"""Generic retrieval regressions; synthetic objects and English questions only."""
import asyncio
import copy
import json
import time

import httpx
import pytest

from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError
from app.reader_retrieval import business_query, diverse, retrieve_evidence, RETRIEVAL_BUDGET
from app.reader_knowledge_coverage import KnowledgeCoverage, knowledge_requirements, validate_coverage
from app.principal import Principal
from app.knowledge import KnowledgeGatewayClient
from app.reader_knowledge import KNOWLEDGE_DEADLINE, KNOWLEDGE_MANIFEST
from test_reader_context_v3 import task
from test_generic_reader_v3 import Gateway, Planner


def chunk(doc, index, text, name='Handbook.md'):
    return {'document_id': doc, 'id': f'{doc}:{index}', 'content': text, 'source_name': name}


class Client:
    def __init__(self, fail_scope=False, mutate=False, changed_chunk=False):
        self.requests = []
        self.file_reads = 0
        self.fail_scope, self.mutate, self.changed_chunk = fail_scope, mutate, changed_chunk
        self.manifest = [
            {'id': 'index', 'name': 'frontend-inventory.json', 'folder_id': 'engineering',
             'status': 'done', 'updated_at': '1', 'size': 2000000},
            {'id': 'rules', 'name': 'Form Conditions.md', 'folder_id': 'rules-scope',
             'status': 'done', 'updated_at': '1', 'size': 2000},
            {'id': 'other', 'name': 'Unrelated.md', 'folder_id': 'another-scope',
             'status': 'done', 'updated_at': '1', 'size': 2000},
            {'id': 'not-ready', 'name': 'Form New.md', 'folder_id': 'unready-scope',
             'status': 'processing', 'updated_at': '1', 'size': 2000}]

    async def files(self, *args, **kwargs):
        self.file_reads += 1
        rows = copy.deepcopy(self.manifest)
        if self.mutate and self.file_reads > 1:
            rows[1]['updated_at'] = '2'
        return {'items': rows}

    async def _post(self, path, body, **kwargs):
        self.requests.append(body)
        if body['folder_id'] == 'root':
            return {'completed_channels': ['vector'], 'chunks': [chunk('index', i, 'form /work/crystals schema',
                'frontend-inventory.json') for i in range(20)]}
        if self.fail_scope:
            raise httpx.ConnectError('private dependency failure')
        if body['query'].startswith('Form Conditions.md'):
            return {'completed_channels': ['vector'], 'chunks': [
                chunk('rules', 1, 'Different content' if self.changed_chunk else 'Schema version determines applicability.', 'Form Conditions.md'),
                chunk('rules', 2, 'Required inputs depend on declared conditions.', 'Form Conditions.md'),
                chunk('other', 1, 'This incidental hit must not be consumed.') ]}
        return {'completed_channels': ['vector'], 'chunks': [
            chunk('rules', 1, 'Schema version determines applicability.', 'Form Conditions.md')]}


def retrieve(client, **context):
    return asyncio.run(retrieve_evidence(client, 'form conditions schema', 'root', 32,
        {'purpose': 'business', **context}))


def test_business_query_preserves_requirements_without_route_words():
    t = task(businessObject='crystals', requestedAttributes=['required materials', 'holder'],
             searchQuery='/work/crystals API schema GET fields version')
    q = business_query(t)
    assert 'required materials' in q and 'holder' in q and 'team' in q and 'next 30 days' in q
    assert '/work' not in q and 'API' not in q and 'GET' not in q


@pytest.mark.parametrize('status', [403, 500])
def test_legacy_search_preserves_primary_http_error_contract(status):
    class FailedClient(KnowledgeGatewayClient):
        def __init__(self):
            pass
        async def _post(self, *args, **kwargs):
            response = httpx.Response(status, request=httpx.Request('POST', 'https://kb.test/search'))
            response.raise_for_status()
    with pytest.raises(httpx.HTTPStatusError) as exc:
        asyncio.run(FailedClient().search('Crystal rules', 'root'))
    assert exc.value.response.status_code == status


def test_business_query_preserves_hypothetical_rule_conditions():
    t = task(needsLiveData=False, timeRange='unknown', filters=[],
             searchQuery='crystal restoration after expiry within thirty days required materials')
    assert 'restoration after expiry within thirty days' in business_query(t)


def test_document_diversity_preserves_different_ids_versions_and_content_conflicts():
    values = [chunk('large', i, 'text ' + str(i)) for i in range(20)]
    values += [chunk('small', 0, 'specific rule'), {**chunk('small', 0, 'other version'), 'document_version': 'v2'}]
    out = diverse(values, 3)
    assert [c['document_id'] for c in out] == ['large', 'small', 'small']
    assert len(diverse([values[0], values[0]], 10)) == 1
    assert len(diverse([values[0], {**values[0], 'content': 'conflict'}], 10)) == 2


def test_scope_and_document_continuation_recover_rule_without_accepting_incidental_hit():
    client = Client(); result = retrieve(client)
    own = [c for c in result['chunks'] if c['document_id'] == 'rules']
    assert len(own) == 2 and {c['document_version'] for c in own} == {'1'}
    assert not any(c['document_id'] == 'other' for c in result['chunks'])
    assert result['pinnedVersions']['rules'][1] == '1'
    assert {c['folder_id'] for c in client.requests} == {'root', 'rules-scope'}
    assert all(q['actualChannels'] == ['vector'] for q in result['retrievalPlan']['queries'])
    assert not any(c['folder_id'] == 'unready-scope' for c in client.requests)


def test_optional_dependency_failure_is_audited_without_leaking_exception_text():
    result = retrieve(Client(fail_scope=True))
    assert result['chunks']  # Independent primary source remains available.
    assert result['retrievalPlan']['supplementFailures']
    assert 'private dependency' not in json.dumps(result)


def test_canonical_search_completes_before_optional_variants_enter_shared_queue():
    async def run():
        entered, release = asyncio.Event(), asyncio.Event()
        order = []
        class QueuedClient(Client):
            async def _post(self, path, body, **kwargs):
                order.append(body['query'])
                if body['query'] == 'crystal conditions':
                    entered.set()
                    await release.wait()
                return await super()._post(path, body, **kwargs)
        client = QueuedClient()
        pending = asyncio.create_task(retrieve_evidence(client, 'crystal conditions', 'root', 32,
            {'purpose': 'business', 'queryVariants': ['crystal policy', 'شروط البلورات']}))
        await entered.wait()
        await asyncio.sleep(0)
        assert order == ['crystal conditions']
        release.set()
        result = await pending
        assert order[:3] == ['crystal conditions', 'crystal policy', 'شروط البلورات']
        assert len([q for q in result['retrievalPlan']['queries'] if q['stage'] == 'expanded_search']) == 2
    asyncio.run(run())


def test_cancelled_canonical_search_does_not_launch_optional_work():
    async def run():
        entered = asyncio.Event()
        requests = []
        class BlockedClient(Client):
            async def _post(self, path, body, **kwargs):
                requests.append(body['query'])
                entered.set()
                await asyncio.Event().wait()
        pending = asyncio.create_task(retrieve_evidence(BlockedClient(), 'crystals', 'root', 32,
            {'purpose': 'business', 'queryVariants': ['crystal policy']}))
        await entered.wait()
        pending.cancel()
        with pytest.raises(asyncio.CancelledError):
            await pending
        assert requests == ['crystals']
    asyncio.run(run())


def test_changed_document_or_conflicting_chunk_fails_closed():
    for client in (Client(mutate=True), Client(changed_chunk=True)):
        result = retrieve(client)
        assert result['consistencyError'] == 'knowledge_document_changed'
        assert result['chunks'] == []


def test_shared_turn_budget_limits_optional_requests_and_keeps_primary():
    async def run():
        client = Client()
        token = RETRIEVAL_BUDGET.set({'remaining': 1})
        try:
            first = await retrieve_evidence(client, 'form schema', 'root', 20, {'purpose': 'business'})
            second = await retrieve_evidence(client, 'form conditions', 'root', 20, {'purpose': 'page_fields'})
        finally:
            RETRIEVAL_BUDGET.reset(token)
        assert len(client.requests) == 3  # two primary requests, one supplement
        assert first['chunks'] and second['chunks']
        assert any(g['code'] == 'knowledge_supplement_budget_exhausted' for g in second['hydrationGaps'])
    asyncio.run(run())


def test_slow_optional_search_preserves_primary_and_mandatory_version_check():
    class SlowClient(Client):
        async def _post(self, path, body, **kwargs):
            if body['folder_id'] != 'root':
                await asyncio.sleep(1)
            return await super()._post(path, body, **kwargs)
    async def run():
        client = SlowClient()
        token = KNOWLEDGE_DEADLINE.set({'deadline': time.monotonic() + 3, 'optionalSeconds': .01,
                                      'minimumVerificationReserve': .01})
        try:
            result = await retrieve_evidence(client, 'form conditions', 'root', 32, {'purpose': 'business'})
        finally:
            KNOWLEDGE_DEADLINE.reset(token)
        assert result['chunks'] and client.file_reads == 2
        assert not result.get('consistencyError')
        assert {f['code'] for f in result['hydrationGaps']} == {'knowledge_supplement_timeout'}
    asyncio.run(run())


def test_document_continuation_is_scoped_upstream_and_root_evidence_avoids_scope_fanout():
    class BusinessClient(Client):
        async def _post(self, path, body, **kwargs):
            response = await super()._post(path, body, **kwargs)
            if body['folder_id'] == 'root':
                response['chunks'].append(chunk('rules', 1, 'Schema version determines applicability.', 'Form Conditions.md'))
            return response
    client = BusinessClient()
    result = retrieve(client)
    assert len(client.requests) == 2
    assert client.requests[-1]['source_refs'] == ['kbfile:rules']
    assert not any(c['document_id'] == 'other' for c in result['chunks'])


def test_mandatory_manifest_timeout_never_returns_unverified_evidence():
    class ExpiredClient(KnowledgeGatewayClient, Client):
        def __init__(self):
            Client.__init__(self)
        async def files(self, *args, **kwargs):
            if self.file_reads:
                await asyncio.sleep(1)
            return await Client.files(self, *args, **kwargs)
        _post = Client._post
    async def run():
        token = KNOWLEDGE_DEADLINE.set({'deadline': time.monotonic() + .04, 'optionalSeconds': .01})
        try:
            result = await ExpiredClient().search('form', 'root', retrieval={'purpose': 'business'})
        finally:
            KNOWLEDGE_DEADLINE.reset(token)
        assert result['consistencyError'] == 'knowledge_verification_timeout'
        assert result['chunks'] == []
    asyncio.run(run())


def test_turn_manifest_reuse_still_detects_a_changed_consumed_document():
    class ChangedBetweenSearches(Client):
        async def files(self, *args, **kwargs):
            result = await super().files(*args, **kwargs)
            if self.file_reads >= 3:
                result['items'][1]['updated_at'] = '2'
            return result
    async def run():
        client = ChangedBetweenSearches()
        token = KNOWLEDGE_MANIFEST.set({})
        try:
            first = await retrieve_evidence(client, 'form conditions', 'root', 32, {'purpose': 'business'})
            second = await retrieve_evidence(client, 'form conditions', 'root', 32, {'purpose': 'business'})
        finally:
            KNOWLEDGE_MANIFEST.reset(token)
        assert first['chunks'] and client.file_reads == 3
        assert second['chunks'] == [] and second['consistencyError'] == 'knowledge_document_changed'
    asyncio.run(run())


def test_prompt_reserves_business_references_among_many_page_records():
    store = KnowledgeStore()
    for i in range(35):
        record = {'id': f'page.{i}', 'revision': 1, 'kind': 'field_semantics', 'status': 'active',
                  'title': 'Synthetic fields', 'applicability': {'portal': 'admin', 'environments': ['local']},
                  'payload': {}, 'sources': [{'reference': 'source'}]}
        store.add({'chunks': [chunk(str(i), 0, json.dumps({'records': [record]}), 'Fields.json')]})
    store.add({'chunks': [chunk('manual', i, f'Rule section {i}') for i in range(25)]})
    store.add({'chunks': [chunk('other', 0, 'Another document explains conditions.')]})
    out = store.prompt()
    assert len(out) == 32
    assert sum(bool(d['recordId']) for d in out) == 16
    assert any('Another document' in p['text'] for d in out for p in d['passages'])


def test_known_page_filters_structured_scope_without_hiding_general_references():
    store = KnowledgeStore()
    for index, page in enumerate(['/work/crystals', '/work/specimens']):
        record = {'id': str(index), 'revision': 1, 'kind': 'field_semantics', 'status': 'active',
                  'title': 'Entity identity', 'applicability': {'portal': 'admin', 'environments': ['local'],
                  'pageRefs': [page]}, 'payload': {}, 'sources': [{'reference': 'source'}]}
        store.add({'chunks': [chunk(str(index), 0, json.dumps({'records': [record]}), 'Fields.json')]})
    store.add({'chunks': [chunk('manual', 0, 'General business explanation.')]})
    out = store.prompt(page='/work/crystals?view=all')
    assert {x['recordId'] for x in out} == {'0', ''}
    assert next(x for x in out if x['recordId'])['applicability']['pageRefs'] == ['/work/crystals']
    assert len(store.prompt()) == 3  # Routing can still compare candidate pages.


def test_generic_count_is_not_a_missing_business_rule_but_population_is_required():
    t = task(requestedMeasures=['count'], businessFocus='awaiting review')
    requirements = knowledge_requirements(t)
    assert not any(r['id'] == 'measure_0' for r in requirements)
    assert any(r['id'] == 'population' and r['value'] == 'awaiting review' for r in requirements)


def coverage_fixture():
    k = KnowledgeStore()
    k.add({'chunks': [chunk('a', 1, 'Closed tasks include cancelled records.'),
                      chunk('a', 2, 'Closed tasks exclude cancelled records.')]})
    citations = [{'sourceId': d['passages'][0]['sourceId']} for d in k.prompt()]
    t = task(recordIdentity='', requestedScope='unknown', timeRange='unknown', groupBy=[], filters=[],
             requestedMeasures=[], businessFocus='', view='')
    data = {'stage': 'knowledge_coverage', 'checks': [{'requirementId': r['id'], 'status': 'partial',
             'reason': 'A definition is incomplete.', 'evidence': citations[:1]} for r in knowledge_requirements(t)]}
    return t, k, citations, data


def test_coverage_requires_all_requirements_and_real_citations():
    t, k, refs, data = coverage_fixture()
    validate_coverage(KnowledgeCoverage.model_validate(data), t, k)
    incomplete = copy.deepcopy(data); incomplete['checks'].pop()
    with pytest.raises(PipelineError, match='knowledge_requirement_coverage_invalid'):
        validate_coverage(KnowledgeCoverage.model_validate(incomplete), t, k)
    data['checks'][0].update(status='covered', evidence=[{'sourceId': 'invented'}])
    with pytest.raises(PipelineError, match='knowledge_citation_invalid'):
        validate_coverage(KnowledgeCoverage.model_validate(data), t, k)


def test_conflict_requires_distinct_passages_and_is_not_resolved_by_ranking():
    t, k, refs, data = coverage_fixture()
    data['checks'][0].update(status='conflicting', evidence=refs[:1])
    with pytest.raises(PipelineError, match='knowledge_conflict_evidence_missing'):
        validate_coverage(KnowledgeCoverage.model_validate(data), t, k)
    data['checks'][0]['evidence'] = refs
    validate_coverage(KnowledgeCoverage.model_validate(data), t, k)


def test_same_filename_in_different_sources_requires_scope_verification():
    t, k, refs, data = coverage_fixture()
    k.add({'chunks': [chunk('different-version', 0, 'A different scope includes archived records.')]})
    k.prompt()
    # Select by document identity, not filename or current prompt ordering.
    last = next(pid for pid, (key, _) in k.passages.items() if k.items[key]['documentId'] == 'different-version')
    data['checks'][0].update(status='conflicting', evidence=[refs[0], {'sourceId': last}])
    plan = KnowledgeCoverage.model_validate(data)
    validate_coverage(plan, t, k)
    assert plan.checks[0].status == 'partial'
    assert 'scope/version' in plan.checks[0].reason


def test_semantic_followups_are_bounded_and_unconfirmed_is_preserved():
    t, k, refs, data = coverage_fixture()
    class CoveragePlanner:
        calls = 0
        async def generic_reader_json(self, **kwargs):
            self.calls += 1
            return {**data, 'checks': [{**c, 'followupQuery': 'Crystal closure conditions'} for c in data['checks']]}
    planner, gateway = CoveragePlanner(), Gateway()
    reader = GenericKnowledgeReader(gateway, planner, portal_base_url='https://portal.test')
    reader.knowledge = k; reader.deadline = time.monotonic() + 60; reader.secrets = ()
    asyncio.run(reader.check_knowledge(Principal('person-1', 'tenant', 'req'), t))
    assert planner.calls == 3 and gateway.events == ['knowledge.search']
    result = reader.finish(task=t).result.public_json()
    assert 'knowledge_requirements_incomplete' in result['missing']
    assert not result['knowledgeRequirementsSatisfied']


def test_full_pipeline_uses_separate_business_and_field_queries():
    class CaptureGateway(Gateway):
        queries = []
        async def invoke(self, principal, name, arguments, **kwargs):
            if name == 'knowledge.search': self.queries.append(copy.deepcopy(arguments))
            return await super().invoke(principal, name, arguments, **kwargs)
    gateway = CaptureGateway()
    reader = GenericKnowledgeReader(gateway, Planner(), portal_base_url='https://portal.test')
    outcome = asyncio.run(reader.run(Principal('person-1', 'tenant', 'req'), 'How many open crystals do I have?'))
    assert [q['retrieval']['purpose'] for q in gateway.queries] == ['business', 'page_fields']
    assert '/work/' not in gateway.queries[0]['query'] and '/work/crystals' in gateway.queries[1]['query']
    assert outcome.result.public_json()['knowledgeRequirementCoverage']


def test_catalog_routing_proofs_survive_large_reference_pool():
    store = KnowledgeStore()
    store.add({'chunks': [chunk(str(i), 0, 'Business explanation ' + str(i)) for i in range(32)]})
    store.add({'chunks': [{'id': 'catalog:authorized', 'source_name': 'page-catalog#authorized',
                          'content': 'Authorized candidate /work/crystals'}]})
    out = store.prompt()
    assert len(out) == 32
    assert any('Authorized candidate' in p['text'] for d in out for p in d['passages'])


def test_consistency_review_can_reject_optimistic_initial_coverage():
    t, k, refs, data = coverage_fixture()
    class ChallengePlanner:
        async def generic_reader_json(self, *, data: dict, **kwargs):
            if 'conflicts' in data:
                return {'stage': 'knowledge_conflict_review', 'checks': [
                    {'requirementId': c['requirementId'], 'relation': 'conflicting',
                     'leftContext': 'Current closed tasks', 'rightContext': 'Current closed tasks',
                     'evidence': refs, 'reason': 'Same context has opposing inclusion rules.'}
                    for c in data['conflicts']]}
            status = 'conflicting' if data.get('phase') == 'consistency_review' else 'covered'
            return {'stage': 'knowledge_coverage', 'checks': [{'requirementId': r['id'], 'status': status,
                'reason': 'Competing include/exclude definitions.' if status == 'conflicting' else 'Initially interpreted definition.',
                'evidence': refs} for r in data['requirements']]}
    reader = GenericKnowledgeReader(Gateway(), ChallengePlanner(), portal_base_url='https://portal.test')
    reader.knowledge = k; reader.deadline = time.monotonic() + 60; reader.secrets = ()
    with pytest.raises(PipelineError, match='knowledge_definition_conflict'):
        asyncio.run(reader.check_knowledge(Principal('person-1', 'tenant', 'req'), t))
    assert all(c['status'] == 'conflicting' for c in reader.knowledge_requirement_coverage)


@pytest.mark.parametrize('live,relation,initial,expected', [
    (False, 'compatible', 'covered', 'covered'), (True, 'compatible', 'covered', 'covered'),
    (False, 'undetermined', 'covered', 'partial'), (True, 'undetermined', 'covered', 'partial'),
    (True, 'compatible', 'partial', 'partial'), (False, 'compatible', 'partial', 'partial')])
def test_different_view_definitions_are_not_automatically_conflicting(live, relation, initial, expected):
    t, _, _, _ = coverage_fixture(); t.needsLiveData = live
    k = KnowledgeStore()
    k.add({'chunks': [chunk('views', 0, 'The current-state view counts the records currently closed.'),
                      chunk('views', 1, 'The history view counts closure events, including reopened records.')]})
    refs = [{'sourceId': d['passages'][0]['sourceId']} for d in k.prompt()]
    class ScopePlanner:
        async def generic_reader_json(self, *, data, **kwargs):
            if 'conflicts' in data:
                return {'stage': 'knowledge_conflict_review', 'checks': [
                    {'requirementId': c['requirementId'], 'relation': relation,
                     'leftContext': 'Current-state records', 'rightContext': 'Historical closure events',
                     'evidence': refs, 'reason': 'The documented views describe different populations.'}
                    for c in data['conflicts']]}
            return {'stage': 'knowledge_coverage', 'checks': [{'requirementId': r['id'],
                'status': 'conflicting' if data.get('phase') else initial, 'evidence': refs,
                'reason': 'Two counts use distinct documented views.'} for r in data['requirements']]}
    reader = GenericKnowledgeReader(Gateway(), ScopePlanner(), portal_base_url='https://portal.test')
    reader.knowledge = k; reader.deadline = time.monotonic() + 60; reader.secrets = ()
    asyncio.run(reader.check_knowledge(Principal('person-1', 'tenant', 'req'), t))
    assert all(c['status'] == expected for c in reader.knowledge_requirement_coverage)
