"""Replay saved B11 drafts through real validators; no model or portal requests."""
import asyncio
import copy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.generic_reader import KnowledgeStore, PipelineError
from app.generic_reader_contracts import TaskSpec
from app.reader_answers import (KnowledgeAnswerDraft, complete_coverage_quotes,
    standalone_answer_routes, validate_answer_draft)
from app.reader_evidence_explanation import compose_guidance, partition
from app.reader_requirements import requirements_for


FIXTURES = Path(__file__).parent / 'fixtures'
LIST = '/licensing/applications'
DETAIL = LIST + '/applicationsDetails'


def case():
    raw = json.loads((FIXTURES / 'guidance_navigation_b11_v34_en.json').read_text())
    original = (FIXTURES / 'guidance_navigation_m12.json').read_bytes()
    assert hashlib.sha256(original).hexdigest() == 'f1bd3d80728a5dc8179f89c0139425b5f30dfb2f06c9ac19c00fc203d58dc26e'
    kb = KnowledgeStore()
    kb.add_local([{'id': raw['knowledgeRecord']['chunkId'], 'source_name': 'Application Details guide',
                   'source_type': 'local_page_knowledge', 'content': original.decode()}])
    documents = kb.prompt(page=DETAIL)
    assert len(documents) == 1 and documents[0]['completeRecord'] and not documents[0]['truncated']
    task = TaskSpec.model_validate(raw['task'])
    assignment = partition(task, raw['prompt'], raw['prompt'])
    catalog = [
        {'name': 'Applications', 'routes': [LIST], 'module': 'Licensing'},
        {'name': 'ApplicationsDetails', 'routes': [DETAIL], 'module': 'Licensing'},
    ]
    return raw, assignment, kb, catalog, documents[0]


def run_guidance(attempt=0, *, draft=None, catalog=None, coverage=None,
                 reject_navigation=False, principal_ref=None, roles=None, secrets=()):
    raw, assignment, kb, default_catalog, _ = case()
    if catalog is None:
        catalog = default_catalog
    if coverage is None:
        coverage = raw['coverage']
    draft = copy.deepcopy(draft or raw['rejectedPlans'][attempt]['candidate'])
    previous = [{'requirementId': 'attribute_0', 'status': 'covered'}]
    calls = []

    async def structured(contract, prompt, data, validate):
        calls.append((contract.__name__, copy.deepcopy(data), prompt))
        if contract.__name__ == 'KnowledgeAnswerDraft':
            plan = contract.model_validate(copy.deepcopy(draft))
        else:
            # This deterministic reviewer response only tests that an independent
            # rejection survives the contract. It is not business acceptance.
            blocks = data['answerBlocks']
            refs = sorted({i for b in blocks for i in b['quoteIndexes']})
            plan = contract.model_validate({'stage': 'knowledge_answer_review', 'checks': [{
                'requirementId': 'attribute_3', 'status': 'covered', 'quoteIndexes': refs,
                'reason': 'Deterministic contract replay; semantic acceptance requires a real review.',
                'pointChecks': [{'pointIndex': i, 'covered': True,
                    'answerBlockIds': ['refresh_procedure' if i < 5 else 'verify_discrepancy'],
                    'reason': 'The corresponding saved draft contains this procedure point.'}
                    for i in range(len(coverage[0].get('requiredPoints', [])))]}],
                'blockChecks': [{'blockId': b['id'], 'supported': not (reject_navigation and b['id'] == 'navigation'),
                    'languageMatches': True, 'customerFacing': True,
                    'reason': 'Page visibility does not prove this page supports the business procedure.'
                              if reject_navigation and b['id'] == 'navigation' else 'Simulated independent review.'}
                    for b in blocks]})
        validate(plan)
        return plan

    reader = SimpleNamespace(current_question=raw['prompt'], knowledge=kb, audit={},
        knowledge_requirement_coverage=previous, structured=structured, secrets=secrets)
    try:
        guidance = asyncio.run(compose_guidance(reader, assignment, coverage, catalog,
            SimpleNamespace(roles=roles or raw['permission']['roles']),
            principal_ref=principal_ref or raw['principalRef']))
    finally:
        assert reader.knowledge_requirement_coverage is previous
    return guidance, calls, reader, assignment


def test_m12_all_visible_passage_hashes_match_actual_audit():
    raw, _, kb, _, doc = case()
    actual = {p['sourceId']: p['text'] for p in doc['passages']}
    assert len(actual) == 18 and raw['knowledgeRecord']['revision'] == '6'
    assert len(raw['knowledgeInputs']) == 5
    for input_ in raw['knowledgeInputs']:
        assert not input_['document']['truncated']
        for passage in input_['document']['passages']:
            text = actual[passage['sourceId']]
            assert len(text) == passage['characters']
            assert hashlib.sha256(text.encode()).hexdigest() == passage['sha256']
    assert not kb.rejected and not kb.conflicted


@pytest.mark.parametrize('attempt', [0, 1])
def test_saved_en_drafts_reproduce_missing_route_receipt_before_fix(attempt):
    raw, assignment, kb, catalog, _ = case()
    quotes = complete_coverage_quotes([], raw['coverage'], kb)
    assert len(quotes) == 6
    draft = KnowledgeAnswerDraft.model_validate(raw['rejectedPlans'][attempt]['candidate'])
    wanted = [r for r in requirements_for(assignment['originalTask']) if r['id'] == 'attribute_3']
    with pytest.raises(PipelineError) as error:
        validate_answer_draft(draft, assignment['originalTask'], quotes,
                              standalone_answer_routes(catalog, kb), requirements=wanted)
    assert error.value.code == 'knowledge_answer_navigation_citation_missing'
    assert error.value.details['routeQuoteIndexes'] == []


@pytest.mark.parametrize('attempt', [0, 1])
def test_exact_en_drafts_gain_only_current_session_route_provenance(attempt):
    raw, *_ = case()
    result, calls, reader, assignment = run_guidance(attempt)
    assert [name for name, _, _ in calls] == ['KnowledgeAnswerDraft', 'KnowledgeAnswerReview']
    assert len(result['quotes']) == 7
    session = result['quotes'][6]
    assert session['sourceId'] == 'session_' + raw['principalRef']
    receipt = json.loads(session['text'])
    assert receipt['assignedRoles'] == raw['permission']['roles']
    assert receipt['boundary'] == 'Assigned roles and page access only; no record values or action authority.'
    assert {r for p in receipt['permittedPages'] for r in p['routes']} == {LIST, DETAIL}
    expected = copy.deepcopy(raw['rejectedPlans'][attempt]['candidate']['blocks'])
    expected[-1]['quoteIndexes'].append(6)
    assert result['blocks'] == expected  # No generated answer text or business facts.
    review = calls[1][1]
    assert review['finalQuotes'][-1] == {'quoteIndex': 6, **session}
    assert 6 in review['requirementAnswers'][0]['answerQuoteIndexes']
    assert review['answerBlocks'] == expected
    for _, data, _ in calls:
        assert [r['id'] for r in data['requirements']] == ['attribute_3']
        assert data['evidenceExplanationTaskAssignment']['originalTask'] == raw['task']
        assert data['evidenceExplanationTaskAssignment']['delegationEstablishesFacts'] is False
        assert data['task'] == assignment['originalTask'].model_dump()
        assert data['verifiedSession']['pages'][0]['routes'] == [LIST]
    assert len(reader.audit['evidenceGuidanceReviews']) == 1


def test_unrelated_authorized_page_does_not_bypass_business_review():
    raw, _, _, catalog, _ = case()
    other = '/happiness/tickets'
    catalog.append({'name': 'Tickets', 'routes': [other], 'module': 'Happiness'})
    draft = copy.deepcopy(raw['rejectedPlans'][0]['candidate'])
    draft['blocks'][-1]['text'] = 'Refresh this licensing application through [Tickets](/happiness/tickets).'
    result, calls, reader, _ = run_guidance(draft=draft, catalog=catalog, reject_navigation=True)
    assert [b['id'] for b in result['blocks']] == ['refresh_procedure', 'verify_discrepancy']
    assert result['coverage'][0]['status'] == 'partial'
    assert len(calls) == 4 and len(reader.audit['evidenceGuidanceReviews']) == 2
    assert other in calls[1][1]['allowedRoutes']
    assert any(q['sourceId'].startswith('session_') for q in calls[1][1]['finalQuotes'])


@pytest.mark.parametrize('route', [
    '/not-authorized', '/licensing/applicationsExtra', DETAIL,
    DETAIL + '?taskId=example', LIST + '?tab=all', LIST + '#section',
    'https://untrusted.example/licensing/applications', '//untrusted.example/licensing/applications',
])
def test_session_quote_cannot_authorize_unknown_parameterized_or_external_links(route):
    raw, *_ = case()
    draft = copy.deepcopy(raw['rejectedPlans'][0]['candidate'])
    draft['blocks'][-1]['text'] = f'Open [Applications]({route}).'
    with pytest.raises(PipelineError) as error:
        run_guidance(draft=draft)
    # The existing technical-identifier guard rejects taskId before link
    # validation; both guards must remain unchanged by citation plumbing.
    expected = 'knowledge_answer_implementation_text' if '?taskId=' in route else 'knowledge_answer_navigation_unverified'
    assert error.value.code == expected


@pytest.mark.parametrize('missing', ['no_coverage', 'uncovered', 'no_references'])
def test_session_without_covered_business_quotes_cannot_generate_guidance(missing):
    raw, *_ = case()
    coverage = copy.deepcopy(raw['coverage'])
    if missing == 'no_coverage': coverage = []
    if missing == 'uncovered': coverage[0]['status'] = 'partial'
    if missing == 'no_references': coverage[0]['evidence'] = []
    result, calls, _, _ = run_guidance(coverage=coverage)
    assert not calls and not result['blocks'] and not result['quotes']
    assert result['coverage'] == coverage


def test_session_receipt_uses_current_principal_and_redacts_secrets():
    result, calls, _, _ = run_guidance(principal_ref='different-current-principal',
        roles=['CANARY_SESSION_SECRET'], secrets=('CANARY_SESSION_SECRET',))
    assert result['quotes'][-1]['sourceId'] == 'session_different-current-principal'
    assert 'CANARY_SESSION_SECRET' not in result['quotes'][-1]['text']
    assert json.loads(result['quotes'][-1]['text'])['assignedRoles'] == ['[redacted]']
