"""Read-only independent acceptance counterexamples; no live sources fabricated."""
import copy
from types import SimpleNamespace

import pytest
from app.reader_expansion import QueryExpansion, validate_expansion
from app.reader_requirements import requirements_for, _semantic_match
from test_reader_current_view_membership import RAW, KEY, fixture, match


@pytest.mark.parametrize('question', [
    'Show urgent applications currently in my Licensing To Do queue.',
    'Show the applications currently in my Licensing To Do queue with status approved.',
    'Show the applications currently in my Licensing To Do queue created yesterday.',
    'Show the applications currently in my Licensing To Do queue or in my Content To Do queue.',
    "Don't show the applications currently in my Licensing To Do queue.",
    'Never show the applications currently in my Licensing To Do queue.',
    'Explain my earlier request: "Show the applications currently in my Licensing To Do queue."',
    'As of last month, show the applications currently in my Licensing To Do queue.',
])
def test_unrepresented_original_clause_outside_positive_span_cannot_gain_membership_alias(question):
    task, kb, source = fixture()
    kb.intent_lexical_context['question'] = question
    # An incorrect model "consistent" response is schema-valid today. The new
    # deterministic current-span path must not treat that declaration as proof
    # that the rest of the question was represented in TaskSpec.
    expansion = QueryExpansion(stage='query_expansion', intentStatus='consistent', issues=[], terms=RAW['terms'])
    validate_expansion(expansion, task, question)
    matched, _ = match(task, kb, source)
    assert not matched, 'Positive span accepted despite an unrepresented original clause: ' + question


@pytest.mark.parametrize('question', [
    'Do not show the applications currently in my Licensing To Do queue.',
    'Show all applications except those currently in my Licensing To Do queue.',
    'Show applications currently in my Licensing To Do queue and currently in my Licensing To Do queue.',
])
def test_supported_negative_and_duplicate_span_are_still_rejected(question):
    task, kb, source = fixture()
    kb.intent_lexical_context['question'] = question
    assert not match(task, kb, source)[0]


@pytest.mark.parametrize('mutation', ['requirement_value', 'requirement_delete', 'filters_retained',
    'source_owner', 'source_time', 'source_task', 'source_proof', 'alias_quote', 'alias_task'])
def test_independent_owner_task_origin_and_requirement_controls_fail_closed(mutation):
    task, kb, source = fixture()
    if mutation == 'requirement_value': kb.intent_lexical_context['requirements'][0]['value'] = 'different'
    elif mutation == 'requirement_delete': kb.intent_lexical_context['requirements'].pop()
    elif mutation == 'filters_retained':
        task, kb, source = fixture({'filters': ['status approved']})
    elif mutation == 'source_owner': source['principalScopeRef'] = 'another user'
    elif mutation == 'source_time': source['capturedAt'] = '2025-01-01T00:00:00Z'
    elif mutation == 'source_task': source['taskFingerprint'] = 'model supplied task'
    elif mutation == 'source_proof': source['sourceViewProof']['authority'] = 'model'
    if mutation.startswith('alias_'):
        _, facts = match(task, kb, source)
        alias = next(a for a in facts[KEY]['intentAliases'] if a.get('currentObservationReference'))
        alias['currentObservationReference']['quote' if mutation == 'alias_quote' else 'taskFingerprint'] = 'forged'
        requirement = next(r for r in requirements_for(task) if r['id'] == 'population')
        assert not _semantic_match(SimpleNamespace(**RAW['populationBinding']), requirement, source, facts)
    else:
        assert not match(task, kb, source)[0]


def test_original_capture_replay_preserves_all_original_requirements_and_unreachable_grain_evidence():
    task, kb, source = fixture()
    task_before, requirements_before, source_before = task.model_dump(), copy.deepcopy(kb.intent_lexical_context['requirements']), copy.deepcopy(source)
    assert match(task, kb, source)[0]
    assert task.model_dump() == task_before == RAW['task']
    assert kb.intent_lexical_context['requirements'] == requirements_before == RAW['requirements']
    assert source == source_before == RAW['source']
    second = RAW['rejectedPlanFailures'][1]['failure']
    assert second['code'] == 'requirement_output_unreachable'
    assert second['requirementId'] == 'grain' and second['unreachableStepIds'] == ['distinct_applications']
