import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api import make_router
from app.conversation_auth import authenticate_conversation_principal
from app.db import get_db
from app.principal import Principal


def principal(**values):
    return Principal(**{'user_id':'owner','tenant_id':'umc:global:owner','request_id':'regression','umc_token':'test-only-token',**values})


def platform(payload=None, error=None):
    return SimpleNamespace(get_user_info=AsyncMock(return_value=payload or {'data':{'id':'owner'}},side_effect=error))


def test_conversation_uses_verified_identity_and_preserves_request_token_in_memory():
    p=principal();client=platform();actual=asyncio.run(authenticate_conversation_principal(p,client))
    assert actual==p
    client.get_user_info.assert_awaited_once_with(umc_token=p.umc_token,request_id=p.request_id)


@pytest.mark.parametrize('workspace',['umc:establishment:4','umc:profile:profile-1','umc:profile:profile-2','umc:profile:profile-3'])
def test_live_profile_and_establishment_memberships_are_accepted(workspace):
    client=platform({'data':{'id':'owner','userEstablishments':[{'id':4,'userProfileId':'profile-1'}],'userInvitation':{'userProfileId':'profile-2'},'userProfileInfo':[{'id':'profile-3'}]}})
    assert asyncio.run(authenticate_conversation_principal(principal(tenant_id=workspace),client)).tenant_id==workspace


@pytest.mark.parametrize('values,status',[({'umc_token':None},401),({'user_id':'someone-else'},403),({'tenant_id':'umc:global:someone-else'},403),({'tenant_id':'umc:profile:unassigned'},403)])
def test_missing_token_forged_owner_or_unassigned_workspace_is_denied(values,status):
    client=platform()
    with pytest.raises(HTTPException) as exc:asyncio.run(authenticate_conversation_principal(principal(**values),client))
    assert exc.value.status_code==status
    if not values.get('umc_token','present'):client.get_user_info.assert_not_awaited()


@pytest.mark.parametrize('status,expected',[(401,401),(403,403),(404,503),(429,503),(500,503)])
def test_upstream_failure_is_not_reported_as_no_data(status,expected):
    request=httpx.Request('POST','https://identity.test/user');response=httpx.Response(status,request=request)
    with pytest.raises(HTTPException) as exc:asyncio.run(authenticate_conversation_principal(principal(),platform(error=httpx.HTTPStatusError('private diagnostics',request=request,response=response))))
    assert exc.value.status_code==expected and 'private' not in exc.value.detail


@pytest.mark.parametrize('payload',[{'data':{}},{'data':{'id':False}},{'data':{'id':''}},{'data':None}])
def test_malformed_identity_fails_closed_as_dependency_error(payload):
    with pytest.raises(HTTPException) as exc:asyncio.run(authenticate_conversation_principal(principal(),platform(payload)))
    assert exc.value.status_code==503


def test_identity_timeout_is_recoverable_without_accessing_history():
    with pytest.raises(HTTPException) as exc:asyncio.run(authenticate_conversation_principal(principal(),platform(error=TimeoutError('private timeout'))))
    assert exc.value.status_code==503


def test_real_rest_history_route_checks_identity_before_owner_scoped_lookup():
    service=SimpleNamespace(tool_gateway=SimpleNamespace(platform=platform()),get_owned_conversation=AsyncMock(side_effect=LookupError('not found')))
    app=FastAPI();app.include_router(make_router(service))
    async def db():yield None
    app.dependency_overrides[get_db]=db
    with TestClient(app) as client:
        url='/api/v1/conversations/test/history'
        claims={'X-User-Id':'owner','X-Tenant-Id':'umc:global:owner'}
        assert client.get(url,headers=claims).status_code==401
        assert client.get(url,headers={**claims,'Authorization':'Bearer test-token','X-User-Id':'other'}).status_code==403
        service.get_owned_conversation.assert_not_awaited()
        assert client.get(url,headers={**claims,'Authorization':'Bearer test-token'}).status_code==404
        service.get_owned_conversation.assert_awaited_once()
