"""Historical rows cannot replace a new read or current authorization."""
import json

import pytest

from app.service import _reader_conversation_context
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths
from test_reader_conversation_context import event


OLD = json.dumps({'Reference': 'REC-101', 'Status': 'OLD_APPROVED', 'Owner': 'OLD_PRIVATE_OWNER'})
FRESH = json.dumps({'Reference': 'REC-101', 'Status': 'CURRENT_PENDING'})


def conversation(with_resolved_intent):
    previous = {'result': 'success', 'page': '/licensing', 'answerShape': 'detail',
                'recordIdentity': 'REC-101', 'facts': [OLD]}
    if with_resolved_intent:
        previous['intentContext'] = {'relation': 'continue', 'slots': {
            'recordIdentity': {'source': 'current', 'value': 'REC-101', 'evidence': 'REC-101'},
            'answerShape': {'source': 'current', 'value': 'detail', 'evidence': 'details'},
        }, 'clarificationOptions': []}
    current = event(3, 'user.message', {'content': 'Show REC-101 status'})
    return _reader_conversation_context([
        event(1, 'user.message', {'content': 'Show REC-101 details'}),
        event(2, 'reader.result', previous), current,
    ], current)


@pytest.mark.parametrize('source', ['service_first_turn', 'service_resolved', 'serialized_legacy'])
@pytest.mark.parametrize('current_status', ['success', 'load_failed', 'no_permission'])
def test_exact_identifier_requires_current_read_and_authorization(source, current_status):
    if source == 'serialized_legacy':
        context = {'previousIntent': {'question': 'Show REC-101 details', 'page': '/licensing',
            'recordIdentity': 'REC-101', 'answerShape': 'detail', 'resultStatus': 'success', 'priorFacts': [OLD]}}
    else:
        context = conversation(source == 'service_resolved')

    gateway = Gateway(
        info={'ok': True, 'result': user_info_for_paths('/other' if current_status == 'no_permission' else '/licensing')},
        portal_result={'ok': True, 'result': {'result': current_status, 'page': '/licensing',
            'facts': [FRESH] if current_status == 'success' else [],
            'missing': [] if current_status == 'success' else ['current_read_failed']}},
    )

    class ContextPlanner(Planner):
        async def plan_admin_portal_read(self, question, permission_context, knowledge_context, conversation_context=None):
            assert 'OLD_APPROVED' not in json.dumps(conversation_context)
            assert 'OLD_PRIVATE_OWNER' not in json.dumps(conversation_context)
            return await super().plan_admin_portal_read(question, permission_context, knowledge_context, conversation_context)

    outcome = run_reader(gateway, ContextPlanner(portal_plan_for('/licensing')), question='Show REC-101 status',
                         conversation_context=context)
    payload = outcome.result.public_json()
    assert payload['result'] == current_status
    assert 'OLD_APPROVED' not in json.dumps(payload)
    assert 'OLD_PRIVATE_OWNER' not in json.dumps(payload)
    reads = [c for c in gateway.calls if c[0] == 'admin.portal.read']
    if current_status == 'no_permission':
        assert reads == []
    else:
        assert len(reads) == 1
    if current_status == 'success':
        assert 'CURRENT_PENDING' in json.dumps(payload)
