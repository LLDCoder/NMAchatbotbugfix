import asyncio
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, digest, render_generic_answer, source_inventory
from app.reader_collection import projection_hash
from app.reader_query_identity import observed_profile_labels, profile_read_plan
from app.portal_reader import permission_context_from_user_info, permission_audit_summary
from app.principal import Principal
from test_reader_previous_answer import envelope, presentation_task, SCOPE

FIXTURES = Path(__file__).with_name('fixtures')
NATIVE = json.loads((FIXTURES / 'group15_query_profile_native_replay.json').read_text())
DEFINITION = json.loads((FIXTURES / 'group15_query_profile_definition.json').read_text())
PAGE = DEFINITION['records'][0]['payload']['pageRef']
OPERATION = DEFINITION['records'][0]['payload']['sourceBinding']['operationRef']


def observation():
    return {'pageIdentity': {'path': PAGE}, 'readHealth': {'healthy': True},
            'apiDiscovery': {'candidates': [{'operationKey': OPERATION, 'status': 200,
                'policyState': 'allowed', 'candidateKind': 'business',
                'responseEvidence': deepcopy(NATIVE['profileResponse']),
                'responseEvidenceTruncated': True,
                'fieldEvidence': deepcopy(NATIVE['fieldEvidence']),
                'collectionContext': deepcopy(NATIVE['collectionContext'])}]}}


def knowledge(document=None):
    store = KnowledgeStore()
    store.add({'chunks': [{'id': 'profile', 'source_type': 'local_page_knowledge',
                          'content': json.dumps(document or DEFINITION)}]})
    return store


def catalog():
    return [{'name': 'Personal Center', 'routes': [PAGE],
             'businessNavigation': [{'route': PAGE, 'label': 'Personal Center'}]}]


def setup(tmp_path, mutation=None):
    authored = [{'name': 'Personal Center', 'routes': [{'path': PAGE, 'title': 'Personal Center', 'isMenu': True}]}]
    catalog_bytes = json.dumps(authored).encode()
    (tmp_path / 'page-catalog.json').write_bytes(catalog_bytes)
    path = tmp_path / 'KB/pages/admin/profile/data.json'
    path.parent.mkdir(parents=True)
    document = deepcopy(DEFINITION)
    if mutation == 'draft_definition': document['packageStatus'] = 'draft'
    path.write_text(json.dumps(document))
    auth = deepcopy(NATIVE['authResponse'])
    if mutation == 'getuserinfo_has_department':
        auth['data']['departmentsInfo'] = deepcopy(NATIVE['profileResponse']['data']['departmentsInfo'])
    fingerprint = digest([auth['data']['id'], 'tenant',
        permission_audit_summary(permission_context_from_user_info(auth))['fingerprint']])
    prior = envelope()
    state = prior['result']['intentState']
    state['principalFingerprint'] = fingerprint
    state['catalogVersion'] = hashlib.sha256(catalog_bytes).hexdigest()
    for output in prior['result']['outputs']:
        for ref in output['evidence']:
            ref['principalScopeRef'] = fingerprint
    for ref in prior['result']['queryReceipt']['sourceRefs']:
        ref['principalScopeRef'] = fingerprint
    if mutation == 'old_query_receipt_missing': prior['result'].pop('queryReceipt')
    return auth, prior


def run_flow(tmp_path, language='en', mutation=None):
    auth, prior = setup(tmp_path, mutation)
    original = SCOPE if language == 'en' else 'يرجى سرد نطاق البيانات والقيود المستخدمة في هذا الاستعلام.'
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': original, 'english': SCOPE}]}
            assert stage == 'task', 'Profile properties use published bindings, not a replacement model question'
            assert data['originalQuestion'] == original
            return presentation_task(requestedAttributes=['data scope', 'limitations']).model_dump()
    class Gateway:
        calls = []
        async def get_user_info(self, principal):
            return {'ok': True, 'result': auth}
        async def invoke(self, principal, tool, arguments, **kwargs):
            self.calls.append((tool, arguments))
            assert tool == 'admin.portal.read' and arguments['startPath'] == PAGE
            assert arguments.get('actions') in ([], [{'type': 'observe'}])
            if mutation in {'401', '403', '500'}:
                return {'ok': False, 'status': int(mutation)}
            obs = observation()
            candidate = obs['apiDiscovery']['candidates'][0]
            if mutation == 'other_page': obs['pageIdentity']['path'] = '/another-page'
            elif mutation == 'other_user': candidate['responseEvidence']['data']['userId'] = 'other'
            elif mutation == 'request_subject_mismatch': candidate['collectionContext']['parameterHashes']['userId'] = projection_hash('other')
            elif mutation == 'array_hash_mismatch': candidate['responseEvidence']['data']['departmentsInfo'][0]['name'] = 'Changed without receipt'
            elif mutation == 'missing_array_receipt': candidate['fieldEvidence'].pop('/data/departmentsInfo')
            elif mutation == 'missing_parent_receipt': candidate['fieldEvidence'].pop('/data/userId')
            elif mutation == 'complete_empty_department':
                candidate['responseEvidence']['data']['departmentsInfo'] = []
                candidate['fieldEvidence']['/data/departmentsInfo']['valueHash'] = projection_hash([])
            elif mutation == 'captured_api_403': candidate['status'] = 403
            return {'ok': True, 'result': {'result': 'success', 'page': PAGE, 'observation': obs}}
    gateway = Gateway()
    gateway.calls = []
    reader = GenericKnowledgeReader(gateway, Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    outcome = asyncio.run(reader.run(Principal(auth['data']['id'], 'tenant', 'current-scope-request'), original,
        conversation_context={'completedPreviousAnswer': prior, 'responseLanguage': language}))
    return outcome.result.public_json(), outcome.audit_evidence, gateway.calls, prior


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_original_scope_question_reaches_fresh_profile_read_and_preserves_previous_scope(tmp_path, language):
    result, audit, calls, prior = run_flow(tmp_path, language)
    assert result['result'] == 'success', result
    assert len(calls) == 1
    projection = result['previousAnswer']
    identity = projection['currentIdentity']
    assert identity['departments'] == ['Happiness Center Unit']
    role_label = NATIVE['authResponse']['data']['listRoles'][0]['nameAr' if language == 'ar' else 'nameEn']
    assert identity['roles'] == [role_label]
    assert identity['accountDisplayName']
    assert identity['remainingProfileAttributes'] == []
    assert projection['sourceRequestId'] == prior['requestId']
    assert projection['observedAt'] == [prior['result']['outputs'][0]['evidence'][0]['capturedAt']]
    assert projection['context']['filterScope'] == prior['result']['context']['filterScope']['value']
    assert identity['profileEvidence'][0]['capturedAt'] != projection['observedAt'][0]
    assert not identity['rowScopeVerified'] and not identity['queryScopeEstablished']
    assert result['intentState']['originalQuestion'] == prior['result']['intentState']['originalQuestion']
    assert not audit['queryIdentityProfile']['historicalQueryReceiptReplaced']
    assert next(s for s in result['executionStatus'] if s['stage'] == 'page_observation')['status'] == 'passed'
    answer = render_generic_answer(result, language)
    assert 'Happiness Center Unit' in answer and role_label in answer
    assert '/api/' not in answer and 'GetAdminUserAsync' not in answer
    assert ('not a new query' in answer) if language == 'en' else ('ليس استعلاماً جديداً' in answer)


@pytest.mark.parametrize('mutation', ['other_page', 'other_user', 'request_subject_mismatch',
    'array_hash_mismatch', 'missing_array_receipt', 'missing_parent_receipt', 'draft_definition'])
def test_profile_read_cannot_be_completed_from_wrong_subject_page_or_partial_property(tmp_path, mutation):
    result, audit, calls, prior = run_flow(tmp_path, mutation=mutation)
    assert result['result'] != 'success'
    identity = result['previousAnswer']['currentIdentity']
    assert identity['remainingProfileAttributes'] == ['department']
    assert not identity['identityComplete']
    assert result['previousAnswer']['verified']  # Historical receipt stays available.
    assert result['previousAnswer']['sourceRequestId'] == prior['requestId']


@pytest.mark.parametrize('mutation,expected', [('401', 'permission_denied'), ('403', 'permission_denied'), ('captured_api_403', 'permission_denied'), ('500', 'load_failed')])
def test_actual_native_error_kind_is_preserved_without_role_inference(tmp_path, mutation, expected):
    result, audit, calls, _ = run_flow(tmp_path, mutation=mutation)
    assert result['result'] == expected
    assert len(calls) == 1
    if mutation == '401':
        assert result['previousAnswer']['currentIdentity']['profileFailure']['upstreamStatus'] == 401
        assert 'session expired' in render_generic_answer(result, 'en').lower()
    elif expected == 'permission_denied':
        assert result['previousAnswer']['currentIdentity']['profileFailure']['upstreamStatus'] == 403
        assert 'service denied' in render_generic_answer(result, 'en').lower()


def test_current_profile_never_replaces_missing_historical_query_receipt(tmp_path):
    result, _, calls, _ = run_flow(tmp_path, mutation='old_query_receipt_missing')
    assert len(calls) == 1 and result['previousAnswer']['currentIdentity']['identityComplete']
    assert result['result'] == 'not_confirmed'
    assert 'previous_query_receipt_unavailable' in result['missing']


def test_complete_empty_department_is_known_absence_not_invented_label(tmp_path):
    result, _, _, _ = run_flow(tmp_path, mutation='complete_empty_department')
    assert result['result'] == 'success'
    identity = result['previousAnswer']['currentIdentity']
    assert identity['departments'] == [] and identity['verifiedEmptyAttributes'] == ['department']
    assert 'no assignment for: department' in render_generic_answer(result, 'en')


def test_native_getuserinfo_complete_display_names_need_no_profile_read(tmp_path):
    result, _, calls, _ = run_flow(tmp_path, mutation='getuserinfo_has_department')
    assert result['result'] == 'success' and calls == []


@pytest.mark.parametrize('bad', ['stale_capture', 'other_principal', 'other_page', 'ambiguous_mapping'])
def test_receipt_binding_helper_never_accepts_retained_or_ambiguous_profile_source(bad):
    store = knowledge()
    plan = profile_read_plan(store, ['department'], catalog(), lambda _: True)
    sources = source_inventory(observation(), PAGE, '2026-09-28T12:00:00Z', 'principal')
    if bad == 'stale_capture': next(iter(sources.values()))['capturedAt'] = '2026-09-27T12:00:00Z'
    elif bad == 'other_principal': next(iter(sources.values()))['principalScopeRef'] = 'other'
    elif bad == 'other_page': next(iter(sources.values()))['page'] = '/another-page'
    else:
        document = deepcopy(DEFINITION)
        binding = next(b for b in document['records'][0]['payload']['bindings'] if b['concept'] == 'department')
        document['records'][0]['payload']['bindings'].append({**binding, 'sourcePath': '/data/anotherProperty'})
        assert profile_read_plan(knowledge(document), ['department'], catalog(), lambda _: True) is None
        return
    labels, evidence = observed_profile_labels(store, plan, sources, NATIVE['authResponse']['data']['id'], 'principal', '2026-09-28T12:00:00Z')
    assert not labels and not evidence


@pytest.mark.parametrize('bad', ['missing_bindings', 'malformed_concept', 'identifier_is_not_display_field', 'unauthorized_route'])
def test_incomplete_or_unsafe_knowledge_cannot_enable_profile_reads(bad):
    document = deepcopy(DEFINITION)
    payload = document['records'][0]['payload']
    if bad == 'missing_bindings': payload['bindings'] = None
    elif bad == 'malformed_concept':
        for binding in payload['bindings']:
            if binding['kind'] == 'attribute': binding['concept'] = {'department': True}
    elif bad == 'identifier_is_not_display_field':
        for binding in payload['bindings']:
            if binding['kind'] == 'attribute': binding['fields'] = ['id']
    assert profile_read_plan(knowledge(document), ['department'], catalog(), lambda _: bad != 'unauthorized_route') is None
