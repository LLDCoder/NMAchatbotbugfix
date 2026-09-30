"""Recorded C-05 AR v32 analysis failure; all replay stays offline."""
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from app.generic_reader import KnowledgeStore, PipelineError, execute_analysis
from app.generic_reader_contracts import TaskSpec, AnalysisPlan
from app.reader_bindings import bind_analysis_evidence
from app.reader_collection import projection_hash
from app.reader_native_view import literal_named_view, allows_population_reference
from app.reader_requirements import semantic_bindings, requirements_for, _semantic_match
from app.reader_routing import source_view_proof, verify_route
from app.reader_view_population import documented_view_identity

SAVED = json.loads((Path(__file__).parent / 'fixtures/native_view_c05_ar_v32.json').read_text())
PAGE = '/licensing/applications'
KEY = 'admin.page-docs.licensing.applications.todo.collection#pending_population'


def fixture(attempt=-1):
    task = TaskSpec.model_validate(SAVED['task'])
    kb = KnowledgeStore()
    for i, item in enumerate(SAVED['knowledge']):
        kb.add({'chunks': [{'id': 'formal-local-' + str(i), 'content': json.dumps(item['content'])}]})
    kb.intent_lexical_context = {'question': SAVED['originalQuestion'], 'requirements': requirements_for(task),
                               'terms': copy.deepcopy(SAVED['queryExpansion']['terms'])}
    source = copy.deepcopy(SAVED['sourceMetadata'])
    receipt = source['collectionReceipt']
    # The DB audit omits row values. Reconstruct ONLY the recorded complete
    # zero-row projection, checked against its existing total/count/hash.
    assert receipt['completeness'] == 'complete' and receipt['rowCount'] == receipt['total'] == 0
    assert receipt['projectionHash'] == projection_hash([])
    assert receipt['rowsPath'] == '/data/page/items' and receipt['totalPath'] == '/data/page/total'
    source['data'] = {'data': {'page': {'items': [], 'total': 0}}}
    plan = AnalysisPlan.model_validate(SAVED['rejectedPlans'][attempt]['candidate'])
    return task, kb, source, plan


def matches(task, kb, source):
    facts = {f['knowledgeBindingId']: f for f in semantic_bindings(kb)}
    binding = SimpleNamespace(knowledgeBindingId=KEY, sourcePath='/data/page/items', fields=['id'])
    req = next(r for r in requirements_for(task) if r['kind'] == 'population')
    return _semantic_match(binding, req, source, facts)


def record(kb, record_id):
    return next(item['record'] for item in kb.items.values() if (item.get('record') or {}).get('id') == record_id)


@pytest.mark.parametrize('attempt', [1, 2])
def test_captured_failed_analysis_plans_replay_without_rewriting_task_or_evidence(attempt):
    task, kb, source, plan = fixture(attempt)
    before = copy.deepcopy(task.model_dump())
    source_before = copy.deepcopy(source)
    assert requirements_for(task) == SAVED['requirements']
    assert task.view == 'todo' and task.businessFocus == 'in progress'
    assert json.loads(SAVED['rejectedPlans'][attempt]['failure'])['code'] == 'analysis_binding_inapplicable'
    proof = source_view_proof(task, PAGE, source, kb)
    assert proof == source['sourceViewProof']  # Recompute from actual captured context.
    assert verify_route(task, PAGE, PAGE, SAVED['observation'], {source['sourceId']: copy.deepcopy(source)}, kb).passed
    bound = bind_analysis_evidence(plan, task, kb, {source['sourceId']: source}, language='ar')
    assert bound is plan
    assert matches(task, kb, source)
    assert task.model_dump() == before
    assert source == source_before


def test_recorded_last_plan_still_reports_its_independent_missing_grain_transformation():
    task, kb, source, plan = fixture()
    bound = bind_analysis_evidence(plan, task, kb, {source['sourceId']: source}, language='ar')
    result = execute_analysis(bound, {source['sourceId']: source}, kb, [], task=task)
    coverage = {r['id']: r for r in result['requirementCoverage']}
    assert coverage['population']['status'] == 'satisfied'
    assert coverage['view']['status'] == 'satisfied'
    assert coverage['grain']['reason'] == 'requested_grain_unverified'
    assert not result['requirementsSatisfied']
    assert all(o['value'] == [] for o in result['outputs'])


def test_original_unreachable_output_failure_is_not_bypassed():
    task, kb, source, plan = fixture(0)
    with pytest.raises(PipelineError, match='requirement_output_unreachable'):
        bind_analysis_evidence(plan, task, kb, {source['sourceId']: source}, language='ar')


def test_native_quote_is_attached_to_same_direct_canonical_definition():
    task, kb, source, _ = fixture()
    resolved = documented_view_identity(kb, PAGE, task.view, task.businessObject)
    direct = documented_view_identity(kb, PAGE, task.view, task.businessObject, _original=False)
    assert {k: v for k, v in resolved.items() if k != 'originalViewReference'} == direct
    ref = resolved['originalViewReference']
    assert ref['quote'] == 'قيد الإنجاز'
    assert kb.intent_lexical_context['question'][ref['sourceSpan']['start']:ref['sourceSpan']['end']] == ref['quote']
    assert allows_population_reference(kb.intent_lexical_context, ref, 'todo', 'in progress')
    assert matches(task, kb, source)


@pytest.mark.parametrize('label', ['In Progress', 'in progress', 'view "In Progress"', '"In Progress" view', 'tab “In Progress”', '“In Progress” tab'])
def test_equivalent_complete_navigation_wrappers_preserve_population_phrase(label):
    task, kb, source, _ = fixture()
    next(t for t in kb.intent_lexical_context['terms'] if t['requirementId'] == 'view')['english'] = label
    assert matches(task, kb, source)


@pytest.mark.parametrize('question', [
    'Show my requests in view "قيد الإنجاز" with status In Progress.',
    'Show my requests in view "قيد الإنجاز" that are in progress.',
    'اعرض الطلبات في عرض «قيد الإنجاز» وحالتها In Progress.',
    'اعرض الطلبات في عرض «قيد الإنجاز» مع حالة قيد الإنجاز.',
    'اعرض الطلبات في عرض «قيد الإنجاز» وهي قيد الإنجاز.',
    'Show my requests not in view "قيد الإنجاز".',
    'Show my requests in view "قيد الإنجاز" except approved requests.',
    'اعرض الطلبات في عرض «قيد الإنجاز» وعرض «مكتمل».',
    'Show my in-progress requests.',
    'Show requests in view "unknown-label".',
    'Show requests in view "Completed".',
])
def test_independent_status_negation_or_other_quote_remains_unsupported(question):
    task, kb, source, _ = fixture()
    kb.intent_lexical_context['question'] = question
    assert not matches(task, kb, source)


@pytest.mark.parametrize('focus', ['urgent in progress', 'not in progress', 'in progress only', 'in progress and approved', 'approved'])
def test_same_native_qe_string_cannot_erase_whole_canonical_population(focus):
    task, kb, source, _ = fixture()
    task.businessFocus = focus
    kb.intent_lexical_context['requirements'] = requirements_for(task)
    term = next(t for t in kb.intent_lexical_context['terms'] if t['requirementId'] == 'population')
    term.update(sourceText=focus, english=focus)  # Intentionally stale native QE anchor.
    assert not matches(task, kb, source)


@pytest.mark.parametrize('change', ['missing_view_qe', 'duplicate_view_qe', 'view_anchor', 'view_native', 'view_translation', 'population_anchor', 'population_native', 'missing_population_qe', 'duplicate_population_qe', 'stale_requirements'])
def test_both_immutable_slot_anchors_and_same_native_quote_are_required(change):
    task, kb, source, _ = fixture()
    context = kb.intent_lexical_context
    view = next(t for t in context['terms'] if t['requirementId'] == 'view')
    population = next(t for t in context['terms'] if t['requirementId'] == 'population')
    if change == 'missing_view_qe': context['terms'].remove(view)
    elif change == 'duplicate_view_qe': context['terms'].append(copy.deepcopy(view))
    elif change == 'view_anchor': view['sourceText'] = 'other'
    elif change == 'view_native': view['arabic'] = 'other'
    elif change == 'view_translation': view['english'] = 'approved view'
    elif change == 'population_anchor': population['sourceText'] = 'other'
    elif change == 'population_native': population['arabic'] = 'other'
    elif change == 'missing_population_qe': context['terms'].remove(population)
    elif change == 'duplicate_population_qe': context['terms'].append(copy.deepcopy(population))
    elif change == 'stale_requirements': next(r for r in context['requirements'] if r['id'] == 'view')['value'] = 'other'
    assert not matches(task, kb, source)


@pytest.mark.parametrize('change', ['scope', 'object', 'view', 'inactive_page', 'conflicting_page', 'duplicate_native_alias', 'no_native_alias', 'different_definition', 'population_operation', 'population_path', 'population_fields', 'population_condition', 'scope_context'])
def test_same_active_page_object_scope_operation_and_population_contract_required(change):
    task, kb, source, _ = fixture()
    page = record(kb, 'admin.page-docs.licensing.applications.routing')
    facts = record(kb, 'admin.page-docs.licensing.applications.todo.collection')['payload']['bindings']
    population = next(f for f in facts if f['id'] == 'pending_population')
    scope = next(f for f in facts if f['id'] == 'personal_scope')
    if change == 'scope': task.requestedScope = 'team'
    elif change == 'object': task.businessObject = 'invoice'
    elif change == 'view': task.view = 'completed'
    elif change == 'inactive_page': page['status'] = 'inactive'
    elif change == 'conflicting_page':
        duplicate = copy.deepcopy(page); duplicate['revision'] += 1
        kb.items['conflicting'] = {'record': duplicate, 'documentId': ''}
    elif change == 'duplicate_native_alias':
        page['payload']['routing']['views'].append({'id': 'other', 'label': 'Other', 'aliases': ['قيد الإنجاز']})
    elif change == 'no_native_alias':
        for v in page['payload']['routing']['views']: v['aliases'] = [a for a in v.get('aliases', []) if a != 'قيد الإنجاز']
    elif change == 'different_definition': page['payload']['pageIdentity']['route'] = '/other'
    elif change == 'population_operation': population['operationRef'] = 'GET /other'
    elif change == 'population_path': population['sourcePath'] = '/other'
    elif change == 'population_fields': population['fields'] = ['otherId']
    elif change == 'population_condition': population['conditions'] = [{'field': 'status', 'predicate': 'eq', 'value': 'Pending Review'}]
    elif change == 'scope_context': scope['contextParameters']['keyword'] = 'something'
    kb.intent_lexical_context['requirements'] = requirements_for(task)
    assert not matches(task, kb, source)


@pytest.mark.parametrize('fault', ['missing', 'page', 'view', 'authority', 'recordId', 'revision', 'operationRef', 'sourcePath', 'contextBindingIds'])
def test_actual_source_view_proof_still_required(fault):
    task, kb, source, _ = fixture()
    if fault == 'missing': source.pop('sourceViewProof')
    elif fault in {'page', 'view', 'authority'}: source['sourceViewProof'][fault] = 'other'
    else:
        for definition in source['sourceViewProof']['definitions']:
            definition[fault] = [] if fault == 'contextBindingIds' else 'other'
    assert not matches(task, kb, source)


@pytest.mark.parametrize('fault', ['page', 'operation', 'context', 'no_principal', 'not_ready'])
def test_wrong_source_cannot_mint_runtime_view_proof(fault):
    task, kb, source, _ = fixture()
    if fault == 'page': source['page'] = '/other'
    elif fault == 'operation': source['operationRef'] = 'GET /other'
    elif fault == 'context': source['collectionContext']['parameterHashes']['keyword'] = projection_hash('other')
    elif fault == 'no_principal': source.pop('principalScopeRef')
    elif fault == 'not_ready': source['ready'] = False
    assert source_view_proof(task, PAGE, source, kb) is None


@pytest.mark.parametrize('fault', ['quote', 'start', 'end', 'authority'])
def test_supplied_quote_reference_is_rechecked_against_original_context(fault):
    task, kb, _, _ = fixture()
    ref = literal_named_view(kb.intent_lexical_context, task.view)
    if fault in {'start', 'end'}: ref['sourceSpan'][fault] += 1
    else: ref[fault] = 'other'
    assert not allows_population_reference(kb.intent_lexical_context, ref, task.view, task.businessFocus)
