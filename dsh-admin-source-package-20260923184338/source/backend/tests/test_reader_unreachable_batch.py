"""Synthetic contracts reproduce the audited hidden-output topology, not live data."""
import pytest

from app.generic_reader import PipelineError, execute_analysis
from app.generic_reader_contracts import Step
from app.reader_bindings import bind_analysis_evidence
from test_reader_generic_completion import detail_fixture as original_detail_fixture


def detail_fixture():
    task, plan, sources, knowledge = original_detail_fixture()
    # The real rejected plans explicitly expose their read. Without this flag
    # the existing compiler hides consumed intermediates before reachability.
    plan.steps[0].expose = True
    return task, plan, sources, knowledge


def hidden(plan, name, op='distinct'):
    plan.steps.append(Step(id=name, op=op, inputs=['detail'], fields=['key'],
        label='Private identity transform', expose=False, evidence=plan.steps[0].evidence))


def expect_batch(task, plan, sources, knowledge):
    old_task = task.model_dump()
    old_topology = [(s.id, s.op, s.expose, list(s.inputs)) for s in plan.steps]
    with pytest.raises(PipelineError, match='requirement_output_unreachable') as error:
        bind_analysis_evidence(plan, task, knowledge, sources)
    assert task.model_dump() == old_task
    assert [(s.id, s.op, s.expose, list(s.inputs)) for s in plan.steps] == old_topology
    assert error.value.category == 'planning'
    return error.value.details


def test_one_hidden_distinct_reports_object_and_grain_together():
    task, plan, sources, knowledge = detail_fixture()
    hidden(plan, 'hidden_distinct')
    for binding in plan.requirementBindings[:2]: binding.stepIds = ['detail', 'hidden_distinct']
    details = expect_batch(task, plan, sources, knowledge)
    assert [b['requirementId'] for b in details['unreachableBindings']] == ['object', 'grain']
    assert all(b['unreachableStepIds'] == ['hidden_distinct'] for b in details['unreachableBindings'])
    assert details['requirementId'] == 'object'  # old diagnostic keys remain
    assert details['exposedOutputAncestors'] == {'detail': ['detail']}


def test_independent_hidden_steps_keep_their_own_requirement_mapping():
    task, plan, sources, knowledge = detail_fixture()
    hidden(plan, 'object_distinct'); hidden(plan, 'grain_project', 'project')
    plan.requirementBindings[0].stepIds = ['object_distinct']
    plan.requirementBindings[1].stepIds = ['grain_project']
    details = expect_batch(task, plan, sources, knowledge)
    assert [(b['requirementId'], b['unreachableStepIds']) for b in details['unreachableBindings']] == [
        ('object', ['object_distinct']), ('grain', ['grain_project'])]


def test_a_legal_hidden_transform_on_the_output_path_remains_valid():
    task, plan, sources, knowledge = detail_fixture()
    plan.steps[0].expose = False
    hidden(plan, 'distinct')
    plan.steps.append(Step(id='visible', op='project', inputs=['distinct'], fields=['color'],
        label='Color', role='detail', expose=True, evidence=plan.steps[0].evidence))
    for binding in plan.requirementBindings[:2]: binding.stepIds = ['distinct']
    plan.requirementBindings[-1].stepIds = ['visible']
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied']
    assert not next(s for s in plan.steps if s.id == 'distinct').expose


def test_attribute_cannot_use_a_disconnected_parent_key_as_its_value():
    task, plan, sources, knowledge = detail_fixture()
    plan.steps.append(Step(id='parent_key', op='read_rows', sourceId='detail', path='/data',
        fields=['key'], label='Parent key', expose=False, evidence=plan.steps[0].evidence))
    plan.requirementBindings[-1].stepIds = ['parent_key']
    details = expect_batch(task, plan, sources, knowledge)
    assert [(b['requirementId'], b['unreachableStepIds']) for b in details['unreachableBindings']] == [
        ('attribute_0', ['parent_key'])]


def test_all_unreachable_requirements_are_reported_before_other_binding_errors():
    task, plan, sources, knowledge = detail_fixture()
    hidden(plan, 'hidden_distinct')
    plan.requirementBindings[0].stepIds = ['hidden_distinct']
    # A bad semantic binding must not mask another independent reachability gap.
    plan.requirementBindings[1].knowledgeBindingId = 'missing.definition'
    plan.requirementBindings[1].stepIds = ['hidden_distinct']
    details = expect_batch(task, plan, sources, knowledge)
    assert [b['requirementId'] for b in details['unreachableBindings']] == ['object', 'grain']


def test_reachability_repair_still_runs_the_unchanged_semantic_validation():
    task, plan, sources, knowledge = detail_fixture()
    plan.requirementBindings[1].knowledgeBindingId = 'missing.definition'
    with pytest.raises(PipelineError, match='analysis_binding_inapplicable'):
        bind_analysis_evidence(plan, task, knowledge, sources)
