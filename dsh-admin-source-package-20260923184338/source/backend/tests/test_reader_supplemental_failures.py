import asyncio,json
from types import SimpleNamespace
import pytest
from test_projected_collection import gateway
from app.reader_related import page_read_failure
from app.generic_reader import KnowledgeStore
from app.reader_gaps import classify_gap

@pytest.mark.parametrize('status,category',[(403,'permission'),(502,'runtime'),(None,'runtime')])
def test_transport_failure_remains_a_dependency_failure(monkeypatch,status,category):
    monkeypatch.setattr(gateway,'READER_OPERATION_CATALOG',[{'method':'GET','path':'/api/specimens'}])
    monkeypatch.setattr(gateway,'_reader_api_configured_policy_allows',lambda *a:True)
    async def fail(*a,**kw):
        if status is None:raise TimeoutError()
        raise gateway.CollectionDependencyError('related_source_failed',{'upstreamStatus':status,'attempts':2,'untrusted':'do not expose'})
    monkeypatch.setattr(gateway,'_reader_get_document',fail)
    outcomes=asyncio.run(gateway._reader_page_reads(SimpleNamespace(_reader_health={}),[gateway.PageReadRequest(operationKey='GET /api/specimens')],'https://portal.test'))
    assert 'untrusted' not in str(outcomes)
    k=KnowledgeStore();k.add({'chunks':[{'content':json.dumps({'records':[{'id':'page','status':'active','kind':'field_semantics','revision':1,'sources':[{'reference':'/specimens'}],
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/specimens']},'payload':{'pageReads':[{'operationKey':'GET /api/specimens','requiredScope':'personal','requiredObjects':['specimen']}]}}]})}]})
    task=SimpleNamespace(requestedScope='personal',businessObject='specimen')
    failure=page_read_failure(task,'/specimens',k,{'pageReadOutcomes':outcomes})
    assert failure.category==category and classify_gap(failure.code)==category
    assert failure.details['stage']=='SupplementalPageRead'
    assert page_read_failure(task,'/unrelated',k,{'pageReadOutcomes':outcomes}) is None
    task.businessObject='other';assert page_read_failure(task,'/specimens',k,{'pageReadOutcomes':outcomes}) is None


def test_policy_failure_is_not_attributed_to_upstream_user_permissions(monkeypatch):
    monkeypatch.setattr(gateway,'READER_OPERATION_CATALOG',[])
    out=asyncio.run(gateway._reader_page_reads(SimpleNamespace(_reader_health={}),[gateway.PageReadRequest(operationKey='GET /api/unregistered')],'https://portal.test'))
    assert out[0]['reason']=='page_read_not_registered'
    assert classify_gap(out[0]['reason'])=='execution_configuration'
