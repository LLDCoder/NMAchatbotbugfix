"""Active source/view contracts; isolated rows never count as business acceptance."""
import copy,json
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.reader_routing import verify_route,source_view_proof
from app.reader_requirements import semantic_bindings,requirements_for
from app.reader_collection import projection_hash
from test_reader_record_set_live_collection import isolated_actual_contract_analysis
from test_reader_multi_record_identity import run_record_set

PAGE='/licensing/applications'
COMPLETED=json.loads((Path(__file__).parent/'fixtures/group17-completed-view-active.json').read_text())

def actual_contract_fixture(view='todo',operation='POST /api/Application/MyComplatedPage'):
    task,plan,sources,kb=isolated_actual_contract_analysis();source=next(iter(sources.values()))
    kb.add({'chunks':[{'id':'official-completed','content':json.dumps(COMPLETED)}]})
    source['operationRef']=operation;task.view=view
    kb.intent_lexical_context['requirements']=requirements_for(task)
    for binding in plan.requirementBindings:
        if binding.requirementId=='detail':continue
        req=next(x for x in requirements_for(task)if x['id']==binding.requirementId)
        fact=next(x for x in semantic_bindings(kb)if x['operationRef']==operation and x['sourcePath']=='/data/page/items'and x['kind']==req['kind']and x['concept']==req['value'])
        binding.knowledgeBindingId=fact['knowledgeBindingId']
    observed={'pageIdentity':{'path':PAGE},'tabControls':[
        {'name':'To Do','selected':view=='todo'},{'name':'Completed','selected':view=='completed'}]}
    return task,plan,sources,kb,observed


def verify(f):
    task,plan,sources,kb,observed=f
    return verify_route(task,PAGE,PAGE,observed,sources,kb,require_record=False)


@pytest.mark.parametrize('requested,operation',[('todo','POST /api/Application/MyComplatedPage'),('completed','POST /api/Application/MyTodoPage')])
def test_visible_tab_cannot_relabel_other_operation_in_complete_analysis(requested,operation):
    f=actual_contract_fixture(requested,operation);result=verify(f);source=next(iter(f[2].values()))
    assert result.passed # The observed UI tab is correct; API coverage is not.
    assert result.checks[1].sourceIds==[]
    assert 'verifiedView'not in source
    assert source['sourceViewProof']['view']!=requested
    analysis=run_record_set(f[:4])
    assert not analysis['requirementsSatisfied']
    assert next(x for x in analysis['requirementCoverage']if x['kind']=='view')['status']=='unfulfilled'


@pytest.mark.parametrize('view,operation',[('todo','POST /api/Application/MyTodoPage'),('completed','POST /api/Application/MyComplatedPage')])
def test_matching_documented_view_operation_reaches_legal_complete_analysis(view,operation):
    f=actual_contract_fixture(view,operation);source=next(iter(f[2].values()))
    assert verify(f).passed and source['verifiedView']==view
    assert source['sourceViewProof']['authority']=='active_page_operation_context'
    analysis=run_record_set(f[:4])
    assert analysis['requirementsSatisfied'],analysis['requirementCoverage']
    assert len(analysis['outputs'][0]['value'])==2


@pytest.mark.parametrize('fault',['unknown_operation','no_kind','other_page','no_principal','no_capture','not_ready','failed_collection','missing_data','retired_definition','conflicting_view'])
def test_unknown_or_conflicting_api_source_never_inherits_ui_view(fault):
    f=actual_contract_fixture('completed');source=next(iter(f[2].values()));kb=f[3]
    if fault=='unknown_operation':source['operationRef']='POST /api/unmapped/completed'
    elif fault=='no_kind':source.pop('kind')
    elif fault=='other_page':source['page']='/unrelated'
    elif fault=='no_principal':source.pop('principalScopeRef')
    elif fault=='no_capture':source.pop('capturedAt')
    elif fault=='not_ready':source['ready']=False
    elif fault=='failed_collection':source['collectionFailure']='collection_changed_between_passes'
    elif fault=='missing_data':source['data']={}
    elif fault=='retired_definition':
        next(x['record']for x in kb.items.values()if x.get('recordId')==COMPLETED['records'][0]['id'])['status']='archived'
    else:
        other=copy.deepcopy(COMPLETED);other['records'][0]['id']='isolated.conflicting.operation.view';other['records'][0]['payload']['view']='todo'
        kb.add({'chunks':[{'id':'conflict','content':json.dumps(other)}]})
    source['verifiedView']='stale';source['sourceViewProof']={'view':'stale'}
    verify(f)
    assert 'verifiedView'not in source and 'sourceViewProof'not in source


def test_same_operation_views_need_captured_request_context_not_operation_name():
    f=actual_contract_fixture('completed');source=next(iter(f[2].values()));kb=f[3]
    completed=next(x['record']for x in kb.items.values()if x.get('recordId')==COMPLETED['records'][0]['id'])
    for fact in completed['payload']['bindings']:fact['contextParameters']={'bucket':'done'}
    other=copy.deepcopy(completed);other['id']='isolated.same.operation.todo';other['payload']['view']='todo'
    for fact in other['payload']['bindings']:fact['contextParameters']={'bucket':'pending'}
    kb.add({'chunks':[{'id':'same-operation-other-view','content':json.dumps({'records':[other]})}]})
    source['collectionContext']={'parameterHashes':{'bucket':projection_hash('done')}}
    assert source_view_proof(f[0],PAGE,source,kb)['view']=='completed'
    verify(f);assert source['verifiedView']=='completed'
    source['collectionContext']['parameterHashes']['bucket']=projection_hash('pending')
    verify(f);assert 'verifiedView'not in source and source['sourceViewProof']['view']=='todo'
    source['collectionContext']['parameterHashes']={}
    verify(f);assert 'verifiedView'not in source and 'sourceViewProof'not in source


@pytest.mark.parametrize('fault',['extra_filter','wrong_type','missing_key'])
def test_context_contract_cannot_be_satisfied_by_partial_or_coerced_parameters(fault):
    f=actual_contract_fixture('completed');source=next(iter(f[2].values()));kb=f[3]
    completed=next(x['record']for x in kb.items.values()if x.get('recordId')==COMPLETED['records'][0]['id'])
    for fact in completed['payload']['bindings']:fact['contextParameters']={'bucket':2}
    hashes={'bucket':projection_hash(2)}
    if fault=='extra_filter':hashes['owner']=projection_hash('other')
    elif fault=='wrong_type':hashes['bucket']=projection_hash('2')
    else:hashes={}
    source['collectionContext']={'parameterHashes':hashes}
    verify(f);assert 'verifiedView'not in source


@pytest.mark.parametrize('kind',['page_metrics','page_section'])
def test_dom_own_observation_retains_actual_selected_ui_view(kind):
    f=actual_contract_fixture();f[2]['dom']={'kind':kind,'operationRef':'permitted_page_observation','page':PAGE,'ready':True,'data':{}}
    verify(f)
    assert f[2]['dom']['verifiedView']=='todo'
    assert f[2]['dom']['sourceViewProof']['authority']=='observed_selected_ui'
    assert 'verifiedView'not in next(iter(f[2].values()))


def supplemental_contract():
    task,plan,sources,kb,observed=actual_contract_fixture();task.view=''
    record={'id':'isolated.bare-set.supplemental','kind':'page_definition','revision':1,'status':'active',
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':[PAGE]},'sources':[{'reference':PAGE}],
        'payload':{'pageReads':[{'operationKey':op,'parameters':{'pageIndex':1,'pageSize':10},
            'requiredScope':'unknown','requiredObjects':['application'],'requiredFor':['record identifiers'],
            'requiredIntent':'bare_record_set'}for op in ['POST /api/Application/MyTodoPage','POST /api/Application/MyComplatedPage']]}}
    kb.add({'chunks':[{'id':'isolated-bare-set-supplemental','content':json.dumps({'records':[record]})}]})
    assert any(x.get('recordId')==record['id'] for x in kb.items.values()),kb.rejected
    return task,kb


def test_bare_set_marker_activates_existing_registered_read_contract_only_for_bare_request():
    from app.reader_related import page_reads
    task,kb=supplemental_contract()
    assert len(page_reads(kb,PAGE,task))==2
    assert len(task.filters)==1 and task.recordIdentity==''


@pytest.mark.parametrize('change',[
    {'view':'todo'},{'view':'completed'},{'requestedScope':'team'},
    {'businessFocus':'pending applications'},{'timeRange':'today'},{'timeField':'submissionTime'},
    {'requestedAttributes':['SLA']},{'requestedMeasures':['count']},{'requestedOrdering':['most urgent']},
    {'groupBy':['status']},{'recordIdentity':'EXAMPLE-1'},{'outputShape':'count'},
    {'readOnly':False},{'needsLiveData':False},{'unresolvedSlots':['businessObject']},
    {'filters':['record identifiers in ["EXAMPLE-1", "EXAMPLE-2"]','status is Pending']},
    {'filters':['record identifiers in ["EXAMPLE-1"]']},
    {'filters':['record identifiers in ["EXAMPLE-1", "EXAMPLE-1"]']},
])
def test_opt_in_page_reads_preserve_explicit_view_and_all_extra_user_clauses(change):
    from app.reader_related import page_reads
    task,kb=supplemental_contract();task=task.model_copy(update=change);before=task.model_dump()
    assert page_reads(kb,PAGE,task)==[]
    assert task.model_dump()==before


def test_unknown_activation_marker_is_not_a_permission_to_read():
    from app.reader_related import page_reads
    task,kb=supplemental_contract()
    record=next(x['record']for x in kb.items.values()if x.get('recordId')=='isolated.bare-set.supplemental')
    for rule in record['payload']['pageReads']:rule['requiredIntent']='model_says_allowed'
    assert page_reads(kb,PAGE,task)==[]
