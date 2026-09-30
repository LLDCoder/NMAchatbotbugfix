from types import SimpleNamespace
from copy import deepcopy
import pytest
from app.reader_collection import projection_hash
from app.reader_lookup_absence import verified_lookup_absence
from app.generic_reader import render_generic_answer
from app.skills import response_language_for


def fixture():
    rows=[{'key':'1','reference':'KNOWN-01'}]
    definitions=[{'operationRef':'POST /api/test/list','sourcePath':'/data/items','identityField':'reference','bindingId':'samples#reference'}]
    source={'operationRef':definitions[0]['operationRef'],'data':{'data':{'items':rows}},'truncated':False,
        'collectionReceipt':{'operationRef':definitions[0]['operationRef'],'rowsPath':'/data/items','rowCount':1,'total':1,
            'fields':['key','reference'],'fieldStatus':{'reference':'complete'},'completeness':'complete','stablePasses':2,
            'projectionHash':projection_hash(rows),'finishedAt':'2026-09-28T00:00:00Z'}}
    return SimpleNamespace(recordIdentity='UNKNOWN-02'),definitions,{'list':source}


def test_complete_exact_lookup_reports_bounded_absence_in_both_languages():
    t,d,s=fixture();proof=verified_lookup_absence(t,d,s)
    assert proof and proof['globalAbsence'] is False
    for lang in ['en','ar']:
        answer=render_generic_answer({'result':'no_data','verifiedLookupAbsence':proof},lang)
        assert t.recordIdentity in answer and '2026-09-28' in answer
        assert 'KNOWN-01' not in answer and '/api/' not in answer


@pytest.mark.parametrize('fault',['bounded','truncated','unstable','missing_field','null_field','mismatched_operation','mismatched_path','hash','total','matching_record','failed'])
def test_unproven_or_matching_lookup_never_reports_absence(fault):
    t,d,s=fixture();v=s['list'];r=v['collectionReceipt']
    if fault=='bounded':r['completeness']='bounded'
    if fault=='truncated':v['truncated']=True
    if fault=='unstable':r['stablePasses']=1
    if fault=='missing_field':r['fieldStatus']={}
    if fault=='null_field':v['data']['data']['items'][0]['reference']=None
    if fault=='mismatched_operation':r['operationRef']='GET /unrelated'
    if fault=='mismatched_path':r['rowsPath']='/other'
    if fault=='hash':r['projectionHash']='bad'
    if fault=='total':r['total']=5
    if fault=='matching_record':t.recordIdentity='KNOWN-01'
    if fault=='failed':v['collectionFailure']='timeout'
    assert verified_lookup_absence(t,d,s) is None


@pytest.mark.parametrize('text,preferred,expected',[('用中文回答','en','en'),('用中文回答','ar','ar'),('👀','ar','ar'),('👀','zh','en'),('Please reply in Arabic','en','ar'),('بالإنجليزية من فضلك','ar','en')])
def test_only_supported_response_languages(text,preferred,expected):
    assert response_language_for(text,preferred)==expected



def empty_fixture():
    task, definitions, sources = fixture()
    source = sources['list']
    source['data']['data']['items'] = []
    source['collectionReceipt'].update(rowCount=0, total=0, fieldStatus={}, projectionHash=projection_hash([]))
    return task, definitions, sources


def test_stable_complete_empty_lookup_needs_no_nonexistent_row_field_status():
    task, definitions, sources = empty_fixture()
    proof = verified_lookup_absence(task, definitions, sources)
    assert proof and proof['scope'] == 'checked_authorized_view' and proof['globalAbsence'] is False
    assert proof['sources'][0]['rowCount'] == 0
    for language in ['en', 'ar']:
        answer = render_generic_answer({'result': 'no_data', 'verifiedLookupAbsence': proof}, language)
        assert task.recordIdentity in answer and '/api/' not in answer


@pytest.mark.parametrize('fault', ['field_not_declared', 'unstable', 'truncated', 'failed', 'wrong_path', 'wrong_hash', 'nonzero_total'])
def test_empty_rows_alone_do_not_establish_absence(fault):
    task, definitions, sources = empty_fixture()
    source = sources['list']; receipt = source['collectionReceipt']
    if fault == 'field_not_declared': receipt['fields'] = ['key']
    if fault == 'unstable': receipt['stablePasses'] = 1
    if fault == 'truncated': source['truncated'] = True
    if fault == 'failed': source['collectionFailure'] = 'timeout'
    if fault == 'wrong_path': receipt['rowsPath'] = '/other'
    if fault == 'wrong_hash': receipt['projectionHash'] = 'not_empty_hash'
    if fault == 'nonzero_total': receipt['total'] = 1
    assert verified_lookup_absence(task, definitions, sources) is None
