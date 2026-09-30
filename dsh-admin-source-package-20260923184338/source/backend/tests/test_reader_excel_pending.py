import json
import pytest
from app.portal_reader import (_documented_object_source, _native_optional_record_fields,
    reader_answer_shape, question_requires_live_portal)
from app.service import _reader_presentation_metadata
from test_reader_historical_retest import native, outcome
from test_admin_portal_reader import Gateway, Planner, run_reader, user_info_for_paths


@pytest.mark.parametrize('q', [
    'Show the books and their statuses, including the information that identifies each one',
    'How about movies? Show them with their statuses and identifying information.',
    'How about Newspapers / Magazines? Show them with their statuses and identifying information.',
    'How about Video Games? Show them with their statuses and identifying information.',
])
def test_display_fields_recover_native_rows(q):
    result = _native_optional_record_fields(outcome(), q).result
    assert result.status == 'success'
    assert json.loads(result.facts[0])['Permit No.'] == 'P-1'


def test_prior_module_applies_to_documented_tab_destinations():
    kb = {'chunks':[{'content':'### Control: application tabs\n- **type:** tab\n- **name:** Completed applications\n- **destination:** `/licensing/applications`'}]}
    assert _documented_object_source(kb, 'How about the completed applications',
        {'sourceHint':{'page':'/content/ContentApplications'}}) == ''


def test_count_context_contains_labels_but_no_stale_numbers():
    metadata = _reader_presentation_metadata({'result':'success','answerShape':'count','completeness':'bounded',
        'page':'/licensing/applications','selectedState':'To Do','facts':['Pending Review: 53']})
    assert metadata['countSource']['labels'] == ['Pending Review']
    assert '53' not in json.dumps(metadata)


def test_json_count_keeps_source_for_navigation_without_carrying_values():
    metadata = _reader_presentation_metadata({'result': 'success', 'answerShape': 'count',
        'completeness': 'bounded', 'page': '/content/ContentLibrary', 'selectedState': 'Books',
        'facts': ['{"total":123}']})
    assert metadata['countSource'] == {'page': '/content/ContentLibrary', 'view': 'Books', 'labels': ['total']}
    assert '123' not in json.dumps(metadata)


@pytest.mark.parametrize('status', ['success', 'not_confirmed', 'no_data'])
@pytest.mark.parametrize('question', ['How many licenses did I complete last week?', 'What about last week?'])
def test_period_count_does_not_relabel_an_unfiltered_total(status, question):
    from app.portal_reader import ReaderOutcome, ReaderResult, _guard_completion_period_count
    old = ReaderOutcome(ReaderResult(status=status, summary='', page='/licensing/licenses',
        answer_shape='count', facts=('{"total":85}',)), {'observation': {'readHealth': {'healthy': True},
        'metrics': [{'label': 'Total', 'value': 85}], 'filterControls': [{'label': 'Effective Start Date'}]}})
    result = _guard_completion_period_count(old, question, {'previousIntent': {
        'question': 'How many licenses did I complete this week?', 'answerShape': 'count'}}).result
    assert result.status == 'not_confirmed'
    assert not result.facts
    assert result.missing == ('completion_period_not_verified',)


def test_period_count_accepts_only_matching_personal_completion_metric():
    from app.portal_reader import ReaderOutcome, ReaderResult, _guard_completion_period_count
    old = ReaderOutcome(ReaderResult(status='success', summary='', answer_shape='count', facts=('Total: 85',)),
        {'observation': {'readHealth': {'healthy': True}, 'metrics': [
            {'label': 'My completed last week', 'value': 0}]}})
    result = _guard_completion_period_count(old, 'How many licenses did I complete last week?', {}).result
    assert result.status == 'success'
    assert result.facts == ('My completed last week: 0',)
    assert _guard_completion_period_count(old, 'How many licenses did I complete this week?', {}).result.status == 'not_confirmed'


def test_period_limitation_and_partial_lists_have_explicit_user_facing_copy():
    from app.service import reader_evidence_only_response, reader_natural_answer_is_grounded
    answer = reader_evidence_only_response({'result':'not_confirmed','answerShape':'count',
        'facts':[], 'missing':['completion_period_not_verified']}, 'en')
    assert 'completion dates' in answer
    assert '85' not in answer
    partial = reader_evidence_only_response({'result':'success','answerShape':'list',
        'completeness':'bounded','facts':['{"Application No.":"MC-2-1-123"}']}, 'en')
    assert 'not the full list' in partial
    assert not reader_natural_answer_is_grounded('There are four applications in your queue.', partial, '', completeness='bounded')
    assert reader_natural_answer_is_grounded('Here are some matching applications.', partial, '', completeness='bounded')


@pytest.mark.parametrize('q', ['Is that the total number?', 'Is the number of pending reviews you listed the total?',
                              'Where can I find the confirmed count results?'])
def test_count_coverage_and_location_do_not_invent_live_data(q):
    g = Gateway(info={'ok':True,'result':user_info_for_paths('/licensing/applications')})
    result = run_reader(g, Planner(), question=q, conversation_context={'previousIntent':{
        'countSource':{'page':'/licensing/applications','view':'To Do','labels':['Pending Review']}}}).result
    assert result.status == 'success'
    assert result.count_source['labels'] == ['Pending Review']
    assert 'Pending Review' in ' '.join(result.facts)


def test_explicit_data_request_does_not_inherit_count_shape():
    assert reader_answer_shape('I now want to view the data in Final Approval.',
        {'resolvedIntent':{'slots':{'answerShape':{'source':'previous','value':'count'}}}}) == 'list'
    assert question_requires_live_portal('Inquire about MC-2-2202-8614403')


def test_pending_review_definition_is_queue_specific():
    g = Gateway(info={'ok':True,'result':user_info_for_paths('/licensing/applications')})
    result = run_reader(g, Planner(), question='Does Pending Review mean the Service Application has been approved?').result
    assert result.status == 'success'
    assert 'does not mean' in ' '.join(result.facts)
    assert 'External Approval' in ' '.join(result.facts)


@pytest.mark.parametrize('value,selected,expected', [(53,'To Do','success'), (0,'To Do','success'),
                                                   (53,'Completed','not_confirmed'), (None,'To Do','not_confirmed')])
def test_pending_review_counter_uses_its_own_api_field(value,selected,expected):
    from app.portal_reader import ReaderOutcome, ReaderResult, _application_pending_count
    obs = {'tabControls':[{'name':selected,'selected':True}], 'apiDiscovery':{'candidates':[{
        'operationKey':'POST /api/Application/MyTodoPage','status':200,
        'responseEvidence':{'isSuccess':True,'data':{'page':{'total':70}, 'statusCount':{'pendingReviewCount':value}}}}]}}
    old = ReaderOutcome(ReaderResult(status='success',summary='',page='/licensing/applications',
                        answer_shape='count',facts=('{"page.total":70}',)), {'observation':obs})
    result = _application_pending_count(old,'How many applications are waiting for me to review?').result
    assert result.status == expected
    assert '70' not in ' '.join(result.facts)
    if expected == 'success':
        assert result.facts == (f'Pending Review: {value}',)


@pytest.mark.parametrize('word', ['status','statuses'])
def test_singular_and_plural_status_field_lists_keep_the_same_bounds(word):
    from app.portal_reader import observation_fallback_result
    result = observation_fallback_result('Provide a comprehensive list of records including '+word+'.',
        native(), page='/work/permits',answer_shape='list')
    assert result.status == 'not_confirmed'
    assert result.completeness == 'bounded'
    assert result.missing == ('complete_collection_not_verified',)


@pytest.mark.parametrize('selected,status,healthy,accepted', [('Final Approval','Final Approval',True,True),
    ('','Final Approval',True,False),('Final Approval','External Approval',True,False),('Final Approval','Final Approval',False,False)])
def test_filtered_rows_require_verified_selection_and_matching_status(selected,status,healthy,accepted):
    from app.portal_reader import _native_status_filter_rows
    obs = native('To Do')
    obs['readHealth']['healthy'] = healthy
    obs['filterControls'] = [{'label':'All Statuses','role':'combobox','options':['Final Approval'],
                             'selected':[selected] if selected else []}]
    for row in obs['sectionSummaries'][0]['rowFields']:
        row['Status'] = status
    result = _native_status_filter_rows(outcome(obs),'I now want to view the data in Final Approval.').result
    assert (result.status == 'success') == accepted


def test_selected_status_replaces_placeholder_label_in_actual_portal():
    from app.portal_reader import _native_status_filter_rows
    obs = native('To Do')
    obs['filterControls'] = [{'label': 'Final Approval', 'role': 'combobox',
                             'options': [], 'selected': ['Final Approval']}]
    for row in obs['sectionSummaries'][0]['rowFields']:
        row['Status'] = 'Final Approval'
    result = _native_status_filter_rows(outcome(obs), 'I now want to view the data in Final Approval.').result
    assert result.status == 'success'
    assert result.answer_shape == 'list'
    assert json.loads(result.facts[0])['Status'] == 'Final Approval'


def test_matching_filter_label_alone_does_not_establish_selection():
    from app.portal_reader import _native_status_filter_rows
    obs = native('To Do')
    obs['filterControls'] = [{'label': 'Final Approval', 'role': 'combobox',
                             'options': ['Final Approval'], 'selected': []}]
    for row in obs['sectionSummaries'][0]['rowFields']:
        row['Status'] = 'Final Approval'
    assert _native_status_filter_rows(outcome(obs), 'Show data in Final Approval.').result.status != 'success'


@pytest.mark.parametrize('view,accepted',[('Completed',True),('To Do',False)])
def test_completed_followup_keeps_native_decision_column(view,accepted):
    from app.portal_reader import _native_queue_followup, ReaderOutcome, ReaderResult
    obs = native(view)
    obs['sectionSummaries'][0]['columnHeaders'].append('My Decision')
    obs['sectionSummaries'][0]['rowFields'][0]['My Decision'] = 'Send Back'
    prior = {'previousIntent':{'question':'Show my application tasks', 'page':'/work/permits',
                              'answerShape':'list','view':'To Do'}}
    old = ReaderOutcome(ReaderResult(status='not_confirmed',summary='',page='/work/permits'),{'observation':obs})
    result = _native_queue_followup(old,'How about the completed applications',prior).result
    assert (result.status == 'success') == accepted
    if accepted:
        assert 'My Decision' in result.facts[0]
        assert result.selected_state == 'Completed'


@pytest.mark.parametrize('question,view,accepted',[
    ('Query My Application Tasks - To-Do - MC-2-2202-8614403 data','To Do',True),
    ('Inquire about MC-2-2202-8614403','To Do',True),
    ('Query full details of MC-2-2202-8614403','To Do',False),
    ('Query Completed application MC-2-2202-8614403','To Do',False),
    ('Query MC-2-2202-9999999','To Do',False)])
def test_application_lookup_matches_exact_record_and_requested_queue(question,view,accepted):
    from app.portal_reader import _observed_application_lookup
    obs = native(view)
    obs['sectionSummaries'][0].update(columnHeaders=['Application No.','Status'],
        rowFields=[{'Application No.':'MC-2-2202-8614403','Status':'Final Approval'}])
    result = _observed_application_lookup(question,obs,'/content/ContentApplications')
    assert bool(result) == accepted
    if accepted:
        assert json.loads(result.facts[0])['Application No.'] == 'MC-2-2202-8614403'


@pytest.mark.parametrize('question,missing',[
    ('Show me the full profile of Customer Individual Overview-Basic Information','applicant_profile_not_verified'),
    ('I need all available details so I can review it.','full_application_detail_not_verified')])
def test_application_header_cannot_claim_complete_profile_or_form(question,missing):
    from app.portal_reader import _native_detail_observation_result
    obs = {'apiDiscovery':{'candidates':[{'operationKey':'GET /api/Application/MyReviewDetail/{taskId}',
        'status':200,'responseEvidence':{'data':{'detail':{'applicationNumber':'ML-1-7-6577159','status':'Final Approval'}}}}]}}
    result = _native_detail_observation_result(obs,page='/licensing/applications',record_identity='ML-1-7-6577159',
                                              scope='unknown',question=question)
    assert result.status == 'not_confirmed'
    assert missing in result.missing


@pytest.mark.parametrize('target,question',[
    ('Applicant Overview','Show me the full profile of Customer Individual Overview'),
    ('Application Overview','I need all available details so I can review it.')])
@pytest.mark.parametrize('change,accepted',[('',True),('missing_control',False),('wrong_id',False),('failed_api',False)])
def test_self_service_guidance_requires_exact_application_and_observed_entry(target,question,change,accepted):
    from app.portal_reader import _native_detail_observation_result
    obs = {'controls':[] if change=='missing_control' else [target,'Profile Overview'],
        'readHealth':{'healthy':False,'blocked':['/unavailable-profile']},
        'apiDiscovery':{'candidates':[{'operationKey':'GET /api/Application/MyReviewDetail/{taskId}',
        'status':403 if change=='failed_api' else 200,
        'responseEvidence':{'data':{'detail':{'applicationNumber':'ML-1-7-9999999' if change=='wrong_id' else 'ML-1-7-6577159'}}}}]}}
    result = _native_detail_observation_result(obs,page='/licensing/applications',record_identity='ML-1-7-6577159',
        scope='personal',question=question)
    assert bool(result and result.status=='success') == accepted
    if accepted:
        assert result.completeness=='bounded'
        assert target in ' '.join(result.facts)
        assert 'navigation guidance only' in ' '.join(result.facts)
        assert 'were not verified' in ' '.join(result.facts)
