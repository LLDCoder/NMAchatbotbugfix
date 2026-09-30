from types import SimpleNamespace
import pytest
from app.generic_reader import PipelineError
from app.generic_reader_contracts import ClarificationRequest
from app.reader_clarification_guard import validate_semantic_options
from app.reader_page_clarification import page_clarification
from test_reader_context_v3 import task
from test_reader_page_clarification import fixture


def request(field, values):
    return ClarificationRequest(question='Which meaning?', missingSlots=[field], options=[{
        'id': 'choice', 'label': 'Alternative', 'updates': [{'field': field, 'value': values, 'source': 'knowledge'}]}])


@pytest.mark.parametrize('values', [['state'], ['state', 'lateness'], ['state', 'VIP']])
def test_missing_group_definition_cannot_drop_or_substitute_requested_dimension(values):
    draft = task(groupBy=['state', 'urgency'])
    candidate = draft.model_copy(update={'clarification': request('groupBy', values)})
    with pytest.raises(PipelineError, match='clarification_semantic_alternatives_unverified'):
        validate_semantic_options(draft, candidate, SimpleNamespace(items={}), ['/specimens'], 'en')


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_documented_choices_preserve_other_requested_clauses(language):
    draft, knowledge, _, _ = fixture()
    clarification, _ = page_clarification(draft, knowledge, ['/specimens'], language)
    validate_semantic_options(draft, SimpleNamespace(clarification=clarification), knowledge, ['/specimens'], language)


def test_user_decided_unset_scope_remains_a_valid_question():
    draft = task(requestedScope='unknown')
    candidate = draft.model_copy(update={'clarification': request('requestedScope', 'personal')})
    validate_semantic_options(draft, candidate, SimpleNamespace(items={}), [], 'en')


def test_free_text_prompt_cannot_reclassify_missing_definition_as_user_ambiguity():
    draft = task(groupBy=['state', 'urgency'])
    question = ClarificationRequest(question='What does urgency mean?', missingSlots=['groupBy'], options=[])
    with pytest.raises(PipelineError, match='clarification_semantic_alternatives_unverified'):
        validate_semantic_options(draft, draft.model_copy(update={'clarification': question}), SimpleNamespace(items={}), [], 'ar')
