"""Replay real clarification failure and verify exact page-defined ID alternatives.

Saved production receipts are evidence of the bug; synthetic fixtures exercise
implementation boundaries and never represent a new live business acceptance.
"""
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.generic_reader import PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_context import merge_task, refine_task, save_intent, validate_record_identity
from app.reader_record_request import (canonical_record_set_task, filter_record_identifiers,
    validate_record_set_outputs)
from app.reader_requirements import semantic_bindings
from test_reader_multi_record_identity import record_set_fixture, run_record_set


FIXTURES = Path(__file__).parent / 'fixtures'
REPLAY = json.loads((FIXTURES / 'group17-record-set-live-replay.json').read_text())


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_actual_business_type_clarification_preserves_set_through_all_boundaries(language):
    observed = REPLAY[language]
    first = TaskSpec.model_validate(observed['firstTask'])
    history = {'previousIntent': {**first.model_dump(), 'task': first.model_dump(),
        'slotStates': [s.model_dump() for s in first.slotUpdates],
        'originalQuestion': observed['originalQuestion']}}
    actual = TaskSpec.model_validate(observed['clarifiedTask'])
    merged = merge_task(actual, history, observed['choice'])
    assert merged.recordIdentity == ''
    assert merged.filters == first.filters
    assert merged.requestedGrain == merged.businessObject == 'transaction'
    refined = refine_task(merged, actual)
    assert refined.recordIdentity == '' and refined.filters == first.filters
    assert refined.requestedGrain == 'transaction'
    validate_record_identity(refined, observed['selectedLabel'], history)
    saved = save_intent(refined, observed['selectedLabel'], history, 'replay', 'same-scope', 'v1', {})
    assert saved['task']['recordIdentity'] == ''
    assert saved['originalQuestion'] == observed['originalQuestion']
    # The next genuine same-conversation turn must not resurrect the stale scalar.
    following = merge_task(refined.model_copy(update={'contextRelation': 'continue', 'slotUpdates': []}),
        {'previousIntent': saved})
    assert following.recordIdentity == '' and following.filters == first.filters


def test_actual_refinement_cannot_restore_the_english_concatenated_scalar():
    first = TaskSpec.model_validate(REPLAY['en']['firstTask'])
    repaired = first.model_copy(update={'recordIdentity': '', 'slotUpdates': []})
    refined = refine_task(first, repaired)
    assert refined.recordIdentity == ''
    assert next(s for s in refined.slotUpdates if s.field == 'recordIdentity').source == 'clear'
    saved = save_intent(first, REPLAY['en']['originalQuestion'], {}, 'replay', 'scope', 'v1', {})
    assert saved['task']['recordIdentity'] == ''


def test_saved_273_receipt_does_not_prove_reference_number_absence():
    from app.reader_lookup_absence import verified_lookup_absence
    from app.reader_routing import locate_record
    receipt = REPLAY['en']['observedCollectionReceipts'][0]
    assert receipt['total'] == receipt['rowCount'] == 273
    assert receipt['fields'] == ['id', 'transactionNo']
    assert receipt['projectionHash'] == '0f866c9a63661326cd047abec11902d57116db1a557cb42a6a5046e76732cd7a'
    broken = TaskSpec.model_validate(REPLAY['en']['clarifiedTask'])
    with pytest.raises(PipelineError, match='intent_multiple_record_identity'):
        verified_lookup_absence(broken, [], {})
    with pytest.raises(PipelineError, match='intent_multiple_record_identity'):
        locate_record(broken, [], {})
    assert verified_lookup_absence(canonical_record_set_task(broken), [], {}) is None


@pytest.mark.parametrize('fault', ['subset_scalar', 'different_set', 'duplicate_filter',
    'malformed_filter', 'numeric_and_valid', 'stale_wrong_scalar', 'detail_shape'])
def test_merged_record_set_rejects_non_equivalent_or_illegal_repairs(fault):
    first = TaskSpec.model_validate(REPLAY['en']['firstTask'])
    if fault == 'subset_scalar': first.recordIdentity = 'ML-2-804-9226243'
    elif fault == 'different_set': first.filters = ['record identifiers in ["ML-2-804-9226243", "ZZ-999"]']
    elif fault == 'duplicate_filter': first.filters *= 2
    elif fault == 'malformed_filter': first.filters = ['record identifiers in ["ML-2-804-9226243", null]']
    elif fault == 'numeric_and_valid': first.filters = ['record identifiers in ["ML-2-804-9226243", "123"]']
    elif fault == 'stale_wrong_scalar':
        first.recordIdentity = ''
        next(s for s in first.slotUpdates if s.field == 'recordIdentity').value = 'ZZ-999'
    else: first.outputShape = 'detail'
    with pytest.raises(PipelineError, match='intent_record_set_'):
        canonical_record_set_task(first)


@pytest.mark.parametrize('fault', ['explicit_grain', 'aggregate', 'no_choice', 'explicit_object'])
def test_type_clarification_does_not_replace_an_explicit_grain_or_aggregate(fault):
    first = TaskSpec.model_validate(REPLAY['ar']['firstTask'])
    old = first.model_dump()
    choice = copy.deepcopy(REPLAY['ar']['choice'])
    task = first.model_copy(update={'businessObject': 'transaction'})
    if fault == 'explicit_grain': old['requestedGrain'] = task.requestedGrain = 'application'
    elif fault == 'aggregate': task.requestedMeasures = ['count']
    elif fault == 'no_choice': choice = None
    else: old['businessObject'] = 'application'
    result = canonical_record_set_task(task, old, choice)
    assert result.requestedGrain == task.requestedGrain


def alternate_fixture():
    from test_projected_collection import gateway
    f = record_set_fixture()
    record = next(iter(f[3].items.values()))['record']
    record['payload']['recordSetLookups'] = [{'id': 'number_or_reference',
        'identifierFields': ['code', 'referenceNumber'], 'keyFields': ['key'],
        'operationRef': 'POST /api/specimens/list', 'sourcePath': '/data/items'}]
    data = f[2]['queue']['data']
    for row, code in zip(data['data']['items'], ['TX-111', 'TX-222', 'TX-333']):
        row['referenceNumber'], row['code'] = row['code'], code
    f[2]['queue']['fieldEvidence'] = gateway._reader_field_evidence(data, data)
    fact = next(x for x in semantic_bindings(f[3]) if x.get('compiledRecordSet'))
    f[1].steps[0].fields.append('referenceNumber')
    f[1].steps[-1].fields.append('referenceNumber')
    step = f[1].steps[1]
    step.op, step.field, step.fields = 'filter_identifiers', '', ['code', 'referenceNumber']
    step.knowledgeBindingId = fact['knowledgeBindingId']
    for binding in f[1].requirementBindings:
        if 'runtime_record_set_' in binding.knowledgeBindingId:
            binding.knowledgeBindingId = fact['knowledgeBindingId']
    return f


def test_legal_list_compiles_exact_or_and_keeps_each_entity_public_number():
    result = run_record_set(alternate_fixture())
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert result['outputs'][0]['value'] == [
        {'code': 'TX-111', 'phase': 'Warm', 'referenceNumber': 'AB-123'},
        {'code': 'TX-222', 'phase': 'Cold', 'referenceNumber': 'CD-456'}]
    proof = next(c['recordSetProof'] for c in result['requirementCoverage'] if c['kind'] == 'filter')
    assert proof['unobservedIdentifiers'] == [] and not proof['globalAbsence']


@pytest.mark.parametrize('fault', ['subset', 'nested_operand', 'wrong_operator', 'contains',
    'wrong_field', 'undeclared_field', 'unbound_step', 'hidden_reference', 'missing_second',
    'duplicate_reference', 'missing_field', 'coerced_field', 'wrong_page'])
def test_alternate_field_path_cannot_weaken_ids_or_claim_incomplete_success(fault):
    from test_projected_collection import gateway
    f = alternate_fixture(); step = f[1].steps[1]; data = f[2]['queue']['data']
    if fault == 'subset': step.operand = ['AB-123']
    elif fault == 'nested_operand': step.operand = ['AB-123', {'id': 'CD-456'}]
    elif fault == 'wrong_operator': step.op, step.field = 'filter', 'referenceNumber'
    elif fault == 'contains': step.predicate = 'contains'
    elif fault == 'wrong_field': step.field = 'referenceNumber'
    elif fault == 'undeclared_field': step.fields = ['referenceNumber']
    elif fault == 'unbound_step': step.knowledgeBindingId = ''
    elif fault == 'hidden_reference': f[1].steps[-1].fields.remove('referenceNumber')
    elif fault == 'missing_second': data['data']['items'].pop(1); data['data']['total'] = 2
    elif fault == 'duplicate_reference':
        data['data']['items'].append({'key': 4, 'code': 'TX-444', 'referenceNumber': 'AB-123', 'phase': 'Warm'})
        data['data']['total'] = 4
    elif fault == 'missing_field': del data['data']['items'][0]['referenceNumber']
    elif fault == 'coerced_field': data['data']['items'][0]['referenceNumber'] = 123
    else: f[2]['queue']['page'] = '/other'
    f[2]['queue']['fieldEvidence'] = gateway._reader_field_evidence(data, data)
    try:
        result = run_record_set(f)
    except PipelineError:
        return
    assert not result['requirementsSatisfied'], fault
    if fault == 'missing_second':
        proof = next(c['recordSetProof'] for c in result['requirementCoverage'] if c['kind'] == 'filter')
        assert proof['unobservedIdentifiers'] == ['CD-456'] and not proof['globalAbsence']


@pytest.mark.parametrize('field', ['principalScopeRef', 'capturedAt', 'observationRef'])
def test_outputs_cannot_merge_two_source_contexts_into_one_verified_set(field):
    f = alternate_fixture(); fact = next(x for x in semantic_bindings(f[3]) if x.get('compiledRecordSet'))
    source = f[2]['queue']; other = copy.deepcopy(source); other[field] = 'different'
    coverage = [{'id': 'filter', 'kind': 'filter', 'status': 'satisfied', 'outputIds': ['out']}]
    bindings = {'filter': [SimpleNamespace(sourceId=sid, knowledgeBindingId=fact['knowledgeBindingId'])
        for sid in ['one', 'two']]}
    outputs = [{'id': 'out', 'value': source['data']['data']['items'][:2],
        'evidence': [{'sourceId': 'one'}, {'sourceId': 'two'}]}]
    validate_record_set_outputs(coverage, {fact['knowledgeBindingId']: fact}, bindings,
        {'one': source, 'two': other}, outputs)
    assert coverage[0]['status'] == 'unfulfilled'


@pytest.mark.parametrize('fault', ['wrong_operation', 'wrong_path', 'no_provenance'])
def test_exact_or_needs_its_documented_runtime_operation_and_path(fault):
    f = alternate_fixture(); fact = next(x for x in semantic_bindings(f[3]) if x.get('compiledRecordSet'))
    ref = {'operationRef': fact['operationRef'], 'fieldBinding': fact['sourcePath']}
    if fault == 'wrong_operation': ref['operationRef'] = 'GET /unrelated'
    elif fault == 'wrong_path': ref['fieldBinding'] = '/unrelated'
    with pytest.raises(PipelineError, match='record_set_lookup_definition_required'):
        filter_record_identifiers(f[2]['queue']['data']['data']['items'], f[1].steps[1], fact,
            [] if fault == 'no_provenance' else [ref])


@pytest.mark.parametrize('fault', ['bad_field_type', 'restricted_field', 'duplicate_field',
    'wrong_entity_key', 'conflicting_definition', 'draft'])
def test_new_lookup_requires_unambiguous_active_field_and_entity_definition(fault):
    f = alternate_fixture(); record = next(iter(f[3].items.values()))['record']
    definition = record['payload']['recordSetLookups'][0]
    if fault == 'bad_field_type': definition['identifierFields'] = [{'name': 'code'}]
    elif fault == 'restricted_field': definition['identifierFields'] = ['accessToken']
    elif fault == 'duplicate_field': definition['identifierFields'] = ['code', 'code']
    elif fault == 'wrong_entity_key': definition['keyFields'] = ['otherEntity']
    elif fault == 'conflicting_definition':
        record['payload']['recordSetLookups'].append({**definition, 'id': 'conflict', 'identifierFields': ['otherCode']})
    else: record['status'] = 'draft'
    assert not any((fact.get('compiledRecordSet') or {}).get('operator') == 'filter_identifiers'
        for fact in semantic_bindings(f[3]))


def real_finance_fixture(activate_candidate=True):
    """Actual saved source rows through real KB fields, never a new live test."""
    from app.generic_reader import KnowledgeStore
    from app.generic_reader_contracts import AnalysisPlan
    from app.reader_requirements import requirements_for
    from test_projected_collection import gateway
    source = json.loads((FIXTURES / 'group17-finance-record-set-knowledge.json').read_text())
    assert source['candidatePackage']['packageStatus'] == 'draft'
    assert source['candidatePackage']['records'][0]['status'] == 'draft'
    task = TaskSpec.model_validate(REPLAY['en']['firstTask'])
    task = merge_task(task, {'previousIntent': {**task.model_dump(), 'task': task.model_dump()}},
        REPLAY['en']['choice'])
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'baseline', 'content': json.dumps(source['baselinePackage'])}]})
    candidate = copy.deepcopy(source['candidatePackage'])
    if activate_candidate:
        candidate['packageStatus'] = candidate['records'][0]['status'] = 'active'
    knowledge.add({'chunks': [{'id': 'private-candidate', 'content': json.dumps(candidate)}]})
    knowledge.intent_lexical_context = {'question': REPLAY['en']['originalQuestion'],
        'requirements': requirements_for(task), 'terms': []}
    native = json.loads((FIXTURES / 'group17-record-set-native-rows.json').read_text())
    rows = [row for observation in native['sources'] for row in observation['rows']]
    data = {'data': {'items': rows, 'totalCount': len(rows)}}
    # Native rows came from separately timestamped native requests. This is an
    # explicitly isolated merged implementation fixture, not a collection receipt.
    inventory = {'saved': {'data': data, 'page': '/financial-payment/transactions',
        'operationRef': 'GET /api/admin/finance/transactions', 'principalScopeRef': 'isolated-test-scope',
        'capturedAt': 'isolated-fixture', 'kind': 'api_response', 'completeness': 'bounded',
        'collectionContext': {'parameterHashes': {}}, 'fieldEvidence': gateway._reader_field_evidence(data, data)}}
    facts = semantic_bindings(knowledge)
    set_fact = next(x for x in facts if x.get('compiledRecordSet'))
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    claim = lambda value: {'value': value, 'evidence': [{'sourceId': ref}]}
    plan = AnalysisPlan.model_validate({'stage': 'analysis', 'missing': [],
        'context': {'scope': 'unknown', 'scopeEvidence': [], 'grain': claim('transaction'),
            'population': claim('requested transactions'), 'filterScope': claim('exact identifiers'),
            'time': claim('saved observations'), 'caveats': []},
        'steps': [
            {'id': 'read', 'op': 'read_rows', 'sourceId': 'saved', 'path': '/data/items',
             'totalPath': '/data/totalCount', 'fields': ['id', 'transactionNo', 'referenceNumber'],
             'expose': False, 'label': 'Read', 'evidence': [{'sourceId': ref}]},
            {'id': 'selected', 'op': 'filter_identifiers', 'inputs': ['read'],
             'fields': ['transactionNo', 'referenceNumber'], 'predicate': 'in',
             'operand': set_fact['compiledRecordSet']['identifiers'],
             'knowledgeBindingId': set_fact['knowledgeBindingId'], 'expose': False,
             'label': 'Selected', 'evidence': [{'sourceId': ref}]},
            {'id': 'entities', 'op': 'distinct', 'inputs': ['selected'], 'fields': ['id'],
             'expose': False, 'label': 'Transactions', 'evidence': [{'sourceId': ref}]},
            {'id': 'visible', 'op': 'project', 'inputs': ['entities'],
             'fields': ['transactionNo', 'referenceNumber'], 'expose': True, 'role': 'detail',
             'label': 'Transactions', 'evidence': [{'sourceId': ref}]}],
        'requirementBindings': [{'requirementId': requirement['id'], 'sourceId': 'saved',
            'stepIds': ['visible'], 'knowledgeBindingId': next(f['knowledgeBindingId'] for f in facts
                if f['kind'] == requirement['kind'] and f['concept'] == requirement['value'])}
            for requirement in requirements_for(task) if requirement['kind'] != 'detail'] + [
            {'requirementId': 'detail', 'sourceId': 'saved', 'sourcePath': '/data/items',
             'stepIds': ['visible'], 'fields': ['transactionNo', 'referenceNumber'], 'knowledgeBindingId': ''}]})
    return task, plan, inventory, knowledge


def test_real_native_reference_fields_follow_the_legal_list_path_with_private_kb():
    f = real_finance_fixture()
    result = run_record_set(f)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    rows = result['outputs'][0]['value']
    assert {r['referenceNumber']: r['transactionNo'] for r in rows} == {
        'ML-2-804-9226243': '202609031716432762',
        'ML-2-804-0460740': '202609091523077753'}
    assert all(set(r) == {'transactionNo', 'referenceNumber'} for r in rows)
    assert all(item['documentId'] == '' for item in f[3].items.values())


def test_unpublished_draft_does_not_enable_the_alternate_lookup():
    f = real_finance_fixture(activate_candidate=False)
    assert not any((fact.get('compiledRecordSet') or {}).get('operator') == 'filter_identifiers'
        for fact in semantic_bindings(f[3]))
    with pytest.raises(PipelineError, match='record_set_lookup_definition_required'):
        run_record_set(f)
