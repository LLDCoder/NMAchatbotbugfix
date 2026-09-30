"""QE representation checks; captured inputs are immutable and no network is used."""
import asyncio
import copy
import json
from pathlib import Path
import time
from types import SimpleNamespace

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_expansion import (QueryExpansion, InputNormalization, PROMPT,
                                  validate_expansion, validate_normalization)
from app.reader_requirements import requirements_for, semantic_bindings, _semantic_match, _context_match
from app.reader_native_view import literal_named_view, allows_population_reference
from app.reader_routing import task_fingerprint

SAVED = json.loads((Path(__file__).parent / 'fixtures/native_view_qe_c05_ar_v36.json').read_text())


def load(corrected=True):
    task = TaskSpec.model_validate(SAVED['intentStages'][-1]['task'])
    raw = SAVED['queryExpansion']
    plan = QueryExpansion.model_validate({k: raw[k] for k in ('stage', 'intentStatus', 'issues', 'terms')})
    if corrected:
        term = next(t for t in plan.terms if t.requirementId == 'view')
        term.arabic, term.english = 'عرض «قيد الإنجاز»', 'view "in progress"'
    return task, plan, SAVED['question']


def view(plan):
    return next(t for t in plan.terms if t.requirementId == 'view')


def context(task, plan, question):
    return {'question': question, 'task': task.model_dump(), 'terms': [t.model_dump() for t in plan.terms],
            'requirements': requirements_for(task), 'principalScopeRef': SAVED['principalScopeRef'],
            'observationNotBefore': SAVED['observationNotBefore']}


def semantic(task, plan, question, *, source=None, records=None):
    kb = SimpleNamespace(items={str(i): r for i, r in enumerate(
        copy.deepcopy(SAVED['knowledge']) if records is None else records)},
        intent_lexical_context=context(task, plan, question))
    facts = {f['knowledgeBindingId']: f for f in semantic_bindings(kb)}
    original = next(b for b in SAVED['rejectedPlans'][1]['candidate']['requirementBindings']
                    if b['requirementId'] == 'population')
    requirement = next(r for r in requirements_for(task) if r['kind'] == 'population')
    observed = copy.deepcopy(SAVED['source']) if source is None else source
    return (_semantic_match(SimpleNamespace(**original), requirement, observed, facts)
            and _context_match(facts[original['knowledgeBindingId']], observed))


def test_captured_actual_qe_is_rejected_early_without_changing_accepted_task_or_any_term():
    task, plan, question = load(False)
    before = copy.deepcopy((task.model_dump(), plan.model_dump(), requirements_for(task)))
    validate_normalization(InputNormalization.model_validate(SAVED['normalization']), question)
    assert task_fingerprint(task) == SAVED['source']['taskFingerprint']
    assert SAVED['intentStages'][-1]['phase'] == 'knowledge_refinement'
    assert [json.loads(x['failure'])['code'] for x in SAVED['rejectedPlans']] == [
        'requirement_output_unreachable', 'analysis_binding_inapplicable', 'analysis_binding_inapplicable']
    with pytest.raises(PipelineError, match='expansion_named_view_label_changed') as error:
        validate_expansion(plan, task, question)
    details = error.value.details
    assert details['stage'] == 'query_expansion' and details['requirementId'] == 'view'
    assert details['taskFingerprint'] == task_fingerprint(task)
    span = details['originalNamedViewSpan']
    assert question[span['start']:span['end']] == 'عرض «قيد الإنجاز»'
    assert (task.model_dump(), plan.model_dump(), requirements_for(task)) == before
    assert not semantic(task, plan, question)


def test_only_fixing_arabic_wrapper_still_rejects_whole_english_phrase_loss():
    task, plan, question = load(False)
    view(plan).arabic = 'عرض «قيد الإنجاز»'
    with pytest.raises(PipelineError, match='expansion_named_view_phrase_changed') as error:
        validate_expansion(plan, task, question)
    assert error.value.details['populationRequirementId'] == 'population'
    assert not semantic(task, plan, question)


@pytest.mark.parametrize('arabic', ['قيد الإنجاز', 'عرض «قيد الإنجاز»', 'تبويب “قيد الإنجاز”',
                                   'عرض "قيد الإنجاز"', "عرض 'قيد الإنجاز'"])
@pytest.mark.parametrize('english', ['in progress', 'view "in progress"', 'tab «in progress»', '"in progress" view'])
def test_legal_full_label_formats_still_need_original_runtime_semantics(arabic, english):
    task, plan, question = load()
    view(plan).arabic, view(plan).english = arabic, english
    before = copy.deepcopy((task.model_dump(), plan.model_dump()))
    validate_expansion(plan, task, question)
    assert semantic(task, plan, question)
    source = copy.deepcopy(SAVED['source']); source.pop('sourceViewProof')
    assert not semantic(task, plan, question, source=source)
    assert (task.model_dump(), plan.model_dump()) == before


@pytest.mark.parametrize('english,arabic', [
    ('in progress view', 'عرض قيد الإنجاز'),
    ('view in progress', 'عرض قيد الإنجاز'),
    ('view "in progress"', 'عرض قيد الإنجاز'),
    ('in progress', 'قيد التنفيذ'),
    ('view "in progress"', 'عرض «قيد الإنجاز عاجل»'),
    ('view "in progress"', 'عرض «الإنجاز قيد»'),
    ('view "in progress"', 'عرض « قيد الإنجاز »'),
])
def test_rejected_unquoted_wrappers_and_changed_labels_remain_rejected(english, arabic):
    task, plan, question = load()
    view(plan).english, view(plan).arabic = english, arabic
    view(plan).alternatives = ['قيد الإنجاز']  # Alternatives cannot restore main-field provenance.
    with pytest.raises(PipelineError, match='expansion_named_view_label_changed'):
        validate_expansion(plan, task, question)
    assert not semantic(task, plan, question)


@pytest.mark.parametrize('wrapper', ['in progress view', 'view in progress', 'in progress tab',
                                    'view "progress"', 'view "urgent in progress"'])
def test_canonical_language_requires_whole_phrase_not_substring_or_unquoted_wrapper(wrapper):
    task, plan, question = load(); view(plan).english = wrapper
    with pytest.raises(PipelineError, match='expansion_named_view_phrase_changed'):
        validate_expansion(plan, task, question)
    assert not semantic(task, plan, question)


@pytest.mark.parametrize('fault', ['page', 'view', 'authority', 'recordId', 'revision', 'operationRef',
                                   'sourcePath', 'contextBindingIds', 'contextParameters', 'kb_inactive'])
def test_representation_pass_does_not_supply_missing_source_or_kb_proof(fault):
    task, plan, question = load(); validate_expansion(plan, task, question)
    source, records = copy.deepcopy(SAVED['source']), copy.deepcopy(SAVED['knowledge'])
    proof = source['sourceViewProof']
    if fault in {'page', 'view', 'authority'}:
        proof[fault] = 'wrong'
    elif fault == 'contextParameters':
        source['collectionContext']['parameterHashes'] = {}
    elif fault == 'kb_inactive':
        for item in records: item['record']['status'] = 'inactive'
    else:
        for definition in proof['definitions']:
            definition[fault] = [] if fault == 'contextBindingIds' else 'wrong'
    assert not semantic(task, plan, question, source=source, records=records)


@pytest.mark.parametrize('question', [
    'Show my requests in view "unknown-label".',
    'Show my requests in view "قيد الإنجاز" and view "مكتمل".',
    'Show my requests not in view "قيد الإنجاز".',
    'Show my requests in view "قيد الإنجاز" with status In Progress.',
    'Show my requests in view "قيد الإنجاز" that are in progress.',
    'Show my requests in view "قيد الإنجاز" and other requests that are in progress.',
])
def test_unknown_label_independent_condition_or_second_view_does_not_become_alias(question):
    task, plan, _ = load()
    if 'unknown-label' in question:
        view(plan).arabic = 'عرض "unknown-label" عربي'
        # The regular language guard is separate. Retain unknown original in English.
        view(plan).english = 'view "unknown-label"'
        pop = next(t for t in plan.terms if t.requirementId == 'population')
        pop.arabic = 'غير معروف'  # Not a duplicate literal label.
    validate_expansion(plan, task, question)
    assert not semantic(task, plan, question)


@pytest.mark.parametrize('population,arabic', [
    ('urgent in progress', 'عاجل قيد الإنجاز'), ('not in progress', 'ليس قيد الإنجاز'),
    ('in progress only', 'قيد الإنجاز فقط'), ('in progress and approved', 'قيد الإنجاز ومعتمد'),
    ('unknown population', 'مجموعة غير معروفة'), ('another account in progress', 'قيد الإنجاز لحساب آخر'),
])
def test_distinct_population_is_not_rewritten_to_the_label(population, arabic):
    task, plan, question = load(); task.businessFocus = population
    pop = next(t for t in plan.terms if t.requirementId == 'population')
    pop.sourceText = pop.english = population; pop.arabic = arabic; pop.alternatives = []
    before = copy.deepcopy((task.model_dump(), plan.model_dump(), requirements_for(task)))
    validate_expansion(plan, task, question)
    assert not semantic(task, plan, question)
    assert (task.model_dump(), plan.model_dump(), requirements_for(task)) == before


@pytest.mark.parametrize('fault,code', [('missing', 'expansion_requirement_coverage_invalid'),
    ('duplicate', 'expansion_requirement_coverage_invalid'), ('source', 'expansion_source_changed')])
def test_exact_requirement_set_and_source_text_are_still_mandatory(fault, code):
    task, plan, question = load()
    if fault == 'missing': plan.terms.pop(0)
    elif fault == 'duplicate': plan.terms.append(copy.deepcopy(plan.terms[0]))
    else: plan.terms[0].sourceText = 'another entity'
    with pytest.raises(PipelineError, match=code): validate_expansion(plan, task, question)


def test_historical_quote_or_multiple_current_mentions_cannot_supply_early_single_label_provenance():
    task, plan, question = load(False)
    for current in ('Show my requests.', question + ' وفي عرض «مكتمل».'):
        before = copy.deepcopy(plan.model_dump())
        validate_expansion(plan, task, current, history_text=question)
        assert literal_named_view(context(task, plan, current), task.view) is None
        assert not semantic(task, plan, current)
        assert plan.model_dump() == before


def test_needs_revision_remains_available_for_real_omitted_condition():
    task, _, question = load()
    question += ' Only urgent requests for another account after 2026-09-01.'
    plan = QueryExpansion(stage='query_expansion', intentStatus='needs_revision',
                          issues=[{'quote': 'Only urgent requests for another account after 2026-09-01.',
                                   'reason': 'Unrepresented independent constraints require intent revision.'}], terms=[])
    before = copy.deepcopy(task.model_dump())
    validate_expansion(plan, task, question)
    assert task.model_dump() == before


def test_retained_date_record_ordering_and_other_subject_terms_cannot_be_removed_by_view_repair():
    from test_generic_reader_v3 import expansion_fixture
    task, original, question = load()
    task.requestedAttributes = ['other account name']
    task.recordIdentity = 'APP-707'
    task.timeRange = 'after 2026-09-01'; task.timeField = 'createdAt'
    task.requestedOrdering = ['createdAt descending']
    task.filters = ['priority urgent', 'owner another account']
    raw = expansion_fixture({'requirements': requirements_for(task)})
    old = {t.requirementId: t.model_dump() for t in original.terms}
    raw['terms'] = [old.get(t['requirementId'], t) for t in raw['terms']]
    # Fixture translations preserve numeric literals using both language scripts.
    for t in raw['terms']:
        if t['sourceText'] == task.timeRange:
            t.update(english=task.timeRange, arabic='بعد 2026-09-01', alternatives=[])
    plan = QueryExpansion.model_validate(raw)
    before = copy.deepcopy((task.model_dump(), plan.model_dump()))
    validate_expansion(plan, task, question + ' after 2026-09-01 for APP-707, show other account name ordered by createdAt.')
    assert (task.model_dump(), plan.model_dump()) == before
    for req in requirements_for(task):
        if req['id'] in old: continue
        missing = plan.model_copy(deep=True)
        missing.terms = [t for t in missing.terms if t.requirementId != req['id']]
        with pytest.raises(PipelineError, match='expansion_requirement_coverage_invalid'):
            validate_expansion(missing, task, question)


class Plans:
    def __init__(self, plans): self.plans, self.calls = plans, []
    async def generic_reader_json(self, **kwargs):
        self.calls.append(copy.deepcopy(kwargs))
        return copy.deepcopy(self.plans[min(len(self.calls)-1, len(self.plans)-1)])


@pytest.mark.parametrize('mode,expected_calls', [('corrected', 2), ('repeat', 2), ('staged', 2)])
def test_existing_structured_correction_budget_and_repeated_failure_stop(mode, expected_calls):
    task, bad, question = load(False); _, good, _ = load()
    middle = bad.model_copy(deep=True); view(middle).arabic = view(good).arabic
    plans = [bad, good] if mode == 'corrected' else [bad, middle, good] if mode == 'staged' else [bad]
    planner = Plans([p.model_dump() for p in plans])
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic()+30
    data = {'question': question, 'task': task.model_dump(), 'requirements': requirements_for(task)}
    before = copy.deepcopy(data)
    call = reader.structured(QueryExpansion, PROMPT, data, lambda p: validate_expansion(p, task, question))
    if mode in {'repeat', 'staged'}:
        code = 'expansion_named_view_label_changed' if mode == 'repeat' else 'expansion_named_view_phrase_changed'
        with pytest.raises(PipelineError, match=code): asyncio.run(call)
    else:
        assert asyncio.run(call).model_dump() == good.model_dump()
    assert data == before and len(planner.calls) == expected_calls
    assert all(all(c['data'][key] == value for key, value in before.items()) for c in planner.calls)
    assert 'expansion_named_view_label_changed' in planner.calls[1]['correction']
    assert set(reader.audit.get('plans', {})) <= {'QueryExpansion'}


@pytest.mark.parametrize('repair', [True, False])
def test_expand_task_uses_original_qe_loop_without_analysis_or_outer_retry(repair):
    task, bad, question = load(False); _, good, _ = load()
    planner = Plans([bad.model_dump(), good.model_dump()] if repair else [bad.model_dump()])
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic()+30; reader.current_question = question
    reader.current_observation_owner = {'principalScopeRef': SAVED['principalScopeRef'],
                                       'observationNotBefore': SAVED['observationNotBefore']}
    before = copy.deepcopy(task.model_dump())
    call = reader.expand_task(task, {}, None)
    if repair:
        assert asyncio.run(call).model_dump() == before
        lexical = reader.knowledge.intent_lexical_context
        assert lexical['task'] == before and lexical['requirements'] == requirements_for(task)
        assert lexical['principalScopeRef'] == SAVED['principalScopeRef']
        assert lexical['terms'] == [t.model_dump() for t in good.terms]
        assert [t for t in lexical['terms'] if t['requirementId'] != 'view'] == [
            t.model_dump() for t in bad.terms if t.requirementId != 'view']
    else:
        with pytest.raises(PipelineError, match='expansion_named_view_label_changed'): asyncio.run(call)
        assert not reader.audit.get('queryExpansions')
        assert reader.expansion is None
    assert len(planner.calls) == 2
    assert all(c['schema']['properties']['stage']['const'] == 'query_expansion' for c in planner.calls)
    assert all(r['stage'] == 'QueryExpansion' for r in reader.recovery)  # No outer intent-revision loop.
    assert task.model_dump() == before
