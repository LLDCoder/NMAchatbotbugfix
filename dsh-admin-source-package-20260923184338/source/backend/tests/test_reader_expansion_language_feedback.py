"""Captured v37 QE failure and controlled new model replies; never live model calls."""
import asyncio
import copy
import json
from pathlib import Path
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_expansion import (InputNormalization, PROMPT, QueryExpansion,
                                  validate_expansion, validate_normalization)
from app.reader_requirements import requirements_for

SAVED = json.loads((Path(__file__).parent / 'fixtures/expansion_language_c05_ar_v37.json').read_text())
QUESTION = SAVED['originalQuestion']


def captured(index=1):
    return (TaskSpec.model_validate(SAVED['revisedTask']),
            QueryExpansion.model_validate(SAVED['rejected'][index]['candidate']))


def view(plan):
    return next(term for term in plan.terms if term.requirementId == 'view')


def controlled_reply(index=1):
    task, plan = captured(index)
    # This is a simulated NEW model reply, never a production repair or a live pass.
    view(plan).english = 'view "قيد الإنجاز"'
    return task, plan


@pytest.mark.parametrize('index', [0, 1])
def test_actual_v37_main_english_failures_have_exact_safe_locator_without_mutation(index):
    task, plan = captured(index)
    before = copy.deepcopy((task.model_dump(), plan.model_dump()))
    validate_normalization(InputNormalization.model_validate(SAVED['normalization']), QUESTION)
    assert json.loads(SAVED['rejected'][index]['failure']) == {
        'code': 'expansion_english_missing', 'stage': 'query_expansion'}
    with pytest.raises(PipelineError, match='expansion_english_missing') as error:
        validate_expansion(plan, task, QUESTION)
    assert error.value.details == {
        'stage': 'query_expansion', 'termIndex': 5, 'requirementId': 'view',
        'requirementKind': 'view', 'field': 'english', 'path': ['terms', 5, 'english'],
        'correction': error.value.details['correction']}
    correction = error.value.details['correction']
    assert 'main english field itself' in correction and 'alternatives do not satisfy' in correction
    assert 'view "<exact original label>"' in correction
    assert 'قيد الإنجاز' not in json.dumps(error.value.details, ensure_ascii=False)
    assert (task.model_dump(), plan.model_dump()) == before


def test_first_needs_revision_still_only_checks_issue_quotes_not_terms_or_clause_resolution():
    task = TaskSpec.model_validate(SAVED['initialTask'])
    plan = QueryExpansion.model_validate(SAVED['firstExpansion'])
    before = copy.deepcopy((task.model_dump(), plan.model_dump()))
    validate_expansion(plan, task, QUESTION)
    assert plan.intentStatus == 'needs_revision' and len(plan.issues) == 2
    assert 'domain qualifier' in plan.issues[1].reason
    assert (task.model_dump(), plan.model_dump()) == before
    forced = plan.model_copy(update={'intentStatus': 'consistent', 'issues': []}, deep=True)
    with pytest.raises(PipelineError, match='expansion_named_view_phrase_changed'):
        validate_expansion(forced, task, QUESTION)
    plan.issues[0].quote = 'invented original clause'
    with pytest.raises(PipelineError, match='intent_review_quote_invalid'):
        validate_expansion(plan, task, QUESTION)


@pytest.mark.parametrize('index', [0, 1])
def test_controlled_reply_changes_one_main_field_only_and_cannot_validate_the_revised_task_semantics(index):
    task, original = captured(index); _, reply = controlled_reply(index)
    before = copy.deepcopy((task.model_dump(), reply.model_dump()))
    validate_expansion(reply, task, QUESTION)
    expected = original.model_dump(); expected['terms'][5]['english'] = 'view "قيد الإنجاز"'
    assert reply.model_dump() == expected
    assert (task.model_dump(), reply.model_dump()) == before
    assert task.filters == ['within the licenses'] and task.view == '"قيد الإنجاز"'
    # A representation check is not a source-view proof or a certification of this model Task repair.
    assert not hasattr(reply, 'sourceViewProof')


class FeedbackPlanner:
    """Only this test double chooses an already authored new reply from exact feedback."""
    def __init__(self, bad, good, field='english', mode='corrected'):
        self.bad, self.good, self.field, self.mode = bad, good, field, mode
        self.calls = []

    async def generic_reader_json(self, **kwargs):
        self.calls.append(copy.deepcopy(kwargs))
        if len(self.calls) == 1:
            return self.bad.model_dump()
        details = json.loads(kwargs['correction'])
        if (details.get('field') != self.field or details.get('termIndex') != 5
                or details.get('requirementId') != 'view' or details.get('requirementKind') != 'view'
                or details.get('path') != ['terms', 5, self.field]):
            return self.bad.model_dump()
        if self.mode == 'repeat':
            return self.bad.model_dump()
        return self.good.model_dump()


def runner(task, planner):
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 30
    reader.current_question = QUESTION
    reader.current_observation_owner = {'principalScopeRef': 'test-current-owner',
                                        'observationNotBefore': '2026-09-29T00:00:00Z'}
    data = {'question': QUESTION, 'task': task.model_dump(), 'requirements': requirements_for(task)}
    return reader, data


@pytest.mark.parametrize('index', [0, 1])
def test_real_structured_two_call_correction_accepts_only_the_new_controlled_model_reply(index):
    task, bad = captured(index); _, good = controlled_reply(index)
    planner = FeedbackPlanner(bad, good); reader, data = runner(task, planner)
    before = copy.deepcopy((task.model_dump(), bad.model_dump(), data))
    result = asyncio.run(reader.structured(QueryExpansion, PROMPT, data,
                                         lambda p: validate_expansion(p, task, QUESTION)))
    assert result.model_dump() == good.model_dump()
    assert (task.model_dump(), bad.model_dump(), data) == before
    assert len(planner.calls) == 2 and len(reader.recovery) == 1
    assert all(c['data']['task'] == before[0] and c['data']['requirements'] == data['requirements']
               for c in planner.calls)
    assert planner.calls[1]['data']['priorValidationConstraints'][-1] == json.loads(planner.calls[1]['correction'])
    assert reader.audit['rejectedPlans'][0]['candidate'] == bad.model_dump()
    assert reader.audit['plans']['QueryExpansion'] == good.model_dump()
    assert set(reader.audit['plans']) == {'QueryExpansion'}
    assert 'expansionVariantSelections' not in reader.audit  # No numeric alternative promotion involved.


@pytest.mark.parametrize('mode,code', [
    ('repeat', 'expansion_english_missing'),
    ('alternative_only', 'expansion_english_missing'),
    ('changed_label', 'expansion_named_view_label_changed'),
    ('suffix_only', 'expansion_named_view_label_changed'),
])
def test_second_invalid_reply_stops_within_existing_budget_without_runtime_substitution(mode, code):
    task, bad = captured(); _, good = controlled_reply()
    if mode == 'alternative_only':
        good = bad.model_copy(deep=True); view(good).alternatives = ['view "قيد الإنجاز"']
    elif mode == 'changed_label': view(good).english = 'view "Other label"'
    elif mode == 'suffix_only': view(good).english = '"قيد الإنجاز" view'
    planner = FeedbackPlanner(bad, good, mode=mode); reader, data = runner(task, planner)
    before = copy.deepcopy((task.model_dump(), bad.model_dump(), good.model_dump()))
    with pytest.raises(PipelineError, match=code):
        asyncio.run(reader.structured(QueryExpansion, PROMPT, data,
                                      lambda p: validate_expansion(p, task, QUESTION)))
    assert len(planner.calls) == 2 and len(reader.recovery) == 1
    assert len(reader.audit['rejectedPlans']) == 2
    assert 'QueryExpansion' not in reader.audit.get('plans', {})
    assert (task.model_dump(), bad.model_dump(), good.model_dump()) == before


def test_arabic_main_language_failure_uses_same_field_specific_correction_chain():
    task, good = controlled_reply(); bad = good.model_copy(deep=True)
    view(bad).arabic = 'untranslated navigation'
    view(bad).alternatives = ['عرض «قيد الإنجاز»']
    view(good).alternatives = view(bad).alternatives[:]
    planner = FeedbackPlanner(bad, good, field='arabic'); reader, data = runner(task, planner)
    result = asyncio.run(reader.structured(QueryExpansion, PROMPT, data,
                                         lambda p: validate_expansion(p, task, QUESTION)))
    assert result.model_dump() == good.model_dump() and len(planner.calls) == 2
    feedback = json.loads(planner.calls[1]['correction'])
    assert feedback['code'] == 'expansion_arabic_missing' and feedback['field'] == 'arabic'
    assert 'main arabic field itself' in feedback['correction']
    assert 'عرض "<exact original label>"' in feedback['correction']


@pytest.mark.parametrize('index', range(6))
@pytest.mark.parametrize('field,bad_value', [('english', 'نص سري'), ('arabic', 'private-sentinel-value')])
def test_language_feedback_has_only_program_owned_locator_and_fixed_text(index, field, bad_value):
    task, plan = controlled_reply()
    setattr(plan.terms[index], field, bad_value)
    before = plan.model_dump()
    with pytest.raises(PipelineError, match='expansion_' + field + '_missing') as error:
        validate_expansion(plan, task, QUESTION + ' untrusted-question-sentinel')
    detail = error.value.details
    assert set(detail) == {'stage', 'termIndex', 'requirementId', 'requirementKind', 'field', 'path', 'correction'}
    expected = next(r for r in requirements_for(task) if r['id'] == plan.terms[index].requirementId)
    assert detail['termIndex'] == index and detail['requirementId'] == expected['id']
    assert detail['requirementKind'] == expected['kind'] and detail['path'] == ['terms', index, field]
    serialized = json.dumps(detail, ensure_ascii=False)
    assert bad_value not in serialized and 'untrusted-question-sentinel' not in serialized
    assert 'قيد الإنجاز' not in serialized and plan.model_dump() == before


def test_model_supplied_requirement_identifier_cannot_enter_feedback():
    task, plan = controlled_reply(); plan.terms[5].requirementId = 'injected-private-sentinel'
    with pytest.raises(PipelineError, match='expansion_requirement_coverage_invalid') as error:
        validate_expansion(plan, task, QUESTION)
    assert error.value.details == {'stage': 'query_expansion'}


def test_expand_task_keeps_task_scope_requirements_and_two_call_budget():
    task, bad = captured(); _, good = controlled_reply()
    before = task.model_dump(); planner = FeedbackPlanner(bad, good); reader, _ = runner(task, planner)
    result = asyncio.run(reader.expand_task(task, {}, None))
    assert result.model_dump() == task.model_dump() == before
    assert len(planner.calls) == 2
    assert all(c['schema']['properties']['stage']['const'] == 'query_expansion' for c in planner.calls)
    lexical = reader.knowledge.intent_lexical_context
    assert lexical['task'] == before and lexical['requirements'] == requirements_for(task)
    assert lexical['principalScopeRef'] == 'test-current-owner'
    assert lexical['terms'] == [term.model_dump() for term in good.terms]


def test_prompt_separates_main_language_view_id_literal_and_genuine_missing_clauses():
    assert 'A string difference alone neither proves' in PROMPT
    assert 'without substituting it\nfor sourceText or automatically rewriting TaskSpec.view' in PROMPT
    assert 'fresh\nauthorized source-view evidence' in PROMPT
    assert 'English alternative cannot repair a main field' in PROMPT
    assert 'do not turn it into a row-data filter or status predicate' in PROMPT
    assert 'Flag a genuinely missing domain or population clause.' in PROMPT
    assert 'do not resolve missing clauses or require consistent intent' in PROMPT
