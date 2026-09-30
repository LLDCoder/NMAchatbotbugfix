import pytest
from app.generic_reader import execute_analysis, PipelineError
from app.generic_reader_contracts import Step
from app.reader_bindings import bind_analysis_evidence
from app.reader_plan_dependencies import prune_disconnected_steps, separate_public_fields
from test_reader_structural_field_proofs import setup


def test_disconnected_bad_projection_cannot_destroy_verified_outputs():
    task, plan, sources, knowledge = setup()
    plan.steps.append(Step(id='unused', op='read_rows', sourceId='queue', path='/not-an-array',
        fields=['unobserved'], expose=False, label='Synthetic unused branch', evidence=list(plan.steps[0].evidence)))
    corrections = []
    bind_analysis_evidence(plan, task, knowledge, sources, corrections=corrections)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied']
    assert any(x.get('removedStepIds') == ['unused'] for x in corrections)


@pytest.mark.parametrize('consumer', ['requirement', 'output', 'derived'])
def test_referenced_hidden_projection_must_still_fail_validation(consumer):
    task, plan, sources, knowledge = setup()
    step = Step(id='needed', op='read_rows', sourceId='queue', path='/not-an-array', fields=['unobserved'], expose=False, label='Synthetic unused branch', evidence=list(plan.steps[0].evidence))
    plan.steps.append(step)
    if consumer == 'requirement': plan.requirementBindings[0].stepIds.append('needed')
    if consumer == 'output': step.expose = True
    if consumer == 'derived': plan.steps[-2].inputs.append('needed')
    prune_disconnected_steps(plan)
    assert 'needed' in {s.id for s in plan.steps}
    with pytest.raises(PipelineError):
        bind_analysis_evidence(plan, task, knowledge, sources)
        execute_analysis(plan, sources, knowledge, [], task=task)


def test_page_public_column_is_not_a_second_identity_key():
    task, plan, sources, knowledge = setup()
    binding = next(b for b in plan.requirementBindings if b.requirementId == 'object')
    binding.fields.append('publicNumber')
    corrections = []
    bind_analysis_evidence(plan, task, knowledge, sources, corrections=corrections)
    assert binding.fields == ['specimenKey']
    assert execute_analysis(plan, sources, knowledge, [], task=task)['requirementsSatisfied']
    assert any(c['reason'] == 'public_columns_separated_from_identity_proof' for c in corrections)


@pytest.mark.parametrize('fields', [['publicNumber'], ['specimenKey', 'invented']])
def test_public_field_normalization_never_removes_unknown_dependencies_or_invents_missing_key(fields):
    _, plan, _, _ = setup()
    binding = plan.requirementBindings[0]; binding.fields = fields.copy()
    assert separate_public_fields(binding, {'kind': 'object', 'fields': ['specimenKey'],
        'displayFields': ['publicNumber']}, {'kind': 'object'}) is None
    assert binding.fields == fields
