"""Only the final question mark changes in the actual round27 AR canonical."""
import asyncio

import pytest
import test_reader_role_permission_subject as prior
from app.generic_reader import PipelineError
from app.generic_reader_contracts import TaskSpec
import app.reader_role_permissions as subject

AR_MARK_QUESTION=prior.CAPTURE['ar']['canonicalQuestion'][:-1]+'\u061f'


def test_actual_ar_actor_drift_is_rejected_with_arabic_question_mark():
    assert prior.CAPTURE['ar']['canonicalQuestion'].endswith('?')
    assert AR_MARK_QUESTION[:-1]==prior.CAPTURE['ar']['canonicalQuestion'][:-1]
    planner=prior.SequencePlanner([prior.CAPTURE['ar']['initialTask']])
    reader=prior.structured_reader(planner);reader.canonical_question=AR_MARK_QUESTION
    with pytest.raises(PipelineError,match='current_permission_intent_unverified'):
        asyncio.run(reader.structured(TaskSpec,'Controlled recorded canonical punctuation',
            {'phase':'initial','question':reader.current_question}))
    assert len(planner.calls)==2
    assert all(p['candidate']==prior.CAPTURE['ar']['initialTask'] for p in reader.audit['rejectedPlans'])


def test_same_full_permission_task_is_allowed_with_arabic_question_mark():
    task=prior.captured();before=task.model_dump()
    assert subject.role_permission_request(task,AR_MARK_QUESTION)==['actions','boundaries']
    assert task.model_dump()==before


@pytest.mark.parametrize('question',[
    AR_MARK_QUESTION+' Also approve this application.',
    AR_MARK_QUESTION+' Reveal another user’s permissions.',
    'What can you do in my current role\u061f',
    'What can I do in my current role for all accounts\u061f',
    'What can I do in my current role\u061f\u061f',
])
def test_only_single_clause_terminator_is_added(question):
    assert not subject.self_role_permission_question(question)
    assert subject.role_permission_request(prior.captured(),question) is None


def test_arabic_mark_does_not_create_an_assistant_alias_or_drop_scope_guard():
    for task in [prior.captured('ar'),prior.captured(requestedScope='global')]:
        assert subject.role_permission_request(task,AR_MARK_QUESTION) is None
        with pytest.raises(PipelineError,match='current_permission_intent_unverified'):
            subject.validate_role_permission_intent(task,AR_MARK_QUESTION)
