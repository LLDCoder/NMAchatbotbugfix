import asyncio
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.generic_reader import GenericKnowledgeReader, digest, render_generic_answer
from app.principal import Principal
from app.portal_reader import permission_context_from_user_info, permission_audit_summary
from app.reader_partial_answer import observed_partial_result
from app.reader_previous_answer import completed_previous_result, project_previous_answer, query_receipt, render_previous_answer
from test_generic_reader_v3 import Gateway
from test_reader_previous_answer import presentation_task, SIMPLE
from test_reader_session_scope import source


TRACE = json.loads(Path(__file__).with_name('fixtures').joinpath('group15_partial_answer_trace.json').read_text())
PAGE = '/licensing/applications'
CATALOG = [{'name': 'Applications', 'routes': [PAGE],
            'businessNavigation': [{'route': PAGE, 'label': 'Licensing / My Application Tasks'}]}]


def history():
    result = deepcopy(TRACE['result'])
    request = result['requestId']
    def event(kind, data):
        return SimpleNamespace(event_type=kind, event_json=data, conversation_id=TRACE['conversationId'],
            user_id=TRACE['owner']['userId'], tenant_id=TRACE['owner']['tenantId'])
    return [event('user.message', {'requestId': request}), event('reader.result', result),
            event('assistant.message', deepcopy(TRACE['answer'])), event('turn.completed', {'requestId': request}),
            event('user.message', {'requestId': 'new', 'content': SIMPLE})]


def envelope():
    rows = history()
    return completed_previous_result(rows, rows[-1])


def project(env=None, **overrides):
    env = envelope() if env is None else env
    state = TRACE['result']['intentState']
    args = dict(kind='simplify_navigation', fingerprint=state['principalFingerprint'],
                catalog_version=state['catalogVersion'], catalog=CATALOG, authorized=lambda _: True)
    args.update(overrides)
    return project_previous_answer(env, **args)


def test_real_partial_trace_is_displayable_but_still_business_partial():
    original = json.dumps(TRACE, ensure_ascii=False, sort_keys=True)
    env = envelope(); assert env['sourceCompletion'] == 'partial'
    assert env['originalAnswer'] == TRACE['answer']['content']
    value = project(env)
    assert value['verified'] and value['presentationOnly'] and value['businessResultComplete'] is False
    assert value['sourceResultStatus'] == 'not_confirmed' and value['sourceRequirementsSatisfied'] is False
    assert value['sourceMissing'] == TRACE['result']['missing']
    assert value['sourceGaps'] == TRACE['result']['gaps']
    assert value['sourceRequirementCoverage'] == TRACE['result']['requirementCoverage']
    assert value['sourceQualityBlockers'] == ['analysis']
    assert value['outputs'] == TRACE['result']['outputs']
    assert value['context']['scope'] == 'personal'
    assert 'grain' not in value['context']  # failed planner context cannot become a confirmed fact
    assert value['liveDataRead'] is False and value['rowScopeVerified'] is False and value['currentStatusClaimed'] is False
    assert json.dumps(TRACE, ensure_ascii=False, sort_keys=True) == original


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_partial_render_keeps_observation_uncertainty_and_actual_navigation(language):
    rendered = render_previous_answer(project(), language)
    assert '[Licensing / My Application Tasks](/licensing/applications)' in rendered
    assert 'Licensing To Do queue rows' in rendered
    assert ('only partly confirmed' in rendered and 'Still unconfirmed' in rendered and
            'no matching rows' in rendered and 'not a new query' in rendered) if language == 'en' else (
            'مؤكدة جزئيًا فقط' in rendered and 'ما زال غير مؤكد' in rendered and 'لم توجد صفوف مطابقة' in rendered)
    assert 'One row per Licensing application' not in rendered
    assert '/api/' not in rendered and 'requested_grain_unverified' not in rendered
    assert TRACE['result']['outputs'][0]['evidence'][0]['capturedAt'] in rendered


@pytest.mark.parametrize('mutation', ['no_answer', 'generic_error_body', 'changed_answer_value', 'dropped_answer_warning', 'wrong_answer_request', 'wrong_result_request',
    'wrong_terminal_request', 'cancelled', 'pending', 'other_owner', 'other_tenant', 'other_cid', 'intervening_user',
    'no_outputs', 'no_evidence', 'no_verified_output', 'no_missing', 'no_gaps', 'missing_code_lost',
    'permission_error', 'dependency_gap', 'collection_failure', 'refusal', 'not_partial', 'wrong_state_request'])
def test_partial_envelope_does_not_replay_errors_foreign_or_inconsistent_history(mutation):
    rows = history(); result = rows[1].event_json
    if mutation == 'no_answer': rows[2].event_json['content'] = ''
    elif mutation == 'generic_error_body': rows[2].event_json['content'] = 'Unable to answer; please retry.'
    elif mutation == 'changed_answer_value': rows[2].event_json['content'] = rows[2].event_json['content'].replace('No matching rows.', 'Three matching rows.')
    elif mutation == 'dropped_answer_warning': rows[2].event_json['content'] = rows[2].event_json['content'].replace('Some requested information remains unconfirmed.', '')
    elif mutation == 'wrong_answer_request': rows[2].event_json['requestId'] = 'other'
    elif mutation == 'wrong_result_request': result['requestId'] = 'other'
    elif mutation == 'wrong_terminal_request': rows[3].event_json['requestId'] = 'other'
    elif mutation == 'cancelled': rows[3].event_type = 'turn.cancelled'
    elif mutation == 'pending': rows.pop(3)
    elif mutation == 'other_owner': rows[1].user_id = 'other'
    elif mutation == 'other_tenant': rows[1].tenant_id = 'other'
    elif mutation == 'other_cid': rows[1].conversation_id = 'other'
    elif mutation == 'intervening_user': rows.insert(-1, deepcopy(rows[0]))
    elif mutation == 'no_outputs': result['outputs'] = []
    elif mutation == 'no_evidence': result['outputs'][0]['evidence'] = []
    elif mutation == 'no_verified_output': result['requirementCoverage'] = [r for r in result['requirementCoverage'] if r['status'] == 'unfulfilled']
    elif mutation == 'no_missing': result['missing'] = []
    elif mutation == 'no_gaps': result['gaps'] = []
    elif mutation == 'missing_code_lost': result['gaps'].pop()
    elif mutation == 'permission_error': result['failureCategory'] = 'permission'
    elif mutation == 'dependency_gap': result['missing'].append('knowledge_dependency_unavailable')
    elif mutation == 'collection_failure': result['qualityBlockers'].append('data_collection')
    elif mutation == 'refusal': result['result'] = 'refused'
    elif mutation == 'not_partial': result['analysisStatus'] = 'unconfirmed'
    elif mutation == 'wrong_state_request': result['intentState']['requestId'] = 'other'
    assert not completed_previous_result(rows, rows[-1])


@pytest.mark.parametrize('mutation', ['changed_identity', 'changed_catalog', 'page_denied', 'other_page',
    'foreign_source', 'no_observation', 'sensitive_field', 'private_value', 'partial_body_changed'])
def test_partial_display_rechecks_current_authority_and_every_source(mutation):
    env = envelope(); overrides = {}; item = env['result']['outputs'][0]
    if mutation == 'changed_identity': overrides['fingerprint'] = 'other'
    elif mutation == 'changed_catalog': overrides['catalog_version'] = 'other'
    elif mutation == 'page_denied': overrides['authorized'] = lambda _: False
    elif mutation == 'other_page': item['evidence'][0]['page'] = '/licensing/licenses'
    elif mutation == 'foreign_source': item['evidence'][0]['principalScopeRef'] = 'other'
    elif mutation == 'no_observation': item['evidence'][0]['observationRef'] = ''
    elif mutation == 'sensitive_field': item['evidence'][0]['fieldBinding'] = '/data/passportNumber'
    elif mutation == 'private_value': item['value'] = [{'email': 'private@example.test'}]
    elif mutation == 'partial_body_changed': env['originalAnswer'] = 'System error'
    assert not project(env, **overrides)['verified']


def test_partial_query_receipt_is_saved_independently_but_unmatched_capture_is_not_filled():
    result = deepcopy(TRACE['result'])
    receipt = query_receipt(result, TRACE['audit'])
    assert receipt and receipt['sourceRefs'][0]['capturedAt'] == result['outputs'][0]['evidence'][0]['capturedAt']
    assert receipt['captures'] == [{key: value for key, value in TRACE['audit']['captures'][0].items()
                                  if key in {'page', 'capturedAt', 'appliedFilters'}}]
    env = envelope(); env['result']['queryReceipt'] = receipt
    # The initial UI observation and later pagination receipt have different
    # capture times. A separate source/context proof is required for C05; do not
    # relabel the earlier observation or borrow a profile scope to make it pass.
    assert project(env, kind='query_scope')['reason'] == 'previous_query_receipt_unverified'


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_pipeline_explains_partial_without_business_query_or_historical_facts_in_planner(language, tmp_path):
    catalog = [{'name': 'Applications', 'routes': [{'path': PAGE, 'title': 'My Application Tasks', 'isMenu': True}]}]
    catalog_bytes = json.dumps(catalog).encode(); (tmp_path / 'page-catalog.json').write_bytes(catalog_bytes)
    auth = source(listSysPermission=[{'frontendRoute': PAGE}])
    fingerprint = digest(['self-1', 'tenant', permission_audit_summary(permission_context_from_user_info(auth))['fingerprint']])
    env = envelope(); env['result']['intentState']['principalFingerprint'] = fingerprint
    env['result']['intentState']['catalogVersion'] = hashlib.sha256(catalog_bytes).hexdigest()
    for output in env['result']['outputs']:
        for ref in output['evidence']: ref['principalScopeRef'] = fingerprint
    original = SIMPLE if language == 'en' else 'يرجى شرح هذه الإجابة بشكل أبسط وإعطائي تنقل الصفحة.'
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            assert 'public_read_todo_rows' not in json.dumps(data)
            stage = schema['properties']['stage']['const']
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': original, 'english': SIMPLE}]}
            assert stage == 'task'
            return presentation_task().model_dump()
    class Auth(Gateway):
        auth_calls = 0
        async def get_user_info(self, principal):
            self.auth_calls += 1
            return {'ok': True, 'result': auth}
        async def admin_portal_read(self, *args, **kwargs):
            raise AssertionError('Do not treat prior observations as a fresh business query')
    class Reader(GenericKnowledgeReader):
        async def search(self, *args, **kwargs):
            raise AssertionError('Do not replace the previous answer with retrieved facts')
    gateway = Auth(); reader = Reader(gateway, Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    result = asyncio.run(reader.run(Principal('self-1', 'tenant', 'new'), original,
        conversation_context={'completedPreviousAnswer': env, 'responseLanguage': language})).result.public_json()
    assert result['result'] == 'success' and result['requirementsSatisfied']  # current presentation only
    assert result['previousAnswer']['sourceResultStatus'] == 'not_confirmed'
    assert result['previousAnswer']['sourceMissing'] == TRACE['result']['missing']
    assert result['previousAnswer']['businessResultComplete'] is False
    assert gateway.auth_calls == 1 and ('only partly confirmed' in render_generic_answer(result, language) if language == 'en'
                                       else 'مؤكدة جزئيًا فقط' in render_generic_answer(result, language))
