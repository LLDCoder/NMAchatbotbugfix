import pytest

from app.reader_finance_skill import finance_skill
from app.reader_prompt_policy import stage_language_policy


@pytest.mark.parametrize('question', [
    'Approve and execute this refund.', 'Explain the fees and payment discrepancy.',
    'اشرح سبب مبلغ الرسوم.', 'صدّر الحسابات المصرفية لكل العملاء.',
])
def test_financial_guidance_is_integrated_without_record_specific_values(question):
    policy = stage_language_policy('KnowledgeAnswerDraft', 'en', question)
    assert finance_skill('KnowledgeAnswerDraft', question) in policy
    assert 'explicit human confirmation' in policy
    assert 'remains unverified' in policy


def test_unrelated_business_question_does_not_receive_financial_instructions():
    assert finance_skill('TaskSpec', 'List the inspection tasks assigned to me.') == ''


def test_fee_analysis_preserves_source_semantics_and_scalar_shape():
    policy = finance_skill('AnalysisPlan', 'Why is this fee this amount?')
    assert 'not automatically the immutable original quote' in policy
    assert 'not a row collection' in policy
