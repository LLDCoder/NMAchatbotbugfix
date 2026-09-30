"""Real X05 v37 routing/answer evidence; controlled mutations are explicitly offline."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.generic_reader import PipelineError, KnowledgeStore, clean
from app.generic_reader_contracts import TaskSpec, RoutingDecision, CandidateCondition
from app.reader_answers import (KnowledgeAnswerDraft, KnowledgeAnswerReview,
    validate_answer_draft, validate_answer_review, verified_answer_blocks)
from app.reader_requirements import requirements_for
from app.reader_routing import task_fingerprint
import app.reader_gap_explanation as gap
from test_reader_gap_explanation import setup, outcome, TEXT

ACTUAL = json.loads((Path(__file__).parent / 'fixtures/x05_gap_entity_conflict_v37.json').read_text())


class NoKnowledgeConsumption(KnowledgeStore):
    def cite(self, *args, **kwargs):
        raise AssertionError('Explicitly conflicting candidates must not consume their citations.')


def actual_setup():
    reader, _, _, _, planner = setup('ar')
    task = TaskSpec.model_validate(ACTUAL['task'])
    routing = RoutingDecision.model_validate(ACTUAL['routing'])
    receipt = ACTUAL['supplementalExplanation']
    reader.current_question = ACTUAL['question']
    reader.intent_state = deepcopy(ACTUAL['intentState'])
    reader.current_observation_owner = {'principalScopeRef': receipt['principalScopeRef']}
    reader.audit['routingDecision'] = routing.model_dump()
    reader.knowledge = NoKnowledgeConsumption()
    recalled = {c['candidateId']: c for c in ACTUAL['candidates']}
    assert task_fingerprint(task) == routing.taskFingerprint == receipt['taskFingerprint']
    return reader, task, routing, recalled, planner


def test_real_x05_five_entity_conflicts_exclude_all_nine_rule_quotes_before_composition():
    reader, task, routing, recalled, planner = actual_setup()
    assert len(routing.candidates) == 5
    assert len(ACTUAL['supplementalExplanation']['quotes']) == 9
    assert all({c.requirementId for c in candidate.conditions if c.status == 'conflict'}
               >= {'object', 'grain', 'record'} for candidate in routing.candidates)
    assert gap.cited_rule_quotes(reader, routing, recalled, lambda _: True) == []
    before = task.model_dump()
    assert asyncio.run(gap.explain_gap(reader, task, routing, recalled, lambda _: True)) is None
    assert reader.audit['supplementalExplanationAttempt'] == {
        'status': 'unavailable', 'modelCalls': 0, 'reason': 'applicable_cited_rules_unavailable'}
    assert not planner.calls and task.model_dump() == before
    assert routing.missing == ['application_record_page']
    assert reader._supplemental_rule_context is None
    payload = outcome(reader, task, routing, recalled)
    assert payload['missing'] == routing.missing and not payload.get('supplementalExplanation')
    assert payload['requirements'] == requirements_for(task)
    assert all(c['status'] == 'unfulfilled' for c in payload['requirementCoverage'])
    assert not payload['requirementsSatisfied'] and payload['outputs'] == []
    assert not planner.calls


def test_real_x05_review_booleans_alone_had_accepted_the_wrong_refund_entity():
    # The new fix is upstream applicability, not weakening/replacing the old review contract.
    task = TaskSpec.model_validate(ACTUAL['task'])
    draft = KnowledgeAnswerDraft.model_validate(ACTUAL['draft'])
    review = KnowledgeAnswerReview.model_validate(ACTUAL['review'])
    quotes = ACTUAL['supplementalExplanation']['quotes']
    requirements = requirements_for(task)
    prior = [{'requirementId': r['id'], 'status': 'not_yet_verified'} for r in requirements]
    validate_answer_draft(draft, task, quotes, (), requirements=requirements)
    validate_answer_review(review, task, quotes, prior, draft.blocks, requirements=requirements)
    assert any(b.id == 'object_grain' and 'سجل استرداد مالي' in b.text
               for b in verified_answer_blocks(draft, review))
    assert {c.requirementId: c.status for c in review.checks}['object'] == 'partial'


@pytest.mark.parametrize('requirement_id', ['object', 'grain', 'record'])
def test_each_explicit_entity_conflict_is_sufficient_even_when_other_conditions_supported(requirement_id):
    reader, task, routing, recalled, planner = actual_setup()
    for candidate in routing.candidates:
        for condition in candidate.conditions:
            condition.status = 'conflict' if condition.requirementId == requirement_id else 'supported'
    reader.audit['routingDecision'] = routing.model_dump()
    assert asyncio.run(gap.explain_gap(reader, task, routing, recalled, lambda _: True)) is None
    assert not planner.calls


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_real_forecast_unknown_identity_and_measure_conflict_keep_supported_boundary_explanation(language):
    reader, task, routing, recalled, planner = setup(language)
    before = task.model_dump()
    payload = outcome(reader, task, routing, recalled)
    receipt = payload['supplementalExplanation']
    assert TEXT[language] == receipt['blocks'][0]['text']
    assert len(planner.calls) == 2 and task.model_dump() == before
    assert payload['result'] == 'not_confirmed' and not payload['requirementsSatisfied']
    assert payload['missing'] == ['forecast_model', 'historical_arrivals_series']
    assert payload['outputs'] == [] and all(c['status'] == 'unfulfilled' for c in payload['requirementCoverage'])
    assert clean(receipt, reader.secrets, max_items=200) == receipt
    assert any(q['sourceId'] == 'k_edf65656488d01a27eae:p3' for q in receipt['quotes'])
    for _, data in planner.calls:
        for quote in data['finalQuotes']:
            assert not any(c['status'] == 'conflict' for c in quote['candidateContext']['identityConditions'])
    if language == 'ar':
        assert any(c.requirementId.startswith('measure_') and c.status == 'conflict'
                   for candidate in routing.candidates for c in candidate.conditions)


@pytest.mark.parametrize('boundary_id', ['time', 'measure_0', 'scope'])
def test_non_entity_conflict_can_explain_boundaries_without_satisfying_live_request(boundary_id):
    reader, task, routing, recalled, planner = setup()
    for candidate in routing.candidates:
        matching = next((c for c in candidate.conditions if c.requirementId == boundary_id), None)
        if matching:
            matching.status = 'conflict'
        else:
            candidate.conditions.append(CandidateCondition(requirementId=boundary_id,
                status='conflict', evidence=deepcopy(candidate.evidence), reason='Controlled scope boundary.'))
    reader.audit['routingDecision'] = routing.model_dump()
    payload = outcome(reader, task, routing, recalled)
    assert payload.get('supplementalExplanation')
    assert payload['result'] == 'not_confirmed' and not payload['requirementsSatisfied']
    assert payload['outputs'] == [] and payload['missing'] == routing.missing
    assert len(planner.calls) == 2


def test_shared_reference_is_deduplicated_only_after_actual_candidate_admission():
    reader, task, routing, recalled, _ = setup()
    original = next(c for c in routing.candidates if any(r.sourceId == 'k_edf65656488d01a27eae:p3'
        for r in [*c.evidence, *(r for cond in c.conditions for r in cond.evidence)]))
    blocked = deepcopy(original)
    for c in blocked.conditions:
        if c.requirementId == 'object': c.status = 'conflict'
    admitted = deepcopy(original); admitted.candidateId = 'controlled-admitted-same-page'
    routing.candidates = [blocked, admitted]
    recalled[admitted.candidateId] = deepcopy(recalled[original.candidateId])
    quotes = gap.cited_rule_quotes(reader, routing, recalled, lambda _: True)
    assert quotes and len({q['sourceId'] for q in quotes}) == len(quotes)
    assert all(q['candidateContext']['candidateId'] == admitted.candidateId for q in quotes)
    assert any(q['sourceId'] == 'k_edf65656488d01a27eae:p3' for q in quotes)


@pytest.mark.parametrize('change', ['authorization', 'route', 'routing', 'owner', 'request', 'no_context', 'forged_quote_context'])
def test_publication_rechecks_same_authority_candidate_and_cited_set(change):
    reader, task, routing, recalled, _ = setup()
    allowed = {'value': True}
    receipt = asyncio.run(gap.explain_gap(reader, task, routing, recalled, lambda _: allowed['value']))
    assert receipt
    reader.supplemental_explanation = receipt
    if change == 'authorization': allowed['value'] = False
    elif change == 'route':
        for candidate in recalled.values(): candidate['route'] = '/other-route'
    elif change == 'routing':
        for candidate in routing.candidates:
            for condition in candidate.conditions:
                if condition.requirementId == 'object': condition.status = 'conflict'
        # Even a resealed hash cannot certify quotes no longer admitted by the current routing.
        reader.audit['routingDecision'] = routing.model_dump()
        receipt['routingFingerprint'] = gap._hash(reader.audit['routingDecision'])
        receipt['contentHash'] = gap._hash({k:v for k,v in receipt.items() if k != 'contentHash'})
    elif change == 'owner': reader.current_observation_owner['principalScopeRef'] = 'other-owner'
    elif change == 'request': reader.intent_state['requestId'] = 'other-request'
    elif change == 'no_context': reader._supplemental_rule_context = None
    else:
        receipt['quotes'][0]['candidateContext']['candidateId'] = 'not-a-validated-candidate'
        receipt['contentHash'] = gap._hash({k:v for k,v in receipt.items() if k != 'contentHash'})
    payload = reader.finish(task=task, error=PipelineError(routing.missing[0], 'knowledge_gap',
        {'routingMissing': routing.missing})).result.payload
    assert not payload.get('supplementalExplanation')
    assert payload['missing'] == routing.missing and not payload['requirementsSatisfied']


def test_new_ineligible_attempt_clears_old_publication_context():
    reader, task, routing, recalled, _ = setup()
    assert asyncio.run(gap.explain_gap(reader, task, routing, recalled, lambda _: True))
    task.readOnly = False
    assert asyncio.run(gap.explain_gap(reader, task, routing, recalled, lambda _: True)) is None
    assert reader._supplemental_rule_context is None


@pytest.mark.parametrize('route', ['/licensing/applications', '/licensing/applications/applicationsDetails'])
def test_x05_unregistered_native_lookup_makes_no_business_request(route, monkeypatch):
    from test_projected_collection import gateway
    upstream = AsyncMock()
    monkeypatch.setattr(gateway, '_umc_request', upstream)
    request = gateway.AdminPortalReadRequest(startPath=route,
        actions=[{'type':'observe'}], nativeRecordLookup='ML-1-7-6577159')
    result = asyncio.run(gateway._native_record_lookup_outcome(request, 'Bearer controlled-token', 'offline-request'))
    assert result == {'status': 'not_confirmed', 'limitations': ['native_lookup_binding_unavailable']}
    upstream.assert_not_awaited()
