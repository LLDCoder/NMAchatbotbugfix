"""A mention, a negation or model-translated alias is not an affirmative choice."""
import json
from copy import deepcopy

import pytest

from app.generic_reader import clean, semantic_history, PipelineError
from app.generic_reader_contracts import TaskSpec, ClarificationRequest, SlotUpdate
from app.reader_context import context_from_state
from app.reader_guidance_choices import new_choices, resume_choices, active_task, STATE_KEY
from app.reader_routing import task_fingerprint
from test_reader_guidance_user_choice import (alternative, bound, reply, blocked, run_turn,
    StopAfterIntent, QUESTION)


NEGATIVE = [
    ('Do not transfer it to Finance.', 'Finance', 'Do not transfer it to Finance.'),
    ('Finance or Legal?', 'Finance', 'Finance or Legal?'),
    ('Finance only if the review allows it; otherwise leave the destination undecided.', 'Finance',
     'Finance only if the review allows it; otherwise leave the destination undecided.'),
    ('The manual says "Finance"; I have not selected a destination.', 'Finance',
     'The manual says "Finance"; I have not selected a destination.'),
    ('لا تحولها إلى الإدارة المالية.', 'Finance', 'Do not transfer it to Finance.'),
    ('لا تحولها إلى الإدارة المالية.', 'Finance', 'Finance'),  # Faulty translation drops negation.
    ('لا', 'Finance', 'Finance'),
    ('المالية', 'Finance', 'Finance'),  # Translation alone is not a supplied literal name.
    ('المالية؟', 'المالية', 'Finance'),
    ('Finance?', 'Finance', 'Finance?'),
    ('"Finance"', 'Finance', '"Finance"'),
    ('Finance/Legal', 'Finance', 'Finance/Legal'),
    ('Finance, Legal', 'Finance', 'Finance, Legal'),
    ('finance', 'Finance', 'Finance'),  # Preserve the actual supplied literal; no renaming.
    ('ＰＸ－１２', 'PX-12', 'PX-12'),
]


@pytest.mark.parametrize('question,value,canonical', NEGATIVE)
def test_non_selection_never_clears_pending_even_when_parser_claims_current_value(question, value, canonical):
    state = new_choices(alternative(), ['businessFocus'])
    updated, accepted = resume_choices(bound(state), reply('businessFocus', value), question, canonical,
        'owner', 'catalog')
    assert accepted == [] and updated.pending == ['businessFocus']
    assert updated.answers == []
    assert updated.replies[0].question == question and updated.replies[0].canonicalQuestion == canonical
    active = active_task(updated, 'ar' if 'لا' in question else 'en', 'clarify')
    assert active.clarification and any(question in a and canonical in a for a in active.requestedAttributes)


@pytest.mark.parametrize('value', ['No', 'Not', 'NO', 'None', 'Maybe', 'Nope', 'Never', 'unknown',
    'لا', 'ﻻ', 'كلا', 'لم', 'ليس', 'نعم', 'No-Finance', 'not_Finance',
    'Finance?', 'Finance؟', 'Finance or Legal', 'Do not transfer it to Finance.',
    'Finance only if approved', '"Finance"', 'Finance/Legal'])
def test_whole_negative_or_sentence_as_value_is_not_a_selection(value):
    state = new_choices(alternative(), ['businessFocus'])
    updated, accepted = resume_choices(bound(state), reply('businessFocus', value), value, value, 'owner', 'catalog')
    assert not accepted and updated.pending == ['businessFocus']


@pytest.mark.parametrize('value', ['Finance', 'Legal', 'المالية', 'PX-12', 'AB_123', '99123'])
def test_bare_user_literal_with_one_field_is_direct_selection(value):
    state = new_choices(alternative(), ['businessFocus'])
    updated, accepted = resume_choices(bound(state), reply('businessFocus', value), value, value, 'owner', 'catalog')
    assert accepted == ['businessFocus'] and not updated.pending
    assert updated.answers[0].value == value and updated.answers[0].selection is None


@pytest.mark.parametrize('question,value,canonical', NEGATIVE[:9])
def test_full_run_does_not_consume_negative_or_translated_choice(tmp_path, question, value, canonical):
    _, first, _, _ = run_turn(tmp_path, blocked(['businessFocus']), QUESTION, request_id='first')
    claims = []
    async def consume(cid, fingerprint): claims.append(cid); return True
    language = 'ar' if any('\u0600' <= c <= '\u06ff' for c in question) else 'en'
    norm = {'stage': 'input_normalization', 'clauses': [{'sourceQuote': question, 'english': canonical}]}
    reader, public, planner, gateway = run_turn(tmp_path, reply('businessFocus', value), question,
        context=context_from_state(first, QUESTION), language=language, normalization=norm,
        claim=consume, reader_type=StopAfterIntent, request_id='second')
    assert public['missing'] == ['intent_ambiguous']
    assert public['clarification']['missingSlots'] == ['businessFocus']
    assert not hasattr(reader, 'accepted_guidance') and claims == []
    assert gateway.events == ['identity']
    assert public['requestedActionExecuted'] is False
    assert public['intentState'][STATE_KEY]['replies'][0]['question'] == question


def test_one_bare_value_cannot_resolve_two_different_fields():
    state = new_choices(alternative(), ['businessObject', 'businessFocus'])
    parsed = reply('businessFocus', 'Finance')
    parsed.businessObject = 'Finance'
    parsed.slotUpdates.append(parsed.slotUpdates[0].model_copy(update={'field': 'businessObject'}))
    updated, accepted = resume_choices(bound(state), parsed, 'Finance', 'Finance', 'owner', 'catalog')
    assert not accepted and updated.pending == ['businessObject', 'businessFocus']


def typed_task():
    value = blocked(['businessFocus'])
    value.clarification = ClarificationRequest(question='Select the destination.', missingSlots=['businessFocus'],
        options=[{'id': 'destination-a', 'label': 'Finance Department',
            'updates': [{'field': 'businessFocus', 'value': 'Finance Department', 'source': 'current'}]},
            {'id': 'destination-b', 'label': 'Legal Affairs',
            'updates': [{'field': 'businessFocus', 'value': 'Legal Affairs', 'source': 'current'}]}])
    return value


@pytest.mark.parametrize('answer,expected', [('1', 'Finance Department'), ('2', 'Legal Affairs'),
    ('destination-b', 'Legal Affairs'), ('Legal Affairs', 'Legal Affairs')])
def test_current_persisted_typed_choice_is_consumed_independently_of_model_value(tmp_path, answer, expected):
    _, first, _, _ = run_turn(tmp_path, typed_task(), QUESTION, request_id='first')
    assert len(first['clarification']['options']) == 2
    claims = []
    async def consume(cid, fingerprint): claims.append(cid); return True
    # The original persisted mapping, not this unrelated model guess, decides.
    parsed = reply('businessFocus', 'MODEL-GUESS', contextRelation='new')
    reader, out, _, gateway = run_turn(tmp_path, parsed, answer,
        context=context_from_state(first, QUESTION), claim=consume, reader_type=StopAfterIntent, request_id='second')
    assert out['missing'] == ['test_guidance_ready'] and claims == ['first:clarification']
    state = out['intentState'][STATE_KEY]
    assert not state['pending'] and state['answers'][0]['value'] == expected
    assert state['answers'][0]['selection']['clarificationId'] == 'first:clarification'
    assert expected in str(reader.accepted_guidance.requestedAttributes)
    # Full public JSON/clean/history projection keeps the proof and original input.
    projected = semantic_history(context_from_state(json.loads(json.dumps(clean(out))), answer))
    assert projected['previousIntent'][STATE_KEY] == state
    assert gateway.events == ['identity']


@pytest.mark.parametrize('fault', ['options', 'id', 'knowledge_version', 'owner', 'ttl'])
def test_typed_choice_cannot_use_a_changed_or_expired_mapping(fault):
    state = new_choices(alternative(typed_task()), ['businessFocus'])
    history = bound(state)
    previous = history['previousIntent']
    if fault == 'options': previous['pendingClarification']['options'][0]['updates'][0]['value'] = 'Injected target'
    if fault == 'id': previous['pendingClarification']['id'] = 'old:clarification'
    if fault == 'knowledge_version': previous['pendingClarification']['knowledgeVersion'] = 'different'
    if fault == 'owner': previous['principalFingerprint'] = 'other-owner'
    if fault == 'ttl': previous['pendingClarification']['expiresAt'] = '2000-01-01T00:00:00+00:00'
    with pytest.raises(PipelineError, match='clarification_context_expired'):
        resume_choices(history, reply('businessFocus', 'Finance'), '1', '1', 'owner', 'catalog')


@pytest.mark.parametrize('question', ['1?', 'not 1', 'Do not select Legal Affairs.', 'Finance Department or Legal Affairs?'])
def test_a_persisted_option_mention_is_still_not_a_choice(question):
    state = new_choices(alternative(typed_task()), ['businessFocus'])
    updated, accepted = resume_choices(bound(state), reply('businessFocus', 'Legal Affairs'), question, question,
        'owner', 'catalog')
    assert not accepted and updated.pending == ['businessFocus']


def test_cumulative_unselected_conditions_survive_clean_transport_and_budget_end(tmp_path):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION, request_id='first')
    context = context_from_state(first, QUESTION)
    messages = ['Do not transfer to Finance. ' * 90 + 'Keep the first final condition.',
                'Do not close before review. ' * 90 + 'Keep the second final condition.']
    for index, message in enumerate(messages, 2):
        _, out, _, gateway = run_turn(tmp_path, reply('businessFocus', 'Finance'), message,
            context=context, request_id=str(index))
        restored = json.loads(json.dumps(clean(out), ensure_ascii=False))
        assert restored['taskFingerprint'] == task_fingerprint(TaskSpec.model_validate(restored['intentState']['task']))
        state = restored['intentState'][STATE_KEY]
        assert [r['question'] for r in state['replies']] == messages[:index-1]
        assert all(any(m in a for a in restored['intentState']['task']['requestedAttributes']) for m in messages[:index-1])
        assert state['pending'] == ['recordIdentity', 'businessFocus'] and not state['answers']
        assert gateway.events == ['identity']
        context = context_from_state(restored, message)
    assert out['missing'] == ['clarification_budget_exhausted']
    assert out['workflowState'] == 'needs_input' and not out.get('clarification')


def test_partial_explicit_value_keeps_an_earlier_negative_condition(tmp_path):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION, request_id='first')
    negative = 'Do not use Finance; preserve the review requirement.'
    _, second, _, _ = run_turn(tmp_path, reply('businessFocus', 'Finance'), negative,
        context=context_from_state(first, QUESTION), request_id='second')
    claims = []
    async def consume(cid, fingerprint): claims.append(cid); return True
    _, third, _, _ = run_turn(tmp_path, reply('recordIdentity', 'PX-12'), 'PX-12',
        context=context_from_state(second, negative), claim=consume, request_id='third')
    state = third['intentState'][STATE_KEY]
    assert state['pending'] == ['businessFocus'] and claims == ['second:clarification']
    assert [a['field'] for a in state['answers']] == ['recordIdentity']
    assert any(negative in a for a in third['intentState']['task']['requestedAttributes'])
    assert third['missing'] == ['clarification_budget_exhausted']


@pytest.mark.parametrize('mode,question', [
    ('clear_unresolved', 'Use Finance, but I withdraw PX-12; the record is still undecided.'),
    ('replace', 'Use PX-13 instead, and select Finance.'),
    ('clear', 'Select Finance. Clear the previous record selection.'),
    ('unresolved', 'The record is undecided; Finance is only a possible destination.'),
])
def test_current_revision_reopens_an_answered_slot_before_other_selection(tmp_path, mode, question):
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION, request_id='first')
    async def consume(cid, fingerprint): return True
    _, second, _, _ = run_turn(tmp_path, reply('recordIdentity', 'PX-12'), 'PX-12',
        context=context_from_state(first, QUESTION), claim=consume, request_id='second')
    parsed = reply('businessFocus', 'Finance')
    if mode in {'clear', 'clear_unresolved', 'replace'}:
        replacement = 'PX-13' if mode == 'replace' else ''
        parsed.recordIdentity = replacement
        parsed.slotUpdates.append(SlotUpdate(field='recordIdentity', value=replacement,
            source='current' if mode == 'replace' else 'clear'))
    if mode in {'unresolved', 'clear_unresolved'}:
        parsed.unresolvedSlots = ['recordIdentity']
    reader, third, _, gateway = run_turn(tmp_path, parsed, question,
        context=context_from_state(second, 'PX-12'), claim=consume,
        request_id='third', reader_type=StopAfterIntent)
    state = third['intentState'][STATE_KEY]
    assert not hasattr(reader, 'accepted_guidance')
    assert state['pending'] == ['recordIdentity', 'businessFocus']
    assert state['answers'] == [] and third['intentState']['task']['recordIdentity'] == ''
    assert any(question in a for a in third['intentState']['task']['requestedAttributes'])
    assert third['missing'] == ['clarification_budget_exhausted'] and gateway.events == ['identity']


def test_bare_replacement_can_replace_old_answer_but_cannot_also_resolve_target():
    state = new_choices(alternative(), ['recordIdentity', 'businessFocus'])
    partial, _ = resume_choices(bound(state), reply('recordIdentity', 'PX-12'), 'PX-12', 'PX-12', 'owner', 'catalog')
    updated, accepted = resume_choices(bound(partial), reply('recordIdentity', 'PX-13'), 'PX-13', 'PX-13', 'owner', 'catalog')
    assert accepted == ['recordIdentity'] and updated.pending == ['businessFocus']
    assert [a.value for a in updated.answers] == ['PX-13']
    assert active_task(updated, 'en').recordIdentity == 'PX-13'
    assert [r.question for r in updated.replies] == ['PX-12', 'PX-13']


@pytest.mark.parametrize('transport', ['event', 'evidence_audit', 'shallow_audit'])
def test_typed_partial_transport_preserves_proof_or_fails_closed_at_existing_depth_limit(tmp_path, transport):
    from app.service import DSHService, _reader_conversation_context
    from types import SimpleNamespace
    original = typed_task().model_copy(update={'unresolvedSlots': ['recordIdentity', 'businessFocus']})
    _, first, _, _ = run_turn(tmp_path, original, QUESTION, request_id='first')
    async def consume(cid, fingerprint): return True
    _, second, _, _ = run_turn(tmp_path, reply('businessFocus', 'model_guess'), '2',
        context=context_from_state(first, QUESTION), claim=consume, request_id='second')
    assert second['clarification']['missingSlots'] == ['recordIdentity']
    saved = json.loads(json.dumps(second))
    if transport != 'event':
        saved = DSHService.audit_payload(saved, max_depth=16 if transport == 'evidence_audit' else 8)
    events = [SimpleNamespace(event_type='user.message', event_json={'content': '2'}),
        SimpleNamespace(event_type='reader.result', event_json=saved),
        SimpleNamespace(event_type='user.message', event_json={'content': 'PX-12'})]
    context = _reader_conversation_context(events, events[-1])
    reader, out, _, gateway = run_turn(tmp_path, reply('recordIdentity', 'PX-12'), 'PX-12',
        context=context, claim=consume, reader_type=StopAfterIntent, request_id='third')
    if transport == 'shallow_audit':
        # The existing shallow audit is not the full session event. Do not
        # widen its global budget or silently promote a truncated choice proof.
        assert '[max-depth]' in json.dumps(saved)
        assert out['missing'] == ['guidance_choice_state_invalid']
        assert not hasattr(reader, 'accepted_guidance')
    else:
        assert out['missing'] == ['test_guidance_ready']
        assert reader.accepted_guidance.recordIdentity == 'PX-12'
        assert out['intentState'][STATE_KEY]['answers'][0]['value'] == 'Legal Affairs'
    assert gateway.events == ['identity']


def test_long_unselected_followups_survive_actual_audit_redaction_and_event_history(tmp_path):
    from app.service import DSHService, _reader_conversation_context
    from types import SimpleNamespace
    _, first, _, _ = run_turn(tmp_path, blocked(), QUESTION, request_id='first')
    sentence = 'Do not transfer to Finance until review. ' * 100 + 'Retain the final condition.'
    _, second, _, _ = run_turn(tmp_path, reply('businessFocus', 'Finance'), sentence,
        context=context_from_state(first, QUESTION), request_id='second')
    saved = DSHService.audit_payload(json.loads(json.dumps(second)))
    assert saved['intentState'][STATE_KEY]['replies'][0]['question'] == sentence
    assert '[max-depth]' not in json.dumps(saved)
    events = [SimpleNamespace(event_type='user.message', event_json={'content': sentence}),
        SimpleNamespace(event_type='reader.result', event_json=saved),
        SimpleNamespace(event_type='user.message', event_json={'content': 'PX-12'})]
    context = _reader_conversation_context(events, events[-1])
    async def consume(cid, fingerprint): return True
    _, third, _, _ = run_turn(tmp_path, reply('recordIdentity', 'PX-12'), 'PX-12',
        context=context, claim=consume, request_id='third')
    assert third['missing'] == ['clarification_budget_exhausted']
    assert third['intentState'][STATE_KEY]['replies'][0]['question'] == sentence
    assert any(sentence in a for a in third['intentState']['task']['requestedAttributes'])
