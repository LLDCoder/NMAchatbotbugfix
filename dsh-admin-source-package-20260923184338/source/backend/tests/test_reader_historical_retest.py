import json
from copy import deepcopy
import pytest
from app.portal_reader import (ReaderOutcome,ReaderResult,_documented_object_source,
    reader_answer_shape,_native_optional_record_fields,_native_status_values,
    _native_bounded_summary,_observed_identity_search)
from app.reader_intent import resolve_literal_same_record_reference
from test_admin_portal_reader import Gateway,Planner,run_reader,portal_plan_for,user_info_for_paths


def native(state='Permits'):
    return {'readHealth':{'healthy':True},'tabControls':[{'name':state,'selected':True}],
        'sectionSummaries':[{'kind':'table','nodeId':'t1','selectedState':state,
         'columnHeaders':['Permit No.','Status','Effective Date','Expiry Date'],
         'rowFields':[{'Permit No.':'P-1','Status':'Active','Effective Date':'30/09/2026','Expiry Date':'30/09/2026'},
                      {'Permit No.':'P-2','Status':'Active','Effective Date':'18/09/2026','Expiry Date':'30/09/2026'}]}]}


def outcome(obs=None,status='not_confirmed',missing=('planner_error',)):
    return ReaderOutcome(ReaderResult(status=status,summary='',page='/work/permits',missing=missing),{'observation':obs or native()})


def test_explicit_module_cannot_be_replaced_by_a_matching_queue_in_another_module():
    kb={'ok':True,'chunks':[
        {'content':'## Semantic node: Work permitted records\n- **page:** `/work/permits`\n- **section:** Permits\n- **content:** Permit No.; Status.'},
        {'content':'## Semantic node: Other applications\n- **page:** `/other/applications`\n- **section:** To Do\n- **content:** Application No.; Status.'}]}
    assert _documented_object_source(kb,'How many Work applications in the To Do queue are there?',{})==''
    assert _documented_object_source(kb,'Show Other applications in To Do.',{})=='/other/applications'


def test_listing_date_columns_does_not_request_an_expiration_countdown():
    assert reader_answer_shape('Show the current permits, including Effective Date, Expiry Date, and Status where available.')=='list'
    assert reader_answer_shape('Show permits expiring soon, including Expiry Date.')=='due'


@pytest.mark.parametrize('phrase',['including their identifiers and statuses where those fields exist','with Status where available','and include Status only if it exists'])
def test_optional_field_list_preserves_native_status_instead_of_api_code(phrase):
    old=outcome(status='success',missing=())
    result=_native_optional_record_fields(old,'Show the first three permits, '+phrase+'.').result
    assert result.status=='success' and json.loads(result.facts[0])['Status']=='Active'
    assert 'Permit No.' in result.facts[0]
    assert any('current selected view is Permits' in fact for fact in result.facts)


@pytest.mark.parametrize('change,allowed',[('',True),('unhealthy',False),('multiple',False),('permission',False)])
def test_status_values_require_one_healthy_current_native_list(change,allowed):
    obs=native()
    if change=='unhealthy':obs['readHealth']['healthy']=False
    if change=='multiple':obs['sectionSummaries'].append(deepcopy(obs['sectionSummaries'][0]))
    old=outcome(obs,status='no_permission' if change=='permission' else 'not_confirmed')
    result=_native_status_values(old,'Which permit statuses are shown in this list?').result
    assert (result.status=='success') is allowed
    if allowed:assert result.facts[0]=='Status values in the currently observed rows: Active.' and 'not a complete' in result.facts[1]
    assert _native_status_values(old,'What do these statuses mean?')==old


@pytest.mark.parametrize('state,allowed',[('Library Analytics',True),('Unrelated Analytics',False)])
def test_bounded_native_summary_matches_selected_view_and_excludes_contacts(state,allowed):
    obs=native(state);obs['sectionSummaries'][0]['columnHeaders'].append('Email')
    obs['sectionSummaries'][0]['rowFields'][0]['Email']='private@example.test'
    result=_native_bounded_summary(outcome(obs),'Show a bounded summary of the current Library Analytics view.').result
    assert (result.status=='success') is allowed
    if allowed:assert 'private@' not in str(result.facts) and '2 observed rows' in result.facts[-1]


def test_same_identifier_search_retains_verified_identity_without_forcing_a_detail_click():
    q='Find that same application by its Application No.'
    prior={'previousIntent':{'question':'Give me one Application No.','recordIdentity':'APP-17'}}
    resolved=resolve_literal_same_record_reference(q,prior).public_json()
    assert resolved['slots']['answerShape']['value']=='list'
    obs={'filterControls':[{'label':'Search','role':'textbox','selector':'input[placeholder="Search"]','filterSurface':True,'commands':[],'selected':[]}]}
    plan=_observed_identity_search(q,{'resolvedIntent':resolved},obs,'/work')
    assert plan['portalRequest']['actions']==[{'type':'filter','selector':'input[placeholder="Search"]','value':'APP-17'}]
    assert _observed_identity_search(q,{},obs,'/work') is None


def test_post_switch_planning_failure_keeps_deep_native_rows_for_recovery():
    obs=native('Video Games')
    class FailingPlanner(Planner):
        async def plan_admin_portal_read(self,q,p,k,conversation_context=None):
            if k.get('portalObservation'):raise ValueError('invalid response')
            return portal_plan_for('/work/permits',[{'type':'switch_tab','role':'tab','name':'Video Games'}])
    g=Gateway(info={'ok':True,'result':user_info_for_paths('/work/permits')},portal_result={'ok':True,'result':{'result':'not_confirmed','observation':obs}})
    result=run_reader(g,FailingPlanner(),question='Show the first three records with Status where available.').result
    assert result.status=='success' and json.loads(result.facts[0])['Status']=='Active'


@pytest.mark.parametrize('shape', ['list', 'detail', 'overview'])
def test_structured_answers_use_llm_organization_with_grounded_fallback(shape):
    import asyncio
    from app.service import DSHService
    class OrganizingLLM:
        async def stream(self, messages):
            assert "Do not use a 'Confirmed details' heading" in messages[0]['content']
            yield 'The verified records are in the Completed view.\n\n'
            yield '- Service Name: Video Game Approval Package\n'
            yield '- Service Category: Video Games\n'
            yield '- Applications: 4; Local: 7; Import: 38'
    service = object.__new__(DSHService)
    service.settings = type('Settings', (), {
        'llm_base_url': 'https://llm.example.test',
        'llm_api_key': 'test',
        'system_prompt': '',
    })()
    service.llm = OrganizingLLM()
    answer, failed, strategy = asyncio.run(service._natural_reader_response('Show current records', {
        'result': 'success', 'answerShape': shape, 'facts': [
            'The current selected view is Completed. These records belong to that view.',
            json.dumps({'Service Name': 'Video Game Approval Package', 'Service Category': 'Video Games'}),
            json.dumps({'Applications': 4, 'Local': 7, 'Import': 38}),
        ], 'missing': []}, 'en'))
    assert not failed
    assert strategy == 'llm_organized'
    assert answer.startswith('The verified records are in the Completed view.')
    assert 'Confirmed details' not in answer


def test_cleared_search_returns_requested_rows_not_just_a_restoration_message():
    from app.portal_reader import _native_cleared_search_result
    obs = native('To Do')
    obs['sectionSummaries'][0]['rowFields'] *= 3
    result = _native_cleared_search_result(outcome(obs),
                                          'Clear that search and show up to three records again.').result
    records = [json.loads(f) for f in result.facts if f.startswith('{')]
    assert result.status == 'success' and result.answer_shape == 'list'
    assert len(records) == 3 and records[0]['Permit No.'] == 'P-1'
    assert result.selected_state == 'To Do'


def test_cleared_search_preserves_successful_projection_and_recovers_only_requested_columns():
    from app.portal_reader import _native_cleared_search_result
    obs = native('Accounts')
    table = obs['sectionSummaries'][0]
    table['columnHeaders'] = ['Account ID', 'Email', 'Full Name']
    table['rowFields'] = [{'Account ID': 'A-1', 'Email': 'private@example.test', 'Full Name': 'Private Name'}]
    question = 'Clear that search and show three Account IDs only.'
    old = outcome(obs, status='success', missing=())
    assert _native_cleared_search_result(old, question) == old
    result = _native_cleared_search_result(outcome(obs), question).result
    assert json.loads(result.facts[0]) == {'Account ID': 'A-1'}
    assert 'private@' not in str(result.facts) and 'Private Name' not in str(result.facts)


@pytest.mark.parametrize('missing', [('page_not_permitted',), ('requested_queue_view_unverified',)])
def test_cleared_search_does_not_override_permission_or_queue_failure(missing):
    from app.portal_reader import _native_cleared_search_result
    old = outcome(missing=missing)
    assert _native_cleared_search_result(old, 'Clear and show up to three records.') == old


def test_count_presentation_keeps_verified_queue_and_count_without_invented_denial():
    import asyncio
    from app.service import DSHService
    service = object.__new__(DSHService)
    answer, failed, strategy = asyncio.run(service._natural_reader_response('How many in Completed?', {
        'result': 'success', 'answerShape': 'count', 'selectedState': 'Completed',
        'facts': ['{"page.total":93}'], 'missing': []}, 'en'))
    assert not failed and strategy == 'deterministic_count' and '93' in answer and 'Current selected view: Completed.' in answer


@pytest.mark.parametrize('explicit', [False, True])
def test_repeated_module_in_bounded_list_is_not_an_unrequested_filter(explicit):
    from app.reader_intent import bind_literal_intent_quotes
    payload = {'slots': {'filter': {'source': 'current', 'value': 'Work', 'evidence': 'Work'}}}
    context = {'previousIntent': {'page': '/work/tasks', 'question': 'How many Work queued tasks?'}}
    question = 'Show only the first three Work queued tasks, including identifiers where available.'
    if explicit:
        question += ' Filter the reason.'
    fixed = bind_literal_intent_quotes(payload, question, context)
    assert fixed['slots']['filter']['source'] == ('current' if explicit else 'unspecified')


def test_successful_bound_summary_keeps_native_metrics_omitted_by_planner_and_excludes_contacts():
    from dataclasses import replace
    obs = {'readHealth': {'healthy': True}, 'sectionSummaries': [{'kind': 'table', 'nodeId': 't1',
        'selectedState': 'Top Customers by Cases', 'columnHeaders': ['Account ID', 'Email', 'Complaints', 'Refunds', 'Total'],
        'rowFields': [{'Account ID': 'A-1', 'Email': 'private@example.test', 'Complaints': '2', 'Refunds': '4', 'Total': '6'}]}]}
    old = outcome(obs, status='success', missing=())
    old = ReaderOutcome(replace(old.result, source_section='t1', selected_state='Top Customers by Cases'), old.audit_evidence)
    result = _native_bounded_summary(old, 'Show a bounded current summary of top accounts without emails.').result
    assert json.loads(result.facts[0]) == {'Account ID': 'A-1', 'Complaints': '2', 'Refunds': '4', 'Total': '6'}
    assert 'private@' not in str(result.facts)


def test_distinct_documented_permission_scopes_keep_their_source_attribution():
    import asyncio
    from app.service import DSHService
    service = object.__new__(DSHService)
    answer, failed, strategy = asyncio.run(service._natural_reader_response('Are all these tasks mine?', {
        'result': 'success', 'answerShape': 'detail', 'facts': [
            'Queue membership does not prove personal assignment.',
            'Team list scope: The Agent permission set does not grant this route.',
            'Personal list scope: The Agent layout showed both queues.',
        ], 'missing': []}, 'en'))
    assert not failed
    assert strategy == 'deterministic_permission_scope'
    assert 'Team list scope: The Agent permission set does not grant this route.' in answer
    assert 'Personal list scope: The Agent layout showed both queues.' in answer


@pytest.mark.parametrize('identity,extra', [('P-1', False), ('P-2', False), ('P-1', True)])
def test_identity_search_returns_only_unique_matching_primary_native_row(identity, extra):
    from app.portal_reader import _native_identity_search_result
    obs = native()
    if not extra:
        obs['sectionSummaries'][0]['rowFields'] = obs['sectionSummaries'][0]['rowFields'][:1]
    old = outcome(obs, status='success', missing=())
    intent = {'slots': {'recordIdentity': {'value': identity, 'source': 'previous', 'evidence': identity}}}
    result = _native_identity_search_result(old, 'Find that same record by its ID.', intent)
    if identity == 'P-1' and not extra:
        assert len(result.result.facts) == 1 and json.loads(result.result.facts[0])['Permit No.'] == 'P-1'
    else:
        assert result == old


@pytest.mark.parametrize('selected', [['NO-SUCH-123'], ['different']])
def test_empty_identity_search_requires_matching_applied_search_and_healthy_empty_list(selected):
    from app.portal_reader import _native_identity_search_result
    obs = native()
    obs['sectionSummaries'][0]['rowFields'] = []
    obs['sectionSummaries'][0]['emptyState'] = 'No Data'
    obs['filterControls'] = [{'label': 'Search', 'selected': selected}]
    old = outcome(obs, status='success', missing=())
    result = _native_identity_search_result(old, 'Find record NO-SUCH-123.', {}).result
    assert (result.status == 'no_data') == (selected == ['NO-SUCH-123'])
