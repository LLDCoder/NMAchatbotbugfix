import json
import pytest
from app.portal_reader import (
    _api_native_source, observation_result_from_plan, _guard_requested_team_scope,
    ReaderOutcome, knowledge_search_query, UserPermissionContext, _bind_observed_actions,
    PortalReadRequest, _api_evidence_fallback_plan,
)
from app.reader_limits import requested_record_limit
from app.service import _reader_select_requested_records, reader_natural_answer_is_grounded
from app.portal_reader import _qualify_knowledge_facts, ReaderResult
from app.reader_intent import SLOT_NAMES, parse_intent_resolution


def test_tab_words_separated_by_module_name_do_not_select_sibling():
    from app.portal_reader import _category_control_requiring_children
    obs={'readHealth':{'healthy':True}, 'tabControls':[
        {'name':'Partner Insights','selected':False}, {'name':'Operational Insights','selected':True},
        {'name':'Service-level Satisfaction','selected':True}],
        'sectionSummaries':[{'nodeId':'t1','kind':'table','selectedState':'Service-level Satisfaction','rowSummaries':[], 'emptyState':'No Data'}]}
    assert _category_control_requiring_children('Show Partner Portal Operational Insights service satisfaction.',obs,None,'overview') is None
    # An explicit sibling request must still require a transition.
    requirement=_category_control_requiring_children('Show Partner Insights.',obs,None,'overview')
    assert requirement and requirement.control_label=='Partner Insights'


@pytest.mark.parametrize('question,expected',[
    ('Open the ticket filter and inspect its fields without applying.',True),
    ('Cancel the filter and return to the list.',True),
    ('Do these items have an Agent field for my current role?',True),
    ('Which member and date criteria are present?',True),
    ('Show three tickets with source and priority.',False),
    ('How many tickets are in To Do?',False),
])
def test_control_and_schema_requests_require_native_evidence(question,expected):
    from app.portal_reader import _question_needs_native_surface
    assert _question_needs_native_surface(question) is expected


def test_explicit_filter_transition_requires_unique_observed_ui():
    from app.portal_reader import _observed_filter_transition
    obs={'controls':['Filter'],'dialogs':[]}
    assert _observed_filter_transition('Open the filter.',obs,'/work')['portalRequest']['actions'][0]['type']=='show_filter'
    assert _observed_filter_transition('Apply the filter.',obs,'/work') is None
    assert _observed_filter_transition('Open the filter.',{'controls':['Filter','Filter']},'/work') is None
    replay = _observed_filter_transition('Cancel the filter.',obs,'/work')['portalRequest']['actions']
    assert [action['type'] for action in replay] == ['show_filter', 'dismiss_overlay']
    obs={'controls':['Cancel'],'dialogs':['Filter Search Cancel Apply']}
    assert _observed_filter_transition('Cancel the filter.',obs,'/work')['portalRequest']['actions'][0]['type']=='dismiss_overlay'
    assert _observed_filter_transition('Cancel the filter.',{'controls':['Cancel'],'dialogs':['Approve record Cancel']},'/work') is None


@pytest.mark.parametrize('followup',[False,True])
def test_model_payment_failure_is_not_bad_intent_or_empty_data(followup):
    import httpx
    from test_admin_portal_reader import Gateway, Planner, run_reader
    from app.service import reader_evidence_only_response
    class Unavailable(Planner):
        async def resolve_admin_portal_intent(self,*args,**kwargs):
            raise httpx.HTTPStatusError('sensitive provider text',request=httpx.Request('POST','https://model.test'),response=httpx.Response(402))
        async def plan_admin_portal_read(self,*args,**kwargs):
            return await self.resolve_admin_portal_intent()
    outcome=run_reader(Gateway(),Unavailable(),question='Show current records.',
        conversation_context={'previousIntent':{'question':'Show records','page':'/licensing'}} if followup else None)
    assert outcome.result.status=='load_failed'
    assert outcome.result.missing==('model_payment_required',)
    assert 'sensitive' not in json.dumps(outcome.audit_evidence)
    assert '余额' in reader_evidence_only_response(outcome.result.public_json(),'zh')


def test_explicit_filter_open_precedes_default_list_api_selection():
    from copy import deepcopy
    from test_admin_portal_reader import Gateway, Planner, run_reader, portal_plan_for, user_info_for_paths
    obs={'readHealth':{'healthy':True},'controls':['Filter'],'dialogs':[],
         'sectionSummaries':[], 'apiDiscovery':{'candidates':[{
          'operationKey':'GET /api/work','path':'/api/work','method':'GET','policyState':'allowed',
          'candidateKind':'business','responseEvidence':{'items':[],'total':0}}],'truncated':False}}
    class FilterGateway(Gateway):
        async def invoke(self,principal,tool_name,arguments,**kwargs):
            if tool_name=='knowledge.search':return await super().invoke(principal,tool_name,arguments,**kwargs)
            self.calls.append((tool_name,arguments,kwargs))
            current=deepcopy(obs)
            if arguments['actions'][0]['type']=='show_filter':
                current.update(dialogs=['Filter Search Cancel Apply'],controls=['Cancel','Apply'])
            return {'ok':True,'result':{'result':'success','page':'/work','observation':current}}
    class NativePlanner(Planner):
        async def plan_admin_portal_read(self,question,permission_context,knowledge_context,conversation_context=None):
            if knowledge_context.get('portalObservation'):
                assert knowledge_context['planningDirective'].get('apiCandidateDecision')!='select'
                assert knowledge_context['planningDirective']['nativeSurfaceRequired'] is True
                return {'mode':'observation_result','result':'not_confirmed','facts':[], 'missing':['schema_not_confirmed']}
            return portal_plan_for('/work',[{'type':'observe'}])
    gateway=FilterGateway(info={'ok':True,'result':user_info_for_paths('/work')})
    outcome=run_reader(gateway,NativePlanner(),question='Open the filter and inspect its fields.')
    assert any(call[1]['actions'][0]['type']=='show_filter' for call in gateway.calls if call[0]=='admin.portal.read')
    assert outcome.result.status!='success'  # a list total must not claim the UI is open


def native():
    return {'readHealth': {'healthy': True}, 'apiEvidence': {'operationKey': 'POST /api/work/query',
        'data': {'items': [{'ref': 'REF-100', 'status': 'Waiting'}, {'ref': 'REF-101', 'status': 'Waiting'}], 'totalCount': 9}},
        'sectionSummaries': [{'kind': 'table', 'nodeId': 'table-1', 'heading': '',
          'columnHeaders': ['Reference', 'Status'], 'selectedState': 'To Do',
          'selectedTabPath': ['Team Work', 'To Do'],
          'rowFields': [{'Reference': 'REF-100', 'Status': 'Waiting'}, {'Reference': 'REF-101', 'Status': 'Waiting'}]}]}


def test_api_projection_keeps_matching_native_view_without_inventing_permission():
    obs = native()
    plan, _ = _api_evidence_fallback_plan(obs['apiEvidence'], answer_shape='list')
    result = observation_result_from_plan(plan, obs, observed_page='/work', verified_scope='unknown')
    assert result.source_section == 'table-1' and result.selected_state == 'To Do'
    assert result.scope == 'unknown'  # view association is not permission expansion
    assert _guard_requested_team_scope(ReaderOutcome(result, {'observation': obs}), {}, 'Show team work').result.status == 'success'


@pytest.mark.parametrize('change', ['wrong_rows', 'ambiguous', 'unhealthy', 'numeric', 'empty'])
def test_api_source_binding_rejects_unsupported_or_ambiguous_identity(change):
    obs = native()
    if change == 'wrong_rows': obs['sectionSummaries'][0]['rowFields'][0]['Reference'] = 'REF-999'
    if change == 'ambiguous': obs['sectionSummaries'].append({**obs['sectionSummaries'][0], 'nodeId': 'table-2'})
    if change == 'unhealthy': obs['readHealth']['healthy'] = False
    if change == 'numeric': obs['sectionSummaries'][0]['rowFields'] = [{'Reference': '1000'}]
    if change == 'empty': obs['sectionSummaries'][0]['rowFields'] = []
    assert _api_native_source(obs) is None


@pytest.mark.parametrize('question,n', [
    ('Show only the first three records.',3), ('Clear that search and show three queued records again.',3),
    ('Show up to five tasks.',5), ('List 2 accounts.',2), ('Show 7 days of records.',None),
    ('How many records? There were three yesterday.',None), ('Show records with 3 warnings.',None),
])
def test_requested_cardinality_is_not_a_filter_or_time_value(question,n):
    assert requested_record_limit(question) == n


def test_record_limit_keeps_separately_verified_total():
    obs=native()
    obs['apiEvidence']['data']['items']=[{'recordNo':f'REF-{i}', 'statusName':'Waiting'} for i in range(100,108)]
    plan,_=_api_evidence_fallback_plan(obs['apiEvidence'],answer_shape='list',semantic_query='Show three records.')
    rows=[json.loads(f) for f in plan['facts']]
    assert len(rows)==4 and sum('recordNo' in r for r in rows)==3
    result={**plan,'facts':[json.dumps({'Reference':f'REF-{i}'}) for i in range(100,107)]+[json.dumps({'totalCount':9})]}
    selected=_reader_select_requested_records(result,'Show three records.')
    assert len(selected['facts'])==4 and json.loads(selected['facts'][-1])['totalCount']==9


def test_conceptual_followup_keeps_page_in_query_but_switch_drops_it():
    context={'resolvedIntent':{'relation':'continue','slots':{}},'sourceHint':{'page':'/work/items'}}
    assert '/work/items' in knowledge_search_query('Why does one list show Assigned Time and the other Last Update?', UserPermissionContext(), context)
    context['resolvedIntent']['relation']='switch'
    assert '/work/items' not in knowledge_search_query('Explain another module.', UserPermissionContext(), context)


def test_child_tab_can_follow_bound_parent_but_not_an_unobserved_first_action():
    obs={'controls':['Team Work'],'sectionSummaries':[]}
    actions=({'type':'switch_tab','role':'tab','name':'Team Work'}, {'type':'switch_tab','role':'tab','name':'Completed','section':'invented'})
    bound,error=_bind_observed_actions(PortalReadRequest('/work',actions),obs,record_identity='')
    assert not error and bound.actions[-1] == {'type':'switch_tab','role':'tab','name':'Completed'}
    assert _bind_observed_actions(PortalReadRequest('/work',(actions[-1],)),obs,record_identity='')[1]


def test_blank_owner_does_not_support_negative_assignment_claim():
    verified='Reference: REF-100; Inspector: ; Status: Queued'
    assert not reader_natural_answer_is_grounded('These are not assigned to you.',verified,'Are these assigned to me?')
    assert reader_natural_answer_is_grounded('The assignment to you is not confirmed.',verified,'Are these assigned to me?')


@pytest.mark.parametrize('value',['this account','current user','that record','these items'])
def test_context_reference_cannot_become_literal_record_search(value):
    slots={key:{'value':'','source':'unspecified','evidence':''} for key in SLOT_NAMES}
    slots['recordIdentity']={'value':value,'source':'current','evidence':value}
    with pytest.raises(ValueError,match='concrete record identifier'):
        parse_intent_resolution({'relation':'switch','slots':slots,'clarificationOptions':[]}, f'Show records for {value}.', {})


def test_exact_knowledge_field_preserves_its_subject_without_guessing_shared_subjects():
    before='Assigned Time is specific to this list and is not Creation Time.'
    after='Last Update is specific to this list and is not Assigned Time.'
    knowledge={'ok':True,'chunks':[{'content':f'## Semantic node: Pending work\n- **section:** To Do\n- **field_distinctions:** {before}'},
                         {'content':f'## Semantic node: Finished work\n- **section:** Completed\n- **field_distinctions:** {after}'}]}
    result=ReaderResult(status='success',summary='',facts=(before,after))
    labeled=_qualify_knowledge_facts(result,knowledge)
    assert labeled.facts==(f'Pending work: {before}',f'Finished work: {after}')
    knowledge['chunks'].append({'content':f'## Semantic node: Other work\n- **field_distinctions:** {before}'})
    assert _qualify_knowledge_facts(result,knowledge).facts[0]==before


def test_followup_switches_requested_view_before_selecting_default_view_api():
    from copy import deepcopy
    from test_admin_portal_reader import Gateway, portal_plan_for, run_reader, user_info_for_paths
    from test_reader_intent_flow import IntentPlanner, resolution, slot
    obs=native();obs.pop('apiEvidence')
    obs['sectionSummaries'][0]['selectedTabPath']=['To Do']
    obs['tabControls']=[{'name':'To Do','selected':True},{'name':'Completed','selected':False}]
    obs['controls']=['To Do','Completed']
    obs['apiDiscovery']={'candidates':[{'operationKey':'GET /api/work','path':'/api/work','method':'GET','policyState':'allowed','candidateKind':'business','responseEvidence':{'items':[{'ref':'REF-100'}]}}], 'truncated':False}
    class ViewGateway(Gateway):
        async def invoke(self,principal,tool_name,arguments,**kwargs):
            if tool_name=='knowledge.search':return await super().invoke(principal,tool_name,arguments,**kwargs)
            self.calls.append((tool_name,arguments,kwargs))
            current=deepcopy(obs)
            if arguments['actions'][0]['type']=='switch_tab':
                assert arguments['actions'][0]['name']=='Completed'
                current.pop('apiDiscovery')
                current['sectionSummaries'][0].update(selectedState='Completed',selectedTabPath=['Completed'],
                    rowFields=[{'Reference':'REF-200','Status':'Completed'}],rowSummaries=['REF-200 Completed'])
                current['tabControls']=[{'name':'Completed','selected':True}]
            return {'ok':True,'result':{'result':'success','page':'/work','observation':current}}
    planner=IntentPlanner(resolution('refine',view=slot('Completed'),answerShape=slot('list','tasks')),
        portal_plan_for('/work',[{'type':'observe'}]),
        {'mode':'observation_result','result':'success','sourceSection':'table-1','answerShape':'list',
         'facts':[json.dumps({'Reference':'REF-200','Status':'Completed'})],'missing':[]})
    gateway=ViewGateway(info={'ok':True,'result':user_info_for_paths('/work')})
    result=run_reader(gateway,planner,question='How about Completed tasks?',
        conversation_context={'previousIntent':{'question':'Show tasks in To Do','page':'/work','answerShape':'list'}})
    assert result.result.status=='success' and result.result.selected_state=='Completed', json.dumps({
        'result':result.result.public_json(),'stage':result.audit_evidence.get('stage'),
        'reads':[c[1] for c in gateway.calls if c[0]=='admin.portal.read']})
    assert any(call[1]['actions'][0]['type']=='switch_tab' for call in gateway.calls if call[0]=='admin.portal.read')
