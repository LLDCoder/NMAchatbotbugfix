"""Native prerequisite completion is bounded by the existing portal budget."""
import asyncio
import copy
import json
import time
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from app.generic_reader import (expected_request_lifecycle_receipt, portal_result_failure,
                                source_inventory, unavailable_source_error)
from app.portal_reader import bounded_portal_read_result
from test_projected_collection import gateway
from test_platform_portal_reader import FakeRoute

ORIGIN = 'https://fixture.test'
OP = 'GET /api/Enquiry/Management/TeamTask/List'
OTHER = 'GET /api/Enquiry/Management/List'


def record(health, op=OP, *, allowed=True, policy='allowed', suffix='?token=PRIVATE'):
    method, path = op.split(' ', 1)
    request = SimpleNamespace(url=ORIGIN+path+suffix, method=method, post_data='',
                              headers={'Authorization':'PRIVATE'}, failure='PRIVATE network failure')
    gateway._reader_record_api_candidate(health, request, ORIGIN, allowed=allowed, policy_state=policy)
    return request


def setup(operations=(OP,)):
    life = gateway._ExpectedRequestLifecycles(operations)
    return life, {'expectedLifecycles': life, 'responseCaptureTasks': set()}


@pytest.mark.parametrize('policy,allowed', [('allowed',False),('blocked',False),('bypassed',True)])
def test_wait_hint_does_not_authorize_a_request(policy, allowed):
    life, h = setup(); record(h, allowed=allowed, policy=policy)
    asyncio.run(life.wait())
    assert life.snapshot()['requests'][0]['state'] == 'not_issued'


def test_unissued_expected_and_unrelated_pending_are_not_waited_or_issued():
    life, h = setup(); record(h, OTHER)
    h['pending']={123: 'PRIVATE'}
    asyncio.run(life.wait())
    assert len(life.entries) == 0 and life.snapshot()['requests'][0]['state'] == 'not_issued'
    assert h['pending'] == {123: 'PRIVATE'}


def test_same_operation_multiple_native_requests_wait_for_each_capture():
    async def run():
        life, h = setup(); requests=[record(h,suffix=f'?page={i}') for i in range(2)]
        task=asyncio.create_task(life.wait()); await asyncio.sleep(0)
        assert not task.done()
        gates=[asyncio.Event(),asyncio.Event()]
        async def capture(gate): await gate.wait(); return True
        for r,g in zip(requests,gates):
            gateway._reader_api_discovery_response_seen(h,r,200)
            life.capture(r,asyncio.create_task(capture(g)))
        gates[0].set(); await asyncio.sleep(0); await asyncio.sleep(0)
        assert not task.done()
        gates[1].set(); await asyncio.wait_for(task,0.2)
        receipt=life.snapshot()
        assert [v['state'] for v in receipt['requests']] == ['complete','complete']
        assert all(v['status']==200 for v in receipt['requests'])
        assert 'PRIVATE' not in json.dumps(receipt) and '/api/' not in json.dumps(receipt)
    asyncio.run(run())


@pytest.mark.parametrize('kind', ['request','capture'])
@pytest.mark.parametrize('cancellation', ['deadline','external'])
def test_pending_is_cancelled_by_original_budget_or_caller(kind,cancellation):
    async def run():
        life,h=setup();r=record(h);capture=None
        if kind=='capture':
            gateway._reader_api_discovery_response_seen(h,r,200)
            capture=asyncio.create_task(asyncio.Event().wait());life.capture(r,capture)
        page=SimpleNamespace(_reader_health=h)
        progress={'stage':'actions'};token=gateway.READER_PROGRESS.set(progress)
        try:
            if cancellation=='deadline':
                with pytest.raises(TimeoutError):
                    async with asyncio.timeout(0.02): await gateway._reader_wait_for_api_response_evidence(page)
            else:
                pending=asyncio.create_task(gateway._reader_wait_for_api_response_evidence(page))
                await asyncio.sleep(0);pending.cancel()
                with pytest.raises(asyncio.CancelledError):await pending
            assert progress['stage']=='expected_response_wait'
            receipt=progress['expectedRequestLifecycles']
            assert receipt['waitOutcome']=='cancelled'
            assert receipt['requests'][0]['state']==('pending' if kind=='request' else 'capture_pending')
            assert receipt['requests'][0]['status']==(None if kind=='request' else 200)
            if capture:
                await asyncio.sleep(0)
                assert capture.cancelled()
        finally:gateway.READER_PROGRESS.reset(token)
    asyncio.run(run())


@pytest.mark.parametrize('status',[401,403,404,500])
def test_http_failure_is_terminal_and_never_becomes_native_data(status):
    life,h=setup();r=record(h);gateway._reader_api_discovery_response_seen(h,r,status)
    asyncio.run(life.wait())
    assert life.snapshot()['requests'][0]['state']=='http_error'
    observation={'apiDiscovery': gateway._reader_api_discovery_snapshot(SimpleNamespace(_reader_health=h))}
    assert not source_inventory(observation,'/happiness/tickets','now','principal')
    failure=unavailable_source_error(observation,[OP])
    assert failure.category==('permission' if status in {401,403} else 'runtime')


def test_network_failure_remains_observed_event_without_exception_text():
    life,h=setup();r=record(h);life.failed(r);asyncio.run(life.wait())
    receipt=life.snapshot()
    assert receipt['requests'][0]['state']=='request_failed' and receipt['requests'][0]['status'] is None
    assert 'PRIVATE' not in json.dumps(receipt)


@pytest.mark.parametrize('capture_result', [None,False,True])
def test_capture_completion_is_distinct_from_response_headers(capture_result):
    async def run():
        life,h=setup();r=record(h);gateway._reader_api_discovery_response_seen(h,r,200)
        async def capture():return capture_result
        task=asyncio.create_task(capture());life.capture(r,task);await life.wait()
        assert life.snapshot()['requests'][0]['state']==('complete' if capture_result is True else 'capture_failed')
    asyncio.run(run())


def test_tracking_is_bounded_and_limit_never_looks_like_completion():
    life,h=setup()
    for _ in range(life.LIMIT+1): record(h)
    assert len(life.entries)==life.LIMIT
    with pytest.raises(RuntimeError, match='reader_expected_request_tracking_limit'):asyncio.run(life.wait())
    receipt=life.snapshot()
    assert receipt['truncated'] and len(receipt['requests'])==50 and receipt['waitOutcome']=='tracking_limit'


@pytest.mark.parametrize('op', ['GET https://outside.test/api/x','GET /api/x?token=PRIVATE',
    'GET /api/x#PRIVATE','DELETE /api/x','GET /api/../x','GET /api/x\nPRIVATE'])
def test_wait_hint_rejects_nonoperation_material(op):
    with pytest.raises(ValidationError):gateway.AdminPortalReadRequest(startPath='/happiness/tickets',
        actions=[{'type':'observe'}], expectedOperations=[op])


@pytest.mark.parametrize('malformed',[{'state':[]},{'operationIndex':True},{'elapsedMs':-1},
    {'status':True},{'state':'PRIVATE'},{'status':'PRIVATE'}])
def test_backend_copies_only_bounded_fixed_diagnostic_fields(malformed):
    good={'operationIndex':0,'state':'pending','status':None,'elapsedMs':2}
    raw={'requests':[{**good,**malformed}], 'waitOutcome':['PRIVATE'], 'secret':'PRIVATE'}
    result=expected_request_lifecycle_receipt({'apiDiscovery':{'expectedRequestLifecycles':raw}})
    assert not result['requests'] and result['waitOutcome']=='not_waited' and 'PRIVATE' not in str(result)


def test_tool_gateway_preserves_hint_without_raising_limits_or_changing_principal():
    from app.tool_gateway import ToolGateway
    from app.principal import Principal
    class Platform:
        portal_base_url=ORIGIN
        async def admin_portal_read(self,payload,**kwargs):
            self.payload=payload;self.kwargs=kwargs
            gateway.AdminPortalReadRequest.model_validate(payload)
            return {'status':'not_confirmed'}
    platform=Platform();tool=ToolGateway(None,platform)
    principal=Principal(user_id='person',tenant_id='tenant',request_id='req',umc_token='PRIVATE')
    result=asyncio.run(tool.invoke(principal,'admin.portal.read',{'startPath':'/happiness/tickets',
        'actions':[{'type':'observe'}],'expectedOperations':[OP], 'timeoutSeconds':999}))
    assert result['ok'] and platform.payload['expectedOperations']==[OP]
    assert platform.payload['timeoutSeconds']==65 and platform.kwargs['user_id']=='person'


@pytest.mark.parametrize('kind', ['late','pending','capture_pending','network','http401','http403','bad_body','evicted'])
def test_real_executor_tracks_native_events_and_body_with_original_timeout(monkeypatch,kind):
    events={};native_tasks=[];created=[]
    page=SimpleNamespace(url=ORIGIN+'/happiness/tickets',
        on=lambda event, callback: events.setdefault(event,[]).append(callback),
        set_default_timeout=lambda *args:None,set_default_navigation_timeout=lambda *args:None)
    def emit(event,value):
        for callback in events.get(event,[]):callback(value)
    async def goto(*args,**kwargs):
        route=FakeRoute('GET',ORIGIN+OP.split(' ',1)[1]);route.request.post_data=''
        await context.handler(route)
        assert route.result[0]=='continue';created.append(route.request)
        async def finish():
            await asyncio.sleep(0.01)
            if kind=='network':emit('requestfailed',route.request);return
            if kind=='pending':return
            status=int(kind[4:]) if kind.startswith('http') else 200
            async def body():
                if kind=='capture_pending':await asyncio.Event().wait()
                await asyncio.sleep(0.01)
                emit('requestfinished',route.request)
                return b'not json' if kind=='bad_body' else b'{"data":{"items":[{"id":123,"code":"HC-fixture"}]}}'
            response=SimpleNamespace(request=route.request,url=route.request.url,status=status,
                                     headers={'content-type':'application/json'},body=body)
            if kind=='evicted':gateway._reader_api_discovery_state(page._reader_health)['requestKeys'].pop(id(route.request))
            emit('response',response)
            if status>=400:emit('requestfinished',route.request)
        native_tasks.append(asyncio.create_task(finish()))
        return SimpleNamespace(status=200)
    page.goto=goto
    async def bind_route(pattern,handler):context.handler=handler
    context=SimpleNamespace(add_init_script=AsyncMock(),route=bind_route,new_page=AsyncMock(return_value=page))
    browser=SimpleNamespace(new_context=AsyncMock(return_value=context),close=AsyncMock())
    @asynccontextmanager
    async def playwright():yield SimpleNamespace(chromium=SimpleNamespace(launch=AsyncMock(return_value=browser)))
    monkeypatch.setattr(gateway,'UMC_BASE_URL',ORIGIN)
    monkeypatch.setattr(gateway,'async_playwright',playwright)
    monkeypatch.setattr(gateway,'_umc_request',AsyncMock(return_value={}))
    monkeypatch.setattr(gateway,'_validate_gateway_permissions',lambda *args:{'userId':'person',
        'pages':['/happiness/tickets'],'subpages':[],'buttons':[],'dataScope':[]})
    monkeypatch.setattr(gateway,'_settle_page',AsyncMock())
    monkeypatch.setattr(gateway,'_observe_semantics',AsyncMock(return_value={}))
    request=gateway.AdminPortalReadRequest(startPath='/happiness/tickets',actions=[{'type':'observe'}],
        expectedOperations=[OP,OTHER],timeoutSeconds=1)
    async def run():
        raw=await gateway.admin_portal_read(request,authorization='Bearer PRIVATE',x_user_id='person')
        await asyncio.gather(*native_tasks)
        return raw
    started=time.monotonic();raw=asyncio.run(run());elapsed=time.monotonic()-started
    result=bounded_portal_read_result(raw)
    assert len(created)==1 and elapsed<1.5  # No endpoint retry or budget extension.
    browser.close.assert_awaited_once()
    if kind in {'pending','capture_pending'}:
        failure=portal_result_failure(result)
        assert failure.category=='runtime' and failure.details['gatewayStage']=='expected_response_wait'
        receipt=failure.details['expectedRequestLifecycles']
        assert receipt['waitOutcome']=='cancelled' and receipt['requests'][0]['state']==kind
    else:
        observation=result['observation'];receipt=expected_request_lifecycle_receipt(observation)
        expected={'late':'complete','network':'request_failed','http401':'http_error','http403':'http_error','bad_body':'capture_failed','evicted':'capture_failed'}[kind]
        assert receipt['requests'][0]['state']==expected
        sources=source_inventory(observation,'/happiness/tickets','now','person')
        assert bool(sources)==(kind=='late')
        if kind in {'http401','http403'}:assert unavailable_source_error(observation,[OP]).category=='permission'
    assert receipt['requests'][1]['state']=='not_issued'
    assert 'PRIVATE' not in json.dumps(receipt) and '/api/' not in json.dumps(receipt)


@pytest.mark.parametrize('status', [None, 401, 403, 500, 'unissued'])
def test_lookup_missing_response_keeps_route_stage_after_optional_search(monkeypatch,status):
    import app.generic_reader as module
    from app.principal import Principal
    from test_reader_execution_flow import routes
    from app.generic_reader import GenericKnowledgeReader
    t, k, candidates = routes()
    t = t.model_copy(update={'requestedScope': 'unknown', 'businessFocus': '', 'filters': [],
                             'requestedMeasures': [], 'timeRange': 'unknown'})
    catalog = [{'id': c['pageId'], 'name': c['name'], 'routes': [c['route']], 'description': c['description'],
                'parameters': c['parameters'], 'fields': c['fields']} for c in candidates]
    monkeypatch.setattr(module, 'load_catalog', lambda *args: (catalog, 'catalog-1'))
    text = 'Crystal lookup: code key pageIndex pageSize rows total; /work/crystals /work/crystal-detail.'
    k.add({'chunks': [{'id': 'paging', 'content': text}]}); k.prompt()
    ref = next(pid for pid, (_, passage) in k.passages.items() if text in passage)
    context = {'contextRef': 'a'*64, 'requestFields': ['pageIndex','pageSize'], 'rowSchemas': [{'path':'/rows','fields':['code','key']}]}
    calls = []
    class Gateway:
        async def get_user_info(self, principal):
            return {'ok': True, 'result': {'data': {'id':'person', 'rolesInfo':[{'roleName':'Reviewer'}], 'listSysPermission': [
                {'frontendRoute': c['route']} for c in candidates]}}}
        async def invoke(self, principal, name, arguments, **kwargs):
            if name == 'knowledge.search': return {'ok': True, 'result': {'chunks': []}}
            calls.append(arguments)
            assert arguments['startPath'] == '/work/crystals'
            assert arguments['expectedOperations'] == ['GET /api/crystals']
            assert not arguments.get('collections') and not arguments.get('pageReads')
            candidates_observed = [] if status == 'unissued' else [{
                'operationKey':'GET /api/crystals','policyState':'allowed',
                'status':status,'candidateKind':'business'}]
            return {'ok': True, 'result': {'page':'/work/crystals', 'observation': {
                'apiDiscovery': {'candidates':candidates_observed,
                    'expectedRequestLifecycles':{'requests':[{
                        'operationIndex':0,'state':'not_issued' if status=='unissued' else 'request_failed' if status is None else 'http_error',
                        'status':None if status=='unissued' else status,'elapsedMs':17}],
                        'waitOutcome':'settled','truncated':False}}}}}
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage = schema['properties']['stage']['const']
            if stage == 'query_expansion':
                from test_generic_reader_v3 import expansion_fixture
                return expansion_fixture(data)
            if stage == 'task': return t.model_dump()
            if stage == 'knowledge_coverage':
                return {'stage': stage, 'checks': [{'requirementId': r['id'], 'status': 'partial',
                    'reason': 'Detail meaning remains unverified.', 'evidence': [{'sourceId': ref}]}
                    for r in data['requirements']]}
            if stage == 'catalog_recall': return {'stage':stage,'candidateIds':[c['candidateId'] for c in data['catalog']],'reason':'Lookup and detail'}
            if stage == 'routing_decision':
                found = {c['name']:c for c in data['candidates']}
                return {'stage':stage,'taskFingerprint':data['taskFingerprint'],'decision':'probe','reason':'Locate then read',
                    'candidates':[{'candidateId':c['candidateId'],'evidence':[{'sourceId':c['catalogSourceIds'][0]}],
                        'reason':'Authorized entry','conditions':[{'requirementId':r['id'],'status':'unknown','reason':'Observe'} for r in data['requirements']]}
                        for c in data['candidates']], 'routePlan':[
                        {'candidateId':found['list']['candidateId'],'purpose':'locate_record'},
                        {'candidateId':found['detail']['candidateId'],'parameterBindingIds':['crystals.fields#key']}]}
            if stage == 'collection':
                return {'stage':stage,'collections':[{'sourceId':data['sources'][0]['sourceId'],'rowsPath':'/rows',
                    'totalPath':'/total','fields':['code','key'],'identityFields':['key'],'pageField':'pageIndex','sizeField':'pageSize',
                    'evidence':[{'sourceId':ref,'quote':text}]}], 'missing':[]}
            if stage == 'source_selection': return {'stage':stage,'sourceIds':[s['sourceId'] for s in data['sources']],
                                                    'rationale':[{'sourceId':ref}],'missing':[]}
            assert stage == 'analysis'
            return {'stage':stage,'context':{'scope':'unknown','scopeEvidence':[],'caveats':[],
                **{key:{'value':'unknown','evidence':[]} for key in ('grain','population','filterScope','time')}},
                'steps':[], 'missing':['detail_semantics_missing']}
    # Force a legitimate optional field-semantics search after the native
    # observation. A subsequent missing response must not blame that KB search.
    import app.reader_prerequisites as prerequisites
    monkeypatch.setattr(prerequisites, 'missing_lookup_attributes', lambda *args: ['phase'])
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test'); reader.knowledge = k
    outcome = asyncio.run(reader.run(Principal('person','tenant','request'), 'Show the details of crystal CR-2.'))
    result = outcome.result.public_json()
    assert len(calls)==1 and not result['outputs']
    assert result['failureStage']=='route_lookup'
    assert result['failureCategory']==('permission' if status in {401,403} else 'runtime')
    assert reader.active_quality_stage=='page_observation'
    assert any(row.get('stage')=='knowledge_retrieval' and row.get('status')=='completed' for row in reader.trace)
    receipt=result['failureDetails']['expectedRequestLifecycles']
    assert receipt['requests'][0]['elapsedMs']==17
    assert outcome.audit_evidence['routeLookupObservations'][0]['expectedRequestLifecycles']==receipt


@pytest.mark.parametrize('state', ['absent','complete'])
def test_expected_wait_does_not_join_unrelated_hung_capture_or_background_request(state):
    async def run():
        life,h=setup();record(h,'POST /api/clientlog/report')
        unrelated=asyncio.create_task(asyncio.Event().wait())
        h['responseCaptureTasks'].add(unrelated)
        h['pending']={111:'/api/clientlog/report',222:'/api/Other/Poll'}
        if state=='complete':
            request=record(h);gateway._reader_api_discovery_response_seen(h,request,200)
            async def done():return True
            capture=asyncio.create_task(done());life.capture(request,capture)
        await asyncio.wait_for(gateway._reader_wait_for_api_response_evidence(SimpleNamespace(_reader_health=h)),0.1)
        assert not unrelated.done() and len(h['pending'])==2
        assert life.snapshot()['requests'][0]['state']==('not_issued' if state=='absent' else 'complete')
        unrelated.cancel()
        with pytest.raises(asyncio.CancelledError):await unrelated
    asyncio.run(run())


def test_capture_exception_diagnostic_does_not_leak_private_failure_text():
    async def run():
        life,h=setup();request=record(h);gateway._reader_api_discovery_response_seen(h,request,200)
        async def fail():raise ValueError('https://private.test?token=PRIVATE headers=PRIVATE')
        life.capture(request,asyncio.create_task(fail()));await life.wait()
        snapshot=life.snapshot()
        assert snapshot['requests'][0]['state']=='capture_failed'
        assert 'PRIVATE' not in json.dumps(snapshot)
    asyncio.run(run())


def test_many_request_receipts_are_explicitly_bounded_through_tool_projection():
    life,h=setup()
    for _ in range(70):record(h)
    snapshot=life.snapshot()
    result=bounded_portal_read_result({'status':'load_failed',
        'diagnostics':{'stage':'expected_response_wait','expectedRequestLifecycles':snapshot}})
    failure=portal_result_failure(result)
    assert failure.details['expectedRequestLifecycles']==snapshot
    assert snapshot['truncated'] is True and len(snapshot['requests'])==50


def test_wait_hint_cannot_enable_mutation_endpoint_even_if_exactly_named():
    async def run():
        operation='POST /api/Application/123/recall-approval'
        life,h=setup([operation]);h.update(blocked=[],failed={},pending={},responses={})
        request=FakeRoute('POST',ORIGIN+'/api/Application/123/recall-approval')
        await gateway._guard_reader_request(request,ORIGIN,frozenset(['/happiness/tickets']),reader_health=h)
        assert request.result[0]=='abort'
        await life.wait()
        assert not life.entries and life.snapshot()['requests'][0]['state']=='not_issued'
    asyncio.run(run())


def test_discovery_budget_does_not_report_an_issued_allowed_request_as_unissued():
    life,h=setup()
    requests = [record(h, f'GET /api/Fixture/Business{chr(65+index//26)}{chr(65+index%26)}')
                for index in range(gateway.READER_MAX_API_CANDIDATES)]
    assert len({id(request) for request in requests})==len(requests)
    assert len(gateway._reader_api_discovery_state(h)['candidates'])==gateway.READER_MAX_API_CANDIDATES
    request=record(h)
    assert id(request) in life.entries
    # The response hook is still able to finish diagnostics even if discovery
    # dropped the candidate and therefore cannot capture it as a source.
    operation=gateway._reader_api_discovery_response_seen(h,request,200)
    assert not operation
    life.capture(request,None)
    asyncio.run(life.wait())
    assert life.snapshot()['requests'][0]['state']=='capture_failed'
