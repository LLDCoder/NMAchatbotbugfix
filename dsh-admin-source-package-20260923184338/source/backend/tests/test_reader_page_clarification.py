import copy
import pytest
from types import SimpleNamespace
from app.reader_page_clarification import page_clarification
from app.generic_reader import PipelineError


def fixture():
    task=SimpleNamespace(businessObject='specimen', requestedMeasures=['pending','returned count','overdue'], requestedAttributes=[])
    rule={'id':'meaning','slot':'requestedMeasures','objects':['specimen'], 'aliases':['returned count'],
          'question':{'en':'Current state or historical events?', 'ar':'الحالة الحالية أم الأحداث السابقة؟'},
          'choices':[{'id':'current','value':'currently returned specimens','label':{'en':'Current','ar':'الحالية'}},
                     {'id':'events','value':'return events','label':{'en':'Events','ar':'الأحداث'}}]}
    record={'id':'specimen.meanings','status':'active','revision':1,'applicability':{'pageRefs':['/specimens']},'payload':{'clarificationRules':[rule]}}
    kb=SimpleNamespace(items={'a':{'record':record,'documentId':'doc'}})
    return task,kb,record,rule


def test_page_rule_preserves_unrelated_measures_in_both_languages():
    t,k,_,_=fixture()
    for language in ['en','ar']:
        c,proof=page_clarification(t,k,['/specimens'],language)
        assert c.missingSlots==['requestedMeasures']
        assert c.options[0].updates[0].value==['pending','currently returned specimens','overdue']
        assert c.options[1].updates[0].value==['pending','return events','overdue']
        assert proof[0]['recordId']=='specimen.meanings'
    assert t.requestedMeasures==['pending','returned count','overdue']


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_declared_ranking_choice_consumes_only_its_exact_duplicate_focus(language):
    t,k,_,rule=fixture()
    rule.update(slot='requestedOrdering', aliases=['most intense'], consumesDuplicateFocus=True)
    t.requestedOrdering=['most intense'];t.businessFocus='most intense'
    c,_=page_clarification(t,k,['/specimens'],language)
    assert [(u.field,u.value) for u in c.options[0].updates]==[
        ('requestedOrdering',['currently returned specimens']), ('businessFocus','')]
    t.businessFocus='most intense returned specimens'
    c,_=page_clarification(t,k,['/specimens'],language)
    assert [u.field for u in c.options[0].updates]==['requestedOrdering']
    rule['consumesDuplicateFocus']=False;t.businessFocus='most intense'
    c,_=page_clarification(t,k,['/specimens'],language)
    assert [u.field for u in c.options[0].updates]==['requestedOrdering']


def test_explicit_term_choice_preserves_record_negation_and_other_conditions():
    from app.reader_page_clarification import automatic_clarification_routes
    t,k,_,rule=fixture()
    rule.update(slot='requestedAttributes', aliases=['retire'], replacementMode='term', autoClarify=True)
    rule['choices'][0]['value']='archive'
    rule['choices'][1]['value']='deactivate'
    t.requestedAttributes=['Explain: retire specimen Q-12 without removing its history.']
    assert automatic_clarification_routes(t,k,['/specimens']) == ['/specimens']
    c,_=page_clarification(t,k,['/specimens'],'en')
    assert c.options[0].updates[0].value == ['Explain: archive specimen Q-12 without removing its history.']
    assert c.options[1].updates[0].value == ['Explain: deactivate specimen Q-12 without removing its history.']
    t.requestedAttributes=c.options[0].updates[0].value
    assert automatic_clarification_routes(t,k,['/specimens']) == []


@pytest.mark.parametrize('fault', ['not_remote','unauthorized','wrong_object','not_explicit','substring'])
def test_automatic_term_rules_need_authorized_remote_explicit_matching_scope(fault):
    from app.reader_page_clarification import automatic_clarification_routes
    t,k,_,rule=fixture();routes=['/specimens']
    rule.update(slot='requestedAttributes', aliases=['retire'], replacementMode='term', autoClarify=True)
    t.requestedAttributes=['Explain: retire specimen Q-12.']
    if fault=='not_remote':k.items['a']['documentId']=''
    if fault=='unauthorized':routes=['/elsewhere']
    if fault=='wrong_object':t.businessObject='other'
    if fault=='not_explicit':rule.pop('autoClarify')
    if fault=='substring':t.requestedAttributes=['retirement date']
    assert automatic_clarification_routes(t,k,routes) == []


@pytest.mark.parametrize('fault',['retired','wrong_page','wrong_object','already_resolved'])
def test_ambiguity_does_not_leak_across_page_subject_or_resolved_choice(fault):
    t,k,r,_=fixture();pages=['/specimens']
    if fault=='retired':r['status']='draft'
    if fault=='wrong_page':pages=['/other']
    if fault=='wrong_object':t.businessObject='other'
    if fault=='already_resolved':t.requestedMeasures=['pending','return events','overdue']
    assert page_clarification(t,k,pages,'ar')==(None,[])


def test_conflicting_page_definitions_and_recursive_choices_fail_closed():
    t,k,r,rule=fixture();other=copy.deepcopy(r);other['id']='other';other['payload']['clarificationRules'][0]['question']['en']='Different meaning?'
    k.items['b']={'record':other}
    with pytest.raises(PipelineError,match='page_clarification_conflict'):page_clarification(t,k,['/specimens'],'en')
    del k.items['b'];rule['choices'][0]['value']='returned count'
    with pytest.raises(PipelineError,match='page_clarification_definition_invalid'):page_clarification(t,k,['/specimens'],'en')


def test_page_options_replace_recursive_model_choices_before_persistence():
    from app.reader_page_clarification import bind_page_clarification
    from app.generic_reader_contracts import ClarificationRequest
    from app.reader_context import literal_choice, merge_task
    from test_reader_context_v3 import task
    _,kb,_,_ = fixture()
    t = task(businessObject='specimen', requestedMeasures=['pending','returned count','overdue'],
        filters=['my collection'], groupBy=['owner'], requestedAttributes=[], unresolvedSlots=['requestedMeasures'],
        clarification=ClarificationRequest(question='What is returned?',missingSlots=['requestedMeasures'],options=[
            {'id':'literal','label':'Returned literally','updates':[{'field':'requestedMeasures',
             'value':['pending','returned count','overdue'],'source':'current'}]}]))
    corrected,proof = bind_page_clarification(t,kb,['/specimens'],'ar')
    assert [x.id for x in corrected.clarification.options] == ['current','events']
    assert corrected.filters == t.filters and corrected.groupBy == t.groupBy
    saved = {'previousIntent': {'task': corrected.model_dump(), 'pendingClarification': {
        **corrected.clarification.model_dump(), 'id':'clarification-id'}}}
    choice = literal_choice('1',saved)
    assert choice['choiceId'] == 'current'
    resumed = merge_task(corrected,saved,choice)
    assert resumed.requestedMeasures == ['pending','currently returned specimens','overdue']
    assert resumed.clarification is None
    assert bind_page_clarification(resumed,kb,['/specimens'],'ar') == (resumed,[])
    assert bind_page_clarification(t,kb,['/other'],'ar') == (t,[])


def test_early_rules_use_only_cited_active_authorized_pages():
    from app.reader_page_clarification import cited_clarification_routes
    from app.generic_reader_contracts import ClarificationRequest
    _,kb,record,_ = fixture()
    kb.passages = {'k_a:p0': ('a', 'definition')}
    c = ClarificationRequest(question='Which?', missingSlots=['requestedMeasures'], options=[
        {'id':'current','label':'Current','updates':[{'field':'requestedMeasures',
         'value':['currently returned specimens'],'source':'knowledge','evidence':'k_a:p0'}]}])
    t = SimpleNamespace(clarification=c)
    assert cited_clarification_routes(t,kb,['/specimens','/other']) == ['/specimens']
    assert cited_clarification_routes(t,kb,['/other']) == []
    record['status']='retired'
    assert cited_clarification_routes(t,kb,['/specimens']) == []


@pytest.mark.parametrize('fault', ['none', 'unrelated_changed', 'choice_changed', 'retired',
    'not_retrieved', 'wrong_page', 'local_only', 'free_form', 'saved_choice_changed'])
def test_clarification_revalidation_checks_its_actual_definitions(fault):
    from app.reader_page_clarification import unchanged_page_clarification
    from test_reader_context_v3 import task
    _,kb,record,rule=fixture()
    t=task(businessObject='specimen',requestedMeasures=['pending','returned count','overdue'],requestedAttributes=[])
    request,_=page_clarification(t,kb,['/specimens'],'en')
    previous={'task':t.model_dump(),'pendingClarification':request.model_dump(),'knowledgeVersion':'old-directory'}
    routes=['/specimens']
    if fault=='unrelated_changed':kb.items['b']={'record':{'id':'other','revision':99,'status':'active'},'documentId':'new-unrelated-doc'}
    elif fault=='choice_changed':rule['choices'][0]['value']='other specimens'
    elif fault=='retired':record['status']='retired'
    elif fault=='not_retrieved':kb.items={}
    elif fault=='wrong_page':routes=['/other']
    elif fault=='local_only':kb.items['a']['documentId']=''
    elif fault=='free_form':previous['pendingClarification']['options'][0]['updates'][0]['evidence']='model prose'
    elif fault=='saved_choice_changed':previous['pendingClarification']['options'][0]['updates'][0]['value']=['other']
    assert bool(unchanged_page_clarification(previous,kb,routes,'en')) == (fault in ['none','unrelated_changed'])
