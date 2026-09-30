import asyncio
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError, digest
from app.generic_reader_contracts import TaskSpec, ClarificationRequest
from app.reader_expansion import QueryExpansion
from app.principal import Principal
from app.reader_requirements import requirements_for, semantic_bindings, _semantic_match, _context_match
from app.reader_routing import task_fingerprint
from test_generic_reader_v3 import Gateway


RAW = json.loads((Path(__file__).parent / 'fixtures/current_view_membership_c08.json').read_text())
KEY = RAW['populationBinding']['knowledgeBindingId']


def fixture(task_changes=None):
    task = TaskSpec.model_validate(RAW['task']).model_copy(update=task_changes or {})
    context = {'question': RAW['question'], 'requirements': requirements_for(task),
        'task': task.model_dump(), 'terms': copy.deepcopy(RAW['terms']),
        'observationNotBefore': RAW['observationNotBefore'],
        # Independently saved by the engine, not inferred from the source.
        'principalScopeRef': RAW['enginePrincipalScopeRef']}
    knowledge = SimpleNamespace(items={str(i): copy.deepcopy(r) for i, r in enumerate(RAW['records'])},
                                intent_lexical_context=context)
    source = copy.deepcopy(RAW['source'])
    source['taskFingerprint'] = task_fingerprint(task)
    return task, knowledge, source


def match(task, knowledge, source):
    facts = {f['knowledgeBindingId']: f for f in semantic_bindings(knowledge)}
    requirement = next(r for r in requirements_for(task) if r['id'] == 'population')
    return _semantic_match(SimpleNamespace(**RAW['populationBinding']), requirement, source, facts), facts


def test_exact_real_task_matches_only_with_current_source_and_preserves_every_requirement():
    task, kb, source = fixture()
    before_task, before_requirements = task.model_dump(), copy.deepcopy(kb.intent_lexical_context['requirements'])
    original_records = copy.deepcopy(kb.items)
    matches, facts = match(task, kb, source)
    assert matches
    fact = facts[KEY]
    alias = next(a for a in fact['intentAliases'] if a.get('currentObservationReference'))
    reference = alias['currentObservationReference']
    span = reference['sourceSpan']
    assert RAW['question'][span['start']:span['end']] == reference['quote'] == task.businessFocus
    assert alias['requiresSourceViewProof'] is True
    assert reference['principalScopeRef'] == RAW['enginePrincipalScopeRef']
    assert _context_match(fact, source)
    assert task.model_dump() == before_task == RAW['task']
    assert kb.intent_lexical_context['requirements'] == before_requirements == RAW['requirements']
    assert kb.items == original_records
    assert source == RAW['source']
    assert RAW['result']['missing'] == ['analysis_binding_inapplicable']  # Original failure evidence is retained.


@pytest.mark.parametrize('changes', [
    {'timeRange': 'last month'}, {'timeRange': 'current'}, {'timeField': 'createdOn'},
    {'filters': ['urgent']}, {'readOnly': False}, {'needsLiveData': False},
    {'requestedScope': 'team'}, {'requestedScope': 'global'},
    {'businessObject': 'license'}, {'view': 'completed'},
])
def test_task_conditions_cannot_be_reinterpreted_as_current_queue_membership(changes):
    task, kb, source = fixture(changes)
    matched, _ = match(task, kb, source)
    assert not matched


@pytest.mark.parametrize('focus', [
    'currently in my urgent Licensing To Do queue',
    'currently in my Licensing To Do page',
    'currently not in my Licensing To Do queue',
    'previously in my Licensing To Do queue',
    'in my Licensing To Do queue currently',
    'currently in another user Licensing To Do queue',
    'currently in my team Licensing To Do queue',
    'currently in my Finance To Do queue',
    'currently in my Licensing Completed queue',
    'currently in my Licensing To Do queue excluding returned',
    'currently in my Licensing To Do queue with status approved',
])
def test_no_extra_word_status_owner_workspace_or_undocumented_wrapper_is_discarded(focus):
    task, kb, source = fixture({'businessFocus': focus})
    kb.intent_lexical_context['question'] = 'Show the applications ' + focus + '.'
    matched, _ = match(task, kb, source)
    assert not matched


@pytest.mark.parametrize('change', ['missing_task', 'different_requirements', 'no_original_span',
    'duplicate_original_span', 'missing_owner', 'missing_observation_origin'])
def test_runtime_origin_and_exact_single_span_are_required(change):
    task, kb, source = fixture()
    context = kb.intent_lexical_context
    if change == 'missing_task': context.pop('task')
    if change == 'different_requirements': context['requirements'] = context['requirements'][:-1]
    if change == 'no_original_span': context['question'] = 'Show my queue.'
    if change == 'duplicate_original_span': context['question'] += ' ' + task.businessFocus
    if change == 'missing_owner': context.pop('principalScopeRef')
    if change == 'missing_observation_origin': context.pop('observationNotBefore')
    matched, _ = match(task, kb, source)
    assert not matched


@pytest.mark.parametrize('question', [
    'Do not show the applications currently in my Licensing To Do queue.',
    'Show applications not currently in my Licensing To Do queue.',
    'Show all applications except those currently in my Licensing To Do queue.',
])
def test_negation_outside_an_extracted_positive_span_cannot_be_ignored(question):
    task, kb, source = fixture()
    kb.intent_lexical_context['question'] = question
    matched, _ = match(task, kb, source)
    assert not matched


@pytest.mark.parametrize('change', ['missing_proof', 'proof_authority', 'proof_page', 'proof_view',
    'proof_revision', 'proof_record', 'proof_path', 'proof_operation', 'proof_context_binding',
    'source_page', 'source_operation', 'request_context', 'other_owner', 'missing_owner',
    'other_task', 'missing_task', 'old_time', 'invalid_time', 'naive_time', 'missing_observation',
    'old_answer_kind', 'not_ready', 'collection_failure'])
def test_new_alias_is_not_live_authority_and_each_source_guard_is_checked_at_adoption(change):
    task, kb, source = fixture()
    if change == 'missing_proof': source.pop('sourceViewProof')
    elif change == 'proof_authority': source['sourceViewProof']['authority'] = 'model'
    elif change == 'proof_page': source['sourceViewProof']['page'] = '/another'
    elif change == 'proof_view': source['sourceViewProof']['view'] = 'completed'
    elif change.startswith('proof_'):
        definition = source['sourceViewProof']['definitions'][0]
        field = {'proof_revision': 'revision', 'proof_record': 'recordId',
            'proof_path': 'sourcePath', 'proof_operation': 'operationRef',
            'proof_context_binding': 'contextBindingIds'}[change]
        definition[field] = 999 if field == 'revision' else [] if field == 'contextBindingIds' else 'different'
    elif change == 'source_page': source['page'] = '/another'
    elif change == 'source_operation': source['operationRef'] = 'POST /api/Application/MyComplatedPage'
    elif change == 'request_context': source['collectionContext']['parameterHashes']['keyword'] = 'other'
    elif change == 'other_owner': source['principalScopeRef'] = 'other_engine_user_tenant_fingerprint'
    elif change == 'missing_owner': source.pop('principalScopeRef')
    elif change == 'other_task': source['taskFingerprint'] = 'another_task'
    elif change == 'missing_task': source.pop('taskFingerprint')
    elif change == 'old_time': source['capturedAt'] = '2026-09-27T00:00:00+00:00'
    elif change == 'invalid_time': source['capturedAt'] = 'unknown'
    elif change == 'naive_time': source['capturedAt'] = '2026-09-28T20:48:42'
    elif change == 'missing_observation': source.pop('observationRef')
    elif change == 'old_answer_kind': source['kind'] = 'previous_answer'
    elif change == 'not_ready': source['ready'] = False
    elif change == 'collection_failure': source['collectionFailure'] = 'incomplete'
    matched, facts = match(task, kb, source)
    assert facts[KEY].get('intentAliases')  # A generated interpretation is NOT enough.
    assert not matched


@pytest.mark.parametrize('change', ['quote', 'span', 'task', 'owner', 'origin'])
def test_original_span_task_and_owner_are_rechecked_when_the_alias_is_consumed(change):
    task, kb, source = fixture()
    _, facts = match(task, kb, source)
    alias = next(a for a in facts[KEY]['intentAliases'] if a.get('currentObservationReference'))
    reference = alias['currentObservationReference']
    if change == 'quote': reference['quote'] = 'currently in a different queue'
    if change == 'span': reference['sourceSpan']['start'] += 1
    if change == 'task': reference['taskFingerprint'] = 'different'
    if change == 'owner': reference['principalScopeRef'] = 'other'
    if change == 'origin': alias['currentObservationOrigin']['question'] = 'Another question'
    requirement = next(r for r in requirements_for(task) if r['id'] == 'population')
    assert not _semantic_match(SimpleNamespace(**RAW['populationBinding']), requirement, source, facts)


@pytest.mark.parametrize('change', ['inactive', 'conflicting_revision', 'scope_mapping', 'object_mapping', 'context_mapping'])
def test_active_revision_and_same_mapping_proofs_remain_required(change):
    task, kb, source = fixture()
    record = next(r['record'] for r in kb.items.values() if r['record']['kind'] == 'field_semantics')
    facts = record['payload']['bindings']
    if change == 'inactive': record['status'] = 'draft'
    elif change == 'conflicting_revision':
        other = copy.deepcopy(record); other['revision'] += 1
        kb.items['conflict'] = {'record': other, 'documentId': 'conflict'}
    elif change == 'scope_mapping': next(f for f in facts if f['id'] == 'personal_scope')['fields'] = ['taskId']
    elif change == 'object_mapping': next(f for f in facts if f['id'] == 'application_object')['operationRef'] = 'GET /another'
    elif change == 'context_mapping': next(f for f in facts if f['id'] == 'personal_scope')['contextParameters']['keyword'] = 'narrowed'
    matched, _ = match(task, kb, source)
    assert not matched


def test_real_run_context_uses_authenticated_engine_owner_not_a_source_or_permission_fingerprint(tmp_path):
    class Planner:
        async def generic_reader_json(self, *, schema, **kwargs):
            kind = schema['properties']['stage']['const']
            if kind == 'task':
                # Initial intent metadata is synthetic; semantic requirements
                # are the real fixture. The binding replay above is unchanged.
                return TaskSpec.model_validate(RAW['task']).model_copy(update={'slotUpdates': []}).model_dump()
            assert kind == 'query_expansion'
            return {'stage': kind, 'intentStatus': 'consistent', 'issues': [], 'terms': RAW['terms']}

    class ClosedGateway(Gateway):
        async def invoke(self, *args, **kwargs):
            raise AssertionError('No knowledge, page or network read in this offline wiring test')

    class Reader(GenericKnowledgeReader):
        async def expand_task(self, task, history, choice):
            result = await super().expand_task(task, history, choice)
            self.captured_context = copy.deepcopy(self.knowledge.intent_lexical_context)
            raise PipelineError('offline_stop_after_expansion', 'runtime')

    (tmp_path / 'page-catalog.json').write_text('[]')
    gateway = ClosedGateway()
    reader = Reader(gateway, Planner(), portal_base_url='https://portal.test', artifacts_dir=str(tmp_path))
    principal = Principal('person-1', 'tenant', 'current-owner-test')
    result = asyncio.run(reader.run(principal, RAW['question']))
    context = reader.captured_context
    expected = digest([principal.user_id, principal.tenant_id, reader.audit['permission']['fingerprint']])
    assert context['principalScopeRef'] == expected
    assert expected != reader.audit['permission']['fingerprint']
    assert context['observationNotBefore'] == reader.audit['permission']['observedAt']
    assert context['task']['businessFocus'] == RAW['task']['businessFocus']
    assert context['requirements'] == RAW['requirements']
    assert gateway.events == ['identity']
    assert 'offline_stop_after_expansion' in result.result.public_json()['missing']


def test_clarification_carry_refreshes_owner_from_this_run_without_another_model_call():
    class NoCalls:
        async def generic_reader_json(self, **kwargs):
            raise AssertionError('Unchanged-clause clarification uses the existing expansion')

    reader = GenericKnowledgeReader(None, NoCalls(), portal_base_url='https://portal.test')
    task = TaskSpec.model_validate(RAW['task'])
    reader.current_question = RAW['question']
    reader.expansion_task = task
    reader.expansion = QueryExpansion(stage='query_expansion', intentStatus='consistent', issues=[], terms=RAW['terms'])
    pending = task.model_copy(update={'clarification': ClarificationRequest(
        question='Which information is required?', missingSlots=['requestedAttributes']),
        'unresolvedSlots': ['requestedAttributes']})
    reader.current_observation_owner = {'principalScopeRef': 'fresh_engine_owner',
                                        'observationNotBefore': '2026-09-29T01:00:00+00:00'}
    reader.knowledge.intent_lexical_context = {'principalScopeRef': 'old_owner',
                                              'observationNotBefore': '2020-01-01T00:00:00+00:00'}
    asyncio.run(reader.expand_task(pending, {}, None))
    context = reader.knowledge.intent_lexical_context
    assert context['principalScopeRef'] == 'fresh_engine_owner'
    assert context['observationNotBefore'] == '2026-09-29T01:00:00+00:00'
    assert context['task'] == pending.model_dump()
    assert context['requirements'] == requirements_for(pending)


@pytest.mark.parametrize('question', [
    RAW['question'],
    'Show applications currently in my Licensing To Do queue.',
    'Please show the applications currently in my Licensing To Do queue.',
    'List the applications currently in my Licensing To Do queue.',
    'Show me the applications currently in my Licensing To Do queue, please.',
    '  Please list me the applications currently in my Licensing To Do queue!  ',
    'Show licensing applications currently in my Licensing To Do queue.',
])
def test_whole_question_grammar_proves_exact_object_and_membership_without_residue(question):
    task, kb, source = fixture()
    kb.intent_lexical_context['question'] = question
    matched, facts = match(task, kb, source)
    assert matched
    ref = next(a['currentObservationReference'] for a in facts[KEY]['intentAliases']
               if a.get('currentObservationReference'))
    coverage = ref['questionCoverage']
    assert coverage['quote'] == question
    assert coverage['sourceSpan'] == {'start': 0, 'end': len(question)}
    span = coverage['objectSourceSpan']
    assert question[span['start']:span['end']] == coverage['objectQuote']
    assert task.model_dump() == RAW['task']
    assert kb.intent_lexical_context['requirements'] == RAW['requirements']


@pytest.mark.parametrize('question', [
    # Conditions need not use any known "negative" word to be rejected.
    'Show applications with attribute FLORP currently in my Licensing To Do queue.',
    'Show the applications currently in my Licensing To Do queue with attribute FLORP.',
    'Show only VIP applications currently in my Licensing To Do queue.',
    'Show the oldest applications currently in my Licensing To Do queue.',
    'Show ten applications currently in my Licensing To Do queue.',
    'Show the applications currently in my Licensing To Do queue ordered by date.',
    'Show the applications currently in my Licensing To Do queue and export their contacts.',
    'Show the applications currently in my Licensing To Do queue; include confidential records.',
    'Show the applications currently in my Licensing To Do queue. Then show another account.',
    'For another user, show the applications currently in my Licensing To Do queue.',
    'Please urgent show the applications currently in my Licensing To Do queue.',
    'Show the applications currently in my Licensing To Do queue, please include approved records.',
    'Show the applications currently in my Licensing To Do queue since yesterday.',
    'Show the applications currently in my Licensing To Do queue or all applications.',
    'Quote: Show the applications currently in my Licensing To Do queue.',
    '"Show the applications currently in my Licensing To Do queue."',
    'The record says: Show the applications currently in my Licensing To Do queue.',
    'If approved, show the applications currently in my Licensing To Do queue.',
    'How would I show the applications currently in my Licensing To Do queue?',
    'Show applications currently in my Licensing To Do queue\nwith status approved.',
])
def test_unknown_substantive_residue_cannot_be_covered_by_a_positive_substring(question):
    task, kb, source = fixture()
    kb.intent_lexical_context['question'] = question
    assert not match(task, kb, source)[0]


@pytest.mark.parametrize('changes', [
    {'outputShape': 'count', 'requestedMeasures': ['count']},
    {'requestedAttributes': ['phone number']}, {'groupBy': ['status']},
    {'requestedOrdering': ['oldest first']}, {'recordIdentity': 'OTHER-RECORD'},
])
def test_narrow_full_question_shape_cannot_cover_undeclared_output_semantics(changes):
    task, kb, source = fixture(changes)
    assert not match(task, kb, source)[0]


@pytest.mark.parametrize('change', ['origin_suffix', 'object_quote', 'object_span',
    'object_definition', 'object_source_proof', 'split_source_proof'])
def test_full_question_and_exact_active_object_proof_are_rechecked_at_adoption(change):
    task, kb, source = fixture()
    _, facts = match(task, kb, source)
    alias = next(a for a in facts[KEY]['intentAliases'] if a.get('currentObservationReference'))
    coverage = alias['currentObservationReference']['questionCoverage']
    if change == 'origin_suffix': alias['currentObservationOrigin']['question'] += ' with status approved'
    elif change == 'object_quote': coverage['objectQuote'] = 'urgent applications'
    elif change == 'object_span': coverage['objectSourceSpan']['end'] += 1
    elif change == 'object_definition': facts.pop(coverage['objectBindingId'])
    elif change == 'object_source_proof': source['sourceViewProof']['definitions'][0]['objectBindingId'] = 'other_object'
    elif change == 'split_source_proof':
        different = copy.deepcopy(source['sourceViewProof']['definitions'][0])
        different['operationRef'] = 'POST /api/Other'
        source['sourceViewProof']['definitions'][0]['objectBindingId'] = 'other_object'
        source['sourceViewProof']['definitions'].append(different)
    requirement = next(r for r in requirements_for(task) if r['id'] == 'population')
    assert not _semantic_match(SimpleNamespace(**RAW['populationBinding']), requirement, source, facts)
