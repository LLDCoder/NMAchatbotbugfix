"""Saved I03 failures and narrow new field meanings; no online acceptance."""
import copy
import json
from pathlib import Path

import pytest

from app.generic_reader import KnowledgeStore, PipelineError, execute_analysis
from app.generic_reader_contracts import AnalysisPlan, TaskSpec
from app.reader_bindings import bind_analysis_evidence
from app.reader_requirements import semantic_bindings
from test_projected_collection import gateway

SAVED = json.loads((Path(__file__).parent / 'fixtures/refund-currency-update-live-replay.json').read_text())
NEW_ID = 'admin.finance.refund.detail.currency-and-update'


def fixture(language='en', candidate=True, correct=True, attempt=1):
    replay = SAVED['replay'][language]
    task = TaskSpec.model_validate(replay['task'])
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'original-refund-fields', 'content': json.dumps(SAVED['baselinePackage'])}]})
    if candidate:
        package = copy.deepcopy(SAVED['candidatePackage'])
        assert package['packageStatus'] == package['records'][0]['status'] == 'draft'
        package['packageStatus'] = package['records'][0]['status'] = 'active'
        knowledge.add({'chunks': [{'id': 'private-field-candidate', 'content': json.dumps(package)}]})
    source = copy.deepcopy(replay['capturedSourceMetadata'])
    source.update(principalScopeRef='isolated-fixture', capturedAt='offline-earlier-native-replay',
        observationRef='offline-fixture', kind='api_response', completeness='bounded')
    source['data'] = {'data': copy.deepcopy(SAVED['earlierNativeProjection'])}
    source['fieldEvidence'] = gateway._reader_field_evidence(source['data'], source['data'])
    sources = {source['sourceId']: source}
    plan = copy.deepcopy(replay['rejectedPlans'][attempt - 1]['candidate'])
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    def remap(value):
        if isinstance(value, dict):
            if value.get('sourceId', '').startswith('k_'):
                value['sourceId'] = ref
                if 'quote' in value: value['quote'] = ''
            for child in value.values(): remap(child)
        elif isinstance(value, list):
            for child in value: remap(child)
    remap(plan)
    if correct:
        for binding in plan['requirementBindings']:
            if binding['requirementId'] == 'attribute_2':
                binding.update(knowledgeBindingId=NEW_ID + '#currency', fields=['applicationInformation.currency'], evidence=[])
            elif binding['requirementId'] == 'attribute_3':
                binding.update(knowledgeBindingId=NEW_ID + '#source-update-time', fields=['lastUpdatedOn'], evidence=[])
    return task, AnalysisPlan.model_validate(plan), sources, knowledge


def run(f):
    task, plan, sources, knowledge = f
    bind_analysis_evidence(plan, task, knowledge, sources)
    return execute_analysis(plan, sources, knowledge, [], task=task)


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('attempt', [1, 2])
def test_actual_saved_attempts_fail_without_a_currency_concept_binding(language, attempt):
    with pytest.raises(PipelineError, match='analysis_binding_inapplicable'):
        run(fixture(language, candidate=False, correct=False, attempt=attempt))


@pytest.mark.parametrize('language', ['en', 'ar'])
@pytest.mark.parametrize('attempt', [1, 2])
def test_new_fields_execute_on_real_saved_shape_without_altering_amount_or_identity(language, attempt):
    f = fixture(language, attempt=attempt)
    result = run(f)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    row = result['outputs'][0]['value'][0]
    assert row['applicationInformation.currency'] == SAVED['earlierNativeProjection']['applicationInformation']['currency']
    assert row['lastUpdatedOn'] == SAVED['earlierNativeProjection']['lastUpdatedOn']
    assert row['applicationInformation.amountCharged'] == -25
    assert set(row) == {'status', 'lastUpdatedOn', 'applicationInformation.amountCharged', 'applicationInformation.currency'}
    assert all(item['documentId'] == '' for item in f[3].items.values())


def test_currency_addition_alone_does_not_conceal_the_separate_missing_update_binding():
    f = fixture()
    candidate = next(item['record'] for item in f[3].items.values() if item['record']['id'] == NEW_ID)
    candidate['payload']['bindings'] = [b for b in candidate['payload']['bindings'] if b['id'] == 'currency']
    with pytest.raises(PipelineError, match='analysis_binding_inapplicable'):
        run(f)


@pytest.mark.parametrize('fault', ['wrong_operation', 'wrong_parent', 'missing_currency',
    'missing_update', 'null_update', 'payment_time_substitution', 'draft'])
def test_field_addition_preserves_operation_identity_missingness_and_time_boundaries(fault):
    f = fixture(); source = next(iter(f[2].values())); row = source['data']['data']
    if fault == 'wrong_operation': source['operationRef'] = 'GET /api/other/{refundNo}'
    elif fault == 'wrong_parent': source['verifiedRecord']['identity'] = 'OTHER-123'
    elif fault == 'missing_currency': del row['applicationInformation']['currency']
    elif fault == 'missing_update': del row['lastUpdatedOn']
    elif fault == 'null_update': row['lastUpdatedOn'] = None
    elif fault == 'payment_time_substitution':
        binding = next(b for b in f[1].requirementBindings if b.requirementId == 'attribute_3')
        binding.fields = ['relatedPaymentInformation.lastUpdatedOn']
    else:
        next(item['record'] for item in f[3].items.values() if item['record']['id'] == NEW_ID)['status'] = 'draft'
    source['fieldEvidence'] = gateway._reader_field_evidence(source['data'], source['data'])
    try:
        result = run(f)
    except PipelineError:
        return
    assert not result['requirementsSatisfied'], fault


def test_knowledge_addition_is_value_free_and_keeps_existing_amount_binding_exact():
    f = fixture(); original = fixture(candidate=False, correct=False)
    before = next(x for x in semantic_bindings(original[3]) if x['knowledgeBindingId'].endswith('.fields#amount'))
    after = next(x for x in semantic_bindings(f[3]) if x['knowledgeBindingId'] == before['knowledgeBindingId'])
    assert before == after
    package = SAVED['candidatePackage']
    body = json.dumps(package['records'][0]['payload'], ensure_ascii=False)
    assert SAVED['earlierNativeProjection']['refundNo'] not in body
    assert SAVED['earlierNativeProjection']['lastUpdatedOn'] not in body
    assert len(package['records'][0]['payload']['bindings']) == 2
