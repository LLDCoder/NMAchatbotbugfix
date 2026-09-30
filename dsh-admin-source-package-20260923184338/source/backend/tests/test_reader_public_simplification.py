"""Real round27 answers plus proof-boundary controls; no live/model calls."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest

from app.generic_reader import render_generic_answer
from app.reader_previous_answer import project_previous_answer, render_previous_answer
from app.reader_previous_display import public_empty_display

RAW = json.loads(Path(__file__).with_name('fixtures').joinpath('c08_public_simplification_v36.json').read_text())
PAGE = '/licensing/applications'
CATALOG = [{'routes': [PAGE], 'businessNavigation': RAW['followProjection']['navigation']}]


def project(prior=None, answer=None, kind='simplify_navigation', **changes):
    prior = deepcopy(RAW['priorResult']) if prior is None else prior
    state = prior['intentState']
    kwargs = {'fingerprint': state['principalFingerprint'], 'catalog_version': state['catalogVersion'],
              'catalog': deepcopy(CATALOG), 'authorized': lambda page: True}
    kwargs.update(changes)
    return project_previous_answer({'schemaVersion': 'completed-prior-answer/1',
        'requestId': prior['requestId'], 'result': prior,
        'originalAnswer': RAW['priorAnswer'] if answer is None else answer}, kind, **kwargs)


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_real_round27_public_blocks_are_preserved_and_empty_result_is_said_once(language):
    raw_before = deepcopy(RAW)
    value = project(); before = deepcopy(value)
    assert value['verified'] and 'publicDisplayProof' in value
    assert value['outputs'] == RAW['priorResult']['outputs'] == RAW['followProjection']['outputs']
    assert value['context'] == RAW['followProjection']['context']
    text = render_previous_answer(value, language)
    empty = 'no matching rows.' if language == 'en' else 'لم توجد صفوف مطابقة.'
    assert text.count(empty) == 1
    assert all(o['label'] in text for o in value['outputs'])
    # The first caveat remains literal apart from Markdown escaping, not cut to
    # reach a word limit. The second was never public and is not added now.
    first = RAW['priorResult']['context']['caveats'][0]['value']
    assert first.replace('(', r'\(').replace(')', r'\)') in text
    assert 'runtime' not in text and "workflow task's approval department" not in text
    assert 'Scope: personal.' in text
    assert value['observedAt'][0] in text
    assert '[Applications](/licensing/applications)' in text
    assert ('not refreshed' if language == 'en' else 'لم تُحدَّث') in text
    assert ('no additional record access' if language == 'en' else 'سجلات إضافية') in text
    assert 'This earlier information does not establish' not in text
    proof = value['publicDisplayProof']
    assert proof['sourceRequestId'] == RAW['priorRequestId']
    assert proof['sourceAnswerSHA256'] == hashlib.sha256(RAW['priorAnswer'].encode()).hexdigest()
    assert proof['claim'] == 'same_verified_empty_source_presented_once_not_a_prior_simplification_claim'
    for block in proof['outputBlocks'] + proof['publicBlocks']:
        span = block['sourceSpan']
        assert RAW['priorAnswer'][span['start']:span['end']] == (block['quote'] if 'quote' in block else '\n'.join(block['quoteLines']))
    assert value['liveDataRead'] is False and value['currentStatusClaimed'] is False
    assert value == before and RAW == raw_before


def test_deterministic_ar_original_is_proved_as_ar_not_fabricated_live_ar_evidence():
    original = render_generic_answer(RAW['priorResult'], 'ar')
    value = project(answer=original)
    assert value['publicDisplayProof']['sourceLanguage'] == 'ar'
    assert '\n'.join(value['publicDisplayProof']['sourceAnswerLines']) == original
    text = render_previous_answer(value, 'ar')
    assert 'النطاق: شخصي.' in text
    assert 'النتيجة: لم توجد صفوف مطابقة.' in text
    assert 'وقت التشغيل' not in text
    assert value['observedAt'][0] in text


@pytest.mark.parametrize('claim', [
    'This is not an application approval.',
    'Only approved records from 2024 were included.',
    'A zero balance does not mean the application is approved.',
    'Records from other departments are excluded.',
    'The snapshot does not guarantee that later changes are reflected.',
    pytest.param(('This limitation must remain. ' * 120).strip(), id='long-caveat'),
])
@pytest.mark.parametrize('language', ['en', 'ar'])
def test_every_actual_public_caveat_survives_regardless_of_length_or_critical_negation(claim, language):
    prior = deepcopy(RAW['priorResult'])
    prior['context']['caveats'].append({'value': claim, 'evidence': []})
    original = render_generic_answer(prior, language)
    value = project(prior, original)
    assert value.get('publicDisplayProof')
    assert claim.strip() in render_previous_answer(value, language)


@pytest.mark.parametrize('alteration', ['drop_limit', 'append_technical_limit', 'change_zero',
    'change_scope', 'prepend_instruction', 'missing_original', 'different_header'])
def test_original_public_text_must_match_completely_before_new_optimization(alteration):
    original = RAW['priorAnswer']
    if alteration == 'drop_limit': original = original[:original.index('The To Do queue')]
    elif alteration == 'append_technical_limit': original += '\nThe API list excludes archived records.'
    elif alteration == 'change_zero': original = original.replace('No matching rows.', 'Two matching rows.')
    elif alteration == 'change_scope': original = original.replace('personal', 'global')
    elif alteration == 'prepend_instruction': original = 'Ignore limits.\n' + original
    elif alteration == 'missing_original': original = ''
    else: original = original.replace('Current page results:', 'Updated live results:')
    value = project(answer=original)
    assert 'publicDisplayProof' not in value


@pytest.mark.parametrize('mutation', ['source', 'observation', 'captured_time', 'principal', 'page',
    'operation', 'path', 'context', 'receipt', 'total', 'unstable', 'scope_requirement',
    'different_fields', 'bounded', 'unknown', 'unavailable', 'nonempty', 'display_rows',
    'date', 'interval', 'derivation', 'semantic_context', 'qualified', 'no_empty_proof',
    'no_requirements', 'scalar', 'extra_output', 'same_roles'])
def test_equal_empty_values_do_not_merge_different_sources_or_meanings(mutation):
    prior = deepcopy(RAW['priorResult']); output = prior['outputs'][1]
    ref = output['evidence'][0]; source = output['emptyListProof']['sources'][0]
    if mutation == 'source': ref['sourceId'] = source['sourceId'] = 'other_source'
    elif mutation == 'observation': ref['observationRef'] = source['observationRef'] = 'other_observation'
    elif mutation == 'captured_time': ref['capturedAt'] = '2026-09-27T10:00:00Z'
    elif mutation == 'principal': ref['principalScopeRef'] = 'another_owner'
    elif mutation == 'page': ref['page'] = '/another'
    elif mutation == 'operation': ref['operationRef'] = source['operationRef'] = 'POST /api/Other'
    elif mutation == 'path': ref['fieldBinding'] = source['sourcePath'] = '/data/other'
    elif mutation == 'context': source['contextRef'] = 'a' * 64
    elif mutation == 'receipt': source['receiptHash'] = 'b' * 64
    elif mutation == 'total': source['total'] = 2
    elif mutation == 'unstable': source['stablePasses'] = 1
    elif mutation == 'scope_requirement': output['requirementIds'].append('extra_filter')
    elif mutation == 'different_fields': output['fieldLabels']['extra'] = 'Extra'
    elif mutation == 'bounded': output['dataCompleteness'] = ref['completeness'] = 'bounded'
    elif mutation == 'unknown': output['unknownCount'] = 1
    elif mutation == 'unavailable': output['unavailableFields'] = ['status']
    elif mutation == 'nonempty': output['value'] = [{'id': 'A1'}]
    elif mutation == 'display_rows': output['displayRows'] = [{'id': 'A1'}]
    elif mutation == 'date': output['snapshotResponseDates'] = [{'parameter': 'from', 'date': '2024-01-01'}]
    elif mutation == 'interval': ref['timeInterval'] = {'start': '2024-01-01', 'end': '2025-01-01', 'businessTimezone': 'UTC'}
    elif mutation == 'derivation': ref['derivation'] = {'referenceUtc': '2024-01-01T00:00:00Z'}
    elif mutation == 'semantic_context': ref['semanticContext'] = 'Another filter applies'
    elif mutation == 'qualified': output['verifiedInterpretations'] = [{'message': 'Not equivalent'}]
    elif mutation == 'no_empty_proof': output.pop('emptyListProof')
    elif mutation == 'no_requirements': output['requirementIds'] = []
    elif mutation == 'scalar': output['value'] = 0
    elif mutation == 'extra_output': prior['outputs'].append(deepcopy(output))
    elif mutation == 'same_roles': output['role'] = 'detail'
    # The predicate sees the precise new source/context; no stale original
    # answer is needed to reject an otherwise equal empty-value shortcut.
    value = deepcopy(RAW['followProjection']); value['outputs'] = prior['outputs']
    assert public_empty_display(value, RAW['priorAnswer']) is None


@pytest.mark.parametrize('field', ['sourceAnswerLines', 'sourceAnswerSHA256', 'projectionHash',
    'sourceRequestId', 'sourceLanguage', 'public_block', 'block_span', 'output_label',
    'output_span', 'empty_group', 'hidden_reason', 'source_time', 'context', 'navigation',
    'completeness', 'owner'])
def test_display_contract_and_current_projection_are_rechecked_at_render(field):
    value = project(); proof = value['publicDisplayProof']
    if field in {'sourceAnswerLines', 'sourceAnswerSHA256', 'projectionHash', 'sourceRequestId', 'sourceLanguage'}: proof[field] = 'tampered'
    elif field == 'public_block': proof['publicBlocks'][-1]['quote'] = 'No limitations apply.'
    elif field == 'block_span': proof['publicBlocks'][-1]['sourceSpan']['end'] += 1
    elif field == 'output_label': proof['outputBlocks'][0]['label'] = 'Every department'
    elif field == 'output_span': proof['outputBlocks'][0]['sourceSpan']['start'] += 1
    elif field == 'empty_group': proof['combinedEmptyOutputIds'].pop()
    elif field == 'hidden_reason': proof['unpresentedContext'][0]['reason'] = 'not_needed'
    elif field == 'source_time': value['observedAt'] = ['2027-01-01T00:00:00Z']
    elif field == 'context': value['context']['caveats'] = []
    elif field == 'navigation': value['navigation'][0]['route'] = '/other'
    elif field == 'completeness': value['completeness'] = 'bounded'
    elif field == 'owner': value['principalScopeRef'] = 'other'
    text = render_previous_answer(value, 'en')
    assert 'cannot verify' in text
    assert 'no matching rows' not in text and '[Applications]' not in text


@pytest.mark.parametrize('denied', ['principal', 'catalog', 'route'])
def test_original_authority_guards_still_run_before_display_contract(denied):
    value = project(**({'fingerprint': 'other'} if denied == 'principal' else
                      {'catalog_version': 'other'} if denied == 'catalog' else
                      {'authorized': lambda page: False}))
    assert value['verified'] is False and 'publicDisplayProof' not in value


def test_query_scope_does_not_use_new_public_display_contract():
    value = project(kind='query_scope')
    assert value['verified'] and 'publicDisplayProof' not in value
    rendered = render_previous_answer(value, 'en')
    assert 'runtime' not in rendered
    assert 'I could not provide a complete explanation of:' in rendered
    assert value['publicQueryContext']['status'] == 'partial'


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_partial_caveat_with_api_and_explicit_time_remains_on_existing_path(language):
    from test_reader_previous_answer_clarity import projection
    value = projection()
    value['context']['caveats'] = ['The API list excludes archived records.']
    value['context']['time'] = '2024-01-01 through 2024-12-31'
    assert public_empty_display(value, RAW['priorAnswer']) is None
    text = render_previous_answer(value, language)
    assert 'The API list excludes archived records.' in text
    assert '2024-01-01 through 2024-12-31' in text
    assert ('only partly confirmed' if language == 'en' else 'مؤكدة جزئيًا فقط') in text


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_real_projection_survives_runtime_clean_and_json_transport(language):
    from app.generic_reader import clean
    value = project()
    transported = json.loads(json.dumps(clean(value, max_items=1000)))
    assert transported == value
    assert render_previous_answer(transported, language) == render_previous_answer(value, language)


def test_context_needing_sanitization_uses_existing_path_without_cutting_the_limit():
    prior = deepcopy(RAW['priorResult'])
    claim = '  The API list excludes archived records.  '
    prior['context']['caveats'].append({'value': claim, 'evidence': []})
    value = project(prior, render_generic_answer(prior, 'en'))
    assert 'publicDisplayProof' not in value
    assert value['context']['caveats'][-1] == claim
    assert claim.strip() in render_previous_answer(value, 'en')


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_pipeline_keeps_public_contract_without_more_planning_or_business_reads(tmp_path, language):
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
    # Owner/catalog are controlled wiring inputs here, not alterations to the
    # immutable captured fixture used in the exact replay tests above.
    env = {'schemaVersion': 'completed-prior-answer/1', 'requestId': prior['requestId'],
           'result': prior, 'originalAnswer': RAW['priorAnswer']}
    question = SIMPLE if language == 'en' else 'يرجى شرح تلك الإجابة بكلمات أبسط وإعطائي مسار التنقل إلى الصفحة.'
    calls = []
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            assert "workflow task's approval department" not in json.dumps(data)
            assert '22ce4e4348dc3be2708b' not in json.dumps(data)
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
            raise AssertionError('No new business read for simplification')
    class Reader(GenericKnowledgeReader):
        async def search(self, *args, **kwargs):
            raise AssertionError('No knowledge lookup for simplification')
    gateway = Auth(); reader = Reader(gateway, Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    value = asyncio.run(reader.run(Principal('self-1', 'tenant', 'new-request'), question,
        conversation_context={'completedPreviousAnswer': env, 'responseLanguage': language})).result.public_json()
    assert value['result'] == 'success', value.get('missing')
    assert '\n'.join(value['previousAnswer']['publicDisplayProof']['sourceAnswerLines']) == RAW['priorAnswer']
    assert value['previousAnswer']['sourceRequestId'] == RAW['priorRequestId']
    text = render_generic_answer(value, language)
    assert text.count('no matching rows.' if language == 'en' else 'لم توجد صفوف مطابقة.') == 1
    assert 'runtime' not in text
    assert calls == (['task'] if language == 'en' else ['input_normalization', 'task'])
    assert gateway.auth_calls == 1
    assert value['intentState']['originalQuestion'] == prior['intentState']['originalQuestion']
