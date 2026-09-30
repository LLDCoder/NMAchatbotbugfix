"""Actual B11 AR refinement failures; offline replay never changes user intent."""
import asyncio
import copy
import json
import time
from pathlib import Path

import pytest
from app.generic_reader import GenericKnowledgeReader
from app.generic_reader_contracts import TaskSpec, SlotUpdate
from app.reader_context import refine_task, merge_task, INTENT_FIELDS
from app.reader_evidence_explanation import preserve_refinement_declarations, validate_declarations, partition
from app.reader_requirements import requirements_for

SAVED = json.loads((Path(__file__).parent / 'fixtures/refinement_b11_ar_v32.json').read_text())


def draft():
    return TaskSpec.model_validate(SAVED['draft'])


def changed_slot(task, field, value, source):
    return task.model_copy(deep=True, update={field: value,
        'slotUpdates': [s.model_copy(deep=True) for s in task.slotUpdates if s.field != field]
            + [SlotUpdate(field=field, value=value, source=source)]})


@pytest.mark.parametrize('attempt', [0, 1])
def test_actual_candidate_goes_through_structured_validation_and_retains_original_request(attempt):
    original = draft()
    before = original.model_dump()
    raw = SAVED['rejectedPlans'][attempt]['candidate']
    assert raw['businessObject'] == raw['requestedGrain'] == 'application'
    assert original.businessObject == original.requestedGrain == 'request'
    assert json.loads(SAVED['rejectedPlans'][attempt]['failure'])['code'] == 'intent_refinement_invalid'
    class RecordedPlanner:
        calls = 0
        async def generic_reader_json(self, **kwargs):
            self.calls += 1
            return copy.deepcopy(raw)
    planner = RecordedPlanner()
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://offline.invalid')
    reader.deadline = time.monotonic() + 30
    reader.secrets = ()
    reader.current_question = SAVED['question']
    obj = asyncio.run(reader.structured(TaskSpec, 'Replay captured refinement only.',
        {'phase': 'knowledge_refinement', 'question': SAVED['question'], 'draft': original.model_dump(),
         'history': copy.deepcopy(SAVED['history'])},
        lambda candidate: refine_task(original, candidate)))
    refined = refine_task(original, obj)
    assert planner.calls == 1
    assert all(getattr(refined, field) == getattr(original, field) for field in INTENT_FIELDS)
    assert refined.businessObject == refined.requestedGrain == 'request'  # No global synonym rewrite.
    assert refined.slotUpdates == original.slotUpdates
    assert refined.evidenceExplanations == original.evidenceExplanations
    assert requirements_for(refined) == requirements_for(original)
    assert refined.readOnly and refined.needsLiveData
    assert original.model_dump() == before
    assignment = partition(refined, SAVED['question'], SAVED['canonicalQuestion'])
    assert assignment['liveTask'].requestedAttributes == ['status']
    assert assignment['knowledgeTask'].requestedAttributes == [
        'status', 'documented procedure to verify or update a status discrepancy']


@pytest.mark.parametrize('attempt', [0, 1])
def test_same_recorded_forged_previous_values_still_fail_ordinary_conversation_merge(attempt):
    original = draft()
    candidate = TaskSpec.model_validate(SAVED['rejectedPlans'][attempt]['candidate'])
    previous = {k: getattr(original, k) for k in INTENT_FIELDS}
    previous['slotStates'] = [x.model_dump() for x in original.slotUpdates]
    with pytest.raises(ValueError, match='previous slot has no matching conversation evidence'):
        merge_task(candidate, {'previousIntent': previous})


@pytest.mark.parametrize('field,value,other', [
    ('businessObject', 'request', 'transaction'),
    ('requestedGrain', 'request', 'workflow task'),
    ('recordIdentity', 'ML-1-7-6577159', 'UNRELATED-27'),
    ('requestedScope', 'personal', 'all'),
    ('businessFocus', 'pending', 'completed'),
    ('filters', ['state = pending', 'exclude cancelled'], ['state = completed']),
    ('timeRange', 'today', 'all time'),
    ('timeField', 'submission time', 'updated time'),
    ('view', 'todo', 'completed'),
    ('requestedAttributes', ['status', 'amount'], ['status']),
    ('requestedMeasures', ['sum amount'], ['count']),
    ('requestedOrdering', ['submission time ascending'], ['amount descending']),
    ('groupBy', ['department', 'service'], ['service']),
    ('disclosurePurpose', 'customer follow-up', 'bulk export'),
    ('groupCompleteness', 'complete_domain', 'observed'),
    ('outputShape', 'detail', 'count'),
])
@pytest.mark.parametrize('owner', ['current', 'previous'])
def test_protected_hard_constraints_survive_false_inherited_rewrites(field, value, other, owner):
    original = changed_slot(draft(), field, value, owner)
    candidate = changed_slot(original, field, other, 'previous')
    result = refine_task(original, candidate)
    assert getattr(result, field) == value
    state = next(s for s in result.slotUpdates if s.field == field)
    assert state.value == value and state.source == owner
    assert result.readOnly == original.readOnly
    assert result.evidenceExplanations == original.evidenceExplanations


@pytest.mark.parametrize('field,empty,other', [
    ('businessFocus', '', 'pending'), ('filters', [], ['state = pending']),
    ('groupBy', [], ['department']), ('requestedAttributes', [], ['secret field']),
    ('requestedMeasures', [], ['count']), ('requestedOrdering', [], ['amount descending']),
    ('timeRange', '', 'today'), ('disclosurePurpose', '', 'bulk export'),
])
@pytest.mark.parametrize('owner', ['current', 'previous', 'clear'])
def test_explicit_empty_or_cleared_requirements_are_not_reintroduced(field, empty, other, owner):
    original = changed_slot(draft(), field, empty, owner)
    result = refine_task(original, changed_slot(original, field, other, 'previous'))
    assert getattr(result, field) == empty
    assert next(s for s in result.slotUpdates if s.field == field).source == owner


@pytest.mark.parametrize('field,empty,other', [
    ('requestedScope', 'unknown', 'personal'), ('requestedGrain', 'unknown', 'application'),
    ('view', '', 'todo'), ('recordIdentity', '', 'UNRELATED-27'),
])
def test_unresolved_slot_cannot_claim_a_nonexistent_previous_value(field, empty, other):
    original = changed_slot(draft(), field, empty, 'previous')
    original.unresolvedSlots = [field]
    with pytest.raises(ValueError, match='previous slot has no matching conversation evidence'):
        refine_task(original, changed_slot(original, field, other, 'previous'))


def test_knowledge_can_still_resolve_unspecified_grain_but_cannot_change_execution_flags():
    original = changed_slot(draft(), 'requestedGrain', 'unknown', 'previous')
    candidate = changed_slot(original, 'requestedGrain', 'application', 'knowledge')
    candidate.readOnly = False
    candidate.needsLiveData = False
    candidate.responseMode = 'draft'
    result = refine_task(original, candidate)
    assert result.requestedGrain == 'application'
    assert result.readOnly is True and result.needsLiveData is True and result.responseMode == 'answer'


@pytest.mark.parametrize('attempt', [0, 1])
def test_actual_c05_v33_refinement_cannot_revive_previous_queue_in_explanation_request(attempt):
    captured = json.loads((Path(__file__).parent / 'fixtures/refinement_c05_ar_v33.json').read_text())
    original = TaskSpec.model_validate(captured['draft'])
    before = original.model_dump()
    assert captured['previousResult']['result'] == 'success'
    assert captured['previousResult']['completeness'] == 'complete'
    assert captured['previousResult']['requirementsSatisfied']
    assert original.businessObject == original.requestedGrain == 'previous answer'
    assert not original.needsLiveData
    raw = captured['rejectedPlans'][attempt]['candidate']
    assert raw['businessObject'] == 'license application'
    assert raw['businessFocus'] == 'in progress' and raw['view'] == 'todo'
    assert raw['requestedScope'] == 'personal'
    class RecordedPlanner:
        calls = 0
        async def generic_reader_json(self, **kwargs):
            self.calls += 1
            return copy.deepcopy(raw)
    planner = RecordedPlanner()
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://offline.invalid')
    reader.deadline = time.monotonic() + 30
    reader.secrets = ()
    reader.current_question = captured['question']
    obj = asyncio.run(reader.structured(TaskSpec, 'Replay captured refinement only.',
        {'phase': 'knowledge_refinement', 'question': captured['question'], 'draft': original.model_dump(),
         'history': copy.deepcopy(captured['history'])}, lambda candidate: refine_task(original, candidate)))
    refined = refine_task(original, obj)
    assert planner.calls == 1
    assert all(getattr(refined, field) == getattr(original, field) for field in INTENT_FIELDS)
    assert refined.slotUpdates == original.slotUpdates
    assert refined.requestedAttributes == ['data scope used for the previous query', 'constraints used for the previous query']
    assert refined.businessObject == refined.requestedGrain == 'previous answer'
    assert refined.view == refined.businessFocus == '' and refined.requestedScope == 'unknown'
    assert all(next(s for s in refined.slotUpdates if s.field == field).source == 'clear'
               for field in ['view', 'businessFocus', 'requestedScope'])
    assert refined.readOnly and not refined.needsLiveData
    assert requirements_for(refined) == requirements_for(original)
    assert original.model_dump() == before
