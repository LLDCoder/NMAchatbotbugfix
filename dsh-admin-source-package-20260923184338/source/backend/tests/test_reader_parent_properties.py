"""Synthetic single-record properties: no portal route or business alias patches."""
import copy
import json
import pytest
from app.generic_reader import KnowledgeStore, execute_analysis, PipelineError
from app.generic_reader_contracts import TaskSpec, AnalysisPlan
from app.reader_bindings import bind_analysis_evidence
from app.reader_collection import projection_hash
from app.reader_subject import bind_authenticated_records
from test_projected_collection import gateway


def fixture():
    data = {'data': {'key': 'viewer-a', 'groups': [{'name': 'Blue'}, {'name': 'Green'}],
                     'badges': [{'name': 'Member'}]}}
    source = {'data': data, 'kind': 'api_response', 'page': '/viewer', 'operationRef': 'GET /api/viewer',
              'completeness': 'bounded', 'truncated': True, 'capturedAt': '2026-09-27', 'principalScopeRef': 'scope',
              'collectionContext': {'requestFields': ['viewerKey'], 'parameterHashes': {'viewerKey': projection_hash('viewer-a')}},
              'fieldEvidence': gateway._reader_field_evidence(data, data)}
    task = TaskSpec(stage='task', businessObject='viewer', requestedScope='personal', requestedGrain='viewer',
        requestedAttributes=['groups', 'badges'], requestedMeasures=[], groupBy=[], timeRange='unknown', filters=[],
        outputShape='detail', needsLiveData=True, readOnly=True, searchQuery='current viewer groups badges', unresolvedSlots=[])
    facts = [{'id': kind, 'kind': kind, 'concept': value, 'fields': ['key'], 'sourcePath': '/data',
              'operationRef': source['operationRef'], **({'contextParameters': {}, 'contextBindings': {'viewerKey': 'principal.user_id'}} if kind == 'scope' else {})}
             for kind, value in [('object', 'viewer'), ('grain', 'viewer'), ('scope', 'personal')]]
    facts += [{'id': name, 'kind': 'attribute', 'concept': name, 'fields': ['name'], 'sourcePath': '/data/'+name,
               'operationRef': source['operationRef']} for name in ['groups', 'badges']]
    record = {'id': 'viewer.profile', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
        'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': ['/viewer']},
        'sources': [{'reference': '/viewer'}], 'payload': {'bindings': facts,
            'sourceBinding': {'sourcePath': '/data', 'operationRef': source['operationRef']},
            'authenticatedRecord': {'subject': 'user', 'requestField': 'viewerKey', 'identityField': 'key'}}}
    knowledge = KnowledgeStore(); knowledge.add({'chunks': [{'id': 'viewer', 'content': json.dumps({'records': [record]})}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']; claim = lambda v: {'value': v, 'evidence': [{'sourceId': ref}]}
    plan = AnalysisPlan.model_validate({'stage': 'analysis', 'missing': [], 'context': {
        'scope': 'personal', 'scopeEvidence': [{'sourceId': ref}], 'grain': claim('viewer'),
        'population': claim('current viewer'), 'filterScope': claim('current subject'), 'time': claim('current'), 'caveats': []},
        'steps': [{'id': name, 'op': 'read_rows', 'sourceId': 'profile', 'path': '/data/'+name, 'fields': ['name'],
            'label': name, 'role': 'detail', 'evidence': [{'sourceId': ref}]} for name in ['groups', 'badges']],
        'requirementBindings': [{'requirementId': kind, 'sourceId': 'profile', 'knowledgeBindingId': 'viewer.profile#'+kind,
                                'stepIds': ['groups', 'badges']} for kind in ['object', 'grain', 'scope']] + [
            {'requirementId': 'attribute_'+str(i), 'sourceId': 'profile', 'knowledgeBindingId': 'viewer.profile#'+name,
             'stepIds': [name]} for i, name in enumerate(['groups', 'badges'])]})
    return task, plan, {'profile': source}, knowledge


def run(f):
    task, plan, sources, knowledge = f
    bind_authenticated_records(knowledge, sources, 'viewer-a')
    bind_analysis_evidence(plan, task, knowledge, sources)
    return execute_analysis(plan, sources, knowledge, [], task=task)


def test_multiple_child_properties_keep_one_parent_without_exposing_identity():
    result = run(fixture())
    assert result['requirementsSatisfied'] and not result['missing']
    assert [x['value'] for x in result['outputs']] == [[{'name': 'Blue'}, {'name': 'Green'}], [{'name': 'Member'}]]
    assert all('key' not in row for x in result['outputs'] for row in x['value'])
    assert all(c['outputIds'] == ['groups', 'badges'] for c in result['requirementCoverage'] if c['kind'] in {'object','grain','scope'})


@pytest.mark.parametrize('change', ['request', 'response', 'receipt', 'operation', 'page'])
def test_subject_proof_requires_current_identity_request_response_and_page(change):
    f = fixture(); s = f[2]['profile']
    if change == 'request': s['collectionContext']['parameterHashes']['viewerKey'] = projection_hash('other')
    if change == 'response': s['data']['data']['key'] = 'other'
    if change == 'receipt': s['fieldEvidence']['/data/key']['status'] = 'transformed'
    if change == 'operation': s['operationRef'] = 'GET /api/other'
    if change == 'page': s['page'] = '/other'
    assert not bind_authenticated_records(f[3], f[2], 'viewer-a')
    assert 'verifiedRecord' not in s and 'subjectParameterHashes' not in s


def test_incomplete_child_property_is_not_complete_just_because_parent_is_verified():
    f = fixture(); f[2]['profile']['fieldEvidence']['/data/groups']['status'] = 'bounded'
    result = run(f)
    assert not result['requirementsSatisfied']
    assert next(c for c in result['requirementCoverage'] if c['id'] == 'attribute_0')['status'] == 'unfulfilled'


def test_parent_proof_cannot_turn_child_count_into_user_count():
    f = fixture(); f[0].outputShape = 'count'; f[0].requestedAttributes = []; f[0].requestedMeasures = ['count']
    raw = f[1].model_dump(); raw['steps'] = raw['steps'][:1]; raw['steps'][0]['expose'] = False
    raw['steps'].append({'id': 'count', 'op': 'count', 'inputs': ['groups'], 'label': 'Viewer count',
        'role': 'total', 'expose': True, 'evidence': raw['steps'][0]['evidence']})
    raw['requirementBindings'] = raw['requirementBindings'][:3]
    for b in raw['requirementBindings']: b['stepIds'] = ['groups']
    raw['requirementBindings'].append({'requirementId': 'measure_0', 'sourceId': 'profile',
        'sourcePath': '/data/groups', 'stepIds': ['count'], 'evidence': raw['steps'][0]['evidence']})
    result = run((f[0], AnalysisPlan.model_validate(raw), f[2], f[3]))
    assert result['outputs'][0]['value'] == 2  # Two groups, not two viewers.
    assert not result['requirementsSatisfied'] and result['outputs'][0]['role'] == 'observation'


def test_redundant_hidden_parent_key_read_is_rebound_to_real_property_outputs():
    f = fixture(); parent = f[1].steps[0].model_copy(deep=True)
    parent.id = 'parent'; parent.path = '/data'; parent.fields = ['key']; parent.expose = False
    f[1].steps.insert(0, parent)
    for b in f[1].requirementBindings[:3]: b.stepIds = ['parent']
    result = run(f)
    assert result['requirementsSatisfied']
    assert all(b.stepIds == ['groups','badges'] for b in f[1].requirementBindings[:3])


def test_parent_context_covers_each_verified_property_even_when_one_branch_was_already_reachable():
    f=fixture()
    # The model links the parent context only to the first property. Both reads
    # belong to the same verified parent, so the compiler must close this lineage.
    for binding in f[1].requirementBindings[:3]:binding.stepIds=['groups']
    result=run(f)
    assert result['requirementsSatisfied']
    assert all(set(b.stepIds)=={'groups','badges'} for b in f[1].requirementBindings[:3])


def test_conflicting_subject_mappings_are_not_resolved_by_order():
    f = fixture(); record = copy.deepcopy(next(iter(f[3].items.values()))['record'])
    record['id'] = 'other.mapping'; record['payload']['authenticatedRecord']['requestField'] = 'otherKey'
    f[2]['profile']['collectionContext']['parameterHashes']['otherKey'] = projection_hash('viewer-a')
    f[3].add({'chunks': [{'id': 'other', 'content': json.dumps({'records': [record]})}]})
    assert not bind_authenticated_records(f[3], f[2], 'viewer-a')


def test_extra_request_filter_cannot_be_ignored_by_subject_context():
    f = fixture(); f[2]['profile']['collectionContext']['parameterHashes']['hiddenFilter'] = projection_hash('unverified')
    assert not run(f)['requirementsSatisfied']


def test_subject_is_revalidated_after_route_proof_reset():
    from app.reader_routing import verify_route
    f = fixture(); task, _, sources, knowledge = f
    assert bind_authenticated_records(knowledge, sources, 'viewer-a')
    verify_route(task, '/viewer', '/viewer', {}, sources, knowledge)
    assert 'verifiedRecord' not in sources['profile']
    assert run(f)['requirementsSatisfied']


@pytest.mark.parametrize('missing_attribute', [False, True])
def test_engine_detail_proof_ignores_model_hidden_branch_but_requires_attributes(missing_attribute):
    from app.generic_reader_contracts import RequirementBinding
    f = fixture(); parent = f[1].steps[0].model_copy(deep=True)
    parent.id = 'parent'; parent.path = '/data'; parent.fields = ['key']; parent.expose = False
    f[1].steps.insert(0, parent)
    f[1].requirementBindings.append(RequirementBinding(requirementId='detail', sourceId='profile',
        sourcePath='/data', stepIds=['parent', 'groups', 'badges'], fields=['key']))
    if missing_attribute:
        f[1].requirementBindings = [b for b in f[1].requirementBindings if b.requirementId != 'attribute_1']
    result = run(f)
    assert result['requirementsSatisfied'] is not missing_attribute
    assert not any(b.requirementId == 'detail' for b in f[1].requirementBindings)
    assert next(c for c in result['requirementCoverage'] if c['kind'] == 'detail')['status'] == 'satisfied'
