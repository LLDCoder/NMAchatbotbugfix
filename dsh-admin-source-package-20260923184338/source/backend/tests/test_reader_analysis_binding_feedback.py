"""Actual EN/AR rejected plans; controlled next plans are not live counterfactual QA."""
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
import ast
import asyncio
import json
import time

import pytest

import app.generic_reader as generic_module
from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError, execute_analysis, pointer, row_scalar
from app.generic_reader_contracts import AnalysisPlan, TaskSpec, Citation
from app.reader_bindings import applicable_bindings, bind_analysis_evidence
from app.reader_collection import projection_hash
from app.reader_requirements import requirements_for, semantic_bindings

FIXTURE_PATH = Path(__file__).with_name('fixtures') / 'd02_analysis_feedback_v39.json'
RAW = json.loads(FIXTURE_PATH.read_text())


def loaded():
    knowledge = KnowledgeStore()
    for p in (Path(generic_module.__file__).parents[2] / 'artifacts/KB/pages/admin/dashboard').glob('*.json'):
        knowledge.add({'chunks': [{'id': p.name, 'content': p.read_text()}]})
    knowledge.prompt()
    return knowledge


def fixture(language='en', attempt=0):
    f = deepcopy(RAW['languages'][language])
    return (TaskSpec.model_validate(f['task']), AnalysisPlan.model_validate(f['rejectedPlans'][attempt]['candidate']),
            f['sources'], loaded())


def instruction():
    tree = ast.parse(Path(generic_module.__file__).read_text())
    call = next(n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
                and n.func.attr == 'structured' and len(n.args) > 1 and isinstance(n.args[0], ast.Name)
                and n.args[0].id == 'AnalysisPlan')
    return ast.literal_eval(call.args[1])


def corrected_partial(language='en', *, empty_metadata=True):
    """Hand-written next plan: valid current panels; no false comparison binding."""
    task, plan, sources, knowledge = fixture(language, 1)
    removed = {s.id for s in plan.steps if 'trend' in s.id}
    plan.steps = [s for s in plan.steps if s.id not in removed]
    plan.requirementBindings = [b for b in plan.requirementBindings
        if b.requirementId not in {'attribute_1', 'attribute_2'} and not set(b.stepIds) & removed]
    catalog = {f['knowledgeBindingId']: f for f in semantic_bindings(knowledge)}
    for binding in plan.requirementBindings:
        if binding.knowledgeBindingId:
            fact = catalog[binding.knowledgeBindingId]
            binding.sourcePath = '' if empty_metadata else fact['sourcePath']
            binding.fields = [] if empty_metadata else list(fact['fields'])
            binding.evidence = []
    # Controlled next-planner content, not automatic production rewriting.
    # Cite each actual panel definition, and the separate comparison boundary.
    def passage(record, text):
        return next(pid for pid, (key, body) in knowledge.passages.items()
            if knowledge.items[key].get('recordId') == record and text in body)
    overview = passage('admin.dashboard.license-overview-panels', 'Each panel has its own population')
    performance = passage('admin.dashboard.license-performance.department', 'Each panel has its own population')
    distribution = passage('admin.dashboard.license-distribution', 'Each panel has its own population')
    comparison = passage('admin.dashboard.interpretation-and-action-boundaries', 'A yesterday or last-week comparison')
    current_scope = passage('admin.dashboard.interpretation-and-action-boundaries', 'A Dashboard summary belongs')
    missing_value = passage('admin.dashboard.license-overview-panels', 'A missing field is unavailable, not zero')
    refs = [overview, performance, distribution]
    claims = {
        'grain': (('Each panel keeps its own population and time basis; these are not one record collection.',
                   'تحتفظ كل لوحة بمجتمعها وأساسها الزمني؛ ولا تمثل اللوحات مجموعة سجلات واحدة.'), refs),
        'population': (('The current overview, performance and distribution panels, with their separate populations.',
                        'لوحات الملخص والأداء والتوزيع الحالية، مع احتفاظ كل منها بمجتمعها المنفصل.'), refs),
        'filterScope': (('The authenticated workspace, rendered role view and applied date filter; these do not establish a common personal or team population.',
                         'مساحة العمل المصادق عليها وعرض الدور ومرشح التاريخ المطبق؛ ولا تثبت هذه السياقات مجتمعاً شخصياً أو جماعياً موحّداً.'), [current_scope, overview]),
        'time': (('Comparable periods for the requested changes are not verified.',
                  'لم يتم التحقق من فترات قابلة للمقارنة للتغيّرات المطلوبة.'), [comparison]),
    }
    for key, (texts, citations) in claims.items():
        getattr(plan.context, key).value = texts[language == 'ar']
        getattr(plan.context, key).evidence = [Citation(sourceId=ref) for ref in citations]
    # A multi-panel result is not proof of one team scope. Preserve the task,
    # keep the planner's unsupported combined scope unknown, and cite no grant.
    plan.context.scope = 'unknown'
    plan.context.scopeEvidence = []
    raw = plan.model_dump()
    raw['context']['caveats'] = [{
        'value': ('A current metric and a completed-task trend are not the same measure; missing data is not zero.' if language == 'en' else 'المؤشر الحالي واتجاه المهام المكتملة ليسا المقياس نفسه؛ البيانات المفقودة ليست صفراً.'),
        'evidence': [{'sourceId': comparison}, {'sourceId': missing_value}]}]
    if language == 'ar':
        for step in plan.steps:
            if step.op != 'project': continue
            parent = next(p for p in plan.steps if p.id == step.inputs[0])
            raw['requirementBindings'].append({'requirementId': 'detail', 'sourceId': parent.sourceId,
                'sourcePath': parent.path, 'fields': list(step.fields), 'stepIds': [step.id],
                'knowledgeBindingId': '', 'evidence': [c.model_dump() for c in parent.evidence]})
    return task, AnalysisPlan.model_validate(raw), sources, knowledge


def validate(f):
    task, plan, sources, knowledge = f
    bind_analysis_evidence(plan, task, knowledge, sources)
    return execute_analysis(plan, sources, knowledge, [], task=task)


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_saved_source_bodies_match_actual_used_scalar_hashes(language):
    task, plan, sources, knowledge = fixture(language, 1)
    checked = 0
    for step in plan.steps:
        if step.op != 'read_rows': continue
        source = sources[step.sourceId]; value = pointer(source['data'], step.path)
        rows = value if isinstance(value, list) else [value]
        for i, row in enumerate(rows):
            for field in step.fields:
                path = step.path + (f'/{i}' if isinstance(value, list) else '') + '/' + field.replace('.', '/')
                assert source['fieldEvidence'][path]['status'] == 'complete'
                assert source['fieldEvidence'][path]['valueHash'] == projection_hash(row_scalar(row, field))
                checked += 1
    assert checked == 50  # 19 overview + 4 performance + 6 distribution + 7 x 3 trend
    assert RAW['freshQA'] is False


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('attempt', [0, 1])
def test_actual_rejected_plan_diagnostic_identifies_exact_binding_source_and_kind(language, attempt):
    task, plan, sources, knowledge = fixture(language, attempt)
    before_task = task.model_dump(); before_sources = deepcopy(sources)
    with pytest.raises(PipelineError) as error:
        bind_analysis_evidence(plan, task, knowledge, sources)
    actual = json.loads(RAW['languages'][language]['rejectedPlans'][attempt]['failure'])
    e = error.value; d = e.details
    assert e.code == actual['code'] == 'analysis_binding_inapplicable'
    location = d['bindingLocation']
    binding = plan.requirementBindings[location['requirementBindingIndex']]
    assert location['knowledgeBindingId'] == binding.knowledgeBindingId
    assert location['sourceId'] == binding.sourceId and location['stepIds'] == binding.stepIds
    assert d['selectedDefinition']['knowledgeBindingId'] == binding.knowledgeBindingId
    assert d['requestedKind'] == 'object'
    assert d['actualOperationRef'] == sources[binding.sourceId]['operationRef']
    if attempt == 1:
        assert d['selectedDefinition']['concept'] == 'dashboard trend'
        assert d['requestedConcept'].casefold() == 'dashboard'
        assert d['matchingBindingIds'] == []
    else:
        assert d['providedFields'] != d['selectedDefinition']['fields']
    assert task.model_dump() == before_task and sources == before_sources


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('empty_metadata', [True, False])
def test_valid_current_outputs_survive_but_original_comparisons_remain_unfulfilled(language, empty_metadata):
    f = corrected_partial(language, empty_metadata=empty_metadata)
    task, plan, sources, knowledge = f
    task_before = task.model_dump(); sources_before = deepcopy(sources)
    result = validate(f)
    assert task.model_dump() == task_before == RAW['languages'][language]['task']
    assert sources == sources_before
    coverage = {r['id']: r for r in result['requirementCoverage']}
    assert coverage['object']['status'] == coverage['grain']['status'] == coverage['attribute_0']['status'] == 'satisfied'
    assert coverage['attribute_1']['status'] == coverage['attribute_2']['status'] == 'unfulfilled'
    assert {r['id'] for r in requirements_for(task)} == set(coverage)
    if language == 'ar': assert coverage['detail']['status'] == 'satisfied'
    assert not result['requirementsSatisfied']
    assert {'yesterday_comparison_series', 'last_week_comparison_series'} <= set(result['missing'])
    assert len(result['outputs']) == 3 and sum(len(o['value'][0]) for o in result['outputs']) == 29
    assert all(o.get('role') == 'detail' for o in result['outputs'])
    for output in result['outputs']:
        projected=next(s for s in plan.steps if s.id==output['id'])
        read=next(s for s in plan.steps if s.id==projected.inputs[0])
        source=sources[read.sourceId]; row=pointer(source['data'],read.path)
        assert set(output['value'][0])==set(projected.fields)
        for field,value in output['value'][0].items():
            assert value==row_scalar(row,field)
            path=read.path+'/'+field.replace('.','/')
            assert source['fieldEvidence'][path]['valueHash']==projection_hash(value)
    assert not any(b.requirementId in {'attribute_1', 'attribute_2'} for b in plan.requirementBindings)
    assert 'zero' in plan.context.caveats[0].value if language == 'en' else 'صفراً' in plan.context.caveats[0].value


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('attempt', [0, 1])
def test_controlled_correction_consumes_targeted_feedback_within_original_budget(language, attempt):
    task, bad, sources, knowledge = fixture(language, attempt)
    _, repaired, _, _ = corrected_partial(language)
    calls = []; result_box = {}
    class Planner:
        async def generic_reader_json(self, **kwargs):
            calls.append(deepcopy(kwargs))
            if len(calls) == 1: return bad.model_dump()
            feedback = json.loads(kwargs['correction'])
            # A controlled next plan uses the new exact locator. This does not
            # assert that a real model would choose the same next proposal.
            if not feedback.get('bindingLocation') or not feedback.get('selectedDefinition'):
                return bad.model_dump()
            location = feedback['bindingLocation']; original = bad.requirementBindings[location['requirementBindingIndex']]
            assert location['sourceId'] == original.sourceId and location['knowledgeBindingId'] == original.knowledgeBindingId
            assert kwargs['data']['task'] == task.model_dump()
            assert kwargs['data']['priorValidationConstraints'][-1] == feedback
            return repaired.model_dump()
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 30; reader.response_language = language
    reader.knowledge = knowledge
    def check(plan):
        bind_analysis_evidence(plan, task, knowledge, sources)
        result_box['value'] = execute_analysis(plan, sources, knowledge, [], task=task)
    data = {'task': task.model_dump(), 'requirements': requirements_for(task), 'sources': sources,
            'semanticBindings': applicable_bindings(knowledge, sources)}
    accepted = asyncio.run(reader.structured(AnalysisPlan, instruction(), data, check))
    assert len(calls) == 2 and len(reader.recovery) == 1
    assert reader.audit['plans']['AnalysisPlan'] == accepted.model_dump()
    assert not result_box['value']['requirementsSatisfied']
    assert len(result_box['value']['outputs']) == 3
    assert task.model_dump() == RAW['languages'][language]['task']
    assert len(reader.audit['rejectedPlans']) == 1
    assert calls[0]['schema'] == calls[1]['schema']


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_unchanged_bad_plan_still_stops_after_repeated_same_error(language):
    task, bad, sources, knowledge = fixture(language, 1);calls=[]
    class Planner:
        async def generic_reader_json(self, **kwargs):calls.append(kwargs);return bad.model_dump()
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://portal.test')
    reader.deadline=time.monotonic()+30;reader.response_language=language
    def check(plan):bind_analysis_evidence(plan,task,knowledge,sources)
    with pytest.raises(PipelineError,match='analysis_binding_inapplicable'):
        asyncio.run(reader.structured(AnalysisPlan,instruction(),{'task':task.model_dump(),'sources':sources,
            'requirements':requirements_for(task),'semanticBindings':applicable_bindings(knowledge,sources)},check))
    assert len(calls)==2 and len(reader.recovery)==1 and len(reader.audit['rejectedPlans'])==2


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('target', ['attribute_1','attribute_2'])
@pytest.mark.parametrize('fact_suffix', ['completed_count','bucket_label'])
def test_raw_measure_or_period_never_satisfies_comparison_even_with_exact_empty_metadata(language,target,fact_suffix):
    task, plan, sources, knowledge = fixture(language,1)
    selected=next(b for b in plan.requirementBindings if b.requirementId==target)
    selected.knowledgeBindingId='admin.dashboard.license-historical-series#'+fact_suffix
    selected.sourcePath='';selected.fields=[]
    # Isolate this actual requested comparison, while leaving task untouched.
    plan.requirementBindings=[selected]
    with pytest.raises(PipelineError) as error:bind_analysis_evidence(plan,task,knowledge,sources)
    assert error.value.code=='analysis_binding_inapplicable'
    assert error.value.details['requestedKind']=='attribute'
    assert error.value.details['matchingBindingIds']==[]
    assert error.value.details['selectedDefinition']['concept'] in {'completed task count','period'}


@pytest.mark.parametrize('mutation', ['operation','path','kind','concept','missing_field','extra_field','unknown_binding','unknown_source'])
def test_targeted_diagnostic_does_not_relax_any_original_binding_guard(mutation):
    task,plan,sources,knowledge=corrected_partial();binding=plan.requirementBindings[0]
    binding.sourcePath='/data';binding.fields=['not-a-dependency']
    if mutation=='operation':sources[binding.sourceId]['operationRef']='GET /api/other'
    elif mutation=='path':binding.sourcePath='/other'
    elif mutation=='kind':binding.knowledgeBindingId=binding.knowledgeBindingId.replace('#object','#key_metrics');binding.fields=[]
    elif mutation=='concept':task.businessObject='another entity';binding.fields=[]
    elif mutation=='missing_field':
        binding.fields=['taskTabCounts.ServiceApplication']
        # A partial declaration can be safely compiled only if the real read
        # already proves the whole snapshot; remove that precondition too.
        next(s for s in plan.steps if s.op=='read_rows' and s.sourceId==binding.sourceId).fields=binding.fields[:]
    elif mutation=='extra_field':binding.fields=['invented']
    elif mutation=='unknown_binding':binding.knowledgeBindingId='not-present#object'
    elif mutation=='unknown_source':binding.sourceId='not-present'
    with pytest.raises(PipelineError):bind_analysis_evidence(plan,task,knowledge,sources)


@pytest.mark.parametrize('fault', ['owner','record','scope','time','missing_scalar_hash','changed_scalar','missing_panel'])
def test_preserving_current_outputs_never_turns_unproven_conditions_into_success(fault):
    task,plan,sources,knowledge=corrected_partial()
    if fault=='owner':list(sources.values())[1]['principalScopeRef']='other'
    elif fault=='record':task.recordIdentity='OTHER'
    elif fault=='scope':task.requestedScope='global'
    elif fault=='time':task.timeRange='last month';task.timeField='submission date'
    elif fault=='missing_scalar_hash':next(s for s in sources.values() if s['operationRef'].endswith('/performance'))['fieldEvidence'].pop('/data/summary/overdueTasks')
    elif fault=='changed_scalar':next(s for s in sources.values() if s['operationRef'].endswith('/performance'))['data']['data']['summary']['overdueTasks']=999
    elif fault=='missing_panel':plan.requirementBindings=[b for b in plan.requirementBindings if not(b.requirementId=='attribute_0' and 'performance' in b.knowledgeBindingId)]
    try:result=validate((task,plan,sources,knowledge))
    except PipelineError:return
    assert not result['requirementsSatisfied']
    if fault in {'record','scope','time'}:
        assert any(x['status']=='unfulfilled' and x['kind'] in {'record','scope','time'} for x in result['requirementCoverage'])


def test_original_private_read_dependency_closure_remains_receipt_bound():
    task,plan,sources,knowledge=corrected_partial()
    read=plan.steps[0]; assert read.op=='read_rows' and not read.expose
    read.fields=[]
    result=validate((task,plan,sources,knowledge))
    assert len(read.fields)==19  # Existing private closure, not this feedback patch.
    assert sum(len(o['value'][0]) for o in result['outputs'])==29
    assert not result['requirementsSatisfied']
    assert {'yesterday_comparison_series','last_week_comparison_series'}<=set(result['missing'])


@pytest.mark.parametrize('fault',['missing_receipt','wrong_scalar'])
def test_empty_private_read_cannot_restore_unproved_panel_dependencies(fault):
    task,plan,sources,knowledge=corrected_partial()
    read=plan.steps[0];read.fields=[];source=sources[read.sourceId]
    if fault=='missing_receipt':source['fieldEvidence'].pop('/data/serviceApplicationCard/totalCount')
    else:source['data']['data']['serviceApplicationCard']['totalCount']=999
    try:result=validate((task,plan,sources,knowledge))
    except PipelineError:return
    assert not result['requirementsSatisfied']
    coverage={r['id']:r for r in result['requirementCoverage']}
    assert coverage['attribute_0']['status']!='satisfied'


def test_targeted_feedback_does_not_include_response_values_credentials_or_reason():
    task,plan,sources,knowledge=fixture('en',1)
    for s in sources.values():s['headers']={'Authorization':'CONTROLLED-TOKEN'};s['secret']='CONTROLLED-SECRET'
    plan.requirementBindings[3].reason='CONTROLLED-MODEL-REASON'
    with pytest.raises(PipelineError) as error:bind_analysis_evidence(plan,task,knowledge,sources)
    feedback=json.dumps(error.value.details)
    assert all(x not in feedback for x in ['CONTROLLED-TOKEN','CONTROLLED-SECRET','CONTROLLED-MODEL-REASON','headers','valueHash','dataPoints/0'])
    assert error.value.details['actualOperationRef']=='GET /api/license/dashboard/performance-trend'
