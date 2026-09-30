import json
from copy import deepcopy
import pytest
from app.portal_reader import (ReaderResult, ReaderOutcome, _native_catalogue_outcome,
    _qualify_knowledge_facts, _observed_switch_tab_action, _observation_has_category_children,
    reader_answer_shape, _documented_object_source)
from test_admin_portal_reader import Gateway, Planner, run_reader, portal_plan_for, user_info_for_paths


def catalogue():
    return {'readHealth':{'healthy':True},'tabControls':[{'name':'Reports','selected':True}],
            'headings':['Alpha Applications','Beta Permits','Unrelated heading']}


@pytest.mark.parametrize('change,expected',[('',True),('unhealthy',False),('uncertain_options',True),('pending',False),('wrong_tab',False),('wrong_page',False),('no_headings',False)])
def test_catalogue_requires_current_selected_page_and_observed_names(change,expected):
    obs=catalogue()
    if change=='unhealthy':obs['readHealth']['healthy']=False
    if change=='uncertain_options':obs['readHealth']={'healthy':False,'uncertain':['/options']}
    if change=='pending':obs['readHealth']={'healthy':False,'uncertain':['/options'],'pending':['/records']}
    if change=='wrong_tab':obs['tabControls'][0]['selected']=False
    if change=='no_headings':obs['headings']=[]
    kb={'ok':True,'chunks':[{'content':'## Semantic node: Report families\n- **page:** `/work/reports`\n- **section:** Reports\n- **type:** report catalogue\n- **content:** Alpha Applications; Beta Permits; Missing Family.'}]}
    outcome=ReaderOutcome(ReaderResult(status='not_confirmed',summary='',page='/wrong' if change=='wrong_page' else '/work/reports'),{'knowledge':kb,'observation':obs})
    result=_native_catalogue_outcome(outcome,'Show a bounded current Reports summary.').result
    assert (result.status=='success') is expected
    if expected:
        assert 'Alpha Applications; Beta Permits' in result.facts[0]
        assert 'Missing Family' not in str(result.facts) and 'Unrelated heading' not in str(result.facts)
        assert 'No report was generated' in result.facts[1]
        if change=='uncertain_options':assert 'not report data or filter options' in result.facts[2]


def test_exact_manual_filter_excerpt_keeps_its_applicability_even_if_model_omits_it():
    kb={'ok':True,'chunks':[{'content':'## Semantic node: Queue filter\n- **page:** `/work/tasks`\n- **section:** Filter\n- **content:** Region; Priority.\n- **scope:** Available only in the Operations Manager layout.\n- **verification_limits:** Option values are unverified.'}]}
    result=_qualify_knowledge_facts(ReaderResult(status='success',summary='',facts=('Region; Priority.',)),kb)
    assert any('Operations Manager layout' in f for f in result.facts)
    assert any('Option values are unverified' in f for f in result.facts)
    assert result.page=='' and result.source_hint['page']=='/work/tasks'


def test_native_tabs_disambiguate_duplicate_ancestor_control_summaries():
    obs={'tabControls':[{'name':'Risk Insights','selected':False}],
         'regionSummaries':[{'nodeId':'a','controls':['Risk Insights']},{'nodeId':'b','controls':['Risk Insights']}]}
    assert _observed_switch_tab_action({'name':'Risk Insights'},obs)=={'type':'switch_tab','role':'tab','name':'Risk Insights'}
    obs['tabControls'].append({'name':'Risk Insights','selected':True})
    assert _observed_switch_tab_action({'name':'Risk Insights'},obs) is None


def test_nested_tab_path_binds_children_to_parent_without_matching_other_groups():
    obs={'sectionSummaries':[{'nodeId':'t1','kind':'table','selectedState':'To Do','selectedTabPath':['Team Work','To Do'],'rowFields':[{'Ref':'R-1'}]}]}
    assert _observation_has_category_children(obs,'Team Work')
    assert not _observation_has_category_children(obs,'Other Work')


def test_date_field_comparison_is_not_an_expiry_countdown():
    assert reader_answer_shape('Show permits whose effective start date is later than their expiry date.')=='list'
    assert reader_answer_shape('Which permits expire soon?')=='due'
    assert reader_answer_shape('Find work task REF-101.')=='list'


def test_named_queue_can_disambiguate_an_unqualified_primary_object():
    kb={'ok':True,'chunks':[{'content':'## Semantic node: Queued Tasks\n- **page:** `/work/tasks`\n- **section:** Queued Tasks\n- **content:** Task No.; Status.'},
                  {'content':'## Semantic node: To Do\n- **page:** `/other/team`\n- **section:** To Do\n- **content:** Task No.; Status.'}]}
    assert _documented_object_source(kb,'From the queued task list, give me one Task No.',{})=='/work/tasks'
    assert _documented_object_source(kb,'Show tasks.',{})==''


def test_unverified_same_record_does_not_guess_search_value():
    g=Gateway()
    result=run_reader(g,Planner(),question='Find that same task by its Task No.',
        conversation_context={'previousIntent':{'question':'Show a queued task','resultStatus':'not_confirmed'}}).result
    assert result.missing==('prior_record_identifier_unverified',)
    assert 'No identifier was guessed' in result.facts[0] and g.events==['GetUserInfo']


def test_exact_search_is_executed_before_default_list_api_selection():
    base={'readHealth':{'healthy':True},'filterControls':[{'role':'textbox','label':'Search',
        'selector':'input[placeholder="Search"]','filterSurface':True,'selected':[],'commands':[]}],
        'apiDiscovery':{'candidates':[{'operationKey':'GET /api/work','method':'GET','path':'/api/work',
            'candidateKind':'business','policyState':'allowed','responseEvidence':{'items':[{'ref':'REF-1'}]}}],'truncated':False},
        'sectionSummaries':[{'nodeId':'t1','kind':'table','rowFields':[{'Ref':'REF-1'}],'columnHeaders':['Ref']}]}
    class SearchGateway(Gateway):
        async def invoke(self,p,name,args,**kwargs):
            if name=='admin.portal.read':
                obs=deepcopy(base)
                if any(a.get('type')=='filter' for a in args['actions']):
                    obs['filterControls'][0]['selected']=['QA-NO-SUCH-100']
                    obs['sectionSummaries'][0].update(rowFields=[],emptyState='No Data')
                    obs['apiDiscovery']={'candidates':[],'truncated':False}
                self.portal_result={'ok':True,'result':{'result':'not_confirmed','page':'/work','observation':obs}}
            return await super().invoke(p,name,args,**kwargs)
    class SearchPlanner(Planner):
        async def plan_admin_portal_read(self,q,p,k,conversation_context=None):
            if not k.get('portalObservation'):return portal_plan_for('/work',[{'type':'observe'}])
            assert k['portalObservation']['filterControls'][0]['selected']==['QA-NO-SUCH-100']
            return {'mode':'observation_result','result':'no_data','page':'/work','sourceSection':'t1','answerShape':'list','facts':[],'missing':[]}
    g=SearchGateway(info={'ok':True,'result':user_info_for_paths('/work')})
    result=run_reader(g,SearchPlanner(),question='Find work task QA-NO-SUCH-100.').result
    assert any(a.get('value')=='QA-NO-SUCH-100' for n,args,_ in g.calls if n=='admin.portal.read' for a in args['actions'])
    assert result.status=='no_data'


@pytest.mark.parametrize('headers,status',[(['Reference No.','Customer','Current Handler'],'success'),([], 'not_confirmed')])
def test_empty_table_schema_uses_headers_not_rows_or_role_assumptions(headers,status):
    from app.portal_reader import _native_schema_outcome
    obs={'readHealth':{'healthy':True},'sectionSummaries':[{'kind':'table','nodeId':'t1','columnHeaders':headers,'rowFields':[],'emptyState':'No Data'}]}
    original=ReaderOutcome(ReaderResult(status='not_confirmed',summary='',page='/work'),{'permission':{'currentRole':'Reviewer'},'observation':obs})
    result=_native_schema_outcome(original,'Do these records have an Agent field or a Customer field for my current role?').result
    assert result.status==status
    if headers:
        assert 'A column named Agent is not present' in result.facts[1]
        assert 'A column named Customer is visible.'==result.facts[2]
        assert 'Reviewer' in result.facts[0]


@pytest.mark.parametrize('dates,matched,skipped',[
    ([('2026-09-20','2026-09-10'),('2026-09-10','2026-09-10')],1,0),
    ([('20/09/2026','10/09/2026'),('10/09/2026','10/09/2026')],1,0),
    ([('2026-09-20','2026-09-10'),('01/02/2026','02/01/2026')],1,1),
    ([('2026-09-10','2026-09-20')],0,0),
])
def test_literal_date_comparison_keeps_verified_fields_and_bounded_coverage(dates,matched,skipped):
    from app.portal_reader import _native_date_comparison_outcome
    rows=[{'Record No.':str(i),'Effective Date':a,'Expiry Date':b} for i,(a,b) in enumerate(dates)]
    obs={'readHealth':{'healthy':True},'sectionSummaries':[{'kind':'table','nodeId':'t1','columnHeaders':list(rows[0]),'rowFields':rows,'summaries':['Total 47']}]}
    original=ReaderOutcome(ReaderResult(status='not_confirmed',summary='',page='/work'),{'observation':obs})
    result=_native_date_comparison_outcome(original,'Show records whose effective start date is later than their expiry date.')
    assert result.audit_evidence['dateComparisonEvidence']['matched']==matched
    assert result.audit_evidence['dateComparisonEvidence']['skipped']==skipped
    assert result.result.completeness=='bounded' and 'Unobserved records remain unchecked' in result.result.facts[-1]
    assert all('47' not in f for f in result.result.facts)


def test_refund_source_attribute_is_not_a_foreign_record_identity():
    from app.portal_reader import _guard_related_record_substitution
    obs={'sectionSummaries':[{'kind':'table','nodeId':'t1','columnHeaders':['Application No.','Refund Source'],'rowFields':[],'emptyState':'No Data'}]}
    original=ReaderOutcome(ReaderResult(status='no_data',summary='',page='/work',source_section='t1'),{'observation':obs})
    assert _guard_related_record_substitution(original,'Show the Completed refund queue and include Refund Source only if it exists.',{})==original


def test_queue_membership_is_not_personal_assignment_even_after_failed_lookup():
    result=run_reader(Gateway(),Planner(),question='Does being in To Do prove I am the Current Handler?').result
    assert result.status=='success' and 'requires a verified handler identity' in result.facts[0]


def test_failed_previous_team_request_cannot_establish_a_sample():
    result=run_reader(Gateway(),Planner(),question='Is that the total number, or only the sample you listed?',
        conversation_context={'previousIntent':{'resultStatus':'not_confirmed','deliveredAnswerShape':'detail'}}).result
    assert result.status=='success' and 'Neither a sample count nor a collection total' in result.facts[0]


def test_nested_child_read_replays_parent_in_each_fresh_portal_context():
    class NestedGateway(Gateway):
        async def invoke(self,p,name,args,**kwargs):
            if name=='admin.portal.read':
                names=[a.get('name') for a in args['actions'] if a['type']=='switch_tab']
                if 'Completed' in names:
                    assert names==['Team Work','Completed']
                parent='Team Work' in names
                selected='Completed' if 'Completed' in names else 'To Do'
                obs={'readHealth':{'healthy':True},'tabControls':[{'name':'Team Work','selected':parent}],
                     'sectionSummaries':[]}
                if parent:
                    obs['tabControls'] += [{'name':t,'selected':t==selected} for t in ['To Do','Completed']]
                    obs['sectionSummaries']=[{'nodeId':'t1','kind':'table','selectedState':selected,'selectedTabPath':['Team Work',selected],
                        'columnHeaders':['Task No.','Status'],'rowSummaries':[('R-DONE' if selected=='Completed' else 'R-TODO')+' '+selected],
                        'rowFields':[{'Task No.':'R-DONE' if selected=='Completed' else 'R-TODO','Status':selected}]}]
                self.portal_result={'ok':True,'result':{'result':'not_confirmed','page':'/work','observation':obs}}
            return await super().invoke(p,name,args,**kwargs)
    class NestedPlanner(Planner):
        async def plan_admin_portal_read(self,q,p,k,conversation_context=None):
            obs=k.get('portalObservation')
            if not obs:return portal_plan_for('/work',[{'type':'observe'}])
            if not obs['tabControls'][0]['selected']:return portal_plan_for('/work',[{'type':'switch_tab','role':'tab','name':'Team Work'}])
            if not obs['tabControls'][-1]['selected']:return portal_plan_for('/work',[{'type':'switch_tab','role':'tab','name':'Completed'}])
            return {'mode':'observation_result','result':'success','page':'/work','sourceSection':'t1','answerShape':'list','facts':[json.dumps({'Task No.':'R-DONE','Status':'Completed'})],'missing':[]}
    g=NestedGateway(info={'ok':True,'result':user_info_for_paths('/work')})
    outcome=run_reader(g,NestedPlanner(),question='Show work tasks in Completed.')
    result=outcome.result
    assert result.status=='success' and 'R-DONE' in str(result.facts) and 'R-TODO' not in str(result.facts), outcome.audit_evidence
    assert g.events.count('admin.portal.read')==3


def test_natural_formatter_does_not_invent_currency():
    from app.service import reader_natural_answer_is_grounded
    assert not reader_natural_answer_is_grounded('Amount $250.00','Amount 250.00','Show refunds')
    assert reader_natural_answer_is_grounded('Amount 250.00','Amount 250.00','Show refunds')
    assert reader_natural_answer_is_grounded('Amount AED 250.00','Amount AED 250.00','Show refunds')


def test_workflow_completion_does_not_prove_bank_settlement():
    result=run_reader(Gateway(),Planner(),question='Does a completed request prove the money reached the customers bank?').result
    assert result.status=='success' and 'separate verified payment evidence' in result.facts[0]


def test_optional_fields_keep_native_schema_without_replacing_time_or_names_with_ids():
    from app.portal_reader import _native_optional_record_fields
    obs={'readHealth':{'healthy':True},'sectionSummaries':[{'kind':'table','nodeId':'t1','columnHeaders':['Ticket No.','Customer','Submission Time'],
        'rowFields':[{'Ticket No.':'REF-1','Customer':'Example','Submission Time':'2026-09-10'}]}]}
    original=ReaderOutcome(ReaderResult(status='success',summary='',page='/work',facts=('Source ID 5 Priority ID 2 SLA end time 2026-09-11',)),{'observation':obs})
    result=_native_optional_record_fields(original,'Show three tickets with source, priority and update time where available.').result
    assert json.loads(result.facts[0])==obs['sectionSummaries'][0]['rowFields'][0]
    assert 'Source ID' not in str(result.facts) and 'not interchangeable' in result.facts[-1]


def test_documented_column_contrast_preserves_both_fields_and_prefers_current_role_variant():
    from app.portal_reader import _documented_column_contrast
    chunks=[]
    for role in ['Reviewer','Manager']:
        for state,field in [('To Do','Assigned Time'),('Completed','Last Update')]:
            chunks.append({'content':f'## Semantic node: {role} {state}\n- **page:** `/work`\n- **content:** Ref; {field}; Status.\n- **scope:** Verified for the {role} representative. Other roles are unverified.'})
    kb={'ok':True,'chunks':chunks}
    result=_documented_column_contrast('Why does one list show Assigned Time and the other Last Update?',kb,'Reviewer')
    assert result.status=='success' and 'Reviewer To Do' in str(result.facts) and 'Reviewer Completed' in str(result.facts)
    assert 'Manager' not in str(result.facts) and 'business event' in result.facts[-1]
    # Documentation for inaccessible roles still describes its own role only.
    other=_documented_column_contrast('Why does one list show Assigned Time and the other Last Update?',kb,'Committee')
    assert 'current-role access' in other.facts[-1] and 'Committee' not in str(other.facts)
    assert _documented_column_contrast('Define Assigned Time.',kb,'Reviewer') is None


def test_documented_tab_can_locate_source_when_primary_list_chunk_was_not_retrieved():
    kb={'ok':True,'chunks':[{'content':'### Control: Queued Tasks tab\n- **name:** Queued Tasks tab\n- **type:** tab switcher\n- **destination:** Local state on `/work/tasks` with the Queued Tasks view.'}]}
    assert _documented_object_source(kb,'From the queued task list, give me one Task No.',{})=='/work/tasks'
    assert _documented_object_source(kb,'Show tasks.',{})==''
    kb['chunks'].append({'content':'## Semantic node: Team Tasks - To Do\n- **page:** `/other/team-management`\n- **section:** Team Tasks / To Do\n- **content:** Task No., Status, Assigned To.'})
    # The word 'to' in a purpose clause must not nominate the unrelated To Do list.
    question='From the queued task list, give me one Task No. and only the information needed to identify it.'
    assert _documented_object_source(kb,question,{})=='/work/tasks'
    kb['chunks'].append({'content':'### Control: Queued Tasks tab\n- **name:** Queued Tasks tab\n- **type:** tab switcher\n- **destination:** Local state on `/another/tasks`.'})
    assert _documented_object_source(kb,question,{})==''


def test_filter_catalogue_keeps_scope_and_does_not_merge_inline_controls():
    from app.portal_reader import _documented_filter_catalogue
    kb={'ok':True,'chunks':[{'content':'## Semantic node: Queued Tasks filter\n- **type:** filter surface\n- **page:** `/work/tasks`\n- **section:** Filter\n- **content:** Region; Priority; Cancel.\n- **scope:** Opening was rechecked for Operations Manager.'},
        {'content':'### Control: Search\n- **name:** Search\n- **content:** All Reasons; All Statuses.'}]}
    result=_documented_filter_catalogue('What filters can I use on the Work queued task list?',kb)
    assert result.status=='success' and 'Operations Manager' in str(result.facts)
    assert 'All Reasons' not in str(result.facts) and 'inline list controls' in str(result.facts)


def test_native_schema_survives_planner_exception_after_verified_read():
    class BadSchemaPlanner(Planner):
        async def plan_admin_portal_read(self,q,p,k,conversation_context=None):
            if k.get('portalObservation'):raise ValueError('invalid model schema')
            return portal_plan_for('/work',[{'type':'observe'}])
    obs={'readHealth':{'healthy':True},'sectionSummaries':[{'kind':'table','nodeId':'t1','columnHeaders':['Customer','Current Handler'],'emptyState':'No Data','rowFields':[]}]}
    g=Gateway(info={'ok':True,'result':user_info_for_paths('/work')},portal_result={'ok':True,'result':{'result':'not_confirmed','observation':obs}})
    result=run_reader(g,BadSchemaPlanner(),question='Do these records have an Agent field or a Customer field for my current role?').result
    assert result.status=='success' and result.page=='/work' and 'Customer is visible' in str(result.facts)


@pytest.mark.parametrize('correct,trigger,expected',[(True,'action:1:switch_tab',True),(False,'action:1:switch_tab',False),(True,'page_load',False)])
def test_empty_selected_api_can_establish_category_children_only_with_matching_action(correct,trigger,expected):
    obs={'readHealth':{'healthy':True},'tabControls':[{'name':'Operational Insights','selected':True}],
        'apiEvidence':{'operationKey':'POST /api/operational-insights/summary' if correct else 'POST /api/other/summary','trigger':trigger,
            'data':{'isSuccess':True,'data':{'items':[],'totalItems':0}},'truncated':False},'sectionSummaries':[]}
    assert _observation_has_category_children(obs,'Operational Insights') is expected


def test_empty_queue_count_cannot_count_another_view_or_loading_table():
    from app.portal_reader import _native_empty_queue_count
    obs={'readHealth':{'healthy':True},'sectionSummaries':[{'kind':'table','nodeId':'t1','columnHeaders':['Ref'],'selectedState':'To Do','rowFields':[],'emptyState':'No Data'}]}
    original=ReaderOutcome(ReaderResult(status='not_confirmed',summary='',page='/work'),{'observation':obs})
    result=_native_empty_queue_count(original,'How many records are in To Do?').result
    assert result.status=='success' and '0 matching records' in result.facts[0]
    assert _native_empty_queue_count(original,'How many records are in Completed?')==original
    obs['readHealth']['healthy']=False
    assert _native_empty_queue_count(original,'How many records are in To Do?')==original
