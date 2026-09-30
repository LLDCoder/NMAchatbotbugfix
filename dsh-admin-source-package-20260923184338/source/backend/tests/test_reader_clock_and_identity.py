import asyncio
import copy
from types import SimpleNamespace

import httpx
import pytest

from app.generic_reader import PipelineError
from app.reader_derivations import compile_derivations, apply_derivations
from app.reader_collection import checked_collections, projection_hash
from app.platform import PlatformGatewayClient
from test_projected_collection import gateway, setup_rows, collect


def fixture():
    rows, captured, spec = setup_rows(3)
    for row in rows:
        row.update(due='2026-09-01T10:00:00', closed=None, phase='Active', node='review', clock=25.0)
    rows[1].update(closed='2026-09-01T10:30:00')
    rows[2].update(phase='Paused')
    spec.fields = ['specimenKey', 'clock']
    rule = {'field':'clock', 'operator':'elapsed_minutes', 'startField':'due', 'endField':'closed',
        'endNull':'reference_time', 'sourceTimezone':'Asia/Dubai', 'nullWhen':[{'field':'phase','equals':'Paused'}],
        'requiresNonNull':['node'], 'nullStartValue':None}
    record = {'id':'page-clock', 'revision':1, 'status':'active', 'applicability':{'pageRefs':['/specimens']},
        'payload':{'sourceBinding':{'operationRef':spec.operationKey,'sourcePath':spec.rowsPath},
            'fields':{f:f for f in rows[0]},'temporalDerivations':[rule]}}
    knowledge = SimpleNamespace(items={'k':{'documentId':'doc','record':record}})
    source = {'operationRef':spec.operationKey,'collectionContext':{'rowSchemas':gateway._collection_row_schemas({'data':{'items':rows}})}}
    return rows, captured, spec, knowledge, source, rule


def test_clock_uses_one_reference_and_preserves_pause_and_completed_time():
    rows, captured, spec, knowledge, source, _ = fixture()
    compiled = compile_derivations(knowledge, '/specimens', source, spec)
    assert 'clock' not in compiled['fields'] and {'due','closed','phase','node'} <= set(compiled['fields'])
    requested = spec.fields[:]; spec.fields = compiled['fields']
    receipt, _ = collect(rows, captured, spec, lambda p, params, n: p)
    receipt['startedAt'] = '2026-09-01T07:00:00+00:00'
    result = apply_derivations(checked_collections([receipt])[0], compiled)
    assert [r['clock'] for r in result['rows']] == [60, 30, None]
    assert result['fields'] == requested and result['projectionHash'] == projection_hash(result['rows'])
    assert result['derivation']['inputProjectionHash'] == receipt['projectionHash']
    assert checked_collections([result])[0]['completeness'] == 'complete'


def test_changing_due_date_still_fails_both_passes():
    rows, captured, spec, knowledge, source, _ = fixture()
    compiled = compile_derivations(knowledge, '/specimens', source, spec); spec.fields = compiled['fields']
    def change(p, params, n):
        p = copy.deepcopy(p)
        if n == 2: p['data']['items'][0]['due'] = '2026-09-02T10:00:00'
        return p
    receipt, _ = collect(rows, captured, spec, change)
    assert apply_derivations(receipt, compiled)['reason'] == 'collection_changed_between_passes'


def test_wrong_page_unobserved_input_and_conflicting_definitions_are_not_used():
    _, _, spec, kb, source, rule = fixture()
    assert not compile_derivations(kb, '/other', source, spec)['rules']
    rule['startField'] = 'invented'
    with pytest.raises(PipelineError, match='collection_derivation_inputs_unverified'):
        compile_derivations(kb, '/specimens', source, spec)
    rule['startField'] = 'due'
    second = copy.deepcopy(kb.items['k']); second['record']['payload']['temporalDerivations'][0]['sourceTimezone']='UTC'
    kb.items['other'] = second
    with pytest.raises(PipelineError, match='collection_derivation_conflict'):
        compile_derivations(kb, '/specimens', source, spec)


def test_unmapped_entity_keeps_unknown_clock_instead_of_using_other_rule():
    rows, captured, spec, kb, source, _ = fixture()
    compiled=compile_derivations(kb,'/specimens',source,spec); spec.fields=compiled['fields']
    rows[0]['node']=None
    receipt,_=collect(rows,captured,spec)
    result=apply_derivations(receipt,compiled)
    assert result['rows'][0]['clock'] is None
    assert result['fieldStatus']['clock']=='collection_derivation_unverified'


def test_complete_source_with_unknown_filter_values_reports_planning_provenance():
    from app.generic_reader import execute_analysis
    from app.generic_reader_contracts import Step
    from test_reader_requirement_coverage import fixture as analysis_fixture
    _, plan, sources, knowledge = analysis_fixture([
        {'specimenKey': 'a', 'phase': None, 'zone': 'Excluded'},
        {'specimenKey': 'b', 'phase': 'Warm', 'zone': 'Included'}])
    ref = plan.steps[0].evidence
    plan.steps.insert(1, Step(id='phase_filter', op='filter', inputs=['rows'], field='phase',
        predicate='ne', operand='Cold', unknownPolicy='report', expose=False, label='Filter', evidence=ref))
    next(s for s in plan.steps if s.id == 'entities').inputs = ['phase_filter']
    with pytest.raises(PipelineError, match='full_collection_required') as exc:
        execute_analysis(plan, sources, knowledge, [], task=None)
    assert exc.value.category == 'planning'
    assert exc.value.details['reason'] == 'aggregate_input_incomplete'
    assert exc.value.details['inputs'][0]['populationComplete'] is True
    assert exc.value.details['inputs'][0]['unknownRows'] == 1
    # A documented guard can remove that row before testing the nullable value;
    # diagnostics must not invite treating the missing value as false or zero.
    plan.steps.insert(1, Step(id='guard', op='filter', inputs=['rows'], field='zone',
        predicate='eq', operand='Included', expose=False, label='Guard', evidence=ref))
    next(s for s in plan.steps if s.id == 'phase_filter').inputs = ['guard']
    result = execute_analysis(plan, sources, knowledge, [], task=None)
    assert result['outputs'][0]['value'] == 1
    assert all(not x.get('unknownCount') for x in result['outputs'])


@pytest.mark.parametrize('status,recovered,calls_expected', [(503,True,2),(429,True,2),(401,False,1),(403,False,1),(422,False,1)])
def test_identity_retries_temporary_errors_but_never_denials(monkeypatch,status,recovered,calls_expected):
    calls=[]; original=httpx.AsyncClient
    def handle(request):
        calls.append(request)
        return httpx.Response(status if len(calls)==1 else 200,json={'id':'same-principal'},request=request)
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw: original(transport=httpx.MockTransport(handle),**kw))
    client=PlatformGatewayClient(SimpleNamespace(platform_gateway_url='http://gateway',platform_timeout_seconds=45,
        umc_user_info_endpoint='http://portal/api/AdminUser/GetUserInfo',umc_base_url='http://portal'))
    if recovered:
        assert asyncio.run(client.get_user_info(umc_token='synthetic',request_id='req'))['id']=='same-principal'
    else:
        with pytest.raises(httpx.HTTPStatusError): asyncio.run(client.get_user_info(umc_token='synthetic'))
    assert len(calls)==calls_expected and all(r.headers['Authorization']=='Bearer synthetic' for r in calls)


def test_gateway_transport_failure_recovers_with_same_principal(monkeypatch):
    calls=[]; original=httpx.AsyncClient
    def handle(request):
        calls.append(request)
        if len(calls)==1: raise httpx.RemoteProtocolError('synthetic disconnect')
        return httpx.Response(200,json={'id':'same-principal'},request=request)
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw: original(transport=httpx.MockTransport(handle),**kw))
    result=asyncio.run(gateway._umc_request('POST','/api/AdminUser/GetUserInfo',authorization='Bearer synthetic',identity_retry=True))
    assert result['id']=='same-principal' and len(calls)==2


def test_gateway_exhaustion_exposes_types_not_secret_payload(monkeypatch):
    calls=[]; original=httpx.AsyncClient
    def handle(request):
        calls.append(request); raise httpx.RemoteProtocolError('PRIVATE failure')
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw: original(transport=httpx.MockTransport(handle),**kw))
    with pytest.raises(gateway.HTTPException) as exc:
        asyncio.run(gateway._umc_request('POST','/api/AdminUser/GetUserInfo',authorization='Bearer synthetic',identity_retry=True))
    assert len(calls)==3 and exc.value.detail['attempts']==3
    assert 'PRIVATE' not in str(exc.value.detail)


def test_route_correlation_is_runtime_owned_but_stale_runtime_task_is_rejected():
    from unittest.mock import AsyncMock
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import TaskSpec, RoutingDecision
    from app.reader_routing import task_fingerprint
    task=TaskSpec(stage='task',businessObject='specimen',requestedScope='personal',requestedGrain='specimen',
        requestedMeasures=['count'],groupBy=[],timeRange='',filters=[],outputShape='count',needsLiveData=True,
        readOnly=True,searchQuery='specimen count',unresolvedSlots=[])
    reader=GenericKnowledgeReader(None,SimpleNamespace(generic_reader_json=AsyncMock(return_value={
        'stage':'routing_decision','taskFingerprint':'model-copy-error', 'decision':'knowledge_gap',
        'candidates':[],'routePlan':[],'missing':['page_semantics_missing'], 'reason':'No documented source.'})),portal_base_url='https://portal.test')
    async def call(stage, awaitable, cap):
        return await awaitable
    reader.call=call
    reader.secrets=[]
    result=asyncio.run(reader.structured(RoutingDecision,'Choose a route.',{
        'task':task.model_dump(),'taskFingerprint':task_fingerprint(task)}))
    assert result.taskFingerprint==task_fingerprint(task)
    assert reader.audit['routingInvocations'][0]['modelFingerprintDiffered'] is True
    with pytest.raises(PipelineError,match='routing_task_version_mismatch'):
        asyncio.run(reader.structured(RoutingDecision,'Choose a route.',{'task':task.model_dump(),'taskFingerprint':'stale'}))


def test_applied_filter_snapshot_is_retained_as_unverified_context():
    from app.reader_context import page_hint, ReaderPageContext
    from pydantic import ValidationError
    raw={'route':'/specimens','capturedAt':'2026-09-26T14:00:00Z',
         'filters':[{'name':'period','value':'last_month'},{'name':'accessToken','value':'PRIVATE'}]}
    hint=page_hint(raw,[{'routes':['/specimens'],'parameters':[]}],lambda _:True)
    assert hint['filters']==[{'name':'period','value':'last_month'}]
    assert hint['filtersVerified'] is False and hint['capturedAt']==raw['capturedAt']
    assert 'PRIVATE' not in str(hint)
    with pytest.raises(ValidationError): ReaderPageContext.model_validate({**raw,'capturedAt':'2026-09-26T14:00:00'})


def test_planner_projection_options_never_cross_an_array_boundary():
    from app.generic_reader import row_projection_options
    data={'data':{'key':'a','label':'PRIVATE_VALUE','departments':[{'id':'1','name':'PrivateName'}],
                  'roles':[{'id':'r','name':'PrivateRole'}],'address':{'secret':'PRIVATE'}}}
    options={o['path']:o for o in row_projection_options(data)}
    assert 'departments.name' not in options['/data']['scalarFields']
    assert options['/data/departments']['scalarFields']==['id','name']
    assert options['/data/roles']['scalarFields']==['id','name']
    assert 'PRIVATE' not in str(options) and 'PrivateName' not in str(options)


def test_heartbeat_preserves_event_order_and_cannot_claim_stage_success():
    from app.stream_transport import forward_events_with_heartbeat
    async def scenario():
        queue=asyncio.Queue();sent=[];delivered=asyncio.Event()
        async def send(payload):
            sent.append(payload)
            if payload['type']=='heartbeat':
                await queue.put({'seq':7,'eventType':'turn.completed','data':{'result':'not_confirmed'}})
            else: delivered.set()
        forwarder=asyncio.create_task(forward_events_with_heartbeat('own-conversation',queue,send,interval=0.005))
        await asyncio.wait_for(delivered.wait(),1)
        forwarder.cancel();await asyncio.gather(forwarder,return_exceptions=True)
        assert sent[:2]==[{'type':'heartbeat','conversationId':'own-conversation'},
                          {'type':'event','seq':7,'eventType':'turn.completed','data':{'result':'not_confirmed'}}]
    asyncio.run(scenario())


@pytest.mark.parametrize('paginated,complete',[(False,'complete'),(True,'bounded')])
def test_attested_child_array_completeness_is_independent_of_unrelated_redaction(paginated,complete):
    from test_reader_generic_completion import detail_fixture
    from test_platform_portal_reader import gateway
    from app.generic_reader import execute_analysis
    task,plan,sources,knowledge=detail_fixture()
    sid=next(iter(sources));source=sources[sid]
    # Keep the test's real source citation, but exercise a complete nested array.
    rows=[{'name':'Research'}]
    source.update(kind='api_response',data={'data':{'groups':rows}},truncated=True,completeness='bounded',
        fieldEvidence=gateway._reader_field_evidence({'data':{'groups':rows}}, {'data':{'groups':rows}}),
        collectionContext={'requestFields':['pageIndex','pageSize'] if paginated else []})
    read=next(s for s in plan.steps if s.op=='read_rows')
    read.path='/data/groups';read.fields=['name'];read.totalPath='';read.expose=True
    plan.steps=[read];plan.requirementBindings=[]
    result=execute_analysis(plan,sources,knowledge,[],task=None)
    assert result['outputs'][0]['evidence'][0]['completeness']==complete


def test_route_can_only_downgrade_to_a_fully_revalidated_probe():
    from unittest.mock import AsyncMock
    import time
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import RoutingDecision
    class Planner:
        generic_reader_json=AsyncMock(return_value={'stage':'routing_decision','taskFingerprint':'test',
            'decision':'route','candidates':[],'routePlan':[],'missing':[],'reason':'Synthetic fixture'})
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://portal.test')
    reader.deadline=time.monotonic()+10;reader.secrets=[];seen=[]
    def validator(plan):
        seen.append(plan.decision)
        if plan.decision=='route':raise PipelineError('routing_requires_probe')
    result=asyncio.run(reader.structured(RoutingDecision,'Read-only route.',{},validator))
    assert result.decision=='probe' and seen==['route','probe']
    assert reader.audit['routingExecutionCorrections'][0]['to']=='probe'
