"""Real routing failures; local probes do not certify citation semantics."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import pytest
from app.generic_reader import KnowledgeStore, PipelineError, GenericKnowledgeReader
from app.generic_reader_contracts import Citation, CandidateCondition, RoutingDecision, TaskSpec
from app.reader_routing import bind_citation_schema, _cite_at, validate_decision, task_fingerprint
from test_reader_routing_v03 import knowledge
from test_reader_role_permission_subject import SequencePlanner

TRACE=json.loads((Path(__file__).parent/'fixtures/d04_round28_routing_citations.json').read_text())


def schema_ids(schema):return schema['$defs']['Citation']['properties']['sourceId'].get('enum',[])


def test_visible_current_store_text_and_metadata_define_call_schema_without_mutation():
    k=knowledge(); docs=k.prompt(); shared=RoutingDecision.model_json_schema(); before=deepcopy(shared)
    out=bind_citation_schema(shared,docs,k)
    expected=sorted(p['sourceId'] for d in docs for p in d['passages'])
    assert schema_ids(out)==expected and shared==before
    assert 'evidence' in out['$defs']['CandidateCondition']['required']
    assert 'minItems' not in out['$defs']['CandidateCondition']['properties']['evidence']
    out['$defs']['Citation']['properties']['sourceId']['enum'].clear()
    assert schema_ids(bind_citation_schema(shared,docs,k))==expected


@pytest.mark.parametrize('key',['sourceName','revision','verification','recordId','documentId','documentVersion','chunkId'])
def test_metadata_mismatch_cannot_offer_a_stale_handle(key):
    k=knowledge();docs=k.prompt(); docs[0][key]='mismatched-version'
    assert schema_ids(bind_citation_schema(RoutingDecision.model_json_schema(),docs,k))==[]


def test_hidden_deleted_and_changed_passages_never_enter_enum():
    k=knowledge();docs=k.prompt(); original=deepcopy(docs)
    shown=deepcopy(docs); shown[0]['passages']=shown[0]['passages'][:1]
    assert schema_ids(bind_citation_schema(RoutingDecision.model_json_schema(),shown,k))==[shown[0]['passages'][0]['sourceId']]
    shown[0]['passages'][0]['text']='different source text'
    assert not schema_ids(bind_citation_schema(RoutingDecision.model_json_schema(),shown,k))
    key=k.passages[original[0]['passages'][0]['sourceId']][0];del k.items[key]
    assert not schema_ids(bind_citation_schema(RoutingDecision.model_json_schema(),original,k))


def test_nonactive_content_is_not_advertised():
    k=knowledge();docs=k.prompt();p=docs[0]['passages'][0]; key=k.passages[p['sourceId']][0]
    p['text']='{"status":"retired"}';k.passages[p['sourceId']]=(key,p['text']);k.items[key]['text']=p['text']
    docs[0]['passages']=[p]
    assert not schema_ids(bind_citation_schema(RoutingDecision.model_json_schema(),docs,k))


class MembershipOnlyStore:
    """Isolates recorded handle/required-evidence failures, not source support."""
    def __init__(self,ids,routes=()):self.ids=set(ids);self.routes=routes
    def cite(self,refs,*,required=False,at='citation'):
        if required and not refs:raise PipelineError('knowledge_citation_missing',details={'field':at})
        for ref in refs:
            if ref.sourceId not in self.ids:raise PipelineError('knowledge_citation_invalid',details={'field':at,'sourceId':ref.sourceId})
        return [{'text':' '.join(self.routes)} for ref in refs]
    def source(self,ref):return {'text':' '.join(self.routes)} if ref.sourceId in self.ids else None


@pytest.mark.parametrize('attempt',[0,2])
def test_all_actual_missing_conditions_receive_exact_location_unknown_stays_legal(attempt):
    raw=TRACE['actualTurns'][0]['rejectedRouting'][attempt]['candidate'];before=deepcopy(raw)
    k=MembershipOnlyStore(TRACE['findings']['visibleSourceIds']); missing=unknown=0
    for i,c in enumerate(raw['candidates']):
        for n,row in enumerate(c['conditions']):
            condition=CandidateCondition.model_validate(row);path=f'/candidates/{i}/conditions/{n}/evidence'
            if condition.status!='unknown' and not condition.evidence:
                with pytest.raises(PipelineError) as e:_cite_at(k,condition.evidence,required=True,at='routing.condition',path=path,candidate_id=c['candidateId'],condition=condition)
                assert e.value.code=='knowledge_citation_missing' and e.value.details['path']==path
                assert e.value.details['requirementId']==row['requirementId'] and e.value.details['status']==row['status']; missing+=1
            else:
                _cite_at(k,condition.evidence,required=condition.status!='unknown',at='routing.condition',path=path,candidate_id=c['candidateId'],condition=condition)
                unknown+=not condition.evidence
    assert (missing,unknown)==(5,25) and raw==before


def test_all_actual_typoes_remain_invalid_with_precise_evidence_index():
    raw=TRACE['actualTurns'][0]['rejectedRouting'][1]['candidate'];before=deepcopy(raw);k=MembershipOnlyStore(TRACE['findings']['visibleSourceIds']);count=0
    for i,c in enumerate(raw['candidates']):
        entries=[(c['evidence'],f'/candidates/{i}/evidence',None)]
        entries += [(row.get('evidence',[]),f'/candidates/{i}/conditions/{n}/evidence',CandidateCondition.model_validate(row)) for n,row in enumerate(c['conditions'])]
        for refs,path,condition in entries:
            refs=[Citation.model_validate(ref) for ref in refs]
            for index,ref in enumerate(refs):
                if ref.sourceId not in k.ids:
                    with pytest.raises(PipelineError) as e:_cite_at(k,refs,required=True,at='routing.condition' if condition else 'routing.candidate',path=path,candidate_id=c['candidateId'],condition=condition)
                    assert e.value.code=='knowledge_citation_invalid' and e.value.details['path']==path+f'/{index}/sourceId';count+=1
    assert count==5 and raw==before


def test_candidate_citation_does_not_fill_empty_supported_condition():
    k=knowledge();ref=Citation(sourceId=k.prompt()[0]['passages'][0]['sourceId']);_cite_at(k,[ref],required=True,at='routing.candidate',path='/candidates/0/evidence',candidate_id='known')
    c=CandidateCondition(requirementId='object',status='supported',reason='controlled',evidence=[])
    with pytest.raises(PipelineError,match='knowledge_citation_missing'):_cite_at(k,[],required=True,at='routing.condition',path='/candidates/0/conditions/0/evidence',candidate_id='known',condition=c)


def test_actual_ar_handles_and_gaps_are_not_relabelled():
    row=TRACE['actualTurns'][1];raw=deepcopy(row['routingDecision']);task=TaskSpec.model_validate(row['task']);raw['taskFingerprint']=task_fingerprint(task)
    ids=[v['sourceId'] for c in raw['candidates'] for v in c['evidence']]+[v['sourceId'] for c in raw['candidates'] for x in c['conditions'] for v in x.get('evidence',[])]
    candidates=row['candidateRecall']['candidates'];k=MembershipOnlyStore(ids,[x['route'] for x in candidates]);plan=RoutingDecision.model_validate(raw);before=plan.model_dump()
    validate_decision(plan,task,candidates,k)
    assert plan.model_dump()==before and raw['missing']==['forecast_method','historical_arrivals_series']


def test_runtime_calls_original_cite_and_preserves_failure_category():
    class ErrorStore:
        def cite(self,*a,**k):raise PipelineError('knowledge_not_active','knowledge_gap')
    with pytest.raises(PipelineError) as e:_cite_at(ErrorStore(),[],required=True,at='routing.candidate',path='/candidates/0/evidence',candidate_id='known')
    assert e.value.code=='knowledge_not_active' and e.value.details=={}


def test_structured_schema_is_isolated_and_repeated_failure_still_stops_at_two_calls(monkeypatch):
    k=knowledge();docs=k.prompt();shared=RoutingDecision.model_json_schema();before=deepcopy(shared)
    monkeypatch.setattr(RoutingDecision,'model_json_schema',classmethod(lambda cls:shared))
    raw={'stage':'routing_decision','taskFingerprint':'same','decision':'knowledge_gap','candidates':[],'routePlan':[],'missing':['unresolved_original'],'reason':'controlled'}
    class Planner:
        def __init__(self):self.calls=[]
        async def generic_reader_json(self,**kwargs):
            self.calls.append(deepcopy(kwargs));return deepcopy(raw)
    planner=Planner();reader=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid');reader.knowledge=k
    async def call(stage,awaitable,cap):return await awaitable
    reader.call=call
    def reject(plan):
        _cite_at(k,[],required=True,at='routing.condition',path='/candidates/1/conditions/3/evidence',candidate_id='known')
    with pytest.raises(PipelineError,match='knowledge_citation_missing'):asyncio.run(reader.structured(RoutingDecision,'Controlled schema and feedback check',{'knowledge':docs},reject))
    assert len(planner.calls)==2 and shared==before
    assert schema_ids(planner.calls[0]['schema'])
    correction=json.loads(planner.calls[1]['correction']);assert correction['path']=='/candidates/1/conditions/3/evidence'
    assert [x['candidate']['missing'] for x in reader.audit['rejectedPlans']]==[['unresolved_original'],['unresolved_original']]


@pytest.mark.parametrize('where',['candidate','condition'])
def test_visible_gate_rejects_library_valid_but_unshown_handle(where):
    from app.reader_routing import validate_visible_citations
    k=knowledge();docs=k.prompt();refs=[p['sourceId'] for d in docs for p in d['passages']];assert len(refs)>1
    k.cite([Citation(sourceId=refs[1])],required=True)  # Valid store reference is insufficient.
    raw={'stage':'routing_decision','taskFingerprint':'control','decision':'knowledge_gap',
         'candidates':[{'candidateId':'controlled','reason':'control','evidence':[{'sourceId':refs[0]}],
                        'conditions':[{'requirementId':'object','status':'unknown','reason':'control','evidence':[]}]}],
         'missing':['original_gap'],'reason':'controlled'}
    if where=='candidate':raw['candidates'][0]['evidence'][0]['sourceId']=refs[1]
    else:raw['candidates'][0]['conditions'][0]['evidence']=[{'sourceId':refs[1]}]
    decision=RoutingDecision.model_validate(raw);before=decision.model_dump()
    with pytest.raises(PipelineError) as e:validate_visible_citations(decision,[refs[0]])
    expected='/candidates/0/evidence/0/sourceId' if where=='candidate' else '/candidates/0/conditions/0/evidence/0/sourceId'
    assert e.value.details['path']==expected and e.value.details['visibleSourceCount']==1
    assert decision.model_dump()==before


@pytest.mark.parametrize('value',['k_deadbeef000000000000:p0','secret@example.test','<script>private</script>'])
def test_empty_visible_set_never_falls_back_to_library_or_echoes_model_value(value):
    from app.reader_routing import validate_visible_citations
    raw={'stage':'routing_decision','taskFingerprint':'control','decision':'knowledge_gap',
         'candidates':[{'candidateId':'unverified-model-text','reason':'control','evidence':[{'sourceId':value}],'conditions':[]}],
         'missing':['original_gap'],'reason':'controlled'}
    with pytest.raises(PipelineError) as e:validate_visible_citations(RoutingDecision.model_validate(raw),[])
    assert e.value.details['visibleSourceCount']==0 and value not in json.dumps(e.value.details)
    assert 'unverified-model-text' not in json.dumps(e.value.details)


def test_empty_visible_set_allows_honest_gap_without_citations():
    from app.reader_routing import validate_visible_citations
    plan=RoutingDecision(stage='routing_decision',taskFingerprint='control',decision='knowledge_gap',candidates=[],missing=['no_sources'],reason='controlled')
    before=plan.model_dump();validate_visible_citations(plan,[]);assert plan.model_dump()==before


def test_structured_enforces_actual_call_visible_set_before_original_validator():
    k=knowledge();docs=k.prompt();ids=[p['sourceId'] for d in docs for p in d['passages']];shown=deepcopy(docs);shown[0]['passages']=shown[0]['passages'][:1]
    calls=[];validated=[]
    raw={'stage':'routing_decision','taskFingerprint':'same','decision':'knowledge_gap','candidates':[{'candidateId':'control','reason':'control','conditions':[],'evidence':[{'sourceId':ids[1]}]}],'missing':['original_gap'],'reason':'controlled'}
    class Planner:
        async def generic_reader_json(self,**kw):calls.append(deepcopy(kw));return deepcopy(raw)
    engine=GenericKnowledgeReader(None,Planner(),portal_base_url='https://offline.invalid');engine.knowledge=k
    async def call(stage,awaitable,cap):return await awaitable
    engine.call=call
    with pytest.raises(PipelineError,match='knowledge_citation_invalid'):asyncio.run(engine.structured(RoutingDecision,'Control runtime enforcement',{'knowledge':shown},lambda plan:validated.append(plan)))
    assert len(calls)==2 and not validated
    assert json.loads(calls[1]['correction'])['field']=='routing.visible_input'
    assert all(x['candidate']['missing']==['original_gap'] for x in engine.audit['rejectedPlans'])
