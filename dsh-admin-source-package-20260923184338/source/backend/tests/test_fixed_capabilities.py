import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.api import reader_identity_from_audit_payloads
from app.config import Settings
from app.platform import PlatformGatewayClient
from app.reader_limits import (
    MAX_PLATFORM_TIMEOUT_SECONDS,
    PORTAL_EXECUTION_TIMEOUT_SECONDS,
    READER_TOTAL_TIMEOUT_SECONDS,
    effective_platform_timeout,
)
from app.service import DSHService
from app.skills import DEFAULT_SKILL_DEFINITIONS
from app.tool_gateway import SYSTEM_DEFAULT_TOOL_NAMES


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_only_generic_runtime_skills_remain() -> None:
    by_id = {item["skill_id"]: item for item in DEFAULT_SKILL_DEFINITIONS}

    assert set(by_id) == {"admin_portal_reader", "general_knowledge"}
    assert by_id["admin_portal_reader"]["allowed_tools"] == ["knowledge.search", "admin.portal.read"]
    assert by_id["general_knowledge"]["allowed_tools"] == ["knowledge.search"]


def test_only_fixed_read_only_tools_are_executable() -> None:
    assert SYSTEM_DEFAULT_TOOL_NAMES == {"knowledge.search", "admin.portal.read"}


def test_audit_ui_distinguishes_internal_user_id_from_reader_login_identity() -> None:
    app_source = (REPOSITORY_ROOT / "frontend" / "app.js").read_text(encoding="utf-8")

    assert 'case "reader.evidence"' in app_source
    assert "登录账号 ${account} · 当前角色 ${currentRole}" in app_source
    assert "conversation.readerIdentity" in app_source
    assert '["登录账号", readerIdentity.account || "未记录"]' in app_source
    assert '["当前角色", readerIdentity.currentRole || "未记录"]' in app_source
    assert "所属用户 ID" in app_source


def test_audit_overview_uses_latest_available_reader_identity() -> None:
    identity = reader_identity_from_audit_payloads([
        {"stage": "planning"},
        {
            "permission": {
                "account": "officer@example.test",
                "currentRole": "Licensing Officer",
                "roles": ["Licensing Officer"],
            }
        },
        {"permission": {"account": "older@example.test", "currentRole": "Licensing Manager"}},
    ])

    assert identity == {
        "account": "officer@example.test",
        "currentRole": "Licensing Officer",
    }


def test_audit_overview_falls_back_to_legacy_roles_and_marks_missing_account() -> None:
    identity = reader_identity_from_audit_payloads([
        {"permission": {"roles": ["Licensing Officer"]}},
    ])

    assert identity == {"account": "", "currentRole": "Licensing Officer"}


def test_reader_response_prompt_forbids_claiming_bounded_rows_are_complete() -> None:
    prompt = DSHService._runtime_system_prompt("admin_portal_reader", "en", "", "")
    assert "Read-only restrictions do not prohibit searching" in prompt
    assert "A fresh baseline does not itself prove" in prompt

    assert "bounded extract" in prompt
    assert "Never say records are all current records" in prompt
    assert "explicitly supports completeness" in prompt


def test_reader_response_prompt_leads_with_business_answer_without_audit_narration() -> None:
    prompt = DSHService._runtime_system_prompt("admin_portal_reader", "en", "", "")

    assert "You are NMA AI Assistant." in prompt
    assert "describe the available help positively" in prompt
    assert "Do not turn a routine capability answer into a restriction list" in prompt
    assert "lead with the business answer" in prompt
    assert "'currently' or 'in your dashboard'" in prompt
    assert "Do not narrate the evidence-gathering process" in prompt
    assert "'based on the visible page'" in prompt
    assert "'based on the visible section'" in prompt
    assert "'this read'" in prompt
    assert "'bounded snapshot'" in prompt


def test_reader_response_prompt_keeps_limitations_concise_and_material() -> None:
    prompt = DSHService._runtime_system_prompt("admin_portal_reader", "en", "", "")

    assert "If only a partial list is supported" in prompt
    assert "Here are some of your current tasks" in prompt
    assert "only when partial results or insufficient evidence materially affect the answer" in prompt
    assert "keep that limitation concise" in prompt


def test_reader_response_prompt_does_not_infer_attention_from_nonzero_counts() -> None:
    prompt = DSHService._runtime_system_prompt("admin_portal_reader", "en", "", "")

    assert "nonzero task-category count is workload information" in prompt
    assert "not evidence that the category or its tasks need attention" in prompt
    assert "never infer attention from a nonzero count" in prompt
 
 
def test_reader_response_prompt_requires_natural_question_focused_answers() -> None:
    prompt = DSHService._runtime_system_prompt("admin_portal_reader", "en", "", "")
 
    assert "do not mechanically repeat every supplied field" in prompt
    assert "lead with a concise conclusion" in prompt
    assert "instead of presenting an API-shaped field dump" in prompt
    assert "Task ID 0 is a placeholder and must not be shown" in prompt
    assert "offer a practical ordering based on verified statuses and counts" in prompt


def test_reader_timeout_defaults_cover_two_stage_planning_and_portal_executor() -> None:
    settings = Settings(_env_file=None, platform_timeout_seconds=1)
    platform = PlatformGatewayClient(settings)

    assert settings.reader_total_timeout_seconds == READER_TOTAL_TIMEOUT_SECONDS == 90
    assert settings.reader_max_candidates_before_drill == 10
    assert platform.timeout > PORTAL_EXECUTION_TIMEOUT_SECONDS == 65


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("reader_total_timeout_seconds", float("nan")),
        ("reader_total_timeout_seconds", float("inf")),
        ("reader_total_timeout_seconds", 181),
        ("reader_max_candidates_before_drill", 0),
        ("reader_max_candidates_before_drill", 33),
        ("platform_timeout_seconds", float("nan")),
        ("platform_timeout_seconds", float("inf")),
        ("platform_timeout_seconds", 181),
    ],
)
def test_reader_timeout_settings_reject_non_finite_and_unbounded_values(field, value) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})


def test_effective_platform_timeout_has_a_fixed_upper_bound() -> None:
    assert effective_platform_timeout(1_000_000) == MAX_PLATFORM_TIMEOUT_SECONDS
    with pytest.raises(ValueError):
        effective_platform_timeout(float("inf"))


def test_hot_config_ignores_invalid_reader_timeouts() -> None:
    settings = Settings(_env_file=None)
    service = object.__new__(DSHService)
    service.settings = settings
    service.console_password = "test"
    service.llm = SimpleNamespace(settings=settings)
    service.tool_gateway = SimpleNamespace(
        knowledge=SimpleNamespace(base_url="", timeout=0, retry_attempts=0),
        platform=SimpleNamespace(base_url="", timeout=0, user_info_url="", portal_base_url=""),
    )
    entries = [
        SimpleNamespace(key="reader_total_timeout_seconds", value={"value": "inf"}),
        SimpleNamespace(key="platform_timeout_seconds", value={"value": "1000000"}),
    ]

    asyncio.run(service.apply_config_entries(entries))

    assert service.settings.reader_total_timeout_seconds == READER_TOTAL_TIMEOUT_SECONDS
    assert service.settings.platform_timeout_seconds == 50
    assert service.tool_gateway.platform.timeout == 70
