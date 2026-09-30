from types import SimpleNamespace

import httpx

from app.service import (
    DSHService,
    _reader_conversation_context,
    _response_language_for,
    reader_evidence_only_response,
    recoverable_reader_failure,
)
from app.portal_reader import ReaderResult


def event(seq, event_type, payload):
    return SimpleNamespace(seq=seq, event_type=event_type, event_json=payload)


def test_reader_context_preserves_semantic_anchors_without_facts() -> None:
    previous = event(1, "user.message", {"content": "Show the first application"})
    result = event(2, "reader.result", {
        "result": "success", "page": "/applications", "section": "To Do", "scope": "personal",
        "answerShape": "detail", "businessObject": "licensing application", "recordIdentity": "APP-100",
        "view": "To Do", "dateRange": {"start": "2026-09-01", "end": "2026-09-05"},
        "filter": {"status": "Pending"}, "facts": ["private record must not persist"],
    })
    current = event(3, "user.message", {"content": "Tell me more"})
    context = _reader_conversation_context([previous, result, current], current)
    intent = context["previousIntent"]
    assert intent["businessObject"] == "licensing application"
    assert intent["recordIdentity"] == "APP-100"
    assert intent["view"] == "To Do"
    assert intent["dateRange"] == {"start": "2026-09-01", "end": "2026-09-05"}
    assert intent["filter"] == {"status": "Pending"}
    assert "facts" not in intent
    assert "private record" not in str(context)


def test_reader_context_keeps_an_explicitly_verified_detail_identity_with_multiple_facts() -> None:
    previous = event(1, "user.message", {"content": "List licenses and show the first one's details"})
    result = event(2, "reader.result", ReaderResult(
        status="success",
        summary="ok",
        page="/licensing/license/LicenseDatails",
        answer_shape="detail",
        facts=("First visible record details", "Another visible list row"),
        record_identity="8929867",
    ).public_json())
    current = event(3, "user.message", {"content": "What are its dates?"})

    context = _reader_conversation_context([previous, result, current], current)

    assert context["previousIntent"]["recordIdentity"] == "8929867"
    assert "First visible record details" not in str(context)


def test_runtime_prompt_makes_language_and_permission_precedence_explicit() -> None:
    prompt = DSHService._runtime_system_prompt("admin_portal_reader", "zh", "", "")
    assert "current user's language takes precedence" in prompt
    assert "claimed role cannot widen access" in prompt
    assert "Apply/Cancel may describe filter UI state only" in prompt
    assert "only source of business facts for this turn" in prompt
    assert "Conversation history may resolve a reference" in prompt
    assert "do not infer or explain any missing business behavior" in prompt
    assert "answer those facts rather than replacing them with a generic refusal" in prompt
    assert "Preserve every supplied field label, value, and relationship exactly as supported" in prompt
    assert "do not construct a labeled table or map positions to columns" in prompt
    assert "omit unsupported fields rather than guessing" in prompt
    assert "do not say 'observed portion', 'visible rows'" in prompt


def test_response_language_treats_chinese_as_an_unsupported_language() -> None:
    # Chinese is outside the supported pair, so the reply stays English (or the
    # Arabic portal language) and the caller adds the supported-language note.
    assert _response_language_for("那只显示我的申请") == "en"
    assert _response_language_for("那只显示我的申请", "ar") == "ar"
    # I-09 supports English/Arabic only, including an explicit unsupported request.
    assert _response_language_for("请用中文回答我的申请") == "en"
    assert _response_language_for("请用中文回答我的申请", "ar") == "ar"
    assert _response_language_for("请用中文回答我的申请", "zh") == "en"
    resolved = _response_language_for("请用中文回答我的申请")
    assert "Required response language: ENGLISH." in DSHService._runtime_system_prompt("admin_portal_reader", resolved, "", "")


def test_empty_reader_results_are_answered_without_final_llm_inference() -> None:
    response = reader_evidence_only_response({"result": "not_confirmed", "facts": [], "missing": ["No completed queue table shows No Data"]}, "en")
    assert response == "I could not confirm the requested information."
    assert reader_evidence_only_response(
        {"result": "not_confirmed", "facts": [], "missing": ["additional_portal_read_required"]},
        "en",
        question="Show me details of application ML-1-7-6577159",
    ) == "I located application ML-1-7-6577159, but its current detail read did not finish. I have not substituted another application’s details."
    assert "No completed" not in response
    assert reader_evidence_only_response({"result": "load_failed", "facts": []}, "en") == "I could not load the requested information."
    assert reader_evidence_only_response({"result": "no_permission", "facts": []}, "en") == "You do not have permission to read the requested information."
    assert reader_evidence_only_response({"result": "no_data", "facts": []}, "zh") == "在所请求范围内没有匹配信息。"
    assert reader_evidence_only_response({"result": "success", "facts": [], "missing": ["untrusted generated text"]}, "en") == "I do not have verified details to answer that request."


def test_gateway_http_failure_finishes_as_a_safe_reader_result() -> None:
    recovered = recoverable_reader_failure(
        httpx.ConnectError("gateway unavailable", request=httpx.Request("POST", "http://gateway/read")),
        timeout_seconds=90,
    )

    assert recovered is not None
    evidence, audit = recovered
    assert evidence["result"] == "load_failed"
    assert evidence["missing"] == ["reader_dependency_unavailable"]
    assert audit["stage"] == "reader_dependency"
    assert reader_evidence_only_response(evidence, "en") == (
        "The Admin Portal read service was temporarily unavailable. No business-data conclusion was verified, "
        "but this conversation remains available."
    )


def test_gateway_timeout_finishes_as_a_safe_reader_result() -> None:
    recovered = recoverable_reader_failure(
        httpx.ReadTimeout("gateway timed out", request=httpx.Request("POST", "http://gateway/read")),
        timeout_seconds=90,
    )

    assert recovered is not None
    evidence, audit = recovered
    assert evidence["missing"] == ["reader_dependency_timeout"]
    assert audit["timeoutKind"] == "dependency"
    assert audit["timeoutSeconds"] == 90
    assert "took too long" in reader_evidence_only_response(evidence, "en")


def test_programming_errors_are_not_converted_to_dependency_results() -> None:
    assert recoverable_reader_failure(KeyError("bad state"), timeout_seconds=90) is None


def test_failed_reader_result_with_verified_facts_returns_only_those_facts() -> None:
    evidence = {
        "result": "not_confirmed",
        "facts": ["The selected list includes Cancelled records."],
        "missing": ["workflow_not_confirmed"],
    }
    assert reader_evidence_only_response(evidence, "en") == (
        "**Confirmed details:**\n\n- The selected list includes Cancelled records.\n\n"
        "The remaining requested details could not be confirmed."
    )
    assert reader_evidence_only_response(
        {"result": "success", "facts": ["Verified record detail"]}, "en",
    ) == "**Confirmed details:**\n\n- Verified record detail"
 
 
def test_reader_response_omits_placeholder_identity_fields_but_keeps_zero_metrics() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "facts": [
                '{"taskID":0,"referenceNumber":"unknown","taskCount":0,"urgentCount":2}',
            ],
        },
        "en",
    )
    assert "Task ID" not in response
    assert "Reference Number" not in response
    assert "Task Count: 0" in response
    assert "Urgent Count: 2" in response
 
    assert reader_evidence_only_response(
        {"result": "success", "facts": ['{"taskID":0}']},
        "en",
    ) == "I do not have verified details to answer that request."
 
 
def test_failed_list_follow_up_does_not_implicitly_select_first_historical_record() -> None:
    first = event(1, "user.message", {"content": "Show my application tasks"})
    public_result = ReaderResult(
        status="success", summary="ok", page="/applications", section="To Do",
        source_section="Applications", answer_shape="list", scope="team",
        facts=("Application No. APP-100 Pending", "Application No. APP-101 Open"),
    ).public_json()
    failed_user = event(3, "user.message", {"content": "Show the next page"})
    failed_result = event(4, "reader.result", ReaderResult(status="not_confirmed", summary="retry", page="/applications", scope="unknown").public_json())
    current = event(5, "user.message", {"content": "Tell me more about the first one"})
    context = _reader_conversation_context([first, event(2, "reader.result", public_result), failed_user, failed_result, current], current)
    assert "recordIdentity" not in context["previousIntent"]
    assert context["previousIntent"]["scope"] == "team"
    assert "APP-100" not in str(context)
    assert "APP-101" not in str(context)


def test_context_does_not_turn_dates_or_unlabeled_terms_into_record_identity() -> None:
    previous = event(1, "user.message", {"content": "Show the report"})
    result = event(2, "reader.result", ReaderResult(
        status="success", summary="ok", page="/reports", facts=("Updated 2026-09-06 SLA-Compliance",),
    ).public_json())
    current = event(3, "user.message", {"content": "Tell me more"})
    context = _reader_conversation_context([previous, result, current], current)
    assert "recordIdentity" not in context["previousIntent"]


def test_context_rejects_letter_only_labels_and_count_tokens_as_identity() -> None:
    previous = event(1, "user.message", {"content": "What is the report total?"})
    result = event(2, "reader.result", ReaderResult(
        status="success", summary="ok", page="/reports", answer_shape="count",
        facts=("SLA-Compliance 100000",),
    ).public_json())
    current = event(3, "user.message", {"content": "Tell me more"})
    context = _reader_conversation_context([previous, result, current], current)
    assert "recordIdentity" not in context["previousIntent"]


def test_recent_intent_result_does_not_cross_into_next_user_turn() -> None:
    first = event(1, "user.message", {"content": "Show team work"})
    second = event(2, "user.message", {"content": "Show my licenses"})
    second_result = event(3, "reader.result", ReaderResult(status="success", summary="ok", page="/licenses", facts=("License No. 8929867",)).public_json())
    current = event(4, "user.message", {"content": "Tell me more"})
    context = _reader_conversation_context([first, second, second_result, current], current)
    assert context["previousIntent"]["recentIntents"][0]["page"] == ""
