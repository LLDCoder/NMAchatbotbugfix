import json
import sys
from unittest.mock import MagicMock

import pytest

# Unit tests exercise pure service/test-runner helpers and never connect to a
# database. Stub the optional production driver when it is absent locally.
sys.modules.setdefault("asyncpg", MagicMock())

from app.service import DSHService, reader_answer_assembly_evidence
from app.testcases import _grade_reader_case


PUBLIC_RESULT = {
    "result": "success",
    "page": "Licensing",
    "section": "Tasks",
    "scope": "team",
    "facts": ["Status: pending"],
    "workflowState": "pending",
    "missing": [],
}


def audits(**payload):
    return [{"recordType": "reader.evidence", "payload": payload or {"stage": "completed"}}]


def case(**overrides):
    value = {"skillId": "admin_portal_reader", "guardrailKind": None, "expectedStatuses": []}
    value.update(overrides)
    return value


def test_audit_payload_recursively_redacts_normalized_sensitive_keys_and_strings() -> None:
    raw = {
        "safe": "Status: pending",
        "nested": {
            "sessionToken": "session-secret",
            "authorizationHeader": "Bearer auth-secret",
            "cookieValue": "sid=cookie-secret",
            "Password": "password-secret",
            "deeper": [{"provider_api_key": "provider-secret"}],
        },
        "message": (
            "Authorization: Bearer inline-secret; password=hunter2; "
            "sessionToken=inline-token; cookieValue=inline-cookie; "
            'payload={"access_token":"json-token"}'
        ),
    }

    result = DSHService.audit_payload(raw)
    encoded = json.dumps(result, ensure_ascii=False)

    assert result["safe"] == "Status: pending"
    assert result["nested"]["sessionToken"] == "[redacted]"
    assert result["nested"]["authorizationHeader"] == "[redacted]"
    assert result["nested"]["cookieValue"] == "[redacted]"
    assert result["nested"]["Password"] == "[redacted]"
    for secret in (
        "session-secret", "auth-secret", "cookie-secret", "password-secret",
        "provider-secret", "inline-secret", "hunter2", "inline-token", "inline-cookie", "json-token",
    ):
        assert secret not in encoded
    assert encoded.count("[redacted]") >= 10


def test_answer_assembly_trace_keeps_only_stage_metrics() -> None:
    trace = reader_answer_assembly_evidence(
        {**PUBLIC_RESULT, "answerShape": "overview"},
        "You have two current tasks.",
        duration_ms=12.4,
        formatting_failed=False,
        strategy="llm_organized",
    )

    assert trace == {
        "stage": "answer_assembly",
        "status": "passed",
        "durationMs": 12.4,
        "input": {
            "readerStatus": "success",
            "factCount": 1,
            "missingCount": 0,
            "answerShape": "overview",
        },
        "output": {
            "responseChars": 27,
            "usedFormattingFallback": False,
            "strategy": "llm_organized",
        },
        "failureCode": "",
    }


@pytest.mark.parametrize(
    ("status", "facts", "missing", "audit"),
    [
        ("success", ["Status: pending"], [], {"stage": "completed"}),
        ("no_data", [], [], {"stage": "completed"}),
        ("no_permission", [], ["page_not_permitted"], {"stage": "policy", "policyError": "page_not_permitted"}),
        ("load_failed", [], ["reader_timeout"], {"stage": "timeout", "error": "reader_timeout"}),
        ("not_confirmed", [], ["field_missing"], {"stage": "planning", "missing": ["field_missing"]}),
    ],
)
def test_regression_grader_validates_all_five_reader_states(status, facts, missing, audit) -> None:
    result = {**PUBLIC_RESULT, "result": status, "facts": facts, "missing": missing}

    grade = _grade_reader_case(
        case(expectedStatuses=[status]),
        {"skillId": "admin_portal_reader"},
        result,
        audits(**audit),
        "A concise answer",
    )

    assert grade["readerStatus"] == status
    assert grade["readerOk"] is True
    assert grade["score"] == 5


def test_regression_grader_does_not_award_five_for_assistant_text_alone() -> None:
    grade = _grade_reader_case(
        case(),
        {"skillId": "admin_portal_reader"},
        {},
        [],
        "An unsupported answer",
    )

    assert grade["score"] < 5
    assert grade["requirements"]["readerResult"] is False
    assert grade["requirements"]["auditEvidence"] is False


def test_mutation_guardrail_requires_policy_rejection_before_completion() -> None:
    rejected = {**PUBLIC_RESULT, "result": "not_confirmed", "facts": [], "missing": ["action_not_read_only"]}
    protected = _grade_reader_case(
        case(guardrailKind="mutation", expectedStatuses=["not_confirmed"]),
        {"skillId": "admin_portal_reader"},
        rejected,
        audits(stage="policy", policyError="action_not_read_only"),
        "That action is not permitted.",
    )
    completed = _grade_reader_case(
        case(guardrailKind="mutation", expectedStatuses=["not_confirmed"]),
        {"skillId": "admin_portal_reader"},
        rejected,
        audits(stage="completed", policyError="action_not_read_only"),
        "Done.",
    )

    assert protected["score"] == 5
    assert completed["score"] < 5
    assert completed["requirements"]["guardrail"] is False


def test_regression_grader_rejects_oversized_or_unredacted_evidence() -> None:
    oversized = {**PUBLIC_RESULT, "facts": ["x" * 1_000] * 20}
    grade = _grade_reader_case(
        case(),
        {"skillId": "admin_portal_reader"},
        oversized,
        audits(sessionToken="raw-secret"),
        "Answer",
    )

    assert grade["score"] < 5
    assert grade["requirements"]["bounds"] is False
    assert grade["requirements"]["auditRedacted"] is False
