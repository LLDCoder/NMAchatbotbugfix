"""Fresh synthetic detail reads must independently prove a navigation hint."""
import copy
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.generic_reader import KnowledgeStore, PipelineError, source_inventory
from app.generic_reader_contracts import RouteHop, RoutingDecision
from app.reader_collection import projection_hash
from app.reader_current_page import navigation_value
from app.reader_requirements import requirements_for
from app.reader_routing import bind_route, page_routing, task_fingerprint, validate_decision, verify_route
from test_reader_context_v3 import task
from test_platform_portal_reader import gateway


def setup():
    value = task(recordIdentity='CR-123', view='', filters=[], groupBy=[], timeRange='',
                 requestedMeasures=[], requestedScope='unknown', outputShape='detail')
    parameter = {'id': 'current_crystal', 'name': 'entry', 'from': 'current_page',
        'operationRef': 'GET /api/crystal/{entry}', 'sourcePath': '/data/detail',
        'identityField': 'code', 'keyFields': ['key'], 'field': 'entry', 'required': True, 'unique': False}
    definition = {key: parameter[key] for key in ('operationRef', 'sourcePath', 'identityField', 'keyFields', 'unique')}
    definition['id'] = 'crystal'
    package = {'packageStatus': 'active', 'records': [{'id': 'crystals.detail', 'kind': 'page_definition',
        'revision': 1, 'status': 'active', 'title': 'Crystal detail', 'sources': [{'reference': 'formal-source'}],
        'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': ['/work/crystal']},
        'payload': {'routing': {'parameters': [parameter], 'records': [definition]}}}]}
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'source_name': 'Crystal-detail.json', 'content': json.dumps(package)}]})
    knowledge.prompt()
    candidate = {'candidateId': 'crystal', 'route': '/work/crystal', 'parameters': ['entry']}
    hint = {'source': 'browser_hint', 'routeAuthorized': True, 'route': '/work/crystal',
            'query': {'entry': 'task-8'}, 'selectedRecordKeys': [],
            'capturedAt': datetime.now(timezone.utc).isoformat()}
    hop = RouteHop(candidateId='crystal', purpose='read_final', parameterBindingIds=['crystals.detail#current_crystal'])
    proof = {}
    route = bind_route(hop, candidate, value, knowledge, proof_out=proof, current_page=hint,
                       principal_scope_ref='principal', turn_ref='turn')
    observation = {'pageIdentity': {'path': '/work/crystal', 'parameterHashes': {'entry': projection_hash('task-8')}},
        'apiDiscovery': {'candidates': [{'operationKey': 'GET /api/crystal/{entry}', 'policyState': 'allowed',
            'status': 200, 'responseEvidence': {'data': {'detail': {'code': 'CR-123', 'entry': 'task-8', 'key': 42}}}}]}}
    capture = observation['apiDiscovery']['candidates'][0]
    capture['fieldEvidence'] = gateway._reader_field_evidence(capture['responseEvidence'], capture['responseEvidence'])
    sources = source_inventory(observation, route, datetime.now(timezone.utc).isoformat(), 'principal')
    # The runtime binds the selected fresh source after page verification.
    for source in sources.values():
        source['taskFingerprint'] = task_fingerprint(value)
    return value, knowledge, candidate, hint, hop, proof, route, observation, sources


def verify(bundle, **updates):
    value, knowledge, candidate, hint, hop, proof, route, observation, sources = bundle
    return verify_route(value, route, candidate['route'], observation, sources, knowledge,
        bound_record=proof, principal_scope_ref=updates.get('principal', 'principal'),
        turn_ref=updates.get('turn', 'turn'))


def test_current_page_requires_fresh_record_not_global_number_uniqueness():
    bundle = setup()
    assert verify(bundle).passed
    result = next(iter(bundle[-1].values()))['verifiedRecord']
    assert result['identity'] == 'CR-123' and result['single'] is True
    assert page_routing(bundle[1], bundle[2]['route'])['records'][0]['unique'] is False
    assert not verify_route(bundle[0], bundle[6], bundle[2]['route'], bundle[7], bundle[8], bundle[1]).passed


@pytest.mark.parametrize('change', ['wrong_page', 'unauthorized', 'no_browser_source', 'missing_time', 'stale',
                                  'future', 'multiple_selection', 'missing_query', 'array_query', 'empty_query'])
def test_invalid_current_hint_does_not_bind(change):
    value, knowledge, candidate, hint, hop, *_ = setup()
    if change == 'wrong_page': hint['route'] = '/another/detail'
    if change == 'unauthorized': hint['routeAuthorized'] = False
    if change == 'no_browser_source': hint['source'] = 'history'
    if change == 'missing_time': hint.pop('capturedAt')
    if change == 'stale': hint['capturedAt'] = (datetime.now(timezone.utc)-timedelta(minutes=16)).isoformat()
    if change == 'future': hint['capturedAt'] = (datetime.now(timezone.utc)+timedelta(minutes=2)).isoformat()
    if change == 'multiple_selection': hint['selectedRecordKeys'] = ['42', '43']
    if change == 'missing_query': hint['query'] = {'another': 'task-8'}
    if change == 'array_query': hint['query'] = {'entry': ['task-8', 'task-9']}
    if change == 'empty_query': hint['query'] = {'entry': ''}
    with pytest.raises(PipelineError, match='current_page_navigation_hint_unavailable'):
        bind_route(hop, candidate, value, knowledge, proof_out={}, current_page=hint,
                   principal_scope_ref='principal', turn_ref='turn')


@pytest.mark.parametrize('field,new_value', [('code', 'CR-999'), ('entry', 'task-9'), ('key', None),
                                          ('key', []), ('key', '[truncated]')])
def test_wrong_record_entry_or_missing_entity_key_cannot_be_verified(field, new_value):
    bundle = setup()
    next(iter(bundle[-1].values()))['data']['data']['detail'][field] = new_value
    assert not verify(bundle).passed
    assert all('verifiedRecord' not in source for source in bundle[-1].values())


@pytest.mark.parametrize('field,value', [('principalScopeRef', 'other'), ('ready', False), ('page', '/elsewhere'),
                                      ('kind', 'page_section'), ('observationRef', ''),
                                      ('taskFingerprint', 'other-task'),
                                      ('capturedAt', '2000-01-01T00:00:00+00:00')])
def test_old_or_other_principal_sources_cannot_prove_record(field, value):
    bundle = setup()
    next(iter(bundle[-1].values()))[field] = value
    assert not verify(bundle).passed


def test_proof_is_bound_to_turn_and_principal():
    bundle = setup()
    assert not verify(bundle, turn='next-turn').passed
    assert not verify(bundle, principal='another-principal').passed
    bundle[5]['boundAt'] = '2000-01-01T00:00:00+00:00'
    assert not verify(bundle).passed


def test_business_number_with_conflicting_returned_entity_keys_is_ambiguous():
    bundle = setup()
    source = copy.deepcopy(next(iter(bundle[-1].values())))
    source['data']['data']['detail']['key'] = 43
    source['fieldEvidence'] = gateway._reader_field_evidence(source['data'], source['data'])
    bundle[-1]['second'] = source
    result = verify(bundle)
    assert not result.passed and result.checks[-1].reason == 'record_ambiguous'


@pytest.mark.parametrize('field', ['code', 'entry', 'key'])
@pytest.mark.parametrize('failure', ['missing', 'bounded', 'wrong_hash'])
def test_each_identity_field_requires_complete_matching_gateway_attestation(field, failure):
    bundle = setup()
    source = next(iter(bundle[-1].values()))
    path = '/data/detail/' + field
    if failure == 'missing':
        source['fieldEvidence'].pop(path)
    elif failure == 'bounded':
        source['fieldEvidence'][path]['status'] = 'bounded'
    else:
        source['fieldEvidence'][path]['valueHash'] = projection_hash('different-value')
    result = verify(bundle)
    assert not result.passed and result.checks[-1].reason == 'current_page_record_fields_unverified'


def test_unrelated_nested_array_truncation_does_not_erase_attested_record_keys():
    bundle = setup()
    source = next(iter(bundle[-1].values()))
    original = copy.deepcopy(source['data'])
    original['data']['history'] = [{'text': 'first'}, {'text': 'second'}]
    source['data']['data']['history'] = [{'text': 'first'}]
    source['truncated'] = True
    source['fieldEvidence'] = gateway._reader_field_evidence(original, source['data'])
    assert source['fieldEvidence']['/data/history']['status'] == 'bounded'
    assert verify(bundle).passed


def test_detail_collection_cannot_masquerade_as_single_returned_object():
    bundle = setup()
    source = next(iter(bundle[-1].values()))
    source['data']['data']['detail'] = [source['data']['data']['detail']]
    assert not verify(bundle).passed


@pytest.mark.parametrize('status', [401, 403, 404, 500])
def test_failed_authorized_read_is_not_record_evidence(status):
    bundle = list(setup())
    bundle[7]['apiDiscovery']['candidates'][0]['status'] = status
    bundle[8] = source_inventory(bundle[7], bundle[6], datetime.now(timezone.utc).isoformat(), 'principal')
    assert not bundle[8] and not verify(bundle).passed


def test_gateway_observed_query_hash_is_required_not_requested_url_alone():
    bundle = setup()
    bundle[7]['pageIdentity']['parameterHashes']['entry'] = projection_hash('task-9')
    assert not verify(bundle).passed
    bundle[7]['pageIdentity']['parameterHashes'] = {}
    assert not verify_route(bundle[0], bundle[6], bundle[6], bundle[7], bundle[8], bundle[1],
        bound_record=bundle[5], principal_scope_ref='principal', turn_ref='turn').passed


def test_anonymous_collection_request_cannot_adopt_browser_record():
    value, knowledge, candidate, hint, hop, *_ = setup()
    value.recordIdentity = ''
    with pytest.raises(PipelineError, match='current_page_binding_knowledge_missing'):
        bind_route(hop, candidate, value, knowledge, proof_out={}, current_page=hint,
                   principal_scope_ref='principal', turn_ref='turn')


def test_route_decision_accepts_documented_current_hint_but_rejects_wrong_page():
    value, knowledge, candidate, hint, hop, *_ = setup()
    ref = {'sourceId': next(iter(knowledge.passages))}
    decision = RoutingDecision(stage='routing_decision', decision='route', taskFingerprint=task_fingerprint(value),
        candidates=[{'candidateId': 'crystal', 'evidence': [ref], 'conditions': [
            {'requirementId': r['id'], 'status': 'supported', 'evidence': [ref], 'reason': 'Formal crystal contract'}
            for r in requirements_for(value)], 'reason': 'Correct object'}], routePlan=[hop], reason='Fresh detail read')
    validate_decision(decision, value, [candidate], knowledge, current_page=hint)
    hint['route'] = '/another/detail'
    with pytest.raises(PipelineError, match='current_page_navigation_hint_unavailable'):
        validate_decision(decision, value, [candidate], knowledge, current_page=hint)
