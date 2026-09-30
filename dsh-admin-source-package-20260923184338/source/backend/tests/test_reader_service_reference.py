"""Only a current, bound, exact record service may select supplementary guidance."""
import copy
import json
import pytest

from app.generic_reader import KnowledgeStore
from app.reader_collection import projection_hash
from app.reader_routing import task_fingerprint
from app.reader_service_reference import verified_service_reference_matches
from test_reader_context_v3 import task as make_task


def fixture():
    task = make_task(recordIdentity='CASE-7')
    record = {'id': 'synthetic.service', 'revision': 1, 'status': 'active', 'kind': 'field_semantics',
        'title': 'Case service', 'applicability': {'portal': 'admin', 'environments': ['local'],
            'pageRefs': ['/cases/detail']}, 'sources': [{'reference': 'inspected-case-schema'}],
        'payload': {'bindings': [{'id': 'name', 'kind': 'attribute', 'concept': 'service name',
            'fields': ['service'], 'sourcePath': '/data', 'operationRef': 'GET /api/case/{id}'}],
            'serviceReferenceGuidance': {'matchBindingId': 'synthetic.service#name',
                'references': [{'serviceNames': ['Film permit', 'تصريح تصوير'],
                    'sections': [{'en': 'Current general information; historical applicability unverified.'}]}]}}}
    source = {'kind': 'api_response', 'page': '/cases/detail?id=7',
        'operationRef': 'GET /api/case/{id}', 'principalScopeRef': 'principal',
        'capturedAt': '2026-09-28T13:00:00Z', 'observationRef': 'observation',
        'taskFingerprint': task_fingerprint(task), 'data': {'data':
            {'id': 7, 'number': 'CASE-7', 'service': 'Film permit', 'applicant': 'private-name'}},
        'verifiedRecord': {'single': True, 'identity': 'CASE-7', 'path': '/data',
            'field': 'number', 'keyFields': ['id']}, 'fieldEvidence': {}}
    for k, v in source['data']['data'].items():
        source['fieldEvidence']['/data/'+k] = {'status': 'complete', 'valueHash': projection_hash(v)}
    return task, record, source


def run(task, record, source, ids=('source',)):
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'synthetic', 'source_name': 'synthetic.json',
        'content': json.dumps({'packageStatus': 'active', 'records': [record]})}]})
    return verified_service_reference_matches(task, knowledge, {'source': source},
        verified_source_ids=set(ids), principal_ref='principal', captured_at='2026-09-28T13:00:00Z')


@pytest.mark.parametrize('name', ['Film permit', 'تصريح تصوير'])
def test_exact_current_match_exposes_only_the_declared_service(name):
    task, record, source = fixture()
    source['data']['data']['service'] = name
    source['fieldEvidence']['/data/service']['valueHash'] = projection_hash(name)
    result = run(task, record, source)
    assert len(result) == 1 and result[0]['matchedServiceName'] == name
    assert not result[0]['historicalApplicabilityVerified']
    assert not result[0]['satisfiesRequestedRule']
    assert 'private-name' not in json.dumps(result)


@pytest.mark.parametrize('field,value', [
    ('principalScopeRef', 'different'), ('capturedAt', '2026-09-27T13:00:00Z'),
    ('taskFingerprint', 'old-task'), ('observationRef', ''), ('page', '/other'),
    ('operationRef', 'GET /api/other'), ('kind', 'page_section')])
def test_wrong_source_context_never_matches(field, value):
    task, record, source = fixture(); source[field] = value
    assert not run(task, record, source)


@pytest.mark.parametrize('field,value', [('single', False), ('identity', 'CASE-8'),
    ('path', '/elsewhere'), ('field', ''), ('keyFields', [])])
def test_wrong_or_missing_record_proof_never_matches(field, value):
    task, record, source = fixture(); source['verifiedRecord'][field] = value
    assert not run(task, record, source)


@pytest.mark.parametrize('field', ['service', 'number', 'id'])
def test_unattested_values_cannot_supply_the_match(field):
    task, record, source = fixture()
    source['fieldEvidence']['/data/'+field]['valueHash'] = 'invalid'
    assert not run(task, record, source)


@pytest.mark.parametrize('change', ['absent_binding', 'two_fields', 'no_match_binding', 'draft',
    'ambiguous_reference', 'qualified_service', 'null_service', 'no_verified_route', 'wrong_record_value'])
def test_missing_semantics_and_ambiguous_names_never_match(change):
    task, record, source = fixture(); payload = record['payload']; ids = ('source',)
    if change == 'absent_binding': payload['bindings'] = []
    if change == 'two_fields': payload['bindings'][0]['fields'].append('applicant')
    if change == 'no_match_binding': payload['serviceReferenceGuidance'].pop('matchBindingId')
    if change == 'draft': record['status'] = 'draft'
    if change == 'ambiguous_reference':
        payload['serviceReferenceGuidance']['references'] *= 2
    if change in {'qualified_service', 'null_service'}:
        value = 'Film permit for a different region' if change == 'qualified_service' else None
        source['data']['data']['service'] = value
        source['fieldEvidence']['/data/service']['valueHash'] = projection_hash(value)
    if change == 'wrong_record_value':
        source['data']['data']['number'] = 'CASE-8'
        source['fieldEvidence']['/data/number']['valueHash'] = projection_hash('CASE-8')
    if change == 'no_verified_route': ids = ()
    assert not run(task, record, source, ids)


def test_match_does_not_change_time_region_version_or_requested_scope():
    task, record, source = fixture()
    task.filters = ['region A', 'rules effective on original submission']
    task.timeRange = 'last year'
    source['taskFingerprint'] = task_fingerprint(task)
    before = copy.deepcopy(task.model_dump())
    assert run(task, record, source)
    assert task.model_dump() == before


@pytest.mark.parametrize('field,value', [('matchBindingId', {}), ('references', None)])
def test_malformed_reference_configuration_fails_closed(field, value):
    task, record, source = fixture()
    record['payload']['serviceReferenceGuidance'][field] = value
    assert not run(task, record, source)


def test_two_different_observations_cannot_select_by_arrival_order():
    task, record, source = fixture()
    other = copy.deepcopy(source); other['observationRef'] = 'different-observation'
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'synthetic', 'source_name': 'synthetic.json',
        'content': json.dumps({'packageStatus': 'active', 'records': [record]})}]})
    assert not verified_service_reference_matches(task, knowledge, {'a': source, 'b': other},
        verified_source_ids={'a', 'b'}, principal_ref='principal', captured_at='2026-09-28T13:00:00Z')


@pytest.mark.parametrize('different_key', [True, False])
@pytest.mark.parametrize('reverse_sources', [True, False])
def test_same_observation_display_identity_cannot_choose_between_sources(different_key, reverse_sources):
    task, record, source = fixture()
    other = copy.deepcopy(source)
    if different_key:
        other['data']['data']['id'] = 8
        other['fieldEvidence']['/data/id']['valueHash'] = projection_hash(8)
    # Both sources carry valid hashes and the same CASE-7 display identity,
    # reference name, principal, task, observation and capture time.
    sources = {'a': source, 'b': other}
    if reverse_sources:
        sources = dict(reversed(list(sources.items())))
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'synthetic', 'source_name': 'synthetic.json',
        'content': json.dumps({'packageStatus': 'active', 'records': [record]})}]})
    assert not verified_service_reference_matches(task, knowledge, sources,
        verified_source_ids={'a', 'b'}, principal_ref='principal', captured_at='2026-09-28T13:00:00Z')


@pytest.mark.parametrize('bad_fields', [None, 'service', {'name': 'service'}, []])
def test_malformed_binding_fields_do_not_create_a_match(bad_fields):
    task, record, source = fixture()
    record['payload']['bindings'][0]['fields'] = bad_fields
    assert not run(task, record, source)
