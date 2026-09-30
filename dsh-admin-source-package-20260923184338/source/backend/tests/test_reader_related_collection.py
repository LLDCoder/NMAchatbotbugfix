"""Opt-in parent collection ownership, without fabricated child entity keys."""
import asyncio, copy, json
from types import SimpleNamespace
import pytest
from app.generic_reader import source_inventory, KnowledgeStore, execute_analysis
from app.reader_related import related_reads, bind_related_records, related_context_read
from app.reader_related_collection import bind_related_collections
from app.reader_bindings import bind_analysis_evidence
from test_projected_collection import gateway
from test_reader_generic_completion import detail_fixture


PARENT = 'GET /api/specimens/{key}'
CHILD = 'GET /api/specimens/{key}/events'
PAGE = '/specimens/detail'


def setup(monkeypatch, rows=None):
    contract = {'relationshipRef':'reviewed.specimen.events','operationKey':CHILD,'parentOperationKey':PARENT,
        'parentPath':'/data','parentField':'key','parameter':'key','collectionPath':'/data','allowedFields':['color'],
        'sources':[{'reference':'reviewed-handler','sha256':'a'*64}]}
    monkeypatch.setattr(gateway,'READER_RELATED_COLLECTION_CONTRACTS',[contract])
    monkeypatch.setattr(gateway,'READER_OPERATION_CATALOG',[{'method':'GET','path':CHILD[4:]}])
    monkeypatch.setattr(gateway,'_reader_api_configured_policy_allows',lambda *a:True)
    spec = gateway.RelatedReadRequest(**{k:v for k,v in contract.items() if k not in {'allowedFields','sources'}},
        ownership='request_parameter_collection',projections=[{'path':'/data','fields':['color']}])
    parent_data={'data':{'key':'a','display':'DISPLAY-A'}}
    parent={'operationKey':PARENT,'policyState':'allowed','status':200,'trigger':'page',
        'responseEvidence':parent_data,'fieldEvidence':gateway._reader_field_evidence(parent_data,parent_data)}
    health={};gateway._reader_api_discovery_state(health)['candidates'][PARENT]=parent
    page=SimpleNamespace(_reader_health=health)
    payload={'data':rows if rows is not None else [{'color':'violet','internalNote':'private'},{'color':'blue','internalNote':'private'}]}
    calls=[]
    async def get_document(page,url):
        calls.append(url);return copy.deepcopy(payload),200
    monkeypatch.setattr(gateway,'_reader_get_document',get_document)
    return spec,page,calls,payload


def captured(monkeypatch, rows=None):
    spec,page,calls,payload=setup(monkeypatch,rows)
    outcome=asyncio.run(gateway._reader_related(page,[spec],'https://portal.test'))
    candidates=list(gateway._reader_api_discovery_state(page._reader_health)['candidates'].values())
    sources=source_inventory({'apiDiscovery':{'candidates':candidates}},PAGE,'now','principal')
    parent_id=next(k for k,v in sources.items() if v['operationRef']==PARENT)
    child_id=next((k for k,v in sources.items() if v['operationRef']==CHILD),None)
    sources[parent_id]['verifiedRecord']={'single':True,'path':'/data','field':'display','identity':'DISPLAY-A','keyFields':['key']}
    return spec,outcome,sources,parent_id,child_id,calls


def test_reviewed_collection_keeps_rows_without_fabricating_identity(monkeypatch):
    spec,outcome,sources,pid,cid,calls=captured(monkeypatch)
    assert outcome==[{'operationKey':CHILD,'verified':True}]
    assert calls==['https://portal.test/api/specimens/a/events']
    assert sources[cid]['data']=={'data':[{'color':'violet'},{'color':'blue'}]}
    assert bind_related_records(sources)==[]
    assert len(bind_related_collections(sources))==1
    assert 'verifiedRecord' not in sources[cid]
    assert sources[cid]['verifiedRelatedCollection']['identity']=='DISPLAY-A'


@pytest.mark.parametrize('fault',['no_contract','duplicate_contract','wrong_parent','wrong_parameter','wrong_collection','unreviewed_field','native_parent_denied','partial_parent_key','policy_denied','unregistered'])
def test_gateway_collection_requires_exact_reviewed_contract(monkeypatch,fault):
    spec,page,calls,_=setup(monkeypatch)
    candidates=gateway._reader_api_discovery_state(page._reader_health)['candidates']
    if fault=='no_contract':monkeypatch.setattr(gateway,'READER_RELATED_COLLECTION_CONTRACTS',[])
    elif fault=='duplicate_contract':monkeypatch.setattr(gateway,'READER_RELATED_COLLECTION_CONTRACTS',gateway.READER_RELATED_COLLECTION_CONTRACTS*2)
    elif fault=='wrong_parent':spec.parentField='display'
    elif fault=='wrong_parameter':spec.parameter='other'
    elif fault=='wrong_collection':spec.collectionPath='/other'
    elif fault=='unreviewed_field':spec.projections[0].fields=['internalNote']
    elif fault=='native_parent_denied':candidates[PARENT]['status']=403
    elif fault=='partial_parent_key':candidates[PARENT]['fieldEvidence']['/data/key']['status']='bounded'
    elif fault=='policy_denied':monkeypatch.setattr(gateway,'_reader_api_configured_policy_allows',lambda *a:False)
    else:monkeypatch.setattr(gateway,'READER_OPERATION_CATALOG',[])
    outcome=asyncio.run(gateway._reader_related(page,[spec],'https://portal.test'))
    assert not outcome[0]['verified'] and not calls


@pytest.mark.parametrize('rows',[None,{},[{'color':{'object':1}}],[{'missing':'x'}]])
def test_collection_rejects_wrong_shape_or_missing_fields(monkeypatch,rows):
    spec,page,calls,_=setup(monkeypatch)
    async def read(*args):return {'data':rows},200
    monkeypatch.setattr(gateway,'_reader_get_document',read)
    result=asyncio.run(gateway._reader_related(page,[spec],'https://portal.test'))
    assert result[0]['verified'] is False


@pytest.mark.parametrize('fault',['no_receipt','no_origin','model_origin_string','wrong_parent_key','wrong_url','wrong_parameter_hash','wrong_parent_hash','wrong_principal','wrong_capture','wrong_observation','wrong_page','partial_array','changed_array','wrong_row_count','missing_contract_proof','duplicate_parent'])
def test_backend_rejects_unproved_collection_ownership(monkeypatch,fault):
    _,_,sources,pid,cid,_=captured(monkeypatch)
    child,parent=sources[cid],sources[pid];receipt=child['relatedReadReceipt']
    if fault=='no_receipt':child.pop('relatedReadReceipt')
    elif fault=='no_origin':child.pop('_relatedCollectionOrigin')
    elif fault=='model_origin_string':child['_relatedCollectionOrigin']='gateway_related_collection'
    elif fault=='wrong_parent_key':parent['data']['data']['key']='b'
    elif fault=='wrong_url':receipt['requestPath']='/api/specimens/b/events'
    elif fault=='wrong_parameter_hash':receipt['requestParameterHash']='forged'
    elif fault=='wrong_parent_hash':receipt['parentValueHash']='forged'
    elif fault=='wrong_principal':child['principalScopeRef']='other'
    elif fault=='wrong_capture':child['capturedAt']='earlier'
    elif fault=='wrong_observation':child['observationRef']='another'
    elif fault=='wrong_page':child['page']='/other'
    elif fault=='partial_array':child['fieldEvidence']['/data']['status']='bounded'
    elif fault=='changed_array':child['data']['data'].append({'color':'other'})
    elif fault=='wrong_row_count':receipt['arrayProjections'][0]['rowCount']=999
    elif fault=='missing_contract_proof':receipt['contractVerified']=False
    else:sources['duplicate-parent']=copy.deepcopy(parent)
    assert bind_related_collections(sources)==[]
    assert 'verifiedRelatedCollection' not in child and 'verifiedRecord' not in child


def test_upstream_self_reported_receipt_cannot_create_capability(monkeypatch):
    _,_,sources,pid,cid,_=captured(monkeypatch)
    child=sources[cid]
    candidate={'operationKey':CHILD,'policyState':'allowed','status':200,'trigger':'page',
        'responseEvidence':{'data':{'relatedReadReceipt':child['relatedReadReceipt'],
                                  '_relatedCollectionOrigin':'gateway_related_collection'}}}
    forged=source_inventory({'apiDiscovery':{'candidates':[candidate]}},PAGE,'now','principal')
    fake=next(iter(forged.values()));assert '_relatedCollectionOrigin' not in fake
    # Metadata copied by the model is JSON, not the internal transport capability.
    fake=json.loads(json.dumps(child));assert fake['_relatedCollectionOrigin']=='gateway_related_collection'
    assert not bind_related_collections({'parent':sources[pid],'forged':fake})


@pytest.mark.parametrize('empty',[False,True])
def test_parent_object_and_grain_are_carried_by_complete_collection(monkeypatch,empty):
    _,_,sources,pid,cid,_=captured(monkeypatch,[] if empty else None)
    assert bind_related_collections(sources)
    task,plan,_,kb=detail_fixture()
    child=sources[cid]
    record={'id':'specimen.events','kind':'field_semantics','revision':1,'status':'active',
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':[PAGE]},
        'sources':[{'reference':'reviewed-handler'}],
        'payload':{'bindings':[{'id':'color','kind':'attribute','concept':'color','operationRef':CHILD,'sourcePath':'/data','fields':['color']}]}}
    kb.add({'chunks':[{'content':json.dumps({'records':[record]})}]})
    plan.steps[0].sourceId=cid;plan.steps[0].fields=['color']
    for binding in plan.requirementBindings[:2]:binding.sourceId=pid
    plan.requirementBindings[2].sourceId=cid;plan.requirementBindings[2].knowledgeBindingId='specimen.events#color'
    bind_analysis_evidence(plan,task,kb,sources)
    result=execute_analysis(plan,sources,kb,[],task=task)
    assert result['requirementsSatisfied'],json.dumps(result['requirementCoverage'])
    assert result['outputs'][0]['value']==([] if empty else [{'color':'violet'},{'color':'blue'}])
    for kind in ['scope','population','filter','time','measure']:
        assert not related_context_read(task,kind,pid,'/data',['key'],sources,plan.steps[0],{'role':'detail','value':[]})
    task.outputShape='count'
    assert not related_context_read(task,'object',pid,'/data',['key'],sources,plan.steps[0],{'role':'detail','value':[]})


def test_default_echo_still_requires_explicit_echo_path():
    with pytest.raises(ValueError):
        gateway.RelatedReadRequest(operationKey=CHILD,parentOperationKey=PARENT,parentPath='/data',parentField='key',parameter='key')


def test_knowledge_collection_rule_requires_explicit_opt_in(monkeypatch):
    spec,_,_,_=setup(monkeypatch)
    rule=spec.model_dump(exclude_none=True);rule.pop('projections');rule['requiredFor']=['color']
    record={'id':'specimen.events','kind':'field_semantics','revision':1,'status':'active',
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':[PAGE]},'sources':[{'reference':'reviewed-handler'}],
        'payload':{'relatedReads':[rule],'bindings':[{'id':'color','kind':'attribute','concept':'color','fields':['color'],'operationRef':CHILD,'sourcePath':'/data'}]}}
    kb=KnowledgeStore();kb.add({'chunks':[{'content':json.dumps({'records':[record]})}]})
    specs=related_reads(kb,PAGE,SimpleNamespace(requestedAttributes=['color']))
    assert len(specs)==1 and specs[0]['ownership']=='request_parameter_collection' and specs[0]['responseKeyPath'] is None
    assert not related_reads(kb,'/other',SimpleNamespace(requestedAttributes=['color']))


def test_gateway_rejects_client_authorship_of_server_receipt(monkeypatch):
    spec,_,_,_=setup(monkeypatch)
    with pytest.raises(ValueError):
        gateway.RelatedReadRequest(**{**spec.model_dump(),'contractVerified':True,'requestPath':'/api/specimens/a/events'})


def test_incomplete_collection_is_not_admitted(monkeypatch):
    spec,page,_,_=setup(monkeypatch,[{'color':'x'*5000} for _ in range(100)])
    outcome=asyncio.run(gateway._reader_related(page,[spec],'https://portal.test'))
    assert outcome[0]['verified'] is False
    assert CHILD not in gateway._reader_api_discovery_state(page._reader_health)['candidates']


def test_config_requires_reviewed_source_and_remains_separate_from_permission(tmp_path):
    path=tmp_path/'contracts.json'
    contract={'relationshipRef':'reviewed.specimen.events','operationKey':CHILD,'parentOperationKey':PARENT,
        'parentPath':'/data','parentField':'key','parameter':'key','collectionPath':'/data','allowedFields':['color'],
        'sources':[{'reference':'source','sha256':'a'*64}]}
    path.write_text(json.dumps({'contracts':[contract]}))
    assert len(gateway._load_reader_related_collection_contracts(path))==1
    contract['sources']=[];path.write_text(json.dumps({'contracts':[contract]}))
    assert not gateway._load_reader_related_collection_contracts(path)
    assert not gateway._load_reader_related_collection_contracts(tmp_path/'missing')


def test_collection_projection_omits_sibling_notes_and_encoded_documents(monkeypatch):
    spec,page,_,_=setup(monkeypatch)
    async def read(*args):
        return {'data':[{'color':'violet','internalNote':'private'}],'notes':'{"sensitive":"value"}'},200
    monkeypatch.setattr(gateway,'_reader_get_document',read)
    result=asyncio.run(gateway._reader_related(page,[spec],'https://portal.test'))
    assert result[0]['verified']
    candidate=gateway._reader_api_discovery_state(page._reader_health)['candidates'][CHILD]
    assert candidate['responseEvidence']=={'data':[{'color':'violet'}]}
    assert not candidate['structuredDocuments']
