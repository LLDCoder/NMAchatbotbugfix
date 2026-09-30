"""The real partial turn remains partial; only the planning input is repaired."""
import asyncio
import copy
import json
import time
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import AnalysisPlan, TaskSpec
from app.reader_requirements import requirements_for
from app.reader_session_scope import analysis_task_assignment, profile_subtask

TRACE = json.loads(Path(__file__).with_name('fixtures').joinpath('group15_analysis_partition_trace.json').read_text())


def invocation():
    task = TaskSpec.model_validate(TRACE['remainingTask'])
    partition = copy.deepcopy(TRACE['partition'])
    # The new runtime captures this receipt at the existing reviewed split.
    partition['permissionReceipt'] = copy.deepcopy(TRACE['permission'])
    return task, partition, copy.deepcopy(TRACE['projection']), copy.deepcopy(TRACE['permission']), TRACE['originalQuestion']


def test_real_reviewed_request_has_separate_sources_without_claiming_row_membership():
    assignment = analysis_task_assignment(*invocation())
    assert [r['value'] for r in assignment['originalRequirements'] if r['kind'] == 'attribute'] == ['department', 'role', 'data scope']
    assert [r['value'] for r in assignment['assignedRequirements'] if r['kind'] == 'attribute'] == ['department', 'role']
    assert {r['id'] for r in assignment['assignedRequirements']} >= {'scope', 'object', 'grain'}
    delegated, = assignment['delegatedRequirements']
    assert delegated['originalRequirement']['value'] == 'data scope'
    assert delegated['coverage']['id'] == 'session_scope'
    assert delegated['coverage']['source'] == 'refreshed_authenticated_session'
    assert delegated['coverage']['rowScopeVerified'] is False
    assert assignment['rowScopeVerifiedByDelegation'] is False
    assert TRACE['actualResult']['missing'] == ['data_scope_value', 'stage_quality_incomplete']
    assert TRACE['actualResult']['requirementsSatisfied'] is False


@pytest.mark.parametrize('change', [
    'missing_receipt', 'other_permission', 'stale_capture', 'no_provenance', 'unavailable',
    'claimed_rows', 'claimed_action_authority', 'business_values', 'team_scope',
    'dropped_department', 'extra_attribute', 'unreviewed_partition', 'wrong_delegation',
    'earlier_query', 'another_person', 'absent_original',
])
def test_unverified_or_changed_division_cannot_change_analysis_responsibility(change):
    task, partition, projection, permission, question = invocation()
    if change == 'missing_receipt': partition.pop('permissionReceipt')
    if change == 'other_permission': permission['fingerprint'] = 'another-session'
    if change == 'stale_capture': projection['observedAt'] = '2000-01-01T00:00:00Z'
    if change == 'no_provenance': projection['provenance'] = 'browser_hint'
    if change == 'unavailable': projection['unavailableAttributes'] = ['scope']
    if change == 'claimed_rows': projection['rowScopeVerified'] = True
    if change == 'claimed_action_authority': projection['actionAuthorityInferred'] = True
    if change == 'business_values': projection['recordValuesRead'] = True
    if change == 'team_scope': task = task.model_copy(update={'requestedScope': 'team'})
    if change == 'dropped_department': task = task.model_copy(update={'requestedAttributes': ['role']})
    if change == 'extra_attribute': task = task.model_copy(update={'requestedAttributes': ['department', 'role', 'email']})
    if change == 'unreviewed_partition': partition['remainingRequirements'] = []
    if change == 'wrong_delegation': projection['requested'] = ['roles']
    if change == 'earlier_query': question = 'Explain my previous query data scope.'
    if change == 'another_person': question = 'Show me another user department, role and data scope.'
    if change == 'absent_original': partition.pop('reviewedOriginalTask')
    assert analysis_task_assignment(task, partition, projection, permission, question) is None


@pytest.mark.parametrize('attribute,kind', [('access scope','scope'), ('data access scope','scope'), ('authorized pages','pages')])
def test_assignment_uses_reviewed_requirement_meaning_and_source_not_case_or_gap_codes(attribute, kind):
    _, partition, projection, permission, question = invocation()
    original = TaskSpec.model_validate(TRACE['originalTask']).model_copy(update={'requestedAttributes': [attribute, 'role', 'department']})
    task = profile_subtask(original, [kind])
    partition.update(reviewedOriginalTask=original.model_dump(), remainingRequirements=requirements_for(task), sessionRequirements=[kind])
    projection['requested'] = [kind]
    assignment = analysis_task_assignment(task, partition, projection, permission, question)
    assert assignment['delegatedRequirements'][0]['originalRequirement']['id'] == 'attribute_0'
    assert assignment['delegatedRequirements'][0]['coverage']['id'] == 'session_' + kind
    assert [r['value'] for r in assignment['assignedRequirements'] if r['kind'] == 'attribute'] == ['role', 'department']


@pytest.mark.parametrize('language,question', [('en', TRACE['originalQuestion']), ('ar', 'هل تعرف القسم والدور ونطاق البيانات الخاص بي المسجّل الدخول حاليًا؟')])
def test_original_question_assignment_and_source_receipt_survive_analysis_repairs(language, question):
    task, partition, projection, permission, canonical = invocation()
    calls = []
    class Planner:
        async def generic_reader_json(self, **kwargs):
            calls.append(copy.deepcopy(kwargs))
            # Replay the actual defective plan. The runtime must never silently
            # erase its missing entry or turn this old result into a success.
            return copy.deepcopy(TRACE['analysisPlan'])
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = question; reader.canonical_question = canonical
    reader.response_language = language; reader.deadline = time.monotonic() + 30
    reader.session_supplement = projection
    reader.audit.update(sessionIntentPartition=partition, permission=permission)
    attempts = []
    def validation(plan):
        attempts.append(plan.missing)
        if len(attempts) == 1:
            raise PipelineError('assigned_attribute_unverified', 'planning')
    result = asyncio.run(reader.structured(AnalysisPlan, 'Plan only the assigned read.',
        {'question': question, 'task': task.model_dump(), 'requirements': requirements_for(task)}, validation))
    assert len(calls) == 2 and calls[1]['correction']
    assert calls[0]['instruction'] == calls[1]['instruction']
    assert calls[0]['data'] == {k: v for k, v in calls[1]['data'].items() if k != 'priorValidationConstraints'}
    assert calls[1]['data']['priorValidationConstraints'] == [{'code': 'assigned_attribute_unverified'}]
    for call in calls:
        assert call['data']['originalQuestion'] == question
        assert call['data']['canonicalQuestion'] == canonical
        assert call['data']['taskAssignment']['delegatedRequirements'][0]['sourceReceipt']['fingerprint'] == permission['fingerprint']
        assert 'only assignedRequirements are your computation' in call['instruction']
        assert 'Flag omitted requirements using this stage' not in call['instruction']
    assert attempts == [['data_scope_value'], ['data_scope_value']]
    assert result.missing == ['data_scope_value']


def test_ordinary_and_unproven_requests_keep_original_omission_guard():
    task, partition, projection, permission, question = invocation()
    calls = []
    class Planner:
        async def generic_reader_json(self, **kwargs):
            calls.append(copy.deepcopy(kwargs))
            return copy.deepcopy(TRACE['analysisPlan'])
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = reader.canonical_question = question
    reader.deadline = time.monotonic() + 30
    reader.session_supplement = projection
    reader.audit.update(sessionIntentPartition=partition, permission={**permission, 'fingerprint': 'different'})
    result = asyncio.run(reader.structured(AnalysisPlan, 'Plan a read.', {'task': task.model_dump()}))
    assert 'taskAssignment' not in calls[0]['data']
    assert 'Flag omitted requirements using this stage' in calls[0]['instruction']
    assert result.missing == TRACE['analysisPlan']['missing']
