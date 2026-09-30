"""A purpose follow-up cannot reopen known choices to bypass missing evidence."""
import pytest

from app.generic_reader import PipelineError
from app.generic_reader_contracts import RoutingDecision, ClarificationRequest, ClarificationChoice, SlotUpdate
from app.reader_routing import task_fingerprint, validate_decision
from test_reader_purpose_clarification import fixture


def decision(task, slot, options=None):
    return RoutingDecision(stage='routing_decision', taskFingerprint=task_fingerprint(task),
        decision='clarify', candidates=[], reason='A user choice is requested.',
        clarification=ClarificationRequest(question='Which information is needed?',
            missingSlots=[slot], options=options or []))


@pytest.mark.parametrize('slot', ['disclosurePurpose', 'requestedAttributes', 'recordIdentity'])
def test_known_slot_rejection_reports_recovery_without_private_values(slot):
    task, knowledge, _ = fixture()
    task.disclosurePurpose = 'Contact the participant for the current case'
    before = task.model_dump()
    with pytest.raises(PipelineError, match='clarification_repeats_known_condition') as error:
        validate_decision(decision(task, slot), task, [], knowledge)
    assert error.value.details['knownSlot'] == slot
    assert 'knowledge_gap' in error.value.details['correction']
    assert task.recordIdentity not in str(error.value.details)
    assert task.disclosurePurpose not in str(error.value.details)
    assert task.model_dump() == before


def test_missing_purpose_still_accepts_free_text_clarification():
    task, knowledge, _ = fixture()
    assert task.disclosurePurpose == ''
    validate_decision(decision(task, 'disclosurePurpose'), task, [], knowledge)


def test_explicitly_unresolved_choice_can_still_be_clarified():
    task, knowledge, _ = fixture()
    task.unresolvedSlots = ['requestedAttributes']
    validate_decision(decision(task, 'requestedAttributes'), task, [], knowledge)


def test_missing_purpose_cannot_authorize_a_narrower_attribute_update():
    task, knowledge, _ = fixture()
    choice = ClarificationChoice(id='contact', label='Contact details only', updates=[
        SlotUpdate(field='requestedAttributes', source='current', value=['phone numbers'])])
    with pytest.raises(PipelineError, match='clarification_changes_unrelated_condition'):
        validate_decision(decision(task, 'disclosurePurpose', [choice]), task, [], knowledge)


def test_knowledge_gap_preserves_all_known_requirements():
    task, knowledge, _ = fixture()
    task.disclosurePurpose = 'Contact the participant for the current case'
    before = task.model_dump()
    plan = RoutingDecision(stage='routing_decision', taskFingerprint=task_fingerprint(task),
        decision='knowledge_gap', candidates=[], routePlan=[], missing=['related_identity_unverified'],
        reason='A customer relation and field bindings have not been independently verified.')
    validate_decision(plan, task, [], knowledge)
    assert task.model_dump() == before
    assert not plan.routePlan
