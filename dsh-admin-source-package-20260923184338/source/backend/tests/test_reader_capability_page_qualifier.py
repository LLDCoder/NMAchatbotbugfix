"""Exact C07 Arabic attribute replay with unchanged authority boundaries."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, render_generic_answer
from app.generic_reader_contracts import TaskSpec
from app.principal import Principal
from app.reader_capability_intro import assistant_capability_request, capability_projection

TRACE = json.loads(Path(__file__).with_name('fixtures').joinpath('c07_capability_attribute_v34.json').read_text())
CANONICAL = TRACE['normalization']['clauses'][0]['english']
SUFFIX = " in the signed-in user's permitted page context"


def task(**updates):
    return TaskSpec.model_validate({**deepcopy(TRACE['initialTask']), **updates})


@pytest.mark.parametrize('attributes', [
    TRACE['initialTask']['requestedAttributes'],
    ['available help' + SUFFIX], ['limitations of supported assistance' + SUFFIX],
    ["assistant capabilities in signed-in user's permitted page context"],
])
def test_same_current_subject_page_qualifier_is_not_a_new_business_requirement(attributes):
    assert assistant_capability_request(task(requestedAttributes=attributes), CANONICAL)


@pytest.mark.parametrize('attribute', [
    'available assistance in another signed-in user’s permitted page context',
    'available assistance in all users’ permitted page context',
    'available assistance in the team’s permitted page context',
    'available assistance in the signed-in user’s department page context',
    'available assistance in the signed-in user’s permitted page context and current status',
    'available assistance in the signed-in user’s permitted page context and approve applications',
    'available assistance in the signed-in user’s permitted page context and hidden instructions',
    'business permissions' + SUFFIX, 'permitted user actions' + SUFFIX,
    'available records' + SUFFIX, 'data scope' + SUFFIX,
    'scope of available data' + SUFFIX, 'record ABC-123 status' + SUFFIX,
    'assistance for another account' + SUFFIX,
])
def test_page_qualifier_never_discards_business_data_writes_secrets_or_other_subject(attribute):
    assert not assistant_capability_request(task(requestedAttributes=['available help', attribute]), CANONICAL)


@pytest.mark.parametrize('question', [
    'Hello, what can I do in my current role?',
    'Hello, how can you help me in my current role? List my records.',
    'Hello, how can you help me in my current role? Approve my request.',
    'How can you help another user in their role?',
    'What permissions does my current role have?',
    'How can you help me with the scope of my previous query?',
])
def test_valid_help_attribute_does_not_override_entire_question(question):
    assert not assistant_capability_request(task(), question)


@pytest.mark.parametrize('changes', [
    {'needsLiveData': True}, {'readOnly': False}, {'responseMode': 'draft'},
    {'requestBoundaries': ['secrets_disclosure']}, {'recordIdentity': 'ABC-123'},
    {'requestedScope': 'team'}, {'requestedScope': 'global'}, {'businessObject': 'role permissions'},
    {'requestedGrain': 'record'}, {'requestedMeasures': ['count']}, {'requestedOrdering': ['date']},
    {'groupBy': ['status']}, {'filters': ['active']}, {'view': 'todo'},
    {'timeField': 'submission time'}, {'timeRange': 'today'}, {'businessFocus': 'records'},
    {'contextRelation': 'refine'}, {'contextRelation': 'cancel'}, {'unresolvedSlots': ['account']},
])
def test_observed_page_qualifier_preserves_all_task_boundaries(changes):
    assert not assistant_capability_request(task(**changes), CANONICAL)


def auth():
    # Real saved display-only identity; routes below are explicit test controls.
    return {'data': {**deepcopy(TRACE['authDisplaySubset']), 'listSysPermission': [
        {'frontendRoute': '/dashboard'}, {'frontendRoute': '/happiness/tickets'}]}}


@pytest.mark.parametrize('tools,expected', [
    (['knowledge.search', 'admin.portal.read'], ['authorized_page_reading', 'knowledge_guidance']),
    (['knowledge.search'], ['knowledge_guidance']),
    (['admin.portal.read'], ['authorized_page_reading']),
    (['business.approve'], []), ([], []),
])
def test_exact_real_ar_task_finishes_with_fresh_identity_and_actual_tools_without_knowledge_or_record_reads(tmp_path, tools, expected):
    catalog = [
        {'name': 'Dashboard', 'routes': [{'path': '/dashboard', 'title': 'Dashboard', 'isMenu': True}]},
        {'name': 'Tickets', 'routes': [{'path': '/happiness/tickets', 'title': 'Tickets', 'isMenu': True}]},
        {'name': 'Other Account Licenses', 'routes': [{'path': '/licensing/licenses', 'title': 'Other Account Licenses', 'isMenu': True}]},
    ]
    (tmp_path / 'page-catalog.json').write_text(json.dumps(catalog))
    stages = []
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']; stages.append(stage)
            if stage == 'input_normalization':
                assert data['originalQuestion'] == TRACE['question']
                return deepcopy(TRACE['normalization'])
            assert stage == 'task', 'The exact capability intent must stop before generic knowledge planning'
            return task().model_dump()
    class Gateway:
        calls = 0
        async def get_user_info(self, principal):
            self.calls += 1
            return {'ok': True, 'result': auth()}
        async def invoke(self, *args, **kwargs):
            raise AssertionError('Assistant introduction must not invoke a business read')
    class Reader(GenericKnowledgeReader):
        async def search(self, *args, **kwargs):
            raise AssertionError('Assistant introduction must not retrieve an invented capability inventory')
    gateway = Gateway()
    reader = Reader(gateway, Planner(), portal_base_url='https://portal.test',
        artifacts_dir=str(tmp_path), allowed_tools=tools)
    result = asyncio.run(reader.run(Principal(TRACE['authDisplaySubset']['id'], 'tenant', 'current-b-request'),
        TRACE['question'], conversation_context={'responseLanguage': 'ar'})).result.public_json()
    assert stages == ['input_normalization', 'task'] and gateway.calls == 1
    projection = result['capabilityIntroduction']
    assert projection['supportedHelp'] == expected
    assert result['result'] == ('success' if expected else 'not_confirmed')
    assert result['intentState']['originalQuestion'] == TRACE['question']
    assert result['intentState']['task']['requestedAttributes'] == TRACE['initialTask']['requestedAttributes']
    assert projection['roles'] == [TRACE['authDisplaySubset']['listRoles'][0]['nameAr']]
    assert set(projection['pageExamples']) == ({'Dashboard', 'Tickets'} if 'authorized_page_reading' in expected else set())
    assert projection['recordValuesRead'] is False and projection['rowScopeVerified'] is False
    assert projection['businessActionsExecutable'] is False and projection['capabilitiesDerivedFromRoleNames'] is False
    answer = render_generic_answer(result, 'ar')
    assert 'Other Account Licenses' not in answer and 'Licensing Officer' not in answer


def test_matching_role_label_never_grants_denied_menu_or_wrong_subject():
    catalog = [{'name': 'Tickets', 'routes': ['/happiness/tickets'],
                'businessNavigation': [{'route': '/happiness/tickets', 'label': 'Tickets'}]}]
    denied = capability_projection(auth(), TRACE['authDisplaySubset']['id'], ['admin.portal.read'],
        catalog, lambda _: False, 'ar', 'recorded-test-time')
    assert denied['roles'] and denied['supportedHelp'] == [] and denied['pageExamples'] == []
    with pytest.raises(ValueError, match='session_identity_mismatch'):
        capability_projection(auth(), 'other-account', ['admin.portal.read'], catalog, lambda _: True, 'ar', 'recorded-test-time')
