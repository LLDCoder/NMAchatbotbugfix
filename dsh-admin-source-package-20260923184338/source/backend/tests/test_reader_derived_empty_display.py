"""Saved round29 EN plus explicitly offline AR/structural negative controls."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.generic_reader import GenericResult, clean, render_generic_answer
from app.reader_previous_answer import completed_previous_result, project_previous_answer, render_previous_answer
from app.reader_empty_display_proof import SCHEMA, _restore
from app.service import DSHService

RAW = json.loads(Path(__file__).with_name('fixtures').joinpath('c08_empty_display_v38.json').read_text())
PAGE = '/licensing/applications'
CATALOG = [{'routes': [PAGE], 'businessNavigation': RAW['followResult']['previousAnswer']['navigation']}]


def envelope(prior=None, answer=None, bad_owner=False):
    prior = deepcopy(RAW['priorResult']) if prior is None else prior
    def event(kind, data, owner='controlled-owner'):
        return SimpleNamespace(event_type=kind, event_json=data, conversation_id=RAW['conversationId'],
                               tenant_id='controlled-tenant', user_id=owner)
    rid = prior['requestId']
    latest = event('user.message', {'requestId': RAW['followResult']['requestId']}, 'other' if bad_owner else 'controlled-owner')
    events = [event('user.message', {'requestId': rid}), event('reader.result', prior),
              event('assistant.message', {'requestId': rid, 'content': RAW['priorAnswer'] if answer is None else answer}),
              event('turn.completed', {'requestId': rid}), latest]
    return completed_previous_result(events, latest)


def project(prior=None, answer=None, **changes):
    env = envelope(prior, answer)
    state = env['result']['intentState']
    args = {'fingerprint': state['principalFingerprint'], 'catalog_version': state['catalogVersion'],
            'catalog': deepcopy(CATALOG), 'authorized': lambda route: True}
    args.update(changes)
    return project_previous_answer(env, 'simplify_navigation', **args)


def test_actual_round29_old_failure_is_reproduced_without_reclassifying_business_result():
    assert render_generic_answer(RAW['priorResult'], 'en') == RAW['priorAnswer']
    assert render_previous_answer(RAW['followResult']['previousAnswer'], 'en') == RAW['followAnswer']
    assert RAW['followAnswer'].count('no matching rows.') == 2
    assert RAW['priorResult']['outputs'][0]['evidence'][0]['derivation']['referenceUtc'] not in RAW['followAnswer']


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_complete_original_public_blocks_and_both_times_survive_real_transport(language):
    before = deepcopy(RAW)
    value = project()
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    assert value['outputs'] == RAW['priorResult']['outputs']
    payload = _restore(value['publicDisplayProof']['sourceNodes'])
    assert payload['projection']['outputs'] == RAW['priorResult']['outputs']
    assert payload['source']['requirements'] == RAW['priorResult']['requirements']
    original = '\n'.join(payload['display']['sourceAnswerLines'])
    assert original == RAW['priorAnswer']
    for block in payload['display']['publicBlocks']:
        span = block['sourceSpan']
        assert original[span['start']:span['end']] == block['quote']
    answer = render_previous_answer(value, language)
    assert ('Unit:' if language == 'en' else 'Unit:') not in answer
    assert ('Limitations:' if language == 'en' else 'Limitations:') not in answer
    assert answer.count('no matching rows.' if language == 'en' else 'لم توجد صفوف مطابقة.') == 1
    assert all(o['label'] in answer for o in value['outputs'])
    assert value['observedAt'][0] in answer
    assert RAW['priorResult']['outputs'][0]['evidence'][0]['derivation']['referenceUtc'] in answer
    assert '[Applications](/licensing/applications)' in answer
    assert 'Application No.' in answer and 'Manager' in answer
    assert 'runtime approval department' not in answer and 'external approval' not in answer
    if language == 'en':
        assert 'Each application has one row in your Licensing To Do queue.' in answer
        assert 'not cover all Licensing work in the department' in answer
        assert 'does not make it a team queue' in answer
        assert 'do not prove the list is complete' in answer
    for carrier in [GenericResult(clean({'previousAnswer': value}, max_items=200)).public_json(),
                    DSHService.audit_payload({'previousAnswer': value})]:
        transported = json.loads(json.dumps(carrier, sort_keys=True))
        assert transported['previousAnswer']['publicDisplayProof'] == value['publicDisplayProof']
        assert render_generic_answer(transported, language) == answer
    assert RAW == before


@pytest.mark.parametrize('mutation', ['principal', 'catalog', 'route', 'history_owner'])
def test_existing_authority_guards_precede_all_display_proofs(mutation):
    if mutation == 'history_owner':
        assert not envelope(bad_owner=True)
        return
    value = project(**({'fingerprint': 'other'} if mutation == 'principal' else
                       {'catalog_version': 'other'} if mutation == 'catalog' else
                       {'authorized': lambda route: False}))
    assert value['verified'] is False and 'publicDisplayProof' not in value


@pytest.mark.parametrize('fault', ['source', 'operation', 'principal', 'capture', 'context', 'receipt', 'fields',
                                  'scope-requirement', 'unknown', 'partial', 'nonempty', 'missing-derivation',
                                  'nonzero-calculation', 'unknown-calculation', 'missing-definition', 'bad-definition-hash',
                                  'different-definition', 'reference-time', 'input-hash', 'truncated-derivation', 'extra-derivation-key'])
def test_empty_values_alone_never_allow_new_complete_display(fault):
    prior = deepcopy(RAW['priorResult']); output = prior['outputs'][1]
    ref = output['evidence'][0]; proof = output['emptyListProof']['sources'][0]; der = ref['derivation']
    if fault == 'source': ref['sourceId'] = proof['sourceId'] = 'other'
    elif fault == 'operation': ref['operationRef'] = proof['operationRef'] = 'GET /other'
    elif fault == 'principal': ref['principalScopeRef'] = 'other'
    elif fault == 'capture': ref['capturedAt'] = '2020-01-01T00:00:00Z'
    elif fault == 'context': proof['contextRef'] = 'a' * 64
    elif fault == 'receipt': proof['receiptHash'] = 'b' * 64
    elif fault == 'fields': output['fieldLabels']['other'] = 'Other'
    elif fault == 'scope-requirement': output['requirementIds'].append('filter_x')
    elif fault == 'unknown': output['unknownCount'] = 1
    elif fault == 'partial': output['dataCompleteness'] = 'bounded'
    elif fault == 'nonempty': output['value'] = [{'applicationNumber': 'OTHER'}]
    elif fault == 'missing-derivation': ref.pop('derivation')
    elif fault == 'nonzero-calculation': der['fieldDiagnostics']['sla']['computedRows'] = 1
    elif fault == 'unknown-calculation': der['kind'] = 'unrecognized'
    elif fault == 'missing-definition': der['definitions'] = []
    elif fault == 'bad-definition-hash': der['definitions'][0]['definitionHash'] = 'unknown'
    elif fault == 'different-definition': der['definitions'][0]['definitionHash'] = 'c' * 64
    elif fault == 'reference-time': der['referenceUtc'] = '2020-01-01T00:00:00Z'
    elif fault == 'input-hash': der['inputProjectionHash'] = 'd' * 64
    elif fault == 'truncated-derivation': der['definitions'][0]['revision'] = '[max-depth]'
    elif fault == 'extra-derivation-key': der['unreviewed'] = 'an extra rule'
    value = project(prior, render_generic_answer(prior, 'en'))
    assert value.get('publicDisplayProof', {}).get('schemaVersion') != SCHEMA


@pytest.mark.parametrize('key,index', [('grain', None), ('caveats', 0), ('caveats', 1)])
@pytest.mark.parametrize('residue', [' Only records from today.', ' Except external approvals.',
                                    ' If the account has approval authority.', ' This also includes all departments.'])
def test_unknown_tail_preserves_entire_public_clause(key, index, residue):
    prior = deepcopy(RAW['priorResult'])
    claim = prior['context'][key] if index is None else prior['context'][key][index]
    claim['value'] += residue
    value = project(prior, render_generic_answer(prior, 'en'))
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    assert claim['value'] in render_previous_answer(value, 'en')


@pytest.mark.parametrize('owner,reference,key', [('personal', 'the displayed Reference Code is the public row reference', 'system'),
                                              ("authenticated user's", 'the public row reference is Reference Code', 'entity')])
def test_structural_owner_and_reference_order_without_case_or_label_template(owner, reference, key):
    prior = deepcopy(RAW['priorResult'])
    prior['context']['grain']['value'] = f'One row for each application in the {owner} Licensing To Do queue, identified by the application {key} key; {reference}.'
    for output in prior['outputs']:
        output['label'] = 'Public results' if output['role'] == 'detail' else 'Source rows'
        output['fieldLabels']['applicationNumber'] = 'Reference Code'
    value = project(prior, render_generic_answer(prior, 'en'))
    answer = render_previous_answer(value, 'en')
    assert f'The {key} key identifies the application; Reference Code is the reference shown.' in answer
    assert 'Public results' in answer and 'Source rows' in answer


@pytest.mark.parametrize('field', ['reference', 'observation', 'scope', 'route', 'label', 'source', 'proof-hash', 'proof-node', 'duplicate-node'])
def test_consumed_proof_and_original_projection_are_rechecked(field):
    value = project()
    if field == 'reference': value['outputs'][0]['evidence'][0]['derivation']['referenceUtc'] = '2020-01-01T00:00:00Z'
    elif field == 'observation': value['observedAt'] = ['2020-01-01T00:00:00Z']
    elif field == 'scope': value['context']['scope'] = 'global'
    elif field == 'route': value['navigation'][0]['route'] = '/other'
    elif field == 'label': value['outputs'][0]['label'] = 'All departments'
    elif field == 'source': value['sourceRequestId'] = 'other'
    elif field == 'proof-hash': value['publicDisplayProof']['contentHash'] = 'f' * 64
    elif field == 'proof-node': value['publicDisplayProof']['sourceNodes'][0][0][0] = '/not-root'
    elif field == 'duplicate-node': value['publicDisplayProof']['sourceNodes'][0].append(deepcopy(value['publicDisplayProof']['sourceNodes'][0][0]))
    assert 'cannot verify' in render_previous_answer(value, 'en')


@pytest.mark.parametrize('replacement', ['another user\'s', 'global', 'team'])
def test_unknown_owner_is_literal_not_reinterpreted_as_personal(replacement):
    prior = deepcopy(RAW['priorResult'])
    claim = prior['context']['grain']
    claim['value'] = claim['value'].replace("authenticated user's", replacement)
    value = project(prior, render_generic_answer(prior, 'en'))
    assert claim['value'] in render_previous_answer(value, 'en')


def test_original_calculation_line_cannot_be_dropped_or_retimed():
    original = RAW['priorAnswer']
    time = RAW['priorResult']['outputs'][0]['evidence'][0]['derivation']['referenceUtc']
    for answer in [original.replace(f'Calculation reference time: {time}.\n', ''), original.replace(time, '2020-01-01T00:00:00Z')]:
        assert 'publicDisplayProof' not in project(answer=answer)


@pytest.mark.parametrize('fault', ['nonzero', 'bool-count', 'naive-time', 'unknown-kind', 'missing-input-field',
                                  'duplicate-field', 'wrong-snapshot-type', 'missing-hash', 'truncated-definition'])
def test_identical_but_invalid_derivations_are_not_proved_by_equality(fault):
    prior = deepcopy(RAW['priorResult'])
    for output in prior['outputs']:
        der = output['evidence'][0]['derivation']
        if fault == 'nonzero': der['fieldDiagnostics']['sla']['computedRows'] = 1
        elif fault == 'bool-count': der['fieldDiagnostics']['sla']['computedRows'] = False
        elif fault == 'naive-time': der['referenceUtc'] = '2026-09-29T00:44:53'
        elif fault == 'unknown-kind': der['kind'] = 'new_transform'
        elif fault == 'missing-input-field': der['inputFields'] = []
        elif fault == 'duplicate-field': der['inputFields'].append(der['inputFields'][0])
        elif fault == 'wrong-snapshot-type': der['snapshotIsolation'] = 'false'
        elif fault == 'missing-hash': der['definitions'][0].pop('definitionHash')
        elif fault == 'truncated-definition': der['definitions'][0]['revision'] = '[max-depth]'
    assert 'publicDisplayProof' not in project(prior, render_generic_answer(prior, 'en'))


def test_actual_database_history_boundary_uses_original_complete_result_not_truncated_followup():
    persisted = json.loads(json.dumps(DSHService.audit_payload(RAW['priorResult']), sort_keys=True))
    assert persisted == RAW['priorResult']
    value = project(persisted)
    assert value['publicDisplayProof']['schemaVersion'] == SCHEMA
    after = json.loads(json.dumps(DSHService.audit_payload({'previousAnswer': value}), sort_keys=True))
    assert render_generic_answer(after, 'en') == render_previous_answer(value, 'en')
    # A random leaf replaced by the truncation marker is not a recognized
    # complete or real-audit transport representation.
    altered = deepcopy(value)
    altered['outputs'][0]['evidence'][0]['derivation']['referenceUtc'] = '[max-depth]'
    assert 'cannot verify' in render_previous_answer(altered, 'en')


@pytest.mark.parametrize('change', ['negation', 'reference-identity', 'view', 'scope', 'extra-requirement'])
def test_unsupported_statement_or_typed_requirement_cannot_gain_new_semantics(change):
    prior = deepcopy(RAW['priorResult'])
    if change == 'negation':
        prior['context']['caveats'][0]['value'] = prior['context']['caveats'][0]['value'].replace('does not turn', 'does turn')
        preserved = prior['context']['caveats'][0]['value']
    elif change == 'reference-identity':
        prior['context']['grain']['value'] = prior['context']['grain']['value'].replace('application entity key', 'Application No. unique key')
        preserved = prior['context']['grain']['value']
    else:
        if change == 'extra-requirement': prior['requirements'].append({'kind': 'filter', 'id': 'filter_0', 'value': 'today'})
        else: next(r for r in prior['requirements'] if r['kind'] == change)['value'] = 'global' if change == 'scope' else 'other'
        preserved = prior['context']['grain']['value']
    value = project(prior, render_generic_answer(prior, 'en'))
    assert preserved in render_previous_answer(value, 'en')


@pytest.mark.parametrize('kind', ['query_scope', 'simplify_navigation'])
def test_nonempty_and_non_simplification_paths_are_not_reclassified(kind):
    prior = deepcopy(RAW['priorResult'])
    if kind == 'simplify_navigation':
        for output in prior['outputs']: output['value'] = [{'applicationNumber': 'CONTROLLED-NONEMPTY'}]
    env = envelope(prior, render_generic_answer(prior, 'en'))
    state = prior['intentState']
    value = project_previous_answer(env, kind, state['principalFingerprint'], state['catalogVersion'], CATALOG, lambda route: True)
    assert value.get('publicDisplayProof', {}).get('schemaVersion') != SCHEMA


def test_flat_encoding_does_not_bypass_original_sensitive_key_redaction():
    prior = deepcopy(RAW['priorResult'])
    for output in prior['outputs']:
        output['evidence'][0]['apiKey'] = 'CONTROLLED-SECRET'
    value = project(prior, render_generic_answer(prior, 'en'))
    assert 'publicDisplayProof' not in value


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_controlled_full_pipeline_adds_no_stage_or_business_read(tmp_path, language):
    import asyncio
    from app.generic_reader import GenericKnowledgeReader, digest
    from app.principal import Principal
    from app.portal_reader import permission_audit_summary, permission_context_from_user_info
    from test_generic_reader_v3 import Gateway
    from test_reader_previous_answer import presentation_task, SIMPLE
    from test_reader_session_scope import source
    data = json.dumps([{'name': 'Applications', 'routes': [{'path': PAGE, 'title': 'Applications', 'isMenu': True}]}]).encode()
    (tmp_path / 'page-catalog.json').write_bytes(data)
    auth = source(listSysPermission=[{'frontendRoute': PAGE}])
    fingerprint = digest(['self-1', 'tenant', permission_audit_summary(permission_context_from_user_info(auth))['fingerprint']])
    prior = deepcopy(RAW['priorResult'])
    # Controlled owner/catalog wiring, never a claim of new real business QA.
    prior['intentState']['principalFingerprint'] = fingerprint
    prior['intentState']['catalogVersion'] = hashlib.sha256(data).hexdigest()
    for output in prior['outputs']:
        for ref in output['evidence']: ref['principalScopeRef'] = fingerprint
    env = {'schemaVersion': 'completed-prior-answer/1', 'requestId': prior['requestId'],
           'result': prior, 'originalAnswer': RAW['priorAnswer']}
    question = SIMPLE if language == 'en' else 'يرجى شرح تلك الإجابة بكلمات أبسط وإعطائي مسار التنقل إلى الصفحة.'
    calls = []
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            assert 'runtime approval department' not in json.dumps(data)
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
            raise AssertionError('No knowledge lookup')
    gateway = Auth(); reader = Reader(gateway, Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    result = asyncio.run(reader.run(Principal('self-1', 'tenant', 'new-request'), question,
        conversation_context={'completedPreviousAnswer': env, 'responseLanguage': language})).result.public_json()
    assert result['result'] == 'success', result.get('missing')
    proof = result['previousAnswer']['publicDisplayProof']
    assert proof['schemaVersion'] == SCHEMA
    assert '\n'.join(_restore(proof['sourceNodes'])['display']['sourceAnswerLines']) == RAW['priorAnswer']
    assert result['previousAnswer']['sourceRequestId'] == prior['requestId']
    assert calls == (['task'] if language == 'en' else ['input_normalization', 'task'])
    assert gateway.auth_calls == 1
    assert result['intentState']['originalQuestion'] == prior['intentState']['originalQuestion']
    text = render_generic_answer(result, language)
    assert text.count('no matching rows.' if language == 'en' else 'لم توجد صفوف مطابقة.') == 1
    assert 'runtime approval department' not in text
