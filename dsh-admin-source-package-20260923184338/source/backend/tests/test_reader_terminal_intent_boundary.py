"""Fault injection proves terminal intent outcomes cannot be promoted by repairs."""
import asyncio
from copy import deepcopy

import httpx
import pytest

from app.portal_reader import AdminPortalReader, ReaderTimeoutBudget
from app.service import reader_evidence_only_response
from test_admin_portal_reader import Gateway, run_reader
from test_reader_intent_flow import HISTORY, IntentPlanner, resolution


def enrich_spy(monkeypatch):
    calls = []
    async def enrichment(self, *args):
        calls.append('outer_rule_enrichment')
        return ('Synthetic rule fact from the test enrichment stage.',)
    monkeypatch.setattr(AdminPortalReader, '_rule_evidence_facts', enrichment)
    return calls


@pytest.mark.parametrize('fault,expected_status,expected_code', [
    (401, 'load_failed', 'model_authentication_failed'),
    (402, 'load_failed', 'model_payment_required'),
    (403, 'load_failed', 'model_authentication_failed'),
    (429, 'load_failed', 'model_rate_limited'),
    (500, 'load_failed', 'model_service_unavailable'),
    (502, 'load_failed', 'model_service_unavailable'),
    (503, 'load_failed', 'model_service_unavailable'),
    ('timeout', 'not_confirmed', 'intent_resolution_timeout'),
])
@pytest.mark.parametrize('question', ['What next?', 'Which rules apply next?'])
def test_all_failed_intent_exits_keep_their_original_failure(monkeypatch, fault, expected_status, expected_code, question):
    enrichment = enrich_spy(monkeypatch)
    events = []

    class FaultPlanner(IntentPlanner):
        async def resolve_admin_portal_intent(self, question, context):
            events.append('resolve_intent')
            if fault == 'timeout':
                await asyncio.sleep(10)
            request = httpx.Request('POST', 'https://synthetic-model.invalid')
            response = httpx.Response(fault, request=request)
            raise httpx.HTTPStatusError('synthetic provider failure', request=request, response=response)

    gateway, planner = Gateway(events=events), FaultPlanner(None)
    outcome = run_reader(gateway, planner, question=question, conversation_context=deepcopy(HISTORY),
                         timeout_budget=ReaderTimeoutBudget(planner_seconds=0.01))
    assert enrichment == []
    assert outcome.result.status == expected_status
    assert outcome.result.missing == (expected_code,)
    assert outcome.result.facts == () and not outcome.result.intent_context
    assert outcome.audit_evidence['stage'] == 'intent_resolution'
    assert outcome.audit_evidence['rootCause'] == expected_code
    assert gateway.calls == [] and planner.calls == []
    assert events == ['GetUserInfo', 'resolve_intent']
    stages = outcome.audit_evidence['qualityTrace']
    assert stages[-1]['stage'] == 'result_classification' and stages[-1]['failureCode'] == expected_code


@pytest.mark.parametrize('question', ['What next?', 'Which rules apply next?'])
def test_explicit_clarification_remains_pending_with_its_options(monkeypatch, question):
    enrichment = enrich_spy(monkeypatch)
    intent = resolution('clarify')
    intent['clarificationOptions'] = ['these appeals', 'all your tasks']
    gateway, planner = Gateway(), IntentPlanner(intent)
    outcome = run_reader(gateway, planner, question=question, conversation_context=deepcopy(HISTORY))
    assert enrichment == []
    assert outcome.result.status == 'not_confirmed' and outcome.result.missing == ('intent_ambiguous',)
    assert outcome.result.facts == ()
    assert outcome.result.clarification_options == ('these appeals', 'all your tasks')
    assert outcome.result.intent_context['relation'] == 'clarify'
    assert outcome.result.intent_context['clarificationOptions'] == ['these appeals', 'all your tasks']
    assert outcome.audit_evidence['stage'] == 'intent_clarification'
    assert gateway.calls == [] and planner.calls == []
    assert reader_evidence_only_response(outcome.result.public_json(), 'en') == 'Do you mean "these appeals" or "all your tasks"?'


@pytest.mark.parametrize('with_history', [False, True])
def test_successful_normal_read_can_still_receive_rule_enrichment(monkeypatch, with_history):
    enrichment = enrich_spy(monkeypatch)
    context = {'previousIntent': {'question': 'Show portal information', 'page': '/licensing'}} if with_history else None
    gateway, planner = Gateway(), IntentPlanner(resolution('continue'))
    outcome = run_reader(gateway, planner, question='What next?', conversation_context=context)
    assert outcome.result.status == 'success' and not outcome.result.missing
    assert enrichment == ['outer_rule_enrichment']
    assert 'Synthetic rule fact from the test enrichment stage.' in outcome.result.facts
    assert [c[0] for c in gateway.calls] == ['knowledge.search', 'admin.portal.read']
