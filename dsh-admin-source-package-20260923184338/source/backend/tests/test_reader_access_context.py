import copy
import pytest

from app.generic_reader import PipelineError
from app.reader_catalog_access import CatalogAccessCheck, access_catalog, validate_access_check
from app.reader_context import bind_browser_history, browser_context_key, literal_choice


def check(decision, ids):
    return CatalogAccessCheck(stage='catalog_access_check', decision=decision,
                              targetPageIds=ids, reason='Metadata target and current route policy compared.')


def test_access_catalog_uses_runtime_routes_not_department_or_role_names():
    entries = access_catalog([
        {'id': 'a', 'name': 'Blue tasks', 'routes': ['/blue'], 'module': 'blue'},
        {'id': 'b', 'name': 'Red tasks', 'routes': ['/red', '/shared'], 'module': 'red'},
    ], lambda route: route == '/shared')
    assert [entry['pageAccess'] for entry in entries] == ['denied', 'allowed']
    assert [entry['moduleAccess'] for entry in entries] == ['denied', 'allowed']
    validate_access_check(check('permission_denied', ['a']), entries)
    validate_access_check(check('continue', ['b']), entries)
    with pytest.raises(PipelineError, match='catalog_access_denial_unverified'):
        validate_access_check(check('permission_denied', ['a', 'b']), entries)


def test_one_denied_page_cannot_make_a_partly_authorized_module_denied():
    entries = access_catalog([
        {'id': 'a', 'name': 'List', 'routes': ['/allowed'], 'module': 'blue'},
        {'id': 'b', 'name': 'Details', 'routes': ['/restricted'], 'module': 'blue'},
    ], lambda route: route == '/allowed')
    assert entries[1]['pageAccess'] == 'denied'
    assert all(entry['moduleAccess'] == 'allowed' for entry in entries)


@pytest.mark.parametrize('ids', [[], ['unknown'], ['a', 'a']])
def test_denial_cannot_invent_a_page_or_omit_its_target(ids):
    with pytest.raises(PipelineError):
        validate_access_check(check('permission_denied', ids), [{'pageId': 'a', 'pageAccess': 'denied'}])


def page(department='blue', role='staff', timestamp='2026-09-28T01:00:00Z'):
    return {'route': '/dashboard', 'routeAuthorized': True, 'view': '', 'query': {},
            'filters': [{'name': 'department', 'value': department}, {'name': 'roleVariant', 'value': role}],
            'capturedAt': timestamp}


@pytest.mark.parametrize('current', [page('red'), page(role='manager')])
def test_workspace_or_role_change_invalidates_old_choice_but_keeps_question(current):
    original = {'previousIntent': {'browserContext': browser_context_key(page()),
        'question': 'List pending tasks with handlers.', 'lastRead': {'page': '/blue'},
        'lastClarification': {'id': 'old'},
        'pendingClarification': {'id': 'old', 'options': [{'id': 'blue', 'label': 'Blue', 'updates': []}]}}}
    history = bind_browser_history(original, current)
    assert literal_choice('1', history) is None
    assert 'lastRead' not in history['previousIntent']
    assert 'lastClarification' not in history['previousIntent']
    assert history['previousIntent']['question'] == original['previousIntent']['question']
    assert history['previousIntent']['contextInvalidation'] == 'browser_context_changed'
    assert 'pendingClarification' in original['previousIntent']


def test_capture_time_and_filter_order_do_not_expire_valid_choices():
    original = {'previousIntent': {'browserContext': browser_context_key(page()),
        'pendingClarification': {'id': 'live', 'options': [{'id': 'blue', 'label': 'Blue', 'updates': []}]}}}
    current = page(timestamp='2026-09-28T02:00:00Z')
    current['filters'].reverse()
    assert bind_browser_history(original, current) is original
    assert literal_choice('1', original)['clarificationId'] == 'live'


def test_unauthorized_hint_cannot_bind_a_workspace():
    assert browser_context_key({'route': '/restricted', 'routeAuthorized': False}) is None
    original = {'previousIntent': {'browserContext': browser_context_key(page())}}
    assert bind_browser_history(original, {'status': 'unavailable'}) is original


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_verified_route_denial_is_not_reported_as_identity_verification_failure(language):
    from app.generic_reader import render_generic_answer
    answer = render_generic_answer({'failureCategory': 'permission',
        'missing': ['requested_scope_not_available'], 'outputs': []}, language)
    assert 'could not be verified' not in answer
    assert 'التحقق من الهوية' not in answer
    assert ('authorized pages' in answer) if language == 'en' else ('صفحاتك' in answer or 'الصفحات' in answer)


def test_row_operator_on_scalar_is_repairable_planning_fault_not_service_failure():
    from app.generic_reader import execute_analysis
    from app.generic_reader_contracts import AnalysisPlan
    from test_generic_reader_v3 import store, reference, analysis, observed
    from app.generic_reader import source_inventory
    k = store()
    plan = analysis(k)
    plan['steps'].append({'id': 'invalid_sum', 'op': 'sum', 'inputs': ['m0'],
                          'field': 'amount', 'label': 'Amount', 'evidence': [reference(k)]})
    sources = source_inventory(observed(), '/work/crystals', 'principal', '2026-09-28')
    with pytest.raises(PipelineError, match='row_input_required') as failure:
        execute_analysis(AnalysisPlan.model_validate(plan), sources, k, observed()['metrics'])
    assert failure.value.category == 'planning'
    assert failure.value.details['inputShapes'] == ['scalar']
    assert failure.value.details['stepId'] == 'invalid_sum'


def test_source_selection_keeps_changed_browser_filters_through_planner_repair():
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from app.generic_reader import GenericKnowledgeReader, validate_selection
    from app.generic_reader_contracts import SourceSelection
    from test_generic_reader_v3 import store, reference
    knowledge = store()
    planner = SimpleNamespace(generic_reader_json=AsyncMock(side_effect=[
        {'stage': 'source_selection', 'sourceIds': ['unknown'], 'rationale': [reference(knowledge)], 'missing': []},
        {'stage': 'source_selection', 'sourceIds': ['current'], 'rationale': [reference(knowledge)], 'missing': []}]))
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://portal.test')
    reader.knowledge = knowledge
    reader.current_question = 'Show the current page totals.'
    reader.turn_context = {'currentPage': page('red', 'manager')}
    async def call(stage, awaitable, cap):
        return await awaitable
    reader.call = call
    sources = {'current': {'field': 'total'}}
    asyncio.run(reader.structured(SourceSelection, 'Select sources.', {'sources': sources},
        lambda result: validate_selection(result, sources, knowledge)))
    assert planner.generic_reader_json.call_count == 2
    for call in planner.generic_reader_json.call_args_list:
        assert call.kwargs['data']['browserPageHint']['filters'] == page('red', 'manager')['filters']
        assert 'never verified values or permissions' in call.kwargs['instruction']
