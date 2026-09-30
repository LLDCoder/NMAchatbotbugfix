import copy
import json
from pathlib import Path

import pytest

from app.generic_reader import KnowledgeStore
from app.generic_reader_contracts import AnalysisPlan, TaskSpec
from app.reader_empty_display import empty_list_shape_proof
from app.reader_requirements import validate_requirements, requirements_for

ROOT = Path(__file__).parent / 'fixtures/empty_display'


def fixture():
    raw = json.loads((ROOT / 's09_en_round9.json').read_text())
    task = TaskSpec.model_validate(raw['task'])
    plan = AnalysisPlan.model_validate(raw['plan'])
    source = raw['source']
    # Audit compacted the receipt rows. Both signed row/total hashes and the
    # complete stable receipt certify the unique reconstruction [] / 0.
    source['data'] = {'isSuccess': True, 'statusCode': 200,
                      'data': {'page': {'items': [], 'total': 0}}}
    output = raw['output']; output['role'] = 'detail'
    sources = {source['sourceId']: source}
    lineage = {output['id']: output['evidence']}
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'round9-active-record', 'content': (ROOT / 'knowledge.json').read_text()}]})
    knowledge.add({'chunks': [{'id': 'round9-view-record', 'content': (ROOT / 'routing.json').read_text()}]})
    knowledge.intent_lexical_context = {"requirements": requirements_for(task)}
    knowledge.prompt()
    return task, plan, sources, knowledge, [output], lineage


def proof(f):
    task, plan, sources, _, outputs, lineage = f
    return empty_list_shape_proof(task, outputs[0], plan.steps, sources, lineage[outputs[0]['id']])


def test_actual_round9_audit_empty_list_satisfies_shape_with_original_context():
    f = fixture()
    requirements, coverage, missing = validate_requirements(*f)
    assert all(item['status'] == 'satisfied' for item in coverage)
    assert f[4][0]['role'] == 'detail'
    assert f[4][0]['value'] == []
    assert f[4][0]['emptyListProof']['covers'] == 'unspecified_list_shape_only'
    assert {x['id'] for x in coverage} == {'object', 'grain', 'scope', 'population', 'view', 'detail'}


@pytest.mark.parametrize('fault', [
    'requested_attribute', 'detail_record_shape', 'nonempty_output', 'unknown_output',
    'missing_lineage', 'incomplete_lineage', 'wrong_source_lineage', 'different_capture',
    'different_principal', 'filtered_to_empty', 'truncated', 'preview_only',
    'collection_failure', 'incomplete_source', 'missing_total', 'null_total',
    'positive_total', 'bool_total', 'missing_receipt', 'single_pass', 'changed_second_pass',
    'hash_mismatch', 'different_context', 'different_operation', 'different_path',
    'failed_response', 'forbidden_response', 'nonempty_source', 'nonempty_receipt',
    'missing_observation', 'missing_principal', 'unknown_collection_mode',
    'different_first_pass', 'changed_identity',
])
def test_unverified_or_nonempty_data_does_not_gain_shape_proof(fault):
    f = fixture(); task, plan, sources, _, outputs, lineage = f
    source = next(iter(sources.values())); output = outputs[0]; receipt = source['collectionReceipt']; ref = lineage[output['id']][0]
    if fault == 'requested_attribute': task.requestedAttributes = ['status']
    elif fault == 'detail_record_shape': task.outputShape = 'detail'
    elif fault == 'nonempty_output': output['value'] = [{'id': 'other'}]
    elif fault == 'unknown_output': output['unknownCount'] = 1
    elif fault == 'missing_lineage': lineage[output['id']] = []
    elif fault == 'incomplete_lineage': ref['completeness'] = 'bounded'
    elif fault == 'wrong_source_lineage': ref['sourceId'] = 'another'
    elif fault == 'different_capture': ref['capturedAt'] = 'another'
    elif fault == 'different_principal': ref['principalScopeRef'] = 'another'
    elif fault == 'filtered_to_empty': plan.steps[-1].op = 'filter'
    elif fault == 'truncated': source['truncated'] = True
    elif fault == 'preview_only': source['kind'] = 'api_response'
    elif fault == 'collection_failure': source['collectionFailure'] = 'collection_http_403'
    elif fault == 'incomplete_source': source['completeness'] = 'bounded'
    elif fault == 'missing_total': del source['data']['data']['page']['total']
    elif fault == 'null_total': source['data']['data']['page']['total'] = None
    elif fault == 'positive_total': source['data']['data']['page']['total'] = 1
    elif fault == 'bool_total': source['data']['data']['page']['total'] = False
    elif fault == 'missing_receipt': source['collectionReceipt'] = {}
    elif fault == 'single_pass': receipt['stablePasses'] = 1
    elif fault == 'changed_second_pass': receipt['comparison']['equivalent'] = False
    elif fault == 'hash_mismatch': receipt['projectionHash'] = 'a' * 64
    elif fault == 'different_context': source['collectionContext']['contextRef'] = 'a' * 64
    elif fault == 'different_operation': source['operationRef'] = 'POST /another'
    elif fault == 'different_path': receipt['rowsPath'] = '/another'
    elif fault == 'failed_response': source['data']['isSuccess'] = False
    elif fault == 'forbidden_response': source['data']['statusCode'] = 403
    elif fault == 'nonempty_source': source['data']['data']['page']['items'] = [{'id': 'a'}]
    elif fault == 'nonempty_receipt': receipt['rowCount'] = receipt['total'] = 1
    elif fault == 'missing_observation': del source['observationRef']
    elif fault == 'missing_principal': del source['principalScopeRef']
    elif fault == 'unknown_collection_mode': source['collectionContext']['mode'] = 'unknown'
    elif fault == 'different_first_pass': receipt['comparison']['firstRowCount'] = 1
    elif fault == 'changed_identity': receipt['comparison']['changedIdentityCount'] = 1
    assert proof(f) is None


@pytest.mark.parametrize('missing_context', ['object', 'grain', 'scope', 'population'])
def test_empty_display_never_replaces_business_context(missing_context):
    f = fixture()
    f[1].requirementBindings = [b for b in f[1].requirementBindings if b.requirementId != missing_context]
    requirements, coverage, missing = validate_requirements(*f)
    detail = next(item for item in coverage if item['id'] == 'detail')
    assert detail['status'] == 'unfulfilled'
    assert detail['reason'] == 'requested_context_unverified'
    assert f[4][0]['role'] == 'observation'


def test_empty_display_does_not_substitute_another_view():
    f = fixture(); next(iter(f[2].values()))['verifiedView'] = 'Completed'
    requirements, coverage, missing = validate_requirements(*f)
    assert next(x for x in coverage if x['id'] == 'view')['status'] == 'unfulfilled'
    assert next(x for x in coverage if x['id'] == 'detail')['status'] == 'unfulfilled'
