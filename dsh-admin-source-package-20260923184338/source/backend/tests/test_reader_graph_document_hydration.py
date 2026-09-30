from app.reader_knowledge import reconstruct_package
from app.generic_reader import KnowledgeStore
import json
from test_reader_routing_v03 import package, chunks_for


def test_derived_graph_evidence_does_not_invalidate_original_json_segments():
    chunks,manifest=chunks_for(package())
    graph={**chunks[0],'id':'graph:derived-node','source_type':'graph','content':'Derived entity description'}
    original=reconstruct_package(chunks,manifest)
    actual=reconstruct_package([graph,*chunks],manifest)
    assert actual is not None and actual['content_hash']==original['content_hash']


def test_graph_provenance_cannot_fill_a_missing_source_segment():
    chunks,manifest=chunks_for(package())
    graph={**chunks[0],'source_type':'graph'}
    assert reconstruct_package([graph,*chunks[1:]],manifest) is None
    malformed={**chunks[0],'id':'graph:claimed-as-original','source_type':'file'}
    assert reconstruct_package([malformed,*chunks],manifest) is None


def test_graph_with_json_filename_is_reference_not_an_incomplete_original():
    store=KnowledgeStore()
    store.add({'chunks':[{'id':'graph:node','document_id':'doc','source_name':'Crystal Fields.json',
                          'source_type':'graph','content':'Derived description with original file provenance.'}]})
    assert not store.rejected
    assert len(store.items)==1
    assert next(iter(store.items.values()))['recordId']==''


def test_graph_generated_json_cannot_supply_structured_operation_definitions():
    store=KnowledgeStore()
    store.add({'chunks':[{'id':'graph:node','document_id':'doc','source_name':'Crystal Fields.json',
                          'source_type':'graph','content':json.dumps(package())}]})
    assert not store.rejected
    assert len(store.items)==1
    assert next(iter(store.items.values()))['record'] is None
