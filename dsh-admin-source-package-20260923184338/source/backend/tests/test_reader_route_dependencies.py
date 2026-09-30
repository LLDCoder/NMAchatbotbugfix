import json
from app.generic_reader import KnowledgeStore
from app.reader_routing import lookup_dependencies


def test_lookup_dependencies_use_documented_source_and_different_catalog_page():
    record={'id':'samples.detail','kind':'page_definition','revision':1,'status':'active',
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/samples/detail']},
        'sources':[{'reference':'authorized-source'}],'payload':{'routing':{'parameters':[{'id':'key','name':'sampleKey','from':'previous_record',
            'operationRef':'GET /api/samples','sourcePath':'/data/items','identityField':'reference', 'keyFields':['key'], 'field':'key','lookupPageRefs':['/samples']}]}}}
    k=KnowledgeStore();k.add({'chunks':[{'content':json.dumps({'records':[record]})}]})
    candidates=[{'candidateId':'list-id','route':'/samples'}, {'candidateId':'detail-id','route':'/samples/detail'}, {'candidateId':'other-id','route':'/other'}]
    deps=lookup_dependencies(candidates,k)
    assert len(deps)==1 and deps[0]['predecessorCandidateIds']==['list-id']
    assert deps[0]['destinationCandidateId']=='detail-id'
    assert deps[0]['parameterBindingId']=='samples.detail#key'
    assert lookup_dependencies(candidates[1:],k)[0]['predecessorCandidateIds']==[]
