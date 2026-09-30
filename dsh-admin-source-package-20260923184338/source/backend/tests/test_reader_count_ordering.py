"""A scalar count and its ordered detail share one verified row population."""
import pytest
from app.generic_reader import execute_analysis
from app.generic_reader_contracts import Step, RequirementBinding
from test_reader_ordering import ranking_fixture


def counted_ranking(values=(31, 34, 9)):
    task, plan, sources, kb = ranking_fixture(values)
    task.requestedMeasures = ['count']
    ref = plan.steps[0].evidence[0]
    plan.steps.append(Step(id='total', op='count', inputs=['entities'], role='total', label='Count', evidence=[ref]))
    sample = plan.requirementBindings[0].model_dump()
    sample.update(requirementId='measure_0', stepIds=['total'], knowledgeBindingId='', fields=['specimenKey'])
    plan.requirementBindings.append(RequirementBinding.model_validate(sample))
    return task, plan, sources, kb


def run(fixture):
    task, plan, sources, kb = fixture
    return execute_analysis(plan, sources, kb, [], task=task)


@pytest.mark.parametrize('projected',[False,True])
def test_count_and_ordered_details_of_identical_population_pass(projected):
    f=counted_ranking()
    if projected: project_public(f)
    result = run(f)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert next(o for o in result['outputs'] if o['id']=='total')['value']==3
    assert [r['score'] for r in next(o for o in result['outputs'] if o['role']=='detail')['value']]==[34,31,9]


@pytest.mark.parametrize('projected',[False,True])
def test_empty_identical_population_passes_without_inventing_rows(projected):
    f=counted_ranking(())
    if projected: project_public(f)
    result = run(f)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert next(o for o in result['outputs'] if o['id']=='total')['value']==0


@pytest.mark.parametrize('projected',[False,True])
@pytest.mark.parametrize('fault', ['wrong_order','no_sort','sample','bypass_identity','wrong_scope','different_filter'])
def test_ordering_exception_does_not_relax_other_evidence(fault,projected):
    f=counted_ranking();task,plan,sources,kb=f
    rank=next(s for s in plan.steps if s.id=='rank')
    total=next(s for s in plan.steps if s.id=='total')
    if fault=='wrong_order':rank.descending=False
    elif fault=='no_sort':
        rank.op='distinct';rank.fields=['specimenKey'];rank.field=''
    elif fault=='sample':rank.limit=1
    elif fault=='bypass_identity':total.inputs=['rows']
    elif fault=='wrong_scope':plan.context.scope='team'
    elif fault=='different_filter':
        plan.steps.insert(2,Step(id='subset',op='filter',inputs=['entities'],field='score',predicate='gt',operand=10,expose=False,label='subset',evidence=rank.evidence))
        rank.inputs=['subset']
    if projected: project_public(f)
    result=run(f)
    assert not result['requirementsSatisfied'], fault


def project_public(f):
    plan=f[1];rank=next(s for s in plan.steps if s.id=='rank');rank.expose=False
    plan.steps.append(Step(id='public',op='project',inputs=['rank'],fields=['specimenKey','score'],role='detail',label='Public details',evidence=rank.evidence))
