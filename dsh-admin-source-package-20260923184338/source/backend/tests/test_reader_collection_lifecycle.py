"""Collection read waits on its own authorized native capture, never old data.

The X03 fixture retains real plan/operation/context receipts. Its response rows
and the completion timing below are synthetic; the old failing branch is unknown.
"""
import asyncio
import copy
import json
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app import generic_reader as reader_module
from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, source_inventory
from app.generic_reader_contracts import CollectionPlan, TaskSpec
from app.portal_reader import PortalReadRequest, bounded_portal_read_result
from app.reader_collection import checked_collections
from app.reader_context import page_knowledge
from test_projected_collection import gateway, setup_rows
from test_reader_expected_request_lifecycle import record, setup

FIXTURE = json.loads((Path(__file__).parent / 'fixtures/collection_lifecycle_x03_en_ar.json').read_text())
CASES = FIXTURE['cases']
PAGE = '/happiness/tickets'
OP = 'GET /api/Enquiry/Management/TeamTask/List'


def observed_fixture(case):
    plan = CollectionPlan.model_validate(case['plan'])
    receipt = case['failedCollections'][0]
    # Explicitly synthetic row, not the real ticket's current status.
    body = {'data': {'items': [{'id': 17, 'enquiryNumber': 'SYNTHETIC-17', 'enquiryStatusId': 1,
        'enquiryStatusObj': {'nameAr': 'synthetic', 'nameEn': 'synthetic'}}], 'total': 1}}
    native = next(copy.deepcopy(c) for c in case['lookupObservation']['observedOperations'] if c['operationKey'] == OP)
    native.update(trigger='initial', responseEvidence=body, collectionContext={
        'contextRef': receipt['contextRef'], 'requestFields': ['PageIndex', 'PageSize'],
        'rowSchemas': gateway._collection_row_schemas(body)})
    observation = {'apiDiscovery': {'candidates': [native]}}
    selected = source_inventory(observation, PAGE, 'offline', 'offline-principal')
    assert plan.collections[0].sourceId in selected  # Original ID is preserved.
    return plan, selected, observation


@pytest.mark.parametrize('case', CASES, ids=['en', 'ar'])
def test_real_x03_plan_reaches_next_gateway_with_expected_operation_and_same_context(case):
    plan, selected, observation = observed_fixture(case)
    kb = KnowledgeStore()
    kb.add_local(page_knowledge(Path(__file__).parents[2] / 'artifacts', [{'routes': [PAGE]}]))
    kb.add({'chunks': [FIXTURE['remoteKnowledge']['chunk']]})
    calls = []
    class ReachedGateway(Exception): pass
    class Gateway:
        async def invoke(self, principal, name, payload, **kwargs):
            calls.append((principal, name, copy.deepcopy(payload), kwargs))
            raise ReachedGateway()
    reader = GenericKnowledgeReader(Gateway(), None, portal_base_url='https://offline.test')
    reader.page = PAGE; reader.knowledge = kb; reader.deadline = time.monotonic() + 60
    structured_calls = []
    async def structured(contract, instruction, data, validator):
        structured_calls.append(contract)
        validator(plan)  # Actual unchanged collection validator and formal M12.
        return plan
    reader.structured = structured
    principal = SimpleNamespace(user_id='offline-principal')
    task = TaskSpec.model_validate(case['task'])
    original_task = task.model_dump()
    with pytest.raises(ReachedGateway):
        asyncio.run(reader.collect_sources(principal, task, PortalReadRequest(PAGE, ({'type': 'observe'},)),
            observation, selected, lookup_fields={OP: case['plan']['collections'][0]['fields']}))
    assert len(calls) == len(structured_calls) == 1
    actual_principal, name, payload, kwargs = calls[0]
    assert actual_principal is principal and name == 'admin.portal.read'
    assert payload['expectedOperations'] == [OP]
    assert payload['collections'][0]['operationKey'] == OP
    assert payload['collections'][0]['contextRef'] == case['failedCollections'][0]['contextRef']
    assert payload['collections'][0]['fields'] == case['plan']['collections'][0]['fields']
    assert len(payload['collections']) == 1 and payload['startPath'] == PAGE
    assert kwargs['allowed_tools'] == reader.allowed_tools
    assert task.model_dump() == original_task and not reader.recovery
    gateway.AdminPortalReadRequest.model_validate(payload)


@pytest.mark.parametrize('fault', ['no_observation', 'no_selected', 'wrong_id', 'changed_context',
    'different_operation', 'unselected_operation', 'denied', 'bypassed', 'missing_status',
    'http403', 'http404', 'unhealthy', 'missing_body', 'not_api', 'query', 'external', 'traversal'])
def test_only_selected_current_authorized_native_source_can_supply_wait_hint(fault):
    plan, selected, obs = observed_fixture(CASES[0]); sid = plan.collections[0].sourceId
    candidate = obs['apiDiscovery']['candidates'][0]
    if fault == 'no_observation': obs = {}
    elif fault == 'no_selected': selected = {}
    elif fault == 'wrong_id': plan.collections[0].sourceId = 'unknown'
    elif fault == 'changed_context': selected[sid]['collectionContext']['contextRef'] = 'a' * 64; candidate['collectionContext'] = {'contextRef': 'b' * 64}
    elif fault == 'different_operation': selected[sid]['operationRef'] = 'GET /api/other'
    elif fault == 'unselected_operation': obs['apiDiscovery']['candidates'] = [{**candidate, 'operationKey': 'GET /api/other'}]
    elif fault in {'denied', 'bypassed'}: candidate['policyState'] = fault
    elif fault == 'missing_status': candidate['status'] = None
    elif fault.startswith('http'): candidate['status'] = int(fault[4:])
    elif fault == 'unhealthy': candidate['responseHealth'] = 'unhealthy'
    elif fault == 'missing_body': candidate.pop('responseEvidence')
    elif fault == 'not_api': selected[sid]['kind'] = 'page_section'
    else:
        op = {'query': OP + '?token=PRIVATE', 'external': 'GET https://private.test/api/x', 'traversal': 'GET /api/../x'}[fault]
        candidate['operationKey'] = op
        selected = source_inventory(obs, PAGE, 'offline', 'principal')
        plan.collections[0].sourceId = next(iter(selected))
    assert reader_module.collection_expected_operations(plan, selected, obs) == []


def test_two_specs_bound_hint_limit_without_importing_task_or_old_capture():
    plan, selected, obs = observed_fixture(CASES[0])
    second = copy.deepcopy(obs['apiDiscovery']['candidates'][0]); second['operationKey'] = 'GET /api/other'
    second['collectionContext']['contextRef'] = 'b' * 64
    obs['apiDiscovery']['candidates'].append(second)
    selected = source_inventory(obs, PAGE, 'offline', 'principal')
    sid = next(k for k, v in selected.items() if v['operationRef'] != OP)
    plan.collections.append(plan.collections[0].model_copy(update={'sourceId': sid}))
    assert reader_module.collection_expected_operations(plan, selected, obs) == [OP, 'GET /api/other']
    plan.collections.append(plan.collections[0])  # Defensive check even if constructed outside validated model.
    assert reader_module.collection_expected_operations(plan, selected, obs) == []


@pytest.mark.parametrize('fault,expected', [('missing', 'capture_missing'), ('changed', 'context_mismatch'),
    ('ambiguous', 'ambiguous_source'), ('denied', 'policy_denied'), ('bypassed', 'policy_denied'),
    ('http403', 'response_not_successful'), ('http404', 'response_not_successful'),
    ('pending', 'response_not_successful')])
def test_failed_collection_diagnostics_preserve_gate_and_never_expose_capture(fault, expected):
    _, capture, spec = setup_rows(1)
    candidate = {'operationKey': spec.operationKey, 'policyState': 'allowed', 'status': 200,
        'collectionContext': {'contextRef': spec.contextRef}}
    capture.update(url='https://PRIVATE.test/api/x?token=PRIVATE', internalNotes='PRIVATE', headers={'secret': 'PRIVATE'})
    health = {'collectionRequests': {spec.operationKey: capture}, 'apiDiscovery': {'candidates': {spec.operationKey: candidate}}}
    if fault == 'missing': health['collectionRequests'] = {}
    elif fault == 'changed': capture['contextRef'] = 'b' * 64
    elif fault == 'ambiguous': health['apiDiscovery']['candidates']['second'] = copy.deepcopy(candidate)
    elif fault in {'denied', 'bypassed'}: candidate['policyState'] = fault
    elif fault == 'pending': candidate['status'] = None
    else: candidate['status'] = int(fault[4:])
    fetch = AsyncMock(side_effect=AssertionError('No failed gate may fetch'))
    page = SimpleNamespace(_reader_health=health, context=SimpleNamespace(request=SimpleNamespace(fetch=fetch)))
    raw = asyncio.run(gateway._reader_collect(page, [spec], 'https://portal.test'))
    result = checked_collections(raw)[0]
    assert result['reason'] == 'collection_source_not_authorized' and result['completeness'] == 'incomplete'
    assert result['sourceDiagnostic']['sourceState'] == expected
    assert result['sourceDiagnostic']['responseState'] == {
        'http403': 'access_denied', 'http404': 'not_found', 'pending': 'not_observed'}.get(fault, 'success')
    assert 'PRIVATE' not in json.dumps(result) and 'rows' not in result
    bounded = bounded_portal_read_result({'observation': {'collections': raw}})
    assert bounded['observation']['collections'][0]['sourceDiagnostic'] == result['sourceDiagnostic']
    fetch.assert_not_awaited()


@pytest.mark.parametrize('bad', [[], {}, 'PRIVATE', 2, None])
def test_diagnostic_input_is_allowlisted_and_not_a_new_data_channel(bad):
    receipt = {'operationRef': OP, 'contextRef': 'a' * 64, 'completeness': 'incomplete',
        'reason': 'collection_source_not_authorized', 'sourceDiagnostic': {
            'sourceState': bad, 'responseState': bad, 'matchingSourceCount': bad, 'candidateObserved': bad,
            'capturePresent': bad, 'captureContextMatches': bad, 'policyAllowed': bad,
            'responseSuccessful': bad, 'body': 'PRIVATE', 'url': 'PRIVATE'}}
    result = checked_collections([receipt])[0]
    assert 'PRIVATE' not in json.dumps(result)
    assert set(result.get('sourceDiagnostic', {})) <= {'matchingSourceCount'}


@pytest.mark.parametrize('status', [200, 403, 404])
def test_native_pending_then_capture_precedes_collection_and_http_error_never_authorizes(monkeypatch, status):
    async def run():
        life, health = setup()
        request = record(health, suffix='?PageIndex=1&PageSize=25')
        captured = gateway._collection_request(request)
        spec = gateway.ProjectedCollectionRequest(operationKey=OP, contextRef=captured['contextRef'],
            rowsPath='/data/items', totalPath='/data/total', pageField='PageIndex', sizeField='PageSize',
            fields=['id'], identityFields=['id'])
        page = SimpleNamespace(_reader_health=health)
        collected = []
        async def rows(*args):
            assert life.snapshot()['requests'][0]['state'] == 'complete'
            collected.append(args)
            return {'completeness': 'offline_transport_reached'}
        monkeypatch.setattr(gateway, '_collect_projected_rows', rows)
        async def execute():
            await gateway._reader_wait_for_api_response_evidence(page)
            return await gateway._reader_collect(page, [spec], 'https://fixture.test')
        pending = asyncio.create_task(execute())
        await asyncio.sleep(0)
        assert not pending.done() and not collected
        gateway._reader_api_discovery_response_seen(health, request, status)
        gate = asyncio.Event()
        async def capture():
            await gate.wait()
            health['collectionRequests'] = {OP: captured}
            gateway._reader_api_discovery_state(health)['candidates'][OP]['collectionContext'] = {'contextRef': captured['contextRef']}
            return True
        if status == 200:
            task = asyncio.create_task(capture()); life.capture(request, task)
            await asyncio.sleep(0)
            assert not pending.done() and not collected
            gate.set()
        result = await asyncio.wait_for(pending, 0.2)
        assert len(life.entries) == 1
        assert bool(collected) == (status == 200)
        if status != 200:
            assert result[0]['reason'] == 'collection_source_not_authorized'
            assert life.snapshot()['requests'][0]['status'] == status
            assert life.snapshot()['requests'][0]['state'] == 'http_error'
            assert result[0]['sourceDiagnostic']['responseState'] == ('access_denied' if status == 403 else 'not_found')
        assert health['apiDiscovery']['candidates'][OP]['status'] == status
    asyncio.run(run())


@pytest.mark.parametrize('status', [403, 404])
def test_real_collection_fetch_failure_retains_status_and_original_single_attempt(monkeypatch, status):
    _, capture, spec = setup_rows(1)
    response = SimpleNamespace(status=status, body=AsyncMock(side_effect=AssertionError('No rejected body read')),
        dispose=AsyncMock())
    fetch = AsyncMock(return_value=response)
    candidate = {'operationKey': spec.operationKey, 'policyState': 'allowed', 'status': 200,
        'collectionContext': {'contextRef': spec.contextRef}}
    page = SimpleNamespace(_reader_health={'collectionRequests': {spec.operationKey: capture},
        'apiDiscovery': {'candidates': {spec.operationKey: candidate}}},
        context=SimpleNamespace(request=SimpleNamespace(fetch=fetch)))
    monkeypatch.setattr(gateway, 'READER_READ_ONLY_POST_PATHS', {'/api/specimens/list'})
    result = checked_collections(asyncio.run(gateway._reader_collect(page, [spec], 'https://portal.test')))[0]
    assert result['completeness'] == 'incomplete' and result['reason'] == 'collection_response_failed'
    assert result['dependency'] == {'upstreamStatus': status, 'attempts': 1}
    fetch.assert_awaited_once(); response.dispose.assert_awaited_once(); response.body.assert_not_awaited()


def test_unissued_unknown_hint_neither_waits_nor_authorizes_collection(monkeypatch):
    async def run():
        life, health = setup(('GET /api/unknown',))
        request = record(health)  # Other native request remains pending, not the hinted one.
        capture = gateway._collection_request(request)
        _, _, template = setup_rows(1)
        spec = template.model_copy(update={'operationKey': 'GET /api/unknown', 'contextRef': capture['contextRef']})
        page = SimpleNamespace(_reader_health=health)
        await asyncio.wait_for(gateway._reader_wait_for_api_response_evidence(page), 0.1)
        result = await gateway._reader_collect(page, [spec], 'https://fixture.test')
        assert len(life.entries) == 0
        assert life.snapshot()['requests'][0]['state'] == 'not_issued'
        assert result[0]['reason'] == 'collection_source_not_authorized'
        assert result[0]['sourceDiagnostic']['sourceState'] == 'capture_missing'
        assert 'collectionRequests' not in health
    asyncio.run(run())
