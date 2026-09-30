"""Unknown scope stays unknown; clearer output never grants or denies access."""
from copy import deepcopy

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError, render_generic_answer
from app.generic_reader_contracts import RoutingDecision
from app.reader_scope_explanation import scope_verification_notice, render_scope_verification


def decision(scope='unknown', **updates):
    data = {'stage': 'routing_decision', 'taskFingerprint': 'test',
            'decision': 'knowledge_gap', 'missing': ['unmapped_cohort'],
            'reason': 'The requested ownership relationship is unverified.',
            'candidates': [{'candidateId': 'records', 'reason': 'Candidate records.',
                'evidence': [{'sourceId': 'verified-definition'}],
                'conditions': [{'requirementId': key, 'status': value,
                    'reason': 'Definition comparison.'} for key, value in
                    [('object', 'supported'), ('grain', 'supported'), ('scope', scope)]]}]}
    data.update(updates)
    return RoutingDecision.model_validate(data)


def payload():
    return {'result': 'not_confirmed', 'failureCategory': 'knowledge_gap',
            'missing': ['unmapped_cohort'], 'outputs': [], 'knowledgeAnswer': [],
            'scopeVerification': scope_verification_notice(decision())}


def test_validated_unknown_scope_is_explained_without_changing_runtime_result():
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.example')
    notice = scope_verification_notice(decision())
    result = reader.finish(error=PipelineError('unmapped_cohort', 'knowledge_gap',
                                               {'scopeVerification': notice})).result.payload
    assert result['result'] == 'not_confirmed'
    assert result['failureCategory'] == 'knowledge_gap'
    assert result['requirementsSatisfied'] is False
    assert result['outputs'] == [] and result['facts'] == []
    assert result['missing'] == ['unmapped_cohort']
    assert result['scopeVerification'] == notice
    for language, phrase in [('en', 'cannot verify'), ('ar', 'لا أستطيع التحقق'), ('zh', '尚无法核实')]:
        answer = render_generic_answer(result, language)
        assert phrase in answer
        assert '403' not in answer and 'unmapped_cohort' not in answer


@pytest.mark.parametrize('scope', ['supported', 'conflict'])
def test_known_or_conflicting_scope_does_not_become_unverified(scope):
    assert scope_verification_notice(decision(scope)) is None


@pytest.mark.parametrize('kind', ['route', 'probe', 'clarify', 'permission_denied', 'runtime_error', 'unsupported_operation'])
def test_other_routing_outcomes_keep_their_original_handling(kind):
    assert scope_verification_notice(decision(decision=kind)) is None


def test_available_authorized_alternative_prevents_blanket_unknown_scope_notice():
    d = decision()
    alternative = deepcopy(d.candidates[0])
    alternative.candidateId = 'available-records'
    alternative.conditions[-1].status = 'supported'
    d.candidates.append(alternative)
    assert scope_verification_notice(d) is None


def test_no_compatible_object_or_grain_does_not_claim_scope_is_the_problem():
    for key in ['object', 'grain']:
        d = decision()
        next(c for c in d.candidates[0].conditions if c.requirementId == key).status = 'conflict'
        assert scope_verification_notice(d) is None
    assert scope_verification_notice(decision(candidates=[])) is None


def test_missing_scope_or_actual_read_plan_cannot_emit_scope_notice():
    d = decision()
    d.candidates[0].conditions.pop()
    assert scope_verification_notice(d) is None
    d = decision(routePlan=[{'candidateId': 'records'}])
    assert scope_verification_notice(d) is None


def test_scope_prose_and_gap_code_are_not_keyword_classifiers():
    d = decision('supported')
    d.reason = 'Another manager outside my team is mentioned in an ordinary known-scope question.'
    d.missing = ['another_manager_task_scope']
    assert scope_verification_notice(d) is None


@pytest.mark.parametrize('change', [
    {'result': 'success'}, {'result': 'permission_denied'}, {'result': 'load_failed'},
    {'failureCategory': 'runtime'}, {'failureCategory': 'planning'},
    {'outputs': [{'verified': True}]}, {'knowledgeAnswer': [{'text': 'Verified fact.'}]},
    {'scopeVerification': {'status': 'unverified'}},
])
def test_notice_does_not_mask_other_failures_or_verified_partial_outputs(change):
    result = payload()
    result.update(change)
    assert render_scope_verification(result, 'en') is None


def test_ordinary_empty_knowledge_gap_retains_existing_answer():
    result = payload()
    result.pop('scopeVerification')
    assert 'available knowledge' in render_generic_answer(result, 'en')
