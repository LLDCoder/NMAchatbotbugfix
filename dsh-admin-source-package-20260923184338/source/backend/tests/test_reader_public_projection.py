"""Customer projection keeps facts and uncertainty while audit retains implementation proofs."""
import copy
import pytest
from app.generic_reader import render_generic_answer, PipelineError
from test_reader_requirement_coverage import fixture, execute


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_public_projection_omits_execution_details_without_erasing_scope_or_unknowns(language):
    evidence = {'outputs': [{'label': 'Count' if language == 'en' else 'العدد', 'value': 7,
                            'unknownCount': 2, 'role': 'observation'}],
                'context': {'scope': 'personal', 'population': {'value': 'POST /api/specimens/list'},
                            'grain': {'value': 'specimen identified by specimenKey'},
                            'caveats': [{'value': 'page.total is before pagination'}]},
                'completeness': 'bounded', 'requirementsSatisfied': False,
                'missing': ['requested_grouping_unfulfilled'], 'gaps': [{'code': 'requested_grouping_unfulfilled'}],
                'executionStatus': [{'stage': 'data_collection', 'status': 'partial'}]}
    before = copy.deepcopy(evidence)
    public = render_generic_answer(evidence, language)
    debug = render_generic_answer(evidence, language, include_diagnostics=True)
    assert '7' in public and '2' in public
    assert ('personal' if language == 'en' else 'شخصي') in public
    for private in ['/api/', 'specimenKey', 'page.total', 'requested_grouping_unfulfilled', '```json']:
        assert private not in public
        assert private in debug
    assert ('not yet satisfy' if language == 'en' else 'لا تستوفي') in public
    assert evidence == before


def test_translated_table_headers_never_modify_verified_keys_or_values():
    f = fixture()
    f[1].steps[-1].fieldLabels = {'phase': 'المرحلة', 'count': 'العدد'}
    result = execute(f)
    rows = result['outputs'][-1]['value']
    assert rows == [{'phase': 'Warm', 'count': 1}, {'phase': 'Cold', 'count': 1}, {'phase': 'Uncatalogued', 'count': 1}]
    text = render_generic_answer(result, 'ar')
    assert '| المرحلة | العدد |' in text and '| Uncatalogued | 1 |' in text
    assert result['requirementsSatisfied']


@pytest.mark.parametrize('language,qualification', [
    ('en', 'This is the latest stored quote, not the historical snapshot of the original transaction.'),
    ('ar', 'هذا أحدث عرض سعر محفوظ، وليس لقطة تاريخية للمعاملة الأصلية.'),
])
def test_customer_source_limitations_survive_technical_projection(language, qualification):
    evidence = {'outputs': [{'label': 'Amount', 'value': 1000}],
                'context': {'scope': 'unknown', 'caveats': [
                    {'value': qualification}, {'value': 'GET /api/private/quote returns internalQuoteId.'}]},
                'completeness': 'complete', 'requirementsSatisfied': False}
    public = render_generic_answer(evidence, language)
    assert qualification in public
    assert '/api/private/' not in public and 'internalQuoteId' not in public
    assert '1000' in public


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_nullable_auxiliary_columns_do_not_become_missing_answer_attributes(language):
    evidence = {'outputs': [{'label': 'States', 'value': [{'state': 'Warm', 'count': 3}],
                            'unavailableFields': ['optionalReference'], 'unknownCount': 0}],
                'context': {'scope': 'personal'}, 'completeness': 'complete', 'requirementsSatisfied': True}
    text = render_generic_answer(evidence, language)
    assert ('Some requested fields' if language == 'en' else 'تعذر تأكيد بعض الحقول') not in text
    assert ('count' if language == 'en' else 'العدد') in text
    evidence['outputs'][0]['value'][0]['state'] = None
    evidence['outputs'][0]['unavailableFields'].append('state')
    assert ('Some requested fields' if language == 'en' else 'تعذر تأكيد بعض الحقول') in render_generic_answer(evidence, language)


def test_arabic_implementation_prerequisites_remain_audit_only():
    evidence = {'outputs': [{'label': 'العدد', 'value': 3}],
                'context': {'scope': 'personal', 'caveats': [
                    {'value': 'لم تتم مطابقة البناء المنشور؛ يجب التحقق من شكل الاستجابة.'},
                    {'value': 'صفحة محدودة ليست مجموعة كاملة.'},
                    {'value': 'تشمل النتائج العناصر المعلقة فقط.'}]},
                'completeness': 'complete', 'requirementsSatisfied': True}
    public = render_generic_answer(evidence, 'ar')
    assert 'البناء المنشور' not in public and 'صفحة محدودة' not in public
    assert 'تشمل النتائج العناصر المعلقة فقط.' in public
    assert 'البناء المنشور' in render_generic_answer(evidence, 'ar', include_diagnostics=True)


@pytest.mark.parametrize('labels', [{'invented': 'Wrong'}, {'phase': 'Same', 'count': 'Same'}])
def test_unobserved_or_colliding_display_columns_cannot_hide_dimensions(labels):
    f = fixture(); f[1].steps[-1].fieldLabels = labels
    with pytest.raises(PipelineError, match='output_field_labels_invalid'):
        execute(f)
