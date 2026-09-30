"""Original License failure metadata; narrowly executable collection repairs."""
import copy,json
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.generic_reader import KnowledgeStore,PipelineError,validate_selection
from app.generic_reader_contracts import TaskSpec,SourceSelection
from app.reader_requirements import semantic_bindings,requirements_for
from app.reader_record_request import minimal_record_set_projection,compile_record_set_read_selection
from test_projected_collection import gateway

SAVED=json.loads((Path(__file__).parent/'fixtures/group17-license-record-set-replay.json').read_text())
PAGE='/licensing/applications'

def fixture(language='en',routing=True):
    task=TaskSpec.model_validate(SAVED[language]['task'])
    kb=KnowledgeStore()
    for index,item in enumerate(SAVED['packages'][:3 if routing else 2]):
        kb.add({'chunks':[{'id':'original-'+str(index),'content':json.dumps(item['content'])}]})
    kb.intent_lexical_context={'question':SAVED['originalQuestion'],'requirements':requirements_for(task),'terms':[]}
    source=copy.deepcopy(SAVED[language]['sourceMetadata'])
    return task,kb,source

def selection(kb,value):
    ref={'sourceId':kb.prompt()[0]['passages'][0]['sourceId']}
    return SourceSelection.model_validate({'stage':'source_selection','sourceIds':[],
        'rationale':[ref],'missing':[],'nextActions':[{'type':'filter','selector':'input[placeholder="Search"]','value':value,'evidence':[ref]}]})


def test_real_en_time_varying_sla_failure_has_no_changed_entities_or_counts():
    comparison=SAVED['en']['actualCollectionFailure']['comparison']
    assert comparison['firstRowCount']==comparison['secondRowCount']==71
    assert comparison['changedFields']==['sla'] and comparison['changedIdentityCount']==54
    assert comparison['addedIdentityCount']==comparison['removedIdentityCount']==0


@pytest.mark.parametrize('language',['en','ar'])
def test_original_bare_set_projection_closes_on_documented_keys_not_unrequested_sla(language):
    task,kb,source=fixture(language)
    assert minimal_record_set_projection(task,kb,PAGE,source,'/data/page/items')==['id','applicationNumber']
    assert task.filters==SAVED[language]['task']['filters'] and task.recordIdentity==''
    # The original gateway still rejects changed values when such a field is requested.
    one=[{'id':1,'applicationNumber':'A-1','sla':'one'}]
    two=[{'id':1,'applicationNumber':'A-1','sla':'two'}]
    assert not gateway._collection_comparison(one,two,list(one[0]),['id'])['equivalent']


@pytest.mark.parametrize('condition',['attribute','scope','time','another_filter','conditional_object','wrong_operation','no_routing','wrong_key'])
def test_projection_does_not_drop_requested_or_unresolved_semantic_fields(condition):
    task,kb,source=fixture(routing=condition!='no_routing')
    if condition=='attribute':task.requestedAttributes=['SLA']
    elif condition=='scope':task.requestedScope='personal'
    elif condition=='time':task.timeRange='today'
    elif condition=='another_filter':task.filters.append('overdue')
    elif condition=='wrong_operation':source['operationRef']='POST /other'
    elif condition in {'conditional_object','wrong_key'}:
        rec=next(v['record']for v in kb.items.values()if v.get('record',{}).get('id')=='admin.licensing.applications.bindings.todo')
        obj=next(b for b in rec['payload']['bindings']if b['kind']=='object')
        if condition=='conditional_object':
            obj['fields']=['id','status']
            obj['conditions']=[{'field':'status','predicate':'eq','value':'Pending'}]
        else:obj['fields']=['taskId']
    assert minimal_record_set_projection(task,kb,PAGE,source,'/data/page/items') is None


def test_active_existing_routing_record_repairs_ar_missing_definition_without_new_kb():
    task,kb,_=fixture('ar',routing=False)
    assert not any(f.get('compiledRecordSet')for f in semantic_bindings(kb))
    raw=SAVED['packages'][2]['content']
    kb.add({'chunks':[{'id':'official-existing-routing','content':json.dumps(raw)}]})
    sets=[f for f in semantic_bindings(kb)if f.get('compiledRecordSet')]
    assert {f['operationRef']for f in sets}=={'POST /api/Application/MyTodoPage','POST /api/Application/MyComplatedPage'}
    assert all(f['compiledRecordSet']['identifiers']==['ML-2-804-9226243','ML-2-804-0460740']for f in sets)
    assert all(item['documentId']==''for item in kb.items.values())


@pytest.mark.parametrize('value',['ML-2-804-9226243','ML-2-804-0460740','ML-2-804-9226243 and ML-2-804-0460740'])
def test_actual_single_search_writes_compile_to_real_collection_and_keep_all_ids(value):
    task,kb,source=fixture();plan=selection(kb,value);sources={source['sourceId']:source}
    result=compile_record_set_read_selection(task,plan,sources,kb,PAGE,[])
    assert result['reason']=='record_set_use_collection_exact_filter'
    assert result['presenceVerified'] is False
    assert plan.sourceIds==[source['sourceId']] and plan.nextActions==[]
    validate_selection(plan,sources,kb)
    assert len(next(f for f in semantic_bindings(kb)if f.get('compiledRecordSet'))['compiledRecordSet']['identifiers'])==2


def test_existing_first_identifier_filter_is_cleared_before_collecting_next_population():
    task,kb,source=fixture('ar');plan=selection(kb,'ML-2-804-0460740')
    actions=SAVED['ar']['captures'][1]['actions']
    result=compile_record_set_read_selection(task,plan,{source['sourceId']:source},kb,PAGE,actions)
    assert result['reason']=='record_set_clear_previous_single_identifier_filter'
    assert plan.sourceIds==[] and len(plan.nextActions)==1 and plan.nextActions[0].value==''
    assert plan.nextActions[0].selector==actions[0]['selector']


@pytest.mark.parametrize('fault',['missing_definition','missing_source','ambiguous_source'])
def test_correction_never_invents_authority_source_or_identity(fault):
    task,kb,source=fixture(routing=fault!='missing_definition');plan=selection(kb,'ML-2-804-9226243')
    sources={}if fault=='missing_source'else{source['sourceId']:source}
    if fault=='ambiguous_source':sources['other']=copy.deepcopy(source)
    with pytest.raises(PipelineError):compile_record_set_read_selection(task,plan,sources,kb,PAGE,[])


def test_unrelated_user_filter_is_not_erased_or_reinterpreted():
    task,kb,source=fixture();plan=selection(kb,'Completed')
    assert compile_record_set_read_selection(task,plan,{source['sourceId']:source},kb,PAGE,[]) is None
    assert plan.nextActions[0].value=='Completed'


def test_cleared_identifier_filter_does_not_keep_reclearing_old_action_history():
    task,kb,source=fixture();plan=selection(kb,'ML-2-804-0460740')
    actions=[{'type':'filter','selector':plan.nextActions[0].selector,'value':'ML-2-804-9226243'},
             {'type':'filter','selector':plan.nextActions[0].selector,'value':''}]
    result=compile_record_set_read_selection(task,plan,{source['sourceId']:source},kb,PAGE,actions)
    assert result['reason']=='record_set_use_collection_exact_filter'
    assert plan.nextActions==[]


def isolated_actual_contract_analysis(language='en'):
    # The task/metadata/field definitions are captured originals. These rows are
    # an explicitly isolated implementation fixture, never business acceptance.
    from app.generic_reader_contracts import AnalysisPlan
    task,kb,source=fixture(language)
    identifiers=json.loads(task.filters[0].split(' in ',1)[1])
    data={'data':{'page':{'items':[
        {'id':101,'applicationNumber':identifiers[0]},
        {'id':202,'applicationNumber':identifiers[1]},
        {'id':303,'applicationNumber':identifiers[0]+'9'}], 'total':3}}}
    source={k:source[k]for k in ['sourceId','page','operationRef','collectionContext']}
    source.update(data=data,completeness='bounded',kind='api_response',
        principalScopeRef='isolated-test-principal',capturedAt='isolated-test-time',
        observationRef='isolated-test-observation',
        fieldEvidence=gateway._reader_field_evidence(data,data))
    sid=source['sourceId'];ref=kb.prompt()[0]['passages'][0]['sourceId']
    facts=[f for f in semantic_bindings(kb) if f['operationRef']==source['operationRef']
           and f['sourcePath']=='/data/page/items']
    claim=lambda value:{'value':value,'evidence':[{'sourceId':ref}]}
    plan=AnalysisPlan.model_validate({'stage':'analysis','missing':[],
        'context':{'scope':'unknown','scopeEvidence':[],'grain':claim('application'),
          'population':claim('requested records'),'filterScope':claim('exact identifiers'),
          'time':claim('current'),'caveats':[]},
        'steps':[
          {'id':'read','op':'read_rows','sourceId':sid,'path':'/data/page/items',
           'totalPath':'/data/page/total','fields':['id','applicationNumber'],
           'expose':False,'label':'Read','evidence':[{'sourceId':ref}]},
          {'id':'selected','op':'filter','inputs':['read'],'field':'applicationNumber',
           'predicate':'in','operand':identifiers,'expose':False,'label':'Selected','evidence':[{'sourceId':ref}]},
          {'id':'entities','op':'distinct','inputs':['selected'],'fields':['id'],
           'expose':False,'label':'Entities','evidence':[{'sourceId':ref}]},
          {'id':'visible','op':'project','inputs':['entities'],'fields':['applicationNumber'],
           'expose':True,'role':'detail','label':'Records','evidence':[{'sourceId':ref}]}],
        'requirementBindings':[
          {'requirementId':r['id'],'sourceId':sid,'stepIds':['visible'],
           'knowledgeBindingId':next(f['knowledgeBindingId']for f in facts
              if f['kind']==r['kind'] and f['concept']==r['value'])}
          for r in requirements_for(task)if r['kind']!='detail'] + [
          {'requirementId':'detail','sourceId':sid,'stepIds':['visible'],
           'sourcePath':'/data/page/items','fields':['applicationNumber'],
           'knowledgeBindingId':'','evidence':[{'sourceId':ref}]}]})
    return task,plan,{sid:source},kb


@pytest.mark.parametrize('language',['en','ar'])
def test_collection_correction_reaches_full_execute_analysis_with_both_exact_ids(language):
    from test_reader_multi_record_identity import run_record_set
    task,analysis,sources,kb=isolated_actual_contract_analysis(language)
    selection_plan=selection(kb,'ML-2-804-9226243')
    correction=compile_record_set_read_selection(task,selection_plan,sources,kb,PAGE,[])
    assert correction['reason']=='record_set_use_collection_exact_filter'
    result=run_record_set((task,analysis,sources,kb))
    assert result['requirementsSatisfied'],result['requirementCoverage']
    assert result['outputs'][0]['value']==[
       {'applicationNumber':'ML-2-804-9226243'}, {'applicationNumber':'ML-2-804-0460740'}]
    proof=next(c['recordSetProof']for c in result['requirementCoverage']if c['kind']=='filter')
    assert proof['unobservedIdentifiers']==[] and proof['globalAbsence']is False


@pytest.mark.parametrize('fault',['second_absent','subset_filter','wrong_identity_field','wrong_page','ambiguous_identity'])
def test_corrected_collection_still_requires_every_id_bound_to_one_current_entity(fault):
    from test_reader_multi_record_identity import run_record_set
    f=isolated_actual_contract_analysis();source=next(iter(f[2].values()));data=source['data']
    if fault=='second_absent':data['data']['page']['items'].pop(1)
    elif fault=='subset_filter':f[1].steps[1].operand=['ML-2-804-9226243']
    elif fault=='wrong_identity_field':f[1].steps[1].field='id'
    elif fault=='wrong_page':source['page']='/finance/transactions'
    else:data['data']['page']['items'].append({'id':404,'applicationNumber':'ML-2-804-9226243'})
    data['data']['page']['total']=len(data['data']['page']['items'])
    source['fieldEvidence']=gateway._reader_field_evidence(data,data)
    try:result=run_record_set(f)
    except PipelineError:return
    assert not result['requirementsSatisfied']


@pytest.mark.parametrize('requested_sla',[False,True])
def test_real_collection_hook_sends_minimal_set_but_preserves_explicit_sla(requested_sla):
    import asyncio,time
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import CollectionPlan
    from app.portal_reader import PortalReadRequest
    task,kb,source=fixture()
    source['data']={'data':{'page':{'items':[{'id':101,'applicationNumber':'FIXTURE-1','sla':'fixture'}],'total':1}}}
    if requested_sla:task.requestedAttributes=['SLA']
    proposed_fields=['id','applicationNumber','sla']
    sid=source['sourceId'];ref=kb.prompt()[0]['passages'][0]['sourceId']
    class ReachedOfflineGateway(Exception):pass
    class Gateway:
        async def invoke(self,principal,name,payload,**kwargs):
            fields=payload['collections'][0]['fields']
            assert set(fields)==set(proposed_fields if requested_sla else proposed_fields[:2])
            assert payload['collections'][0]['identityFields']==['id']
            raise ReachedOfflineGateway()
    reader=GenericKnowledgeReader(Gateway(),None,portal_base_url='https://isolated.test')
    reader.page=PAGE;reader.knowledge=kb;reader.deadline=time.monotonic()+60
    async def planned(contract,instruction,data,validator):
        plan=CollectionPlan.model_validate({'stage':'collection','collections':[{
            'sourceId':sid,'rowsPath':'/data/page/items','totalPath':'/data/page/total',
            'fields':proposed_fields,'identityFields':['id'],'pageField':'pageIndex',
            'sizeField':'pageSize','evidence':[{'sourceId':ref}]}]})
        validator(plan);return plan
    reader.structured=planned
    with pytest.raises(ReachedOfflineGateway):
        asyncio.run(reader.collect_sources(None,task,PortalReadRequest(PAGE,({'type':'observe'},)),{}, {sid:source}))
    excluded=[field for item in reader.audit.get('excludedProjectionFields',[])for field in item['fields']]
    assert ('sla'in excluded)is not requested_sla
