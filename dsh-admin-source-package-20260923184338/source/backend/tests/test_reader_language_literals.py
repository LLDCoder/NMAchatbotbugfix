import pytest

from app.skills import detect_message_language, detect_unsupported_message_language, response_language_for


@pytest.mark.parametrize('literal', [
    'NONEXISTENT-REGRESSION-20260925-99999999', 'APPLICATION123456789',
    'request_2026_alpha_1234', 'c8353c37-b54d-4919-b3b3-4682d4ab3397',
    'https://example.test/applications/long-english-route', 'long.english.name@example.test',
    '`aVeryLongEnglishPropertyName`',
])
def test_opaque_literal_does_not_outvote_arabic_prose(literal):
    assert response_language_for('ابحث عن الطلب رقم ' + literal, 'en') == 'ar'
    assert detect_message_language(literal) == ''
    assert response_language_for(literal, 'ar') == 'ar'


@pytest.mark.parametrize('suffix', ['١٢٣٤٥٦٧٨٩٠' * 10, '؟،؛' * 40, 'ـ' * 80])
def test_arabic_digits_and_punctuation_are_not_arabic_language_evidence(suffix):
    assert response_language_for('Find my application ' + suffix, 'ar') == 'en'
    assert detect_message_language(suffix) == ''


def test_unsupported_language_is_not_hidden_by_long_identifier():
    message = '请查询申请编号 NONEXISTENT-REGRESSION-20260925-99999999'
    assert detect_unsupported_message_language(message) == 'zh'
    assert response_language_for(message, 'ar') == 'ar'


@pytest.mark.parametrize('message,preferred,expected', [
    ('ابحث عن الطلب NONEXISTENT-REGRESSION-20260925-99999999. Reply in English.', 'ar', 'en'),
    ('Find application APPLICATION123. Reply in Arabic.', 'en', 'ar'),
    ('Check the up-to-date status.', 'ar', 'en'),
    ('qzxv qzxv 987xz randomword 锟斤拷', 'ar', 'en'),
    ('س ص ع ف غيرمفهوم 锟斤拷', 'en', 'ar'),
])
def test_prose_and_explicit_language_preferences_remain_authoritative(message, preferred, expected):
    assert response_language_for(message, preferred) == expected
