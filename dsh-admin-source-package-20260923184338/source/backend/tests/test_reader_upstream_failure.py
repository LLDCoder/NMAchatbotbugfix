import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from app.generic_reader import GenericKnowledgeReader, portal_result_failure, unavailable_source_error, render_generic_answer, source_inventory
from app.principal import Principal
from app.reader_gaps import classify_gap
from app.reader_upstream_failure import upstream_failure
from test_projected_collection import gateway


@pytest.mark.parametrize('status,code,category',[(401,'upstream_session_expired','permission'),(403,'upstream_access_denied','permission'),(404,'upstream_source_not_found','runtime'),(500,'source_response_unavailable','runtime'),(503,'source_response_unavailable','runtime')])
def test_business_failure_status_survives_source_selection_and_gateway_envelope(status,code,category):
    observation={'apiDiscovery':{'candidates':[{'operationKey':'GET /api/records','candidateKind':'business','policyState':'allowed','status':status}]}}
    error=unavailable_source_error(observation,['GET /api/records'])
    envelope=portal_result_failure({'status':'no_permission' if status in {401,403} else 'load_failed','diagnostics':{'upstreamStatus':status,'body':'private-source-body'}})
    assert (error.code,error.category)==(code,category)==(envelope.code,envelope.category)
    assert error.details['upstreamStatus']==status
    assert classify_gap(code)==category
    assert 'private-source-body' not in str(envelope.details)
    for lang in ['en','ar']:
        answer=render_generic_answer({'result':'permission_denied' if category=='permission' else 'load_failed','failureCategory':category,'missing':[code]},lang)
        assert answer and '/api/' not in answer and code not in answer
        if status==404:assert '404' in answer
        if status==401:assert ('Sign in again' if lang=='en' else 'سجّل الدخول') in answer
        if status==500:assert ('Retry' if lang=='en' else 'أعد المحاولة') in answer


def test_failed_dom_metrics_carry_specific_failure_without_becoming_zero():
    for status in [401,403,404,500]:
        source=source_inventory({'metrics':[{'label':'Tasks','value':0}],'readHealth':{'failed':['/api/records']},'apiDiscovery':{'candidates':[{'status':status}]}},'/work','now','owner')['page_metrics']
        assert source['ready'] is False and source['failureCode']==upstream_failure(status).code


@pytest.mark.parametrize('status',[401,403])
def test_live_identity_failure_ends_before_knowledge_or_business_read(status):
    client=SimpleNamespace(get_user_info=AsyncMock(return_value={'ok':False,'code':'permission_denied','status':status}),invoke=AsyncMock())
    planner=SimpleNamespace(generic_reader_json=AsyncMock())
    reader=GenericKnowledgeReader(client,planner,portal_base_url='https://portal.test')
    result=asyncio.run(reader.run(Principal('owner','umc:global:owner','request',umc_token='test-token'),'Read my work'))
    assert result.result.payload['result']=='permission_denied' and result.result.payload['missing']==[upstream_failure(status).code]
    client.invoke.assert_not_awaited();planner.generic_reader_json.assert_not_awaited()


@pytest.mark.parametrize('status',[401,403])
def test_executor_identity_denial_preserves_status_for_bilingual_recovery(monkeypatch,status):
    module=gateway
    async def fail(*args,**kwargs):raise HTTPException(status_code=status,detail={'upstreamStatus':status})
    monkeypatch.setattr(module,'_umc_request',fail)
    # Identity fails before Playwright is started.
    request=module.AdminPortalReadRequest(startPath='/work',actions=[{'type':'observe'}])
    response=asyncio.run(module._execute_admin_portal_read(request,'Bearer test-token','request','owner'))
    assert response['status']=='no_permission' and response['diagnostics']['upstreamStatus']==status
    assert portal_result_failure(response).code==upstream_failure(status).code


def test_failed_candidate_alone_blocks_metrics_and_auth_failure_takes_precedence():
    observation={'metrics':[{'label':'Tasks','value':0}],'apiDiscovery':{'candidates':[
        {'candidateKind':'business','status':500},{'candidateKind':'business','status':401}]}}
    source=source_inventory(observation,'/work','now','owner')['page_metrics']
    assert source['ready'] is False and source['failureCode']=='upstream_session_expired'
    assert unavailable_source_error(observation).code=='upstream_session_expired'


@pytest.mark.parametrize('field',['outputs','knowledgeAnswer'])
def test_public_failure_does_not_replace_already_verified_partial_evidence(field):
    from app.reader_upstream_failure import public_upstream_failure
    assert public_upstream_failure({field:[{'verified':True}],'missing':['upstream_session_expired']},'en') is None
