from copy import deepcopy
from datetime import datetime, timedelta, timezone
import pytest
from types import SimpleNamespace
from app.reader_context import bind_history, clarification_question, literal_choice
from app.reader_intent_aliases import bind_translation_alternatives
from app.reader_requirements import _semantic_match
from test_reader_context_v3 import task, history_for
from test_reader_intent_aliases import count_fixture


def pending():
    facts, ctx = count_fixture()
    value = task(requestedScope='unknown', unresolvedSlots=['requestedScope'], clarification={
        'question': 'Which scope?', 'missingSlots': ['requestedScope'], 'options': [
            {'id': 'team', 'label': 'Managed team', 'updates': [
                {'field': 'requestedScope', 'source': 'current', 'value': 'team'}]}]})
    return facts, ctx, history_for(value, ctx['question'])


def test_current_bound_choice_keeps_literal_evidence_without_changing_current_input():
    facts, ctx, history = pending()
    history = bind_history(history, 'principal', 'catalog')
    choice = literal_choice('1', history)
    before = deepcopy(history)
    ctx['question'] = clarification_question('1', history, choice)
    bind_translation_alternatives(facts, ctx)
    assert history == before
    binding = SimpleNamespace(knowledgeBindingId='fact', sourcePath='/data/items', fields=['id'])
    assert _semantic_match(binding, ctx['requirements'][0], {'operationRef': 'GET /parcels'}, {'fact': facts[0]})


@pytest.mark.parametrize('fault', ['expired', 'principal', 'catalog', 'fingerprint', 'no_principal',
    'wrong_choice', 'unrelated', 'no_expiry', 'wrong_updates'])
def test_unbound_or_unrelated_input_cannot_borrow_original_question(fault):
    _, _, history = pending()
    current = '1'
    choice = literal_choice(current, history)
    previous = history['previousIntent']
    if fault == 'expired':
        previous['pendingClarification']['expiresAt'] = (datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()
    if fault == 'fingerprint': previous['pendingClarification']['taskFingerprint'] = 'another-task'
    if fault == 'no_principal': previous.pop('principalFingerprint')
    if fault == 'wrong_choice': choice['choiceId'] = 'invented'
    if fault == 'wrong_updates': choice = {**choice, 'updates': []}
    if fault == 'unrelated': current = 'Show another collection.'
    if fault == 'no_expiry': previous['pendingClarification'].pop('expiresAt')
    history = bind_history(history, 'other' if fault == 'principal' else 'principal',
        'new' if fault == 'catalog' else 'catalog')
    assert clarification_question(current, history, choice) == current
