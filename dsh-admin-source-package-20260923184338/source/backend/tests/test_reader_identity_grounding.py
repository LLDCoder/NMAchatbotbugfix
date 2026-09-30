import asyncio
import copy
import time
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_context import validate_record_identity, validate_literal_view
from test_reader_parent_properties import fixture


@pytest.mark.parametrize('question,identity', [
    ('What are my current properties?', 'current signed-in user'),
    ('ما خصائصي الحالية؟', 'current signed-in user'),
    ('Read record AB-1234.', 'AB-123'),
    ('Read record AB-123.', 'AB-999'),
])
def test_record_identity_must_be_a_literal_or_bound_context(question, identity):
    task=fixture()[0].model_copy(update={'recordIdentity': identity})
    with pytest.raises(PipelineError, match='intent_record_identity_ungrounded'):
        validate_record_identity(task, question, {})


@pytest.mark.parametrize('question,identity', [
    ('Read record AB-123.', 'AB-123'),
    ('اعرض السجل AB-123.', 'AB-123'),
    ('Read "Alpha West".', 'Alpha West'),
    ('What are my current properties?', ''),
])
def test_literal_names_identifiers_and_identity_free_subject_queries_remain_valid(question, identity):
    task=fixture()[0].model_copy(update={'recordIdentity': identity})
    validate_record_identity(task, question, {})


def test_bound_prior_identity_cannot_cross_a_topic_switch():
    task=fixture()[0].model_copy(update={'recordIdentity':'AB-123','contextRelation':'continue'})
    history={'previousIntent':{'recordIdentity':'AB-123'}}
    validate_record_identity(task,'What about its status?',history)
    task.contextRelation='switch'
    with pytest.raises(PipelineError): validate_record_identity(task,'Show another subject.',history)


def test_selected_clarification_resolves_only_its_explicit_identity():
    task=fixture()[0].model_copy(update={'recordIdentity':'AB-123','contextRelation':'clarify'})
    choice={'updates':[{'field':'recordIdentity','source':'current','value':'AB-123'}]}
    validate_record_identity(task,'1',{},choice)
    task.recordIdentity='AB-999'
    with pytest.raises(PipelineError): validate_record_identity(task,'1',{},choice)


def test_actual_task_stage_retries_ungrounded_identity_before_expansion():
    task=fixture()[0]
    responses=[task.model_copy(update={'recordIdentity':'current signed-in user'}).model_dump(),task.model_dump()]
    class Planner:
        def __init__(self):self.calls=[]
        async def generic_reader_json(self,**kwargs):
            self.calls.append(copy.deepcopy(kwargs));return responses[len(self.calls)-1]
    reader=GenericKnowledgeReader(None,Planner(),portal_base_url='https://portal.test')
    reader.current_question='ما خصائصي الحالية؟';reader.canonical_question='What are my current properties?'
    reader.response_language='ar';reader.deadline=time.monotonic()+30
    result=asyncio.run(reader.structured(TaskSpec,'Parse intent.',{'question':reader.current_question}))
    assert not result.recordIdentity and len(reader.planner.calls)==2
    assert 'intent_record_identity_ungrounded' in reader.planner.calls[-1]['correction']
    assert result.requestedAttributes==task.requestedAttributes


def test_technical_view_is_only_allowed_from_question_or_bound_continuation():
    task=fixture()[0].model_copy(update={'view':'/viewer/details'})
    with pytest.raises(PipelineError,match='intent_view_ungrounded'):
        validate_literal_view(task,'What are its properties?',{})
    validate_literal_view(task,'Read /viewer/details.',{})
    task.contextRelation='continue'
    validate_literal_view(task,'And its groups?',{'previousIntent':{'view':'/viewer/details'}})
    task.contextRelation='switch'
    with pytest.raises(PipelineError):validate_literal_view(task,'Show another subject.',{'previousIntent':{'view':'/viewer/details'}})
