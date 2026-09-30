"""Output format must not discard a fully bound snapshot attribute."""
import copy
import json
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.generic_reader import KnowledgeStore, PipelineError, execute_analysis
from app.generic_reader_contracts import TaskSpec, AnalysisPlan
from app.reader_bindings import bind_analysis_evidence, applicable_bindings
from app.reader_requirements import requirements_for, _semantic_match
from app.reader_snapshots import overview_component_requirements
from test_reader_snapshot_request_context import baseline_fixture

@pytest.mark.parametrize('language',['en','ar'])
def test_complete_snapshot_detail_retains_all_29_scalars_and_original_shape(language):
    task,plan,sources,kb,_=baseline_fixture(language)
    task.outputShape='detail'
    task_before=task.model_dump();sources_before=copy.deepcopy(sources)
    bind_analysis_evidence(plan,task,kb,sources)
    result=execute_analysis(plan,sources,kb,[],task=task)
    assert result['requirementsSatisfied'],result['requirementCoverage']
    assert len(result['outputs'])==3
    assert sum(len(o['value'][0]) for o in result['outputs'])==29
    assert task.model_dump()==task_before and sources==sources_before

@pytest.mark.parametrize('fault',[
    'missing_one','missing_two','duplicate','other_observation','other_principal',
    'wrong_object','wrong_grain','wrong_scope','record_identity','record_count',
    'grouping','list_shape','missing_metric_hash','changed_metric','missing_output',
])
def test_detail_shape_cannot_relax_component_entity_scope_or_scalar_proof(fault):
    task,plan,sources,kb,_=baseline_fixture();task.outputShape='detail'
    if fault in {'missing_one','missing_two'}:
        omitted={'performance'} if fault=='missing_one' else {'performance','license-distribution'}
        plan.requirementBindings=[b for b in plan.requirementBindings if not(b.requirementId=='attribute_0' and b.sourceId in omitted)]
    if fault=='duplicate':
        one=next(b for b in plan.requirementBindings if b.requirementId=='attribute_0')
        plan.requirementBindings.append(copy.deepcopy(one))
    if fault=='other_observation':sources['performance']['observationRef']='other'
    if fault=='other_principal':sources['performance']['principalScopeRef']='other'
    if fault=='wrong_object':task.businessObject='application'
    if fault=='wrong_grain':task.requestedGrain='application'
    if fault=='wrong_scope':task.requestedScope='global'
    if fault=='record_identity':task.recordIdentity='APP-123'
    if fault=='record_count':task.requestedMeasures=['count']
    if fault=='grouping':task.groupBy=['employee']
    if fault=='list_shape':task.outputShape='list'
    if fault=='missing_metric_hash':sources['performance']['fieldEvidence'].pop('/data/summary/overdueTasks')
    if fault=='changed_metric':sources['performance']['data']['data']['summary']['overdueTasks']=9191
    if fault=='missing_output':plan.steps[1].expose=False
    try:
        bind_analysis_evidence(plan,task,kb,sources)
        result=execute_analysis(plan,sources,kb,[],task=task)
    except PipelineError:return
    assert not result['requirementsSatisfied']

def original_fixture(language,draft=False):
    f=json.loads((Path(__file__).parent/'fixtures/d01-summary-round7'/f'{language}.json').read_text())
    kb=KnowledgeStore()
    folder=Path(__file__).parent/'fixtures/d01-summary-round7/knowledge' if draft else Path(__file__).parent/'fixtures/dashboard-snapshot/knowledge'
    for p in folder.glob('*.json'):
        kb.add({'chunks':[{'id':p.name,'content':p.read_text()}]})
    return f,kb

@pytest.mark.parametrize('attempt',[0,1])
def test_original_ar_task_and_plan_all_components_pass_without_shape_rewrite(attempt):
    f,kb=original_fixture('ar');task=TaskSpec.model_validate(f['task']);plan=AnalysisPlan.model_validate(f['plans'][attempt]);assert task.outputShape=='detail'
    before=task.model_dump();catalog={b['knowledgeBindingId']:b for b in applicable_bindings(kb,f['sources'])};reqs={r['id']:r for r in requirements_for(task)};bindings={}
    for b in plan.requirementBindings:bindings.setdefault(b.requirementId,[]).append(b)
    assert overview_component_requirements(task,reqs,bindings,catalog,f['sources'])=={'attribute_0'}
    assert task.model_dump()==before
    assert len(f['provenance']['scalarChecks'])==33 and not f['provenance']['businessAcceptance']

@pytest.mark.parametrize('language',['en','ar'])
@pytest.mark.parametrize('attempt',[0,1])
def test_original_plan_binds_with_exact_draft_alias_and_preserves_values(language,attempt):
    f,kb=original_fixture(language,True);task=TaskSpec.model_validate(f['task']);plan=AnalysisPlan.model_validate(f['plans'][attempt]);before_task=task.model_dump();before_sources=copy.deepcopy(f['sources'])
    bind_analysis_evidence(plan,task,kb,f['sources'],language=language)
    assert task.model_dump()==before_task and f['sources']==before_sources

@pytest.mark.parametrize('concept',[
    'key metrics displayed on the current Dashboard',
    'key indicators displayed on the current Dashboard',
    'المؤشرات الرئيسية المعروضة في لوحة المعلومات الحالية',
    'المؤشرات الأساسية المعروضة في لوحة المعلومات الحالية',
])
def test_explicit_current_dashboard_alias_matches_all_three_exact_components(concept):
    f,kb=original_fixture('en',True);task=TaskSpec.model_validate(f['task']);plan=AnalysisPlan.model_validate(f['plans'][0]);catalog={b['knowledgeBindingId']:b for b in applicable_bindings(kb,f['sources'])}
    for b in plan.requirementBindings:
        if b.requirementId=='attribute_0':assert _semantic_match(b,{'id':'attribute_0','kind':'attribute','value':concept},f['sources'][b.sourceId],catalog)

@pytest.mark.parametrize('concept',['all employees key metrics','other department key metrics','all dashboard business data','last month dashboard key metrics','dashboard forecast key metrics'])
def test_alias_does_not_strip_business_qualifiers(concept):
    f,kb=original_fixture('en',True);plan=AnalysisPlan.model_validate(f['plans'][0]);catalog={b['knowledgeBindingId']:b for b in applicable_bindings(kb,f['sources'])}
    for b in plan.requirementBindings:
        if b.requirementId=='attribute_0':assert not _semantic_match(b,{'id':'attribute_0','kind':'attribute','value':concept},f['sources'][b.sourceId],catalog)
