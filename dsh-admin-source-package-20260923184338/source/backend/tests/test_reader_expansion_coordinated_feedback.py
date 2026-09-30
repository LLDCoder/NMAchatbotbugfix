"""Actual v38 rejects; representation repairs below are controlled model replies only."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import time
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_expansion import QueryExpansion, PROMPT, validate_expansion
from app.reader_requirements import requirements_for

SAVED=json.loads((Path(__file__).parent/'fixtures/c05_qe_coordinated_v38.json').read_text())
QUESTION=SAVED['question']


def captured(attempt=1):
    return TaskSpec.model_validate(SAVED['acceptedTask']), QueryExpansion.model_validate(SAVED['rejectedPlans'][attempt]['candidate'])


def term(plan,kind):return next(t for t in plan.terms if t.requirementId==kind)


def controlled(attempt=1):
    task,plan=captured(attempt)
    term(plan,'view').english='view "in progress"'
    return task,plan


@pytest.mark.parametrize('attempt',[0,1])
def test_actual_failure_has_joint_safe_main_field_locator_without_mutation(attempt):
    task,plan=captured(attempt);before=deepcopy((task.model_dump(),plan.model_dump()))
    with pytest.raises(PipelineError,match='expansion_named_view_phrase_changed') as error:
        validate_expansion(plan,task,QUESTION)
    d=error.value.details
    assert d['termIndex']==5 and d['requirementKind']=='view'
    assert d['fields']==['english'] and d['paths']==[['terms',5,'english']]
    assert d['populationRequirementId']=='population' and d['populationTermIndex']==3
    assert d['populationPaths']==[['terms',3,'english']] and d['populationSourceTextPath']==['terms',3,'sourceText']
    assert d['originalLabelAnchoredFields']==['english','arabic']
    assert 'in progress' not in json.dumps(d) and 'قيد الإنجاز' not in json.dumps(d,ensure_ascii=False)
    assert (task.model_dump(),plan.model_dump())==before
    old=json.loads(SAVED['rejectedPlans'][attempt]['failure'])
    assert old['code']=='expansion_named_view_phrase_changed' and 'paths' not in old


@pytest.mark.parametrize('attempt',[0,1])
def test_controlled_reply_changes_only_one_main_field_and_keeps_all_other_original_terms(attempt):
    task,bad=captured(attempt);_,good=controlled(attempt)
    before=deepcopy((task.model_dump(),good.model_dump()))
    validate_expansion(good,task,QUESTION)
    expected=bad.model_dump();expected['terms'][5]['english']='view "in progress"'
    assert good.model_dump()==expected and (task.model_dump(),good.model_dump())==before
    assert term(good,'view').arabic=='عرض "قيد الإنجاز"'


class FeedbackPlanner:
    def __init__(self,bad,good,mode='correct'):
        self.bad=bad;self.good=good;self.mode=mode;self.calls=[]
    async def generic_reader_json(self,**kwargs):
        self.calls.append(deepcopy(kwargs))
        if len(self.calls)==1:return self.bad.model_dump()
        d=json.loads(kwargs['correction'])
        if (d.get('paths')!=[['terms',5,'english']] or d.get('populationSourceTextPath')!=['terms',3,'sourceText']
                or 'arabic' not in d.get('originalLabelAnchoredFields',[])):
            return self.bad.model_dump()
        if self.mode=='repeat' or self.mode=='third_only' and len(self.calls)<3:return self.bad.model_dump()
        return self.good.model_dump()


def runner(task,planner):
    reader=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid')
    reader.deadline=time.monotonic()+30;reader.current_question=QUESTION
    reader.current_observation_owner={'principalScopeRef':'controlled-current-owner','observationNotBefore':'2026-09-29T00:00:00Z'}
    data={'question':QUESTION,'task':task.model_dump(),'requirements':requirements_for(task)}
    return reader,data


@pytest.mark.parametrize('attempt',[0,1])
def test_exact_actual_failure_can_correct_inside_original_two_call_budget(attempt):
    task,bad=captured(attempt);_,good=controlled(attempt)
    planner=FeedbackPlanner(bad,good);reader,data=runner(task,planner);before=deepcopy(data)
    answer=asyncio.run(reader.structured(QueryExpansion,PROMPT,data,lambda p:validate_expansion(p,task,QUESTION)))
    assert answer.model_dump()==good.model_dump() and data==before and len(planner.calls)==2
    assert len(reader.audit['rejectedPlans'])==1 and len(reader.recovery)==1
    assert reader.audit['rejectedPlans'][0]['candidate']==bad.model_dump()
    assert all(c['data']['task']==before['task'] and c['data']['requirements']==before['requirements'] for c in planner.calls)
    assert planner.calls[1]['data']['priorValidationConstraints'][-1]==json.loads(planner.calls[1]['correction'])
    assert set(reader.audit['plans'])=={'QueryExpansion'} and 'expansionVariantSelections' not in reader.audit


@pytest.mark.parametrize('mode',['repeat','third_only','alternative_only','lost_anchor','truncated_phrase'])
def test_invalid_second_reply_never_uses_a_third_call_or_runtime_substitution(mode):
    task,bad=captured();_,good=controlled()
    if mode=='alternative_only':
        good=bad.model_copy(deep=True);term(good,'view').alternatives=['view "in progress"']
    elif mode=='lost_anchor':term(good,'view').arabic='عرض "قيد التنفيذ"'
    elif mode=='truncated_phrase':term(good,'view').english='view "progress"'
    planner=FeedbackPlanner(bad,good,mode);reader,data=runner(task,planner)
    before=deepcopy((task.model_dump(),bad.model_dump(),good.model_dump()))
    code='expansion_named_view_label_changed' if mode=='lost_anchor' else 'expansion_named_view_phrase_changed'
    with pytest.raises(PipelineError,match=code):
        asyncio.run(reader.structured(QueryExpansion,PROMPT,data,lambda p:validate_expansion(p,task,QUESTION)))
    assert len(planner.calls)==2 and len(reader.audit['rejectedPlans'])==2
    assert 'QueryExpansion' not in reader.audit.get('plans',{})
    assert (task.model_dump(),bad.model_dump(),good.model_dump())==before


def test_expand_task_preserves_original_task_and_current_owner_without_outer_retry():
    task,bad=captured();_,good=controlled();before=task.model_dump()
    planner=FeedbackPlanner(bad,good);reader,_=runner(task,planner)
    answer=asyncio.run(reader.expand_task(task,{},None))
    assert answer.model_dump()==before and len(planner.calls)==2
    context=reader.knowledge.intent_lexical_context
    assert context['task']==before and context['principalScopeRef']=='controlled-current-owner'
    assert context['terms']==[t.model_dump() for t in good.terms]
    assert all(c['schema']['properties']['stage']['const']=='query_expansion' for c in planner.calls)


@pytest.mark.parametrize('field,missing',[('english','قيد الإنجاز'),('arabic','in progress')])
def test_language_missing_templates_coordinate_both_constraints(field,missing):
    task,plan=controlled();setattr(term(plan,'view'),field,missing)
    with pytest.raises(PipelineError,match='expansion_'+field+'_missing') as error:
        validate_expansion(plan,task,QUESTION)
    d=error.value.details
    assert d['path']==['terms',5,field]
    assert 'at least one main view field' in d['correction']
    assert 'WHOLE unchanged canonical population phrase' in d['correction']
    assert 'Without that duplicate-label relationship' in d['correction']
    assert set(d)=={'stage','termIndex','requirementId','requirementKind','field','path','correction'}


def test_arabic_canonical_phrase_locates_arabic_field_and_preserves_english_label_anchor():
    task,plan=captured();task.businessFocus='قيد الإنجاز';task.view='Review Queue'
    pop=term(plan,'population');pop.sourceText=pop.arabic=task.businessFocus;pop.english='Review Queue';pop.alternatives=[]
    view=term(plan,'view');view.sourceText=task.view;view.english='view "Review Queue"';view.arabic='عرض "Review Queue"';view.alternatives=[]
    question='Show my requests in view "Review Queue".'
    with pytest.raises(PipelineError,match='expansion_named_view_phrase_changed') as error:
        validate_expansion(plan,task,question)
    d=error.value.details
    assert d['fields']==['arabic'] and d['paths']==[['terms',5,'arabic']]
    assert d['populationPaths']==[['terms',3,'arabic']] and 'english' in d['originalLabelAnchoredFields']
    before=task.model_dump();old=plan.model_dump()
    view.arabic='عرض "قيد الإنجاز"'  # Controlled new reply; no alias/runtime authorization.
    validate_expansion(plan,task,question)
    old['terms'][5]['arabic']=view.arabic
    assert plan.model_dump()==old and task.model_dump()==before


def test_no_duplicate_label_does_not_force_unrelated_population_into_view():
    task,plan=captured();task.businessFocus='eligible applications'
    pop=term(plan,'population');pop.sourceText=pop.english=task.businessFocus;pop.arabic='طلبات مؤهلة';pop.alternatives=[]
    before=deepcopy((task.model_dump(),plan.model_dump()))
    validate_expansion(plan,task,QUESTION)
    assert (task.model_dump(),plan.model_dump())==before


@pytest.mark.parametrize('english',['view "progress"','view "urgent in progress"','view in progress','in progress view'])
def test_shortened_or_unquoted_canonical_wrapper_is_still_rejected(english):
    task,plan=controlled();term(plan,'view').english=english
    with pytest.raises(PipelineError,match='expansion_named_view_phrase_changed'):
        validate_expansion(plan,task,QUESTION)


@pytest.mark.parametrize('arabic',['عرض "قيد التنفيذ"','عرض "قيد الإنجاز عاجل"','عرض "الإنجاز قيد"'])
def test_changed_last_original_anchor_still_rejected_even_when_alternative_has_original(arabic):
    task,plan=controlled();term(plan,'view').arabic=arabic;term(plan,'view').alternatives=['قيد الإنجاز']
    with pytest.raises(PipelineError,match='expansion_named_view_label_changed'):
        validate_expansion(plan,task,QUESTION)


def test_genuinely_missing_conditions_still_take_original_needs_revision_quote_path():
    task,_=captured();question=QUESTION+' Only urgent requests for another account after 2026-09-01.'
    plan=QueryExpansion(stage='query_expansion',intentStatus='needs_revision',terms=[],issues=[{
        'quote':'Only urgent requests for another account after 2026-09-01.', 'reason':'Original independent requirements missing.'}])
    before=task.model_dump();validate_expansion(plan,task,question)
    assert task.model_dump()==before and plan.terms==[] and plan.intentStatus=='needs_revision'
    plan.issues[0].quote='unbound invented clause'
    with pytest.raises(PipelineError,match='intent_review_quote_invalid'):validate_expansion(plan,task,question)


def test_original_record_date_status_filter_and_other_terms_remain_required():
    from test_generic_reader_v3 import expansion_fixture
    task,plan=controlled();task.filters=['status Approved','owner another account'];task.recordIdentity='APP-707'
    task.timeField='assignment date';task.timeRange='after 2026-09-01';task.requestedAttributes=['urgency']
    raw=expansion_fixture({'requirements':requirements_for(task)})
    old={t.requirementId:t.model_dump() for t in plan.terms}
    raw['terms']=[old.get(t['requirementId'],t) for t in raw['terms']]
    for t in raw['terms']:
        if t['sourceText']==task.timeRange:t.update(english=task.timeRange,arabic='بعد 2026-09-01',alternatives=[])
    expanded=QueryExpansion.model_validate(raw);question=QUESTION+' with status Approved for APP-707 after 2026-09-01 assigned to another account, include urgency.'
    before=deepcopy((task.model_dump(),expanded.model_dump()));validate_expansion(expanded,task,question)
    assert (task.model_dump(),expanded.model_dump())==before
    for req in requirements_for(task):
        if req['id'] in old:continue
        missing=expanded.model_copy(deep=True);missing.terms=[t for t in missing.terms if t.requirementId!=req['id']]
        with pytest.raises(PipelineError,match='expansion_requirement_coverage_invalid'):validate_expansion(missing,task,question)


def test_external_cancellation_still_propagates():
    task,bad=captured();_,good=controlled();planner=FeedbackPlanner(bad,good);reader,data=runner(task,planner)
    async def cancelled(**kwargs):planner.calls.append(kwargs);raise asyncio.CancelledError()
    planner.generic_reader_json=cancelled
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(reader.structured(QueryExpansion,PROMPT,data,lambda p:validate_expansion(p,task,QUESTION)))
    assert len(planner.calls)==1


def test_prompt_coordinates_qe_main_fields_without_overriding_original_normalization_contract():
    assert 'Satisfy both main view fields jointly' in PROMPT
    assert 'does not\nrequire BOTH main view fields' in PROMPT
    assert 'Without that duplicate-label relationship' in PROMPT
    assert 'independent status, date, filter, ownership condition' in PROMPT
