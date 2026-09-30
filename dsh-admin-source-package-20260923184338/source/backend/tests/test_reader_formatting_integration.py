import json

import pytest

from app.portal_reader import (
    _api_project_fact, _current_list_count_candidates, _serialize_api_mapping,
    _knowledge_route_recovery_request, knowledge_search_query,
    UserPermissionContext, ReadOnlyPortalPolicy,
)
from app.reader_intent import SLOT_NAMES, bind_literal_intent_quotes, parse_intent_resolution


def intent(value, evidence, source='previous', name='businessObject'):
    return {'relation':'continue', 'clarificationOptions':[], 'slots':{
        key: {'source':source,'value':value,'evidence':evidence} if key==name else
             {'source':'unspecified','value':'','evidence':''} for key in SLOT_NAMES}}


def test_literal_quote_binding_preserves_intervening_words_and_semantics():
    context={'previousIntent':{'question':"Show the inspection team's To Do tasks."}}
    candidate=intent('inspection tasks', 'inspection tasks')
    bound=bind_literal_intent_quotes(candidate, 'Now show the completed tasks.', context)
    result=parse_intent_resolution(bound, 'Now show the completed tasks.', context).public_json()
    slot=result['slots']['businessObject']
    assert slot['value']=='inspection tasks'
    assert slot['evidence']=="show the inspection team's to do tasks."
    assert slot['source']=='previous'
    assert candidate['slots']['businessObject']['evidence']=='inspection tasks'


@pytest.mark.parametrize('name,value',[
    ('businessObject','customer tickets'), ('recordIdentity','REF-555'), ('requestedScope','global'),
    ('businessObject','inspection /private'), ('businessFocus','all tasks 555'),
])
def test_quote_binding_does_not_invent_values_identities_or_permission_scope(name,value):
    candidate=intent(value,'fabricated quote',name=name)
    context={'previousIntent':{'question':'Show inspection tasks.'}}
    bound=bind_literal_intent_quotes(candidate,'Continue.',context)
    assert bound==candidate
    with pytest.raises(ValueError):
        parse_intent_resolution(bound,'Continue.',context)


def count_observation():
    rows={'operationKey':'GET /api/records', 'responseEvidence':{'data':{
        'items':[{'recordNo':'REF-1','statusName':'Waiting'}], 'totalCount':1}}}
    stats={'operationKey':'GET /api/records/stats', 'responseEvidence':{
        'data':{'totalCount':2,'statuses':[{'statusName':'Waiting','count':1},{'statusName':'Done','count':1}]}}}
    observation={'readHealth':{'healthy':True}, 'sectionSummaries':[{
        'nodeId':'table-1','kind':'table','heading':'Records','selectedState':'To Do',
        'rowFields':[{'Reference':'REF-1','Status':'Waiting'}]}],
        'apiDiscovery':{'candidates':[rows,stats]}}
    return observation,(rows,stats)


def test_current_view_count_binds_to_native_collection_not_global_statistics():
    observation,candidates=count_observation()
    selected=_current_list_count_candidates(observation,candidates,'How many records are in the current authorized view?',{})
    assert [c['operationKey'] for c in selected]==['GET /api/records']


@pytest.mark.parametrize('change',['unhealthy','wrong_rows','ambiguous_tables','ambiguous_responses'])
def test_current_count_narrowing_requires_unambiguous_matching_current_rows(change):
    observation,candidates=count_observation()
    if change=='unhealthy':observation['readHealth']['healthy']=False
    elif change=='wrong_rows':observation['sectionSummaries'][0]['rowFields']=[{'Reference':'REF-9'}]
    elif change=='ambiguous_tables':observation['sectionSummaries'].append({**observation['sectionSummaries'][0],'nodeId':'table-2'})
    else:
        copy={**candidates[0],'operationKey':'GET /api/other-records'}
        observation['apiDiscovery']['candidates'].append(copy)
        candidates=(*candidates,copy)
    assert not _current_list_count_candidates(observation,candidates,'How many records are in the current view?',{})


def test_overall_statistics_request_is_not_forced_to_current_list():
    observation,candidates=count_observation()
    assert not _current_list_count_candidates(observation,candidates,'Show overall status statistics.',{})


def test_requested_readable_status_survives_bounded_record_projection():
    record={**{f'recordRelatedId{i}':i for i in range(25)},
            'recordNo':'REF-1','statusId':5,'statusName':'Pending Committee Decision'}
    fact=json.loads(_serialize_api_mapping(record,semantic_query='Show records and their statuses.',answer_shape='list'))
    assert fact['statusName']=='Pending Committee Decision'
    assert len(json.dumps(fact,separators=(',',':')))<=300


@pytest.mark.parametrize('answer_shape', ['overview', 'count', 'list', 'attention', 'due', 'detail'])
def test_api_projection_exposes_business_values_not_transport_enums(answer_shape):
    record = {
        'pageItems.taskNo': 'ML-5-7-6245691',
        'pageItems.status': 'Initial Approval',
        'pageItems.statusId': 2,
        'pageItems.statusDisplay': 'Initial Approval',
        'pageItems.statusDisplayOnly': 'Initial Approval',
        'pageItems.taskCategory': 'Applications',
        'pageItems.taskCategoryCode': 'applications',
        'pageItems.sourceId': '6703a757-7d0f-11f1-825e-86a333376d33',
        'pageItems.canReassign': True,
    }
    fact = json.loads(_serialize_api_mapping(
        record,
        semantic_query='Please provide all task details and status.',
        answer_shape=answer_shape,
    ))
    assert fact == {
        'taskNo': 'ML-5-7-6245691',
        'status': 'Initial Approval',
        'taskCategory': 'Applications',
    }


def test_api_projection_cleans_model_fact_before_final_delivery():
    projected = json.loads(_api_project_fact(json.dumps({
        'Page Items Task No': 'ML-5-7-6245691',
        'Page Items Status': 'Initial Approval',
        'Page Items Status Id': 2,
        'Page Items Source Id': '6703a757-7d0f-11f1-825e-86a333376d33',
        'Page Items Task Category Code': 'applications',
    })))
    assert projected == {
        'Task No': 'ML-5-7-6245691',
        'Status': 'Initial Approval',
    }


def test_retrieval_does_not_replace_requested_topic_with_permission_routes():
    permissions = UserPermissionContext(roles=('Reader',), pages=('/overview', '/finance/records'), departments=('99',))
    query = knowledge_search_query('Show queued work items.', permissions)
    assert 'Show queued work items.' in query
    assert 'Reader' in query
    assert '/overview' not in query and '/finance/records' not in query and '99' not in query


def test_route_recovery_preserves_denied_best_target_for_policy_validation():
    permissions = UserPermissionContext(roles=('Reader',), pages=('/overview',))
    knowledge = {'chunks': [
        {'content': '## Work - **page:** `/work/items` - **section:** Queued work items - **type:** list - **meaning:** Queued work items - **use_when:** Show queued work items'},
        {'content': '## Overview - **page:** `/overview` - **section:** Summary - **type:** summary - **content:** work'},
    ]}
    request = _knowledge_route_recovery_request('Show queued work items.', knowledge, permissions)
    assert request is not None and request.start_path == '/work/items'
    assert request.actions == ({'type': 'observe'},)
    assert ReadOnlyPortalPolicy('https://portal.example.test').validate(request, permissions) == 'page_not_permitted'


@pytest.mark.parametrize('path', ['https://other.example/work/items', '//other.example/work/items', 'work/items'])
def test_route_recovery_does_not_convert_external_or_relative_references_to_local(path):
    knowledge = {'chunks': [{'content': f'## Work - **page:** `{path}` - **section:** Queued work items - **type:** list'}]}
    assert _knowledge_route_recovery_request('Show queued work items.', knowledge, UserPermissionContext()) is None
