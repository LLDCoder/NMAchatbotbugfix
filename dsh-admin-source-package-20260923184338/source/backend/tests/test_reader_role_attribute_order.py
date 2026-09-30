"""Round28 actual TaskSpec attempts; offline correction, no fabricated grants."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import time
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_requirements import requirements_for
import app.reader_role_permissions as permission
from test_reader_role_permission_subject import SequencePlanner
import test_reader_role_permissions as scenario

FIXTURE=json.loads((Path(__file__).parent/'fixtures/i04_round28_attribute_order.json').read_text())
QUESTION=FIXTURE['question']

def actual(attempt=2, **changes):
    task=TaskSpec.model_validate(FIXTURE['rejectedPlans'][attempt-1]['candidate'])
    return task.model_copy(update=changes)

def reader(planner):
    value=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid')
    value.current_question=value.canonical_question=QUESTION
    value.response_language='en';value.deadline=time.monotonic()+30
    return value


def test_real_first_attempt_assistant_drift_is_rejected_with_precise_attribute_path():
    task=actual(1);before=task.model_dump()
    with pytest.raises(PipelineError) as failed:
        permission.validate_role_permission_intent(task,QUESTION)
    assert failed.value.code=='current_permission_intent_unverified'
    assert failed.value.details['invalidAttributePaths']==['requestedAttributes[0]']
    assert 'not the assistant' in failed.value.details['correction']
    assert permission.role_permission_request(task,QUESTION) is None
    assert task.model_dump()==before


def test_real_second_attempt_accepts_all_original_attributes_and_polarity():
    task=actual();before=task.model_dump()
    assert permission.role_permission_request(task,QUESTION)==['actions','boundaries','actions','boundaries']
    permission.validate_role_permission_intent(task,QUESTION)
    assert task.model_dump()==before


def test_real_recorded_two_attempts_use_existing_budget_and_never_rewrite_task():
    replies=[row['candidate'] for row in FIXTURE['rejectedPlans']]
    planner=SequencePlanner(replies);engine=reader(planner)
    result=asyncio.run(engine.structured(TaskSpec,'Controlled recorded TaskSpec attempts',
        {'phase':'initial','question':QUESTION}))
    assert len(planner.calls)==2 and len(engine.audit['rejectedPlans'])==1
    assert result.model_dump()==actual().model_dump()
    assert engine.audit['rejectedPlans'][0]['candidate']==FIXTURE['rejectedPlans'][0]['candidate']
    correction=str(planner.calls[1]['priorValidationConstraints'])
    assert 'invalidAttributePaths' in correction and 'requestedAttributes[0]' in correction
    assert not getattr(engine,'role_permission_assignment',None)


def test_repeated_actor_drift_still_stops_at_original_two_attempts():
    planner=SequencePlanner([FIXTURE['rejectedPlans'][0]['candidate']]);engine=reader(planner)
    with pytest.raises(PipelineError,match='current_permission_intent_unverified'):
        asyncio.run(engine.structured(TaskSpec,'Controlled repeated actor drift',
            {'phase':'initial','question':QUESTION}))
    assert len(planner.calls)==2 and len(engine.audit['rejectedPlans'])==2


@pytest.mark.parametrize('text', ['available actions','permitted actions','allowed actions','permissions',
 'business permissions','capabilities','available capabilities','current role permissions',
 'available actions in current role','permitted actions within my current account','my role permissions'])
def test_legacy_positive_vocabulary_still_works(text):
    assert permission._attribute(text)=='actions'


@pytest.mark.parametrize('text',['limitations','limits','permission limitations','permission boundaries',
 'boundaries','access limitations','current role limitations','limitations of current role',
 'limitations within my current account'])
def test_legacy_boundaries_still_work(text):
    assert permission._attribute(text)=='boundaries'


@pytest.mark.parametrize('text',['actions permitted','actions allowed','actions available',
 'actions permitted in current role','actions allowed within my current role',
 'actions available in the current account','ACTIONS PERMITTED IN CURRENT ROLE',
 'actions permitted in role','actions permitted within account'])
def test_complete_positive_postpositive_nominals(text):
    assert permission._attribute(text)=='actions'


@pytest.mark.parametrize('text',['actions not permitted','actions not allowed',
 'actions not permitted in current role','actions not allowed within my current role',
 'actions not permitted in the current account'])
def test_negation_is_preserved_and_never_assigned_to_auth_facts(text):
    assert permission._attribute(text)=='boundaries'


@pytest.mark.parametrize('text',['actions not available in current role',
 'actions permitted in another user role','actions permitted in their current role',
 'actions permitted in assistant role','actions permitted in global role',
 'actions permitted in current role for all records','all actions permitted in current role',
 'actions permitted in current role and approve ML-123','actions permitted in current role 123',
 'actions permitted in current role; export records','actions permitted! in current role',
 'actions permitted in current_role','actions not not permitted in current role',
 'actions permitted in current role not','not actions permitted in current role',
 'actions permitted in current role /dashboard','actions permitted in current role yesterday',
 'actions forbidden on application ML-123','available assistance','assistant capabilities'])
def test_extra_actor_scope_operation_number_punctuation_negation_are_not_deleted(text):
    assert permission._attribute(text) is None
    task=actual(requestedAttributes=['current role permissions','current role limitations',text])
    with pytest.raises(PipelineError) as failed:permission.validate_role_permission_intent(task,QUESTION)
    assert failed.value.details['invalidAttributePaths']==['requestedAttributes[2]']


@pytest.mark.parametrize('question',['What can my colleague do in their current role?',
 'What can I do in my current role and approve this application?',
 'What can I do in my current role? Show ML-123.',
 'What can I do in my current role across the whole organization?',
 'Tell me what a role means.','What can I not do in my current role?',
 'What can you do in my current role?','What can I do in my current role? List every action.'])
def test_whole_question_actor_mixed_global_role_only_and_negation_guards_unchanged(question):
    assert not permission.self_role_permission_question(question)
    assert permission.role_permission_request(actual(),question) is None


@pytest.mark.parametrize('changes',[{'requestedScope':'global'},{'requestedScope':'team'},
 {'businessObject':'available assistance'},{'businessObject':'other user permissions'},
 {'recordIdentity':'ML-123'},{'readOnly':False},{'responseMode':'draft'},
 {'groupCompleteness':'complete_domain'},{'filters':['department=other']},
 {'requestedAttributes':['actions not permitted in current role','limitations']},
 {'requestedAttributes':['actions permitted in current role']}])
def test_remaining_task_guards_are_still_hard(changes):
    task=actual(**changes)
    assert permission.role_permission_request(task,QUESTION) is None
    with pytest.raises(PipelineError,match='current_permission_intent_unverified'):
        permission.validate_role_permission_intent(task,QUESTION)


def test_partition_preserves_every_original_attribute_and_routes_negative_to_cited_knowledge():
    task=actual();before=task.model_dump()
    assignment=scenario.partition(task=task)
    assert assignment['originalTask'].model_dump()==before and task.model_dump()==before
    assert assignment['originalRequirements']==requirements_for(task)
    assert assignment['authRequirementIds']==['attribute_0','attribute_2']
    assert assignment['knowledgeTask'].requestedAttributes==[task.requestedAttributes[1],task.requestedAttributes[3]]
    assert assignment['requirementIdMap']['attribute_0']=='attribute_1'
    assert assignment['requirementIdMap']['attribute_1']=='attribute_3'
    assert not assignment['knowledgeTask'].needsLiveData
    updates={u.field:u.value for u in assignment['knowledgeTask'].slotUpdates}
    assert updates['requestedAttributes']==assignment['knowledgeTask'].requestedAttributes


@pytest.mark.parametrize('no_buttons',[False,True])
def test_negative_requirement_cannot_be_satisfied_by_auth_configuration_or_missing_permission(no_buttons):
    task=actual();auth=deepcopy(scenario.TRACE['auth'])
    if no_buttons:
        def remove(rows):
            for row in rows:
                row['buttonList']=[];remove(row.get('children') or [])
        remove(auth['data']['listSysPermission'])
    assigned=scenario.partition(task=task,auth=auth)
    payload=scenario.successful_knowledge_payload(assigned)
    # Explicit missing negative rule; auth may have actions but cannot fill it.
    payload.update(result='not_confirmed',requirementsSatisfied=False,missing=['attribute_1','knowledge_answer_incomplete'])
    next(c for c in payload['requirementCoverage'] if c['id']=='attribute_1')['status']='unfulfilled'
    result=permission.merge_result(payload,assigned,{'status':'active','task':task.model_dump()})
    assert result['result']=='not_confirmed' and not result['requirementsSatisfied']
    assert 'attribute_3' in result['missing']
    assert next(c for c in result['requirementCoverage'] if c['id']=='attribute_3')['status']=='unfulfilled'
    assert result['requirements']==requirements_for(task)
    assert not result['currentAccountPermissions']['recordActionEligibilityVerified']
    assert not result['currentAccountPermissions']['examplesExhaustive']
    assert not any(key.lower().startswith(('denied','prohibited')) for key in result['currentAccountPermissions'])


def test_already_partitioned_knowledge_subtask_does_not_receive_original_actor_gate():
    task=actual();assigned=scenario.partition(task=task)
    planner=SequencePlanner([assigned['knowledgeTask'].model_dump()]);engine=reader(planner)
    engine.role_permission_assignment=assigned
    result=asyncio.run(engine.structured(TaskSpec,'Controlled partitioned task',
        {'phase':'knowledge_refinement','question':QUESTION},lambda t:permission.validate_subtask(t,assigned)))
    assert result.model_dump()==assigned['knowledgeTask'].model_dump()
    assert len(planner.calls)==1
