"""Actual round28 transport, finite grammar and adversarial semantic controls."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.generic_reader import GenericResult, clean, render_generic_answer
from app.reader_previous_answer import completed_previous_result, project_previous_answer, render_previous_answer
from app.reader_previous_display import public_empty_display, _hash
from app.reader_public_rewrite import SCHEMA, SOURCE_KEY

RAW = json.loads(Path(__file__).with_name('fixtures').joinpath('c08_readable_clauses_v37.json').read_text())
PAGE = '/licensing/applications'
CATALOG = [{'routes': [PAGE], 'businessNavigation': RAW['followResult']['previousAnswer']['navigation']}]


def envelope(prior=None, answer=None):
    prior = deepcopy(RAW['priorResult']) if prior is None else prior
    # Captured audit export has no ORM owner columns. Supply explicit controlled
    # owner wiring, while keeping the captured result/RIDs/text unchanged.
    def event(kind, data):
        return SimpleNamespace(event_type=kind, event_json=data, conversation_id=RAW['conversationId'],
                               tenant_id='controlled-tenant', user_id='controlled-owner')
    rid = prior['requestId']
    latest = event('user.message', {'requestId': RAW['followRequestId']})
    history = [event('user.message', {'requestId': rid}), event('reader.result', prior),
               event('assistant.message', {'requestId': rid, 'content': RAW['priorAnswer'] if answer is None else answer}),
               event('turn.completed', {'requestId': rid}), latest]
    return completed_previous_result(history, latest)


def project(prior=None, answer=None, kind='simplify_navigation', **changes):
    env = envelope(prior, answer)
    state = env['result']['intentState']
    args = {'fingerprint': state['principalFingerprint'], 'catalog_version': state['catalogVersion'],
            'catalog': deepcopy(CATALOG), 'authorized': lambda route: True}
    args.update(changes)
    return project_previous_answer(env, kind, **args)


def base(value):
    proof = value['publicDisplayProof']
    return proof.get('originalDisplayProof', proof)


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_actual_round28_transport_simplifies_whole_clauses_and_keeps_original_proof(language):
    before = deepcopy(RAW)
    value = project(); proof = value['publicDisplayProof']
    assert proof['schemaVersion'] == SCHEMA
    assert proof['originalDisplayProof'] == RAW['followResult']['previousAnswer']['publicDisplayProof']
    assert value['outputs'] == RAW['priorResult']['outputs']
    assert value['context'] == RAW['followResult']['previousAnswer']['context']
    transported = json.loads(json.dumps(GenericResult(clean({'previousAnswer': value}, max_items=1000)).public_json()))
    assert transported['previousAnswer'] == value
    answer = render_generic_answer(transported, language)
    assert answer == render_previous_answer(value, language)
    assert 'Unit:' not in answer and 'Population:' not in answer
    assert value['observedAt'][0] in answer and '[Applications](/licensing/applications)' in answer
    assert 'Application No.' in answer and 'Manager' in answer
    assert all(member in answer for member in ('pending modification', 'external approval', 'pending review'))
    assert 'runtime approval department' not in answer
    if language == 'en':
        assert answer.startswith('Your personal Licensing To Do queue had no matching applications.')
        assert 'The system key identifies the application; Application No. is the reference shown.' in answer
        assert 'This list uses one row per application.' in answer
        assert 'All records in that queue were checked.' in answer
        assert 'This queue of pending tasks includes pending modification, external approval and pending review.' in answer
        assert 'A Manager role does not make this personal queue a team queue.' in answer
        assert 'summary counts come from a separate source; they do not prove the list is complete.' in answer
        assert 'not refreshed and grants no additional record access.' in answer
        assert answer.count('no matching') == 1
        assert not any(x in answer for x in ('only pending', 'unique Application No.', 'You are a Manager', 'currently has no'))
    plan = proof['rewritePlan']
    assert len(plan['entries']) == len(base(value)['publicBlocks']) == 5
    assert [e['action'] for e in plan['entries']] == ['covered', 'rewrite', 'rewrite', 'rewrite', 'rewrite']
    assert {e.get('rule') for e in plan['entries']} == {None, 'row_grain', 'scoped_population', 'separate_counter_not_completeness', 'role_does_not_expand_scope'}
    for e, block in zip(plan['entries'], base(value)['publicBlocks']):
        assert e['sourceSpan'] == block['sourceSpan'] and e['atoms']
        span = e['sourceSpan']; assert RAW['priorAnswer'][span['start']:span['end']] == block['quote']
    assert RAW == before


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_original_source_language_is_preserved_and_ar_sample_is_offline_only(language):
    original = render_generic_answer(RAW['priorResult'], language)
    value = project(answer=original)
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    assert base(value)['sourceLanguage'] == language
    assert base(value)['sourceAnswerSHA256'] == hashlib.sha256(original.encode()).hexdigest()
    assert '\n'.join(base(value)['sourceAnswerLines']) == original
    assert 'cannot verify' not in render_previous_answer(value, 'en')


def test_round27_remains_the_same_public_block_contract():
    from test_reader_public_simplification import project as old_project, RAW as OLD
    value = old_project()
    assert value['publicDisplayProof']['schemaVersion'] == 'previous-public-empty-display/1'
    assert SOURCE_KEY not in value
    assert value['publicDisplayProof'] == public_empty_display(deepcopy(value), OLD['priorAnswer'])


@pytest.mark.parametrize('obj,qualifier,view,role,field,key', [
    ('record', 'Services', 'Pending', 'Supervisor', 'Record Ref.', 'system'),
    ('complaint', 'Customer Support', 'My Work', 'Regional Auditor', 'Complaint Code', 'entity'),
    ('permit', 'Licensing', 'To Do', 'Reviewer', 'Permit Number', 'system'),
])
def test_other_object_view_role_field_and_source_are_bound_not_hardcoded(obj, qualifier, view, role, field, key):
    prior = deepcopy(RAW['priorResult'])
    context = prior['context']; queue = qualifier + ' ' + view + ' queue'
    context['grain']['value'] = f'One row for each {obj} in the personal {queue}, identified by the {obj} {key} key; the displayed {field} is the public row reference.'
    context['population']['value'] = f"Complete {view} pending-work queue of the authenticated user's {qualifier} {obj} tasks, including pending verification and internal inspection as well as external submission."
    context['caveats'][0]['value'] = f'The {view} summary counters are a separate count source and do not prove list completeness.'
    context['caveats'][1]['value'] = f'A {role} role does not turn this personal queue into a global queue.'
    for claim in [context['grain'], context['population'], *context['caveats']]:
        claim['evidence'] = [{'sourceId': 'controlled_other_page_clause:17'}]
    for req in prior['requirements']:
        if req['kind'] in {'object', 'grain'}: req['value'] = obj
        elif req['kind'] == 'view': req['value'] = view.lower().replace(' ', '')
    for output in prior['outputs']:
        output['label'] = f'Distinct {obj}s in the {view} queue' if output['role'] == 'detail' else queue + ' rows'
        output['fieldLabels'] = {'publicReference': field}
        output['evidence'][0]['sourceId'] = output['emptyListProof']['sources'][0]['sourceId'] = 'other_source'
    value = project(prior, render_generic_answer(prior, 'en'))
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    answer = render_previous_answer(value, 'en')
    assert f'Your personal {queue} had no matching {obj}s.' in answer
    assert f'The system key identifies the {obj}; {field} is the reference shown.' in answer
    assert f'A {role} role does not make this personal queue a global queue.' in answer
    assert 'pending verification, internal inspection and external submission' in answer
    assert 'Application No.' not in answer and 'Manager role' not in answer


CLAUSES = [('grain', None), ('population', None), ('caveats', 0), ('caveats', 1)]


@pytest.mark.parametrize('key,index', CLAUSES)
@pytest.mark.parametrize('residue', [
    ' Only records submitted today are included.',
    ' Except for external approval.',
    ' This applies after 2024-01-01.',
    ' This also covers the team review queue.',
    ' A different person owns the external tasks.',
    ' The second reference is Permit No.',
    ' If the account has approval authority.',
    ' No approval is implied.',
])
def test_extra_sentence_or_condition_preserves_whole_original_block(key, index, residue):
    prior = deepcopy(RAW['priorResult'])
    claim = prior['context'][key] if index is None else prior['context'][key][index]
    claim['value'] += residue
    value = project(prior, render_generic_answer(prior, 'en'))
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    entry = next(e for e in value['publicDisplayProof']['rewritePlan']['entries'] if e['sourceClaim']['value'] == claim['value'])
    assert entry['action'] == 'literal'
    assert claim['value'] in render_previous_answer(value, 'en')


@pytest.mark.parametrize('old,new', [
    ('One row per application', 'Only one row per application'),
    ('personal Licensing To Do', 'personal Licensing Review'),
    ('application entity key', 'Application No. unique key'),
    ('displayed Application No.', 'displayed Unknown Ref.'),
    ('Complete To Do', 'Part of the To Do'),
    ('including pending modification', 'including only pending modification'),
    ('pending modification and', 'pending modification except approved ones and'),
    ('external approval as well as', 'external approval on Monday as well as'),
    ('pending review.', 'pending review and pending inspection.'),
    ('authenticated user\'s', 'another user\'s'),
    ('Licensing application tasks', 'Licensing permit tasks'),
    ('separate count source and do not', 'count source and do'),
    ('does not turn', 'does turn'),
    ('A Manager role', 'Your Manager role'),
])
def test_changed_operator_member_owner_object_and_field_cannot_use_partial_match(old, new):
    prior = deepcopy(RAW['priorResult']); changed = []
    for claim in [prior['context']['grain'], prior['context']['population'], *prior['context']['caveats']]:
        if old in claim['value']:
            claim['value'] = claim['value'].replace(old, new); changed.append(claim['value'])
    assert changed
    value = project(prior, render_generic_answer(prior, 'en'))
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    for text in changed:
        entry = next(e for e in value['publicDisplayProof']['rewritePlan']['entries'] if e['sourceClaim']['value'] == text)
        assert entry['action'] == 'literal'
        assert text in render_previous_answer(value, 'en')


@pytest.mark.parametrize('mutation', ['requirement_view', 'requirement_object', 'extra_requirement', 'requirement_scope',
    'unknown_requirement_id', 'output_view', 'output_scope', 'output_object', 'no_clause_evidence'])
def test_typed_context_mismatch_never_generates_simpler_claims(mutation):
    prior = deepcopy(RAW['priorResult'])
    if mutation.startswith('requirement_'):
        key = mutation.removeprefix('requirement_')
        next(r for r in prior['requirements'] if r['kind'] == key)['value'] = 'different'
    elif mutation == 'extra_requirement': prior['requirements'].append({'kind': 'filter', 'id': 'filter', 'value': 'approved'})
    elif mutation == 'unknown_requirement_id': prior['outputs'][0]['requirementIds'][0] = 'other'
    elif mutation == 'output_view': prior['outputs'][1]['label'] = 'Licensing Review queue rows'
    elif mutation == 'output_scope': prior['outputs'][0]['label'] = 'All departments applications'
    elif mutation == 'output_object': prior['outputs'][0]['label'] = 'Distinct permits in the To Do queue'
    else:
        for claim in [prior['context']['grain'], prior['context']['population'], *prior['context']['caveats']]: claim['evidence'] = []
    value = project(prior, render_generic_answer(prior, 'en'))
    assert value.get('publicDisplayProof', {}).get('schemaVersion') != SCHEMA
    assert SOURCE_KEY not in value


@pytest.mark.parametrize('mutation', ['object', 'field', 'queue', 'role', 'scope', 'members_only', 'member_missing',
    'target_text', 're_signed_wrong_answer', 'source_evidence', 'source_claim', 'source_span', 'coverage',
    'hidden_public', 'output_group', 'source_hash', 'source_request', 'source_context', 'source_requirement',
    'source_context_evidence', 'original_span', 'original_context_index', 'principal', 'receipt', 'observed_time'])
def test_tampered_parameters_prose_coverage_and_sources_fail_even_with_new_hash(mutation):
    value = project(); proof = value['publicDisplayProof']; plan = proof['rewritePlan']; entries = plan['entries']
    if mutation in {'object', 'field', 'queue'}: entries[1]['parameters'][mutation] = 'forged'
    elif mutation in {'role', 'scope'}: entries[4]['parameters'][mutation] = 'forged'
    elif mutation == 'members_only': entries[2]['members']['rule'] = 'exclusive_members'
    elif mutation == 'member_missing': entries[2]['members']['parameters'].pop()
    elif mutation == 'target_text': entries[1]['targetText'] = 'Application No. is the unique entity key.'
    elif mutation == 're_signed_wrong_answer':
        base(value)['sourceAnswerLines'][-1] = 'A Manager has no team permissions.'
        base(value)['sourceAnswerSHA256'] = hashlib.sha256('\n'.join(base(value)['sourceAnswerLines']).encode()).hexdigest()
    elif mutation == 'source_evidence': entries[1]['sourceClaim']['evidence'][0]['sourceId'] = 'other'
    elif mutation == 'source_claim': entries[2]['sourceClaim']['value'] += ' Only these tasks.'
    elif mutation == 'source_span': entries[1]['sourceSpan']['end'] -= 1
    elif mutation == 'coverage': entries[1]['action'] = 'covered'
    elif mutation == 'hidden_public': base(value)['publicBlocks'].append({'kind': 'filterScope', 'quote': value['context']['filterScope'], 'sourceSpan': {'start': 0, 'end': 1}})
    elif mutation == 'output_group': plan['emptyOutputIds'].pop()
    elif mutation == 'source_hash': proof['sourceBindingHash'] = 'a' * 64
    elif mutation == 'source_request': value[SOURCE_KEY]['sourceRequestId'] = 'other'
    elif mutation == 'source_context': value[SOURCE_KEY]['context']['scope'] = 'global'
    elif mutation == 'source_requirement': value[SOURCE_KEY]['requirements'][-1]['value'] = 'review'
    elif mutation == 'source_context_evidence': value[SOURCE_KEY]['context']['grain']['evidence'][0]['sourceId'] = 'different'
    elif mutation == 'original_span': base(value)['publicBlocks'][1]['sourceSpan']['end'] += 1
    elif mutation == 'original_context_index': base(value)['publicBlocks'][-1]['contextIndex'] = 0
    elif mutation == 'principal': value['principalScopeRef'] = 'other'
    elif mutation == 'receipt': value['outputs'][0]['emptyListProof']['sources'][0]['receiptHash'] = 'a' * 64
    else: value['observedAt'] = ['2028-01-01T00:00:00Z']
    # An arbitrary extra re-signature never licenses prose or modified slots.
    # For source mutations re-sign the actual source hash as well: source/plan
    # agreement and typed bindings, not a digest alone, must still reject them.
    if mutation.startswith('source_') and mutation != 'source_hash': proof['sourceBindingHash'] = _hash(value[SOURCE_KEY])
    text = render_previous_answer(value, 'en')
    assert 'cannot verify' in text and 'had no matching' not in text


def test_unrecognized_long_limit_is_never_truncated_or_removed():
    prior = deepcopy(RAW['priorResult'])
    limitation = 'Only pending work is described, never approval authority. ' * 70
    prior['context']['caveats'].append({'value': limitation.strip(), 'evidence': [{'sourceId': 'long_clause'}]})
    value = project(prior, render_generic_answer(prior, 'en'))
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    assert limitation.strip() in render_previous_answer(value, 'en')


@pytest.mark.parametrize('kind', ['simplify', 'simplify_navigation'])
@pytest.mark.parametrize('damage', ['bounded', 'nonempty', 'unstable', 'date', 'different_source'])
def test_existing_empty_complete_gate_cannot_be_expanded(kind, damage):
    value = deepcopy(RAW['followResult']['previousAnswer']); value.pop('publicDisplayProof')
    value['kind'] = kind
    if damage == 'bounded': value['completeness'] = 'bounded'
    elif damage == 'nonempty': value['outputs'][0]['value'] = [{'id': 'a'}]
    elif damage == 'unstable': value['outputs'][0]['emptyListProof']['sources'][0]['stablePasses'] = 1
    elif damage == 'date': value['context']['time'] = '2024-01-01'
    else:
        value['outputs'][1]['evidence'][0]['sourceId'] = 'other'
        value['outputs'][1]['emptyListProof']['sources'][0]['sourceId'] = 'other'
    assert public_empty_display(value, RAW['priorAnswer'], RAW['priorResult']) is None
    assert SOURCE_KEY not in value


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_query_scope_keeps_existing_projection_and_text(language):
    before = deepcopy(RAW)
    value = project(kind='query_scope')
    assert value['verified'] and 'publicDisplayProof' not in value and SOURCE_KEY not in value
    # The accepted C05 contract carries whole public clauses and explicitly
    # marks unavailable explanations; it cannot expose this old internal phrase.
    text = render_previous_answer(value, language)
    proof = value['publicQueryContext']
    assert proof['status'] == 'partial' and 'filterScope' in proof['missing']
    assert 'runtime approval department' not in text
    assert RAW['priorResult']['context']['filterScope']['value'] not in text
    assert ('the full filtering conditions' if language == 'en' else 'شروط التصفية الكاملة') in text
    # query_scope has never repeated the prior business output rows.
    assert value['outputs'] == [] and value['liveDataRead'] is False
    assert value['context'] == RAW['followResult']['previousAnswer']['context']
    assert RAW['priorResult']['result'] == 'success' and RAW['priorResult']['missing'] == []
    item = next(item for item in proof['items'] if item['path'] == 'filterScope')
    assert item['status'] == 'unavailable' and 'text' not in item
    assert value['observedAt'][0] in text and '[Applications](/licensing/applications)' in text
    assert RAW['priorResult']['context']['population']['value'] in text
    for caveat in RAW['priorResult']['context']['caveats']:
        assert caveat['value'] in text
    assert RAW == before


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_pipeline_has_no_extra_model_knowledge_or_business_calls(tmp_path, language):
    import asyncio
    from app.generic_reader import GenericKnowledgeReader, digest
    from app.principal import Principal
    from app.portal_reader import permission_audit_summary, permission_context_from_user_info
    from test_generic_reader_v3 import Gateway
    from test_reader_previous_answer import presentation_task, SIMPLE
    from test_reader_session_scope import source
    catalog = [{'name': 'Applications', 'routes': [{'path': PAGE, 'title': 'Applications', 'isMenu': True}]}]
    data = json.dumps(catalog).encode(); (tmp_path / 'page-catalog.json').write_bytes(data)
    auth = source(listSysPermission=[{'frontendRoute': PAGE}])
    fingerprint = digest(['self-1', 'tenant', permission_audit_summary(permission_context_from_user_info(auth))['fingerprint']])
    prior = deepcopy(RAW['priorResult'])
    prior['intentState']['principalFingerprint'] = fingerprint
    prior['intentState']['catalogVersion'] = hashlib.sha256(data).hexdigest()
    for output in prior['outputs']:
        for ref in output['evidence']: ref['principalScopeRef'] = fingerprint
    env = envelope(prior)
    question = SIMPLE if language == 'en' else 'يرجى شرح تلك الإجابة بكلمات أبسط وإعطائي مسار التنقل إلى الصفحة.'
    calls = []
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            serialized = json.dumps(data)
            assert 'entity key' not in serialized and 'summary counters' not in serialized
            stage = schema['properties']['stage']['const']; calls.append(stage)
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': question, 'english': SIMPLE}]}
            assert stage == 'task'
            return presentation_task().model_dump()
    class Auth(Gateway):
        auth_calls = 0
        async def get_user_info(self, principal):
            self.auth_calls += 1
            return {'ok': True, 'result': auth}
        async def admin_portal_read(self, *args, **kwargs):
            raise AssertionError('No new business read')
    class Reader(GenericKnowledgeReader):
        async def search(self, *args, **kwargs):
            raise AssertionError('No new knowledge read')
    gateway = Auth(); reader = Reader(gateway, Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    value = asyncio.run(reader.run(Principal('self-1', 'tenant', 'new-request'), question,
        conversation_context={'completedPreviousAnswer': env, 'responseLanguage': language})).result.public_json()
    assert value['result'] == 'success', value.get('missing')
    assert value['previousAnswer']['publicDisplayProof']['schemaVersion'] == SCHEMA
    assert value['previousAnswer']['sourceRequestId'] == RAW['priorRequestId']
    text = render_generic_answer(value, language)
    assert 'cannot verify' not in text and 'runtime' not in text
    assert calls == (['task'] if language == 'en' else ['input_normalization', 'task'])
    assert gateway.auth_calls == 1
    assert value['intentState']['originalQuestion'] == prior['intentState']['originalQuestion']
