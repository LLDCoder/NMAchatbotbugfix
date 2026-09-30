"""Missing page packages use bounded, authorized document continuations."""
import asyncio

import pytest

from app import reader_retrieval as retrieval


class Client:
    def __init__(self, *, already_found=False):
        self.requests = []
        self.already_found = already_found

    async def files(self, *args, **kwargs):
        return {'items': [
            {'id': 'detail', 'name': 'Crystal Detail.json', 'folder_id': 'pages', 'status': 'done'},
            {'id': 'list', 'name': 'Crystal Collection-Identity.json', 'folder_id': 'pages', 'status': 'done'},
            {'id': 'pending', 'name': 'Crystal Collection-New.json', 'folder_id': 'pages', 'status': 'processing'},
            {'id': 'index', 'name': 'Crystal Collection-inventory.json', 'folder_id': 'pages', 'status': 'done'},
            {'id': 'incidental', 'name': 'Collection Other.json', 'folder_id': 'pages', 'status': 'done'},
        ]}

    async def _post(self, path, body, **kwargs):
        self.requests.append(body)
        def chunk(doc, name):
            return {'document_id': doc, 'id': doc + ':0', 'source_name': name, 'content': '{}'}
        if body.get('source_refs'):
            return {'chunks': [chunk('list', 'Crystal Collection-Identity.json'),
                               chunk('outside-manifest', 'Unseen.json')]}
        chunks = [chunk('detail', 'Crystal Detail.json')]
        if self.already_found:
            chunks.append(chunk('list', 'Crystal Collection-Identity.json'))
        return {'chunks': chunks}


@pytest.fixture
def hydration_input(monkeypatch):
    async def pass_through(client, gathered, *args, **kwargs):
        # Reconstruction, source hashes and manifest consistency have their own
        # integration tests; this fixture checks which chunks reach that gate.
        return gathered
    monkeypatch.setattr(retrieval, 'hydrate_packages', pass_through)


def run(client):
    return asyncio.run(retrieval.retrieve_evidence(
        client, 'Crystal Collection record identity', 'root', 20, {'purpose': 'page_fields'}))


def test_missed_page_json_is_discovered_despite_a_different_json_hit(hydration_input):
    client = Client()
    result = run(client)
    assert result['retrievalPlan']['selectedDocuments'] == ['list']
    assert client.requests[1]['source_refs'] == ['kbfile:list']
    assert {c['document_id'] for c in result['chunks']} == {'detail', 'list'}
    assert len(client.requests) == 2


def test_already_returned_page_json_is_not_requested_twice(hydration_input):
    client = Client(already_found=True)
    result = run(client)
    assert result['retrievalPlan']['selectedDocuments'] == []
    assert len(client.requests) == 1


def test_missing_package_cannot_bypass_shared_supplement_budget(hydration_input):
    async def check():
        client = Client()
        token = retrieval.RETRIEVAL_BUDGET.set({'remaining': 0})
        try:
            result = await retrieval.retrieve_evidence(
                client, 'Crystal Collection record identity', 'root', 20, {'purpose': 'page_fields'})
        finally:
            retrieval.RETRIEVAL_BUDGET.reset(token)
        assert len(client.requests) == 1
        assert {c['document_id'] for c in result['chunks']} == {'detail'}
        assert result['retrievalPlan']['supplementFailures'][0]['code'] == 'knowledge_supplement_budget_exhausted'
    asyncio.run(check())
