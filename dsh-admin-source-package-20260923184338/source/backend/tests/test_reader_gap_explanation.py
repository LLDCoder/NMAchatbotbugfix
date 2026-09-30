"""Actual round27 inputs; generated answers/reviews are controlled offline mocks."""
import asyncio
from copy import deepcopy
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError, render_generic_answer
from app.generic_reader_contracts import TaskSpec, RoutingDecision
from app.reader_routing import task_fingerprint, validate_decision
from app.reader_requirements import requirements_for
from app.reader_answers import KnowledgeAnswerDraft, KnowledgeAnswerReview
import app.reader_gap_explanation as gap
from app.principal import Principal
import test_reader_role_permissions as identity_fixture

FIXTURE = json.loads((Path(__file__).parent/'fixtures/d04_round27_gap.json').read_text())
TEXT = {
 'en': 'I cannot provide a reliable number for next month’s incoming applications, complaints or inspections from the available evidence. The documented historical trend counts completed tasks, not arrivals. A precise arrivals forecast needs a matching historical arrivals series, an explicit method and assumptions, validation and uncertainty; a historical count must not be relabeled as a prediction.',
 'ar': 'لا يمكنني تقديم عدد موثوق للطلبات والشكاوى والتفتيشات الواردة الشهر القادم من الأدلة المتاحة. فالاتجاه التاريخي الموثق يحصي المهام المكتملة، لا الوارد الجديد. ويتطلب التوقع الدقيق سلسلة تاريخية مطابقة للوارد وطريقة وافتراضات معلنة والتحقق وعدم اليقين؛ ولا يجوز إعادة تسمية عدد تاريخي بأنه توقع.'}


def knowledge_for(case):
    store = KnowledgeStore()
    for entry in FIXTURE['records']:
        store.add_local([{'id':entry['path'], 'source_type':'local_page_knowledge',
            'source_name':entry['path'], 'content':json.dumps({'packageStatus':'active',
                'records':[entry['record']]}, ensure_ascii=False)}])
    for candidate in case['candidates']:
        store.add({'chunks':[{'id':'catalog:'+candidate['candidateId'],
            'source_name':'page-catalog#'+candidate['pageId'],
            'content':json.dumps({k:candidate[k] for k in ('pageId','route','name','description','parameters','fields')},ensure_ascii=False)}]})
    store.prompt()
    return store


class Planner:
    def __init__(self, language='en', mode='supported'):
        self.language=language;self.mode=mode;self.calls=[]
    async def generic_reader_json(self, *, schema, data, **kwargs):
        stage=schema['properties']['stage']['const'];self.calls.append((stage,deepcopy(data)))
        if self.mode=='cancel': raise asyncio.CancelledError()
        if self.mode=='timeout' or (self.mode=='review_timeout' and stage=='knowledge_answer_review'):
            raise asyncio.TimeoutError()
        if self.mode=='invalid': return {'stage':stage,'blocks':[]}
        if stage=='knowledge_answer_draft':
            idx=next(q['quoteIndex'] for q in data['finalQuotes'] if q['sourceId']=='k_edf65656488d01a27eae:p3')
            text=TEXT[self.language]
            if self.mode=='number':text='You will receive exactly 500 applications next month.'
            if self.mode=='actor':text='Your current user role permits forecasting because the assistant can explain reports.'
            block={'id':'limits','text':text,'requirementIds':[r['id'] for r in data['requirements']], 'quoteIndexes':[idx]}
            if self.mode=='bad_citation':block['quoteIndexes']=[999]
            return {'stage':stage,'blocks':[block]}
        assert stage=='knowledge_answer_review'
        bad=self.mode in {'number','actor','unsupported','record_fact'}
        return {'stage':stage, 'checks':[{'requirementId':r['id'],'status':'covered',
            'quoteIndexes':r['answerQuoteIndexes'],'reason':'Controlled review; attempted upgrade must be clamped.'}
            for r in data['requirementAnswers']], 'blockChecks':[{'blockId':b['id'],
            'supported':not bad, 'languageMatches':self.mode!='wrong_language','customerFacing':True,
            'reason':'Controlled independent review.', 'containsUnverifiedRecordFacts':self.mode=='record_fact',
            'unsupportedClaims':['The claim is not supported by the cited rules.'] if bad else []}
            for b in data['answerBlocks']]}


def setup(language='en', mode='supported'):
    case=deepcopy(FIXTURE['cases'][language]);planner=Planner(language,mode)
    reader=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid')
    reader.current_question=case['question'];reader.canonical_question=case['question']
    reader.response_language=language;reader.deadline=time.monotonic()+300
    reader.intent_state=deepcopy(case['intentState']);reader.knowledge=knowledge_for(case)
    reader.current_observation_owner={'principalScopeRef':reader.intent_state['principalFingerprint']}
    reader.audit['routingDecision']=deepcopy(case['routing']);reader.active_quality_stage='page_routing'
    task=TaskSpec.model_validate(case['task']);routing=RoutingDecision.model_validate(case['routing'])
    recalled={c['candidateId']:c for c in case['candidates']}
    return reader,task,routing,recalled,planner


def outcome(reader,task,routing,recalled,authorized=lambda _:True):
    reader.supplemental_explanation=asyncio.run(gap.explain_gap(reader,task,routing,recalled,authorized))
    return reader.finish(task=task,error=PipelineError(routing.missing[0],'knowledge_gap',
        {'routingMissing':list(routing.missing),'stage':'RoutingDecision'})).result.payload


@pytest.mark.parametrize('language',['en','ar'])
def test_actual_routing_passages_are_reconstructed_and_hash_match(language):
    reader,task,routing,recalled,_=setup(language)
    validate_decision(routing,task,list(recalled.values()),reader.knowledge)
    manifests={p['sourceId']:p for d in FIXTURE['cases'][language]['inputManifest'] for p in d['passages']}
    refs={r.sourceId for c in routing.candidates for r in c.evidence}
    refs.update(r.sourceId for c in routing.candidates for cond in c.conditions for r in cond.evidence)
    for sid in refs:
        text=reader.knowledge.passages[sid][1]
        assert hashlib.sha256(text.encode()).hexdigest()==manifests[sid]['sha256']
    quotes=gap.cited_rule_quotes(reader,routing,recalled,lambda _:True)
    assert quotes and all(q['recordId'] for q in quotes)
    assert all(not q['source'].startswith('page-catalog#') for q in quotes)


@pytest.mark.parametrize('language',['en','ar'])
def test_recorded_gap_gets_supported_explanation_without_task_completion(language):
    reader,task,routing,recalled,planner=setup(language)
    before=task.model_dump();payload=outcome(reader,task,routing,recalled)
    assert task.model_dump()==before
    assert payload['result']=='not_confirmed' and not payload['requirementsSatisfied']
    assert payload['analysisStatus']=='unconfirmed'
    assert payload['missing']==['forecast_model','historical_arrivals_series']
    assert payload['requirements']==requirements_for(task)
    assert all(c['status']=='unfulfilled' for c in payload['requirementCoverage'])
    assert payload['outputs']==payload['knowledgeAnswer']==payload['knowledgeQuotes']==[]
    assert not payload.get('queryReceipt')
    supplement=payload['supplementalExplanation']
    assert all(c['status']=='not_yet_verified' for c in supplement['requirementChecks'])
    assert len(planner.calls)==2
    assert TEXT[language] in render_generic_answer(payload,language)
    assert reader.active_quality_stage=='page_routing'
    assert reader.knowledge_requirement_coverage==[]


@pytest.mark.parametrize('mode',['invalid','bad_citation','timeout','review_timeout','unsupported','wrong_language','number','actor','record_fact'])
def test_invalid_or_unreviewed_claims_keep_original_gap_and_no_draft(mode):
    reader,task,routing,recalled,planner=setup(mode=mode);payload=outcome(reader,task,routing,recalled)
    assert payload['missing']==routing.missing and payload['result']=='not_confirmed'
    assert not payload.get('supplementalExplanation')
    assert render_generic_answer(payload)==FIXTURE['cases']['en']['answer']
    assert len(planner.calls)<=2
    if mode in {'invalid','bad_citation','timeout'}:assert len(planner.calls)==1


def test_user_cancellation_propagates_without_an_answer():
    reader,task,routing,recalled,_=setup(mode='cancel')
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(gap.explain_gap(reader,task,routing,recalled,lambda _:True))
    assert reader.active_quality_stage=='page_routing'


@pytest.mark.parametrize('decision',['route','probe','clarify','permission_denied','runtime_error','unsupported_operation'])
def test_only_actual_knowledge_gap_can_attempt_explanation(decision):
    reader,task,routing,recalled,planner=setup();routing.decision=decision
    reader.audit['routingDecision']=routing.model_dump()
    assert asyncio.run(gap.explain_gap(reader,task,routing,recalled,lambda _:True)) is None
    assert not planner.calls


@pytest.mark.parametrize('change',['readOnly','responseMode','needsLiveData','fingerprint','request_actor','principal_actor','audit_not_validated','route_plan'])
def test_original_task_owner_and_validated_routing_cannot_be_substituted(change):
    reader,task,routing,recalled,planner=setup()
    if change=='readOnly':task.readOnly=False
    elif change=='responseMode':task.responseMode='draft'
    elif change=='needsLiveData':task.needsLiveData=False
    elif change=='fingerprint':routing.taskFingerprint='other'
    elif change=='request_actor':reader.intent_state['requestId']=''
    elif change=='principal_actor':reader.current_observation_owner['principalScopeRef']='other'
    elif change=='audit_not_validated':reader.audit.pop('routingDecision')
    else:routing.routePlan=[object()]
    assert asyncio.run(gap.explain_gap(reader,task,routing,recalled,lambda _:True)) is None
    assert not planner.calls


@pytest.mark.parametrize('change',['unknown_ref','tampered_passage','inactive','conflict','mismatched','not_applicable','catalog_only','unauthorized','quote_budget'])
def test_unusable_evidence_does_not_turn_reason_into_fact(change,monkeypatch):
    reader,task,routing,recalled,planner=setup();allow=lambda _:True
    if change=='unknown_ref':
        routing.candidates[0].evidence[0].sourceId='unknown';reader.audit['routingDecision']=routing.model_dump()
    elif change=='tampered_passage':
        key,_=reader.knowledge.passages['k_edf65656488d01a27eae:p3'];reader.knowledge.passages['k_edf65656488d01a27eae:p3']=(key,'Invented forecast of 500')
    elif change=='unauthorized':allow=lambda _:False
    elif change=='quote_budget':monkeypatch.setattr(gap,'MAX_CHARACTERS',1)
    else:
        for item in reader.knowledge.items.values():
            rec=item.get('record')
            if not rec:continue
            if change=='inactive':rec['status']='retired'
            elif change=='conflict':reader.knowledge.conflicted.add(rec['id'])
            elif change=='mismatched':rec['applicability']['deployedBuildMatch']='mismatched'
            elif change=='not_applicable':rec['applicability']['pageRefs']=['/unrelated']
            elif change=='catalog_only':item['record']=None
    receipt=asyncio.run(gap.explain_gap(reader,task,routing,recalled,allow))
    assert receipt is None and not planner.calls


@pytest.mark.parametrize('change',['principal','request','task','missing','language','text','record_changed','passage_changed'])
def test_receipt_cannot_cross_request_or_changed_evidence(change):
    reader,task,routing,recalled,_=setup()
    reader.supplemental_explanation=asyncio.run(gap.explain_gap(reader,task,routing,recalled,lambda _:True))
    assert reader.supplemental_explanation
    if change=='principal':reader.current_observation_owner['principalScopeRef']='other'
    elif change=='request':reader.intent_state['requestId']='other'
    elif change=='task':task.timeRange='last month'
    elif change=='missing':routing.missing.append('another_gap')
    elif change=='language':reader.response_language='ar'
    elif change=='text':reader.supplemental_explanation['blocks'][0]['text']='500'
    elif change=='record_changed':reader.knowledge.items['k_edf65656488d01a27eae']['record']['status']='retired'
    else:reader.knowledge.passages['k_edf65656488d01a27eae:p3']=('k_edf65656488d01a27eae','changed')
    payload=reader.finish(task=task,error=PipelineError(routing.missing[0],'knowledge_gap',{'routingMissing':routing.missing})).result.payload
    assert not payload.get('supplementalExplanation')


def test_no_model_call_without_review_reserve():
    reader,task,routing,recalled,planner=setup();reader.deadline=time.monotonic()+11
    assert asyncio.run(gap.explain_gap(reader,task,routing,recalled,lambda _:True)) is None
    assert not planner.calls


def test_optional_calls_only_tighten_caps_and_do_not_change_deadline():
    reader,task,routing,recalled,planner=setup();deadline=reader.deadline; caps=[];original=reader.structured
    async def spy(*args,**kwargs):
        caps.append((kwargs['attempt_cap'],kwargs['time_cap']))
        return await original(*args,**kwargs)
    reader.structured=spy
    assert asyncio.run(gap.explain_gap(reader,task,routing,recalled,lambda _:True))
    assert len(caps)==2 and all(n==1 and 0<t<=15 for n,t in caps)
    assert sum(t for _,t in caps)<=30 and reader.deadline==deadline


class ContractPlanner:
    def __init__(self):self.calls=0
    async def generic_reader_json(self,**kwargs):self.calls+=1;return {'stage':'knowledge_answer_draft','blocks':[]}


@pytest.mark.parametrize('cap,expected',[(None,2),(1,1),(100,2)])
def test_attempt_cap_never_expands_default_correction_budget(cap,expected):
    planner=ContractPlanner();reader=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid');reader.deadline=time.monotonic()+30
    with pytest.raises(PipelineError):asyncio.run(reader.structured(KnowledgeAnswerDraft,'test',{},attempt_cap=cap))
    assert planner.calls==expected


@pytest.mark.parametrize('cap',[False,0,-1,1.5])
def test_invalid_attempt_caps_never_invoke_planner(cap):
    planner=ContractPlanner();reader=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid')
    with pytest.raises(ValueError):asyncio.run(reader.structured(KnowledgeAnswerDraft,'test',{},attempt_cap=cap))
    assert planner.calls==0


@pytest.mark.parametrize('cap',[False,0,-1,float('nan'),float('inf'),'5'])
def test_invalid_time_caps_never_invoke_planner(cap):
    planner=ContractPlanner();reader=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid')
    with pytest.raises(ValueError):asyncio.run(reader.structured(KnowledgeAnswerDraft,'test',{},time_cap=cap))
    assert planner.calls==0


class ReplayPlanner(Planner):
    async def generic_reader_json(self, *, schema, data, **kwargs):
        stage=schema['properties']['stage']['const'];case=FIXTURE['cases'][self.language]
        if stage=='task':return deepcopy(case['task'])
        if stage=='catalog_access_check':return deepcopy(case['plans']['CatalogAccessCheck'])
        if stage=='input_normalization':
            return {'stage':stage,'clauses':[{'sourceQuote':case['question'],
                'english':'Predict how many applications, complaints and inspections we will receive next month.'}]}
        return await super().generic_reader_json(schema=schema,data=data,**kwargs)


class ReplayReader(GenericKnowledgeReader):
    """Replay the already recorded routing frontier; no fresh business reads."""
    async def expand_task(self,task,history,choice):
        from app.reader_expansion import QueryExpansion
        self.expansion=QueryExpansion.model_validate(FIXTURE['cases'][self.fixture_language]['plans']['QueryExpansion'])
        self.expansion_task=task
        return task
    async def search(self,*args,**kwargs):
        self.fixture_searches+=1
    async def route_task(self,principal,task,question,catalog,current_page):
        case=FIXTURE['cases'][self.fixture_language]
        self.knowledge=knowledge_for(case)
        routing=RoutingDecision.model_validate(case['routing'])
        recalled={c['candidateId']:c for c in case['candidates']}
        # Real validation runs again; copied model success flags are not enough.
        validate_decision(routing,task,list(recalled.values()),self.knowledge)
        self.audit['routingDecision']=routing.model_dump()
        return routing,recalled


def run_frontier(tmp_path,language):
    case=FIXTURE['cases'][language]
    (tmp_path/'page-catalog.json').write_text(json.dumps([{'name':c['name'],'graphId':c['pageId'],
        'routes':[{'path':c['route']}]} for c in case['candidates']]))
    gateway=identity_fixture.OfflineGateway(identity_fixture.TRACE['auth']);planner=ReplayPlanner(language)
    reader=ReplayReader(gateway,planner,portal_base_url='https://offline.invalid',artifacts_dir=str(tmp_path))
    reader.fixture_language=language;reader.fixture_searches=0
    result=asyncio.run(reader.run(Principal(identity_fixture.USER,'offline-tenant','controlled-request'),
        case['question'],conversation_context={'responseLanguage':language}))
    return result.result.payload,result.audit_evidence,reader,gateway,planner


@pytest.mark.parametrize('language',['en','ar'])
def test_replayed_routing_frontier_uses_real_failure_branch_and_preserves_all_missing(tmp_path,language):
    payload,audit,reader,gateway,planner=run_frontier(tmp_path,language)
    assert payload['missing']==['forecast_model','historical_arrivals_series'],(payload['missing'],audit.get('rejectedPlans'))
    assert payload['supplementalExplanation']
    assert payload['requirements']==requirements_for(TaskSpec.model_validate(FIXTURE['cases'][language]['task']))
    assert TEXT[language] in render_generic_answer(payload,language)
    assert payload['result']=='not_confirmed' and payload['requirementsSatisfied'] is False
    assert gateway.events==['identity'] and reader.fixture_searches==1
    assert len(planner.calls)==2


def test_review_reserve_exhausted_after_draft_discards_it_without_second_call():
    reader,task,routing,recalled,planner=setup();original=reader.structured
    async def exhaust(*args,**kwargs):
        value=await original(*args,**kwargs)
        reader.deadline=time.monotonic()+1
        return value
    reader.structured=exhaust
    payload=outcome(reader,task,routing,recalled)
    assert not payload.get('supplementalExplanation') and len(planner.calls)==1
    assert reader.audit['supplementalExplanationAttempt']['reason']=='optional_review_budget_unavailable'


@pytest.mark.parametrize('cap,expected',[(None,60),(5,5),(10000,60)])
def test_time_cap_never_expands_existing_stage_budget(cap,expected):
    reader,_,_,_,_=setup();seen=[]
    async def fake_call(stage,awaitable,effective):
        seen.append(effective);awaitable.close()
        raise PipelineError('controlled_stop','runtime')
    reader.call=fake_call
    with pytest.raises(PipelineError):asyncio.run(reader.structured(KnowledgeAnswerDraft,'test',{},time_cap=cap))
    assert seen==[min(reader.budget.planner_seconds,expected)]


@pytest.mark.parametrize('change',['text','missing','task','language','actor','result','permission'])
def test_render_does_not_display_a_transplanted_or_mutated_receipt(change):
    reader,task,routing,recalled,_=setup();payload=outcome(reader,task,routing,recalled)
    if change=='text':payload['supplementalExplanation']['blocks'][0]['text']='500'
    elif change=='missing':payload['missing']=[]
    elif change=='task':payload['taskFingerprint']='other'
    elif change=='language':payload['supplementalExplanation']['responseLanguage']='ar'
    elif change=='actor':payload['intentState']['principalFingerprint']='other'
    elif change=='result':payload['result']='success'
    else:payload['failureCategory']='permission'
    assert gap.explanation_blocks(payload,'en')==[]


def test_diagnostic_citations_are_kept_without_source_metadata_in_normal_prose():
    reader,task,routing,recalled,_=setup();payload=outcome(reader,task,routing,recalled)
    normal=render_generic_answer(payload)
    diagnostic=render_generic_answer(payload,include_diagnostics=True)
    assert payload['supplementalExplanation']['quotes'][0]['source'] not in normal
    assert payload['supplementalExplanation']['quotes'][0]['source'] in diagnostic
