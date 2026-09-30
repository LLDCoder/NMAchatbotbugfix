"""Persisted alias collisions must not choose or consume an arbitrary mapping."""
from copy import deepcopy
import json

import pytest

from app.generic_reader_contracts import ClarificationRequest, SlotUpdate
from app.reader_context import context_from_state, literal_choice
from app.reader_guidance_choices import STATE_KEY
from test_reader_guidance_positive_selection import typed_task
from test_reader_guidance_user_choice import QUESTION, reply, run_turn, StopAfterIntent


def colliding_task(kind):
    task = typed_task()
    first, second = task.clarification.options
    if kind == 'label':
        second.label = first.label
        answer = first.label
    elif kind == 'id':
        second.id = first.id
        answer = first.id
    else:
        first.id = '2'
        answer = '2'
    # Exercise the actual typed entry, rather than mutate saved history.
    return task.model_validate(task.model_dump()), answer


@pytest.mark.parametrize('kind', ['label', 'id', 'numeric_alias'])
@pytest.mark.parametrize('relation', ['clarify', 'new'])
@pytest.mark.parametrize('parser_uses_alias', [False, True])
def test_colliding_alias_stays_pending_without_claim_or_bare_value_fallback(
        tmp_path, kind, relation, parser_uses_alias):
    task, answer = colliding_task(kind)
    _, first, _, _ = run_turn(tmp_path, task, QUESTION, request_id='first')
    claims = []
    async def claim(cid, fingerprint): claims.append(cid); return True
    parsed = reply('businessFocus', answer if parser_uses_alias else 'MODEL-GUESS', contextRelation=relation)
    reader, public, planner, gateway = run_turn(tmp_path, parsed, answer,
        context=context_from_state(first, QUESTION), claim=claim, reader_type=StopAfterIntent, request_id='second')
    assert not hasattr(reader, 'accepted_guidance') and not claims
    assert public['missing'] == ['intent_ambiguous']
    state = public['intentState'][STATE_KEY]
    assert state['pending'] == ['businessFocus'] and state['answers'] == []
    assert state['requestedTask'] == first['intentState'][STATE_KEY]['requestedTask']
    assert state['replies'] == [{'question': answer, 'canonicalQuestion': answer}]
    assert any(answer in item for item in public['intentState']['task']['requestedAttributes'])
    assert public['intentState']['clarificationRounds'] == 2
    assert public['intentState']['parentRequestId'] == 'first'
    assert public['clarification']['options'] == first['clarification']['options']
    assert public['requestedActionExecuted'] is False and not public['requirementsSatisfied']
    assert planner.calls == ['task'] and gateway.events == ['identity']


def choice_history(first_updates, second_updates):
    request = ClarificationRequest(question='Choose one.', missingSlots=['businessFocus'], options=[
        {'id': 'a', 'label': 'Shared', 'updates': first_updates},
        {'id': 'b', 'label': 'Shared', 'updates': second_updates}])
    return {'previousIntent': {'pendingClarification': {**request.model_dump(), 'id': 'turn:clarification'}}}


@pytest.mark.parametrize('change', ['value', 'field', 'source', 'evidence', 'scalar_list',
    'list_order', 'list_member', 'case', 'numeric_text', 'extra_field', 'duplicate_field'])
def test_complete_typed_mapping_differences_are_not_collapsed(change):
    before = [{'field': 'businessFocus', 'value': 'Finance', 'source': 'current', 'evidence': 'selected'}]
    after = deepcopy(before)
    if change == 'value': after[0]['value'] = 'Legal'
    elif change == 'field': after[0]['field'] = 'businessObject'
    elif change == 'source': after[0]['source'] = 'knowledge'
    elif change == 'evidence': after[0]['evidence'] = 'different evidence'
    elif change == 'scalar_list': after[0]['value'] = ['Finance']
    elif change == 'list_order':
        before[0]['value'], after[0]['value'] = ['Finance', 'Legal'], ['Legal', 'Finance']
    elif change == 'list_member':
        before[0]['value'], after[0]['value'] = ['Finance', 'Legal'], ['Finance', 'Review']
    elif change == 'case': after[0]['value'] = 'finance'
    elif change == 'numeric_text': before[0]['value'], after[0]['value'] = '02', '2'
    elif change == 'extra_field':
        after.append({'field': 'recordIdentity', 'value': 'PX-12', 'source': 'current'})
    else: after.append(deepcopy(after[0]))
    assert literal_choice('Shared', choice_history(before, after)) is None


def test_equal_complete_mapping_accepts_distinct_field_order_and_default_evidence():
    before = [{'field': 'businessFocus', 'value': 'Finance', 'source': 'current'},
              {'field': 'filters', 'value': ['review', 'confirm'], 'source': 'current', 'evidence': 'original'}]
    after = [deepcopy(before[1]), {**before[0], 'evidence': ''}]
    history = choice_history(before, after)
    chosen = literal_choice('Shared', history)
    assert chosen == {'clarificationId': 'turn:clarification', 'choiceId': 'a',
        'updates': [SlotUpdate.model_validate(u).model_dump() for u in before]}


def test_duplicate_field_mapping_has_no_unique_semantics_even_if_identical():
    updates = [{'field': 'businessFocus', 'value': 'Finance', 'source': 'current'},
               {'field': 'businessFocus', 'value': 'Legal', 'source': 'current'}]
    assert literal_choice('Shared', choice_history(updates, updates)) is None


@pytest.mark.parametrize('kind', ['label', 'id', 'numeric_alias'])
def test_equivalent_aliases_can_complete_with_one_claim(tmp_path, kind):
    task, answer = colliding_task(kind)
    task.clarification.options[1].updates = deepcopy(task.clarification.options[0].updates)
    _, first, _, _ = run_turn(tmp_path, task, QUESTION, request_id='first')
    claims = []
    async def claim(cid, fingerprint): claims.append(cid); return True
    reader, public, _, _ = run_turn(tmp_path, reply('businessFocus', 'MODEL-GUESS', contextRelation='new'), answer,
        context=context_from_state(first, QUESTION), claim=claim, reader_type=StopAfterIntent, request_id='second')
    assert hasattr(reader, 'accepted_guidance') and claims == ['first:clarification']
    state = public['intentState'][STATE_KEY]
    assert state['pending'] == [] and len(state['answers']) == 1
    assert state['answers'][0]['value'] == 'Finance Department'
    assert state['answers'][0]['selection']['request']['options'] == first['clarification']['options']


@pytest.mark.parametrize('kind', ['label', 'id', 'numeric_alias'])
def test_unique_reply_after_collision_resolves_within_original_budget(tmp_path, kind):
    task, answer = colliding_task(kind)
    _, first, _, _ = run_turn(tmp_path, task, QUESTION, request_id='first')
    claims = []
    async def claim(cid, fingerprint): claims.append(cid); return True
    _, second, _, _ = run_turn(tmp_path, reply('businessFocus', answer, contextRelation='new'), answer,
        context=context_from_state(first, QUESTION), claim=claim, request_id='second')
    # First display position has no colliding id/label in these fixtures.
    reader, third, _, _ = run_turn(tmp_path, reply('businessFocus', 'MODEL-GUESS'), '1',
        context=context_from_state(json.loads(json.dumps(second)), answer), claim=claim,
        reader_type=StopAfterIntent, request_id='third')
    assert hasattr(reader, 'accepted_guidance') and claims == ['second:clarification']
    saved = third['intentState'][STATE_KEY]
    assert not saved['pending'] and saved['answers'][0]['value'] == 'Finance Department'
    assert [r['question'] for r in saved['replies']] == [answer, '1']


def test_repeated_collision_cannot_reset_two_round_budget_as_new_topic(tmp_path):
    task, answer = colliding_task('numeric_alias')
    _, public, _, _ = run_turn(tmp_path, task, QUESTION, request_id='first')
    claims = []
    async def claim(cid, fingerprint): claims.append(cid); return True
    for request_id in ['second', 'third']:
        reader, public, _, _ = run_turn(tmp_path, reply('businessFocus', answer, contextRelation='new'), answer,
            context=context_from_state(public, QUESTION), claim=claim,
            reader_type=StopAfterIntent, request_id=request_id)
    assert not claims and not hasattr(reader, 'accepted_guidance')
    assert public['missing'] == ['clarification_budget_exhausted'] and not public.get('clarification')
    assert public['intentState'][STATE_KEY]['pending'] == ['businessFocus']
    assert len(public['intentState'][STATE_KEY]['replies']) == 2
