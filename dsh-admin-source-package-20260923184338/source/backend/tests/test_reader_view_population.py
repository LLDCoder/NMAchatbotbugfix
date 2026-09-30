import copy
import json
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.generic_reader_contracts import TaskSpec
from app.reader_requirements import _semantic_match, requirements_for, semantic_bindings


def fixture():
    payload = {'pageRef': '/customs', 'view': 'queued', 'bindings': [
        {'id': 'population', 'kind': 'population', 'concept': 'queued', 'aliases': ['waiting'], 'contextParameters': {'query': ''}},
        {'id': 'scope', 'kind': 'scope', 'concept': 'personal', 'aliases': ['my', 'mine'], 'contextParameters': {'query': ''}},
        {'id': 'object', 'kind': 'object', 'concept': 'parcel', 'aliases': ['customs parcels']},
    ]}
    for f in payload['bindings']:
        f.update(operationRef='GET /parcels', sourcePath='/items', fields=['id'])
    records = [{'id': 'facts', 'kind': 'field_semantics', 'status': 'active', 'revision': 1, 'payload': payload},
        {'id': 'page', 'kind': 'page_definition', 'status': 'active', 'revision': 1, 'payload': {
            'pageIdentity': {'route': '/customs'}, 'routing': {'views': [
                {'id': 'queued', 'label': 'Queued', 'aliases': ['waiting', 'queued list']}]}}}]
    task = TaskSpec(stage='task', businessObject='parcel', businessFocus='in my customs waiting list',
                    requestedScope='personal', view='queued', outputShape='list', requestedGrain='parcel',
                    requestedMeasures=[], groupBy=[], timeRange='unknown', filters=[],
                    needsLiveData=True, readOnly=True, searchQuery='customs waiting parcels', unresolvedSlots=[])
    return records, task


def knowledge(records, task):
    return SimpleNamespace(items={str(i): {'documentId': str(i), 'record': r} for i, r in enumerate(records)},
                           intent_lexical_context={'requirements': requirements_for(task)})


def population(records, task):
    return next(f for f in semantic_bindings(knowledge(records, task)) if f['kind'] == 'population')


def test_only_complete_same_page_composition_extends_lexical_evidence():
    records, task = fixture(); before = copy.deepcopy(task)
    fact = population(records, task)
    proof = fact['intentAliases'][0]
    assert proof['evidenceBindingIds'] == ['facts#population', 'facts#scope', 'facts#object']
    assert proof['viewEvidence']['view'] == 'queued'
    assert task == before  # No population, scope or view requirements are removed.
    binding = SimpleNamespace(knowledgeBindingId='facts#population', sourcePath='/items', fields=['id'])
    req = next(r for r in requirements_for(task) if r['kind'] == 'population')
    assert _semantic_match(binding, req, {'operationRef': 'GET /parcels'}, {'facts#population': fact})
    assert not _semantic_match(binding, req, {'operationRef': 'GET /other'}, {'facts#population': fact})


@pytest.mark.parametrize('focus', [
    'in my customs waiting list excluding returned', 'in my customs waiting list not urgent',
    'in someone else customs waiting list', 'in all customs waiting lists',
    'in my customs overdue waiting list', 'in my customs completed list',
    'in my finance waiting list', 'in my customs waiting queue', 'in my customs rejected list',
])
def test_extra_predicates_ownership_workspace_and_undocumented_wrappers_are_not_dropped(focus):
    records, task = fixture(); task.businessFocus = focus
    assert not population(records, task).get('intentAliases')


@pytest.mark.parametrize('change', [
    'view', 'scope', 'object', 'inactive', 'route', 'population_view', 'source', 'path',
    'fields', 'context', 'scope_context', 'condition', 'no_wrapper', 'no_population_name',
    'conflict', 'ambiguous_view', 'scope_binding',
])
def test_missing_or_conflicting_page_proof_cannot_establish_composition(change):
    records, task = fixture(); facts = records[0]['payload']['bindings']; page = records[1]['payload']
    if change == 'view': task.view = 'done'
    if change == 'scope': task.requestedScope = 'team'
    if change == 'object': task.businessObject = 'invoice'
    if change == 'inactive': records[1]['status'] = 'inactive'
    if change == 'route': page['pageIdentity']['route'] = '/other'
    if change == 'population_view': records[0]['payload']['view'] = 'done'
    if change == 'source': facts[1]['operationRef'] = 'GET /other'
    if change == 'path': facts[1]['sourcePath'] = '/other'
    if change == 'fields': facts[1]['fields'] = ['otherId']
    if change == 'context': facts[0].pop('contextParameters')
    if change == 'scope_context': facts[1]['contextParameters']['query'] = 'something'
    if change == 'condition': facts[0]['conditions'] = [{'field': 'id', 'predicate': 'eq', 'value': '1'}]
    if change == 'no_wrapper': page['routing']['views'][0]['aliases'] = ['waiting']
    if change == 'no_population_name': page['routing']['views'][0].update(id='queued', label='Work', aliases=['work list'])
    if change == 'conflict': records.append(copy.deepcopy(records[1])); records[-1]['revision'] = 2
    if change == 'ambiguous_view': page['routing']['views'].append(copy.deepcopy(page['routing']['views'][0]))
    if change == 'scope_binding': facts[1]['contextBindings'] = {'ownerId': 'principal.user_id'}
    assert not population(records, task).get('intentAliases')


def test_real_failed_task_and_exact_page_facts_reproduce_then_resolve_only_population_match():
    data = json.loads((Path(__file__).parent / 'fixtures/view_population_s09.json').read_text())
    task = TaskSpec.model_validate(data['task']); kb = knowledge(data['records'], task)
    req = next(r for r in requirements_for(task) if r['id'] == 'population')
    key = 'admin.page-docs.licensing.applications.todo.collection#pending_population'
    fact = next(f for f in semantic_bindings(kb) if f['knowledgeBindingId'] == key)
    binding = SimpleNamespace(knowledgeBindingId=key, sourcePath=fact['sourcePath'], fields=fact['fields'])
    source = {'operationRef': fact['operationRef']}
    uncomposed = {k: v for k, v in fact.items() if k != 'intentAliases'}
    assert not _semantic_match(binding, req, source, {key: uncomposed})
    assert _semantic_match(binding, req, source, {key: fact})
    assert {r['kind'] for r in requirements_for(task)} >= {'object', 'scope', 'population', 'view'}


def test_qualified_view_reuses_exact_page_object_and_view_evidence_for_population():
    from app.reader_view_population import documented_view_identity
    records, task = fixture(); task.view = 'customs waiting'
    kb = knowledge(records, task)
    proof = documented_view_identity(kb, '/customs', task.view, task.businessObject)
    assert proof['id'] == 'queued' and proof['objectEvidenceBindingId'] == 'facts#object'
    assert population(records, task)['intentAliases'][0]['viewEvidence']['view'] == 'queued'
    assert task.view == 'customs waiting'


@pytest.mark.parametrize('view', ['customs done', 'finance waiting', 'customs urgent waiting', 'customs not waiting', 'waiting for customs', 'someone else customs waiting'])
def test_qualified_view_does_not_strip_unproved_words(view):
    from app.reader_view_population import documented_view_identity
    records, task = fixture();kb = knowledge(records, task)
    assert documented_view_identity(kb, '/customs', view, task.businessObject) is None


@pytest.mark.parametrize('change', ['page', 'inactive', 'different_entity', 'ambiguous_view', 'conflicting_revision', 'conditional_object', 'wrong_view', 'missing_operation'])
def test_qualified_view_requires_unique_active_same_page_object_proof(change):
    from app.reader_view_population import documented_view_identity
    records, task = fixture()
    if change == 'page': records[0]['payload']['pageRef'] = '/another'
    if change == 'inactive': records[0]['status'] = 'inactive'
    if change == 'different_entity': task.businessObject = 'invoice'
    if change == 'ambiguous_view':
        records[1]['payload']['routing']['views'].append({'id': 'other', 'label': 'Waiting'})
        other = copy.deepcopy(records[0]);other['id']='other';other['payload']['view']='other';records.append(other)
    if change == 'conflicting_revision':
        other = copy.deepcopy(records[0]);other['revision'] = 2;records.append(other)
    if change == 'conditional_object': records[0]['payload']['bindings'][2]['conditions'] = [{'field': 'x'}]
    if change == 'wrong_view': records[0]['payload']['view'] = 'done'
    if change == 'missing_operation': records[0]['payload']['bindings'][2].pop('operationRef')
    assert documented_view_identity(knowledge(records, task), '/customs', 'customs waiting', task.businessObject) is None


@pytest.mark.parametrize('selected,duplicate', [(True,False),(False,False),(True,True)])
def test_qualified_view_still_requires_unique_actual_selected_control(selected, duplicate):
    from app.reader_routing import verify_route
    records, task = fixture();task.view='customs waiting'
    for r in records: r['applicability']={'pageRefs':['/customs']}
    observation={'pageIdentity':{'path':'/customs'}, 'tabControls': [
        {'name':'Waiting','selected':selected,'groupRef':'main'},
        {'name':'Completed','selected':not selected,'groupRef':'main'}]}
    if duplicate: observation['tabControls'].append({'name':'Waiting','selected':True,'groupRef':'other'})
    # This fixture tests the selected DOM view; API ownership needs a separate
    # active operation/context proof and is covered by source-specific tests.
    sources={'rows':{'kind':'page_section','operationRef':'permitted_page_observation','page':'/customs','ready':True}}
    result=verify_route(task,'/customs','/customs',observation,sources,knowledge(records,task), require_record=False)
    assert result.passed is (selected and not duplicate)
    assert sources['rows'].get('verifiedView') == (task.view if selected and not duplicate else None)


def test_original_failed_qualified_view_and_population_share_one_proof():
    from app.reader_routing import verify_route
    raw=json.loads((Path(__file__).parent/'fixtures/view_population_s09.json').read_text())
    current=json.loads((Path(__file__).parent/'fixtures/qualified_view_s09.json').read_text())
    task=TaskSpec.model_validate(current['task'])
    assert current['actualFailedVerification']['passed'] is False
    assert current['proposedCanonicalView']=='todo'
    kb=knowledge(raw['records'],task)
    observation=current['observation']
    sources={'rows':{}}
    check=verify_route(task,'/licensing/applications','/licensing/applications',observation,sources,kb,require_record=False)
    assert check.passed
    req=next(r for r in requirements_for(task) if r['id']=='population')
    facts=semantic_bindings(kb)
    fact=next(f for f in facts if f['knowledgeBindingId']=='admin.page-docs.licensing.applications.todo.collection#pending_population')
    binding=SimpleNamespace(knowledgeBindingId=fact['knowledgeBindingId'],sourcePath=fact['sourcePath'],fields=fact['fields'])
    assert _semantic_match(binding,req,{'operationRef':fact['operationRef']},{fact['knowledgeBindingId']:fact})
