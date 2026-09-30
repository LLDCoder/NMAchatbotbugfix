import json
from dataclasses import replace

import pytest

from app.portal_reader import (
    _category_control_requiring_children,
    _result_from_structured_observation,
    observation_fallback_result,
    reader_answer_shape,
    observation_result_from_plan,
    _observation_evidence_for_result,
    ReaderResult,
    _observed_identity_search,
    _guard_requested_team_scope,
    _guard_requested_queue_view,
    normalize_empty_observation_plan,
    normalize_bounded_list_plan,
    _observed_tab_catalogue,
    _observed_explicit_route_failure,
    ReaderOutcome,
    PortalReadRequest,
    _observed_search_clear,
    _search_clear_verified,
    _bind_observed_actions,
    _native_metric_count_fallback,
)
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths


def test_filter_action_binds_to_the_current_observed_control():
    request = PortalReadRequest(
        start_path='/licensing/applications',
        actions=({'type': 'filter', 'field': 'All Statuses', 'value': 'Final Approval'},),
    )
    observation = {'filterControls': [{
        'role': 'combobox', 'label': 'All Statuses',
        'selector': '#status-filter', 'filterSurface': True,
        'options': ['External Approval', 'Final Approval'],
    }]}
    bound, error = _bind_observed_actions(request, observation, record_identity='')
    assert not error
    assert bound is not None
    assert bound.actions == ({'type': 'filter', 'selector': '#status-filter', 'value': 'Final Approval'},)


def test_filter_action_rejects_an_unobserved_value():
    request = PortalReadRequest(
        start_path='/work',
        actions=({'type': 'filter', 'field': 'Status', 'value': 'Invented'},),
    )
    observation = {'filterControls': [{
        'role': 'combobox', 'label': 'Status', 'selector': '#status',
        'filterSurface': True, 'options': ['Open', 'Closed'],
    }]}
    bound, error = _bind_observed_actions(request, observation, record_identity='')
    assert bound is None and error == 'filter_value_not_observed'


def test_count_fallback_prefers_a_uniquely_matching_visible_metric():
    result = _native_metric_count_fallback(
        {
            'readHealth': {'healthy': True},
            'metrics': [
                {'label': 'To Do', 'value': '70'},
                {'label': 'Pending Review', 'value': '53'},
            ],
            'sectionSummaries': [{'kind': 'table', 'selectedState': 'To Do'}],
        },
        page='/licensing/applications', scope='unknown',
        question='How many applications are waiting for me to review?',
    )
    assert result is not None
    assert result.facts == ('Pending Review: 53',)


@pytest.mark.parametrize('question,accepted', [
    ('Clear the search and show three records.', True),
    ('Clear that search and confirm the original queue is back.', True),
    ('Please clear search.', True),
    ('Clear that account search and show three Account IDs only.', True),
    ('Clear that task search and show three queued tasks again.', True),
    ('Do not clear the search.', False),
    ('Explain how to clear the search.', False),
    ('Clear the search unless the status is Open.', False),
    ('Clear all filters.', False),
])
def test_literal_search_clear_uses_only_unique_native_search(question, accepted):
    observation = {'filterControls': [{'role': 'textbox', 'label': 'Search', 'selector': '#search',
                    'filterSurface': True, 'selected': ['R-1'], 'commands': ['Filter', 'Reset']}]}
    plan = _observed_search_clear(question, observation, '/work')
    assert bool(plan) is accepted
    if plan:
        assert plan['portalRequest']['actions'] == [
            {'type': 'filter', 'selector': '#search', 'value': ''},
            {'type': 'apply_filter', 'role': 'button', 'name': 'Filter'},
        ]
    observation['filterControls'] *= 2
    assert _observed_search_clear(question, observation, '/work') is None


@pytest.mark.parametrize('healthy,selected,status,verified', [
    (True, [], 'success', True), (False, [], 'success', False),
    (True, ['R-1'], 'success', False), (True, [], 'load_failed', False),
])
def test_search_clear_evidence_requires_executed_action_and_healthy_new_value(healthy, selected, status, verified):
    request = PortalReadRequest(start_path='/work', actions=({'type': 'filter', 'selector': '#search', 'value': ''},))
    payload = {'result': status, 'observation': {'readHealth': {'healthy': healthy},
               'filterControls': [{'role': 'textbox', 'label': 'Search', 'selector': '#search', 'selected': selected}]}}
    assert _search_clear_verified(request, payload) is verified
    assert not _search_clear_verified(PortalReadRequest(start_path='/work', actions=({'type': 'observe'},)), payload)


@pytest.mark.parametrize('healthy,rows,fact,selected,accepted', [
    (True, [], 'No Data', 'To Do', True),
    (False, [], 'No Data', 'To Do', False),
    (True, [{'Reference': 'REF-1'}], 'No Data', 'To Do', False),
    (True, [], 'All records were deleted', 'To Do', True),
    (True, [], 'No matching records were found for this search.', 'To Do', True),
    (False, [], 'No matching records were found for this search.', 'To Do', False),
    (True, [], 'No Data', 'Completed', False),
])
def test_redundant_empty_fact_normalization_requires_healthy_matching_native_evidence(healthy, rows, fact, selected, accepted):
    observation = {'readHealth': {'healthy': healthy}, 'sectionSummaries': [{
        'nodeId': 'table-1', 'kind': 'table', 'heading': 'Records', 'selectedState': 'To Do',
        'rowFields': rows, 'rowSummaries': [], 'emptyState': 'No Data',
    }]}
    plan = {'mode': 'observation_result', 'result': 'no_data', 'sourceSection': 'table-1',
            'answerShape': 'list', 'selectedState': selected, 'facts': [fact], 'missing': []}
    normalized = normalize_empty_observation_plan(plan, observation)
    assert (normalized['facts'] == []) is accepted
    assert plan['facts'] == [fact]


def test_empty_normalization_never_infers_absence_from_unmarked_or_unbound_table():
    for empty, source in [('', 'table-1'), ('No Data', 'missing-table')]:
        observation = {'readHealth': {'healthy': True}, 'sectionSummaries': [{
            'nodeId': 'table-1', 'kind': 'table', 'heading': 'Records',
            'rowFields': [], 'rowSummaries': [], 'emptyState': empty,
        }]}
        plan = {'mode': 'observation_result', 'result': 'no_data', 'sourceSection': source,
                'facts': ['There are no records anywhere.'], 'missing': []}
        assert normalize_empty_observation_plan(plan, observation) == plan


@pytest.mark.parametrize('question,selected,blocked', [
    ('Show Inspection To Do tasks', 'Queued Tasks', True),
    ('From the queued task list, give me one Task No.', 'To Do', True),
    ('How many Inspection Queued Tasks are there?', 'To Do', True),
    ('Show records in Completed', 'To Do', True),
    ('Show records in Completed', 'Completed', False),
    ('Show Inspection Queued Tasks', 'Queued Tasks', False),
    ('Explain records in Completed', 'To Do', False),
    ('Compare records in To Do and in Completed', 'To Do', False),
    ('Show records', 'To Do', False),
])
def test_explicit_queue_must_not_be_replaced_by_another_native_view(question, selected, blocked):
    result = ReaderResult(status='success', summary='', page='/work', answer_shape='list',
                          source_section='observation-table-001', facts=('REF-1 Waiting',))
    outcome = ReaderOutcome(result, {'observation': observed(selected)})
    guarded = _guard_requested_queue_view(outcome, question)
    assert (guarded.result.status == 'not_confirmed') is blocked
    if blocked:
        assert 'REF-1' not in str(guarded.result.facts)
        assert 'layout shows' in guarded.result.facts[0]
        assert guarded.result.missing == ('requested_queue_view_unverified',)
    else:
        assert guarded == outcome


@pytest.mark.parametrize('language', ['en', 'zh', 'ar'])
def test_queue_mismatch_has_a_specific_safe_explanation(language):
    from app.service import reader_evidence_only_response
    result = {'result': 'not_confirmed', 'facts': [], 'missing': ['requested_queue_view_unverified']}
    answer = reader_evidence_only_response(result, language)
    assert answer and 'requested_queue_view_unverified' not in answer
    assert answer != reader_evidence_only_response({**result, 'missing': []}, language)


def test_fallback_retains_native_node_id_for_member_scope_verification():
    observation = {'readHealth': {'healthy': True}, 'sectionSummaries': [{
        'nodeId': 'table-1', 'kind': 'table', 'heading': '',
        'columnHeaders': ['Team Members', 'Total Tasks'],
        'rowFields': [{'Team Members': 'Member A', 'Total Tasks': '5'}],
        'rowSummaries': ['Member A 5'],
    }]}
    result = observation_fallback_result('Show a bounded summary of Team Performance', observation,
                                         page='/reports', answer_shape='overview')
    assert result.source_section == 'table-1'
    outcome = ReaderOutcome(result, {'observation': observation})
    intent = {'slots': {'requestedScope': {'source': 'current', 'value': 'team', 'evidence': 'Team'}}}
    assert _guard_requested_team_scope(outcome, intent) == outcome


def test_native_list_fallback_allows_requested_status_field():
    observation = {
        'readHealth': {'healthy': True},
        'sectionSummaries': [{
            'nodeId': 'task-table', 'kind': 'table', 'heading': '',
            'columnHeaders': ['Task No.', 'Status', 'Assigned To'],
            'rowFields': [
                {'Task No.': 'TASK-1', 'Status': 'Initial Approval', 'Assigned To': 'Staff A'},
                {'Task No.': 'TASK-2', 'Status': 'Completed', 'Assigned To': 'Staff B'},
            ],
            'rowSummaries': ['TASK-1 Initial Approval Staff A', 'TASK-2 Completed Staff B'],
        }],
    }
    result = observation_fallback_result(
        'Please provide a list of records including detailed information and status.',
        observation,
        page='/tasks',
        answer_shape='list',
    )
    assert result is not None and result.status == 'success'
    assert json.loads(result.facts[0])['Status'] == 'Initial Approval'
    assert json.loads(result.facts[1])['Task No.'] == 'TASK-2'


def test_native_list_fallback_marks_comprehensive_request_as_bounded():
    observation = {
        'readHealth': {'healthy': True},
        'sectionSummaries': [{
            'nodeId': 'task-table', 'kind': 'table', 'heading': '',
            'rowFields': [{'Task No.': 'TASK-1', 'Status': 'Initial Approval'}],
        }],
    }
    result = observation_fallback_result(
        'Provide a comprehensive list of records including status.',
        observation,
        page='/tasks',
        answer_shape='list',
    )
    assert result is not None
    assert result.status == 'not_confirmed'
    assert result.completeness == 'bounded'
    assert result.missing == ('complete_collection_not_verified',)
    assert json.loads(result.facts[0]) == {'Task No.': 'TASK-1', 'Status': 'Initial Approval'}


@pytest.mark.parametrize('kind,facts,shape', [
    ('metrics',['Total 0'],'count'), ('cards',['Person A Completed 7'],'list'),
])
@pytest.mark.parametrize('healthy',[True,False])
@pytest.mark.parametrize('status',['success','not_confirmed'])
def test_metric_and_card_results_require_settled_data(kind,facts,shape,healthy,status):
    source='observation-'+kind+'-001'
    observation={'sectionSummaries':[{'nodeId':source,'kind':kind,'heading':'',
        'summaries':facts if kind=='metrics' else [],'cardSummaries':facts if kind=='cards' else []}],
        'readHealth':{'healthy':healthy,'pending':[] if healthy else ['/api/example/list']}}
    plan={'mode':'observation_result','result':status,'facts':facts,'missing':[],
          'sourceSection':source,'answerShape':shape,'completeness':'bounded'}
    if status == 'not_confirmed':
        plan['missing'] = ['remaining_fields_unavailable']
    assert (observation_result_from_plan(plan,observation) is not None) is healthy
    result=_result_from_structured_observation(observation,page='/work',section_name=source,
        answer_shape=shape,scope='unknown',question='How many records?' if shape=='count' else 'Show members')
    assert (result is not None) is healthy


def test_initial_unobserved_section_is_observed_before_scoped_action():
    observation = observed('Group Items')
    gateway = Gateway(info={'ok': True, 'result': user_info_for_paths('/work')},
                      portal_result={'ok': True, 'result': {'result': 'success', 'observation': observation}})
    planner = Planner(
        portal_plan_for('/work', [{'type': 'switch_tab', 'role': 'tab', 'name': 'Group Items',
                                  'section': 'Documented list title'}]),
        {'mode': 'observation_result', 'result': 'success', 'page': '/work',
         'section': 'Group Items', 'sourceSection': 'observation-table-001', 'answerShape': 'list',
         'completeness': 'bounded', 'selectedState': 'Group Items', 'facts': ['REF-1 Waiting'], 'missing': []},
    )
    outcome = run_reader(gateway, planner, question='Show Group Items')
    read = next(call for call in gateway.calls if call[0] == 'admin.portal.read')
    assert read[1]['actions'] == [{'type': 'observe'}]
    assert planner.calls[1][2]['planningDirective']['preserveRequestedScope'] is True
    instruction = planner.calls[1][2]['planningDirective']['instruction']
    assert 'not a user scope constraint' in instruction
    assert 'Do not preserve its invented section name' in instruction
    assert 'user requires a particular region' in instruction
    assert planner.calls[1][2]['unverifiedInitialPlan']['actions'][0]['section'] == 'Documented list title'
    assert outcome.result.facts == ('REF-1 Waiting',)


def observed(active="Waiting Items"):
    return {
        "tabControls": [{"name": name, "selected": name == active} for name in ("Waiting Items", "Group Items", "Group Members")],
        "sectionSummaries": [{
            "nodeId": "observation-table-001", "kind": "table", "heading": "",
            "selectedState": active, "columnHeaders": ["Reference", "Status"],
            "rowSummaries": ["REF-1 Waiting"], "summaries": ["Total 37"],
        }],
        "readHealth": {"healthy": True},
    }


def search_context(identity='REF-123'):
    return {'resolvedIntent': {'relation': 'new', 'slots': {'recordIdentity': {
        'source': 'current', 'value': identity, 'evidence': identity,
    }}, 'clarificationOptions': []}}


def search_observation():
    return {'filterControls': [{'label': 'Search', 'role': 'textbox', 'filterSurface': True,
        'selector': 'input[placeholder="Search"]', 'selected': [], 'commands': ['Filter', 'Reset']}]}


def test_exact_identity_uses_observed_search_and_apply_not_unfiltered_sample():
    plan = _observed_identity_search('Find record REF-123.', search_context(), search_observation(), '/work')
    assert plan['portalRequest']['actions'] == [
        {'type': 'filter', 'selector': 'input[placeholder="Search"]', 'value': 'REF-123'},
        {'type': 'apply_filter', 'role': 'button', 'name': 'Filter'},
    ]


def test_standalone_literal_identifier_can_use_unique_observed_search():
    plan = _observed_identity_search('Find application REF-123-456.', {}, search_observation(), '/work')
    assert plan['portalRequest']['actions'][0]['value'] == 'REF-123-456'


@pytest.mark.parametrize('question', ['Find REF-123 and REF-456', 'Find records dated 2026-09-08',
    'Find https://example.test/REF-123', 'Explain REF-123', 'Find records with no reference'])
def test_standalone_search_does_not_guess_identity_from_dates_urls_or_multiple_tokens(question):
    assert _observed_identity_search(question, {}, search_observation(), '/work') is None


@pytest.mark.parametrize('question', ['Find REF-1234', 'Explain REF-123', 'Show records except REF-123', 'Show all records'])
def test_identity_search_cannot_invent_current_intent(question):
    assert _observed_identity_search(question, search_context(), search_observation(), '/work') is None


@pytest.mark.parametrize('patch', [{'selected': ['REF-123']}, {'commands': ['Filter', 'Apply']},
    {'filterSurface': False}, {'role': 'combobox'}, {'selector': ''}])
def test_identity_search_requires_unique_unapplied_observed_control(patch):
    observation = search_observation()
    observation['filterControls'][0].update(patch)
    assert _observed_identity_search('Find REF-123', search_context(), observation, '/work') is None


def test_identity_search_refuses_ambiguous_search_boxes():
    observation = search_observation()
    observation['filterControls'] *= 2
    assert _observed_identity_search('Find REF-123', search_context(), observation, '/work') is None


def test_identity_search_with_no_apply_button_only_sets_observed_search():
    observation = search_observation()
    observation['filterControls'][0]['commands'] = []
    plan = _observed_identity_search('Find REF-123', search_context(), observation, '/work')
    assert plan['portalRequest']['actions'] == [{'type': 'filter', 'selector': 'input[placeholder="Search"]', 'value': 'REF-123'}]


def bounded_limit_fixture():
    observation = {'readHealth': {'healthy': True}, 'sectionSummaries': [{
        'nodeId': 'observation-table-001', 'kind': 'table', 'heading': '', 'selectedState': 'Completed',
        'columnHeaders': ['Reference', 'Status'], 'rowFields': [{'Reference': 'REF-1', 'Status': 'Pending'}],
        'rowSummaries': ['REF-1 Pending'],
    }]}
    plan = {'mode': 'observation_result', 'result': 'not_confirmed', 'answerShape': 'list',
        'page': '/work', 'sourceSection': 'observation-table-001', 'selectedState': 'Completed',
        'completeness': 'bounded', 'facts': ['{"Reference":"REF-1","Status":"Pending"}'],
        'missing': ['Only one row was returned in the Completed view; the requested first three records could not be fully listed.']}
    return plan, observation


def test_available_records_can_satisfy_upper_bound_without_becoming_a_total():
    plan, observation = bounded_limit_fixture()
    normalized = normalize_bounded_list_plan(plan, observation, 3)
    assert normalized['result'] == 'success'
    assert normalized['facts'] == plan['facts']
    assert normalized['completeness'] == 'bounded'
    assert 'not a collection-wide total' in normalized['workflowState']


@pytest.mark.parametrize('key,value', [
    ('facts', ['{"Reference":"REF-999","Status":"Pending"}']),
    ('sourceSection', 'unrelated'), ('selectedState', 'To Do'), ('answerShape', 'count'),
    ('missing', ['Only one row was returned; permission evidence could not be confirmed.']),
    ('missing', ['Requested status not available']), ('missing', []),
])
def test_upper_bound_normalization_preserves_unrelated_uncertainty(key, value):
    plan, observation = bounded_limit_fixture()
    plan[key] = value
    assert normalize_bounded_list_plan(plan, observation, 3) == plan


@pytest.mark.parametrize('limit', [0, 1, True, '3', 100])
def test_upper_bound_normalization_requires_explicit_numeric_limit(limit):
    plan, observation = bounded_limit_fixture()
    assert normalize_bounded_list_plan(plan, observation, limit) == plan


def test_upper_bound_normalization_refuses_unhealthy_observation():
    plan, observation = bounded_limit_fixture()
    observation['readHealth']['healthy'] = False
    assert normalize_bounded_list_plan(plan, observation, 3) == plan


def test_upper_bound_normalization_does_not_count_two_projections_of_one_row_as_two_records():
    plan, observation = bounded_limit_fixture()
    observation['sectionSummaries'][0]['rowFields'].append({'Reference': 'REF-2', 'Status': 'Pending'})
    plan['facts'].append('{"Reference":"REF-1"}')
    assert normalize_bounded_list_plan(plan, observation, 3) == plan


TAB_QUESTION = 'In Violation Management, which queue tabs are available to my current account?'


def tab_outcome(tabs):
    return ReaderOutcome(ReaderResult(status='success', summary='', page='/work', answer_shape='list',
        facts=('REF-1 Open',)), {'observation': {'readHealth': {'healthy': True}, 'tabControls': tabs}})


def test_tab_inventory_uses_visible_controls_not_record_rows():
    outcome = tab_outcome([{'name': 'To Do', 'selected': True}, {'name': 'Completed', 'selected': False}])
    result = _observed_tab_catalogue(outcome, TAB_QUESTION).result
    assert result.status == 'success'
    assert result.answer_shape == 'detail'
    assert result.facts == ('Visible tab: To Do', 'Visible tab: Completed')
    assert result.scope == 'unknown'


def test_no_named_tab_controls_does_not_mean_no_business_data_or_permission():
    result = _observed_tab_catalogue(tab_outcome([]), TAB_QUESTION).result
    assert result.status == 'success'
    assert result.facts == ('No named visible tab controls were observed on this page during this read.',)


def test_conditional_queue_request_reports_absent_controls_without_substitution():
    question = 'Show three records in Completed, if that queue exists for this account.'
    result = _observed_tab_catalogue(tab_outcome([]), question).result
    assert result.status == 'not_confirmed'
    assert result.facts == ()
    assert result.missing == ('observed_queue_not_available',)
    outcome = tab_outcome([{'name': 'To Do'}, {'name': 'Completed'}])
    assert _observed_tab_catalogue(outcome, question) == outcome


@pytest.mark.parametrize('question', ['Show the completed records.', 'Which queue tabs are available and how many records?',
    'What tabs were visible yesterday?', 'Hide all tabs.', 'Show tabs for another account.'])
def test_data_or_historical_questions_do_not_become_tab_inventory(question):
    outcome = tab_outcome([{'name': 'Completed'}])
    assert _observed_tab_catalogue(outcome, question) == outcome


@pytest.mark.parametrize('status', ['no_permission', 'load_failed'])
def test_tab_inventory_never_overrides_denied_or_failed_read(status):
    outcome = tab_outcome([{'name': 'Completed'}])
    outcome = ReaderOutcome(replace(outcome.result, status=status), outcome.audit_evidence)
    assert _observed_tab_catalogue(outcome, TAB_QUESTION) == outcome


@pytest.mark.parametrize('patch', [{'tabControls': None}, {'tabControls': [{'name': ''}]},
    {'readHealth': {'healthy': False}}, {'readHealth': None}])
def test_tab_inventory_needs_healthy_native_schema(patch):
    outcome = tab_outcome([{'name': 'Completed'}])
    outcome.audit_evidence['observation'].update(patch)
    assert _observed_tab_catalogue(outcome, TAB_QUESTION) == outcome


def test_explicit_route_404_is_page_failure_not_empty_business_result():
    outcome = ReaderOutcome(ReaderResult(status='not_confirmed', summary='', page='/work'), {
        'observation': {'regions': ['Work 404 Page not found or unavailable.'], 'rowSummaries': []}})
    result = _observed_explicit_route_failure(outcome, 'Open /work specifically and tell me whether that page works.').result
    assert result.status == 'load_failed'
    assert result.missing == ('observed_page_not_found',)


@pytest.mark.parametrize('page,status,rows', [('/other', 'not_confirmed', []),
    ('/work', 'no_permission', []), ('/work', 'success', ['REF-1 404 Page not found or unavailable.'])])
def test_explicit_route_check_does_not_confuse_other_pages_denial_or_record_text(page, status, rows):
    outcome = ReaderOutcome(ReaderResult(status=status, summary='', page=page), {
        'observation': {'regions': ['404 Page not found or unavailable.'], 'rowSummaries': rows}})
    assert _observed_explicit_route_failure(outcome, 'Open /work specifically and tell me whether that page works.') == outcome


@pytest.mark.parametrize('status', ['success', 'no_data'])
def test_requested_team_scope_cannot_relabel_personal_table(status):
    result = ReaderResult(status=status, summary='', page='/work', answer_shape='count',
        source_section='observation-table-001', selected_state='To Do', facts=('Total 162',))
    outcome = ReaderOutcome(result, {'observation': observed('To Do')})
    intent = {'slots': {'requestedScope': {'value': 'team', 'source': 'current', 'evidence': 'team'}}}
    guarded = _guard_requested_team_scope(outcome, intent)
    assert guarded.result.status == 'not_confirmed'
    assert guarded.result.facts == ()
    assert guarded.result.missing == ('requested_team_scope_unverified',)


def test_verified_nested_team_tab_path_retains_completed_result():
    observation = observed('Completed')
    observation['sectionSummaries'][0]['selectedTabPath'] = ['Team Tasks', 'Completed']
    result = ReaderResult(status='success', summary='', page='/work', source_section='observation-table-001',
        selected_state='Completed', facts=('Total 31',))
    outcome = ReaderOutcome(result, {'observation': observation})
    intent = {'slots': {'requestedScope': {'value': 'team', 'source': 'current', 'evidence': 'team'}}}
    assert _guard_requested_team_scope(outcome, intent) == outcome


def test_team_scope_guard_does_not_require_live_view_for_documented_definition():
    result = ReaderResult(status='success', summary='', page='/reports', answer_shape='detail', facts=('Team metrics are aggregated.',))
    outcome = ReaderOutcome(result, {'stage': 'knowledge_only'})
    intent = {'slots': {'requestedScope': {'value': 'team', 'source': 'current', 'evidence': 'team'}}}
    assert _guard_requested_team_scope(outcome, intent, 'Explain team metrics') == outcome


def test_unrelated_team_tab_cannot_prove_current_table_scope():
    observation = observed('To Do')
    observation['tabControls'].append({'name': 'Team Tasks', 'selected': True})
    result = ReaderResult(status='success', summary='', page='/work', source_section='observation-table-001',
        selected_state='To Do', facts=('Total 162',))
    outcome = ReaderOutcome(result, {'observation': observation})
    intent = {'slots': {'requestedScope': {'value': 'team', 'source': 'current', 'evidence': 'team'}}}
    assert _guard_requested_team_scope(outcome, intent).result.status == 'not_confirmed'
    assert _guard_requested_team_scope(outcome, {}, 'Show the inspection team tasks').result.status == 'not_confirmed'


def test_initial_overlay_reset_is_observed_before_any_button_click():
    observation = observed('Group Items')
    observation['dialogs'] = []
    gateway = Gateway(info={'ok': True, 'result': user_info_for_paths('/work')},
                      portal_result={'ok': True, 'result': {'result': 'success', 'observation': observation}})
    planner = Planner(
        portal_plan_for('/work', [{'type': 'reset_filter', 'role': 'button', 'name': 'Invented Reset'}]),
        {'mode': 'observation_result', 'result': 'success', 'page': '/work', 'section': 'Group Items',
         'sourceSection': 'observation-table-001', 'answerShape': 'list', 'completeness': 'bounded',
         'selectedState': 'Group Items', 'facts': ['REF-1 Waiting'], 'missing': []},
    )
    outcome = run_reader(gateway, planner, question='Show Group Items')
    reads = [call for call in gateway.calls if call[0] == 'admin.portal.read']
    assert reads[0][1]['actions'] == [{'type': 'observe'}]
    assert not any(action['type'] == 'reset_filter' for call in reads for action in call[1]['actions'])
    assert outcome.result.status == 'success'


def test_partial_raw_switch_result_still_interprets_observed_selected_view():
    gateway = Gateway(info={'ok': True, 'result': user_info_for_paths('/work')},
        portal_result={'ok': True, 'result': {'status': 'not_confirmed',
            'facts': ['A report card was found'], 'missing': ['requested fields'],
            'observation': observed('Group Items')}})
    planner = Planner(portal_plan_for('/work', [{'type': 'switch_tab', 'role': 'tab', 'name': 'Group Items'}]),
        {'mode': 'observation_result', 'result': 'success', 'page': '/work',
         'section': 'Group Items', 'sourceSection': 'observation-table-001', 'answerShape': 'list',
         'completeness': 'bounded', 'selectedState': 'Group Items', 'facts': ['REF-1 Waiting'], 'missing': []})
    outcome = run_reader(gateway, planner, question='Show Group Items')
    assert outcome.result.status == 'success'
    assert outcome.result.facts == ('REF-1 Waiting',)
    assert len(planner.calls) == 2


def test_nonnumeric_catalogue_cards_can_form_a_bounded_overview():
    observation = {'tabControls': [{'name': 'Reports', 'selected': True}],
        'readHealth': {'healthy': True}, 'sectionSummaries': [{
            'nodeId': 'observation-cards-001', 'kind': 'cards', 'heading': 'Reports',
            'selectedState': 'Reports', 'cardSummaries': ['Recorded Books', 'Media Permit Applications'],
        }]}
    result = observation_fallback_result('Show a bounded summary of the current Reports view', observation,
        page='/reports-analytics', section='observation-cards-001', answer_shape='overview')
    assert result.status == 'success'
    assert 'Recorded Books' in result.facts
    assert result.completeness == 'bounded'
    assert observation_fallback_result('How many reports?', observation,
        page='/reports-analytics', section='observation-cards-001', answer_shape='count') is None


def test_overview_fallback_uses_current_route_for_parent_page_context():
    observation = observed('Team Performance')
    observation['tabControls'] = [{'name': 'Reports', 'selected': False}, {'name': 'Team Performance', 'selected': True}]
    observation['sectionSummaries'][0]['rowFields'] = [{'Team Member': 'Example Member', 'Tasks': '2'}]
    result = observation_fallback_result('Show the current Team Performance view in Content Reports & Analytics',
        observation, page='/content/reports-analytics', section='observation-table-001', answer_shape='overview')
    assert result is not None
    assert result.status == 'success'


@pytest.mark.parametrize("shape,question", [
    ("list", "Show Group Items"), ("detail", "Show details of Group Items"),
    ("count", "How many Group Items are there?"),
    ("overview", "Show a current summary of Group Items"),
])
def test_unselected_named_tab_requires_its_own_evidence(shape, question):
    requirement = _category_control_requiring_children(question, observed(), None, shape)
    assert requirement is not None
    assert requirement.control_label == "Group Items"


@pytest.mark.parametrize("shape", ["list", "count"])
def test_default_tab_rows_cannot_become_named_tab_fallback(shape):
    assert _result_from_structured_observation(
        observed(), page="/work", section_name="observation-table-001", answer_shape=shape,
        scope="unknown", question="Show Group Items" if shape == "list" else "How many Group Items?",
    ) is None
    assert observation_fallback_result(
        "Show Group Items", observed(), page="/work", section="observation-table-001", answer_shape=shape,
    ) is None


def test_overview_cannot_fall_back_to_another_tabs_total():
    assert observation_fallback_result(
        'Show a current summary of Group Items', observed(), page='/work',
        section='observation-table-001', answer_shape='overview',
    ) is None


def test_unhealthy_read_cannot_become_a_successful_overview_fallback():
    observation = observed('Group Items')
    observation['readHealth'] = {'healthy': False, 'blocked': ['/api/unknown-dependency']}
    assert observation_fallback_result(
        'Show a current summary of Group Items', observation, page='/work',
        section='observation-table-001', answer_shape='overview',
    ) is None


def test_healthy_selected_overview_keeps_its_own_summary():
    result = observation_fallback_result(
        'Show a current summary of Group Items', observed('Group Items'), page='/work',
        section='observation-table-001', answer_shape='overview',
    )
    assert result is not None and result.facts == ('Total 37',)


def test_selected_table_overview_retains_native_sample_not_only_total():
    observation = observed('Group Items')
    table = observation['sectionSummaries'][0]
    table['rowFields'] = [{'Service': 'Example Type', 'Submitted': '7', 'Issued': '5',
                           'Rejected': '2', 'Pending': '0', 'Region / West': '25.00%'}]
    result = observation_fallback_result(
        'Show a current summary of Group Items', observation, page='/work',
        section='observation-table-001', answer_shape='overview',
    )
    assert result.status == 'success'
    assert json.loads(result.facts[0]) == {
        'Service': 'Example Type', 'Submitted': '7', 'Issued': '5', 'Rejected': '2', 'Pending': '0',
    }
    assert result.facts[-1] == 'Total 37'
    assert result.completeness == 'bounded' and result.missing


def test_table_overview_keeps_complete_pairs_within_fact_budget():
    observation = observed('Group Items')
    table = observation['sectionSummaries'][0]
    table['rowFields'] = [{'Reference': 'REF-1', 'Status': 'Waiting', 'Description': 'x' * 300}]
    table['summaries'] = []
    result = observation_fallback_result(
        'Show a current summary of Group Items', observation, page='/work',
        section='observation-table-001', answer_shape='overview',
    )
    assert result.status == 'success'
    assert json.loads(result.facts[0]) == {'Reference': 'REF-1', 'Status': 'Waiting'}
    assert all(len(fact) <= 300 for fact in result.facts)


def test_overview_never_projects_fields_without_complete_identity_pair():
    observation = observed('Group Items')
    observation['sectionSummaries'][0]['rowFields'] = [{'Reference': 'x' * 300, 'Status': 'Waiting'}]
    result = observation_fallback_result(
        'Show a current summary of Group Items', observation, page='/work',
        section='observation-table-001', answer_shape='overview',
    )
    assert result.facts == ('Total 37',)


def test_selected_tab_is_not_read_again_when_evidence_is_present():
    assert _category_control_requiring_children("Show Group Items", observed("Group Items"), None, "list") is None
    result = _result_from_structured_observation(
        observed("Group Items"), page="/work", section_name="observation-table-001",
        answer_shape="list", scope="unknown", question="Show Group Items",
    )
    assert result is not None and result.facts == ("REF-1 Waiting",)


def test_named_tab_requirement_reaches_first_post_observation_plan():
    gateway = Gateway(info={'ok': True, 'result': user_info_for_paths('/work')},
                      portal_result={'ok': True, 'result': {'result': 'success', 'observation': observed()}})
    planner = Planner(portal_plan_for('/work', [{'type': 'observe'}]),
                      {'mode': 'observation_result', 'result': 'not_confirmed', 'facts': [], 'missing': ['unavailable']},
                      {'mode': 'observation_result', 'result': 'not_confirmed', 'facts': [], 'missing': ['unavailable']})
    run_reader(gateway, planner, question='Show a current summary of Group Items')
    directive = planner.calls[1][2]['planningDirective']
    assert directive['reason'] == 'named_collection_requires_child_evidence'
    assert directive['categoryControl'] == 'Group Items'
    assert directive['requirePortalRead'] is True


@pytest.mark.parametrize('shape', ['list', 'count', 'overview'])
@pytest.mark.parametrize('question', ['Show Team Tasks Completed in the current view',
                                     'Show Team Tasks in Completed'])
def test_selected_parent_does_not_hide_requested_unselected_child(shape, question):
    observation = observed('To Do')
    observation['tabControls'] = [{'name': 'Team Tasks', 'selected': True},
                                  {'name': 'To Do', 'selected': True},
                                  {'name': 'Completed', 'selected': False}]
    requirement = _category_control_requiring_children(
        question, observation, None, shape,
    )
    assert requirement is not None and requirement.control_label == 'Completed'
    assert observation_fallback_result(
        question, observation, section='observation-table-001',
        answer_shape=shape,
    ) is None


def test_search_input_identity_is_not_a_categorical_status_filter():
    from app.portal_reader import _explicit_observed_filter
    observation = {'filterControls': [{'label': 'Search', 'role': 'textbox',
                                      'selected': ['REF-NO-MATCH'], 'options': []}]}
    assert _explicit_observed_filter('Find REF-NO-MATCH.', observation) == ''
    observation['filterControls'].append({'label': 'Status', 'role': 'combobox',
                                          'selected': ['Pending'], 'options': ['Pending']})
    assert _explicit_observed_filter('Show Pending records', observation) == 'Pending'


def test_parent_page_word_does_not_override_explicit_selected_tab():
    observation = observed('Permit Analytics')
    observation['tabControls'] = [{'name': 'Reports', 'selected': False},
                                  {'name': 'Permit Analytics', 'selected': True}]
    assert _category_control_requiring_children(
        'Show a current Permit Analytics summary in Reports and Analytics', observation, None, 'overview',
    ) is None


def test_explicit_unselected_view_wins_over_selected_parent_word():
    observation = observed('Reports')
    observation['tabControls'] = [{'name': 'Reports', 'selected': True},
                                  {'name': 'Permit Analytics', 'selected': False}]
    result = _category_control_requiring_children(
        'Show a current Permit Analytics summary in Reports and Analytics', observation, None, 'overview',
    )
    assert result.control_label == 'Permit Analytics'


@pytest.mark.parametrize('selected', [True, False])
def test_current_route_context_is_not_an_extra_requested_tab(selected):
    observation = observed('Team Performance' if selected else 'Other View')
    observation['tabControls'] = [{'name': 'Reports', 'selected': False},
                                  {'name': 'Team Performance', 'selected': selected}]
    result = _category_control_requiring_children(
        'Show the current Team Performance view in Content Reports & Analytics',
        observation, None, 'overview', current_page='/content/reports-analytics',
    )
    if selected:
        assert result is None
    else:
        assert result.control_label == 'Team Performance'


def test_unrelated_route_does_not_erase_explicit_parent_and_child():
    observation = observed('Team Tasks')
    observation['tabControls'] = [{'name': 'Team Tasks', 'selected': True},
                                  {'name': 'Completed', 'selected': False}]
    result = _category_control_requiring_children(
        'Show Team Tasks in Completed', observation, None, 'list', current_page='/inspection/task-list',
    )
    assert result.control_label == 'Completed'


def test_sibling_metrics_do_not_own_explicit_table_evidence():
    observation = observed('Group Items')
    observation['sectionSummaries'].append({'nodeId': 'metrics-1', 'kind': 'metrics',
        'heading': 'Group Items', 'selectedState': 'Group Items', 'summaries': ['Total 37']})
    result = ReaderResult(status='success', summary='', section='Group Items',
                          source_section='observation-table-001', selected_state='Group Items')
    assert _observation_evidence_for_result(observation,result)['kind'] == 'table'


def test_real_region_still_limits_source_binding():
    observation = observed('Group Items')
    observation['regionSummaries'] = [{'nodeId': 'region-1', 'kind': 'region', 'heading': 'Group Items'}]
    observation['sectionSummaries'][0]['parentRef'] = 'region-2'
    result = ReaderResult(status='success', summary='', section='Group Items',
                          source_section='observation-table-001', selected_state='Group Items')
    assert _observation_evidence_for_result(observation,result) is None


@pytest.mark.parametrize("question", ["Show items", "Show Waiting Items", "Show unrelated records", "Show group"])
def test_do_not_invent_unrequested_tab_requirement(question):
    assert _category_control_requiring_children(question, observed(), None, "list") is None


@pytest.mark.parametrize("question", [
    "How many blocked records are there?", "How many overdue tasks?", "Count the items needing attention",
    "How many records are due today?", "有多少条逾期任务？", "有几个需要关注的记录？",
])
def test_explicit_count_keeps_count_shape(question):
    assert reader_answer_shape(question) == "count"


def test_standalone_count_repairs_planner_answer_shape_before_returning_rows():
    observation = observed("Group Items")
    initial = {"mode": "observation_result", "result": "success", "page": "/work",
               "section": "Group Items", "sourceSection": "observation-table-001", "answerShape": "attention",
               "facts": ["REF-1 Waiting"], "missing": []}
    corrected = {**initial, "answerShape": "count", "facts": ["Total 37"]}
    planner = Planner(portal_plan_for("/work", [{"type": "observe"}]), initial, corrected)
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/work")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": observation}})
    outcome = run_reader(gateway, planner, question="How many Group Items are there?")
    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "count"
    assert outcome.result.facts == ("Total 37",)
    assert len(planner.calls) == 3
    assert planner.calls[-1][2]["planningDirective"]["requestedAnswerShape"] == "count"


@pytest.mark.parametrize("selected", ["To Do", "Completed", "Group Items", "待处理"])
def test_previous_visible_selected_state_is_a_valid_view_anchor(selected):
    from app.reader_intent import SLOT_NAMES, parse_intent_resolution
    slots = {name: {"source": "unspecified", "value": "", "evidence": ""} for name in SLOT_NAMES}
    slots["view"] = {"source": "previous", "value": selected, "evidence": selected}
    context = {"previousIntent": {"question": "Show my records", "selectedState": selected, "answerShape": "list"}}
    result = parse_intent_resolution({"relation": "continue", "slots": slots, "clarificationOptions": []}, "Show three", context)
    assert dict(result.slots)["view"].value == selected


def test_explicit_previous_view_takes_precedence_over_visible_default_tab():
    from app.reader_intent import SLOT_NAMES, parse_intent_resolution
    slots = {name: {"source": "unspecified", "value": "", "evidence": ""} for name in SLOT_NAMES}
    context = {"previousIntent": {"question": "Show Group Items", "view": "Group Items", "selectedState": "Waiting Items"}}
    result = parse_intent_resolution({"relation": "continue", "slots": slots, "clarificationOptions": []}, "Show three", context)
    assert dict(result.slots)["view"].value == "Group Items"


@pytest.mark.parametrize("question", [
    "What is the difference between Waiting Items and Group Items?",
    "Does Group Items mean that each record has that status?",
    "Do Group Items prove personal assignment?",
])
def test_conceptual_tab_mention_does_not_require_inactive_tab_rows(question):
    assert _category_control_requiring_children(question, observed(), None, "detail") is None


def test_standalone_record_request_repairs_total_only_answer():
    observation = observed("Group Items")
    initial = {"mode": "observation_result", "result": "success", "page": "/work",
               "section": "Group Items", "sourceSection": "observation-table-001", "answerShape": "overview",
               "facts": ["Total 37"], "missing": []}
    corrected = {**initial, "answerShape": "list", "facts": ["REF-1 Waiting"]}
    planner = Planner(portal_plan_for("/work", [{"type": "observe"}]), initial, corrected)
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/work")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": observation}})
    outcome = run_reader(gateway, planner, question="Show Group Items including their statuses")
    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "list"
    assert outcome.result.facts == ("REF-1 Waiting",)
