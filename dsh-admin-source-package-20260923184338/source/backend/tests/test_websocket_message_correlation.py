from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import make_router
from app.principal import Principal
from app.service import DSHService


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_burst_frames_on_one_socket_have_distinct_turn_ids_and_keep_authenticated_identity(language):
    principals = []

    async def submit(principal, conversation_id, content, client_message_id, response_language, **kwargs):
        principals.append(principal)
        return {'accepted': True, 'duplicate': False, 'conversationId': conversation_id,
                'seq': len(principals), 'requestId': principal.request_id}

    service = SimpleNamespace(
        tool_gateway=SimpleNamespace(platform=SimpleNamespace(
            get_user_info=AsyncMock(return_value={'data': {'id': 'verified-owner'}}))),
        submit_message=submit,
    )
    app = FastAPI()
    app.include_router(make_router(service))
    with TestClient(app) as client:
        with client.websocket_connect('/api/v1/ws?userId=verified-owner&tenantId=umc:global:verified-owner') as ws:
            ws.send_json({'type': 'auth', 'umctoken': 'test-only-session-token'})
            assert ws.receive_json()['type'] == 'authenticated'
            for i in range(4):
                ws.send_json({'type': 'message', 'conversationId': 'conversation',
                              'clientMessageId': f'client-{i}', 'content': f'question {i}',
                              'responseLanguage': language})
            receipts = [ws.receive_json() for _ in range(4)]
    assert [r['clientMessageId'] for r in receipts] == [f'client-{i}' for i in range(4)]
    assert len({r['requestId'] for r in receipts}) == 4
    assert [r['requestId'] for r in receipts] == [p.request_id for p in principals]
    assert all(p.user_id == 'verified-owner' and p.tenant_id == 'umc:global:verified-owner'
               and p.umc_token == 'test-only-session-token' for p in principals)
    assert 'test-only-session-token' not in str(receipts)


def test_rejected_message_receipt_still_identifies_its_client_message():
    service = SimpleNamespace(
        tool_gateway=SimpleNamespace(platform=SimpleNamespace(
            get_user_info=AsyncMock(return_value={'data': {'id': 'verified-owner'}}))),
        submit_message=AsyncMock(side_effect=LookupError('private details')),
    )
    app = FastAPI()
    app.include_router(make_router(service))
    with TestClient(app) as client:
        with client.websocket_connect('/api/v1/ws?userId=verified-owner') as ws:
            ws.send_json({'type': 'auth', 'umctoken': 'test-only-session-token'})
            assert ws.receive_json()['type'] == 'authenticated'
            ws.send_json({'type': 'message', 'conversationId': 'unowned-conversation',
                          'clientMessageId': 'client-unowned', 'content': 'Hello'})
            assert ws.receive_json() == {'type': 'error', 'code': 'conversation_not_found',
                                         'clientMessageId': 'client-unowned'}


def test_persisted_idempotency_retry_keeps_original_turn_id_without_scheduling_a_second_turn(monkeypatch):
    import asyncio
    import app.service as module

    queries = []
    results = [SimpleNamespace(user_event_seq=19),
               SimpleNamespace(event_json={'requestId': 'original-turn-id', 'clientMessageId': 'client-one'})]

    class DB:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def execute(self, query):
            queries.append(str(query))
            value = results.pop(0)
            return SimpleNamespace(scalar_one_or_none=lambda: value)

    monkeypatch.setattr(module, 'SessionLocal', DB)
    service = DSHService.__new__(DSHService)
    service._writer_locks = {}
    service.get_owned_conversation = AsyncMock(return_value=SimpleNamespace(conversation_id='owned'))
    service.runtime_manager = SimpleNamespace(ensure_runtime=AsyncMock())
    result = asyncio.run(service.submit_message(Principal('owner', 'tenant', 'new-socket-request'),
                        'owned', 'retry', 'client-one'))
    assert result == {'accepted': False, 'duplicate': True, 'conversationId': 'owned',
                      'seq': 19, 'requestId': 'original-turn-id'}
    service.runtime_manager.ensure_runtime.assert_not_awaited()
    assert len(queries) == 2 and 'session_event.conversation_id' in queries[1]
    assert 'session_event.seq' in queries[1]
