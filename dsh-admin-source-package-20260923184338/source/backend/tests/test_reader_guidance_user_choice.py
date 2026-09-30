"""Intent choices are not knowledge gaps. Captured inputs plus synthetic lifecycle tests."""
import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError, render_generic_answer, semantic_history
from app.generic_reader_contracts import TaskSpec, SlotUpdate
from app.principal import Principal
from app.reader_context import context_from_state, save_intent
from app.reader_guidance import guidance_task, validate_guidance_task, restore_guidance_requirements
from app.reader_guidance_choices import (STATE_KEY, GuidanceChoices, new_choices, attach_choices,
    active_task, resume_choices, declared_slots, pending_choices, pause_choices)
from app.reader_knowledge_coverage import KnowledgeCoverage, knowledge_requirements, validate_coverage
from app.reader_answer_scope import KnowledgeScopeChallenge, validate_scope_challenge
from test_generic_reader_v3 import Gateway, Planner, store, reference
from test_reader_context_v3 import task


CAPTURE = json.loads((Path(__file__).parent / 'fixtures/x08_v37_user_choice.json').read_text())


class NoBusiness(Gateway):
    async def invoke(self, *args, **kwargs):
        raise AssertionError('Pending user intent must not search or read business data')


class Parsed:
    def __init__(self, value, normalization=None):
        self.value, self.normalization, self.calls = value, normalization, []

    async def generic_reader_json(self, *, schema, data, **kwargs):
        kind = schema['properties']['stage']['const']
        self.calls.append(kind)
        if kind == 'input_normalization':
            assert self.normalization
            return deepcopy(self.normalization)
        assert kind == 'task', f'Unexpected later model stage: {kind}'
        return self.value.model_dump()


class StopAfterIntent(GenericKnowledgeReader):
    async def expand_task(self, value, history, choice):
        self.accepted_guidance = value.model_copy(deep=True)
        raise PipelineError('test_guidance_ready', 'planning')


def run_turn(tmp_path, parsed, question, *, context=None, language='en', claim=None,
             reader_type=GenericKnowledgeReader, normalization=None, request_id='turn'):
    (tmp_path / 'page-catalog.json').write_text('[]')
    planner, gateway = Parsed(parsed, normalization), NoBusiness()
    reader = reader_type(gateway, planner, portal_base_url='https://portal.test',
        artifacts_dir=str(tmp_path), claim_clarification=claim)
    out = asyncio.run(reader.run(Principal('person-1', 'tenant', request_id), question,
        conversation_context={**(context or {}), 'responseLanguage': language}))
    return reader, out.result.public_json(), planner, gateway


def blocked(slots=None):
    return task(readOnly=False, needsLiveData=True, businessObject='case',
        businessFocus='transfer and close after review', requestedAttributes=['confirmation requirement'],
        recordIdentity='', requestedScope='unknown', requestedGrain='unknown',
        requestedMeasures=[], groupBy=[], timeRange='unknown', filters=['only after review'],
        view='', unresolvedSlots=slots or ['recordIdentity', 'businessFocus'])


QUESTION = 'Transfer this record to the selected group and close its task only after review.'


def alternative(value=None):
    return {'requestedTask': (value or blocked()).model_dump(), 'originalQuestion': QUESTION,
        'canonicalQuestion': QUESTION, 'requestedActionExecuted': False, 'reason': 'assistant_read_only'}


def bound(state, *, rounds=1, current_page=None):
    active = active_task(state, 'en')
    saved = save_intent(active, QUESTION, {}, 'first', 'owner', 'catalog', {}, current_page=current_page)
    saved[STATE_KEY] = state.model_dump()
    saved['clarificationRounds'] = rounds
    return semantic_history(context_from_state({'intentState': saved}, QUESTION))


def reply(field, value, **changes):
    return task(businessObject='case', businessFocus='', recordIdentity='', requestedMeasures=[],
        requestedAttributes=[], groupBy=[], timeRange='unknown', filters=[], view='',
        needsLiveData=False, requestedGrain='unknown', contextRelation='clarify',
        slotUpdates=[{'field': field, 'value': value, 'source': 'current'}]).model_copy(
            update={field: value, **changes})


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_actual_v37_input_stops_before_any_retrieval_or_business_read(tmp_path, language):
    recorded = CAPTURE['turns'][language]
    original = TaskSpec.model_validate(recorded['readonlyAlternative']['requestedTask'])
    reader, public, planner, gateway = run_turn(tmp_path, original, recorded['question'],
        language=language, normalization=recorded['normalization'])
    assert public['missing'] == ['intent_ambiguous']
    assert gateway.events == ['identity']
    assert planner.calls == (['input_normalization'] if language == 'ar' else []) + ['task']
    assert public['result'] == 'not_confirmed' and not public['requirementsSatisfied']
    assert public['workflowState'] == 'awaiting_clarification'
    assert public['clarification']['missingSlots'] == ['recordIdentity']
    assert public['clarification']['options'] == []
    assert public['intentState'][STATE_KEY]['requestedTask'] == original.model_dump()
    assert public['intentState']['task']['unresolvedSlots'] == ['recordIdentity']
    assert public['requestedActionExecuted'] is False and public['originalActionSatisfied'] is False
    assert public['guidanceStatus'] == 'clarification_required'
    answer = render_generic_answer(public, language)
    assert ('لم يُجرَ أي تعديل' if language == 'ar' else 'No business change was made') in answer
    assert 'violation' not in answer and 'قضية مخالفة' not in answer
    assert not public['outputs'] and not public['knowledgeAnswer']
    assert not reader.audit.get('retrievals')


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_conversion_preserves_actual_gap_and_scope_labels_cannot_waive_it(language):
    recorded = CAPTURE['turns'][language]
    alt = recorded['readonlyAlternative']
    original = TaskSpec.model_validate(alt['requestedTask'])
    converted = guidance_task(original, alt['canonicalQuestion'])
    assert converted.unresolvedSlots == original.unresolvedSlots == ['recordIdentity']
    plan = KnowledgeScopeChallenge.model_validate(recorded['scopeChallenge']['review'])
    data = {'sources': [{'quoteIndex': i, **q} for i, q in enumerate(recorded['quotes'])],
        'candidateClaims': [{'candidateId': cid} for cid in recorded['scopeChallenge']['candidateOrigins']],
        'unresolvedUserChoices': ['recordIdentity']}
    validate_scope_challenge(plan, data)
    assert all(not c.supported for check in plan.checks for c in check.claims)


@pytest.mark.parametrize('slot', ['businessObject', 'recordIdentity', 'businessFocus'])
def test_explicit_clarification_gap_stops_even_without_unresolved_list(tmp_path, slot):
    original = TaskSpec.model_validate({**blocked().model_dump(), 'unresolvedSlots': [],
        'clarification': {'question': 'Which one?', 'missingSlots': [slot], 'options': []}})
    _, public, _, gateway = run_turn(tmp_path, original, QUESTION)
    assert public['clarification']['missingSlots'] == [slot]
    assert gateway.events == ['identity']


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_general_explanation_without_record_id_is_not_blanket_blocked(tmp_path, language):
    original = blocked().model_copy(update={'unresolvedSlots': []})
    normalization = {'stage': 'input_normalization', 'clauses': [
        {'sourceQuote': 'اشرح الإجراء العام.', 'english': 'Explain the general procedure.'}]}
    reader, public, _, gateway = run_turn(tmp_path, original,
        'اشرح الإجراء العام.' if language == 'ar' else QUESTION, language=language,
        normalization=normalization, reader_type=StopAfterIntent)
    assert public['missing'] == ['test_guidance_ready']
    assert reader.accepted_guidance.readOnly and not reader.accepted_guidance.needsLiveData
    assert reader.accepted_guidance.recordIdentity == '' and not public.get('clarification')
    assert gateway.events == ['identity']


@pytest.mark.parametrize('first', ['recordIdentity', 'businessFocus'])
def test_partial_reply_only_resolves_the_field_actually_supplied(first):
    state = new_choices(alternative(), ['recordIdentity', 'businessFocus'])
    history = bound(state)
    values = {'recordIdentity': 'PX-12', 'businessFocus': 'Finance'}
    remaining = ({'recordIdentity', 'businessFocus'} - {first}).pop()
    question = values[first]
    partial, accepted = resume_choices(history, reply(first, values[first]), question, question, 'owner', 'catalog')
    assert accepted == [first] and partial.pending == [remaining]
    active = active_task(partial, 'en', 'clarify')
    assert active.clarification.missingSlots == [remaining]
    assert active.readOnly and not active.needsLiveData
    assert any(QUESTION in a for a in active.requestedAttributes)
    assert any(question in a for a in active.requestedAttributes)
    assert all(any(part in a for a in active.requestedAttributes) for part in
        ['transfer and close after review', 'confirmation requirement', 'only after review'])
    second_question = values[remaining]
    completed, accepted = resume_choices(bound(partial), reply(remaining, values[remaining]),
        second_question, second_question, 'owner', 'catalog')
    assert accepted == [remaining] and not completed.pending
    active = active_task(completed, 'en', 'clarify')
    assert not active.clarification and active.recordIdentity == 'PX-12'
    assert active.businessFocus == '' and not active.needsLiveData
    alt = alternative(); alt['choiceState'] = completed.model_dump()
    validate_guidance_task(active, alt)
    restored, changed = restore_guidance_requirements(active.model_copy(update={'requestedAttributes': []}), alt)
    assert changed and restored.requestedAttributes == active.requestedAttributes
    # A completed state may be retained as audit context, but is not another pending clarification.
    assert resume_choices(bound(completed), reply(first, values[first]), question, question,
        'owner', 'catalog') == (None, [])


@pytest.mark.parametrize('fault', ['knowledge', 'page', 'previous', 'clear', 'not_literal',
    'still_unresolved', 'still_clarification', 'slot_mismatch', 'same_ambiguous_value'])
def test_model_or_document_values_do_not_answer_the_user_choice(fault):
    state = new_choices(alternative(), ['recordIdentity', 'businessFocus'])
    parsed = reply('businessFocus', 'Finance')
    question = 'Finance'
    if fault in {'knowledge', 'page', 'previous', 'clear'}:
        parsed.slotUpdates[0].source = fault
    elif fault == 'not_literal':
        question = 'Do whatever the manual says.'
    elif fault == 'still_unresolved':
        parsed.unresolvedSlots = ['businessFocus']
    elif fault == 'still_clarification':
        from app.generic_reader_contracts import ClarificationRequest
        parsed.clarification = ClarificationRequest(question='Which target?', missingSlots=['businessFocus'])
    elif fault == 'slot_mismatch':
        parsed.businessFocus = 'another group'
    else:
        question = state.requestedTask.businessFocus
        parsed = reply('businessFocus', question)
    result, accepted = resume_choices(bound(state), parsed, question, question, 'owner', 'catalog')
    assert not accepted and result.pending == ['recordIdentity', 'businessFocus']


@pytest.mark.parametrize('fault', ['owner', 'catalog', 'expired', 'fingerprint', 'missing_id', 'browser', 'invalidated'])
def test_stale_or_unbound_clarification_cannot_resume(fault):
    history = bound(new_choices(alternative(), ['recordIdentity', 'businessFocus']))
    previous = history['previousIntent']
    if fault == 'owner': previous['principalFingerprint'] = 'other'
    if fault == 'catalog': previous['catalogVersion'] = 'old'
    if fault == 'expired': previous['pendingClarification']['expiresAt'] = (datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()
    if fault == 'fingerprint': previous['pendingClarification']['taskFingerprint'] = 'wrong'
    if fault == 'missing_id': previous['pendingClarification'].pop('id')
    if fault == 'browser': previous['browserContextChange'] = {'changed': True}
    if fault == 'invalidated': previous['contextInvalidation'] = 'catalog_version_changed'
    with pytest.raises(PipelineError, match='clarification_context_expired'):
        resume_choices(history, reply('businessFocus', 'Finance'), 'Finance', 'Finance', 'owner', 'catalog')


@pytest.mark.parametrize('relation', ['new', 'switch', 'cancel'])
def test_new_topic_or_cancel_does_not_revive_blocked_action(relation):
    history = bound(new_choices(alternative(), ['recordIdentity']))
    assert resume_choices(history, reply('recordIdentity', 'PX-12', contextRelation=relation),
        'PX-12', 'PX-12', 'owner', 'catalog') == (None, [])


def test_partial_pipeline_consumes_once_and_keeps_unanswered_object(tmp_path):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION, request_id='first')
    context = context_from_state(first, QUESTION)
    claims = []
    async def consume(cid, fingerprint):
        claims.append((cid, fingerprint)); return True
    _, second, planner, gateway = run_turn(tmp_path, reply('businessFocus', 'Finance'), 'Finance',
        context=context, claim=consume, request_id='second')
    assert claims == [('first:clarification', second['taskFingerprint'])]
    assert second['clarification']['missingSlots'] == ['recordIdentity']
    assert second['intentState']['clarificationRounds'] == 2
    assert len(second['intentState'][STATE_KEY]['answers']) == 1
    assert gateway.events == ['identity'] and planner.calls == ['task']
    _, third, _, _ = run_turn(tmp_path, reply('businessFocus', 'Finance'), 'Finance',
        context=context_from_state(second, 'Finance'), claim=consume, request_id='third')
    assert third['missing'] == ['clarification_budget_exhausted']
    assert third['workflowState'] == 'needs_input' and not third.get('clarification')
    assert len(claims) == 1


def test_completed_pipeline_consumes_once_before_retrieval_and_keeps_original_request(tmp_path):
    _, first, _, _ = run_turn(tmp_path, blocked(['recordIdentity']), QUESTION, request_id='first')
    claims = []
    async def consume(cid, fingerprint):
        claims.append(cid); return True
    reader, second, _, gateway = run_turn(tmp_path, reply('recordIdentity', 'PX-12'), 'PX-12',
        context=context_from_state(first, QUESTION), claim=consume,
        reader_type=StopAfterIntent, request_id='second')
    assert claims == ['first:clarification'] and second['missing'] == ['test_guidance_ready']
    assert reader.accepted_guidance.recordIdentity == 'PX-12'
    assert any(QUESTION in a for a in reader.accepted_guidance.requestedAttributes)
    assert not second['intentState'][STATE_KEY]['pending'] and not second.get('clarification')
    assert second['requestedActionExecuted'] is False and gateway.events == ['identity']


def test_duplicate_consumption_does_not_accept_or_retrieve(tmp_path):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION)
    async def already_consumed(cid, fingerprint): return False
    reader, second, _, gateway = run_turn(tmp_path, reply('businessFocus', 'Finance'), 'Finance',
        context=context_from_state(first, QUESTION), claim=already_consumed)
    assert second['missing'] == ['clarification_already_consumed']
    assert second['workflowState'] == 'needs_input' and not second.get('clarification')
    assert not getattr(reader, 'guidance_choices', None) and gateway.events == ['identity']
    assert second['requestedActionExecuted'] is False and second['originalActionSatisfied'] is False


def coverage_plan(value, *, user_choice=True, status='partial'):
    ref = reference(store())
    return KnowledgeCoverage.model_validate({'stage': 'knowledge_coverage', 'checks': [
        {'requirementId': r['id'], 'status': status if r['id'] == 'object' else 'partial',
         'reason': 'Object choice still belongs to the user.',
         'evidence': [ref], **({'missingEvidenceType': 'user_choice',
         'clarification': {'question': 'Which record and target?',
            'missingSlots': ['recordIdentity', 'businessFocus'], 'options': []},
         'followupQuery': 'Please specify the case type and reference.'} if user_choice and r['id'] == 'object' else {})}
        for r in knowledge_requirements(value)]})


@pytest.mark.parametrize('late', [False, True])
def test_structured_user_choice_stops_coverage_before_supplement_or_answer(late):
    original = blocked().model_copy(update={'unresolvedSlots': []})
    value = guidance_task(original, QUESTION)
    class CoveragePlanner:
        calls = []
        async def generic_reader_json(self, *, schema, data, **kwargs):
            kind = schema['properties']['stage']['const']
            self.calls.append((kind, data.get('phase')))
            assert kind == 'knowledge_coverage'
            selected = not late or data.get('phase') == 'consistency_review'
            return coverage_plan(value, user_choice=selected).model_dump()
    planner = CoveragePlanner()
    reader = GenericKnowledgeReader(NoBusiness(), planner, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 100
    reader.secrets = (); reader.current_question = QUESTION; reader.response_language = 'en'
    reader.knowledge = store(); reader.readonly_alternative = alternative(original)
    reader.remember_guidance_task = lambda t: setattr(reader, 'intent_state', save_intent(
        t, QUESTION, {}, 'late', 'owner', 'catalog', {}))
    with pytest.raises(PipelineError, match='intent_ambiguous'):
        asyncio.run(reader.check_knowledge(Principal('person-1', 'tenant', 'late'), value))
    assert len(planner.calls) == (2 if late else 1)
    assert pending_choices(reader) == ['recordIdentity', 'businessFocus']
    assert reader.intent_state['pendingClarification']['missingSlots'] == ['recordIdentity', 'businessFocus']
    assert reader.gateway.events == [] and not reader.audit.get('retrievals')
    # Completion cannot promote an injected covered answer or return technical knowledge while waiting.
    reader.knowledge_requirement_coverage = [{'requirementId': 'object', 'status': 'covered'}]
    out = reader.finish(task=value, knowledge_quotes=[{'text': 'A category definition'}],
        answer_blocks=[{'text': 'Your case is a violation.'}], answer_coverage=[
            {'requirementId': 'object', 'status': 'covered', 'quoteIndexes': [0], 'reason': 'alias'}],
        analysis={'outputs': [{'id': 'fabricated', 'value': 1}]}).result.public_json()
    assert out['result'] == 'not_confirmed' and out['missing'] == ['guidance_user_choice_required']
    assert not out['requirementsSatisfied'] and not out['knowledgeRequirementsSatisfied']
    assert not out['outputs'] and not out['knowledgeAnswer'] and not out['knowledgeQuotes']


@pytest.mark.parametrize('status', ['covered', 'partial', 'not_yet_verified', 'conflicting'])
def test_user_choice_cannot_be_covered_or_become_a_search(status):
    value = guidance_task(blocked(), QUESTION)
    plan = coverage_plan(value, status=status)
    knowledge = store(); knowledge.prompt()
    validate_coverage(plan, value, knowledge, readonly_alternative=True)
    check = next(c for c in plan.checks if c.requirementId == 'object')
    assert check.status == 'partial' and check.followupQuery == ''


def test_user_choice_schema_cannot_silently_enter_an_unrelated_live_workflow():
    value = guidance_task(blocked(), QUESTION)
    with pytest.raises(PipelineError, match='knowledge_user_choice_contract_invalid'):
        validate_coverage(coverage_plan(value), value, store())


def test_pending_state_blocks_direct_model_stage_and_guidance_validation():
    reader = GenericKnowledgeReader(NoBusiness(), Parsed(blocked()), portal_base_url='https://portal.test')
    state = new_choices(alternative(), ['recordIdentity'])
    attach_choices(reader, state)
    with pytest.raises(PipelineError, match='guidance_user_choice_required'):
        asyncio.run(reader.structured(TaskSpec, 'ignored', {}))
    with pytest.raises(PipelineError, match='guidance_user_choice_required'):
        validate_guidance_task(active_task(state, 'en'), reader.readonly_alternative)
    assert reader.planner.calls == []


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_actual_scope_challenge_cannot_relabel_pending_object_as_a_definition(language):
    recorded = CAPTURE['turns'][language]
    plan = KnowledgeScopeChallenge.model_validate(recorded['scopeChallenge']['review'])
    objects = [claim for check in plan.checks if check.candidateId.startswith(('answer:object', 'point:object'))
               for claim in check.claims]
    assert objects and all(c.supported for c in objects)  # Exact observed pre-fix model output.
    data = {'sources': [{'quoteIndex': i, **q} for i, q in enumerate(recorded['quotes'])],
        'candidateClaims': [{'candidateId': cid} for cid in recorded['scopeChallenge']['candidateOrigins']],
        'unresolvedUserChoices': ['recordIdentity']}
    validate_scope_challenge(plan, data)
    assert all(not c.supported for c in objects)


def test_arabic_complex_reply_retains_both_gaps_and_complete_unselected_input(tmp_path):
    captured = CAPTURE['turns']['ar']
    value = TaskSpec.model_validate(captured['readonlyAlternative']['requestedTask'])
    value.unresolvedSlots.append('businessFocus')  # Additional synthetic target gap, not captured evidence.
    _, first, _, _ = run_turn(tmp_path, value, captured['question'], language='ar',
        normalization=captured['normalization'], request_id='first')
    reply_text = 'إلى الإدارة المالية.'
    norm = {'stage': 'input_normalization', 'clauses': [
        {'sourceQuote': reply_text, 'english': 'To Finance.'}]}
    async def consume(cid, fingerprint): return True
    _, second, planner, gateway = run_turn(tmp_path, reply('businessFocus', 'Finance'), reply_text,
        context=context_from_state(first, captured['question']), language='ar',
        normalization=norm, claim=consume, request_id='second')
    assert second['clarification']['missingSlots'] == ['recordIdentity', 'businessFocus']
    assert second['intentState'][STATE_KEY]['replies'][0]['question'] == reply_text
    assert second['intentState'][STATE_KEY]['answers'] == []
    assert 'لم يُجرَ أي تعديل' in render_generic_answer(second, 'ar')
    assert gateway.events == ['identity'] and planner.calls == ['input_normalization', 'task']


@pytest.mark.parametrize('relation', ['new', 'switch', 'cancel'])
@pytest.mark.parametrize('invalid_state', [False, True])
def test_pipeline_new_topic_and_cancel_discard_pending_guidance_state(tmp_path, relation, invalid_state):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION)
    if invalid_state:
        first['intentState'][STATE_KEY]['pending'] = []
    fresh = task(contextRelation=relation, needsLiveData=False, requestedMeasures=[],
        requestedAttributes=['general description'], requestedGrain='unknown', recordIdentity='',
        businessFocus='', groupBy=[], filters=[], timeRange='unknown', view='')
    reader, out, _, gateway = run_turn(tmp_path, fresh, 'Cancel' if relation == 'cancel' else 'Explain crystals.',
        context=context_from_state(first, QUESTION), reader_type=StopAfterIntent, request_id='new')
    assert STATE_KEY not in out['intentState'] and not out.get('clarification')
    assert not getattr(reader, 'readonly_alternative', None)
    assert out['workflowState'] == ('cancelled' if relation == 'cancel' else 'ready')
    assert gateway.events == ['identity']


def test_invalid_saved_partition_does_not_silently_lose_pending_choice(tmp_path):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION)
    first['intentState'][STATE_KEY]['pending'] = []
    _, out, planner, gateway = run_turn(tmp_path, reply('businessFocus', 'Finance'), 'Finance',
        context=context_from_state(first, QUESTION))
    assert out['missing'] == ['guidance_choice_state_invalid']
    assert planner.calls == ['task'] and gateway.events == ['identity']


def test_long_accepted_question_retains_final_condition_instead_of_new_length_failure():
    long_question = 'Explain the original condition. ' * 500 + 'Do both actions only after final review.'
    alt = {**alternative(), 'originalQuestion': long_question, 'canonicalQuestion': long_question}
    state = new_choices(alt, ['recordIdentity'])
    assert state.originalQuestion == long_question
    assert any(a.endswith('Do both actions only after final review.') for a in active_task(state, 'en').requestedAttributes)


def test_partial_answer_preserves_late_knowledge_version_binding(tmp_path):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION)
    first['intentState']['knowledgeVersion'] = 'previous-documents'
    first['intentState']['pendingClarification']['knowledgeVersion'] = 'previous-documents'
    async def consume(cid, fingerprint): return True
    _, second, _, gateway = run_turn(tmp_path, reply('businessFocus', 'Finance'), 'Finance',
        context=context_from_state(first, QUESTION), claim=consume, request_id='second')
    assert second['intentState']['knowledgeVersion'] == 'previous-documents'
    assert second['clarification']['knowledgeVersion'] == 'previous-documents'
    assert second['clarification']['missingSlots'] == ['recordIdentity']
    assert gateway.events == ['identity']
