import asyncio
import copy
import json
import time
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.reader_expansion import InputNormalization, NORMALIZATION_PROMPT, validate_normalization, bind_normalization_source

TRACE = json.loads((Path(__file__).parent / 'fixtures/normalization_coverage_b11.json').read_text())


def test_schema_binds_whole_original_input_without_changing_contract_for_long_inputs():
    schema = bind_normalization_source(InputNormalization.model_json_schema(), TRACE['question'])
    assert schema['properties']['clauses']['minItems'] == schema['properties']['clauses']['maxItems'] == 1
    assert schema['$defs']['TranslatedClause']['properties']['sourceQuote']['const'] == TRACE['question']
    long_schema = bind_normalization_source(InputNormalization.model_json_schema(), 'a' * 10001)
    assert long_schema['properties']['clauses']['maxItems'] == 30
    assert 'const' not in long_schema['$defs']['TranslatedClause']['properties']['sourceQuote']


def test_real_missing_attached_conjunction_remains_rejected_with_precise_offsets():
    plan = InputNormalization.model_validate(TRACE['rejectedCandidate'])
    with pytest.raises(PipelineError) as caught:
        validate_normalization(plan, TRACE['question'])
    error = caught.value
    assert error.code == 'normalization_source_coverage_invalid'
    assert error.details['clauseIndex'] == 2
    gap = TRACE['question'][error.details['nextSourceOffset']:error.details['matchedSourceOffset']]
    assert gap.strip() == 'و'
    assert TRACE['question'] not in json.dumps(error.details, ensure_ascii=False)
    assert plan.model_dump() == TRACE['rejectedCandidate']


def test_translation_repair_gets_original_and_gap_feedback_without_waiving_any_check():
    calls = []
    class Planner:
        async def generic_reader_json(self, **kwargs):
            calls.append(copy.deepcopy(kwargs))
            assert kwargs['schema']['$defs']['TranslatedClause']['properties']['sourceQuote']['const'] == TRACE['question']
            if len(calls) == 1:
                return copy.deepcopy(TRACE['rejectedCandidate'])
            assert 'prefer one sourceQuote' in kwargs['correction']
            return {'stage': 'input_normalization', 'clauses': [{
                'sourceQuote': TRACE['question'],
                'english': ' '.join(c['english'] for c in TRACE['rejectedCandidate']['clauses'])}]}
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = TRACE['question']; reader.response_language = 'ar'
    reader.deadline = time.monotonic() + 30
    result = asyncio.run(reader.structured(InputNormalization, NORMALIZATION_PROMPT,
        {'question': TRACE['question']}, lambda p: validate_normalization(p, TRACE['question'])))
    assert len(calls) == 2 and len(reader.audit['rejectedPlans']) == 1
    assert calls[0]['data']['question'] == calls[1]['data']['question'] == TRACE['question']
    assert 'Do not change any data.' in result.clauses[0].english
    validate_normalization(result, TRACE['question'])


@pytest.mark.parametrize('source,english,code', [
    ('Read ID-123.', 'Read ID-123.', 'normalization_source_coverage_invalid'),
    ('Read ID-123. Do not approve.', 'Read ID-999. Do not approve.', 'normalization_numeric_constraint_changed'),
    ('Read ID-123. Do not approve.', 'اقرأ فقط', 'normalization_english_missing'),
])
def test_repair_guidance_cannot_accept_missing_clauses_or_changed_literals(source, english, code):
    plan = InputNormalization(stage='input_normalization', clauses=[{'sourceQuote': source, 'english': english}])
    with pytest.raises(PipelineError, match=code):
        validate_normalization(plan, 'Read ID-123. Do not approve.')
