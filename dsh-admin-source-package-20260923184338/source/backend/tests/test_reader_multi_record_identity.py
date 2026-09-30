"""A scalar lookup cannot bind two records by concatenating their identifiers."""
import asyncio
import copy
import json
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_context import validate_record_identity
from test_reader_parent_properties import fixture


@pytest.mark.parametrize('identity', [
    'AB-123 and CD-456', 'AB-123, CD-456', 'AB-123; CD-456',
    'AB-123 و CD-456', 'AB-123 وCD-456',
    'ZX_123 XY_456', 'AB123 and CD456',
    'ML-2-804-9226243 and ML-2-804-0460740',
])
def test_two_distinct_opaque_ids_cannot_be_one_scalar_lookup(identity):
    task = fixture()[0].model_copy(update={'recordIdentity': identity})
    with pytest.raises(PipelineError, match='intent_multiple_record_identity'):
        validate_record_identity(task, 'Find ' + identity + '.', {})


@pytest.mark.parametrize('identity', [
    'AB-123', 'ML-2-804-9226243', '0123456', '2026-09-28',
    'Alpha and Beta', 'Region AB-123 and CD-456 office',
    'Rock & Roll', 'AB-123/CD-456',
])
def test_single_id_dates_and_real_names_are_not_split(identity):
    task = fixture()[0].model_copy(update={'recordIdentity': identity})
    validate_record_identity(task, 'Find "' + identity + '".', {})


def test_invalid_composite_in_history_is_not_promoted_to_a_current_record():
    identity = 'AB-123 and CD-456'
    task = fixture()[0].model_copy(update={'recordIdentity': identity, 'contextRelation': 'continue'})
    with pytest.raises(PipelineError, match='intent_multiple_record_identity'):
        validate_record_identity(task, 'What are their statuses?', {'previousIntent': {'recordIdentity': identity}})


def test_task_stage_repairs_composite_without_dropping_either_record_or_guessing_type():
    draft = fixture()[0].model_copy(update={
        'businessObject': 'unknown', 'requestedGrain': 'unknown',
        'recordIdentity': 'AB-123 and CD-456', 'requestedAttributes': ['status'],
    })
    repaired = draft.model_copy(update={
        'recordIdentity': '', 'outputShape': 'list',
        'filters': ['record identifiers in ["AB-123", "CD-456"]'],
    })
    responses = [draft.model_dump(), repaired.model_dump()]

    class Planner:
        def __init__(self): self.calls = []
        async def generic_reader_json(self, **kwargs):
            self.calls.append(copy.deepcopy(kwargs))
            return responses[len(self.calls) - 1]

    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = 'Find AB-123 and CD-456. Keep their statuses separate.'
    reader.canonical_question = reader.current_question
    reader.response_language = 'en'
    reader.deadline = time.monotonic() + 30
    result = asyncio.run(reader.structured(TaskSpec, 'Parse intent.', {'question': reader.current_question}))
    assert len(reader.planner.calls) == 2
    assert 'intent_multiple_record_identity' in reader.planner.calls[-1]['correction']
    assert result.recordIdentity == ''
    assert result.filters == repaired.filters
    assert result.requestedAttributes == ['status']
    assert result.businessObject == 'unknown'


def test_related_objects_may_keep_one_parent_id_and_an_explicit_other_constraint():
    task = fixture()[0].model_copy(update={'recordIdentity': 'AB-123',
        'filters': ['linked transaction CD-456'], 'requestedAttributes': ['payment status']})
    validate_record_identity(task, 'For application AB-123, read linked transaction CD-456.', {})


def test_retry_that_keeps_only_one_record_is_rejected_then_repaired():
    draft = fixture()[0].model_copy(update={'recordIdentity': 'AB-123 and CD-456'})
    partial = draft.model_copy(update={'recordIdentity': 'AB-123'})
    repaired = draft.model_copy(update={'recordIdentity': '', 'outputShape': 'list',
        'filters': ['record identifiers in ["AB-123", "CD-456"]']})
    responses = [draft.model_dump(), partial.model_dump(), repaired.model_dump()]
    class Planner:
        def __init__(self): self.calls = []
        async def generic_reader_json(self, **kwargs):
            self.calls.append(copy.deepcopy(kwargs)); return responses[len(self.calls) - 1]
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = reader.canonical_question = 'Find AB-123 and CD-456.'
    reader.response_language = 'en'; reader.deadline = time.monotonic() + 30
    result = asyncio.run(reader.structured(TaskSpec, 'Parse.', {'question': reader.current_question}))
    assert result.filters == repaired.filters
    assert len(reader.planner.calls) == 3
    assert 'intent_record_set_targets_lost' in reader.planner.calls[-1]['correction']


@pytest.mark.parametrize('value', ['record identifiers in ["AB-123", "ZZ-999"]',
    'record identifiers in ["AB-123", "AB-123"]', 'record identifiers in AB-123, CD-456'])
def test_record_set_filter_rejects_invented_or_malformed_values(value):
    task = fixture()[0].model_copy(update={'filters': [value], 'recordIdentity': '', 'outputShape': 'list'})
    with pytest.raises(PipelineError, match='intent_record_set_ungrounded'):
        validate_record_identity(task, 'Find AB-123 and CD-456.', {})


@pytest.mark.parametrize('mode', ['guidance', 'mutation'])
def test_mutation_or_general_guidance_does_not_get_converted_to_live_list(mode):
    task = fixture()[0].model_copy(update={'recordIdentity': 'AB-123 and CD-456',
        'needsLiveData': mode != 'guidance', 'readOnly': mode != 'mutation'})
    validate_record_identity(task, 'Explain handling for AB-123 and CD-456.', {})


def record_set_fixture():
    from app.generic_reader import KnowledgeStore
    from app.generic_reader_contracts import AnalysisPlan
    from app.reader_requirements import requirements_for, semantic_bindings
    from test_projected_collection import gateway
    task = fixture()[0].model_copy(update={
        'businessObject': 'specimen', 'requestedGrain': 'specimen', 'requestedScope': 'unknown',
        'recordIdentity': '', 'requestedAttributes': ['phase'], 'outputShape': 'list',
        'filters': ['record identifiers in ["AB-123", "CD-456"]'],
    })
    operation, path, page = 'POST /api/specimens/list', '/data/items', '/specimens'
    record = {'id': 'specimen.list', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
        'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': [page]},
        'sources': [{'reference': page}], 'payload': {'bindings': [
            {'id': kind, 'kind': kind, 'concept': concept, 'fields': fields,
             'sourcePath': path, 'operationRef': operation,
             **({'displayFields': ['code']} if kind == 'object' else {})}
            for kind, concept, fields in [('object', 'specimen', ['key']), ('grain', 'specimen', ['key']),
                                          ('attribute', 'phase', ['phase'])]],
            'routing': {'records': [{'id': 'code', 'identityField': 'code', 'keyFields': ['key'],
                'operationRef': operation, 'sourcePath': path, 'unique': True}]}}}
    knowledge = KnowledgeStore()
    # The source definition contains no question-specific identifier or filter value.
    knowledge.add({'chunks': [{'id': 'specimens', 'content': json.dumps({'records': [record]})}]})
    knowledge.intent_lexical_context = {'question': 'Find AB-123 and CD-456.',
        'requirements': requirements_for(task), 'terms': []}
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    data = {'data': {'items': [
        {'key': 1, 'code': 'AB-123', 'phase': 'Warm'},
        {'key': 2, 'code': 'CD-456', 'phase': 'Cold'},
        {'key': 3, 'code': 'AB-1234', 'phase': 'Other'},
    ], 'total': 3}}
    source = {'data': data, 'page': page, 'operationRef': operation, 'principalScopeRef': 'same-user',
        'capturedAt': '2026-09-28', 'completeness': 'bounded', 'kind': 'api_response',
        'collectionContext': {'parameterHashes': {}}, 'fieldEvidence': gateway._reader_field_evidence(data, data)}
    facts = semantic_bindings(knowledge)
    claim = lambda value: {'value': value, 'evidence': [{'sourceId': ref}]}
    plan = AnalysisPlan.model_validate({'stage': 'analysis', 'missing': [],
        'context': {'scope': 'unknown', 'scopeEvidence': [], 'grain': claim('specimen'),
            'population': claim('requested specimens'), 'filterScope': claim('exact identifiers'),
            'time': claim('current'), 'caveats': []},
        'steps': [
            {'id': 'read', 'op': 'read_rows', 'sourceId': 'queue', 'path': path, 'totalPath': '/data/total',
             'fields': ['key', 'code', 'phase'], 'expose': False, 'label': 'Read', 'evidence': [{'sourceId': ref}]},
            {'id': 'selected', 'op': 'filter', 'inputs': ['read'], 'field': 'code', 'predicate': 'in',
             'operand': ['AB-123', 'CD-456'], 'expose': False, 'label': 'Selected', 'evidence': [{'sourceId': ref}]},
            {'id': 'entities', 'op': 'distinct', 'inputs': ['selected'], 'fields': ['key'],
             'expose': False, 'label': 'Entities', 'evidence': [{'sourceId': ref}]},
            {'id': 'visible', 'op': 'project', 'inputs': ['entities'], 'fields': ['code', 'phase'],
             'expose': True, 'role': 'detail', 'label': 'Records', 'evidence': [{'sourceId': ref}]},
        ],
        'requirementBindings': [
            {'requirementId': requirement['id'], 'sourceId': 'queue', 'stepIds': ['visible'],
             'knowledgeBindingId': next(f['knowledgeBindingId'] for f in facts
                if f['kind'] == requirement['kind'] and f['concept'] == requirement['value'])}
            for requirement in requirements_for(task) if requirement['kind'] != 'detail']})
    return task, plan, {'queue': source}, knowledge


def run_record_set(f):
    from app.reader_bindings import bind_analysis_evidence
    from app.generic_reader import execute_analysis
    task, plan, sources, knowledge = f
    bind_analysis_evidence(plan, task, knowledge, sources)
    return execute_analysis(plan, sources, knowledge, [], task=task)


def test_complete_legal_list_path_proves_each_exact_identifier_from_page_mapping():
    f = record_set_fixture()
    result = run_record_set(f)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert result['outputs'][0]['value'] == [
        {'code': 'AB-123', 'phase': 'Warm'}, {'code': 'CD-456', 'phase': 'Cold'}]
    proof = next(c['recordSetProof'] for c in result['requirementCoverage'] if c['kind'] == 'filter')
    assert proof['unobservedIdentifiers'] == [] and proof['globalAbsence'] is False


@pytest.mark.parametrize('fault', ['only_one', 'combined_string', 'wrong_field', 'wrong_operator'])
def test_analysis_cannot_weaken_the_exact_identifier_set(fault):
    f = record_set_fixture()
    step = f[1].steps[1]
    if fault == 'only_one': step.operand = ['AB-123']
    elif fault == 'combined_string': step.operand = 'AB-123 and CD-456'
    elif fault == 'wrong_field': step.field = 'phase'
    else: step.predicate = 'not_in'
    try:
        result = run_record_set(f)
    except PipelineError:
        return
    assert not result['requirementsSatisfied']


def test_absent_second_record_does_not_silently_complete_all_requested_records():
    from test_projected_collection import gateway
    f = record_set_fixture(); data = f[2]['queue']['data']
    data['data']['items'].pop(1); data['data']['total'] = 2
    f[2]['queue']['fieldEvidence'] = gateway._reader_field_evidence(data, data)
    result = run_record_set(f)
    assert not result['requirementsSatisfied']
    proof = next(c['recordSetProof'] for c in result['requirementCoverage'] if c['kind'] == 'filter')
    assert proof['unobservedIdentifiers'] == ['CD-456']
    assert proof['globalAbsence'] is False


def test_one_business_number_matching_two_entity_keys_remains_ambiguous():
    from test_projected_collection import gateway
    f = record_set_fixture(); data = f[2]['queue']['data']
    data['data']['items'].append({'key': 4, 'code': 'AB-123', 'phase': 'Warm'})
    data['data']['total'] = 4
    f[2]['queue']['fieldEvidence'] = gateway._reader_field_evidence(data, data)
    result = run_record_set(f)
    assert not result['requirementsSatisfied']
    assert next(c for c in result['requirementCoverage'] if c['kind'] == 'filter')['reason'] == 'record_set_targets_not_verified'


@pytest.mark.parametrize('fault', ['invented_literal', 'wrong_page', 'ambiguous_identity', 'retired_definition'])
def test_record_set_needs_user_literals_current_page_and_unambiguous_active_mapping(fault):
    from app.reader_requirements import semantic_bindings
    f = record_set_fixture()
    if fault == 'invented_literal': f[3].intent_lexical_context['question'] = 'Find AB-123.'
    elif fault == 'wrong_page': f[2]['queue']['page'] = '/unrelated'
    else:
        record = next(iter(f[3].items.values()))['record']
        if fault == 'retired_definition': record['status'] = 'archived'
        else: record['payload']['routing']['records'].append({
            **record['payload']['routing']['records'][0], 'id': 'other', 'identityField': 'otherCode'})
    if fault == 'wrong_page':
        assert not run_record_set(f)['requirementsSatisfied']
    else:
        assert not any(fact.get('compiledRecordSet') for fact in semantic_bindings(f[3]))
