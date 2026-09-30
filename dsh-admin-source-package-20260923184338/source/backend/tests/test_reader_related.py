import asyncio, copy, json
from types import SimpleNamespace
import pytest
from test_projected_collection import gateway
from app.reader_related import bind_related_records
from app.reader_collection import projection_hash


def fixture(monkeypatch, value=None):
    monkeypatch.setattr(gateway, 'READER_OPERATION_CATALOG', [{'method':'GET','path':'/api/specimens/{key}/rules'}])
    monkeypatch.setattr(gateway, '_reader_api_configured_policy_allows', lambda *a: True)
    spec=gateway.RelatedReadRequest(operationKey='GET /api/specimens/{key}/rules',parentOperationKey='GET /api/specimens/{key}',
        parentPath='/data',parentField='key',parameter='key',responseKeyPath='/data/specimenKey')
    data={'data': value if value is not None else {'key':'r-1','name':'Specimen'}}
    parent={'policyState':'allowed','status':200,'responseEvidence':data,'fieldEvidence':gateway._reader_field_evidence(data,data)}
    return spec, {spec.parentOperationKey:parent}


def test_only_registered_get_with_complete_observed_scalar_key(monkeypatch):
    spec,candidates=fixture(monkeypatch)
    url,receipt=gateway._related_read_target(spec,candidates,'https://portal.test')
    assert url=='https://portal.test/api/specimens/r-1/rules'
    assert receipt['keyHash']==projection_hash('r-1')
    # Unrelated truncated sibling data must not erase a complete key proof.
    candidates[spec.parentOperationKey]['fieldEvidence'].setdefault('/data', {})['status']='transformed'
    assert gateway._related_read_target(spec,candidates,'https://portal.test')[0]==url


@pytest.mark.parametrize('change', ['denied','post','unregistered','policy','missing','multiple','partial','key_receipt','sensitive','unsafe'])
def test_related_read_refuses_unproven_target(monkeypatch,change):
    spec,c=fixture(monkeypatch);p=c[spec.parentOperationKey]
    if change=='denied':p['status']=403
    if change=='post':spec.operationKey='POST /api/specimens/{key}/rules'
    if change=='unregistered':spec.operationKey='GET /api/other/{key}'
    if change=='policy':monkeypatch.setattr(gateway,'_reader_api_configured_policy_allows',lambda *a:False)
    if change=='missing':p['responseEvidence']['data'].pop('key')
    if change=='multiple':p['responseEvidence']['data']=[{'key':'r-1'},{'key':'r-2'}]
    if change=='partial':p['responseEvidence']['data']=[{'key':'r-1'}];p['fieldEvidence']=gateway._reader_field_evidence(p['responseEvidence'],p['responseEvidence']);p['fieldEvidence']['/data']['status']='bounded'
    if change=='key_receipt':p['fieldEvidence']['/data/key']['status']='transformed'
    if change=='sensitive':spec.parentField='password'
    if change=='unsafe':p['responseEvidence']['data']['key']='../all';p['fieldEvidence']=gateway._reader_field_evidence(p['responseEvidence'],p['responseEvidence'])
    with pytest.raises((ValueError, KeyError)):
        gateway._related_read_target(spec,c,'https://portal.test')


def test_related_proof_keeps_parent_identity_and_does_not_upgrade_data(monkeypatch):
    spec,c=fixture(monkeypatch);_,receipt=gateway._related_read_target(spec,c,'https://portal.test')
    parent={'operationRef':spec.parentOperationKey,'data':c[spec.parentOperationKey]['responseEvidence'],
        'principalScopeRef':'viewer','capturedAt':'now','verifiedRecord':{'single':True,'path':'/data','keyFields':['key'],'identity':'public-1'}}
    child={'operationRef':spec.operationKey,'data':{'data':{'specimenKey':'r-1','items':[]}},
        'principalScopeRef':'viewer','capturedAt':'now','relatedReadReceipt':{**receipt,'verified':True},'truncated':True}
    sources={'parent':parent,'child':child}
    assert len(bind_related_records(sources))==1
    assert child['verifiedRecord']['identity']=='public-1' and child['truncated']
    for field,value in [('principalScopeRef','other'),('capturedAt','yesterday')]:
        changed=copy.deepcopy(sources);changed['child'].pop('verifiedRecord');changed['child'][field]=value
        assert bind_related_records(changed)==[] and 'verifiedRecord' not in changed['child']
    changed=copy.deepcopy(sources);changed['child'].pop('verifiedRecord');changed['child']['data']['data']['specimenKey']='r-2'
    assert bind_related_records(changed)==[]


def test_supplemental_list_read_is_registered_static_get_only(monkeypatch):
    monkeypatch.setattr(gateway,'READER_OPERATION_CATALOG',[{'method':'GET','path':'/api/specimens'}])
    monkeypatch.setattr(gateway,'_reader_api_configured_policy_allows',lambda *a:True)
    spec=gateway.PageReadRequest(operationKey='GET /api/specimens',parameters={'pending':False,'page':1})
    assert gateway._page_read_target(spec,'https://portal.test')=='https://portal.test/api/specimens?pending=false&page=1'
    for op in ['POST /api/specimens','GET /api/other','GET /api/specimens/{key}']:
        with pytest.raises(ValueError):gateway._page_read_target(spec.model_copy(update={'operationKey':op}),'https://portal.test')
    for params in [{'accessToken':'secret'},{'q':'x'*121},{'q[]':'x'}]:
        with pytest.raises(ValueError):gateway._page_read_target(spec.model_copy(update={'parameters':params}),'https://portal.test')
    monkeypatch.setattr(gateway,'_reader_api_configured_policy_allows',lambda *a:False)
    with pytest.raises(ValueError):gateway._page_read_target(spec,'https://portal.test')


def test_page_read_selection_preserves_requested_object_scope_and_page():
    from app.reader_related import page_reads
    from app.generic_reader import KnowledgeStore
    payload={'records':[{'id':'sample.personal','kind':'field_semantics','status':'active','revision':1,
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/specimens']},
        'sources':[{'reference':'authorized-source'}],'payload':{'pageReads':[{'operationKey':'GET /api/specimens',
        'parameters':{'pending':True},'requiredScope':'personal','requiredObjects':['specimen']}]}}]}
    kb=KnowledgeStore();kb.add({'chunks':[{'content':json.dumps(payload)}]})
    task=SimpleNamespace(requestedScope='personal',businessObject='specimen')
    assert len(page_reads(kb,'/specimens',task))==1
    assert not page_reads(kb,'/other',task)
    task.requestedScope='team';assert not page_reads(kb,'/specimens',task)
    task.requestedScope='personal';task.businessObject='owner';assert not page_reads(kb,'/specimens',task)


def test_page_read_alias_comes_from_same_page_object_and_operation_only():
    from app.reader_related import page_reads, validate_page_read_selection
    from app.generic_reader import KnowledgeStore, PipelineError
    payload={'records':[{'id':'sample.alias','kind':'field_semantics','status':'active','revision':1,
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/specimens']},
        'sources':[{'reference':'authorized-source'}],'payload':{
            'bindings':[{'id':'object','kind':'object','concept':'specimen', 'aliases':['sample request'],
                         'operationRef':'GET /api/specimens','sourcePath':'/data','fields':['id']}],
            'pageReads':[{'operationKey':'GET /api/specimens','requiredScope':'personal',
                          'requiredObjects':['specimen']}]}}]}
    kb=KnowledgeStore();kb.add({'chunks':[{'content':json.dumps(payload)}]})
    task=SimpleNamespace(requestedScope='personal',businessObject='sample request')
    assert len(page_reads(kb,'/specimens',task))==1
    sources={'mine':{'operationRef':'GET /api/specimens'},'team':{'operationRef':'GET /api/team'}}
    selected=SimpleNamespace(sourceIds=['team'],nextActions=[],missing=[])
    with pytest.raises(PipelineError,match='documented_scope_source_not_selected'):
        validate_page_read_selection(task,'/specimens',selected,sources,kb)
    with pytest.raises(PipelineError,match='expected_source_not_observed'):
        validate_page_read_selection(task,'/specimens',selected,{'team':sources['team']},kb)
    selected.sourceIds=['mine']
    validate_page_read_selection(task,'/specimens',selected,sources,kb)
    fact=next(iter(kb.items.values()))['record']['payload']['bindings'][0]
    fact['operationRef']='GET /api/other'
    assert not page_reads(kb,'/specimens',task)
    fact['operationRef']='GET /api/specimens';fact['kind']='attribute'
    assert not page_reads(kb,'/specimens',task)


def test_read_transport_retries_transient_failure_but_not_denial():
    class Response:
        def __init__(self,status): self.status=status
        async def body(self): return b'{"data":{"key":"r-1"}}'
        async def dispose(self): pass
    class Request:
        def __init__(self,statuses): self.statuses=list(statuses);self.calls=0
        async def get(self,url,**kwargs):
            assert kwargs['max_redirects']==0
            self.calls+=1;return Response(self.statuses.pop(0))
    req=Request([502,200]);page=SimpleNamespace(context=SimpleNamespace(request=req))
    payload,status=asyncio.run(gateway._reader_get_document(page,'https://portal.test/api/specimens'))
    assert status==200 and req.calls==2 and payload['data']['key']=='r-1'
    req=Request([403,200]);page.context.request=req
    with pytest.raises(gateway.CollectionDependencyError):asyncio.run(gateway._reader_get_document(page,'https://portal.test/api/specimens'))
    assert req.calls==1


def test_supplemental_transport_uses_isolated_verified_principal_context():
    class Request:
        def __init__(self):self.calls=0
        async def get(self,url,**kwargs):
            self.calls+=1
            class Response:
                status=200
                async def body(self):return b'{"data":{"key":"a"}}'
                async def dispose(self):pass
            return Response()
    browser,isolated=Request(),Request()
    page=SimpleNamespace(context=SimpleNamespace(request=browser),_reader_request_context=isolated)
    assert asyncio.run(gateway._reader_get_document(page,'https://portal.test/api/specimens'))[1]==200
    assert isolated.calls==1 and browser.calls==0


@pytest.mark.parametrize('parent_branch',[False,True])
def test_related_attribute_can_use_parent_identity_without_crossing_entity_counts(parent_branch):
    from test_reader_generic_completion import detail_fixture
    from app.generic_reader import execute_analysis
    from app.reader_bindings import bind_analysis_evidence
    from app.reader_collection import projection_hash
    task,plan,sources,kb=detail_fixture()
    parent=sources['detail'];child_data={'data':{'parentKey':'a','color':'violet'}}
    receipt={'operationKey':'GET /api/specimens/{key}/attributes','parentOperationKey':parent['operationRef'],
        'parentPath':'/data','parentField':'key','parameter':'key','responseKeyPath':'/data/parentKey',
        'verified':True,'keyHash':projection_hash('a'),'parentValueHash':projection_hash({'key':'a'})}
    child={**{k:parent[k] for k in ['page','capturedAt','principalScopeRef']},
        'operationRef':receipt['operationKey'],'kind':'api_response','completeness':'bounded',
        'data':child_data,'fieldEvidence':gateway._reader_field_evidence(child_data,child_data),
        'relatedReadReceipt':receipt}
    sources['child']=child
    assert bind_related_records(sources)
    kb.add({'chunks':[{'content':json.dumps({'records':[{'id':'specimen.attributes','kind':'field_semantics',
        'revision':1,'status':'active','sources':[{'reference':'/specimens/detail'}],
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/specimens/detail']},
        'payload':{'bindings':[{'id':'color','kind':'attribute','concept':'color','operationRef':child['operationRef'],
            'sourcePath':'/data','fields':['color']}]}}]})}]})
    plan.steps[0].sourceId='child';plan.steps[0].fields=['color']
    attr=plan.requirementBindings[2];attr.sourceId='child';attr.knowledgeBindingId='specimen.attributes#color'
    if parent_branch:
        from app.generic_reader_contracts import Step
        plan.steps.append(Step(id='parent_visible',op='read_rows',sourceId='detail',path='/data',
            fields=['color'],label='Parent color',role='detail',evidence=list(plan.steps[0].evidence)))
        for binding in plan.requirementBindings[:2]:
            binding.stepIds=['parent_visible']
    bind_analysis_evidence(plan,task,kb,sources)
    if parent_branch:
        assert all('detail' in b.stepIds for b in plan.requirementBindings[:2])
    result=execute_analysis(plan,sources,kb,[],task=task)
    assert result['requirementsSatisfied'],result['requirementCoverage']
    assert result['outputs'][0]['value']==[{'color':'violet'}]
    from app.reader_related import related_context_read
    output={'role':'detail','value':[]};read=plan.steps[0]
    for kind in ['scope','population','measure','filter','time']:
        assert not related_context_read(task,kind,'detail','/data',['key'],sources,read,output)
    for field,value in [('principalScopeRef','other'),('capturedAt','yesterday')]:
        previous=child[field];child[field]=value
        assert not related_context_read(task,'object','detail','/data',['key'],sources,read,output)
        child[field]=previous
    task.outputShape='count'
    assert not related_context_read(task,'grain','detail','/data',['key'],sources,read,output)


def test_related_array_projection_retains_all_rows_before_transport_budget():
    payload={'data':{'specimenKey':'r-1','items':[
        {'name':str(i),'enabled':True,'nested':{'value':i}, **{'unused'+str(j):j for j in range(45)}}
        for i in range(35)]}}
    before=copy.deepcopy(payload)
    bounded,truncated=gateway._reader_bounded_api_evidence(payload)
    assert truncated and len(bounded['data']['items']) < 35
    spec=gateway.RelatedArrayProjection(path='/data/items',fields=['name','enabled','nested.value'])
    projected,proof=gateway._reader_project_related_arrays(payload,[spec],'/data/specimenKey')
    evidence,truncated=gateway._reader_bounded_api_evidence(projected, projected_array_paths={'/data/items'})
    assert not truncated and len(evidence['data']['items']) == 35
    assert payload == before
    assert evidence['data']['items'][-1] == {'name':'34','enabled':True,'nested':{'value':34}}
    receipt=gateway._reader_field_evidence(projected,evidence)['/data/items']
    assert receipt['status']=='complete' and receipt['valueHash']==proof[0]['projectedArrayHash']
    assert proof[0]['sourceArrayHash']==projection_hash(payload['data']['items'])
    assert proof[0]['rowCount']==35
    # A larger selected projection still hits existing transport limits.
    projected['data']['items'] *= 100
    assert gateway._reader_bounded_api_evidence(projected, projected_array_paths={'/data/items'})[1]


@pytest.mark.parametrize('fields,code', [(['password'],'related_projection_invalid'),
    (['nested'],'related_projection_not_scalar'), (['missing'],'related_projection_field_missing')])
def test_related_projection_never_invents_fields_or_exports_secrets(fields,code):
    payload={'data':{'key':'r','items':[{'name':'A','nested':{},'password':'secret'}]}}
    spec=gateway.RelatedArrayProjection(path='/data/items',fields=fields)
    with pytest.raises(ValueError,match=code):
        gateway._reader_project_related_arrays(payload,[spec],'/data/key')


def test_duplicate_related_definitions_union_documented_projection_fields():
    from app.reader_related import related_reads
    spec={'operationKey':'GET /api/specimens/{key}/rules','parentOperationKey':'GET /api/specimens/{key}',
        'parentPath':'/data','parentField':'key','parameter':'key','responseKeyPath':'/data/specimenKey',
        'requiredFor':['checks']}
    items={}
    for field in ['code','name']:
        items[field]={'record':{'id':field,'status':'active','applicability':{'pageRefs':['/specimens/detail']},
            'payload':{'relatedReads':[spec], 'bindings':[{'kind':'attribute','operationRef':spec['operationKey'],
                'sourcePath':'/data/items','fields':[field]}]}}}
    result=related_reads(SimpleNamespace(items=items),'/specimens/detail',SimpleNamespace(requestedAttributes=['checks']))
    assert len(result)==1
    assert result[0]['projections']==[{'path':'/data/items','fields':['code','name']}]


def test_child_attribute_drops_only_verified_redundant_key_lookup():
    from app.reader_related import redundant_related_key_reads
    from types import SimpleNamespace as NS
    b=NS(sourceId='child',sourcePath='/data',fields=['amount'],stepIds=['parent_keys','value'])
    sources={'parent':{'operationRef':'GET /api/parent','principalScopeRef':'u','capturedAt':'now'},
             'child':{'operationRef':'GET /api/child','principalScopeRef':'u','capturedAt':'now',
                'verifiedRecord':{'single':True,'boundTo':'verified_related_record','parentSourceId':'parent'},
                'relatedReadReceipt':{'verified':True,'operationKey':'GET /api/child',
                    'parentOperationKey':'GET /api/parent','parentPath':'/data/links','parentField':'key'}}}
    steps={'parent_keys':NS(id='parent_keys',op='read_rows',sourceId='parent',path='/data/links',
                           fields=['key','display'],inputs=[],expose=False),
           'value':NS(id='value',op='read_rows',sourceId='child',path='/data',fields=['amount'],inputs=[],expose=False)}
    args=(b,{'kind':'attribute'},sources,steps,{'visible':['visible','value']})
    assert redundant_related_key_reads(*args)==['parent_keys']
    # A hidden amount read is a different comparison branch, not a key lookup.
    steps['parent_keys'].path='/data/transaction'
    assert redundant_related_key_reads(*args)==[]
    steps['parent_keys'].path='/data/links';sources['child']['relatedReadReceipt']['verified']=False
    assert redundant_related_key_reads(*args)==[]
    sources['child']['relatedReadReceipt']['verified']=True;sources['parent']['principalScopeRef']='other'
    assert redundant_related_key_reads(*args)==[]
