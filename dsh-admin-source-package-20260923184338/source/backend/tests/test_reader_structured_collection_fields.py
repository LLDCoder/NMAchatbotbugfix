import json
from types import SimpleNamespace
import pytest
from app.generic_reader import collection_definition_proofs
from test_reader_requirement_coverage import fixture


@pytest.mark.parametrize('fault',[None,'inactive','other_page','other_operation','other_path','malformed','conflict'])
def test_exact_structured_binding_proves_fields_without_duplicate_flat_dictionary(fault):
    t,p,s,k=fixture()
    rec={'id':'new.field','revision':1,'status':'active','kind':'field_semantics',
         'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/research/specimens']},
         'sources':[{'reference':'/research/specimens'}], 'payload':{'bindings':[
             {'id':'public_label','kind':'attribute','concept':'public label','operationRef':s['queue']['operationRef'],
              'sourcePath':'/data/items','fields':['publicLabel']}]}}
    if fault=='inactive':rec['status']='draft'
    if fault=='other_page':rec['applicability']['pageRefs']=['/elsewhere']
    if fault=='other_operation':rec['payload']['bindings'][0]['operationRef']='GET /different'
    if fault=='other_path':rec['payload']['bindings'][0]['sourcePath']='/other/items'
    if fault=='malformed':rec['payload']['bindings'][0]['kind']='untrusted_kind'
    if fault=='conflict':rec['payload']['bindings'].append({**rec['payload']['bindings'][0],'fields':['otherLabel']})
    k.add({'chunks':[{'id':'structured-field','content':json.dumps({'records':[rec]})}]})
    spec=SimpleNamespace(fields=['publicLabel','undeclared'],rowsPath='/data/items',totalPath='/data/total',pageField='pageIndex',sizeField='pageSize')
    proofs=collection_definition_proofs(k,'/research/specimens',s['queue']['operationRef'],spec)
    assert ('publicLabel' in proofs)==(fault is None)
    assert 'undeclared' not in proofs
