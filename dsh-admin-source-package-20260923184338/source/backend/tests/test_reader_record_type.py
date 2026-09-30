import json
import pytest
from app.generic_reader import KnowledgeStore
from app.reader_record_type import record_type_conflict,type_conflict_clarification,public_type_conflict
from app.reader_collection import projection_hash
from app.reader_context import save_intent,literal_choice,merge_task
from test_reader_context_v3 import task


def setup(fault=None):
    t=task(businessObject='specimen',requestedGrain='specimen',recordIdentity='R-2',outputShape='detail',requestedAttributes=['phase'])
    facts=[{'id':name,'kind':'object','concept':name,'aliases':[alias],'operationRef':'GET /api/record/{id}',
        'sourcePath':'/data','fields':['id','kind'],'conditions':[{'field':'kind','predicate':'eq','value':code}]}
        for name,alias,code in [('specimen','عينة',1),('reference','مرجع',2)]]
    rec={'id':'page.types','kind':'field_semantics','status':'active','revision':1,
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/record']},
        'sources':[{'reference':'/record'}],'payload':{'bindings':facts}}
    source={'page':'/record','operationRef':'GET /api/record/{id}','principalScopeRef':'principal',
        'data':{'data':{'id':20,'kind':2}},'verifiedRecord':{'single':True,'identity':'R-2','path':'/data','keyFields':['id']},
        'fieldEvidence':{'/data/kind':{'status':'complete','valueHash':projection_hash(2)}}}
    if fault=='same_type':source['data']['data']['kind']=1;source['fieldEvidence']['/data/kind']['valueHash']=projection_hash(1)
    if fault=='null':source['data']['data']['kind']=None
    if fault=='forged':source['fieldEvidence']['/data/kind']['valueHash']='changed'
    if fault=='different_identity':source['verifiedRecord']['identity']='R-3'
    if fault=='no_principal':source['principalScopeRef']=''
    if fault=='wrong_page':source['page']='/other'
    if fault=='unproven_context':facts[1]['contextParameters']={'scope':'permitted'}
    if fault=='overlap':facts.append({**facts[1],'id':'third','concept':'other reference'})
    if fault=='inactive':rec['status']='draft'
    if fault=='wrong_field':facts[1]['fields']=['otherKind'];facts[1]['conditions'][0]['field']='otherKind'
    if fault=='range':facts[0]['conditions'][0]['predicate']='gt'
    k=KnowledgeStore();k.add({'chunks':[{'id':'types','content':json.dumps({'records':[rec]})}]})
    return t,{'record':source},k

@pytest.mark.parametrize('fault',[None,'same_type','null','forged','different_identity','no_principal','wrong_page','unproven_context','overlap','inactive','wrong_field','range'])
def test_type_mismatch_requires_a_verified_record_and_disjoint_known_subtypes(fault):
    t,s,k=setup(fault);result=record_type_conflict(t,s,k)
    assert bool(result)==(fault is None)
    if result:
        assert result['actual']=={'en':'reference','ar':'مرجع'}
        assert 'kind' not in result and '2' not in result.values()

@pytest.mark.parametrize('language',['en','ar'])
def test_confirmation_updates_type_only_after_user_choice(language):
    t,s,k=setup();conflict=record_type_conflict(t,s,k);pending=type_conflict_clarification(t,conflict,language)
    assert pending.businessObject=='specimen' and pending.recordIdentity=='R-2'
    assert ('مرجع' if language=='ar' else 'reference') in pending.clarification.question
    saved={'previousIntent':save_intent(pending,'Initial question',{},'request','principal','catalog','now')}
    c=literal_choice('1',saved);resolved=merge_task(pending,saved,c)
    assert resolved.businessObject==resolved.requestedGrain=='reference'
    assert resolved.recordIdentity=='R-2' and resolved.requestedAttributes==['phase']
    other=merge_task(pending,saved,literal_choice('2',saved))
    assert other.recordIdentity=='' and other.businessObject=='specimen'

@pytest.mark.parametrize('page',['/record?id=20','/record?id=20&tab=overview'])
def test_verified_record_query_parameters_do_not_change_page_definition(page):
    t,s,k=setup();s['record']['page']=page
    assert record_type_conflict(t,s,k)['actual']['en']=='reference'
    s['record']['verifiedRecord']['identity']='R-3'
    assert record_type_conflict(t,s,k) is None
