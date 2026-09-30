"""Literal navigation fidelity, without creating business aliases or authority."""
import asyncio
import copy
import json
import time
from pathlib import Path

import pytest

from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.reader_expansion import InputNormalization, NORMALIZATION_PROMPT, validate_normalization


TRACE = json.loads((Path(__file__).parent / 'fixtures/native_view_normalization_c05_ar_v35.json').read_text())
ERROR = 'normalization_named_view_label_changed'
LABEL = 'قيد الإنجاز'


def plan(question, english):
    return InputNormalization(stage='input_normalization', clauses=[{'sourceQuote': question, 'english': english}])


def rejected(question, english, code=ERROR):
    candidate = plan(question, english)
    before = candidate.model_dump()
    with pytest.raises(PipelineError) as caught:
        validate_normalization(candidate, question)
    assert caught.value.code == code
    assert candidate.model_dump() == before
    return caught.value


def test_real_c05_normalization_renamed_literal_is_rejected():
    candidate = InputNormalization.model_validate(TRACE['inputNormalization'])
    with pytest.raises(PipelineError, match=ERROR):
        validate_normalization(candidate, TRACE['originalQuestion'])
    assert candidate.model_dump() == TRACE['inputNormalization']


def test_real_c05_original_literal_may_remain_in_english_sentence():
    candidate = InputNormalization.model_validate(TRACE['faithfulLiteralNormalization'])
    validate_normalization(candidate, TRACE['originalQuestion'])
    assert candidate.model_dump() == TRACE['faithfulLiteralNormalization']


@pytest.mark.parametrize('quotes', [('«', '»'), ('“', '”'), ('"', '"'), ("'", "'")])
@pytest.mark.parametrize('syntax', ['prefix', 'suffix'])
def test_output_named_quote_styles_and_english_prefix_or_suffix(quotes, syntax):
    quoted = quotes[0] + LABEL + quotes[1]
    english = f'Display my view {quoted}.' if syntax == 'prefix' else f'Display my {quoted} view.'
    validate_normalization(plan(TRACE['originalQuestion'], english), TRACE['originalQuestion'])


@pytest.mark.parametrize('source', ['اعرض view «قيد الإنجاز».', 'اعرض «قيد الإنجاز» view.',
    'اعرض tab «قيد الإنجاز».', 'اعرض «قيد الإنجاز» tab.', 'اعرض التبويب «قيد الإنجاز».'])
def test_original_prefix_and_suffix_are_also_anchored(source):
    validate_normalization(plan(source, f'Display view «{LABEL}».'), source)
    rejected(source, 'Display view "In Progress".')


@pytest.mark.parametrize('english', [
    'Display the requests in my "In Progress" view.',
    'Display the requests in my view "In Progress".',
    'Display my view قيد الإنجاز.',
    'Display the requests; the original text says «قيد الإنجاز».',
    'Display view «قيد الإنجاز» and view "In Progress".',
    'Display «قيد الإنجاز» view and "In Progress" tab.',
    'Display view «قيد الإنجاز» and view «قيد الإنجاز».',
    'Display view «urgent قيد الإنجاز».',
    'Display view «قيد الإنجاز urgent».',
    'Display view « قيد الإنجاز».',
    'Display view «قيد الإنجاز ».',
    'Display view «قيد الإنجاز.',
])
def test_renamed_duplicated_unquoted_or_qualified_label_is_not_preservation(english):
    error = rejected(TRACE['originalQuestion'], english)
    assert LABEL not in json.dumps(error.details, ensure_ascii=False)
    assert TRACE['originalQuestion'] not in json.dumps(error.details, ensure_ascii=False)


@pytest.mark.parametrize('source,english', [
    ('قال «قيد الإنجاز» في تعليق.', 'He said "In Progress" in a comment.'),
    ('راجع تعليق «قيد الإنجاز».', 'Review the comment "In Progress".'),
    ('اعرض الحالة قيد الإنجاز.', 'Show the status In Progress.'),
    ('اعرض العبارة «منظر جميل».', 'Display the phrase "beautiful view".'),
])
def test_non_navigation_quotes_and_business_phrases_keep_existing_flow(source, english):
    validate_normalization(plan(source, english), source)


def test_outside_urgency_and_negation_stay_outside_literal_without_new_authority():
    question = 'اعرض الطلبات العاجلة في عرض «قيد الإنجاز»، وليس الطلبات المعتمدة.'
    english = 'Show urgent requests in view «قيد الإنجاز», not approved requests.'
    candidate = plan(question, english)
    before = copy.deepcopy(candidate.model_dump())
    validate_normalization(candidate, question)
    assert candidate.model_dump() == before
    rejected(question, 'Show requests in view «urgent قيد الإنجاز», not approved requests.')
    rejected(question, 'Show requests in view "urgent In Progress", not approved requests.')


@pytest.mark.parametrize('english', ['Display view "casesensitive".', 'Display view "CASESENSITIVE".'])
def test_label_characters_are_not_casefolded(english):
    rejected('اعرض view "CaseSensitive".', english)


def test_digits_inside_native_label_are_literal_even_when_numeric_values_match():
    question = 'اعرض عرض «قائمة ٣» مع 2 سجلات.'
    validate_normalization(plan(question, 'Show view «قائمة ٣» with 2 records.'), question)
    rejected(question, 'Show view «قائمة 3» with 2 records.')
    rejected(question, 'Show view «قائمة ٤» with 2 records.', 'normalization_numeric_constraint_changed')


def test_existing_numeric_identifier_and_coverage_guards_still_run():
    question = 'اعرض view «قيد الإنجاز» مع AB-407 و3 سجلات.'
    rejected(question, 'Show view «قيد الإنجاز» with AB-407 and 4 records.', 'normalization_numeric_constraint_changed')
    rejected(question, 'Show view «قيد الإنجاز» with AC-407 and 3 records.', 'normalization_literal_changed')
    candidate = plan(question[:-1], 'Show view «قيد الإنجاز» with AB-407 and 3 records.')
    with pytest.raises(PipelineError, match='normalization_source_coverage_invalid'):
        validate_normalization(candidate, question)


@pytest.mark.parametrize('english', [
    'Compare view «الثاني» and view «الأول».',
    'Compare view «الأول».',
    'Compare view «الأول» and view «الأول».',
    'Compare view «الأول» and view «الثاني» and view "Extra".',
])
def test_multiple_label_order_count_and_identity_are_preserved(english):
    question = 'قارن عرض «الأول» وتبويب «الثاني».'
    rejected(question, english)


def test_multiple_distinct_and_repeated_label_occurrences_are_kept():
    question = 'قارن عرض «الأول» وتبويب «الثاني» ثم عرض «الأول».'
    english = 'Compare view «الأول» and «الثاني» tab, then view «الأول».'
    validate_normalization(plan(question, english), question)
    rejected(question, 'Compare view «الأول» and «الثاني» tab.')


def test_one_label_surrounded_by_both_navigation_syntaxes_is_one_occurrence():
    question = 'اعرض view «قيد الإنجاز» tab.'
    validate_normalization(plan(question, 'Display view «قيد الإنجاز».'), question)


def test_overlapping_navigation_words_cannot_hide_a_second_label():
    question = 'اعرض «الأول» view «الثاني».'
    validate_normalization(plan(question, 'Show «الأول» view and view «الثاني».'), question)
    rejected(question, 'Show view «الأول».')


def test_each_original_clause_owns_its_labels():
    first = 'اعرض عرض «الأول».'
    second = 'ثم عرض «الثاني».'
    question = first + ' ' + second
    candidate = InputNormalization(stage='input_normalization', clauses=[
        {'sourceQuote': first, 'english': 'Show view «الأول».'},
        {'sourceQuote': second, 'english': 'Then view «الثاني».'}])
    validate_normalization(candidate, question)
    candidate.clauses[0].english, candidate.clauses[1].english = candidate.clauses[1].english, candidate.clauses[0].english
    with pytest.raises(PipelineError, match=ERROR):
        validate_normalization(candidate, question)


@pytest.mark.parametrize('split', ['before_quote', 'inside_quote', 'before_suffix'])
def test_whole_question_span_cannot_escape_checks_by_clause_splitting(split):
    if split == 'before_suffix':
        question = 'اعرض «قيد الإنجاز» view.'
        index = question.index(' view')
    else:
        question = 'اعرض عرض «قيد الإنجاز».'
        index = question.index('«') if split == 'before_quote' else question.index('الإنجاز')
    candidate = InputNormalization(stage='input_normalization', clauses=[
        {'sourceQuote': question[:index], 'english': 'Show view «قيد الإنجاز».'},
        {'sourceQuote': question[index:], 'english': 'Continue.'}])
    with pytest.raises(PipelineError) as caught:
        validate_normalization(candidate, question)
    assert caught.value.code == ERROR and caught.value.details['namedViewSpanSplit'] is True


def test_label_cannot_be_copied_to_a_clause_without_original_named_label():
    first = 'اعرض عرض «قيد الإنجاز».'
    second = 'ولا تعدل البيانات.'
    question = first + ' ' + second
    candidate = InputNormalization(stage='input_normalization', clauses=[
        {'sourceQuote': first, 'english': 'Show view «قيد الإنجاز».'},
        {'sourceQuote': second, 'english': 'Do not modify data in view «قيد الإنجاز».'}])
    with pytest.raises(PipelineError, match=ERROR):
        validate_normalization(candidate, question)


@pytest.mark.parametrize('corrected', [True, False])
def test_structured_uses_existing_repair_budget_and_retains_complete_original(corrected):
    calls = []
    class Planner:
        async def generic_reader_json(self, **kwargs):
            calls.append(copy.deepcopy(kwargs))
            assert kwargs['schema']['$defs']['TranslatedClause']['properties']['sourceQuote']['const'] == TRACE['originalQuestion']
            if len(calls) > 1 and corrected:
                assert ERROR in kwargs['correction']
                return copy.deepcopy(TRACE['faithfulLiteralNormalization'])
            return copy.deepcopy(TRACE['inputNormalization'])
    reader = GenericKnowledgeReader(None, Planner(), portal_base_url='https://portal.test')
    reader.current_question = TRACE['originalQuestion']; reader.response_language = 'ar'
    reader.deadline = time.monotonic() + 30
    execute = lambda: asyncio.run(reader.structured(InputNormalization, NORMALIZATION_PROMPT,
        {'question': TRACE['originalQuestion']}, lambda p: validate_normalization(p, TRACE['originalQuestion'])))
    if corrected:
        result = execute()
        assert result.model_dump() == TRACE['faithfulLiteralNormalization']
    else:
        with pytest.raises(PipelineError, match=ERROR):
            execute()
    assert len(calls) == 2
    assert all(c['data']['question'] == TRACE['originalQuestion'] for c in calls)
    assert len(reader.recovery) == 1
