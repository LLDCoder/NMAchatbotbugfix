import pytest
from app.reader_requirements import _context_match
from app.reader_collection import projection_hash

@pytest.mark.parametrize('value,wire',[(False,'false'),(True,'true'),(17,'17'),('false','false'),(2.5,'2.5')])
def test_get_context_uses_exact_query_encoding(value,wire):
    fact={'contextParameters':{'selected':value}}
    source={'operationRef':'GET /api/records','collectionContext':{'parameterHashes':{'selected':projection_hash(wire)}}}
    assert _context_match(fact,source)
    source['collectionContext']['parameterHashes']['extra']=projection_hash('unreviewed')
    assert not _context_match(fact,source)

@pytest.mark.parametrize('value',[False,True,17,2.5])
def test_post_context_preserves_json_types(value):
    fact={'contextParameters':{'selected':value}}
    source={'operationRef':'POST /api/records/query','collectionContext':{'parameterHashes':{'selected':projection_hash(value)}}}
    assert _context_match(fact,source)
    source['collectionContext']['parameterHashes']['selected']=projection_hash(str(value).lower())
    assert not _context_match(fact,source)

def test_get_mismatched_value_and_case_still_fail():
    fact={'contextParameters':{'selected':False}}
    for wire in ['true','False','0',False,None]:
        source={'operationRef':'GET /api/records','collectionContext':{'parameterHashes':{'selected':projection_hash(wire)}}}
        assert not _context_match(fact,source)
