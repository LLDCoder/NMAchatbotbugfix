import pytest
from app.generic_reader import execute_analysis, PipelineError
from app.reader_bindings import bind_analysis_evidence
from test_reader_structural_field_proofs import setup


def test_internal_identity_stays_in_lineage_while_public_reference_is_returned():
    task, plan, sources, knowledge = setup()
    plan.steps[-1].fields.insert(0, 'specimenKey')
    corrections = []
    bind_analysis_evidence(plan, task, knowledge, sources, corrections=corrections)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert all('specimenKey' not in row and row['publicNumber'] for out in result['outputs'] for row in out['value'])
    assert 'specimenKey' in plan.steps[0].fields
    assert 'specimenKey' in plan.steps[1].fields
    assert corrections[0]['reason'] == 'page_public_reference_projection'


def test_no_public_reference_cannot_substitute_internal_key():
    task, plan, sources, knowledge = setup()
    plan.steps[-1].fields = ['specimenKey', 'phase']
    with pytest.raises(PipelineError, match='analysis_public_reference_required'):
        bind_analysis_evidence(plan, task, knowledge, sources)


def test_no_declared_public_reference_does_not_guess_from_column_name():
    task, plan, sources, knowledge = setup()
    plan.steps[-1].fields.insert(0, 'specimenKey')
    for item in knowledge.items.values():
        for fact in (item.get('record') or {}).get('payload', {}).get('bindings', []):
            fact.pop('displayFields', None)
    before = list(plan.steps[-1].fields)
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert plan.steps[-1].fields == before


def test_unmapped_columns_remain_unverified_after_identity_projection():
    task, plan, sources, knowledge = setup(True)
    plan.steps[-1].fields.insert(0, 'specimenKey')
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert not execute_analysis(plan, sources, knowledge, [], task=task)['requirementsSatisfied']
