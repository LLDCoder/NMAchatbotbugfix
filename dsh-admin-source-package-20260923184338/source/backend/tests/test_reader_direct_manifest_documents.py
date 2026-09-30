import asyncio
import copy
import hashlib
import json
import pytest
from app.reader_knowledge import hydrate_packages
from app.reader_retrieval import retrieve_evidence


class Client:
    def __init__(self, *, changed=False, corrupt=False):
        self.content = json.dumps({'records': [{'id': 'work.scope', 'status': 'active',
                                                'payload': {'scope': 'documented workspace'}}]})
        self.entry = {'id': 'workscope', 'name': 'Crystal Workspace Members.json', 'folder_id': 'root',
            'updated_at': 'revision-1', 'status': 'done', 'size': len(self.content.encode()),
            'sha256': hashlib.sha256(self.content.encode()).hexdigest()}
        self.changed, self.corrupt, self.reads = changed, corrupt, []
        self.manifest_reads = 0

    async def manifest(self, *args, **kwargs):
        self.manifest_reads += 1
        entry = copy.deepcopy(self.entry)
        if self.changed and self.manifest_reads > 1: entry['updated_at'] = 'revision-2'
        return {'items': [entry]}

    async def document(self, doc_id, folder_id, **kwargs):
        self.reads.append(('document', doc_id))
        return {'content': self.content + ('invalid' if self.corrupt else ''),
                'content_hash': self.entry['sha256'], 'manifest': self.entry}

    async def _post(self, path, body, **kwargs):
        self.reads.append(('search', body))
        # Simulate successful three-channel search whose top-k missed the
        # needed structured page document. Do not fabricate a source chunk.
        return {'chunks': [], 'completed_channels': ['vector', 'bm25', 'graph']}


def test_missing_structured_page_is_loaded_from_authorized_manifest_without_second_search():
    client = Client()
    result = asyncio.run(retrieve_evidence(client, 'Crystal Workspace Members scope', 'root', 32,
                                           {'purpose': 'page_fields'}))
    assert len([r for r in client.reads if r[0] == 'search']) == 1
    assert client.reads[-1] == ('document', 'workscope')
    assert result['chunks'][0]['content'] == client.content
    assert result['retrievalPlan']['directDocumentIds'] == ['workscope']
    assert result['pinnedVersions']['workscope']


@pytest.mark.parametrize('fault', ['changed', 'corrupt', 'unlisted', 'not_ready'])
def test_direct_document_still_requires_authorization_readiness_and_exact_integrity(fault):
    client = Client(changed=fault == 'changed', corrupt=fault == 'corrupt')
    if fault == 'not_ready': client.entry['status'] = 'indexing'
    result = asyncio.run(hydrate_packages(client, {'chunks': []}, 'root', 32,
        document_ids=['unlisted' if fault == 'unlisted' else 'workscope']))
    assert not result['chunks']
    if fault == 'changed': assert result['consistencyError'] == 'knowledge_document_changed'
    if fault in {'not_ready', 'unlisted'}: assert not client.reads


def test_direct_selection_does_not_bypass_failed_primary_search():
    import httpx
    class Failed(Client):
        async def _post(self, path, body, **kwargs):
            raise httpx.HTTPStatusError('Failed', request=httpx.Request('POST','https://kb.test/search'),
                                       response=httpx.Response(503))
    client = Failed()
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(retrieve_evidence(client, 'Crystal Workspace Members scope', 'root', 32,
                                     {'purpose': 'page_fields'}))
    assert not client.reads
