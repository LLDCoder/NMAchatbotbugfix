"""Failed prerequisites cannot publish or execute an unverified option list."""
import asyncio
from copy import deepcopy
from unittest.mock import AsyncMock

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError, render_generic_answer
from app.principal import Principal
from app.reader_context import (bind_history, clock_context, context_from_state, literal_choice,
                                project_history, quarantine_failed_clarification, save_intent)
from app.reader_upstream_failure import (KNOWLEDGE_DEPENDENCY_FAILURES, public_upstream_failure,
                                        public_knowledge_failure)
from test_generic_reader_v3 import Gateway, Planner
from test_reader_context_v3 import task


def pending_task(**updates):
    return task(requestedScope='unknown', unresolvedSlots=['requestedScope'], clarification={
        'question': 'My crystals or team crystals?', 'missingSlots': ['requestedScope'], 'options': [
            {'id': 'mine', 'label': 'My crystals', 'updates': [
                {'field': 'requestedScope', 'source': 'current', 'value': 'personal'}]},
            {'id': 'team', 'label': 'Team crystals', 'updates': [
                {'field': 'requestedScope', 'source': 'current', 'value': 'team'}]}]}, **updates)


def failed_result(code='knowledge_upstream_unavailable'):
    state = save_intent(pending_task(), 'Show blue crystals.', {}, 'r1', 'principal', 'catalog',
                        clock_context('UTC'), knowledge_version='')
    return {'result': 'load_failed', 'failureCategory': 'runtime', 'missing': [code],
            'intentState': state, 'clarification': state['pendingClarification'],
            'workflowState': 'awaiting_clarification', 'outputs': [], 'knowledgeAnswer': []}


@pytest.mark.parametrize('code', sorted(KNOWLEDGE_DEPENDENCY_FAILURES))
@pytest.mark.parametrize('language', ['en', 'ar', 'zh'])
def test_trusted_dependency_failures_are_visible_instead_of_options(code, language):
    evidence = failed_result(code)
    public = render_generic_answer(evidence, language)
    assert public and 'My crystals' not in public and 'Team crystals' not in public
    assert code not in public and '/api/' not in public
    state = quarantine_failed_clarification(evidence['intentState'], evidence)
    assert state['status'] == 'needs_input' and not state.get('pendingClarification')


@pytest.mark.parametrize('answer', ['1', '2', 'mine', 'team', 'My crystals', 'Team crystals', 'option 2', 'second'])
def test_legacy_saved_failure_cannot_activate_any_old_choice(answer):
    evidence = failed_result(); original = deepcopy(evidence)
    ctx = context_from_state(evidence, 'Show blue crystals.')
    state = ctx['previousIntent']['intentState']
    assert state['task'] == original['intentState']['task']
    assert state['clarificationRounds'] == 1 and state['taskRevision'] == 1
    assert state['failedClarification']['actionable'] is False
    assert state['failedClarification']['pending'] == original['clarification']
    history = bind_history(project_history(ctx), 'principal', 'catalog')
    assert literal_choice(answer, history) is None
    assert history['previousIntent']['originalQuestion'] == 'Show blue crystals.'
    assert history['previousIntent']['failedClarification']['reason'] == 'knowledge_upstream_unavailable'
    assert evidence == original  # Never rewrite the raw failed result.


@pytest.mark.parametrize('change', [
    {'result': 'success'}, {'failureCategory': 'knowledge_gap'},
    {'missing': ['knowledge_fields_missing']}, {'missing': ['knowledge_upstream_unavailable_in_note']},
    {'missing': ['intent_ambiguous'], 'failureCategory': 'clarification', 'result': 'not_confirmed'},
])
def test_non_dependency_results_retain_normal_clarification(change):
    evidence = {**failed_result(), **change}
    assert quarantine_failed_clarification(evidence['intentState'], evidence) is evidence['intentState']
    assert 'Team crystals' in render_generic_answer(evidence)
    assert literal_choice('2', project_history(context_from_state(evidence, 'Show blue crystals.')))


@pytest.mark.parametrize('native', ['upstream_session_expired', 'upstream_access_denied'])
def test_native_permission_failure_has_precedence_even_after_knowledge_code(native):
    evidence = failed_result(); evidence['missing'].append(native)
    assert public_upstream_failure(evidence, 'en') == public_upstream_failure({'missing': [native]}, 'en')


def test_verified_partial_facts_survive_without_the_unverified_options():
    evidence = failed_result()
    evidence['outputs'] = [{'id': 'count', 'label': 'Verified count', 'value': 7, 'evidence': []}]
    assert public_upstream_failure(evidence, 'en') is None
    answer = render_generic_answer(evidence)
    assert 'Verified count' in answer and '7' in answer and 'Team crystals' not in answer


@pytest.mark.parametrize('code', ['stage_timeout', 'dependency_unavailable', 'reader_timeout'])
@pytest.mark.parametrize('stage', ['knowledge_retrieval', 'identity_permissions', 'query_expansion'])
def test_generic_runtime_failures_require_the_actual_knowledge_stage(code, stage):
    evidence = {**failed_result(code), 'failureStage': stage}
    state = quarantine_failed_clarification(evidence['intentState'], evidence)
    if stage == 'knowledge_retrieval':
        assert state['status'] == 'needs_input' and 'Team crystals' not in render_generic_answer(evidence)
    else:
        assert state is evidence['intentState']


@pytest.mark.parametrize('code,details', [('knowledge_upstream_unavailable', {}),
    ('stage_timeout', {'stage': 'knowledge_retrieval'})])
def test_finish_quarantines_the_public_copy_after_selecting_final_intent(code, details):
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.intent_state = failed_result()['intentState']; original = deepcopy(reader.intent_state)
    result = reader.finish(task=pending_task(), error=PipelineError(code, 'runtime', details)).result.payload
    assert result['result'] == 'load_failed' and result['missing'] == [code]
    assert result['workflowState'] == 'needs_input' and 'clarification' not in result
    assert result['intentState']['task'] == original['task']
    assert result['intentState']['clarificationRounds'] == original['clarificationRounds']
    assert reader.intent_state == original


def test_verified_knowledge_blocks_and_previous_answer_remain_visible():
    evidence = failed_result(); evidence['knowledgeAnswer'] = [{'text': 'Verified handbook fact.'}]
    assert 'Verified handbook fact.' in render_generic_answer(evidence)
    assert 'Team crystals' not in render_generic_answer(evidence)
    from test_reader_previous_answer import project
    from app.reader_previous_answer import render_previous_answer
    evidence = failed_result(); evidence['previousAnswer'] = project()
    answer = render_generic_answer(evidence)
    assert render_previous_answer(evidence['previousAnswer'], 'en') in answer
    assert public_knowledge_failure(evidence, 'en') in answer


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('mode', ['supplement', 'standalone'])
def test_session_facts_and_boundaries_compose_with_exactly_one_failure(language, mode):
    from app.reader_session_scope import render_session_projection
    session = {'schemaVersion': 'authenticated-session-summary/1',
        'provenance': 'refreshed_authenticated_session', 'mode': mode,
        'requested': ['roles', 'scope'], 'roles': ['Verified role'],
        'departments': [], 'permittedPages': ['Verified page']}
    evidence = {**failed_result(), 'sessionContext': session}
    original = deepcopy(evidence)
    answer = render_generic_answer(evidence, language)
    assert render_session_projection(session, language) in answer
    assert answer.count(public_knowledge_failure(evidence, language)) == 1
    assert 'My crystals' not in answer and evidence == original


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_permissions_and_partial_facts_compose_without_losing_failure_or_scope(language):
    from test_reader_role_permissions import partition
    from app.reader_role_permissions import render_permissions, projection_valid
    assignment = partition(language=language)
    original_task = assignment['originalTask']
    original_intent = save_intent(original_task, 'Describe my role.', {}, 'r1',
        'principal', 'catalog', clock_context('UTC'))
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
    reader.role_permission_assignment = assignment
    reader.role_permission_original_intent = original_intent
    reader.intent_state = original_intent
    result = reader.finish(task=assignment['knowledgeTask'],
        error=PipelineError('knowledge_upstream_unavailable', 'runtime')).result.payload
    assert projection_valid(result['currentAccountPermissions'])
    expected = render_permissions(result['currentAccountPermissions'], language)
    for field, facts in [('outputs', [{'id': 'count', 'label': 'Verified count', 'value': 7, 'evidence': []}]),
                         ('knowledgeAnswer', [{'text': 'Verified handbook fact.'}])]:
        evidence = {**result, field: facts}
        before = deepcopy(evidence); answer = render_generic_answer(evidence, language)
        assert expected in answer
        assert ('Verified count' if field == 'outputs' else 'Verified handbook fact.') in answer
        assert answer.count(public_knowledge_failure(evidence, language)) == 1
        assert evidence == before


@pytest.mark.parametrize('projection', [{}, {'unverified': True}])
def test_unverified_truthy_projection_cannot_hide_knowledge_failure(projection):
    evidence = {**failed_result(), 'currentAccountPermissions': projection}
    assert public_knowledge_failure(evidence, 'en') in render_generic_answer(evidence)


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('native', ['upstream_session_expired', 'upstream_access_denied'])
def test_native_identity_denial_still_precedes_session_and_knowledge(language, native):
    evidence = {**failed_result(), 'sessionContext': {'schemaVersion': 'authenticated-session-summary/1',
        'provenance': 'refreshed_authenticated_session', 'mode': 'supplement',
        'requested': ['roles'], 'roles': ['Earlier role'], 'departments': [], 'permittedPages': []}}
    evidence['missing'].append(native)
    assert render_generic_answer(evidence, language) == public_upstream_failure(evidence, language)


def test_failure_while_continuing_valid_choice_does_not_consume_or_retry():
    class AskingPlanner(Planner):
        async def generic_reader_json(self, *, schema, data, **kwargs):
            if schema['properties']['stage']['const'] == 'task':
                return pending_task(contextRelation='continue' if data.get('history') else 'new').model_dump()
            return await super().generic_reader_json(schema=schema, data=data, **kwargs)

    class FailedKnowledge(Gateway):
        async def invoke(self, principal, name, arguments, **kwargs):
            self.events.append(name)
            assert name == 'knowledge.search'
            return {'ok': True, 'result': {'consistencyError': 'knowledge_upstream_unavailable',
                    'retrievalError': {'code': 'knowledge_upstream_unavailable', 'stage': 'primary'}}}

    first = asyncio.run(GenericKnowledgeReader(Gateway(), AskingPlanner(), portal_base_url='https://portal.test').run(
        Principal('person-1', 'tenant', 'first'), 'Show blue crystals CR-123 by status within next 30 days in To Do.')).result.payload
    assert first['missing'] == ['intent_ambiguous']
    gateway = FailedKnowledge(); claim = AsyncMock(return_value=True)
    second = asyncio.run(GenericKnowledgeReader(gateway, AskingPlanner(), portal_base_url='https://portal.test',
        claim_clarification=claim).run(Principal('person-1', 'tenant', 'second'), '2',
        conversation_context=context_from_state(first, 'Show blue crystals CR-123 by status within next 30 days in To Do.'))).result.payload
    assert second['result'] == 'load_failed' and second['missing'] == ['knowledge_upstream_unavailable']
    assert second['intentState']['originalQuestion'] == 'Show blue crystals CR-123 by status within next 30 days in To Do.'
    assert second['intentState']['clarificationRounds'] == first['intentState']['clarificationRounds']
    assert not second['intentState'].get('pendingClarification')
    claim.assert_not_awaited()
    assert gateway.events == ['identity', 'knowledge.search']
