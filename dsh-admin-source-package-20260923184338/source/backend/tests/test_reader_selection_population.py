import json
import pytest
from app.generic_reader import KnowledgeStore
from app.generic_reader_contracts import SourceSelection
from app.reader_bindings import selection_context_gaps
from app.reader_collection import projection_hash
from test_reader_context_v3 import task

@pytest.mark.parametrize('kind,expected_id',[('object','object'),('grain','grain'),('measure','measure_0')])
@pytest.mark.parametrize('actual',['all','specimens'])
def test_category_bound_business_meaning_is_checked_before_collection(kind,expected_id,actual):
    source={'operationRef':'POST /api/work/query','data':{'data':{'items':[]}},
        'collectionContext':{'parameterHashes':{'category':projection_hash(actual)}}}
    concept='count of specimens' if kind=='measure' else 'specimen'
    fact={'id':'meaning','kind':kind,'concept':concept,'fields':['key'],
        'operationRef':source['operationRef'],'sourcePath':'/data/items',
        'contextParameters':{'category':'specimens'}}
    if kind=='measure':fact['operator']='count'
    record={'id':'page.fields','revision':1,'status':'active','kind':'field_semantics',
        'applicability':{'portal':'admin','environments':['local']},
        'sources':[{'reference':'/work'}],'payload':{'bindings':[fact]}}
    k=KnowledgeStore();k.add({'chunks':[{'id':'fields','content':json.dumps({'records':[record]})}]})
    intent=task(businessObject='specimen',requestedGrain='specimen',requestedMeasures=['count of specimens'])
    selection=SourceSelection(stage='source_selection',sourceIds=['live'],nextActions=[],rationale=[],missing=[])
    gaps=selection_context_gaps(intent,selection,{'live':source},k)
    assert [g['requirementId'] for g in gaps]==([expected_id] if actual=='all' else [])
    assert not selection_context_gaps(intent,selection,{'live':dict(source,operationRef='GET /other')},k)

@pytest.mark.parametrize('selected,missing',[(['current','history'],[]),(['current'],['measure_1']),(['history'],['measure_0'])])
def test_distinct_measures_can_use_distinct_contexts_of_same_operation(selected,missing):
    facts=[]
    for view in ['current','history']:
        facts.append({'id':view,'kind':'measure','concept':view+' records','operator':'count','fields':['key'],
            'operationRef':'POST /api/work/query','sourcePath':'/data/items','contextParameters':{'view':view}})
    record={'id':'page.fields','revision':1,'status':'active','kind':'field_semantics',
        'applicability':{'portal':'admin','environments':['local']},'sources':[{'reference':'/work'}],
        'payload':{'bindings':facts}}
    k=KnowledgeStore();k.add({'chunks':[{'id':'fields','content':json.dumps({'records':[record]})}]})
    sources={view:{'operationRef':'POST /api/work/query','data':{'data':{'items':[]}},
        'collectionContext':{'parameterHashes':{'view':projection_hash(view)}}} for view in ['current','history']}
    intent=task(requestedMeasures=['current records','history records'])
    selection=SourceSelection(stage='source_selection',sourceIds=selected,nextActions=[],rationale=[],missing=[])
    assert [g['requirementId'] for g in selection_context_gaps(intent,selection,sources,k)]==missing
