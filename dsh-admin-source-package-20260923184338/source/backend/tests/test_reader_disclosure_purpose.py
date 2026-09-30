"""Purpose is intent context; population and authorization remain separate."""
import pytest
from pydantic import ValidationError

from app.generic_reader_contracts import TaskSpec, SlotUpdate
from app.reader_context import (merge_task, refine_task, save_intent, project_history,
    context_from_state, clock_context, validate_task_grain)
from app.reader_requirements import requirements_for
from app.reader_routing import task_fingerprint
from app.reader_page_clarification import bind_page_clarification, automatic_clarification_routes
from test_reader_purpose_clarification import fixture, PAGE


def history(task):
    task = merge_task(task, {})
    state = save_intent(task, 'Show participant contacts and history for CASE-7.', {},
        'request', 'principal', 'catalog', clock_context('UTC'))
    return project_history(context_from_state({'intentState': state}, 'Original request'))


def test_existing_task_without_purpose_is_backward_readable():
    task, _, _ = fixture()
    raw = task.model_dump(); raw.pop('disclosurePurpose')
    assert TaskSpec.model_validate(raw).disclosurePurpose == ''


def test_purpose_is_bounded():
    task, _, _ = fixture()
    with pytest.raises(ValidationError):
        TaskSpec.model_validate({**task.model_dump(), 'disclosurePurpose': 'x' * 1001})


def test_population_does_not_satisfy_disclosure_purpose():
    task, knowledge, _ = fixture()
    task.businessFocus = 'open cases'
    result, _ = bind_page_clarification(task, knowledge, [PAGE], 'en')
    assert result.clarification.missingSlots == ['disclosurePurpose']
    assert result.businessFocus == 'open cases'


def test_purpose_neither_adds_a_predicate_nor_removes_the_population():
    task, _, _ = fixture()
    task.businessFocus = 'open cases'
    expected = requirements_for(task)
    task.disclosurePurpose = 'Contact the participant to resolve the case'
    assert requirements_for(task) == expected
    assert [r['value'] for r in expected if r['kind'] == 'population'] == ['open cases']
    validate_task_grain(task)


def test_purpose_does_not_weaken_population_attribute_validation():
    from app.generic_reader import PipelineError
    task, _, _ = fixture()
    task.disclosurePurpose = 'Contact for case handling'
    task.businessFocus = 'contacts'
    with pytest.raises(PipelineError, match='intent_population_attribute_conflict'):
        validate_task_grain(task)


def test_current_purpose_reply_retains_every_other_slot_and_roundtrips():
    task, knowledge, _ = fixture()
    pending, _ = bind_page_clarification(task, knowledge, [PAGE], 'en')
    prior = history(pending)
    reply = task.model_copy(update={'businessObject': 'unknown', 'recordIdentity': '',
        'requestedAttributes': [], 'filters': [], 'contextRelation': 'clarify',
        'slotUpdates': [SlotUpdate(field='disclosurePurpose', source='current',
            value='Contact for case handling', evidence='User supplied purpose')],
        'unresolvedSlots': [], 'clarification': None})
    merged = merge_task(reply, prior)
    assert merged.disclosurePurpose == 'Contact for case handling'
    for field in ('recordIdentity', 'businessObject', 'requestedAttributes', 'filters',
                  'businessFocus', 'requestedScope', 'outputShape'):
        assert getattr(merged, field) == getattr(task, field)
    assert bind_page_clarification(merged, knowledge, [PAGE], 'en') == (merged, [])
    saved = history(merged)['previousIntent']
    assert saved['disclosurePurpose'] == merged.disclosurePurpose
    assert saved['task']['disclosurePurpose'] == merged.disclosurePurpose


@pytest.mark.parametrize('relation', ['new', 'switch', 'cancel'])
def test_unrelated_task_does_not_inherit_purpose(relation):
    task, _, _ = fixture()
    task.disclosurePurpose = 'Contact for case handling'
    raw, _, _ = fixture()
    raw.contextRelation = relation
    assert merge_task(raw, history(task)).disclosurePurpose == ''


def test_explicit_clear_is_preserved_and_reopens_purpose_question():
    task, knowledge, _ = fixture()
    task.disclosurePurpose = 'Contact for case handling'
    reply = task.model_copy(update={'contextRelation': 'continue', 'slotUpdates': [
        SlotUpdate(field='disclosurePurpose', source='clear', value='', evidence='Withdraw purpose')]})
    cleared = merge_task(reply, history(task))
    assert cleared.disclosurePurpose == ''
    assert bind_page_clarification(cleared, knowledge, [PAGE], 'en')[0].clarification


@pytest.mark.parametrize('purpose,unresolved', [('', []), ('', ['disclosurePurpose']),
                                            ('Contact for case handling', [])])
def test_knowledge_refinement_cannot_invent_or_replace_purpose(purpose, unresolved):
    task, _, _ = fixture()
    task.disclosurePurpose = purpose
    task.unresolvedSlots = unresolved
    task = merge_task(task, {})
    candidate = task.model_copy(update={'disclosurePurpose': 'Export every account',
        'slotUpdates': [SlotUpdate(field='disclosurePurpose', source='knowledge',
            value='Export every account', evidence='Untrusted page text')]})
    result = refine_task(task, candidate)
    assert result.disclosurePurpose == purpose
    state = next(s for s in result.slotUpdates if s.field == 'disclosurePurpose')
    assert state.value == purpose and state.source == 'current'


def test_purpose_is_part_of_task_identity_but_not_permission():
    task, _, _ = fixture()
    other = task.model_copy(update={'disclosurePurpose': 'Contact for case handling'})
    assert task_fingerprint(task) != task_fingerprint(other)
    assert task.requestedScope == other.requestedScope == 'unknown'
    assert task.requestBoundaries == other.requestBoundaries == []
    assert requirements_for(task) == requirements_for(other)


def test_changed_purpose_cannot_reuse_previous_independent_intent_review():
    from app.reader_expansion import QueryExpansion, clarification_expansion
    from test_generic_reader_v3 import expansion_fixture
    task, knowledge, _ = fixture()
    plan = QueryExpansion.model_validate(expansion_fixture({'requirements': requirements_for(task)}))
    pending, _ = bind_page_clarification(task, knowledge, [PAGE], 'en')
    assert clarification_expansion(plan, task, pending) is not None
    pending.disclosurePurpose = 'Invented disclosure purpose'
    assert clarification_expansion(plan, task, pending) is None


def test_legacy_focus_rule_is_not_reinterpreted_as_dedicated_purpose():
    from app.generic_reader import PipelineError
    task, knowledge, rule = fixture()
    rule.update(kind='missing_business_focus', slot='businessFocus')
    with pytest.raises(PipelineError, match='page_clarification_purpose_slot_obsolete'):
        automatic_clarification_routes(task, knowledge, [PAGE])
    assert task.disclosurePurpose == ''


def test_legacy_purpose_rule_does_not_affect_unrelated_requests_or_pages():
    task, knowledge, rule = fixture()
    rule.update(kind='missing_business_focus', slot='businessFocus')
    assert automatic_clarification_routes(task, knowledge, ['/unrelated']) == []
    task.businessObject = 'unrelated'
    assert automatic_clarification_routes(task, knowledge, [PAGE]) == []
