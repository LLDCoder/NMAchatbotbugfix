import asyncio
import json
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from app.generic_reader import portal_result_failure, render_generic_answer
from test_projected_collection import gateway


def request(**changes):
    return gateway.AdminPortalReadRequest(startPath='/content/ContentApplications',
        actions=[{'type': 'observe'}], nativeRecordLookup='MC-2-2202-8614403', **changes)


@pytest.mark.parametrize('status', [401, 403, 500])
def test_native_status_is_taken_from_actual_endpoint_not_menu_metadata(monkeypatch, status):
    upstream = AsyncMock(side_effect=HTTPException(status_code=status, detail={
        'upstreamStatus': status, 'permissionResponse': {'isSuccess': False, 'statusCode': status}}))
    monkeypatch.setattr(gateway, '_umc_request', upstream)
    result = asyncio.run(gateway._native_record_lookup_outcome(request(), 'Bearer current-user', 'request'))
    upstream.assert_awaited_once_with('POST', '/api/Content/MyTodoPage',
        json={'pageIndex': 1, 'pageSize': 1, 'keyword': 'MC-2-2202-8614403'},
        authorization='Bearer current-user', request_id='request')
    assert result['diagnostics']['upstreamStatus'] == status
    error = portal_result_failure(result)
    for language in ['en', 'ar']:
        answer = render_generic_answer({'failureCategory': error.category, 'missing': [error.code]}, language)
        assert answer and 'current-user' not in answer and '/api/' not in answer
    assert error.category == ('permission' if status in {401, 403} else 'runtime')


@pytest.mark.parametrize('payload', [
    {'isSuccess': True, 'data': {'privateRecords': [{'id': 'not-public'}]}},
    {'isSuccess': False, 'statusCode': 404, 'message': 'No record'},
])
def test_accepted_or_other_business_response_is_not_falsely_reported_as_permission_denied(monkeypatch, payload):
    monkeypatch.setattr(gateway, '_umc_request', AsyncMock(return_value=payload))
    result = asyncio.run(gateway._native_record_lookup_outcome(request(), 'Bearer current-user', 'request'))
    assert result['status'] == 'not_confirmed' and portal_result_failure(result) is None
    assert 'not-public' not in json.dumps(result)


def test_native_permission_envelope_with_http_200_is_not_empty_data(monkeypatch):
    monkeypatch.setattr(gateway, '_umc_request', AsyncMock(return_value={
        'isSuccess': False, 'statusCode': 403, 'message': 'You do not have permission to perform this action.', 'data': None}))
    result = asyncio.run(gateway._native_record_lookup_outcome(request(), 'Bearer current-user', 'request'))
    assert portal_result_failure(result).code == 'upstream_access_denied'


def test_unknown_page_cannot_select_an_arbitrary_api_or_claim_denial(monkeypatch):
    upstream = AsyncMock()
    monkeypatch.setattr(gateway, '_umc_request', upstream)
    candidate = request().model_copy(update={'start_path': '/unknown'})
    result = asyncio.run(gateway._native_record_lookup_outcome(candidate, 'Bearer current-user', 'request'))
    assert result['limitations'] == ['native_lookup_binding_unavailable']
    upstream.assert_not_awaited()


def test_readonly_check_remains_enabled_even_when_browser_network_policy_is_disabled(monkeypatch):
    monkeypatch.setattr(gateway, 'READER_WHITELIST_ENABLED', False)
    monkeypatch.setattr(gateway, 'READER_READ_ONLY_POST_PATHS', frozenset())
    upstream = AsyncMock()
    monkeypatch.setattr(gateway, '_umc_request', upstream)
    with pytest.raises(HTTPException) as failure:
        asyncio.run(gateway._native_record_lookup_outcome(request(), 'Bearer current-user', 'request'))
    assert failure.value.status_code == 422
    upstream.assert_not_awaited()


def test_native_lookup_does_not_relax_identity_checks_or_normal_browser_page_permissions():
    user = {'data': {'id': 'owner', 'rolesInfo': [{'roleName': 'Manager'}],
        'listSysPermission': [{'frontendRoute': '/licensing/applications'}]}}
    with pytest.raises(HTTPException):
        gateway._validate_gateway_permissions(user, '/content/ContentApplications', 'someone-else', require_page_access=False)
    with pytest.raises(HTTPException):
        gateway._validate_gateway_permissions(user, '/content/ContentApplications', 'owner')
    assert gateway._validate_gateway_permissions(user, '/content/ContentApplications', 'owner',
        require_page_access=False)['userId'] == 'owner'


def test_native_lookup_rejects_combined_browser_actions(monkeypatch):
    upstream = AsyncMock()
    monkeypatch.setattr(gateway, '_umc_request', upstream)
    candidate = request().model_copy(update={'actions': [gateway.PortalReadAction(type='query', label='hidden')]})
    with pytest.raises(HTTPException):
        asyncio.run(gateway._native_record_lookup_outcome(candidate, 'Bearer current-user', 'request'))
    upstream.assert_not_awaited()
