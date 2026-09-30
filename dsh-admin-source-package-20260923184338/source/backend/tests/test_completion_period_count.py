import asyncio
from copy import deepcopy
from datetime import datetime, timezone

import pytest

from test_platform_portal_reader import gateway
from app.portal_reader import _personal_completion_query, PortalReadRequest


def observation():
    return {'readHealth': {'healthy': True}, 'tabControls': [{'name': 'Completed', 'selected': True}],
            'apiDiscovery': {'candidates': [{'operationKey': 'POST /api/Application/MyComplatedPage',
                                            'status': 200, 'policyState': 'allowed'}]}}


def payload(rows=None, total=None):
    rows = [{'id': 1, 'assignee': 'me', 'taskApprovalAt': '2026-09-08T13:00:00'}] if rows is None else rows
    return {'data': {'page': {'items': rows, 'total': len(rows) if total is None else total}}}


def aggregate(monkeypatch, responses=None, obs=None, **overrides):
    requests = []
    async def read(method, path, **kwargs):
        requests.append((method, path, kwargs['json']))
        return deepcopy(responses.pop(0)) if responses is not None else payload()
    monkeypatch.setattr(gateway, '_umc_request', read)
    original = gateway._completion_window
    monkeypatch.setattr(gateway, '_completion_window', lambda p: original(p, datetime(2026, 9, 16, tzinfo=timezone.utc)))
    request = gateway.AdminPortalReadRequest.model_validate({'startPath': '/licensing/applications',
        'actions': [{'type': 'observe'}], 'completionPeriod': 'last week', **overrides})
    result = asyncio.run(gateway._completed_period_aggregate(request, observation() if obs is None else obs, 'me', 'Bearer hidden', None))
    return result, requests


def test_complete_count_uses_real_approval_time_and_returns_no_records(monkeypatch):
    result, calls = aggregate(monkeypatch)
    assert result['count'] == 1 and result['stablePasses'] == 2
    assert result['startInclusive'] == '2026-09-07T00:00:00+04:00'
    assert result['endExclusive'] == '2026-09-14T00:00:00+04:00'
    assert 'assignee' not in str(result) and 'Bearer' not in str(result)
    assert all(body == {'pageIndex': 1, 'pageSize': 100} for _, _, body in calls)


@pytest.mark.parametrize('stamp,expected', [('2026-09-06T23:59:59', 0), ('2026-09-07T00:00:00', 1),
    ('2026-09-13T23:59:59', 1), ('2026-09-14T00:00:00', 0),
    ('2026-09-06T20:00:00Z', 1), ('2026-09-13T20:00:00Z', 0)])
def test_boundaries_and_utc_conversion(monkeypatch, stamp, expected):
    p = payload([{'id': 1, 'assignee': 'me', 'taskApprovalAt': stamp, 'lastUpdatedTime': '2040-01-01T00:00:00'}])
    result, _ = aggregate(monkeypatch, [p, p])
    assert result['count'] == expected


def test_verified_empty_source_is_zero(monkeypatch):
    result, _ = aggregate(monkeypatch, [payload([]), payload([])])
    assert result['count'] == result['recordsScanned'] == 0


@pytest.mark.parametrize('patch', [{'taskApprovalAt': None}, {'taskApprovalAt': ''}, {'taskApprovalAt': 'invalid'},
    {'taskApprovalAt': '2026-09-99T00:00:00'}, {'taskApprovalAt': '0001-01-01T00:00:00'},
    {'assignee': 'someone-else'}, {'id': None}, {'id': True}, {'id': 0}])
def test_bad_row_never_produces_count(monkeypatch, patch):
    row = payload()['data']['page']['items'][0] | patch
    with pytest.raises(ValueError):
        aggregate(monkeypatch, [payload([row])])


@pytest.mark.parametrize('total', [-1, True, 3001, '1', None])
def test_total_requires_bounded_integer(total):
    p = payload()
    p['data']['page']['total'] = total
    with pytest.raises(ValueError):
        gateway._completion_rows(p, 'me')


def test_multpage_scan_complete_and_stable(monkeypatch):
    rows = [{'id': i, 'assignee': 'me', 'taskApprovalAt': '2026-09-08T00:00:00'} for i in range(1, 102)]
    a, b = payload(rows[:100], 101), payload(rows[100:], 101)
    result, calls = aggregate(monkeypatch, [a, b, a, b])
    assert result['count'] == 101 and result['pagesRead'] == 4
    assert [c[2]['pageIndex'] for c in calls] == [1, 2, 1, 2]


@pytest.mark.parametrize('mode', ['overlap', 'empty', 'total-changed', 'date-changed', 'duplicate'])
def test_partial_or_changing_snapshots_fail(monkeypatch, mode):
    row = payload()['data']['page']['items'][0]
    other = row | {'id': 2}
    responses = {
        'overlap': [payload([row], 2), payload([row], 2)],
        'empty': [payload([row], 2), payload([], 2)],
        'total-changed': [payload([row], 2), payload([other], 3)],
        'date-changed': [payload([row]), payload([row | {'taskApprovalAt': '2026-09-15T00:00:00'}])],
        'duplicate': [payload([row, row], 2)],
    }[mode]
    with pytest.raises(ValueError):
        aggregate(monkeypatch, responses)


@pytest.mark.parametrize('mode', ['unhealthy', 'wrong-tab', 'unobserved', 'denied', 'wrong-operation'])
def test_page_and_operation_provenance_required(monkeypatch, mode):
    obs = observation()
    if mode == 'unhealthy': obs['readHealth']['healthy'] = False
    if mode == 'wrong-tab': obs['tabControls'][0]['name'] = 'To Do'
    if mode == 'unobserved': obs['apiDiscovery']['candidates'] = []
    if mode == 'denied': obs['apiDiscovery']['candidates'][0]['policyState'] = 'blocked'
    if mode == 'wrong-operation': obs['apiDiscovery']['candidates'][0]['operationKey'] = 'POST /api/Application/MyTodoPage'
    with pytest.raises(ValueError): aggregate(monkeypatch, obs=obs)


def test_never_bypass_configured_whitelist(monkeypatch):
    monkeypatch.setattr(gateway, 'READER_READ_ONLY_POST_PATHS', frozenset())
    with pytest.raises(ValueError, match='source_not_permitted'): aggregate(monkeypatch)


@pytest.mark.parametrize('route', ['/licensing/licenses', '/inspection/tasks', '/api/Application/MyComplatedPage'])
def test_other_sources_rejected(monkeypatch, route):
    with pytest.raises(ValueError): aggregate(monkeypatch, startPath=route)


@pytest.mark.parametrize('period,start,end', [('this week', '2026-09-14', '2026-09-21'),
    ('last week', '2026-09-07', '2026-09-14'), ('this month', '2026-09-01', '2026-10-01'),
    ('last month', '2026-08-01', '2026-09-01'), ('this year', '2026-01-01', '2027-01-01'),
    ('last year', '2025-01-01', '2026-01-01')])
def test_calendar_ranges(period, start, end):
    a, b = gateway._completion_window(period, datetime(2026, 9, 16, tzinfo=timezone.utc))
    assert a.date().isoformat() == start and b.date().isoformat() == end


def test_leap_month_and_year_boundary():
    a, b = gateway._completion_window('last month', datetime(2024, 3, 1, tzinfo=timezone.utc))
    assert (b - a).days == 29
    a, b = gateway._completion_window('last month', datetime(2026, 1, 3, tzinfo=timezone.utc))
    assert a.year == 2025 and a.month == 12 and b.year == 2026


@pytest.mark.parametrize('question', ['How many licenses did I complete last week?',
    'How many applications have I completed this month?', 'How many applications did I complete previous week?'])
def test_narrow_personal_count_intent(question):
    assert _personal_completion_query(question, {})


@pytest.mark.parametrize('question', ['How many licenses did my team complete last week?',
    'How many licenses did I complete last week for films?', 'How many approved licenses did I complete last week?',
    'What about last week?', 'How many licenses were issued last week?'])
def test_never_drop_scope_or_filter(question):
    assert not _personal_completion_query(question, {})


def test_context_carries_measure_not_previous_value():
    assert _personal_completion_query('What about last week?', {'previousIntent': {
        'question': 'How many licenses did I complete this week?'}}) == 'last week'
    req = PortalReadRequest('/licensing/applications', ({'type': 'observe'},), completion_period='last week')
    assert req.as_payload()['completionPeriod'] == 'last week'


def test_gateway_openapi_describes_limits_and_field():
    schema = gateway.app.openapi()['components']['schemas']['AdminPortalReadRequest']['properties']['completionPeriod']
    assert 'taskApprovalAt' in schema['description'] and '3000' in schema['description']


@pytest.mark.parametrize('route', ['/licensing/applications', '/content/ContentApplications'])
@pytest.mark.parametrize('count', [0, 21])
def test_reader_real_orchestration_preserves_aggregate_and_context(route, count):
    from test_admin_portal_reader import Gateway, Planner, run_reader, user_info_for_paths
    obs = observation()
    obs['completionAggregate'] = {'verified': True, 'period': 'last week', 'count': count,
        'startInclusive': '2026-09-07T00:00:00+04:00', 'endExclusive': '2026-09-14T00:00:00+04:00',
        'scope': 'personal', 'dateField': 'taskApprovalAt', 'stablePasses': 2}
    g = Gateway(info={'ok': True, 'result': user_info_for_paths(route)},
                portal_result={'ok': True, 'result': {'status': 'success', 'observation': obs}})
    planner = Planner()
    outcome = run_reader(g, planner, question='What about last week?', conversation_context={
        'previousIntent': {'question': 'How many licenses did I complete this week?'}})
    result = outcome.result
    assert result.status == 'success' and result.scope == 'personal'
    assert result.page == route and result.completeness == 'complete'
    assert f'last week: {count}.' in result.facts[0]
    assert 'not by license issuance' in ' '.join(result.public_json()['facts'])
    assert result.public_json()['countSource']['labels'] == ['Personal Completed applications by task approval time']
    assert len(planner.calls) == 0
    assert g.events == ['GetUserInfo', 'knowledge.search', 'admin.portal.read', 'admin.portal.read']
    assert g.calls[-1][1]['completionPeriod'] == 'last week'


@pytest.mark.parametrize('routes,expected', [(['/inspection/tasks'], 'no_permission'),
    (['/licensing/applications', '/content/ContentApplications'], 'not_confirmed')])
def test_aggregate_does_not_choose_an_unauthorized_or_ambiguous_module(routes, expected):
    from test_admin_portal_reader import Gateway, run_reader, user_info_for_paths
    g = Gateway(info={'ok': True, 'result': user_info_for_paths(*routes)})
    result = run_reader(g, question='How many licenses did I complete last week?').result
    assert result.status == expected
    assert 'admin.portal.read' not in g.events


def test_incomplete_aggregate_cannot_inherit_unfiltered_total():
    from test_admin_portal_reader import Gateway, run_reader, user_info_for_paths
    obs = observation()
    obs['completionAggregate'] = {'verified': False, 'reason': 'completion_pagination_incomplete'}
    g = Gateway(info={'ok': True, 'result': user_info_for_paths('/licensing/applications')},
                portal_result={'ok': True, 'result': {'facts': ['Total: 665'], 'observation': obs}})
    result = run_reader(g, question='How many licenses did I complete last week?').result
    assert result.status == 'not_confirmed' and not result.facts


def test_repeated_followup_retains_only_verified_measure():
    from app.service import _reader_presentation_metadata
    source = {'page': '/licensing/applications', 'view': 'Completed',
              'labels': ['Personal Completed applications by task approval time']}
    metadata = _reader_presentation_metadata({'result': 'success', 'answerShape': 'count',
        'completeness': 'complete', 'scope': 'personal', 'page': source['page'], 'countSource': source,
        'facts': ['Your Completed applications last week: 21.']})
    assert '21' not in str(metadata)
    context = {'previousIntent': {'question': 'What about last week?', 'resultStatus': 'success', **metadata}}
    assert _personal_completion_query('What about this month?', context) == 'this month'
    context['previousIntent']['resultStatus'] = 'no_permission'
    assert not _personal_completion_query('What about this month?', context)
