"""Retain exact captured tasks while accepting equivalent procedural grammar."""
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.generic_reader import PipelineError
from app.generic_reader_contracts import EvidenceExplanation, TaskSpec
from app.reader_evidence_explanation import partition, validate_declarations, merge_results
from app.reader_requirements import requirements_for


CAPTURED = json.loads((Path(__file__).parent/'fixtures/evidence_guidance_b11_v31_en.json').read_text())
AR_CAPTURED = json.loads((Path(__file__).parent/'fixtures/evidence_guidance_b11_v31_ar.json').read_text())


@pytest.mark.parametrize('index', [0, 1])
def test_both_captured_tasks_keep_all_original_requirements_and_can_partition(index):
    task = TaskSpec.model_validate(CAPTURED['rejectedCandidates'][index])
    before = task.model_dump()
    assignment = partition(task, CAPTURED['question'], CAPTURED['question'])
    assert assignment is not None
    assert task.model_dump() == before
    assert assignment['liveTask'].requestedAttributes == ['status']
    assert assignment['knowledgeTask'].requestedAttributes == [
        'status', 'documented procedure to refresh or verify a conflicting status']
    assert assignment['knowledgeMap']['attribute_1'] == 'attribute_3'
    assert assignment['originalTask'].requestedAttributes == before['requestedAttributes']
    # Validating a responsibility never proves the guidance or the live value.
    analysis = {'outputs': [], 'requirementCoverage': [], 'requirementsSatisfied': False, 'missing': []}
    merged = merge_results(assignment, analysis, {}, 'principal', [], 'en', {'coverage': [], 'blocks': []})
    assert not merged['requirementsSatisfied']
    assert set(merged['missing']) == {r['id'] for r in requirements_for(task)}


def task_for(label, quote='tell me how to refresh or verify the discrepancy'):
    task = TaskSpec.model_validate(CAPTURED['rejectedCandidates'][0])
    task.requestedAttributes[-1] = label
    task.evidenceExplanations[-1] = EvidenceExplanation(attribute=label,
        kind='knowledge_guidance', questionQuote=quote)
    task.slotUpdates = []
    return task


@pytest.mark.parametrize('label', [
    'procedure to refresh the page', 'instructions for refreshing the page',
    'instructions to verify a discrepancy', 'steps to verify the displayed status',
    'documented procedure for verifying a discrepancy', 'documented steps to refresh the page',
    'documented instructions for refreshing the page'])
def test_equivalent_procedural_heads_retain_the_exact_attribute_and_quote(label):
    task = task_for(label); before = task.model_dump()
    validate_declarations(task, CAPTURED['question'])
    assert task.model_dump() == before


@pytest.mark.parametrize('label', [
    'documented procedure status', 'payment procedure completion status',
    'documented procedure completion date', 'documented procedure payment amount',
    'procedure status', 'amount for procedure', 'procedure last updated time',
    'status of documented procedure to refresh', 'documented procedure',
    'documented procedure to', 'documented instructions',
])
def test_business_values_and_incomplete_heads_are_not_newly_accepted(label):
    with pytest.raises(PipelineError, match='evidence_guidance_meaning_unverified'):
        validate_declarations(task_for(label), CAPTURED['question'])


@pytest.mark.parametrize('quote', ['invented user guidance', 'tell me the current payment amount'])
def test_procedural_label_does_not_waive_original_question_quote(quote):
    with pytest.raises(PipelineError, match='evidence_explanation_quote_invalid'):
        validate_declarations(task_for('documented procedure to refresh', quote), CAPTURED['question'])


def test_grammar_change_does_not_reassign_the_live_status():
    task = task_for('documented procedure to refresh')
    task.evidenceExplanations[-1].attribute = 'status'
    with pytest.raises(PipelineError, match='evidence_explanation_anchor_invalid'):
        validate_declarations(task, CAPTURED['question'])


@pytest.mark.parametrize('index', [1, 2])
def test_both_schema_valid_arabic_captured_tasks_keep_every_original_clause(index):
    task = TaskSpec.model_validate(AR_CAPTURED['rejectedCandidates'][index])
    before = task.model_dump()
    assignment = partition(task, AR_CAPTURED['question'], AR_CAPTURED['question'])
    assert assignment['liveTask'].requestedAttributes == ['status']
    assert assignment['knowledgeTask'].requestedAttributes == [
        'status', 'documented procedure to verify or update a status discrepancy']
    assert assignment['knowledgeMap']['attribute_1'] == 'attribute_3'
    assert task.model_dump() == before
    assert assignment['assigned'][-1]['questionQuote'] == 'وأرشدني إلى كيفية التحديث أو التحقق من هذا الاختلاف'


def test_arabic_first_attempt_schema_failure_is_not_hidden_by_grammar_change():
    # Its separate unknown slot field remains invalid. The repair does not
    # broaden TaskSpec or rewrite any captured model candidate.
    with pytest.raises(ValidationError) as error:
        TaskSpec.model_validate(AR_CAPTURED['rejectedCandidates'][0])
    assert ('slotUpdates', 1, 'field') in [e['loc'] for e in error.value.errors()]


V34_AR_CAPTURED = json.loads((Path(__file__).parent/'fixtures/evidence_guidance_b11_v34_ar.json').read_text())


@pytest.mark.parametrize('index', [0, 1])
def test_v34_arabic_guidance_rejections_partition_without_rewriting_the_captured_task(index):
    task = TaskSpec.model_validate(V34_AR_CAPTURED['rejectedCandidates'][index])
    before = task.model_dump()
    assignment = partition(task, V34_AR_CAPTURED['question'], V34_AR_CAPTURED['canonical'])
    assert assignment is not None
    assert task.model_dump() == before
    assert assignment['liveTask'].requestedAttributes == ['status']
    assert assignment['knowledgeTask'].requestedAttributes == [
        'status', 'documented guidance on how to update or verify the status discrepancy']
    assert assignment['knowledgeMap']['attribute_1'] == 'attribute_3'
    assert assignment['assigned'][-1]['questionQuote'] == 'وأرشدني إلى كيفية التحديث أو التحقق من هذا الاختلاف'
    assert assignment['originalTask'].requestedAttributes == before['requestedAttributes']
    assert task.readOnly is True and task.needsLiveData is True
    # Partitioning is not fresh verification, cited guidance, or case closure.
    merged = merge_results(assignment, {'outputs': [], 'requirementCoverage': [],
        'requirementsSatisfied': False, 'missing': []}, {}, 'principal', [], 'ar',
        {'coverage': [], 'blocks': []})
    assert not merged['requirementsSatisfied']
    assert set(merged['missing']) == {r['id'] for r in requirements_for(task)}


@pytest.mark.parametrize('label', [
    'documented guidance on how to update or verify the discrepancy',
    'Documented Guidance On How To Update Or Verify The Discrepancy',
    'the documented guidance on how to verify the status',
    'the guidance on how to refresh the page',
    'documented instructions on how to verify a discrepancy',
    'the documented instructions on how to verify a discrepancy',
    'a documented procedure for verifying a discrepancy',
    'the documented steps to refresh the page',
    '  documented  guidance\ton how to verify the discrepancy  ',
])
def test_explicit_guidance_heads_allow_documented_articles_case_and_spacing(label):
    task = task_for(label)
    before = task.model_dump()
    validate_declarations(task, CAPTURED['question'])
    assert task.model_dump() == before


@pytest.mark.parametrize('label', [
    'current status showing how the request was processed',
    'current status of the procedure',
    'status of the documented guidance on how to update the record',
    'payment amount for instructions on how to update the record',
    'current procedure completion date',
    'documented guidance completion status',
    'the documented guidance status',
    'documented guidance on how many records are pending',
    'documented guidance on how the status was updated',
    'documented guidance on how to',
    'the documented instructions on how to',
    'how to ',
    'update the status now',
    'approve the request and show how it was handled',
])
def test_how_inside_live_fields_or_actions_is_not_a_guidance_head(label):
    task = task_for(label)
    before = task.model_dump()
    with pytest.raises(PipelineError, match='evidence_guidance_meaning_unverified'):
        validate_declarations(task, CAPTURED['question'])
    assert task.model_dump() == before


@pytest.mark.parametrize('question', [
    'Update the record now, then tell me how to verify it.',
    'Approve the request, and show me how to check the resulting status.',
])
def test_a_write_request_with_a_guidance_clause_remains_a_write_request(question):
    task = task_for('documented guidance on how to verify the status', question)
    task.requestedAttributes = ['status', task.requestedAttributes[-1]]
    task.evidenceExplanations = [task.evidenceExplanations[-1]]
    task.readOnly = False
    before = task.model_dump()
    assert partition(task, question, question) is None
    assert task.model_dump() == before and task.readOnly is False


def test_new_guidance_head_still_requires_an_exact_original_or_canonical_quote():
    task = task_for('documented guidance on how to verify the status', 'invented instructions')
    with pytest.raises(PipelineError, match='evidence_explanation_quote_invalid'):
        validate_declarations(task, CAPTURED['question'])
