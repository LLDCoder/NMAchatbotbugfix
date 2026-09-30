import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from app.generic_reader import KnowledgeStore
from app.generic_reader_contracts import TaskSpec
from app.reader_collection import projection_hash
from app.reader_requirements import semantic_bindings, requirements_for, _semantic_match
from app.reader_routing import verify_route, source_view_proof
from app.reader_view_population import documented_view_identity

SAVED = json.loads((Path(__file__).parent / 'fixtures/native_view_c05_ar_v31.json').read_text())
PAGE = '/licensing/applications'


def fixture():
    task = TaskSpec.model_validate(SAVED['task'])
    kb = KnowledgeStore()
    for i, item in enumerate(SAVED['knowledge']):
        kb.add({'chunks': [{'id': 'formal-local-' + str(i), 'content': json.dumps(item['content'])}]})
    kb.intent_lexical_context = {'question': SAVED['originalQuestion'], 'requirements': requirements_for(task),
                               'terms': copy.deepcopy(SAVED['queryExpansion']['terms'])}
    return task, kb, copy.deepcopy(SAVED['observation'])


def route(task, kb, observation, page=PAGE):
    return verify_route(task, page, page, observation, {}, kb).model_dump()


def isolated_population(task, kb):
    """Synthetic source receipt for unit testing, not the original business read."""
    key = 'admin.page-docs.licensing.applications.todo.collection#pending_population'
    facts = {f['knowledgeBindingId']: f for f in semantic_bindings(kb)}
    fact = facts[key]
    source = {'sourceId': 'isolated', 'page': PAGE, 'kind': 'api_response', 'operationRef': fact['operationRef'],
              'capturedAt': '2026-09-28T17:40:42+00:00', 'principalScopeRef': 'isolated-unit-principal',
              'data': {'data': {'page': {'items': [], 'total': 0}}},
              'collectionContext': {'parameterHashes': {k: projection_hash(v) for k, v in fact['contextParameters'].items()}}}
    source['sourceViewProof'] = source_view_proof(task, PAGE, source, kb)
    binding = SimpleNamespace(knowledgeBindingId=key, sourcePath=fact['sourcePath'], fields=fact['fields'])
    requirement = next(r for r in requirements_for(task) if r['kind'] == 'population')
    return source, facts, binding, requirement


def test_actual_v31_failure_replays_with_original_label_and_real_dom_only():
    task, kb, observation = fixture()
    before = copy.deepcopy(task.model_dump())
    assert SAVED['routeVerification']['passed'] is False
    assert SAVED['routeVerification']['checks'][1]['reason'] == 'requested_view_unverified'
    question = kb.intent_lexical_context.pop('question')
    assert not route(task, kb, observation)['passed']
    kb.intent_lexical_context['question'] = question
    proof = documented_view_identity(kb, PAGE, task.view, task.businessObject)
    assert proof['id'] == 'todo'
    reference = proof['originalViewReference']
    assert question[reference['sourceSpan']['start']:reference['sourceSpan']['end']] == 'قيد الإنجاز'
    assert route(task, kb, observation)['passed']
    assert task.model_dump() == before  # Requirements are not rewritten or deleted.


def test_population_uses_same_page_definition_and_runtime_source_proof():
    task, kb, _ = fixture()
    source, facts, binding, requirement = isolated_population(task, kb)
    assert source['sourceViewProof']['view'] == 'todo'
    assert _semantic_match(binding, requirement, source, facts)
    source.pop('sourceViewProof')
    assert not _semantic_match(binding, requirement, source, facts)


@pytest.mark.parametrize('fault', ['page', 'view', 'authority', 'recordId', 'revision', 'operationRef', 'sourcePath', 'contextBindingIds'])
def test_population_proof_cannot_cross_route_view_source_or_definition(fault):
    task, kb, _ = fixture()
    source, facts, binding, requirement = isolated_population(task, kb)
    proof = source['sourceViewProof']
    if fault in {'page', 'view', 'authority'}:
        proof[fault] = 'wrong'
    else:
        for definition in proof['definitions']:
            definition[fault] = [] if fault == 'contextBindingIds' else 'wrong'
    assert not _semantic_match(binding, requirement, source, facts)


@pytest.mark.parametrize('question', [
    'اعرض الطلبات قيد الإنجاز الخاصة بي.',
    'اعرض الطلبات في عرض «قيد الإنجاز» وعرض «مكتمل».',
    'لا تعرض الطلبات في عرض «قيد الإنجاز».',
    'اعرض كل الطلبات باستثناء عرض «قيد الإنجاز».',
    'اعرض الطلبات وغير عرض «قيد الإنجاز».',
    'Show requests not in view "قيد الإنجاز".',
    'Show requests in view "unknown-label".',
    'Show requests in view "الإنجاز قيد".',
])
def test_unanchored_negated_ambiguous_or_undocumented_labels_do_not_resolve(question):
    task, kb, observation = fixture()
    kb.intent_lexical_context['question'] = question
    assert not route(task, kb, observation)['passed']


@pytest.mark.parametrize('question', [
    'Show my requests in view "قيد الإنجاز".',
    'Show my requests in tab “قيد الإنجاز”.',
    'اعرض الطلبات في تبويب «قيد الإنجاز».',
])
def test_navigation_syntax_does_not_depend_on_business_or_response_language(question):
    task, kb, observation = fixture()
    kb.intent_lexical_context['question'] = question
    assert route(task, kb, observation)['passed']


@pytest.mark.parametrize('question', [
    'اعرض الطلبات في عرض «قيد الإنجاز» وحالتها In Progress.',
    'Show requests in view "قيد الإنجاز" with status In Progress.',
    'Show requests in view "قيد الإنجاز" that are in progress.',
])
def test_independent_status_predicate_remains_unproved(question):
    task, kb, observation = fixture()
    kb.intent_lexical_context['question'] = question
    assert route(task, kb, observation)['passed']  # Named view can still be correct.
    source, facts, binding, requirement = isolated_population(task, kb)
    assert not _semantic_match(binding, requirement, source, facts)


@pytest.mark.parametrize('change', ['wrong_page', 'wrong_entity', 'inactive', 'conflict', 'duplicate_alias', 'different_requested_view', 'no_view_requirement', 'stale_view_requirement', 'wrong_selected_tab', 'two_selected_tabs', 'missing_qe_anchor', 'changed_qe_anchor', 'changed_qe_native', 'qualified_view'])
def test_binding_failures_do_not_take_authority_from_browser_or_translation(change):
    task, kb, observation = fixture()
    page = PAGE
    definition = next(i['record'] for i in kb.items.values() if (i.get('record') or {}).get('id') == 'admin.page-docs.licensing.applications.routing')
    if change == 'wrong_page': page = '/unrelated'
    elif change == 'wrong_entity': task.businessObject = 'invoice'
    elif change == 'inactive': definition['status'] = 'inactive'
    elif change == 'conflict':
        other = copy.deepcopy(definition); other['revision'] += 1
        kb.items['conflicting'] = {'record': other, 'documentId': ''}
    elif change == 'duplicate_alias':
        definition['payload']['routing']['views'].append({'id': 'other', 'label': 'Other', 'aliases': ['قيد الإنجاز']})
    elif change == 'different_requested_view':
        task.view = 'Completed'
        kb.intent_lexical_context['requirements'] = requirements_for(task)
    elif change == 'no_view_requirement':
        kb.intent_lexical_context['requirements'] = [r for r in kb.intent_lexical_context['requirements'] if r['kind'] != 'view']
    elif change == 'stale_view_requirement': task.view = 'another translation'
    elif change == 'wrong_selected_tab':
        for tab in observation['tabControls']: tab['selected'] = tab['name'] == 'Completed'
    elif change == 'two_selected_tabs':
        for tab in observation['tabControls']: tab['selected'] = True
    elif change == 'missing_qe_anchor': kb.intent_lexical_context['terms'] = []
    elif change in {'changed_qe_anchor', 'changed_qe_native'}:
        term = next(t for t in kb.intent_lexical_context['terms'] if t['requirementId'] == 'view')
        term['sourceText' if change == 'changed_qe_anchor' else 'arabic'] = 'unrelated'
    elif change == 'qualified_view':
        task.view = 'urgent In Progress'
        kb.intent_lexical_context['requirements'] = requirements_for(task)
    assert not route(task, kb, observation, page)['passed']


@pytest.mark.parametrize('population', ['urgent in progress', 'not in progress', 'in progress only', 'in progress and approved'])
def test_population_qualifiers_are_not_removed(population):
    task, kb, _ = fixture()
    task.businessFocus = population
    kb.intent_lexical_context['requirements'] = requirements_for(task)
    source, facts, binding, requirement = isolated_population(task, kb)
    assert not _semantic_match(binding, requirement, source, facts)


def test_qe_translation_and_browser_hint_cannot_invent_alias():
    task, kb, observation = fixture()
    kb.intent_lexical_context['question'] = 'Show my in-progress requests.'
    kb.intent_lexical_context['currentPage'] = {'view': 'todo', 'route': PAGE, 'routeAuthorized': True}
    assert not route(task, kb, observation)['passed']
