import json
import pytest
from test_reader_generic_completion import detail_fixture
from app.generic_reader import execute_analysis,render_generic_answer,KnowledgeStore
from app.reader_bindings import bind_analysis_evidence
from app.generic_reader_contracts import Citation
from test_projected_collection import gateway


def fixture():
    task,plan,sources,old=detail_fixture();source=sources['detail'];row=source['data']['data'];row.update(color=None,phase='Awaiting review')
    source['fieldEvidence']=gateway._reader_field_evidence(source['data'],source['data'])
    rec=next(iter(old.items.values()))['record'];fact=rec['payload']['bindings'][-1];fact['fields']=['color','phase']
    fact['absenceRule']={'conditions':[{'field':'phase','value':'Awaiting review'}],'nullFields':['color'],
        'message':{'en':'No reviewed color is recorded yet.','ar':'لم يتم تسجيل اللون بعد المراجعة بعد.'}}
    kb=KnowledgeStore();kb.add({'chunks':[{'content':json.dumps({'records':[rec]})}]})
    ref=kb.prompt()[0]['passages'][0]['sourceId']
    for step in plan.steps:step.fields=['key','color','phase'];step.evidence=[Citation(sourceId=ref)]
    # Ensure typed citations as in a normal parsed plan.
    from app.generic_reader_contracts import AnalysisPlan
    plan=AnalysisPlan.model_validate(plan.model_dump())
    for name in ['grain','population','filterScope','time']:getattr(plan.context,name).evidence=plan.steps[0].evidence
    return task,plan,sources,kb


def test_documented_observed_absence_is_an_answer_in_both_languages():
    t,p,s,k=fixture();bind_analysis_evidence(p,t,k,s);result=execute_analysis(p,s,k,[],task=t)
    assert result['requirementsSatisfied'],result['requirementCoverage']
    assert result['outputs'][0]['verifiedAbsences']
    for lang,text in [('en','No reviewed color'),('ar','لم يتم تسجيل اللون')]:
        answer=render_generic_answer(result,lang)
        assert text in answer and '| None |' not in answer and '| color |' not in answer


@pytest.mark.parametrize('fault',['missing_receipt','other_state','other_record','not_single','value_present'])
def test_absence_cannot_certify_unobserved_fields_or_another_record(fault):
    t,p,s,k=fixture();source=s['detail']
    if fault=='missing_receipt':source['fieldEvidence'].pop('/data/color')
    if fault=='other_state':source['data']['data']['phase']='Complete'
    if fault=='other_record':source['verifiedRecord']['identity']='OTHER'
    if fault=='not_single':source['verifiedRecord']['single']=False
    if fault=='value_present':source['data']['data']['color']='blue'
    from app.reader_requirements import semantic_bindings
    from app.reader_absence import observed_absence
    fact=next(x for x in semantic_bindings(k) if x['kind']=='attribute')
    assert observed_absence(t,fact,source,fact['fields'],'/data') is None
