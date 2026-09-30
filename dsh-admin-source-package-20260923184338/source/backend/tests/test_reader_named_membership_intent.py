"""Controlled model-output viability, not evidence of live/model success.

The saved original task remains a negative control. Re-expression is supplied by
the test only; no implementation rewrites task slots, proof or captured records.
"""
import asyncio
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError, digest
from app.generic_reader_contracts import TaskSpec, AnalysisPlan
from app.reader_bindings import applicable_bindings, bind_analysis_evidence
from app.reader_context import validate_task_grain
from app.reader_expansion import InputNormalization, QueryExpansion, validate_normalization, validate_expansion
from app.reader_knowledge_selection import split_passages
from app.reader_native_view import literal_named_view, allows_population_reference
from app.reader_requirements import requirements_for, _semantic_match, _context_match
from app.reader_view_population import documented_view_identity


SAVED = json.loads((Path(__file__).parent / 'fixtures/c08_named_membership_v39_ar.json').read_text())
LABEL = 'قيد الإنجاز'
POP_ID = 'admin.page-docs.licensing.applications.todo.collection#pending_population'


def original():
    return TaskSpec.model_validate(SAVED['task']), QueryExpansion.model_validate(SAVED['queryExpansion'])


def controlled_output():
    """Explicit hypothetical model response, never an edit to saved evidence."""
    task, plan = original()
    task.businessObject = 'licensing application'
    task.businessFocus = LABEL
    for update in task.slotUpdates:
        if update.field == 'businessObject':
            update.value, update.source, update.evidence = task.businessObject, 'current', SAVED['question']
        elif update.field == 'businessFocus':
            update.value, update.source, update.evidence = LABEL, 'current', 'في عرض «قيد الإنجاز»'
    for term in plan.terms:
        if term.requirementId == 'object':
            term.sourceText = term.english = task.businessObject
            term.arabic, term.alternatives = 'طلب ترخيص', []
        elif term.requirementId == 'population':
            term.sourceText, term.english, term.arabic = LABEL, f'view "{LABEL}"', LABEL
            term.alternatives = []
        elif term.requirementId == 'view':
            term.english, term.arabic, term.alternatives = f'view "{LABEL}"', LABEL, []
    return task, plan


def context(task, plan, question=None):
    return {'question': question or SAVED['question'], 'task': task.model_dump(),
            'requirements': requirements_for(task), 'terms': [x.model_dump() for x in plan.terms],
            'principalScopeRef': SAVED['principalScopeRef'],
            'observationNotBefore': SAVED['observationNotBefore']}


def recorded_store(task, plan):
    store = KnowledgeStore()
    for entry in SAVED['knowledge']:
        record, meta = entry['record'], entry['metadata']
        assert 'k_' + digest([record['id'], record['revision'], record]) == meta['sourceId']
        store.add({'chunks': [{'id': meta['chunkId'], 'document_id': meta['documentId'],
            'content': json.dumps({**entry['package'], 'records': [record]}, ensure_ascii=False)}]})
        text = store.items[meta['sourceId']]['text']
        for i, (_, _, passage) in enumerate(split_passages(text)):
            store.passages[f'{meta["sourceId"]}:p{i}'] = (meta['sourceId'], passage)
        for call in SAVED['knowledgeInputs']:
            for used in call['inputs']:
                if used['recordId'] != record['id']:
                    continue
                for item in used['passages']:
                    passage = store.passages[item['sourceId']][1]
                    assert hashlib.sha256(passage.encode()).hexdigest() == item['sha256']
                    assert len(passage) == item['characters']
    store.intent_lexical_context = context(task, plan)
    source = deepcopy(SAVED['source'])
    receipt = source['collectionReceipt']
    assert receipt['rowCount'] == receipt['total'] == 0
    assert receipt['completeness'] == 'complete' and receipt['stablePasses'] == 2
    # Reconstruction is explicitly bounded by the saved receipt, not raw HTTP.
    source['data'] = {'data': {'page': {'items': [], 'total': 0}}}
    return store, {source['sourceId']: source}


def bind_first(task, plan):
    store, sources = recorded_store(task, plan)
    analysis = AnalysisPlan.model_validate(SAVED['rejectedPlans'][0]['candidate'])
    bind_analysis_evidence(analysis, task, store, sources)
    return analysis, store, sources


def test_original_actual_task_is_still_rejected_twice_without_rewriting_anything():
    task, plan = original()
    before = deepcopy((task.model_dump(), plan.model_dump(), SAVED))
    validate_normalization(InputNormalization.model_validate(SAVED['normalization']), SAVED['question'])
    validate_expansion(plan, task, SAVED['question'])
    store, sources = recorded_store(task, plan)
    for rejected in SAVED['rejectedPlans']:
        analysis = AnalysisPlan.model_validate(rejected['candidate'])
        with pytest.raises(PipelineError, match='analysis_binding_inapplicable') as error:
            bind_analysis_evidence(analysis, task, store, sources)
        assert error.value.details['requirementId'] == 'population'
        assert error.value.details['matchingBindingIds'] == []
    assert (task.model_dump(), plan.model_dump(), SAVED) == before


def test_controlled_reexpression_passes_existing_language_object_context_and_population_gates():
    task, plan = controlled_output()
    before = deepcopy((task.model_dump(), plan.model_dump()))
    validate_task_grain(task)
    validate_expansion(plan, task, SAVED['question'])
    reference = literal_named_view(context(task, plan), task.view)
    assert reference and reference['quote'] == LABEL
    assert allows_population_reference(context(task, plan), reference, task.view, task.businessFocus)
    analysis, store, sources = bind_first(task, plan)
    identity = documented_view_identity(store, '/licensing/applications', task.view, task.businessObject)
    assert identity['id'] == 'todo'
    assert next(iter(sources.values()))['sourceViewProof']['view'] == 'todo'
    population = next(b for b in analysis.requirementBindings if b.requirementId == 'population')
    assert population.knowledgeBindingId == POP_ID
    assert (task.model_dump(), plan.model_dump()) == before
    # This is binding viability, not final answer/permission/freshness certification.
    assert SAVED['task']['businessFocus'] != task.businessFocus


@pytest.mark.parametrize('focus,arabic', [
    ('not in the named view', 'ليس في العرض المحدد'),
    ('only urgent members of the named view', 'فقط الطلبات العاجلة في العرض المحدد'),
    ('members in the named view with status approved', 'طلبات العرض بالحالة معتمد'),
    ('members in the named view after 2026-09-01', 'طلبات العرض بعد 2026-09-01'),
    ('members in the named view or another view', 'طلبات العرض أو عرض آخر'),
    ('members in the named view for a different department', 'طلبات العرض لقسم آخر'),
])
def test_retained_independent_population_is_not_made_equivalent_to_the_bare_label(focus, arabic):
    task, plan = controlled_output()
    task.businessFocus = focus
    population = next(t for t in plan.terms if t.requirementId == 'population')
    population.sourceText = population.english = focus
    population.arabic = arabic
    before = deepcopy((task.model_dump(), plan.model_dump()))
    validate_expansion(plan, task, SAVED['question'] + ' ' + focus)
    with pytest.raises(PipelineError, match='analysis_binding_inapplicable') as error:
        bind_first(task, plan)
    assert error.value.details['requirementId'] == 'population'
    assert (task.model_dump(), plan.model_dump()) == before


@pytest.mark.parametrize('field,value,translation', [
    ('businessObject', 'content application', 'طلب محتوى'),
    ('requestedScope', 'global', 'عام'),
    ('requestedScope', 'team', 'فريق'),
])
def test_existing_binding_does_not_grant_a_different_object_or_population_scope(field, value, translation):
    task, plan = controlled_output()
    setattr(task, field, value)
    rid = 'object' if field == 'businessObject' else 'scope'
    term = next(t for t in plan.terms if t.requirementId == rid)
    term.sourceText = term.english = value
    term.arabic = translation
    with pytest.raises(PipelineError, match='analysis_binding_inapplicable') as error:
        bind_first(task, plan)
    assert error.value.details['requirementId'] == rid


@pytest.mark.parametrize('fault', ['operation', 'context'])
def test_formal_literal_alias_does_not_skip_the_actual_source_operation_or_request_context(fault):
    task, plan = controlled_output()
    store, sources = recorded_store(task, plan)
    source = next(iter(sources.values()))
    if fault == 'operation':
        source['operationRef'] = 'POST /api/Different/Queue'
    else:
        source['collectionContext']['parameterHashes'] = {}
    facts = {f['knowledgeBindingId']: f for f in applicable_bindings(store, sources)}
    analysis = AnalysisPlan.model_validate(SAVED['rejectedPlans'][0]['candidate'])
    binding = next(b for b in analysis.requirementBindings if b.requirementId == 'population')
    requirement = next(r for r in requirements_for(task) if r['id'] == 'population')
    assert (not _semantic_match(binding, requirement, source, facts)
            or not _context_match(facts.get(POP_ID, {}), source))


@pytest.mark.parametrize('fault,code', [('drop', 'expansion_requirement_coverage_invalid'),
    ('relabel', 'expansion_source_changed'), ('language', 'expansion_english_missing')])
def test_literal_label_exception_keeps_requirement_identity_and_main_language_guards(fault, code):
    task, plan = controlled_output()
    population = next(t for t in plan.terms if t.requirementId == 'population')
    if fault == 'drop':
        plan.terms.remove(population)
    elif fault == 'relabel':
        population.sourceText = 'pending'
    else:
        population.english = LABEL
    with pytest.raises(PipelineError, match=code):
        validate_expansion(plan, task, SAVED['question'])


class Planned:
    def __init__(self, plans):
        self.plans, self.calls = plans, []

    async def generic_reader_json(self, **kwargs):
        self.calls.append(deepcopy(kwargs))
        return deepcopy(self.plans[min(len(self.calls) - 1, len(self.plans) - 1)])


def reader_for(plans):
    planner = Planned(plans)
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 30
    reader.current_question = SAVED['question']
    reader.canonical_question = ' '.join(c['english'] for c in SAVED['normalization']['clauses'])
    reader.current_observation_owner = {'principalScopeRef': SAVED['principalScopeRef'],
        'observationNotBefore': SAVED['observationNotBefore']}
    return reader, planner


def revision():
    return QueryExpansion(stage='query_expansion', intentStatus='needs_revision',
        issues=[{'quote': 'في عرض «قيد الإنجاز»',
                 'reason': 'Keep the pure named-view member selector distinct from its entity/domain and ownership.'}], terms=[])


def test_existing_intent_repair_consumes_controlled_model_responses_and_keeps_original_input():
    original_task, _ = original()
    corrected_task, corrected_qe = controlled_output()
    reader, planner = reader_for([revision().model_dump(), corrected_task.model_dump(), corrected_qe.model_dump()])
    before = deepcopy(original_task.model_dump())
    result = asyncio.run(reader.expand_task(original_task, {}, None))
    assert result.businessFocus == LABEL and result.businessObject == 'licensing application'
    assert result.requestedScope == 'personal' and result.requestedGrain == 'application'
    assert original_task.model_dump() == before
    assert len(planner.calls) == 3  # QE, one existing TaskSpec repair, final QE.
    assert len(reader.audit['queryExpansions']) == 2
    assert reader.knowledge.intent_lexical_context['question'] == SAVED['question']
    assert reader.knowledge.intent_lexical_context['task'] == result.model_dump()
    bind_first(result, reader.expansion)


def test_second_needs_revision_stops_without_an_extra_repair_or_retrieval():
    task, _ = original()
    corrected, _ = controlled_output()
    reader, planner = reader_for([revision().model_dump(), corrected.model_dump(), revision().model_dump()])
    with pytest.raises(PipelineError, match='intent_clause_mismatch'):
        asyncio.run(reader.expand_task(task, {}, None))
    assert len(planner.calls) == 3 and len(reader.audit['queryExpansions']) == 2
    assert not getattr(reader.knowledge, 'intent_lexical_context', None)


@pytest.mark.parametrize('tail', [' only urgent requests.', ' with status Approved.',
    ' excluding another account.', ' after 2026-09-01.', ' and list the other queue.'])
def test_genuine_extra_clause_can_require_revision_without_silently_rewriting_task(tail):
    task, _ = controlled_output()
    question = SAVED['question'] + tail
    plan = QueryExpansion(stage='query_expansion', intentStatus='needs_revision',
        issues=[{'quote': tail.strip(), 'reason': 'Independent current clause is not retained in the supplied task.'}], terms=[])
    before = deepcopy(task.model_dump())
    validate_expansion(plan, task, question)
    assert task.model_dump() == before
