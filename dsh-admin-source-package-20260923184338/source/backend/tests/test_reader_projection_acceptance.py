import copy
import pytest
from app.generic_reader import execute_analysis
from app.reader_projection_acceptance import resolve_unused_projection_gaps
from test_reader_requirement_coverage import fixture


def setup():
    task, plan, sources, knowledge = fixture()
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied'] and not result['missing']
    excluded = [{'sourceId': 'queue', 'fields': ['unusedDisplay'], 'reason': 'collection_field_semantics_missing'}]
    return plan, result, sources, ['collection_field_semantics_missing'], excluded


def test_complete_computation_resolves_only_its_unused_optional_projection_warning():
    args = setup(); before = copy.deepcopy(args[1])
    missing, resolutions = resolve_unused_projection_gaps(*args)
    assert missing == [] and resolutions[0]['excluded'][0]['fields'] == ['unusedDisplay']
    assert args[1] == before


@pytest.mark.parametrize('fault', ['used_field', 'used_binding', 'unsatisfied', 'no_requirements',
    'other_missing', 'plan_missing', 'bounded_output', 'no_provenance', 'collection_failure',
    'unselected_source', 'no_exclusion', 'empty_fields'])
def test_exclusion_cannot_waive_missing_requirements_or_incomplete_data(fault):
    plan, result, sources, missing, excluded = setup()
    if fault == 'used_field': plan.steps[0].fields.append('unusedDisplay')
    if fault == 'used_binding': plan.requirementBindings[0].fields.append('unusedDisplay')
    if fault == 'unsatisfied': result['requirementCoverage'][0]['status'] = 'unfulfilled'
    if fault == 'no_requirements': result['requirementCoverage'] = []
    if fault == 'other_missing': result['missing'] = ['another_gap']
    if fault == 'plan_missing': plan.missing = ['collection_field_semantics_missing']
    if fault == 'bounded_output': result['outputs'][0]['evidence'][0]['completeness'] = 'bounded'
    if fault == 'no_provenance': result['outputs'][0]['evidence'] = []
    if fault == 'collection_failure': sources['queue']['collectionFailure'] = 'timeout'
    if fault == 'unselected_source': excluded[0]['sourceId'] = 'other'
    if fault == 'no_exclusion': excluded = []
    if fault == 'empty_fields': excluded[0]['fields'] = []
    remaining, resolved = resolve_unused_projection_gaps(plan, result, sources, missing, excluded)
    assert remaining == missing and not resolved


def test_other_collection_failure_codes_remain_even_if_unused_projection_resolves():
    args = setup(); args[3].append('collection_pagination_incomplete')
    remaining, resolved = resolve_unused_projection_gaps(*args)
    assert remaining == ['collection_pagination_incomplete'] and resolved
