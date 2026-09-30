"""Page titles never manufacture selected views; missing observations retain runtime failures."""
import asyncio
import copy
import time

import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError, portal_result_failure
from app.generic_reader_contracts import SlotUpdate, TaskSpec
from app.reader_context import validate_page_view
from test_reader_parent_properties import fixture
from test_projected_collection import gateway


def task_view(value='Research overview', source='page'):
    return fixture()[0].model_copy(update={'view': value,
        'slotUpdates': [SlotUpdate(field='view', source=source, value=value)]})


def page(view=''):
    return {'route': '/research/overview', 'view': view, 'routeAuthorized': True,
        'pageCandidates': [{'name': 'Research overview'}]}


@pytest.mark.parametrize('selected', ['', 'Open', 'Team • Pending'])
def test_page_title_is_not_the_browser_selected_view(selected):
    with pytest.raises(PipelineError, match='intent_page_view_ungrounded'):
        validate_page_view(task_view(), page(selected))


@pytest.mark.parametrize('source', ['current', 'previous', 'knowledge'])
def test_explicit_inherited_and_documented_views_keep_their_existing_guards(source):
    task = task_view('My Tasks / Licensing / Pending', source)
    before = task.model_dump()
    validate_page_view(task, page())
    assert task.model_dump() == before  # No view stripping or acceptance waiver.


def test_browser_selected_view_remains_an_unverified_requirement():
    task = task_view('Team • Pending')
    validate_page_view(task, page('Team • Pending'))
    assert task.view == 'Team • Pending'
    from app.generic_reader import KnowledgeStore
    from app.reader_routing import verify_route
    check = verify_route(task, '/research/overview', '/research/overview',
        {'pageIdentity': {'path': '/research/overview'}, 'tabControls': []}, {}, KnowledgeStore(), require_record=False)
    assert not check.passed
    assert check.checks[-1].reason == 'requested_view_unverified'


@pytest.mark.parametrize('question', ['Summarize my current page.', 'لخص الصفحة الحالية.'])
@pytest.mark.parametrize('phase', ['initial', 'knowledge_refinement'])
def test_task_stage_repairs_page_sourced_view_without_changing_business_requirements(question, phase):
    wrong = task_view()
    correct = wrong.model_copy(update={'view': '', 'slotUpdates': [SlotUpdate(field='view', source='page', value='')]})
    responses = [wrong.model_dump(), correct.model_dump()]
    class Planner:
        def __init__(self): self.calls = []
        async def generic_reader_json(self, **kwargs):
            self.calls.append(copy.deepcopy(kwargs)); return responses[len(self.calls)-1]
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = question; reader.canonical_question = 'Summarize my current page.'
    reader.response_language = 'ar' if question.startswith('ل') else 'en'; reader.deadline = time.monotonic()+30
    result = asyncio.run(reader.structured(TaskSpec, 'Parse intent.',
        {'question': question, 'phase': phase, 'currentPage': page()}))
    assert result.view == '' and len(reader.planner.calls) == 2
    assert result.requestedAttributes == wrong.requestedAttributes
    assert result.businessObject == wrong.businessObject
    assert 'intent_page_view_ungrounded' in reader.planner.calls[-1]['correction']


@pytest.mark.parametrize('stage,reason', [
    ('dashboard_context', 'dashboard_context_requests_unsettled'),
    ('dashboard_context_final', 'dashboard_applied_context_changed_during_read'),
    ('actions', 'reader_selector_not_found'),
])
def test_unobserved_gateway_rejection_is_not_a_page_route_knowledge_gap(stage, reason):
    result = {'status': 'not_confirmed', 'limitations': [reason],
        'diagnostics': {'stage': stage, 'errorType': 'RuntimeError', 'readHealth': {'pendingCount': 2,
            'failedCount': 0, 'privateUrl': 'PRIVATE', 'responseCount': True, 'blockedCount': -1}}}
    failure = portal_result_failure(result)
    assert failure.code == 'page_read_not_confirmed' and failure.category == 'runtime'
    assert failure.details['gatewayReasons'] == [reason]
    assert failure.details['gatewayStage'] == stage
    assert failure.details['dependencyErrorType'] == 'RuntimeError'
    assert failure.details['readHealth'] == {'pendingCount': 2, 'failedCount': 0}
    assert 'PRIVATE' not in str(failure.details)


@pytest.mark.parametrize('result', [
    {'status': 'not_confirmed', 'observation': {'pageIdentity': {'path': '/research/overview'}},
        'limitations': ['reader_selector_not_found'], 'diagnostics': {'stage': 'actions'}},
    {'status': 'not_confirmed', 'observation': {}},
    {'status': 'not_confirmed', 'limitations': ['native_lookup_binding_unavailable'],
        'diagnostics': {'stage': 'native_record_lookup'}},
])
def test_partial_observations_and_native_business_responses_keep_existing_validation(result):
    assert portal_result_failure(result) is None


def test_gateway_failure_health_has_counts_without_private_payload():
    data = gateway._reader_failure_diagnostics('dashboard_context', RuntimeError('PRIVATE error'), {
        'pending': {1: '/private?id=SECRET'}, 'failed': {'/private/record': 1},
        'blocked': ['SECRET'], 'responseCaptureTasks': {object()}, 'responses': {2: 403},
        'apiDiscovery': {'candidates': {'private-path': {'responseEvidence': {'secret': 'SECRET'}},
                                       'another-private-path': {}}}})
    assert data == {'stage': 'dashboard_context', 'errorType': 'RuntimeError', 'readHealth': {
        'pendingCount': 1, 'failedCount': 1, 'blockedCount': 1, 'captureTaskCount': 1, 'responseCount': 1,
        'sourceCandidateCount': 2, 'capturedSourceCount': 1}}
    assert 'PRIVATE' not in str(data) and 'SECRET' not in str(data)


@pytest.mark.parametrize('when', ['initial', 'final'])
def test_gateway_exception_envelope_survives_tool_projection_and_failure_classification(monkeypatch, caplog, when):
    from contextlib import asynccontextmanager
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from app.portal_reader import bounded_portal_read_result
    request = gateway.AdminPortalReadRequest(startPath='/dashboard', actions=[{'type': 'observe'}])
    page_obj = SimpleNamespace(url='https://fixture.test/dashboard', on=lambda *a: None,
        set_default_timeout=lambda *a: None, set_default_navigation_timeout=lambda *a: None,
        goto=AsyncMock(return_value=SimpleNamespace(status=200)))
    context = SimpleNamespace(add_init_script=AsyncMock(), route=AsyncMock(), new_page=AsyncMock(return_value=page_obj))
    browser = SimpleNamespace(new_context=AsyncMock(return_value=context), close=AsyncMock())
    @asynccontextmanager
    async def playwright():
        yield SimpleNamespace(chromium=SimpleNamespace(launch=AsyncMock(return_value=browser)))
    monkeypatch.setattr(gateway, 'async_playwright', playwright)
    monkeypatch.setattr(gateway, '_umc_request', AsyncMock(return_value={}))
    monkeypatch.setattr(gateway, '_validate_gateway_permissions', lambda *a: {'userId': 'fixture-user', 'pages': ['/dashboard'], 'subpages': [], 'buttons': []})
    monkeypatch.setattr(gateway, '_settle_page', AsyncMock())
    monkeypatch.setattr(gateway, '_execute_reader_actions', AsyncMock(return_value=([], [], [], False, {})))
    async def context_check(page, *a, **kw):
        if when == 'initial' or kw.get('allow_restore') is False:
            page._reader_health['pending'][123] = '/private?token=SECRET'
            raise RuntimeError('dashboard_context_requests_unsettled')
        return {'verified': True}
    monkeypatch.setattr(gateway, '_restore_dashboard_context', context_check)
    with caplog.at_level('INFO', logger='uvicorn.error'):
        raw = asyncio.run(gateway.admin_portal_read(request, authorization='Bearer private-token',
            x_request_id='fixture-request', x_user_id='fixture-user'))
    failure = portal_result_failure(bounded_portal_read_result(raw))
    expected = 'dashboard_context' if when == 'initial' else 'dashboard_context_final'
    assert raw['status'] == 'not_confirmed' and failure.code == 'page_read_not_confirmed'
    assert failure.details['gatewayStage'] == expected
    assert failure.details['gatewayReasons'] == ['dashboard_context_requests_unsettled']
    assert failure.details['readHealth']['pendingCount'] == 1
    assert 'reason=dashboard_context_requests_unsettled' in caplog.text
    assert 'SECRET' not in caplog.text+str(raw) and 'private-token' not in caplog.text+str(raw)
    browser.close.assert_awaited_once()
