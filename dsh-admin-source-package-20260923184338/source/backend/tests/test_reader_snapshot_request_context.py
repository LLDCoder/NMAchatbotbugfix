import copy,json
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.generic_reader import KnowledgeStore,execute_analysis,PipelineError
from app.generic_reader_contracts import TaskSpec,AnalysisPlan
from app.reader_bindings import bind_analysis_evidence,selection_context_gaps
from app.reader_requirements import semantic_bindings,_context_match
from app.reader_collection import projection_hash
from test_projected_collection import gateway

FIXTURES=Path(__file__).parent / 'fixtures' / 'dashboard-snapshot'

def loaded():
    kb=KnowledgeStore()
    for p in (FIXTURES/'knowledge').glob('*.json'):
        kb.add({'chunks':[{'id':p.name,'content':p.read_text()}]})
    return kb


def scalar_receipts(value,path=''):
    if isinstance(value,dict):
        return {k:v for name,item in value.items() for k,v in scalar_receipts(item,path+'/'+name).items()}
    if isinstance(value,list):return {}
    return {path:{'status':'complete','valueHash':projection_hash(value)}}


def baseline_fixture(lang='en'):
    # Replay recorded native responses as OFFLINE inputs only, not new receipts
    # or new business acceptance. Request facts come from the saved browser.
    doc=json.loads((FIXTURES/f'baseline-{lang}.json').read_text())
    sources={}
    for r in doc['responses']:
        key=r['path'].split('/')[-1]
        if key not in {'overview','performance','license-distribution'}:continue
        captured={'method':'GET','parameters':r['query']}
        sources[key]={'sourceId':key,'kind':'api_response','operationRef':'GET '+r['path'],'page':'/dashboard',
            'data':r['data'],'ready':True,'capturedAt':r['observedAt'],'principalScopeRef':'offline-test-principal',
            'observationRef':'offline-one-browser-capture','completeness':'bounded','fieldEvidence':scalar_receipts(r['data']),
            'collectionContext':{'contextRef':projection_hash(r['query']),
                'parameterHashes':{k:projection_hash(v) for k,v in r['query'].items()},
                'parameterShapeEvidence':gateway._request_date_shape_evidence(captured)}}
    task=TaskSpec(stage='task',businessObject='dashboard',businessFocus='',requestedScope='unknown',requestedGrain='dashboard',requestedMeasures=[],requestedAttributes=['key metrics' if lang=='en' else 'key indicators'],groupBy=[],timeRange='unknown',filters=[],outputShape='overview',needsLiveData=True,readOnly=True,searchQuery='dashboard key metrics',unresolvedSlots=[])
    kb=loaded();kb.prompt();facts={f['knowledgeBindingId']:f for f in semantic_bindings(kb)}
    ids={'overview':'admin.dashboard.license-overview-panels','performance':'admin.dashboard.license-performance.department','license-distribution':'admin.dashboard.license-distribution'}
    attr={'overview':'key_metrics','performance':'dashboard_summary_component','license-distribution':'summary_metrics'}
    steps=[];bindings=[]
    for sid,rid in ids.items():
        fact=facts[rid+'#'+attr[sid]]
        citation=next(pid for pid,(key,text) in kb.passages.items() if kb.items[key].get('recordId')==rid)
        steps.append({'id':sid.replace('-','_'),'op':'read_rows','sourceId':sid,'path':fact['sourcePath'],'fields':fact['fields'],'role':'detail','expose':True,'label':sid,'evidence':[{'sourceId':citation}]})
        for requirement,bid in [('object','object'),('grain','grain'),('attribute_0',attr[sid])]:
            f=facts[rid+'#'+bid]
            bindings.append({'requirementId':requirement,'sourceId':sid,'sourcePath':f['sourcePath'],'fields':f['fields'],'stepIds':[sid.replace('-','_')],'knowledgeBindingId':f['knowledgeBindingId']})
    cite=steps[0]['evidence'];claim=lambda v:{'value':v,'evidence':cite}
    plan=AnalysisPlan.model_validate({'stage':'analysis','context':{'scope':'unknown','scopeEvidence':[],'grain':claim('current Dashboard panels'),'population':claim('each panel retains its population'),'filterScope':claim('captured request'),'time':claim('current'),'caveats':[]},'steps':steps,'requirementBindings':bindings,'missing':[]})
    return task,plan,sources,kb,facts


@pytest.mark.parametrize('lang',['en','ar'])
def test_recorded_three_panel_snapshots_have_independent_complete_scalar_lineage(lang):
    task,plan,sources,kb,_=baseline_fixture(lang)
    assert selection_context_gaps(task,SimpleNamespace(sourceIds=list(sources),nextActions=[],missing=[]),sources,kb)==[]
    bind_analysis_evidence(plan,task,kb,sources)
    result=execute_analysis(plan,sources,kb,[],task=task)
    assert result['requirementsSatisfied'],result['requirementCoverage']
    assert len(result['outputs'])==3
    assert sum(len(output['value'][0]) for output in result['outputs'])==29
    assert result['outputs'][0]['value'][0]['serviceApplicationCard.totalCount']==3


@pytest.mark.parametrize('fault',['missing_proof','bad_shape','hash_mismatch','bad_hash','missing_context_ref','missing_principal','wrong_transport','extra_filter','wrong_count','unknown_scope','unknown_category'])
def test_request_date_shape_is_not_an_unrestricted_context_bypass(fault):
    _,_,sources,_,facts=baseline_fixture();source=sources['overview'];fact=facts['admin.dashboard.license-overview-panels#grain'];context=source['collectionContext']
    if fault=='missing_proof':context['parameterShapeEvidence']={}
    if fault=='bad_shape':context['parameterShapeEvidence']['startDate']['format']='free_text'
    if fault=='hash_mismatch':context['parameterHashes']['startDate']=projection_hash('2026-01-01')
    if fault=='bad_hash':context['parameterShapeEvidence']['startDate']['valueHash']='forged'
    if fault=='missing_context_ref':context.pop('contextRef')
    if fault=='missing_principal':source.pop('principalScopeRef')
    if fault=='wrong_transport':source['operationRef']='POST /api/license/dashboard/overview'
    if fault=='extra_filter':context['parameterHashes']['customer']=projection_hash('other')
    if fault=='wrong_count':context['parameterHashes']['priorityCardCount']=projection_hash('999')
    if fault=='unknown_scope':context['parameterHashes']['scope']=projection_hash('global')
    if fault=='unknown_category':context['parameterHashes']['taskCategory']=projection_hash('99')
    assert not _context_match(fact,source)


@pytest.mark.parametrize('kind',['scope','population','filter','time','measure','ordering'])
def test_request_date_shape_cannot_establish_other_requirement_kinds(kind):
    _,_,sources,_,facts=baseline_fixture();fact=copy.deepcopy(facts['admin.dashboard.license-overview-panels#object']);fact['kind']=kind
    assert not _context_match(fact,sources['overview'])


@pytest.mark.parametrize('date',['2026-02-30','2026-13-01','today','2026-09-22T00:00:00','2026-9-2','',None,42])
def test_gateway_only_attests_strict_actual_iso_date_parameters(date):
    assert gateway._request_date_shape_evidence({'method':'GET','parameters':{'from':date}})=={}


def test_gateway_proof_contains_only_shape_and_digest_not_request_values():
    proof=gateway._request_date_shape_evidence({'method':'GET','parameters':{'from':'2026-09-22','scope':'1'}})
    assert proof=={'from':{'status':'complete','format':'date','valueHash':projection_hash('2026-09-22')}}
    assert gateway._request_date_shape_evidence({'method':'POST','parameters':{'from':'2026-09-22'}})=={}


@pytest.mark.parametrize('change',['measure','record','scope','time'])
def test_snapshot_overview_does_not_prove_entity_count_identity_scope_or_requested_period(change):
    task,plan,sources,kb,_=baseline_fixture()
    if change=='measure':task.requestedMeasures=['count']
    if change=='record':task.recordIdentity='OTHER-RECORD'
    if change=='scope':task.requestedScope='global'
    if change=='time':task.timeRange='last month';task.timeField='submission date'
    bind_analysis_evidence(plan,task,kb,sources)
    try:result=execute_analysis(plan,sources,kb,[],task=task)
    except PipelineError as exc:assert exc.code=='unrequested_row_output'
    else:assert not result['requirementsSatisfied']


@pytest.mark.parametrize('fault',['missing_component','duplicate_component','other_principal','missing_component_output','missing_scalar_receipt','array_as_snapshot','stale_capture'])
def test_three_component_summary_cannot_pass_with_one_panel_or_unverified_substitution(fault):
    task,plan,sources,kb,_=baseline_fixture()
    if fault=='missing_component':
        plan.requirementBindings=[b for b in plan.requirementBindings if not (b.requirementId=='attribute_0' and b.sourceId=='performance')]
    if fault=='duplicate_component':
        b=next(b for b in plan.requirementBindings if b.requirementId=='attribute_0' and b.sourceId=='performance')
        original=next(b for b in plan.requirementBindings if b.requirementId=='attribute_0' and b.sourceId=='overview')
        b.knowledgeBindingId=original.knowledgeBindingId;b.sourceId=original.sourceId;b.sourcePath=original.sourcePath;b.fields=list(original.fields);b.stepIds=list(original.stepIds)
    if fault=='other_principal':sources['performance']['principalScopeRef']='other'
    if fault=='missing_component_output':plan.steps[1].expose=False
    if fault=='missing_scalar_receipt':sources['performance']['fieldEvidence'].pop('/data/summary/overdueTasks')
    if fault=='array_as_snapshot':sources['performance']['data']['data']['summary']=[sources['performance']['data']['data']['summary']]
    if fault=='stale_capture':sources['performance']['observationRef']='old-capture'
    try:
        bind_analysis_evidence(plan,task,kb,sources)
        result=execute_analysis(plan,sources,kb,[],task=task)
    except PipelineError:
        return
    assert not result['requirementsSatisfied']


def test_individual_performance_definition_does_not_require_unrequested_panels():
    kb=loaded();facts=semantic_bindings(kb)
    individual=next(f for f in facts if f['knowledgeBindingId']=='admin.dashboard.license-performance.department#performance_metrics')
    assert 'summaryComponent' not in individual
    assert 'key metrics' not in individual['aliases']


def test_request_date_binding_cannot_override_fixed_parameters():
    _,_,sources,_,facts=baseline_fixture();fact=copy.deepcopy(facts['admin.dashboard.license-overview-panels#grain'])
    fact['contextParameters']['startDate']='2026-09-22'
    assert not _context_match(fact,sources['overview'])
