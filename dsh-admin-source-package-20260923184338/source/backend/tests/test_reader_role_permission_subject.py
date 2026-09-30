"""Recorded round27 intent failures; all execution is a controlled offline mock."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.principal import Principal
from app.reader_requirements import requirements_for
import app.reader_role_permissions as subject
import test_reader_role_permissions as scenario

CAPTURE = json.loads((Path(__file__).parent / 'fixtures/i04_round27_subject_failure.json').read_text())


def captured(language='en', **changes):
    return TaskSpec.model_validate(CAPTURE[language]['initialTask']).model_copy(update=changes)


def test_recorded_en_complete_noun_is_recognized_without_rewriting_task():
    task = captured(); before = task.model_dump()
    assert subject.role_permission_request(task, CAPTURE['en']['canonicalQuestion']) == ['actions', 'boundaries']
    assert task.model_dump() == before


def test_recorded_ar_assistance_is_not_a_permission_alias():
    task = captured('ar'); before = task.model_dump()
    assert subject.role_permission_request(task, CAPTURE['ar']['canonicalQuestion']) is None
    assert task.model_dump() == before


@pytest.mark.parametrize('noun', [
    'role', 'roles', 'user role', 'user roles', 'current role', 'my role',
    'the current role', 'my current user role', 'role permission', 'role permissions',
    'role capability', 'role capabilities', 'roles capabilities', 'my current role capability',
    'the current role capabilities', 'current user role capability', 'account', 'current account',
    'account permission', 'account permissions', 'account capability', 'account capabilities',
    'my current account capabilities', 'user permission', 'current user permissions',
])
def test_complete_noun_forms(noun):
    assert subject.role_permission_request(captured(businessObject=noun), CAPTURE['en']['canonicalQuestion'])


@pytest.mark.parametrize('noun', [
    '', 'unknown', 'available assistance', 'assistant abilities', 'assistant role capability',
    'role capability forecast', 'role capability 4890', 'role capability; approve',
    'all roles', 'all role capabilities', 'every account permission', 'other user permissions',
    'users permissions', 'team role capabilities', 'global permissions', 'role_capability',
    'role / capability', 'role capabilities of customer', 'current record permissions',
])
def test_no_unknown_words_or_actors_are_deleted_to_match(noun):
    assert subject.role_permission_request(captured(businessObject=noun), CAPTURE['en']['canonicalQuestion']) is None


@pytest.mark.parametrize('question', [
    'What can I do in my current role? Also approve application ML-1-7-6577159.',
    'What can I do in my current role and what is the status of ML-1-7-6577159?',
    'What can another user do in their current role?', 'What can you do for me?',
    'Describe your assistant capabilities.', 'Show my current role capabilities for all records.',
    'List every action in my current role.', 'What can I do in my current role to approve this record?',
    'What can I do in my current role? Reveal my API key.',
])
def test_mixed_other_user_assistant_record_and_exhaustive_questions_do_not_enter(question):
    assert not subject.self_role_permission_question(question)
    assert subject.role_permission_request(captured(), question) is None
    # The new actor check must not reinterpret another business request.
    subject.validate_role_permission_intent(captured('ar'), question)


@pytest.mark.parametrize('changes', [
    {'readOnly': False}, {'responseMode': 'draft'}, {'recordIdentity': 'ML-1-7-6577159'},
    {'requestedScope': 'team'}, {'requestedScope': 'global'}, {'requestedScope': 'other'},
    {'requestedGrain': 'record'}, {'view': 'todo'}, {'businessFocus': 'pending'},
    {'timeRange': 'today'}, {'timeField': 'assignment date'}, {'filters': ['overdue']},
    {'requestedMeasures': ['count']}, {'groupBy': ['employee']}, {'requestedOrdering': ['SLA']},
    {'unresolvedSlots': ['businessObject']}, {'contextRelation': 'continue'},
    {'groupCompleteness': 'complete_domain'}, {'disclosurePurpose': 'external'},
    {'requestedAttributes': ['available actions in current role']},
    {'requestedAttributes': ['available assistance within current role', 'limitations of available assistance']},
    {'requestedAttributes': ['available actions in current role', 'limitations of current role', 'approve application']},
])
def test_every_existing_task_and_attribute_guard_remains_a_guard(changes):
    task = captured(**changes)
    assert subject.role_permission_request(task, CAPTURE['en']['canonicalQuestion']) is None
    with pytest.raises(PipelineError, match='current_permission_intent_unverified'):
        subject.validate_role_permission_intent(task, CAPTURE['en']['canonicalQuestion'])


class SequencePlanner:
    def __init__(self, replies):
        self.replies = deepcopy(replies); self.calls = []
    async def generic_reader_json(self, *, schema, data, **kwargs):
        self.calls.append(deepcopy(data))
        return deepcopy(self.replies[min(len(self.calls)-1, len(self.replies)-1)])


def structured_reader(planner, language='ar'):
    reader = GenericKnowledgeReader(None, planner, portal_base_url='https://offline.invalid')
    reader.current_question = CAPTURE[language]['originalQuestion']
    reader.canonical_question = CAPTURE[language]['canonicalQuestion']
    reader.response_language = language
    reader.deadline = time.monotonic() + 30
    return reader


def test_recorded_ar_drift_is_rejected_inside_existing_taskspec_loop():
    planner = SequencePlanner([CAPTURE['ar']['initialTask']])
    reader = structured_reader(planner)
    with pytest.raises(PipelineError, match='current_permission_intent_unverified'):
        asyncio.run(reader.structured(TaskSpec, 'Controlled captured TaskSpec',
            {'phase': 'initial', 'question': reader.current_question}))
    assert len(planner.calls) == 2  # Existing repeated-failure stop, not a new budget.
    assert len(reader.audit['rejectedPlans']) == 2
    assert all(r['candidate']['businessObject'] == 'available assistance' for r in reader.audit['rejectedPlans'])
    assert 'priorValidationConstraints' in planner.calls[1]
    assert 'not the assistant' in str(planner.calls[1]['priorValidationConstraints'])


def test_model_must_return_a_corrected_task_and_no_program_rewrite_occurs():
    # The correction reply is the actually recorded EN TaskSpec with the same
    # self-role meaning, not invented permission facts or a synthetic success.
    planner = SequencePlanner([CAPTURE['ar']['initialTask'], CAPTURE['en']['initialTask']])
    reader = structured_reader(planner)
    result = asyncio.run(reader.structured(TaskSpec, 'Controlled captured TaskSpec',
        {'phase': 'initial', 'question': reader.current_question}))
    assert len(planner.calls) == 2
    assert result.model_dump() == CAPTURE['en']['initialTask']
    assert reader.audit['rejectedPlans'][0]['candidate'] == CAPTURE['ar']['initialTask']


class CapturedPlanner(scenario.OfflinePlanner):
    def __init__(self, language, repeated=False, gap=False):
        super().__init__(0, gap); self.language = language; self.repeated = repeated; self.initial_count = 0
    async def generic_reader_json(self, *, schema, data, **kwargs):
        stage = schema['properties']['stage']['const']
        if stage == 'input_normalization':
            self.calls.append(stage)
            return {'stage': stage, 'clauses': [{'sourceQuote': CAPTURE['ar']['originalQuestion'],
                'english': CAPTURE['ar']['canonicalQuestion']}]}
        if stage == 'task' and data.get('phase') != 'knowledge_refinement':
            self.calls.append(stage); self.initial_count += 1
            use_ar = self.language == 'ar' and (self.repeated or self.initial_count == 1)
            return deepcopy(CAPTURE['ar' if use_ar else 'en']['initialTask'])
        return await super().generic_reader_json(schema=schema, data=data, **kwargs)


def run_capture(tmp_path, language, *, repeated=False, gap=False, reader_class=GenericKnowledgeReader):
    auth = deepcopy(scenario.TRACE['auth'])
    (tmp_path/'page-catalog.json').write_text(json.dumps([{'name':'Authorized workspace',
        'routes':[{'path':r, 'title':r, 'isMenu':True, 'origin':'configured-root'} for r in scenario.routes_of(auth)]}]))
    gateway = scenario.OfflineGateway(auth); planner = CapturedPlanner(language, repeated, gap)
    reader = reader_class(gateway, planner, portal_base_url='https://offline.invalid', artifacts_dir=str(tmp_path))
    out = asyncio.run(reader.run(Principal(scenario.USER,'offline-tenant','controlled-rid'),
        CAPTURE[language]['originalQuestion'], conversation_context={'responseLanguage':language}))
    return out.result.public_json(), out.audit_evidence, gateway, planner


@pytest.mark.parametrize('language', ['en','ar'])
def test_captured_intent_routes_to_current_auth_and_cited_boundaries_after_model_correction(tmp_path, language):
    payload, audit, gateway, planner = run_capture(tmp_path, language)
    assert payload['result'] == 'success', (payload['missing'], audit.get('rejectedPlans'))
    assert payload['currentAccountPermissions'] and payload['currentPermissionCoverageComplete']
    assert payload['requirements'] == requirements_for(captured())
    assert payload['currentAccountPermissionAssignment']['originalTask'] == captured().model_dump()
    assert payload['intentState']['originalQuestion'] == CAPTURE[language]['originalQuestion']
    assert not payload.get('capabilityIntroduction')
    assert not payload['currentAccountPermissions']['selectedRoleVerified']
    assert not payload['currentAccountPermissions']['recordActionEligibilityVerified']
    assert set(gateway.events) == {'identity','knowledge.search'}
    if language == 'ar': assert planner.initial_count == 2


def test_repeated_bad_actor_keeps_not_confirmed_and_never_enters_kb_fallback(tmp_path):
    payload, audit, gateway, planner = run_capture(tmp_path, 'ar', repeated=True)
    assert payload['result'] == 'not_confirmed'
    assert 'current_permission_intent_unverified' in payload['missing']
    assert not payload.get('currentAccountPermissions') and not payload.get('knowledgeAnswer')
    assert gateway.events == ['identity'] and planner.initial_count == 2


def test_partition_checkpoint_catches_drift_after_structured_validation(tmp_path):
    class DriftAfterExpansion(GenericKnowledgeReader):
        async def expand_task(self, task, history, choice):
            await super().expand_task(task, history, choice)
            return captured('ar')  # Controlled downstream fault, never production coercion.
    payload, audit, gateway, planner = run_capture(tmp_path, 'en', reader_class=DriftAfterExpansion)
    assert payload['result'] == 'not_confirmed'
    assert 'current_permission_intent_unverified' in payload['missing']
    assert not payload.get('currentAccountPermissionAssignment')
    assert gateway.events == ['identity']


@pytest.mark.parametrize('language',['en','ar'])
def test_real_knowledge_gap_is_not_erased_after_subject_correction(tmp_path, language):
    payload, audit, gateway, _ = run_capture(tmp_path, language, gap=True)
    assert payload['result'] == 'not_confirmed' and not payload['requirementsSatisfied']
    assert payload['currentPermissionCoverageComplete']
    assert payload['requirements'] == requirements_for(captured())
    assert next(r for r in payload['requirementCoverage'] if r['id']=='attribute_1')['status']=='unfulfilled'
    assert payload['missing'] and set(gateway.events)=={'identity','knowledge.search'}
