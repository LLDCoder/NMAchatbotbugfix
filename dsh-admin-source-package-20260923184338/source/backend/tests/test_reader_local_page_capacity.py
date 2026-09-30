import json

import pytest

from app.generic_reader import KnowledgeStore
from app.reader_context import page_knowledge
from app.reader_routing import page_routing


def chunk(index, *, route='/work/items', revision=1, remote=False):
    record = {'id': f'page.{index}', 'kind': 'page_definition', 'status': 'active',
        'revision': revision, 'title': 'Synthetic page definition',
        'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': [route]},
        'sources': [{'kind': 'source_code', 'reference': 'synthetic fixture'}],
        'payload': {'routing': {'records': [{'id': 'item', 'identityField': 'code'}]}}}
    return {'id': str(index), **({'document_id': f'doc-{index}'} if remote else
        {'source_type': 'local_page_knowledge'}),
        'content': json.dumps({'packageStatus': 'active', 'records': [record]})}


@pytest.mark.parametrize('count', [0, 32, 33, 65])
def test_all_authorized_local_packages_are_loaded(count):
    store = KnowledgeStore()
    store.add_local([chunk(i) for i in range(count)])
    assert {item['recordId'] for item in store.items.values()} == {f'page.{i}' for i in range(count)}
    assert len(page_routing(store, '/work/items')['records']) == count
    assert not store.conflicted and not store.rejected


def test_remote_response_limit_is_unchanged_and_cannot_use_local_entry():
    chunks = [chunk(i, remote=True) for i in range(33)]
    store = KnowledgeStore()
    store.add({'chunks': chunks})
    assert len(store.items) == 32
    with pytest.raises(ValueError, match='local_page_knowledge_required'):
        store.add_local(chunks)
    assert len(store.items) == 32


def test_remote_definition_still_supersedes_last_local_package():
    store = KnowledgeStore()
    store.add_local([chunk(i) for i in range(33)])
    store.add({'chunks': [chunk(32, revision=2, remote=True)]})
    latest = [item for item in store.items.values() if item['recordId'] == 'page.32']
    assert len(latest) == 1 and latest[0]['record']['revision'] == 2
    assert latest[0]['documentId'] == 'doc-32' and not store.conflicted


def test_catalog_route_filter_runs_before_loading_local_packages(tmp_path):
    folder = tmp_path / 'KB/pages/admin/items'
    folder.mkdir(parents=True)
    for i in range(34):
        entry = chunk(i, route='/private' if i == 33 else '/work/items')
        (folder / f'{i:02}.json').write_text(entry['content'])
    store = KnowledgeStore()
    store.add_local(page_knowledge(tmp_path, [{'routes': ['/work/items']}]))
    assert len(store.items) == 33
    assert 'page.32' in {item['recordId'] for item in store.items.values()}
    assert 'page.33' not in {item['recordId'] for item in store.items.values()}


def test_conflicting_local_versions_across_batches_remain_rejected():
    store = KnowledgeStore()
    store.add_local([chunk(i) for i in range(32)] + [chunk(0, revision=2)])
    assert 'page.0' in store.conflicted
    assert all(item['recordId'] != 'page.0' for item in store.items.values())
