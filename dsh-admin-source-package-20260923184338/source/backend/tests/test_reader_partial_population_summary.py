import copy
import pytest
from app.generic_reader import execute_analysis, render_generic_answer
from app.generic_reader_contracts import Step, RequirementBinding
from app.reader_bindings import bind_analysis_evidence
from test_reader_requirement_coverage import fixture
from test_reader_generic_completion import add_fact, REFERENCE


def partial_result():
    task,plan,sources,kb=fixture([{'specimenKey':'a','phase':'2024-02-28T09:00:00Z','zone':'East'},
                                {'specimenKey':'b','phase':None,'zone':'East'}])
    task.timeRange='today';task.timeField='collection date';task.groupBy=[]
    binding,ref=add_fact(kb,{'id':'collected','kind':'time','concept':'collection date',
        'operationRef':'POST /api/specimens/list','sourcePath':'/data/items','fields':['phase']})
    plan.steps.pop()
    plan.steps.insert(2,Step(id='period',op='filter_time',inputs=['entities'],field='phase',
        knowledgeBindingId=binding,label='Requested period',expose=False,unknownPolicy='report',evidence=[{'sourceId':ref}]))
    plan.steps[-1].inputs=['period'];plan.steps[-1].unknownPolicy='report'
    plan.requirementBindings=[b for b in plan.requirementBindings if b.requirementId!='group_0']
    plan.requirementBindings.append(RequirementBinding(requirementId='time',knowledgeBindingId=binding,sourceId='queue',stepIds=['period']))
    bind_analysis_evidence(plan,task,kb,sources)
    result=execute_analysis(plan,sources,kb,[],task=task,reference_time=REFERENCE)
    return {**result,'completeness':'bounded','analysisStatus':'partial'}


def test_unknown_filter_reports_read_population_without_claiming_complete_matches():
    result=partial_result();before=copy.deepcopy(result)
    assert not result['requirementsSatisfied']
    assert 'time_values_unavailable' in result['missing']
    assert result['outputs'][0]['value']==1 and result['outputs'][0]['unknownCount']==1
    en=render_generic_answer(result,'en');ar=render_generic_answer(result,'ar')
    assert 'All rows of the declared source population were read' in en
    assert 'matching set remains incomplete' in en
    assert 'تمت قراءة جميع صفوف مجموعة البيانات المحددة' in ar
    assert 'غير مكتملة' in ar
    assert 'These are bounded observations;' not in en
    assert result==before


@pytest.mark.parametrize('fault',['missing_receipt','unread_rows','bounded_source','unexplained_partial'])
def test_incomplete_scan_still_retains_bounded_warning(fault):
    result=partial_result();ref=result['outputs'][0]['evidence'][0]
    if fault=='missing_receipt':ref.pop('populationComplete')
    if fault=='unread_rows':ref['populationComplete']=False
    if fault=='bounded_source':ref['completeness']='bounded'
    if fault=='unexplained_partial':ref.pop('unknownRows')
    text=render_generic_answer(result,'en')
    assert 'These are bounded observations;' in text
    assert 'All rows of the declared source population were read' not in text
    assert not result['requirementsSatisfied']
