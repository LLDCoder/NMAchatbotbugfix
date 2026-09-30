"""Business-neutral regressions for dependency goals, identity and evidence state."""
import asyncio
import copy
import json
import time
from types import SimpleNamespace

import httpx
import pytest

from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError, row_scalar, source_inventory
from app.generic_reader_contracts import RouteHop, RoutingDecision
from app.portal_reader import ReaderTimeoutBudget
from app.reader_collection import projection_hash
from app.reader_knowledge import hydrate_packages
from app.reader_requirements import requirements_for
from app.reader_routing import bind_route, locate_record, recall_candidates, task_fingerprint, validate_decision, verify_route
from test_reader_context_v3 import task
from test_reader_routing_v03 import package, chunks_for
from test_projected_collection import gateway, setup_rows, collect


def test_knowledge_refinement_preserves_conjuncts_and_explicit_conditions():
    from app.reader_context import merge_task, refine_task
    draft = merge_task(task(groupBy=['state', 'urgency'], requestedGrain='unknown'), {})
    candidate = task(groupBy=['state'], requestedScope='personal', requestedGrain='crystal',
        requestedMeasures=['sum'], needsLiveData=False, slotUpdates=[
            {'field': 'groupBy', 'source': 'knowledge', 'value': ['state'], 'evidence': 'Only state is documented'},
            {'field': 'requestedScope', 'source': 'knowledge', 'value': 'personal', 'evidence': 'Available page'},
            {'field': 'requestedMeasures', 'source': 'current', 'value': ['sum']},
            {'field': 'requestedGrain', 'source': 'knowledge', 'value': 'crystal', 'evidence': 'Entity definition'}])
    result = refine_task(draft, candidate)
    assert result.groupBy == ['state', 'urgency']
    assert result.requestedScope == 'team' and result.requestedMeasures == ['count']
    assert result.requestedGrain == 'crystal' and result.needsLiveData
    assert next(s for s in result.slotUpdates if s.field == 'groupBy').source == 'current'


def test_new_user_turn_can_remove_requirement_but_knowledge_cannot_undo_clear():
    from app.reader_context import merge_task, refine_task
    from test_reader_context_v3 import history_for
    current = merge_task(task(contextRelation='refine', groupBy=['state'], filters=[], slotUpdates=[
        {'field': 'groupBy', 'source': 'current', 'value': ['state']},
        {'field': 'filters', 'source': 'clear', 'value': []}]), history_for(task(groupBy=['state','urgency'])))
    result = refine_task(current, task(slotUpdates=[
        {'field': 'filters', 'source': 'knowledge', 'value': ['color=red'], 'evidence': 'Default page filter'}]))
    assert result.groupBy == ['state'] and result.filters == []


def test_nested_tab_groups_verify_one_selected_target_without_ignoring_ambiguity():
    t, knowledge, _ = routes()
    t = t.model_copy(update={'recordIdentity': '', 'view': 'Open'})
    tabs = [{'name': 'Work', 'selected': True, 'groupRef': 'outer'},
            {'name': 'Members', 'selected': False, 'groupRef': 'outer'},
            {'name': 'Open', 'selected': True, 'groupRef': 'inner'},
            {'name': 'Closed', 'selected': False, 'groupRef': 'inner'}]
    verify = lambda value: verify_route(t, '/work/crystals', '/work/crystals', {'tabControls': value}, {}, knowledge).passed
    assert verify(tabs)
    both = copy.deepcopy(tabs); both[-1]['selected'] = True
    assert not verify(both)
    duplicate = copy.deepcopy(tabs); duplicate.append({'name': 'Open', 'selected': False, 'groupRef': 'other'})
    assert not verify(duplicate)
    assert not verify([{k:v for k,v in tab.items() if k != 'groupRef'} for tab in tabs])
    assert verify([{'name': 'Open', 'selected': True}])


def test_row_analysis_schema_cannot_claim_unselected_card_coverage():
    from app.generic_reader_contracts import AnalysisPlan
    from test_reader_requirement_coverage import fixture
    _, plan, sources, _ = fixture()
    class Planner:
        async def generic_reader_json(self, **kwargs):
            assert kwargs['schema']['properties']['metricCoverage']['maxItems'] == 0
            for name in ['Step', 'RequirementBinding']:
                assert kwargs['schema']['$defs'][name]['properties']['sourceId']['enum'] == ['', *sorted(sources)]
            return plan.model_dump()
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 60; reader.secrets = ()
    result = asyncio.run(reader.structured(AnalysisPlan, 'Analyze verified rows.', {'sources': sources}))
    assert result.metricCoverage == []


def test_lookup_schema_limits_projection_and_live_source_namespace():
    from app.generic_reader_contracts import CollectionPlan
    class Planner:
        async def generic_reader_json(self, **kwargs):
            props = kwargs['schema']['$defs']['CollectionSpec']['properties']
            assert props['sourceId']['enum'] == ['api_items']
            assert props['fields']['items']['enum'] == ['code','key']
            assert props['identityFields']['items']['enum'] == ['code','key']
            return {'stage': 'collection', 'collections': [], 'missing': []}
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 60; reader.secrets = ()
    asyncio.run(reader.structured(CollectionPlan, 'Locate the record.',
        {'sources': [{'sourceId': 'api_items'}], 'lookupFields': {'GET /api/items': ['key','code']}}))


def test_routing_schema_uses_exact_runtime_identifiers():
    from app.reader_routing import task_fingerprint
    runtime_task = task()
    fingerprint = task_fingerprint(runtime_task)
    class Planner:
        async def generic_reader_json(self, **kwargs):
            schema = kwargs['schema']
            assert 'taskFingerprint' not in schema['properties']
            for name in ('RouteHop','PageCandidate'):
                assert schema['$defs'][name]['properties']['candidateId']['enum'] == ['opaque-candidate']
            return {'stage':'routing_decision','decision':'knowledge_gap',
                'candidates':[],'routePlan':[],'reason':'No verified source','missing':['source_definition_missing']}
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.deadline = time.monotonic()+60; reader.secrets=()
    result = asyncio.run(reader.structured(RoutingDecision,'Use supplied IDs.',
        {'task': runtime_task.model_dump(), 'taskFingerprint':fingerprint,'candidates':[{'candidateId':'opaque-candidate'}]}))
    assert result.taskFingerprint == fingerprint


def test_detail_with_nested_arrays_does_not_trigger_list_pagination():
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
    source = {'operationRef':'GET /api/crystals/{key}', 'data':{'detail':{'key':'1','history':[]}},
        'collectionContext':{'requestFields':['key'],'rowSchemas':[{'path':'/detail/history','fields':['key']}]}}
    observation = {'pageIdentity':{'path':'/work/crystal-detail'}}
    result, missing = asyncio.run(reader.collect_sources(None, task(outputShape='detail'), None,
        observation, {'detail':source}))
    assert result is observation and not missing


def test_exact_structured_semantics_do_not_require_requoting_field_names():
    from app.generic_reader import execute_analysis
    from app.generic_reader_contracts import ExtractCitation
    from app.reader_requirements import semantic_bindings
    from test_reader_requirement_coverage import fixture
    t, plan, sources, knowledge = fixture()
    catalog = {r['knowledgeBindingId']: r for r in semantic_bindings(knowledge)}
    for binding in plan.requirementBindings:
        if binding.knowledgeBindingId:
            fact = catalog[binding.knowledgeBindingId]
            reference = next(c.sourceId for c in binding.evidence if knowledge.source(c)['recordId'] == fact['recordId'])
            binding.evidence = [ExtractCitation(sourceId=reference, quote='"kind": "'+fact['kind']+'"')]
    result = execute_analysis(plan, sources, knowledge, [], task=t)
    assert result['requirementsSatisfied']
    # A wrong operation remains unverified despite valid citations.
    sources['queue']['operationRef'] = 'GET /api/other'
    assert not execute_analysis(plan, sources, knowledge, [], task=t)['requirementsSatisfied']


def test_wrong_card_link_preserves_guard_and_explains_independent_row_computation():
    from app.generic_reader import execute_analysis
    from app.generic_reader_contracts import AnalysisPlan
    from test_reader_requirement_coverage import fixture
    t, plan, sources, knowledge = fixture()
    value = plan.model_dump()
    value['metricCoverage'] = [{'metricIndex': 0, 'disposition': 'included',
        'stepId': next(s.id for s in plan.steps if s.op == 'count'), 'reason': 'Incorrect card equivalence'}]
    with pytest.raises(PipelineError) as error:
        execute_analysis(AnalysisPlan.model_validate(value), sources, knowledge, [{'value': 99}], task=t)
    assert error.value.code == 'metric_source_binding_mismatch'
    assert 'Remove this metricCoverage' in error.value.details['correction']


def test_refinement_cannot_use_a_page_route_as_an_undefined_view():
    from app.principal import Principal
    from test_generic_reader_v3 import Gateway, Planner
    class InvalidViewPlanner(Planner):
        async def generic_reader_json(self, **kwargs):
            value = await super().generic_reader_json(**kwargs)
            if kwargs['data'].get('phase') == 'knowledge_refinement' and not kwargs.get('correction'):
                value['view'] = '/work/crystals'
                value['slotUpdates'] = [{'field': 'view', 'source': 'knowledge',
                    'value': '/work/crystals', 'evidence': 'Page is not a tab view'}]
            return value
    reader = GenericKnowledgeReader(Gateway(), InvalidViewPlanner(), portal_base_url='https://portal.test')
    result = asyncio.run(reader.run(Principal('person-1', 'tenant', 'request'), 'Show the current crystal summary.'))
    ignored = result.audit_evidence.get('ignoredIntentSuggestions', [])
    assert {'field': 'view', 'value': '/work/crystals',
            'reason': 'not_defined_in_loaded_page_knowledge'} in ignored
    assert result.result.public_json()['intentState']['task']['view'] == ''


def routes():
    data = package()
    record = data['records'][0]
    record['payload'].pop('longProvenance')
    record['applicability']['pageRefs'] = ['/work/crystals', '/work/crystal-detail']
    record['payload']['routing'] = {
        'parameters': [{'id': 'key', 'name': 'key', 'from': 'previous_record', 'operationRef': 'GET /api/crystals',
                        'identityField': 'code', 'sourcePath': '/rows', 'keyFields': ['key'], 'field': 'key', 'unique': False}],
        'records': [{'id': 'list', 'operationRef': 'GET /api/crystals', 'sourcePath': '/rows',
                     'identityField': 'code', 'keyFields': ['key'], 'unique': False},
                    {'id': 'detail', 'operationRef': 'GET /api/crystals/{key}', 'sourcePath': '/detail',
                     'identityField': 'code', 'keyFields': ['key'], 'unique': False}]}
    k = KnowledgeStore(); k.add({'chunks': [{'source_name': 'crystals.json', 'content': json.dumps(data)}]}); k.prompt()
    t = task(recordIdentity='CR-2', view='', outputShape='detail', groupBy=[])
    candidates = recall_candidates(t, [{'id': name, 'name': name, 'description': 'Crystal records',
        'routes': [route], 'parameters': ['key'] if name == 'detail' else [], 'fields': []}
        for name, route in [('list', '/work/crystals'), ('detail', '/work/crystal-detail')]], k)
    return t, k, candidates


def test_list_detail_subgoal_ignores_output_shape_conflict_but_not_scope_conflict():
    t, k, candidates = routes()
    ref = next(iter(k.passages))
    by_name = {c['name']: c for c in candidates}
    decision = RoutingDecision.model_validate({'stage': 'routing_decision', 'taskFingerprint': task_fingerprint(t),
        'decision': 'probe', 'reason': 'Locate then read', 'candidates': [
            {'candidateId': c['candidateId'], 'evidence': [{'sourceId': ref}], 'reason': 'Catalog evidence',
             'conditions': [{'requirementId': r['id'], 'status': 'conflict' if c['name'] == 'list' and r['kind'] in {'grain','detail','measure'} else 'unknown',
                 'evidence': [{'sourceId': ref}], 'reason': 'Intermediate list is not final detail'} for r in requirements_for(t)]}
            for c in candidates], 'routePlan': [
                {'candidateId': by_name['list']['candidateId'], 'purpose': 'locate_record'},
                {'candidateId': by_name['detail']['candidateId'], 'parameterBindingIds': ['crystals.fields#key']}]})
    validate_decision(decision, t, candidates, k)
    lookup = next(c for c in decision.candidates if c.candidateId == by_name['list']['candidateId'])
    next(c for c in lookup.conditions if c.requirementId == 'object').status = 'conflict'
    with pytest.raises(PipelineError, match='routing_condition_conflict') as error:
        validate_decision(decision, t, candidates, k)
    assert error.value.category == 'planning'
    assert error.value.details['requirementIds'] == ['object']
    assert 'knowledge_gap' in error.value.details['correction']


def test_alternative_parameter_sources_cannot_both_bind_the_same_query_name():
    t, knowledge, candidates = routes()
    item = next(i for i in knowledge.items.values() if i.get('record'))
    definitions = item['record']['payload']['routing']['parameters']
    definitions.append({**definitions[0], 'id': 'other-key', 'operationRef': 'GET /api/other-crystals'})
    ref = next(iter(knowledge.passages)); by_name = {c['name']: c for c in candidates}
    decision = RoutingDecision.model_validate({'stage': 'routing_decision', 'taskFingerprint': task_fingerprint(t),
        'decision': 'probe', 'reason': 'Locate and read', 'candidates': [
            {'candidateId': c['candidateId'], 'evidence': [{'sourceId': ref}], 'reason': 'Catalog',
             'conditions': [{'requirementId': r['id'], 'status': 'unknown', 'evidence': [], 'reason': 'Observe'}
                            for r in requirements_for(t)]} for c in candidates],
        'routePlan': [{'candidateId': by_name['list']['candidateId'], 'purpose': 'locate_record'},
            {'candidateId': by_name['detail']['candidateId'], 'parameterBindingIds': ['crystals.fields#key', 'crystals.fields#other-key']}]})
    with pytest.raises(PipelineError, match='route_parameter_binding_conflict'):
        validate_decision(decision, t, candidates, knowledge)


def test_identifier_aliases_resolve_only_within_same_source_and_same_entity():
    from app.reader_routing import page_routing, parameter_lookup_definitions
    t, knowledge, candidates = routes(); detail = next(c for c in candidates if c['name'] == 'detail')
    item = next(i for i in knowledge.items.values() if i.get('record'))
    definitions = item['record']['payload']['routing']['parameters']
    definitions.append({**definitions[0], 'id': 'display-key', 'identityField': 'displayCode'})
    definitions.append({**definitions[0], 'id': 'outside', 'identityField': 'otherCode', 'operationRef': 'GET /api/other'})
    family = parameter_lookup_definitions(page_routing(knowledge, detail['route'])['parameters'], ['crystals.fields#key'])
    assert {d['identityField'] for d in family} == {'code', 'displayCode'}
    source = {'operationRef':'GET /api/crystals', 'data':{'rows':[{'key':'2','code':'INTERNAL-2','displayCode':t.recordIdentity}]},
        'collectionReceipt':{'operationRef':'GET /api/crystals','rowsPath':'/rows','completeness':'complete','rowCount':1}}
    hop = RouteHop(candidateId=detail['candidateId'],parameterBindingIds=['crystals.fields#key'])
    proof = {}; assert bind_route(hop,detail,t,knowledge,{'s':source},proof_out=proof).endswith('?key=2')
    assert proof['bindingIds'] == ['crystals.fields#display-key']
    source['data']['rows'].append({'key':'3','code':t.recordIdentity,'displayCode':'ANOTHER'})
    source['collectionReceipt']['rowCount'] = 2
    with pytest.raises(PipelineError,match='record_ambiguous'):
        bind_route(hop,detail,t,knowledge,{'s':source})


def test_unavailable_dimension_keeps_requirement_but_allows_correct_page_probe():
    t, knowledge, candidates = routes()
    t = t.model_copy(update={'recordIdentity': '', 'view': '', 'groupBy': ['urgency'],
        'outputShape': 'count', 'unresolvedSlots': ['urgency_dimension']})
    candidate = next(c for c in candidates if c['name'] == 'list'); ref = next(iter(knowledge.passages))
    decision = RoutingDecision.model_validate({'stage': 'routing_decision', 'taskFingerprint': task_fingerprint(t),
        'decision': 'probe', 'reason': 'Correct page with unknown requested dimension',
        'candidates': [{'candidateId': candidate['candidateId'], 'evidence': [{'sourceId': ref}], 'reason': 'Catalog',
            'conditions': [{'requirementId': r['id'], 'status': 'conflict' if r['kind'] in {'group','unresolved'} else 'unknown',
                'evidence': [{'sourceId': ref}], 'reason': 'Unavailable dimension'} for r in requirements_for(t)]}],
        'routePlan': [{'candidateId': candidate['candidateId']}]})
    validate_decision(decision, t, [candidate], knowledge)
    assert any(r['kind'] == 'unresolved' for r in requirements_for(t))
    next(c for c in decision.candidates[0].conditions if c.requirementId == 'scope').status = 'conflict'
    with pytest.raises(PipelineError, match='routing_condition_conflict'):
        validate_decision(decision, t, [candidate], knowledge)


@pytest.mark.parametrize('failure, expected', [('timeout', 'identity_dependency_timeout'),
    (401, 'authentication_failed'), (403, 'permission_denied'), (503, 'identity_dependency_unavailable'),
    ('missing', 'missing_user_identity'), ('invalid', 'identity_response_invalid'), ('success', None)])
def test_websocket_uses_configured_identity_client_and_classifies_failures(failure, expected):
    import httpx
    from fastapi import WebSocketDisconnect
    from app.api import make_router
    called = []
    class Platform:
        async def get_user_info(self, **kwargs):
            called.append(kwargs)
            if failure == 'timeout': raise httpx.ReadTimeout('synthetic')
            if isinstance(failure, int):
                response = httpx.Response(failure, request=httpx.Request('POST', 'https://portal.test/identity'))
                response.raise_for_status()
            if failure == 'invalid': raise ValueError('synthetic malformed JSON')
            return {'data': {} if failure == 'missing' else {'id': 'person-1'}}
    service = SimpleNamespace(tool_gateway=SimpleNamespace(platform=Platform()))
    endpoint = next(r.endpoint for r in make_router(service).routes if r.path.endswith('/ws'))
    class Socket:
        scope = {'query_string': b'userId=person-1&tenantId=tenant'}
        headers = {}; sent = []; received = False
        async def accept(self): pass
        async def send_json(self, value): self.sent.append(value)
        async def receive_json(self):
            if self.received: raise WebSocketDisconnect()
            self.received = True
            return {'type': 'auth', 'umctoken': 'synthetic-token'}
    socket = Socket(); asyncio.run(endpoint(socket))
    assert len(called) == (2 if failure in {'timeout', 503} else 1)
    assert all(call['umc_token'] == 'synthetic-token' for call in called)
    assert socket.sent[-1].get('code') == expected
    assert socket.sent[-1]['type'] == ('error' if expected else 'authenticated')


def test_websocket_identity_recovers_once_but_never_retries_denial():
    import httpx
    from app.api import websocket_identity
    class Platform:
        calls = 0
        async def get_user_info(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                raise httpx.ConnectError('synthetic transient outage')
            return {'data': {'id': 'person-1'}}
    platform = Platform()
    assert asyncio.run(websocket_identity(platform, 'synthetic-token', 'trace')) == ('person-1', None)
    assert platform.calls == 2


def test_websocket_identity_retry_shares_one_total_budget():
    import time
    import httpx
    from app.api import websocket_identity
    class Platform:
        timeout = 1
        calls = 0
        async def get_user_info(self, **kwargs):
            self.calls += 1
            await asyncio.sleep(0.6)
            raise httpx.ConnectError('synthetic transient outage')
    platform = Platform(); start = time.monotonic()
    assert asyncio.run(websocket_identity(platform, 'synthetic-token', 'trace')) == (None, 'identity_dependency_timeout')
    assert platform.calls == 2 and time.monotonic() - start < 1.4


def test_nonunique_number_requires_complete_lookup_and_matching_detail_keys():
    t, k, candidates = routes()
    detail = next(c for c in candidates if c['name'] == 'detail')
    hop = RouteHop(candidateId=detail['candidateId'], parameterBindingIds=['crystals.fields#key'])
    source = {'operationRef': 'GET /api/crystals', 'data': {'rows': [{'key': '1', 'code': 'CR-1'}]}, 'truncated': False}
    with pytest.raises(PipelineError, match='route_record_mapping_unverified'):
        bind_route(hop, detail, t, k, {'s': source})
    source['data']['rows'].append({'key': '2', 'code': 'CR-2'})
    source['collectionReceipt'] = {'operationRef': source['operationRef'], 'rowsPath': '/rows', 'rowCount': 2, 'completeness': 'complete'}
    proof = {}
    route = bind_route(hop, detail, t, k, {'s': source}, proof_out=proof)
    assert route.endswith('?key=2')
    observation = {'pageIdentity': {'path': '/work/crystal-detail', 'parameterHashes': {'key': projection_hash('2')}}}
    response = {'s': {'operationRef': 'GET /api/crystals/{key}', 'data': {'detail': {'key': '2', 'code': 'CR-2'}}}}
    assert not verify_route(t, route, '/work/crystal-detail', observation, response, k).passed
    assert verify_route(t, route, '/work/crystal-detail', observation, response, k, bound_record=proof).passed
    response['s']['truncated'] = True  # An unrelated history array was bounded.
    assert verify_route(t, route, '/work/crystal-detail', observation, response, k, bound_record=proof).passed
    response['s']['ready'] = False
    assert not verify_route(t, route, '/work/crystal-detail', observation, response, k, bound_record=proof).passed
    response['s'].pop('ready')
    response['s']['data']['detail']['key'] = 'another'
    assert not verify_route(t, route, '/work/crystal-detail', observation, response, k, bound_record=proof).passed
    source['data']['rows'].append({'key': '3', 'code': 'CR-2'})
    source['collectionReceipt']['rowCount'] = 3
    with pytest.raises(PipelineError, match='record_ambiguous'):
        bind_route(hop, detail, t, k, {'s': source})


def test_nested_projection_preserves_null_and_rejects_missing_leaf():
    rows, capture, spec = setup_rows(3)
    rows[0]['timing'] = {'late': True}; rows[1]['timing'] = {'late': False}; rows[2]['timing'] = None
    spec.fields = ['specimenKey', 'timing.late']
    result, _ = collect(rows, capture, spec)
    assert result['completeness'] == 'complete'
    assert [r['timing.late'] for r in result['rows']] == [True, False, None]
    assert row_scalar({'timing': None}, 'timing.late') is None
    rows[0]['timing'] = {}
    assert collect(rows, capture, spec)[0]['reason'] == 'collection_field_missing'


def test_policy_denial_and_upstream_denial_are_different_and_good_api_survives():
    for health, status, expected in [({'blocked': ['/api/example']}, None, 'execution_configuration'),
                                     ({'failed': ['/api/example']}, 403, 'permission')]:
        observed = {'metrics': [{'value': 0}], 'readHealth': health, 'apiDiscovery': {'candidates': [
            {'operationKey': 'GET /api/example', 'status': status, 'policyState': 'blocked'},
            {'operationKey': 'GET /api/independent', 'status': 200, 'policyState': 'allowed', 'responseEvidence': {'count': 3}}]}}
        inventory = source_inventory(observed, '/work/example', 'now', 'p')
        assert inventory['page_metrics']['failureCategory'] == expected
        assert any(v.get('operationRef') == 'GET /api/independent' and v.get('ready') is not False for v in inventory.values())


def test_registered_reads_do_not_enable_mutations_or_other_http_methods():
    origin = 'https://portal.test'
    for method, path in [('POST', '/api/Content/MyTodoPage'), ('POST', '/api/content/team-management/tasks/query'),
                         ('GET', '/api/Content/MyReviewDetail/task-1')]:
        assert gateway._reader_network_request_allowed(SimpleNamespace(url=origin+path, method=method, resource_type='fetch'), origin)
    for path in ['/api/Content/ApproveV2', '/api/content/team-management/tasks/reassign']:
        assert not gateway._reader_network_request_allowed(SimpleNamespace(url=origin+path, method='POST', resource_type='fetch'), origin)
    assert not gateway._reader_network_request_allowed(SimpleNamespace(url=origin+'/api/Content/MyTodoPage', method='DELETE', resource_type='fetch'), origin)


def test_timeout_budget_respects_config_and_records_actual_limit():
    budget = ReaderTimeoutBudget.from_dependencies(total_seconds=180, llm_timeout_seconds=60,
                                                    knowledge_timeout_seconds=30, platform_timeout_seconds=50)
    assert budget.knowledge_search_seconds == 30
    assert budget.planner_seconds == 60
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 10
    async def run():
        with pytest.raises(PipelineError) as exc:
            await reader.call('knowledge_retrieval', asyncio.sleep(.1), .001)
        assert exc.value.details['budgetKind'] == 'stage'
        assert exc.value.details['effectiveBudgetMs'] == 1
        assert exc.value.details['durationMs'] >= 1
    asyncio.run(run())


def capture_http_call_failure(error, stage='CatalogRecall'):
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
    reader.deadline = time.monotonic() + 10
    calls = 0
    async def dependency():
        nonlocal calls
        calls += 1
        raise error
    async def run():
        with pytest.raises(PipelineError) as caught:
            await reader.call(stage, dependency(), 1)
        return caught.value
    failure = asyncio.run(run())
    assert calls == 1  # Diagnostics do not introduce retries.
    assert failure.code == 'dependency_unavailable' and failure.category == 'runtime'
    assert failure.__cause__ is error
    assert failure.details['stage'] == stage
    assert type(failure.details['durationMs']) is int and failure.details['durationMs'] >= 0
    assert reader.trace == [{**failure.details, 'status': 'failed', 'code': 'dependency_unavailable'}]
    assert set(failure.details) <= {'stage', 'exceptionType', 'durationMs', 'httpStatus'}
    return failure, reader


@pytest.mark.parametrize('status', [401, 402, 403, 429, 503])
def test_call_http_status_diagnostics_keep_status_without_request_or_response_secrets(status):
    request = httpx.Request('POST', 'https://private-provider.invalid/path?token=query-secret',
                           headers={'Authorization': 'Bearer header-secret'}, content=b'request-body-secret')
    response = httpx.Response(status, request=request, headers={'Set-Cookie': 'cookie-secret'},
                             json={'error': 'response-body-secret', 'token': 'upstream-secret'})
    error = httpx.HTTPStatusError('exception-message-secret', request=request, response=response)
    failure, reader = capture_http_call_failure(error)
    assert failure.details['exceptionType'] == 'HTTPStatusError'
    assert failure.details['httpStatus'] == status
    serialized = json.dumps({'details': failure.details, 'trace': reader.trace})
    for secret in ['secret', 'private-provider', 'https://', 'Authorization', 'Cookie', 'token', 'body', 'path?']:
        assert secret not in serialized


@pytest.mark.parametrize('kind', [httpx.ReadTimeout, httpx.ConnectTimeout, httpx.PoolTimeout,
                                  httpx.RemoteProtocolError, httpx.ReadError, httpx.HTTPError])
def test_call_http_transport_kind_works_without_attached_request(kind):
    error = kind('private-provider-secret https://private-provider.invalid/token')
    # httpx raises RuntimeError if its absent request property is accessed.
    if isinstance(error, httpx.RequestError):
        with pytest.raises(RuntimeError):
            _ = error.request
    failure, reader = capture_http_call_failure(error)
    assert failure.details['exceptionType'] == kind.__name__
    assert 'httpStatus' not in failure.details
    assert 'private' not in json.dumps([failure.details, reader.trace])


def test_call_http_exception_subclass_name_is_not_untrusted_diagnostic_text():
    custom = type('private_token_secret_exception', (httpx.ReadTimeout,), {})
    failure, reader = capture_http_call_failure(custom('raw-secret'))
    assert failure.details['exceptionType'] == 'ReadTimeout'
    assert 'secret' not in json.dumps([failure.details, reader.trace])


def test_call_http_status_does_not_require_request_on_error_or_response():
    response = httpx.Response(503)
    error = httpx.HTTPStatusError('raw-secret', request=None, response=response)
    failure, _ = capture_http_call_failure(error, 'SourceSelection')
    assert failure.details['exceptionType'] == 'HTTPStatusError'
    assert failure.details['httpStatus'] == 503


@pytest.mark.parametrize('status', ['503 private-token-secret', True, 999])
def test_call_http_diagnostics_omit_nonstandard_status_values(status):
    response = httpx.Response(503)
    response.status_code = status
    error = httpx.HTTPStatusError('raw-secret', request=None, response=response)
    failure, reader = capture_http_call_failure(error)
    assert 'httpStatus' not in failure.details
    assert 'secret' not in json.dumps([failure.details, reader.trace])


def test_call_external_cancellation_propagates_without_dependency_failure():
    async def run():
        reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
        reader.deadline = time.monotonic() + 10
        entered, cancelled = asyncio.Event(), asyncio.Event()
        async def dependency():
            entered.set()
            try:
                await asyncio.Future()
            finally:
                cancelled.set()
        pending = asyncio.create_task(reader.call('CatalogRecall', dependency(), 5))
        await entered.wait()
        pending.cancel()
        with pytest.raises(asyncio.CancelledError):
            await pending
        assert cancelled.is_set() and reader.trace == []
    asyncio.run(run())


def test_call_non_http_failure_and_success_are_unchanged():
    async def run():
        reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
        reader.deadline = time.monotonic() + 10
        error = ValueError('unrelated-private-failure')
        async def failing():
            raise error
        with pytest.raises(ValueError) as caught:
            await reader.call('CatalogRecall', failing(), 1)
        assert caught.value is error and reader.trace == []
        assert await reader.call('CatalogRecall', asyncio.sleep(0, result={'value': 7}), 1) == {'value': 7}
        assert reader.trace[0]['status'] == 'completed'
        assert 'exceptionType' not in reader.trace[0] and 'httpStatus' not in reader.trace[0]
    asyncio.run(run())


def test_configured_total_budget_does_not_expand_individual_dependency_limits():
    from app.reader_limits import bounded_reader_total_timeout
    budget = ReaderTimeoutBudget.from_dependencies(total_seconds=240, llm_timeout_seconds=60,
        knowledge_timeout_seconds=75, platform_timeout_seconds=50)
    assert (budget.total_seconds, budget.knowledge_search_seconds, budget.planner_seconds,
            budget.portal_read_seconds) == (240, 75, 60, 50)
    assert bounded_reader_total_timeout(9999) == 300
    with pytest.raises(ValueError):
        bounded_reader_total_timeout(float('inf'))


def test_document_cache_requires_same_caller_and_fresh_directory_version():
    chunks, manifest = chunks_for(package())
    class Client:
        posts = 0
        version = '12'
        async def files(self, *args, **kwargs): return {'items': [{**manifest, 'updated_at': self.version}]}
        async def _post(self, *args, **kwargs):
            self.posts += 1
            return {'chunks': chunks}
    async def run():
        client = Client()
        for caller, version, expected in [('a','12',1), ('a','12',1), ('b','12',2), ('b','13',3)]:
            client.version = version
            result = await hydrate_packages(client, {'chunks': chunks[:1]}, 'folder', 20, caller)
            assert result['documentVersions'] and client.posts == expected
    asyncio.run(run())


def test_complete_verified_result_is_not_forced_bounded_or_partial():
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test'); reader.secrets = ()
    result = reader.finish(analysis={'outputs': [{'id':'n','label':'Count','value':0,
        'evidence':[{'completeness':'complete'}]}], 'requirements':[{'id':'n'}],
        'requirementCoverage':[{'id':'n','status':'satisfied','outputIds':['n']}]}).result.public_json()
    assert result['analysisStatus'] == 'complete' and result['completeness'] == 'complete'
    assert 'deployment_semantics_unverified' not in result['missing']


def test_pipeline_collects_lookup_before_binding_detail(monkeypatch):
    import app.generic_reader as module
    from app.principal import Principal
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
            route = arguments['startPath']; calls.append((route, bool(arguments.get('collections'))))
            if 'crystal-detail' in route:
                assert route == '/work/crystal-detail?key=2' and calls[-2][1]
                return {'ok': True, 'result': {'page':route, 'observation': {'pageIdentity': {'path':'/work/crystal-detail',
                    'parameterHashes': {'key':projection_hash('2')}}, 'apiDiscovery': {'candidates': [{
                        'operationKey':'GET /api/crystals/{key}', 'policyState':'allowed','status':200,
                        'responseEvidence':{'detail':{'code':'CR-2','key':'2'}}}]}}}}
            if arguments.get('collections'):
                rows = [{'code':'CR-1','key':'1'}, {'code':'CR-2','key':'2'}]
                spec = arguments['collections'][0]
                rows = [{f:r[f] for f in spec['fields']} for r in rows]
                receipt = {'schemaVersion':'projected-collection/1', 'operationRef':'GET /api/crystals',
                    'contextRef':context['contextRef'],'rowsPath':'/rows','totalPath':'/total', 'fields':spec['fields'],
                    'identityFields':spec['identityFields'],'rows':rows,'total':2,'rowCount':2,'stablePasses':2,
                    'snapshotIsolation':False,'completeness':'complete','projectionHash':projection_hash(rows),'finishedAt':'now'}
                return {'ok': True, 'result': {'page':route,'observation':{'collections':[receipt]}}}
            return {'ok': True,'result': {'page':route,'observation': {'apiDiscovery': {'candidates': [{
                'operationKey':'GET /api/crystals','policyState':'allowed','status':200,'collectionContext':context,
                'responseEvidence':{'rows':[{'code':'CR-1','key':'1'}],'total':2},'responseEvidenceTruncated':False}]}}}}
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
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test'); reader.knowledge = k
    outcome = asyncio.run(reader.run(Principal('person','tenant','request'), 'Show the details of crystal CR-2.'))
    result = outcome.result.public_json()
    assert result.get('routeVerification', {}).get('passed'), (result['missing'], outcome.audit_evidence.get('stages'), calls)
    assert calls == [('/work/crystals',False),('/work/crystals',True),('/work/crystal-detail?key=2',False)]


def test_verified_detail_object_supports_scalar_projection_but_not_unbound_object():
    from app.generic_reader import execute_analysis
    from app.generic_reader_contracts import AnalysisPlan
    from test_generic_reader_v3 import store, reference
    k = store(); ref = reference(k)
    plan = AnalysisPlan.model_validate({'stage':'analysis','context':{'scope':'unknown','scopeEvidence':[],'caveats':[],
        **{name:{'value':'unknown','evidence':[]} for name in ('grain','population','filterScope','time')}},
        'steps':[{'id':'row','op':'read_rows','sourceId':'s','path':'/detail','fields':['key','phase'],
                  'role':'detail','label':'Record','evidence':[ref]}], 'missing':[]})
    source = {'data':{'detail':{'key':'2','phase':'Blue'}},'operationRef':'read','completeness':'bounded'}
    with pytest.raises(PipelineError, match='row_projection_required'):
        execute_analysis(plan, {'s':source}, k, [])
    source['verifiedRecord'] = {'single':True,'path':'/detail','identity':'CR-2'}
    result = execute_analysis(plan, {'s':source}, k, [])
    assert result['outputs'][0]['value'] == [{'key':'2','phase':'Blue'}]
    assert result['outputs'][0]['evidence'][0]['completeness'] == 'complete'


def test_null_filter_value_cannot_be_silently_counted_as_not_late():
    from app.generic_reader import execute_analysis
    from app.generic_reader_contracts import AnalysisPlan
    from test_generic_reader_v3 import store, reference
    k=store();ref=reference(k)
    plan=AnalysisPlan.model_validate({'stage':'analysis','context':{'scope':'unknown','scopeEvidence':[],'caveats':[],
        **{name:{'value':'unknown','evidence':[]} for name in ('grain','population','filterScope','time')}},'missing':[],
        'steps':[{'id':'rows','op':'read_rows','sourceId':'s','path':'/rows','totalPath':'/total',
                  'fields':['key','timing.late'],'label':'Rows','expose':False,'evidence':[ref]},
                 {'id':'late','op':'filter','inputs':['rows'],'field':'timing.late','predicate':'eq','operand':True,
                  'label':'Late','evidence':[ref]}]})
    source={'data':{'rows':[{'key':'2','timing':None}],'total':1},'operationRef':'read','completeness':'bounded'}
    with pytest.raises(PipelineError, match='filter_value_unavailable'):
        execute_analysis(plan, {'s':source}, k, [])


def test_document_budget_prioritizes_exact_page_applicability():
    all_chunks=[]; manifests=[]
    for n in range(4):
        value=package();value['records'][0]['applicability']['pageRefs']=[f'/work/page{n}']
        chunks, manifest=chunks_for(value);doc=f'doc{n}';name=f'fields{n}.json'
        manifests.append({**manifest,'id':doc,'name':name})
        all_chunks.extend([{**c,'id':c['id'].replace('kbfile:doc-',f'kbfile:{doc}-'),
                            'document_id':doc,'source_name':name} for c in chunks])
    class Client:
        async def files(self,*args,**kwargs):return {'items':manifests}
        async def _post(self,*args,**kwargs):return {'chunks':all_chunks}
    result=asyncio.run(hydrate_packages(Client(), {'chunks':all_chunks}, 'folder', 32, query='/work/page3 record fields'))
    ids={x['documentId'] for x in result['documentVersions']}
    assert 'doc3' in ids and len(ids)==3


def test_hydration_narrows_both_queries_to_discovered_document_folder():
    chunks, manifest = chunks_for(package())
    manifest['folder_id'] = 'authorized-child'
    class Client:
        calls = []
        async def files(self, folder_id, **kwargs):
            assert folder_id == 'authorized-root'
            return {'items': [manifest]}
        async def _post(self, path, body, **kwargs):
            self.calls.append(body)
            # Root-ranked results starve this document's continuation.
            if body['folder_id'] != 'authorized-child':
                return {'chunks': chunks[:1]}
            return {'chunks': chunks[:2] if len(self.calls) == 1 else chunks[1:]}
    client = Client()
    result = asyncio.run(hydrate_packages(client, {'chunks': chunks[:1]}, 'authorized-root', 32))
    assert [c['folder_id'] for c in client.calls] == ['authorized-child', 'authorized-child']
    assert result['chunks'][0]['content'] == json.dumps(package(), ensure_ascii=False, indent=2)
    assert result['documentVersions'][0]['documentId'] == 'doc'
    assert result['hydrationGaps'] == []


def test_exact_filename_is_not_starved_by_three_other_structured_documents():
    all_chunks, manifests = [], []
    for n in range(4):
        chunks, manifest = chunks_for(package())
        doc, name = f'doc{n}', f'fields{n}.json'
        manifests.append({**manifest, 'id': doc, 'name': name})
        all_chunks.extend([{**c, 'id': c['id'].replace('kbfile:doc-', f'kbfile:{doc}-'),
                            'document_id': doc, 'source_name': name} for c in chunks])
    class Client:
        async def files(self, *args, **kwargs): return {'items': manifests}
        async def _post(self, *args, **kwargs): return {'chunks': all_chunks}
    result = asyncio.run(hydrate_packages(Client(), {'chunks': all_chunks}, 'folder', 32, query='fields3.json'))
    ids = {x['documentId'] for x in result['documentVersions']}
    assert 'doc3' in ids and len(ids) == 3


def test_structured_collection_definitions_are_bound_to_page_operation_and_rows():
    from app.generic_reader import collection_definition_proofs
    data=package();record=data['records'][0]
    record['payload']={'sourceBinding':{'operationRef':'GET /api/crystals','sourcePath':'/rows'},
        'fields':{'key':'Entity key','timing':{'late':'Nullable boolean'}},
        'pagination':{'pageIndex':'1 based','pageSize':'Rows per page','rowsPath':'/rows','totalPath':'/total'}}
    k=KnowledgeStore();k.add({'chunks':[{'source_name':'crystals.json','content':json.dumps(data)}]})
    spec=SimpleNamespace(rowsPath='/rows',totalPath='/total',fields=['key','timing.late','unverified'],
                         pageField='pageIndex',sizeField='pageSize')
    proofs=collection_definition_proofs(k,'/work/crystals','GET /api/crystals',spec)
    assert set(proofs)=={'key','timing.late','pageIndex','pageSize','total'}
    assert not collection_definition_proofs(k,'/work/wrong','GET /api/crystals',spec)
    assert not collection_definition_proofs(k,'/work/crystals','GET /api/other',spec)
    spec.rowsPath='/other'
    assert not collection_definition_proofs(k,'/work/crystals','GET /api/crystals',spec)
