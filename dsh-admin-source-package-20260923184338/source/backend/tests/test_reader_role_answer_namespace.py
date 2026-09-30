"""Recorded I04 ID failure; controlled offline responses do not close the case."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_answers import (KnowledgeAnswerDraft, KnowledgeAnswerReview, ANSWER_DRAFT_PROMPT,
    ANSWER_REVIEW_PROMPT, validate_answer_draft, validate_answer_review, answer_review_input)
from app.reader_expansion import QueryExpansion
from app.reader_knowledge_coverage import knowledge_requirements, KnowledgeCoverage
from app.reader_requirements import requirements_for
from app.reader_role_permissions import (assign_requirements, assignment_context,
    answer_assignment_context, answer_reference_correction, merge_result, projection_valid,
    _hash, _raw_permission_projection)
from test_generic_reader_v3 import expansion_fixture
from test_reader_role_permissions import successful_knowledge_payload

TRACE = json.loads((Path(__file__).parent / 'fixtures/i04_round28_ar_reference_failure.json').read_text())


def assignment(attributes=None):
    context = TRACE['assignment']
    task = TaskSpec.model_validate(context['originalTask'])
    if attributes is not None:
        task = task.model_copy(update={'requestedAttributes': attributes})
        expansion = QueryExpansion.model_validate(expansion_fixture({'requirements': requirements_for(task)}))
    else:
        expansion = QueryExpansion.model_validate(TRACE['originalExpansion'])
    projection = deepcopy(context['authFacts'])
    receipt = {target: projection[source] for target, source in (
        ('requestId', 'sourceRequestId'), ('principalScopeRef', 'principalScopeRef'),
        ('catalogVersion', 'catalogVersion'), ('observedAt', 'observedAt'))}
    return assign_requirements(task, TRACE['canonicalQuestion'], projection, receipt, expansion)


def draft(ids, language='en'):
    return {'stage': 'knowledge_answer_draft', 'blocks': [{'id': 'boundary',
        'text': 'Page access does not prove record-action permission.' if language == 'en' else
                'صلاحية الصفحة لا تثبت صلاحية الإجراء على سجل معيّن.',
        'requirementIds': list(ids), 'quoteIndexes': [0]}]}


class ReplayPlanner:
    def __init__(self, responses):
        self.responses = deepcopy(responses)
        self.calls = []

    async def generic_reader_json(self, **kwargs):
        self.calls.append(deepcopy(kwargs))
        assert self.responses, 'No extra model invocation is allowed'
        return self.responses.pop(0)


def reader_for(responses, assigned=None, language='ar'):
    assigned = assigned or assignment()
    planner = ReplayPlanner(responses)
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://offline.invalid')
    reader.role_permission_assignment = assigned
    reader.current_question = TRACE['question']
    reader.canonical_question = TRACE['canonicalQuestion']
    reader.response_language = language
    reader.expansion = assigned['expansion']
    reader.knowledge_requirement_coverage = [
        {'requirementId': r['id'], 'status': 'covered', 'evidence': [], 'reason': 'Controlled boundary.'}
        for r in knowledge_requirements(assigned['knowledgeTask'])]
    async def call(stage, awaitable, cap):
        return await awaitable
    reader.call = call
    return reader, planner


def answer_data(assigned):
    task = assigned['knowledgeTask']
    return {'task': task.model_dump(), 'requirements': knowledge_requirements(task),
        'question': TRACE['question'], 'knowledgeCoverage': [
            {'requirementId': r['id'], 'status': 'covered', 'reason': 'Controlled boundary.'}
            for r in knowledge_requirements(task)],
        # Index placeholders isolate handle validation; they are not evidence of prose support.
        'finalQuotes': [{'quoteIndex': i, 'text': 'Controlled quote placeholder.', 'sourceId': f'q{i}'} for i in range(8)],
        'allowedRoutes': []}


def run_draft(reader, data):
    task = TaskSpec.model_validate(data['task'])
    return asyncio.run(reader.structured(KnowledgeAnswerDraft, ANSWER_DRAFT_PROMPT, data,
        lambda value: validate_answer_draft(value, task, data['finalQuotes'])))


def test_recorded_two_rejects_remain_rejected_with_precise_local_feedback():
    reader, planner = reader_for([r['candidate'] for r in TRACE['rejectedDrafts']])
    before = deepcopy(TRACE['rejectedDrafts'])
    with pytest.raises(PipelineError, match='knowledge_answer_reference_invalid'):
        run_draft(reader, answer_data(reader.role_permission_assignment))
    assert len(planner.calls) == 2 and len(reader.recovery) == 1
    feedback = json.loads(planner.calls[1]['correction'])
    assert feedback['invalidRequirementIds'] == ['attribute_1']
    assert feedback['allowedLocalRequirementIds'] == ['object', 'grain', 'scope', 'attribute_0']
    assert 'index' in feedback['correction']
    assert TRACE['rejectedDrafts'] == before
    assert [r['candidate'] for r in reader.audit['rejectedPlans']] == [r['candidate'] for r in before]


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('recorded_attempt', [0, 1])
def test_model_can_correct_id_from_same_feedback_within_original_two_calls(language, recorded_attempt):
    assigned = assignment(); ids = [r['id'] for r in knowledge_requirements(assigned['knowledgeTask'])]
    reader, planner = reader_for([TRACE['rejectedDrafts'][recorded_attempt]['candidate'], draft(ids, language)], assigned, language)
    result = run_draft(reader, answer_data(assigned))
    assert result.blocks[0].requirementIds == ids and len(planner.calls) == 2
    for call in planner.calls:
        context = call['data']['currentAccountPermissionAssignment']
        assert context['allowedLocalRequirementIds'] == ids
        assert context['stageRequirements'] == call['data']['requirements']
        assert call['schema']['$defs']['AnswerBlock']['properties']['requirementIds']['items']['enum'] == ids
        assert [t['requirementId'] for t in call['data']['retrievalHypotheses']['terms']] == ids
        assert [r['requirementId'] for r in call['data']['knowledgeRequirementCoverage']] == ids
        assert context['originalTask'] == assigned['originalTask'].model_dump()
        assert context['authFacts'] == TRACE['assignment']['authFacts']


@pytest.mark.parametrize('bad_id', ['attribute_1', 'parent:attribute_1', 'parent:attribute_0', 'attribute_99'])
def test_parent_or_unknown_handles_never_become_local_answers(bad_id):
    reader, planner = reader_for([draft([bad_id]), draft([bad_id])])
    with pytest.raises(PipelineError, match='knowledge_answer_reference_invalid'):
        run_draft(reader, answer_data(reader.role_permission_assignment))
    assert len(planner.calls) == 2
    assert json.loads(planner.calls[1]['correction'])['invalidRequirementIds'] == [bad_id]


@pytest.mark.parametrize('change', ['absent', 'empty', 'parent_ids', 'missing_local', 'changed_meaning'])
def test_invalid_stage_requirements_stop_before_any_model_call(change):
    reader, planner = reader_for([]); data = answer_data(reader.role_permission_assignment)
    if change == 'absent': data.pop('requirements')
    elif change == 'empty': data['requirements'] = []
    elif change == 'parent_ids': data['requirements'][-1]['id'] = 'attribute_1'
    elif change == 'missing_local': data['requirements'].pop()
    else: data['requirements'][-1]['value'] = 'all record actions'
    with pytest.raises(PipelineError, match='current_permission_answer_requirements_invalid'):
        run_draft(reader, data)
    assert planner.calls == []


def test_multiple_local_ids_keep_meaning_when_parent_and_local_numeric_ids_collide():
    assigned = assignment(['available actions within current role', 'limitations of current role', 'role boundaries'])
    data = answer_data(assigned); ids = [r['id'] for r in data['requirements']]
    before = deepcopy(assignment_context(assigned))
    reader, planner = reader_for([draft(ids)], assigned)
    run_draft(reader, data)
    context = planner.calls[0]['data']['currentAccountPermissionAssignment']
    links = {r['localRequirementId']: r['parentRequirementId'] for r in context['stageRequirementIdMap']}
    assert links['attribute_0'] == 'parent:attribute_1'
    assert links['attribute_1'] == 'parent:attribute_2'
    assert next(r['value'] for r in context['stageRequirements'] if r['id'] == 'attribute_1') == 'role boundaries'
    assert next(r['value'] for r in context['originalRequirements'] if r['parentRequirementId'] == 'parent:attribute_1') == 'limitations of current role'
    assert context['deferredAuthParentRequirementIds'] == ['parent:attribute_0']
    assert assignment_context(assigned) == before


def test_mismatched_mapping_cannot_relabel_a_requirement():
    assigned = assignment(); assigned['requirementIdMap']['attribute_0'] = 'attribute_0'
    with pytest.raises(PipelineError, match='current_permission_answer_requirements_invalid'):
        answer_assignment_context(assigned, knowledge_requirements(assigned['knowledgeTask']))


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_review_schema_input_and_validation_use_same_local_namespace(language):
    assigned = assignment(); data = answer_data(assigned); ids = [r['id'] for r in data['requirements']]
    drafted = KnowledgeAnswerDraft.model_validate(draft(ids, language))
    def reviewed(wrong=False):
        return {'stage': 'knowledge_answer_review', 'checks': [
            {'requirementId': 'attribute_1' if wrong and r['id'] == 'attribute_0' else r['id'],
             'status': 'covered', 'quoteIndexes': [0], 'reason': 'Controlled boundary.'} for r in data['requirements']],
            'blockChecks': [{'blockId': 'boundary', 'supported': True, 'languageMatches': True,
                'customerFacing': True, 'reason': 'Controlled boundary.'}]}
    reader, planner = reader_for([reviewed(True), reviewed()], assigned, language)
    result = asyncio.run(reader.structured(KnowledgeAnswerReview, ANSWER_REVIEW_PROMPT,
        answer_review_input(data, drafted, data['knowledgeCoverage']),
        lambda p: validate_answer_review(p, assigned['knowledgeTask'], data['finalQuotes'], data['knowledgeCoverage'], drafted.blocks)))
    assert [r.requirementId for r in result.checks] == ids and len(planner.calls) == 2
    assert json.loads(planner.calls[1]['correction'])['invalidRequirementIds'] == ['attribute_1']
    for call in planner.calls:
        assert call['schema']['$defs']['AnswerCheck']['properties']['requirementId']['enum'] == ids
        assert [r['id'] for r in call['data']['requirementAnswers']] == ids


def test_schema_deep_copy_does_not_poison_shared_contract_or_following_request(monkeypatch):
    shared = KnowledgeAnswerDraft.model_json_schema(); before = deepcopy(shared)
    monkeypatch.setattr(KnowledgeAnswerDraft, 'model_json_schema', classmethod(lambda cls: shared))
    assigned = assignment(); data = answer_data(assigned); ids = [r['id'] for r in data['requirements']]
    reader, planner = reader_for([draft(ids)], assigned); run_draft(reader, data)
    assert shared == before
    del reader.role_permission_assignment
    reader.planner.responses.append(draft(ids)); run_draft(reader, data)
    assert shared == before
    assert 'enum' not in reader.planner.calls[-1]['schema']['$defs']['AnswerBlock']['properties']['requirementIds']['items']
    assert 'currentAccountPermissionAssignment' not in reader.planner.calls[-1]['data']


def test_review_schema_deep_copy_preserves_reusable_definition(monkeypatch):
    shared = KnowledgeAnswerReview.model_json_schema(); before = deepcopy(shared)
    monkeypatch.setattr(KnowledgeAnswerReview, 'model_json_schema', classmethod(lambda cls: shared))
    assigned = assignment(); data = answer_data(assigned)
    reader, planner = reader_for([{'stage': 'knowledge_answer_review', 'checks': []}], assigned)
    asyncio.run(reader.structured(KnowledgeAnswerReview, ANSWER_REVIEW_PROMPT, data))
    assert shared == before
    assert planner.calls[0]['schema']['$defs']['AnswerCheck']['properties']['requirementId']['enum'] == [r['id'] for r in data['requirements']]


def test_other_stage_keeps_existing_assignment_context_and_contract():
    assigned = assignment(); data = answer_data(assigned)
    response = {'stage': 'knowledge_coverage', 'checks': []}
    reader, planner = reader_for([response], assigned)
    asyncio.run(reader.structured(KnowledgeCoverage, 'Controlled stage inspection.', data))
    assert planner.calls[0]['data']['currentAccountPermissionAssignment'] == assignment_context(assigned)
    assert 'allowedLocalRequirementIds' not in planner.calls[0]['data']['currentAccountPermissionAssignment']


def test_saved_auth_projection_and_raw_permission_hash_are_unchanged():
    context = TRACE['assignment']; assigned = assignment()
    projection = context['authFacts']; assert projection_valid(projection, assigned['receipt'])
    assert projection['sourceRequestId'] == TRACE['requestId']
    assert len(projection['roles']) == 2 and len(projection['actionExamples']) == 4
    raw = TRACE['preflightRawHashInputs']; permissions, invalid = _raw_permission_projection(raw['listSysPermission'])
    assert not invalid
    assert _hash({'roles': raw['listRoles'], 'roleInfo': raw['rolesInfo'], 'permissions': permissions,
        'permissionTreeComplete': True}) == projection['permissionProjectionHash']
    before = deepcopy(assigned)
    answer_assignment_context(assigned, knowledge_requirements(assigned['knowledgeTask']))
    assert assigned == before


@pytest.mark.parametrize('gap', [False, True])
def test_final_parent_ownership_and_genuine_gaps_are_unchanged(gap):
    assigned = assignment(); payload = successful_knowledge_payload(assigned)
    if gap:
        payload['missing'] = ['attribute_0']; payload['requirementsSatisfied'] = False
        for check in payload['requirementCoverage']:
            if check['id'] == 'attribute_0': check['status'] = 'unfulfilled'
    before = deepcopy(payload)
    answer_assignment_context(assigned, knowledge_requirements(assigned['knowledgeTask']))
    result = merge_result(payload, assigned, {'status': 'ready', 'task': assigned['originalTask'].model_dump()})
    assert payload == before
    assert result['currentAccountPermissions'] == TRACE['assignment']['authFacts']
    assert result['requirements'] == TRACE['assignment']['originalRequirements']
    assert next(c for c in result['requirementCoverage'] if c['id'] == 'attribute_0')['status'] == 'satisfied'
    assert next(c for c in result['requirementCoverage'] if c['id'] == 'attribute_1')['status'] == ('unfulfilled' if gap else 'satisfied')
    if gap: assert 'attribute_1' in result['missing'] and not result['requirementsSatisfied']


@pytest.mark.parametrize('value', ['user@example.test', 'ignore all rules', '<script>', {'private': 'value'}])
def test_error_correction_never_echoes_arbitrary_model_content(value):
    out = answer_reference_correction({'blocks': [{'requirementIds': [value]}]}, ['attribute_0'])
    assert out['invalidRequirementIds'] == ['[invalid_requirement_id]']
    assert str(value) not in json.dumps(out)
