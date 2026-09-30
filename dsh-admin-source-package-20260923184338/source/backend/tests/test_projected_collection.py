"""Generic gateway collection, authorization and completeness regressions."""
import asyncio
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

os.environ['UMC_PORTAL'] = 'admin'
MODULE_PATH = Path(__file__).parents[2] / 'platform-gateway' / 'app.py'
SPEC = importlib.util.spec_from_file_location('collection_gateway', MODULE_PATH)
gateway = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = gateway
SPEC.loader.exec_module(gateway)


def setup_rows(count=625):
    rows = [{'specimenKey': str(i), 'phase': ['Warm', 'Cold', 'Novel'][i % 3],
             'email': 'private@example.test'} for i in range(count)]
    capture = gateway._collection_request(SimpleNamespace(method='POST', url='https://portal.test/api/specimens/list',
        post_data=json.dumps({'pageIndex': 1, 'pageSize': 25, 'sortBy': 'specimenKey', 'zone': 'East'})))
    spec = gateway.ProjectedCollectionRequest(operationKey='POST /api/specimens/list', contextRef=capture['contextRef'],
        rowsPath='/data/items', totalPath='/data/total', fields=['specimenKey', 'phase'], identityFields=['specimenKey'],
        pageField='pageIndex', sizeField='pageSize')
    return rows, capture, spec


def collect(rows, capture, spec, transform=None):
    calls = []
    async def fetch(params):
        calls.append(dict(params))
        offset = (params['pageIndex'] - 1) * params['pageSize']
        payload = {'data': {'items': rows[offset:offset + params['pageSize']], 'total': len(rows)}}
        if transform:
            payload = transform(payload, params, len(calls))
        return json.dumps(payload).encode()
    result = asyncio.run(gateway._collect_projected_rows(spec, capture, fetch))
    return result, calls


def test_full_collection_projection_and_two_passes_keep_query_frozen():
    rows, captured, spec = setup_rows()
    result, calls = collect(rows, captured, spec)
    assert result['completeness'] == 'complete'
    assert result['rowCount'] == 625 and result['pagesRead'] == 4 and result['stablePasses'] == 2
    assert all(set(row) == {'specimenKey', 'phase'} for row in result['rows'])
    assert all({k: v for k, v in p.items() if k not in {'pageIndex', 'pageSize'}} ==
               {k: v for k, v in captured['parameters'].items() if k not in {'pageIndex', 'pageSize'}} for p in calls)
    assert all(p['pageSize'] == 500 for p in calls)
    assert result['pagination']['observedPageSize'] == 25
    assert result['snapshotIsolation'] is False


def test_empty_collection_is_complete_zero():
    rows, captured, spec = setup_rows(0)
    result, calls = collect(rows, captured, spec)
    assert result['completeness'] == 'complete' and result['total'] == 0 and len(calls) == 2


def test_repeated_page_is_not_full_collection():
    rows, captured, spec = setup_rows()
    result, _ = collect(rows, captured, spec, lambda payload, params, n:
                        {'data': {'items': rows[:params['pageSize']], 'total': len(rows)}})
    assert result['reason'] == 'collection_repeated_page' and 'rows' not in result


def test_total_drift_rejected():
    rows, captured, spec = setup_rows()
    def drift(payload, params, n):
        if n == 2:
            payload['data']['total'] += 1
        return payload
    result, _ = collect(rows, captured, spec, drift)
    assert result['reason'] == 'collection_total_changed'


def test_same_total_changed_state_between_passes_rejected():
    rows, captured, spec = setup_rows(25)
    def change(payload, params, n):
        if n == 2:
            payload['data']['items'] = copy.deepcopy(payload['data']['items'])
            payload['data']['items'][0]['phase'] = 'Changed'
        return payload
    result, _ = collect(rows, captured, spec, change)
    assert result['reason'] == 'collection_changed_between_passes'


def test_short_nonterminal_page_is_not_complete():
    rows, captured, spec = setup_rows()
    def short(payload, params, n):
        payload['data']['items'] = payload['data']['items'][:10]
        return payload
    result, _ = collect(rows, captured, spec, short)
    assert result['reason'] == 'collection_page_incomplete'


def test_server_clamped_page_size_never_claims_complete_population():
    rows, captured, spec = setup_rows()
    def clamp(payload, params, n):
        offset = (params['pageIndex'] - 1) * 25
        payload['data']['items'] = rows[offset:offset + 25]
        return payload
    result, calls = collect(rows, captured, spec, clamp)
    assert result['reason'] == 'collection_page_incomplete' and 'rows' not in result
    assert len(calls) == 2


def test_missing_identity_does_not_become_one_null_entity():
    rows, captured, spec = setup_rows(1)
    rows[0]['specimenKey'] = None
    result, _ = collect(rows, captured, spec)
    assert result['reason'] == 'collection_identity_missing'


@pytest.mark.parametrize('field', ['email', 'password', 'phone'])
def test_sensitive_projection_rejected(field):
    rows, captured, spec = setup_rows()
    spec.fields.append(field)
    result, calls = collect(rows, captured, spec)
    assert result['reason'] == 'collection_field_restricted' and not calls


def test_context_change_prevents_replay():
    rows, captured, spec = setup_rows()
    spec.contextRef = '0' * 64
    result, calls = collect(rows, captured, spec)
    assert result['reason'] == 'collection_context_changed' and not calls


def test_arbitrary_body_field_cannot_be_used_as_pagination():
    rows, captured, spec = setup_rows()
    spec.pageField = 'zone'
    result, calls = collect(rows, captured, spec)
    assert result['reason'] == 'collection_pagination_unsupported' and not calls


def test_budget_exhaustion_has_no_rows_or_complete_claim():
    rows, captured, spec = setup_rows(5001)
    result, _ = collect(rows, captured, spec)
    assert result['reason'] == 'collection_budget_exceeded' and 'rows' not in result


def test_bypassed_policy_cannot_authorize_collection():
    _, captured, spec = setup_rows()
    health = {'collectionRequests': {spec.operationKey: captured}, 'apiDiscovery': {
        'candidates': {spec.operationKey: {'policyState': 'bypassed', 'status': 200}}}}
    result = asyncio.run(gateway._reader_collect(SimpleNamespace(_reader_health=health), [spec], 'https://portal.test'))
    assert result[0]['reason'] == 'collection_source_not_authorized'


def test_redirects_disabled_and_only_captured_origin_and_parameters_are_used(monkeypatch):
    rows, captured, spec = setup_rows(1)
    seen = []
    class Response:
        status = 200
        async def body(self):
            return json.dumps({'data': {'items': rows, 'total': 1}}).encode()
        async def dispose(self):
            pass
    class Client:
        async def fetch(self, url, **kwargs):
            seen.append((url, kwargs))
            return Response()
    health = {'collectionRequests': {spec.operationKey: captured}, 'apiDiscovery': {
        'candidates': {spec.operationKey: {'policyState': 'allowed', 'status': 200}}}}
    monkeypatch.setattr(gateway, 'READER_READ_ONLY_POST_PATHS', {'/api/specimens/list'})
    page = SimpleNamespace(_reader_health=health, context=SimpleNamespace(request=Client()))
    result = asyncio.run(gateway._reader_collect(page, [spec], 'https://portal.test'))
    assert result[0]['completeness'] == 'complete'
    assert all(url == captured['url'] and kwargs['max_redirects'] == 0 for url, kwargs in seen)
    assert all(kwargs['data']['zone'] == 'East' for _, kwargs in seen)
    assert 'parameters' not in result[0] and 'url' not in result[0]
    seen.clear()
    result = asyncio.run(gateway._reader_collect(page, [spec], 'https://different.test'))
    assert result[0]['reason'] == 'collection_source_not_authorized' and not seen
