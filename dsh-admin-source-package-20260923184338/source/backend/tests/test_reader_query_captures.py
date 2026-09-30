"""Collection scope uses its own receipt, never the initial page timestamp.

The sealed trace contains a real empty projection and provenance. Observation
filters below are synthetic controls, not reconstructed historical UI facts.
"""
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.reader_collection import projection_hash
from app.reader_previous_answer import query_receipt
from app.reader_query_captures import (collection_query_capture, matching_query_captures,
                                     query_capture_matches)
from test_reader_partial_answer import TRACE, envelope, project


SEALED = json.loads(Path(__file__).with_name('fixtures').joinpath('group15_collection_scope_trace.json').read_text())


def fixture():
    source = deepcopy(SEALED['source'])
    receipt = source['collectionReceipt']
    assert receipt['rowCount'] == receipt['total'] == 0
    assert receipt['projectionHash'] == projection_hash([])
    source['data'] = {'data': {'page': {'items': [], 'total': 0}}}
    observation = {'appliedFilters': [{'label': 'Status', 'value': 'Pending'}],
                   'readHealth': {'healthy': True, 'failed': [], 'blocked': [], 'pending': [], 'uncertain': []}}
    return source, observation


def capture():
    source, observation = fixture()
    return collection_query_capture(source['sourceId'], source, observation)


def audit_with_capture():
    audit = deepcopy(TRACE['audit'])
    audit['querySourceCaptures'] = [capture()]
    return audit


def test_actual_receipt_time_and_source_provenance_are_used_without_changing_initial_capture():
    source, observation = fixture()
    before = deepcopy(source)
    observed = collection_query_capture(source['sourceId'], source, observation)
    assert observed['capturedAt'] == source['collectionReceipt']['finishedAt']
    assert observed['capturedAt'] != TRACE['audit']['captures'][0]['capturedAt']
    assert observed['sourceId'] == source['sourceId']
    assert observed['observationRef'] == source['observationRef']
    assert observed['collectionContextRef'] == source['collectionContext']['contextRef']
    assert source == before
    assert observed['appliedFilters'] == observation['appliedFilters']
    observation['appliedFilters'][0]['value'] = 'Completed'
    assert observed['appliedFilters'][0]['value'] == 'Pending'


@pytest.mark.parametrize('fault', ['bounded', 'truncated', 'failed', 'wrong_time', 'naive_time',
    'wrong_operation', 'wrong_context', 'missing_scope', 'missing_observation', 'missing_page',
    'invalid_hash', 'wrong_total', 'changed_rows', 'one_pass', 'unhealthy', 'pending',
    'missing_filters', 'private_filter', 'missing_data'])
def test_unverified_collection_or_filter_envelope_cannot_create_a_query_capture(fault):
    source, observation = fixture()
    if fault == 'bounded': source['completeness'] = 'bounded'
    elif fault == 'truncated': source['truncated'] = True
    elif fault == 'failed': source['collectionFailure'] = 'collection_changed_during_read'
    elif fault == 'wrong_time': source['capturedAt'] = TRACE['audit']['captures'][0]['capturedAt']
    elif fault == 'naive_time': source['capturedAt'] = source['collectionReceipt']['finishedAt'] = '2026-09-28T12:34:41'
    elif fault == 'wrong_operation': source['operationRef'] = 'other-operation'
    elif fault == 'wrong_context': source['collectionContext']['contextRef'] = '0' * 64
    elif fault == 'missing_scope': source.pop('principalScopeRef')
    elif fault == 'missing_observation': source.pop('observationRef')
    elif fault == 'missing_page': source.pop('page')
    elif fault == 'invalid_hash': source['collectionReceipt']['projectionHash'] = '0' * 64
    elif fault == 'wrong_total': source['data']['data']['page']['total'] = 1
    elif fault == 'changed_rows': source['data']['data']['page']['items'] = [{'id': 'new'}]
    elif fault == 'one_pass': source['collectionReceipt']['stablePasses'] = 1
    elif fault == 'unhealthy': observation['readHealth']['healthy'] = False
    elif fault == 'pending': observation['readHealth']['pending'] = ['unfinished-read']
    elif fault == 'missing_filters': observation.pop('appliedFilters')
    elif fault == 'private_filter': observation['appliedFilters'] = [{'token': 'private-value'}]
    elif fault == 'missing_data': source.pop('data')
    assert collection_query_capture(source['sourceId'], source, observation) is None


def test_partial_query_scope_uses_verified_collection_capture_and_retains_uncertainty():
    audit = audit_with_capture(); initial = deepcopy(audit['captures'])
    env = envelope()
    env['result']['queryReceipt'] = query_receipt(env['result'], audit)
    receipt = env['result']['queryReceipt']
    assert receipt['captures'] == [{k: v for k, v in capture().items() if k != 'bindingVerification'}]
    assert audit['captures'] == initial
    value = project(env, kind='query_scope')
    assert value['verified'] and value['businessResultComplete'] is False
    assert value['sourceMissing'] == TRACE['result']['missing']
    assert value['observedFilters'] == capture()['appliedFilters']
    assert value['rowScopeVerified'] is False and value['liveDataRead'] is False


@pytest.mark.parametrize('field', ['sourceId', 'principalScopeRef', 'observationRef', 'operationRef',
                                  'sourcePath', 'collectionContextRef', 'collectionReceiptHash'])
def test_bad_collection_capture_cannot_fall_back_to_same_page_timestamp(field):
    audit = audit_with_capture()
    ref = TRACE['result']['outputs'][0]['evidence'][0]
    audit['captures'][0]['capturedAt'] = ref['capturedAt']
    audit['querySourceCaptures'][0][field] = ''
    assert matching_query_captures([ref], audit) is None


def test_conflicting_observed_filters_for_one_source_are_not_selected_arbitrarily():
    audit = audit_with_capture()
    other = deepcopy(audit['querySourceCaptures'][0]); other['appliedFilters'] = []
    audit['querySourceCaptures'].append(other)
    refs = TRACE['result']['outputs'][0]['evidence']
    assert matching_query_captures(refs, audit) is None


def test_duplicate_capture_is_deduplicated_but_all_evidence_sources_require_captures():
    audit = audit_with_capture(); audit['querySourceCaptures'].append(deepcopy(capture()))
    refs = deepcopy(TRACE['result']['outputs'][0]['evidence'])
    assert matching_query_captures(refs, audit) == [capture()]
    extra = deepcopy(refs[0]); extra['sourceId'] = 'another'; extra['page'] = '/another'
    assert matching_query_captures([*refs, extra], audit) is None


def test_consuming_receipt_also_rejects_an_output_source_with_no_capture():
    env = envelope(); audit = audit_with_capture()
    env['result']['queryReceipt'] = query_receipt(env['result'], audit)
    extra = deepcopy(env['result']['outputs'][0]['evidence'][0])
    extra['sourceId'] = 'different-source'; extra['observationRef'] = 'different-observation'
    env['result']['outputs'][0]['evidence'].append(extra)
    env['result']['queryReceipt']['sourceRefs'].append({k: extra[k] for k in
        ('page', 'capturedAt', 'observationRef', 'sourceId', 'principalScopeRef', 'completeness') if k in extra})
    assert project(env, kind='query_scope')['reason'] == 'previous_query_receipt_unverified'


def test_legacy_page_capture_matching_does_not_accept_unknown_provenance_kind():
    ref = TRACE['result']['outputs'][0]['evidence'][0]
    value = {'page': ref['page'], 'capturedAt': ref['capturedAt']}
    assert query_capture_matches(value, ref)
    value['source'] = 'model_assertion'
    assert not query_capture_matches(value, ref)


@pytest.mark.parametrize('fault', ['', 'wrong_route', 'wrong_context', 'changed_rows'])
def test_executor_records_scope_only_after_actual_collection_validation(fault):
    import asyncio
    from types import SimpleNamespace
    from app.generic_reader import GenericKnowledgeReader, KnowledgeStore, PipelineError
    from app.generic_reader_contracts import CollectionPlan, TaskSpec
    from test_reader_empty_collection_planning import empty_fixture, compile_empty, collect

    _, _, spec, old_knowledge, source, _ = empty_fixture()
    record = deepcopy(old_knowledge.items['k']['record'])
    record.update(kind='field_semantics', sources=[{'reference': '/specimens'}])
    record['applicability'].update(portal='admin', environments=['local'])
    record['payload']['pagination'] = {'rowsPath': spec.rowsPath, 'totalPath': spec.totalPath,
        spec.pageField: 'Page number', spec.sizeField: 'Page size'}
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'content': json.dumps({'records': [record]})}]})
    evidence = [{'sourceId': knowledge.prompt()[0]['passages'][0]['sourceId']}]
    plan = CollectionPlan.model_validate({'stage': 'collection', 'collections': [{
        'sourceId': 'queue', 'rowsPath': spec.rowsPath, 'totalPath': spec.totalPath,
        'pageField': spec.pageField, 'sizeField': spec.sizeField, 'fields': ['specimenKey', 'clock'],
        'identityFields': ['specimenKey'], 'evidence': evidence}]})
    source['collectionContext']['requestFields'] = [spec.pageField, spec.sizeField]
    source.update(page='/specimens', principalScopeRef='current-principal',
                  capturedAt='2026-09-01T00:00:00+00:00', observationRef='initial-page')
    _, captured, gateway_spec, _ = compile_empty()
    receipt, calls = collect([], captured, gateway_spec)
    assert len(calls) == 2
    if fault == 'wrong_context': receipt['contextRef'] = '0' * 64
    if fault == 'changed_rows': receipt['rows'] = [{'specimenKey': 'unexpected'}]
    observed = {'pageIdentity': {'path': '/other' if fault == 'wrong_route' else '/specimens'},
        'metrics': [{'label': 'Total', 'value': '0'}], 'collections': [receipt],
        'appliedFilters': [{'label': 'Zone', 'value': 'East'}],
        'readHealth': {'healthy': True, 'failed': [], 'blocked': [], 'pending': [], 'uncertain': []}}
    class Gateway:
        async def invoke(self, principal, name, payload, **kwargs):
            assert payload['collections'][0]['contextRef'] == source['collectionContext']['contextRef']
            return {'ok': True, 'result': {'page': '/specimens', 'observation': observed}}
    reader = GenericKnowledgeReader(Gateway(), None, portal_base_url='https://portal.test')
    reader.page = '/specimens'; reader.knowledge = knowledge; reader.secrets = []
    async def structured(contract, prompt, data, validator):
        validator(plan)
        return plan
    async def call(stage, awaitable, timeout):
        return await awaitable
    reader.structured = structured; reader.call = call
    task = TaskSpec(stage='task', businessObject='specimen', requestedGrain='specimen', requestedScope='personal',
        requestedMeasures=[], requestedAttributes=[], groupBy=[], timeRange='unknown', filters=[],
        outputShape='list', needsLiveData=True, readOnly=True, searchQuery='specimen', unresolvedSlots=[])
    run = lambda: asyncio.run(reader.collect_sources(SimpleNamespace(user_id='current-principal'), task,
        SimpleNamespace(as_payload=lambda: {}), {}, {'queue': source}))
    if fault == 'wrong_route':
        with pytest.raises(PipelineError, match='collection_page_mismatch'):
            run()
    else:
        run()
    if fault:
        assert not reader.audit.get('querySourceCaptures')
    else:
        saved = reader.audit['querySourceCaptures'][0]
        assert saved['capturedAt'] == receipt['finishedAt']
        assert saved['observationRef'] != 'initial-page'
        assert saved['sourceId'] == 'queue' and saved['principalScopeRef'] == 'current-principal'
        assert saved['appliedFilters'] == observed['appliedFilters']
        assert source['collectionReceipt']['derivation']
