import pytest

from app.portal_reader import (ABSENCE_EVIDENCE_LIMIT, PRIOR_EMPTY_LIST_FACT, PRIOR_LIST_SAMPLE_FACT,
                              previous_sample_explanation, reader_absence_limit_explanation)
from app.service import _reader_conversation_context, reader_evidence_only_response
from test_admin_portal_reader import Gateway, Planner, run_reader
from test_service_reader_context import event


PRIOR = {"previousIntent": {"question": "Show three records", "resultStatus": "success",
                            "deliveredAnswerShape": "list", "completeness": "bounded"}}


def test_absence_question_explains_reader_limit_without_asserting_record_history():
    gateway, planner = Gateway(), Planner()
    outcome = run_reader(gateway, planner, question='Can you confirm a task was deleted just because this search found nothing?')
    assert outcome.result.status == 'success'
    assert outcome.result.facts == (ABSENCE_EVIDENCE_LIMIT,)
    assert gateway.events == ['GetUserInfo']
    assert planner.calls == []


@pytest.mark.parametrize('question', ['Was record REF-1 deleted?', 'Find deleted tasks.', 'Delete that task.',
    'Can you confirm a task was deleted just because this search found nothing and restore it?'])
def test_actual_history_or_mutation_request_cannot_use_absence_explanation(question):
    assert reader_absence_limit_explanation(question) is None


@pytest.mark.parametrize('language', ['en', 'zh', 'ar'])
def test_observed_404_response_retains_page_failure_not_no_data(language):
    answer = reader_evidence_only_response({'result': 'load_failed', 'facts': [],
        'missing': ['observed_page_not_found']}, language)
    assert '404' in answer


def test_unavailable_queue_reply_is_not_empty_record_result():
    answer = reader_evidence_only_response({'result': 'not_confirmed', 'facts': [],
        'missing': ['observed_queue_not_available']}, 'en')
    assert 'not a no-matching-records result' in answer


@pytest.mark.parametrize("question", [
    "Is that the total number, or only the sample you listed?",
    "Is this all or just a sample?", "这是总数还是你列出的样本？",
])
def test_answer_coverage_uses_only_verified_presentation_metadata(question):
    gateway, planner = Gateway(), Planner()
    outcome = run_reader(gateway, planner, question=question, conversation_context=PRIOR)
    assert outcome.result.status == "success"
    assert "bounded coverage" in outcome.result.facts[0]
    assert "separately verified total" in outcome.result.facts[0]
    assert gateway.events == ["GetUserInfo"]
    assert planner.calls == []


@pytest.mark.parametrize("field,value", [
    ("resultStatus", "not_confirmed"),
    ("deliveredAnswerShape", "count"), ("deliveredAnswerShape", "overview"),
    ("completeness", "complete"), ("completeness", "unknown"),
])
def test_missing_or_different_presentation_evidence_does_not_invent_a_sample(field, value):
    context = {"previousIntent": {**PRIOR["previousIntent"], field: value}}
    explanation = previous_sample_explanation("Is that total or only a sample?", context)
    if field == 'resultStatus' and value == 'not_confirmed':
        assert 'Neither a sample count nor a collection total was verified' in explanation
    else:
        assert explanation is None


@pytest.mark.parametrize("question", ["How many records are there now?", "Show all records.", "List the next page."])
def test_current_data_questions_cannot_use_old_presentation_metadata(question):
    assert previous_sample_explanation(question, PRIOR) is None
    assert previous_sample_explanation(question, {"previousIntent": {**PRIOR["previousIntent"], "resultStatus": "no_data"}}) is None


@pytest.mark.parametrize("completeness", ["bounded", "complete"])
def test_empty_query_followup_uses_coverage_not_current_records(completeness):
    context = {"previousIntent": {**PRIOR["previousIntent"], "resultStatus": "no_data", "completeness": completeness}}
    gateway, planner = Gateway(), Planner()
    outcome = run_reader(gateway, planner, question="Is that total or only a sample?", conversation_context=context)
    assert outcome.result.status == "success"
    assert list(outcome.result.facts) == [PRIOR_EMPTY_LIST_FACT]
    assert gateway.events == ["GetUserInfo"]
    assert planner.calls == []


@pytest.mark.parametrize("patch", [{"completeness": "unknown"}, {"deliveredAnswerShape": "count"}, {"deliveredAnswerShape": "overview"}])
def test_unverified_empty_query_coverage_is_not_invented(patch):
    context = {"previousIntent": {**PRIOR["previousIntent"], "resultStatus": "no_data", **patch}}
    assert previous_sample_explanation("Is that total or only a sample?", context) is None


@pytest.mark.parametrize("with_intent", [False, True])
@pytest.mark.parametrize("status", ["success", "no_data"])
def test_service_retains_only_previous_presentation_metadata(with_intent, status):
    previous = event(1, "user.message", {"content": "Show three records"})
    result = {"result": status, "answerShape": "list", "completeness": "bounded",
              "facts": ['{"Reference":"PRIVATE-123"}']}
    if with_intent:
        result["intentContext"] = {"relation": "refine", "slots": {"answerShape": {
            "source": "current", "value": "list", "evidence": "Show",
        }}, "clarificationOptions": []}
    current = event(3, "user.message", {"content": "Is that total or a sample?"})
    context = _reader_conversation_context([previous, event(2, "reader.result", result), current], current)
    assert context["previousIntent"]["completeness"] == "bounded"
    assert context["previousIntent"]["deliveredAnswerShape"] == "list"
    assert "PRIVATE-123" not in str(context)


@pytest.mark.parametrize("language", ["en", "zh", "ar"])
@pytest.mark.parametrize("fact", [PRIOR_LIST_SAMPLE_FACT, PRIOR_EMPTY_LIST_FACT])
def test_sample_explanation_bypasses_formatter_without_retracting_earlier_total(language, fact):
    result = {"result": "success", "answerShape": "detail", "facts": [fact], "missing": []}
    response = reader_evidence_only_response(result, language, prior_answer_coverage=True)
    assert response
    assert not any(char.isdigit() for char in response)
    if language == "en" and fact == PRIOR_LIST_SAMPLE_FACT:
        assert "immediately preceding list" in response
        assert "does not change any separately verified total" in response
        assert "not the complete collection" not in response
    if language == "en" and fact == PRIOR_EMPTY_LIST_FACT:
        assert "not a sample count or a global collection total" in response
        assert "still current" in response
    # The formatting branch now always supplies a deterministic presentation.
    # Only the trusted coverage stage gets the localized coverage explanation.
    ordinary = reader_evidence_only_response(result, language)
    assert ordinary and ordinary != response


@pytest.mark.parametrize("patch", [
    {"answerShape": "count"}, {"facts": [PRIOR_LIST_SAMPLE_FACT, "Total 493"]},
    {"facts": ["The earlier total was just a sample."]}, {"missing": ["unverified"]},
    {"facts": [PRIOR_EMPTY_LIST_FACT, "There are no records anywhere."]},
])
def test_coverage_guard_does_not_trust_generated_or_mixed_facts(patch):
    result = {"result": "success", "answerShape": "detail", "facts": [PRIOR_LIST_SAMPLE_FACT], "missing": [], **patch}
    assert reader_evidence_only_response(result, "en", prior_answer_coverage=True) == reader_evidence_only_response(result, "en")


@pytest.mark.parametrize('language', ['en', 'zh', 'ar'])
def test_team_scope_failure_never_formats_personal_rows_as_team_data(language):
    result = {'result': 'not_confirmed', 'facts': [], 'missing': ['requested_team_scope_unverified']}
    response = reader_evidence_only_response(result, language)
    assert response
    assert '162' not in response
    if language == 'en':
        assert 'not treated the current list as team data' in response
