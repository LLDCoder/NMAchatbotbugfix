"""A current entry can replace only a redundant same-entity identity lookup."""
import copy
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.generic_reader import KnowledgeStore
from app.generic_reader_contracts import RoutingDecision
from app.reader_current_page import prefer_current_navigation
from app.reader_requirements import requirements_for
from app.reader_routing import bind_route, task_fingerprint, validate_decision, verify_route
from test_reader_current_page import setup as detail_setup
from test_platform_portal_reader import gateway


def setup():
    bundle = detail_setup()
    task, old, candidate, hint, *_ = bundle
    task.requestedAttributes = ['status', 'handler']
    record = copy.deepcopy(next(iter(old.items.values()))['record'])
    previous = {'id': 'lookup_entry', 'name': 'entry', 'from': 'previous_record',
        'operationRef': 'POST /api/crystals/list', 'sourcePath': '/data/items',
        'identityField': 'code', 'keyFields': ['key'], 'field': 'entry',
        'required': True, 'unique': False, 'lookupPageRefs': ['/work/crystals']}
    record['payload']['routing']['parameters'].append(previous)
    lookup_record = copy.deepcopy(record)
    lookup_record['id'] = 'crystals.list'
    lookup_record['applicability']['pageRefs'] = ['/work/crystals']
    lookup_record['payload']['routing'] = {'records': [{
        'id': 'crystals', **{k: previous[k] for k in
            ('operationRef', 'sourcePath', 'identityField', 'keyFields', 'unique')}}]}
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'content': json.dumps({'packageStatus': 'active',
        'records': [record, lookup_record]}), 'source_name': 'crystals.json'}]})
    knowledge.prompt()
    candidates = [candidate, {'candidateId': 'lookup', 'route': '/work/crystals', 'parameters': []}]
    def item(c):
        source = next(pid for pid, (key, _) in knowledge.passages.items()
            if c['route'] in knowledge.items[key]['record']['applicability']['pageRefs'])
        ref = {'sourceId': source}
        return {'candidateId': c['candidateId'], 'evidence': [ref], 'reason': 'Same crystal entity',
            'conditions': [{'requirementId': r['id'],
                'status': 'unknown' if r['id'] == 'record' else 'supported',
                'evidence': [ref], 'reason': 'Declared definition; record requires a fresh read'}
                for r in requirements_for(task)]}
    decision = RoutingDecision(stage='routing_decision', decision='probe',
        taskFingerprint=task_fingerprint(task), candidates=[item(c) for c in candidates],
        routePlan=[{'candidateId': 'lookup', 'purpose': 'locate_record',
                    'requirementIds': ['record', 'object', 'grain']},
                   {'candidateId': 'crystal', 'purpose': 'read_final',
                    'requirementIds': [r['id'] for r in requirements_for(task)],
                    'parameterBindingIds': ['crystals.detail#lookup_entry']}],
        reason='Locate the supplied identity, then read its detail.')
    validate_decision(decision, task, candidates, knowledge, current_page=hint)
    return decision, task, candidates, knowledge, hint, bundle


def choose(b):
    return prefer_current_navigation(*b[:5])


def test_only_navigation_changes_record_stays_unknown_and_task_is_immutable():
    b = setup()
    before = b[0].model_dump()
    task_before = b[1].model_dump()
    result, receipt = choose(b)
    assert result.decision == 'probe' and len(result.routePlan) == 1
    assert result.routePlan[0].candidateId == before['routePlan'][-1]['candidateId']
    assert result.routePlan[0].parameterBindingIds == ['crystals.detail#current_crystal']
    assert result.candidates == b[0].candidates and b[0].model_dump() == before
    assert b[1].model_dump() == task_before
    assert receipt['recordConditionUnchanged'] == 'unknown'
    assert receipt['requiresFreshRecordVerification'] is True


@pytest.mark.parametrize('change', ['wrong_page', 'not_authorized', 'history', 'stale', 'future',
    'multiple_selection', 'missing_query', 'extra_query', 'array_query', 'missing_time'])
def test_invalid_or_ambiguous_browser_hint_retains_original_plan(change):
    b = setup()
    h = b[4]
    if change == 'wrong_page': h['route'] = '/other/detail'
    if change == 'not_authorized': h['routeAuthorized'] = False
    if change == 'history': h['source'] = 'history'
    if change == 'stale': h['capturedAt'] = (datetime.now(timezone.utc)-timedelta(minutes=16)).isoformat()
    if change == 'future': h['capturedAt'] = (datetime.now(timezone.utc)+timedelta(minutes=2)).isoformat()
    if change == 'multiple_selection': h['selectedRecordKeys'] = ['a', 'b']
    if change == 'missing_query': h['query'] = {}
    if change == 'extra_query': h['query']['department'] = 'another'
    if change == 'array_query': h['query']['entry'] = ['a', 'b']
    if change == 'missing_time': h.pop('capturedAt')
    assert choose(b) == (b[0], None)


@pytest.mark.parametrize('requirement', ['object', 'grain', 'attribute_0', 'attribute_1', 'detail'])
@pytest.mark.parametrize('status', ['unknown', 'conflict'])
def test_every_non_record_condition_must_already_be_supported(requirement, status):
    b = setup()
    final = next(c for c in b[0].candidates if c.candidateId == 'crystal')
    next(c for c in final.conditions if c.requirementId == requirement).status = status
    assert choose(b) == (b[0], None)


@pytest.mark.parametrize('change', ['missing_identity', 'multiple_identities', 'collection', 'filter',
                                  'view', 'group', 'measure', 'time'])
def test_non_scalar_or_additional_task_constraints_are_not_dropped(change):
    b = setup()
    t = b[1]
    if change == 'missing_identity': t.recordIdentity = ''
    if change == 'multiple_identities': t.recordIdentity = '["CR-123", "CR-456"]'
    if change == 'collection': t.outputShape = 'list'
    if change == 'filter': t.filters = ['owner=someone']
    if change == 'view': t.view = 'completed'
    if change == 'group': t.groupBy = ['status']
    if change == 'measure': t.requestedMeasures = ['count']
    if change == 'time': t.timeRange = 'last month'
    b[0].taskFingerprint = task_fingerprint(t)
    assert choose(b) == (b[0], None)


@pytest.mark.parametrize('change', ['multiple_current', 'different_identity_field', 'different_key',
                                  'different_entry_field', 'different_parameter', 'missing_record_contract'])
def test_ambiguous_or_relationship_contract_cannot_be_replaced(change):
    b = setup()
    record = next(i['record'] for i in b[3].items.values() if i['recordId'] == 'crystals.detail')
    routing = record['payload']['routing']
    previous = routing['parameters'][1]
    if change == 'multiple_current':
        extra = copy.deepcopy(routing['parameters'][0]);extra['id'] = 'second_current'
        routing['parameters'].append(extra)
    if change == 'different_identity_field': previous['identityField'] = 'parentCode'
    if change == 'different_key': previous['keyFields'] = ['parentKey']
    if change == 'different_entry_field': previous['field'] = 'relatedEntry'
    if change == 'different_parameter': previous['name'] = 'relatedEntry'
    if change == 'missing_record_contract': routing['records'] = []
    assert choose(b) == (b[0], None)


def test_lookup_that_serves_an_output_or_has_unknown_entity_is_preserved():
    b = setup();b[0].routePlan[0].requirementIds.append('attribute_0')
    assert choose(b) == (b[0], None)
    b = setup()
    lookup = next(c for c in b[0].candidates if c.candidateId == 'lookup')
    next(c for c in lookup.conditions if c.requirementId == 'grain').status = 'unknown'
    assert choose(b) == (b[0], None)


def test_multihop_relationship_and_single_page_selection_are_unchanged():
    b = setup();b[0].routePlan.insert(0, b[0].routePlan[0].model_copy())
    assert choose(b) == (b[0], None)
    b = setup();b[0].routePlan = b[0].routePlan[-1:]
    assert choose(b) == (b[0], None)


def test_selected_current_navigation_without_actual_read_does_not_verify_record():
    b = setup();decision, _ = choose(b);proof = {}
    route = bind_route(decision.routePlan[0], b[2][0], b[1], b[3], proof_out=proof,
        current_page=b[4], principal_scope_ref='principal', turn_ref='turn')
    result = verify_route(b[1], route, b[2][0]['route'], {'pageIdentity': {'path': b[2][0]['route']}},
        {}, b[3], bound_record=proof, principal_scope_ref='principal', turn_ref='turn')
    assert not result.passed


def test_fresh_response_for_different_number_is_not_accepted_after_selection():
    b = setup();decision, _ = choose(b);proof = {}
    route = bind_route(decision.routePlan[0], b[2][0], b[1], b[3], proof_out=proof,
        current_page=b[4], principal_scope_ref='principal', turn_ref='turn')
    sources = b[5][-1]
    source = next(iter(sources.values()))
    source['taskFingerprint'] = task_fingerprint(b[1])
    source['capturedAt'] = datetime.now(timezone.utc).isoformat()
    source['data']['data']['detail']['code'] = 'CR-DIFFERENT'
    source['fieldEvidence'] = gateway._reader_field_evidence(source['data'], source['data'])
    result = verify_route(b[1], route, b[2][0]['route'], b[5][-2], sources, b[3],
        bound_record=proof, principal_scope_ref='principal', turn_ref='turn')
    assert not result.passed and 'verifiedRecord' not in source
