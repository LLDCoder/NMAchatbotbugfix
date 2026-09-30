import pytest
from app.generic_reader import PipelineError
from app.generic_reader_contracts import RouteHop
from app.reader_routing import parameter_lookup_definitions, bind_route
from test_reader_execution_flow import routes


def definitions():
    base={'id':'one','bindingId':'page#one','name':'id','from':'previous_record',
          'operationRef':'GET /api/queue-one','sourcePath':'/rows','identityField':'code',
          'keyFields':['key'],'field':'key','unique':False}
    return [base,{**base,'id':'two','bindingId':'page#two','operationRef':'GET /api/queue-two'}]


def test_cross_operation_lookup_requires_explicit_matching_equivalence():
    rows=definitions()
    assert parameter_lookup_definitions(rows,['page#one'])==rows[:1]
    rows[0]['lookupEquivalence']='specimen-key'
    assert parameter_lookup_definitions(rows,['page#one'])==rows[:1]
    rows[1]['lookupEquivalence']='different-key'
    assert parameter_lookup_definitions(rows,['page#one'])==rows[:1]
    rows[1]['lookupEquivalence']='specimen-key'
    assert parameter_lookup_definitions(rows,['page#one'])==rows
    rows[1]['keyFields']=['foreignKey']
    assert parameter_lookup_definitions(rows,['page#one'])==rows[:1]


def test_identity_equivalence_does_not_accept_incomplete_or_ambiguous_sources():
    from app.reader_routing import locate_record
    from types import SimpleNamespace
    rows=definitions()
    for r in rows:r['lookupEquivalence']='specimen-key'
    defs=parameter_lookup_definitions(rows,['page#one'])
    def source(op,key,complete=True):
        return {'operationRef':op,'data':{'rows':[{'code':'S-1','key':key}]},'collectionReceipt':{
            'operationRef':op,'rowsPath':'/rows','rowCount':1,'completeness':'complete' if complete else 'bounded'}}
    task=SimpleNamespace(recordIdentity='S-1')
    match,error=locate_record(task,defs,{'two':source('GET /api/queue-two',42)})
    assert not error and match[0][2]['key']==42
    assert locate_record(task,defs,{'two':source('GET /api/queue-two',42,False)})[1]=='record_not_verified'
    assert locate_record(task,defs,{'one':source('GET /api/queue-one',43),'two':source('GET /api/queue-two',42)})[1]=='record_ambiguous'
