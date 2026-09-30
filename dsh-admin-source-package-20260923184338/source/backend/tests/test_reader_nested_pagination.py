import json
from types import SimpleNamespace
import pytest
from app.generic_reader import collection_definition_proofs, bind_collection_evidence
from test_reader_requirement_coverage import fixture

@pytest.mark.parametrize('fault',[None,'other_rows','other_total','request_list','response_list','wrong_page','wrong_size','inactive','wrong_operation'])
def test_nested_pagination_requires_exact_declared_request_and_response(fault):
    _,_,sources,k=fixture()
    operation=sources['queue']['operationRef']
    payload={'sourceBinding':{'operationRef':operation,'sourcePath':'/data/items'},
        'fields':{'publicLabel':'Public item label'},
        'pagination':{'request':{'pageIndex':'offsetPage','pageSize':'limitSize'},
            'response':{'items':'/data/items','total':'/data/total'}}}
    record={'id':'nested.page','revision':1,'status':'active','kind':'field_semantics',
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/research/specimens']},
        'sources':[{'reference':'/research/specimens'}],'payload':payload}
    if fault=='other_rows':payload['pagination']['response']['items']='/other/items'
    if fault=='other_total':payload['pagination']['response']['total']='/other/total'
    if fault=='request_list':payload['pagination']['request']=[]
    if fault=='response_list':payload['pagination']['response']=[]
    if fault=='wrong_page':payload['pagination']['request']['pageIndex']='otherPage'
    if fault=='wrong_size':payload['pagination']['request']['pageSize']='otherSize'
    if fault=='inactive':record['status']='draft'
    if fault=='wrong_operation':payload['sourceBinding']['operationRef']='GET /unrelated'
    k.add({'chunks':[{'id':'nested-pagination','content':json.dumps({'records':[record]})}]})
    spec=SimpleNamespace(fields=['publicLabel'],rowsPath='/data/items',totalPath='/data/total',pageField='offsetPage',sizeField='limitSize',evidence=[])
    proofs=collection_definition_proofs(k,'/research/specimens',operation,spec)
    assert bind_collection_evidence(k,spec,proofs)==(fault is None)
    if fault is None:
        assert set(proofs)=={'publicLabel','offsetPage','limitSize','total'}
        assert all(v['recordId']=='nested.page' for p in proofs.values() for v in p)
