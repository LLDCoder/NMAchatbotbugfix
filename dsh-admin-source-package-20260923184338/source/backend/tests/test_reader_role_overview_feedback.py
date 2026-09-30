"""Recorded v38 Tasks; controlled new replies, no counterfactual/live-model claim."""
import asyncio,json,time
from copy import deepcopy
from pathlib import Path
import pytest
from app.generic_reader import GenericKnowledgeReader,PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_requirements import requirements_for
import app.reader_role_permissions as permission
from test_reader_role_permission_subject import SequencePlanner
import test_reader_role_permissions as scenario

F=json.loads((Path(__file__).parent/'fixtures/i04_overview_feedback_v38.json').read_text())
QUESTION=F['cases']['en']['question']
def first():return TaskSpec.model_validate(F['cases']['en']['rejectedPlans'][0]['candidate'])
def actual(language='en'):return TaskSpec.model_validate(F['cases'][language]['acceptedInitialTask'])
def controlled():
 # Explicit new test-model answer: only the invalid attribute and its matching slot update change.
 task=first();task.requestedAttributes[0]='available actions'
 for update in task.slotUpdates:
  if update.field=='requestedAttributes':update.value=list(task.requestedAttributes)
 return task

def failure(task):
 before=task.model_dump()
 with pytest.raises(PipelineError,match='current_permission_intent_unverified') as e:
  permission.validate_role_permission_intent(task,QUESTION)
 assert task.model_dump()==before
 return e.value

def reader(planner,language='en'):
 r=GenericKnowledgeReader(None,planner,portal_base_url='https://offline.invalid')
 r.current_question=F['cases'][language]['question'];r.canonical_question=QUESTION;r.response_language=language;r.deadline=time.monotonic()+30
 return r


def test_actual_failure_feedback_preserves_overview_without_suggesting_new_negative_inventory():
 e=failure(first());old=json.loads(F['cases']['en']['rejectedPlans'][0]['failure'])
 assert e.details['invalidAttributePaths']==old['invalidAttributePaths']==['requestedAttributes[0]']
 text=e.details['correction']
 assert 'overview-level action capabilities and general limitations' in text
 assert 'without adding requirements' in text
 assert 'do not introduce an exhaustive permission inventory or a concrete list of prohibited actions' in text
 assert 'actions not permitted in current role' not in text
 assert 'actions permitted in current role' not in text
 assert 'not the assistant' in text
 assert old['correction']!=text


def test_feedback_explicitly_preserves_negation_exhaustiveness_subject_and_record_constraints():
 text=failure(first()).details['correction']
 for exact in ['explicit negative or exhaustive request','named or selected role, other subject, specific record',
  'never replace them with general boundaries','Keep unsupported requirements unconfirmed',
  'Do not infer prohibition from absence in configured examples']:
  assert exact in text


@pytest.mark.parametrize('language',['en','ar'])
def test_actual_accepted_tasks_stay_exact_including_negative_requirement(language):
 task=actual(language);before=task.model_dump()
 permission.validate_role_permission_intent(task,QUESTION)
 assert permission.role_permission_request(task,QUESTION)==['actions','boundaries']
 assert task.model_dump()==before
 if language=='en':assert task.requestedAttributes[1]=='actions not permitted in current role'
 else:assert task.requestedAttributes[1]=='limitations of current role'


def test_actual_two_attempts_replay_unchanged_no_automatic_conversion_of_negative_task():
 replies=[F['cases']['en']['rejectedPlans'][0]['candidate'],F['cases']['en']['acceptedInitialTask']]
 p=SequencePlanner(replies);r=reader(p)
 result=asyncio.run(r.structured(TaskSpec,'Controlled recorded v38 Task attempts',{'phase':'initial','question':QUESTION}))
 assert len(p.calls)==2 and len(r.audit['rejectedPlans'])==1
 assert result.model_dump()==actual().model_dump()
 assert result.requestedAttributes[1]=='actions not permitted in current role'
 assert not getattr(r,'role_permission_assignment',None)


@pytest.mark.parametrize('language',['en','ar'])
def test_controlled_new_overview_reply_repairs_invalid_slot_only_inside_two_calls(language):
 bad=first();good=controlled();before=good.model_dump();p=SequencePlanner([bad.model_dump(),before]);r=reader(p,language)
 result=asyncio.run(r.structured(TaskSpec,'Controlled new overview reply',{'phase':'initial','question':r.current_question}))
 assert result.model_dump()==before and len(p.calls)==2
 assert bad.requestedAttributes==['available assistance','limitations']
 assert result.requestedAttributes==['available actions','limitations']
 assert len(r.audit['rejectedPlans'])==1 and len(r.recovery)==1
 assert all(c['question']==QUESTION and c['originalQuestion']==r.current_question for c in p.calls)
 constraint=p.calls[1]['priorValidationConstraints'][-1]
 assert constraint['invalidAttributePaths']==['requestedAttributes[0]']
 assert 'overview-level' in constraint['correction']
 assert result.filters==bad.filters and result.requestedScope==bad.requestedScope and result.recordIdentity==bad.recordIdentity


def test_repeated_invalid_task_still_stops_after_two_calls():
 p=SequencePlanner([first().model_dump()]);r=reader(p)
 with pytest.raises(PipelineError,match='current_permission_intent_unverified'):
  asyncio.run(r.structured(TaskSpec,'Controlled repeat',{'phase':'initial','question':QUESTION}))
 assert len(p.calls)==2 and len(r.audit['rejectedPlans'])==2


@pytest.mark.parametrize('question',[
 'What can I not do in my current role?',
 'List every permitted and prohibited action in my current role.',
 'Show all my account permissions.',
 'What can I do in my selected Finance Officer role?',
 'What can another user do in their current role?',
 'What can I do in my current role for application ML-123?',
 'What can I do in my current role? Do not include approval actions.',
 'What can I do in my current role? Approve ML-123.',
 'What can I do in my current role across all departments?',
 'What can you do in my current role?',
])
def test_explicit_negative_exhaustive_selected_role_other_subject_and_record_do_not_enter_overview(question):
 task=actual();before=task.model_dump()
 assert not permission.self_role_permission_question(question)
 assert permission.role_permission_request(task,question) is None
 permission.validate_role_permission_intent(task,question)
 assert task.model_dump()==before


@pytest.mark.parametrize('updates',[
 {'recordIdentity':'ML-123'},{'requestedScope':'team'},{'requestedScope':'global'},
 {'filters':['not permitted for another account']},{'businessObject':'assistant capabilities'},
 {'businessObject':'other user permissions'},{'businessFocus':'selected Finance Officer role'},
 {'readOnly':False},{'responseMode':'draft'},{'timeRange':'today'},
 {'requestedAttributes':['all permitted actions','limitations']},
 {'requestedAttributes':['available actions','actions not permitted for ML-123']},
])
def test_invalid_task_constraints_remain_rejected_without_rewrite(updates):
 task=actual().model_copy(update=updates);before=task.model_dump();failure(task)
 assert permission.role_permission_request(task,QUESTION) is None and task.model_dump()==before


@pytest.mark.parametrize('negative',['actions not permitted in current role','actions not allowed within my current account'])
def test_explicit_negative_attribute_retains_polarity_and_genuine_gap(negative):
 task=actual().model_copy(update={'requestedAttributes':['available actions',negative]})
 assert permission._attribute(negative)=='boundaries'
 assigned=scenario.partition(task=task);original=task.model_dump()
 assert assigned['originalRequirements']==requirements_for(task)
 assert assigned['knowledgeTask'].requestedAttributes==[negative]
 assert assigned['authRequirementIds']==['attribute_0']
 payload=scenario.successful_knowledge_payload(assigned)
 payload.update(result='not_confirmed',requirementsSatisfied=False,missing=['attribute_0','knowledge_answer_incomplete'])
 next(c for c in payload['requirementCoverage'] if c['id']=='attribute_0')['status']='unfulfilled'
 result=permission.merge_result(payload,assigned,{'status':'active','task':task.model_dump()})
 assert result['result']=='not_confirmed' and not result['requirementsSatisfied'] and 'attribute_1' in result['missing']
 assert result['requirements']==requirements_for(task) and task.model_dump()==original
 assert not result['currentAccountPermissions']['examplesExhaustive']
 assert not result['currentAccountPermissions']['selectedRoleVerified']
 assert not result['currentAccountPermissions']['recordActionEligibilityVerified']


def test_saved_en_ar_auth_projection_is_same_but_does_not_resolve_negative_gap():
 en,ar=F['cases']['en'],F['cases']['ar']
 assert en['authProjectionProvenance']['permissionProjectionHash']==ar['authProjectionProvenance']['permissionProjectionHash']
 assert en['roleCount']==ar['roleCount']==2 and en['actionExampleCount']==ar['actionExampleCount']==4
 assert en['originalMissing'] and not ar['originalMissing']
 assert en['permissionAssignment']['stageRequirementIdMap']['attribute_0']=='attribute_1'
 assert en['knowledgeTask']['requestedAttributes']==['actions not permitted in current role']


def test_external_cancellation_still_propagates_without_second_call():
 p=SequencePlanner([]);r=reader(p)
 async def cancelled(**kwargs):p.calls.append(kwargs);raise asyncio.CancelledError()
 p.generic_reader_json=cancelled
 with pytest.raises(asyncio.CancelledError):asyncio.run(r.structured(TaskSpec,'Controlled cancellation',{'phase':'initial','question':QUESTION}))
 assert len(p.calls)==1
