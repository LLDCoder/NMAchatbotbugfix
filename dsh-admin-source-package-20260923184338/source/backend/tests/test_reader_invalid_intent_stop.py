"""Invalid intent is a terminal turn boundary, including outer answer repairs."""
from copy import deepcopy
import json

import pytest

from app.portal_reader import AdminPortalReader
from app.service import _reader_conversation_context, reader_evidence_only_response
from test_admin_portal_reader import Gateway, run_reader
from test_reader_conversation_context import event
from test_reader_intent_flow import HISTORY, IntentPlanner, resolution, slot


INVALID = [None, {}, {'relation': 'continue'},
           resolution('continue', recordIdentity=slot('INVENTED-999', 'INVENTED-999', 'previous'))]


def failed_turn(candidate, question='What next?'):
    events = []
    gateway = Gateway(events=events)
    planner = IntentPlanner(deepcopy(candidate), events=events)
    outcome = run_reader(gateway, planner, question=question, conversation_context=deepcopy(HISTORY))
    return outcome, gateway, planner, events


@pytest.mark.parametrize('candidate', INVALID)
@pytest.mark.parametrize('question', ['What next?', 'Which rules apply next?'])
def test_invalid_intent_stops_before_retrieval_planning_and_read(candidate, question):
    outcome, gateway, planner, events = failed_turn(candidate, question)
    assert outcome.result.status == 'not_confirmed'
    assert outcome.result.missing == ('intent_resolution_invalid',)
    assert not outcome.result.facts and not outcome.result.page and not outcome.result.intent_context
    assert gateway.calls == []
    assert planner.calls == []
    assert events == ['GetUserInfo', 'resolve_intent']
    trace = outcome.audit_evidence['qualityTrace']
    assert outcome.audit_evidence['rootCause'] == 'intent_resolution_invalid'
    assert [(r['status'], r['failureCode']) for r in trace if r['stage'] == 'intent_resolution'] == [
        ('failed', 'intent_resolution_invalid')]
    assert trace[-1]['stage'] == 'result_classification' and trace[-1]['status'] == 'failed'
    assert not any(r['stage'] in {'knowledge_retrieval', 'planning', 'portal_execution'} for r in trace)


def test_invalid_intent_cannot_be_repaired_by_outer_rule_enrichment(monkeypatch):
    calls = []
    async def rule_enrichment(self, *args):
        calls.append('rule_enrichment')
        return ('Unrelated rule must not promote the failed intent to success.',)
    monkeypatch.setattr(AdminPortalReader, '_rule_evidence_facts', rule_enrichment)
    outcome, gateway, planner, _ = failed_turn({'relation': 'continue'}, 'Which rules apply next?')
    assert calls == []
    assert outcome.result.status == 'not_confirmed' and outcome.result.facts == ()
    assert not gateway.calls and not planner.calls


@pytest.mark.parametrize('error', [RuntimeError('resolver unavailable'), TypeError('invalid resolver response')])
def test_unusable_resolver_result_is_not_a_permission_to_read(error):
    class BrokenPlanner(IntentPlanner):
        async def resolve_admin_portal_intent(self, question, context):
            raise error
    gateway, planner = Gateway(), BrokenPlanner(None)
    outcome = run_reader(gateway, planner, question='What next?', conversation_context=HISTORY)
    assert outcome.result.missing == ('intent_resolution_invalid',)
    assert gateway.events == ['GetUserInfo'] and gateway.calls == [] and planner.calls == []


def test_actual_failed_turn_does_not_restore_older_record_on_next_followup():
    outcome, _, _, _ = failed_turn({'relation': 'continue'})
    current = event(5, 'user.message', {'content': 'Try again'})
    history = [event(1, 'user.message', {'content': 'Show appeals in To Do'}),
               event(2, 'reader.result', {'result': 'success', 'recordIdentity': 'REF-41',
                   'page': '/happiness/appeals', 'scope': 'team', 'facts': ['OLD_PRIVATE_VALUE']}),
               event(3, 'user.message', {'content': 'What next?'}),
               event(4, 'reader.result', outcome.result.public_json()), current]
    context = _reader_conversation_context(history, current)
    assert context == {'previousIntent': {'question': 'What next?', 'resultStatus': 'not_confirmed'}}
    assert not any(value in json.dumps(context) for value in ('REF-41', '/happiness/appeals', 'OLD_PRIVATE_VALUE'))


@pytest.mark.parametrize('language,required', [
    ('en', 'No business data was read'), ('zh', '没有读取业务数据'), ('ar', 'لم تُقرأ أي بيانات أعمال'),
])
def test_invalid_intent_answer_explains_the_boundary_without_repeating_old_scope(language, required):
    outcome, _, _, _ = failed_turn({'relation': 'continue'})
    answer = reader_evidence_only_response(outcome.result.public_json(), language)
    assert required in answer
    assert 'REF-41' not in answer and '/happiness/appeals' not in answer
