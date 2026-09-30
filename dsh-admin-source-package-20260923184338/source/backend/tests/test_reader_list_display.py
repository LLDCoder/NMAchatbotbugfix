import pytest
from app.reader_bindings import validate_list_display, applicable_bindings
from app.generic_reader import PipelineError
from app.generic_reader_contracts import Step
from test_reader_requirement_coverage import fixture


def make_list():
    task,plan,sources,knowledge=fixture();task.outputShape='list';task.requestedAttributes=['phase'];task.requestedMeasures=[];task.groupBy=[]
    plan.steps=plan.steps[:2]+[Step(id='shown',op='project',inputs=['entities'],fields=['phase'],label='Phase',role='detail',expose=True,evidence=[])]
    binding=next(b for b in plan.requirementBindings if b.requirementId=='object')
    plan.requirementBindings=[binding]
    for item in knowledge.items.values():
        for fact in (item.get('record') or {}).get('payload',{}).get('bindings',[]):
            if fact.get('kind')=='object':fact['displayFields']=['publicNumber']
    catalog={f['knowledgeBindingId']:f for f in applicable_bindings(knowledge,sources)}
    return task,plan,sources,catalog


def test_anonymous_value_list_is_rejected_with_documented_display_correction():
    task,plan,sources,catalog=make_list()
    with pytest.raises(PipelineError,match='analysis_list_display_missing') as e:
        validate_list_display(plan,task,catalog,sources)
    assert e.value.details['publicDisplayFields']==['publicNumber']
    assert plan.steps[-1].fields==['phase']
    plan.steps[0].fields.append('publicNumber');plan.steps[-1].fields.append('publicNumber')
    validate_list_display(plan,task,catalog,sources)


def test_display_label_must_exist_on_read_branch_not_only_final_projection():
    task,plan,sources,catalog=make_list();plan.steps[-1].fields.append('publicNumber')
    with pytest.raises(PipelineError,match='analysis_list_display_missing'):
        validate_list_display(plan,task,catalog,sources)


@pytest.mark.parametrize('shape',['detail','count','overview'])
def test_non_list_outputs_do_not_require_unrequested_entity_display(shape):
    task,plan,sources,catalog=make_list();task.outputShape=shape
    validate_list_display(plan,task,catalog,sources)
