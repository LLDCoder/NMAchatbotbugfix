import json
from types import SimpleNamespace
import pytest
from app.generic_reader import KnowledgeStore
from app.reader_collection import projection_hash
from app.reader_related import compile_page_read_selection, validate_page_read_selection


def setup():
    k=KnowledgeStore();k.add({'chunks':[{'content':json.dumps({'records':[{
        'id':'sample.views','kind':'field_semantics','status':'active','revision':1,
        'sources':[{'reference':'verified-source'}],
        'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/work']},
        'payload':{'pageReads':[{'operationKey':'POST /api/samples/query','parameters':{'view':'done'},
            'requiredScope':'team','requiredObjects':['sample']}]}}]})}]})
    task=SimpleNamespace(requestedScope='team',businessObject='sample')
    source={'operationRef':'POST /api/samples/query','page':'/work?tab=all','principalScopeRef':'actor',
        'observationRef':'read1','collectionContext':{'parameterHashes':{'view':projection_hash('done')}}}
    selection=SimpleNamespace(nextActions=[],missing=[],sourceIds=['current'])
    return task,source,selection,k


def test_required_observed_read_is_compiled_without_replacing_planner_source():
    t,s,p,k=setup();sources={'history':s}
    assert compile_page_read_selection(t,'/work',p,sources,k)==[
        {'sourceId':'history','operationRef':s['operationRef'],'reason':'required_observed_page_read'}]
    assert p.sourceIds==['current','history']
    validate_page_read_selection(t,'/work',p,sources,k)
    assert not compile_page_read_selection(t,'/work',p,sources,k)

@pytest.mark.parametrize('fault',['unrelated','wrong_context','extra_filter','ambiguous','no_principal','stale','not_ready','missing','next_action'])
def test_unverified_or_ambiguous_provenance_is_not_auto_selected(fault):
    t,s,p,k=setup();sources={'history':s}
    if fault=='unrelated':s['page']='/elsewhere'
    if fault=='wrong_context':s['collectionContext']['parameterHashes']['view']=projection_hash('current')
    if fault=='extra_filter':s['collectionContext']['parameterHashes']['owner']=projection_hash('somebody')
    if fault=='ambiguous':sources['other']=dict(s)
    if fault=='no_principal':s.pop('principalScopeRef')
    if fault=='stale':s.pop('observationRef')
    if fault=='not_ready':s['ready']=False
    if fault=='missing':p.missing=['required_read_unavailable']
    if fault=='next_action':p.nextActions=[{}]
    assert not compile_page_read_selection(t,'/work',p,sources,k)
    assert p.sourceIds==['current']
