import asyncio
import copy
from types import SimpleNamespace
import pytest
from test_projected_collection import gateway
from app.generic_reader import source_inventory
from app.reader_collection import projection_hash, checked_collections


def fixture(monkeypatch):
    monkeypatch.setattr(gateway, 'READER_OPERATION_CATALOG', [{'method':'POST','path':'/api/specimens/query'}])
    monkeypatch.setattr(gateway, 'READER_READ_ONLY_POST_PATHS', ['/api/specimens/query'])
    page = SimpleNamespace(_reader_health={})
    calls = []
    async def read(page, url, *, method, parameters):
        calls.append((method, parameters.copy()))
        return {'data': {'items': [{'id': parameters['view']}], 'total': 1}}, 200
    monkeypatch.setattr(gateway, '_reader_get_document', read)
    specs = [gateway.PageReadRequest(operationKey='POST /api/specimens/query',
        parameters={'view': view, 'pageIndex':1, 'pageSize':20}) for view in ['open','done']]
    outcomes = asyncio.run(gateway._reader_page_reads(page, specs, 'https://portal.test'))
    return page, specs, outcomes, calls


def test_registered_readonly_post_keeps_both_parameter_contexts(monkeypatch):
    page, specs, outcomes, calls = fixture(monkeypatch)
    assert all(o['verified'] for o in outcomes)
    assert len({o['contextRef'] for o in outcomes}) == 2
    assert [c[1]['view'] for c in calls] == ['open','done']
    candidates = list(gateway._reader_api_discovery_state(page._reader_health)['candidates'].values())
    sources = source_inventory({'apiDiscovery': {'candidates': candidates}}, '/work', 'now', 'viewer')
    assert len(sources) == 2
    assert {s['data']['data']['items'][0]['id'] for s in sources.values()} == {'open','done'}


def test_collection_replays_exact_context_instead_of_last_request(monkeypatch):
    page, specs, outcomes, _ = fixture(monkeypatch)
    async def collect(spec, captured, fetch):
        assert captured['contextRef'] == spec.contextRef
        return {'view': captured['parameters']['view'], 'contextRef': spec.contextRef}
    monkeypatch.setattr(gateway, '_collect_projected_rows', collect)
    requests = [gateway.ProjectedCollectionRequest(operationKey=spec.operationKey,
        contextRef=out['contextRef'], rowsPath='/data/items', totalPath='/data/total',
        fields=['id'], identityFields=['id'], pageField='pageIndex', sizeField='pageSize')
        for spec, out in zip(specs, outcomes)]
    result = asyncio.run(gateway._reader_collect(page, requests, 'https://portal.test'))
    assert [r['view'] for r in result] == ['open','done']
    forged = requests[0].model_copy(update={'contextRef':'f'*64})
    result = asyncio.run(gateway._reader_collect(page, [forged], 'https://portal.test'))
    assert result[0]['reason'] == 'collection_source_not_authorized'
    assert checked_collections(result)[0]['contextRef'] == 'f'*64


def test_catalog_entry_does_not_authorize_post_mutation(monkeypatch):
    monkeypatch.setattr(gateway, 'READER_OPERATION_CATALOG', [{'method':'POST','path':'/api/specimens/close'}])
    monkeypatch.setattr(gateway, 'READER_READ_ONLY_POST_PATHS', [])
    spec = gateway.PageReadRequest(operationKey='POST /api/specimens/close')
    with pytest.raises(ValueError, match='page_read_not_allowed'):
        gateway._page_read_target(spec, 'https://portal.test')


def test_same_operation_wrong_view_cannot_satisfy_supplement_selection():
    from app.reader_related import validate_page_read_selection
    from app.generic_reader import KnowledgeStore, PipelineError
    import json
    kb = KnowledgeStore(); kb.add({'chunks':[{'content':json.dumps({'records':[{
        'id':'sample.views','kind':'field_semantics','status':'active','revision':1,
        'sources':[{'reference':'verified-source'}],
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/work']},
        'payload':{'pageReads':[{'operationKey':'POST /api/specimens/query','parameters':{'view':'done'},
            'requiredScope':'team','requiredObjects':['specimen']}]}}]})}]})
    task = SimpleNamespace(requestedScope='team',businessObject='specimen')
    source = lambda view:{'operationRef':'POST /api/specimens/query',
        'collectionContext':{'parameterHashes':{'view':projection_hash(view)}}}
    selection = SimpleNamespace(nextActions=[],missing=[],sourceIds=['open'])
    with pytest.raises(PipelineError, match='documented_scope_source_not_selected'):
        validate_page_read_selection(task,'/work',selection,{'open':source('open'),'done':source('done')},kb)
