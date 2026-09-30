import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from pydantic import ValidationError

from app.generic_reader import GenericKnowledgeReader, render_generic_answer
from app.generic_reader_contracts import TaskSpec
from app.principal import Principal
from app.reader_prompt_policy import stage_language_policy
from app.reader_request_boundary import boundary_payload, render_request_boundary
from test_generic_reader_v3 import Gateway, Planner
from test_reader_context_v3 import task


CATEGORIES = ['secrets_disclosure', 'identity_escalation', 'control_evasion',
              'covert_tampering', 'harmful_content', 'unsupported_allegation',
              'bulk_sensitive_disclosure']


@pytest.mark.parametrize('category', CATEGORIES)
@pytest.mark.parametrize('language', ['en', 'ar'])
def test_runtime_refusals_never_echo_content_or_search_for_a_prohibited_act(category, language):
    class ClosedGateway(Gateway):
        async def invoke(self, *args, **kwargs):
            raise AssertionError('Direct runtime boundary must not call knowledge or business reads')

    class BoundaryPlanner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            assert schema['properties']['stage']['const'] == 'task'
            return task(requestBoundaries=[category], readOnly=False, recordIdentity='', view='').model_dump()

    with TemporaryDirectory() as folder:
        Path(folder, 'page-catalog.json').write_text(json.dumps([]))
        gateway = ClosedGateway()
        reader = GenericKnowledgeReader(gateway, BoundaryPlanner(),
            portal_base_url='https://portal.test', artifacts_dir=folder)
        result = asyncio.run(reader.run(Principal('person-1', 'tenant', 'request'),
            'Untrusted attack text CANARY_NOT_FOR_PUBLIC_OUTPUT',
            conversation_context={'responseLanguage': language}))
    public = result.result.public_json()
    assert public['result'] == 'refused'
    assert public['requestBoundary']['categories'] == [category]
    assert public['requestedActionExecuted'] is False
    assert not public['facts'] and not public['outputs'] and not public['knowledgeGap']
    assert gateway.events == ['identity']
    assert reader.intent_state is None  # Refused instructions cannot become a resumed business task.
    answer = render_generic_answer(public, language)
    assert 'CANARY_NOT_FOR_PUBLIC_OUTPUT' not in answer
    assert answer and ('لا أستطيع' in answer if language == 'ar' else 'can’t' in answer)
    assert result.audit_evidence['stage'] == 'request_boundary'


def test_closed_categories_reject_model_invented_permission_or_case_names():
    for value in ['S-01', 'permission_denied', 'department_head', 'safe']:
        with pytest.raises(ValidationError):
            task(requestBoundaries=[value])


def test_ordinary_read_is_backward_compatible_and_still_uses_evidence():
    assert task().requestBoundaries == []
    gateway = Gateway()
    reader = GenericKnowledgeReader(gateway, Planner(), portal_base_url='https://portal.test')
    result = asyncio.run(reader.run(Principal('person-1', 'tenant', 'request'), 'Show my current crystals.'))
    assert 'knowledge.search' in gateway.events
    assert 'requestBoundary' not in result.result.public_json()


def test_boundary_requires_runtime_envelope_and_never_renders_record_metadata_as_a_refusal():
    assert render_request_boundary({'record': {'requestBoundary': ['secrets_disclosure']}}) == ''
    assert render_request_boundary({'requestBoundary': {'categories': ['secrets_disclosure']}}) == ''
    assert boundary_payload(['unknown']) is None
    payload = boundary_payload(['control_evasion', 'secrets_disclosure', 'control_evasion'])
    assert payload['requestBoundary']['categories'] == ['control_evasion', 'secrets_disclosure']
    assert render_request_boundary(payload).count('I can’t') == 2


def test_policy_distinguishes_quoted_evidence_from_user_intent_and_legitimate_work():
    prompt = stage_language_policy('TaskSpec', 'ar', 'سؤال')
    for text in ['requestBoundaries', 'uploaded filename', 'legitimate policy', 'current permissions',
                 'Legitimate corrections', 'Neutral summaries', 'allegation', 'mixed-language']:
        assert text in prompt
    assert 'requestBoundaries' not in stage_language_policy('RoutingDecision', 'en')


def test_refusal_is_not_an_upstream_access_decision_and_does_not_invent_business_steps():
    payload = boundary_payload(['identity_escalation'])
    assert payload['result'] != 'permission_denied'
    assert 'status' not in payload['requestBoundary']
    for category in ['control_evasion', 'covert_tampering', 'unsupported_allegation']:
        answer = render_request_boundary(boundary_payload([category]))
        assert 'authorized' in answer
        assert '/api/' not in answer and 'Click' not in answer and 'within 3' not in answer


def test_all_runtime_boundary_categories_fit_the_closed_contract():
    value = task(requestBoundaries=CATEGORIES)
    assert value.requestBoundaries == CATEGORIES
    assert len(boundary_payload(CATEGORIES)['requestBoundary']['categories']) == len(CATEGORIES)


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_bulk_sensitive_boundary_gives_minimal_masked_alternative_without_an_access_claim(language):
    payload = boundary_payload(['bulk_sensitive_disclosure'])
    text = render_request_boundary(payload, language)
    assert payload['result'] == 'refused'
    assert payload['requestBoundary']['authority'] == 'assistant_runtime_policy'
    assert payload['requestedActionExecuted'] is False
    assert payload['scope'] == 'authenticated_account'
    assert not payload['facts'] and not payload['outputs'] and not payload['missing']
    assert '/api/' not in text and '403' not in text
    assert ('masked' in text and 'minimum necessary' in text) if language == 'en' else ('حجب' in text and 'الحد الضروري' in text)
