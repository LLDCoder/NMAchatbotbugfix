import asyncio
import hashlib
import json
import pytest
from app.reader_knowledge import hydrate_packages


class Client:
    def __init__(self, *, corrupt=False, moved=False, denied=False):
        self.text = json.dumps({'records': [{'id': 'page.fields', 'bindings': []}]})
        self.item = {'id': 'abc123', 'name': 'Page-fields.json', 'folder_id': 'root',
                     'status': 'done', 'updated_at': '1', 'size': len(self.text.encode()),
                     'sha256': hashlib.sha256(self.text.encode()).hexdigest()}
        self.corrupt, self.moved, self.denied = corrupt, moved, denied
        self.reads = 0

    async def files(self, *args, **kwargs):
        raise AssertionError('decorated directory reads should not be needed')

    async def manifest(self, *args, **kwargs):
        return {'items': [] if self.moved else [self.item]}

    async def document(self, file_id, folder_id, **kwargs):
        assert (file_id, folder_id) == ('abc123', 'root')
        self.reads += 1
        if self.denied:
            raise ValueError('document_revoked')
        return {'content': self.text + ('bad' if self.corrupt else ''),
                'content_hash': self.item['sha256'], 'manifest': self.item}

    async def _post(self, *args, **kwargs):
        raise AssertionError('exact document hydration must not issue semantic searches')


async def run(client):
    return await hydrate_packages(client, {'chunks': [{'document_id': 'abc123',
        'source_name': client.item['name'], 'id': 'kbfile:abc123-chunk-0', 'content': '{'}]},
        'root', 32, manifest_before=[client.item])


def test_exact_read_and_verified_cache_preserve_whole_document():
    c = Client()
    first = asyncio.run(run(c))
    assert first['chunks'][0]['content'] == c.text
    assert first['chunks'][0]['hydration']['method'] == 'authorized_document_sha256'
    asyncio.run(run(c))
    assert c.reads == 1


@pytest.mark.parametrize('options', [{'corrupt': True}, {'denied': True}, {'moved': True}])
def test_bad_or_revoked_document_cannot_survive_as_fragments(options):
    result = asyncio.run(run(Client(**options)))
    assert not result['chunks']
    assert result.get('hydrationGaps')
