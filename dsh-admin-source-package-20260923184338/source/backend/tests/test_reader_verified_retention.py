import hashlib
from app.reader_retrieval import retain_verified_definitions
from app.generic_reader import KnowledgeStore


def definition(doc='definition'):
    import json
    record={'id':doc,'revision':1,'status':'active','kind':'page_knowledge','title':'Synthetic shapes',
            'sources':[{'kind':'manual','reference':'approved'}],
            'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/shapes']},
            'payload':{'clarificationRules':[{'id':'shape-meaning'}]}}
    content=json.dumps({'records':[record]})
    sha=hashlib.sha256(content.encode()).hexdigest()
    chunk={'document_id':doc,'id':doc+'#complete','source_name':'Shapes.json',
           'document_version':'7','content_hash':sha,'content':content}
    receipt={'documentId':doc,'version':'7','contentHash':sha}
    return chunk,receipt


def test_complete_definition_survives_more_than_one_page_of_prose():
    chunk,receipt=definition()
    prose=[{'document_id':str(i),'id':str(i),'content':'Reference '+str(i),'source_name':'Handbook.md'} for i in range(80)]
    kept,omitted=retain_verified_definitions({'chunks':[*prose,chunk],'documentVersions':[receipt]},32)
    assert len(kept)==32 and kept[0]==chunk and not omitted
    store=KnowledgeStore();store.add({'chunks':kept})
    assert any(i['recordId']=='definition' for i in store.items.values())
    assert len({i['documentId'] for i in store.items.values()})==32


def test_graph_or_changed_bytes_cannot_claim_verified_priority():
    chunk,receipt=definition()
    ordinary={'id':'first','document_id':'first','content':'First evidence','source_name':'Manual.md'}
    for invalid in [{**chunk,'source_type':'graph'},{**chunk,'content':chunk['content']+' changed'},
                    {**chunk,'document_version':'8'}]:
        kept,_=retain_verified_definitions({'chunks':[ordinary,invalid],'documentVersions':[receipt]},1)
        assert kept==[ordinary]


def test_exhausted_budget_reports_verified_definitions_that_cannot_be_retained():
    a,ra=definition('a');b,rb=definition('b')
    kept,omitted=retain_verified_definitions({'chunks':[a,b],'documentVersions':[ra,rb]},1)
    assert kept==[a] and omitted==['b']


def test_receipt_free_results_retain_existing_document_diversity():
    items=[{'id':str(i),'document_id':str(i//3),'content':str(i)} for i in range(6)]
    kept,omitted=retain_verified_definitions({'chunks':items},4)
    assert [c['id'] for c in kept]==['0','3','1','4'] and not omitted
