import copy
import json
from pathlib import Path

import pytest
from app.generic_reader import execute_analysis, PipelineError
from app.generic_reader_contracts import AnalysisPlan, TaskSpec
from app.reader_bindings import applicable_bindings, bind_analysis_evidence
from app.reader_plan_dependencies import assemble_snapshot_binding
from app.reader_requirements import requirements_for
from test_reader_snapshot_request_context import baseline_fixture, loaded


def mismatch_fixture():
    task, plan, sources, knowledge, _ = baseline_fixture()
    for b in plan.requirementBindings:
        if b.requirementId not in {'object', 'grain'}:
            continue
        if b.sourceId == 'overview':
            b.fields = b.fields[:13]
        if b.sourceId == 'license-distribution':
            b.fields = list(plan.steps[2].fields)
    return task, plan, sources, knowledge


def assemble_first(task, plan, sources, knowledge, mutate=None):
    catalog = {f['knowledgeBindingId']: f for f in applicable_bindings(knowledge, sources)}
    requirements = {r['id']: r for r in requirements_for(task)}
    binding = plan.requirementBindings[0]
    if mutate:
        mutate(catalog, requirements, binding)
    before = binding.model_dump()
    correction = assemble_snapshot_binding(binding, plan, task, catalog, requirements, sources)
    return correction, before, binding


def test_existing_complete_reads_compile_metadata_without_changing_values_or_projection():
    task, plan, sources, knowledge = mismatch_fixture()
    before_steps = [s.model_dump() for s in plan.steps]
    before_sources = copy.deepcopy(sources)
    corrections = []
    bind_analysis_evidence(plan, task, knowledge, sources, corrections=corrections)
    assert len([c for c in corrections if c['reason'] == 'unique_observed_snapshot_binding_fields_assembled']) == 4
    assert sources == before_sources
    assert [(s.fields, s.sourceId, s.path) for s in plan.steps] == [
        (s['fields'], s['sourceId'], s['path']) for s in before_steps]
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied']
    assert len(result['outputs']) == 3
    assert sum(len(o['value'][0]) for o in result['outputs']) == 29


@pytest.mark.parametrize('fault', [
    'wrong_id', 'wrong_path', 'wrong_source', 'wrong_operation', 'ambiguous_definition',
    'ambiguous_grain', 'wrong_concept', 'not_singleton', 'unknown_extra', 'unread_required',
    'missing_receipt', 'changed_value', 'wrong_context', 'missing_principal', 'different_read_source',
    'missing_step', 'requested_record', 'requested_count', 'array', 'attribute_requirement',
])
def test_unsafe_or_ambiguous_mapping_is_not_repaired(fault):
    task, plan, sources, knowledge = mismatch_fixture()
    source = sources['overview']
    binding = plan.requirementBindings[0]
    if fault == 'wrong_id': binding.knowledgeBindingId = 'unknown#object'
    if fault == 'wrong_path': binding.sourcePath = '/other'
    if fault == 'wrong_source': binding.sourceId = 'performance'
    if fault == 'wrong_operation': source['operationRef'] = 'GET /other'
    if fault == 'unknown_extra': binding.fields.append('invented')
    if fault == 'unread_required': plan.steps[0].fields = plan.steps[0].fields[:13]
    if fault == 'missing_receipt': source['fieldEvidence'].pop('/data/serviceApplicationCard/totalCount')
    if fault == 'changed_value': source['data']['data']['serviceApplicationCard']['totalCount'] = 7654321
    if fault == 'wrong_context': source['collectionContext']['parameterHashes']['scope'] = 'bad'
    if fault == 'missing_principal': source['principalScopeRef'] = ''
    if fault == 'different_read_source': plan.steps[0].sourceId = 'performance'
    if fault == 'missing_step': binding.stepIds = ['missing']
    if fault == 'requested_record': task.recordIdentity = 'OTHER'
    if fault == 'requested_count': task.requestedMeasures = ['count']
    if fault == 'array': source['data']['data'] = [source['data']['data']]
    def mutate(catalog, requirements, binding):
        if fault in {'ambiguous_definition', 'ambiguous_grain'}:
            key = binding.knowledgeBindingId if fault == 'ambiguous_definition' else binding.knowledgeBindingId.replace('#object', '#grain')
            duplicate = copy.deepcopy(catalog[key]); duplicate['knowledgeBindingId'] += '_other'
            catalog[duplicate['knowledgeBindingId']] = duplicate
        if fault == 'wrong_concept': requirements['object']['value'] = 'different entity'
        if fault == 'not_singleton':
            catalog[binding.knowledgeBindingId.replace('#object', '#grain')].pop('observationShape')
        if fault == 'attribute_requirement': requirements['object']['kind'] = 'attribute'
    correction, before, binding = assemble_first(task, plan, sources, knowledge, mutate)
    assert correction is None
    assert binding.model_dump() == before


@pytest.mark.parametrize('fault', ['other_principal', 'old_observation', 'missing_component'])
def test_normalization_cannot_satisfy_a_broken_multi_panel_proof(fault):
    task, plan, sources, knowledge = mismatch_fixture()
    if fault == 'other_principal': sources['performance']['principalScopeRef'] = 'other'
    if fault == 'old_observation': sources['performance']['observationRef'] = 'old'
    if fault == 'missing_component': plan.requirementBindings = [
        b for b in plan.requirementBindings if not (b.requirementId == 'attribute_0' and b.sourceId == 'performance')]
    bind_analysis_evidence(plan, task, knowledge, sources)
    with pytest.raises(PipelineError) as failure:
        execute_analysis(plan, sources, knowledge, [], task=task)
    assert failure.value.code == ('requirement_binding_invalid' if fault == 'other_principal'
                                  else 'overview_components_incomplete')


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('attempt', [0, 1])
def test_actual_rejected_plan_field_assembly_replay(language, attempt):
    fixture = json.loads((Path(__file__).parent / 'fixtures/snapshot-binding-assembly' / (language + '.json')).read_text())
    task = TaskSpec.model_validate(fixture['task'])
    plan = AnalysisPlan.model_validate(fixture['plans'][attempt])
    sources, knowledge = fixture['sources'], loaded()
    before_steps = [s.model_dump() for s in plan.steps]
    corrections = []
    bind_analysis_evidence(plan, task, knowledge, sources, language=language, corrections=corrections)
    assert any(c['reason'] == 'unique_observed_snapshot_binding_fields_assembled' for c in corrections)
    assert [(s.id, s.sourceId, s.path, s.fields, s.inputs) for s in plan.steps] == [
        (s['id'], s['sourceId'], s['path'], s['fields'], s['inputs']) for s in before_steps]
    # This is an actual-plan contract replay, not a fresh page read or business acceptance.
    assert fixture['provenance']['businessAcceptance'] is False
