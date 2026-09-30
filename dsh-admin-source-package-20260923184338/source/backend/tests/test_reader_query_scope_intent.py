"""Real C05 intent regression; fresh identity remains a separate mocked read."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, render_generic_answer
from app.generic_reader_contracts import TaskSpec
from app.principal import Principal
from app.reader_previous_answer import previous_answer_request, project_previous_answer
from test_reader_query_identity_flow import NATIVE, PAGE, observation, setup

TRACE = json.loads(Path(__file__).with_name('fixtures').joinpath('c05_scope_intent_v34.json').read_text())
AR = TRACE['normalization']['clauses'][0]['sourceQuote']
NORMALIZED = TRACE['normalization']['clauses'][0]['english']


def draft(**updates):
    return TaskSpec.model_validate({**deepcopy(TRACE['initialTask']), **updates})


@pytest.mark.parametrize('question', [TRACE['originalEnglish'], NORMALIZED,
    'Explain the scope and the limitations of the previous query.',
    'Describe the query scope and its constraints for my last search.',
    'What data scope and the constraints were used for this query?'])
def test_same_whole_scope_request_accepts_normalized_limits_synonyms(question):
    assert previous_answer_request(draft(), question) == 'query_scope'


@pytest.mark.parametrize('question', [
    NORMALIZED + ' Also show all records for another department.',
    NORMALIZED + ' Approve the applications.',
    NORMALIZED + ' Include another user’s account.',
    'Refresh the data scope and the constraints used for this query.',
    'List the data scope and the constraints for all users.',
    'List the data scope and the constraints used for a future query.',
    'Explain constraints on licensing applications.',
    'List the data scope and the constraints used for this query and the current balances.',
])
def test_alias_does_not_accept_extra_requests_or_generic_knowledge(question):
    assert previous_answer_request(draft(), question) == ''


@pytest.mark.parametrize('change', [
    {'readOnly': False}, {'needsLiveData': True}, {'responseMode': 'draft'},
    {'requestBoundaries': ['secrets_disclosure']}, {'recordIdentity': 'new-record'},
    {'requestedMeasures': ['count']}, {'requestedOrdering': ['date descending']},
    {'groupBy': ['status']}, {'filters': ['status=approved']}, {'view': 'todo'},
    {'timeField': 'submission date'}, {'timeRange': 'today'}, {'unresolvedSlots': ['requestedScope']},
    {'contextRelation': 'cancel'},
])
def test_normalized_alias_keeps_all_task_boundary_checks(change):
    assert previous_answer_request(draft(**change), NORMALIZED) == ''


def actual_projection(**changes):
    prior = deepcopy(TRACE['actualPreviousResult'])
    state = prior['intentState']
    args = {'fingerprint': state['principalFingerprint'], 'catalog_version': state['catalogVersion'],
        'catalog': [{'routes': ['/licensing/applications']}], 'authorized': lambda _: True}
    args.update(changes)
    envelope = {'schemaVersion': 'completed-prior-answer/1', 'requestId': prior['requestId'],
        'result': prior, 'originalAnswer': TRACE['actualPreviousAnswer']}
    return project_previous_answer(envelope, 'query_scope', **args)


def test_actual_complete_empty_prerequisite_remains_a_valid_historical_scope():
    projected = actual_projection()
    assert projected['verified'], projected
    assert projected['sourceRequestId'] == TRACE['actualPreviousResult']['requestId']
    assert projected['context']['filterScope'] == TRACE['actualPreviousResult']['context']['filterScope']['value']
    assert projected['outputs'] == [] and projected['liveDataRead'] is False
    assert projected['currentStatusClaimed'] is False and projected['rowScopeVerified'] is False
    assert 'currentIdentity' not in projected


@pytest.mark.parametrize('change', [{'fingerprint': 'other-user'}, {'catalog_version': 'changed'},
    {'authorized': lambda _: False}])
def test_actual_previous_read_cannot_bypass_current_authorization(change):
    assert not actual_projection(**change)['verified']


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('mutation', [None, 'missing_previous_receipt', 'profile_403', 'profile_other_user'])
def test_saved_intent_routes_to_fresh_identity_with_historical_evidence_separate(tmp_path, language, mutation):
    # Existing fixture supplies native-profile source shape, not code defaults.
    # This integration fixture is distinct from the unmodified actual saved prior read above.
    auth, prior = setup(tmp_path)
    if mutation == 'missing_previous_receipt':
        prior['result'].pop('queryReceipt')
    previous_snapshot = deepcopy(prior)
    original = TRACE['originalEnglish'] if language == 'en' else AR
    canonical = TRACE['originalEnglish'] if language == 'en' else NORMALIZED
    model_stages, calls = [], []
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            model_stages.append(stage)
            assert 'Happiness Center Unit' not in json.dumps(data, ensure_ascii=False)
            assert 'completedPreviousAnswer' not in data
            if stage == 'input_normalization':
                return {'stage': stage, 'clauses': [{'sourceQuote': original, 'english': canonical}]}
            assert stage == 'task', 'The query-scope request must not enter business/knowledge interpretation'
            assert data['originalQuestion'] == original
            return draft().model_dump()
    class Gateway:
        async def get_user_info(self, principal):
            return {'ok': True, 'result': auth}
        async def invoke(self, principal, tool, arguments, **kwargs):
            calls.append((tool, arguments))
            assert tool == 'admin.portal.read' and arguments['startPath'] == PAGE
            assert arguments.get('actions') in ([], [{'type': 'observe'}])
            if mutation == 'profile_403':
                return {'ok': False, 'status': 403}
            observed = observation()
            if mutation == 'profile_other_user':
                observed['apiDiscovery']['candidates'][0]['responseEvidence']['data']['userId'] = 'other-user'
            return {'ok': True, 'result': {'result': 'success', 'page': PAGE, 'observation': observed}}
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    outcome = asyncio.run(reader.run(Principal(auth['data']['id'], 'tenant', 'current-intent-regression'), original,
        conversation_context={'completedPreviousAnswer': prior, 'responseLanguage': language}))
    result = outcome.result.public_json()
    assert model_stages == (['input_normalization', 'task'] if language == 'ar' else ['task'])
    assert len(calls) == 1 and prior == previous_snapshot
    projection = result['previousAnswer']
    identity = projection['currentIdentity']
    assert identity['sourceRequestId'] == 'current-intent-regression'
    assert identity['profileReadAttempted'] is True
    assert 'currentIdentity' not in result['intentState']
    assert not identity['queryScopeEstablished'] and not identity['rowScopeVerified']
    if mutation == 'profile_403':
        assert result['result'] == 'permission_denied'
        assert identity['profileFailure']['upstreamStatus'] == 403
        assert not identity['identityComplete']
    elif mutation == 'profile_other_user':
        assert result['result'] != 'success' and not identity['identityComplete']
        assert identity['remainingProfileAttributes'] == ['department']
    elif mutation == 'missing_previous_receipt':
        assert result['result'] == 'not_confirmed' and identity['identityComplete']
        assert 'previous_query_receipt_unavailable' in result['missing']
    else:
        assert result['result'] == 'success' and projection['queryIdentityComplete']
        assert identity['departments'] == [row['name'] for row in NATIVE['profileResponse']['data']['departmentsInfo']]
        assert identity['roles'] and identity['accountDisplayName']
        assert projection['sourceRequestId'] == prior['requestId']
        answer = render_generic_answer(result, language)
        assert identity['accountDisplayName'] in answer and identity['roles'][0] in answer
        assert identity['departments'][0] in answer and '/api/' not in answer
