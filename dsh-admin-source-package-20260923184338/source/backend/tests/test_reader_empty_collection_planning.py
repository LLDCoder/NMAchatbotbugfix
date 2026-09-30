"""An attested empty preview can plan fields, but only stable collection proves zero."""
import copy

import pytest

from app.generic_reader import PipelineError, source_inventory
from app.reader_collection import checked_collections, has_attested_empty_page, projection_hash
from app.reader_derivations import apply_derivations, compile_derivations
from test_reader_clock_and_identity import fixture, collect, gateway


def empty_fixture():
    rows, captured, spec, knowledge, source, rule = fixture()
    payload = {'isSuccess': True, 'data': {'items': [], 'total': 0}}
    source.update(kind='api_response', truncated=False, data=payload,
        fieldEvidence=gateway._reader_field_evidence(payload, payload),
        collectionContext={'mode': 'page_number_two_pass', 'contextRef': captured['contextRef'],
            'parameterHashes': {spec.pageField: projection_hash(spec.firstPage)},
            'rowSchemas': gateway._collection_row_schemas(payload)})
    return rows, captured, spec, knowledge, source, rule


def compile_empty():
    rows, captured, spec, knowledge, source, rule = empty_fixture()
    assert has_attested_empty_page(source, spec)
    compiled = compile_derivations(knowledge, '/specimens', source, spec)
    spec.fields = compiled['fields']
    spec.unknownPolicy = 'report'  # Matches the backend CollectionSpec default.
    return rows, captured, spec, compiled


def test_attested_empty_preview_still_requires_two_real_collection_passes():
    _, captured, spec, compiled = compile_empty()
    receipt, calls = collect([], captured, spec)
    assert len(calls) == 2 and receipt['stablePasses'] == 2
    assert checked_collections([receipt])[0]['completeness'] == 'complete'
    result = apply_derivations(receipt, compiled)
    assert result['rows'] == [] and result['total'] == result['rowCount'] == 0
    assert result['fields'] == ['specimenKey', 'clock']
    assert result['derivation']['fieldDiagnostics']['clock'] == {
        'computedRows': 0, 'documentedNullRows': 0, 'unverifiedRows': 0}


@pytest.mark.parametrize('fault', [
    'truncated', 'missing_total', 'null_total', 'string_total', 'bool_total', 'positive_total',
    'missing_rows', 'nonempty_rows', 'field_hash_mismatch', 'incomplete_field_evidence',
    'missing_attestation', 'truncated_schema', 'other_first_page', 'failed_response', 'unknown_mode',
])
def test_incomplete_or_failed_preview_cannot_bypass_observation(fault):
    rows, captured, spec, knowledge, source, rule = empty_fixture()
    if fault == 'truncated': source['truncated'] = True
    elif fault == 'missing_total': del source['data']['data']['total']
    elif fault == 'null_total': source['data']['data']['total'] = None
    elif fault == 'string_total': source['data']['data']['total'] = '0'
    elif fault == 'bool_total': source['data']['data']['total'] = False
    elif fault == 'positive_total': source['data']['data']['total'] = 5
    elif fault == 'missing_rows': del source['data']['data']['items']
    elif fault == 'nonempty_rows': source['data']['data']['items'] = rows[:1]
    elif fault == 'field_hash_mismatch': source['fieldEvidence'][spec.rowsPath]['valueHash'] = '0' * 64
    elif fault == 'incomplete_field_evidence': source['fieldEvidence'][spec.totalPath]['status'] = 'truncated'
    elif fault == 'missing_attestation': source['fieldEvidence'] = {}
    elif fault == 'truncated_schema': source['collectionContext']['rowSchemas'][0]['fieldsTruncated'] = True
    elif fault == 'other_first_page': source['collectionContext']['parameterHashes'][spec.pageField] = projection_hash(2)
    elif fault == 'failed_response': source['data']['isSuccess'] = False
    elif fault == 'unknown_mode': source['collectionContext']['mode'] = 'unknown'
    assert not has_attested_empty_page(source, spec)
    with pytest.raises(PipelineError, match='collection_derivation_inputs_unverified'):
        compile_derivations(knowledge, '/specimens', source, spec)


def test_empty_preview_never_invents_undocumented_formula_fields():
    _, _, spec, knowledge, source, rule = empty_fixture()
    rule['startField'] = 'unrecorded'
    with pytest.raises(PipelineError, match='collection_derivation_inputs_unverified'):
        compile_derivations(knowledge, '/specimens', source, spec)


def test_new_rows_after_empty_preview_are_collected_and_computed_from_actual_fields():
    rows, captured, spec, compiled = compile_empty()
    receipt, calls = collect(rows, captured, spec)
    assert len(calls) == 2 and receipt['total'] == 3
    receipt['startedAt'] = '2026-09-01T07:00:00+00:00'
    result = apply_derivations(checked_collections([receipt])[0], compiled)
    assert [r['clock'] for r in result['rows']] == [60, 30, None]
    assert result['total'] == 3


def test_new_rows_missing_formula_input_remain_unverified_not_zero():
    rows, captured, spec, compiled = compile_empty()
    del rows[0]['due']
    receipt, _ = collect(rows, captured, spec)
    result = apply_derivations(checked_collections([receipt])[0], compiled)
    assert result['fieldStatus']['clock'] == 'collection_derivation_unverified'
    assert result['rows'][0]['clock'] is None and result['total'] == 3


@pytest.mark.parametrize('fault', ['missing_identity', 'incomplete_page', 'permission_response', 'changes_between_passes'])
def test_final_collection_failure_cannot_be_replaced_by_the_initial_empty_preview(fault):
    rows, captured, spec, compiled = compile_empty()
    def change(payload, params, count):
        if fault == 'missing_identity':
            del payload['data']['items'][0]['specimenKey']
        elif fault == 'incomplete_page': payload['data']['items'] = []
        elif fault == 'permission_response': return {'isSuccess': False, 'statusCode': 403, 'data': {'items': [], 'total': 0}}
        elif fault == 'changes_between_passes' and count == 1: return {'data': {'items': [], 'total': 0}}
        return payload
    receipt, _ = collect(copy.deepcopy(rows), captured, spec, change)
    checked = checked_collections([receipt])[0]
    assert checked['completeness'] == 'incomplete'
    assert apply_derivations(checked, compiled)['completeness'] == 'incomplete'
    assert 'rows' not in checked and 'total' not in checked


def test_denied_upstream_is_never_an_attested_api_source():
    _, _, spec, _, source, _ = empty_fixture()
    candidate = {'operationKey': 'POST /api/specimens/list', 'policyState': 'allowed', 'status': 403,
        'responseEvidence': source['data'], 'fieldEvidence': source['fieldEvidence'],
        'collectionContext': source['collectionContext']}
    result = source_inventory({'apiDiscovery': {'candidates': [candidate]}}, '/specimens', 'now', 'principal')
    assert not any(s['kind'] == 'api_response' for s in result.values())


def test_real_collection_planner_accepts_documented_empty_identity_but_still_calls_gateway():
    import asyncio
    import json
    from types import SimpleNamespace
    from app.generic_reader import GenericKnowledgeReader, KnowledgeStore
    from app.generic_reader_contracts import CollectionPlan, TaskSpec

    _, _, spec, old_knowledge, source, _ = empty_fixture()
    record = copy.deepcopy(old_knowledge.items['k']['record'])
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
    calls = []
    class ReachedGateway(Exception): pass
    class Gateway:
        async def invoke(self, principal, name, payload, **kwargs):
            calls.append(payload)
            raise ReachedGateway()
    reader = GenericKnowledgeReader(Gateway(), None, portal_base_url='https://portal.test')
    reader.page = '/specimens'; reader.knowledge = knowledge; reader.secrets = []
    async def structured(contract, prompt, data, validator):
        validator(plan)
        return plan
    async def call(stage, awaitable, timeout): return await awaitable
    reader.structured = structured; reader.call = call
    task = TaskSpec(stage='task', businessObject='specimen', requestedGrain='specimen', requestedScope='personal',
        requestedMeasures=[], requestedAttributes=[], groupBy=[], timeRange='unknown', filters=[],
        outputShape='list', needsLiveData=True, readOnly=True, searchQuery='specimen', unresolvedSlots=[])
    with pytest.raises(ReachedGateway):
        asyncio.run(reader.collect_sources(SimpleNamespace(), task, SimpleNamespace(as_payload=lambda: {}), {}, {'queue': source}))
    assert len(calls) == 1
    collection = calls[0]['collections'][0]
    assert collection['identityFields'] == ['specimenKey']
    assert {'specimenKey', 'due', 'closed', 'phase', 'node'} == set(collection['fields'])
    assert reader.audit['emptyCollectionPlanning'][0]['requiredVerification'] == 'same_context_stable_two_pass_receipt'
    assert 'collections' not in reader.audit  # Planning did not fabricate a completed receipt.
