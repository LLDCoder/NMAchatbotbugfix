import copy
import json
import pytest
from app.reader_requirements import _context_match, semantic_bindings, minimal_list_projection, collection_dependencies
from app.reader_collection import projection_hash
from app.generic_reader import KnowledgeStore
from test_reader_context_v3 import task


def store(facts):
    k = KnowledgeStore()
    r = {'id':'sample.fields','revision':1,'status':'active','kind':'field_semantics',
         'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/samples']},
         'sources':[{'reference':'/samples'}], 'payload':{'bindings':facts}}
    k.add({'chunks':[{'id':'mapping','content':json.dumps({'records':[r]})}]})
    return k


def fact(kind='object'):
    return {'id':kind,'kind':kind,'concept':'sample','fields':['key'],
        'operationRef':'POST /api/sample/query','sourcePath':'/data/items',
        'contextParameters':{'category':'sample'},'entityContextAlternatives':{'view':['active','finished']}}


def source(view='active', **parameters):
    return {'operationRef':'POST /api/sample/query','data':{'data':{'items':[]}},
        'collectionContext':{'parameterHashes':{k:projection_hash(v) for k,v in
            {'category':'sample','view':view, **parameters}.items()}}}

@pytest.mark.parametrize('kind',['object','grain'])
@pytest.mark.parametrize('view,valid',[('active',True),('finished',True),('summary',False),('',False)])
def test_entity_context_is_explicitly_enumerated(kind,view,valid):
    assert _context_match(fact(kind),source(view)) is valid
    assert not _context_match(fact(kind),source(view, unreviewed='extra'))
    assert not _context_match(fact(kind),source(view, category='other'))

@pytest.mark.parametrize('kind',['scope','filter','population','measure','attribute','ordering'])
def test_entity_alternatives_cannot_weaken_population_or_measure(kind):
    f=fact(kind)
    assert not semantic_bindings(store([f]))
    assert not _context_match(f,source())

@pytest.mark.parametrize('alternatives',[{'view':[]},{'view':'active'},{'view':[{}]},{'category':['sample']}])
def test_invalid_declarations_are_not_bindings(alternatives):
    f=fact();f['entityContextAlternatives']=alternatives
    assert not semantic_bindings(store([f]))


def list_setup():
    obj=fact();obj['displayFields']=['publicNumber']
    grain=fact('grain')
    order={'id':'order','kind':'ordering','concept':'rank highest first','fields':['rank'],
        'operationRef':obj['operationRef'],'sourcePath':obj['sourcePath'],
        'direction':'ascending','valueType':'number'}
    k=store([obj,grain,order]);t=task(businessObject='sample',requestedGrain='sample',
        requestedScope='unknown',businessFocus='',timeRange='unknown',requestedMeasures=[],requestedAttributes=[],
        requestedOrdering=['rank highest first'],outputShape='list',filters=[],groupBy=[],recordIdentity='',view='')
    deps,ambiguous=collection_dependencies(t,k,'/samples',source(),'/data/items')
    return k,t,deps,ambiguous


def test_list_projection_preserves_identity_public_label_and_order_dependency():
    k,t,deps,ambiguous=list_setup()
    assert set(minimal_list_projection(t,k,deps,ambiguous))=={'key','publicNumber','rank'}

@pytest.mark.parametrize('change',[{'requestedAttributes':['historical note']},{'filters':['unmapped boundary']},
    {'requestedMeasures':['special count']},{'groupBy':['team']},{'recordIdentity':'S-17'}])
def test_unmapped_requirements_never_get_silently_removed(change):
    k,t,deps,ambiguous=list_setup()
    for key,value in change.items():setattr(t,key,value)
    assert minimal_list_projection(t,k,deps,ambiguous) is None


def test_no_projection_when_no_public_display_or_ambiguous_mapping():
    k,t,deps,ambiguous=list_setup()
    assert minimal_list_projection(t,k,deps,[{'requirementId':'object'}]) is None
    for item in k.items.values():
        for f in (item.get('record') or {}).get('payload',{}).get('bindings',[]):f.pop('displayFields',None)
    assert minimal_list_projection(t,k,deps,[]) is None
