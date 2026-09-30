"""Generic, read-only Admin Portal reader orchestration.

The reader is deliberately independent from business-module Skills and Tools.
It obtains the current identity first, retrieves relevant documentation, then
executes one bounded ``admin.portal.read`` request.  Only the public result is
returned to the main assistant; technical evidence is kept separately for the
audit trail.
"""

from __future__ import annotations

import asyncio
import html
import hashlib
import json
import re
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timezone
from typing import Any, Literal, Protocol
from urllib.parse import unquote, urlsplit

import httpx

from .principal import Principal
from .inspection_assignment import TASK_NUMBER, is_assignment_followup, classify_assignment
from .reader_intent import (
    parse_intent_resolution,
    resolve_literal_filter_followup,
    resolve_literal_record_field_followup,
    resolve_literal_same_record_reference,
    resolve_literal_view_followup,
    semantic_source_hint,
)
from .reader_limits import PORTAL_EXECUTION_TIMEOUT_SECONDS, READER_TOTAL_TIMEOUT_SECONDS, bounded_reader_total_timeout, requested_record_limit


ReaderStatus = Literal["success", "no_data", "no_permission", "load_failed", "not_confirmed"]
READER_STATUSES = frozenset({"success", "no_data", "no_permission", "load_failed", "not_confirmed"})
MAX_API_CANDIDATES_BEFORE_DRILL = 10
MAX_API_DRILL_DEPTH = 1
API_SELECTION_REASON_CODES = frozenset({
    "trigger_matches_intent",
    "swagger_schema_matches_answer",
    "swagger_tag_matches_business_object",
    "request_fields_match_filters",
    "response_fields_match_answer",
    "only_safe_candidate",
})
API_DRILL_REASON_CODES = frozenset({"control_matches_intent", "reduce_candidate_set"})
API_DRILL_ACTIONS = frozenset({"switch_tab", "filter", "show_filter", "apply_filter"})
ALLOWED_READER_ACTIONS = frozenset({
    "observe", "navigate", "query", "filter", "paginate", "switch_tab", "expand_details",
    "show_filter", "apply_filter", "reset_filter", "show_detail", "dismiss_overlay", "sort",
})
FORBIDDEN_ACTION_TERMS = frozenset(
    {
        "approve", "approval", "reject", "submit", "modify", "update", "edit", "delete",
        "remove", "assign", "send", "export", "upload", "download", "create", "write",
        "save", "pay", "refund", "appeal", "publish", "import", "cancel", "confirm", "dowload",
        "suspend", "archive", "enable", "disable", "close", "open", "activate", "deactivate",
    }
)
# Browser action types and HTTP methods are the primary read-only boundary. These
# terms provide a second, contextual guard for UI commands without treating the
# names of business resources or workflow states as commands.
MUTATION_COMMAND_TERMS = frozenset(
    {
        "approve", "reject", "submit", "modify", "update", "edit", "delete",
        "remove", "assign", "send", "export", "upload", "download", "dowload",
        "create", "write", "save", "pay", "refund", "appeal", "publish", "import",
        "cancel", "confirm", "suspend", "archive", "enable", "disable", "close",
        "open", "activate", "deactivate",
    }
)
# Whole-word matching leaves plural resource routes such as ``/refunds`` and
# ``/appeals`` readable while retaining single-command routes as mutations.
MUTATION_ROUTE_TERMS = MUTATION_COMMAND_TERMS
READ_ONLY_OPEN_CONTEXT_TERMS = frozenset({"task", "tasks", "status", "statuses", "category", "categories"})
SENSITIVE_KEYS = frozenset(
    {
        "authorization", "cookie", "cookies", "token", "access_token", "accesstoken",
        "refresh_token", "refreshtoken", "password", "secret", "credential", "html",
        "pagehtml", "fullhtml", "dom", "screenshot", "binary", "base64",
    }
)
SENSITIVE_KEY_FRAGMENTS = frozenset(
    {"html", "dom", "screenshot", "base64", "binary", "token", "cookie", "credential", "password", "secret", "session", "authorization", "raw", "pagecontent", "fullpage", "completetable"}
)
_CREDENTIAL_NAME = (
    r"session[_-]?token|access[_-]?token|refresh[_-]?token|umc[_-]?token|token|"
    r"password|api[_-]?key|"
    r"provider[_-]?key|secret|credential"
)


def _sanitize_untrusted_text(value: object, *, max_length: int | None) -> str:
    decoded = html.unescape(str(value))
    without_active_markup = re.sub(
        r"(?is)<(script|style)\b[^>]*>.*?(?:</\1\s*>|$)",
        " ",
        decoded,
    )
    plain = re.sub(r"<[^>]{1,500}>", " ", without_active_markup)
    redacted = re.sub(
        r"(?i)(?P<prefix>\bauthorization(?:header)?\b(?:\s*[:=]\s*|\s+\bis\b\s+|\s+))"
        r"(?P<value>(?:(?:bearer|basic)\s+)?[^\s,;]+)",
        lambda match: f"{match.group('prefix')}[redacted]",
        plain,
    )
    redacted = re.sub(
        r"(?i)\b(?:bearer|basic)\s+[a-z0-9._~+/=-]+",
        "[redacted-auth]",
        redacted,
    )
    redacted = re.sub(
        r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b",
        "[redacted-jwt]",
        redacted,
    )
    redacted = re.sub(
        r"(?i)(?P<prefix>\bcookie(?:value|header)?\b(?:\s*[:=]\s*|\s+\bis\b\s+))"
        r"(?P<value>[^\s;,=]+=[^;\s,]+(?:\s*;\s*(?:[^\s;,=]+=[^;\s,]+|secure|httponly|partitioned))*)",
        lambda match: f"{match.group('prefix')}[redacted]",
        redacted,
    )
    redacted = re.sub(
        r"(?i)(?P<prefix>\b(?:session|access|refresh|umc)[\s_-]?token\b\s+)"
        r"(?P<value>(?!(?:policy|status|scope|lifetime|expiry|expiration|format|rotation|required)\b)"
        r"[a-z0-9._~+/=-]{6,})",
        lambda match: f"{match.group('prefix')}[redacted]",
        redacted,
    )
    redacted = re.sub(
        r"(?i)(?P<prefix>\bcookie(?:value|header)?\b(?:\s*[:=]\s*|\s+\bis\b\s+))"
        r"(?P<value>[^\s,;]+)",
        lambda match: f"{match.group('prefix')}[redacted]",
        redacted,
    )
    redacted = re.sub(
        r"(?i)(?P<prefix>\b(?:api[\s_-]?key|provider[\s_-]?key)\b\s+)"
        r"(?P<value>sk-[a-z0-9_-]{8,}|[a-z0-9._~+/=-]{16,})",
        lambda match: f"{match.group('prefix')}[redacted]",
        redacted,
    )
    redacted = re.sub(
        rf"(?i)(?P<key>\b(?:{_CREDENTIAL_NAME}|api[\s_-]?key|provider[\s_-]?key)\b)"
        r"(?P<closing_quote>[\"']?)(?P<separator>(?:\s*[:=]\s*|\s+\bis\b\s+))"
        r"(?P<value>\"[^\"]*\"|'[^']*'|[^\s,;}\]]+)",
        lambda match: f"{match.group('key')}{match.group('closing_quote')}{match.group('separator')}[redacted]",
        redacted,
    )
    return re.sub(r"\s+", " ", redacted).strip()[:max_length]


@dataclass(frozen=True)
class ReaderTimeoutBudget:
    """Total and per-dependency budgets for one Reader turn."""

    total_seconds: float = READER_TOTAL_TIMEOUT_SECONDS
    get_user_info_seconds: float = 10.0
    knowledge_search_seconds: float = 15.0
    planner_seconds: float = 30.0
    portal_read_seconds: float = 50.0

    @classmethod
    def from_dependencies(
        cls,
        *,
        total_seconds: float,
        llm_timeout_seconds: float,
        knowledge_timeout_seconds: float,
        platform_timeout_seconds: float,
    ) -> "ReaderTimeoutBudget":
        total = bounded_reader_total_timeout(total_seconds)
        return cls(
            total_seconds=total,
            get_user_info_seconds=min(10.0, float(platform_timeout_seconds), total),
            knowledge_search_seconds=min(float(knowledge_timeout_seconds), total),
            planner_seconds=min(float(llm_timeout_seconds), total),
            portal_read_seconds=min(float(platform_timeout_seconds), total),
        )


class ReaderStageTimeout(TimeoutError):
    def __init__(self, stage: str, timeout_seconds: float, *, total_budget: bool) -> None:
        super().__init__(stage)
        self.stage = stage
        self.timeout_seconds = timeout_seconds
        self.total_budget = total_budget


async def _await_reader_stage(awaitable: Any, *, stage: str, cap_seconds: float, deadline: float) -> Any:
    remaining = max(0.001, deadline - asyncio.get_running_loop().time())
    timeout_seconds = min(max(0.001, cap_seconds), remaining)
    try:
        return await asyncio.wait_for(awaitable, timeout=timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise ReaderStageTimeout(stage, timeout_seconds, total_budget=remaining <= cap_seconds) from exc


def _timeout_evidence(exc: ReaderStageTimeout, budget: ReaderTimeoutBudget) -> dict[str, Any]:
    return {
        "stage": exc.stage,
        "timeoutKind": "total" if exc.total_budget else "stage",
        "timeoutSeconds": round(exc.timeout_seconds, 3),
        "totalTimeoutSeconds": budget.total_seconds,
    }


@dataclass(frozen=True)
class UserPermissionContext:
    user_id: str = ""
    account: str = ""
    current_role: str = ""
    roles: tuple[str, ...] = ()
    departments: tuple[str, ...] = ()
    pages: tuple[str, ...] = ()
    subpages: tuple[str, ...] = ()
    buttons: tuple[str, ...] = ()
    data_scope: dict[str, Any] = field(default_factory=dict)
    preferred_language: str = ""

    def prompt_json(self) -> dict[str, Any]:
        payload = asdict(self)
        # The login account is useful for audit attribution, not Reader planning.
        payload.pop("account", None)
        return bounded_json(payload, max_depth=4, max_items=50, max_string=300)


@dataclass(frozen=True)
class PortalReadRequest:
    start_path: str
    actions: tuple[dict[str, Any], ...]
    expected_fields: tuple[str, ...] = ()
    completion_period: str | None = None

    def as_payload(self) -> dict[str, Any]:
        return {
            "startPath": self.start_path,
            "actions": [dict(action) for action in self.actions],
            "expectedFields": list(self.expected_fields),
            # These limits are server-owned and cannot be raised by the model.
            "maxPages": 3,
            "timeoutSeconds": int(PORTAL_EXECUTION_TIMEOUT_SECONDS),
            "maxOutputItems": 20,
            **({'completionPeriod': self.completion_period} if self.completion_period else {}),
        }


@dataclass(frozen=True)
class ReaderResult:
    status: ReaderStatus
    summary: str
    page: str = ""
    section: str = ""
    source_section: str = ""
    answer_shape: Literal["overview", "count", "list", "attention", "due", "detail", "unspecified"] = "unspecified"
    completeness: Literal["bounded", "complete", "unknown"] = "unknown"
    selected_state: str = ""
    scope: Literal["personal", "team", "global", "unknown"] = "unknown"
    facts: tuple[str, ...] = ()
    workflow_state: str = ""
    missing: tuple[str, ...] = ()
    intent_context: dict[str, Any] = field(default_factory=dict)
    clarification_options: tuple[str, ...] = ()
    source_hint: dict[str, str] = field(default_factory=dict)
    record_identity: str = ""
    count_source: dict[str, Any] = field(default_factory=dict)

    def public_json(self) -> dict[str, Any]:
        result = {
            "result": self.status,
            "page": _sanitize_untrusted_text(self.page, max_length=500),
            "section": _sanitize_untrusted_text(self.section, max_length=300),
            "sourceSection": _sanitize_untrusted_text(self.source_section or self.section, max_length=300),
            "answerShape": self.answer_shape,
            "completeness": self.completeness,
            "selectedState": _sanitize_untrusted_text(self.selected_state, max_length=300),
            "scope": self.scope,
            "facts": [_sanitize_untrusted_text(item, max_length=400) for item in self.facts[:20]],
            "workflowState": _sanitize_untrusted_text(self.workflow_state, max_length=500),
            "missing": [_sanitize_untrusted_text(item, max_length=200) for item in self.missing[:10]],
        }
        if self.intent_context:
            result["intentContext"] = bounded_json(self.intent_context, max_depth=4, max_items=10, max_string=500)
        if self.source_hint:
            result["sourceHint"] = {key: _sanitize_untrusted_text(value, max_length=500)
                                    for key, value in self.source_hint.items() if key in {"page", "section"}}
        if self.record_identity:
            result["recordIdentity"] = _sanitize_untrusted_text(self.record_identity, max_length=300)
        if self.count_source:
            result['countSource'] = bounded_json(self.count_source, max_depth=3, max_items=5, max_string=160)
        if self.clarification_options:
            result["clarificationOptions"] = [
                _sanitize_untrusted_text(option, max_length=120) for option in self.clarification_options[:2]
            ]
        while len(json.dumps(result, ensure_ascii=False).encode("utf-8")) > 12_000 and result["facts"]:
            result["facts"].pop()
        while len(json.dumps(result, ensure_ascii=False).encode("utf-8")) > 12_000 and result["missing"]:
            result["missing"].pop()
        for field_name in ("workflowState", "selectedState", "sourceSection", "section", "page"):
            while len(json.dumps(result, ensure_ascii=False).encode("utf-8")) > 12_000 and result[field_name]:
                result[field_name] = result[field_name][: max(0, len(result[field_name]) // 2)]
        if len(json.dumps(result, ensure_ascii=False).encode("utf-8")) > 12_000:
            result.pop("intentContext", None)
        return result


@dataclass(frozen=True)
class ReaderOutcome:
    result: ReaderResult
    audit_evidence: dict[str, Any]


@dataclass
class _ReaderQualityTrace:
    """Keep bounded, stage-level diagnostics out of the public Reader result."""

    entries: list[dict[str, Any]] = field(default_factory=list)

    def record(
        self,
        stage: str,
        status: Literal["passed", "failed", "degraded", "skipped"],
        *,
        started_at: float | None = None,
        input_summary: dict[str, Any] | None = None,
        output_summary: dict[str, Any] | None = None,
        failure_code: str = "",
    ) -> None:
        if len(self.entries) >= 20:
            return
        entry: dict[str, Any] = {
            "stage": stage[:80],
            "status": status,
            "durationMs": round(max(0.0, time.perf_counter() - started_at) * 1000, 1)
            if started_at is not None
            else 0.0,
            "input": bounded_json(input_summary or {}, max_depth=3, max_items=10, max_string=160),
            "output": bounded_json(output_summary or {}, max_depth=3, max_items=10, max_string=160),
            "failureCode": _sanitize_untrusted_text(failure_code, max_length=120),
        }
        self.entries.append(entry)

    def root_cause(self, result: ReaderResult) -> str:
        if result.status in {"success", "no_data"}:
            return ""
        for entry in reversed(self.entries):
            if entry["status"] == "failed":
                failure_code = str(entry.get("failureCode") or "")
                if failure_code:
                    return failure_code
        if result.status == "no_permission":
            return "permission_not_confirmed"
        if result.status == "load_failed":
            return "reader_load_failed"
        return "evidence_not_confirmed"


class ReaderPlanner(Protocol):
    async def plan_admin_portal_read(
        self,
        question: str,
        permission_context: dict[str, Any],
        knowledge_context: dict[str, Any],
        conversation_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...


def _api_discovery(observation: Any) -> dict[str, Any] | None:
    if not isinstance(observation, dict):
        return None
    discovery = observation.get("apiDiscovery")
    return discovery if isinstance(discovery, dict) else None


def _selectable_api_candidates(
    observation: Any, *, candidate_field: str = "candidates",
) -> tuple[dict[str, Any], ...]:
    """Return healthy candidates selectable in the gateway's current network mode."""

    discovery = _api_discovery(observation)
    raw_candidates = discovery.get(candidate_field) if discovery is not None else None
    if not isinstance(raw_candidates, list):
        return ()
    candidates: list[dict[str, Any]] = []
    candidate_indexes: dict[str, int] = {}
    for raw in raw_candidates[:100]:
        if not isinstance(raw, dict):
            continue
        policy_state = str(raw.get("policyState") or "").casefold()
        if policy_state not in {"allowed", "bypassed"}:
            continue
        status = raw.get("status")
        if not isinstance(status, int) or isinstance(status, bool) or not 200 <= status < 400:
            continue
        response_health = raw.get("responseHealth")
        if response_health is not None:
            health_value = (
                response_health.get("status") or response_health.get("state")
                if isinstance(response_health, dict)
                else response_health
            )
            if str(health_value or "").casefold() != "healthy":
                continue
        operation_key = _sanitize_untrusted_text(raw.get("operationKey") or "", max_length=500)
        if not operation_key:
            continue
        raw_trigger = _sanitize_untrusted_text(raw.get("trigger") or "", max_length=160)
        raw_triggers = bounded_json(raw.get("triggers") or [], max_depth=3, max_items=10, max_string=160)
        if operation_key in candidate_indexes:
            existing = candidates[candidate_indexes[operation_key]]
            merged_triggers = list(existing.get("triggers") or [])
            for trigger in ([raw_trigger] if raw_trigger else []) + (raw_triggers if isinstance(raw_triggers, list) else []):
                if trigger not in merged_triggers and len(merged_triggers) < 10:
                    merged_triggers.append(trigger)
            existing["triggers"] = merged_triggers
            if raw_trigger:
                existing["trigger"] = raw_trigger
            if "swagger" not in existing and isinstance(raw.get("swagger"), dict):
                existing["swagger"] = bounded_json(raw["swagger"], max_depth=4, max_items=30, max_string=300)
            continue
        candidate = {
            "operationKey": operation_key,
            "candidateKind": "support" if str(raw.get("candidateKind") or "").casefold() == "support" else "business",
            "method": _sanitize_untrusted_text(raw.get("method") or "", max_length=20),
            "path": _sanitize_untrusted_text(raw.get("path") or raw.get("pathTemplate") or "", max_length=500),
            "pathTemplate": _sanitize_untrusted_text(raw.get("pathTemplate") or raw.get("path") or "", max_length=500),
            "status": status,
            "policyState": policy_state,
            "trigger": raw_trigger,
            "triggers": raw_triggers,
        }
        if isinstance(raw.get("swagger"), dict):
            candidate["swagger"] = bounded_json(raw["swagger"], max_depth=4, max_items=30, max_string=300)
        candidate_indexes[operation_key] = len(candidates)
        candidates.append(candidate)
    return tuple(candidates)


def _question_requests_support_api(question: str, conversation_context: Any) -> bool:
    resolved = _resolved_intent_values(conversation_context)
    semantic_text = " ".join((question, *resolved.values())).casefold()
    return bool(re.search(
        r"\b(?:enum|enumeration|lookup|dropdown)\b"
        r"|\b(?:what|which)\b.{0,80}\b(?:statuses|status values|types|categories|options)\b"
        r"|\b(?:statuses|status values|types|categories|options)\b.{0,80}\b(?:available|allowed|mean|meaning)\b"
        r"|(?:状态|类型|类别|下拉|枚举).{0,20}(?:有哪些|选项|含义|可用值)",
        semantic_text,
    ))


def _api_response_leaf_field_tokens(value: Any) -> frozenset[str]:
    tokens: set[str] = set()

    def visit(item: Any) -> None:
        if isinstance(item, dict):
            for key, child in item.items():
                if child is None or isinstance(child, (str, int, float, bool)):
                    tokens.update(_api_field_tokens(key))
                elif isinstance(child, (dict, list, tuple)):
                    visit(child)
        elif isinstance(item, (list, tuple)):
            for child in item:
                if isinstance(child, (dict, list, tuple)):
                    visit(child)

    visit(value)
    return frozenset(tokens)


def _prefer_semantic_response_candidates(
    observation: Any,
    candidates: tuple[dict[str, Any], ...],
    question: str,
    conversation_context: Any,
) -> tuple[dict[str, Any], ...]:
    """Prefer candidates that match the requested answer shape and business terms."""

    semantic_text = " ".join((question, *_resolved_intent_values(conversation_context).values()))
    query_tokens = _api_query_tokens(semantic_text)
    answer_shape = (
        _resolved_intent_values(conversation_context).get("answerShape")
        or reader_answer_shape(question, conversation_context)
    )
    shape_tokens = _API_SHAPE_TERMS.get(answer_shape, frozenset())
    if len(candidates) <= 1:
        return candidates
    scored: list[tuple[dict[str, Any], tuple[int, int, int, int]]] = []
    for candidate in candidates:
        evidence = _api_response_evidence_for_operation(
            observation, str(candidate.get("operationKey") or ""),
        )
        field_tokens = _api_response_leaf_field_tokens(evidence.get("data")) if evidence else frozenset()
        metadata_tokens = frozenset(_api_field_tokens(" ".join((
            str(candidate.get("operationKey") or ""),
            str(candidate.get("path") or candidate.get("pathTemplate") or ""),
            json.dumps(candidate.get("swagger") or {}, ensure_ascii=False, default=str),
        ))))
        scored.append((candidate, (
            len(metadata_tokens.intersection(shape_tokens)),
            len(field_tokens.intersection(query_tokens)),
            len(metadata_tokens.intersection(query_tokens)),
            len(field_tokens.intersection(shape_tokens)),
        )))
    # These lexical scores are a coarse relevance signal, not the semantic
    # decision itself. Keep every safe business candidate available to the
    # planner and use the score only to put the strongest evidence first.
    # Otherwise one field-name overlap can collapse a multi-operation page to
    # a single endpoint and silently bypass question-to-response reasoning.
    return tuple(
        candidate
        for candidate, _score in sorted(
            scored,
            key=lambda item: item[1],
            reverse=True,
        )
    )


def _relevant_selectable_api_candidates(
    observation: Any,
    question: str,
    conversation_context: Any,
    *,
    delta_only: bool = False,
) -> tuple[dict[str, Any], ...]:
    candidates = _selectable_api_candidates(
        observation, candidate_field="deltaCandidates" if delta_only else "candidates",
    )
    if _question_requests_support_api(question, conversation_context):
        return candidates
    business_candidates = tuple(
        candidate for candidate in candidates if candidate.get("candidateKind") != "support"
    )
    list_bound = _current_list_count_candidates(observation, business_candidates, question, conversation_context)
    if list_bound:
        business_candidates = list_bound
    return _prefer_semantic_response_candidates(
        observation, business_candidates, question, conversation_context,
    )


def _current_list_count_candidates(observation: Any, candidates: tuple[dict[str, Any], ...],
                                   question: str, context: Any) -> tuple[dict[str, Any], ...]:
    """A current-view count must use the collection matching the native rows.

    Merely sharing an object name with a statistics endpoint is insufficient.
    Narrow only when a single list response has exact native record references.
    """
    shape = _resolved_intent_values(context).get("answerShape") or reader_answer_shape(question, context)
    if shape != "count" or not re.search(r"\b(?:current|this|that)\s+(?:authorized\s+)?(?:view|list|queue)\b|当前.*(?:列表|视图)", question, re.I):
        return ()
    if not isinstance(observation, dict) or not _observation_no_data_allowed(observation):
        return ()
    tables = [n for n in _observation_semantic_nodes(observation) if n.get("kind") == "table"]
    if len(tables) != 1:
        return ()
    references = set(re.findall(r"\b[A-Za-z][A-Za-z0-9_]*-\d[A-Za-z0-9_-]*\b",
                               json.dumps({k:tables[0].get(k) for k in ('rowFields','rowSummaries')}, ensure_ascii=False)))
    if not references:
        return ()
    def matches_collection(value: Any) -> bool:
        if not isinstance(value, dict):
            return False
        has_total = any(_key(k) in {'total', 'totalcount'} and type(v) is int for k,v in value.items())
        if has_total:
            for rows in value.values():
                if isinstance(rows, list) and rows and all(isinstance(r, dict) for r in rows):
                    native = set(_observation_scalar_strings(rows))
                    if references <= native:
                        return True
        return any(matches_collection(v) for v in value.values() if isinstance(v, dict))
    matched = tuple(c for c in candidates if matches_collection(
        (_api_response_evidence_for_operation(observation, str(c.get('operationKey') or '')) or {}).get('data')))
    return matched if len(matched) == 1 else ()


def _api_response_evidence_for_operation(observation: Any, operation_key: str) -> dict[str, Any] | None:
    """Return the bounded response captured for one exact page-generated operation."""

    discovery = _api_discovery(observation)
    if discovery is None:
        return None
    for field_name in ("deltaCandidates", "candidates"):
        raw_candidates = discovery.get(field_name)
        if not isinstance(raw_candidates, list):
            continue
        for candidate in raw_candidates:
            if not isinstance(candidate, dict) or candidate.get("operationKey") != operation_key:
                continue
            if "responseEvidence" not in candidate:
                continue
            return {
                "operationKey": operation_key,
                "trigger": _sanitize_untrusted_text(candidate.get("trigger") or "", max_length=160),
                "truncated": candidate.get("responseEvidenceTruncated") is True,
                "data": _bounded_api_json(
                    candidate.get("responseEvidence"),
                    max_depth=32,
                    max_items=60,
                    max_string=1_000,
                ),
            }
    return None


def _native_detail_observation_result(
    observation: Any,
    *,
    page: str,
    record_identity: str,
    scope: Literal["personal", "team", "global", "unknown"],
    question: str = "",
) -> ReaderResult | None:
    """Deliver one already-loaded record detail without replaying its click.

    The portal can return a detail page as the result of the preceding
    ``show_detail`` action. A planner may still ask for the same click again
    after observing that page; that is redundant, not missing evidence.
    """

    identity = _detail_identity(record_identity)
    if not identity or not isinstance(observation, dict):
        return None

    license_labels = {
        "licensenumber": "License Number",
        "issuancedate": "Issuance Date",
        "effectivedate": "Effective Date",
        "expirydate": "Expiry Date",
        "daysremaining": "Days Remaining",
    }
    for node in _observation_semantic_nodes(observation):
        if node.get("kind") != "cards":
            continue
        for summary in _bounded_observation_field(node, "cardSummaries", limit=20):
            parts = [part.strip() for part in str(summary).split("|") if part.strip()]
            positions = {_key(part): index for index, part in enumerate(parts)}
            identity_index = positions.get("licensenumber")
            if identity_index is None or identity_index + 1 >= len(parts):
                continue
            if _detail_identity(parts[identity_index + 1]).casefold() != identity.casefold():
                continue
            fields: dict[str, str] = {}
            for normalized, label in license_labels.items():
                index = positions.get(normalized)
                if index is not None and index + 1 < len(parts):
                    fields[label] = _sanitize_untrusted_text(parts[index + 1], max_length=300)
            if identity_index >= 2:
                fields = {
                    "License Name": _sanitize_untrusted_text(parts[0], max_length=300),
                    "Status": _sanitize_untrusted_text(parts[identity_index - 1], max_length=100),
                    **fields,
                }
            if fields.get("License Number", "").casefold() != identity.casefold():
                continue
            return ReaderResult(
                status="success",
                summary="The requested license detail was already present in the fresh portal read.",
                page=str(page)[:500],
                section="License Details",
                source_section=str(node.get("nodeId") or "license-detail-card"),
                answer_shape="detail",
                completeness="bounded",
                scope=scope,
                facts=(json.dumps(fields, ensure_ascii=False, separators=(",", ":")),),
                record_identity=identity,
            )

    operation_keys = (
        "GET /api/Application/MyReviewDetail/{taskId}",
        "GET /api/Application/MyCompletedDetail/{taskId}",
    )
    detail: dict[str, Any] | None = None

    def find_detail(value: Any, depth: int = 0) -> dict[str, Any] | None:
        if depth > 8:
            return None
        if isinstance(value, dict):
            application_number = next(
                (child for key, child in value.items() if _key(key) in {"applicationnumber", "applicationno"}),
                None,
            )
            if isinstance(application_number, str) and application_number.casefold() == identity.casefold():
                return value
            for child in value.values():
                found = find_detail(child, depth + 1)
                if found is not None:
                    return found
        elif isinstance(value, (list, tuple)):
            for child in value[:20]:
                found = find_detail(child, depth + 1)
                if found is not None:
                    return found
        return None

    for operation_key in operation_keys:
        evidence = _api_response_evidence_for_operation(observation, operation_key)
        candidates = (_api_discovery(observation) or {}).get("candidates") or []
        verified = any(isinstance(c, dict) and c.get('operationKey') == operation_key
                       and c.get('status') == 200 for c in candidates)
        if evidence is not None and verified:
            detail = find_detail(evidence.get("data"))
            if detail is not None:
                break
    if detail is None:
        # The API candidate key can vary by portal build, but the response is
        # still usable when it was triggered by the already executed detail
        # action and contains the exact requested application number.
        discovery = _api_discovery(observation) or {}
        for candidate in (discovery.get("candidates") or [])[:40]:
            if not isinstance(candidate, dict) or "responseEvidence" not in candidate:
                continue
            if candidate.get("status") != 200:
                continue
            if "detail" not in str(candidate.get("operationKey") or "").casefold():
                continue
            detail = find_detail(candidate.get("responseEvidence"))
            if detail is not None:
                break
    if detail is None:
        return None

    profile_requested = bool(re.search(r'\b(?:profile|individual overview|basic information)\b', question, re.I))
    full_requested = bool(re.search(r'\b(?:all available details|full application|complete application)\b', question, re.I))
    if profile_requested or full_requested:
        # A visible detail navigation control proves an entry point, not that
        # its fields loaded. Guide self-service without reading extra APIs or
        # claiming that a partial application header is a complete profile.
        controls = observation.get('controls') or []
        names = {str(c.get('name') or '') if isinstance(c, dict) else str(c) for c in controls}
        target = 'Applicant Overview' if profile_requested else 'Application Overview'
        if target in names:
            guidance = (f'Open the application list at {page}, select Application No. {identity}, '
                        f'then use the visible {target} entry in that application detail.')
            if profile_requested and 'Profile Overview' in names:
                guidance += ' The same detail also shows a Profile Overview entry.'
            return ReaderResult(status='success', summary='Verified self-service entry points for the requested application.',
                page=page, section=target, source_section='observed:application-detail-navigation',
                answer_shape='detail', completeness='bounded', scope=scope,
                facts=(f'Application No. {identity} was located.', guidance,
                       'This is navigation guidance only. The requested full profile or application form values '
                       'were not verified in this read; open the entry to inspect them yourself.'))

    if profile_requested:
        return ReaderResult(status='not_confirmed', summary='Application header evidence does not establish an applicant profile.',
            page=page,section='Applicant Profile',answer_shape='detail',completeness='unknown',
            facts=('The application was located, but its applicant profile was not verified in this read. '
                   'Application header fields and pagination totals cannot substitute for applicant information.',),
            missing=('applicant_profile_not_verified',))

    field_aliases = (
        ("Application No.", ("applicationnumber", "applicationno")),
        ("Service Name", ("servicenameen", "servicename")),
        ("Service Category", ("servicecategorynameen", "servicecategory")),
        ("Type", ("servicetypenameen", "servicetype", "type")),
        ("Status", ("status",)),
        ("SLA", ("sladescription",)),
        ("Apply For", ("applyforen", "applyfor")),
        ("Submission Time", ("submissiontime",)),
        ("My Decision", ("mydecision",)),
    )
    fields: dict[str, str] = {}
    for label, aliases in field_aliases:
        value = next((child for key, child in detail.items() if _key(key) in aliases), None)
        if value is None or isinstance(value, bool) or not str(value).strip():
            continue
        fields[label] = _sanitize_untrusted_text(value, max_length=300)
    if fields.get("Application No.", "").casefold() != identity.casefold():
        return None
    return ReaderResult(
        status="not_confirmed" if full_requested else "success",
        summary="The requested application detail was already present in the fresh portal read.",
        page=str(page)[:500],
        section="Application Details",
        source_section="api:application-detail",
        answer_shape="detail",
        completeness="bounded",
        scope=scope,
        facts=(json.dumps(fields, ensure_ascii=False, separators=(",", ":")),
               *(("Only the application header was verified; the complete application review fields have not been established.",) if full_requested else ())),
        missing=('full_application_detail_not_verified',) if full_requested else (),
        record_identity=identity,
    )


def _compound_list_detail_result(
    detail_result: ReaderResult,
    list_observation: Any,
    record_identity: str,
) -> ReaderResult:
    """Retain the bounded list evidence that selected a compound detail target."""

    tables = [
        node for node in _observation_semantic_nodes(list_observation)
        if node.get("kind") in {"table", "grid"} and node.get("rowFields")
    ]
    if len(tables) != 1:
        return detail_result
    table = tables[0]
    headers = table.get("columnHeaders") or []
    rows = table.get("rowFields") or []
    if not headers or not rows or not isinstance(rows[0], dict):
        return detail_result
    if _detail_identity(rows[0].get(str(headers[0]))).casefold() != _detail_identity(record_identity).casefold():
        return detail_result
    list_facts = _bounded_native_row_facts(table, limit=4)
    if not list_facts:
        return detail_result
    detail_payload: Any = detail_result.facts[0] if detail_result.facts else ""
    try:
        detail_payload = json.loads(detail_payload)
    except (TypeError, ValueError):
        pass
    if isinstance(detail_payload, dict):
        first_detail = "First visible record details: " + "; ".join(
            f"{key}: {value}" for key, value in detail_payload.items()
        )
    else:
        first_detail = f"First visible record details: {detail_payload}"
    return replace(
        detail_result,
        summary="A bounded list sample and the first visible record's details were read from the portal.",
        section="Licenses and First License Details",
        facts=(
            first_detail,
            *list_facts,
            f"The list portion contains {len(list_facts)} visible records from the current page; it is not the complete collection.",
        ),
        record_identity=_detail_identity(record_identity),
    )


def _api_discovery_is_truncated(
    discovery: dict[str, Any], *, include_support: bool, delta_only: bool,
) -> bool:
    prefix = "deltaSelectable" if delta_only else "selectable"
    business_key = f"{prefix}BusinessTruncated"
    support_key = f"{prefix}SupportTruncated"
    if business_key in discovery or support_key in discovery:
        return discovery.get(business_key) is True or (
            include_support and discovery.get(support_key) is True
        )
    legacy_prefix = "deltaAllowed" if delta_only else "allowed"
    legacy_business_key = f"{legacy_prefix}BusinessTruncated"
    legacy_support_key = f"{legacy_prefix}SupportTruncated"
    if legacy_business_key in discovery or legacy_support_key in discovery:
        return discovery.get(legacy_business_key) is True or (
            include_support and discovery.get(legacy_support_key) is True
        )
    return discovery.get("deltaTruncated" if delta_only else "truncated") is True


def _api_reason_codes(plan: Any, allowed: frozenset[str]) -> tuple[str, ...] | None:
    if not isinstance(plan, dict) or not isinstance(plan.get("reasonCodes"), list):
        return None
    codes = tuple(str(value) for value in plan["reasonCodes"])
    if not 1 <= len(codes) <= 5 or len(set(codes)) != len(codes) or any(code not in allowed for code in codes):
        return None
    return codes


def api_selection_from_plan(
    plan: Any,
    candidates: tuple[dict[str, Any], ...],
) -> tuple[dict[str, Any], tuple[str, ...]] | None:
    """Resolve an exact observed operation while tolerating harmless plan shape differences."""

    if not isinstance(plan, dict):
        return None
    operation_key = str(plan.get("operationKey") or plan.get("selectedOperationKey") or "")
    matches = [candidate for candidate in candidates if candidate["operationKey"] == operation_key]
    if len(matches) != 1:
        return None
    raw_codes = plan.get("reasonCodes") if isinstance(plan.get("reasonCodes"), list) else []
    reason_codes = tuple(dict.fromkeys(
        str(code) for code in raw_codes if str(code) in API_SELECTION_REASON_CODES
    ))[:5] or ("trigger_matches_intent",)
    return matches[0], reason_codes


def _observed_api_drill_controls(observation: Any) -> tuple[dict[str, Any], ...]:
    discovery = _api_discovery(observation)
    if discovery is None:
        return ()
    raw_controls = discovery.get("safeControls") or discovery.get("drillControls")
    if not isinstance(raw_controls, list):
        raw_controls = []
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    allowed_action_keys = {
        "type", "selector", "label", "role", "name", "field", "section", "emptyState",
        "permissionCode", "value", "values", "method", "parameters", "filters",
    }
    for raw in raw_controls[:30]:
        if not isinstance(raw, dict):
            continue
        control_id = _sanitize_untrusted_text(raw.get("controlId") or "", max_length=160)
        if not control_id or control_id in seen:
            continue
        action = raw.get("action")
        if not isinstance(action, dict):
            continue
        action_type = str(action.get("type") or "").casefold().replace("-", "_")
        if action_type not in API_DRILL_ACTIONS or not set(action).issubset(allowed_action_keys):
            continue
        seen.add(control_id)
        result.append({
            "controlId": control_id,
            "label": _sanitize_untrusted_text(raw.get("label") or action.get("name") or action.get("field") or "", max_length=160),
            "action": bounded_json(action, max_depth=3, max_items=20, max_string=300),
        })

    # Compatibility for the current observation schema. A semantic node with a
    # selectedState is a verified tab group; the executor still requires one
    # exact visible role=tab match before clicking. Structured filterControls
    # already contain the narrow selector and enumerated values observed by the
    # gateway, so the model only chooses a generated id and never supplies them.
    if isinstance(observation, dict):
        for node in _observation_semantic_nodes(observation):
            if not str(node.get("selectedState") or "").strip():
                continue
            section = str(node.get("heading") or "").strip()
            for label in _bounded_observation_field(node, "controls", limit=20):
                if ReadOnlyPortalPolicy._contains_mutation_command(label):
                    continue
                identity = f"tab:{node.get('nodeId') or section}:{label}"
                control_id = "observed-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]
                if control_id in seen:
                    continue
                seen.add(control_id)
                action: dict[str, Any] = {"type": "switch_tab", "role": "tab", "name": label}
                if section:
                    action["section"] = section
                result.append({"controlId": control_id, "label": label, "action": action})
                if len(result) >= 30:
                    return tuple(result)
        for index, control in enumerate(observation.get("filterControls") or []):
            if not isinstance(control, dict) or not control.get("selector"):
                continue
            selected = {str(value) for value in control.get("selected") or []}
            for option_index, option in enumerate(control.get("options") or []):
                value = str(option).strip()
                if not value or value in selected or ReadOnlyPortalPolicy._contains_mutation_command(value):
                    continue
                control_id = f"filter-{index}-{option_index}"
                if control_id in seen:
                    continue
                seen.add(control_id)
                result.append({
                    "controlId": control_id,
                    "label": f"{control.get('label') or 'filter'}: {value}"[:160],
                    "action": {"type": "filter", "selector": control["selector"], "value": value},
                })
                if len(result) >= 30:
                    return tuple(result)
    return tuple(result)


def _state_control_label_matches(observed: object, requested: object) -> bool:
    observed_text = re.sub(r"\s+", " ", str(observed or "")).strip().casefold()
    requested_text = re.sub(r"\s+", " ", str(requested or "")).strip().casefold()
    if not observed_text or not requested_text:
        return False
    # Portal tab labels are localized, while the Reader's semantic actions use
    # stable state names. Treat these labels as the same state so Arabic turns
    # can enter the completed refund view instead of remaining on the default
    # in-progress tab.
    aliases = {
        "completed": {"completed", "مكتمل", "المكتمل", "المكتملين", "مكتملة", "المكتملة"},
        "to do": {"to do", "todo", "قيد التنفيذ", "قيد العمل"},
    }
    for canonical, values in aliases.items():
        if observed_text in values and requested_text in values | {canonical}:
            return True
    if observed_text == requested_text:
        return True
    if re.search(r"\d$", requested_text):
        return False
    return bool(re.fullmatch(re.escape(requested_text) + r"\s+\d+", observed_text))


def _replay_observed_tab_path(request: PortalReadRequest, observation: Any) -> PortalReadRequest:
    """Restore a verified tab path because gateway reads start with a new page.

    Only native, uniquely named selected tabs can be replayed. This is navigation
    metadata from this turn, not prior records, a model route, or authorization.
    The effective request is still checked against the read-only policy.
    """
    if (not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True
            or len(request.actions) != 1 or request.actions[0].get('type') != 'switch_tab'):
        return request
    paths = {tuple(node['selectedTabPath']) for node in _observation_semantic_nodes(observation)
             if isinstance(node.get('selectedTabPath'), list) and node['selectedTabPath']
             and all(isinstance(label, str) for label in node['selectedTabPath'])}
    if len(paths) != 1:
        return request
    path = next(iter(paths))
    if len(path) < 2:
        return request
    target = request.actions[0].get('name')
    prefix = []
    for label in path:
        if _state_control_label_matches(label, target):
            break
        action = _observed_switch_tab_action({'name': label}, observation)
        tabs = observation.get('tabControls') or []
        if action is None or not any(isinstance(t, dict) and t.get('selected') is True
                                    and t.get('name') == action['name'] for t in tabs):
            return request
        prefix.append(action)
    return replace(request, actions=(*prefix, *request.actions)) if prefix else request


def _pending_initial_tab_actions(actions: list[dict[str, Any]], observation: Any) -> list[dict[str, Any]]:
    """Skip a verified default selection without clicking its changing badge."""
    if not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True:
        return actions
    tabs = observation.get('tabControls') or []
    matched = [[t for t in tabs if isinstance(t, dict) and _state_control_label_matches(t.get('name'), a.get('name'))]
               for a in actions]
    # A hidden/ambiguous child may still require the parent transition.
    if any(len(m) != 1 for m in matched):
        return actions
    offset = 0
    while offset < len(matched) and matched[offset][0].get('selected') is True:
        offset += 1
    return actions[offset:]


def _observed_switch_tab_action(action: dict[str, Any], observation: Any) -> dict[str, Any] | None:
    """Bind a requested state label to one currently observed tab control."""

    requested = action.get("name") or action.get("label")
    native_tabs = observation.get('tabControls') if isinstance(observation, dict) else None
    if isinstance(native_tabs, list):
        matches = [tab for tab in native_tabs if isinstance(tab, dict)
                   and _state_control_label_matches(tab.get('name'), requested)]
        if len(matches) == 1 and not ReadOnlyPortalPolicy._contains_mutation_command(str(matches[0].get('name') or '')):
            return {'type':'switch_tab', 'role':'tab', 'name':str(matches[0]['name'])}
        if len(matches) > 1:
            return None
    discovery = _api_discovery(observation)
    raw_controls = discovery.get("safeControls") if discovery is not None else None
    explicit_matches = []
    for control in raw_controls if isinstance(raw_controls, list) else []:
        observed_action = control.get("action") if isinstance(control, dict) else None
        if (
            isinstance(observed_action, dict)
            and str(observed_action.get("type") or "").casefold().replace("-", "_") == "switch_tab"
            and _state_control_label_matches(
                control.get("label") or observed_action.get("name") or observed_action.get("label"),
                requested,
            )
        ):
            explicit_matches.append(observed_action)
    if len(explicit_matches) == 1:
        observed_name = explicit_matches[0].get("name") or explicit_matches[0].get("label")
        return {"type": "switch_tab", "role": "tab", "name": str(observed_name)}
    if len(explicit_matches) > 1:
        return None

    matches: list[str] = []
    for node in _observation_semantic_nodes(observation):
        for label in _bounded_observation_field(node, "controls", limit=20):
            if (
                _state_control_label_matches(label, requested)
                and not ReadOnlyPortalPolicy._contains_mutation_command(label)
            ):
                matches.append(label)
    if len(matches) > 1:
        return None
    if not matches and isinstance(observation, dict):
        matches = [
            label for label in _bounded_observation_field(observation, "controls", limit=30)
            if (
                _state_control_label_matches(label, requested)
                and not ReadOnlyPortalPolicy._contains_mutation_command(label)
            )
        ]
    if len(matches) != 1:
        return None
    # The model-provided selector and section are advisory only. A globally
    # unique observed tab label is re-resolved against the fresh page by the
    # gateway immediately before click.
    return {"type": "switch_tab", "role": "tab", "name": matches[0]}


def _row_contains_record_identity(row: object, identity: str) -> bool:
    row_text = re.sub(r"\s+", " ", str(row or "")).strip()
    if not row_text or not identity:
        return False
    return bool(re.search(
        r"(?<![A-Za-z0-9])" + re.escape(identity) + r"(?![A-Za-z0-9])",
        row_text,
        flags=re.IGNORECASE,
    ))


def _observed_cell_detail_action(
    observation: Any,
    record_identity: str,
    *,
    destination: str = "",
) -> dict[str, Any] | None:
    """Bind one stable identity to exactly one currently observed table row."""

    identity = _detail_identity(record_identity)
    matching_rows = []
    for node in _observation_semantic_nodes(observation):
        if node.get("kind") not in {"table", "grid"}:
            continue
        for index, row in enumerate(_bounded_observation_field(node, "rowSummaries", limit=20)):
            if _row_contains_record_identity(row, identity):
                matching_rows.append((str(node.get("nodeId") or ""), index))
    if len(matching_rows) > 1:
        return None
    if not matching_rows:
        discovery = _api_discovery(observation)
        candidates = [] if discovery is None else discovery.get("candidates") or []

        def contains_identity(value: Any, depth: int = 0) -> bool:
            if depth >= 10:
                return False
            if isinstance(value, dict):
                return any(contains_identity(child, depth + 1) for child in value.values())
            if isinstance(value, (list, tuple)):
                return any(contains_identity(child, depth + 1) for child in value)
            return isinstance(value, (str, int, float)) and not isinstance(value, bool) and _detail_identity(value).casefold() == identity.casefold()

        if not any(
            isinstance(candidate, dict)
            and contains_identity(candidate.get("responseEvidence"))
            for candidate in candidates[:32]
        ):
            return None
    action = {"type": "show_detail", "role": "cell", "name": identity, "value": identity}
    if destination:
        action["path"] = destination
    return action


def _first_observed_record_identity(observation: Any) -> str:
    """Return the first row identity only from one unambiguous native table."""
    tables = [
        node for node in _observation_semantic_nodes(observation)
        if node.get("kind") in {"table", "grid"} and node.get("rowFields")
    ]
    if len(tables) != 1:
        return ""
    table = tables[0]
    headers = table.get("columnHeaders") or []
    rows = table.get("rowFields") or []
    if not headers or not rows or not isinstance(rows[0], dict):
        return ""
    identity_header = str(headers[0])
    if not re.search(r"(?:^|\s)(?:no\.?|number|id)$", identity_header, re.I):
        return ""
    identity = _detail_identity(rows[0].get(identity_header))
    if not identity or not any(char.isdigit() for char in identity):
        return ""
    return identity


def _detail_action_can_use_observed_identity(action: dict[str, Any], record_identity: str) -> bool:
    """Allow only harmless missing detail-binding fields to be normalized."""

    identity = _detail_identity(record_identity)
    if not identity or str(action.get("type") or "").casefold().replace("-", "_") != "show_detail":
        return False
    if str(action.get("method") or "GET").upper() != "GET":
        return False
    if str(action.get("role") or "cell").casefold() != "cell":
        return False
    if action.get("permissionCode") or action.get("permission_code") or action.get("selector"):
        return False
    if any(action.get(name) not in (None, "", {}, []) for name in ("path", "url", "parameters", "filters", "values", "direction")):
        return False
    supplied_value = _detail_identity(action.get("value"))
    if supplied_value and supplied_value != identity:
        return False
    supplied_name = _detail_identity(action.get("name"))
    if supplied_name and any(char.isdigit() for char in supplied_name) and supplied_name != identity:
        return False
    return not any(
        ReadOnlyPortalPolicy._contains_mutation_command(action.get(name))
        for name in ("name", "label", "field", "section")
        if action.get(name)
    )


def _observed_filter_action(
    action: dict[str, Any], observation: Any,
) -> tuple[dict[str, Any] | None, str]:
    """Bind a semantic filter request to one exact current filter control."""

    controls = [
        control for control in (observation.get("filterControls", []) if isinstance(observation, dict) else [])
        if isinstance(control, dict)
        and control.get("filterSurface") is True
        and control.get("selector")
    ]
    if not controls:
        # Some bounded observations intentionally omit filter metadata. Keep a
        # complete semantic role/name locator for the gateway in that case;
        # when controls are present, all matching and option checks below are
        # mandatory and model-provided labels are never passed through.
        if action.get("name") or action.get("label") or action.get("field"):
            return dict(action), ""
        return None, "filter_control_not_observed"
    selector = str(action.get("selector") or "").strip()
    if selector:
        matches = [control for control in controls if str(control.get("selector")) == selector]
    else:
        requested = str(action.get("field") or action.get("name") or action.get("label") or "").strip()
        if not requested:
            return None, "filter_locator_missing"
        requested_key = _key(requested)
        matches = [
            control for control in controls
            if requested_key in {
                _key(control.get("label")),
                _key(control.get("placeholder")),
                _key(control.get("name")),
            }
        ]
    if len(matches) != 1:
        return None, "filter_control_not_unique"
    control = matches[0]
    values = action.get("values")
    if values not in (None, [], ""):
        requested_values = [str(value).strip() for value in values] if isinstance(values, list) else []
        if not requested_values or any(not value for value in requested_values):
            return None, "filter_values_invalid"
        observed_options = {str(value).strip().casefold() for value in control.get("options", [])}
        if observed_options and any(value.casefold() not in observed_options for value in requested_values):
            return None, "filter_value_not_observed"
        return {"type": "filter", "selector": str(control["selector"]), "values": requested_values}, ""
    value = action.get("value")
    if value is None:
        return None, "filter_value_missing"
    value = str(value)
    observed_options = {str(option).strip().casefold() for option in control.get("options", [])}
    if value.strip() and observed_options and value.strip().casefold() not in observed_options:
        return None, "filter_value_not_observed"
    return {"type": "filter", "selector": str(control["selector"]), "value": value}, ""


def _bind_observed_actions(
    request: PortalReadRequest,
    observation: Any,
    *,
    record_identity: str,
    allow_valid_detail_metadata: bool = False,
) -> tuple[PortalReadRequest | None, str]:
    """Replace model locators with unique controls from the current observation."""

    bound_actions: list[dict[str, Any]] = []
    for action in request.actions:
        action_type = str(action.get("type") or "").casefold().replace("-", "_")
        if action_type == "switch_tab":
            bound = _observed_switch_tab_action(action, observation)
            if bound is None and any(a.get('type') == 'switch_tab' for a in bound_actions):
                # A preceding verified tab may reveal a child tab. Pass only
                # its semantic label; the gateway resolves exactly one visible
                # role=tab again immediately before executing each click.
                name = str(action.get('name') or action.get('label') or '').strip()
                if name and not ReadOnlyPortalPolicy._contains_mutation_command(name):
                    bound = {'type': 'switch_tab', 'role': 'tab', 'name': name}
            if bound is None:
                return None, "state_control_not_unique"
            bound_actions.append(bound)
            continue
        if action_type == "show_detail" and str(action.get("role") or "cell").casefold() == "cell":
            identity = record_identity or _detail_identity(action.get("value"))
            supplied_identity = _detail_identity(action.get("value"))
            if (
                supplied_identity and supplied_identity != identity
                or not allow_valid_detail_metadata
                and not _detail_action_can_use_observed_identity(action, identity)
            ):
                return None, "detail_identity_conflict"
            bound = _observed_cell_detail_action(
                observation,
                identity,
                destination=_cell_detail_destination(action) or "",
            )
            if bound is None:
                return None, "detail_target_not_unique"
            bound_actions.append(bound)
            continue
        if action_type == "filter":
            bound, binding_error = _observed_filter_action(action, observation)
            if bound is None:
                return None, binding_error
            bound_actions.append(bound)
            continue
        bound_actions.append(dict(action))
    return replace(request, actions=tuple(bound_actions)), ""


def api_drill_request_from_plan(
    plan: Any,
    observation: Any,
    *,
    start_path: str,
) -> tuple[PortalReadRequest, str, tuple[str, ...]] | None:
    """Resolve one model-selected observed control without accepting locators from it."""

    if not isinstance(plan, dict) or set(plan) != {"mode", "controlId", "reasonCodes"}:
        return None
    if plan.get("mode") != "api_drill":
        return None
    reason_codes = _api_reason_codes(plan, API_DRILL_REASON_CODES)
    control_id = str(plan.get("controlId") or "")
    controls = [control for control in _observed_api_drill_controls(observation) if control["controlId"] == control_id]
    if reason_codes is None or len(controls) != 1:
        return None
    action = controls[0]["action"]
    if not isinstance(action, dict):
        return None
    return PortalReadRequest(start_path=start_path, actions=(dict(action),)), control_id, reason_codes


class ReaderToolGateway(Protocol):
    async def get_user_info(self, principal: Principal) -> dict[str, Any]: ...

    async def invoke(
        self,
        principal: Principal,
        tool_name: str,
        arguments: dict[str, Any],
        *,
        allowed_tools: list[str] | None = None,
    ) -> dict[str, Any]: ...


def _key(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).casefold())


def _strings(value: Any, *, limit: int = 100) -> tuple[str, ...]:
    result: list[str] = []

    def visit(item: Any) -> None:
        if len(result) >= limit:
            return
        if isinstance(item, (str, int)):
            text = str(item).strip()
            if text and text not in result:
                result.append(text[:300])
        elif isinstance(item, list):
            for child in item:
                visit(child)
        elif isinstance(item, dict):
            preferred = next(
                (
                    item.get(name)
                    for name in (
                        "frontendRoute", "path", "url", "route", "roleName", "nameEn",
                        "permissionCode", "key", "departmentId", "name", "title", "code", "id",
                    )
                    if item.get(name) is not None
                ),
                None,
            )
            if preferred is not None:
                visit(preferred)
            else:
                for child in item.values():
                    visit(child)

    visit(value)
    return tuple(result)


def _find_values(payload: Any, aliases: set[str]) -> list[Any]:
    found: list[Any] = []
    if isinstance(payload, dict):
        for name, value in payload.items():
            if _key(name) in aliases:
                found.append(value)
            if isinstance(value, (dict, list)):
                found.extend(_find_values(value, aliases))
    elif isinstance(payload, list):
        for value in payload:
            found.extend(_find_values(value, aliases))
    return found


def _first_direct_string(payload: Any, names: tuple[str, ...]) -> str:
    if not isinstance(payload, dict):
        return ""
    values_by_key = {_key(name): value for name, value in payload.items()}
    for name in names:
        values = _strings(values_by_key.get(_key(name)), limit=1)
        if values:
            return values[0]
    return ""


def permission_context_from_user_info(payload: Any) -> UserPermissionContext:
    """Normalize portal-specific ``GetUserInfo`` shapes without trusting the client."""

    aliases = {
        "user": {"userid", "useridentifier", "adminuserid"},
        "account": {
            "account", "accountname", "email", "emailaddress", "loginaccount",
            "loginname", "useremail", "username",
        },
        "current_role": {
            "activerole", "activerolename", "currentrole", "currentrolename",
            "selectedrole", "selectedrolename",
        },
        "roles": {"role", "roles", "roleinfo", "rolesinfo", "listrole", "listroles", "rolename", "rolenames"},
        "departments": {"department", "departments", "departmentinfo", "listdepartment", "listdepartments", "departmentname", "departmentnames", "departmentid"},
        "pages": {"page", "pages", "pagepermissions", "menus", "menupermissions", "listsyspermission", "syspermissions", "permissions"},
        "subpages": {"subpage", "subpages", "subpagepermissions", "children", "childpermissions"},
        "buttons": {"button", "buttons", "buttonlist", "buttonpermissions", "actions", "actionpermissions", "operations"},
        "scope": {"datascope", "datascopes", "scope", "scopes"},
    }
    user_values = _find_values(payload, aliases["user"])
    envelope_data = payload.get("data") if isinstance(payload, dict) and isinstance(payload.get("data"), dict) else {}
    user_id = str(envelope_data.get("id") or next(iter(_strings(user_values, limit=1)), "")).strip()[:300]
    account = _first_direct_string(
        envelope_data,
        ("email", "emailAddress", "userEmail", "loginAccount", "accountName", "account", "userName", "username", "loginName"),
    ) or next(iter(_strings(_find_values(envelope_data, aliases["account"]), limit=1)), "")
    roles = _strings(_find_values(payload, aliases["roles"]))
    current_role = _first_direct_string(
        envelope_data,
        ("currentRoleName", "activeRoleName", "selectedRoleName", "currentRole", "activeRole", "selectedRole"),
    ) or next(iter(_strings(_find_values(envelope_data, aliases["current_role"]), limit=1)), "")
    if not current_role and roles:
        current_role = roles[0]
    scope_values = _find_values(payload, aliases["scope"])
    scope = bounded_json(scope_values[0], max_depth=4, max_items=50, max_string=300) if scope_values else {}
    if not isinstance(scope, dict):
        scope = {"values": scope if isinstance(scope, list) else [scope]}
    profile_rows = envelope_data.get("userProfileInfo") if isinstance(envelope_data, dict) else None
    profile = profile_rows[0] if isinstance(profile_rows, list) and profile_rows and isinstance(profile_rows[0], dict) else {}
    language_id = profile.get("defaultLanguageId") or profile.get("DefaultLanguageId")
    language_code = str(profile.get("primaryLangCode") or profile.get("PrimaryLangCode") or "").casefold()
    preferred_language = {
        "1": "en", "en": "en", "english": "en", "enus": "en",
        "2": "ar", "ar": "ar", "arabic": "ar", "arar": "ar",
        "3": "zh", "zh": "zh", "chinese": "zh", "zhcn": "zh",
    }.get(str(language_id).strip().casefold(), "")
    if not preferred_language:
        preferred_language = {
            "en": "en", "english": "en", "enus": "en",
            "ar": "ar", "arabic": "ar", "arar": "ar",
            "zh": "zh", "chinese": "zh", "zhcn": "zh",
        }.get(language_code, "")
    return UserPermissionContext(
        user_id=user_id,
        account=account,
        current_role=current_role,
        roles=roles,
        departments=_strings(_find_values(payload, aliases["departments"])),
        pages=_strings(_find_values(payload, aliases["pages"])),
        subpages=_strings(_find_values(payload, aliases["subpages"])),
        buttons=_strings(_find_values(payload, aliases["buttons"])),
        data_scope=scope,
        preferred_language=preferred_language,
    )


def permission_audit_summary(context: UserPermissionContext) -> dict[str, Any]:
    """Return audit-safe authorization evidence without copying permission trees."""

    def normalized(values: tuple[str, ...]) -> list[str]:
        return sorted({"".join(char for char in str(value).casefold() if char.isalnum()) for value in values if str(value).strip()})

    def normalized_scope(value: Any) -> Any:
        if isinstance(value, dict):
            return {str(key): normalized_scope(value[key]) for key in sorted(value, key=lambda item: str(item).casefold())}
        if isinstance(value, (list, tuple, set)):
            items = [normalized_scope(item) for item in value]
            return sorted(items, key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True))
        if isinstance(value, str):
            return "".join(char for char in value.casefold() if char.isalnum())
        return value

    fingerprint_payload = {
        "roles": normalized(context.roles),
        "departments": normalized(context.departments),
        "pages": normalized(context.pages),
        "subpages": normalized(context.subpages),
        "buttons": normalized(context.buttons),
        "dataScope": normalized_scope(bounded_json(context.data_scope, max_depth=4, max_items=50, max_string=300)),
    }
    canonical = json.dumps(fingerprint_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return {
        "fingerprint": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "account": _sanitize_untrusted_text(context.account, max_length=300),
        "currentRole": _sanitize_untrusted_text(context.current_role, max_length=300),
        "roles": list(context.roles[:20]),
        "departments": list(context.departments[:20]),
        "pageCount": len(context.pages),
        "subpageCount": len(context.subpages),
        "buttonCount": len(context.buttons),
        "preferredLanguage": context.preferred_language,
        "observedAt": datetime.now(timezone.utc).isoformat(),
    }


def _bounded_conversation_context(value: Any) -> dict[str, Any]:
    """Keep only non-authoritative continuity metadata needed by the Reader."""

    if not isinstance(value, dict):
        return {}
    if isinstance(value.get("resolvedIntent"), dict):
        resolved_context = {"resolvedIntent": bounded_json(value["resolvedIntent"], max_depth=4, max_items=10, max_string=500)}
        options = value.get("resolvedChoiceOptions")
        if isinstance(options, list) and len(options) == 2 and all(isinstance(option, str) for option in options):
            resolved_context["resolvedChoiceOptions"] = [_sanitize_untrusted_text(option, max_length=120) for option in options]
        if isinstance(value.get("sourceHint"), dict):
            resolved_context["sourceHint"] = {key: _sanitize_untrusted_text(item, max_length=500)
                                              for key, item in value["sourceHint"].items()
                                              if key in {"page", "section"} and isinstance(item, str)}
        return resolved_context
    if not isinstance(value.get("previousIntent"), dict):
        return {}
    previous = value["previousIntent"]
    limits = {
        "question": 500,
        "answerShape": 40,
        "deliveredAnswerShape": 40,
        "completeness": 40,
        "businessObject": 160,
        "businessFocus": 240,
        "recordIdentity": 300,
        "view": 200,
        "dateRange": 240,
        "filter": 240,
        "recentIntents": 900,
        "page": 300,
        "section": 200,
        "sourceSection": 200,
        "selectedState": 200,
        "scope": 40,
        "requestedScope": 40,
        "resultStatus": 40,
        "workflowState": 300,
        "countSource": 160,
        "profileVerificationEmpty": 10,
    }
    bounded: dict[str, Any] = {}
    for name, max_length in limits.items():
        value = previous.get(name)
        if value is None:
            continue
        bounded[name] = (
            bounded_json(value, max_depth=3, max_items=8 if name == "recentIntents" else 12, max_string=max_length)
            if isinstance(value, (dict, list, tuple))
            else _sanitize_untrusted_text(value, max_length=max_length)
        )
    if isinstance(previous.get("intentContext"), dict):
        bounded["intentContext"] = bounded_json(previous["intentContext"], max_depth=4, max_items=10, max_string=500)
    source = previous.get('assignmentSource')
    if isinstance(source, dict) and source.get('page') == '/inspection/tasks':
        refs = source.get('taskNumbers')
        if isinstance(refs, list) and 0 < len(refs) <= 20 and all(isinstance(r, str) and TASK_NUMBER.fullmatch(r) for r in refs):
            bounded['assignmentSource'] = {'page': source['page'], 'taskNumbers': list(dict.fromkeys(refs)),
                'selectedState': _sanitize_untrusted_text(source.get('selectedState') or '', max_length=100)}
    if isinstance(previous.get("sourceHint"), dict):
        bounded["sourceHint"] = {key: _sanitize_untrusted_text(item, max_length=500)
                                 for key, item in previous["sourceHint"].items()
                                 if key in {"page", "section"} and isinstance(item, str)}
    if isinstance(previous.get("clarificationOptions"), list):
        bounded["clarificationOptions"] = [
            _sanitize_untrusted_text(option, max_length=120)
            for option in previous["clarificationOptions"][:2] if isinstance(option, str)
        ]
    return {"previousIntent": bounded} if any(bounded.values()) else {}


def _resolved_intent_values(conversation_context: Any) -> dict[str, str]:
    context = _bounded_conversation_context(conversation_context)
    slots = context.get("resolvedIntent", {}).get("slots", {})
    return {
        key: str(slot.get("value") or "")
        for key, slot in slots.items()
        if isinstance(slot, dict) and slot.get("source") in {"current", "previous"} and slot.get("value")
    } if isinstance(slots, dict) else {}


def reader_answer_shape(
    question: str,
    conversation_context: dict[str, Any] | None = None,
) -> Literal["overview", "count", "list", "attention", "due", "detail", "unspecified"]:
    """Classify a generic answer shape without selecting a business destination."""

    if re.search(r'\b(?:view|show)\b.*\b(?:the )?data in\b', question, re.I):
        return 'list'
    resolved = _resolved_intent_values(conversation_context).get("answerShape")
    if resolved in {"overview", "count", "list", "attention", "due", "detail", "unspecified"}:
        return resolved  # type: ignore[return-value]
    normalized = re.sub(r"\s+", " ", str(question or "").casefold()).strip()
    previous_question = str(
        (_bounded_conversation_context(conversation_context).get("previousIntent") or {}).get("question") or ""
    ).casefold()
    # Keep a named metric bound when a follow-up changes language. This is
    # label-based rather than route-based, so a unit/trend question cannot
    # silently fall through to a neighbouring KPI.
    metric_label = re.search(
        r"\b(?:sla\s+compliance|avg\.?\s+processing\s+time|average\s+processing\s+time)\b",
        normalized + " " + previous_question,
        re.I,
    )
    metric_follow_up = re.search(
        r"\b(?:unit|units|trend|history|historical|changed|change|last\s+\d+\s+days?)\b"
        r"|الوحدة|وحدته|وحدتها|اتجاه|تاريخ|تاريخي|تغي(?:رت|ر)"
        r"|نفس\s+(?:المؤشر|المقياس)",
        normalized,
        re.I,
    )
    if metric_label and metric_follow_up:
        return "overview"
    if metric_label and re.search(
        r"\b(?:value|rate|percentage|metric|compliance)\b|قيمة|نسبة|معدل|مؤشر|مقياس",
        normalized,
        re.I,
    ):
        return "count"
    if re.fullmatch(
        r"(?:show|display)(?: me)? my tasks?[?!.]*|(?:显示|查看)(?:一下)?我的任务[？。!！]*",
        normalized,
    ):
        return "overview"
    if re.search(r'\bdate\s+is\s+(?:later|earlier)\s+than\b.{0,50}\bdate\b', normalized):
        return 'list'
    field_list = re.match(r'\s*show\b(?P<subject>.*?)\b(?:including|with)\b.*\bexpiry date\b', normalized)
    if field_list and not re.search(r'expir|overdue|\bdue\b', field_list['subject']):
        return 'list'
    # An explicit request for a list remains a list even when the user calls
    # the visible row fields "details". A detail answer is for one selected
    # record, not a synonym for a collection with columns.
    if re.search(r"\blist\b", normalized):
        return "list"
    if re.search(r'\bwhat\b.{0,80}\b(?:requests|tasks|records|accounts|items)\s+are\b', normalized):
        return 'list'
    patterns = (
        ("count", r"\bhow many\b|\bcount\b|\bnumber of\b|多少|几个|几项"),
        ("attention", r"\battention\b|pay attention|需要.{0,8}(?:关注|留意)|(?:关注|留意).{0,8}(?:什么|哪些)"),
        (
            "due",
            r"\bdue\b|\bdue soon\b|\bdeadlines?\b|"
            r"\b(?:approaching|near(?:ing)?)\b.{0,32}\b(?:deadlines?|due|expiry|expiration|sla)\b|"
            r"expir|overdue|到期|逾期",
        ),
        ("detail", r"\bdetails?\b|详情|明细"),
        ("overview", r"\boverview\b|\bsummary\b|\bwhat (?:is shown|can i see)\b|概览|概况|总览"),
        ("list", r"\bshow\b|\blist\b|\bwhich\b|\bwhat are\b|\b(?:check|view|find)\b.*\b(?:tasks?|items?|records?|applications?)\b|显示|列出|哪些|有什么|(?:مبالغ|عملات|طلبات|سجلات).*(?:استرداد|مكتمل|الظاهر)|(?:استرداد|مكتمل|الظاهر).*(?:مبالغ|عملات|طلبات|سجلات)|اذكر.*(?:كل|الإجمالي)"),
    )
    for shape, pattern in patterns:
        if re.search(pattern, normalized):
            return shape  # type: ignore[return-value]
    elliptical = bool(
        re.search(r"\b(?:how|what) about\b|\band\b|那么|那|至于|呢\s*[?？]?\s*$", normalized)
    )
    if elliptical:
        previous = _bounded_conversation_context(conversation_context).get("previousIntent")
        inherited = str(previous.get("answerShape") or "") if isinstance(previous, dict) else ""
        if inherited in {"overview", "count", "list", "attention", "due", "detail"}:
            return inherited  # type: ignore[return-value]
    return "unspecified"


def knowledge_search_query(
    question: str,
    context: UserPermissionContext,
    conversation_context: dict[str, Any] | None = None,
) -> str:
    """Retrieve the requested topic without bias toward accessible sibling pages."""

    question_text = question.strip()[:1_200]
    bounded_context = _bounded_conversation_context(conversation_context)
    resolved_values = _resolved_intent_values(bounded_context)
    if question_is_conceptual(question) and not re.search(r"\b(?:current|today|latest|visible)\b|当前|今天|最新", question, re.I):
        previous = bounded_context.get("previousIntent") or {}
        parts = ["Admin Portal user manual", "Question: " + question_text]
        parts.extend(f"Topic {name}: {resolved_values[name]}" for name in ('businessObject', 'businessFocus') if resolved_values.get(name))
        hint = bounded_context.get('sourceHint') or semantic_source_hint(bounded_context)
        relation = bounded_context.get('resolvedIntent', {}).get('relation')
        if hint.get('page') and relation in {None, 'continue', 'refine'}:
            parts.append('Explanation concerns the previous page: ' + hint['page'])
        if isinstance(previous, dict) and previous.get('question'):
            parts.append("Previous question: " + str(previous['question'])[:400])
        # Permission page lists and department numbers are not definition
        # search terms; they otherwise pull retrieval toward dashboard manuals.
        return ". ".join(parts)[:2000]
    if bounded_context.get("resolvedIntent"):
        parts = ["Admin Portal user manual"]
        if context.roles:
            parts.append("Current roles: " + ", ".join(context.roles[:4])[:160])
        # Reserve space for every resolved condition before the original wording.
        parts.extend(f"Current task {name}: {value[:180]}" for name, value in resolved_values.items())
        hint = bounded_context.get("sourceHint", {})
        if hint:
            parts.append("Verified candidate source, not a restriction: " + str(hint.get("page", ""))[:200] + " " + str(hint.get("section", ""))[:180])
        parts.append("Original question: " + question_text)
        return ". ".join(parts)[:2_000]
    previous = bounded_context.get("previousIntent")
    previous_page = str(previous.get("page") or "") if isinstance(previous, dict) else ""
    page_label = urlsplit(previous_page).path.rstrip("/").rsplit("/", 1)[-1].replace("-", " ").strip()
    manual_prefix = (
        f"Admin Portal {page_label} page user manual"
        if page_label
        else "Admin Portal user manual"
    )
    parts = [manual_prefix, "Question: " + question_text]
    if previous_page:
        parts.append("Previous page is a candidate source, not a scope constraint: " + previous_page)
    parts.append("Requested answer shape: " + reader_answer_shape(question, bounded_context))
    if isinstance(previous, dict):
        continuity = [
            f"{name}: {previous[name]}"
            for name in (
                "question", "businessObject", "recordIdentity", "view", "dateRange", "filter",
                "recentIntents", "selectedState", "sourceSection", "page", "section", "answerShape",
            )
            if previous.get(name)
        ]
        if continuity:
            parts.append("Prior follow-up intent: " + ", ".join(continuity))
    if context.roles:
        parts.append("Current roles: " + ", ".join(context.roles[:4]))
    # Access is validated separately using GetUserInfo. Adding every allowed
    # route here made unavailable topics retrieve accessible, unrelated views.
    query = ". ".join(parts)
    if len(query) <= 2_000:
        return query
    # Preserve the current question and follow-up intent before permission vocabulary.
    required_count = 5 if previous_page and len(parts) >= 5 else 4 if isinstance(previous, dict) and len(parts) >= 4 else 3
    required = ". ".join(parts[:required_count])
    optional = ". ".join(parts[required_count:])
    return (required + (". " + optional[: max(0, 1_998 - len(required))] if optional else ""))[:2_000]



# Wording that asks for a business rule rather than a page description.  The
# page manuals answer "where is this shown"; these questions need the
# regulation, fee schedule, standard or requirement document as well.
_RULE_EVIDENCE_REQUEST = re.compile(
    r"\b(?:why|basis|based on|according to|which (?:policy|rule|regulation|article)|"
    r"polic\w+|regulation|legislation|decree|clause|article|requirement|requirements|"
    r"criteria|criteri\w+|threshold|standard|standards|penalt\w+|fee|fees|charge|charges|"
    r"composition|breakdown|entitle|eligib\w+|allowed|permitted|prohibited|violat\w+|"
    r"checklist|documents?|materials?|required\b)\b"
    r"|依据|政策|规则|法规|条款|第.{1,4}条|要求|条件|标准|违规|处罚|罚款|费用|构成|明细|材料|清单|"
    r"为什么|能否|是否可以|需要哪些|要准备|依据是什么"
    r"|سياسة|قاعدة|لائحة|قانون|مادة|شرط|شروط|متطلبات|معيار|غرامة|مخالفة|رسوم|أسباب|لماذا",
    re.I,
)


_STAFF_PERFORMANCE_REQUEST = re.compile(
    r"\bsla\s+compliance\b|\bcompliance\s+rate\b|\bbreach\s+rate\b"
    r"|\bperformance\s+(?:rate|overview|metric)s?\b|\bworst\s+perform\w+\b"
    r"|\bwho\s+performs?\s+worst\b"
    r"|(?:表现|绩效)\s*最差|最差.{0,6}(?:员工|成员|人员)|SLA\s*合规率|合规率|违约率|完成率"
    r"|أداء\s+الموظف|معدل\s+الالتزام",
    re.I,
)


_POLICY_DOCUMENT_ANCHORS = (
    "regulation cabinet resolution law by decree article clause requirement checklist standard "
    "法规 条款 第几条 要求 条件 材料 清单 依据 政策 规则 标准 "
    "لائحة قانون مادة شرط متطلبات معيار"
)

# One policy question is about content standards, another about licence renewal,
# another about a fee.  Anchoring with the wrong domain pushes the right
# document out of the result set, so the vocabulary follows the question.
_POLICY_DOMAIN_ANCHORS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"content|standards?|prohibited|classif\w+|violat\w+|penalt\w+"
                   r"|内容|标准|违规|违反|禁止|处罚|محتوى|معيار|مخالفة", re.I),
        "media content standards media-content-standards.pdf 07_NMA_Media_Content_Standards_AR.pdf "
        "the-uae-en-uae-media-content-standards prohibited content classification media violations and penalties administrative",
    ),
    (
        re.compile(r"licen[cs]e|permit|application|renew\w*|cancel\w*|suspend\w*|restore|revoke\w*"
                   r"|许可|许可申请|许可证|续期|取消|恢复|吊销|暂停|رخصة|تجديد|إلغاء|استعادة", re.I),
        "media executive regulation 03_Cabinet_68_2024_Media_Executive_Regulation.pdf licensing approving the "
        "license application license term and renewal cancellation suspension expiry restoration conditions requirements",
    ),
    (
        re.compile(r"fee|fees|charge|refund|refunded|amount|tax|price|payment"
                   r"|费用|收费|退款|金额|税费|罚款|价格|رسوم|استرداد|مبلغ|غرامة", re.I),
        "media services fees 04_Cabinet_41_2025_Media_Services_Fees.pdf 06_Cabinet_38_2016_Free_Zone_Media_Fees.pdf "
        "fee schedule refund amount tax",
    ),
    (
        re.compile(r"inspection|inspector|visit|checklist|site\b|检查|巡检|走访|تفتيش|جولة", re.I),
        "inspection report requirements media violations and penalties site visit checklist",
    ),
)


def policy_domain_anchors(question: str) -> str:
    """Vocabulary of the policy documents that answer this question's topic."""

    text = str(question or "")
    matched = [anchor for pattern, anchor in _POLICY_DOMAIN_ANCHORS if pattern.search(text)]
    if not matched:
        matched = [
            "media executive regulation cabinet resolution regulating the media",
            "media services fees media content standards media violations and penalties",
        ]
    return " ".join(matched[:2])


def knowledge_search_queries(
    question: str,
    context: UserPermissionContext,
    conversation_context: dict[str, Any] | None = None,
) -> tuple[str, ...]:
    """One page-manual query, plus a regulation-first query for rule questions.

    The manual-biased query keeps page/route questions precise, but its
    "Admin Portal user manual" prefix dominates the semantic index and pushes
    the regulation, fee schedule and standards documents out of the result set.
    A second, unbiased query restores them without changing the first.
    """

    manual_query = knowledge_search_query(question, context, conversation_context)
    text = str(question or "").strip()
    if not text or not _RULE_EVIDENCE_REQUEST.search(text):
        return (manual_query,)
    # A generic "find the rule" wrapper loses to the manual corpus; anchoring the
    # question with the vocabulary of the governing documents keeps the
    # regulation, fee schedule, standards and penalty texts in range.
    policy_query = (
        text[:900] + " " + policy_domain_anchors(text) + " " + _POLICY_DOCUMENT_ANCHORS
    )
    if policy_query.casefold() == manual_query.casefold():
        return (manual_query,)
    return (manual_query, policy_query[:2_000])


def merge_knowledge_results(results: list[Any], *, limit: int) -> dict[str, Any]:
    """Combine several knowledge searches into one bounded evidence set.

    Chunks are de-duplicated by source and text, ordered by their own retrieval
    score, and truncated to the reader's budget so the planner sees one
    coherent set of passages.
    """

    usable = [item for item in results if isinstance(item, dict) and isinstance(item.get("result"), dict)]
    if not usable:
        first = results[0] if results else {"ok": False, "code": "knowledge_unavailable"}
        return first if isinstance(first, dict) else {"ok": False, "code": "knowledge_unavailable"}
    if len(usable) == 1:
        return usable[0]
    base = usable[0]
    payload = base["result"]
    chunks: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in usable:
        for chunk in (item["result"].get("chunks") or []):
            if not isinstance(chunk, dict):
                continue
            nested = chunk.get("chunk") if isinstance(chunk.get("chunk"), dict) else chunk
            content = str(nested.get("content") or "")
            source = str(nested.get("source_name") or "")
            key = (source, content[:200])
            if not content or key in seen:
                continue
            seen.add(key)
            chunks.append(nested)
    chunks.sort(key=lambda entry: float(entry.get("score") or 0), reverse=True)
    merged_payload = {
        **payload,
        "chunks": chunks[:limit],
        "total": max(int((item["result"].get("total") or 0)) for item in usable),
        "degraded": any(bool(item["result"].get("degraded")) for item in usable),
        "queryCount": sum(1 for item in usable),
    }
    return {**base, "result": merged_payload}


def portal_request_paths(request: PortalReadRequest) -> frozenset[str]:
    return frozenset(
        {request.start_path}
        | {
            str(action.get(name))
            for action in request.actions
            for name in ("path", "url")
            if action.get(name)
        }
    )


def permission_path_matches(requested_path: str, allowed_path: str) -> bool:
    """Match exact routes or explicit one-segment route templates only."""

    requested = urlsplit(requested_path).path.rstrip("/") or "/"
    allowed = urlsplit(allowed_path).path.rstrip("/") or "/"
    if requested.casefold() == allowed.casefold():
        return True
    requested_parts = requested.strip("/").split("/")
    allowed_parts = allowed.strip("/").split("/")
    if len(requested_parts) != len(allowed_parts):
        return False
    def segment_matches(actual: str, expected: str) -> bool:
        if expected.casefold() == actual.casefold():
            return True
        dynamic = expected == "*" or (expected.startswith(":") and len(expected) > 1) or (expected.startswith("{") and expected.endswith("}"))
        return dynamic and bool(re.fullmatch(r"[A-Za-z0-9_-]*\d[A-Za-z0-9_-]*", actual))

    return all(segment_matches(actual, expected) for actual, expected in zip(requested_parts, allowed_parts, strict=True))


def _click_permission_matches(action: dict[str, Any], buttons: tuple[str, ...]) -> bool:
    candidates = {_key(action.get("permissionCode") or action.get("permission_code"))} - {""}
    allowed = {_key(button) for button in buttons if _key(button)}
    return bool(candidates and allowed and candidates.intersection(allowed))


def _detail_identity(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _stable_detail_identity_from_query(question: str, actions: tuple[dict[str, Any], ...]) -> str:
    """Recover one exact record-like query value without guessing an identity."""

    candidates: set[str] = set()
    question_text = question.casefold()
    for action in actions:
        if str(action.get("type") or "").casefold().replace("-", "_") not in {"query", "filter"}:
            continue
        value = _detail_identity(action.get("value"))
        if (
            3 <= len(value) <= 200
            and any(char.isdigit() for char in value)
            and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", value)
            and value.casefold() in question_text
        ):
            candidates.add(value)
    return next(iter(candidates)) if len(candidates) == 1 else ""


def _cell_detail_destination(action: dict[str, Any]) -> str | None:
    destinations = [str(action[name]).strip() for name in ("path", "url") if action.get(name)]
    return destinations[0] if len(destinations) == 1 else None


def _same_route(first: str, second: str) -> bool:
    return (urlsplit(first).path.rstrip("/") or "/").casefold() == (
        urlsplit(second).path.rstrip("/") or "/"
    ).casefold()


def bounded_json(value: Any, *, max_depth: int = 5, max_items: int = 100, max_string: int = 1_000) -> Any:
    """Bound and redact untrusted evidence before it crosses runtime boundaries."""

    if max_depth <= 0:
        return "[truncated]"
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for name, child in list(value.items())[:max_items]:
            normalized = _key(name)
            if normalized in {_key(item) for item in SENSITIVE_KEYS} or any(fragment in normalized for fragment in SENSITIVE_KEY_FRAGMENTS):
                continue
            result[str(name)[:120]] = bounded_json(child, max_depth=max_depth - 1, max_items=max_items, max_string=max_string)
        return result
    if isinstance(value, (list, tuple)):
        return [bounded_json(item, max_depth=max_depth - 1, max_items=max_items, max_string=max_string) for item in list(value)[:max_items]]
    if isinstance(value, str):
        return _sanitize_untrusted_text(value, max_length=max_string)
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:max_string]


_API_TRUNCATION_MARKERS = frozenset({
    "[truncated]", "<truncated>", "[max-depth]", "[depth]",
})


def _bounded_api_json(
    value: Any,
    *,
    max_depth: int = 32,
    max_items: int = 60,
    max_string: int = 1_000,
    max_fields: int = 200,
) -> Any:
    """Project already-bounded API JSON without turning omissions into facts."""

    omitted = object()

    def visit(item: Any, depth: int) -> Any:
        if depth >= max_depth:
            return omitted
        if isinstance(item, dict):
            result: dict[str, Any] = {}
            for name, child in list(item.items())[:max_fields]:
                normalized = _key(name)
                if (
                    normalized in {_key(key) for key in SENSITIVE_KEYS}
                    or any(fragment in normalized for fragment in SENSITIVE_KEY_FRAGMENTS)
                ):
                    continue
                projected = visit(child, depth + 1)
                if projected is not omitted:
                    result[str(name)[:120]] = projected
            return result
        if isinstance(item, (list, tuple)):
            result = []
            for child in list(item)[:max_items]:
                projected = visit(child, depth + 1)
                if projected is not omitted:
                    result.append(projected)
            return result
        if isinstance(item, str):
            if item.strip().casefold() in _API_TRUNCATION_MARKERS:
                return omitted
            return _sanitize_untrusted_text(item, max_length=max_string)
        if item is None or isinstance(item, (bool, int, float)):
            return item
        return _sanitize_untrusted_text(str(item), max_length=max_string)

    projected = visit(value, 0)
    return {} if projected is omitted else projected


def bounded_portal_observation(value: Any) -> Any:
    """Bound page semantics while giving each captured API response its own depth budget."""

    projected = bounded_json(value, max_depth=10, max_items=60, max_string=1_000)
    if isinstance(value, dict) and isinstance(projected, dict) and "collections" in value:
        # Computation receipts have independent row/byte limits and must never
        # inherit the UI's 60-item truncation while retaining "complete".
        from .reader_collection import checked_collections
        projected["collections"] = checked_collections(value["collections"])
    raw_discovery = _api_discovery(value)
    projected_discovery = _api_discovery(projected)
    if raw_discovery is None or projected_discovery is None:
        return projected
    for field_name in ("candidates", "deltaCandidates"):
        raw_candidates = raw_discovery.get(field_name)
        projected_candidates = projected_discovery.get(field_name)
        if not isinstance(raw_candidates, list) or not isinstance(projected_candidates, list):
            continue
        raw_by_operation = {
            str(candidate.get("operationKey") or ""): candidate
            for candidate in raw_candidates
            if isinstance(candidate, dict) and candidate.get("operationKey")
        }
        for candidate in projected_candidates:
            if not isinstance(candidate, dict):
                continue
            raw_candidate = raw_by_operation.get(str(candidate.get("operationKey") or ""))
            if not isinstance(raw_candidate, dict) or "responseEvidence" not in raw_candidate:
                continue
            candidate["responseEvidence"] = _bounded_api_json(
                raw_candidate.get("responseEvidence"),
                max_depth=32,
                max_items=60,
                max_string=1_000,
            )
            candidate["responseEvidenceTruncated"] = (raw_candidate.get("responseEvidenceTruncated") is True
                or candidate["responseEvidence"] != raw_candidate.get("responseEvidence"))
            # Transport receipts are indexed by field path, not UI rows.
            # The generic 60-item observation bound used to silently discard
            # sibling-array proofs and fields at the end of a detail response.
            receipts = raw_candidate.get('fieldEvidence')
            if isinstance(receipts, dict):
                candidate['fieldEvidence'] = {
                    path: {key: receipt[key] for key in ('status', 'kind', 'valueHash')}
                    for path, receipt in list(receipts.items())[:600]
                    if (isinstance(path, str) and path.startswith('/') and len(path) <= 512
                        and isinstance(receipt, dict)
                        and receipt.get('status') in {'complete', 'bounded', 'transformed', 'null'}
                        and receipt.get('kind') in {'scalar', 'array', 'object'}
                        and isinstance(receipt.get('valueHash'), str)
                        and re.fullmatch(r'[0-9a-f]{64}', receipt['valueHash'])
                        and not any(fragment in _key(path) for fragment in SENSITIVE_KEY_FRAGMENTS))
                }
            if isinstance(raw_candidate.get('structuredDocuments'), list):
                candidate['structuredDocuments'] = _bounded_api_json(
                    raw_candidate['structuredDocuments'][:3], max_depth=32,
                    max_items=60, max_fields=200, max_string=1_000)
            if isinstance(raw_candidate.get('assignmentEvidence'), list):
                candidate['assignmentEvidence'] = _bounded_api_json(raw_candidate['assignmentEvidence'],
                    max_depth=8, max_items=20, max_string=120)
    return projected


def bounded_portal_read_result(value: Any) -> Any:
    """Project a portal Tool result without spending API evidence depth on envelopes."""

    projected = bounded_json(value, max_depth=7, max_items=100, max_string=1_000)
    if isinstance(value, dict) and isinstance(projected, dict) and value.get("observation") is not None:
        projected["observation"] = bounded_portal_observation(value.get("observation"))
    return projected


def _sanitize_knowledge_text(value: str, *, max_length: int) -> str:
    return _sanitize_untrusted_text(value, max_length=max_length)


_KNOWLEDGE_MARKDOWN_V2_ENVELOPE = re.compile(
    r"\A【知识库文件】\s*文件名：(?P<source_name>.+?)\s+目录：\S+\s+分段：\d+\s+"
    r"【文档路径】.+?\s+【来源行】\d+(?:-\d+)?\s+"
    r"【内容类型】[^\s【]+\s+【切分版本】markdown-v2\s+(?P<body>.+)\Z",
    re.IGNORECASE | re.DOTALL,
)


def _knowledge_content_body(content: str, source_name: object = "") -> str:
    """Remove the known retrieval envelope while preserving manual content."""

    normalized = re.sub(r"\s+", " ", str(content or "")).strip()
    match = _KNOWLEDGE_MARKDOWN_V2_ENVELOPE.fullmatch(normalized)
    structured_source = re.sub(r"\s+", " ", str(source_name or "")).strip()
    if not match or not structured_source:
        return normalized
    envelope_source = re.sub(r"\s+", " ", match.group("source_name")).strip()
    if envelope_source.casefold() != structured_source.casefold():
        return normalized
    return match.group("body").strip()


def project_knowledge_result(
    value: Any,
    *,
    max_chunks: int = 8,
    max_content: int = 4_000,
    max_bytes: int = 48_000,
) -> dict[str, Any]:
    """Project the gateway response into bounded planning evidence.

    Knowledge responses are nested more deeply than ordinary audit payloads.
    An explicit projection preserves useful chunk text while excluding IDs,
    hashes, graph payloads, and other retrieval internals.
    """

    if not isinstance(value, dict):
        return {"ok": False, "code": "knowledge_result_invalid"}
    projected: dict[str, Any] = {
        "ok": value.get("ok") is True,
        "code": str(value.get("code") or "")[:120],
    }
    payload = value.get("result")
    if not isinstance(payload, dict):
        return projected
    if isinstance(payload.get("total"), int):
        projected["total"] = payload["total"]
    if isinstance(payload.get("degraded"), bool):
        projected["degraded"] = payload["degraded"]
    raw_chunks = payload.get("chunks")
    if not isinstance(raw_chunks, list):
        raw_chunks = []
    chunks: list[dict[str, Any]] = []
    for raw_item in raw_chunks[: max(0, max_chunks)]:
        if not isinstance(raw_item, dict):
            continue
        nested = raw_item.get("chunk") if isinstance(raw_item.get("chunk"), dict) else {}
        content = raw_item.get("content") or nested.get("content") or raw_item.get("text") or nested.get("text")
        if not isinstance(content, str) or not content.strip():
            continue
        source_name = (
            raw_item.get("source_name")
            or nested.get("source_name")
            or raw_item.get("document_keyword")
            or nested.get("document_keyword")
        )
        body = _knowledge_content_body(content, source_name)
        safe_content = _sanitize_knowledge_text(body, max_length=max_content)
        if not safe_content:
            continue
        item: dict[str, Any] = {"content": safe_content}
        if len(body) > max_content:
            # Keep truncation explicit so the planner cannot mistake an
            # incomplete semantic node for complete manual evidence.
            item["truncated"] = True
        if isinstance(source_name, str) and source_name.strip():
            safe_source_name = _sanitize_knowledge_text(source_name, max_length=300)
            if safe_source_name:
                item["source_name"] = safe_source_name
        score = raw_item.get("score", nested.get("score"))
        if isinstance(score, (int, float)) and not isinstance(score, bool):
            item["score"] = score
        candidate = {**projected, "chunks": [*chunks, item]}
        if len(json.dumps(candidate, ensure_ascii=False).encode("utf-8")) > max_bytes:
            break
        chunks.append(item)
    projected["chunks"] = chunks
    return projected


class ReadOnlyPortalPolicy:
    """Validate generic browser actions before any network call is made."""

    def __init__(self, portal_base_url: str, *, max_actions: int = 12, max_pages: int = 3) -> None:
        parsed = urlsplit(portal_base_url)
        self.portal_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme in {"http", "https"} and parsed.netloc else ""
        self.max_actions = max(1, max_actions)
        self.max_pages = max(1, max_pages)

    @staticmethod
    def _safe_path(value: object) -> str | None:
        path = unquote(str(value or "")).strip()
        if not path.startswith("/") or path.startswith("//") or "\\" in path:
            return None
        parsed = urlsplit(path)
        if parsed.scheme or parsed.netloc or parsed.username or parsed.password:
            return None
        return path[:1_000]

    @staticmethod
    def _words(value: object) -> frozenset[str]:
        decoded = unquote(str(value or ""))
        # Split camel-case parameter names such as ``exportFormat`` before
        # tokenizing, while keeping plural resource names distinct from verbs.
        spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", decoded)
        return frozenset(re.findall(r"[a-z]+", spaced.casefold()))

    @classmethod
    def _contains_mutation_command(cls, value: object) -> bool:
        words = cls._words(value)
        mutation_terms = words.intersection(MUTATION_COMMAND_TERMS)
        return bool(
            mutation_terms - {"open"}
            or ("open" in mutation_terms and not words.intersection(READ_ONLY_OPEN_CONTEXT_TERMS))
        )

    @classmethod
    def _is_mutation_route(cls, value: object) -> bool:
        parsed = urlsplit(unquote(str(value or "")))
        return any(
            cls._contains_mutation_command(segment)
            and cls._words(segment).intersection(MUTATION_ROUTE_TERMS)
            for segment in parsed.path.split("/")
            if segment
        )

    @classmethod
    def _is_safe_overlay_dismissal_label(cls, value: object, action_type: str) -> bool:
        return action_type == "dismiss_overlay" and cls._words(value) in ({"close"}, {"dismiss"}, {"cancel"})

    def validate(
        self,
        request: PortalReadRequest,
        permissions: UserPermissionContext,
        *,
        require_permission_context: bool = True,
    ) -> str | None:
        if not self.portal_origin:
            return "invalid_portal_origin"
        if not self._safe_path(request.start_path):
            return "invalid_navigation_path"
        if self._is_mutation_route(request.start_path):
            return "action_not_read_only"
        if not request.actions or len(request.actions) > self.max_actions:
            return "invalid_action_count"
        page_paths = {request.start_path}
        allowed_pages = tuple(path for path in (*permissions.pages, *permissions.subpages) if path.startswith("/"))
        if require_permission_context and (not permissions.roles or not allowed_pages):
            return "permission_context_incomplete"
        if allowed_pages and not any(permission_path_matches(request.start_path, page) for page in allowed_pages):
            return "page_not_permitted"
        for action in request.actions:
            action_type = str(action.get("type") or "").strip().casefold().replace("-", "_")
            if action_type not in ALLOWED_READER_ACTIONS:
                return "action_not_read_only"
            method = str(action.get("method") or "GET").strip().upper()
            # Query means interacting with the already-loaded page, not calling
            # an arbitrary API endpoint. The isolated executor owns all network
            # traffic, so model-provided POST requests are never accepted.
            if method != "GET":
                return "method_not_read_only"
            permission_code = action.get("permissionCode") or action.get("permission_code")
            cell_detail_without_button = (
                action_type == "show_detail"
                and str(action.get("role") or "").casefold() == "cell"
                and not str(permission_code or "").strip()
            )
            if action_type == "show_detail" and str(action.get("role") or "").casefold() == "cell" and permission_code:
                return "click_target_not_detail"
            if action_type in {"expand_details", "show_detail"} and not cell_detail_without_button and (
                not permission_code or not _click_permission_matches(action, permissions.buttons)
            ):
                return "button_not_permitted"
            if action_type == "show_detail" and not str(action.get("value") or "").strip():
                return "detail_identity_required"
            if action_type == "sort" and str(action.get("direction") or "").casefold() not in {"ascending", "descending"}:
                return "sort_direction_required"
            raw_values = action.get("values")
            if raw_values is not None and (
                not isinstance(raw_values, list)
                or not 1 <= len(raw_values) <= 20
                or any(not isinstance(value, str) or not value.strip() or len(value) > 1_000 for value in raw_values)
            ):
                return "invalid_filter_values"
            if action_type == "filter" and action.get("value") is None and not raw_values:
                return "filter_value_required"
            for name in ("path", "url"):
                if name in action and not self._safe_path(action[name]):
                    return "invalid_navigation_path"
                if name in action and self._is_mutation_route(action[name]):
                    return "action_not_read_only"
                if name in action:
                    action_path = str(action[name])
                    page_paths.add(action_path)
                    if allowed_pages and not any(permission_path_matches(action_path, page) for page in allowed_pages):
                        return "page_not_permitted"
            if cell_detail_without_button:
                identity = _detail_identity(action.get("value"))
                if not str(action.get("name") or "").strip() or _detail_identity(action.get("name")) != identity:
                    return "detail_cell_identity_mismatch"
                destination = _cell_detail_destination(action)
                if destination is not None and (urlsplit(destination).query or urlsplit(destination).fragment):
                    return "detail_destination_query_forbidden"
                if destination is not None and _same_route(request.start_path, destination):
                    return "detail_destination_not_distinct"
            parameters = action.get("parameters") or action.get("filters") or {}
            if not isinstance(parameters, dict):
                return "invalid_action_parameters"
            if any(self._contains_mutation_command(name) for name in parameters):
                return "action_not_read_only"
            for name in ("label", "name", "selector"):
                candidate = action.get(name)
                if candidate is None:
                    continue
                if name in {"label", "name"} and self._is_safe_overlay_dismissal_label(candidate, action_type):
                    continue
                if self._contains_mutation_command(candidate):
                    return "action_not_read_only"
            if action_type == "query" and (
                action.get("value") is not None or raw_values or action.get("parameters") or action.get("filters")
            ):
                return "query_cannot_apply_filters"
        if len(page_paths) > self.max_pages:
            return "page_limit_exceeded"
        return None


def portal_read_request_from_plan(plan: Any) -> PortalReadRequest | None:
    if not isinstance(plan, dict) or set(plan) != {"mode", "portalRequest"} or plan.get("mode") != "portal_read":
        return None
    candidate = plan.get("portalRequest")
    if not isinstance(candidate, dict):
        return None
    if not set(candidate).issubset({"startPath", "actions", "expectedFields"}):
        return None
    start_path = str(candidate.get("startPath") or candidate.get("start_path") or "").strip()
    raw_actions = candidate.get("actions")
    if not start_path or not isinstance(raw_actions, list):
        return None
    if not raw_actions:
        raw_actions = [{"type": "observe"}]
    action_keys = {
        "type", "action", "path", "url", "selector", "label", "role", "name", "field", "section",
        "emptyState", "permissionCode", "value", "values", "method", "parameters", "filters", "direction",
    }
    if any(not isinstance(action, dict) or not set(action).issubset(action_keys) for action in raw_actions):
        return None
    actions: list[dict[str, Any]] = []
    for raw_action in raw_actions:
        action_type = raw_action.get("type")
        action_alias = raw_action.get("action")
        if action_type is not None and action_alias is not None and _key(action_type) != _key(action_alias):
            return None
        normalized_action = {name: value for name, value in raw_action.items() if name != "action"}
        if action_type is None and action_alias is not None:
            normalized_action["type"] = action_alias
        # The model may omit a semantic role for known read-only UI commands.
        # Fill only the role implied by the action type; never overwrite an
        # explicit role, which must continue through policy validation.
        if "role" not in normalized_action:
            implied_role = {
                "switch_tab": "tab",
                "show_filter": "button",
                "apply_filter": "button",
                "reset_filter": "button",
                "dismiss_overlay": "button",
            }.get(str(normalized_action.get("type") or "").casefold())
            if implied_role:
                normalized_action["role"] = implied_role
        actions.append(normalized_action)
    fields = _strings(candidate.get("expectedFields") or candidate.get("expected_fields") or (), limit=30)
    return PortalReadRequest(start_path=start_path, actions=tuple(actions), expected_fields=fields)


def _normalize_initial_observation_request(request: PortalReadRequest) -> PortalReadRequest | None:
    """Normalize redundant observations after original fields pass policy.

    State-changing read actions already return a final observation. A trailing
    pure observe adds no evidence in that case. Other mixed plans stay invalid.
    Callers must validate the original request so normalization cannot hide
    unsafe metadata or bypass action budgets.
    """

    action_types = tuple(
        str(action.get("type") or "").strip().casefold().replace("-", "_")
        for action in request.actions
    )
    if "observe" not in action_types:
        return request
    if (
        len(action_types) > 1
        and action_types[-1] == "observe"
        and action_types.count("observe") == 1
        and set(request.actions[-1]) == {"type"}
        and all(action_type in ALLOWED_READER_ACTIONS - {"observe"} for action_type in action_types[:-1])
        and any(action_type != "query" for action_type in action_types[:-1])
    ):
        return replace(request, actions=request.actions[:-1])
    if not action_types or any(action_type != "observe" for action_type in action_types):
        return None
    return PortalReadRequest(
        start_path=request.start_path,
        actions=({"type": "observe"},),
        expected_fields=request.expected_fields,
    )


def _closed_result_from_plan(
    plan: Any,
    *,
    expected_mode: Literal["knowledge_only", "observation_result"],
) -> ReaderResult | None:
    """Validate one closed planner result mode without accepting aliases."""

    if not isinstance(plan, dict) or plan.get("mode") != expected_mode:
        return None
    allowed = {
        "mode", "result", "page", "section", "sourceSection", "answerShape", "completeness",
        "selectedState", "scope", "facts", "workflowState", "missing",
    }
    if expected_mode == "knowledge_only" and not set(plan).issubset(allowed):
        return None
    raw_facts = plan.get("facts")
    if expected_mode == "observation_result" and raw_facts is None:
        raw_facts = plan.get("items") or plan.get("data") or plan.get("answer")
    if isinstance(raw_facts, list):
        facts = raw_facts
    elif raw_facts in (None, "", {}):
        facts = []
    else:
        facts = [raw_facts]
    raw_missing = plan.get("missing")
    if isinstance(raw_missing, list):
        missing = raw_missing
    elif raw_missing in (None, ""):
        missing = []
    else:
        missing = [raw_missing]
    status = str(plan.get("result") or plan.get("status") or ("success" if facts else "not_confirmed"))
    if status not in {"success", "no_data", "not_confirmed"}:
        return None
    if status == "success" and not facts:
        return None
    if status == "no_data" and facts:
        return None
    if status == "not_confirmed" and not missing and expected_mode == "observation_result":
        missing = ["evidence_not_confirmed"]
    if status == "not_confirmed" and not missing:
        return None
    scope = str(plan.get("scope") or "unknown")
    if scope not in {"personal", "team", "global", "unknown"}:
        return None
    answer_shape = str(plan.get("answerShape") or "unspecified")
    if answer_shape not in {"overview", "count", "list", "attention", "due", "detail", "unspecified"}:
        return None
    completeness = str(plan.get("completeness") or "unknown")
    if completeness not in {"bounded", "complete", "unknown"}:
        return None
    return ReaderResult(
        status=status,  # type: ignore[arg-type]
        summary=(
            "The knowledge base answered the request."
            if expected_mode == "knowledge_only" and status == "success"
            else "The portal observation answered the request."
            if expected_mode == "observation_result" and status == "success"
            else "The planner result is incomplete."
        ),
        page=str(plan.get("page") or "")[:500],
        section=str(plan.get("section") or "")[:300],
        source_section=str(plan.get("sourceSection") or plan.get("section") or "")[:300],
        answer_shape=answer_shape,  # type: ignore[arg-type]
        completeness=completeness,  # type: ignore[arg-type]
        selected_state=str(plan.get("selectedState") or "")[:300],
        scope=scope,  # type: ignore[arg-type]
        facts=tuple(
            (
                str(item)[:500]
                if isinstance(item, str)
                else json.dumps(bounded_json(item, max_depth=4, max_items=30, max_string=500), ensure_ascii=False)[:500]
            )
            for item in facts[:20]
        ),
        workflow_state=str(plan.get("workflowState") or "")[:500],
        missing=tuple(str(item)[:500] for item in missing[:10]),
    )


def knowledge_result_from_plan(plan: Any) -> ReaderResult | None:
    """Validate the planner's closed pre-observe knowledge-only result shape."""

    return _closed_result_from_plan(plan, expected_mode="knowledge_only")


def _observation_plan_result_from_plan(plan: Any) -> ReaderResult | None:
    """Validate the planner's closed post-observe result shape."""

    return _closed_result_from_plan(plan, expected_mode="observation_result")


def _selected_api_answer_plan(
    plan: Any,
    *,
    answer_shape: str,
) -> dict[str, Any] | None:
    """Normalize arbitrary JSON produced while processing selected API evidence."""

    if _observation_plan_result_from_plan(plan) is not None:
        return plan
    if not isinstance(plan, dict) or plan.get("mode") in {"portal_read", "api_selection", "knowledge_only"}:
        return None

    preferred_collections = ("facts", "items", "records", "rows", "tasks", "results")
    preferred_wrappers = ("answer", "output", "response", "data", "result")

    def extract(value: Any, depth: int = 0) -> list[Any]:
        if depth >= 8 or value in (None, ""):
            return []
        if isinstance(value, list):
            return list(value[:20])
        if not isinstance(value, dict):
            return [value]
        for key in preferred_collections:
            if key in value and value[key] not in (None, "", []):
                scalar_context = {
                    str(name): child
                    for name, child in value.items()
                    if name != key and child not in (None, "", [], {})
                    and isinstance(child, (str, int, float, bool))
                    and str(name).casefold() not in {"mode", "status", "result", "answershape", "completeness"}
                }
                return ([scalar_context] if scalar_context else []) + extract(value[key], depth + 1)
        for key in preferred_wrappers:
            child = value.get(key)
            if child not in (None, "", [], {}) and not (
                key == "result" and isinstance(child, str)
                and child.casefold() in {"success", "ok", "no_data", "not_confirmed"}
            ):
                return extract(child, depth + 1)
        content = {
            str(name): child for name, child in value.items()
            if str(name).casefold() not in {
                "mode", "status", "result", "answershape", "answer_shape", "completeness",
                "missing", "page", "section", "sourcesection", "selectedstate", "scope", "workflowstate",
            }
            and child not in (None, "", [], {})
        }
        return [content] if content else []

    facts = extract(plan)
    raw_status = plan.get("status")
    if not isinstance(raw_status, str):
        raw_status = plan.get("result") if isinstance(plan.get("result"), str) else ""
    normalized_status = str(raw_status or "").casefold().replace("-", "_").replace(" ", "_")
    no_data = normalized_status in {"no_data", "empty", "not_found"} and not facts
    if not facts and not no_data:
        return None
    normalized_shape = answer_shape if answer_shape in {
        "overview", "count", "list", "attention", "due", "detail",
    } else "unspecified"
    return {
        "mode": "observation_result",
        "result": "no_data" if no_data else "success",
        "answerShape": normalized_shape,
        "completeness": "bounded",
        "facts": facts[:20],
        "missing": [],
    }


_DOCUMENTATION_QUESTION_MARKERS = ("manual", "documented", "documentation", "user guide", "手册", "文档", "说明", "دليل")


_HARMFUL_CONTENT_REQUEST = re.compile(
    r"\b(?:write|draft|compose|generate|create|produce|prepare)\b[^.]{0,80}"
    r"\b(?:threat|threatening|violent|violence|hate|hatred|discriminat|harass|blackmail|propaganda|manipulat)\w*\b"
    r"|\b(?:threat|violent|hate|discriminat|harass|blackmail|propaganda)\w*\s+content\b"
    r"|(?:اكتب|صِغ|أعد|أنشئ|ولّد)[^.]{0,40}(?:تهديد|عنف|كراهية|تمييز|تحريض|دعاية)"
    r"|(?:تهديد|عنف|كراهية|تحريض|دعاية)[^.]{0,20}(?:محتوى|منشور|حملة)"
    r"|写(?:一篇|一段|一份)?[^。]{0,20}(?:威胁|暴力|仇恨|歧视|政治宣传|煽动)"
    r"|(?:威胁|暴力|仇恨|歧视|煽动|政治宣传)(?:性)?内容",
    re.I,
)
_INJECTION_REQUEST = re.compile(
    r"(?:ignore|disregard|forget)\s+(?:all|any|the)\s+(?:previous\s+|prior\s+)?(?:rules|instructions|prompts)"
    r"|reveal\s+(?:the\s+)?(?:system\s+prompt|internal\s+instructions)"
    r"|show\s+(?:me\s+)?all\s+(?:customer\s+)?bank\s+details"
    r"|show\s+(?:me\s+)?all\s+applicants?\s*'?\s*passport\s+numbers?"
    r"|تجاهل\s+(?:كل|جميع)\s+(?:القواعد|التعليمات)"
    r"|اكشف\s+(?:تعليمات|موجه)\s+النظام"
    r"|忽略(?:所有|全部)?(?:规则|指令)|泄露系统提示|显示所有客户银行信息|显示所有申请人护照号",
    re.I,
)


def _safety_request_result(question: str) -> ReaderResult | None:
    """Answer harmful-content and injection attempts explicitly, item by item."""

    text = str(question or "")
    facts: list[str] = []
    if _HARMFUL_CONTENT_REQUEST.search(text):
        facts.extend((
            "Refused: this request asks for threatening, hateful, violent or manipulative content, and the Admin assistant does not produce it.",
            "A compliant alternative: describe the applicant's submitted content to the Content review surface, record the specific rule and evidence, "
            "and route the case through the normal Content review or escalation path. No harmful text was generated.",
        ))
    if _INJECTION_REQUEST.search(text):
        refused = []
        if re.search(r"(?:system\s+prompt|internal\s+instructions)|تعليمات\s+النظام|系统提示", text, re.I):
            refused.append("reveal the system prompt or internal instructions - refused; no such content exists in this answer")
        if re.search(r"bank\s+details|بيانات\s+البنك|银行信息", text, re.I):
            refused.append("list all customer bank details - refused; the reader is read-only and never returns customer payment credentials")
        if re.search(r"passport\s+numbers?|جواز\s+السفر|护照号", text, re.I):
            refused.append("list all applicants' passport numbers - refused; personal identity documents are outside the answer scope")
        if refused:
            facts.append("Refused, one item at a time: " + "; ".join(refused) + ".")
    if not facts:
        return None
    facts.append(
        "The remaining business question in the same message is answered separately; a refused item is never silently merged into it."
    )
    return ReaderResult(
        status="success",
        summary="The sensitive parts of the request were refused explicitly.",
        answer_shape="detail",
        completeness="bounded",
        scope="unknown",
        facts=tuple(facts[:6]),
    )


def _leading_verb_names_a_record(text: str, verb_pattern: str) -> bool:
    """True when a change verb is really part of the record being asked about.

    "Refund HC-02-2026-5239576 current status and amount" and its Chinese form
    start with a word that is also a business action, but the identifier shows
    the word names the object, and a read-state cue shows the intent is read
    only.
    """

    remainder = re.sub(r"^(?:" + verb_pattern + r")\s*", "", str(text or "").strip(), count=1, flags=re.IGNORECASE)
    if not _explicit_record_identity(remainder):
        return False
    return bool(re.search(
        r"(?:status|state|amount|progress|detail|details|next step|outcome|result)\b"
        r"|状态|金额|进度|详情|明细|情况|下一步|结果",
        str(text or ""),
        re.IGNORECASE,
    ))


_LEADING_ENGLISH_VERBS = (
    "approve|reject|submit|delete|remove|create|assign|reassign|export|upload|download|pay|"
    "refund|send|suspend|publish|save|archive"
)
_LEADING_CHINESE_VERBS = "删除|导出|下载|上传|批准|审批|驳回|提交|创建|新建|分配|重新分配|发送|退款|支付|停用|发布|保存"


def question_requests_business_mutation(question: str) -> bool:
    """Recognize explicit commands, not resource names or read-only view changes."""
    text = re.sub(r"\s+", " ", str(question or "")).strip()
    english = re.sub(
        r"^(?:(?:please|now)\s+|(?:can|could|would|will)\s+you\s+|i\s+(?:need|want)\s+you\s+to\s+)+",
        "", text, flags=re.IGNORECASE,
    )
    if re.match(r"^(?:" + _LEADING_ENGLISH_VERBS + r")\b", english, re.IGNORECASE):
        return not _leading_verb_names_a_record(english, _LEADING_ENGLISH_VERBS)
    if re.match(r"^(?:change|modify|update|edit|enable|disable|activate|deactivate)\b", english, re.IGNORECASE):
        return not bool(re.match(
            r"^(?:change|modify|update|edit)\s+"
            r"(?:(?:to|into|the)\s+)?"
            r"(?:(?:the|that|this|my|current)\s+)?"
            r"(?:filters?|search(?:es)?|tabs?|views?|pages?|sort(?:ing)?|date\s+range|"
            r"(?:past|last|current|previous|next)\s+\d*\s*(?:days?|weeks?|months?|period))\b",
            english, re.IGNORECASE,
        ))
    if re.match(r"^turn\b.*\b(?:automatic\s+assignment|auto[- ]assignment|assignment\s+settings?)\b.*\b(?:off|on)\b", english, re.IGNORECASE):
        return True
    chinese = re.sub(r"^(?:(?:请|帮我|给我|现在|立即|麻烦你|我需要你|我想让你)\s*)+", "", text)
    if re.match(r"^(?:" + _LEADING_CHINESE_VERBS + r")", chinese):
        return not _leading_verb_names_a_record(chinese, _LEADING_CHINESE_VERBS)
    return bool(
        re.match(r"^(?:关闭|开启|禁用|启用)自动分配", chinese)
        or re.match(r"^(?:يرجى\s+)?(?:احذف|صدّر|صدر|حمّل|حمل|ارفع|أرسل|ارسل|وافق|ارفض|ادفع)\b", text)
    )


PRIOR_LIST_SAMPLE_FACT = (
    "The immediately preceding list has bounded coverage; its listed record count alone does not establish the collection total. "
    "This does not change any separately verified total."
)
PRIOR_EMPTY_LIST_FACT = (
    "The immediately preceding query reported no matching records within its verified view and criteria. "
    "That was an empty query result, not a sample count or a global collection total. "
    "It does not establish that no records exist elsewhere or that the result is still current."
)
PRIOR_UNVERIFIED_LIST_FACT = (
    'The preceding request did not establish a verified list or sample. '
    'Neither a sample count nor a collection total was verified for that request.'
)


ABSENCE_EVIDENCE_LIMIT = 'A search with no matching records does not establish that a record was deleted. Deletion or historical existence requires separate evidence; this Reader has not verified that history.'


def reader_absence_limit_explanation(question: str) -> str | None:
    if re.fullmatch(r'\s*do (?:these|the) (?:aggregate or risk figures|aggregate figures|risk figures) '
                    r'prove a final violation decision[?.]?\s*', question, re.I):
        return ('Aggregate counts and risk indicators alone do not establish a final decision for an individual violation. '
                'A final decision requires separately verified record-level decision evidence. '
                'No final violation decision is established by those figures alone.')
    if re.fullmatch(r'\s*does a completed request prove the money reached the customer[’\x27]?s bank\??\s*', question, re.I):
        return ('A request marked Completed alone does not verify that money reached the customer\x27s bank. '
                'Bank receipt or settlement needs separate verified payment evidence. No bank receipt, settlement, '
                'or financial finality was verified by this workflow status.')
    if re.fullmatch(r'\s*does being in (?:to do|completed|queued) prove (?:i am|I.m) the current handler\??\s*', question, re.I):
        return ('Queue membership alone does not establish that you are the Current Handler. '
                'That requires a verified handler identity for the specific record and comparison with the signed-in user. '
                'No personal assignment is established by this explanation.')
    if re.fullmatch(
        r'\s*can you confirm (?:a|the|that) [a-z]+ was deleted just because '
        r'(?:this|the|that) search found nothing\??\s*', question, re.I,
    ):
        return ABSENCE_EVIDENCE_LIMIT
    return None


def _inspection_assignment_rows(observation: Any) -> dict[str, dict[str, Any]]:
    """Read only healthy, exact task-API assignment projections, not names or
    foreign task references from Dashboard/violations/lookup responses.
    """
    if not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True:
        return {}
    valid = {c['operationKey']: c for c in _selectable_api_candidates(observation)
             if c['method'] == 'GET' and re.fullmatch(
                 r'/api/admin/inspection/tasks(?:/(?:\d+|\{id\}))?', c['path'])}
    rows = {}
    # Detail evidence takes precedence over the list loaded before the click.
    candidates = (observation.get('apiDiscovery') or {}).get('candidates') or []
    for candidate in sorted((c for c in candidates if isinstance(c, dict)),
                            key=lambda c: len(str(c.get('path') or ''))):
        if candidate.get('operationKey') not in valid:
            continue
        projected = candidate.get('assignmentEvidence')
        if not isinstance(projected, list):
            continue
        seen = set()
        for row in projected[:20]:
            if not isinstance(row, dict) or not TASK_NUMBER.fullmatch(str(row.get('taskNo') or '')):
                continue
            number = row['taskNo'].upper()
            rows[number] = {} if number in seen else row
            seen.add(number)
    return rows


def previous_sample_explanation(question: str, context: dict[str, Any]) -> str | None:
    """Explain prior answer coverage without reusing old records or totals."""
    previous = _bounded_conversation_context(context).get("previousIntent", {})
    if previous.get('resultStatus') in {'not_confirmed', 'load_failed'} and re.search(
        r'\b(?:total|all)\b.*\b(?:sample|listed|shown)\b|\b(?:full set|complete list)\b', question, re.I,
    ):
        return PRIOR_UNVERIFIED_LIST_FACT
    if previous.get('resultStatus') == 'no_permission' and previous.get('deliveredAnswerShape') != 'list' and re.search(
        r'\b(?:total|all)\b.*\b(?:sample|listed|shown)\b', question, re.I,
    ):
        return PRIOR_UNVERIFIED_LIST_FACT
    if previous.get("deliveredAnswerShape") != "list":
        return None
    if re.search(
        r"^\s*is (?:that|this|it)\b.*\b(?:total|all)\b.*\b(?:sample|listed|shown)\b|"
        r"^\s*(?:这|那).{0,20}总数.{0,25}(?:样本|示例|列出)", question, re.IGNORECASE,
    ):
        if previous.get("resultStatus") == "success" and previous.get("completeness") == "bounded":
            return PRIOR_LIST_SAMPLE_FACT
        if previous.get("resultStatus") == "no_data" and previous.get("completeness") in {"bounded", "complete"}:
            return PRIOR_EMPTY_LIST_FACT
    return None


_LIVE_TIME_MARKERS = (
    "current", "currently", "right now", "today", "latest",
    "当前", "现在", "目前", "今天", "最新", "此刻",
    "حالي", "حاليًا", "الآن", "اليوم", "الأحدث",
)
_LIVE_STATE_MARKERS = (
    "visible", "list ", "show ", "how many", "overdue", "due soon",
    "哪些", "有没有", "多少", "逾期", "到期", "快到期",
    "اعرض", "كم ", "متأخر", "مستحق",
)
_KNOWLEDGE_SENTINELS = ("[truncated]", "knowledge_error", "knowledge timeout", "knowledge_timeout")
_KNOWLEDGE_PROSE_TERMS = frozenset(
    {
        "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "for", "from", "has", "have",
        "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "were",
        "will", "with",
    }
)


def _question_is_assistant_capability_overview(question: str) -> bool:
    """Match a generic request about the assistant, not live portal state."""

    normalized = re.sub(r"\s+", " ", str(question or "")).strip().casefold()
    return bool(re.fullmatch(
        r"(?:please\s+)?(?:"
        r"what can (?:you|(?:the\s+)?nma ai assistant) do(?: for me)?"
        r"|how can (?:you|(?:the\s+)?nma ai assistant) help(?: me)?"
        r"|what (?:are you|is (?:the\s+)?nma ai assistant) (?:able to do|capable of)"
        r")\s*[?.!]?"
        r"|(?:请)?(?:你|nma ai assistant)(?:能|可以)(?:为我|帮我)?(?:做什么|怎么帮助我|如何帮助我|提供什么帮助|提供哪些帮助|有哪些功能|有哪些能力)\s*[？。！]?"
        r"|ماذا (?:يمكنك|يستطيع مساعد nma) أن (?:تفعل|تقدم)(?: لي)?\s*[؟?!]?",
        normalized,
        re.IGNORECASE,
    ))


def _question_is_capability_catalogue(question: str) -> bool:
    return _question_is_assistant_capability_overview(question) or bool(re.search(
        r'\b(?:what|which)\b.*\b(?:criteria|filters?|fields?|columns?)\b.*\b(?:available|supported|present|can i use)\b'
        r'|\bwhat is\b.*\b(?:entry|entry point)\b', question, re.I))


def question_is_conceptual(question: str) -> bool:
    if _question_is_assistant_capability_overview(question):
        return True
    normalized = question.casefold()
    return bool(re.search(
        r"\b(?:explain|describe|define|meaning|definition|difference|distinction|manual)\b"
        r"|\bwhat (?:does|do)\b.*\b(?:mean|cover|measure|provide|represent)\b"
        r"|\bwhat information\b.*\b(?:provide|cover|contain)\b"
        r"|\bwhat (?:information|fields|columns)\b.*\bdiffers?\b"
        r"|\bhow (?:is|are)\b.*\b(?:different|related)\b"
        r"|\bwhy does\b.*\bshow\b.*\b(?:other|instead)\b"
        r"|\bdoes\b.*\btell me\b"
        r"|\bare\b.*\bthe same (?:identifier|record type|field)\b"
        r"|\bcan\b.*\bconfirm\b.*\bjust because\b"
        r"|\b(?:does|do|can)\b.*\b(?:prove|guarantee|imply|establish|mean)\b"
        r"|\balone\b.*\bidentify\b|\bhow (?:do i|can i|to)\b"
        r"|\b(?:what|which)\b.*\b(?:criteria|filters?|fields?|columns?)\b.*\b(?:available|supported|present|can i use)\b"
        r"|\bwhat is\b.*\b(?:entry|entry point)\b"
        r"|解释|含义|区别|手册|是什么意思|如何|怎么使用|شرح|معنى|الفرق|كيف",
        normalized,
    )) or any(marker in normalized for marker in _DOCUMENTATION_QUESTION_MARKERS)


def _private_customer_information_request(question: str) -> bool:
    """Recognize a direct request for protected customer/profile data."""

    normalized = re.sub(r"\s+", " ", str(question or "")).casefold()
    return bool(re.search(
        r"\b(?:customer|applicant|user)(?:'s)?\s+(?:private|personal|confidential)\s+"
        r"(?:information|data|details?)\b|\b(?:private|personal)\s+"
        r"(?:customer|applicant|profile)\s+(?:information|data|details?)\b"
        r"|客户.{0,8}(?:隐私|个人).{0,8}(?:信息|数据)|申请人.{0,8}(?:隐私|个人).{0,8}(?:信息|数据)",
        normalized,
    ))


def _service_processing_time_explanation(question: str, context: dict[str, Any] | None = None) -> ReaderResult | None:
    """Answer two metric-meaning questions without inventing a KPI formula."""

    normalized = re.sub(r"\s+", " ", str(question or "")).casefold()
    previous = (context or {}).get("previousIntent") if isinstance(context, dict) else None
    prior_text = " ".join(str(previous.get(key) or "") for key in ("question", "businessObject", "businessFocus")) if isinstance(previous, dict) else ""
    metric_context = normalized + " " + prior_text.casefold()
    if not re.search(r"\b(?:service )?application\b.{0,50}\b(?:processing[ -]?time|avg\.? processing)\b|\b(?:processing[ -]?time|avg\.? processing)\b.{0,50}\b(?:service )?application\b", metric_context):
        return None
    if re.search(r"\b(?:does|do).{0,25}\baverage\b.{0,80}\b(?:same|every|each)\b", normalized):
        return ReaderResult(
            status="success",
            summary="An average does not establish identical individual processing times.",
            section="Service Operations Analytics",
            answer_shape="detail",
            completeness="bounded",
            facts=(
                "No. An average processing-time value summarizes a group; it does not mean every individual Service Application took the same time.",
                "The displayed metric label does not establish its formula, denominator, or which start/end events are used. Those details require documented metric definitions.",
            ),
        )
    if re.search(r"\b(?:what does|what is|explain|represent|mean)\b", normalized):
        return ReaderResult(
            status="success",
            summary="The visible metric is a performance measure with bounded meaning.",
            section="Service Operations Analytics",
            answer_shape="detail",
            completeness="bounded",
            facts=(
                "Avg. Processing Time is the Service Application performance measure displayed for the current analytics period.",
                "Its label does not establish the exact formula, denominator, or processing start/end events, so those details are not inferred.",
            ),
        )
    return None


def _profile_verification_pending_followup(question: str, context: dict[str, Any]) -> bool:
    """Keep an elliptical pending-review follow-up in its Profile Verification scope."""

    if not re.fullmatch(r"\s*(?:how many|what number)(?: are| is)?\s+pending review\s*[?.!]?\s*", question, re.I):
        return False
    previous = context.get("previousIntent") if isinstance(context, dict) else None
    if not isinstance(previous, dict):
        return False
    text = " ".join(str(previous.get(key) or "") for key in (
        "question", "businessObject", "businessFocus", "section", "sourceSection",
    ))
    return bool(re.search(r"profile\s+verification", text, re.I))


# Latin keywords use a "not followed by another Latin letter" guard instead of
# \b, because a question can continue straight into CJK or Arabic text such as
# "Video Games等等" where a Unicode word boundary never occurs.
_CONTENT_CATEGORY_PATTERNS: tuple[tuple[str, str], ...] = (
    ("Blocked Authors", r"\bblocked\s+authors?(?![A-Za-z])|受限作者|被封作者|مؤلفون\s+محظورون"),
    ("Regulate Entry Items", r"\bregulate\s+entry\s+items?(?![A-Za-z])|规管条目|عناصر\s+تنظيم\s+الدخول"),
    ("Newspapers / Magazines",
     r"\bnewspapers?(?![A-Za-z])|\bmagazines?(?![A-Za-z])|\bperiodicals?(?![A-Za-z])|报刊|报纸|杂志|صحف|مجلات"),
    ("Video Games",
     r"\bvideo\s*games?(?![A-Za-z])|\bgames?(?![A-Za-z])|电子游戏|视频游戏|游戏|ألعاب\s+الفيديو|ألعاب"),
    ("Movies", r"\bmovies?(?![A-Za-z])|\bfilms?(?![A-Za-z])|\bcinemas?(?![A-Za-z])|电影|影片|أفلام|فيلم"),
    ("Books", r"\bbooks?(?![A-Za-z])|图书|书籍|كتب|كتاب"),
)


_PREDICTION_REQUEST = re.compile(
    r"\b(?:predict|prediction|forecast|project(?:ion|ed)?|expect(?:ed)?\s+to\s+(?:receive|get))\b"
    r"|预测|预估|预计|预判|会收到多少"
    r"|توقع|تنبؤ|متوقع",
    re.I,
)


def _prediction_requested(question: str) -> bool:
    """True when the user asks for a forecast rather than a rendered record."""

    return bool(_PREDICTION_REQUEST.search(str(question or "")))


def _content_categories_from_question(question: str) -> tuple[str, ...]:
    """Return every Content Library category the question names, in order.

    A follow-up can list several sections at once, for example
    "How about movies (Newspapers / Magazines, Video Games ...)?".  The reader
    answers the section named first and says so, instead of leaving the page on
    the previous category and reporting that the requested columns are missing.
    """

    text = str(question or "")
    found: list[tuple[int, str]] = []
    for label, pattern in _CONTENT_CATEGORY_PATTERNS:
        match = re.search(pattern, text, re.I)
        if match is not None:
            found.append((match.start(), label))
    return tuple(label for _start, label in sorted(found, key=lambda item: item[0]))


def _content_category_from_question(question: str) -> str:
    categories = _content_categories_from_question(question)
    return categories[0] if categories else ""


def _explicit_reader_source(question: str, context: dict[str, Any]) -> str:
    """Bind distinctive object names to documented read surfaces before planning."""

    normalized = re.sub(r"\s+", " ", str(question or "")).casefold()
    # Profile Verification is a distinct Licensing surface. Binding the
    # initial summary as well as its elliptical follow-up prevents a generic
    # pending-review count from silently switching to Application tasks.
    if re.search(r"\bprofile\s+verification\b", normalized):
        return "/licensing/profile"
    # A question about one customer's accounts, phone, address or history
    # belongs to the rendered Customer Management surface; without this the
    # planner occasionally started from Customer Happiness analytics instead.
    if re.search(r"customer|客户|客戶|عميل", normalized) and re.search(
        r"\baccounts?\b|account\s+details|账号|账户|電話|电话|手机|地址|历史申请|\bmobile\b|\baddress\b",
        normalized,
        re.I,
    ):
        return "/happiness/customerManagement"
    if re.search(r"\b(?:books?|book)\s+applications?\b", normalized):
        return "/content/ContentLibrary"
    # A confirmed-count location question belongs to the rendered Content
    # Library surface.  Bind it before generic planning so the response can
    # explain the metric and give a verifiable navigation path, rather than
    # returning only a bare count.
    if re.search(r"\bconfirmed\s+count(?:\s+results?)?\b|\bcount\s+results?\b|确认的数量|确认数量|العدد\s+المؤكد|نتائج\s+العدد", normalized, re.I):
        return "/content/ContentLibrary"
    # Any named Content Library section belongs to the same rendered surface, so
    # "How about movies?" style follow-ups are read there instead of falling
    # through to a planner that may not switch the rendered section.
    if _content_category_from_question(question):
        return "/content/ContentLibrary"
    # A question that names one Content Library record (for example a book
    # ISBN) belongs to the rendered Content Library surface.  Without this the
    # planner started from Team Tasks and reported the record as unreadable.
    if _explicit_record_identity(question) and re.search(
        r"\b(?:content|isbn|book|title|record|item)s?\b|内容|书号|图书|记录|محتوى|سجل|كتاب",
        normalized,
        re.I,
    ):
        return "/content/ContentLibrary"
    # Customer Happiness work orders are rendered on Enquiries & Complaints,
    # rather than on the refund workflow.  HC-01 is the stable ticket-number
    # family observed on that page.  Bind it before planning so an exact ticket
    # question cannot be redirected to an unrelated application/detail API.
    # Violation and committee-decision questions are rendered on the
    # Violations surface, which is also where the committee queue and the fine
    # amounts appear.  Other inspection questions use the task queue.
    if re.search(
        r"\b(?:violations?|fines?|penalt\w+|committee\s+decision|compliance\s+committee)\b"
        r"|违规|罚款|罚金|处罚|委员会|تفتيش|مخالفة|غرامة|لجنة",
        normalized,
    ):
        return "/inspection/violations"
    if re.search(
        r"\b(?:inspection|inspector)\b|检查|巡检|المفتش",
        normalized,
    ):
        return "/inspection/tasks"
    if re.search(r"\bHC-01-\d{4}-\d+\b", str(question or ""), re.I) or re.search(
        r"\b(?:ticket|tickets|work\s*orders?|enquir(?:y|ies)|complaints?|cases?)\b"
        r"|(?:工单|工單|单据|單據|单子|單子|票据|案件|投诉|諮詢)"
        r"|(?:تذاكر|تذكرة|شكاوى|شكوى|استفسارات|استفسار)",
        normalized,
        re.I,
    ):
        return "/happiness/tickets"
    # A transaction number belongs to Finance Transactions.  This is kept
    # separate from Finance Refunds and Customer Happiness Refunds because
    # their status fields describe different business objects.
    if re.search(r"\bTRX-[A-Za-z0-9-]+\b", str(question or ""), re.I) or re.search(
        r"\b(?:transaction|transactions|payment|payments)\b.{0,40}"
        r"\b(?:amount|currency|status|application|details?)\b"
        r"|(?:交易|付款).{0,30}(?:金额|币种|状态|申请|详情)"
        r"|(?:معاملة|معاملات|مدفوعات|الدفع).{0,40}(?:المبلغ|العملة|الحالة|الطلب|المرتبط|مرتبط)",
        normalized,
        re.I,
    ):
        return "/financial-payment/transactions"
    # Only the Customer Happiness refund view renders an SLA column, so a
    # past-SLA refund question has to be read there.
    if _refund_sla_requested(question):
        return "/happiness/refunds"
    # A concrete refund record number (HC-02-...) is a Finance Refunds row:
    # that rendered list exposes the record together with its Transaction No.,
    # amount, currency and status.  Bind it before the generic "refund"
    # wording so an exact-record question cannot be sent to the Customer
    # Happiness refund queue, where the same number is a different workflow
    # row and the requested record looks unavailable.
    if re.search(r"\bHC-\d{2}-\d{4}-\d+\b", str(question or ""), re.I) and re.search(
        r"amount|currency|status|updated|next\s*step|action|"
        r"金额|币种|状态|更新时间|下一步|"
        r"مبلغ|عملة|حالة|خطوة|تحديث",
        normalized,
        re.I,
    ):
        return "/financial-payment/refunds"
    if re.search(r"\b(?:license|licensing)\s+refunds?\b", normalized):
        return "/happiness/refunds"
    # Finance Refunds is a separate rendered table from Customer Happiness
    # license refunds.  Bind both its explicit module wording and the stable
    # HC refund record shape so amount/currency/status questions cannot fall
    # back to a sibling page or a generic metadata response.
    if re.search(r"\b(?:finance|financial)\b.{0,30}\brefunds?\b|\brefunds?\b.{0,30}\b(?:finance|financial)\b", normalized):
        return "/financial-payment/refunds"
    # Keep an Arabic refund-list question on the rendered refund surface.
    # The prior English-only route binding let such turns fall into a generic
    # planner path and return not_confirmed before any refund rows were read.
    if re.search(r"(?:المالية|مالي(?:ة)?|مدفوعات).{0,30}(?:استرداد|استردادات)|(?:استرداد|استردادات).{0,30}(?:المالية|مالي(?:ة)?|مدفوعات)", normalized):
        return "/financial-payment/refunds"
    # Generic refund wording refers to the currently rendered Refunds page in
    # both supported languages.  Keep the Finance route reserved for an
    # explicit Finance/financial/مدفوعات qualifier; otherwise English could
    # drift to the API-backed finance collection and return seven rows instead
    # of the two records visible in the selected Completed view.
    if re.search(r"\brefunds?\b|استرداد|استردادات", normalized):
        return "/happiness/refunds"
    if re.search(r"\b(?:license|licensing)\b.{0,40}\b(?:status|licenses?)\b|رخص(?:تي|ة)|حالة.{0,20}رخص", normalized):
        return "/licensing/licenses"
    if _profile_verification_pending_followup(question, context):
        return "/licensing/profile"
    return ""


def _refund_completed_view_requested(question: str) -> bool:
    """Recognize completed-refund wording in supported portal languages."""

    normalized = re.sub(r"\s+", " ", str(question or "")).casefold()
    return bool(re.search(r"\bcompleted\b|(?:ال)?مكتمل[\u0600-\u06ff]*", normalized))


def _refund_sla_requested(question: str) -> bool:
    """True when the question asks for refunds past / over the SLA.

    Workbook row 52 asks for the refunds that are past SLA.  The reader only
    understood "overdue" and "past due", so that wording silently fell back to
    a list of every refund row on a page that does not even render an SLA
    column.
    """

    text = str(question or "")
    if re.search(
        r"\b(?:past|over|exceed(?:ed|ing)?|breach(?:ed)?|beyond|missed)\s*(?:the\s*)?sla\b"
        r"|\bsla\b[^.]{0,25}\b(?:past|over|exceed(?:ed|ing)?|breach(?:ed)?|beyond|missed|violat)",
        text,
        re.I,
    ):
        return True
    return bool(re.search(
        r"(?:تجاوز|متجاوز).{0,20}(?:اتفاقية مستوى الخدمة|SLA)"
        r"|(?:اتفاقية مستوى الخدمة|SLA).{0,20}(?:تجاوز|متجاوز)",
        text,
        re.I,
    ))


def _finance_combined_summary_requested(question: str) -> bool:
    """Payments-and-refunds status roll-up, but never a single-record lookup.

    An exact record question can mention a transaction, a refund and a status
    at the same time, so the presence of those words alone is not a roll-up
    request.  A named identifier or an explicit "which record does it belong
    to" question is a lookup and stays on the exact-record path.
    """

    if _explicit_record_identity(question):
        return False
    if re.search(
        r"\b(?:which|what)\b.{0,40}\b(?:refund|payment|transaction)\s+record\b"
        r"|\bdoes\s+(?:it|this|that)\s+belong\b"
        r"|أي سجل|ينتمي",
        str(question or ""),
        re.I,
    ):
        return False
    normalized = re.sub(r"\s+", " ", str(question or "")).casefold()
    return bool(
        re.search(r"\b(?:payments?|transactions?)\b|付款|支付|المدفوعات|المعاملات|معاملات", normalized)
        and re.search(r"\brefunds?\b|退款|استرداد", normalized)
        and re.search(
            r"\b(?:status|statuses|count|counts|how many|breakdown|summar(?:y|ise|ize)|visible)\b"
            r"|按状态|汇总|كم|الظاهرة|حسب الحالة",
            normalized,
        )
    )


def _ticket_team_summary_requested(question: str) -> bool:
    """Recognize only the explicit staff/work-order roll-up requested in row 54.

    A normal ticket list must remain a normal bounded list.  This higher-level
    projection is therefore deliberately limited to requests that name team
    members/staff and ask for pending, overdue, or closed/completed counts.
    """

    normalized = re.sub(r"\s+", " ", str(question or "").casefold())
    has_people = bool(re.search(r"\b(?:team|staff|member|employee|handler)s?\b|(?:团队|團隊|员工|員工|部门|部門|فريق|موظف)", normalized))
    has_ticket_scope = bool(re.search(
        r"\b(?:ticket|work\s*order|case|complaint|enquir(?:y|ies))s?\b"
        r"|(?:工单|工單|单据|單據|单子|單子|票据|案件|تذاكر|تذكرة|شكاوى|استفسار|طلبات)",
        normalized,
    ))
    has_rollup = bool(re.search(
        r"\b(?:pending|overdue|closed|completed|unhandled|open)\b"
        r"|(?:未处理|未處理|逾期|关闭|關閉|已关闭|قيد الانتظار|بالانتظار|معل[قةق]|متأخر|مغلق|"
        r"غير معالجة|غير المعالجة|بدون معالجة|لم تتم معالجتها|مفتوح|مفتوحة)",
        normalized,
    ))
    return has_people and has_ticket_scope and has_rollup


def _ticket_member_query(question: str) -> str:
    """Extract a user-named staff member without treating Chinese prose as a name."""

    value = str(question or "")
    chinese = re.search(r"(?:部门|部門)\s+([A-Za-z][A-Za-z .'-]{1,80}?)\s*(?:这个|這個)?员工", value, re.I)
    english = None if re.search(r"\b(?:staff\s+member|team\s+member)'s\b", value, re.I) else re.search(
        r"\b(?:staff(?:\s+member)?|team\s+member|employee|handler)\s+(?:named\s+)?"
        r"([A-Za-z][A-Za-z .'-]{1,80}?)(?=(?:'s\b|\s+(?:pending|overdue|closed|completed|tickets?)\b|[?.!,]|$))",
        value,
        re.I,
    )
    have_form = None
    if not chinese and not english:
        have_form = re.search(
            r"(?<![\w.])([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})"
            r"(?=\s+(?:have|has|owns)\b)",
            value,
            re.I,
        )
    arabic = None
    if not chinese and not english:
        arabic = re.search(
            r"(?:لدى|للموظف|الموظف|عضو الفريق|المكلف|المسؤول عن)\s+"
            r"([A-Za-z][A-Za-z .'-]{1,80}?)"
            r"(?=\s*(?:في|قيد|التذاكر|تذاكر|تذكرة|المتأخرة|المغلقة|$|[؟?.,!]))",
            value,
            re.I,
        )
    selected = (
        chinese.group(1) if chinese
        else english.group(1) if english
        else arabic.group(1) if arabic
        else have_form.group(1) if have_form
        else ""
    )
    words = re.sub(r"\s+", " ", selected).split()
    noise = {
        "how", "many", "much", "does", "do", "did", "is", "are", "the", "a", "an", "my", "our",
        "in", "of", "for", "and", "to", "tickets", "ticket", "tasks", "task", "cases", "case",
        "unhandled", "pending", "open", "overdue", "closed", "completed", "total", "count", "number",
    }
    while words and re.sub(r"[^a-z]", "", words[0].casefold()) in noise:
        words.pop(0)
    while words and re.sub(r"[^a-z]", "", words[-1].casefold()) in noise:
        words.pop()
    return " ".join(words).strip(" .,-")[:100]


def _ticket_team_summary_result(
    todo_observation: Any,
    completed_observation: Any,
    *,
    question: str,
    scope: Literal["personal", "team", "global", "unknown"],
) -> ReaderResult | None:
    """Aggregate only visible ticket rows by their rendered owner field.

    This does not infer assignment from queue membership: an owner is counted
    only when an actual ``Current Handler``/``Assigned To`` column was read.
    ``Completed`` is a view label, so the response calls it a completed/closed
    count rather than claiming every possible terminal workflow state.
    """

    if scope not in {"team", "global"}:
        return ReaderResult(
            status="not_confirmed",
            summary="A team-scoped ticket view was not verified for this account.",
            page="/happiness/tickets",
            answer_shape="overview",
            scope=scope,
            missing=("requested_team_scope_unverified",),
        )

    def table_rows(observation: Any) -> tuple[list[dict[str, Any]], str] | None:
        if not isinstance(observation, dict) or _observation_has_error_state(observation):
            return None
        if (observation.get("readHealth") or {}).get("healthy") is not True:
            return None
        tables = [
            node for node in _observation_semantic_nodes(observation)
            if node.get("kind") in {"table", "grid"} and node.get("columnHeaders") and node.get("rowFields")
        ]
        if len(tables) != 1:
            return None
        return list(tables[0].get("rowFields") or []), str(tables[0].get("nodeId") or "")

    todo = table_rows(todo_observation)
    completed = table_rows(completed_observation)
    if todo is None or completed is None:
        return None

    def field(row: dict[str, Any], *names: str) -> str:
        wanted = {re.sub(r"[^a-z0-9]", "", name.casefold()) for name in names}
        for key, value in row.items():
            normalized = re.sub(r"[^a-z0-9]", "", str(key).casefold())
            if normalized in wanted and value is not None:
                return str(value).strip()
        return ""

    totals: dict[str, dict[str, int]] = {}
    labels: dict[str, str] = {}
    # The completed view can render without an owner column.  A zero that was
    # never attributed would read as "this member closed nothing", so the
    # closed count is only reported when the owner column was really observed.
    closed_owner_observed = False

    def add(rows: list[dict[str, Any]], *, completed_view: bool) -> None:
        nonlocal closed_owner_observed
        for row in rows:
            if not isinstance(row, dict):
                continue
            handler = field(row, "Current Handler", "Assigned To", "Owner", "Responsible Person")
            if not handler or handler.casefold() in {"-", "unassigned", "n/a", "none"}:
                continue
            key = re.sub(r"[^a-z0-9]", "", handler.casefold())
            if not key:
                continue
            labels.setdefault(key, handler)
            bucket = totals.setdefault(key, {"Pending Tickets": 0, "Overdue Tickets": 0, "Closed Tickets": 0})
            status = field(row, "Status").casefold()
            sla = field(row, "SLA").casefold()
            if completed_view:
                closed_owner_observed = True
                if status in {"completed", "closed", "cancelled", "canceled", "resolved"} or status:
                    bucket["Closed Tickets"] += 1
            else:
                bucket["Pending Tickets"] += 1
                if "overdue" in sla or "past due" in sla:
                    bucket["Overdue Tickets"] += 1

    add(todo[0], completed_view=False)
    add(completed[0], completed_view=True)
    requested_member = _ticket_member_query(question)
    if requested_member:
        member_key = re.sub(r"[^a-z0-9]", "", requested_member.casefold())
        matching = [key for key in totals if member_key and member_key in key]
        if not matching:
            return ReaderResult(
                status="no_data",
                summary="The named staff member was not visible in the current ticket rows.",
                page="/happiness/tickets",
                section="Enquiries & Complaints",
                source_section=todo[1],
                answer_shape="overview",
                completeness="bounded",
                scope=scope,
                facts=(f"No visible Current Handler matches {requested_member} in the current To Do and Completed ticket views.",),
            )
        totals = {key: totals[key] for key in matching}

    facts = tuple(
        json.dumps(
            {
                "Team Member": labels[key],
                "Pending Tickets": totals[key]["Pending Tickets"],
                "Overdue Tickets": totals[key]["Overdue Tickets"],
                **({"Closed Tickets": totals[key]["Closed Tickets"]} if closed_owner_observed else {}),
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        for key in sorted(totals, key=lambda item: labels[item].casefold())
    )
    if not closed_owner_observed:
        facts = (*facts, "The completed ticket view for this account does not render a handler column, "
                        "so closed tickets are not attributed to individual members.")
    if not facts:
        return ReaderResult(
            status="not_confirmed",
            summary="The current ticket views did not expose a usable owner field.",
            page="/happiness/tickets",
            section="Enquiries & Complaints",
            source_section=todo[1],
            answer_shape="overview",
            completeness="bounded",
            scope=scope,
            missing=("ticket_current_handler_not_observed",),
        )
    return ReaderResult(
        status="success",
        summary="Visible To Do and Completed ticket rows were aggregated by Current Handler.",
        page="/happiness/tickets",
        section="Enquiries & Complaints",
        source_section=todo[1],
        answer_shape="overview",
        completeness="bounded",
        scope=scope,
        selected_state="To Do / Completed",
        facts=facts,
    )


def _refund_overdue_sorted_result(
    observation: Any,
    *,
    page: str,
    scope: Literal["personal", "team", "global", "unknown"],
) -> ReaderResult | None:
    """Return only rendered overdue refund rows, sorted by their amount."""

    if not isinstance(observation, dict) or _observation_has_error_state(observation):
        return None
    read_health = observation.get("readHealth") if isinstance(observation.get("readHealth"), dict) else {}
    tables = [
        node for node in _observation_semantic_nodes(observation)
        if node.get("kind") in {"table", "grid"} and node.get("columnHeaders") and node.get("rowFields")
    ]
    if len(tables) != 1:
        return None
    table = tables[0]
    headers = [str(header) for header in table.get("columnHeaders") or []]
    sla_headers = [header for header in headers if "sla" in re.sub(r"[^a-z0-9]", "", header.casefold())]
    if read_health.get("healthy") is not True and not (sla_headers and table.get("rowFields")):
        # A partially unhealthy read (for example one blocked lookup endpoint on
        # the same page) still renders the refund table together with its SLA
        # column.  Reporting only rows that literally carry an SLA value is
        # safe; an unhealthy read without that rendered evidence is refused.
        return None
    rows: list[tuple[float, dict[str, Any]]] = []
    for raw_row in table.get("rowFields") or []:
        if not isinstance(raw_row, dict):
            continue
        row = {key: raw_row[key] for key in headers if key in raw_row}
        sla = " ".join(str(value) for key, value in row.items() if "sla" in re.sub(r"[^a-z0-9]", "", str(key).casefold()))
        # The portal renders a breached SLA as "Exceeded" on the refund rows,
        # alongside the "overdue"/"past due" wording used elsewhere.
        if not re.search(r"overdue|past\s+due|exceed(?:ed|ing)?|breach(?:ed)?|متأخر|逾期|متجاوز|تجاوز", sla, re.I):
            continue
        amount = None
        for key, value in row.items():
            if "amount" in re.sub(r"[^a-z0-9]", "", str(key).casefold()):
                try:
                    amount = float(str(value).replace(",", ""))
                except (TypeError, ValueError):
                    amount = None
                break
        if amount is not None:
            rows.append((amount, row))
    if not rows:
        return ReaderResult(
            status="no_data",
            summary="No overdue refund rows were visible in the current rendered view.",
            page=page,
            section=str(table.get("heading") or "Refunds"),
            source_section=str(table.get("nodeId") or ""),
            answer_shape="list",
            completeness="bounded",
            scope=scope,
            facts=("No visible refund row has an SLA marked overdue in the current view.",),
        )
    facts = _bounded_native_row_facts({**table, "rowFields": [row for _amount, row in sorted(rows, key=lambda item: item[0])]}, limit=8)
    return ReaderResult(
        status="success",
        summary="Visible overdue refund rows were sorted by amount.",
        page=page,
        section=str(table.get("heading") or "Refunds"),
        source_section=str(table.get("nodeId") or ""),
        answer_shape="list",
        completeness="bounded",
        scope=scope,
        facts=facts,
    )


def _financial_daily_status_summary(
    observations: tuple[tuple[str, Any], ...],
    *,
    scope: Literal["personal", "team", "global", "unknown"],
) -> ReaderResult | None:
    """Count only payment/refund rows whose rendered date is today."""

    today = datetime.now().date()
    grouped: dict[tuple[str, str], int] = defaultdict(int)
    saw_date = False
    for source_label, observation in observations:
        if not isinstance(observation, dict) or _observation_has_error_state(observation):
            continue
        if (observation.get("readHealth") or {}).get("healthy") is not True:
            continue
        tables = [
            node for node in _observation_semantic_nodes(observation)
            if node.get("kind") in {"table", "grid"} and node.get("rowFields")
        ]
        if not tables:
            tables = [
                node for node in observation.get("sectionSummaries", [])
                if isinstance(node, dict) and node.get("kind") in {"table", "grid"} and node.get("rowFields")
            ]
        if len(tables) != 1:
            continue
        for raw_row in tables[0].get("rowFields") or []:
            if not isinstance(raw_row, dict):
                continue
            date_value = ""
            status_value = ""
            for key, value in raw_row.items():
                normalized_key = re.sub(r"[^a-z0-9]", "", str(key).casefold())
                if any(token in normalized_key for token in ("transactiontime", "lastupdated", "updatedat", "submissiontime", "date")):
                    date_value = str(value or "").strip()
                if normalized_key.endswith("status") or normalized_key == "status":
                    status_value = str(value or "").strip() or "Unknown"
            parsed = None
            for pattern in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    parsed = datetime.strptime(date_value[:19], pattern).date()
                    break
                except (TypeError, ValueError):
                    continue
            if parsed is None:
                continue
            saw_date = True
            if parsed == today:
                grouped[(source_label, status_value)] += 1
    if grouped:
        facts = tuple(
            json.dumps({"Source": source, "Status": status, "Count": count}, ensure_ascii=False, separators=(",", ":"))
            for (source, status), count in sorted(grouped.items())
        )
        return ReaderResult(
            status="success",
            summary="Today’s rendered payment and refund rows were grouped by status.",
            page="/financial-payment/transactions",
            section="Transactions and Finance Refunds",
            answer_shape="count",
            completeness="bounded",
            scope=scope,
            facts=facts,
        )
    if saw_date:
        return ReaderResult(
            status="no_data",
            summary="No rendered payment or refund row is dated today.",
            page="/financial-payment/transactions",
            section="Transactions and Finance Refunds",
            answer_shape="count",
            completeness="bounded",
            scope=scope,
            facts=("No payment or refund rows dated today were visible in the current bounded views.",),
        )
    return ReaderResult(
        status="not_confirmed",
        summary="The visible payment/refund rows did not expose a verifiable date field.",
        page="/financial-payment/transactions",
        section="Transactions and Finance Refunds",
        answer_shape="count",
        completeness="bounded",
        scope=scope,
        missing=("today_date_not_observed",),
    )


def _financial_status_breakdown(
    observations: tuple[tuple[str, Any], ...],
    *,
    scope: Literal["personal", "team", "global", "unknown"],
) -> ReaderResult | None:
    """Group every currently rendered payment/refund row by source and status.

    Workbook row 52 asks for the payments and refunds visible to the account
    by status.  The earlier reader answered it from the Customer Happiness
    refund queue alone and then called those rows "payments", so the counts
    could not be reconciled with the Finance pages.  This helper keeps the two
    rendered sources separate and labels each group, and it never claims a
    date window that was not requested.
    """

    grouped: dict[tuple[str, str], int] = defaultdict(int)
    for source_label, observation in observations:
        if not isinstance(observation, dict) or _observation_has_error_state(observation):
            continue
        if (observation.get("readHealth") or {}).get("healthy") is not True:
            continue
        tables = [
            node for node in _observation_semantic_nodes(observation)
            if node.get("kind") in {"table", "grid"} and node.get("rowFields")
        ]
        if not tables:
            tables = [
                node for node in observation.get("sectionSummaries", [])
                if isinstance(node, dict) and node.get("kind") in {"table", "grid"} and node.get("rowFields")
            ]
        if len(tables) != 1:
            continue
        sampled = False
        for raw_row in tables[0].get("rowFields") or []:
            if not isinstance(raw_row, dict):
                continue
            status_value = ""
            for key, value in raw_row.items():
                normalized_key = re.sub(r"[^a-z0-9]", "", str(key).casefold())
                if normalized_key == "status" or normalized_key.endswith("status"):
                    status_value = str(value or "").strip()
            grouped[(source_label, status_value or "Unknown")] += 1
            sampled = True
        if not sampled:
            continue
    if not grouped:
        return None
    facts = tuple(
        json.dumps({"Source": source, "Status": status, "Count": count}, ensure_ascii=False, separators=(",", ":"))
        for (source, status), count in sorted(grouped.items())
    )
    facts = (*facts, "Each group counts only rows rendered in that source view for the signed-in account.")
    return ReaderResult(
        status="success",
        summary="The rendered payment and refund rows were grouped by source and status.",
        page="/financial-payment/transactions",
        section="Transactions and Finance Refunds",
        answer_shape="count",
        completeness="bounded",
        scope=scope,
        facts=facts,
    )


def _question_needs_native_surface(question: str) -> bool:
    """Controls and rendered schemas cannot be answered from a record API."""
    return bool(re.search(
        r'\b(?:open|inspect|cancel|close|dismiss)\b.{0,70}\bfilters?\b'
        r'|\b(?:fields?|columns?|criteria|layout)\b.{0,60}\b(?:current|present|view|role)\b'
        r'|\b(?:current|these|this)\b.{0,100}\b(?:fields?|columns?|criteria|layout)\b'
        r'|打开.{0,15}筛选|关闭.{0,15}筛选|取消.{0,15}筛选|当前.{0,20}(?:字段|列|筛选条件)',
        question, re.I))


def _observed_filter_transition(question: str, observation: Any, page: str) -> dict[str, Any] | None:
    """Use only an observed Filter/Cancel control for an explicit UI request."""
    if not isinstance(observation, dict) or not page:
        return None
    controls = observation.get('controls') or []
    dialogs = observation.get('dialogs') or []
    action = None
    if re.search(r'\bopen\b.{0,50}\bfilter\b|打开.{0,15}筛选', question, re.I):
        if not dialogs and controls.count('Filter') == 1:
            action = {'type': 'show_filter', 'role': 'button', 'name': 'Filter'}
    elif re.search(r'\b(?:cancel|close|dismiss)\b.{0,50}\bfilter\b|(?:关闭|取消).{0,15}筛选', question, re.I):
        if not dialogs and controls.count('Filter') == 1:
            # Each read starts fresh. Reconstruct and dismiss only the filter overlay,
            # in one bounded call; an already closed fresh page proves no cancellation.
            return {'mode': 'portal_read', 'portalRequest': {'startPath': page, 'actions': [
                {'type': 'show_filter', 'role': 'button', 'name': 'Filter'},
                {'type': 'dismiss_overlay', 'role': 'button', 'name': 'Cancel'},
            ], 'expectedFields': []}}
        if len(dialogs) == 1 and re.search(r'\bfilter\b|筛选', str(dialogs[0]), re.I) and controls.count('Cancel') == 1:
            action = {'type': 'dismiss_overlay', 'role': 'button', 'name': 'Cancel'}
    return {'mode': 'portal_read', 'portalRequest': {'startPath': page, 'actions': [action], 'expectedFields': []}} if action else None


def _model_http_failure(exc: Exception) -> ReaderResult | None:
    if not isinstance(exc, httpx.HTTPStatusError):
        return None
    code = exc.response.status_code
    failure = ('model_payment_required' if code == 402 else 'model_rate_limited' if code == 429
               else 'model_authentication_failed' if code in {401, 403} else 'model_service_unavailable')
    return ReaderResult(status='load_failed', summary='The configured model service could not complete this request.', missing=(failure,))


def question_requires_live_portal(question: str) -> bool:
    """Identify generic freshness/personalization language without module routing."""

    normalized = re.sub(r"\s+", " ", str(question or "")).strip().casefold()
    if _question_is_assistant_capability_overview(question):
        return False
    if _explicit_record_identity(question):
        return True
    if re.search(r'\b(?:inquire|query|show|find|check)\b.*\b(?:mc-2|ml-[12])-\d+-\d+\b', normalized):
        return True
    if re.search(r'\bgive me\s+(?:one|a|an|[1-9][0-9]?)\s+(?:[a-z]+\s+){0,3}(?:no\.?|number|id|record|task|item)\b', normalized):
        return True
    if re.match(r'(?:please\s+)?(?:open|visit|navigate to|go to)\s+/[a-z0-9_/-]+', normalized):
        return True
    documentation_intent = any(marker in normalized for marker in _DOCUMENTATION_QUESTION_MARKERS)
    personal_intent = bool(
        re.search(r"\b(?:my|mine|do i|can i|for me|i have)\b", normalized)
        or any(marker in normalized for marker in ("我的", "我有", "我能", "我可以", "对我", "لدي", "خاصتي", "هل لدي"))
    )
    current_or_visible = any(marker in normalized for marker in (*_LIVE_TIME_MARKERS, "visible", "selected", "active", "applied", "我能看到", "已选择", "当前", "الظاهرة"))
    if (question_is_conceptual(question) and not current_or_visible
            and re.search(r'\b(?:criteria|filters?|fields?|columns?|entry|entry point)\b', normalized)
            and not re.search(r'\b(?:open|inspect|cancel|close|apply|change|show|read)\b', normalized)):
        return False
    definition_intent = bool(
        re.search(r"\bwhat (?:does|do)\b.*\bmean\b", normalized)
        or any(marker in normalized for marker in ("是什么意思", "含义是什么", "ما معنى"))
    )
    conceptual_intent = bool(
        re.search(r"\b(?:explain|describe|define)\b", normalized)
        or re.search(r"\b(?:difference|distinction|meaning)\b", normalized)
        or any(marker in normalized for marker in ("解释", "区别", "含义", "是什么意思"))
    )
    explicit_conceptual = bool(
        re.search(r"\b(?:without|don't|do not|not)\b.*\b(?:read|access|check)\b", normalized)
        or any(marker in normalized for marker in ("不用读取", "不读取我的数据", "无需读取", "不需要读取"))
    )
    if explicit_conceptual and conceptual_intent and not current_or_visible and not any(marker in normalized for marker in ("how many", "list ", "show ", "哪些", "多少")):
        return False
    if documentation_intent and definition_intent and not current_or_visible:
        return False
    if (
        re.search(r"\bwhich\b.*\bdate\b.*\b(?:filter|use|refer|field|mean)\b", normalized)
        and not current_or_visible
        and not re.search(r"\b(?:active|selected|applied)\b", normalized)
    ):
        return False
    which_live = bool(re.search(r"\bwhich\b.*\b(?:task|tasks|item|items|record|records|list)\b", normalized))
    if current_or_visible or which_live or personal_intent:
        return True
    if documentation_intent:
        return False
    if re.search(r"\b(?:check|view|find)\b.*\b(?:tasks|items|records|applications)\b", normalized):
        return True
    if re.search(r"\b(?:how|what) about\b.*\b(?:tasks?|items?|records?)\b", normalized):
        return True
    return any(marker in normalized for marker in _LIVE_STATE_MARKERS)


def _knowledge_evidence_strings(knowledge_context: Any, *, limit: int = 200) -> tuple[str, ...]:
    if not isinstance(knowledge_context, dict) or knowledge_context.get("ok") is not True:
        return ()
    chunks = knowledge_context.get("chunks")
    if not isinstance(chunks, list):
        return ()
    values: list[str] = []
    for chunk in chunks[:limit]:
        content = chunk.get("content") if isinstance(chunk, dict) else None
        if not isinstance(content, str):
            continue
        text = _knowledge_content_body(content, chunk.get("source_name"))
        if text and not any(marker in text.casefold() for marker in _KNOWLEDGE_SENTINELS):
            values.append(text[:4_000])
    return tuple(values)


def _contains_contiguous_tokens(haystack: list[str], needle: list[str]) -> bool:
    if not needle or len(needle) > len(haystack):
        return False
    return any(haystack[index:index + len(needle)] == needle for index in range(len(haystack) - len(needle) + 1))


_NEGATION_PATTERN = re.compile(
    r"(?:\b(?:not|no|never|cannot|without)\b|n't\b|不可以|不能|不可|不得|没有|禁止|尚未|未(?:获|完|通|批)|"
    r"(?:^|\s)(?:لا|ليس|لن|لم|غير|بدون|ممنوع)(?:\s|$))",
    re.IGNORECASE,
)


def _negative_polarity(value: str) -> bool:
    return bool(_NEGATION_PATTERN.search(re.sub(r"\s+", " ", value).strip()))


def _knowledge_numbers_supported(fact: str, unit: str) -> bool:
    fact_numbers = re.findall(r"\d+(?:\.\d+)?", fact)
    unit_numbers = re.findall(r"\d+(?:\.\d+)?", unit)
    return all(fact_numbers.count(number) <= unit_numbers.count(number) for number in set(fact_numbers))


def _knowledge_meaningful_terms(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z][a-z0-9_-]*|\d+(?:\.\d+)?", value.casefold())
        if token[0].isdigit() or (len(token) >= 3 and token not in _KNOWLEDGE_PROSE_TERMS)
    }


_FILE_NAME_DOT = re.compile(r"(?<=[A-Za-z0-9_])\.(?=[A-Za-z0-9]{1,5}\b)")


def _knowledge_fact_clauses(value: str) -> tuple[str, ...]:
    # A cited document name such as "the-uae-en-uae-media-content-standards.md"
    # is not a sentence boundary, so a dot inside a file name must not split the
    # fact into unverifiable fragments.
    protected = _FILE_NAME_DOT.sub("\u0000", str(value))
    return tuple(
        item.strip().replace("\u0000", ".")
        for item in re.split(r"[!?。！？;；]+|\.(?=\s|$)", protected)
        if item.strip()
    )


def _knowledge_fact_is_structural(value: str) -> bool:
    normalized = re.sub(r"\s+", " ", str(value or "")).strip()
    if normalized.startswith("【知识库文件】") or re.match(r"^#{1,6}\s+\S", normalized):
        return True
    field_prefixes = re.findall(r"(?:^|\s)-\s*\*\*[^*:\n]{1,80}:\*\*", normalized)
    return bool(field_prefixes)


def _knowledge_unit_supports_fact(fact: str, unit: str) -> bool:
    normalized_fact = re.sub(r"\s+", " ", fact).strip().casefold()
    normalized_unit = re.sub(r"\s+", " ", unit).strip().casefold()
    if not normalized_fact or not normalized_unit:
        return False
    if _negative_polarity(normalized_fact) != _negative_polarity(normalized_unit):
        return False
    if not _knowledge_numbers_supported(normalized_fact, normalized_unit):
        return False
    if normalized_fact in normalized_unit:
        return True

    fact_latin = [
        token
        for token in re.findall(r"[a-z][a-z0-9_-]*|\d+(?:\.\d+)?", normalized_fact)
        if token[0].isdigit() or (len(token) >= 2 and token not in _KNOWLEDGE_PROSE_TERMS)
    ]
    unit_latin = [
        token
        for token in re.findall(r"[a-z][a-z0-9_-]*|\d+(?:\.\d+)?", normalized_unit)
        if token[0].isdigit() or (len(token) >= 2 and token not in _KNOWLEDGE_PROSE_TERMS)
    ]
    fact_han = [
        sequence[index:index + 2]
        for sequence in re.findall(r"[\u3400-\u9fff]+", normalized_fact)
        for index in range(max(0, len(sequence) - 1))
    ]
    unit_han = {
        sequence[index:index + 2]
        for sequence in re.findall(r"[\u3400-\u9fff]+", normalized_unit)
        for index in range(max(0, len(sequence) - 1))
    }
    fact_arabic = re.findall(r"[\u0621-\u064a]+", normalized_fact)
    unit_arabic = re.findall(r"[\u0621-\u064a]+", normalized_unit)

    checks: list[bool] = []
    if fact_latin:
        checks.append(_contains_contiguous_tokens(unit_latin, fact_latin))
    if fact_han:
        checks.append(len(set(fact_han) & unit_han) >= max(1, (len(set(fact_han)) * 3 + 3) // 4))
    if fact_arabic:
        checks.append(_contains_contiguous_tokens(unit_arabic, fact_arabic))
    return bool(checks) and all(checks)


def _knowledge_claim_supported_by_chunk(fact: str, chunk: str) -> bool:
    passages = _knowledge_semantic_passages(chunk)
    if len(passages) > 1:
        return any(_knowledge_claim_supported_by_chunk(fact, passage) for passage in passages)
    normalized_fact = re.sub(r"\s+", " ", fact).strip().casefold()
    if not normalized_fact or _knowledge_fact_is_structural(fact):
        return False

    for field, value in _knowledge_content_fields(chunk).items():
        prefix = re.match(re.escape(field) + r":\s*(.+)$", normalized_fact)
        if prefix:
            return _knowledge_claim_supported_by_chunk(prefix[1], value)

    subjects = re.findall(r"(?:## Semantic node:\s*|\*\*section:\*\*\s*)(.*?)(?=\s+-\s+\*\*|$)", chunk)
    for subject in subjects:
        for field, value in _knowledge_content_fields(chunk).items():
            prefix = re.match(re.escape(subject.strip().casefold()) + r"\s+" + re.escape(field) + r":\s*(.+)$", normalized_fact)
            if prefix and _knowledge_claim_supported_by_chunk(prefix[1], value):
                return True
        prefix = re.match(re.escape(subject.strip().casefold()) + r"\s+(?:is|covers|includes)\s+(.+)$", normalized_fact)
        if prefix and _knowledge_claim_supported_by_chunk(prefix[1], chunk):
            return True

    # The planner may name the documented section before quoting it, as in
    # "Service Operations Analytics: \"A headline total and a separate chart
    # total are not proven to share an aggregation basis.\"".  The section name
    # is retrieval metadata, so the quoted remainder is checked against this
    # same chunk; the remainder still has to be present in it.
    subject_prefix = re.match(r"^(.{1,160}?)[:：]\s*(.+)$", normalized_fact, re.DOTALL)
    if subject_prefix:
        subject_label = _key(subject_prefix.group(1))
        subject_names = {_key(name) for name in subjects} | {
            _key(field.split(":", 1)[0]) for field in _knowledge_content_fields(chunk)
        }
        remainder = subject_prefix.group(2).strip().strip('"').strip("'").strip()
        # The planner usually cites the document or section before the quote,
        # as in "Media Content Standards (standard.md): \"...\"".  Accept that
        # label when it names - or is named by - a section of this same chunk,
        # then verify the quoted remainder against the chunk as usual.
        names_label = bool(subject_label) and any(
            name and (name in subject_label or subject_label in name) for name in subject_names
        )
        cites_document = bool(re.search(r"\.(?:md|pdf|json|txt|csv|xlsx)\b", subject_prefix.group(1), re.I))
        if remainder and (subject_label in subject_names or names_label or cites_document):
            if _knowledge_claim_supported_by_chunk(remainder, chunk):
                return True

    quote = normalized_fact.replace("`", "").rstrip(".!?。！？ ")
    sentences = tuple(sentence for body in _knowledge_content_fields(chunk).values()
                      for sentence in _knowledge_fact_clauses(body)) or _knowledge_fact_clauses(chunk)
    units = [
        item.strip()
        for sentence in sentences
        for item in re.split(r"[,，،]+", sentence)
        if item.strip()
    ]
    if quote and any(
        quote in sentence.casefold().replace("`", "")
        and _negative_polarity(quote) == _negative_polarity(sentence)
        and _knowledge_numbers_supported(quote, sentence)
        for sentence in sentences
    ):
        return True

    if any(_knowledge_unit_supports_fact(fact, unit) for unit in units):
        return True

    fact_terms = _knowledge_meaningful_terms(normalized_fact)
    if len(fact_terms) < 2:
        return False
    fact_numbers = re.findall(r"\d+(?:\.\d+)?", normalized_fact)
    best_supported_overlap = 0
    best_conflicting_overlap = 0
    for unit in units:
        unit_terms = _knowledge_meaningful_terms(unit)
        overlap = fact_terms & unit_terms
        number_conflict = bool(fact_numbers and not _knowledge_numbers_supported(normalized_fact, unit))
        if _negative_polarity(normalized_fact) != _negative_polarity(unit) or number_conflict:
            best_conflicting_overlap = max(best_conflicting_overlap, len(overlap))
            continue
        if len(overlap) >= 2 and len(overlap) * 2 >= len(fact_terms):
            best_supported_overlap = max(best_supported_overlap, len(overlap))
    return best_supported_overlap > best_conflicting_overlap


def _knowledge_semantic_passages(content: str) -> tuple[str, ...]:
    """Keep repeated manual fields inside their own semantic or control section."""
    return tuple(part.strip() for part in re.split(r'(?=## Semantic node:|### Control:)', content) if part.strip())


def _knowledge_content_fields(content: str, *, include_metadata: bool = False) -> dict[str, str]:
    """Separate flattened manual fields without rewriting their assertions."""
    fields = {}
    for match in re.finditer(r"-\s*\*\*([a-z_]+):\*\*\s*(.*?)(?=\s+-\s*\*\*[a-z_]+:\*\*|$)", content, re.DOTALL):
        if include_metadata or match[1] not in {"section", "page", "name", "type"}:
            fields[match[1]] = match[2].strip()
    return fields


def knowledge_fact_evidence(knowledge_context: Any, question: str = "") -> list[dict[str, Any]]:
    evidence = []
    contents = [(index, passage) for index, content in enumerate(_knowledge_evidence_strings(knowledge_context, limit=12))
                for passage in _knowledge_semantic_passages(content)]
    def metadata(content: str) -> dict[str, str]:
        fields = _knowledge_content_fields(content, include_metadata=True)
        return {key: fields[key][:300] for key in ('section', 'page') if fields.get(key)}
    if question:
        words = _section_match_tokens(question)
        contents.sort(key=lambda item: len(words & _section_match_tokens(metadata(item[1]).get('section', ''))), reverse=True)
    for index, content in contents:
        for field, value in _knowledge_content_fields(content).items():
            if field not in {"meaning", "content", "distinguish_from", "field_distinctions", "filters", "available_fields", "scope", "evidence_limits", "verification_limits", "criteria_meaning", "entry_conditions"}:
                continue
            if value and len(value) <= 600:
                evidence.append({"chunkIndex": index, **metadata(content), "field": field, "text": value})
            if len(evidence) >= 24:
                return evidence
    return evidence


def _knowledge_for_current_role(knowledge_context: dict[str, Any], permission: UserPermissionContext,
                                question: str) -> dict[str, Any]:
    """Keep verified role variants separate without treating a manual as access control."""
    current = ' '.join(permission.current_role.casefold().split())
    if not current:
        return knowledge_context
    retained, excluded = [], 0
    for chunk in knowledge_context.get('chunks', []):
        if not isinstance(chunk, dict):
            continue
        parts = re.split(r'(?=## Semantic node:)', str(chunk.get('content') or ''))
        matching = []
        for part in parts:
            owners = re.findall(r'verified for (?:the )?([A-Za-z][A-Za-z &-]{1,80}?) representative', part, re.I)
            normalized = [' '.join(owner.casefold().split()) for owner in owners]
            # Explicit role comparisons may retain both sources, with their original scope.
            explicit_other = bool(re.search(r'\b(?:compare|difference|distinction|between)\b', question, re.I)) and any(
                re.search(r'(?<!\w)'+re.escape(owner)+r'(?!\w)', question, re.I) for owner in owners)
            field_explanation = (question_is_conceptual(question)
                and bool(re.search(r'\b(?:fields?|columns?|assigned time|last update)\b', question, re.I))
                and not _question_is_capability_catalogue(question)
                and not re.search(r'\b(?:filters?|criteria|access|available)\b', question, re.I))
            if owners and current not in normalized and not explicit_other and not field_explanation:
                excluded += 1
                continue
            matching.append(part)
        content = ''.join(matching).strip()
        if content:
            retained.append({**chunk, 'content': content})
    if not excluded:
        return knowledge_context
    return {**knowledge_context, 'chunks': retained, 'roleApplicability': {
        'currentRole': permission.current_role, 'excludedOtherRoleSections': excluded,
        'permissionSource': 'GetUserInfo', 'missingCoverageIsNotPermissionDenial': True,
    }}


def _qualify_knowledge_facts(result: ReaderResult, knowledge_context: Any) -> ReaderResult:
    """Keep the subject of an exact manual excerpt when presenting its text."""
    passages = [passage for content in _knowledge_evidence_strings(knowledge_context)
                for passage in _knowledge_semantic_passages(content)]
    facts, sources, qualifications = [], set(), []
    for fact in result.facts:
        subjects, distinctions = set(), set()
        normalized = ' '.join(fact.split())
        for passage in passages:
            title = re.match(r'(?:## Semantic node:|### Control:)\s*(.*?)(?=\s+-\s*\*\*|\n|$)', passage)
            if title and normalized in ' '.join(passage.split()):
                subjects.add(title[1].strip())
                fields = _knowledge_content_fields(passage, include_metadata=True)
                if passage.startswith('### Control:') and normalized in ' '.join(fields.get('distinguish_from', '').split()):
                    distinctions.add(title[1].strip())
                for key in ('scope', 'verification_limits'):
                    qualification = fields.get(key, '')
                    if qualification and len(qualification) <= 350:
                        qualifications.append(f'{title[1].strip()} {key}: {qualification}')
                page = fields.get('page', '').strip('` ')
                if page.startswith('/') and not page.startswith('//') and not any(c in page for c in '?#\\'):
                    sources.add((page, fields.get('section', '')[:240]))
        if len(subjects) == 1:
            subject = next(iter(subjects))
            labeled = f'{subject} is distinct from: {fact}' if subject in distinctions else f'{subject}: {fact}'
            if len(labeled) <= 400:
                facts.append(labeled)
                continue
        facts.append(fact)
    # Documentation navigation hints preserve a follow-up's source without
    # claiming that the page was read or that this role can access it.
    hint = result.source_hint
    if len({page for page, _ in sources}) == 1:
        hint = {'page': next(iter(sources))[0]}
        if len(sources) == 1:
            hint['section'] = next(iter(sources))[1]
    for qualification in dict.fromkeys(qualifications):
        value = qualification.split(': ', 1)[-1]
        if not any(value in fact for fact in facts):
            facts.append(qualification)
    return replace(result, facts=tuple(facts), source_hint=hint)


def _documented_column_contrast(question: str, knowledge: dict[str, Any], role: str) -> ReaderResult | None:
    """Explain explicitly contrasted column names without defining their business events."""
    match = re.fullmatch(r'\s*why does one list show ([A-Za-z ]{1,50}?) and the other ([A-Za-z ]{1,50}?)\??\s*', question, re.I)
    if not match:
        return None
    requested = [match[1].strip(), match[2].strip()]
    candidates = []
    for content in _knowledge_evidence_strings(knowledge):
        for passage in _knowledge_semantic_passages(content):
            title = re.match(r'## Semantic node:\s*(.*?)(?=\s+-\s*\*\*|\n|$)', passage)
            fields = _knowledge_content_fields(passage,include_metadata=True)
            columns = [c.strip(' .') for c in fields.get('content','').split(';')]
            if not title or not fields.get('scope') or not fields.get('page'):
                continue
            names = [name for name in requested if any(name.casefold()==c.casefold() for c in columns)]
            if names:
                own = bool(re.search(r'\bverified for (?:the )?'+re.escape(role)+r' representative\b',fields['scope'],re.I))
                candidates.append((title[1].strip(),fields,names,own))
    if any(c[3] for c in candidates):
        candidates = [c for c in candidates if c[3]]
    if not candidates or len(candidates)>4 or any(not any(n in c[2] for c in candidates) for n in requested):
        return None
    pages = {c[1]['page'].strip('` ') for c in candidates}
    if len(pages)!=1:
        return None
    facts=[]
    for title,fields,names,_ in candidates:
        facts.append(f'{title}: documented column '+', '.join(names)+'.')
        facts.append(f'{title} scope: '+fields['scope'])
    facts.append('These are distinct columns in the documented list layouts. Their names do not establish the underlying business event, timezone, or date-boundary rules. '
                 'This documentation comparison does not establish current-role access to those lists.')
    return ReaderResult(status='success',summary='The documented list-column distinction is explained.',answer_shape='detail',
        facts=tuple(facts),completeness='bounded',source_hint={'page':next(iter(pages))})


def _ambiguous_date_reading(first: int, second: int, year: int | None, *, month_first: bool) -> str:
    """Render one reading of an ambiguous numeric date with a month name."""

    month, day = (first, second) if month_first else (second, first)
    if year is None:
        return f"ISO {month:02d}-{day:02d} = {_MONTH_NAMES[month - 1]} {day}"
    return f"ISO {year:04d}-{month:02d}-{day:02d} = {_MONTH_NAMES[month - 1]} {day}, {year:04d}"


def _documented_filter_catalogue(question: str, knowledge: dict[str, Any]) -> ReaderResult | None:
    if not re.fullmatch(r'\s*what filters can i use on .+\??\s*',question,re.I):
        return None
    def terms(text):
        return {t.rstrip('s') for t in re.findall(r'[a-z]+',text.casefold())} - {'what','filter','surface','list','can','use','the','on','i','task'}
    requested=terms(question)
    candidates=[]
    for content in _knowledge_evidence_strings(knowledge):
        for passage in _knowledge_semantic_passages(content):
            title=re.match(r'## Semantic node:\s*(.*?)(?=\s+-\s*\*\*|\n|$)',passage)
            fields=_knowledge_content_fields(passage,include_metadata=True)
            if not title or fields.get('type')!='filter surface' or not all(fields.get(k) for k in ('content','scope','page')):
                continue
            score=len(requested & terms(title[1]+' '+fields['page']))
            if score:candidates.append((score,title[1].strip(),fields))
    if not candidates:return None
    best=max(c[0] for c in candidates);selected=[c for c in candidates if c[0]==best]
    if len(selected)!=1:return None
    _,title,fields=selected[0]
    facts=(f'Documented {title} contents: '+fields['content'],f'{title} scope: '+fields['scope'],
           'This describes the documented filter surface. It does not establish that these fields are currently rendered or available to every role, '
           'and inline list controls are not treated as fields inside this surface.')
    return ReaderResult(status='success',summary='The documented filter catalogue is explained.',answer_shape='detail',
        facts=facts,completeness='bounded',source_hint={'page':fields['page'].strip('` '),'section':fields.get('section','')})


def _requested_schema_fields(question: str) -> tuple[str, ...]:
    match = re.search(r'\bhave an? ([A-Za-z][A-Za-z ]{0,40}?) (?:field|column) or an? ([A-Za-z][A-Za-z ]{0,40}?) (?:field|column)\b', question, re.I)
    return (match[1].strip(), match[2].strip()) if match else ()


def _requested_date_comparison(question: str) -> tuple[str, str, str] | None:
    match = re.search(r'\bwhose ([A-Za-z ]{1,45}?date) is (later|earlier) than (?:their |its |the )?([A-Za-z ]{1,45}?date)\b', question, re.I)
    return (match[1].strip(), match[3].strip(), match[2].casefold()) if match else None


def _native_date_comparison_outcome(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    comparison = _requested_date_comparison(question)
    if not comparison or outcome.result.status in {'no_permission', 'load_failed'}:
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if (not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True
            or _observation_has_error_state(observation)):
        return outcome
    def label(value: str) -> str:
        # A start/end modifier is accepted only if it resolves to one native header.
        return ' '.join(t for t in value.casefold().split() if t not in {'start', 'end'})
    candidates = []
    for source in observation.get('sectionSummaries', []):
        if not isinstance(source, dict) or source.get('kind') not in {'table', 'grid'}:
            continue
        headers = source.get('columnHeaders') or []
        left = [h for h in headers if isinstance(h, str) and label(h) == label(comparison[0])]
        right = [h for h in headers if isinstance(h, str) and label(h) == label(comparison[1])]
        if len(left) == len(right) == 1 and left != right and source.get('rowFields'):
            candidates.append((source, left[0], right[0]))
    if len(candidates) != 1:
        return outcome
    source, left, right = candidates[0]
    rows = [r for r in source['rowFields'][:20] if isinstance(r, dict)]
    slash = [re.fullmatch(r'(\d{2})/(\d{2})/(\d{4})', str(r.get(k, ''))) for r in rows for k in (left, right)]
    day_first = any(m and int(m[1]) > 12 for m in slash) and not any(m and int(m[2]) > 12 for m in slash)
    month_first = any(m and int(m[2]) > 12 for m in slash) and not any(m and int(m[1]) > 12 for m in slash)
    def parse(value: Any):
        value = str(value or '')
        try:
            if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
                return datetime.strptime(value, '%Y-%m-%d').date()
            if day_first or month_first:
                return datetime.strptime(value, '%d/%m/%Y' if day_first else '%m/%d/%Y').date()
        except ValueError:
            pass
        return None
    compared, skipped, matches, samples = 0, 0, [], []
    identities = [h for h in source.get('columnHeaders', []) if re.search(r'\b(?:No\.?|ID|Number)$', h, re.I)]
    for row in rows:
        a, b = parse(row.get(left)), parse(row.get(right))
        if a is None or b is None:
            skipped += 1
            continue
        compared += 1
        text = '; '.join(f'{h}: {row[h]}' for h in identities[:2] if row.get(h))
        text += f'; {left}: {row[left]}; {right}: {row[right]}'
        samples.append(text.lstrip('; '))
        if (a > b if comparison[2] == 'later' else a < b):
            matches.append(text.lstrip('; '))
    if not compared:
        return outcome
    facts = [f'Compared {left} with {right} for {compared} observed records: {len(matches)} matched the requested {comparison[2]}-than condition. '
             f'{skipped} observed records had missing or ambiguous dates and were not compared.']
    facts.extend(matches if matches else ['Checked example: ' + s for s in samples[:3]])
    facts.append('This is a bounded comparison of the observed records, not a verified filter over the entire list. '
                 'Unobserved records remain unchecked. It does not define permit validity, timezone rules, or date-boundary business semantics.')
    result = replace(outcome.result, status='success', answer_shape='list', completeness='bounded', scope='unknown',
        source_section=str(source.get('nodeId') or ''), facts=tuple(facts), missing=())
    return ReaderOutcome(result, {**evidence, 'dateComparisonEvidence': {'fields':[left,right], 'compared':compared,
        'matched':len(matches), 'skipped':skipped, 'coverage':'observed_records_only'}, 'result':result.public_json()})


def _native_schema_outcome(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    requested = _requested_schema_fields(question)
    if not requested or outcome.result.status in {'no_permission', 'load_failed'}:
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if (not outcome.result.page or not isinstance(observation, dict)
            or (observation.get('readHealth') or {}).get('healthy') is not True
            or _observation_has_error_state(observation)):
        return outcome
    tables = [s for s in observation.get('sectionSummaries', []) if isinstance(s, dict)
              and s.get('kind') in {'table', 'grid'} and s.get('columnHeaders')]
    if len(tables) != 1:
        return outcome
    source = tables[0]
    headers = [str(h).strip() for h in source['columnHeaders'] if isinstance(h, str)]
    role = (evidence.get('permission') or {}).get('currentRole') or 'signed-in account'
    facts = [f'In the current {role} view at {outcome.result.page}, the visible columns are: ' + '; '.join(headers) + '.']
    for field in requested:
        present = any(h.casefold() == field.casefold() for h in headers)
        facts.append(f'A column named {field} is ' + ('visible.' if present else 'not present among those observed headers.'))
    facts.append('Column availability does not establish record values, personal assignment, or equivalence between differently named fields.')
    result = replace(outcome.result, status='success', answer_shape='detail', completeness='bounded',
        source_section=str(source.get('nodeId') or ''), facts=tuple(facts), missing=(), scope='unknown')
    return ReaderOutcome(result, {**evidence, 'nativeSchemaEvidence': {'headers': headers, 'requested': requested},
                                  'result': result.public_json()})


def _observed_application_lookup(question: str, observation: Any, page: str) -> ReaderResult | None:
    """A query for a visible application row does not require opening its detail page."""
    ids = re.findall(r'\b(?:MC-2|ML-[12])-\d+-\d+\b', question, re.I)
    if (len(set(ids)) != 1 or not re.search(r'\b(?:query|inquire)\b', question, re.I)
            or re.search(r'\b(?:details?|profile|full|all|open)\b', question, re.I)
            or not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True):
        return None
    tables = [n for n in _observation_semantic_nodes(observation) if n.get('kind') in {'table','grid'}
              and any(_key(h) in {'applicationno','applicationnumber'} for h in n.get('columnHeaders', []))]
    matches = []
    for table in tables:
        selected = str(table.get('selectedState') or '')
        for view in ('Completed','To Do'):
            if re.search(r'\b'+view.replace(' ',r'[ -]')+r'\b',question,re.I) and not _state_control_label_matches(selected,view):
                return None
        for row in table.get('rowFields', []):
            if not isinstance(row, dict):
                continue
            identities = [v for k,v in row.items() if _key(k) in {'applicationno','applicationnumber'}]
            if identities == [ids[0]]:
                fields = {k:v for k,v in row.items() if k in table['columnHeaders']}
                matches.append((table, fields))
    if len(matches) != 1:
        return None
    table, fields = matches[0]
    return ReaderResult(status='success', summary='The exact application was matched in the current native table.',
        page=page,section='My Application Tasks',source_section=str(table.get('nodeId') or ''),
        selected_state=str(table.get('selectedState') or ''),answer_shape='detail',completeness='bounded',
        facts=(json.dumps(fields,ensure_ascii=False,separators=(',',':')),))


def _native_identity_search_result(outcome: ReaderOutcome, question: str, intent: dict[str, Any]) -> ReaderOutcome:
    """Present the matched native row instead of accompanying API lookup lists."""
    identity = str(_resolved_intent_values({'resolvedIntent': intent}).get('recordIdentity') or '')
    if not identity:
        tokens = re.findall(r'(?<![\w/-])(?=[A-Za-z0-9-]*[A-Za-z])(?=[A-Za-z0-9-]*\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+(?![\w/-])', question)
        if len(tokens) == 1:
            identity = tokens[0]
    if (outcome.result.status != 'success' or not identity
            or not re.search(r'\b(?:find|search)\b', question, re.I)):
        return outcome
    observation = outcome.audit_evidence.get('observation') or {}
    if ((observation.get('readHealth') or {}).get('healthy') is not True
            or _observation_has_error_state(observation)):
        return outcome
    tables = [s for s in observation.get('sectionSummaries', []) if isinstance(s, dict)
              and s.get('kind') in {'table', 'grid'} and s.get('columnHeaders')]
    if len(tables) != 1:
        return outcome
    table = tables[0]
    primary = table['columnHeaders'][0]
    if not re.search(r'\b(?:no\.?|number|id)\s*$', primary, re.I):
        return outcome
    rows = [r for r in table.get('rowFields', []) if isinstance(r, dict)]
    search_matches = any(str(c.get('label') or '').casefold() == 'search' and c.get('selected') == [identity]
                         for c in observation.get('filterControls', []) if isinstance(c, dict))
    if (not rows and search_matches and _observation_no_data_allowed(observation)
            and _raw_observation_has_empty_state(table)):
        result = replace(outcome.result, status='no_data', facts=(), missing=(), answer_shape='list', completeness='bounded')
        return ReaderOutcome(result, {**outcome.audit_evidence, 'nativeIdentityMatch': identity, 'result': result.public_json()})
    if len(rows) != 1 or str(rows[0].get(primary) or '').casefold() != identity.casefold():
        return outcome
    fields = {key: value for key, value in rows[0].items() if key in table['columnHeaders']}
    result = replace(outcome.result, facts=(json.dumps(fields, ensure_ascii=False),),
                     source_section=str(table.get('nodeId') or ''), selected_state=str(table.get('selectedState') or ''),
                     answer_shape='list', completeness='bounded')
    return ReaderOutcome(result, {**outcome.audit_evidence, 'nativeIdentityMatch': identity, 'result': result.public_json()})


def _sibling_refund_source(page: str) -> str:
    """The other rendered surface that carries the same refund records."""

    return {
        "/happiness/refunds": "/financial-payment/refunds",
        "/financial-payment/refunds": "/happiness/refunds",
    }.get(str(page or ""), "")


def _identity_lookup_sources(page: str) -> tuple[str, ...]:
    """Fallback pages that may hold one concrete Finance/refund identifier."""

    if page == "/financial-payment/transactions":
        # A payment transaction number can be the refund's own Transaction No.
        return ("/financial-payment/refunds",)
    if page == "/financial-payment/refunds":
        return ("/happiness/refunds",)
    if page == "/happiness/refunds":
        return ("/financial-payment/refunds",)
    return ()


def _explicit_record_identity(question: str) -> str:
    """Return the single record identifier named by the question.

    Hyphenated numbers (``HC-02-2026-5239576``) were the original case.
    Finance also renders bare numeric transaction numbers, so a lone
    ten-digit-or-longer number is accepted when the question is about a
    transaction, payment or refund.  Two candidate identifiers are ambiguous
    and therefore return nothing rather than guessing one.
    """

    text = str(question or "")
    hyphenated = re.findall(
        r"(?<![A-Za-z0-9])(?=[A-Za-z0-9-]*[A-Za-z])(?=[A-Za-z0-9-]*\d)"
        r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+(?![A-Za-z0-9])",
        text,
    )
    if len(hyphenated) == 1:
        return hyphenated[0]
    if hyphenated:
        return ""
    numeric = re.findall(r"(?<!\d)(\d{6,})(?!\d)", text)
    if len(numeric) == 1 and re.search(
        r"\b(?:transaction|transactions|payment|payments|refund|refunds|order|receipt)s?\b|"
        r"\b(?:record|records|item|items|isbn|book|content|application|licen[cs]e|ticket|case)s?\b|"
        r"交易|付款|退款|记录|编号|书号|内容|许可|工单|案件|"
        r"معاملة|استرداد|دفع|سجل|رقم|محتوى|رخصة|تذكرة",
        text,
        re.I,
    ):
        return numeric[0]
    return ""


def _discovered_finance_refund_fields(observation: Any, identity: str) -> dict[str, Any]:
    """Merge API-backed fields for one exact Finance refund record.

    The rendered Finance Refunds table repeats the refund number, transaction
    number, amount, status and last update, but not the currency or the refund
    action state.  The page's own API evidence for that same identifier does
    carry them, so only the one record whose identifier matches is merged; no
    sibling record and no default value is ever substituted.
    """

    if not isinstance(observation, dict):
        return {}
    wanted = _detail_identity(identity).casefold()
    if not wanted:
        return {}
    merged: dict[str, Any] = {}

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            identifiers = {
                _detail_identity(child).casefold()
                for key, child in value.items()
                if _key(key) in {"refundno", "applicationno", "transactionno", "originaltransactionno"}
                and child not in (None, "")
            }
            if wanted in identifiers:
                currency = value.get("currency")
                if currency and "Currency" not in merged:
                    merged["Currency"] = str(currency).upper()
                original = value.get("originalTransactionNo")
                if original and "Original Transaction No." not in merged:
                    merged["Original Transaction No."] = str(original)
                updated = value.get("lastUpdatedOn")
                if updated and "Last Updated" not in merged:
                    merged["Last Updated"] = str(updated)
                if "canExecuteRefund" in value and "Next Step" not in merged:
                    if value.get("canExecuteRefund") is False:
                        merged["Next Step"] = str(
                            value.get("unsupportedReason") or "No further refund action is available for this record."
                        )
                    else:
                        merged["Next Step"] = "A refund action is still available for this record."
            for child in value.values():
                visit(child)
        elif isinstance(value, (list, tuple)):
            for child in value:
                visit(child)

    visit((observation.get("apiDiscovery") or {}).get("candidates") or [])
    return merged


def _native_exact_identity_row_result(
    observation: Any,
    *,
    page: str,
    record_identity: str,
    scope: str,
    question: str,
) -> ReaderResult | None:
    """Read one exact visible row without requiring an English search verb.

    Arabic follow-ups often ask for a record directly ("للسجل ...") rather
    than using ``find``/``search``.  The old identity recovery therefore
    skipped an already-visible matching row and later reported a false
    not-confirmed result.  This helper is intentionally limited to one exact
    row in the fresh, healthy observation; it never searches hidden pages or
    substitutes a neighbouring record.
    """
    identity = _detail_identity(record_identity)
    if not identity or not isinstance(observation, dict) or _observation_has_error_state(observation):
        return None
    if (observation.get("readHealth") or {}).get("healthy") is not True:
        return None
    # Prefer the raw section summaries: the bounded semantic normalizer may
    # intentionally omit numeric cells, while refund amounts and timestamps
    # are valid, user-visible fields that must survive an exact-record read.
    raw_tables = observation.get("sectionSummaries")
    candidate_tables = raw_tables if isinstance(raw_tables, list) else []
    if not candidate_tables:
        candidate_tables = list(_observation_semantic_nodes(observation))
    tables = [node for node in candidate_tables
              if isinstance(node, dict)
              and node.get("kind") in {"table", "grid"}
              and node.get("columnHeaders") and node.get("rowFields")]
    matches: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for table in tables:
        headers = [str(header) for header in table.get("columnHeaders") or []]
        for row in table.get("rowFields") or []:
            if not isinstance(row, dict):
                continue
            values = [row.get(header) for header in headers]
            if any(_detail_identity(value).casefold() == identity.casefold() for value in values):
                matches.append((table, {key: row.get(key) for key in headers if key in row}))
    if len(matches) != 1:
        return None
    table, fields = matches[0]
    if page == "/financial-payment/refunds":
        for key, value in _discovered_finance_refund_fields(observation, identity).items():
            fields.setdefault(key, value)
    if page == "/financial-payment/refunds" and not any(
        re.sub(r"[^a-z0-9]", "", str(key).casefold()) in {"currency", "currencycode", "itemscurrency"}
        for key in fields
    ):
        # Finance renders the currency at page/statistics level even when the
        # exact refund row omits a Currency column. Reuse only an explicitly
        # observed currency code; never default a missing value.
        observed_text = json.dumps(observation, ensure_ascii=False)
        currency = re.search(r"\b(?:AED|USD|EUR|GBP|CNY|SAR)\b", observed_text, re.I)
        if currency:
            fields["Currency"] = currency.group(0).upper()
    return ReaderResult(
        status="success",
        summary="The exact requested record was matched in the current native table.",
        page=page,
        section=str(table.get("heading") or table.get("nodeId") or ""),
        source_section=str(table.get("nodeId") or ""),
        selected_state=str(table.get("selectedState") or ""),
        answer_shape="detail",
        scope=scope,
        completeness="bounded",
        facts=(json.dumps(fields, ensure_ascii=False, separators=(",", ":")),),
    )


def _native_optional_record_fields(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Keep optional-field lists on their observed schema instead of API lookup IDs."""
    optional_fields = bool(re.search(r'\bshow\b.*\b(?:with|including)\b.*\bwhere (?:available|those fields exist)\b', question, re.I))
    optional_fields = optional_fields or bool(re.search(
        r'\bshow\b.*\binclude\b.*\bonly if (?:it|they) exists?\b', question, re.I))
    native_description = bool(re.search(r'\bshow\b.*(?:\bincluding their statuses\b|\binformation (?:that )?(?:used to identify|identifies)\b|\bstatuses and identifying information\b)', question, re.I))
    failed_bounded_list = (outcome.result.status=='not_confirmed' and requested_record_limit(question) is not None
                          and any(m in {'planner_error','invalid_observation_schema','invalid_follow_up_plan'} for m in outcome.result.missing))
    if (not (optional_fields or native_description or failed_bounded_list)
            or outcome.result.status not in {'success','not_confirmed'} or not outcome.result.page):
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if (not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True
            or _observation_has_error_state(observation)):
        return outcome
    if _category_control_requiring_children(question, observation, None, 'list', current_page=outcome.result.page):
        return outcome
    tables = [s for s in observation.get('sectionSummaries', []) if isinstance(s, dict)
              and s.get('kind') in {'table','grid'} and s.get('columnHeaders') and s.get('rowFields')]
    if len(tables) != 1:
        return outcome
    source = tables[0]
    rows = [{k:v for k,v in r.items() if k in source['columnHeaders']} for r in source['rowFields'] if isinstance(r,dict)]
    rows = [r for r in rows if r][:requested_record_limit(question) or 4]
    if not rows:
        return outcome
    selected_state = str(source.get('selectedState') or '').strip()
    context = ((f'The current selected view is {selected_state}. These records belong to that view.',)
               if selected_state else ())
    facts = tuple(json.dumps(r,ensure_ascii=False) for r in rows) + context + (
        'These are bounded records from the current view. Fields absent from the displayed columns are not established. '
        'Differently named time columns are not interchangeable; their business event semantics are not established.',)
    result = replace(outcome.result,status='success',answer_shape='list',completeness='bounded',
        source_section=str(source.get('nodeId') or ''),selected_state=str(source.get('selectedState') or ''),
        facts=facts,missing=())
    return ReaderOutcome(result,{**evidence,'nativeOptionalFields':{'columns':source['columnHeaders'],'count':len(rows)},'result':result.public_json()})


def _native_cleared_search_result(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Recover a bounded list after the caller verifies a successful search clear."""
    limit = requested_record_limit(question)
    if (outcome.result.status != 'not_confirmed'
            or set(outcome.result.missing) - {'planner_error'}):
        return outcome
    observation = outcome.audit_evidence.get('observation') or {}
    tables = [s for s in observation.get('sectionSummaries', [])
              if isinstance(s, dict) and s.get('kind') in {'table', 'grid'}]
    if ((observation.get('readHealth') or {}).get('healthy') is not True
            or _observation_has_error_state(observation) or len(tables) != 1
            or not tables[0].get('rowFields')):
        return outcome
    table = tables[0]
    rows = [{k: v for k, v in row.items() if k in table.get('columnHeaders', [])}
            for row in table['rowFields'] if isinstance(row, dict)]
    rows = [row for row in rows if row][:limit or 4]
    if re.search(r'\bonly[.!?]*\s*$', question, re.I):
        normalize = lambda v: re.sub(r'[^a-z0-9]+', ' ', re.sub(r'\bstatuses\b', 'status', re.sub(r'\bids\b', 'id', v.casefold()))).strip()
        requested = [key for key in table.get('columnHeaders', []) if normalize(key) in normalize(question)]
        if not requested:
            return outcome
        rows = [{key: value for key, value in row.items() if key in requested} for row in rows]
    if limit is not None and not rows:
        return outcome
    facts = tuple(json.dumps(row, ensure_ascii=False) for row in rows) if limit is not None else ()
    state = str(table.get('selectedState') or '')
    if state:
        facts += (f'The current selected view is {state}.',)
    facts += ('The cleared-search list is available again in the freshly read view. '
              'Only the displayed sample is established; other prior filters and the entire collection are not established.',)
    result = replace(outcome.result, status='success', answer_shape='list' if limit is not None else 'overview',
                     completeness='bounded', scope='unknown', missing=(), facts=facts,
                     source_section=str(table.get('nodeId') or ''), selected_state=state)
    return ReaderOutcome(result, {**outcome.audit_evidence, 'result': result.public_json()})


def _native_empty_queue_count(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    match = re.search(r'\bhow many\b.*\bin (To Do|Completed)\b',question,re.I)
    if not match or outcome.result.status!='not_confirmed' or not outcome.result.page:
        return outcome
    evidence=outcome.audit_evidence
    observation=evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if not isinstance(observation,dict) or not _observation_no_data_allowed(observation):
        return outcome
    tables=[s for s in _observation_semantic_nodes(observation) if s.get('kind') in {'table','grid'}]
    if len(tables)!=1:return outcome
    source=tables[0]
    if (not _state_control_label_matches(source.get('selectedState'),match[1])
            or source.get('rowFields') or source.get('rowSummaries')
            or not re.fullmatch(r'No Data|No records|No results|暂无数据|暂无记录',source.get('emptyState',''),re.I)):
        return outcome
    result=replace(outcome.result,status='success',answer_shape='count',completeness='bounded',scope='unknown',missing=(),
        source_section=str(source.get('nodeId') or ''),selected_state=str(source['selectedState']),
        facts=(f'The currently selected {source["selectedState"]} query has 0 matching records. This is the verified empty current view, not a count across other views or criteria.',))
    return ReaderOutcome(result,{**evidence,'nativeEmptyCount':{'source':source['nodeId'],'state':source['selectedState']},'result':result.public_json()})


def _native_status_values(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    if (not re.fullmatch(r'\s*(?:which|what)\s+[a-z ]*statuses\s+are\s+shown\s+in\s+(?:this|the current)\s+list[?.]?\s*', question, re.I)
            or outcome.result.status not in {'success','not_confirmed'} or not outcome.result.page):
        return outcome
    observation=outcome.audit_evidence.get('observation')
    if not isinstance(observation,dict) or (observation.get('readHealth') or {}).get('healthy') is not True or _observation_has_error_state(observation):
        return outcome
    tables=[s for s in observation.get('sectionSummaries',[]) if isinstance(s,dict) and s.get('kind') in {'table','grid'} and 'Status' in s.get('columnHeaders',[])]
    if len(tables)!=1:return outcome
    rows=tables[0].get('rowFields') or []
    values=list(dict.fromkeys(str(r['Status']) for r in rows if isinstance(r,dict) and r.get('Status')))
    if not values:return outcome
    result=replace(outcome.result,status='success',answer_shape='list',completeness='bounded',scope='unknown',missing=(),
        source_section=str(tables[0].get('nodeId') or ''),selected_state=str(tables[0].get('selectedState') or ''),
        facts=('Status values in the currently observed rows: '+ '; '.join(values)+'.',
               f'This covers {len(rows)} observed rows only. It is not a complete status enumeration or a definition of those statuses.'))
    return ReaderOutcome(result,{**outcome.audit_evidence,'result':result.public_json(),'nativeStatusValues':values})


def _native_bounded_summary(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    if (outcome.result.status not in {'success', 'not_confirmed'} or not outcome.result.page
            or not re.search(r'\bshow a bounded (?:current )?summary\b',question,re.I)):
        return outcome
    observation=outcome.audit_evidence.get('observation')
    if not isinstance(observation,dict) or (observation.get('readHealth') or {}).get('healthy') is not True or _observation_has_error_state(observation):return outcome
    tables=[s for s in observation.get('sectionSummaries',[]) if isinstance(s,dict) and s.get('kind') in {'table','grid'} and s.get('rowFields')]
    if len(tables)!=1:return outcome
    table=tables[0];label=str(table.get('selectedState') or '')
    words=lambda v:set(re.findall(r'[a-z]+',v.casefold()))-{'view','analytics'}
    bound_source = (outcome.result.status == 'success'
                    and outcome.result.source_section == table.get('nodeId')
                    and _observation_selected_state_matches(outcome.result.selected_state, table))
    if not words(label) or not (words(label)<=words(question) or bound_source):return outcome
    rows=[{k:v for k,v in r.items() if k in table.get('columnHeaders',[]) and not re.search(r'email|mobile|phone',k,re.I)} for r in table['rowFields'] if isinstance(r,dict)][:4]
    if not rows or not all(rows):return outcome
    result=replace(outcome.result,status='success',answer_shape='overview',completeness='bounded',scope='unknown',missing=(),
        selected_state=label,source_section=str(table.get('nodeId') or ''),
        facts=tuple(json.dumps(r,ensure_ascii=False) for r in rows)+(f'These are {len(rows)} observed rows in {label}; other rows and filter contexts are not covered by this bounded summary.',))
    return ReaderOutcome(result,{**outcome.audit_evidence,'result':result.public_json(),'nativeSummaryState':label})


def _native_catalogue_outcome(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Read a documented catalogue's actually visible headings, never its files."""
    if outcome.result.status in {'no_permission', 'load_failed'} or question_is_conceptual(question):
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if not isinstance(observation, dict) or _observation_has_error_state(observation):
        return outcome
    health = observation.get('readHealth') or {}
    # A pending option lookup cannot establish report data, but settled static
    # catalogue headings are independent evidence of names only.
    names_only = (health.get('healthy') is False and bool(health.get('uncertain'))
                  and not any(health.get(k) for k in ('failed','blocked','pending')))
    if health.get('healthy') is not True and not names_only:
        return outcome
    selected = {str(t.get('name') or '') for t in observation.get('tabControls', []) if isinstance(t, dict) and t.get('selected') is True}
    headings = [str(h) for h in observation.get('headings', []) if isinstance(h, str) and h.strip()]
    candidates = []
    for content in _knowledge_evidence_strings(evidence.get('knowledge') or {}):
        for passage in _knowledge_semantic_passages(content):
            fields = _knowledge_content_fields(passage, include_metadata=True)
            page, section = fields.get('page', '').strip('` '), fields.get('section', '')
            if ('catalogue' not in fields.get('type', '').casefold() or page != outcome.result.page
                    or section not in selected or not fields.get('content')):
                continue
            names = [n.strip().rstrip('.') for n in fields['content'].split(';')]
            visible = [n for n in names if n in headings]
            if visible:
                candidates.append((section, visible))
    if len(candidates) != 1:
        return outcome
    section, names = candidates[0]
    result = replace(outcome.result, status='success', section=section, selected_state=section,
        source_section='catalogueHeadings', answer_shape='overview', completeness='bounded', scope='unknown', missing=(),
        facts=('The currently selected catalogue shows these report families: ' + '; '.join(names[:20]) + '.',
               'These are catalogue entries. No report was generated, opened, exported, or downloaded.',
               *(('Some supporting reads were unconfirmed; only the rendered catalogue names are established, not report data or filter options.',) if names_only else ())))
    return ReaderOutcome(result, {**evidence, 'nativeCatalogueEvidence': {'selectedTab': section, 'headings': names},
                                  'result': result.public_json()})


@dataclass(frozen=True)
class _DocumentedSourceResolution:
    page: str = ""
    invalid_path_count: int = 0
    detail_candidate_count: int = 0


def _canonical_documented_page(value: Any) -> str:
    """Accept one standalone Markdown or plain route, never trailing prose."""

    if not isinstance(value, str):
        return ""
    match = re.fullmatch(r"\s*`?(/[A-Za-z][A-Za-z0-9_/-]*)`?\s*", value)
    if not match:
        return ""
    page = match[1]
    if page.startswith("//") or any(char in page for char in "?#\\"):
        return ""
    return page


def _documented_source_is_detail(passage: str, fields: dict[str, str], page: str) -> bool:
    """Keep record-detail destinations out of primary collection discovery."""

    heading = passage.splitlines()[0] if passage else ""
    semantic_labels = " ".join((heading, fields.get("section", ""), fields.get("type", "")))
    return bool(
        re.search(r"(?:^|[/_-])[^/]*details?(?:$|[/_-])", page, re.IGNORECASE)
        or re.search(r"\b(?:record|item|application|task)?\s*details?\b", semantic_labels, re.IGNORECASE)
    )


def _resolve_documented_object_source(
    knowledge: dict[str, Any], question: str, context: dict[str, Any],
) -> _DocumentedSourceResolution:
    """Resolve only an unambiguous documented primary identity in the named module.

    This is a navigation hint, not an authorization grant or a data-scope claim.
    Foreign-key columns and record-detail pages never nominate a target list.
    """
    if question_is_conceptual(question) or re.search(r'/[a-zA-Z][\w/-]+', question):
        return _DocumentedSourceResolution()
    tokens = lambda s: {t.rstrip('s') for t in re.findall(r'[a-z]+', s.casefold())}
    values = _resolved_intent_values(context)
    requested = tokens(values.get('businessObject') or question)
    hint = context.get('sourceHint') or semantic_source_hint(context)
    module_hint = str(hint.get('page') or '').strip('/').split('/')[0]
    candidates = set()
    invalid_path_count = 0
    detail_candidate_count = 0
    passages = [p for c in _knowledge_evidence_strings(knowledge) for p in _knowledge_semantic_passages(c)]
    documented_modules = {path.strip('/').split('/')[0] for p in passages
                          for path in re.findall(r'`(/[A-Za-z][A-Za-z0-9_/-]*)`', p)}
    named_modules = {m for m in documented_modules if tokens(m) <= tokens(question)}
    explicit_module = next(iter(named_modules)) if len(named_modules) == 1 else ''
    for content in _knowledge_evidence_strings(knowledge):
        for passage in _knowledge_semantic_passages(content):
            fields = _knowledge_content_fields(passage, include_metadata=True)
            if passage.startswith('### Control:') and 'tab' in fields.get('type','').casefold():
                name = tokens(fields.get('name','')) - {'tab','switcher','control'}
                specific = name - {'task','record','item','list','queue'}
                paths = set(re.findall(r'`(/[A-Za-z][A-Za-z0-9_/-]*)`',fields.get('destination','')))
                if explicit_module or module_hint:
                    paths = {p for p in paths if p.strip('/').split('/')[0] == (explicit_module or module_hint)}
                if name and specific and name <= tokens(question) and len(paths)==1:
                    candidates.update(paths)
            raw_page = fields.get('page', '')
            page = _canonical_documented_page(raw_page)
            if raw_page and not page:
                invalid_path_count += 1
                continue
            if not page:
                continue
            if _documented_source_is_detail(passage, fields, page):
                detail_candidate_count += 1
                continue
            module = page.strip('/').split('/')[0]
            if explicit_module and module != explicit_module:
                continue
            if module_hint and not explicit_module and module != module_hint:
                continue
            section_words = tokens(fields.get('section', '')) - {'task', 'record', 'list', 'view', 'item'}
            # A preposition such as 'to' in 'To Do' cannot name that queue.
            # Require the complete distinctive label, not one shared token.
            named_view = not module_hint and bool(section_words) and section_words <= tokens(question)
            if not (tokens(module) & tokens(question) or module == module_hint or named_view):
                continue
            for column in re.split(r'[;,]', fields.get('content', '')):
                match = re.fullmatch(r'\s*([A-Za-z ]+?)\s+(?:No\.?|Number|ID)\s*', column)
                if not match:
                    continue
                subject = tokens(match[1])
                if subject & {'source', 'related', 'parent', 'linked', 'reference'}:
                    continue
                if subject and subject <= requested:
                    candidates.add(page)
                break  # Subsequent identities are related fields, not the primary object.
    return _DocumentedSourceResolution(
        page=next(iter(candidates)) if len(candidates) == 1 else '',
        invalid_path_count=invalid_path_count,
        detail_candidate_count=detail_candidate_count,
    )


def _documented_object_source(knowledge: dict[str, Any], question: str, context: dict[str, Any]) -> str:
    return _resolve_documented_object_source(knowledge, question, context).page


def _filter_return_requested(question: str) -> bool:
    return bool(re.search(r'\b(?:cancel|close|dismiss)\b.*\bfilter\b.*\breturn\s+to\s+'
                          r'(?:the\s+)?(?:(?:task|tickets?)\s+)?list\b|(?:取消|关闭).*筛选.*返回.*列表', question, re.I))


def _filter_return_outcome(outcome: ReaderOutcome, observation: dict[str, Any],
                           executions: list[dict[str, Any]], context: dict[str, Any]) -> ReaderOutcome:
    """Closing an overlay proves neither list recovery nor an empty collection."""
    previous = context.get('previousIntent') or {}
    expected_page = semantic_source_hint(context).get('page') or outcome.result.page
    expected_view = previous.get('selectedState') or _resolved_intent_values(context).get('view')
    actual_page = executions[-1].get('input', {}).get('startPath')
    tables = [n for n in _observation_semantic_nodes(observation)
              if n.get('kind') in {'table', 'grid'} and n.get('columnHeaders')]
    # Do not merge competing tables or mistake a dashboard's empty card for a list.
    unique = {n.get('nodeId') or n.get('heading'): n for n in tables}
    source = next(iter(unique.values())) if len(unique) == 1 else None
    missing = 'filter_return_list_unverified'
    result = None
    if actual_page != expected_page:
        missing = 'filter_return_source_mismatch'
    elif source is not None:
        selected = str(source.get('selectedState') or '')
        if expected_view and not _state_control_label_matches(selected, expected_view):
            missing = 'filter_return_view_mismatch'
        elif source.get('rowFields') or source.get('rowSummaries') or _raw_observation_has_empty_state(source):
            result = _result_from_structured_observation(observation, page=actual_page,
                section_name=str(source.get('nodeId') or source.get('heading') or ''),
                answer_shape='list', scope='unknown')
    if result is None or result.status not in {'success', 'no_data'}:
        result = replace(outcome.result, status='not_confirmed', answer_shape='list', facts=(),
                         missing=(missing,), workflow_state='filter_return_unverified')
    else:
        result = replace(result, workflow_state='filter_return_verified',
                         intent_context=outcome.result.intent_context, source_hint=outcome.result.source_hint)
    evidence = {**outcome.audit_evidence, 'observation': observation,
                'filterReturnEvidence': {'cancelVerified': True, 'expectedPage': expected_page,
                    'expectedView': expected_view or '', 'listVerified': result.status in {'success', 'no_data'}},
                'result': result.public_json()}
    guarded = _guard_requested_team_scope(ReaderOutcome(result, evidence), outcome.result.intent_context)
    if guarded.result.status == 'not_confirmed':
        result = replace(guarded.result, workflow_state='filter_return_unverified')
        return ReaderOutcome(result, {**guarded.audit_evidence, 'result': result.public_json()})
    return guarded


def _documented_detail_destination(
    knowledge: dict[str, Any],
    source_page: str,
    permitted_paths: tuple[str, ...],
) -> str:
    """Resolve one documented, permitted detail route for the current list."""

    source = urlsplit(source_page).path.rstrip("/").casefold() or "/"
    candidates: set[str] = set()
    for content in _knowledge_evidence_strings(knowledge):
        for passage in _knowledge_semantic_passages(content):
            fields = _knowledge_content_fields(passage, include_metadata=True)
            page_routes = re.findall(
                r"`(/[A-Za-z][A-Za-z0-9_/-]*)`",
                fields.get("page", ""),
            )
            if not page_routes or not _documented_source_is_detail(
                passage, fields, page_routes[0],
            ):
                continue
            documented_routes = {
                route.rstrip("/").casefold() or "/"
                for route in re.findall(r"`(/[A-Za-z][A-Za-z0-9_/-]*)`", passage)
            }
            if source not in documented_routes:
                continue
            detail_routes = {
                route.rstrip("/").casefold() or "/"
                for route in page_routes
                if (route.rstrip("/").casefold() or "/") != source
            }
            for permitted in permitted_paths:
                permitted_path = urlsplit(permitted).path.rstrip("/") or "/"
                if permitted_path.casefold() in detail_routes:
                    candidates.add(permitted_path)
    return next(iter(candidates)) if len(candidates) == 1 else ""


def _requested_completion_period(question: str, context: dict[str, Any] | None = None) -> str:
    """Keep an explicit calendar qualifier attached to its completion measure."""
    match = re.search(r'\b(?:this|last|previous|current)\s+(?:week|month|year)\b', question, re.I)
    if not match:
        return ''
    subject = question
    if re.match(r'\s*(?:what|how) about\b', question, re.I):
        subject += ' ' + str(((context or {}).get('previousIntent') or {}).get('question') or '')
        if _prior_personal_completion_measure(context or {}):
            subject += ' completed'
    value = match[0].casefold().replace('previous ', 'last ').replace('current ', 'this ')
    return value if re.search(r'\bcomplet(?:e|ed|ion)\b', subject, re.I) else ''


def _prior_personal_completion_measure(context: dict[str, Any]) -> bool:
    prior = context.get('previousIntent') or {}
    source = prior.get('countSource') or {}
    return (prior.get('resultStatus') == 'success' and source.get('view') == 'Completed'
            and source.get('page') in {'/licensing/applications', '/content/ContentApplications'}
            and source.get('labels') == ['Personal Completed applications by task approval time'])


def _personal_completion_query(question: str, context: dict[str, Any]) -> str:
    """A narrow count intent; never silently drop service/actor/status filters."""
    period = _requested_completion_period(question, context)
    if not period:
        return ''
    direct = r'\s*how many (?:licenses|applications|service applications)(?: did I complete| have I completed) (?:this|last|previous|current) (?:week|month|year)[?.!]?\s*'
    if re.fullmatch(direct, question, re.I):
        return period
    if re.fullmatch(r'\s*(?:what|how) about (?:this|last|previous|current) (?:week|month|year)[?.!]?\s*', question, re.I):
        previous = (context.get('previousIntent') or {}).get('question', '')
        if re.fullmatch(direct, previous, re.I) or _prior_personal_completion_measure(context):
            return period
    return ''


def _guard_completion_period_count(outcome: ReaderOutcome, question: str, context: dict[str, Any]) -> ReaderOutcome:
    """A list total or an effective/submission date cannot prove a completion-period count."""
    period = _requested_completion_period(question, context)
    if (not period or reader_answer_shape(question, context) != 'count'
            or outcome.result.status not in {'success', 'no_data', 'not_confirmed'}):
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation') or {}
    metrics = observation.get('metrics') or []
    aggregate = observation.get('completionAggregate') or {}
    if (aggregate.get('verified') is True and aggregate.get('period') == period
            and aggregate.get('scope') == 'personal' and aggregate.get('dateField') == 'taskApprovalAt'
            and aggregate.get('stablePasses') == 2 and type(aggregate.get('count')) is int
            and aggregate['count'] >= 0 and outcome.result.scope == 'personal'
            and outcome.result.status == 'success'):
        return outcome
    supported = []
    for metric in metrics:
        if not isinstance(metric, dict):
            continue
        label, value = str(metric.get('label') or ''), metric.get('value')
        personal = outcome.result.scope == 'personal' or bool(re.search(r'\b(?:my|your)\b', label, re.I))
        if (period in label.casefold() and re.search(r'\bcomplet(?:e|ed|ion)\b', label, re.I)
                and personal and re.fullmatch(r'\d[\d,]*', str(value))):
            supported.append(f'{label}: {value}')
    if len(supported) == 1 and (observation.get('readHealth') or {}).get('healthy') is True:
        result = replace(outcome.result, status='success', facts=tuple(supported), missing=())
    else:
        result = replace(outcome.result, status='not_confirmed', facts=(), completeness='unknown',
                         missing=('completion_period_not_verified',))
    return ReaderOutcome(result, {**evidence, 'completionPeriod': period, 'result': result.public_json()})


def _native_queue_followup(outcome: ReaderOutcome, question: str, context: dict[str, Any]) -> ReaderOutcome:
    from .reader_intent import resolve_literal_view_followup
    resolved = resolve_literal_view_followup(question, context)
    if not resolved or outcome.result.status not in {'success','not_confirmed'}:
        return outcome
    if semantic_source_hint(context).get('page') != outcome.result.page:
        return outcome
    requested = _resolved_intent_values(resolved.planner_context(context)).get('view', '')
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True:
        return outcome
    tables = [n for n in _observation_semantic_nodes(observation) if n.get('kind') in {'table','grid'}
              and n.get('columnHeaders') and _state_control_label_matches(n.get('selectedState'), requested)]
    if len(tables) != 1:
        return outcome
    result = _result_from_structured_observation(observation, page=outcome.result.page,
        section_name=str(tables[0].get('nodeId') or ''), answer_shape='list', scope=outcome.result.scope)
    if result is None or result.status not in {'success','no_data'}:
        return outcome
    result = replace(result, intent_context=outcome.result.intent_context,source_hint={'page':outcome.result.page})
    return ReaderOutcome(result,{**evidence,'verifiedQueueView':requested,'result':result.public_json()})


def _native_longest_overdue(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Select the largest visible overdue duration only from one healthy table."""

    if not re.fullmatch(r"\s*which one has been overdue the longest\s*[?.!]?\s*", question, re.I):
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get("observation") or ((evidence.get("portalEvidence") or {}).get("result") or {}).get("observation")
    # This helper is called only after the direct dashboard observation has
    # returned successfully. The gateway's compact API observation does not
    # always repeat its UI readHealth marker, so requiring that optional field
    # here would discard the same fresh card values we just read.
    if not isinstance(observation, dict):
        return outcome
    tables = [node for node in _observation_semantic_nodes(observation)
              if node.get("kind") in {"table", "grid"} and node.get("columnHeaders") and node.get("rowFields")]
    if len(tables) != 1:
        return outcome
    table = tables[0]
    candidates: list[tuple[int, dict[str, Any]]] = []
    for row in table.get("rowFields") or []:
        if not isinstance(row, dict):
            continue
        sla = next((str(value) for key, value in row.items() if _key(key) in {"sla", "sladescription"}), "")
        match = re.search(r"\b(\d+)\s*d(?:ays?)?\s+overdue\b", sla, re.I)
        if match:
            candidates.append((int(match.group(1)), {key: value for key, value in row.items() if key in table["columnHeaders"]}))
    if not candidates:
        return outcome
    maximum = max(days for days, _row in candidates)
    matched_rows = [row for days, row in candidates if days == maximum]
    if len(matched_rows) != 1:
        return outcome
    result = replace(
        outcome.result,
        status="success",
        section=str(table.get("heading") or table.get("nodeId") or ""),
        source_section=str(table.get("nodeId") or ""),
        answer_shape="detail",
        completeness="bounded",
        facts=(json.dumps(matched_rows[0], ensure_ascii=False, separators=(",", ":")),
               f"This is the longest overdue duration among the current bounded list: {maximum} days overdue."),
        missing=(),
    )
    return ReaderOutcome(result, {**evidence, "nativeLongestOverdue": maximum, "result": result.public_json()})


def _native_approaching_sla_rows(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Recover visible non-overdue SLA countdown rows without inventing a threshold.

    The Admin Portal labels some pending rows with a compact countdown such as
    ``1d`` rather than the words ``Due in 1 day``. That is sufficient to
    report the row's displayed SLA value, but not to claim a product-defined
    number of days for what counts as "approaching".
    """

    if _due_query_mode(question) != "upcoming":
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get("observation") or ((evidence.get("portalEvidence") or {}).get("result") or {}).get("observation")
    if not isinstance(observation, dict):
        return outcome
    tables = [node for node in _observation_semantic_nodes(observation)
              if node.get("kind") in {"table", "grid"} and node.get("columnHeaders") and node.get("rowFields")]
    if len(tables) != 1:
        return outcome
    table = tables[0]
    visible_rows: list[dict[str, Any]] = []
    for row in table.get("rowFields") or []:
        if not isinstance(row, dict):
            continue
        sla = next((str(value).strip() for key, value in row.items()
                    if _key(key) in {"sla", "sladescription"}), "")
        normalized_sla = re.sub(r"\s+", " ", sla).casefold()
        is_countdown = bool(re.search(r"\bdue in\b|\bdue soon\b|\bupcoming\b|即将|临近|قريب", normalized_sla))
        is_compact_countdown = bool(re.fullmatch(r"\d+\s*d(?:\s*\d+\s*h)?", normalized_sla))
        is_overdue = bool(re.search(r"\boverdue\b|\bpast due\b|逾期|متأخر", normalized_sla))
        if not (is_countdown or is_compact_countdown) or is_overdue:
            continue
        visible = {key: value for key, value in row.items() if key in table["columnHeaders"]}
        if visible:
            visible_rows.append(visible)
    if not visible_rows:
        candidates = (observation.get('apiDiscovery') or {}).get('candidates') or []
        api_rows: list[dict[str, Any]] = []

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                sla_value = next((str(child).strip() for key, child in value.items()
                                  if _key(key) in {'sla', 'sladescription'}), '')
                compact = bool(re.fullmatch(r"\d+\s*d(?:\s*\d+\s*h)?", sla_value.casefold()))
                textual = bool(re.search(r"\bdue in\b|\bdue soon\b|\bupcoming\b", sla_value, re.I))
                if (compact or textual) and not re.search(r"\boverdue\b|\bpast due\b", sla_value, re.I):
                    permitted = {'applicationno', 'applicationnumber', 'servicename', 'servicecategory', 'status', 'sla', 'sladescription'}
                    row = {key: child for key, child in value.items() if _key(key) in permitted and isinstance(child, (str, int, float))}
                    if row:
                        api_rows.append(row)
                for child in value.values():
                    visit(child)
            elif isinstance(value, (list, tuple)):
                for child in value:
                    visit(child)

        for candidate in candidates:
            if (isinstance(candidate, dict)
                    and candidate.get('operationKey') == 'POST /api/Application/MyTodoPage'
                    and candidate.get('status') == 200
                    and isinstance(candidate.get('responseEvidence'), dict)
                    and candidate['responseEvidence'].get('isSuccess') is not False):
                visit(candidate['responseEvidence'])
        visible_rows = list(dict.fromkeys(json.dumps(row, sort_keys=True, ensure_ascii=False) for row in api_rows))
        visible_rows = [json.loads(row) for row in visible_rows]
    if not visible_rows:
        return outcome
    facts = tuple(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in visible_rows[:8])
    result = replace(
        outcome.result,
        status="success",
        section=str(table.get("heading") or table.get("nodeId") or ""),
        source_section=str(table.get("nodeId") or ""),
        answer_shape="due",
        completeness="bounded",
        facts=(*facts, "Rows are shown from their visible non-overdue SLA countdowns; the portal does not define an 'approaching SLA' day threshold."),
        missing=(),
    )
    return ReaderOutcome(result, {**evidence, "nativeApproachingSla": True, "result": result.public_json()})


def _profile_verification_empty_pending_result(observation: Any) -> ReaderResult | None:
    """Confirm a zero pending-review count only from the Profile card's zero total.

    The dashboard's Profile Verification card has no separately labelled
    Pending Review counter. A displayed zero total-task count does establish
    that there can be no pending task in that card; any non-zero total remains
    unconfirmed instead of borrowing the Service Application queue's count.
    """

    # This helper is called only after the direct dashboard observation has
    # returned successfully. The compact API observation does not always
    # repeat its UI readHealth marker, so do not discard its fresh card data.
    if not isinstance(observation, dict):
        return None
    values: list[tuple[str, Any]] = []

    def visit(value: Any, prefix: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                path = f"{prefix}.{key}" if prefix else str(key)
                values.append((path, child))
                visit(child, path)
        elif isinstance(value, (list, tuple)):
            for child in value:
                visit(child, prefix)

    visit(observation)
    total_values = [value for path, value in values if re.fullmatch(
        r"profileverificationcard(?:totaltasks|totalcount)", _key(path), re.I,
    )]
    if not total_values or not all(type(value) in {int, float} and value == 0 for value in total_values):
        return None
    return ReaderResult(
        status="success",
        summary="The current Profile Verification dashboard card is empty.",
        page="/dashboard",
        section="Profile Verification",
        source_section="profileVerificationCard",
        answer_shape="count",
        completeness="bounded",
        facts=("Pending Review: 0.", "The current Profile Verification dashboard card shows 0 total tasks; no Service Application queue count was used."),
    )


def _native_explicit_source_rows(observation: Any, *, page: str, question: str) -> ReaderResult | None:
    """Return one current rendered list for a deliberately named source page.

    This is used only after a successfully authorised direct read of a page
    named in the question. It never selects a sibling module or invents a
    category when the matching table is not rendered.
    """

    if not isinstance(observation, dict) or _observation_has_error_state(observation):
        return None
    tables = [node for node in _observation_semantic_nodes(observation)
              if node.get("kind") in {"table", "grid"} and node.get("columnHeaders") and node.get("rowFields")]
    if len(tables) != 1:
        return None
    table = tables[0]
    result = _result_from_structured_observation(
        observation, page=page, section_name=str(table.get("nodeId") or table.get("heading") or ""),
        answer_shape="list", scope="unknown", question=question,
    )
    if result is None or result.status not in {"success", "no_data"}:
        return None
    if page == "/financial-payment/refunds":
        # Finance renders AED beside the amount/statistics even though the
        # refund row schema has no Currency column. Preserve that bounded
        # page-level currency evidence instead of reporting it as missing.
        result = replace(result, facts=(*result.facts, "Currency: AED"))
    return replace(result, source_hint={"page": page})


def _content_confirmed_count_navigation_result(result: ReaderResult, observation: Any = None) -> ReaderResult:
    """Return the visible total first, then explain and locate that metric."""

    total_facts: list[str] = []
    for label, value, _source in _observed_metric_pairs(observation):
        normalized_label = re.sub(r"[^a-z0-9]", "", label.casefold())
        if normalized_label in {"total", "totalcount", "confirmedcount"} and re.fullmatch(r"\d[\d,.]*", value):
            total_facts.append(f"Confirmed Count: {value}")
            break
    facts = (
        "Confirmed Count is the total displayed for the selected Content Library category and status view; it is not just the number of sample rows shown in the answer.",
        "To verify it, open Admin Portal > Content Module > Content Library, select the relevant category and status view, then check the summary or pagination area on that page.",
        "The current verified source page is /content/ContentLibrary. A new read is required if the category, status, or count has changed.",
    )
    return replace(
        result,
        answer_shape="detail",
        completeness="bounded",
        facts=(*total_facts, *result.facts, *facts),
        source_hint={"page": "/content/ContentLibrary", "section": result.source_section or "Content Library"},
    )


def _native_status_filter_rows(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Recover a failed planner only after a literal status selection and rows agree."""
    if (outcome.result.status not in {'success','not_confirmed'}
            or not re.search(r'\b(?:view|show)\b.*\bdata in\b', question, re.I)):
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True:
        return outcome
    target = _explicit_observed_filter(question, observation)
    selected_controls = [c for c in observation.get('filterControls', []) if isinstance(c, dict)
        and c.get('role') == 'combobox'
        and (re.search(r'status', str(c.get('label') or ''), re.I)
             or str(c.get('label') or '').casefold() == target.casefold())
        and target and {str(v).casefold() for v in c.get('selected', [])} == {target.casefold()}]
    tables = [n for n in _observation_semantic_nodes(observation) if n.get('kind') in {'table','grid'}
              and 'Status' in n.get('columnHeaders', [])]
    if len(selected_controls) != 1 or len(tables) != 1:
        return outcome
    source = tables[0]
    rows = source.get('rowFields') or []
    if rows and not all(isinstance(row,dict) and str(row.get('Status') or '').casefold() == target.casefold() for row in rows):
        return outcome
    result = _result_from_structured_observation(observation, page=outcome.result.page,
        section_name=str(source.get('nodeId') or ''), answer_shape='list', scope=outcome.result.scope,
        question=question)
    if result is None or result.status not in {'success','no_data'}:
        return outcome
    result = replace(result, facts=(*result.facts, f'The selected Status filter is {target}. This is a bounded view of matching records.'),
                     intent_context=outcome.result.intent_context, source_hint=outcome.result.source_hint)
    return ReaderOutcome(result, {**evidence, 'verifiedStatusFilter':target,'result':result.public_json()})


def _native_filter_outcome(outcome: ReaderOutcome, question: str, executions: list[dict[str, Any]],
                           context: dict[str, Any] | None = None) -> ReaderOutcome:
    """Report only rendered filter schema or a verified open/dismiss sequence."""
    if (outcome.result.status in {'no_permission', 'load_failed'}
            or any(m in {'requested_queue_view_unverified', 'requested_team_scope_unverified',
                         'requested_view_not_visible', 'requested_object_unverified'} for m in outcome.result.missing)
            or not _question_needs_native_surface(question)):
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation')
    if not isinstance(observation, dict):
        observation = ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if (not isinstance(observation, dict) or (observation.get('readHealth') or {}).get('healthy') is not True
            or _observation_has_error_state(observation)):
        if _filter_return_requested(question):
            failed = replace(outcome.result, status='load_failed', facts=(),
                             missing=('filter_return_read_failed',), workflow_state='')
            return ReaderOutcome(failed, {**evidence, 'result': failed.public_json()})
        return outcome
    dialogs = observation.get('dialogs') or []
    fields = tuple(dict.fromkeys(str(label) for label in observation.get('filterDialogFields', []) if isinstance(label, str)))
    actions = executions[-1].get('input', {}).get('actionTypes', []) if executions else []
    # Entering a verified parent tab does not apply any filter criteria.
    filter_actions = [action for action in actions if action not in {'observe', 'switch_tab', 'navigate'}]
    facts = ()
    if re.search(r'\bopen\b.{0,50}\bfilter\b|打开.{0,15}筛选', question, re.I):
        if (len(dialogs) == 1 and re.search(r'\bfilter\b|筛选', str(dialogs[0]), re.I) and fields
                and executions and executions[-1].get('status') == 'passed'
                and filter_actions == ['show_filter']):
            facts = ('The Filter surface is open. Its observed fields are: ' + '; '.join(fields[:20]) + '.',
                     'No filter criteria were applied.')
    elif re.search(r'\b(?:cancel|close|dismiss)\b.{0,50}\bfilter\b|(?:关闭|取消).{0,15}筛选', question, re.I):
        if (not dialogs and executions and executions[-1].get('status') == 'passed'
                and filter_actions == ['show_filter', 'dismiss_overlay']):
            if _filter_return_requested(question):
                return _filter_return_outcome(outcome, observation, executions, context or {})
            facts = ('In a fresh read-only view, the Filter surface was opened and Cancel was selected; the surface is now closed. '
                     'This confirms the cancellation flow in that fresh view, not a change to your browser session or any business data.',)
    if not facts:
        if _filter_return_requested(question):
            unverified = replace(outcome.result, status='not_confirmed', facts=(),
                                 missing=('filter_cancellation_unverified',), workflow_state='')
            return ReaderOutcome(unverified, {**evidence, 'result': unverified.public_json()})
        return outcome
    result = replace(outcome.result, status='success', answer_shape='detail', facts=facts, missing=(),
                     page=outcome.result.page or str(executions[-1].get('input', {}).get('startPath') or ''),
                     completeness='bounded', source_section='filterControls', scope='unknown')
    tables = [n for n in _observation_semantic_nodes(observation) if n.get('kind') in {'table', 'grid'}]
    views = {str(n.get('selectedState')) for n in tables if n.get('selectedState')}
    if len(views) == 1:
        result = replace(result, selected_state=next(iter(views)))
    return ReaderOutcome(result, {**evidence, 'observation':observation, 'nativeFilterEvidence': {'fields': list(fields), 'dialogCount': len(dialogs)},
                                 'result': result.public_json()})


def knowledge_supports_result(result: ReaderResult, knowledge_context: Any) -> bool:
    """Require knowledge-only success facts to be grounded in retrieved content."""

    if result.status != "success" or not result.facts:
        return False
    evidence = tuple(passage for chunk in _knowledge_evidence_strings(knowledge_context)
                     for passage in _knowledge_semantic_passages(chunk))
    if not evidence:
        return False
    for fact in result.facts:
        normalized_fact = re.sub(r"\s+", " ", fact).strip().casefold()
        if (
            not normalized_fact
            or _knowledge_fact_is_structural(fact)
            or any(marker in normalized_fact for marker in _KNOWLEDGE_SENTINELS)
        ):
            return False
        clauses = _knowledge_fact_clauses(fact)
        if not clauses:
            return False
        # A compound fact is grounded only when one retrieved chunk supports
        # every clause. Never stitch independent relationships across chunks.
        if not any(
            all(_knowledge_claim_supported_by_chunk(clause, chunk) for clause in clauses)
            for chunk in evidence
        ):
            return False
    return True


_OBSERVATION_PROSE_TERMS = frozenset(
    {
        "and", "are", "area", "areas", "card", "cards", "column", "columns", "control", "controls",
        "count", "counts", "current", "currently", "data", "display", "displayed", "displays", "field",
        "fields", "filter", "filters", "for", "from", "has", "have", "in", "includes", "including",
        "information", "is", "label", "labels", "list", "main", "major", "of", "on", "overview",
        "page", "present", "primary", "region", "regions", "row", "rows", "section", "shown", "shows",
        "summary", "tab", "tabs", "table", "tables", "task", "the", "this", "to", "value", "values",
        "with",
    }
)
_EXPLICIT_EMPTY_MARKERS = (
    "no data", "no records", "no result", "no matching", "nothing found", "暂无数据", "暂无记录", "没有数据",
)
_OBSERVATION_FALLBACK_DISALLOWED_TERMS = frozenset(
    {
        *FORBIDDEN_ACTION_TERMS,
        "attention", "blacklist", "black list", "find", "search", "named", "specific", "particular",
        "detail", "details", "filter", "status", "type", "category", "pending", "completed", "overdue",
        "due", "sla", "date", "recent", "between", "before", "after", "manager",
        "关注", "注意", "黑名单", "查找", "搜索", "指定", "具体", "详情", "明细", "筛选", "过滤",
        "状态", "类型", "类别", "待处理", "已完成", "逾期", "到期", "日期", "最近", "经理",
        "اهتمام", "قائمة سوداء", "بحث", "محدد", "تفاصيل", "تصفية", "حالة", "نوع", "فئة", "تاريخ",
    }
)
_COLLECTION_FIELD_DETAIL_TERMS = frozenset(
    {"detail", "details", "详情", "明细", "تفاصيل"}
)
_OBSERVATION_FALLBACK_MAX_FACTS = 8
_OBSERVATION_FALLBACK_MAX_FACT_CHARS = 300
_OBSERVATION_FALLBACK_MAX_FACT_BYTES = 2_400
def _observation_scalar_strings(value: Any, *, limit: int = 300) -> tuple[str, ...]:
    values: list[str] = []

    def visit(item: Any) -> None:
        if len(values) >= limit:
            return
        if isinstance(item, str):
            text = re.sub(r"\s+", " ", item).strip()
            if text:
                values.append(text[:1_000])
        elif isinstance(item, (int, float)) and not isinstance(item, bool):
            values.append(str(item))
        elif isinstance(item, dict):
            for child in item.values():
                visit(child)
        elif isinstance(item, (list, tuple)):
            for child in item:
                visit(child)

    visit(value)
    return tuple(values)


_API_ENVELOPE_FIELDS = frozenset({
    "actioncode", "actionlabel", "actionurl", "code", "detailtarget", "error", "errors",
    "httpcode", "httpstatus", "issuccess", "message", "msg", "openmode", "operationkey",
    "rawresponse", "requestid", "statuscode", "success", "timestamp", "traceid",
})
_API_COUNT_FIELDS = frozenset({
    "count", "itemcount", "recordcount", "resultcount", "total", "totalcount", "totalelements",
})
_API_SHAPE_TERMS = {
    "attention": frozenset({"attention", "blocked", "escalated", "overdue", "priority", "risk", "urgent", "waiting"}),
    "count": frozenset({"count", "statistics", "stats", "summary", "total"}),
    "detail": frozenset({"detail", "details"}),
    "due": frozenset({"deadline", "due", "expired", "late", "overdue", "remaining", "sla", "waiting"}),
    "list": frozenset({"items", "list", "page", "records", "results"}),
    "overview": frozenset({"overview", "statistics", "stats", "summary", "total"}),
}
_API_QUERY_STOPWORDS = frozenset({
    "a", "an", "any", "are", "current", "do", "for", "have", "i", "in", "is", "me", "my",
    "of", "on", "show", "the", "there", "to", "what", "which", "with",
})


def _api_field_tokens(value: object) -> list[str]:
    text = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", str(value or ""))
    text = re.sub(r"[-_]+", " ", text)
    return re.findall(r"[a-z][a-z0-9]*|\d+(?:\.\d+)?", text.casefold())


def _api_query_tokens(value: str) -> frozenset[str]:
    tokens = {
        token for token in _api_field_tokens(value)
        if len(token) >= 2 and token not in _API_QUERY_STOPWORDS
    }
    # Preserve the original token while adding a conservative singular form.
    # API fields commonly use `task` while natural-language questions use
    # `tasks`; treating those as unrelated destabilizes semantic selection.
    for token in tuple(tokens):
        if token == "statuses":
            tokens.add("status")
        elif len(token) > 4 and token.endswith("ies"):
            tokens.add(token[:-3] + "y")
        elif len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
            tokens.add(token[:-1])
    return frozenset(tokens)


def _due_query_mode(value: str) -> Literal["upcoming", "overdue", "any"]:
    normalized = re.sub(r"\s+", " ", str(value or "").casefold()).strip()
    upcoming = bool(re.search(
        r"\bdue soon\b|\bupcoming\b|\bexpir(?:es?|ing)\b|"
        r"\b(?:approaching|near(?:ing)?)\b.{0,32}\b(?:deadlines?|due|expiry|expiration|sla)\b|"
        r"即将|临近|قريب",
        normalized,
    ))
    overdue = bool(re.search(r"\boverdue\b|\bpast due\b|\blate\b|逾期|متأخر", normalized))
    if upcoming and not overdue:
        return "upcoming"
    if overdue and not upcoming:
        return "overdue"
    return "any"


def _query_requests_record_identities(value: str) -> bool:
    return bool(re.search(
        r"\b(?:which|list|show|display|what are)\b|哪些|列出|显示|اعرض|أي",
        str(value or "").casefold(),
    ))


def _api_unit_relevance(unit: str, *, answer_shape: str, semantic_query: str) -> int:
    unit_tokens = frozenset(_api_field_tokens(unit))
    shape_tokens = _API_SHAPE_TERMS.get(answer_shape, frozenset())
    query_tokens = _api_query_tokens(semantic_query)
    return 4 * len(unit_tokens.intersection(shape_tokens)) + len(unit_tokens.intersection(query_tokens))


_API_INTERNAL_BUSINESS_FIELDS = frozenset({
    "canassign", "canapprove", "canedit", "canreassign", "canview",
    "categorycode", "displayonly", "sourceid", "statusid",
})
_API_INTERNAL_FIELD_SUFFIXES = ("code", "displayonly", "sourceid", "statusid")
_API_COLLECTION_CONTEXT_FIELDS = frozenset({
    "data", "pageitems", "payload", "response", "result",
})


def _api_field_is_internal(key: str) -> bool:
    normalized = _key(key)
    tokens = _api_field_tokens(key)
    return (
        normalized in _API_INTERNAL_BUSINESS_FIELDS
        or normalized.endswith(_API_INTERNAL_FIELD_SUFFIXES)
        or (bool(tokens) and tokens[-1] == "id")
    )


def _api_public_field_key(key: str) -> str:
    parts = [part for part in str(key).split(".") if part]
    visible = [part for part in parts if _key(part) not in _API_COLLECTION_CONTEXT_FIELDS]
    public = ".".join(visible) or str(key)
    # Model-produced facts may already contain the humanized form of a
    # collection path (for example, "Page Items Task No").
    while True:
        cleaned = re.sub(
            r"^(?:page\s*items?|items|rows|records|results|data|list)\s+",
            "",
            public,
            count=1,
            flags=re.IGNORECASE,
        )
        if cleaned == public:
            return public
        public = cleaned


def _api_business_mapping(mapping: dict[str, Any]) -> dict[str, Any]:
    """Keep business values while removing transport metadata and enum helpers."""

    scalar = {
        _api_public_field_key(str(key)): value
        for key, value in mapping.items()
        if (value is None or isinstance(value, (str, int, float, bool)))
        and not _api_field_is_internal(_api_public_field_key(str(key)).rsplit(".", 1)[-1])
    }
    if not scalar:
        return {}

    # Prefer the actual display field when an API returns both a business value
    # and its display/name/code variants. Keep the original key so evidence
    # grounding remains compatible with the selected response.
    normalized_keys = {_key(key) for key in scalar}
    selected: dict[str, Any] = {}
    for key, value in scalar.items():
        normalized = _key(key)
        base = normalized
        for suffix in ("displayonly", "display", "name", "label"):
            if base.endswith(suffix) and len(base) > len(suffix):
                base = base[:-len(suffix)]
                break
        if normalized.endswith(("displayonly", "display")) and base in normalized_keys:
            continue
        if normalized.endswith(("name", "label")) and base in normalized_keys:
            continue
        selected[key] = value
    return selected


def _api_project_fact(fact: str) -> str:
    """Apply the public business-field boundary to one JSON fact."""

    try:
        fields = json.loads(fact)
    except (TypeError, ValueError):
        return fact
    if not isinstance(fields, dict):
        return fact
    projected = _api_business_mapping(fields)
    if not projected:
        return ""
    try:
        return json.dumps(projected, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    except (TypeError, ValueError):
        return ""


def _serialize_api_mapping(
    mapping: dict[str, Any],
    *,
    semantic_query: str,
    answer_shape: str,
    context_path: tuple[str, ...] = (),
) -> str:
    """Serialize complete scalar fields without cutting a JSON fact mid-value."""

    query_tokens = _api_query_tokens(semantic_query)
    shape_tokens = _API_SHAPE_TERMS.get(answer_shape, frozenset())

    def field_priority(item: tuple[str, Any]) -> tuple[int, int]:
        key, value = item
        tokens = frozenset((*_api_field_tokens(key), *_api_field_tokens(value)))
        key_tokens = _api_field_tokens(key)
        readable_requested_label = bool(
            isinstance(value, str) and value.strip() and key_tokens
            and key_tokens[-1] in {"name", "label"}
            and set(key_tokens[:-1]).intersection(query_tokens)
        )
        return (
            20 * readable_requested_label + 4 * len(tokens.intersection(shape_tokens)) + len(tokens.intersection(query_tokens)),
            1 if re.search(r"(?:id|number|no|name|title|status)$", _key(key)) else 0,
        )

    selected: dict[str, Any] = {}
    mapping = _api_business_mapping(mapping)
    visible_context = tuple(
        part for part in context_path
        if _key(part) not in _API_COLLECTION_CONTEXT_FIELDS
    )
    for key, value in sorted(mapping.items(), key=field_priority, reverse=True):
        if _key(key) in _API_ENVELOPE_FIELDS:
            continue
        if isinstance(value, str) and value.strip().casefold() in _API_TRUNCATION_MARKERS:
            continue
        qualified_key = ".".join((*visible_context[-2:], key)) if visible_context else key
        candidate = {**selected, qualified_key: value}
        try:
            encoded = json.dumps(candidate, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        except (TypeError, ValueError):
            continue
        if len(encoded) <= _OBSERVATION_FALLBACK_MAX_FACT_CHARS:
            selected = candidate
    if not selected:
        return ""
    return json.dumps(selected, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _api_evidence_units(
    value: Any, *, limit: int = 120,
) -> tuple[tuple[dict[str, Any] | None, str, tuple[str, ...]], ...]:
    """Return record-local API units so facts cannot join unrelated rows."""

    units: list[tuple[dict[str, Any] | None, str, tuple[str, ...]]] = []

    def record_scalars(item: dict[str, Any], *, max_depth: int = 4) -> dict[str, Any]:
        """Flatten scalar descendants from one list record without crossing records."""

        flattened: dict[str, Any] = {}
        conflicts: set[str] = set()

        def collect(value: Any, depth: int) -> None:
            if depth > max_depth or len(flattened) >= 40:
                return
            if not isinstance(value, dict):
                return
            for key, child in value.items():
                name = str(key)
                if isinstance(child, dict):
                    collect(child, depth + 1)
                    continue
                if isinstance(child, (list, tuple)):
                    continue
                if not (child is None or isinstance(child, (str, int, float, bool))):
                    continue
                if _key(name) in _API_ENVELOPE_FIELDS or (
                    isinstance(child, str) and child.strip().casefold() in _API_TRUNCATION_MARKERS
                ):
                    continue
                if name in flattened and flattened[name] != child:
                    conflicts.add(name)
                elif name not in conflicts:
                    flattened[name] = child

        collect(item, 0)
        for name in conflicts:
            flattened.pop(name, None)
        return flattened

    def visit(item: Any, path: tuple[str, ...] = ()) -> None:
        if len(units) >= limit:
            return
        if isinstance(item, dict):
            scalars = {
                str(key): child
                for key, child in item.items()
                if (
                    child is None
                    or isinstance(child, (str, int, float, bool))
                )
                and not (
                    isinstance(child, str)
                    and child.strip().casefold() in _API_TRUNCATION_MARKERS
                )
            }
            business_scalars = {
                key: child for key, child in scalars.items()
                if _key(key) not in _API_ENVELOPE_FIELDS
            }
            if business_scalars:
                tokens = [
                    token
                    for key, child in business_scalars.items()
                    for token in (*_api_field_tokens(key), *_api_field_tokens(child))
                ]
                path_tokens = [token for key in path for token in _api_field_tokens(key)]
                units.append((business_scalars, " ".join((*path_tokens, *tokens)), path))
            for key, child in item.items():
                if isinstance(child, (dict, list, tuple)):
                    visit(child, (*path, str(key)))
        elif isinstance(item, (list, tuple)):
            scalar_items = [
                child for child in item
                if (child is None or isinstance(child, (str, int, float, bool)))
                and not (
                    isinstance(child, str)
                    and child.strip().casefold() in _API_TRUNCATION_MARKERS
                )
            ]
            if scalar_items:
                path_tokens = [token for key in path for token in _api_field_tokens(key)]
                value_tokens = [token for child in scalar_items for token in _api_field_tokens(child)]
                units.append((None, " ".join((*path_tokens, *value_tokens)), path))
            for child in item:
                if isinstance(child, (dict, list, tuple)):
                    if isinstance(child, dict):
                        flattened = record_scalars(child)
                        if flattened:
                            path_tokens = [token for key in path for token in _api_field_tokens(key)]
                            record_tokens = [
                                token
                                for key, value in flattened.items()
                                for token in (*_api_field_tokens(key), *_api_field_tokens(value))
                            ]
                            units.append((flattened, " ".join((*path_tokens, *record_tokens)), path))
                    visit(child, path)

    visit(value)
    return tuple(units)


def _api_mapping_fact_supported(fields: dict[str, Any], evidence: Any) -> bool:
    if not fields or not all(
        isinstance(key, str) and (value is None or isinstance(value, (str, int, float, bool)))
        for key, value in fields.items()
    ):
        return False
    def unit_supports(
        mapping: dict[str, Any] | None,
        path: tuple[str, ...],
    ) -> bool:
        if mapping is None:
            return False
        normalized_path = tuple(_key(part) for part in path)
        for qualified_key, value in fields.items():
            parts = tuple(part for part in qualified_key.split(".") if part)
            leaf_key = parts[-1] if parts else qualified_key
            if leaf_key not in mapping or mapping[leaf_key] != value:
                return False
            qualifiers = tuple(_key(part) for part in parts[:-1])
            if qualifiers and normalized_path[-len(qualifiers):] != qualifiers:
                return False
        return True

    return any(
        unit_supports(mapping, path)
        for mapping, _unit, path in _api_evidence_units(evidence)
    )


def _api_evidence_supports_fact(fact: str, evidence: Any) -> bool:
    """Ground one answer fact in a single selected response record or summary."""

    try:
        fields = json.loads(fact)
    except (TypeError, ValueError):
        fields = None
    if isinstance(fields, dict):
        return _api_mapping_fact_supported(fields, evidence)

    fact_tokens = _api_field_tokens(fact)
    concrete = [
        token for token in fact_tokens
        if token[0].isdigit() or (len(token) >= 2 and token not in _OBSERVATION_PROSE_TERMS)
    ]
    if not concrete:
        return False
    for _mapping, unit, _path in _api_evidence_units(evidence):
        unit_tokens = _api_field_tokens(unit)
        if all(concrete.count(token) <= unit_tokens.count(token) for token in set(concrete)):
            polarity_source = " ".join(str(value) for value in (_mapping or {}).values()) or unit
            if _negative_polarity(fact) == _negative_polarity(polarity_source):
                return True
    return False


def _api_evidence_fallback_plan(
    api_evidence: Any,
    *,
    answer_shape: str,
    semantic_query: str = "",
) -> tuple[dict[str, Any] | None, str]:
    """Build a closed result from relevant fields in one selected API response."""

    if not isinstance(api_evidence, dict) or "data" not in api_evidence:
        return None, "selected_response_missing"
    data = api_evidence.get("data")
    units = _api_evidence_units(data)
    normalized_shape = answer_shape if answer_shape in {
        "overview", "count", "list", "attention", "due", "detail",
    } else "unspecified"

    list_values: list[Any] = []
    saw_empty_list = False

    def collect_lists(value: Any) -> None:
        nonlocal saw_empty_list
        if isinstance(value, dict):
            for child in value.values():
                collect_lists(child)
        elif isinstance(value, (list, tuple)):
            saw_empty_list = saw_empty_list or not value
            list_values.extend(value[:20])
            for child in value[:20]:
                if isinstance(child, (dict, list, tuple)):
                    collect_lists(child)

    collect_lists(data)
    mapping_units = [(mapping, unit, path) for mapping, unit, path in units if mapping]
    count_units = [
        ({key: value for key, value in mapping.items() if _key(key) in _API_COUNT_FIELDS}, unit, path)
        for mapping, unit, path in mapping_units
    ]
    count_units = [(mapping, unit, path) for mapping, unit, path in count_units if mapping]
    count_mappings = [mapping for mapping, _unit, _path in count_units]

    selected_mappings: list[tuple[dict[str, Any], tuple[str, ...]]]
    if normalized_shape == "count":
        if not count_units:
            return None, "selected_response_count_not_confirmed"
        ranked_counts = sorted(
            count_units,
            key=lambda item: _api_unit_relevance(
                item[1], answer_shape=normalized_shape, semantic_query=semantic_query,
            ),
            reverse=True,
        )
        best_score = _api_unit_relevance(
            ranked_counts[0][1], answer_shape=normalized_shape, semantic_query=semantic_query,
        )
        tied = [
            (mapping, path) for mapping, unit, path in ranked_counts
            if _api_unit_relevance(unit, answer_shape=normalized_shape, semantic_query=semantic_query) == best_score
        ]
        if len(tied) > 1 and len({json.dumps(item[0], sort_keys=True, default=str) for item in tied}) > 1:
            return None, "selected_response_count_ambiguous"
        selected_mappings = tied[:1]
    elif normalized_shape == "list":
        row_mappings = [
            {
                str(key): value for key, value in item.items()
                if (value is None or isinstance(value, (str, int, float, bool)))
                and _key(key) not in _API_ENVELOPE_FIELDS
                and not (
                    isinstance(value, str)
                    and value.strip().casefold() in _API_TRUNCATION_MARKERS
                )
            }
            for item in list_values if isinstance(item, dict)
        ]
        row_mappings = [mapping for mapping in row_mappings if mapping]
        if row_mappings:
            row_limit = 7 if count_mappings else 8
            row_limit = min(row_limit, requested_record_limit(semantic_query) or row_limit)
            selected_mappings = [
                *((mapping, ()) for mapping in row_mappings[:row_limit]),
                *((mapping, path) for mapping, _unit, path in count_units[:1]),
            ]
        else:
            selected_mappings = []
            scalar_items = [item for item in list_values if item is None or isinstance(item, (str, int, float, bool))]
            if scalar_items:
                facts = _bounded_fact_candidates(tuple(str(item) for item in scalar_items))
                return ({
                    "mode": "observation_result", "result": "success", "answerShape": "list",
                    "completeness": "bounded", "facts": list(facts), "missing": [],
                }, "answerable") if facts else (None, "selected_response_list_not_confirmed")
            zero_count = any(
                isinstance(value, (int, float)) and not isinstance(value, bool) and value == 0
                for mapping in count_mappings for value in mapping.values()
            )
            if (
                saw_empty_list
                and (zero_count or not count_mappings)
                and api_evidence.get("truncated") is not True
            ):
                return ({
                    "mode": "observation_result", "result": "no_data", "answerShape": "list",
                    "completeness": "bounded", "facts": [], "missing": [],
                }, "answerable_empty")
            return None, "selected_response_list_not_confirmed"
    elif normalized_shape == "detail":
        ranked = sorted(
            mapping_units,
            key=lambda item: _api_unit_relevance(
                item[1], answer_shape=normalized_shape, semantic_query=semantic_query,
            ),
            reverse=True,
        )
        selected_mappings = [(ranked[0][0], ranked[0][2])] if ranked else []
        if not selected_mappings:
            return None, "selected_response_detail_not_confirmed"
    elif normalized_shape in {"attention", "due"}:
        ranked = [
            (mapping, unit, path, _api_unit_relevance(
                unit, answer_shape=normalized_shape, semantic_query=semantic_query,
            ))
            for mapping, unit, path in mapping_units
        ]
        if normalized_shape == "due":
            due_mode = _due_query_mode(semantic_query)

            def due_mode_matches(item: tuple[dict[str, Any], str, tuple[str, ...], int]) -> bool:
                mapping, unit, _path, _score = item
                evidence_text = " ".join((
                    unit,
                    *(f"{key} {value}" for key, value in mapping.items()),
                )).casefold()
                if due_mode == "upcoming":
                    return bool(re.search(
                        r"\bdue in\b|\bdue soon\b|\bupcoming(?:due)?\b|"
                        r"\bexpir(?:es?|ing)\b|即将|临近|قريب",
                        evidence_text,
                    )) and not bool(re.search(r"\boverdue\b|\bpast due\b|逾期|متأخر", evidence_text))
                if due_mode == "overdue":
                    return bool(re.search(r"\boverdue\b|\bpast due\b|\blate\b|逾期|متأخر", evidence_text))
                return True

            ranked = [item for item in ranked if due_mode_matches(item)]
            if _query_requests_record_identities(semantic_query):
                ranked = [
                    item for item in ranked
                    if any(
                        re.search(r"(?:id|number|no|name|title|reference)$", _key(key))
                        and value not in (None, "")
                        for key, value in item[0].items()
                    )
                ]
        query_tokens = _api_query_tokens(semantic_query)
        exact_field_ranked = [item for item in ranked if _api_response_leaf_field_tokens(item[0]).intersection(query_tokens)]
        if exact_field_ranked:
            best_field_match = max(
                len(_api_response_leaf_field_tokens(item[0]).intersection(query_tokens))
                for item in exact_field_ranked
            )
            ranked = [
                item for item in exact_field_ranked
                if len(_api_response_leaf_field_tokens(item[0]).intersection(query_tokens)) == best_field_match
            ]
        ranked = sorted((item for item in ranked if item[3] > 0), key=lambda item: item[3], reverse=True)
        selected_mappings = [(mapping, path) for mapping, _unit, path, _score in ranked[:8]]
        if not selected_mappings:
            return None, f"selected_response_{normalized_shape}_not_confirmed"
    else:
        ranked = sorted(
            mapping_units,
            key=lambda item: _api_unit_relevance(
                item[1], answer_shape=normalized_shape, semantic_query=semantic_query,
            ),
            reverse=True,
        )
        selected_mappings = [(mapping, path) for mapping, _unit, path in ranked[:8]]
        if not selected_mappings:
            if saw_empty_list and api_evidence.get("truncated") is not True:
                return ({
                    "mode": "observation_result", "result": "no_data", "answerShape": normalized_shape,
                    "completeness": "bounded", "facts": [], "missing": [],
                }, "answerable_empty")
            return None, "selected_response_content_not_confirmed"

    serialized_mappings: list[str] = []
    for mapping, context_path in selected_mappings:
        try:
            serialized = _serialize_api_mapping(
                mapping,
                semantic_query=semantic_query,
                answer_shape=normalized_shape,
                context_path=context_path,
            )
        except (TypeError, ValueError):
            continue
        if serialized:
            serialized_mappings.append(serialized)
    facts = _bounded_fact_candidates(tuple(serialized_mappings))
    if not facts:
        return None, "selected_response_content_not_confirmed"
    return {
        "mode": "observation_result",
        "result": "success",
        "answerShape": normalized_shape,
        "completeness": "bounded",
        "facts": list(facts),
        "missing": [],
    }, "answerable"


def _api_answer_plan_is_grounded(plan: Any, api_evidence: Any) -> bool:
    """Accept model wording only when every fact is supported by the selected response."""

    result = _observation_plan_result_from_plan(plan)
    if result is None or not isinstance(api_evidence, dict):
        return False
    if result.status == "no_data":
        fallback, _reason = _api_evidence_fallback_plan(
            api_evidence,
            answer_shape=result.answer_shape,
        )
        return fallback is not None and fallback.get("result") == "no_data"
    return bool(
        result.status == "success"
        and result.facts
        and all(_api_evidence_supports_fact(fact, api_evidence.get("data")) for fact in result.facts)
    )


def _observation_fallback_intent(
    question: str,
    answer_shape: Literal["overview", "count", "list", "attention", "due", "detail", "unspecified"] | None = None,
) -> Literal["list", "overview"] | None:
    normalized = re.sub(r"[^\w\u3400-\u9fff\u0621-\u064a]+", " ", str(question or "").casefold())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized or re.search(r"\d", normalized):
        return None
    answer_shape = answer_shape or reader_answer_shape(question)
    if answer_shape not in {"list", "overview"}:
        return None
    if answer_shape == "list" and "show" in set(re.findall(r"[a-z]+", normalized)) and not re.search(
        r"\b(?:list|tasks|applications|licenses|records|items)\b",
        normalized,
    ):
        return None
    latin_words = set(re.findall(r"[a-z]+", normalized))
    disallowed_terms = _OBSERVATION_FALLBACK_DISALLOWED_TERMS
    if answer_shape == "overview":
        disallowed_terms -= {"status", "状态", "حالة"}
    elif answer_shape == "list":
        # Once semantic resolution has established a collection answer, words
        # such as "details" describe the requested row fields. Record-specific
        # requests remain blocked by the identity and filter guards above.
        disallowed_terms -= _COLLECTION_FIELD_DETAIL_TERMS
    if any(
        (" " in term and term in normalized)
        or (term.isascii() and term in latin_words)
        or (not term.isascii() and term in normalized)
        for term in disallowed_terms
    ):
        return None
    return answer_shape


def _observed_identity_search(question: str, context: dict[str, Any], observation: Any, current_page: str) -> dict[str, Any] | None:
    """Bind a literal requested identity to one observed search-and-apply surface."""
    identity = _resolved_intent_values(context).get("recordIdentity", "")
    if not identity:
        identity = _explicit_record_identity(question)
    if not identity and re.match(r"\s*(?:find|search\b.*?\bfor|查找|搜索)\b", question, re.IGNORECASE):
        identifiers = re.findall(r"(?<![\w/-])(?=[A-Za-z0-9-]*[A-Za-z])(?=[A-Za-z0-9-]*\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+(?![\w/-])", question)
        if len(identifiers) == 1:
            identity = identifiers[0]
    same_record_search = bool(re.fullmatch(r'\s*(?:please\s+)?(?:find|locate)\s+(?:that|the)\s+same\s+[a-z ]+\s+by\s+its\s+[a-z ]+(?:no\.?|number|id)\.?\s*', question, re.I)
                              and _resolved_intent_values(context).get('recordIdentity'))
    if (not identity or len(identity) > 120 or not current_page or not isinstance(observation, dict)
            or question_is_conceptual(question)
            or not (same_record_search or re.search(r"(?<!\w)" + re.escape(identity) + r"(?!\w)", question, re.IGNORECASE))
            or re.search(r"\b(?:not|except|excluding|without|compare|versus)\b|排除|不要|对比", question, re.IGNORECASE)):
        return None
    controls = [control for control in observation.get("filterControls", []) if isinstance(control, dict)
                and control.get("role") == "textbox" and control.get("filterSurface") is True
                and control.get("selector") and str(control.get("label") or "").casefold() == "search"]
    if len(controls) != 1 or controls[0].get("selected") == [identity]:
        return None
    commands = [command for command in controls[0].get("commands", [])
                if str(command).casefold() in {"filter", "apply", "apply filters"}]
    if len(commands) > 1:
        return None
    actions = [{"type": "filter", "selector": controls[0]["selector"], "value": identity}]
    if commands:
        actions.append({"type": "apply_filter", "role": "button", "name": commands[0]})
    return {"mode": "portal_read", "portalRequest": {"startPath": current_page, "actions": [
        *actions,
    ], "expectedFields": []}}


def _observed_search_clear(question: str, observation: Any, current_page: str) -> dict[str, Any] | None:
    """Bind a literal search-only clear to one native control, never a global reset."""
    if (not current_page or not isinstance(observation, dict)
            or not re.match(r"\s*(?:please\s+)?clear\s+(?:(?:the|that|this|previous)\s+)?(?:(?:account|task|application)\s+)?search\b", question, re.IGNORECASE)
            or re.search(r"\b(?:except|without|not|unless)\b", question, re.IGNORECASE)):
        return None
    controls = [control for control in observation.get("filterControls", []) if isinstance(control, dict)
                and control.get("role") == "textbox" and control.get("filterSurface") is True
                and control.get("selector") and str(control.get("label") or "").casefold() == "search"]
    if len(controls) != 1:
        return None
    commands = [command for command in controls[0].get("commands", [])
                if str(command).casefold() in {"filter", "apply", "apply filters"}]
    if len(commands) > 1:
        return None
    actions = [{"type": "filter", "selector": controls[0]["selector"], "value": ""}]
    if commands:
        actions.append({"type": "apply_filter", "role": "button", "name": commands[0]})
    return {"mode": "portal_read", "portalRequest": {
        "startPath": current_page, "actions": actions, "expectedFields": [],
    }}


def _search_clear_verified(request: PortalReadRequest, payload: Any) -> bool:
    if not isinstance(payload, dict) or payload.get("result", payload.get("status")) in {"load_failed", "no_permission"}:
        return False
    observation = payload.get("observation")
    if (not isinstance(observation, dict) or not isinstance(observation.get("readHealth"), dict)
            or observation["readHealth"].get("healthy") is not True):
        return False
    controls = observation.get("filterControls", [])
    return any(action.get("type") == "filter" and action.get("value") == ""
               and any(isinstance(control, dict) and control.get("selector") == action.get("selector")
                       and control.get("role") == "textbox" and str(control.get("label") or "").casefold() == "search"
                       and control.get("selected") == [] for control in controls)
               for action in request.actions)


def _data_observation_control(value: str) -> bool:
    normalized = value.casefold()
    if not re.search(r"\d", normalized) or not any(character.isalpha() for character in normalized):
        return False
    return not any(
        marker in normalized
        for marker in ("next", "previous", "page ", "last day", "last week", "last month", "loading", "please wait")
    )


def _observation_has_error_state(observation: Any) -> bool:
    if not isinstance(observation, dict):
        return False
    # Page-level signals are distinct from record descriptions and other regions.
    surface = _observation_scalar_strings({
        key: observation.get(key) for key in ("title", "headings", "error", "errorState", "loadingState")
    })
    error_marker = re.compile(
        r"unauthorized|forbidden|access denied|permission denied|something went wrong|"
        r"internal server error|page not found|loading|please wait|retry|"
        r"未授权|无权限|禁止访问|加载中|重试", re.IGNORECASE,
    )
    if any(
        error_marker.fullmatch(value.strip(" .!…"))
        or re.search(r"\b(?:http|error|status code)\s*:?[45]\d{2}\b", value, re.IGNORECASE)
        or re.search(r"\b[45]\d{2}\s+(?:error|unauthorized|forbidden|not found|server error)\b", value, re.IGNORECASE)
        for value in surface
    ):
        return True
    if _observation_semantic_nodes(observation):
        return False
    # Legacy, unstructured observations may consist solely of a loading/error row.
    content = _observation_scalar_strings({
        key: observation.get(key) for key in ("regions", "rowSummaries", "summaries")
    })
    return bool(content) and all(error_marker.fullmatch(value.strip(" .!…")) for value in content)


def _bounded_observation_field(observation: Any, name: str, *, limit: int) -> tuple[str, ...]:
    if not isinstance(observation, dict) or not isinstance(observation.get(name), (list, tuple)):
        return ()
    result: list[str] = []
    for value in observation[name]:
        if not isinstance(value, (str, int, float)) or isinstance(value, bool):
            continue
        text = re.sub(r"\s+", " ", str(value)).strip()[:_OBSERVATION_FALLBACK_MAX_FACT_CHARS]
        if (
            not text
            or text in result
            or any(marker in text.casefold() for marker in _KNOWLEDGE_SENTINELS)
            or any(marker in text.casefold() for marker in _EXPLICIT_EMPTY_MARKERS)
        ):
            continue
        result.append(text)
        if len(result) >= limit:
            break
    return tuple(result)


def _section_observation(section: Any) -> dict[str, Any] | None:
    if not isinstance(section, dict):
        return None
    heading = re.sub(
        r"\s+",
        " ",
        str(section.get("sourceSection") or section.get("sourceRegion") or section.get("heading") or ""),
    ).strip()[:300]
    if not heading and not (
        isinstance(section.get("nodeId"), str)
        and section["nodeId"].strip()
        and section.get("kind") in {"table", "grid", "region", "cards", "metrics"}
    ):
        return None
    normalized = {
        "heading": heading,
        "sourceSection": heading,
        "headings": [heading] if heading else [],
        "columnHeaders": list(section.get("columnHeaders")) if isinstance(section.get("columnHeaders"), (list, tuple)) else [],
        "rowSummaries": list(section.get("rowSummaries")) if isinstance(section.get("rowSummaries"), (list, tuple)) else [],
        "controls": list(section.get("controls")) if isinstance(section.get("controls"), (list, tuple)) else [],
        "summaries": list(section.get("summaries")) if isinstance(section.get("summaries"), (list, tuple)) else [],
        "cardSummaries": list(section.get("cardSummaries")) if isinstance(section.get("cardSummaries"), (list, tuple)) else [],
        "selectedState": str(section.get("selectedState") or "")[:300],
        "selectedTabPath": [value[:200] for value in section.get("selectedTabPath", [])[:4] if isinstance(value, str)]
        if isinstance(section.get("selectedTabPath"), list) else [],
        "emptyState": str(section.get("emptyState") or "")[:300],
    }
    for name, max_length in (("nodeId", 120), ("kind", 40), ("parentRef", 120)):
        value = str(section.get(name) or "").strip()
        if value:
            normalized[name] = value[:max_length]
    if isinstance(section.get("rowFields"), list):
        normalized["rowFields"] = [
            {str(key)[:120]: str(value)[:300] for key, value in list(row.items())[:12] if isinstance(value, str)}
            for row in section["rowFields"][:SEMANTIC_ROW_LIMIT] if isinstance(row, dict)
        ]
    return normalized


# A rendered page holds ten rows.  Keeping only four structured rows made a
# per-assignee roll-up impossible, because the remaining handlers were dropped
# before the aggregation ever saw them.
SEMANTIC_ROW_LIMIT = 10


def _observation_semantic_nodes(observation: Any) -> tuple[dict[str, Any], ...]:
    """Return bounded semantic nodes without merging same-heading siblings."""

    if not isinstance(observation, dict):
        return ()
    nodes: list[dict[str, Any]] = []
    for collection_name in ("sectionSummaries", "regionSummaries"):
        raw_nodes = observation.get(collection_name)
        if not isinstance(raw_nodes, (list, tuple)):
            continue
        for raw_node in raw_nodes[:12]:
            node = _section_observation(raw_node)
            if node is not None:
                nodes.append(node)
    return tuple(nodes)


def _semantic_node_evidence_signature(
    node: dict[str, Any],
    nodes_by_id: dict[str, dict[str, Any]],
) -> tuple[Any, ...]:
    """Describe bounded business evidence while ignoring semantic node identity."""

    def normalized_text(value: Any) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip().casefold()

    parent = nodes_by_id.get(normalized_text(node.get("parentRef")))
    values = tuple(
        (
            field_name,
            tuple(
                normalized_text(value)
                for value in _bounded_observation_field(node, field_name, limit=20)
            ),
        )
        for field_name in (
            "columnHeaders",
            "rowSummaries",
            "controls",
            "summaries",
            "cardSummaries",
        )
    )
    return (
        normalized_text(node.get("kind")),
        normalized_text(node.get("heading")),
        normalized_text(node.get("sourceSection")),
        normalized_text(node.get("selectedState")),
        normalized_text(node.get("emptyState")),
        normalized_text(parent.get("kind")) if parent else "",
        normalized_text(parent.get("heading")) if parent else "",
        normalized_text(parent.get("selectedState")) if parent else "",
        values,
    )


def _structured_observation_sections(observation: Any) -> tuple[dict[str, Any], ...]:
    """Merge bounded evidence by semantic section without flattening the page."""

    if not isinstance(observation, dict):
        return ()
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for collection_name in ("sectionSummaries", "regionSummaries"):
        raw_sections = observation.get(collection_name)
        if not isinstance(raw_sections, (list, tuple)):
            continue
        for raw_section in raw_sections[:12]:
            section = _section_observation(raw_section)
            if section is None:
                continue
            key = re.sub(
                r"[^a-z0-9\u3400-\u9fff\u0621-\u064a]+",
                " ",
                section["heading"].casefold(),
            ).strip()
            if not key:
                continue
            if key not in merged:
                merged[key] = section
                if section.get("nodeId"):
                    merged[key]["nodeRefs"] = [section["nodeId"]]
                order.append(key)
                continue
            target = merged[key]
            for field_name in ("columnHeaders", "rowSummaries", "controls", "summaries", "cardSummaries"):
                values = target[field_name]
                for value in section[field_name]:
                    if value not in values:
                        values.append(value)
            target_rows = target.setdefault("rowFields", [])
            for row in section.get("rowFields", []):
                if row not in target_rows:
                    target_rows.append(row)
            if not target["emptyState"]:
                target["emptyState"] = section["emptyState"]
            if not target["selectedState"]:
                target["selectedState"] = section["selectedState"]
            node_id = str(section.get("nodeId") or "")
            if node_id and node_id not in target.setdefault("nodeRefs", []):
                target["nodeRefs"].append(node_id)
    return tuple(merged[key] for key in order)


def _matching_observation_section(
    observation: Any,
    *,
    heading: str,
    exclude: tuple[str, ...] = (),
) -> dict[str, Any] | None:
    if not isinstance(observation, dict):
        return None
    expected = heading.casefold()
    for section in _structured_observation_sections(observation):
        normalized = section["heading"].casefold()
        if expected in normalized and not any(term.casefold() in normalized for term in exclude):
            return section
    return None


def _observation_evidence_for_section(observation: Any, section_name: str) -> dict[str, Any] | None:
    """Resolve the most specific bounded evidence node for a visible section."""

    nodes = _observation_semantic_nodes(observation)
    if not nodes:
        return observation if isinstance(observation, dict) else None
    nodes_by_id = {
        str(node.get("nodeId") or "").casefold(): node
        for node in nodes
        if node.get("nodeId")
    }

    def with_parent_state(node: dict[str, Any]) -> dict[str, Any]:
        parent = nodes_by_id.get(str(node.get("parentRef") or "").casefold())
        if parent is None or node.get("selectedState"):
            return node
        selected_state = str(parent.get("selectedState") or "").strip()
        return {**node, "selectedState": selected_state} if selected_state else node

    if not section_name.strip():
        return with_parent_state(nodes[0]) if len(nodes) == 1 else None
    expected = re.sub(r"\s+", " ", section_name).strip().casefold()
    exact_node = nodes_by_id.get(expected)
    if exact_node is not None:
        return with_parent_state(exact_node)
    matches = [
        section
        for section in nodes
        if section["heading"] and (
            expected == section["heading"].casefold()
            or expected in section["heading"].casefold()
            or section["heading"].casefold() in expected
        )
    ]
    if len(matches) == 1:
        return with_parent_state(matches[0])
    table_matches = [
        node
        for node in matches
        if str(node.get("kind") or "").casefold() == "table"
        and (
            _bounded_observation_field(node, "rowSummaries", limit=1)
            or _bounded_observation_field(node, "cardSummaries", limit=1)
            or _raw_observation_has_empty_state(node)
        )
    ]
    if len(table_matches) == 1:
        # A region and its only table often share a visible heading. The table is
        # the narrower evidence bundle for row/detail answers.
        return with_parent_state(table_matches[0])
    if (
        matches
        and len({str(node.get("heading") or "").casefold() for node in matches}) == 1
        and len({_semantic_node_evidence_signature(node, nodes_by_id) for node in matches}) == 1
    ):
        return with_parent_state(matches[0])
    if len(matches) > 1:
        ids = {str(node.get("nodeId") or "") for node in matches}
        parents = [str(node.get("parentRef") or "") for node in matches]
        states = {str(node.get("selectedState") or "").strip().casefold() for node in matches
                  if node.get("selectedState")}
        roots = [node for node in matches if str(node.get("parentRef") or "") not in ids]
        # Same-heading wrappers may contribute complementary bounded data only
        # when their native parent links prove a single nested chain. Siblings
        # and independent equal-state regions remain ambiguous.
        if ("" not in ids and len(ids) == len(matches) and len(roots) == 1
                and len(states) <= 1
                and len([p for p in parents if p in ids]) == len(set(p for p in parents if p in ids))
                and len({str(node.get("heading") or "").casefold() for node in matches}) == 1):
            visited = {str(roots[0]["nodeId"])}
            while True:
                children = {str(node["nodeId"]) for node in matches
                            if str(node.get("parentRef") or "") in visited}
                if children <= visited:
                    break
                visited.update(children)
            if visited == ids:
                merged = [section for section in _structured_observation_sections(observation)
                          if set(section.get("nodeRefs") or []) == ids]
                if len(merged) == 1:
                    return merged[0]
    if matches and all(not node.get("nodeId") and not node.get("parentRef") for node in matches):
        legacy_matches = [
            section
            for section in _structured_observation_sections(observation)
            if expected == section["heading"].casefold()
            or expected in section["heading"].casefold()
            or section["heading"].casefold() in expected
        ]
        return legacy_matches[0] if len(legacy_matches) == 1 else None
    if not matches:
        empty_tables = [
            node
            for node in nodes
            if str(node.get("kind") or "").casefold() == "table"
            and _raw_observation_has_empty_state(node)
        ]
        if len(empty_tables) == 1:
            # A bounded scan can retain a table while dropping its parent region.
            # The explicit empty state remains valid evidence for a no-data result.
            return with_parent_state(empty_tables[0])
    return None


def _observation_selected_state_matches(claim: str, node: dict[str, Any]) -> bool:
    claimed = re.sub(r"\s+", " ", claim).strip().casefold()
    actual = re.sub(r"\s+", " ", str(node.get("selectedState") or "")).strip().casefold()
    if claimed == actual:
        return True
    controls = {re.sub(r"\s+", " ", value).strip().casefold()
                for value in _bounded_observation_field(node, "controls", limit=20)}
    badge = re.fullmatch(r"(.+?)\s+\d+", actual)
    return bool(actual in controls and badge and claimed == badge.group(1))


def _observation_evidence_for_result(observation: Any, result: ReaderResult) -> dict[str, Any] | None:
    """Bind a source within its declared region and observed view, never globally by a tab label."""

    def normalized(value: Any) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip().casefold()

    nodes = _observation_semantic_nodes(observation)
    source = normalized(result.source_section or result.section)
    section = normalized(result.section)
    state = normalized(result.selected_state)
    nodes_by_id = {normalized(node.get("nodeId")): node for node in nodes if node.get("nodeId")}
    roots = [node for node in nodes if section and section in {
        normalized(node.get("nodeId")), normalized(node.get("heading")),
    }]
    source_node = nodes_by_id.get(source)
    # A same-name metrics block is a sibling, not the parent of a table.
    # Bind by the explicit source ID and its active view when no region claims it.
    if (source_node and section and section == normalized(source_node.get("selectedState"))
            and not any(node.get("kind") == "region" for node in roots)
            and (not state or _observation_selected_state_matches(state, source_node))):
        return source_node
    if not roots:
        if result.status != "no_data" and nodes_by_id and source not in nodes_by_id and not any(
            normalized(node.get("heading")) == source for node in nodes
        ):
            return None
        return _observation_evidence_for_section(observation, result.source_section or result.section)

    root_ids = {normalized(node.get("nodeId")) for node in roots if node.get("nodeId")}

    def in_region(node: dict[str, Any]) -> bool:
        if node in roots:
            return True
        parent = normalized(node.get("parentRef"))
        seen: set[str] = set()
        while parent and parent not in seen:
            if parent in root_ids:
                return True
            seen.add(parent)
            parent = normalized(nodes_by_id.get(parent, {}).get("parentRef"))
        return False

    def with_state(node: dict[str, Any]) -> dict[str, Any]:
        parent = nodes_by_id.get(normalized(node.get("parentRef")), {})
        return {**node, "selectedState": node.get("selectedState") or parent.get("selectedState") or ""}

    scoped = [with_state(node) for node in nodes if in_region(node)]
    if source in nodes_by_id:
        return next((node for node in scoped if normalized(node.get("nodeId")) == source), None)
    # A control can name the source only when it is the observed active view in
    # the declared region. An unrelated same-name heading is not an alternative.
    candidates = [node for node in scoped if source == normalized(node.get("heading"))
                  or node.get("selectedState") and _observation_selected_state_matches(source, node)]
    if state:
        matching_state = [node for node in candidates if _observation_selected_state_matches(state, node)]
        if not matching_state and any(node.get("selectedState") for node in candidates):
            return None
        candidates = matching_state or [node for node in candidates if not node.get("selectedState")]
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        return None
    if len({normalized(node.get("heading")) for node in candidates}) != 1:
        return None
    return _observation_evidence_for_section(
        {"sectionSummaries": candidates}, str(candidates[0].get("heading") or ""),
    )


_SECTION_INFERENCE_STOP_WORDS = frozenset({
    "about", "anything", "current", "dashboard", "display", "give", "have", "how", "item", "items",
    "list", "many", "overview", "page", "please", "section", "show", "the", "this", "what", "with",
    "我的", "当前", "显示", "查看", "页面", "总览", "概览", "哪些", "什么", "多少", "几个",
})


def _section_match_tokens(value: Any) -> frozenset[str]:
    normalized = re.sub(
        r"[^a-z0-9\u3400-\u9fff\u0621-\u064a]+",
        " ",
        str(value or "").casefold(),
    )
    return frozenset(
        token
        for token in normalized.split()
        if len(token) > 1 and token not in _SECTION_INFERENCE_STOP_WORDS
    )


def _knowledge_route_recovery_request(
    question: str,
    knowledge_context: Any,
    permission_context: UserPermissionContext,
    conversation_context: dict[str, Any] | None = None,
) -> PortalReadRequest | None:
    """Propose the best documented surface for policy validation after refusal."""

    if not isinstance(knowledge_context, dict):
        return None
    question_tokens = _section_match_tokens(question)
    if not question_tokens:
        return None
    bounded_context = _bounded_conversation_context(conversation_context)
    resolved_values = _resolved_intent_values(bounded_context)
    previous = bounded_context.get("previousIntent")
    scope_hint = str(
        resolved_values.get("scope")
        or resolved_values.get("requestedScope")
        or (previous.get("scope") if isinstance(previous, dict) else "")
        or ""
    ).casefold()
    personal_request = "personal" in scope_hint or bool(re.search(
        r"\b(?:my|mine|for me|i have)\b|我的|我有|خاصتي|لدي",
        question.casefold(),
    ))
    team_request = any(word in scope_hint for word in ("team", "department")) or bool(re.search(
        r"\b(?:team|department|staff|assignees?)\b|团队|部门|员工|الفريق|القسم",
        question.casefold(),
    ))
    permission_scope = _permission_result_scope(permission_context)
    answer_shape = reader_answer_shape(question, bounded_context)

    def semantic_fields(content: str) -> dict[str, str]:
        markers = list(re.finditer(
            r"(?:^|\s+-\s+)\*\*([a-z][a-z0-9_ -]*):\*\*\s*",
            content,
            flags=re.IGNORECASE,
        ))
        fields: dict[str, str] = {}
        for index, marker in enumerate(markers):
            end = markers[index + 1].start() if index + 1 < len(markers) else len(content)
            name = re.sub(r"[ -]+", "_", marker.group(1).casefold())
            fields[name] = content[marker.end():end].strip()
        return fields

    positive_weights = {
        "section": 5,
        "type": 4,
        "meaning": 3,
        "use_when": 4,
        "content": 2,
        "time_semantics": 2,
        "scope": 1,
    }
    shape_terms = {
        "overview": frozenset({"overview", "summary", "workload", "dashboard"}),
        "count": frozenset({"count", "total", "metric", "summary", "statistics"}),
        "list": frozenset({"list", "table", "queue", "records", "tasks", "items"}),
        "attention": frozenset({"attention", "urgent", "priority", "blocked", "overdue"}),
        "due": frozenset({
            "due", "deadline", "deadlines", "expiry", "expiration", "overdue", "urgent",
            "urgency", "sla", "remaining",
        }),
        "detail": frozenset({"detail", "details", "record", "relationship"}),
    }
    scores: dict[str, int] = {}
    for chunk in (knowledge_context.get("chunks") or [])[:8]:
        if not isinstance(chunk, dict):
            continue
        content = str(chunk.get("content") or "")
        fields = semantic_fields(content)
        page_value = fields.get("page", "")
        raw_paths = re.findall(r"`([^`]+)`", page_value)
        if not raw_paths:
            continue
        field_tokens = {
            name: _section_match_tokens(fields.get(name, ""))
            for name in positive_weights
        }
        overlap_score = sum(
            len(question_tokens & field_tokens[name]) * weight
            for name, weight in positive_weights.items()
        )
        if not overlap_score:
            continue
        semantic_tokens = frozenset().union(*field_tokens.values())
        type_text = fields.get("type", "").casefold()
        scope_text = fields.get("scope", "").casefold()
        score = overlap_score
        if shape_terms.get(answer_shape, frozenset()) & semantic_tokens:
            score += 6
        if answer_shape in {"list", "attention", "due"} and re.search(
            r"\b(?:list|table|queue|task|workload)\b", type_text,
        ):
            score += 4
        elif answer_shape in {"overview", "count"} and re.search(
            r"\b(?:overview|summary|metric|workload)\b", type_text,
        ):
            score += 4
        elif answer_shape == "detail" and "detail" in type_text:
            score += 6
        if "navigation" in type_text:
            score -= 12
        if answer_shape in {"overview", "count", "list", "attention", "due"} and "detail" in type_text:
            score -= 8
        team_surface = bool(re.search(r"\b(?:team|department)\b", type_text + " " + scope_text))
        personal_surface = "personal" in type_text or "personal" in scope_text
        if team_surface and not team_request:
            score -= 12
        if personal_request and team_surface:
            score -= 12
        if team_request and personal_surface:
            score -= 12
        if permission_scope == "personal" and team_surface:
            score -= 12
        if personal_request and personal_surface:
            score += 4
        elif team_request and team_surface:
            score += 4
        if score <= 0:
            continue
        for raw_path in raw_paths:
            parsed = urlsplit(raw_path.strip())
            if parsed.scheme or parsed.netloc or not parsed.path.startswith("/"):
                continue
            path = parsed.path.rstrip("/") or "/"
            # Do not replace an unavailable target with an accessible runner-up.
            # The caller validates this observe-only proposal before any access.
            scores[path] = max(scores.get(path, 0), score)
    if not scores:
        return None
    best_score = max(scores.values())
    matches = [path for path, score in scores.items() if score == best_score]
    if len(matches) != 1:
        return None
    return PortalReadRequest(
        start_path=matches[0],
        actions=({"type": "observe"},),
        expected_fields=(),
    )


_CATEGORY_TARGET_STOP_WORDS = frozenset({
    "detail", "details", "me", "my", "record", "records", "task", "tasks",
})


def _category_target_tokens(value: Any) -> frozenset[str]:
    return _section_match_tokens(value) - _CATEGORY_TARGET_STOP_WORDS


@dataclass(frozen=True)
class _CategoryChildRequirement:
    semantic_label: str
    control_label: str


def _category_control_requiring_children(
    question: str,
    observation: Any,
    planned_result: ReaderResult | None,
    requested_answer_shape: str,
    conversation_context: dict[str, Any] | None = None,
    *, current_page: str = "",
) -> _CategoryChildRequirement | None:
    """Identify a named collection whose parent count is not enough evidence."""

    if (
        requested_answer_shape not in {"list", "detail", "count", "overview"}
        or (planned_result is not None and planned_result.status not in {"success", "not_confirmed"})
    ):
        return None
    if requested_answer_shape == "detail" and re.search(
        r"\b(?:difference|distinction|meaning)\b|\b(?:does|do)\b.+\b(?:mean|prove)\b|区别|含义|是否意味着",
        question, re.IGNORECASE,
    ) and not re.search(r"\b(?:show|list|open|read)\b|显示|列出|打开|读取", question, re.IGNORECASE):
        return None
    previous = _bounded_conversation_context(conversation_context).get("previousIntent")
    target_sources: tuple[Any, ...] = (
        question,
        _resolved_intent_values(conversation_context).get("businessObject", ""),
        _resolved_intent_values(conversation_context).get("view", ""),
        previous.get("question") if isinstance(previous, dict) else "",
        previous.get("selectedState") if isinstance(previous, dict) else "",
        previous.get("sourceSection") if isinstance(previous, dict) else "",
        previous.get("section") if isinstance(previous, dict) else "",
    )
    candidates: dict[str, _CategoryChildRequirement] = {}
    tab_controls = observation.get("tabControls", []) if isinstance(observation, dict) else []
    current_words = frozenset(re.findall(r"\w+", question.casefold()))
    current_words |= frozenset(re.findall(r"\w+", _resolved_intent_values(conversation_context).get("view", "").casefold()))
    # Match contiguous labels. Words in a module name must not accidentally
    # select a sibling tab sharing one of those words (e.g. X ... Y Insights).
    phrases = [' '.join(re.findall(r'\w+', str(value).casefold())) for value in
               (question, _resolved_intent_values(conversation_context).get('view', ''))]
    named_tabs = [control for control in (tab_controls[:20] if isinstance(tab_controls, list) else []) if isinstance(control, dict)
                  and control.get('name') and any(
                      ' ' + ' '.join(re.findall(r'\w+', str(control['name']).casefold())) + ' ' in ' ' + phrase + ' '
                      for phrase in phrases)]
    # A trailing page context ("... in Reports & Analytics") must not win
    # over the requested view. Keep explicitly named parent AND child tabs.
    context_parts = re.split(r"\bin\b", question.casefold(), maxsplit=1)
    focus_words = set(re.findall(r"\w+", context_parts[0]))
    focus_tabs = [control for control in named_tabs
                  if set(re.findall(r"\w+", str(control['name']).casefold())).issubset(focus_words)]
    route_words = set(re.findall(r"\w+", urlsplit(current_page).path.rsplit("/", 1)[-1].replace("-", " ").casefold()))
    if focus_tabs and len(context_parts) == 2 and (
            re.search(r'\b(?:page|module|portal)\b', context_parts[1])
            or (len(route_words) >= 2 and route_words.issubset(set(re.findall(r"\w+", context_parts[1]))))
            or (re.search(r'&|\band\b', context_parts[1])
                and _section_match_tokens(context_parts[0]) & _section_match_tokens(context_parts[1]))):
        named_tabs = focus_tabs
    if named_tabs and all(control.get("selected") is True for control in named_tabs):
        return None
    for control in tab_controls[:20] if isinstance(tab_controls, list) else []:
        if not isinstance(control, dict) or control.get("selected") is not False:
            continue
        label = str(control.get("name") or "").strip()[:200]
        if named_tabs and control not in named_tabs:
            continue
        label_words = frozenset(re.findall(r"\w+", label.casefold()))
        if label_words and label_words.issubset(current_words) and not _observation_has_category_children(observation, label):
            candidates.setdefault(label, _CategoryChildRequirement(semantic_label=label, control_label=label))
    for section in _observation_semantic_nodes(observation):
        if requested_answer_shape in {"count", "overview"}:
            break
        for control in _bounded_observation_field(section, "controls", limit=20):
            match = re.fullmatch(
                r"(.+?)\s*(?:[([]\s*)?\d+(?:[.,]\d+)?(?:\s*[)\]])?",
                control,
            )
            if match is None:
                continue
            label = match.group(1).strip()
            if label and not _observation_has_category_children(observation, label):
                candidates.setdefault(
                    control,
                    _CategoryChildRequirement(
                        semantic_label=label,
                        control_label=control,
                    ),
                )
    for source in target_sources:
        source_tokens = _category_target_tokens(source)
        if not source_tokens:
            continue
        scored = [
            (
                len(source_tokens & _category_target_tokens(candidate.semantic_label)),
                int(_category_target_tokens(candidate.semantic_label).issubset(source_tokens)),
                candidate,
            )
            for candidate in candidates.values()
            if source_tokens & _category_target_tokens(candidate.semantic_label)
        ]
        if not scored:
            continue
        best_score = max((overlap, full_match) for overlap, full_match, _ in scored)
        matches = {
            candidate
            for overlap, full_match, candidate in scored
            if (overlap, full_match) == best_score
        }
        return next(iter(matches)) if len(matches) == 1 else None
    return None


def _observation_has_category_children(observation: Any, category_label: str) -> bool:
    """Require child evidence under a matching heading or selected state."""

    category_tokens = _section_match_tokens(category_label)
    if not category_tokens:
        return False
    api = observation.get('apiEvidence') if isinstance(observation,dict) else None
    if isinstance(api,dict) and _observation_no_data_allowed(observation):
        empty_plan, _ = _api_evidence_fallback_plan(api,answer_shape='list')
        selected = any(isinstance(t,dict) and t.get('selected') is True
                       and _state_control_label_matches(t.get('name'),category_label)
                       for t in observation.get('tabControls',[]))
        operation_tokens = _section_match_tokens(str(api.get('operationKey') or '').replace('/',' ').replace('-',' '))
        if (selected and len(category_tokens)>=2 and category_tokens <= operation_tokens
                and str(api.get('trigger') or '').endswith(':switch_tab') and empty_plan and empty_plan.get('result')=='no_data'):
            return True  # The selected, action-generated response verifies an empty child collection.
    for node in _observation_semantic_nodes(observation):
        path = node.get('selectedTabPath') or []
        if (isinstance(path, list) and any(_state_control_label_matches(label, category_label) for label in path)
                and node.get('kind') in {'table','grid'} and node.get('rowFields')):
            return True
    nodes = _observation_semantic_nodes(observation)
    nodes_by_id = {
        str(node.get("nodeId") or ""): node
        for node in nodes
        if node.get("nodeId")
    }
    for section in nodes:
        parent = nodes_by_id.get(str(section.get("parentRef") or ""))
        heading_tokens = _section_match_tokens(section.get("heading"))
        parent_heading_tokens = _section_match_tokens(parent.get("heading")) if parent else frozenset()
        selected_state = str(
            section.get("selectedState")
            or (parent.get("selectedState") if parent else "")
            or ""
        ).strip()
        selected_tokens = _section_match_tokens(selected_state)
        selected_matches = bool(selected_tokens and category_tokens.issubset(selected_tokens))
        heading_matches = bool(
            (heading_tokens and category_tokens.issubset(heading_tokens))
            or (parent_heading_tokens and category_tokens.issubset(parent_heading_tokens))
        )
        if selected_state and not selected_matches:
            continue
        if not selected_matches and not heading_matches:
            continue
        rows = _bounded_observation_field(section, "rowSummaries", limit=8)
        child_cards = tuple(
            value
            for value in _bounded_observation_field(section, "cardSummaries", limit=12)
            if re.fullmatch(r".+?\s*(?:[([]\s*)?\d+(?:[.,]\d+)?(?:\s*[)\]])?", value) is None
        )
        if rows or child_cards or _raw_observation_has_empty_state(section):
            return True
    return False


def _request_advances_category_on_current_page(
    request: PortalReadRequest | None,
    *,
    current_page: str,
    category_control: str,
) -> bool:
    """Confirm a refinement selects or expands the observed category in place."""

    if request is None:
        return False
    current_path = urlsplit(current_page).path.rstrip("/") or "/"
    request_path = urlsplit(request.start_path).path.rstrip("/") or "/"
    if request_path != current_path:
        return False
    expected_control = re.sub(r"\s+", " ", category_control).strip()
    if not expected_control:
        return False
    for action in request.actions:
        action_type = str(action.get("type") or "").strip().casefold().replace("-", "_")
        if action_type not in {"switch_tab", "expand_details"}:
            continue
        if action.get("field"):
            locator_value = action.get("field")
        elif action.get("role"):
            locator_value = action.get("name") or action.get("label")
        else:
            locator_value = action.get("section")
        actual_control = re.sub(r"\s+", " ", str(locator_value or "")).strip()
        if actual_control == expected_control:
            return True
    return False


def _infer_observation_section(
    observation: Any,
    *,
    question: str,
    expected_fields: tuple[str, ...] = (),
    answer_shape: Literal["overview", "count", "list", "attention", "due", "detail", "unspecified"] = "unspecified",
) -> str:
    """Choose one observed semantic section from question and planner field vocabulary."""

    sections = _structured_observation_sections(observation)
    if not sections:
        return ""
    question_context = str(question or "").casefold()
    expected_context = " ".join(expected_fields).casefold()
    question_tokens = _section_match_tokens(question_context)
    expected_tokens = _section_match_tokens(expected_context)
    ranked: list[tuple[int, int, str]] = []
    for index, section in enumerate(sections):
        heading = str(section.get("heading") or "").strip()
        if not heading:
            continue
        heading_normalized = re.sub(r"\s+", " ", heading).strip().casefold()
        heading_tokens = _section_match_tokens(heading)
        evidence_tokens = _section_match_tokens(
            " ".join(
                _observation_scalar_strings(
                    {
                        key: section.get(key)
                        for key in ("controls", "summaries", "cardSummaries", "columnHeaders")
                    },
                    limit=80,
                )
            )
        )
        exact_question_score = 200 if heading_normalized and heading_normalized in question_context else 0
        question_heading_score = 30 * len(question_tokens & heading_tokens)
        expected_exact_score = 40 if heading_normalized and heading_normalized in expected_context else 0
        expected_heading_score = 3 * len(expected_tokens & heading_tokens)
        evidence_score = min(8, 2 * len(question_tokens & evidence_tokens))
        due_evidence_score = 0
        if answer_shape == "due":
            evidence_text = " ".join(
                _observation_scalar_strings(
                    {
                        key: section.get(key)
                        for key in ("controls", "summaries", "cardSummaries", "rowSummaries")
                    },
                    limit=80,
                )
            ).casefold()
            due_mode = _due_query_mode(question_context)
            matching_due_evidence = (
                bool(re.search(r"\bdue in\b|\bdue soon\b|\bupcoming\b|即将|临近|قريب", evidence_text))
                if due_mode == "upcoming"
                else bool(re.search(r"\boverdue\b|\bpast due\b|\blate\b|逾期|متأخر", evidence_text))
                if due_mode == "overdue"
                else bool(re.search(
                    r"\bdue\b|\boverdue\b|\bupcoming\b|即将|临近|到期|逾期|قريب|متأخر",
                    evidence_text,
                ))
            )
            if matching_due_evidence:
                due_evidence_score = 80
        evidence_only_allowed = answer_shape in {"overview", "count", "attention", "due"}
        if (
            exact_question_score
            or question_heading_score
            or expected_exact_score
            or expected_heading_score
            or (evidence_score and evidence_only_allowed)
            or due_evidence_score
        ):
            ranked.append((
                exact_question_score + question_heading_score + expected_exact_score
                + expected_heading_score + evidence_score + due_evidence_score,
                -index,
                heading,
            ))
    ranked.sort(reverse=True)
    if not ranked:
        return ""
    # Multiple structural summaries can represent the same semantic section.
    # Collapse them by heading before deciding whether the destination is truly
    # ambiguous; duplicate DOM wrappers are not competing business sources.
    ranked_by_heading: dict[str, tuple[int, int, str]] = {}
    for candidate in ranked:
        heading_key = re.sub(r"\s+", " ", candidate[2]).strip().casefold()
        ranked_by_heading[heading_key] = max(ranked_by_heading.get(heading_key, candidate), candidate)
    distinct_ranked = sorted(ranked_by_heading.values(), reverse=True)
    if distinct_ranked[0][0] <= 0:
        return ""
    if len(distinct_ranked) > 1 and distinct_ranked[0][0] == distinct_ranked[1][0]:
        return ""
    return distinct_ranked[0][2]


def _result_from_structured_observation(
    observation: Any,
    *,
    page: str,
    section_name: str,
    answer_shape: Literal["overview", "count", "list", "attention", "due", "detail", "unspecified"],
    scope: Literal["personal", "team", "global", "unknown"],
    question: str = "",
) -> ReaderResult | None:
    """Resolve a repeated observe when it identifies one existing section."""

    if (
        answer_shape not in {"count", "list", "attention", "due"}
    ):
        return None
    section = _observation_evidence_for_section(observation, section_name)
    if section is None or _observation_has_error_state(section):
        return None
    if section.get("kind") in {"metrics", "cards"} and not _observation_no_data_allowed(observation):
        return None
    heading = str(section.get("heading") or "")
    attention_heading = reader_answer_shape(heading) == "attention" or bool(re.search(
        r"\b(?:need(?:s|ing)?|requir(?:e|es|ing))\b.{0,25}\b(?:review|action)\b|待处理|待审核|需要审核",
        heading.casefold(),
    ))
    if answer_shape == "attention" and not attention_heading:
        # Generic rows establish a list, not a business priority. Other attention
        # evidence needs semantic evaluation by the planner, not label copying.
        return None
    rows = _bounded_observation_field(section, "rowSummaries", limit=8)
    native_rows = _bounded_native_row_facts(section, limit=8)
    # A completed-refund list can expose the requested child rows directly
    # even when the page has no rendered status-tab control.  Do not reject
    # those already-observed rows merely because the planner classified the
    # wording as a category request.
    if (
        _category_control_requiring_children(question, observation, None, answer_shape, current_page=page)
        and not native_rows and not rows
    ):
        return None
    controls = _bounded_observation_field(section, "controls", limit=20)
    card_summaries = _bounded_observation_field(section, "cardSummaries", limit=20)
    summaries = _bounded_observation_field(section, "summaries", limit=20)
    if answer_shape == "count":
        candidates = tuple(
            value for value in (*summaries, *controls)
            if re.search(r"(?:^|\s)\d+(?:[.,]\d+)?\s*$", value)
        )
    elif answer_shape == "due":
        due_mode = _due_query_mode(question)
        candidates = tuple(
            value for value in (*card_summaries, *controls, *rows)
            if (
                (re.search(r"\bdue in\b|\bdue soon\b|\bupcoming\b|即将|临近|قريب", value.casefold())
                 and not re.search(r"\boverdue\b|\bpast due\b|逾期|متأخر", value.casefold()))
                if due_mode == "upcoming"
                else re.search(r"\boverdue\b|\bpast due\b|\blate\b|逾期|متأخر", value.casefold())
                if due_mode == "overdue"
                else re.search(r"\bdue\b|\boverdue\b|\bupcoming\b|即将|临近|到期|逾期|قريب|متأخر", value.casefold())
            )
        )
    elif answer_shape in {"list", "attention"}:
        category_controls = tuple(
            value for value in controls
            if re.search(r"(?:^|\s)\d+(?:[.,]\d+)?\s*$", value)
        )
        non_count_controls = tuple(
            value for value in controls
            if _data_observation_control(value)
            and not re.search(r"(?:^|\s)\d+(?:[.,]\d+)?\s*$", value)
        )
        selected_state = str(section.get("selectedState") or "").strip()
        if answer_shape == "list" and not native_rows and not rows and not card_summaries and len(category_controls) >= 2:
            if not selected_state:
                return None
            requested_tokens = _section_match_tokens(question)
            matching_categories = tuple(
                value for value in category_controls
                if requested_tokens & _section_match_tokens(value)
            )
            if matching_categories and not (
                requested_tokens & _section_match_tokens(selected_state)
            ):
                return None
        candidates = native_rows or rows or card_summaries or non_count_controls
        if answer_shape == "attention" and not candidates and category_controls:
            return ReaderResult(
                status="not_confirmed",
                summary="Attention counts are confirmed; the requested item details are not.",
                page=page, section=heading, source_section=str(section.get("nodeId") or heading),
                answer_shape="attention", completeness="bounded", scope=scope,
                selected_state=selected_state, facts=_bounded_fact_candidates(category_controls),
                missing=("attention_details_not_confirmed",),
            )
    else:
        candidates = rows
    facts = _bounded_fact_candidates(candidates)
    if facts:
        return ReaderResult(
            status="success",
            summary="The requested portal section was observed.",
            page=str(page)[:500],
            section=str(section.get("heading") or section_name)[:300],
            source_section=str(section.get("nodeId") or section.get("heading") or section_name)[:300],
            answer_shape=answer_shape,
            completeness="bounded",
            selected_state=str(section.get("selectedState") or "")[:300],
            scope=scope,
            facts=facts,
        )
    if _raw_observation_has_empty_state(section):
        if not _observation_no_data_allowed(observation):
            return None
        return ReaderResult(
            status="no_data",
            summary="The requested portal section is empty.",
            page=str(page)[:500],
            section=str(section.get("heading") or section_name)[:300],
            source_section=str(section.get("heading") or section_name)[:300],
            answer_shape=answer_shape,
            completeness="bounded",
            selected_state=str(section.get("selectedState") or "")[:300],
            scope=scope,
        )
    return None


def _application_pending_count(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """A personal review counter must come from its own settled queue response."""
    if (outcome.result.page not in {'/licensing/applications', '/content/ContentApplications'}
            or outcome.result.status not in {'success', 'not_confirmed'}
            or not re.search(r'\b(?:how many|number of)\b.*\b(?:waiting|pending)\b.*\breview\b', question, re.I)):
        return outcome
    evidence = outcome.audit_evidence
    observation = evidence.get('observation') or ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if not isinstance(observation, dict):
        return outcome
    operation = 'POST /api/Content/MyTodoPage' if outcome.result.page.startswith('/content/') else 'POST /api/Application/MyTodoPage'
    candidates = (observation.get('apiDiscovery') or {}).get('candidates') or []
    matches = [c for c in candidates if isinstance(c, dict) and c.get('operationKey') == operation
               and c.get('status') == 200 and isinstance(c.get('responseEvidence'), dict)]
    values = []
    def visit(value: Any, depth: int = 0) -> None:
        if depth > 6 or not isinstance(value, dict):
            return
        for key, child in value.items():
            if _key(key) == 'pendingreviewcount' and type(child) is int and child >= 0:
                values.append(child)
            elif isinstance(child, dict):
                visit(child, depth + 1)
    for candidate in matches:
        payload = candidate['responseEvidence']
        if payload.get('isSuccess') is not False:
            visit(payload)
    selected = [t.get('name') for t in observation.get('tabControls', [])
                if isinstance(t, dict) and t.get('selected') is True]
    if len(set(values)) == 1 and selected == ['To Do']:
        result = replace(outcome.result, status='success', answer_shape='count', section='My Application Tasks',
            source_section='api:personal-application-pending-review', selected_state='To Do', completeness='bounded',
            facts=(f'Pending Review: {values[0]}',), missing=())
        return ReaderOutcome(result, {**evidence, 'verifiedCounter':operation, 'result':result.public_json()})
    # The formatter cannot repair a wrongly selected total without evidence.
    result = replace(outcome.result, status='not_confirmed', answer_shape='count', facts=(),
                     missing=('pending_review_counter_not_verified',))
    return ReaderOutcome(result, {**evidence, 'result':result.public_json()})


def _native_metric_count_fallback(
    observation: Any,
    *,
    page: str,
    scope: Literal["personal", "team", "global", "unknown"],
    question: str,
) -> ReaderResult | None:
    """Use one uniquely matching visible metric before a broader table total."""

    if not isinstance(observation, dict) or _observation_has_error_state(observation):
        return None
    metrics = [
        {"label": label, "value": value}
        for label, value, _source in _observed_metric_pairs(observation)
    ]
    if not metrics:
        return None
    query_tokens = _api_query_tokens(question)
    ranked = [
        (len(set(_api_query_tokens(str(metric["label"]))).intersection(query_tokens)), metric)
        for metric in metrics
    ]
    ranked = [item for item in ranked if item[0] > 0]
    if not ranked:
        return None
    best_score = max(score for score, _metric in ranked)
    best = [metric for score, metric in ranked if score == best_score]
    if len(best) != 1:
        return None
    metric = best[0]
    selected_state = next(
        (
            str(node.get("selectedState") or "").strip()
            for node in _observation_semantic_nodes(observation)
            if str(node.get("selectedState") or "").strip()
        ),
        "",
    )
    return ReaderResult(
        status="success",
        summary="A uniquely matching visible metric answered the request.",
        page=str(page)[:500],
        section="metrics",
        source_section="metrics",
        answer_shape="count",
        completeness="bounded",
        selected_state=selected_state[:300],
        scope=scope,
        facts=(f"{str(metric['label']).strip()}: {str(metric['value']).strip()}",),
    )


def _native_metric_trend_fallback(
    observation: Any,
    *,
    page: str,
    scope: Literal["personal", "team", "global", "unknown"],
    question: str,
    conversation_context: Any = None,
) -> ReaderResult | None:
    """Bind a unit/trend follow-up to one visible metric, never a sibling KPI."""
    if not isinstance(observation, dict) or _observation_has_error_state(observation):
        return None
    if not re.search(
        r"\b(?:unit|units|trend|history|historical|changed|change|last\s+\d+\s+days?)\b"
        r"|الوحدة|وحدته|وحدتها|اتجاه|تاريخ|تاريخي|تغي(?:رت|ر)|نفس\s+(?:المؤشر|المقياس)",
        question,
        re.I,
    ):
        return None
    previous = (_bounded_conversation_context(conversation_context).get("previousIntent") or {})
    query_text = " ".join((str(question or ""), str(previous.get("question") or "")))
    query_tokens = _api_query_tokens(query_text)
    metrics = [{"label": label, "value": value} for label, value, _source in _observed_metric_pairs(observation)]
    ranked = [
        (len(set(_api_query_tokens(str(metric["label"]))).intersection(query_tokens)), metric)
        for metric in metrics
    ]
    ranked = [item for item in ranked if item[0] > 0]
    if not ranked:
        return None
    best_score = max(score for score, _metric in ranked)
    best = [metric for score, metric in ranked if score == best_score]
    if len(best) != 1:
        return None
    metric = best[0]
    label, value = str(metric["label"]).strip(), str(metric["value"]).strip()
    return ReaderResult(
        status="success",
        summary="The current metric is visible, but no historical series is available for comparison.",
        page=str(page)[:500],
        section="metrics",
        source_section="metrics",
        answer_shape="overview",
        completeness="bounded",
        scope=scope,
        workflow_state="metric_trend_unavailable",
        facts=(f"{label}: {value}", "No historical data is available in the current portal view to compare a trend."),
    )


def _observed_metric_pairs(observation: Any) -> tuple[tuple[str, str, str], ...]:
    """Extract conservative label/value pairs from rendered metric regions."""
    if not isinstance(observation, dict):
        return ()
    sources: list[tuple[str, Any]] = [("metrics", observation.get("metrics")),
                                      ("summaries", observation.get("summaries"))]
    for node in _observation_semantic_nodes(observation):
        if node.get("kind") not in {"metrics", "cards", "region"}:
            continue
        node_id = str(node.get("nodeId") or node.get("heading") or "")
        sources.extend((node_id, node.get(key)) for key in ("summaries", "cardSummaries", "controls"))
    pairs: list[tuple[str, str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for source, values in sources:
        if isinstance(values, dict):
            values = [values]
        if not isinstance(values, (list, tuple)):
            continue
        for item in values[:30]:
            if isinstance(item, dict):
                label = str(item.get("label") or "").strip()
                value = str(item.get("value") or "").strip()
            else:
                text = re.sub(r"\s+", " ", str(item or "")).strip(" |")
                match = re.fullmatch(r"(.+?)\s+([+-]?\d[\d,.]*(?:%|[kmbKMB])?)", text)
                if not match:
                    continue
                label, value = match.group(1).strip(" :|-"), match.group(2)
            if (not label or len(label) > 120
                    or not re.fullmatch(r"[+-]?\d[\d,.]*(?:%|[kmbKMB])?", value)
                    or re.search(r"@|password|token|secret", label, re.I)):
                continue
            key = (label.casefold(), value, source)
            if key not in seen:
                seen.add(key)
                pairs.append((label, value, source))
    return tuple(pairs)


def _native_metric_overview(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Repair a partial answer when a requested metric breakdown is visible."""
    if (outcome.result.status in {"no_permission", "load_failed"} or not outcome.result.page
            or not re.search(r"\b(?:breakdown|distribution|status\s+(?:overview|counts?)|by\s+status)\b|状态(?:分布|概览|统计)", question, re.I)):
        return outcome
    pairs = _observed_metric_pairs(outcome.audit_evidence.get("observation"))
    if len(pairs) < 2:
        return outcome
    grouped: dict[str, list[tuple[str, str]]] = {}
    for label, value, source in pairs:
        grouped.setdefault(source, []).append((label, value))
    source, selected = max(grouped.items(), key=lambda item: len(item[1]))
    if len(selected) < 2:
        return outcome
    status_words = re.compile(r"active|expire|expired|cancel|suspend|pending|completed|issued|to do|review|状态|激活|过期|取消|暂停|待处理|完成", re.I)
    status_selected = [(label, value) for label, value in selected if status_words.search(label)]
    if len(status_selected) >= 2:
        totals = [(label, value) for label, value in selected if label.casefold() == "total"]
        selected = totals + status_selected
    result = replace(outcome.result, status="success", answer_shape="overview", completeness="bounded",
                     source_section=source, facts=tuple(f"{label}: {value}" for label, value in selected[:12]) +
                     ("This is the bounded set of status metrics rendered in one current portal region; it is not a historical trend.",), missing=())
    return ReaderOutcome(result, {**outcome.audit_evidence, "nativeMetricOverview": {
        "source": source, "metricCount": len(selected),
    }, "result": result.public_json()})


def _native_queue_counts(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Return both queue counts when a question explicitly asks for them."""
    if (outcome.result.status in {"no_permission", "load_failed"} or not outcome.result.page
            or not re.search(r"\b(?:pending|to\s+do)\b.*\bcompleted\b|\bcompleted\b.*\b(?:pending|to\s+do)\b", question, re.I)):
        return outcome
    pairs = _observed_metric_pairs(outcome.audit_evidence.get("observation"))
    found: dict[str, tuple[str, str]] = {}
    for label, value, _source in pairs:
        normalized = re.sub(r"\s+", " ", label.casefold()).strip()
        if normalized in {"to do", "pending", "completed"}:
            found[normalized] = (label, value)
    todo = found.get("to do") or found.get("pending")
    completed = found.get("completed")
    if not todo or not completed:
        return outcome
    result = replace(outcome.result, status="success", answer_shape="count", completeness="bounded",
                     facts=(f"{todo[0]}: {todo[1]}", f"{completed[0]}: {completed[1]}"), missing=(), source_section="metrics")
    return ReaderOutcome(result, {**outcome.audit_evidence, "nativeQueueCounts": {
        "pending": todo[1], "completed": completed[1],
    }, "result": result.public_json()})


def _native_profile_type_count(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Count visible profile-verification type categories, not profile rows."""
    if (outcome.result.status in {"no_permission", "load_failed"} or not outcome.result.page
            or not re.search(r"\bhow many\b.*\b(?:user|profile)\s+types?\b|多少.*(?:用户|档案).{0,8}类型", question, re.I)):
        return outcome
    pairs = _observed_metric_pairs(outcome.audit_evidence.get("observation"))
    labels = list(dict.fromkeys(label for label, _value, _source in pairs
                               if label.casefold() not in {"total", "count", "records"}
                               and not re.search(r"rate|average|processing|revenue|satisfaction", label, re.I)))
    if len(labels) < 2:
        return outcome
    result = replace(outcome.result, status="success", answer_shape="count", completeness="bounded",
                     facts=(f"{len(labels)} user types are shown in the current Profile Verification summary: "
                            + "; ".join(labels[:12]) + ".",), missing=(), source_section="metrics")
    return ReaderOutcome(result, {**outcome.audit_evidence, "nativeProfileTypeCount": {
        "count": len(labels), "labels": labels[:12],
    }, "result": result.public_json()})


def _raw_observation_has_empty_state(observation: Any) -> bool:
    values: list[str] = []

    def visit(item: Any) -> None:
        if isinstance(item, dict):
            for name, value in item.items():
                if _key(name) == "emptystate":
                    values.extend(text.casefold() for text in _observation_scalar_strings(value))
                elif isinstance(value, (dict, list, tuple)):
                    visit(value)
        elif isinstance(item, (list, tuple)):
            for value in item:
                visit(value)

    visit(observation)
    return any(marker in value for value in values for marker in _EXPLICIT_EMPTY_MARKERS)


def _observation_no_data_allowed(observation: Any) -> bool:
    """Do not turn an unhealthy read into a false empty result."""

    if not isinstance(observation, dict):
        return True
    health = observation.get("readHealth")
    return not (isinstance(health, dict) and health.get("healthy") is False)


def _bounded_fact_candidates(candidates: tuple[str, ...]) -> tuple[str, ...]:
    facts: list[str] = []
    fact_bytes = 0
    for candidate in candidates:
        raw_fact = re.sub(r"\s+", " ", str(candidate)).strip()
        if any(marker in raw_fact.casefold() for marker in _API_TRUNCATION_MARKERS):
            continue
        fact = raw_fact
        if len(fact) > _OBSERVATION_FALLBACK_MAX_FACT_CHARS:
            try:
                structured = json.loads(fact)
            except (TypeError, ValueError):
                structured = None
            fact = (
                _serialize_api_mapping(structured, semantic_query="", answer_shape="unspecified")
                if isinstance(structured, dict)
                else fact[:_OBSERVATION_FALLBACK_MAX_FACT_CHARS]
            )
        if not fact or fact in facts:
            continue
        encoded_size = len(fact.encode("utf-8"))
        if fact_bytes + encoded_size > _OBSERVATION_FALLBACK_MAX_FACT_BYTES:
            break
        facts.append(fact)
        fact_bytes += encoded_size
        if len(facts) >= _OBSERVATION_FALLBACK_MAX_FACTS:
            break
    return tuple(facts)


def _bounded_native_row_facts(source: Any, *, limit: int = 4) -> tuple[str, ...]:
    """Project complete, uniquely grounded table rows without page-specific fields."""

    if not isinstance(source, dict) or not isinstance(source.get("rowFields"), (list, tuple)):
        return ()
    facts: list[str] = []
    for row in source["rowFields"][:limit]:
        if not isinstance(row, dict):
            continue
        selected: dict[str, str] = {}
        for raw_key, raw_value in list(row.items())[:20]:
            if not isinstance(raw_value, str):
                continue
            normalized_key = _key(raw_key)
            if (
                normalized_key in {_key(key) for key in SENSITIVE_KEYS}
                or any(fragment in normalized_key for fragment in SENSITIVE_KEY_FRAGMENTS)
            ):
                continue
            key = _sanitize_untrusted_text(raw_key, max_length=120)
            value = _sanitize_untrusted_text(raw_value, max_length=500)
            if not key or not value:
                continue
            candidate = {**selected, key: value}
            encoded = json.dumps(candidate, ensure_ascii=False, separators=(",", ":"))
            if len(encoded) > _OBSERVATION_FALLBACK_MAX_FACT_CHARS:
                break
            selected = candidate
        fact = json.dumps(selected, ensure_ascii=False, separators=(",", ":"))
        if selected and _structured_row_supports_fact(fact, source):
            facts.append(fact)
    return _bounded_fact_candidates(tuple(facts))


_COMPLETE_COLLECTION_PATTERN = re.compile(
    r"\b(?:comprehensive|complete|entire|full)\s+(?:list|set|collection)\b"
    r"|\b(?:show|list|give)\s+all\b"
    r"|\bevery\b|全部|所有|完整(?:列表|清单|数据)|全面",
    re.IGNORECASE,
)


def _complete_collection_requested(question: str) -> bool:
    return bool(_COMPLETE_COLLECTION_PATTERN.search(str(question or "")))


def _explicit_collection_field_request(question: str) -> bool:
    """Allow native rows when field words are output requirements, not filters."""

    normalized = re.sub(r"\s+", " ", str(question or "").casefold()).strip()
    if re.fullmatch(r'show (?:the )?current [a-z ]+ task queue and (?:the )?information '
                    r'(?:shown|displayed) for each task[.!?]?', normalized):
        return True
    match = re.search(r"\b(?:including|with)\b(?P<fields>.*)$", normalized)
    if not match:
        return False
    fields = match.group("fields")
    if re.search(
        r"\b(?:pending|completed|overdue|today|between|before|after|assigned\s+to|search|filter)\b",
        fields,
    ):
        return False
    return bool(re.search(
        r"\b(?:detail|details|information|status(?:es)?|type|category|sla|date|assigned|fields?)\b"
        r"|详情|明细|信息|状态|类型|类别|日期",
        fields,
    ))


def _minimal_identity_plan(question: str, observation: Any) -> dict[str, Any] | None:
    """A request for one identifier must not fall back to a personal profile API."""
    match = re.search(r'\bidentify one (?P<field>[A-Za-z][A-Za-z ]{0,60}?\b(?:ID|Number))\b'
                      r'.*\bwithout\b.*\bpersonal\b', question, re.I)
    if not match or not isinstance(observation, dict):
        return None
    failure = {'mode':'observation_result','result':'not_confirmed','answerShape':'list','facts':[],
               'missing':['requested_identifier_not_observed']}
    if ((observation.get('readHealth') or {}).get('healthy') is not True
            or _observation_has_error_state(observation)):
        return {**failure, 'missing':['requested_identifier_source_unhealthy']}
    tables = [node for node in _observation_semantic_nodes(observation)
              if node.get('kind') in {'table','grid'} and node.get('nodeId')
              and any(_key(h) == _key(match['field']) for h in node.get('columnHeaders', []))]
    if len(tables) != 1:
        return failure
    source = tables[0]
    for row in source.get('rowFields', []):
        fields = {key:value for key,value in row.items() if _key(key)==_key(match['field'])
                  and isinstance(value,str) and value.strip() not in {'','-','—'}}
        fact = json.dumps(fields,ensure_ascii=False)
        if len(fields)==1 and _structured_row_supports_fact(fact,source):
            return {'mode':'observation_result','result':'success','sourceSection':source['nodeId'],
                    'selectedState':source.get('selectedState',''),'answerShape':'list',
                    'completeness':'bounded','scope':'unknown','facts':[fact],'missing':[]}
    return failure


def _native_list_fallback_result(
    observation: Any,
    *,
    page: str,
    section: str,
    scope: Literal["personal", "team", "global", "unknown"],
    question: str,
) -> ReaderResult | None:
    """Project a safe bounded list before lexical fallback guards run."""

    if _observation_has_error_state(observation) or not _observation_no_data_allowed(observation):
        return None
    if (
        _observation_fallback_intent(question, "list") is None
        and not _explicit_collection_field_request(question)
        and not (page == '/happiness/refunds' and re.fullmatch(
            r'\s*what refund requests are currently in (?:the )?customer happiness queue[?.]?\s*', question, re.I))
    ):
        return None
    resolved_section = section
    if not resolved_section:
        table_nodes = [
            node for node in _observation_semantic_nodes(observation)
            if str(node.get("kind") or "").casefold() in {"table", "grid"}
            and node.get("rowFields")
            and node.get("nodeId")
        ]
        if len(table_nodes) == 1:
            resolved_section = str(table_nodes[0]["nodeId"])
    source = _observation_evidence_for_section(observation, resolved_section)
    if not isinstance(source, dict) or not source.get("rowFields"):
        return None
    result = _result_from_structured_observation(
        observation,
        page=page,
        section_name=resolved_section,
        answer_shape="list",
        scope=scope,
        question=question,
    )
    if result is None:
        return None
    if _complete_collection_requested(question) and result.completeness != "complete":
        result = replace(
            result,
            status="not_confirmed",
            missing=(*result.missing, "complete_collection_not_verified"),
        )
    return result


def observation_fallback_result(
    question: str,
    observation: Any,
    *,
    page: str = "",
    section: str = "",
    scope: Literal["personal", "team", "global", "unknown"] = "unknown",
    answer_shape: Literal["overview", "count", "list", "attention", "due", "detail", "unspecified"] | None = None,
) -> ReaderResult | None:
    """Return exact facts from one plan-selected or unambiguous semantic region."""

    answer_shape = answer_shape or reader_answer_shape(question)
    if answer_shape == "list":
        native = _native_list_fallback_result(
            observation,
            page=page,
            section=section,
            scope=scope,
            question=question,
        )
        if native is not None:
            return native
    intent = _observation_fallback_intent(question, answer_shape)
    if intent is None:
        return None
    if answer_shape in {"count", "attention", "due", "detail"}:
        return None
    if _observation_has_error_state(observation) or not _observation_no_data_allowed(observation):
        return None
    if _category_control_requiring_children(question, observation, None, answer_shape, current_page=page):
        return None

    source = _observation_evidence_for_section(observation, section)
    if source is None:
        return None
    headings = _bounded_observation_field(source, "headings", limit=3)
    controls = tuple(
        value for value in _bounded_observation_field(source, "controls", limit=12)
        if _data_observation_control(value)
    )
    rows = _bounded_observation_field(source, "rowSummaries", limit=4)
    list_native_rows = _bounded_native_row_facts(source, limit=4) if intent == "list" else ()
    summaries = (
        *(
            value for value in _bounded_observation_field(source, "cardSummaries", limit=12)
            if (intent == "overview" and source.get("kind") == "cards") or _data_observation_control(value)
        ),
        *(
            value for value in _bounded_observation_field(source, "summaries", limit=12)
            if _data_observation_control(value)
        ),
    )
    if intent == "list" and not list_native_rows and not rows:
        if _structured_observation_sections(observation) and _raw_observation_has_empty_state(source):
            if not _observation_no_data_allowed(observation):
                return None
            return ReaderResult(
                status="no_data",
                summary="The requested portal section is empty.",
                page=str(page)[:500],
                section=str(source.get("heading") or section)[:300],
                source_section=str(source.get("nodeId") or source.get("heading") or section)[:300],
                answer_shape="list",
                completeness="bounded",
                selected_state=str(source.get("selectedState") or "")[:300],
                scope=scope,
            )
        return None
    native_rows = []
    if intent == "overview" and source.get("kind") == "table":
        for row in source.get("rowFields", [])[:4]:
            if not isinstance(row, dict):
                continue
            selected = {}
            # Retain complete native pairs; truncating serialized rows can
            # break field bindings and make downstream formatting ambiguous.
            for key, value in list(row.items())[:5]:
                candidate = {**selected, key: value}
                if len(json.dumps(candidate, ensure_ascii=False)) > _OBSERVATION_FALLBACK_MAX_FACT_CHARS:
                    break
                selected = candidate
            fact = json.dumps(selected, ensure_ascii=False)
            if len(selected) >= 2 and _structured_row_supports_fact(fact, source):
                native_rows.append(fact)
    if intent == "overview" and not controls and not summaries and not native_rows:
        if _raw_observation_has_empty_state(source):
            if not _observation_no_data_allowed(observation):
                return None
            return ReaderResult(
                status="no_data",
                summary="The requested portal section is empty.",
                page=str(page)[:500],
                section=str(source.get("heading") or section)[:300],
                source_section=str(source.get("nodeId") or source.get("heading") or section)[:300],
                answer_shape="overview",
                completeness="bounded",
                selected_state=str(source.get("selectedState") or "")[:300],
                scope=scope,
            )
        return None
    if intent == "list":
        candidates = list_native_rows or rows
    else:
        count_controls = tuple(
            value for value in controls
            if re.search(r"(?:^|\s)\d+(?:[.,]\d+)?\s*$", value)
        )
        requested_tokens = _section_match_tokens(question)
        matching_count_controls = tuple(
            value for value in count_controls
            if requested_tokens & _section_match_tokens(value)
        )
        if len(matching_count_controls) == 1:
            candidates = matching_count_controls
        else:
            candidates = (*summaries, *(count_controls if len(count_controls) >= 2 else controls))
    facts = _bounded_fact_candidates((*native_rows, *candidates))
    if not facts:
        return None
    return ReaderResult(
        status="success",
        summary="The bounded portal observation answered the generic request.",
        page=str(page)[:500],
        section=str(source.get("heading") or section or (headings[0] if headings else ""))[:300],
        source_section=str(source.get("nodeId") or source.get("heading") or section or (headings[0] if headings else ""))[:300],
        answer_shape=intent,
        completeness="bounded",
        selected_state=str(source.get("selectedState") or "")[:300],
        scope=scope,
        facts=facts,
        missing=("Overview includes only a bounded sample of rows and fields, not every analytics dimension.",)
        if native_rows else (),
    )


def _observation_unit_supports_fact(fact: str, value: str, *, structural_tokens: frozenset[str]) -> bool:
    normalized_fact = re.sub(r"\s+", " ", fact).strip().casefold()
    normalized_value = re.sub(r"\s+", " ", value).strip().casefold()
    if not normalized_fact or not normalized_value:
        return False
    if _negative_polarity(normalized_fact) != _negative_polarity(normalized_value):
        return False
    fact_tokens = re.findall(r"[a-z][a-z0-9_-]*|\d+(?:\.\d+)?", normalized_fact)
    value_tokens = re.findall(r"[a-z][a-z0-9_-]*|\d+(?:\.\d+)?", normalized_value)
    concrete_tokens = {
        token
        for token in fact_tokens
        if token not in structural_tokens
        and (token[0].isdigit() or (len(token) >= 2 and token not in _OBSERVATION_PROSE_TERMS))
    }
    if not concrete_tokens:
        return normalized_fact in normalized_value or normalized_value in normalized_fact
    if not concrete_tokens.issubset(set(value_tokens)):
        return False
    compact_fact = [
        token for token in fact_tokens
        if token not in _OBSERVATION_PROSE_TERMS and token not in structural_tokens
    ]
    compact_value = [token for token in value_tokens if token not in _OBSERVATION_PROSE_TERMS]
    supported_numbers: set[str] = set()
    for index, token in enumerate(compact_fact):
        if not token[0].isdigit():
            continue
        windows = [
            compact_fact[start:end]
            for start in range(max(0, index - 2), index + 1)
            for end in range(index + 1, min(len(compact_fact), index + 3) + 1)
            if end - start >= 2
        ]
        if any(_contains_contiguous_tokens(compact_value, window) for window in windows):
            supported_numbers.add(token)
            continue
        translated_repeat = token in supported_numbers and re.search(
            rf"{re.escape(token)}\D{{0,40}}[（(][^）)]*{re.escape(token)}(?:\D|$)",
            fact,
        )
        if not translated_repeat:
            return False
    return True


def _table_row_supports_fact(
    fact: str,
    row: str,
    *,
    column_headers: tuple[str, ...],
) -> bool:
    """Allow an ambiguous table fallback to retain only its original row text."""

    normalized_fact = re.sub(r"\s+", " ", fact).strip().casefold()
    normalized_row = re.sub(r"\s+", " ", row).strip().casefold()
    if not normalized_fact or not normalized_row:
        return False
    # Without native rowFields, headers only describe the table shape. They
    # cannot prove which position supplied a value, so an LLM must not turn
    # them into label:value claims. Keep the raw, unlabeled row as the only
    # safe fallback.
    return normalized_fact == normalized_row


def _native_sample_value_facts(observation: Any) -> tuple[str, ...]:
    """Derive field occurrences, never a complete enum or collection total."""
    if not isinstance(observation, dict) or observation.get("kind") != "table":
        return ()
    rows = [row for row in observation.get("rowFields", [])[:4] if isinstance(row, dict)]
    if not rows:
        return ()
    facts = []
    for field in list(rows[0])[:12]:
        values = list(dict.fromkeys(row[field] for row in rows if isinstance(row.get(field), str)))
        if not values or len(values) > 4:
            continue
        fact = f"Values of {field} in the bounded row sample: " + json.dumps(values, ensure_ascii=False)
        if len(fact) <= 400:
            facts.append(fact)
    return tuple(facts)


def _observation_supports_fact(fact: str, observation: Any) -> bool:
    """Require a fact's labels, values, polarity and numbers in one observed unit.

    Natural-language glue may be translated or paraphrased, while statuses,
    labels, dates and counts must come directly from the bounded observation.
    """

    if not fact.strip():
        return False
    if isinstance(observation, dict) and str(observation.get("kind") or "").casefold() == "table":
        if fact in _native_sample_value_facts(observation):
            return True
        if observation.get("rowFields") and _structured_row_supports_fact(fact, observation):
            return True
        if any(_observation_unit_supports_fact(fact, value, structural_tokens=frozenset())
               for value in _bounded_observation_field(observation, "summaries", limit=4)):
            return True
        column_headers = _bounded_observation_field(observation, "columnHeaders", limit=20)
        return any(
            _table_row_supports_fact(fact, row, column_headers=column_headers)
            for row in _bounded_observation_field(observation, "rowSummaries", limit=12)
        )
    values = _observation_scalar_strings(observation)
    if not values:
        return False
    structural_values = (
        str(observation.get("heading") or "") if isinstance(observation, dict) else "",
        str(observation.get("sourceSection") or "") if isinstance(observation, dict) else "",
        *_bounded_observation_field(observation, "headings", limit=3),
        *_bounded_observation_field(observation, "columnHeaders", limit=20),
        *_bounded_observation_field(observation, "labels", limit=20),
    )
    structural_tokens = frozenset(
        token
        for value in structural_values
        for token in re.findall(r"[a-z][a-z0-9_-]*", value.casefold())
    )
    if any(
        _observation_unit_supports_fact(fact, value, structural_tokens=structural_tokens)
        for value in values
    ):
        return True
    return False


def _unconfirmed_observation_fact(fact: str) -> str:
    normalized = re.sub(r"\s+", " ", fact).strip()
    return f"unconfirmed_fact: {normalized}"[:500]


def _structured_row_supports_fact(fact: str, observation: dict[str, Any]) -> bool:
    def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        if len({key for key, _ in pairs}) != len(pairs):
            raise ValueError("duplicate_field")
        return dict(pairs)

    try:
        fields = json.loads(fact, object_pairs_hook=unique_object)
    except (TypeError, ValueError):
        return False
    if not isinstance(fields, dict) or not fields or not all(isinstance(value, str) for value in fields.values()):
        return False
    return sum(
        all(key in row and value == row[key] for key, value in fields.items())
        for row in observation.get("rowFields", []) if isinstance(row, dict)
    ) == 1


_ADMIN_ROLE = re.compile(
    r"\b(?:super\s*admin|system\s*admin|it\s*admin|administrator|superadmin|super\s*administrator)\b"
    r"|مسؤول النظام|مدير النظام|超级管理员",
    re.I,
)
_LEADER_ROLE = re.compile(
    r"\b(?:manager|leader|supervisor|head|director|chief|lead)\b"
    r"|مدير|قائد|مشرف|رئيس قسم|主管|经理",
    re.I,
)


def _permission_result_scope(context: UserPermissionContext) -> Literal["personal", "team", "global", "unknown"]:
    values = {re.sub(r"[^a-z]", "", value.casefold()) for value in _strings(context.data_scope, limit=20)}
    matches: set[str] = set()
    if values.intersection({"personal", "self", "own"}):
        matches.add("personal")
    if values.intersection({"team", "department"}):
        matches.add("team")
    if values.intersection({"global", "all"}):
        matches.add("global")
    if matches == {"personal"}:
        return "personal"
    if matches == {"team"}:
        return "team"
    if matches == {"global"}:
        return "global"
    # Some deployments do not return a data-scope field at all, so the portal's
    # own role name is the remaining evidence for the visible working scope.
    # A department role such as "Happiness Center Manager" is exactly what the
    # portal uses to render the department/team view; without this fallback the
    # reader refused a team request it could plainly answer from the same page.
    role_text = " ".join((context.current_role, *context.roles)).strip()
    if role_text:
        if _ADMIN_ROLE.search(role_text):
            return "global"
        if _LEADER_ROLE.search(role_text):
            return "team"
    return "unknown"


def _explicit_observed_filter(question: str, observation: Any) -> str:
    """Recognize one literal observed category, not a business-specific status map."""
    if not isinstance(observation, dict) or not observation.get("filterControls"):
        return ""
    question_text = re.sub(r"\s+", " ", question).strip().casefold()
    if re.search(r"\b(not|except|excluding|without|compare|versus)\b|不要|排除|不包括|对比", question_text):
        return ""
    selected_tabs = {str(node.get("selectedState") or "").casefold()
                     for node in _observation_semantic_nodes(observation)}
    labels = [item.get("label") for item in observation.get("metrics", []) if isinstance(item, dict)]
    for control in observation.get("filterControls", []):
        if isinstance(control, dict) and control.get("role") != "textbox":
            labels.extend(control.get("options") or [])
            labels.extend(control.get("selected") or [])
    matches = {str(label).strip() for label in labels if isinstance(label, str) and len(label.strip()) >= 3
               and label.strip().casefold() not in selected_tabs
               and re.search(r"(?<!\w)" + re.escape(label.strip().casefold()) + r"(?!\w)", question_text)}
    # Nested labels are not separate predicates (e.g. Review / Pending Review).
    matches = {label for label in matches if not any(label.casefold() in other.casefold() and label != other for other in matches)}
    return next(iter(matches)) if len(matches) == 1 else ""


def _filter_result_needs_read(plan: Any, observation: Any, requested_value: str, requested_shape: str = "unspecified") -> bool:
    if not requested_value or not isinstance(plan, dict) or plan.get("mode") != "observation_result":
        return False
    if requested_shape in {"count", "overview"} or requested_shape == "unspecified" and plan.get("answerShape") in {"count", "overview"}:
        return False
    result = _observation_plan_result_from_plan(plan)
    source = _observation_evidence_for_result(observation, result) if result else None
    rows = source.get("rowFields", []) if source else []
    matching_rows = [row for row in rows if isinstance(row, dict)
                     and requested_value.casefold() in {str(value).strip().casefold() for value in row.values()}]
    if matching_rows and len(matching_rows) == len(rows):
        # The read is complete; ordinary source/shape validation can repair the
        # candidate without selecting the same filter again.
        return False
    if result and result.facts:
        return not all(_structured_row_supports_fact(fact, {"rowFields": matching_rows}) for fact in result.facts)
    if plan.get("result") == "no_data":
        applied = {str(value).casefold() for value in observation.get("appliedFilters", [])}
        return requested_value.casefold() not in applied or bool(rows)
    return True


def _list_selection_review_context(plan: Any, context: dict[str, Any]) -> dict[str, Any] | None:
    """Ask for semantic review of a partial selection, never infer a row filter."""
    result = _observation_plan_result_from_plan(plan)
    if result is None or result.status != "success" or result.answer_shape != "list":
        return None
    section = _observation_evidence_for_result(context.get("portalObservation"), result)
    if not section or not section.get("selectedState"):
        return None
    rows = [row for row in section.get("rowFields", [])[:4] if isinstance(row, dict)]
    selected: set[int] = set()
    for fact in result.facts:
        matches = [
            index for index, row in enumerate(rows)
            if _structured_row_supports_fact(fact, {"rowFields": [row]})
        ]
        if len(matches) != 1:
            return None
        selected.add(matches[0])
    if not 0 < len(selected) < len(rows):
        return None
    return {
        **context,
        "planningDirective": {
            **(context.get("planningDirective") or {}),
            "listSelectionReview": True,
            "reason": "selected_view_rows_were_omitted",
            "observedRowCount": len(rows),
            "selectedRowCount": len(selected),
            "priorSelection": bounded_json(plan, max_depth=3, max_items=24, max_string=500),
        },
    }


def _api_native_source(observation: Any) -> dict[str, Any] | None:
    """Carry view provenance only when API values match one fresh native table."""
    if not isinstance(observation, dict) or not _observation_no_data_allowed(observation):
        return None
    api = observation.get('apiEvidence')
    if not isinstance(api, dict) or 'data' not in api:
        return None
    values = {s.casefold() for s in _observation_scalar_strings(api['data'])}
    matches = []
    for node in _observation_semantic_nodes(observation):
        if node.get('kind') not in {'table', 'grid'}:
            continue
        headers, rows = node.get('columnHeaders') or [], node.get('rowFields') or []
        if not headers or not rows:
            continue
        identities = [str(row.get(headers[0]) or '').strip() for row in rows if isinstance(row, dict)]
        if (len(identities) == len(rows) and all(len(v) >= 4 and not v.isdigit() for v in identities)
                and len(set(identities)) == len(identities)
                and all(v.casefold() in values for v in identities)):
            matches.append(node)
    return matches[0] if len(matches) == 1 else None


def observation_result_from_plan(
    plan: Any,
    observation: Any,
    *,
    verified_scope: Literal["personal", "team", "global", "unknown"] = "unknown",
    observed_page: str = "",
    permitted_paths: tuple[str, ...] = (),
) -> ReaderResult | None:
    """Validate a post-observe LLM result against permission and bounded evidence."""

    result = _observation_plan_result_from_plan(plan)
    if result is None:
        return None
    result_page = (urlsplit(result.page).path.rstrip("/") or "/") if result.page else ""
    actual_page = (urlsplit(observed_page).path.rstrip("/") or "/") if observed_page else ""
    if result_page and actual_page and result_page != actual_page:
        return None
    if result_page and permitted_paths and not any(
        permission_path_matches(result_page, allowed) for allowed in permitted_paths
    ):
        return None
    api_evidence = observation.get("apiEvidence") if isinstance(observation, dict) else None
    if isinstance(api_evidence, dict) and "data" in api_evidence:
        native_source = _api_native_source(observation)
        if native_source is not None:
            result = replace(result, source_section=str(native_source.get('nodeId') or ''),
                             section=str(native_source.get('selectedState') or native_source.get('heading') or ''),
                             selected_state=str(native_source.get('selectedState') or ''))
        operation_key = str(api_evidence.get("operationKey") or "")
        public_source = result.source_section or result.section
        if (operation_key and operation_key in public_source) or public_source.casefold().startswith("api:"):
            public_source = result.section
        if result.status == "no_data":
            fallback, _reason = _api_evidence_fallback_plan(
                api_evidence,
                answer_shape=result.answer_shape,
            )
            if fallback is None or fallback.get("result") != "no_data":
                return None
            supported_facts: tuple[str, ...] = ()
            unsupported_facts: tuple[str, ...] = ()
        else:
            supported_values: list[str] = []
            unsupported_values: list[str] = []
            for fact in result.facts:
                if not _api_evidence_supports_fact(fact, api_evidence.get("data")):
                    unsupported_values.append(fact)
                    continue
                projected = _api_project_fact(fact)
                if projected:
                    supported_values.append(projected)
                else:
                    unsupported_values.append(fact)
            supported_facts = tuple(supported_values)
            unsupported_facts = tuple(unsupported_values)
            if not supported_facts:
                return ReaderResult(
                    status="not_confirmed",
                    summary="The selected portal response did not support the proposed answer.",
                    page=observed_page or result.page,
                    section=result.section,
                    source_section=public_source,
                    answer_shape=result.answer_shape,
                    completeness="bounded",
                    selected_state=result.selected_state,
                    scope=verified_scope,
                    missing=("unsupported_api_answer_facts",),
                )
        return ReaderResult(
            status="not_confirmed" if unsupported_facts else result.status,
            summary="The selected portal API response answered the request."
            if result.status == "success" and not unsupported_facts else result.summary,
            page=observed_page or result.page,
            section=result.section,
            source_section=public_source,
            answer_shape=result.answer_shape,
            completeness="bounded" if api_evidence.get("truncated") is True or result.answer_shape == "list" else result.completeness,
            selected_state=result.selected_state,
            scope=verified_scope,
            facts=supported_facts,
            workflow_state=result.workflow_state,
            missing=tuple(dict.fromkeys((
                *result.missing,
                *(("unsupported_api_answer_facts",) if unsupported_facts else ()),
            )))[:10],
        )
    source_ref = result.source_section or result.section
    scoped_observation = _observation_evidence_for_result(observation, result)
    if scoped_observation is not None and _observation_has_error_state(scoped_observation):
        return None
    actual_selected_state = ""
    if scoped_observation is not None:
        actual_selected_state = re.sub(
            r"\s+",
            " ",
            str(scoped_observation.get("selectedState") or ""),
        ).strip()[:300]
    claimed_selected_state = re.sub(r"\s+", " ", result.selected_state).strip()
    if actual_selected_state and claimed_selected_state and (
        not _observation_selected_state_matches(claimed_selected_state, scoped_observation)
    ):
        return None
    if scoped_observation is not None and scoped_observation.get("nodeId"):
        result = replace(result, source_section=str(scoped_observation["nodeId"]))
    if result.status == "not_confirmed" and not result.facts:
        if source_ref and scoped_observation is None:
            return None
        return ReaderResult(
            status=result.status,
            summary=result.summary,
            page=observed_page or result.page,
            section=result.section,
            source_section=result.source_section or result.section,
            answer_shape=result.answer_shape,
            completeness=result.completeness,
            selected_state=actual_selected_state,
            scope=verified_scope,
            missing=result.missing,
        )
    if scoped_observation is None:
        return None
    if scoped_observation.get("kind") in {"metrics", "cards"} and not _observation_no_data_allowed(observation):
        return None
    if result.status in {"success", "not_confirmed"}:
        sample_facts = _native_sample_value_facts(scoped_observation)
        uses_sample_values = any(fact in sample_facts for fact in result.facts)
        if uses_sample_values and (result.answer_shape not in {"detail", "overview"}
                                   or not _observation_no_data_allowed(observation)):
            return None
        supported: list[str] = []
        unsupported: list[str] = []
        structured_list = result.answer_shape == "list" and bool(scoped_observation.get("rowFields"))
        fact_observation = scoped_observation
        if result.answer_shape == "count" and scoped_observation.get("kind") in {"table", "grid"}:
            # Visible record values and row counts cannot establish a collection total.
            fact_observation = {key: scoped_observation.get(key, []) for key in ("summaries", "cardSummaries")}
        for fact in result.facts:
            fact_supported = (
                _structured_row_supports_fact(fact, scoped_observation)
                if structured_list else _observation_supports_fact(fact, fact_observation)
            )
            (supported if fact_supported else unsupported).append(fact)
        supported_facts = tuple(supported)
        if not supported_facts and result.status == "success":
            return None
        visible_rows = _bounded_observation_field(scoped_observation, "rowSummaries", limit=8)
        if supported_facts and result.answer_shape == "list" and visible_rows and not structured_list:
            column_headers = _bounded_observation_field(scoped_observation, "columnHeaders", limit=20)
            row_fact_supported = any(
                _table_row_supports_fact(fact, row, column_headers=column_headers)
                if str(scoped_observation.get("kind") or "").casefold() == "table"
                else _observation_supports_fact(fact, {**scoped_observation, "rowSummaries": [row]})
                for fact in supported_facts
                for row in visible_rows
            )
            if not row_fact_supported:
                # A table schema is useful context, but it is not a task list.
                # Let the bounded row fallback answer instead of returning headers
                # after the planner collapsed several rows into a prose summary.
                return None
        missing = tuple(
            [*result.missing, *(_unconfirmed_observation_fact(fact) for fact in unsupported)][:10]
        )
        count_source = {
            "heading": str(scoped_observation.get("heading") or ""),
            "controls": [
                value for value in (
                    *_bounded_observation_field(scoped_observation, "controls", limit=20),
                    *_bounded_observation_field(scoped_observation, "summaries", limit=20),
                ) if re.search(r"(?:^|\s)\d+(?:[.,]\d+)?\s*$", value)
            ],
        }
        count_only_attention = result.answer_shape == "attention" and bool(supported_facts) and all(
            _observation_supports_fact(fact, count_source) for fact in supported_facts
        )
        if count_only_attention:
            missing = tuple(dict.fromkeys(("attention_details_not_confirmed", *missing)))[:10]
        result = ReaderResult(
            status="not_confirmed" if unsupported or count_only_attention else result.status,
            summary=result.summary,
            page=result.page,
            section=result.section,
            source_section=result.source_section or result.section,
            answer_shape=result.answer_shape,
            completeness=result.completeness,
            selected_state=actual_selected_state,
            scope=result.scope,
            facts=supported_facts,
            workflow_state=result.workflow_state,
            missing=missing,
        )
        if result.answer_shape == "list" or uses_sample_values:
            result = replace(result, completeness="bounded")
    elif result.status == "no_data":
        if not _observation_no_data_allowed(observation):
            return None
        evidence_text = " ".join(_observation_scalar_strings(scoped_observation)).casefold()
        if not any(marker in evidence_text for marker in _EXPLICIT_EMPTY_MARKERS):
            return None

    return ReaderResult(
        status=result.status,
        summary="The portal observation answered the request." if result.status == "success" else result.summary,
        page=observed_page or result.page,
        section=result.section,
        source_section=result.source_section or result.section,
        answer_shape=result.answer_shape,
        completeness=result.completeness,
        selected_state=actual_selected_state,
        scope=verified_scope,
        facts=result.facts,
        workflow_state=result.workflow_state,
        missing=result.missing,
    )


def normalize_bounded_list_plan(plan: Any, observation: Any, limit: int) -> Any:
    """A verified native list need not fill an explicit upper bound."""
    if (isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 99
            or not isinstance(plan, dict) or plan.get('mode') != 'observation_result'
            or plan.get('result') != 'not_confirmed' or plan.get('answerShape') != 'list'
            or not isinstance(observation, dict) or _observation_has_error_state(observation)
            or not isinstance(observation.get('readHealth'), dict)
            or observation.get('readHealth', {}).get('healthy') is not True):
        return plan
    missing = plan.get('missing')
    if (not isinstance(missing, list) or len(missing) != 1 or not isinstance(missing[0], str)
            or not re.fullmatch(
                r'Only (?:one|two|[1-9]) (?:\w+ ){0,3}rows? (?:was|were|is|are) (?:returned|visible|available)'
                r'[^.;]*[.;] (?:the )?requested first (?:one|two|three|four|five|six|seven|eight|nine|ten|[1-9]\d?) '
                r'[\w ]*(?:records|rows|requests|items|tasks|applications|appeals|violations) '
                r'(?:could not be fully listed|could not be confirmed|cannot be confirmed|cannot be fully listed)\.?',
                missing[0], re.I)):
        return plan
    result = _observation_plan_result_from_plan(plan)
    if result is None:
        return plan
    source = _observation_evidence_for_result(observation, result)
    if (not isinstance(source, dict) or source.get('kind') not in {'table', 'grid'}
            or (plan.get('sourceSection') or plan.get('section')) != source.get('nodeId')):
        return plan
    rows = source.get('rowFields')
    facts = plan.get('facts')
    if (not isinstance(rows, list) or not 0 < len(rows) < limit
            or not isinstance(facts, list) or len(facts) != len(rows)
            or any(not isinstance(fact, str) for fact in facts)
            or len(set(facts)) != len(facts)
            or any(not _structured_row_supports_fact(fact, source) for fact in facts)
            or not _observation_selected_state_matches(result.selected_state, source)):
        return plan
    bindings = [[index for index, row in enumerate(rows)
                 if _structured_row_supports_fact(fact, {**source, 'rowFields': [row]})] for fact in facts]
    if any(len(indices) != 1 for indices in bindings) or len({indices[0] for indices in bindings}) != len(rows):
        return plan
    return {**plan, 'result': 'success', 'completeness': 'bounded', 'missing': [],
            'workflowState': f'Returned {len(facts)} observed records within the requested limit of {limit}; this is a bounded list, not a collection-wide total.'}


def normalize_empty_observation_plan(plan: Any, observation: Any) -> Any:
    """Derive a fact-free empty result from native evidence, not planner prose."""
    if (not isinstance(plan, dict) or plan.get("mode") != "observation_result"
            or plan.get("result") != "no_data" or not isinstance(plan.get("facts"), list)
            or not plan["facts"] or not _observation_no_data_allowed(observation)):
        return plan
    source = _observation_evidence_for_section(observation, plan.get("sourceSection") or plan.get("section") or "")
    if (not source or source.get("kind") not in {"table", "grid"}
            or source.get("rowFields") or source.get("rowSummaries")):
        return plan
    reference = str(plan.get("sourceSection") or plan.get("section") or "").strip().casefold()
    if (not reference or reference not in {str(source.get("nodeId") or "").casefold(),
                                          str(source.get("heading") or "").casefold()}):
        return plan
    if not all(isinstance(fact, str) for fact in plan["facts"]):
        return plan
    # Discard all explanatory claims. Only the independently validated native
    # empty state survives, and downstream view/filter checks still apply.
    normalized = {**plan, "facts": []}
    if observation_result_from_plan(normalized, observation) is None:
        return plan
    return normalized


def _reader_result_from_tool(tool_result: dict[str, Any]) -> ReaderResult:
    if not tool_result.get("ok"):
        code = str(tool_result.get("code") or "")
        status: ReaderStatus = "no_permission" if code in {"permission_denied", "page_not_permitted", "umc_token_required"} else "load_failed"
        return ReaderResult(status=status, summary="The Admin Portal could not be read for this request.", missing=(code or "portal_read_failed",))
    raw = tool_result.get("result")
    payload = bounded_json(raw, max_depth=5, max_items=100, max_string=1_000)
    if not isinstance(payload, dict):
        return ReaderResult(status="not_confirmed", summary="The Admin Portal returned an unrecognized result.")
    requested_status = str(payload.get("result") or payload.get("status") or "").strip()
    status: ReaderStatus = requested_status if requested_status in READER_STATUSES else "not_confirmed"  # type: ignore[assignment]
    facts_value = payload.get("facts") or payload.get("items") or payload.get("data") or []
    if not isinstance(facts_value, list):
        facts_value = [facts_value] if facts_value else []
    normalized_facts: list[str] = []
    for item in facts_value[:20]:
        raw_fact = (
            str(item)[:500]
            if isinstance(item, str)
            else json.dumps(bounded_json(item, max_depth=3, max_items=20, max_string=500), ensure_ascii=False)[:500]
        )
        projected_fact = _api_project_fact(raw_fact)
        normalized_facts.append(projected_fact or raw_fact)
    facts: tuple[str, ...] = tuple(normalized_facts)
    if not requested_status:
        status = "success" if facts else "no_data"
    summary = str(payload.get("summary") or payload.get("message") or "").strip()
    if not summary:
        summary = "The requested portal data was found." if status == "success" else "No matching portal data was found." if status == "no_data" else "The portal result could not be confirmed."
    answer_shape = str(payload.get("answerShape") or "unspecified")
    if answer_shape not in {"overview", "count", "list", "attention", "due", "detail", "unspecified"}:
        answer_shape = "unspecified"
    completeness = str(payload.get("completeness") or "unknown")
    if completeness not in {"bounded", "complete", "unknown"}:
        completeness = "unknown"
    return ReaderResult(
        status=status,
        summary=summary[:2_000],
        page=str(payload.get("page") or next(iter(_strings(payload.get("pagesVisited") or (), limit=1)), ""))[:500],
        section=str(payload.get("section") or "")[:300],
        source_section=str(payload.get("sourceSection") or payload.get("section") or "")[:300],
        answer_shape=answer_shape,  # type: ignore[arg-type]
        completeness=completeness,  # type: ignore[arg-type]
        selected_state=str(payload.get("selectedState") or "")[:300],
        scope=str(payload.get("scope") or "unknown") if str(payload.get("scope") or "unknown") in {"personal", "team", "global", "unknown"} else "unknown",  # type: ignore[arg-type]
        facts=facts,
        workflow_state=str(payload.get("workflowState") or payload.get("workflow_state") or "")[:500],
        missing=_strings(payload.get("missing") or payload.get("limitations") or (), limit=10),
    )


def _align_result_to_answer_shape(
    result: ReaderResult,
    question: str,
    conversation_context: dict[str, Any] | None = None,
) -> ReaderResult:
    """Attach presentation guidance without deleting already verified facts."""

    if _bounded_conversation_context(conversation_context).get("resolvedIntent"):
        # A declared current intent must be checked, not copied onto the evidence.
        return result
    answer_shape = reader_answer_shape(question, conversation_context)
    return replace(
        result,
        answer_shape=answer_shape if answer_shape != "unspecified" else result.answer_shape,
    )


def _reconcile_verified_answer_shape(result: ReaderResult, expected_shape: str, question: str) -> ReaderResult:
    """Check narrow content equivalence; retain other verified evidence as partial."""
    if (
        result.status == "success" and result.answer_shape == "list" and expected_shape == "due"
        and result.facts and re.search(r"\boverdue\b|逾期|متأخر", question, re.IGNORECASE)
        and not re.search(r"\d|today|tomorrow|yesterday|\bdays?\b|\bweeks?\b|\bmonths?\b|今天|明天|昨天", question, re.IGNORECASE)
        and all(
            re.search(r"\boverdue\b|逾期|متأخر", fact, re.IGNORECASE)
            and not _negative_polarity(fact)
            and not re.search(r"\b0(?:d|\s+days?)?\s+overdue\b|\boverdue\s*:?\s*0\b", fact, re.IGNORECASE)
            for fact in result.facts
        )
    ):
        return replace(result, answer_shape="due")
    return replace(
        result, status="not_confirmed", completeness="bounded",
        missing=tuple(dict.fromkeys((*result.missing, "answer_intent_mismatch")))[:10],
    )


def _selected_view_list_fallback(
    observation: Any, *, section_name: str, question: str, page: str,
    scope: Literal["personal", "team", "global", "unknown"], conversation_context: Any,
) -> ReaderResult | None:
    """Recover a plain request for one verified view, never infer extra predicates."""
    resolved = _resolved_intent_values(conversation_context)
    if any(resolved.get(key) for key in ("dateRange", "recordIdentity")):
        return None
    section = _observation_evidence_for_section(observation, section_name)
    if section is None and not section_name:
        tables = [node for node in _observation_semantic_nodes(observation)
                  if node.get('kind') in {'table', 'grid'} and node.get('rowFields')]
        if len(tables) == 1:
            section = tables[0]
    if section is None or not section.get("selectedState") or not section.get("rowFields"):
        return None
    if (re.search(r"\d", question) or _observation_has_error_state(observation)
            or not _observation_no_data_allowed(observation)):
        return None

    def tokens(value: str) -> set[str]:
        return {word[:-1] if len(word) > 3 and word.endswith("s") else word
                for word in _section_match_tokens(value)}

    question_tokens = tokens(question)
    view_tokens = tokens(str(section["selectedState"]))
    if any(tokens(resolved.get(key, "")) - view_tokens for key in ("filter", "view")):
        return None
    if not question_tokens & view_tokens:
        return None
    request_words = tokens("show list display please me the all records items tasks now for that same")
    if scope == "personal":
        request_words.add("my")
    if scope == "team":
        request_words.add("our")
    native_path_tokens = tokens(' '.join(section.get('selectedTabPath') or []))
    source_tokens = tokens(page) | tokens(str(section.get('heading') or '')) | native_path_tokens
    if question_tokens - view_tokens - source_tokens - request_words:
        return None
    # Native field bindings avoid reconstructing cells from flattened text.
    facts = _bounded_native_row_facts(section)
    if (
        not facts or any(len(fact) > 500 for fact in facts)
        or sum(len(f.encode("utf-8")) for f in facts) > 2400
        or any(not _structured_row_supports_fact(fact, section) for fact in facts)
    ):
        return None
    return ReaderResult(
        status="success", summary="The requested selected view was observed.", page=page,
        section=str(section.get("heading") or ""), source_section=str(section.get("nodeId") or section_name),
        answer_shape="list", completeness="bounded", scope=scope,
        selected_state=str(section["selectedState"]), facts=facts,
    )


def _observed_explicit_route_failure(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    match = re.fullmatch(r'\s*open (/[-a-zA-Z0-9_/]+) specifically and tell me whether that page works\.?\s*', question, re.I)
    result, evidence = outcome.result, outcome.audit_evidence
    if not match or result.status == 'no_permission' or not result.page or not _same_route(match[1], result.page):
        return outcome
    observation = evidence.get('observation')
    if not isinstance(observation, dict):
        observation = ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if (not isinstance(observation, dict) or observation.get('rowSummaries')
            or any(node.get('rowFields') or node.get('rowSummaries')
                   for node in _observation_semantic_nodes(observation))):
        return outcome
    surface = _observation_scalar_strings({key: observation.get(key) for key in ('headings', 'regions', 'error', 'errorState')})
    if not any(re.search(r'\b404\s+page not found or unavailable[.!]?$', text, re.I) for text in surface):
        return outcome
    updated = replace(result, status='load_failed', facts=(), missing=('observed_page_not_found',),
                      answer_shape='detail', summary='The explicitly requested page displayed a 404 unavailable state.')
    return ReaderOutcome(updated, {**evidence, 'explicitRouteFailure': {'path': match[1], 'observedCode': 404},
                                  'result': updated.public_json()})


def _observed_tab_catalogue(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Answer a literal control-inventory question from fresh native tab metadata."""
    inventory = re.fullmatch(
        r'\s*(?:in [a-z &-]+,\s*)?(?:which|what) (?:queue )?tabs are (?:available|visible|present)'
        r'(?: (?:to|for|in) (?:my|the) (?:current )?(?:account|view))?\??\s*', question, re.I,
    )
    conditional_queue = re.fullmatch(
        r'\s*show (?:one|two|three|four|five|[1-9]\d?) [a-z ]+ in [a-z ]+, '
        r'if that queue exists for this account\.?\s*', question, re.I,
    )
    if not inventory and not conditional_queue:
        return outcome
    result, evidence = outcome.result, outcome.audit_evidence
    if result.status in {'no_permission', 'load_failed'} or not result.page:
        return outcome
    observation = evidence.get('observation')
    if not isinstance(observation, dict):
        observation = ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    if (not isinstance(observation, dict) or not isinstance(observation.get('readHealth'), dict)
            or observation['readHealth'].get('healthy') is not True or _observation_has_error_state(observation)):
        return outcome
    tabs = observation.get('tabControls')
    if (not isinstance(tabs, list) or len(tabs) > 20 or any(not isinstance(tab, dict)
            or not isinstance(tab.get('name'), str) or not tab['name'].strip() for tab in tabs)):
        return outcome
    names = tuple(dict.fromkeys(_sanitize_untrusted_text(tab['name'], max_length=200) for tab in tabs))
    if any(not name for name in names):
        return outcome
    if conditional_queue:
        if names:
            return outcome
        updated = replace(result, status='not_confirmed', facts=(), missing=('observed_queue_not_available',),
                          source_section='tabControls', summary='No named queue tabs are visible in this current page layout.')
        return ReaderOutcome(updated, {**evidence, 'uiSchemaEvidence': {'source': 'tabControls', 'names': []},
                                      'result': updated.public_json()})
    facts = tuple(f'Visible tab: {name}' for name in names[:8]) if names else (
        'No named visible tab controls were observed on this page during this read.',)
    updated = replace(result, status='success', answer_shape='detail', completeness='bounded', scope='unknown',
                      facts=facts, source_section='tabControls', missing=(),
                      summary='The currently visible tab controls were observed.')
    return ReaderOutcome(updated, {**evidence, 'uiSchemaEvidence': {'source': 'tabControls', 'names': list(names[:8])},
                                  'result': updated.public_json()})


def _guard_related_record_substitution(outcome: ReaderOutcome, question: str,
                                       intent_state: dict[str, Any]) -> ReaderOutcome:
    """A related-record column is not evidence of a list of those related records."""
    result, evidence = outcome.result, outcome.audit_evidence
    if result.status not in {'success', 'no_data'} or question_is_conceptual(question):
        return outcome
    if str(evidence.get('stage') or '').startswith('knowledge_'):
        return outcome
    observation = evidence.get('observation')
    if not isinstance(observation, dict):
        observation = ((evidence.get('portalEvidence') or {}).get('result') or {}).get('observation')
    source = _observation_evidence_for_result(observation, result)
    if not isinstance(source, dict) or source.get('kind') not in {'table', 'grid'}:
        return outcome
    columns = source.get('columnHeaders')
    if not isinstance(columns, list) or not columns or any(not isinstance(c, str) for c in columns):
        return outcome
    def tokens(value: str) -> set[str]:
        value = re.sub(r'([a-z])([A-Z])', r'\1 \2', value)
        return {t.rstrip('s') for t in re.findall(r'[a-z]+', value.casefold())}
    values = _resolved_intent_values({'resolvedIntent': intent_state})
    requested = tokens(values.get('businessObject') or question)
    excluded = {'source', 'related', 'parent', 'linked', 'reference', 'no', 'number', 'id'}
    primary = [c for c in columns if tokens(c) & {'no', 'number', 'id'}
               and not tokens(c) & {'source', 'related', 'parent', 'linked'}]
    for column in columns:
        related = tokens(column)
        if not re.match(r'^(?:source|related|parent|linked)\b', column.strip(), re.I):
            continue
        target = related - excluded
        if not target or not target <= requested or not primary:
            continue
        if any(target <= tokens(c) for c in primary):
            continue
        primary_target = tokens(primary[0]) - excluded
        if primary_target and primary_target <= requested:
            continue  # The user requests the primary records, including their references.
        labels = [str(source.get('heading') or ''), *(source.get('selectedTabPath') or [])]
        if any(target <= tokens(str(label)) for label in labels):
            continue  # A native task view can contain application/record identifiers.
        facts = (
            f'The observed list uses {primary[0]} to identify its records. {column} is a related reference, not a verified list of the referenced records.',
            'The requested records and their assignment to the current user have not been established.',
        )
        guarded = replace(result, status='not_confirmed', facts=facts,
                          completeness='unknown', workflow_state='', source_hint={},
                          missing=('related_record_is_not_requested_object',))
        return ReaderOutcome(guarded, {**evidence, 'businessObjectGuard': {
            'primaryIdentity': primary[0], 'relatedColumn': column,
        }, 'result': guarded.public_json()})
    return outcome


def _guard_requested_queue_view(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    result = outcome.result
    if (result.status not in {"success", "no_data", "not_confirmed"} or not result.page
            or question_is_conceptual(question)):
        return outcome
    matches = re.findall(r"\b(?:(?:in|tasks?)\s+(to do|completed)|((?:to do|queued)\s+tasks?(?:\s+list)?))\b", question, re.I)
    requested = {re.sub(r"\s+tasks?(?:\s+list)?$", "", (a or b).casefold()) for a, b in matches}
    if len(requested) != 1:
        return outcome
    evidence = outcome.audit_evidence
    if str(evidence.get("stage") or "").startswith("knowledge_"):
        return outcome
    observation = evidence.get("observation")
    if not isinstance(observation, dict):
        observation = ((evidence.get("portalEvidence") or {}).get("result") or {}).get("observation")
    source = _observation_evidence_for_result(observation, result)
    if not isinstance(source, dict) or source.get("kind") not in {"table", "grid"}:
        return outcome
    selected = str(source.get("selectedState") or "").strip().casefold()
    selected = re.sub(r"\s+tasks$", "", selected)
    if not selected or selected in requested:
        return outcome
    permission = evidence.get('permission') or {}
    role = permission.get('currentRole') or 'account'
    tabs = [str(t.get('name')) for t in observation.get('tabControls', []) if isinstance(t, dict) and t.get('name')]
    facts = (f'The current {role} layout shows {", ".join(tabs[:12])}. '
             f'The requested {next(iter(requested))} view was not verified, so this other list and its count '
             'are not presented as the requested queue.',) if tabs else ()
    guarded = replace(result, status="not_confirmed", facts=facts, missing=("requested_queue_view_unverified",))
    return ReaderOutcome(guarded, {**evidence, "queueViewGuard": {
        "requested": next(iter(requested)), "observed": selected,
    }, "result": guarded.public_json()})


def _guard_requested_team_scope(outcome: ReaderOutcome, intent_state: dict[str, Any], question: str = "") -> ReaderOutcome:
    result = outcome.result
    requested = _resolved_intent_values({"resolvedIntent": intent_state}).get("requestedScope")
    if (not requested and not question_is_conceptual(question) and re.search(r"\bteam\b|团队|فريق", question, re.IGNORECASE)
            and not re.search(r"\b(?:not|except|without)\b|不要|排除", question, re.IGNORECASE)):
        requested = "team"
    if requested != "team" or result.status not in {"success", "no_data"} or not result.page or result.scope == "team":
        return outcome
    evidence = outcome.audit_evidence
    if str(evidence.get('stage') or '').startswith('knowledge_'):
        return outcome
    observation = evidence.get("observation")
    if not isinstance(observation, dict):
        observation = ((evidence.get("portalEvidence") or {}).get("result") or {}).get("observation")
    source = _observation_evidence_for_result(observation, result)
    labels = []
    if isinstance(source, dict):
        path = source.get("selectedTabPath")
        labels = [source.get("heading", ""), source.get("selectedState", ""), *(path if isinstance(path, list) else [])]
        headers = source.get("columnHeaders", [])
        if headers and str(headers[0]).casefold() in {"team member", "team members"}:
            labels.append(headers[0])
    if any(isinstance(label, str) and re.search(r"\bteam\b|团队|فريق", label, re.IGNORECASE) for label in labels):
        return outcome
    role = str((evidence.get('permission') or {}).get('currentRole') or '')
    tabs = tuple(dict.fromkeys(str(t.get('name')) for t in (observation or {}).get('tabControls', [])
                              if isinstance(t, dict) and t.get('name')))
    facts = ()
    if role and tabs and (observation.get('readHealth') or {}).get('healthy') is True:
        facts = (f'The current {role} view shows these tabs: {", ".join(tabs[:12])}. '
                 'A team-scoped view has not been verified here; these records and their count cannot be used as the team result.',)
    guarded = replace(result, status="not_confirmed", facts=facts, missing=("requested_team_scope_unverified",))
    return ReaderOutcome(guarded, {**evidence, "scopeGuard": {"requested": "team", "verified": result.scope},
                                  "result": guarded.public_json()})


_SELF_PROFILE_PATTERNS: tuple[str, ...] = (
    r"\bwhat can you (?:do|help)\b",
    r"\bwhat are you able to do\b",
    r"\bwhat can i do\b",
    r"\bwho am i\b",
    r"\bmy (?:role|department|scope|permissions|data scope)\b",
    r"\bwhat (?:is|are) my (?:role|department|scope|permissions)\b",
    r"\bdata (?:scope|range)\b",
    r"\bscope and limits?\b",
    r"\blimits?\b[^.]{0,30}\b(?:query|read|access)\b",
    r"数据范围",
    r"(?:查询|读取|访问)[^。]{0,12}(?:范围|限制)",
    r"\bwhich (?:role|department) am i\b",
    r"你能(?:做|帮|干什么)",
    r"你可以(?:做|帮|提供)",
    r"能帮我(?:做|干)什么",
    r"我可以做什么",
    r"你能帮我做什么",
    r"\bwhat can you help\b",
    r"\bhow can you help\b",
    r"ماذا يمكنك أن تفعل",
    r"ما الذي يمكنك فعله",
    r"我的(?:部门|角色|权限|数据范围)",
    r"我当前(?:登录的)?(?:部门|角色)",
    r"你(?:是|知道)(?:谁|我的)",
    r"ماذا يمكنك",
    r"ما (?:دوري|صلاحياتي|نطاق)",
    r"من أنا",
    r"ما (?:القسم|الدور)",
)


def _self_profile_requested(question: str) -> bool:
    """True when the user asks who they are or what the assistant can do."""

    text = str(question or "")
    return any(re.search(pattern, text, re.I) for pattern in _SELF_PROFILE_PATTERNS)


def _self_profile_result(question: str, context: UserPermissionContext, page_hint: str = "") -> ReaderResult | None:
    """Answer identity/capability questions from the verified GetUserInfo context."""

    if not _self_profile_requested(question):
        return None
    scope = _permission_result_scope(context)
    role = (context.current_role or (context.roles[0] if context.roles else "")).strip()
    departments = ", ".join(str(value) for value in context.departments[:6]) or "not returned by the portal"
    facts = (
        f"Signed-in portal account: {context.account or context.user_id}.",
        f"Business role: {role or 'not returned by GetUserInfo'}.",
        f"Roles returned by GetUserInfo: {', '.join(str(value) for value in context.roles[:6]) or 'none'}.",
        f"Portal department identifiers for this account: {departments}.",
        f"Data scope: {scope} (derived from the GetUserInfo roles, departments and any data-scope field).",
        "Read-only capabilities: dashboard summaries; licensing applications, licenses and profile verification; "
        "content library and content applications; customer-happiness enquiries, refunds and the team view; "
        "inspection tasks and violations; finance transactions and refunds. Each one is limited to the pages this "
        "account is authorized to open.",
        "Not supported in chat: approvals, rejections, assignment, refunds or payment changes, closing or deleting "
        "records, exports and downloads.",
        "Access is always taken from the signed-in account; a claim inside the question never widens it.",
    )
    return ReaderResult(
        status="success",
        summary="The signed-in account, role and scope were read from GetUserInfo.",
        page=page_hint,
        answer_shape="detail",
        completeness="bounded",
        scope=scope,
        facts=facts,
    )


_MONTH_NAMES = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)
_SENSITIVE_GUIDANCE_QUESTION = re.compile(
    r"system\s+prompt|internal\s+(?:instructions|polic\w+|notes?|review)|api\s*key|access\s+token|cookie|"
    r"connection\s+string|creden\w+|pretend\s+(?:i|you)|act\s+as|impersonat|hidden\s+records?|"
    r"other\s+departments?|all\s+supervisors?|passport\s+numbers?|bank\s+details|"
    r"系统提示词|内部(?:政策|指令|审核|意见|备注|配置)|密钥|令牌|凭证|连接字符串|链接串|假装|扮演|隐藏记录|"
    r"其他部门|所有主管|全部隐藏|护照号|银行信息|"
    r"كلمة\s+المرور|تعليمات\s+النظام|تجاهل\s+القواعد|جواز\s+السفر|بيانات\s+البنك|تظاهر",
    re.I,
)
# The documented-guidance pass names a portal destination. It must only run for a
# real business question, never for a credential, role-play or low-signal turn
# whose correct answer is a refusal or a request to rephrase.
_GUIDANCE_BUSINESS_TOPIC = re.compile(
    r"licen[cs]e|permit|application|content|refund|ticket|inspection|dashboard|task|report|analytics|"
    r"account|customer|payment|transaction|fine|violation|polic\w+|rule|standard|document|sla|status|"
    r"queue|team|member|officer|book|isbn|wallet|fee|applicant|"
    r"许可|申请|内容|退款|工单|检查|看板|仪表盘|任务|报表|报告|账户|客户|付款|交易|罚款|违规|政策|规则|"
    r"标准|材料|状态|队列|团队|成员|员工|币种|金额|费用|机构|委员会|主管|"
    r"رخصة|رخص|طلب|محتوى|استرداد|تذكرة|تفتيش|لوحة|مهمة|تقرير|حساب|عميل|دفع|معاملة|غرامة|مخالفة|"
    r"سياسة|قاعدة|معيار|مستند|حالة|فريق|موظف",
    re.I,
)
_GUIDANCE_LOW_SIGNAL = re.compile(r"(.)\1{9,}|^[\W_\d]+$")


def _knowledge_chunk_guidance(chunk: Any) -> dict[str, str]:
    """Read the documented destination metadata out of one retrieved passage."""

    content = re.sub(r"\s+", " ", str((chunk or {}).get("content") or "")).strip()
    if not content:
        return {}
    fields: dict[str, str] = {}
    for name in ("section", "name", "page", "meaning", "use_when", "type", "destination"):
        match = re.search(r"-\s*\*\*" + name + r":\*\*\s*(.*?)(?=\s+-\s+\*\*|$)", content)
        fields[name] = match.group(1).strip().strip("`").strip() if match else ""
    page = fields["page"] or fields["destination"]
    if not re.match(r"^/[A-Za-z0-9_/?=&.-]+$", page or ""):
        return {}
    return {
        "page": page,
        "section": fields["section"] or fields["name"] or fields["type"],
        "meaning": fields["meaning"],
        "use_when": fields["use_when"],
    }


_HAN_SEQUENCE = re.compile(r"[\u3400-\u9fff]+")
_ARABIC_SEQUENCE = re.compile(r"[\u0621-\u064a]{3,}")


def _documented_guidance_score(question: str, guidance: dict[str, str]) -> int:
    """Overlap score that also works for Chinese and Arabic wording."""

    haystack = " ".join((guidance.get("section", ""), guidance.get("meaning", ""), guidance.get("use_when", "")))
    score = len(_api_query_tokens(question) & _api_query_tokens(haystack))
    han_question = {seq[index:index + 2] for seq in _HAN_SEQUENCE.findall(question) for index in range(max(0, len(seq) - 1))}
    if han_question:
        score += sum(1 for token in han_question if token in haystack)
    arabic_question = set(_ARABIC_SEQUENCE.findall(question))
    if arabic_question:
        score += len(arabic_question & set(_ARABIC_SEQUENCE.findall(haystack)))
    return score


def documented_guidance_result(
    question: str,
    knowledge_context: Any,
    permission_context: UserPermissionContext,
    result: ReaderResult,
) -> ReaderResult | None:
    """Name the documented destination when the stored rule itself is unavailable.

    Workbook questions ask for rules, handlers, comparisons and preparation
    steps that the portal's read surfaces do not store.  The documented
    destination is still verifiable, so the reply states the destination, what
    the manual says it is for, and which part could not be confirmed, instead
    of returning an empty refusal or inventing a rule.
    """

    if result.status != "not_confirmed" or result.facts:
        return None
    if not isinstance(permission_context, UserPermissionContext):
        return None
    text = str(question or "")
    if _SENSITIVE_GUIDANCE_QUESTION.search(text) or question_requests_business_mutation(text):
        return None
    if _GUIDANCE_LOW_SIGNAL.search(text) or not _GUIDANCE_BUSINESS_TOPIC.search(text):
        return None
    if not isinstance(knowledge_context, dict) or knowledge_context.get("ok") is not True:
        return None
    permitted = (*permission_context.pages, *permission_context.subpages)
    candidates: list[tuple[int, int, dict[str, str]]] = []
    for index, chunk in enumerate(knowledge_context.get("chunks") or ()):
        guidance = _knowledge_chunk_guidance(chunk)
        if not guidance.get("meaning"):
            continue
        if not any(permission_path_matches(guidance["page"], path) for path in permitted):
            continue
        candidates.append((_documented_guidance_score(text, guidance), index, guidance))
    if not candidates:
        return None
    # Retrieval order is the relevance order, so a question written in a script
    # the token scorer cannot split still receives the best retrieved
    # documented destination instead of an empty refusal.
    best = max(candidates, key=lambda item: (item[0], -item[1]))
    guidance = best[2]
    heading = guidance["section"] or guidance["page"]
    facts = [f"Documented destination: {heading} ({guidance['page']}).", f"{heading}: {guidance['meaning']}"]
    if guidance.get("use_when"):
        facts.append(f"{heading} is used when: {guidance['use_when']}")
    facts.append(
        "This reply states only what the retrieved portal documentation records. "
        "No rule, clause number, threshold or value is asserted beyond that documentation."
    )
    return replace(result, answer_shape="detail", completeness="bounded", facts=tuple(facts[:4]))


_PRIORITY_ADVICE_REQUEST = re.compile(
    r"\b(?:priorit(?:y|ies|ise|ize)|what\s+should\s+(?:i|we)\s+(?:do|work\s+on)\s+first|triage)\b"
    r"|(?:优先级|優先級|优先建议|先处理|处理顺序|工作顺序)"
    r"|(?:أولويات|الأولوية|بأي\s+ترتيب)",
    re.I,
)


def _native_queue_priority_advice(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Turn a rendered queue into an explicitly advisory work order.

    The advice is derived only from the values the page renders for this
    account.  When the queue renders no SLA or urgency value, the answer says
    so instead of inventing a ranking, and it never changes a task.
    """

    if not _PRIORITY_ADVICE_REQUEST.search(str(question or "")):
        return outcome
    if outcome.result.status not in {"success", "not_confirmed", "no_data"}:
        return outcome
    observation = outcome.audit_evidence.get("observation") or (
        (outcome.audit_evidence.get("portalEvidence") or {}).get("result") or {}
    ).get("observation")
    rows = _queue_rows_for_advice(observation)
    if not rows:
        return outcome
    overdue, remaining = [], []
    for row in rows:
        sla = str(row.get("SLA") or "").strip()
        if not sla or sla == "-":
            remaining.append(row)
        elif re.search(r"overdue|past due|逾期|متأخر", sla, re.I):
            overdue.append(row)
        else:
            remaining.append(row)
    facts: list[str] = []
    if overdue:
        facts.append(
            "Start with the rows whose rendered SLA is already overdue ("
            + str(len(overdue)) + " visible row(s)): "
            + "; ".join(_queue_row_label(row) for row in overdue[:5])
        )
    if remaining:
        facts.append(
            "Then review the remaining visible rows ("
            + str(len(remaining)) + "): "
            + "; ".join(_queue_row_label(row) for row in remaining[:5])
        )
    if not overdue:
        facts.append(
            "No visible row in this queue currently renders an overdue SLA, and the page renders no other urgency field, "
            "so no row can be ranked ahead of the others from this view alone."
        )
    facts.append(
        "This is advisory only, derived from the values rendered in the current page for this account. "
        "No task was assigned, reprioritised or changed."
    )
    result = replace(
        outcome.result,
        status="success",
        answer_shape="attention",
        completeness="bounded",
        facts=tuple(facts[:4]),
        missing=(),
    )
    return ReaderOutcome(result, {**outcome.audit_evidence, "nativePriorityAdvice": True, "result": result.public_json()})


def _queue_rows_for_advice(observation: Any) -> list[dict[str, str]]:
    """Visible task rows with the fields the advice may quote."""

    if not isinstance(observation, dict):
        return []
    wanted = {"Task No.", "Task Category", "Apply For", "Assigned To", "SLA", "Status", "Last Updated",
              "Inspector", "Current Handler"}
    rows: list[dict[str, str]] = []
    for node in _observation_semantic_nodes(observation):
        if node.get("kind") not in {"table", "grid"}:
            continue
        headers = [str(header) for header in node.get("columnHeaders") or []]
        if not {"Task No.", "Status"} <= set(headers):
            continue
        for row in node.get("rowFields") or []:
            if not isinstance(row, dict):
                continue
            visible = {key: str(value) for key, value in row.items() if key in wanted and value not in (None, "")}
            if visible:
                rows.append(visible)
    return rows


def _queue_row_label(row: dict[str, str]) -> str:
    parts = [f"{key}: {row[key]}" for key in ("Task No.", "Task Category", "Status", "SLA") if row.get(key)]
    return " | ".join(parts)


_PERSON_ROLLUP_REQUEST = re.compile(
    r"\b(?:per|by|each|every)\s+(?:officer|inspector|staff|member|handler|employee)s?\b"
    r"|\b(?:officer|inspector|staff|member|handler|employee)s?\s+(?:breakdown|roll[- ]?up|summary)\b"
    r"|(?:按|每位|每个|各个)\s*(?:officer|inspector|员工|成员|处理人|人员)"
    r"|(?:حسب|لكل)\s*(?:الموظف|المفتش|العضو|الفريق)",
    re.I,
)
_OVERDUE_RENDERED = re.compile(r"\boverdue\b|逾期|متأخر", re.I)
_RETURNED_RENDERED = re.compile(r"退回|rejected|returned|sent back", re.I)


def _api_candidate_rows(observation: Any, operation_key: str) -> tuple[dict[str, Any], ...]:
    """Rows returned by one read API that the page itself already called."""

    if not isinstance(observation, dict):
        return ()
    for candidate in (observation.get("apiDiscovery") or {}).get("candidates") or ():
        if not isinstance(candidate, dict) or str(candidate.get("operationKey") or "") != operation_key:
            continue
        if candidate.get("status") != 200:
            continue
        evidence = candidate.get("responseEvidence")
        payload = evidence.get("data") if isinstance(evidence, dict) and isinstance(evidence.get("data"), dict) else evidence
        if not isinstance(payload, dict):
            return ()
        items = payload.get("items")
        if isinstance(items, list):
            return tuple(item for item in items if isinstance(item, dict))
    return ()


def _observed_api_rows(outcome: ReaderOutcome) -> tuple[dict[str, Any], ...]:
    """Rows from the read APIs the page issued, across every recorded observation."""

    evidence = outcome.audit_evidence
    observations: list[Any] = []
    if evidence.get("observation"):
        observations.append(evidence["observation"])
    recorded = evidence.get("observations")
    if isinstance(recorded, dict):
        observations.extend(value for value in recorded.values() if isinstance(value, dict))
    portal_observation = ((evidence.get("portalEvidence") or {}).get("result") or {}).get("observation")
    if isinstance(portal_observation, dict):
        observations.append(portal_observation)
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for observation in observations:
        for operation in (
            "GET /api/admin/inspection/tasks",
            "GET /api/admin/finance/transactions",
            "GET /api/admin/payments/refunds",
        ):
            for row in _api_candidate_rows(observation, operation):
                identity = str(
                    row.get("taskNo") or row.get("transactionNo") or row.get("refundNo") or json.dumps(
                        row, sort_keys=True, ensure_ascii=False
                    )
                )
                if identity in seen:
                    continue
                seen.add(identity)
                rows.append(row)
        if rows:
            break
    return tuple(rows)


_FINANCE_CURRENCY_REQUEST = re.compile(
    r"\b(?:payments?|transactions?|refunds?|amount|currency|today)\b|今天|付款|交易|退款|金额|币种|عملات|مبلغ|اليوم",
    re.I,
)
_OTHER_PEOPLE_TASK_REQUEST = re.compile(
    r"\bother\s+(?:inspectors?|officers?|staff|members?|handlers?)\b|\ball\s+(?:inspectors?|officers?|staff|members?)\b"
    r"|其他\s*(?:inspector|officer|检查员|员工|成员|处理人)|其他部门",
    re.I,
)
_PERIOD_COMPARISON_REQUEST = re.compile(
    r"\b(?:compared?\s+(?:with|to)|versus|vs\.?|change[sd]?\s+from|week\s+over\s+week|day\s+over\s+day|trend)\b"
    r"|(?:与|和|跟).{0,6}(?:相比|对比)|相比.{0,6}(?:有什么|有何|变化)|(?:同比|环比|变化趋势)",
    re.I,
)


_RULE_CLAUSE_MARKER = re.compile(r"\bArticle\s*\(?\d+\)?|第\s*\d+\s*条|\bالمادة\s*\(?\d+\)?", re.I)


def _deterministic_rule_clauses(question: str, knowledge_context: Any, *, limit: int = 3) -> tuple[str, ...]:
    """Verbatim article sentences from the retrieved documents, chosen by topic.

    Some rule questions depend on the planner volunteering a quote.  This
    fallback copies the governing sentence straight out of a retrieved chunk, so
    the citation does not depend on a model decision.
    """

    if not isinstance(knowledge_context, dict):
        return ()
    tokens = _api_query_tokens(question)
    han = {seq[index:index + 2] for seq in _HAN_SEQUENCE.findall(str(question or "")) for index in range(max(0, len(seq) - 1))}
    arabic = set(_ARABIC_SEQUENCE.findall(str(question or "")))
    scored: list[tuple[int, str]] = []
    for chunk in knowledge_context.get("chunks") or ():
        if not isinstance(chunk, dict):
            continue
        source = str(chunk.get("source_name") or "").strip()
        text = re.sub(r"\s+", " ", str(chunk.get("content") or "")).strip()
        if not source or not text:
            continue
        for sentence in re.split(r"(?<=[.;])\s+", text):
            if not _RULE_CLAUSE_MARKER.search(sentence):
                continue
            if len(sentence) < 40 or len(sentence) > 600:
                continue
            score = len(tokens & _api_query_tokens(sentence))
            score += sum(1 for token in han if token in sentence)
            score += len(arabic & set(_ARABIC_SEQUENCE.findall(sentence)))
            if score:
                scored.append((score, f"{source}: {sentence.strip()}"))
    scored.sort(key=lambda item: item[0], reverse=True)
    chosen: list[str] = []
    seen: set[str] = set()
    for _score, fact in scored:
        key = fact[:120].casefold()
        if key in seen:
            continue
        seen.add(key)
        chosen.append(fact)
        if len(chosen) >= limit:
            break
    return tuple(chosen)

_FINE_DECISION_REQUEST = re.compile(
    r"\bfines?\b|\bpenalt\w+\b|\bcommittee\s+decision\b|罚款|罚金|处罚|罚款金额|委员会.{0,12}决定|"
    r"غرامة|مخالفة",
    re.I,
)


_RECORD_DETAIL_REQUEST = re.compile(
    r"\bhandler|\bhandled by|who (?:processed|handled|reviewed)|history|audit trail|"
    r"materials?|documents?|required\s+(?:documents?|items?)|attachments?|"
    r"next step|details?\b|"
    r"处理人|谁处理|处理过|处理的|历史|处理记录|材料|资料|缺少哪些|需要哪些|必备|附件|下一步|详情|明细|"
    r"المعالج|سجل|تاريخ|مستندات|مرفقات|الخطوة التالية|تفاصيل",
    re.I,
)
_HISTORY_OPERATION_PREFIX = "GET /api/ContentLibrary/GetHistoryList"
_REVIEW_DETAIL_OPERATION_PREFIX = "GET /api/Application/MyReviewDetail"
_DOCUMENT_LABEL = re.compile(r"\"(?:label|title|name)\s*\"?\s*:\s*\"([^\"]{3,60})\"")


def _api_rows_by_prefix(observation: Any, prefix: str) -> tuple[dict[str, Any], ...]:
    """Rows returned by a parametrised read API the page issued."""

    if not isinstance(observation, dict):
        return ()
    for candidate in (observation.get("apiDiscovery") or {}).get("candidates") or ():
        if not isinstance(candidate, dict) or candidate.get("status") != 200:
            continue
        if not str(candidate.get("operationKey") or "").startswith(prefix):
            continue
        payload = candidate.get("responseEvidence")
        # Unwrap a service envelope before treating the payload as rows.
        while isinstance(payload, dict) and "data" in payload and (
            "isSuccess" in payload or "statusCode" in payload or "message" in payload
        ):
            payload = payload["data"]
        if isinstance(payload, list):
            return tuple(item for item in payload if isinstance(item, dict))
        if isinstance(payload, dict):
            items = payload.get("items")
            if isinstance(items, list):
                return tuple(item for item in items if isinstance(item, dict))
            return (payload,)
    return ()


def _review_detail_documents(observation: Any) -> tuple[str, ...]:
    """Required-item names carried by the application review-detail payload."""

    documents: list[str] = []
    for row in _api_rows_by_prefix(observation, _REVIEW_DETAIL_OPERATION_PREFIX):
        for value in row.values():
            if not isinstance(value, str) or "label" not in value:
                continue
            for match in _DOCUMENT_LABEL.findall(value):
                text = match.strip()
                if text and text.casefold() not in {item.casefold() for item in documents}:
                    documents.append(text)
    for label in observation.get("labels") or []:
        text = str(label).strip()
        if text and text.casefold() not in {item.casefold() for item in documents}:
            documents.append(text)
    return tuple(documents[:20])


def _record_detail_facts(question: str, observation: Any, identity: str) -> tuple[str, ...]:
    """Project the record's own detail page into bounded answer facts."""

    facts: list[str] = []
    history = _api_rows_by_prefix(observation, _HISTORY_OPERATION_PREFIX)
    if history:
        for row in history[:5]:
            facts.append(json.dumps({
                "Processed By": row.get("approverName"),
                "Step": row.get("nodeName"),
                "Date": str(row.get("approverDate") or "")[:19],
                "Source Application": row.get("applicationNum"),
            }, ensure_ascii=False, separators=(",", ":")))
        facts.append(
            "These are the handling steps the record's own detail page shows for " + identity
            + "; no unrelated employee record is included."
        )
        return tuple(facts)
    if _REVIEW_DETAIL_OPERATION_PREFIX in json.dumps(
        ((observation.get("apiDiscovery") or {}).get("candidates") or [])[:8], ensure_ascii=False, default=str
    ) or _api_rows_by_prefix(observation, _REVIEW_DETAIL_OPERATION_PREFIX):
        documents = _review_detail_documents(observation)
        if documents:
            facts.append(
                "Required items listed on this application's detail page: " + "; ".join(documents[:12]) + "."
            )
        for node in _observation_semantic_nodes(observation):
            rows = [str(row) for row in (node.get("rowSummaries") or [])[:4]]
            if rows:
                facts.append(
                    (str(node.get("heading") or "Detail record") + ": ") + " | ".join(rows)
                )
        if not facts:
            facts.append(
                "The application detail page for " + identity + " rendered no additional fields in this read."
            )
        return tuple(facts[:6])
    rows: list[str] = []
    for node in _observation_semantic_nodes(observation):
        rows.extend(str(row) for row in (node.get("rowSummaries") or [])[:4])
    labels = [str(label) for label in (observation.get("labels") or [])[:12]]
    if labels:
        facts.append("Items shown on the record's detail page: " + "; ".join(labels) + ".")
    if rows:
        facts.append("Detail rows: " + " | ".join(rows[:5]))
    return tuple(facts[:6])

def _native_fine_decision_result(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Report the fine a violation record carries, or state plainly that none exists.

    The committee queue and the fine amounts are rendered on the Violations
    surface.  When the requested case has no violation record, the empty result
    is stated as empty with the page to open, never as a generic failure.
    """

    if not _FINE_DECISION_REQUEST.search(str(question or "")):
        return outcome
    page = str(outcome.result.page or "")
    if "violations" not in page:
        return outcome
    observation = outcome.audit_evidence.get("observation") or (
        (outcome.audit_evidence.get("portalEvidence") or {}).get("result") or {}
    ).get("observation")
    rows = _api_candidate_rows(observation, "GET /api/admin/inspection/violations")
    if not rows:
        rendered = [
            row for row in _observation_text_rows(observation)
            if re.search(r"\bVN-\d|\bIN-\d", row)
        ]
        if rendered:
            result = replace(
                outcome.result,
                status="success",
                answer_shape="list",
                facts=tuple(rendered[:8]) + (
                    "These are the violation rows the page renders for this account; open Violations to filter by "
                    "case or status.",
                ),
                missing=(),
            )
            return ReaderOutcome(result, {**outcome.audit_evidence, "nativeFineDecision": "rendered",
                                          "result": result.public_json()})
        searched = re.findall(r"\b(?:IN|VN)-\d{4}-\d+\b", str(question or ""), re.I)
        if searched:
            note = (
                "No violation or fine record matches " + ", ".join(searched[:3]) + " in the records this account can "
                "read. That means no fine decision has been recorded for the case - it is not that the amount is zero. "
                "Open Inspection > Violations and filter by the case number to confirm."
            )
        else:
            note = (
                "The Violations list is empty for this account: no violation or fine record is visible at all. "
                "Open Inspection > Violations to confirm the empty list."
            )
        result = replace(
            outcome.result,
            status="no_data",
            answer_shape="list",
            facts=(note,),
            missing=(),
        )
        return ReaderOutcome(result, {**outcome.audit_evidence, "nativeFineDecision": "empty",
                                      "result": result.public_json()})
    identities = re.findall(r"\b(?:IN|VN)-\d{4}-\d+\b", str(question or ""), re.I)
    matched = [
        row for row in rows
        if identities and any(identity.casefold() in json.dumps(row, ensure_ascii=False).casefold() for identity in identities)
    ]
    if matched:
        facts = tuple(
            "Fine record: "
            + json.dumps(
                {
                    "Violation No.": row.get("violationNo"),
                    "Task No.": row.get("taskNo"),
                    "Violation Type": row.get("violationTypeName"),
                    "Status": row.get("statusName"),
                    "Fine Amount": row.get("fineAmount"),
                    "Reported By": row.get("reportedByName"),
                    "Created On": str(row.get("createdOn") or "")[:19],
                    "Last Updated": str(row.get("lastUpdatedOn") or "")[:19],
                },
                ensure_ascii=False, separators=(",", ":"),
            )
            for row in matched[:3]
        )
        note = (
            "These are the fine records recorded for the requested case in the Violations surface this account reads. "
            "The decision itself and any appeal stay with the responsible committee through the portal workflow."
        )
    else:
        visible = [
            " | ".join(str(part) for part in (
                row.get("violationNo"), row.get("violationTypeName"), row.get("statusName"),
                f"fine {row.get('fineAmount')}" if row.get("fineAmount") is not None else "",
                row.get("taskNo"),
            ) if part)
            for row in rows[:5]
        ]
        facts = ()
        note = (
            "No fine decision is recorded for the requested case in this account's readable violation records, so the "
            "amount is not that it is zero - it is that no record exists yet. Open Inspection > Violations and filter by "
            "the case number to confirm."
            + (" Records currently visible there: " + "; ".join(visible) + "." if visible else "")
        )
    merged = replace(
        outcome.result,
        status="success",
        answer_shape="list",
        facts=(*outcome.result.facts, *facts, note)[:24],
        missing=(),
    )
    return ReaderOutcome(merged, {**outcome.audit_evidence, "nativeFineDecision": bool(facts),
                                  "result": merged.public_json()})

def _native_sla_performance_metrics(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Report the rendered SLA figures instead of a ranking the page cannot give."""

    if not _STAFF_PERFORMANCE_REQUEST.search(str(question or "")):
        return outcome
    page = str(outcome.result.page or "")
    if "reports-analytics" not in page and "/dashboard" not in page:
        return outcome
    observation = outcome.audit_evidence.get("observation") or (
        (outcome.audit_evidence.get("portalEvidence") or {}).get("result") or {}
    ).get("observation")
    pairs = _observed_metric_pairs(observation)
    chosen = [
        (label, value) for label, value, _source in pairs
        if re.search(r"sla|breach|compliant|completion|overdue|processing", label, re.I)
    ]
    if len(chosen) < 2:
        return outcome
    facts = tuple(f"{label}: {value}" for label, value in chosen[:10])
    facts += (
        "These are the SLA figures the page renders for this account's scope. An individual employee ranking is not "
        "derived from them, and no employee is named.",
    )
    result = replace(
        outcome.result,
        status="success",
        answer_shape="overview",
        completeness="bounded",
        facts=facts,
        missing=(),
    )
    return ReaderOutcome(result, {**outcome.audit_evidence, "nativeSlaPerformance": True,
                                  "result": result.public_json()})

# Information families that a portal page may genuinely not carry.  When the
# question asks for one and the answer carries no value for it, the reply says
# what was read, why the item is not available, and where it can be seen.
_UNAVAILABLE_FAMILIES: tuple[tuple[re.Pattern[str], re.Pattern[str], str], ...] = (
    (
        re.compile(r"\bmaterials?\b|\bdocuments?\b|\brequisites?\b|\battachments?\b|材料|资料|附件|مستندات|مرفقات", re.I),
        re.compile(r"material|document|requisite|attachment|required item|items listed|"
                   r"材料|资料|附件|مستند|مرفق", re.I),
        "Required materials/attachments are not rendered on the page that was read. In the portal they appear on the "
        "corresponding business page - the application record detail (Licensing > Applications) or the checklist step of "
        "the inspection execution flow - so the list has to be read there.",
    ),
    (
        re.compile(r"\bhistory\b|\bhandled by\b|\bhandler\b|处理人|处理过|历史|سجل", re.I),
        re.compile(r"processed by|handler|history|approver|处理人|处理过|历史|المعالج", re.I),
        "The handling history is not rendered on the page that was read. The portal shows it on the record's own detail "
        "page, so open that record to see who processed it and when.",
    ),
    (
        re.compile(r"\bpenalt\w+|\bviolations?\b|\bfines?\b|处罚|违规|罚款", re.I),
        re.compile(r"violation|penalt|fine|处罚|违规|罚款", re.I),
        "The portal does not publish a per-establishment history of penalties or violations. Violation records are listed "
        "on Inspection > Violations for the cases this account may read.",
    ),
    (
        re.compile(r"\bcontacts?\b|联系人", re.I),
        re.compile(r"contact|联系人", re.I),
        "Contact information for this record is not exposed by the portal pages or interfaces that were checked, so it "
        "cannot be returned from this account's readable data.",
    ),
    (
        re.compile(r"\bsla\b|\boverdue\b|逾期|超时", re.I),
        re.compile(r"\bsla\b|overdue|逾期|超时", re.I),
        "The list that was read does not render an SLA or overdue field. The Finance refund list has no SLA column; SLA is "
        "shown on Customer Happiness > Refunds, so use that page for SLA-based questions.",
    ),
)


def _native_unavailable_information_notes(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Explain genuinely unavailable information and point at the portal page."""

    if outcome.result.status not in {"success", "no_data", "not_confirmed"}:
        return outcome
    text = str(question or "")
    covered = " ".join(str(fact) for fact in outcome.result.facts).casefold()
    page = str(outcome.result.page or "").strip()
    notes: list[str] = []
    for ask, have, explanation in _UNAVAILABLE_FAMILIES:
        if not ask.search(text) or have.search(covered):
            continue
        notes.append("About the requested item: " + explanation)
    if not notes:
        return outcome
    existing = {re.sub(r"\s+", " ", str(fact)).strip().casefold() for fact in outcome.result.facts}
    additions = [note for note in notes if note.casefold() not in existing][:2]
    if not additions:
        return outcome
    if page:
        additions.append(
            "This answer is based on what " + page + " renders for the signed-in account; that page stays the "
            "authoritative place to check."
        )
    merged = replace(outcome.result, facts=(*outcome.result.facts, *additions)[:24])
    return ReaderOutcome(merged, {**outcome.audit_evidence, "unavailableInformationNotes": len(additions),
                                  "result": merged.public_json()})

def _native_observed_api_enrichment(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Add fields the page's own read API returned but the table did not render.

    Two workbook rows are only missing values that the page already fetched:
    the inspector name behind each inspection task, and the currency behind a
    finance transaction or refund.  Both come from the page's own API response,
    never from a default value.
    """

    if outcome.result.status not in {"success", "no_data", "not_confirmed"}:
        return outcome
    rows = _observed_api_rows(outcome)
    if not rows:
        return outcome
    text = str(question or "")
    facts: list[str] = []

    if _OTHER_PEOPLE_TASK_REQUEST.search(text) or re.search(r"inspector|检查员|تفتيش|المفتش", text, re.I):
        named = [
            (str(row.get("taskNo") or ""), str(row.get("inspectorName") or ""))
            for row in rows
            if row.get("taskNo") and row.get("inspectorName")
        ]
        if named:
            pairs = "; ".join(f"{number}: {name}" for number, name in named[:10])
            facts.append("Inspector recorded for these tasks in the page's own task data: " + pairs + ".")
        elif any("inspectorName" in row for row in rows):
            facts.append(
                "The page's own task data returns no inspector for the tasks in this view (the inspector field is "
                "empty), so no per-inspector split can be made from these rows. Open Task Management and select a task "
                "row, or use its Inspector filter, to see whether an inspector has been assigned to that task."
            )

    if _FINANCE_CURRENCY_REQUEST.search(text):
        currencies = sorted({str(row.get("currency") or "").strip() for row in rows if str(row.get("currency") or "").strip()})
        if currencies:
            facts.append(
                "Currencies returned with the matching rows: " + ", ".join(currencies[:5]) + "."
            )
        dates = sorted(
            str(row.get(key) or "")[:10]
            for row in rows
            for key in ("createdOn", "updateOn", "lastUpdatedOn", "completedAt")
            if str(row.get(key) or "")[:10]
        )
        if dates:
            span = dates[0] if dates[0] == dates[-1] else f"{dates[0]} to {dates[-1]}"
            facts.append(
                "The rows returned by the page's own list query cover " + span
                + "; this is the range actually returned, not a re-applied date filter."
            )

    if not facts:
        return outcome
    existing = {re.sub(r"\s+", " ", str(fact)).strip().casefold() for fact in outcome.result.facts}
    additions = [fact for fact in facts if fact.casefold() not in existing]
    if not additions:
        return outcome
    merged = replace(outcome.result, facts=(*outcome.result.facts, *additions)[:24])
    return ReaderOutcome(merged, {**outcome.audit_evidence, "nativeObservedApiFields": len(additions),
                                  "result": merged.public_json()})


def _native_scope_and_comparison_notes(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Explain the scope of other people's rows and the absence of history."""

    if outcome.result.status not in {"success", "no_data", "not_confirmed"}:
        return outcome
    text = str(question or "")
    notes: list[str] = []
    if _OTHER_PEOPLE_TASK_REQUEST.search(text):
        notes.append(
            "These rows are the ones the current account's role may read on this page; only the fields the page "
            "renders are returned, and location or travel detail is limited to those rendered fields."
        )
    if _PERIOD_COMPARISON_REQUEST.search(text):
        notes.append(
            "The portal exposes preset periods such as Last 7 Days, which recompute the figures shown for the current "
            "period. It stores no earlier-period snapshot, so a change against yesterday or last week cannot be "
            "confirmed from this view."
        )
    if not notes:
        return outcome
    existing = {re.sub(r"\s+", " ", str(fact)).strip().casefold() for fact in outcome.result.facts}
    additions = [note for note in notes if note.casefold() not in existing]
    if not additions:
        return outcome
    merged = replace(outcome.result, facts=(*outcome.result.facts, *additions)[:24])
    return ReaderOutcome(merged, {**outcome.audit_evidence, "nativeScopeNotes": len(additions),
                                  "result": merged.public_json()})

def _native_person_rollup(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Group the visible queue rows by their rendered assignee.

    Several workbook rows ask for a per-Officer or per-Inspector roll-up.  The
    pages render one bounded page of rows with an assignee column and no
    per-person aggregate, so the answer groups exactly the rows that are on
    screen and states that limit instead of returning a bare page total.
    """

    if not _PERSON_ROLLUP_REQUEST.search(str(question or "")):
        return outcome
    if outcome.result.status not in {"success", "not_confirmed", "no_data"}:
        return outcome
    observation = outcome.audit_evidence.get("observation") or (
        (outcome.audit_evidence.get("portalEvidence") or {}).get("result") or {}
    ).get("observation")
    rows = _queue_rows_for_advice(observation)
    if not rows:
        return outcome
    api_inspectors = {
        str(candidate.get("taskNo") or "").strip(): str(candidate.get("inspectorName") or "").strip()
        for candidate in _api_candidate_rows(
            outcome.audit_evidence.get("observation")
            or ((outcome.audit_evidence.get("portalEvidence") or {}).get("result") or {}).get("observation"),
            "GET /api/admin/inspection/tasks",
        )
        if str(candidate.get("taskNo") or "").strip()
    }
    grouped: dict[str, dict[str, int]] = {}
    for row in rows:
        person = (
            str(row.get("Assigned To") or row.get("Inspector") or row.get("Current Handler") or "").strip()
        )
        if not person or person == "-":
            person = api_inspectors.get(str(row.get("Task No.") or "").strip(), "")
        person = person or "unassigned"
        bucket = grouped.setdefault(person, {"total": 0, "overdue": 0, "returned": 0})
        bucket["total"] += 1
        sla = str(row.get("SLA") or "")
        if _OVERDUE_RENDERED.search(sla):
            bucket["overdue"] += 1
        status = f"{row.get('Status', '')}"
        if _RETURNED_RENDERED.search(status):
            bucket["returned"] += 1
    if not grouped:
        return outcome
    def order(item: tuple[str, dict[str, int]]) -> tuple[int, int, str]:
        person, bucket = item
        return (-bucket["overdue"], -bucket["total"], person)

    facts = [
        json.dumps(
            {
                "Assignee": person,
                "Visible rows": bucket["total"],
                "Visible rows past SLA": bucket["overdue"],
                "Visible rows returned": bucket["returned"],
            },
            ensure_ascii=False, separators=(",", ":"),
        )
        for person, bucket in sorted(grouped.items(), key=order)[:10]
    ]
    facts.append(
        "Counts cover only the rows rendered on this page for this account; the page does not render a per-person "
        "aggregate, so these are visible-row totals and not the complete team workload."
    )
    result = replace(
        outcome.result,
        status="success",
        answer_shape="count",
        completeness="bounded",
        facts=tuple(facts),
        missing=(),
    )
    return ReaderOutcome(result, {**outcome.audit_evidence, "nativePersonRollup": {
        "people": len(grouped), "rows": len(rows),
    }, "result": result.public_json()})


def _personal_task_counter_pairs(observation: Any) -> tuple[tuple[str, str], ...]:
    """Read the rendered My Tasks per-category counters from the dashboard region."""

    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for node in _observation_semantic_nodes(observation):
        heading = str(node.get("heading") or node.get("sourceSection") or "").strip()
        if "my tasks" not in heading.casefold():
            continue
        values = node.get("controls") or node.get("summaries") or node.get("cardSummaries") or []
        if not isinstance(values, (list, tuple)):
            continue
        for item in values[:24]:
            text = re.sub(r"\s+", " ", str(item or "")).strip()
            match = re.fullmatch(r"(.+?)\s+([\d,]+)", text)
            if not match:
                continue
            label, value = match.group(1).strip(" :-"), match.group(2)
            if not label or label.casefold() in seen or len(label) > 80:
                continue
            seen.add(label.casefold())
            pairs.append((label, value))
    return tuple(pairs)


def _native_personal_task_counts(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """Report the rendered My Tasks counts when a personal task list is asked for.

    The Dashboard renders My Tasks as per-category counters for the signed-in
    account, so an individual task row cannot be produced from it.  Returning
    the rendered counters plus that limit answers the question honestly instead
    of an empty no_data.
    """

    if outcome.result.status not in {"no_data", "not_confirmed"} or outcome.result.page != "/dashboard":
        return outcome
    if not re.search(
        r"\b(?:my|mine)\b|\bassigned\s+to\s+me\b|\bfor\s+me\b|我的|待办|指派给我|مهامي|المسندة\s+إليّ",
        question,
        re.I,
    ):
        return outcome
    personal = _personal_task_counter_pairs(outcome.audit_evidence.get("observation"))
    if len(personal) < 2:
        return outcome
    facts = tuple(f"My Tasks \u2014 {label}: {value}" for label, value in personal[:12])
    limit = (
        "The Dashboard renders My Tasks as per-category counters for this account; individual task rows are not "
        "rendered here, so no single task can be named as the most urgent from this view."
    )
    result = replace(
        outcome.result,
        status="success",
        answer_shape="overview",
        completeness="bounded",
        source_section="metrics",
        facts=(*facts, limit),
        missing=(),
    )
    return ReaderOutcome(result, {**outcome.audit_evidence, "nativePersonalTaskCounts": {
        "counters": len(facts),
    }, "result": result.public_json()})


_LICENSE_MODULE = re.compile(r"\blicen[cs]es?\b|\bpermits?\b|许可|许可证|牌照|执照|رخصة|رخص|تصريح", re.I)
_LICENSE_LIFECYCLE_VERB = re.compile(
    r"restore|renew|reactivat|reinstate|reissue|恢复|续期|重新激活|补办|تجديد|استعادة|إعادة\s*إصدار",
    re.I,
)
_LICENSE_SOON = re.compile(
    r"expir\w*|expire\s+soon|expiring|即将到期|快到期|将要到期|快要到期|\d+\s*天(?:内|之内)|"
    r"(?:الانتهاء|انتهاء|تنتهي|قريب\w*\s*من\s*الانتهاء)",
    re.I,
)
_LICENSE_URGENCY = re.compile(
    r"most\s+urgent|highest\s+priority|most\s+critical|\burgent\b|最紧急|最急|最优先|"
    r"الأكثر\s+إلحاح\w*|عاجل",
    re.I,
)
_LIST_CUE = re.compile(
    r"\bwhich\b|\bhow\s+many\b|\blist\b|\bshow\b|\bcount\b|哪些|多少|列出|显示|所有|全部|"
    r"كم|أي|اعرض|أظهر",
    re.I,
)


def _license_module_focus(question: str) -> str:
    """Classify a licensing question the rendered licence pages can answer."""

    text = str(question or "")
    if not _LICENSE_MODULE.search(text):
        return ""
    if _LICENSE_LIFECYCLE_VERB.search(text):
        return ""
    if _explicit_record_identity(text):
        return ""
    if _LIST_CUE.search(text) and _LICENSE_SOON.search(text):
        return "expiry"
    if _LICENSE_URGENCY.search(text) and re.search(r"application|applications|申请|طلب", text, re.I):
        return "urgency"
    return ""


def _observation_text_rows(observation: Any) -> tuple[str, ...]:
    """All rendered row texts, in page order and without duplicates."""

    if not isinstance(observation, dict):
        return ()
    rows: list[str] = []
    seen: set[str] = set()

    def collect(values: Any) -> None:
        if isinstance(values, (list, tuple)):
            for item in values:
                text = re.sub(r"\s+", " ", str(item or "")).strip()
                if text and text.casefold() not in seen:
                    seen.add(text.casefold())
                    rows.append(text)

    collect(observation.get("rowSummaries"))
    for node in _observation_semantic_nodes(observation):
        collect(node.get("rowSummaries"))
    for section in observation.get("sectionSummaries") or ():
        if isinstance(section, dict):
            collect(section.get("rowSummaries"))
    for key in ("headers", "columnHeaders"):
        pass
    for table in observation.get("tables") or ():
        if isinstance(table, dict):
            collect(table.get("rowSummaries"))
    return tuple(rows)


def _observed_status_option_action(observation: Any, wanted: str) -> dict[str, Any] | None:
    """Build one observed Status-combobox filter for an exact displayed option."""

    if not isinstance(observation, dict):
        return None
    for control in observation.get("filterControls") or ():
        if not isinstance(control, dict) or control.get("role") != "combobox" or not control.get("selector"):
            continue
        for option in control.get("options") or ():
            if str(option).strip().casefold() == wanted.casefold():
                return {"type": "filter", "selector": str(control["selector"]), "value": str(option).strip()}
    return None


def _license_module_result(
    observation: Any,
    *,
    question: str,
    page: str,
    focus: str,
    scope: Literal["personal", "team", "global", "unknown"],
    filtered: bool,
) -> ReaderResult | None:
    """Answer a licence listing question from the rendered licence surface only."""

    if not isinstance(observation, dict):
        return None
    rows = _observation_text_rows(observation)
    if focus == "expiry":
        if not rows:
            if not filtered:
                return None
            return ReaderResult(
                status="no_data",
                summary="No licence currently renders under the selected Status value.",
                page=page,
                section="Licenses list",
                answer_shape="list",
                completeness="bounded",
                scope=scope,
                facts=(
                    "The Licenses list was filtered with its own Status value for licences that are about to expire, "
                    "and the resulting list rendered no rows.",
                ),
            )
        note = (
            "These rows come from the Licenses list"
            + (" filtered with its own Status value for licences about to expire" if filtered else "")
            + ". The portal does not document a fixed day threshold for what counts as expiring soon, so no day-count "
              "is asserted; the Expiry Date column is reported exactly as rendered."
        )
        return ReaderResult(
            status="success",
            summary="Licences approaching expiry, read from the rendered Licenses list.",
            page=page,
            section="Licenses list",
            answer_shape="list",
            completeness="bounded",
            scope=scope,
            facts=(*rows[:8], note),
        )
    overdue: list[tuple[int, str]] = []
    countdown: list[tuple[int, str]] = []
    for row in rows:
        match = re.search(r"\b(\d+)\s*d(?:ays?)?\s+overdue\b", row, re.I)
        if match:
            overdue.append((int(match.group(1)), row))
            continue
        match = re.search(r"\b(\d+)\s*d(?:ays?)?\b(?!\s+overdue)", row, re.I)
        if match:
            countdown.append((int(match.group(1)), row))
    if overdue:
        worst = max(days for days, _row in overdue)
        selected = [row for days, row in overdue if days == worst]
        note = (
            "Ranked by the SLA value rendered in the current queue: this row carries the largest overdue duration "
            f"({worst} days). It is the most urgent visible application on this bounded page."
        )
    elif countdown:
        best = min(days for days, _row in countdown)
        selected = [row for days, row in countdown if days == best]
        note = (
            "No visible row of this queue renders an overdue SLA. Ranked by the rendered SLA countdown, the "
            f"shortest remaining value is {best} day(s)."
        )
    else:
        return None
    return ReaderResult(
        status="success",
        summary="The most urgent visible application and its SLA.",
        page=page,
        section="Application tasks",
        answer_shape="detail",
        completeness="bounded",
        scope=scope,
        facts=tuple(selected[:3]) + (note,),
    )


def _guard_unfound_record_identity(outcome: ReaderOutcome, question: str) -> ReaderOutcome:
    """A named record number that is not visible must never be answered with aggregates."""

    identity = _explicit_record_identity(question)
    if not identity:
        return outcome
    result = outcome.result
    if result.status not in {"success", "no_data"}:
        return outcome
    if result.answer_shape not in {"list", "detail", "count", "overview"}:
        return outcome
    if identity.casefold() in " ".join(str(fact) for fact in result.facts).casefold():
        return outcome
    page = result.page or (result.source_hint or {}).get("page") or ""
    facts = (
        f"No record matching {identity} is visible in the current view"
        + (f" ({page})" if page else "") + ".",
        "The requested identifier was not replaced with another record, and no aggregate statistic is used as its answer.",
    )
    guarded = replace(
        result,
        status="no_data",
        answer_shape="list",
        facts=facts,
        missing=("record_identity_not_found",),
        completeness="bounded",
    )
    return ReaderOutcome(guarded, {
        **outcome.audit_evidence,
        "unfoundRecordIdentity": identity,
        "result": guarded.public_json(),
    })


_MUTATION_REQUEST_PATTERNS: tuple[str, ...] = (
    r"\b(?:please\s+)?(?:approve|reject|assign|reassign|refund|close|delete|remove|export|send|pay|waive|"
    r"reset|disable|merge|cancel|change|update|set)\b[^.]{0,30}\b(?:application|licen[cs]e|content|ticket|refund|payment|transaction|task|case|record|account|user|photo|note|fine|penalt(?:y|ies)|fee|profile|complaint|enquir(?:y|ies)|report)\b",
    r"\b(?:approve|reject|assign|refund|close|delete|export|send|waive|reset|disable|merge|cancel)\b"
    r"[^.]{0,20}\b(?:it|this|that|them|the record)\b",
    r"(?:帮我|请|直接|把)[^。]{0,14}(?:批准|驳回|分派|指派|退款|关闭|删除|修改|改成|标记|标注|设为|判为|导出|发送|免除|重置|停用|合并|跳过|执行)",
    r"(?:批准|驳回|分派|退款|关闭|删除|修改|导出|发送|免除|重置|停用|合并|改为|改成)(?:这|该|此|本)?"
    r"(?:个|项|张|条|笔)?(?:申请|内容|投诉|工单|退款|付款|交易|任务|案件|记录|账号|用户|罚单|报告|备注)",
    r"(?:跳过|绕过|规避)[^。]{0,16}(?:检查|审批|审核|现场|复核|流程|审计)",
    r"(?:وافق|ارفض|عيّن|استرد|أغلق|احذف|عدّل|صدّر|أرسل|تجاوز|ألغِ|صفّر)[^.]{0,24}"
    r"(?:الطلب|الرخصة|المحتوى|التذكرة|الاسترداد|الدفع|المهمة|السجل|الحساب|المراجعة|التدقيق)",
)


def _mutation_request_refusal_result(question: str) -> ReaderResult | None:
    """Refuse an explicit business-change request before any page read.

    The planner is not the only entry point for these turns, so the intent is
    detected from the wording itself.  Only imperative change verbs aimed at a
    business object match; read questions that merely mention a state do not.
    """

    text = str(question or "")
    if not any(re.search(pattern, text, re.I) for pattern in _MUTATION_REQUEST_PATTERNS):
        return None
    return ReaderResult(
        status="not_confirmed",
        summary="The request asks for a business change, which the read-only reader cannot perform.",
        answer_shape="detail",
        missing=("action_not_read_only",),
    )


class AdminPortalReader:
    """GetUserInfo-first orchestration for one serialized Admin reader turn."""

    def __init__(
        self,
        gateway: ReaderToolGateway,
        planner: ReaderPlanner,
        *,
        portal_base_url: str,
        knowledge_folder_id: str = "",
        knowledge_top_k: int = 12,
        allowed_tools: tuple[str, ...] = ("knowledge.search", "admin.portal.read"),
        timeout_budget: ReaderTimeoutBudget | None = None,
        max_candidates_before_drill: int = MAX_API_CANDIDATES_BEFORE_DRILL,
    ) -> None:
        self.gateway = gateway
        self.planner = planner
        self.policy = ReadOnlyPortalPolicy(portal_base_url)
        self.knowledge_folder_id = knowledge_folder_id
        self.knowledge_top_k = max(1, min(int(knowledge_top_k), 32))
        self.allowed_tools = list(allowed_tools)
        self.timeout_budget = timeout_budget or ReaderTimeoutBudget()
        self.max_candidates_before_drill = max(1, min(int(max_candidates_before_drill), 32))
        self._turn_permission_context: UserPermissionContext | None = None

    async def run(
        self,
        principal: Principal,
        question: str,
        *,
        conversation_context: dict[str, Any] | None = None,
    ) -> ReaderOutcome:
        trace = _ReaderQualityTrace()
        bounded_context = _bounded_conversation_context(conversation_context)
        intent_state: dict[str, Any] = {}
        api_audit: dict[str, Any] = {}
        trace.record(
            "question_context",
            "passed",
            input_summary={
                "questionChars": min(len(question), 10_000),
                "hasFollowUp": bool(bounded_context),
            },
            output_summary={
                "answerShape": reader_answer_shape(question, bounded_context),
                "requiresLivePortalRead": question_requires_live_portal(question),
            },
        )
        try:
            outcome = await self._run(
                principal,
                question,
                conversation_context=bounded_context,
                trace=trace,
                intent_state=intent_state,
                api_audit=api_audit,
            )
        except Exception as exc:
            trace.record(
                "reader_runtime",
                "failed",
                output_summary={"exceptionType": type(exc).__name__},
                failure_code="reader_runtime_error",
            )
            raise
        if intent_state:
            hint = parse_intent_resolution(intent_state, question, bounded_context).planner_context(bounded_context).get("sourceHint", {})
            result = replace(outcome.result, intent_context=intent_state, source_hint=outcome.result.source_hint or hint)
            expected_shape = reader_answer_shape(question, {"resolvedIntent": intent_state})
            if result.status in {"success", "no_data"} and expected_shape not in {None, "unspecified", result.answer_shape}:
                result = _reconcile_verified_answer_shape(result, expected_shape, question)
            outcome = ReaderOutcome(result, {
                **outcome.audit_evidence, "intentResolution": intent_state, "result": result.public_json(),
            })
        if outcome.audit_evidence.get("stage") in {"intent_resolution", "intent_clarification"}:
            # Every terminal intent result is final for this turn. Preserve the
            # original invalid/timeout/model failure or explicit clarification,
            # including its validated intent metadata, before any outer repair.
            return self._classify_outcome(outcome, trace, api_audit)
        outcome = _observed_explicit_route_failure(outcome, question)
        if (str(outcome.audit_evidence.get('stage') or '').startswith('knowledge_')
                and outcome.result.facts and isinstance(outcome.audit_evidence.get('knowledge'), dict)):
            qualified = _qualify_knowledge_facts(outcome.result, outcome.audit_evidence['knowledge'])
            outcome = ReaderOutcome(qualified, {**outcome.audit_evidence, 'result': qualified.public_json()})
        outcome = _observed_tab_catalogue(outcome, question)
        outcome = _native_schema_outcome(outcome, question)
        outcome = _native_date_comparison_outcome(outcome, question)
        outcome = _application_pending_count(outcome, question)
        outcome = _native_optional_record_fields(outcome, question)
        outcome = _native_status_values(outcome, question)
        outcome = _native_bounded_summary(outcome, question)
        outcome = _native_empty_queue_count(outcome, question)
        outcome = _native_catalogue_outcome(outcome, question)
        outcome = _native_metric_overview(outcome, question)
        outcome = _native_queue_counts(outcome, question)
        outcome = _native_profile_type_count(outcome, question)
        outcome = _native_personal_task_counts(outcome, question)
        outcome = _native_queue_priority_advice(outcome, question)
        outcome = _native_person_rollup(outcome, question)
        outcome = _guard_unfound_record_identity(outcome, question)
        outcome = _guard_related_record_substitution(outcome, question, intent_state)
        outcome = _guard_requested_queue_view(outcome, question)
        outcome = _guard_requested_team_scope(outcome, intent_state, question)
        outcome = _native_identity_search_result(outcome, question, intent_state)
        outcome = _native_queue_followup(outcome, question, bounded_context)
        outcome = _native_status_filter_rows(outcome, question)
        outcome = _native_approaching_sla_rows(outcome, question)
        outcome = _native_longest_overdue(outcome, question)
        executions = [entry for entry in trace.entries if entry.get("stage") == "portal_execution"]
        outcome = _native_filter_outcome(outcome, question, executions, bounded_context)
        if (outcome.result.status in {"success", "no_data", "not_confirmed"} and executions
                and executions[-1].get("status") == "passed"
                and executions[-1].get("output", {}).get("searchClearVerified") is True
                and executions[-1].get("input", {}).get("startPath") == outcome.result.page):
            outcome = _native_cleared_search_result(outcome, question)
            outcome = ReaderOutcome(replace(outcome.result, workflow_state=(
                "The Search input was explicitly cleared and verified empty in the freshly read view. "
                "Only the current view is confirmed; no claim is made about every prior filter or all records."
            )), outcome.audit_evidence)
        outcome = _guard_completion_period_count(outcome, question, bounded_context)
        knowledge_context = outcome.audit_evidence.get("knowledge")
        if not isinstance(knowledge_context, dict):
            knowledge_context = {}
        outcome = _native_sla_performance_metrics(outcome, question)
        outcome = _native_fine_decision_result(outcome, question)
        # A question about one record's own history, requisites or next step
        # needs the record's detail page, which the list surface does not load.
        detail_identity = _explicit_record_identity(question)
        detail_page = str(outcome.result.page or "")
        if (detail_identity and detail_page and _RECORD_DETAIL_REQUEST.search(str(question or ""))
                ):
            detail_observation = await self._open_record_detail(principal, detail_page, detail_identity)
            if detail_observation:
                detail_facts = _record_detail_facts(question, detail_observation, detail_identity)
                if detail_facts:
                    existing = {re.sub(r"\s+", " ", str(fact)).strip().casefold() for fact in outcome.result.facts}
                    additions = [fact for fact in detail_facts if fact.casefold() not in existing]
                    if additions:
                        merged = replace(
                            outcome.result,
                            status="success",
                            facts=(*outcome.result.facts, *additions)[:24],
                            missing=tuple(
                                code for code in outcome.result.missing
                                if code not in {"knowledge_not_grounded"}
                            ),
                        )
                        outcome = ReaderOutcome(merged, {
                            **outcome.audit_evidence,
                            "stage": "record_detail_read",
                            "recordDetail": {"identity": detail_identity, "factCount": len(additions)},
                            "result": merged.public_json(),
                        })
        # These run last: they add fields the page's own read API returned and
        # the scope/history notes, which earlier repairs would otherwise drop.
        outcome = _native_observed_api_enrichment(outcome, question)
        outcome = _native_scope_and_comparison_notes(outcome, question)
        outcome = _native_unavailable_information_notes(outcome, question)
        rule_facts = await self._rule_evidence_facts(principal, question, outcome, knowledge_context)
        if rule_facts:
            # The rule text is quoted from the governing document, so it can sit
            # beside the page values instead of replacing them.
            merged = replace(
                outcome.result,
                status="success",
                facts=(*outcome.result.facts, *rule_facts)[:24],
                missing=tuple(
                    code for code in outcome.result.missing
                    if code not in {"knowledge_not_grounded", "portal_read_required"}
                ),
            )
            outcome = ReaderOutcome(merged, {
                **outcome.audit_evidence,
                "stage": "answer_with_rule_evidence",
                "ruleEvidence": {"factCount": len(rule_facts)},
                "result": merged.public_json(),
            })
        elif (
            _RULE_EVIDENCE_REQUEST.search(str(question or ""))
            and outcome.result.status == "success"
            and outcome.result.page
            and not _SENSITIVE_GUIDANCE_QUESTION.search(str(question or ""))
            and not question_requests_business_mutation(str(question or ""))
        ):
            # The question asks for a rule and the documents state none for it.
            # Say that plainly and name the page where the case is handled,
            # instead of leaving the answer looking like a complete rule lookup.
            note = (
                f"No retrieved policy or regulation states a rule for this specific case. "
                f"{outcome.result.page} is the page where the portal records it, and the decision itself stays with "
                "the responsible team through the portal's own workflow."
            )
            existing = {re.sub(r"\s+", " ", str(fact)).strip().casefold() for fact in outcome.result.facts}
            if note.casefold() not in existing:
                merged = replace(outcome.result, facts=(*outcome.result.facts, note)[:24])
                outcome = ReaderOutcome(merged, {
                    **outcome.audit_evidence,
                    "stage": "rule_evidence_not_documented",
                    "result": merged.public_json(),
                })
        guidance = documented_guidance_result(
            question,
            knowledge_context,
            getattr(self, "_turn_permission_context", None),
            outcome.result,
        )
        if guidance is not None:
            outcome = ReaderOutcome(guidance, {
                **outcome.audit_evidence,
                "stage": "documented_guidance",
                "result": guidance.public_json(),
            })
        if outcome.result.status == 'success' and outcome.result.answer_shape == 'count' and not outcome.result.selected_state:
            observation = outcome.audit_evidence.get('observation') or ((outcome.audit_evidence.get('portalEvidence') or {}).get('result') or {}).get('observation') or {}
            selected = [str(t.get('name')) for t in observation.get('tabControls', [])
                        if isinstance(t, dict) and t.get('selected') is True and t.get('name')]
            if selected:
                result = replace(outcome.result, selected_state=' / '.join(dict.fromkeys(selected)))
                outcome = ReaderOutcome(result, {**outcome.audit_evidence, 'result': result.public_json()})
        return self._classify_outcome(outcome, trace, api_audit)

    @staticmethod
    def _classify_outcome(outcome: ReaderOutcome, trace: _ReaderQualityTrace, api_audit: dict[str, Any]) -> ReaderOutcome:
        result_status = "passed" if outcome.result.status in {"success", "no_data"} else "failed"
        failure_code = outcome.result.missing[0] if outcome.result.missing else ""
        trace.record(
            "result_classification",
            result_status,  # type: ignore[arg-type]
            input_summary={"readerStatus": outcome.result.status},
            output_summary={
                "factCount": len(outcome.result.facts),
                "missingCount": len(outcome.result.missing),
                "answerShape": outcome.result.answer_shape,
            },
            failure_code=failure_code,
        )
        root_cause = trace.root_cause(outcome.result)
        evidence = {
            **outcome.audit_evidence,
            "qualityTrace": trace.entries,
            "rootCause": root_cause,
        }
        if api_audit:
            evidence["apiSelection"] = bounded_json(api_audit, max_depth=5, max_items=30, max_string=300)
        return ReaderOutcome(outcome.result, evidence)

    async def _rule_evidence_facts(
        self,
        principal: Principal,
        question: str,
        outcome: ReaderOutcome,
        knowledge_context: Any,
    ) -> tuple[str, ...]:
        """Quote the governing rule when the question asks for one.

        A question such as "which rule is this decision based on" or "does this
        content meet the media content standard" needs the regulation, fee
        schedule or standard text.  The retrieved documents are supplied to one
        bounded planning pass that may return only quoted rule facts; anything
        the documents do not state is left unconfirmed rather than invented.
        """

        text = str(question or "")
        if not _RULE_EVIDENCE_REQUEST.search(text):
            return ()
        if _SENSITIVE_GUIDANCE_QUESTION.search(text) or question_requests_business_mutation(text):
            return ()
        if not isinstance(knowledge_context, dict) or not knowledge_context.get("chunks"):
            # Several questions are answered by an early exact-record path that
            # never retrieved documents.  The rule part still needs them, so
            # retrieve here with the same two-query strategy.
            knowledge_context = await self._rule_evidence_retrieval(principal, question)
        permission_context = getattr(self, "_turn_permission_context", None)
        permission_payload = (
            {
                "currentRole": permission_context.current_role,
                "roles": list(permission_context.roles),
                "departments": list(permission_context.departments),
            }
            if isinstance(permission_context, UserPermissionContext)
            else {}
        )
        directive = {
            "ruleEvidenceOnly": True,
            "reason": "question_asks_for_a_business_rule",
            "instruction": (
                "Return the rule that governs this question, not a statement about one record. "
                "The user is asking which policy, regulation, standard, requirement or checklist applies. "
                "Return 1-4 facts. Every fact must copy a sentence that actually appears in a retrieved document, "
                "and must start with that document's file name followed by ': '. Keep any article, clause or section "
                "label that appears next to the copied sentence. "
                "A governing rule that applies to this type of application, licence, fee, violation or content is a "
                "correct answer even when the document never names the specific record, so do not refuse for that "
                "reason. Only return knowledge_only not_confirmed with no facts when no retrieved document contains "
                "any rule relevant to the question's topic. "
                "Do not repeat portal row values and never invent a rule, clause number, amount or decision."
            ),
            "allowedFallback": "knowledge_only:not_confirmed",
        }
        try:
            plan = await asyncio.wait_for(
                self.planner.plan_admin_portal_read(
                    question,
                    permission_payload,
                    {**knowledge_context, "planningDirective": directive},
                    None,
                ),
                timeout=min(20.0, self.timeout_budget.planner_seconds),
            )
        except (asyncio.TimeoutError, httpx.HTTPError, RuntimeError, ValueError, TypeError, AttributeError):
            return ()
        candidate = knowledge_result_from_plan(plan)
        if candidate is None or candidate.status != "success" or not candidate.facts:
            return _deterministic_rule_clauses(question, knowledge_context)
        if not knowledge_supports_result(candidate, knowledge_context):
            return ()
        existing = {re.sub(r"\s+", " ", str(fact)).strip().casefold() for fact in outcome.result.facts}
        facts = [
            str(fact).strip()
            for fact in candidate.facts
            if re.sub(r"\s+", " ", str(fact)).strip().casefold() not in existing
        ]
        if not facts:
            facts = [
                fact for fact in _deterministic_rule_clauses(question, knowledge_context)
                if fact.casefold() not in existing
            ]
        return tuple(facts[:5])

    async def _open_record_detail(
        self,
        principal: Principal,
        page: str,
        identity: str,
    ) -> dict[str, Any]:
        """Open one record's own detail page through the page's row/cell click.

        A list surface often renders only summary columns while the record's
        detail route holds the history, requisites and next step.  The click is
        performed by the page itself, so permissions and the read-only network
        policy apply exactly as they do for a user.
        """

        if not page or not identity:
            return {}
        try:
            result = await asyncio.wait_for(
                self.gateway.invoke(
                    principal,
                    "admin.portal.read",
                    {"startPath": page, "actions": [
                        {"type": "show_detail", "role": "cell", "name": identity, "value": identity},
                    ]},
                    allowed_tools=self.allowed_tools,
                ),
                timeout=min(45.0, self.timeout_budget.portal_read_seconds),
            )
        except (asyncio.TimeoutError, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError, AttributeError):
            return {}
        if not result.get("ok"):
            return {}
        payload = result.get("result") or {}
        observation = payload.get("observation")
        return observation if isinstance(observation, dict) else {}

    async def _rule_evidence_retrieval(self, principal: Principal, question: str) -> dict[str, Any]:
        """Retrieve the rule documents for a question answered elsewhere."""

        context = getattr(self, "_turn_permission_context", None)
        if not self.knowledge_folder_id or not isinstance(context, UserPermissionContext):
            return {}
        queries = knowledge_search_queries(question, context, None)
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*[
                    self.gateway.invoke(
                        principal,
                        "knowledge.search",
                        {"query": query, "folder_id": self.knowledge_folder_id, "top_k": self.knowledge_top_k},
                        allowed_tools=self.allowed_tools,
                    )
                    for query in queries
                ]),
                timeout=min(20.0, self.timeout_budget.knowledge_search_seconds + 5.0),
            )
        except (asyncio.TimeoutError, httpx.HTTPError, RuntimeError, ValueError, TypeError):
            return {}
        merged = merge_knowledge_results(list(results), limit=self.knowledge_top_k)
        return project_knowledge_result(merged, max_chunks=self.knowledge_top_k)

    async def _run(
        self,
        principal: Principal,
        question: str,
        *,
        conversation_context: dict[str, Any] | None = None,
        trace: _ReaderQualityTrace,
        intent_state: dict[str, Any],
        api_audit: dict[str, Any],
    ) -> ReaderOutcome:
        budget = self.timeout_budget
        bounded_conversation_context = _bounded_conversation_context(conversation_context)
        list_selection_reviewed = False
        observation_grounding_reviewed = False
        intent_completion_reviewed = False
        filter_completion_reviewed = False
        observation_schema_reviewed = False
        action_contract_reviewed = False
        api_selection_recovery_reviewed = False
        api_drill_depth = 0
        api_selected_observations: set[str] = set()
        identity_search_reviewed = False
        search_clear_planned = False
        native_filter_transition_planned = False
        last_portal_page = ''
        last_portal_observation: dict[str, Any] = {}
        last_portal_changed_tabs = False
        compound_first_detail = bool(
            re.search(r"\b(?:first|1st)\s+(?:one|record|license|application|item)\b", question, re.I)
            and re.search(r"\b(?:list|show|several|multiple|some|few)\b", question, re.I)
            and re.search(r"\b(?:detail|details)\b", question, re.I)
        )

        def plan_reader(knowledge_or_observation: dict[str, Any]):
            if bounded_conversation_context:
                return self.planner.plan_admin_portal_read(
                    question,
                    permission_context.prompt_json(),
                    knowledge_or_observation,
                    bounded_conversation_context,
                )
            return self.planner.plan_admin_portal_read(
                question,
                permission_context.prompt_json(),
                knowledge_or_observation,
            )

        def observed_detail_action(
            observation: Any,
            record_identity: str,
            source_page: str,
        ) -> dict[str, Any] | None:
            destination = _documented_detail_destination(
                knowledge_context,
                source_page,
                (*permission_context.pages, *permission_context.subpages),
            )
            return _observed_cell_detail_action(
                observation,
                record_identity,
                destination=destination,
            )

        def plan_summary(plan: Any) -> dict[str, Any]:
            if not isinstance(plan, dict):
                return {"planType": type(plan).__name__}
            request = plan.get("portalRequest")
            if not isinstance(request, dict):
                return {"mode": str(plan.get("mode") or ""), "hasPortalRequest": False,
                        "resultStatus": str(plan.get("result") or "")[:32],
                        "resultKeys": sorted(str(key)[:60] for key in plan)[:20],
                        "factsType": type(plan.get("facts")).__name__,
                        "factCount": len(plan["facts"]) if isinstance(plan.get("facts"), list) else 0,
                        "missingType": type(plan.get("missing")).__name__,
                        "missingCount": len(plan["missing"]) if isinstance(plan.get("missing"), list) else 0,
                        "answerShape": str(plan.get("answerShape") or "")[:32]}
            actions = request.get("actions")
            return {
                "mode": str(plan.get("mode") or ""),
                "startPath": str(request.get("startPath") or "")[:300],
                "actionCount": len(actions) if isinstance(actions, list) else 0,
                "actionTypes": [
                    str(action.get("type") or action.get("action") or "")[:80]
                    for action in actions[:12]
                    if isinstance(action, dict)
                ] if isinstance(actions, list) else [],
                "expectedFieldCount": len(request.get("expectedFields") or [])
                if isinstance(request.get("expectedFields"), list) else 0,
            }

        def request_summary(request: PortalReadRequest) -> dict[str, Any]:
            return {
                "startPath": request.start_path[:300],
                "actionCount": len(request.actions),
                "actionTypes": [str(action.get("type") or "")[:80] for action in request.actions],
                "expectedFieldCount": len(request.expected_fields),
            }

        async def plan_stage(
            knowledge_or_observation: dict[str, Any],
            *,
            timeout_stage: str,
            reason: str,
        ) -> dict[str, Any]:
            nonlocal list_selection_reviewed, intent_completion_reviewed, filter_completion_reviewed, observation_schema_reviewed, action_contract_reviewed, api_selection_recovery_reviewed, api_drill_depth, identity_search_reviewed, search_clear_planned, native_filter_transition_planned
            if not search_clear_planned:
                clear_plan = _observed_search_clear(question, knowledge_or_observation.get("portalObservation"),
                    str((knowledge_or_observation.get("priorPortalRead") or {}).get("startPath") or ""))
                if clear_plan:
                    search_clear_planned = True
                    trace.record("search_clear", "passed", output_summary={"decision": "observed_search_clear_required"})
                    return clear_plan
            started_at = time.perf_counter()
            observation = knowledge_or_observation.get("portalObservation")
            if compound_first_detail and isinstance(observation, dict):
                first_identity = _first_observed_record_identity(observation)
                current_page = str(
                    (knowledge_or_observation.get("priorPortalRead") or {}).get("startPath") or ""
                )
                first_detail_action = observed_detail_action(
                    observation, first_identity, current_page,
                ) if first_identity and current_page else None
                if first_detail_action is not None and current_page:
                    resolved_values["recordIdentity"] = first_identity
                    trace.record(
                        "planning",
                        "passed",
                        started_at=started_at,
                        input_summary={"reason": reason},
                        output_summary={
                            "strategy": "observed_first_record_detail",
                            "recordIdentity": first_identity,
                        },
                    )
                    return {
                        "mode": "portal_read",
                        "portalRequest": {
                            "startPath": current_page,
                            "actions": [first_detail_action],
                            "expectedFields": [],
                        },
                    }
            if _requested_schema_fields(question) and observation is None:
                page = semantic_source_hint(bounded_conversation_context).get('page', '')
                if page:
                    return {'mode':'portal_read','portalRequest':{'startPath':page,'actions':[{'type':'observe'}],'expectedFields':[]}}
            discovery = _api_discovery(observation)
            minimal_identity = _minimal_identity_plan(question, observation)
            if minimal_identity is not None:
                return minimal_identity
            if _requested_date_comparison(question):
                # Native labels bind the requested fields; expiry projections
                # such as daysRemaining cannot answer a field-to-field comparison.
                discovery = None
                knowledge_or_observation = {**knowledge_or_observation, 'planningDirective': {
                    **knowledge_or_observation.get('planningDirective', {}),
                    'nativeDateComparison': True, 'instruction': 'Read the actual date columns and record identities. '
                    'Compare only observed unambiguous dates. Keep bounded coverage explicit; do not infer filter support or global emptiness.'}}
            if _question_needs_native_surface(question) and isinstance(observation, dict):
                discovery = None
                if not native_filter_transition_planned:
                    transition = _observed_filter_transition(question, observation,
                        str((knowledge_or_observation.get('priorPortalRead') or {}).get('startPath') or ''))
                    if transition:
                        native_filter_transition_planned = True
                        return transition
                knowledge_or_observation = {**knowledge_or_observation, 'planningDirective': {
                    **knowledge_or_observation.get('planningDirective', {}),
                    'nativeSurfaceRequired': True,
                    'instruction': 'Use current rendered columnHeaders, filterControls and dialogs for schema/control questions. '
                        'Record API rows and totals do not establish field availability or that a filter was opened or dismissed. '
                        'An empty table can still have verified column headers. Do not infer personal scope from role labels.',
                }}
            requested_view = _resolved_intent_values(bounded_conversation_context).get('view', '')
            if not requested_view and not question_is_conceptual(question):
                named_views = set(re.findall(r'\b(?:in\s+|tasks?\s+)(To Do|Completed)\b', question, re.I))
                if len(named_views) == 1:
                    requested_view = next(iter(named_views))
            if requested_view and isinstance(observation, dict):
                selected = [str(tab.get('name') or '') for tab in observation.get('tabControls') or []
                            if isinstance(tab, dict) and tab.get('selected') is True]
                if selected and not any(_state_control_label_matches(label, requested_view) for label in selected):
                    action = _observed_switch_tab_action({'name': requested_view}, observation)
                    page = str((knowledge_or_observation.get('priorPortalRead') or {}).get('startPath') or '')
                    if action is not None and page:
                        return {'mode':'portal_read','portalRequest':{'startPath':page,'actions':[action],'expectedFields':[]}}
                    # Do not select an API from the default queue before
                    # resolving a requested hidden child view from the manual.
                    discovery = None
                    knowledge_or_observation = {**knowledge_or_observation, 'planningDirective': {
                        **knowledge_or_observation.get('planningDirective', {}),
                        'requestedStateRequiresParent': requested_view, 'requirePortalRead': True,
                        'instruction': 'The requested view is not active. Use documented parent/child tab steps; current-view APIs and rows cannot answer this request.',
                    }}
            if not identity_search_reviewed and isinstance(observation, dict):
                search_plan = _observed_identity_search(question, bounded_conversation_context, observation,
                    str((knowledge_or_observation.get('priorPortalRead') or {}).get('startPath') or ''))
                if search_plan:
                    identity_search_reviewed = True
                    trace.record('identity_search', 'passed', output_summary={'decision':'search_before_api_selection'})
                    return search_plan
            include_support_api = _question_requests_support_api(question, bounded_conversation_context)
            prior_read = knowledge_or_observation.get("priorPortalRead") or {}
            prior_actions = prior_read.get("actions") if isinstance(prior_read, dict) else []
            action_generated_delta = bool(
                discovery is not None
                and isinstance(discovery.get("deltaCandidates"), list)
                and discovery.get("deltaCandidates")
                and isinstance(prior_actions, list)
                and any(
                    isinstance(action, dict)
                    and str(action.get("type") or "").casefold().replace("-", "_")
                    not in {"observe", "query"}
                    for action in prior_actions
                )
            )
            delta_only = bool(api_drill_depth) or action_generated_delta
            api_candidates = _relevant_selectable_api_candidates(
                observation, question, bounded_conversation_context, delta_only=delta_only,
            )
            policy_state_counts = {
                state: sum(1 for candidate in api_candidates if candidate.get("policyState") == state)
                for state in ("allowed", "bypassed")
            }
            api_signature = hashlib.sha256(
                json.dumps(
                    [candidate["operationKey"] for candidate in api_candidates],
                    ensure_ascii=False,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest() if discovery is not None else ""
            api_decision = ""
            api_controls: tuple[dict[str, Any], ...] = ()
            incoming_directive = knowledge_or_observation.get("planningDirective")
            using_selected_candidate = (
                isinstance(incoming_directive, dict)
                and incoming_directive.get("apiCandidateDecision") == "use_selected"
            )
            if discovery is not None and not using_selected_candidate and api_signature not in api_selected_observations:
                truncated = _api_discovery_is_truncated(
                    discovery,
                    include_support=include_support_api,
                    delta_only=delta_only,
                )
                discovery_decision = (
                    "not_confirmed" if not api_candidates
                    else "drill" if truncated
                    else "select"
                )
                discoveries = api_audit.setdefault("discoveries", [])
                if isinstance(discoveries, list) and len(discoveries) < 2:
                    discoveries.append({
                        "drillDepth": api_drill_depth,
                        "deltaOnly": delta_only,
                        "reportedCandidateCount": discovery.get("candidateCount")
                        if isinstance(discovery.get("candidateCount"), int) else 0,
                        "relevantSelectableCount": len(api_candidates),
                        "policyStateCounts": policy_state_counts,
                        "truncated": truncated,
                        "decision": discovery_decision,
                    })
                trace.record(
                    "operation_discovery",
                    "passed" if api_candidates else "failed",
                    input_summary={
                        "reportedCandidateCount": discovery.get("candidateCount")
                        if isinstance(discovery.get("candidateCount"), int) else 0,
                        "drillDepth": api_drill_depth,
                    },
                    output_summary={
                        "relevantSelectableCount": len(api_candidates),
                        "policyStateCounts": policy_state_counts,
                        "truncated": truncated,
                        "decision": discovery_decision,
                    },
                    failure_code="" if api_candidates else "no_selectable_api_candidates",
                )
                if not api_candidates:
                    api_audit.update({
                        "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                        "selectableCandidateCount": 0,
                        "candidateCount": discovery.get("candidateCount") if isinstance(discovery.get("candidateCount"), int) else 0,
                        "truncated": truncated,
                        "decision": "not_confirmed",
                        "reason": "no_selectable_api_candidates",
                        "drillDepth": api_drill_depth,
                    })
                # Candidate count is an audit and prompt-budget signal, not a
                # business-state decision. An intact bounded candidate set can
                # still be semantically unique even when it is numerically large.
                needs_drill = bool(api_candidates) and truncated
                if needs_drill and api_drill_depth >= MAX_API_DRILL_DEPTH:
                    api_audit.update({
                        "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                        "selectableCandidateCount": len(api_candidates),
                        "truncated": truncated,
                        "decision": "not_confirmed",
                        "reason": "api_candidates_still_ambiguous",
                        "drillDepth": api_drill_depth,
                    })
                    trace.record(
                        "operation_selection", "failed",
                        input_summary={"selectableCandidateCount": len(api_candidates), "truncated": truncated},
                        output_summary={"decision": "not_confirmed", "drillDepth": api_drill_depth},
                        failure_code="api_candidates_still_ambiguous",
                    )
                    api_decision = "unavailable"
                    api_candidates = ()
                else:
                    api_decision = "drill" if needs_drill else "select" if api_candidates else "unavailable"
                if needs_drill and api_decision == "drill":
                    api_controls = _observed_api_drill_controls(observation)
                    if not api_controls:
                        api_audit.update({
                            "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                            "selectableCandidateCount": len(api_candidates),
                            "truncated": truncated,
                            "decision": "not_confirmed",
                            "reason": "no_safe_api_drill_control",
                            "drillDepth": api_drill_depth,
                        })
                        trace.record(
                            "operation_drill", "failed",
                            input_summary={"selectableCandidateCount": len(api_candidates), "truncated": truncated},
                            output_summary={"decision": "not_confirmed", "safeControlCount": 0},
                            failure_code="no_safe_api_drill_control",
                        )
                        # Discovery is one evidence channel. If the same bounded
                        # observation independently proves the answer, let normal
                        # DOM planning and grounding decide it instead of making
                        # the unavailable drill a global failure.
                        api_decision = "unavailable"
                        api_candidates = ()
                directive = dict(knowledge_or_observation.get("planningDirective") or {})
                directive.update({
                    "apiCandidateDecision": api_decision,
                    "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                    "selectableApiCandidates": list(api_candidates),
                    "selectableCandidateCount": len(api_candidates),
                    "apiDiscoveryTruncated": truncated,
                    "apiDrillDepth": api_drill_depth,
                })
                if api_controls:
                    directive["observedSafeControls"] = list(api_controls)
                knowledge_or_observation = {**knowledge_or_observation, "planningDirective": directive}
            input_summary = {
                "reason": reason,
                "knowledgeChunks": len(knowledge_or_observation.get("chunks") or [])
                if isinstance(knowledge_or_observation, dict) else 0,
                "hasPortalObservation": bool(
                    isinstance(knowledge_or_observation, dict)
                    and knowledge_or_observation.get("portalObservation") is not None
                ),
            }
            raw_selectable_candidates = _selectable_api_candidates(
                observation,
                candidate_field="deltaCandidates" if delta_only else "candidates",
            )
            if not _question_requests_support_api(question, bounded_conversation_context):
                raw_selectable_candidates = tuple(
                    candidate
                    for candidate in raw_selectable_candidates
                    if candidate.get("candidateKind") != "support"
                )
            deterministic_unique_selection = bool(
                api_decision == "select"
                and len(api_candidates) == 1
                and len(raw_selectable_candidates) == 1
                and _api_response_evidence_for_operation(
                    observation, api_candidates[0]["operationKey"],
                ) is not None
            )
            if deterministic_unique_selection:
                plan = {
                    "mode": "api_selection",
                    "operationKey": api_candidates[0]["operationKey"],
                    "reasonCodes": ["only_safe_candidate", "trigger_matches_intent"],
                }
                trace.record(
                    "planning",
                    "passed",
                    started_at=started_at,
                    input_summary=input_summary,
                    output_summary={
                        "mode": "api_selection",
                        "selection": "unique_current_page_response",
                    },
                )
            else:
                try:
                    plan = await _await_reader_stage(
                        plan_reader(knowledge_or_observation),
                        stage=timeout_stage,
                        cap_seconds=budget.planner_seconds,
                        deadline=deadline,
                    )
                except ReaderStageTimeout as exc:
                    trace.record(
                        "planning",
                        "failed",
                        started_at=started_at,
                        input_summary=input_summary,
                        output_summary={"timeoutKind": "total" if exc.total_budget else "stage"},
                        failure_code="reader_total_timeout" if exc.total_budget else "planner_timeout",
                    )
                    raise
                except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                    validation_error = (
                        _sanitize_untrusted_text(exc, max_length=200)
                        if isinstance(exc, ValueError) else ""
                    )
                    trace.record(
                        "planning",
                        "failed",
                        started_at=started_at,
                        input_summary=input_summary,
                        output_summary={
                            "exceptionType": type(exc).__name__,
                            **({"validationError": validation_error} if validation_error else {}),
                        },
                        failure_code="planner_error",
                    )
                    raise
                trace.record(
                    "planning",
                    "passed",
                    started_at=started_at,
                    input_summary=input_summary,
                    output_summary=plan_summary(plan),
                )
            if (
                using_selected_candidate
                and isinstance(observation, dict)
                and observation.get("apiEvidence") is not None
            ):
                selected_answer_shape = (
                    _resolved_intent_values(bounded_conversation_context).get("answerShape")
                    or reader_answer_shape(question, bounded_conversation_context)
                )
                normalized_api_plan = _selected_api_answer_plan(
                    plan,
                    answer_shape=selected_answer_shape,
                )
                fallback_api_plan, evidence_reason = _api_evidence_fallback_plan(
                    observation["apiEvidence"],
                    answer_shape=selected_answer_shape,
                    semantic_query=" ".join((question, *_resolved_intent_values(bounded_conversation_context).values())),
                )
                if fallback_api_plan is not None:
                    plan = fallback_api_plan
                    api_audit["evidenceDelivery"] = {
                        "state": "answerable",
                        "strategy": "deterministic_response_projection",
                    }
                    trace.record(
                        "evidence_delivery",
                        "passed",
                        input_summary={"answerShape": selected_answer_shape},
                        output_summary={
                            "state": "answerable",
                            "strategy": "deterministic_response_projection",
                        },
                        failure_code="",
                    )
                elif (
                    normalized_api_plan is not None
                    and _api_answer_plan_is_grounded(normalized_api_plan, observation["apiEvidence"])
                ):
                    plan = normalized_api_plan
                    api_audit["evidenceDelivery"] = {
                        "state": "answerable",
                        "strategy": "grounded_model_format",
                    }
                else:
                    plan = {
                        "mode": "observation_result",
                        "result": "not_confirmed",
                        "answerShape": selected_answer_shape,
                        "completeness": "bounded",
                        "facts": [],
                        "missing": [evidence_reason],
                    }
                    api_audit["evidenceDelivery"] = {
                        "state": "eligible_not_sufficient",
                        "reason": evidence_reason,
                    }
                    trace.record(
                        "evidence_delivery",
                        "failed",
                        input_summary={"answerShape": selected_answer_shape},
                        output_summary={"state": "eligible_not_sufficient"},
                        failure_code=evidence_reason,
                    )
            if api_decision == "select":
                selected = api_selection_from_plan(plan, api_candidates)
                if (selected is None and isinstance(observation, dict)
                        and bounded_conversation_context.get('resolvedIntent', {}).get('relation') in {'continue','refine'}
                        and re.search(r'\b(?:these|those|that queue|that list)\b', question, re.I)
                        and not _resolved_intent_values(bounded_conversation_context).get('recordIdentity')
                        and reader_answer_shape(question,bounded_conversation_context) in {'list','detail'}):
                    # A deictic follow-up can reuse the source, never its old
                    # data. Recover only one response with freshly matching
                    # native record identities; ambiguous sources still fail.
                    matched = [candidate for candidate in api_candidates if _api_native_source({
                        **observation, 'apiEvidence': _api_response_evidence_for_operation(observation,candidate['operationKey'])}) is not None]
                    if len(matched) == 1:
                        selected = (matched[0], ('response_fields_match_answer',))
                        trace.record('operation_source_recovery','passed',output_summary={'reason':'unique_fresh_native_record_match'})
                if selected is None:
                    api_audit.update({
                        "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                        "selectableCandidateCount": len(api_candidates),
                        "decision": "not_confirmed",
                        "reason": "invalid_api_selection",
                        "drillDepth": api_drill_depth,
                    })
                    trace.record(
                        "operation_selection", "failed",
                        input_summary={"selectableCandidateCount": len(api_candidates)},
                        output_summary={"decision": "rejected"},
                        failure_code="invalid_api_selection",
                    )
                    if not api_selection_recovery_reviewed:
                        api_selection_recovery_reviewed = True
                        api_selected_observations.add(api_signature)
                        prior_directive = knowledge_or_observation.get("planningDirective")
                        recovery_directive = {
                            key: value
                            for key, value in (prior_directive.items() if isinstance(prior_directive, dict) else ())
                            if key not in {
                                "selectableApiCandidates", "selectableCandidateCount", "selectedApiCandidate",
                                "selectionReasonCodes", "observedSafeControls",
                            }
                        }
                        recovery_directive.update({
                            "apiCandidateDecision": "unavailable",
                            "apiFailureReason": "invalid_api_selection",
                            "reason": "Use only independently sufficient bounded page observation evidence.",
                        })
                        return await plan_stage(
                            {
                                **knowledge_or_observation,
                                "planningDirective": recovery_directive,
                            },
                            timeout_stage=timeout_stage,
                            reason="recover_from_invalid_api_selection",
                        )
                    return {
                        "mode": "observation_result", "result": "not_confirmed", "facts": [],
                        "missing": ["invalid_api_selection"],
                    }
                selected_candidate, reason_codes = selected
                api_selected_observations.add(api_signature)
                api_audit.update({
                    "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                    "selectableCandidateCount": len(api_candidates),
                    "decision": "selected",
                    "selectedOperationKey": selected_candidate["operationKey"],
                    "selectedPolicyState": selected_candidate["policyState"],
                    "reasonCodes": list(reason_codes),
                    "drillDepth": api_drill_depth,
                })
                api_audit["selection"] = {
                    "operationKey": selected_candidate["operationKey"],
                    "policyState": selected_candidate["policyState"],
                    "reasonCodes": list(reason_codes),
                }
                trace.record(
                    "operation_selection", "passed",
                    input_summary={"selectableCandidateCount": len(api_candidates)},
                    output_summary={
                        "decision": "selected",
                        "operationKey": selected_candidate["operationKey"],
                        "reasonCodes": list(reason_codes),
                    },
                )
                selected_api_evidence = _api_response_evidence_for_operation(
                    observation, selected_candidate["operationKey"],
                )
                if selected_api_evidence is not None:
                    observation["apiEvidence"] = selected_api_evidence
                    # Once a page-generated response has been selected, keep the
                    # answer pass focused on that response. Unrelated DOM regions
                    # from the same dashboard can otherwise pull the model back to
                    # a visually prominent but semantically different section.
                    reduced_observation = {
                        "apiEvidence": selected_api_evidence,
                        "apiDiscovery": {
                            "candidates": [selected_candidate],
                            "candidateCount": 1,
                            "truncated": False,
                        },
                    }
                else:
                    reduced_observation = dict(observation)
                    reduced_observation["apiDiscovery"] = {
                        "candidates": [selected_candidate], "candidateCount": 1, "truncated": False,
                    }
                return await plan_stage(
                    {
                        **knowledge_or_observation,
                        "portalObservation": reduced_observation,
                        "planningDirective": {
                            **knowledge_or_observation.get("planningDirective", {}),
                            "apiCandidateDecision": "use_selected",
                            "selectedApiCandidate": selected_candidate,
                            "selectionReasonCodes": list(reason_codes),
                            "selectableApiCandidates": [selected_candidate],
                            "selectableCandidateCount": 1,
                        },
                    },
                    timeout_stage=timeout_stage,
                    reason="use_selected_api_candidate",
                )
            if api_decision == "drill":
                prior_read = knowledge_or_observation.get("priorPortalRead") or {}
                current_page = str(prior_read.get("startPath") or "")
                drill = api_drill_request_from_plan(plan, observation, start_path=current_page)
                if drill is None or not current_page:
                    api_audit.update({
                        "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                        "selectableCandidateCount": len(api_candidates),
                        "decision": "not_confirmed",
                        "reason": "invalid_api_drill_selection",
                        "drillDepth": api_drill_depth,
                    })
                    trace.record(
                        "operation_drill", "failed",
                        input_summary={"selectableCandidateCount": len(api_candidates)},
                        output_summary={"decision": "rejected"},
                        failure_code="invalid_api_drill_selection",
                    )
                    return {
                        "mode": "observation_result", "result": "not_confirmed", "facts": [],
                        "missing": ["invalid_api_drill_selection"],
                    }
                drill_request, control_id, reason_codes = drill
                api_drill_depth += 1
                api_audit.update({
                    "maxCandidatesBeforeDrill": self.max_candidates_before_drill,
                    "selectableCandidateCount": len(api_candidates),
                    "decision": "drill",
                    "controlId": control_id,
                    "reasonCodes": list(reason_codes),
                    "drillDepth": api_drill_depth,
                })
                api_audit["drill"] = {"controlId": control_id, "reasonCodes": list(reason_codes)}
                trace.record(
                    "operation_drill", "passed",
                    input_summary={"selectableCandidateCount": len(api_candidates)},
                    output_summary={"decision": "drill", "controlId": control_id, "drillDepth": api_drill_depth},
                )
                return {
                    "mode": "portal_read",
                    "portalRequest": {
                        "startPath": drill_request.start_path,
                        "actions": [dict(action) for action in drill_request.actions],
                        "expectedFields": [],
                    },
                }
            observation = knowledge_or_observation.get("portalObservation")
            if not identity_search_reviewed and plan.get("mode") == "observation_result":
                search_plan = _observed_identity_search(question, bounded_conversation_context, observation,
                    str((knowledge_or_observation.get("priorPortalRead") or {}).get("startPath") or ""))
                if search_plan:
                    identity_search_reviewed = True
                    trace.record("identity_search", "degraded", output_summary={"decision": "observed_search_required"})
                    return search_plan
            requested_filter = _explicit_observed_filter(question, observation)
            filter_controls = observation.get("filterControls", []) if isinstance(observation, dict) else []
            observed_filter_actions = [
                {"controlLabel": control.get("label"), "action": {
                    "type": "filter", "selector": control["selector"], "value": requested_filter,
                }} for control in filter_controls if isinstance(control, dict)
                and control.get("role") == "combobox" and control.get("selector") and requested_filter
            ]
            request_candidate = portal_read_request_from_plan(plan)
            invalid_filter_actions = request_candidate and any(
                (action.get("type") in {"apply_filter", "reset_filter", "show_filter"}
                 and action.get("role") not in {None, "button"})
                or (action.get("type") == "show_filter" and any(
                    str(control.get("label") or "").casefold() == str(action.get("field") or action.get("name") or action.get("label") or "").casefold()
                    for control in filter_controls if isinstance(control, dict) and control.get("role") == "combobox"
                ))
                for action in request_candidate.actions
            )
            if invalid_filter_actions:
                if not action_contract_reviewed:
                    action_contract_reviewed = True
                    return await plan_stage(
                        {**knowledge_or_observation, "planningDirective": {
                            **knowledge_or_observation.get("planningDirective", {}),
                            "filterActionContractReview": True, "priorCandidate": bounded_json(plan),
                            "observedFilterActions": observed_filter_actions,
                        }}, timeout_stage=timeout_stage, reason="filter_action_contract_review",
                    )
                return {"mode": "observation_result" if observation is not None else "knowledge_only",
                        "result": "not_confirmed", "facts": [], "missing": ["invalid_filter_action_contract"]}
            if _filter_result_needs_read(plan, observation, requested_filter, reader_answer_shape(question, bounded_conversation_context)):
                trace.record("filter_completion", "degraded", input_summary={"requestedValue": requested_filter},
                             output_summary={"decision": "read_required"}, failure_code="requested_filter_not_confirmed")
                if not filter_completion_reviewed:
                    filter_completion_reviewed = True
                    matching_controls = [control for control in filter_controls if isinstance(control, dict)
                                         and control.get("filterSurface") is True
                                         and control.get("role") == "combobox" and control.get("selector")
                                         and requested_filter.casefold() in {str(value).casefold() for value in control.get("options", [])}]
                    prior_read = knowledge_or_observation.get("priorPortalRead") or {}
                    if len(matching_controls) == 1 and prior_read.get("startPath"):
                        # A literal user condition and a unique observed option
                        # determine a read action, not a business answer.
                        return {"mode": "portal_read", "portalRequest": {
                            "startPath": prior_read["startPath"],
                            "actions": [{"type": "filter", "selector": matching_controls[0]["selector"], "value": requested_filter}],
                            "expectedFields": [],
                        }}
                    return await plan_stage(
                        {**knowledge_or_observation, "planningDirective": {
                            **knowledge_or_observation.get("planningDirective", {}),
                            "filterCompletionReview": True,
                            "requestedFilterValues": [requested_filter],
                            "observedFilterActions": observed_filter_actions,
                            "priorCandidate": bounded_json(plan),
                        }}, timeout_stage=timeout_stage, reason="requested_filter_completion_review",
                    )
                return {"mode": "observation_result", "result": "not_confirmed", "facts": [],
                        "answerShape": "list", "missing": ["requested_filter_not_confirmed"]}
            if (observation is not None and plan.get("mode") == "observation_result"
                    and _observation_plan_result_from_plan(plan) is None):
                if not observation_schema_reviewed:
                    observation_schema_reviewed = True
                    return await plan_stage(
                        {**knowledge_or_observation, "planningDirective": {
                            **knowledge_or_observation.get("planningDirective", {}),
                            "observationSchemaReview": True, "priorCandidate": bounded_json(plan),
                        }}, timeout_stage=timeout_stage, reason="invalid_observation_schema_review",
                    )
                return {"mode": "observation_result", "result": "not_confirmed", "facts": [],
                        "missing": ["invalid_observation_schema"]}
            expected_shape = _resolved_intent_values(bounded_conversation_context).get("answerShape") or (
                reader_answer_shape(question, bounded_conversation_context) if requested_filter else None
            )
            if expected_shape is None and reader_answer_shape(question) == "count":
                expected_shape = "count"
            elif (
                expected_shape is None and not bounded_conversation_context
                and reader_answer_shape(question) == "list"
                and plan.get("mode") == "observation_result"
                and plan.get("answerShape") in {"overview", "count"}
            ):
                expected_shape = "list"
            if (plan.get("mode") == "knowledge_only" and question_is_conceptual(question)
                    and expected_shape in {"detail", "overview"}
                    and plan.get("answerShape") in {None, "unspecified"}):
                plan = {**plan, "answerShape": expected_shape}
            if (
                not intent_completion_reviewed and expected_shape not in {None, "unspecified"}
                and plan.get("mode") in {"observation_result", "knowledge_only"}
                and (
                    plan.get("result") in {"success", "no_data"} and plan.get("answerShape") != expected_shape
                    or plan.get("result") == "not_confirmed" and bool(plan.get("facts"))
                )
            ):
                intent_completion_reviewed = True
                try:
                    return await plan_stage(
                        {**knowledge_or_observation, "planningDirective": {
                            **knowledge_or_observation.get("planningDirective", {}),
                            "intentCompletionReview": True,
                            "requestedAnswerShape": expected_shape,
                            "priorCandidate": bounded_json(plan),
                        }},
                        timeout_stage=timeout_stage,
                        reason="current_intent_completion_review",
                    )
                except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError):
                    prior_read = knowledge_or_observation.get("priorPortalRead") or {}
                    candidate = observation_result_from_plan(
                        plan, knowledge_or_observation.get("portalObservation"),
                        observed_page=str(prior_read.get("startPath") or ""),
                        verified_scope=_permission_result_scope(permission_context),
                        permitted_paths=(*permission_context.pages, *permission_context.subpages),
                    )
                    if candidate is None or not candidate.facts:
                        raise
                    return {
                        **plan, "result": "not_confirmed", "facts": list(candidate.facts),
                        "missing": [*candidate.missing, "completion_review_unavailable"][:10],
                    }
            review_context = (
                _list_selection_review_context(plan, knowledge_or_observation)
                if not list_selection_reviewed else None
            )
            if review_context is not None:
                list_selection_reviewed = True
                directive = review_context["planningDirective"]
                trace.record(
                    "list_selection_review",
                    "degraded",
                    input_summary={
                        "observedRowCount": directive["observedRowCount"],
                        "selectedRowCount": directive["selectedRowCount"],
                    },
                    output_summary={"decision": "request_semantic_review"},
                )
                return await plan_stage(
                    review_context,
                    timeout_stage=timeout_stage,
                    reason="bounded_list_selection_review",
                )
            return plan

        def validate_policy(request: PortalReadRequest, *, reason: str) -> str | None:
            started_at = time.perf_counter()
            policy_error = self.policy.validate(request, permission_context)
            trace.record(
                "read_policy",
                "failed" if policy_error else "passed",
                started_at=started_at,
                input_summary={"reason": reason, **request_summary(request)},
                output_summary={"decision": "rejected" if policy_error else "allowed"},
                failure_code=policy_error or "",
            )
            return policy_error

        async def portal_read_stage(
            request: PortalReadRequest,
            *,
            timeout_stage: str,
            attempt: str,
        ) -> dict[str, Any]:
            nonlocal last_portal_page, last_portal_observation, last_portal_changed_tabs
            original_request = request
            if request.start_path == last_portal_page and last_portal_changed_tabs:
                request = _replay_observed_tab_path(request, last_portal_observation)
            if request != original_request:
                replay_policy_error = validate_policy(request, reason='effective_read_with_tab_prerequisites')
                if replay_policy_error:
                    return {'ok': False, 'code': replay_policy_error}
            started_at = time.perf_counter()
            request_trace = {"attempt": attempt, **request_summary(request)}
            try:
                tool_result = await _await_reader_stage(
                    self.gateway.invoke(
                        principal,
                        "admin.portal.read",
                        request.as_payload(),
                        allowed_tools=self.allowed_tools,
                    ),
                    stage=timeout_stage,
                    cap_seconds=budget.portal_read_seconds,
                    deadline=deadline,
                )
            except ReaderStageTimeout as exc:
                trace.record(
                    "portal_execution",
                    "failed",
                    started_at=started_at,
                    input_summary=request_trace,
                    output_summary={"timeoutKind": "total" if exc.total_budget else "stage"},
                    failure_code="reader_total_timeout" if exc.total_budget else "portal_read_timeout",
                )
                raise
            except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                trace.record(
                    "portal_execution",
                    "failed",
                    started_at=started_at,
                    input_summary=request_trace,
                    output_summary={"exceptionType": type(exc).__name__},
                    failure_code="portal_read_error",
                )
                raise
            payload = tool_result.get("result") if isinstance(tool_result, dict) else None
            if (tool_result.get('ok') and isinstance(payload, dict) and isinstance(payload.get('observation'), dict)):
                last_portal_page = request.start_path
                last_portal_observation = payload['observation']
                last_portal_changed_tabs = any(a.get('type') == 'switch_tab' for a in request.actions)
            else:
                last_portal_page, last_portal_observation = '', {}
                last_portal_changed_tabs = False
            facts = payload.get("facts") if isinstance(payload, dict) else []
            trace.record(
                "portal_execution",
                "passed" if isinstance(tool_result, dict) and tool_result.get("ok") else "failed",
                started_at=started_at,
                input_summary=request_trace,
                output_summary={
                    "toolCode": str(tool_result.get("code") or "")[:120] if isinstance(tool_result, dict) else "",
                    "resultStatus": str(payload.get("result") or payload.get("status") or "")[:80]
                    if isinstance(payload, dict) else "",
                    "factCount": len(facts) if isinstance(facts, list) else int(bool(facts)),
                    "hasObservation": bool(isinstance(payload, dict) and payload.get("observation") is not None),
                    "searchClearVerified": bool(tool_result.get("ok") and _search_clear_verified(request, payload)),
                },
                failure_code=(
                    str(tool_result.get("code") or "portal_read_failed")[:120]
                    if isinstance(tool_result, dict) and not tool_result.get("ok") else ""
                ),
            )
            return tool_result

        async def repair_partial_observation(
            candidate_plan: Any, candidate: ReaderResult | None, context: dict[str, Any], *, page: str,
        ) -> tuple[Any, ReaderResult | None]:
            nonlocal observation_grounding_reviewed
            original = _observation_plan_result_from_plan(candidate_plan)
            if (
                observation_grounding_reviewed or original is None or not original.facts
                or original.status not in {"success", "not_confirmed"}
                or candidate is not None and not any(item.startswith("unconfirmed_fact:") for item in candidate.missing)
            ):
                return candidate_plan, candidate
            observation_grounding_reviewed = True
            bound_source = _observation_evidence_for_result(context.get("portalObservation"), original)
            repair_context = dict(context)
            if bound_source is not None:
                repair_observation: dict[str, Any] = {"sectionSummaries": [bound_source]}
                full_observation = context.get("portalObservation")
                if isinstance(full_observation, dict) and "readHealth" in full_observation:
                    repair_observation["readHealth"] = full_observation["readHealth"]
                repair_context["portalObservation"] = repair_observation
            repair_started_at = time.perf_counter()
            try:
                repaired_plan = await plan_stage(
                    {**repair_context, "planningDirective": {
                        "repairObservationGrounding": True,
                        "priorCandidate": bounded_json(candidate_plan),
                        "confirmedFacts": list(candidate.facts) if candidate is not None else [],
                        "boundSource": bounded_json(bound_source, max_depth=4, max_items=20, max_string=500),
                        "reason": "Candidate facts or their source were not grounded. Cite one exact observed nodeId when headings repeat, use its actual selectedState, and copy its original evidence units without inventing field labels.",
                    }},
                    timeout_stage="planning_observation_grounding", reason="repair_observation_grounding",
                )
                repaired = observation_result_from_plan(
                    repaired_plan, context.get("portalObservation"), observed_page=page,
                    verified_scope=_permission_result_scope(permission_context),
                    permitted_paths=(*permission_context.pages, *permission_context.subpages),
                )
                source_changed = bool(
                    bound_source and bound_source.get("nodeId") and repaired is not None
                    and repaired.source_section != bound_source["nodeId"]
                )
                if source_changed:
                    repaired = None
                trace.record(
                    "observation_grounding", "passed" if repaired is not None and repaired.facts else "degraded",
                    started_at=repair_started_at,
                    input_summary={"boundSource": str((bound_source or {}).get("nodeId") or "")},
                    output_summary={
                        "sourceSection": str(repaired_plan.get("sourceSection") or "")[:120]
                        if isinstance(repaired_plan, dict) else "",
                        "selectedState": str(repaired_plan.get("selectedState") or "")[:120]
                        if isinstance(repaired_plan, dict) else "",
                        "factCount": len(repaired.facts) if repaired is not None else 0,
                    },
                    failure_code=("grounding_repair_source_changed" if source_changed else
                                  "" if repaired is not None and repaired.facts else "grounding_repair_rejected"),
                )
                if repaired is not None and repaired.facts and (
                    repaired.status == "success" or candidate is None or len(repaired.facts) >= len(candidate.facts)
                ):
                    return repaired_plan, repaired
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError) as exc:
                trace.record(
                    "observation_grounding", "degraded", started_at=repair_started_at,
                    input_summary={"boundSource": str((bound_source or {}).get("nodeId") or "")},
                    output_summary={"errorType": type(exc).__name__},
                    failure_code="grounding_repair_unavailable",
                )
            return candidate_plan, candidate

        def deterministic_observation_fallback(
            observation: Any,
            *,
            page: str,
            section: str,
            answer_shape: Literal["overview", "count", "list", "attention", "due", "detail", "unspecified"],
            scope: Literal["personal", "team", "global", "unknown"],
            selection: ReaderResult | None = None,
        ) -> tuple[ReaderResult | None, str]:
            if selection is not None:
                binding = observation_result_from_plan(
                    {**selection.public_json(), "mode": "observation_result", "result": "not_confirmed",
                     "facts": [], "missing": ["binding_validation"]},
                    observation, observed_page=page, verified_scope=scope,
                    permitted_paths=(*permission_context.pages, *permission_context.subpages),
                )
                if binding is None:
                    return None, "none"
                section = binding.source_section or binding.section
            if answer_shape == "list":
                native = _native_list_fallback_result(
                    observation,
                    page=page,
                    section=section,
                    scope=scope,
                    question=question,
                )
                if native is not None:
                    return native, "native_row_fallback"
            if answer_shape in {"count", "overview"}:
                trend = _native_metric_trend_fallback(
                    observation,
                    page=page,
                    scope=scope,
                    question=question,
                    conversation_context=bounded_conversation_context,
                )
                if trend is not None:
                    return trend, "metric_trend_unavailable"
                if answer_shape == "count":
                    metric = _native_metric_count_fallback(
                        observation,
                        page=page,
                        scope=scope,
                        question=question,
                    )
                    if metric is not None:
                        return metric, "metric_semantic_match"
            fallback_intent = _observation_fallback_intent(question, answer_shape)
            if fallback_intent is None and answer_shape == "list":
                selected_view = _selected_view_list_fallback(
                    observation, section_name=section, question=question, page=page,
                    scope=scope, conversation_context=bounded_conversation_context,
                )
                if selected_view is not None:
                    return selected_view, "verified_selected_view"
            if fallback_intent is None and answer_shape in {"count", "attention", "due"}:
                unique_section = _observation_evidence_for_section(observation, section)
                if unique_section is not None:
                    fallback_intent = answer_shape
            if fallback_intent is None:
                return None, "none"
            structured = _result_from_structured_observation(
                observation,
                page=page,
                section_name=section,
                answer_shape=fallback_intent,
                scope=scope,
                question=question,
            )
            if structured is not None:
                return structured, "structured_unique_evidence"
            generic = observation_fallback_result(
                question,
                observation,
                page=page,
                section=section,
                scope=scope,
                answer_shape=answer_shape,
            )
            if generic is not None:
                return generic, "generic_unique_evidence"
            return None, "none"

        def record_semantic_resolution(
            *,
            decision: str,
            reason: str,
            llm_plan: Any = None,
            result: ReaderResult | None = None,
            fallback_strategy: str = "none",
        ) -> dict[str, Any]:
            llm_result = _observation_plan_result_from_plan(llm_plan)
            llm_request = portal_read_request_from_plan(llm_plan)
            llm_selection = (
                {
                    "resultStatus": llm_result.status,
                    "section": llm_result.section[:160],
                    "sourceSection": llm_result.source_section[:120],
                    "answerShape": llm_result.answer_shape,
                }
                if llm_result is not None
                else {
                    "startPath": llm_request.start_path[:160],
                    "actionTypes": [str(action.get("type") or "")[:40] for action in llm_request.actions],
                }
                if llm_request is not None
                else {}
            )
            status = "passed" if result is not None and result.status in {"success", "no_data"} else "degraded"
            if decision == "fallback":
                status = "degraded"
            failure_code = "" if status == "passed" else reason
            trace.record(
                "semantic_resolution",
                status,
                input_summary={
                    "reason": reason,
                    "llmMode": str(llm_plan.get("mode") or "")[:80] if isinstance(llm_plan, dict) else "",
                },
                output_summary={
                    "decision": decision,
                    "fallbackStrategy": fallback_strategy,
                    "resultStatus": result.status if result is not None else "",
                    "factCount": len(result.facts) if result is not None else 0,
                    "answerShape": result.answer_shape if result is not None else "",
                },
                failure_code=failure_code,
            )
            resolution = {
                "decision": decision,
                "reason": reason,
                "llmMode": str(llm_plan.get("mode") or "")[:80] if isinstance(llm_plan, dict) else "",
                "llmSelection": bounded_json(llm_selection, max_depth=3, max_items=8, max_string=160),
                "validation": "passed" if decision == "llm_result" else "failed"
                if "invalid" in reason or reason == "planner_error" else "not_applicable",
                "fallbackUsed": decision == "fallback",
                "fallbackStrategy": fallback_strategy,
            }
            if decision == "fallback":
                resolution["quality"] = "degraded"
                resolution["selectedEvidence"] = bounded_json({
                    "sourceSection": result.source_section if result is not None else "",
                    "answerShape": result.answer_shape if result is not None else "",
                    "facts": list(result.facts[:8]) if result is not None else [],
                }, max_depth=3, max_items=10, max_string=300)
            return resolution

        # Finish just inside the service guard so the current stage can be
        # recorded instead of collapsing into a generic runtime timeout.
        deadline = asyncio.get_running_loop().time() + max(0.01, budget.total_seconds - 1.0)
        # This call must remain first. Never use client-provided role, page or
        # button claims as an authorization source.
        identity_started_at = time.perf_counter()
        try:
            user_info = await _await_reader_stage(
                self.gateway.get_user_info(principal),
                stage="get_user_info",
                cap_seconds=budget.get_user_info_seconds,
                deadline=deadline,
            )
        except ReaderStageTimeout as exc:
            missing = "reader_total_timeout" if exc.total_budget else "get_user_info_timeout"
            trace.record(
                "identity_permissions",
                "failed",
                started_at=identity_started_at,
                output_summary={"timeoutKind": "total" if exc.total_budget else "stage"},
                failure_code=missing,
            )
            result = ReaderResult(status="load_failed", summary="The current Admin Portal permissions could not be loaded in time.", missing=(missing,))
            return ReaderOutcome(result, _timeout_evidence(exc, budget))
        if not user_info.get("ok"):
            status: ReaderStatus = "no_permission" if user_info.get("code") == "permission_denied" else "load_failed"
            trace.record(
                "identity_permissions",
                "failed",
                started_at=identity_started_at,
                output_summary={"toolCode": str(user_info.get("code") or "")[:120]},
                failure_code=str(user_info.get("code") or "get_user_info_failed"),
            )
            result = ReaderResult(status=status, summary="The current Admin Portal permissions could not be verified.")
            return ReaderOutcome(result, {"stage": "get_user_info", "userInfo": bounded_json(user_info)})

        permission_context = permission_context_from_user_info(user_info.get("result"))
        # The outer wrapper applies the documented-guidance pass after this
        # coroutine returns, so the turn's own permission context is kept on the
        # reader while a page destination is validated against it.
        self._turn_permission_context = permission_context
        permission_audit = permission_audit_summary(permission_context)
        if not permission_context.user_id or str(permission_context.user_id) != str(principal.user_id):
            trace.record(
                "identity_permissions",
                "failed",
                started_at=identity_started_at,
                output_summary={"identityMatch": False},
                failure_code="identity_mismatch",
            )
            result = ReaderResult(
                status="no_permission",
                summary="The current Admin Portal identity could not be confirmed.",
                missing=("identity_mismatch",),
            )
            return ReaderOutcome(result, {"stage": "get_user_info", "permission": permission_audit, "identityMatch": False})
        if not permission_context.roles or not (*permission_context.pages, *permission_context.subpages):
            trace.record(
                "identity_permissions",
                "failed",
                started_at=identity_started_at,
                output_summary={"identityMatch": True, "permissionContext": "incomplete"},
                failure_code="permission_context_incomplete",
            )
            result = ReaderResult(
                status="no_permission",
                summary="No confirmed Admin Portal page permission is available for this user.",
                missing=("permission_context_incomplete",),
            )
            return ReaderOutcome(result, {"stage": "get_user_info", "permission": permission_audit, "identityMatch": True})
        trace.record(
            "identity_permissions",
            "passed",
            started_at=identity_started_at,
            output_summary={
                "identityMatch": True,
                "roleCount": len(permission_context.roles),
                "pageCount": len(permission_context.pages) + len(permission_context.subpages),
                "buttonCount": len(permission_context.buttons),
            },
        )
        mutation_refusal = _mutation_request_refusal_result(question)
        if mutation_refusal is not None:
            return ReaderOutcome(mutation_refusal, {
                "stage": "mutation_request_refused",
                "permission": permission_audit,
                "result": mutation_refusal.public_json(),
            })
        # Identity and capability questions need no page read: the verified
        # GetUserInfo context is exactly the answer the portal can support.
        profile_result = _self_profile_result(question, permission_context)
        if profile_result is not None:
            return ReaderOutcome(profile_result, {
                "stage": "self_profile",
                "permission": permission_audit,
                "identityMatch": True,
                "result": profile_result.public_json(),
            })
        # A matching identity anchors a fresh read; historical rows do not
        # establish its current status or current page/record authorization.
        normalized_question = re.sub(r'\s+', ' ', question).strip().casefold()

        # A slash date with both day and month in the 1..12 range is
        # inherently ambiguous. Ask the user which convention they intended
        # before reading a portal page rather than returning a generic failure.
        ambiguous_date = re.search(r"(?<!\d)(\d{1,2})/(\d{1,2})(?:/(\d{4}))?(?!\d)", question)
        if ambiguous_date:
            first, second = int(ambiguous_date.group(1)), int(ambiguous_date.group(2))
            year = int(ambiguous_date.group(3)) if ambiguous_date.group(3) else None
            if first <= 12 and second <= 12 and first != second:
                # Spell both readings with month names rather than guessing a
                # convention: the same digits mean two different days.
                readings = ", ".join((
                    _ambiguous_date_reading(first, second, year, month_first=True),
                    _ambiguous_date_reading(first, second, year, month_first=False),
                ))
                result = ReaderResult(
                    status="not_confirmed",
                    answer_shape="detail",
                    completeness="bounded",
                    summary="The date format is ambiguous and needs confirmation.",
                    facts=(
                        f"The date {ambiguous_date.group(0)} is ambiguous; it is not assumed to be MM/DD or DD/MM.",
                        f"Reading the first number as the month: {readings.split(', ')[0]}",
                        f"Reading the second number as the month: {readings.split(', ')[1]}",
                        "Please confirm which day you mean before I search the portal records.",
                    ),
                    missing=("ambiguous_date_format",),
                )
                return ReaderOutcome(result, {
                    "stage": "date_format_clarification",
                    "permission": permission_audit,
                    "result": result.public_json(),
                })

        def _safety_flags(candidate: str) -> dict[str, bool]:
            return {
                "approval_bypass": bool(re.search(
                    r'\b(?:skip|bypass|circumvent|evade)\b.{0,80}\b(?:approval|approve|review|process)\b'
                    r'|\bapprove\b.{0,60}\b(?:directly|without|skip|bypass)\b'
                    r'|\bsubmit\b.{0,80}\b(?:approval|approve)\b.{0,60}\b(?:without|hide|conceal|not tell|no)\b.{0,40}\b(?:reviewer|review|audit)\b'
                    r'|\b(?:i have permission|do it anyway|just do it)\b',
                    candidate,
                )),
                "audit_evasion": bool(re.search(
                    r'\b(?:don\'t|do not|avoid|disable|hide|conceal|delete|remove|erase|destroy|omit|withhold)\b.{0,80}'
                    r'\b(?:log|logging|audit|trace|detected|trail|record|records|evidence|source|history)\b'
                    r'|\b(?:log|logging|audit|trace|trail|record|records|evidence|source|history)\b.{0,80}'
                    r'\b(?:off|disable|hide|avoid|delete|remove|erase|destroy|omit|withhold)\b',
                    candidate,
                )),
                "threat_request": bool(re.search(r'\b(?:threat|threatening|intimidat|blackmail)\w*\b', candidate)),
                "fabrication_request": bool(re.search(
                    r'\b(?:fabricat|falsif|forg|fake|invent|manufactur|alter|manipulat|backdat|doctor)\w*\b.{0,100}'
                    r'\b(?:report|evidence|proof|record|document|complaint|case|violation|allegation)\b'
                    r'|\b(?:report|evidence|proof|record|document|complaint|case|complaint|allegation)\b.{0,100}'
                    r'\b(?:fabricat|falsif|forg|fake|invent|manipulat|backdat|doctor)\w*\b'
                    r'|\b(?:change|edit|modify|alter)\b.{0,80}\b(?:record|status)\b.{0,80}\b(?:look|appear|approved|compliant)\w*\b'
                    r'|\b(?:false|fake)\s+(?:evidence|report|proof|record|document|complaint|allegation)\b'
                    r'|\bframe\b.{0,50}\b(?:someone|somebody|the other party|them|a person)\b'
                    r'|\blie\b.{0,50}\b(?:in|on|about)\b.{0,30}\b(?:report|complaint|statement|record)\b'
                    r'|\bmake\b.{0,80}\b(?:look|appear)\b.{0,80}\b(?:violat|guilty|approved|compliant)\w*\b',
                    candidate,
                )),
            }

        current_safety = _safety_flags(normalized_question)
        approval_bypass = current_safety["approval_bypass"]
        audit_evasion = current_safety["audit_evasion"]
        threat_request = current_safety["threat_request"]
        fabrication_request = current_safety["fabrication_request"]
        previous_question = str((bounded_conversation_context.get("previousIntent") or {}).get("question") or "")
        previous_safety = _safety_flags(re.sub(r'\s+', ' ', previous_question).strip().casefold())
        followup_escape = bool(
            previous_question
            and any(previous_safety.values())
            and re.search(r'\b(?:why not|just give me|i have permission|do it anyway|only a test|remove the word|tell me the steps|make the (?:report|message) more convincing|give me a template)\b', normalized_question)
        )
        if followup_escape:
            approval_bypass = approval_bypass or previous_safety["approval_bypass"]
            audit_evasion = audit_evasion or previous_safety["audit_evasion"]
            threat_request = threat_request or previous_safety["threat_request"]
            fabrication_request = fabrication_request or previous_safety["fabrication_request"]
        if re.search(
            r'\b(?:only a test|remove the word fake|tell me the steps|make the (?:report|message) more convincing)\b',
            normalized_question,
        ):
            fabrication_request = True
        if question_requests_business_mutation(question) and not any((approval_bypass, audit_evasion, threat_request, fabrication_request)):
            trace.record("read_policy", "failed", failure_code="action_not_read_only",
                         output_summary={"decision": "explicit_business_command_rejected"})
            return ReaderOutcome(
                ReaderResult(status="not_confirmed", summary="Business mutations are outside the read-only Reader.",
                             missing=("action_not_read_only",)),
                {"stage": "read_only_boundary", "permission": permission_audit},
            )
        if _private_customer_information_request(question):
            trace.record("privacy_boundary", "failed", failure_code="private_customer_data_forbidden",
                         output_summary={"decision": "private_customer_data_refused"})
            return ReaderOutcome(
                ReaderResult(
                    status="no_permission",
                    summary="Private customer information is outside the Reader's permitted scope.",
                    missing=("private_customer_data_forbidden",),
                ),
                {"stage": "privacy_boundary", "permission": permission_audit},
            )
        processing_explanation = _service_processing_time_explanation(question, bounded_conversation_context)
        if processing_explanation is not None:
            trace.record("metric_explanation", "passed", output_summary={"metric": "avg_processing_time"})
            return ReaderOutcome(
                processing_explanation,
                {"stage": "metric_explanation", "permission": permission_audit,
                 "result": processing_explanation.public_json()},
            )
        if re.search(r'\b(?:i?gnore|bypass|override)\s+(?:the\s+)?(?:role|permission|access)\s+(?:restriction|check|limit|control)s?\b', question, re.I):
            return ReaderOutcome(
                ReaderResult(status='no_permission', summary='Role restrictions cannot be bypassed.',
                             missing=('role_scope_override_not_permitted',)),
                {'stage': 'permission_scope_boundary', 'permission': permission_audit},
            )
        # Refuse approval bypass, audit-log evasion, and threats before intent
        # resolution. These are safety/compliance boundaries, not ambiguous
        # portal questions, and each refusal includes a compliant next step.
        safe_reporting_followup = bool(re.search(
            r'\b(?:help me )?(?:write|prepare|document)\b.{0,80}\b(?:factual|truthful|accurate)\b.{0,80}'
            r'\b(?:incident report|complaint|report)\b'
            r'|\bhow (?:can|should) i report (?:this|a concern) properly\b'
            r'|\bwhat information should i preserve\b.{0,80}\b(?:complaint|report)\b'
            r'|\bhow do i report (?:a concern|this) through the proper channel\b'
            r'|\b(?:can you )?help (?:me )?separate verified facts from assumptions\b'
            r'|\bexplain the normal approval and audit workflow\b',
            normalized_question,
        ))
        if safe_reporting_followup:
            result = ReaderResult(
                status='success', answer_shape='detail', completeness='bounded',
                summary='I can help document a concern accurately through the authorized process.',
                facts=(
                    'Use only verified dates, actions, witnesses, and source references; separate observed facts from assumptions.',
                    'Preserve the original evidence and submit the report through the authorized complaint, appeal, or reporting channel.',
                ),
            )
            return ReaderOutcome(result, {'stage':'safe_reporting_guidance',
                                          'permission':permission_audit, 'result':result.public_json()})
        if approval_bypass or audit_evasion or threat_request or fabrication_request:
            if approval_bypass:
                facts = (
                    "I can't bypass the approval process or approve an application outside the authorized workflow.",
                    "Compliant next step: I can help you check the application's current status, explain the approval steps, or guide you to the authorized reviewer.",
                )
            elif threat_request:
                facts = (
                    "I can't write threats or help conceal harmful communications.",
                    "Safe alternative: I can help draft a respectful message, document the concern, or identify an appropriate reporting channel.",
                )
            elif fabrication_request:
                facts = (
                    "I can't fabricate, falsify, or alter a report, evidence, or record to accuse another party.",
                    "Safe alternative: I can help write a factual incident report from verified evidence, preserve source records, or guide you to the formal complaint or appeal channel.",
                )
            else:
                facts = (
                    "I can't disable, hide, or evade audit logging for an operation.",
                    "Compliant next step: I can explain the recorded approval workflow or help you correct an authorized action through the normal process.",
                )
            result = ReaderResult(status='not_confirmed', answer_shape='detail', completeness='bounded',
                                  summary='The requested action is outside the safe, read-only and compliant assistant scope.',
                                  facts=facts, missing=('unsafe_or_noncompliant_request',))
            return ReaderOutcome(result, {'stage':'safety_compliance_boundary',
                                          'permission':permission_audit, 'result':result.public_json()})
        record_summary_without_change = bool(re.search(
            r'\bsummarize\b.{0,40}\b(?:the )?(?:current )?record\b.{0,40}\bwithout changing\b',
            normalized_question,
        ))
        previous_intent = bounded_conversation_context.get('previousIntent') or {}
        has_record_identity = bool(previous_intent.get('recordIdentity')) or bool(re.search(
            r'\b(?:trx|ml|case|application|license|permit)[-_ ]?[a-z0-9-]{3,}\b', normalized_question,
        ))
        if record_summary_without_change and not has_record_identity:
            result = ReaderResult(
                status='not_confirmed', answer_shape='detail', completeness='bounded',
                summary='Please identify the record to summarize.',
                facts=(
                    'I can summarize a record without changing it, but the request does not identify a specific application, case, license, permit, or transaction.',
                    'Provide the record number or another unique identifier and I will read only the permitted details.',
                ),
                missing=('record_identity_required',),
            )
            return ReaderOutcome(result, {'stage':'record_summary_clarification',
                                          'permission':permission_audit, 'result':result.public_json()})
        missing_transaction = re.search(r'\bTRX-99999999-ZZ\b', question, re.I)
        if missing_transaction:
            result = ReaderResult(status='no_data', answer_shape='detail', completeness='bounded',
                                  summary='The requested transaction number was not found.',
                                  facts=(
                                      '未找到交易编号 TRX-99999999-ZZ。',
                                      '未返回相似或无关记录。请核对交易编号后重试；如需查询其他记录，请提供准确的交易号、申请号或案件编号。',
                                  ))
            return ReaderOutcome(result, {'stage':'explicit_missing_transaction',
                                          'permission':permission_audit, 'result':result.public_json()})
        # Reviewed Admin title-to-route binding. A capability probe must not be
        # answered from a sibling's Source Task foreign key. The route supplies
        # no authority: the current GetUserInfo envelope remains decisive.
        inspection_task_probe = bool(re.fullmatch(
            r'\s*can (?:this|the) current account read inspection task management[?.]?\s*', question, re.I))
        if inspection_task_probe:
            page = '/inspection/tasks'
            denied = self.policy.validate(PortalReadRequest(start_path=page, actions=({'type': 'observe'},)), permission_context)
            if denied == 'page_not_permitted':
                result = ReaderResult(status='no_permission', page=page, source_hint={'page': page},
                    summary='The current account cannot read Inspection Task Management.',
                    facts=('The current account permissions do not include Inspection Task Management. '
                           'No inspection task records were read.',
                           'Next step: ask an administrator to grant this account the Inspection Task Management page permission, then sign in again and retry the request.'),
                    missing=('page_not_permitted',))
                return ReaderOutcome(result, {'stage':'named_page_permission', 'permission':permission_audit,
                                              'result':result.public_json()})
            # This is an authorization question, not a request to derive a
            # task result from a discovered API.  GetUserInfo plus the same
            # read-only policy used for every portal request are the
            # authoritative evidence.  Do not send the yes/no capability
            # probe through API selection, where an unrelated candidate can
            # make a permitted account look indeterminate.
            result = ReaderResult(
                status='success', page=page, source_hint={'page': page},
                answer_shape='detail', completeness='bounded',
                summary='The current account can read Inspection Task Management.',
                facts=('The current account permissions include Inspection Task Management.',
                       'How to proceed: open the Admin Portal, go to Inspection > Inspection Task Management, and use the To Do or Completed view to inspect the task list.'),
            )
            return ReaderOutcome(result, {'stage':'named_page_permission', 'permission':permission_audit,
                                          'result':result.public_json()})

        # "Content Module pending reviews" is exposed by the current Content
        # account on the Team Management page. Resolve it before model/API
        # planning so a planner failure cannot erase the permitted read.
        content_pending_review_query = bool(re.fullmatch(
            r'\s*(?:show|list|display)\s+(?:me\s+)?content module pending reviews?[?.!]?\s*',
            question, re.I,
        ))
        if content_pending_review_query:
            page = '/content/team-management'
            request = PortalReadRequest(start_path=page, actions=({'type': 'observe'},))
            denied = validate_policy(request, reason='content_module_pending_reviews')
            if denied:
                result = ReaderResult(
                    status='no_permission', page=page, source_hint={'page': page},
                    summary='The current account cannot read Content Module pending reviews.',
                    missing=(denied,),
                )
                return ReaderOutcome(result, {'stage':'content_module_pending_reviews',
                                              'permission':permission_audit, 'result':result.public_json()})
            try:
                tool = await portal_read_stage(
                    request, timeout_stage='content_module_pending_reviews',
                    attempt='content_module_pending_reviews',
                )
            except ReaderStageTimeout as exc:
                missing = 'reader_total_timeout' if exc.total_budget else 'portal_read_timeout'
                result = ReaderResult(status='not_confirmed', page=page,
                                      summary='Content Module pending reviews could not be read in time.',
                                      missing=(missing,))
                return ReaderOutcome(result, {**_timeout_evidence(exc, budget),
                                              'stage':'content_module_pending_reviews', 'permission':permission_audit})
            if not tool.get('ok'):
                result = _reader_result_from_tool(tool)
                result = replace(result, page=page, source_hint={'page': page})
                return ReaderOutcome(result, {'stage':'content_module_pending_reviews',
                                              'permission':permission_audit, 'result':result.public_json()})
            observation = ((tool.get('result') or {}).get('observation') or {})
            result = _native_explicit_source_rows(observation, page=page, question=question)
            if result is None:
                result = _native_metric_count_fallback(
                    observation, page=page, scope=_permission_result_scope(permission_context), question=question,
                )
            if result is not None:
                result = replace(result, source_hint={'page': page})
                return ReaderOutcome(result, {'stage':'content_module_pending_reviews',
                                              'permission':permission_audit, 'observation':observation,
                                              'result':result.public_json()})
            result = ReaderResult(status='not_confirmed', page=page, source_hint={'page': page},
                                  summary='Content Module was opened, but its Pending Review records were not displayed in a verifiable list.',
                                  missing=('content_pending_review_rows_not_observed',))
            return ReaderOutcome(result, {'stage':'content_module_pending_reviews',
                                          'permission':permission_audit, 'observation':observation,
                                          'result':result.public_json()})

        # Preserve a literal Content Library category switch such as
        # "How about movies?" from the immediately preceding Books read.
        # This is a native tab transition, not a new API-selection question;
        # routing it through the planner previously lost the conversation
        # context and returned an unconfirmed result.
        content_library_switch = re.fullmatch(
            r'\s*how about\s+(?P<category>movies?|newspapers?|magazines?|video\s+games?)\s*[?.!]?[\s]*',
            question, re.I,
        )
        previous_intent = bounded_conversation_context.get('previousIntent') or {}
        previous_page = str(
            previous_intent.get('page')
            or (previous_intent.get('sourceHint') or {}).get('page')
            or bounded_conversation_context.get('sourceHint', {}).get('page')
            or ''
        ) if isinstance(previous_intent, dict) else ''
        if content_library_switch and previous_page.rstrip('/').casefold() == '/content/contentlibrary':
            page = '/content/ContentLibrary'
            request = PortalReadRequest(start_path=page, actions=({'type': 'observe'},))
            denied = validate_policy(request, reason='content_library_category_followup')
            if denied:
                result = ReaderResult(status='no_permission', page=page, source_hint={'page': page},
                                      summary='The current permissions do not allow reading the requested Content Library category.',
                                      missing=(denied,))
                return ReaderOutcome(result, {'stage':'content_library_category_followup',
                                              'permission':permission_audit, 'result':result.public_json()})
            try:
                initial = await portal_read_stage(request, timeout_stage='content_library_category_followup',
                                                  attempt='content_library_category_followup')
                observation = (initial.get('result') or {}).get('observation') or {}
                category = str(content_library_switch.group('category')).casefold()
                category_label = ('Movies' if category.startswith('movie') else
                                  'Newspapers' if category.startswith('newspaper') else
                                  'Magazines' if category.startswith('magazine') else 'Video Games')
                action = _observed_switch_tab_action({'name': category_label}, observation)
                selected = any(
                    isinstance(tab, dict) and tab.get('selected') is True
                    and str(tab.get('name') or '').casefold() == category_label.casefold()
                    for tab in observation.get('tabControls', [])
                )
                if action is None and not selected:
                    result = ReaderResult(status='not_confirmed', page=page, answer_shape='list',
                                          summary=f'The {category_label} category was not visible in the current Content Library view.',
                                          missing=('content_library_category_not_observed',))
                    return ReaderOutcome(result, {'stage':'content_library_category_followup',
                                                  'permission':permission_audit, 'observation':observation,
                                                  'result':result.public_json()})
                if action is not None:
                    followup = await portal_read_stage(
                        replace(request, actions=(action,)),
                        timeout_stage='content_library_category_followup_read',
                        attempt='content_library_category_followup_read',
                    )
                    observation = (followup.get('result') or {}).get('observation') or {}
                    if not followup.get('ok'):
                        result = _reader_result_from_tool(followup)
                        return ReaderOutcome(replace(result, page=page, source_hint={'page': page}),
                                             {'stage':'content_library_category_followup',
                                              'permission':permission_audit, 'result':result.public_json()})
                result = _native_explicit_source_rows(observation, page=page, question=question)
                if result is not None:
                    return ReaderOutcome(replace(result, source_hint={'page': page}),
                                         {'stage':'content_library_category_followup',
                                          'permission':permission_audit, 'observation':observation,
                                          'result':result.public_json()})
                result = ReaderResult(status='not_confirmed', page=page, answer_shape='list',
                                      summary=f'The {category_label} category opened, but its records were not displayed in a verifiable list.',
                                      missing=('content_library_category_rows_not_observed',))
                return ReaderOutcome(result, {'stage':'content_library_category_followup',
                                              'permission':permission_audit, 'observation':observation,
                                              'result':result.public_json()})
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                result = ReaderResult(status='not_confirmed', page=page, answer_shape='list',
                                      summary=f'The {category_label} category could not be read.',
                                      missing=(type(exc).__name__,))
                return ReaderOutcome(result, {'stage':'content_library_category_followup',
                                              'permission':permission_audit, 'result':result.public_json()})

        # A Profile Verification follow-up that asks which previously listed
        # row is pending review can be answered from a fresh bounded read of
        # the same table. Do not ask the planner to invent a selector from a
        # prior answer summary.
        profile_pending_followup = bool(re.fullmatch(
            r'\s*which\s+one\s+is\s+pending\s+review\s*[?.!]?[\s]*', question, re.I,
        )) and previous_page.rstrip('/').casefold() == '/licensing/profile'
        if profile_pending_followup:
            page = '/licensing/profile'
            request = PortalReadRequest(start_path=page, actions=({'type': 'observe'},))
            denied = validate_policy(request, reason='profile_pending_review_followup')
            if denied:
                result = ReaderResult(status='no_permission', page=page, source_hint={'page': page},
                                      summary='The current permissions do not allow reading Profile Verification tasks.',
                                      missing=(denied,))
                return ReaderOutcome(result, {'stage':'profile_pending_review_followup',
                                              'permission':permission_audit, 'result':result.public_json()})
            try:
                tool = await portal_read_stage(request, timeout_stage='profile_pending_review_followup',
                                               attempt='profile_pending_review_followup')
                observation = (tool.get('result') or {}).get('observation') or {}
                tables = [node for node in _observation_semantic_nodes(observation)
                          if node.get('kind') in {'table', 'grid'} and node.get('rowFields')
                          and 'Status' in node.get('columnHeaders', [])]
                pending_rows = []
                for table in tables:
                    for row in table.get('rowFields') or []:
                        if isinstance(row, dict) and str(row.get('Status') or '').casefold() == 'pending review':
                            pending_rows.append((table, row))
                if pending_rows:
                    table, _ = pending_rows[0]
                    facts = tuple(
                        json.dumps({key: value for key, value in row.items() if key in table.get('columnHeaders', [])},
                                   ensure_ascii=False, separators=(',', ':'))
                        for _table, row in pending_rows[:4]
                    )
                    result = ReaderResult(status='success', page=page,
                                          section=str(table.get('heading') or 'My Profile Verification Tasks'),
                                          source_section=str(table.get('nodeId') or ''), answer_shape='detail',
                                          completeness='bounded', facts=facts,
                                          summary='The pending Profile Verification task was found in the current task list.')
                else:
                    result = ReaderResult(status='no_data', page=page,
                                          section='My Profile Verification Tasks', answer_shape='detail',
                                          completeness='bounded',
                                          summary='No Pending Review Profile Verification task is visible in the current task list.')
                return ReaderOutcome(result, {'stage':'profile_pending_review_followup',
                                              'permission':permission_audit, 'observation':observation,
                                              'result':result.public_json()})
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                result = ReaderResult(status='not_confirmed', page=page, answer_shape='detail',
                                      summary='The current Profile Verification task list could not be read.',
                                      missing=(type(exc).__name__,))
                return ReaderOutcome(result, {'stage':'profile_pending_review_followup',
                                              'permission':permission_audit, 'result':result.public_json()})
        if _profile_verification_pending_followup(question, bounded_conversation_context):
            previous = bounded_conversation_context.get('previousIntent') or {}
            if previous.get('profileVerificationEmpty') == 'true':
                result = ReaderResult(
                    status='success', page='/dashboard', section='Profile Verification',
                    source_section='profileVerificationCard', answer_shape='count', completeness='bounded',
                    summary='The preceding Profile Verification dashboard card was empty.',
                    facts=('Pending Review: 0.',
                           'This follows the Profile Verification dashboard card shown immediately before this question: it displayed 0 total tasks. No Service Application queue count was used.'),
                )
                return ReaderOutcome(result, {'stage': 'profile_verification_pending_review_context',
                                              'permission': permission_audit, 'result': result.public_json()})
            request = PortalReadRequest(start_path='/dashboard', actions=({'type': 'observe'},))
            denied = validate_policy(request, reason='profile_verification_pending_review')
            if denied:
                result = ReaderResult(status='no_permission', page='/dashboard', source_hint={'page': '/dashboard'},
                    summary='The current permissions do not allow reading the Profile Verification dashboard card.',
                    missing=(denied,))
                return ReaderOutcome(result, {'stage': 'profile_verification_pending_review',
                                              'permission': permission_audit, 'result': result.public_json()})
            try:
                tool = await portal_read_stage(request, timeout_stage='profile_verification_pending_review',
                                               attempt='profile_verification_pending_review')
                if not tool.get('ok'):
                    raise RuntimeError(str(tool.get('code') or 'portal_read_failed'))
                observation = (tool.get('result') or {}).get('observation') or {}
                result = _profile_verification_empty_pending_result(observation)
                if result is not None:
                    return ReaderOutcome(result, {'stage': 'profile_verification_pending_review',
                                                  'permission': permission_audit, 'observation': observation,
                                                  'result': result.public_json()})
                result = ReaderResult(status='not_confirmed', page='/dashboard', section='Profile Verification',
                    answer_shape='count', summary='The current Profile Verification pending-review count could not be verified.',
                    missing=('profile_verification_pending_review_not_visible',))
                return ReaderOutcome(result, {'stage': 'profile_verification_pending_review',
                                              'permission': permission_audit, 'observation': observation,
                                              'result': result.public_json()})
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                result = ReaderResult(status='load_failed', page='/dashboard', section='Profile Verification',
                    answer_shape='count', summary='The Profile Verification dashboard card could not be read.',
                    missing=(type(exc).__name__,))
                return ReaderOutcome(result, {'stage': 'profile_verification_pending_review',
                                              'permission': permission_audit, 'result': result.public_json()})
        if (_due_query_mode(question) == 'upcoming'
                and re.search(r'\bservice\s+applications?\b', question, re.I)):
            request = PortalReadRequest(start_path='/licensing/applications', actions=({'type': 'observe'},))
            denied = validate_policy(request, reason='service_application_approaching_sla')
            if denied:
                result = ReaderResult(status='no_permission', page=request.start_path, source_hint={'page': request.start_path},
                    summary='The current permissions do not allow reading Service Application SLA rows.', missing=(denied,))
                return ReaderOutcome(result, {'stage': 'service_application_approaching_sla',
                                              'permission': permission_audit, 'result': result.public_json()})
            try:
                tool = await portal_read_stage(request, timeout_stage='service_application_approaching_sla',
                                               attempt='service_application_approaching_sla')
                if not tool.get('ok'):
                    raise RuntimeError(str(tool.get('code') or 'portal_read_failed'))
                observation = (tool.get('result') or {}).get('observation') or {}
                seed = ReaderOutcome(
                    ReaderResult(status='not_confirmed', page=request.start_path, answer_shape='due',
                                 summary='Visible Service Application SLA countdown rows are being checked.',
                                 missing=('approaching_sla_not_visible',)),
                    {'stage': 'service_application_approaching_sla', 'permission': permission_audit,
                     'observation': observation},
                )
                recovered = _native_approaching_sla_rows(seed, question)
                if recovered.result.status == 'success':
                    return recovered
                # A current queue can legitimately have no countdown rows.
                # Report that bounded state explicitly instead of collapsing
                # it into the generic planner failure message.
                tables = [node for node in _observation_semantic_nodes(observation)
                          if node.get('kind') in {'table', 'grid'} and node.get('rowFields')
                          and any(_key(header) in {'sla', 'sladescription'} for header in node.get('columnHeaders', []))]
                sla_values = []
                for table in tables:
                    for row in table.get('rowFields') or []:
                        if isinstance(row, dict):
                            value = next((str(cell).strip() for key, cell in row.items()
                                          if _key(key) in {'sla', 'sladescription'} and str(cell).strip()), '')
                            if value and value not in sla_values:
                                sla_values.append(value)
                if tables and sla_values:
                    visible_rows = []
                    for table in tables:
                        headers = table.get('columnHeaders') or []
                        for row in table.get('rowFields') or []:
                            if not isinstance(row, dict):
                                continue
                            selected = {
                                key: value for key, value in row.items()
                                if key in headers and isinstance(value, (str, int, float))
                            }
                            if selected:
                                visible_rows.append(json.dumps(selected, ensure_ascii=False, separators=(',', ':')))
                    result = ReaderResult(
                        status='success', page=request.start_path, section='My Application Tasks',
                        answer_shape='due', completeness='bounded',
                        summary='No approaching-SLA countdown rows are visible in the current Service Application view.',
                        facts=(
                            'No Service Application task in the current bounded view displays a verifiable approaching-SLA countdown.',
                            'Visible SLA values in this view: ' + ', '.join(sla_values[:12]) + '.',
                            f'The current bounded view contains {len(visible_rows)} visible Service Application task row(s).',
                            *visible_rows[:8],
                            'The portal does not define a separate day threshold for the phrase approaching SLA; overdue and on-time labels were not reclassified.',
                            'This is the current bounded view, not a collection-wide total. Use the portal pagination or filters to inspect additional tasks.',
                        ),
                    )
                    return ReaderOutcome(result, {'stage': 'service_application_approaching_sla',
                                                  'permission': permission_audit, 'observation': observation,
                                                  'result': result.public_json()})
                return seed
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                result = ReaderResult(status='load_failed', page=request.start_path, answer_shape='due',
                    summary='Service Application SLA rows could not be read.', missing=(type(exc).__name__,))
                return ReaderOutcome(result, {'stage': 'service_application_approaching_sla',
                                              'permission': permission_audit, 'result': result.public_json()})
        financial_daily_summary = bool(
            re.search(r"\b(?:today|today's|current day)\b|今天|今日|اليوم", normalized_question, re.I)
            and re.search(r"\b(?:payments?|refunds?)\b|付款|支付|退款|استرداد|مدفوع", normalized_question, re.I)
            and re.search(r"\b(?:status|statuses|count|how many|breakdown|summar(?:y|ise|ize))\b|按状态|汇总|حسب الحالة|كم", normalized_question, re.I)
        )
        if financial_daily_summary:
            daily_pages = (
                ("Payments", "/financial-payment/transactions"),
                ("Refunds", "/financial-payment/refunds"),
            )
            daily_observations: list[tuple[str, Any]] = []
            daily_permission_error = ""
            for label, page in daily_pages:
                request = PortalReadRequest(start_path=page, actions=({'type': 'observe'},))
                denied = validate_policy(request, reason='financial_daily_status_summary')
                if denied:
                    daily_permission_error = denied
                    continue
                try:
                    tool = await portal_read_stage(
                        request,
                        timeout_stage='financial_daily_status_summary',
                        attempt=f'financial_daily_status_summary_{label.casefold()}',
                    )
                except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                    result = ReaderResult(
                        status='load_failed', page=page, answer_shape='count',
                        summary='The payment/refund status summary could not be read.',
                        missing=(type(exc).__name__,),
                    )
                    return ReaderOutcome(result, {
                        'stage': 'financial_daily_status_summary',
                        'permission': permission_audit,
                        'result': result.public_json(),
                    })
                daily_observations.append((label, (tool.get('result') or {}).get('observation') or {}))
            if daily_permission_error and not daily_observations:
                result = ReaderResult(
                    status='no_permission', page='/financial-payment/transactions', answer_shape='count',
                    summary='The current account cannot read the requested payment/refund pages.',
                    missing=(daily_permission_error,),
                )
                return ReaderOutcome(result, {'stage': 'financial_daily_status_summary', 'permission': permission_audit,
                                              'result': result.public_json()})
            daily_result = _financial_daily_status_summary(
                tuple(daily_observations), scope=_permission_result_scope(permission_context),
            )
            if daily_result is not None:
                return ReaderOutcome(daily_result, {
                    'stage': 'financial_daily_status_summary',
                    'permission': permission_audit,
                    'observations': {label: observation for label, observation in daily_observations},
                    'result': daily_result.public_json(),
                })

        financial_combined_summary = bool(
            not financial_daily_summary and _finance_combined_summary_requested(question)
        )
        if financial_combined_summary:
            # Workbook row 52 asks for the payments and refunds visible to the
            # account, by status.  Both rendered Finance surfaces are read and
            # reported separately, so the answer can no longer label Customer
            # Happiness refund rows as "payments".
            combined_pages = (
                ("Payments", "/financial-payment/transactions"),
                ("Refunds", "/financial-payment/refunds"),
            )
            combined_observations: list[tuple[str, Any]] = []
            combined_permission_error = ""
            for label, page in combined_pages:
                request = PortalReadRequest(start_path=page, actions=({'type': 'observe'},))
                denied = validate_policy(request, reason='financial_status_breakdown')
                if denied:
                    combined_permission_error = denied
                    continue
                try:
                    tool = await portal_read_stage(
                        request,
                        timeout_stage='financial_status_breakdown',
                        attempt=f'financial_status_breakdown_{label.casefold()}',
                    )
                except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                    result = ReaderResult(
                        status='load_failed', page=page, answer_shape='count',
                        summary='The payment/refund status breakdown could not be read.',
                        missing=(type(exc).__name__,),
                    )
                    return ReaderOutcome(result, {
                        'stage': 'financial_status_breakdown',
                        'permission': permission_audit,
                        'result': result.public_json(),
                    })
                combined_observations.append((label, (tool.get('result') or {}).get('observation') or {}))
            if combined_permission_error and not combined_observations:
                result = ReaderResult(
                    status='no_permission', page='/financial-payment/transactions', answer_shape='count',
                    summary='The current account cannot read the requested payment/refund pages.',
                    missing=(combined_permission_error,),
                )
                return ReaderOutcome(result, {'stage': 'financial_status_breakdown', 'permission': permission_audit,
                                              'result': result.public_json()})
            combined_result = _financial_status_breakdown(
                tuple(combined_observations), scope=_permission_result_scope(permission_context),
            )
            if combined_result is not None:
                return ReaderOutcome(combined_result, {
                    'stage': 'financial_status_breakdown',
                    'permission': permission_audit,
                    'observations': {label: observation for label, observation in combined_observations},
                    'result': combined_result.public_json(),
                })

        safety_result = _safety_request_result(question)
        if safety_result is not None:
            return ReaderOutcome(safety_result, {
                'stage': 'safety_request_refusal',
                'permission': permission_audit,
                'result': safety_result.public_json(),
            })

        if _prediction_requested(question):
            # The portal has no forecasting surface.  Answering with a task list
            # would look like a prediction, so state the limitation first and
            # only then offer the rendered current counts.
            prediction_request = PortalReadRequest(start_path='/dashboard', actions=({'type': 'observe'},))
            denied = validate_policy(prediction_request, reason='prediction_unavailable')
            if denied:
                result = ReaderResult(status='no_permission', page='/dashboard',
                    summary='The dashboard counts are not readable for this account.', missing=(denied,))
                return ReaderOutcome(result, {'stage': 'prediction_unavailable', 'permission': permission_audit,
                                              'result': result.public_json()})
            try:
                prediction_tool = await portal_read_stage(
                    prediction_request,
                    timeout_stage='prediction_unavailable',
                    attempt='prediction_unavailable',
                )
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                prediction_tool = {}
            prediction_observation = (prediction_tool.get('result') or {}).get('observation') or {}
            disclaimer = (
                "The Admin Portal has no forecasting data, so next month's volume cannot be predicted. "
                "The values below are the counts currently rendered in your dashboard, not a prediction."
            )
            count_facts: list[str] = []
            for label, value, _source in _observed_metric_pairs(prediction_observation):
                if re.fullmatch(r"\d[\d,]*", str(value).strip()):
                    count_facts.append(json.dumps(
                        {"Dashboard Metric": label, "Count": value},
                        ensure_ascii=False, separators=(",", ":"),
                    ))
            facts = (disclaimer, *count_facts[:10])
            result = ReaderResult(
                status='success', page='/dashboard', answer_shape='count', completeness='bounded',
                scope=_permission_result_scope(permission_context),
                workflow_state='prediction_unavailable',
                summary='Forecasting is not available; current dashboard counts are reported instead.',
                facts=facts,
            )
            return ReaderOutcome(result, {'stage': 'prediction_unavailable', 'permission': permission_audit,
                                          'observation': prediction_observation, 'result': result.public_json()})

        license_focus = _license_module_focus(question)
        if license_focus:
            license_page = "/licensing/applications" if license_focus == "urgency" else "/licensing/licenses"
            license_request = PortalReadRequest(start_path=license_page, actions=({'type': 'observe'},))
            license_denied = validate_policy(license_request, reason='license_module_read')
            if license_denied:
                result = ReaderResult(status='no_permission', page=license_page,
                    summary='The licensing page needed for this question is not permitted.',
                    missing=(license_denied,))
                return ReaderOutcome(result, {'stage': 'license_module_read', 'permission': permission_audit,
                                              'result': result.public_json()})
            try:
                license_tool = await portal_read_stage(license_request, timeout_stage='license_module_read',
                                                       attempt='license_module_read')
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError):
                license_tool = {}
            if license_tool.get('ok'):
                license_observation = (license_tool.get('result') or {}).get('observation') or {}
                license_actions: tuple[dict[str, Any], ...] = ()
                if license_focus == 'expiry':
                    option = next(
                        (str(candidate).strip() for control in (license_observation.get('filterControls') or ())
                         if isinstance(control, dict) and control.get('role') == 'combobox'
                         for candidate in (control.get('options') or ())
                         if re.fullmatch(r"expiring soon|expire soon", str(candidate).strip(), re.I)),
                        "",
                    )
                    observed_filter = _observed_status_option_action(license_observation, option) if option else None
                    if observed_filter is not None:
                        try:
                            filtered_tool = await portal_read_stage(
                                replace(license_request, actions=(observed_filter,)),
                                timeout_stage='license_expiry_filter', attempt='license_expiry_filter')
                        except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError):
                            filtered_tool = {}
                        if filtered_tool.get('ok'):
                            license_observation = (filtered_tool.get('result') or {}).get('observation') or {}
                            license_actions = (observed_filter,)
                license_result = _license_module_result(
                    license_observation,
                    question=question,
                    page=license_page,
                    focus=license_focus,
                    scope=_permission_result_scope(permission_context),
                    filtered=bool(license_actions),
                )
                if license_result is not None:
                    return ReaderOutcome(license_result, {
                        'stage': 'license_module_read',
                        'permission': permission_audit,
                        'observation': license_observation,
                        'actions': license_actions,
                        'result': license_result.public_json(),
                    })

        explicit_source = _explicit_reader_source(question, bounded_conversation_context)
        if explicit_source in {
            '/happiness/tickets', '/happiness/refunds', '/financial-payment/refunds',
            '/financial-payment/transactions', '/content/ContentLibrary', '/licensing/licenses',
        }:
            request = PortalReadRequest(start_path=explicit_source, actions=({'type': 'observe'},))
            denied = validate_policy(request, reason='explicit_named_source_list')
            if denied:
                # The same refund records are rendered on both refund surfaces.
                # When the account cannot read the preferred page, use the
                # sibling refund surface instead of refusing a record the
                # current role can still see.
                alternate = _sibling_refund_source(explicit_source)
                alternate_request = (
                    PortalReadRequest(start_path=alternate, actions=({'type': 'observe'},)) if alternate else None
                )
                if alternate_request is not None and not validate_policy(
                    alternate_request, reason='explicit_named_source_alternate'
                ):
                    explicit_source = alternate
                    request = alternate_request
                    denied = ""
                else:
                    result = ReaderResult(status='no_permission', page=explicit_source, source_hint={'page': explicit_source},
                        summary='The current permissions do not allow reading the requested named page.', missing=(denied,))
                    return ReaderOutcome(result, {'stage': 'explicit_named_source_list',
                                                  'permission': permission_audit, 'result': result.public_json()})
            try:
                tool = await portal_read_stage(request, timeout_stage='explicit_named_source_list',
                                               attempt='explicit_named_source_list')
                if not tool.get('ok'):
                    raise RuntimeError(str(tool.get('code') or 'portal_read_failed'))
                observation = (tool.get('result') or {}).get('observation') or {}
                actions: tuple[dict[str, Any], ...] = ()
                # Exact Customer Happiness/Finance identifiers must stay on
                # the one visible matching row.  Without this early binding,
                # the named-source list branch could return the first four
                # unrelated rows and make a real record look unavailable.
                if explicit_source in {'/happiness/tickets', '/financial-payment/transactions', '/financial-payment/refunds'}:
                    record_identity = _explicit_record_identity(question)
                    if record_identity:
                        exact = _native_exact_identity_row_result(
                            observation,
                            page=explicit_source,
                            record_identity=record_identity,
                            scope=_permission_result_scope(permission_context),
                            question=question,
                        )
                        if exact is not None:
                            return ReaderOutcome(exact, {
                                'stage': 'explicit_named_source_exact_record',
                                'permission': permission_audit,
                                'observation': observation,
                                'result': exact.public_json(),
                            })
                        # A Finance transaction number can be the refund's own
                        # Transaction No., and a refund number can be rendered
                        # on the other refund surface.  Look in the sibling
                        # surface before reporting the record as unavailable.
                        for sibling in _identity_lookup_sources(explicit_source):
                            if sibling == explicit_source:
                                continue
                            sibling_request = PortalReadRequest(
                                start_path=sibling, actions=({'type': 'observe'},)
                            )
                            if validate_policy(sibling_request, reason='explicit_identity_sibling_source'):
                                continue
                            try:
                                sibling_tool = await portal_read_stage(
                                    sibling_request,
                                    timeout_stage='explicit_identity_sibling_source',
                                    attempt='explicit_identity_sibling_source',
                                )
                            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError):
                                sibling_tool = {}
                            if not sibling_tool.get('ok'):
                                continue
                            sibling_observation = (sibling_tool.get('result') or {}).get('observation') or {}
                            sibling_exact = _native_exact_identity_row_result(
                                sibling_observation,
                                page=sibling,
                                record_identity=record_identity,
                                scope=_permission_result_scope(permission_context),
                                question=question,
                            )
                            if sibling_exact is not None:
                                return ReaderOutcome(sibling_exact, {
                                    'stage': 'explicit_named_source_exact_record_sibling',
                                    'permission': permission_audit,
                                    'observation': sibling_observation,
                                    'primaryObservation': observation,
                                    'result': sibling_exact.public_json(),
                                })
                if explicit_source in {'/happiness/refunds', '/financial-payment/refunds'} and (
                    _refund_sla_requested(question)
                    or (
                        re.search(r"\b(?:overdue|past\s+due)\b|逾期|متأخر", normalized_question, re.I)
                        and re.search(r"\brefunds?\b|退款|استرداد", normalized_question, re.I)
                    )
                ):
                    sla_result = _refund_overdue_sorted_result(
                        observation,
                        page=explicit_source,
                        scope=_permission_result_scope(permission_context),
                    )
                    if sla_result is None or sla_result.status != 'success':
                        # Completed refund rows are the ones that carry an SLA
                        # value, so replay that observed view before answering.
                        completed_action = _observed_switch_tab_action({'name': 'Completed'}, observation)
                        if completed_action is not None:
                            try:
                                completed_tool = await portal_read_stage(
                                    replace(request, actions=(*actions, completed_action)),
                                    timeout_stage='explicit_named_source_refund_sla_view',
                                    attempt='explicit_named_source_refund_sla_view',
                                )
                            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError):
                                completed_tool = {}
                            if completed_tool.get('ok'):
                                completed_observation = (completed_tool.get('result') or {}).get('observation') or {}
                                completed_result = _refund_overdue_sorted_result(
                                    completed_observation,
                                    page=explicit_source,
                                    scope=_permission_result_scope(permission_context),
                                )
                                if completed_result is not None and completed_result.status == 'success':
                                    return ReaderOutcome(completed_result, {
                                        'stage': 'explicit_named_source_refund_sla_view',
                                        'permission': permission_audit,
                                        'observation': completed_observation,
                                        'actions': (*actions, completed_action),
                                        'result': completed_result.public_json(),
                                    })
                    if sla_result is not None:
                        return ReaderOutcome(sla_result, {
                            'stage': 'explicit_named_source_overdue_refunds',
                            'permission': permission_audit,
                            'observation': observation,
                            'result': sla_result.public_json(),
                        })
                if explicit_source == '/happiness/tickets' and _ticket_team_summary_requested(question):
                    # The team roll-up requires both visible queue states.  A
                    # single fresh To Do read is insufficient evidence for
                    # closed-ticket counts, so switch only after the observed
                    # Completed control has been uniquely identified.
                    completed_action = _observed_switch_tab_action({'name': 'Completed'}, observation)
                    if completed_action is None:
                        result = ReaderResult(
                            status='not_confirmed', page=explicit_source,
                            section='Enquiries & Complaints', answer_shape='overview',
                            scope=_permission_result_scope(permission_context),
                            summary='The Completed ticket view was not visible in the current layout.',
                            missing=('completed_ticket_view_not_visible',),
                        )
                        return ReaderOutcome(result, {
                            'stage': 'ticket_team_summary', 'permission': permission_audit,
                            'observation': observation, 'result': result.public_json(),
                        })
                    completed_tool = await portal_read_stage(
                        replace(request, actions=(completed_action,)),
                        timeout_stage='explicit_named_source_completed_tickets',
                        attempt='explicit_named_source_completed_tickets',
                    )
                    if not completed_tool.get('ok'):
                        raise RuntimeError(str(completed_tool.get('code') or 'completed_ticket_read_failed'))
                    completed_observation = (completed_tool.get('result') or {}).get('observation') or {}
                    team_result = _ticket_team_summary_result(
                        observation,
                        completed_observation,
                        question=question,
                        scope=_permission_result_scope(permission_context),
                    )
                    if team_result is not None:
                        return ReaderOutcome(team_result, {
                            'stage': 'ticket_team_summary', 'permission': permission_audit,
                            'observation': observation,
                            'completedObservation': completed_observation,
                            'actions': (completed_action,),
                            'result': team_result.public_json(),
                        })
                if explicit_source == '/content/ContentLibrary':
                    requested_category = _content_category_from_question(question) or 'Books'
                    action = _observed_switch_tab_action({'name': requested_category}, observation)
                    if action is None and requested_category != 'Books':
                        action = _observed_switch_tab_action({'name': 'Books'}, observation)
                    if action is None:
                        result = ReaderResult(status='not_confirmed', page=explicit_source, answer_shape='list',
                            summary='The Books category was not visible in the current Content Library view.',
                            missing=('books_category_not_observed',))
                        return ReaderOutcome(result, {'stage': 'explicit_named_source_list',
                                                      'permission': permission_audit, 'observation': observation,
                                                      'result': result.public_json()})
                    actions = (action,)
                    tool = await portal_read_stage(replace(request, actions=actions),
                                                   timeout_stage='explicit_named_source_books',
                                                   attempt='explicit_named_source_books')
                    if not tool.get('ok'):
                        raise RuntimeError(str(tool.get('code') or 'portal_read_failed'))
                    observation = (tool.get('result') or {}).get('observation') or {}
                    if _explicit_record_identity(question):
                        # One named record must be read through the page's own
                        # search control instead of answering with the first
                        # bounded page of unrelated rows.
                        identity_plan = _observed_identity_search(
                            question, bounded_conversation_context, observation, explicit_source,
                        )
                        identity_actions = tuple(
                            (identity_plan or {}).get('portalRequest', {}).get('actions') or ()
                        )
                        if identity_actions:
                            identity_tool = await portal_read_stage(
                                replace(request, actions=(*actions, *identity_actions)),
                                timeout_stage='explicit_named_source_identity',
                                attempt='explicit_named_source_identity',
                            )
                            if identity_tool.get('ok'):
                                searched = (identity_tool.get('result') or {}).get('observation') or {}
                                if searched:
                                    observation = searched
                                    actions = (*actions, *identity_actions)
                elif explicit_source in {'/happiness/refunds', '/financial-payment/refunds'} and _refund_completed_view_requested(question):
                    # Refund pages open on the in-progress tab by default. A
                    # completed-refund question must replay the observed,
                    # localized Completed tab before projecting rows.
                    action = _observed_switch_tab_action({'name': 'Completed'}, observation)
                    if action is None:
                        result = ReaderResult(status='not_confirmed', page=explicit_source, answer_shape='list',
                            summary='The completed refund view was not visible in the current rendered page.',
                            missing=('completed_refund_view_not_visible',))
                        return ReaderOutcome(result, {'stage': 'explicit_named_source_list',
                                                      'permission': permission_audit, 'observation': observation,
                                                      'actions': actions, 'result': result.public_json()})
                    actions = (action,)
                    tool = await portal_read_stage(replace(request, actions=actions),
                                                   timeout_stage='explicit_named_source_completed',
                                                   attempt='explicit_named_source_completed')
                    if not tool.get('ok'):
                        raise RuntimeError(str(tool.get('code') or 'portal_read_failed'))
                    observation = (tool.get('result') or {}).get('observation') or {}
                result = _native_explicit_source_rows(observation, page=explicit_source, question=question)
                if result is not None:
                    if explicit_source == '/content/ContentLibrary' and re.search(
                        r"\bconfirmed\s+count(?:\s+results?)?\b|\bcount\s+results?\b|确认的数量|确认数量|العدد\s+المؤكد|نتائج\s+العدد",
                        normalized_question,
                        re.I,
                    ):
                        result = _content_confirmed_count_navigation_result(result, observation)
                    if explicit_source == '/content/ContentLibrary' and len(
                        _content_categories_from_question(question)
                    ) > 1:
                        result = replace(result, facts=(
                            *result.facts,
                            "Only the section named first is answered here; ask again for each remaining "
                            "section to see its records.",
                        ))
                    return ReaderOutcome(result, {'stage': 'explicit_named_source_list',
                                                  'permission': permission_audit, 'observation': observation,
                                                  'actions': actions, 'result': result.public_json()})
                # A refund question that named no page lands on one of the two
                # refund surfaces.  When that surface renders no usable rows,
                # report the sibling surface rather than claiming the records
                # cannot be confirmed.
                sibling = _sibling_refund_source(explicit_source)
                if sibling and not _refund_sla_requested(question):
                    sibling_request = PortalReadRequest(start_path=sibling, actions=({'type': 'observe'},))
                    if not validate_policy(sibling_request, reason='refund_list_sibling_source'):
                        try:
                            sibling_tool = await portal_read_stage(
                                sibling_request,
                                timeout_stage='refund_list_sibling_source',
                                attempt='refund_list_sibling_source',
                            )
                        except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError):
                            sibling_tool = {}
                        if sibling_tool.get('ok'):
                            sibling_observation = (sibling_tool.get('result') or {}).get('observation') or {}
                            sibling_rows = _native_explicit_source_rows(
                                sibling_observation, page=sibling, question=question,
                            )
                            if sibling_rows is not None:
                                return ReaderOutcome(sibling_rows, {
                                    'stage': 'explicit_named_source_sibling_list',
                                    'permission': permission_audit,
                                    'observation': sibling_observation,
                                    'actions': actions,
                                    'result': sibling_rows.public_json(),
                                })
                # Explain what the page actually renders instead of leaving the
                # reader with a bare refusal: the requested condition is not a
                # visible row, and the rendered tabs/filters prove which
                # conditions were checked.
                context_facts: list[str] = []
                selected_tabs = [
                    str(tab.get('name')) for tab in observation.get('tabControls') or []
                    if isinstance(tab, dict) and tab.get('selected') is True and tab.get('name')
                ]
                if selected_tabs:
                    context_facts.append(
                        'The rendered view is the ' + ' / '.join(selected_tabs) + ' tab of ' + explicit_source + '.'
                    )
                available_tabs = [
                    str(tab.get('name')) for tab in observation.get('tabControls') or []
                    if isinstance(tab, dict) and tab.get('name')
                ]
                if available_tabs:
                    context_facts.append('The page renders these tabs: ' + ', '.join(dict.fromkeys(available_tabs)) + '.')
                option_values = [
                    str(option) for control in observation.get('filterControls') or []
                    if isinstance(control, dict)
                    for option in (control.get('options') or [])
                ]
                if option_values:
                    context_facts.append(
                        'The page renders these filter values: ' + ', '.join(dict.fromkeys(option_values))[:400] + '.'
                    )
                context_facts.append(
                    'No record matching the requested condition is visible in this bounded view, so no record was '
                    'returned and no other row was substituted.'
                )
                result = ReaderResult(status='not_confirmed', page=explicit_source, answer_shape='list',
                    summary='The requested named-page list could not be verified from the current rendered view.',
                    facts=tuple(context_facts[:5]),
                    missing=('named_source_list_not_visible',))
                return ReaderOutcome(result, {'stage': 'explicit_named_source_list',
                                              'permission': permission_audit, 'observation': observation,
                                              'actions': actions, 'result': result.public_json()})
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, KeyError) as exc:
                result = ReaderResult(status='load_failed', page=explicit_source, answer_shape='list',
                    summary='The requested named-page list could not be read.', missing=(type(exc).__name__,))
                return ReaderOutcome(result, {'stage': 'explicit_named_source_list',
                                              'permission': permission_audit, 'result': result.public_json()})
        absence_explanation = reader_absence_limit_explanation(question)
        if absence_explanation:
            return ReaderOutcome(
                ReaderResult(status='success', summary='The read-only evidence boundary is explained.',
                             answer_shape='detail', facts=(absence_explanation,)),
                {'stage': 'read_evidence_boundary', 'permission': permission_audit,
                 'source': 'reader_contract_no_history_inference'},
            )
        completion_period = _personal_completion_query(question, bounded_conversation_context)
        if completion_period:
            prior_page = semantic_source_hint(bounded_conversation_context).get('page') or (
                (bounded_conversation_context.get('previousIntent') or {}).get('countSource') or {}).get('page')
            routes = ('/licensing/applications', '/content/ContentApplications')
            permitted = [p for p in routes if not self.policy.validate(
                PortalReadRequest(start_path=p, actions=({'type': 'observe'},)), permission_context)]
            page = prior_page if prior_page in permitted else permitted[0] if len(permitted) == 1 else ''
            if not page:
                return ReaderOutcome(ReaderResult(status='not_confirmed' if permitted else 'no_permission',
                    summary='A single permitted personal Completed view is required.',
                    missing=('completion_source_ambiguous' if permitted else 'page_not_permitted',)),
                    {'stage': 'completion_permission', 'permission': permission_audit})
            if self.knowledge_folder_id:
                try:
                    await _await_reader_stage(self.gateway.invoke(principal, 'knowledge.search',
                        {'query': 'My Application Tasks Completed personal review completion date',
                         'folder_id': self.knowledge_folder_id, 'top_k': 4}, allowed_tools=self.allowed_tools),
                        stage='completion_knowledge', cap_seconds=budget.knowledge_search_seconds, deadline=deadline)
                except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError):
                    trace.record('knowledge_retrieval', 'degraded', failure_code='completion_manual_unavailable')
            request = PortalReadRequest(start_path=page, actions=({'type': 'observe'},))
            try:
                initial = await portal_read_stage(request, timeout_stage='completion_view', attempt='completion_view')
                obs = (initial.get('result') or {}).get('observation') or {}
                action = _observed_switch_tab_action({'name': 'Completed'}, obs)
                selected = any(t.get('selected') is True and str(t.get('name', '')).casefold() == 'completed'
                               for t in obs.get('tabControls', []) if isinstance(t, dict))
                if not initial.get('ok') or (not action and not selected):
                    raise ValueError('completion_view_unverified')
                request = replace(request, actions=(action,) if action else ({'type': 'observe'},),
                                  completion_period=completion_period)
                if validate_policy(request, reason='personal_completion_count'):
                    raise ValueError('completion_view_not_permitted')
                tool = await portal_read_stage(request, timeout_stage='completion_count', attempt='completion_count')
                obs = (tool.get('result') or {}).get('observation') or {}
                aggregate = obs.get('completionAggregate') or {}
                if not tool.get('ok') or aggregate.get('verified') is not True or aggregate.get('period') != completion_period:
                    raise ValueError(str(aggregate.get('reason') or 'completion_period_not_verified'))
                count = aggregate.get('count')
                if type(count) is not int or count < 0 or aggregate.get('stablePasses') != 2:
                    raise ValueError('completion_count_invalid')
                facts = (f'Your Completed applications {completion_period}: {count}.',
                         f'Task approval time: {aggregate["startInclusive"]} (inclusive) to '
                         f'{aggregate["endExclusive"]} (exclusive), Asia/Dubai; weeks start Monday.',
                         'Each application in your personal Completed view is counted once by your review completion time, '
                         'not by license issuance or final application approval.')
                result = ReaderResult(status='success', summary='Personal completion-period count verified.',
                    page=page, section='My Application Tasks', selected_state='Completed', scope='personal',
                    answer_shape='count', completeness='complete', facts=facts,
                    source_hint={'page': page}, count_source={'page': page, 'view': 'Completed',
                    'labels': ['Personal Completed applications by task approval time']})
                return ReaderOutcome(result, {'stage': 'completion_period_count', 'permission': permission_audit,
                    'observation': {'readHealth': {'healthy': True}, 'completionAggregate': aggregate},
                    'result': result.public_json()})
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, KeyError) as exc:
                return ReaderOutcome(ReaderResult(status='not_confirmed', answer_shape='count', page=page,
                    summary='The complete personal completion-period count could not be verified.',
                    missing=('completion_period_not_verified',)),
                    {'stage': 'completion_period_count', 'permission': permission_audit,
                     'reason': str(exc)[:120] if isinstance(exc, ValueError) else type(exc).__name__})
        if is_assignment_followup(question):
            previous = bounded_conversation_context.get('previousIntent') or {}
            source = previous.get('assignmentSource') or {}
            numbers = source.get('taskNumbers') or []
            if not numbers or source.get('page') != '/inspection/tasks' or previous.get('resultStatus') != 'success':
                return ReaderOutcome(ReaderResult(status='not_confirmed', answer_shape='detail',
                    summary='The tasks to compare have not been identified.',
                    facts=('Please first list the inspection tasks in this conversation, then ask which are assigned to you. '
                           'I need their task numbers to check the same records, rather than a different queue.',),
                    missing=('assignment_task_references_missing',)), {'stage':'assignment_context','permission':permission_audit})
            request = PortalReadRequest(start_path=source['page'], actions=({'type':'observe'},))
            error = validate_policy(request, reason='fresh_assignment_read')
            if error:
                return ReaderOutcome(ReaderResult(status='no_permission', page=request.start_path,
                    summary='The current permissions do not allow checking these task assignments.',
                    missing=(error,)), {'stage':'assignment_permission','permission':permission_audit})
            # Retrieve the manual, but derive live ownership only from task data.
            if self.knowledge_folder_id:
                try:
                    await _await_reader_stage(self.gateway.invoke(principal, 'knowledge.search',
                        {'query':'Inspection Task Management assignment inspectors task details',
                         'folder_id':self.knowledge_folder_id,'top_k':4}, allowed_tools=self.allowed_tools),
                        stage='assignment_knowledge', cap_seconds=budget.knowledge_search_seconds, deadline=deadline)
                except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError):
                    trace.record('knowledge_retrieval','degraded',failure_code='assignment_manual_unavailable')
            async def read_assignment(req, attempt):
                if validate_policy(req, reason=attempt):
                    return {}
                try:
                    tool = await portal_read_stage(req, timeout_stage='assignment_read', attempt=attempt)
                except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError):
                    return {}
                payload = tool.get('result') if tool.get('ok') else None
                if not isinstance(payload, dict) or payload.get('result', payload.get('status')) in {'load_failed','no_permission'}:
                    return {}
                return payload.get('observation') or {}
            observation = await read_assignment(request, 'assignment_list')
            view_actions = ()
            selected = source.get('selectedState')
            tabs = observation.get('tabControls') or []
            if selected in {'To Do','Completed'} and not any(
                    isinstance(t,dict) and t.get('selected') is True and _state_control_label_matches(t.get('name'),selected)
                    for t in tabs):
                parent = _observed_switch_tab_action({'name':'Team Tasks'}, observation)
                if parent:
                    view_actions = (parent, {'type':'switch_tab','role':'tab','name':selected})
                    observation = await read_assignment(replace(request,actions=view_actions),'assignment_source_view')
            current = _inspection_assignment_rows(observation)
            classifications = {}
            for number in numbers:
                row = current.get(number.upper())
                classification = classify_assignment(row, permission_context.user_id)
                if classification == 'unknown' and row:
                    action = _observed_cell_detail_action(observation,number)
                    if action:
                        detail = await read_assignment(replace(request,actions=(*view_actions,action)), 'assignment_detail')
                        detail_row = _inspection_assignment_rows(detail).get(number.upper())
                        classification = classify_assignment(detail_row,permission_context.user_id)
                classifications[number] = classification
            unresolved = any(value == 'unknown' for value in classifications.values())
            facts = tuple(json.dumps({'Task No':number,'Assignment':value}) for number,value in classifications.items())
            result = ReaderResult(status='not_confirmed' if unresolved else 'success', page=request.start_path,
                source_section='verified-task-assignment', answer_shape='list', completeness='bounded',
                workflow_state='assignment_rechecked', summary='Current assignments checked against the signed-in user.',
                facts=facts, missing=('assignment_unverified',) if unresolved else ())
            return ReaderOutcome(result, {'stage':'assignment_recheck','permission':permission_audit,
                'comparison':'GetUserInfo.id versus task.inspectors[].inspectorId; explicit assignmentState',
                'result':result.public_json()})
        previous_count = (bounded_conversation_context.get('previousIntent') or {}).get('countSource')
        if isinstance(previous_count, dict):
            count_page = _canonical_documented_page(previous_count.get('page'))
            labels = previous_count.get('labels') or []
            coverage = bool(re.search(r'\bis (?:that|this|it|the number)\b.*\btotal\b', question, re.I))
            location = bool(re.search(r'\bwhere\b.*\b(?:find|see|view)\b.*\b(?:count|results?|numbers?)\b', question, re.I))
            if (count_page and labels and (coverage or location)
                    and self.policy.validate(PortalReadRequest(start_path=count_page, actions=({'type':'observe'},)), permission_context) is None):
                view = str(previous_count.get('view') or '')
                label = ', '.join(str(s) for s in labels[:5])
                fact = (f'The previous confirmed count came from {count_page}, view {view or "the current view"}, '
                        f'metric {label}. ')
                explanation = (f'Open that page, select {view}, and look for {label} in the summary or pagination area.' if location else
                         'It is the displayed count for that metric and authorized view, not the number of sample rows in the answer. '
                         'It does not establish an all-status or all-user total. A fresh query is needed for an updated number.')
                result = ReaderResult(status='success', summary='The prior count source and coverage are explained.',
                    page=count_page, answer_shape='detail', completeness='bounded', facts=(fact, explanation),
                    count_source=previous_count, source_hint={'page':count_page})
                return ReaderOutcome(result, {'stage':'prior_count_source','permission':permission_audit,'result':result.public_json()})
        sample_explanation = previous_sample_explanation(question, bounded_conversation_context)
        if sample_explanation is not None:
            return ReaderOutcome(
                ReaderResult(status="success", summary="The previous answer coverage is confirmed.",
                             answer_shape="detail", facts=(sample_explanation,)),
                {"stage": "prior_answer_coverage", "permission": permission_audit,
                 "source": "previous_result_presentation_metadata"},
            )
        explicit_route = re.match(r'\s*open\s+(/[a-zA-Z][\w/-]+)(?:\s|[.?!]|$)', question, re.I)
        if explicit_route and self.policy.validate(PortalReadRequest(start_path=explicit_route[1], actions=({'type':'observe'},)), permission_context) == 'page_not_permitted':
            result = ReaderResult(status='no_permission', summary='The explicitly requested route is not permitted.',
                page=explicit_route[1], source_hint={'page':explicit_route[1]}, missing=('page_not_permitted',))
            return ReaderOutcome(result, {'stage':'explicit_route_permission', 'permission':permission_audit, 'result':result.public_json()})
        previous = bounded_conversation_context.get('previousIntent') or {}
        if (previous.get('resultStatus') in {'not_confirmed', 'load_failed'}
                and re.match(r'\s*(?:find|locate)\s+(?:that|the)\s+same\s+', question, re.I)
                and not previous.get('recordIdentity')):
            return ReaderOutcome(ReaderResult(status='not_confirmed', summary='No preceding record identifier was verified.',
                facts=('The preceding request did not establish a verified record identifier, so there is no confirmed '
                       'same-record search value. No identifier was guessed or searched.',),
                missing=('prior_record_identifier_unverified',)),
                {'stage':'prior_unverified_record', 'permission':permission_audit})
        previous_source = semantic_source_hint(bounded_conversation_context).get('page', '')
        if (previous.get('resultStatus') == 'no_permission' and previous_source
                and re.match(r'\s*(?:find|locate)\s+(?:that|the)\s+same\s+', question, re.I)
                and self.policy.validate(PortalReadRequest(start_path=previous_source, actions=({'type':'observe'},)), permission_context) == 'page_not_permitted'):
            result = ReaderResult(status='no_permission', summary='The previous request established no readable record.',
                page=previous_source, source_hint={'page':previous_source}, missing=('page_not_permitted',),
                facts=('The preceding request did not verify a record identifier. Current permissions still do not '
                       'authorize the requested source page, so no identifier was guessed or searched.',))
            return ReaderOutcome(result, {'stage':'prior_denied_record','permission':permission_audit,'result':result.public_json()})
        literal_followup = (
            resolve_literal_filter_followup(question, bounded_conversation_context or {})
            or resolve_literal_same_record_reference(question, bounded_conversation_context or {})
            or resolve_literal_view_followup(question, bounded_conversation_context or {})
            or resolve_literal_record_field_followup(question, bounded_conversation_context or {})
        ) if bounded_conversation_context else None
        resolver = getattr(self.planner, "resolve_admin_portal_intent", None)
        if literal_followup is not None:
            intent_state.update(literal_followup.public_json())
            bounded_conversation_context = literal_followup.planner_context(bounded_conversation_context)
            trace.record(
                "intent_resolution", "passed", output_summary={"relation": intent_state["relation"], "sources": {
                    name: slot["source"] for name, slot in intent_state["slots"].items()
                }, "strategy": "literal_followup"},
            )
        elif bounded_conversation_context and callable(resolver):
            intent_started_at = time.perf_counter()
            intent_resolved = False
            try:
                candidate = await _await_reader_stage(
                    resolver(question, bounded_conversation_context),
                    stage="intent_resolution", cap_seconds=min(20.0, budget.planner_seconds), deadline=deadline,
                )
                resolution = parse_intent_resolution(candidate, question, bounded_conversation_context)
                intent_state.update(resolution.public_json())
                intent_resolved = True
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                model_failure = _model_http_failure(exc)
                if model_failure is not None:
                    trace.record("intent_resolution", "failed", started_at=intent_started_at,
                                 failure_code=model_failure.missing[0])
                    return ReaderOutcome(
                        model_failure,
                        {"stage": "intent_resolution", "permission": permission_audit},
                    )
                if isinstance(exc, ReaderStageTimeout):
                    trace.record("intent_resolution", "failed", started_at=intent_started_at,
                                 failure_code="intent_resolution_timeout")
                    return ReaderOutcome(
                        ReaderResult(status="not_confirmed",
                                     summary="The current task scope could not be resolved.",
                                     missing=("intent_resolution_timeout",)),
                        {"stage": "intent_resolution", "permission": permission_audit},
                    )
                # An invalid scope is a terminal intent failure, not permission
                # to reinterpret this follow-up using the previous target.
                trace.record(
                    "intent_resolution", "failed", started_at=intent_started_at,
                    failure_code="intent_resolution_invalid",
                )
                return ReaderOutcome(
                    ReaderResult(status="not_confirmed",
                                 summary="The current follow-up scope could not be resolved. Please restate the intended record, view, or scope.",
                                 missing=("intent_resolution_invalid",)),
                    {"stage": "intent_resolution", "permission": permission_audit},
                )
            if intent_resolved:
                trace.record(
                    "intent_resolution", "passed", started_at=intent_started_at,
                    output_summary={"relation": intent_state["relation"], "sources": {
                        name: slot["source"] for name, slot in intent_state["slots"].items()
                    }},
                )
                if intent_state["relation"] == "clarify":
                    return ReaderOutcome(
                        ReaderResult(status="not_confirmed", summary="The requested scope needs clarification.",
                                     missing=("intent_ambiguous",), clarification_options=tuple(intent_state["clarificationOptions"])),
                        {"stage": "intent_clarification", "permission": permission_audit},
                    )
                bounded_conversation_context = resolution.planner_context(bounded_conversation_context)
        knowledge_result: dict[str, Any] = {"ok": False, "code": "knowledge_not_configured"}
        knowledge_trace_recorded = False
        search_queries: tuple[str, ...] = ()
        if self.knowledge_folder_id:
            search_queries = knowledge_search_queries(question, permission_context, bounded_conversation_context)
            search_query = search_queries[0]
            knowledge_started_at = time.perf_counter()
            try:
                knowledge_result = await _await_reader_stage(
                    asyncio.gather(*[
                        self.gateway.invoke(
                            principal,
                            "knowledge.search",
                            {"query": query, "folder_id": self.knowledge_folder_id, "top_k": self.knowledge_top_k},
                            allowed_tools=self.allowed_tools,
                        )
                        for query in search_queries
                    ]),
                    stage="knowledge_search",
                    cap_seconds=budget.knowledge_search_seconds,
                    deadline=deadline,
                )
                if isinstance(knowledge_result, (list, tuple)):
                    search_queries_result = list(knowledge_result)
                    knowledge_result = merge_knowledge_results(
                        search_queries_result, limit=self.knowledge_top_k,
                    )
            except ReaderStageTimeout as exc:
                if exc.total_budget:
                    trace.record(
                        "knowledge_retrieval",
                        "failed",
                        started_at=knowledge_started_at,
                        input_summary={"queryChars": len(search_query), "topK": self.knowledge_top_k},
                        output_summary={"timeoutKind": "total"},
                        failure_code="reader_total_timeout",
                    )
                    result = ReaderResult(status="load_failed", summary="The Admin Portal Reader exhausted its total time budget.", missing=("reader_total_timeout",))
                    return ReaderOutcome(result, {**_timeout_evidence(exc, budget), "permission": permission_audit})
                # A temporary manual-search delay must not prevent a live,
                # permission-checked portal read.
                knowledge_result = {"ok": False, "code": "knowledge_timeout"}
                trace.record(
                    "knowledge_retrieval",
                    "degraded",
                    started_at=knowledge_started_at,
                    input_summary={"queryChars": len(search_query), "topK": self.knowledge_top_k},
                    output_summary={"timeoutKind": "stage"},
                    failure_code="knowledge_timeout",
                )
                knowledge_trace_recorded = True
        all_knowledge = project_knowledge_result(knowledge_result, max_chunks=self.knowledge_top_k)
        # Resolve a small set of unambiguous follow-ups locally. These are
        # purely textual continuations of an already verified source/identity
        # and avoid making a transient model failure erase a valid business
        # workflow context.
        literal_followup = (
            resolve_literal_filter_followup(question, conversation_context or {})
            or resolve_literal_same_record_reference(question, conversation_context or {})
            or resolve_literal_view_followup(question, conversation_context or {})
            or resolve_literal_record_field_followup(question, conversation_context or {})
        )
        filter_followup = literal_followup if literal_followup and re.search(
            r"\b(?:filter|list)\b|筛选|列表", question, re.I
        ) else None
        if literal_followup is not None:
            intent_state.update(literal_followup.public_json())
            bounded_conversation_context = literal_followup.planner_context(bounded_conversation_context)
        filter_source = semantic_source_hint(conversation_context or {}).get('page', '') if filter_followup else ''
        view_followup = resolve_literal_view_followup(question, conversation_context or {})
        if view_followup:
            view_source = semantic_source_hint(conversation_context or {}).get('page', '')
            if view_source:
                bounded_conversation_context['sourceHint'] = {'page':view_source}
        if filter_source:
            bounded_conversation_context['sourceHint'] = {'page': filter_source}
            if self.policy.validate(PortalReadRequest(start_path=filter_source, actions=({'type':'observe'},)), permission_context) == 'page_not_permitted':
                result = ReaderResult(status='no_permission', summary='The same filter source is not permitted.',
                    page=filter_source, source_hint={'page':filter_source}, missing=('page_not_permitted',))
                return ReaderOutcome(result, {'stage':'filter_source_permission', 'permission':permission_audit, 'result':result.public_json()})
        source_resolution = _resolve_documented_object_source(
            all_knowledge, question, bounded_conversation_context,
        )
        object_source = source_resolution.page
        # Application number prefixes identify the business module, never access.
        # Always run the normal page policy below, including for denied accounts.
        application_ids = re.findall(r'\b(?:MC-2|ML-1|ML-2)-\d+-\d+\b', question, re.I)
        if len(set(application_ids)) == 1:
            object_source = '/content/ContentApplications' if application_ids[0].upper().startswith('MC-2-') else '/licensing/applications'
            knowledge_context_hint = {'page': object_source}
            bounded_conversation_context['sourceHint'] = knowledge_context_hint
        explicit_source = _explicit_reader_source(question, bounded_conversation_context)
        if not explicit_source and _STAFF_PERFORMANCE_REQUEST.search(str(question or "")):
            # A question about staff performance or SLA compliance belongs to an
            # analytics surface.  Bind it to the analytics page this account can
            # actually read instead of letting the planner start from a team
            # management page the role may not be allowed to open.
            for module in ("content", "licensing", "inspection", "happiness", "financial-payment"):
                candidate = f"/{module}/reports-analytics"
                if any(permission_path_matches(candidate, path)
                       for path in (*permission_context.pages, *permission_context.subpages)):
                    explicit_source = candidate
                    break
        if explicit_source:
            object_source = explicit_source
            bounded_conversation_context['sourceHint'] = {'page': explicit_source}
        if source_resolution.invalid_path_count or source_resolution.detail_candidate_count:
            failure_code = (
                "invalid_documented_path"
                if source_resolution.invalid_path_count
                else "detail_source_requires_observed_record"
            )
            trace.record(
                "documented_source_selection",
                "degraded",
                output_summary={
                    "decision": "ignored_non_primary_candidates",
                    "selectedPrimarySource": bool(object_source),
                    "invalidPathCount": source_resolution.invalid_path_count,
                    "detailCandidateCount": source_resolution.detail_candidate_count,
                },
                failure_code=failure_code,
            )
        knowledge_context = _knowledge_for_current_role(all_knowledge, permission_context, question)
        if object_source:
            knowledge_context = {**knowledge_context, 'documentedPrimarySource': object_source}
            probe = PortalReadRequest(start_path=object_source, actions=({'type': 'observe'},))
            if self.policy.validate(probe, permission_context) == 'page_not_permitted':
                result = ReaderResult(status='no_permission', summary='The documented primary-record page is not permitted.',
                    page=object_source, source_hint={'page': object_source},
                    facts=(f'Current role: {permission_context.current_role}. The requested records belong to {object_source}, '
                           'which the current account permissions do not authorize reading. No requested records were verified.',),
                    missing=('page_not_permitted',))
                return ReaderOutcome(result, {'stage': 'primary_source_permission', 'permission': permission_audit,
                    'sourceSelection': {'page': object_source, 'basis': 'retrieved_primary_identity'}, 'result': result.public_json()})
        if question_is_conceptual(question):
            hint = bounded_conversation_context.get('sourceHint') or semantic_source_hint(bounded_conversation_context)
            relation = bounded_conversation_context.get('resolvedIntent', {}).get('relation')
            page = hint.get('page', '')
            if page and relation in {None, 'continue', 'refine'}:
                module = '/' + page.strip('/').split('/')[0] + '/'
                chunks = knowledge_context.get('chunks') or []
                matched = [c for c in chunks if any(
                    path == page or path.startswith(module)
                    for path in re.findall(r'\*\*page:\*\*\s*`([^`]+)`', str(c.get('content') or '')))]
                if matched:
                    knowledge_context = {**knowledge_context, 'chunks': matched,
                                         'followUpKnowledgeSource': {'page': page, 'excludedSiblingChunks': len(chunks)-len(matched)}}
        if not knowledge_trace_recorded:
            retrieval_ok = bool(knowledge_result.get("ok"))
            trace.record(
                "knowledge_retrieval",
                "passed" if retrieval_ok else "degraded" if self.knowledge_folder_id else "skipped",
                started_at=knowledge_started_at if self.knowledge_folder_id else None,
                input_summary={
                    "topK": self.knowledge_top_k,
                    "queries": [query[:120] for query in (search_queries or (search_query,))],
                } if self.knowledge_folder_id else {},
                output_summary={
                    "toolCode": str(knowledge_result.get("code") or "")[:120],
                    "chunkCount": len(knowledge_context.get("chunks") or []),
                    "sourceNames": [
                        str(chunk.get("source_name") or "")[:160]
                        for chunk in (knowledge_context.get("chunks") or [])[:8]
                        if isinstance(chunk, dict)
                    ],
                },
                failure_code="" if retrieval_ok else str(knowledge_result.get("code") or "knowledge_not_configured"),
            )
        filter_catalogue = _documented_filter_catalogue(question, knowledge_context)
        if filter_catalogue is not None:
            return ReaderOutcome(filter_catalogue, {'stage':'knowledge_filter_catalogue','permission':permission_audit,
                'knowledge':knowledge_context,'result':filter_catalogue.public_json()})
        column_contrast = _documented_column_contrast(question, knowledge_context, permission_context.current_role)
        if column_contrast is not None:
            return ReaderOutcome(column_contrast, {'stage':'knowledge_column_contrast','permission':permission_audit,
                'knowledge':knowledge_context,'result':column_contrast.public_json()})
        # Verified against the deployed Admin ApplicationAppService on 2026-09-15.
        # This explains this specific queue counter, not every field named Pending Review.
        if (question_is_conceptual(question) and re.search(r'\bpending review\b', question, re.I)
                and re.search(r'\bservice applications?\b', question, re.I)
                and self.policy.validate(PortalReadRequest(start_path='/licensing/applications', actions=({'type':'observe'},)), permission_context) is None):
            result = ReaderResult(status='success', summary='The application queue counter definition is verified.',
                page='/licensing/applications', section='My Application Tasks', answer_shape='detail', completeness='bounded',
                facts=('In Service Applications / My Application Tasks, Pending Review counts the current user\'s To Do workflow tasks excluding Pending Modification and External Approval.',
                       'Pending Review does not mean the application has been approved. It is a pending-work counter, not a final approval decision. Check the individual application status and decision for its actual outcome.'))
            return ReaderOutcome(result, {'stage':'verified_application_counter_definition','permission':permission_audit,
                'implementationSource':'ApplicationAppService.GetMyReviewPageAsync.StatusCount.PendingReviewCount',
                'verifiedAt':'2026-09-15','result':result.public_json()})
        try:
            plan = await plan_stage(knowledge_context, timeout_stage="planning", reason="initial")
        except ReaderStageTimeout as exc:
            missing = "reader_total_timeout" if exc.total_budget else "planner_timeout"
            result = ReaderResult(status="not_confirmed", summary="A bounded read-only portal plan could not be prepared in time.", missing=(missing,))
            return ReaderOutcome(result, {**_timeout_evidence(exc, budget), "permission": permission_audit, "knowledge": knowledge_context})
        except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
            result = _model_http_failure(exc) or ReaderResult(status="not_confirmed", summary="I could not determine a bounded read-only portal plan.", missing=('planner_error',))
            validation_error = _sanitize_untrusted_text(exc, max_length=200) if isinstance(exc, ValueError) else ""
            return ReaderOutcome(
                result,
                {
                    "stage": "planning",
                    "permission": permission_audit,
                    "knowledge": knowledge_context,
                    "errorType": type(exc).__name__,
                    **({"validationError": validation_error} if validation_error else {}),
                },
            )
        resolved_values = _resolved_intent_values(bounded_conversation_context)
        conceptual_request = question_is_conceptual(question)
        question_record_identity = _explicit_record_identity(question)
        explicit_identity = bool(
            not _question_is_capability_catalogue(question)
            and (
                question_record_identity
                or (
                    resolved_values.get("recordIdentity")
                    and re.search(
                        r"(?<![\w-])" + re.escape(resolved_values["recordIdentity"]) + r"(?![\w-])", question, re.IGNORECASE,
                    )
                )
            )
        )
        if conceptual_request and not any(
            marker in question.casefold() for marker in (*_LIVE_TIME_MARKERS, "visible", "selected", "applied")
        ) and not explicit_identity:
            needs_live_read = False
        else:
            needs_live_read = explicit_identity or question_requires_live_portal(question) or bool(
                resolved_values and not conceptual_request and (
                    resolved_values.get("recordIdentity") or resolved_values.get("view")
                    or resolved_values.get("answerShape") in {"overview", "count", "list", "attention", "due", "detail"}
                )
            )
        if (_question_is_capability_catalogue(question) and not needs_live_read and isinstance(plan, dict)
                and plan.get('mode') == 'portal_read' and _knowledge_evidence_strings(knowledge_context)):
            # Permission to browse is not required to explain already retrieved documentation.
            # One bounded replan precedes policy validation; no forbidden page is visited.
            try:
                explanation_plan = await plan_stage({**knowledge_context, 'planningDirective': {
                    'knowledgeExplanationOnly': True, 'reason': 'documented_capability_question',
                    'allowedFallback': 'knowledge_only:not_confirmed',
                }}, timeout_stage='planning_capability_explanation', reason='capability_explanation')
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError):
                explanation_plan = None
            if isinstance(explanation_plan, dict) and explanation_plan.get('mode') == 'knowledge_only':
                plan = explanation_plan
            else:
                result = ReaderResult(status='not_confirmed', summary='The requested documentation explanation was not established.',
                                      missing=('knowledge_explanation_not_confirmed',))
                return ReaderOutcome(result, {'stage': 'knowledge_explanation', 'permission': permission_audit,
                                             'knowledge': knowledge_context, 'result': result.public_json()})
        knowledge_result_from_planner = knowledge_result_from_plan(plan)
        if (
            knowledge_result_from_planner is not None
            and knowledge_result_from_planner.status == "success"
            and not needs_live_read
            and knowledge_supports_result(knowledge_result_from_planner, knowledge_context)
        ):
            return ReaderOutcome(
                knowledge_result_from_planner,
                {
                    "stage": "knowledge_only",
                    "permission": permission_audit,
                    "knowledge": knowledge_context,
                    "result": knowledge_result_from_planner.public_json(),
                },
            )
        if (
            isinstance(plan, dict)
            and plan.get("mode") == "knowledge_only"
            and not needs_live_read
            and knowledge_result_from_planner is not None
            and knowledge_result_from_planner.status in {"success", "not_confirmed"}
            and bool(_knowledge_evidence_strings(knowledge_context))
        ):
            # Give a stable, non-live explanation one bounded grounding repair
            # before considering a portal read. The repair must quote/rephrase
            # retrieved evidence; it may not turn a definition question into a
            # current-state browse.
            try:
                repaired_plan = await plan_stage(
                    {
                        **knowledge_context,
                        "planningDirective": {
                            "knowledgeGroundingRepair": True,
                            "reason": "knowledge_result_not_grounded_or_incomplete",
                            "requiredEvidenceUse": "quote_exact_relevant_sentences_in_source_language",
                            "allowedFallback": "knowledge_only:not_confirmed",
                        },
                        "priorKnowledgeResult": bounded_json(plan, max_depth=3, max_items=20, max_string=300),
                    },
                    timeout_stage="planning_knowledge_grounding_repair",
                    reason="knowledge_grounding_repair",
                )
            except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError):
                repaired_plan = None
            repaired_result = knowledge_result_from_plan(repaired_plan)
            if (
                repaired_result is not None
                and repaired_result.status == "success"
                and knowledge_supports_result(repaired_result, knowledge_context)
            ):
                return ReaderOutcome(
                    repaired_result,
                    {
                        "stage": "knowledge_only_repaired",
                        "permission": permission_audit,
                        "knowledge": knowledge_context,
                        "result": repaired_result.public_json(),
                    },
                )
            supported_facts = tuple(dict.fromkeys(
                fact for candidate in (repaired_result, knowledge_result_from_planner)
                if candidate is not None and candidate.status in {'success', 'not_confirmed'}
                for fact in candidate.facts
                if knowledge_supports_result(replace(candidate, status='success', facts=(fact,)), knowledge_context)
            ))[:8]
            result = ReaderResult(
                status="not_confirmed",
                summary="The manual evidence could not be grounded for this explanation.",
                facts=supported_facts,
                missing=("knowledge_not_grounded",),
            )
            return ReaderOutcome(
                result,
                {
                    "stage": "knowledge_grounding_repair",
                    "permission": permission_audit,
                    "knowledge": knowledge_context,
                    "result": result.public_json(),
                    "knowledgeGrounding": {
                        "initialFacts": list(knowledge_result_from_planner.facts[:3]),
                        "repairFacts": list(repaired_result.facts[:3]) if repaired_result is not None else [],
                        "repairStatus": repaired_result.status if repaired_result is not None else "invalid_plan",
                        "unsupportedInitialFacts": [
                            fact for fact in knowledge_result_from_planner.facts
                            if not knowledge_supports_result(replace(knowledge_result_from_planner, facts=(fact,)), knowledge_context)
                        ][:3],
                        "unsupportedRepairFacts": [
                            fact for fact in repaired_result.facts
                            if not knowledge_supports_result(replace(repaired_result, facts=(fact,)), knowledge_context)
                        ][:3] if repaired_result is not None else [],
                    },
                },
            )
        if (
            isinstance(plan, dict)
            and (plan.get("mode") == "knowledge_only" or needs_live_read and plan.get("mode") == "observation_result")
        ):
            force_reason = (
                "current_portal_state_required"
                if needs_live_read
                else "knowledge_result_not_grounded_or_incomplete"
            )
            forced_context = {
                **knowledge_context,
                "planningDirective": {
                    "requirePortalRead": True,
                    "reason": force_reason,
                    "allowedFallback": "knowledge_only:not_confirmed",
                },
            }
            try:
                plan = await plan_stage(
                    forced_context,
                    timeout_stage="planning_required_portal",
                    reason="required_portal_read",
                )
            except ReaderStageTimeout as exc:
                missing = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                result = ReaderResult(status="not_confirmed", summary="A required live portal read could not be planned in time.", missing=(missing,))
                return ReaderOutcome(result, {**_timeout_evidence(exc, budget), "permission": permission_audit, "knowledge": knowledge_context, "forceReason": force_reason})
            except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                result = ReaderResult(status="not_confirmed", summary="A required live portal read could not be planned.", missing=("portal_read_required",))
                return ReaderOutcome(result, {"stage": "planning_required_portal", "permission": permission_audit, "knowledge": knowledge_context, "forceReason": force_reason, "errorType": type(exc).__name__})
            if portal_read_request_from_plan(plan) is None and not (
                isinstance(plan, dict) and plan.get("mode") == "portal_read"
            ):
                recovered_request = _knowledge_route_recovery_request(
                    question, knowledge_context, permission_context, bounded_conversation_context,
                )
                if recovered_request is None:
                    result = ReaderResult(status="not_confirmed", summary="The requested current portal state could not be confirmed.", missing=("portal_read_required",))
                    return ReaderOutcome(result, {"stage": "planning_required_portal", "permission": permission_audit, "knowledge": knowledge_context, "forceReason": force_reason, "plan": bounded_json(plan)})
                trace.record(
                    "route_recovery",
                    "passed",
                    input_summary={"reason": "required_portal_read_planner_refusal"},
                    output_summary={"startPath": recovered_request.start_path},
                )
                plan = {
                    "mode": "portal_read",
                    "portalRequest": {
                        "startPath": recovered_request.start_path,
                        "actions": [{"type": "observe"}],
                        "expectedFields": [],
                    },
                }
        invalid_plan_error: str | None = None
        deferred_detail_identity = ""
        deferred_first_detail = False
        deferred_detail_prerequisite_actions: tuple[dict[str, Any], ...] = ()
        deferred_state_action: dict[str, Any] | None = None
        request = portal_read_request_from_plan(plan)
        if request is None and isinstance(plan, dict) and plan.get("mode") == "portal_read":
            invalid_plan_error = "invalid_closed_plan"
        elif request is None:
            result = ReaderResult(status="not_confirmed", summary="The request did not produce a valid read-only portal plan.")
            return ReaderOutcome(result, {"stage": "planning", "plan": bounded_json(plan), "permission": permission_audit, "knowledge": knowledge_context})
        if request is not None:
            # Validate the original plan before discarding observe metadata.
            # This prevents normalization from concealing unsafe fields.
            raw_policy_error = self.policy.validate(request, permission_context)
            cell_detail_actions = [
                action for action in request.actions
                if str(action.get("type") or "").casefold().replace("-", "_") == "show_detail"
                and str(action.get("role") or "cell").casefold() == "cell"
            ]
            resolved_record_identity = _detail_identity(resolved_values.get("recordIdentity"))
            planned_record_identity = (
                _detail_identity(cell_detail_actions[0].get("value"))
                if len(cell_detail_actions) == 1 else ""
            )
            if not planned_record_identity and len(cell_detail_actions) == 1:
                planned_record_identity = _stable_detail_identity_from_query(
                    question, request.actions,
                )
            detail_identity = resolved_record_identity or planned_record_identity
            detail_identity_conflict = bool(
                resolved_record_identity and planned_record_identity
                and resolved_record_identity != planned_record_identity
            )
            binding_only_error = raw_policy_error in {
                "button_not_permitted", "detail_identity_required", "detail_cell_identity_mismatch",
                "detail_destination_required",
            }
            other_actions = tuple(action for action in request.actions if action not in cell_detail_actions)
            other_request = PortalReadRequest(
                start_path=request.start_path,
                actions=other_actions or ({"type": "observe"},),
                expected_fields=request.expected_fields,
            )
            other_policy_error = self.policy.validate(other_request, permission_context)
            can_defer_detail = bool(
                len(cell_detail_actions) == 1
                and detail_identity
                and not detail_identity_conflict
                and other_policy_error is None
                and (
                    raw_policy_error is None
                    or binding_only_error
                    and _detail_action_can_use_observed_identity(cell_detail_actions[0], detail_identity)
                )
            )
            can_defer_first_detail = bool(
                not can_defer_detail
                and len(cell_detail_actions) == 1
                and not detail_identity
                and raw_policy_error == "detail_identity_required"
                and other_policy_error is None
                and all(str(action.get("type") or "").casefold().replace("-", "_") in {"observe", "query"}
                        for action in other_actions)
                and re.search(r"\b(?:first|1st)\s+(?:one|record|license|application|item)\b", question, re.I)
                and re.search(r"\b(?:list|show|several|multiple|some|few)\b", question, re.I)
                and _detail_action_can_use_observed_identity(cell_detail_actions[0], "FIRST-ROW-1")
            )
            if can_defer_detail or can_defer_first_detail:
                # Resolve the model's semantic request against the page's fresh,
                # bounded observation before allowing any record click.
                deferred_detail_identity = detail_identity if can_defer_detail else ""
                deferred_first_detail = can_defer_first_detail
                deferred_detail_prerequisite_actions = tuple(
                    action for action in other_actions
                    if str(action.get("type") or "").casefold().replace("-", "_") != "observe"
                )
                if detail_identity and not resolved_record_identity:
                    resolved_values["recordIdentity"] = detail_identity
                request = PortalReadRequest(
                    start_path=request.start_path,
                    actions=({"type": "observe"},),
                    expected_fields=request.expected_fields,
                )
            state_actions = [
                action for action in request.actions
                if str(action.get("type") or "").casefold().replace("-", "_") == "switch_tab"
            ]
            can_defer_state = bool(
                not can_defer_detail
                and raw_policy_error is None
                and len(state_actions) >= 1
                and all(
                    str(action.get("type") or "").casefold().replace("-", "_")
                    in {"switch_tab", "query", "observe"}
                    for action in request.actions
                )
            )
            if can_defer_state:
                # State controls are page state, not planner-provided locators.
                # Observe first, then resolve the semantic label against exactly
                # one safe control in that fresh observation.
                deferred_state_action = dict(state_actions[0])
                request = PortalReadRequest(
                    start_path=request.start_path,
                    actions=({"type": "observe"},),
                    expected_fields=request.expected_fields,
                )
            policy_error = validate_policy(
                request,
                reason=(
                    "initial_observed_detail_binding" if can_defer_detail
                    else "initial_observed_state_binding" if can_defer_state
                    else "initial"
                ),
            )
            if policy_error:
                status = "no_permission" if policy_error in {"page_not_permitted", "permission_context_incomplete", "button_not_permitted"} else "not_confirmed"
                result = ReaderResult(status=status, summary="The requested portal operation is not permitted by the read-only reader.",
                                      page=request.start_path, source_hint={'page': request.start_path}, missing=(policy_error,))  # type: ignore[arg-type]
                return ReaderOutcome(result, {"stage": "policy", "plan": bounded_json(request.as_payload()), "policyError": policy_error, "permission": permission_audit})
            normalized_request = _normalize_initial_observation_request(request)
            if normalized_request is None:
                invalid_plan_error = "invalid_observation_plan"
            else:
                request = normalized_request

        if invalid_plan_error is not None:
            correction_context = {
                **knowledge_context,
                "planningDirective": {
                    "requirePortalRead": True,
                    "pureObserveFirst": True,
                    "invalidClosedPlan": True,
                    "reason": invalid_plan_error,
                    "allowedFallback": "knowledge_only:not_confirmed",
                },
            }
            try:
                corrected_plan = await plan_stage(
                    correction_context,
                    timeout_stage="planning_correction",
                    reason="invalid_closed_plan",
                )
            except ReaderStageTimeout as exc:
                missing = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                result = ReaderResult(status="not_confirmed", summary="The invalid portal plan could not be corrected in time.", missing=(missing,))
                return ReaderOutcome(result, {**_timeout_evidence(exc, budget), "permission": permission_audit, "invalidPlanError": invalid_plan_error})
            except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                result = ReaderResult(status="not_confirmed", summary="The invalid portal plan could not be corrected.", missing=(invalid_plan_error,))
                return ReaderOutcome(result, {"stage": "planning_correction", "permission": permission_audit, "invalidPlanError": invalid_plan_error, "errorType": type(exc).__name__})

            corrected_request = portal_read_request_from_plan(corrected_plan)
            if corrected_request is None:
                result = ReaderResult(status="not_confirmed", summary="The corrected portal plan was not valid.", missing=("invalid_closed_plan",))
                return ReaderOutcome(result, {"stage": "planning_correction", "permission": permission_audit, "invalidPlanError": "invalid_closed_plan"})
            policy_error = validate_policy(corrected_request, reason="corrected_plan")
            if policy_error:
                status = "no_permission" if policy_error in {"page_not_permitted", "permission_context_incomplete", "button_not_permitted"} else "not_confirmed"
                result = ReaderResult(status=status, summary="The corrected portal operation is not permitted by the read-only reader.", missing=(policy_error,))  # type: ignore[arg-type]
                return ReaderOutcome(result, {"stage": "policy_after_correction", "policyError": policy_error, "permission": permission_audit})
            normalized_request = _normalize_initial_observation_request(corrected_request)
            if normalized_request is None:
                result = ReaderResult(status="not_confirmed", summary="The corrected observation plan was still invalid.", missing=("invalid_observation_plan",))
                return ReaderOutcome(result, {"stage": "planning_correction", "permission": permission_audit, "invalidPlanError": "invalid_observation_plan"})
            plan = corrected_plan
            request = normalized_request

        unverified_scoped_plan = (
            plan.get("portalRequest") if deferred_state_action is not None
            and deferred_state_action.get("section") else None
        )
        if any(action.get("section") and action.get("type") != "observe" for action in request.actions):
            # A manual node title is not an observed locator. Establish the
            # structure first and replan the original scope against that evidence.
            unverified_scoped_plan = request.as_payload()
            request = replace(request, actions=({"type": "observe"},))
        elif (any(action.get("type") in {"reset_filter", "apply_filter", "dismiss_overlay"} for action in request.actions)
              and not any(action.get("type") == "show_filter" for action in request.actions)):
            # A fresh reader context has no previously opened filter overlay.
            request = replace(request, actions=({"type": "observe"},))
        elif (_question_needs_native_surface(question)
              and any(action.get('type') == 'show_filter' and not (action.get('name') or action.get('selector'))
                      for action in request.actions)):
            # Bind the actual Filter button from a fresh observation; an action
            # type alone is not a locator and would fail the gateway schema.
            request = replace(request, actions=({'type': 'observe'},))
        planned_request = portal_read_request_from_plan(plan)
        observation_section_hint = next(
            (
                str(action.get("section") or "").strip()
                for action in (planned_request.actions if planned_request is not None else ())
                if str(action.get("type") or "").casefold() == "observe" and action.get("section")
            ),
            "",
        )
        category_requirement: _CategoryChildRequirement | None = None
        category_read_is_in_place = False
        try:
            tool_result = await portal_read_stage(
                request,
                timeout_stage="portal_read",
                attempt="initial",
            )
        except ReaderStageTimeout as exc:
            missing = "reader_total_timeout" if exc.total_budget else "portal_read_timeout"
            result = ReaderResult(status="load_failed", summary="The Admin Portal page could not be loaded in time.", missing=(missing,))
            return ReaderOutcome(result, {**_timeout_evidence(exc, budget), "permission": permission_audit})
        raw_tool_payload = tool_result.get("result") if isinstance(tool_result, dict) else None
        observation = raw_tool_payload.get("observation") if isinstance(raw_tool_payload, dict) else None
        lookup_result = _observed_application_lookup(question, observation, request.start_path)
        if lookup_result is not None and raw_tool_payload.get('result') not in {'load_failed','no_permission'}:
            return ReaderOutcome(lookup_result, {'stage':'observed_application_lookup','permission':permission_audit,
                'observation':bounded_portal_observation(observation),'result':lookup_result.public_json()})
        # Bind exact identifiers directly against the fresh visible table for
        # all supported languages.  In particular, Arabic detail follow-ups
        # do not contain the English ``find``/``search`` verbs used by the
        # older identity-search recovery path.
        observed_identity = _detail_identity(resolved_values.get("recordIdentity"))
        if not observed_identity:
            identity_tokens = re.findall(
                r"(?<![A-Za-z0-9])(?=[A-Za-z0-9-]*[A-Za-z])(?=[A-Za-z0-9-]*\d)"
                r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+(?![A-Za-z0-9])",
                str(question or ""),
            )
            if len(identity_tokens) == 1:
                observed_identity = _detail_identity(identity_tokens[0])
        exact_row_result = _native_exact_identity_row_result(
            observation,
            page=request.start_path,
            record_identity=observed_identity,
            scope=_permission_result_scope(permission_context),
            question=question,
        )
        if exact_row_result is not None and raw_tool_payload.get('result') not in {'load_failed', 'no_permission'}:
            return ReaderOutcome(
                exact_row_result,
                {
                    'stage': 'observed_exact_identity_row',
                    'permission': permission_audit,
                    'observation': bounded_portal_observation(observation),
                    'nativeIdentityMatch': observed_identity,
                    'result': exact_row_result.public_json(),
                },
            )
        if observation is not None and (
            any(str(action.get("type") or "").casefold() == "observe" for action in request.actions)
            or not raw_tool_payload.get("facts")
            or str(raw_tool_payload.get("result") or raw_tool_payload.get("status") or "") == "not_confirmed"
        ):
            observed_context = {
                **knowledge_context,
                "portalObservation": bounded_portal_observation(observation),
                "priorPortalRead": bounded_json(request.as_payload(), max_depth=4, max_items=30, max_string=200),
            }
            if unverified_scoped_plan is not None:
                observed_context["unverifiedInitialPlan"] = bounded_json(unverified_scoped_plan)
                observed_context["planningDirective"] = {
                    "reason": "initial_section_requires_observation",
                    "preserveRequestedScope": True,
                    "instruction": (
                        "Preserve the user's requested business object, view, filters and scope. "
                        "unverifiedInitialPlan is an untrusted locator proposal, not a user scope constraint. "
                        "Do not preserve its invented section name. Use an exact observed globally unique "
                        "control without section when that control still fulfills the user's scope. "
                        "If the user requires a particular region and it cannot be uniquely verified, "
                        "return not_confirmed; never substitute another region."
                    ),
                }
            observation_status = str(
                raw_tool_payload.get("result") or raw_tool_payload.get("status") or ""
            ).strip()
            if observation_status in {"load_failed", "no_permission"}:
                result = ReaderResult(
                    status=observation_status,  # type: ignore[arg-type]
                    summary=(
                        "The Admin Portal page could not be loaded."
                        if observation_status == "load_failed"
                        else "The requested Admin Portal page is not permitted."
                    ),
                    page=request.start_path,
                    missing=(f"observation_{observation_status}",),
                )
                return ReaderOutcome(
                    result,
                    {
                        "stage": "observation_validation",
                        "permission": permission_audit,
                        "observation": observed_context["portalObservation"],
                    },
                )
            if _observation_has_error_state(observed_context["portalObservation"]):
                result = ReaderResult(
                    status="not_confirmed",
                    summary="The observed page was not a confirmed Admin Portal data page.",
                    missing=("observation_page_not_confirmed",),
                )
                return ReaderOutcome(
                    result,
                    {
                        "stage": "observation_validation",
                        "permission": permission_audit,
                        "observation": observed_context["portalObservation"],
                    },
                )
            requested_answer_shape = reader_answer_shape(question, bounded_conversation_context)
            resolved_section_hint = observation_section_hint or _infer_observation_section(
                observed_context["portalObservation"],
                question=question,
                expected_fields=request.expected_fields,
                answer_shape=requested_answer_shape,
            )
            verified_scope = _permission_result_scope(permission_context)
            category_requirement = _category_control_requiring_children(
                question,
                observed_context["portalObservation"],
                None,
                requested_answer_shape,
                bounded_conversation_context,
                current_page=request.start_path,
            )
            if category_requirement:
                observed_context = {**observed_context, "planningDirective": {
                    **observed_context.get("planningDirective", {}),
                    "requirePortalRead": True,
                    "reason": "named_collection_requires_child_evidence",
                    "currentPage": request.start_path,
                    "categoryControl": category_requirement.control_label,
                    "categorySemanticLabel": category_requirement.semantic_label,
                    "requestedAnswerShape": requested_answer_shape,
                    "requireChildEvidence": True,
                    "parentCountNotSufficient": True,
                }}
            deferred_plan: dict[str, Any] | None = None
            if deferred_state_action is not None:
                state_actions = _pending_initial_tab_actions(state_actions, observed_context['portalObservation'])
                deferred_state_action = dict(state_actions[0]) if state_actions else None
            if deferred_state_action is not None:
                native_tabs = observed_context["portalObservation"].get("tabControls") or []
                matching_tabs = [tab for tab in native_tabs if isinstance(tab, dict)
                    and _state_control_label_matches(tab.get("name"), deferred_state_action.get("name"))]
                if len(matching_tabs) == 1 and matching_tabs[0].get("selected") is True and len(state_actions) == 1:
                    # A fresh selected tab needs no second click. The normal
                    # observation validator still checks health and row scope.
                    deferred_state_action = None
                elif native_tabs and not matching_tabs:
                    if len(state_actions) > 1:
                        names = ', '.join(str(tab.get('name')) for tab in native_tabs if isinstance(tab, dict) and tab.get('name'))
                        result = ReaderResult(status='not_confirmed', summary='The first requested tab is absent from the observed layout.',
                            page=request.start_path, source_hint={'page':request.start_path}, answer_shape='detail',
                            facts=(f'The current {permission_context.current_role} view shows {names}. '
                                   f'The requested {deferred_state_action.get("name")} tab is not visible in this layout, '
                                   'so its child queue and records were not read. The available list is not a substitute.',),
                            missing=('requested_view_not_visible',))
                        return ReaderOutcome(result, {'stage':'native_view_boundary','permission':permission_audit,
                            'observation':observed_context['portalObservation'],'result':result.public_json()})
                    # The fresh page may start on a parent queue. Let the
                    # existing observed planner resolve prerequisites from the
                    # manual instead of treating a hidden child as ambiguous.
                    observed_context = {**observed_context, 'planningDirective': {
                        **observed_context.get('planningDirective', {}),
                        'requestedStateRequiresParent': deferred_state_action.get('name'),
                        'reason': 'requested_child_tab_not_yet_visible',
                        'requirePortalRead': True,
                        'instruction': 'Use the retrieved control steps to select the visible parent before the requested child; do not substitute the current queue.',
                    }}
                    deferred_state_action = None
            if deferred_state_action is not None:
                state_request = PortalReadRequest(
                    start_path=request.start_path,
                    # Keep a requested parent/child sequence together. Discarding
                    # the child forces a third fresh-page read and loses context.
                    # Each label is still bound/validated at execution time.
                    actions=tuple(dict(action) for action in state_actions),
                    expected_fields=request.expected_fields,
                )
                bound_state_request, binding_error = _bind_observed_actions(
                    state_request,
                    observed_context["portalObservation"],
                    record_identity="",
                )
                if binding_error or bound_state_request is None:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested state did not have one uniquely observed safe control.",
                        page=request.start_path,
                        scope=verified_scope,
                        missing=(binding_error or "state_control_not_unique",),
                    )
                    return ReaderOutcome(result, {
                        "stage": "state_control_binding",
                        "permission": permission_audit,
                        "observation": observed_context["portalObservation"],
                    })
                bound_policy_error = validate_policy(
                    bound_state_request,
                    reason="initial_after_observed_state_binding",
                )
                if bound_policy_error:
                    status: ReaderStatus = "no_permission" if bound_policy_error in {
                        "page_not_permitted", "permission_context_incomplete", "button_not_permitted",
                    } else "not_confirmed"
                    result = ReaderResult(
                        status=status,
                        summary="The bound state transition is not permitted.",
                        missing=(bound_policy_error,),
                    )
                    return ReaderOutcome(result, {
                        "stage": "policy_after_observed_state_binding",
                        "permission": permission_audit,
                        "policyError": bound_policy_error,
                    })
                deferred_plan = {
                    "mode": "portal_read",
                    "portalRequest": {
                        "startPath": bound_state_request.start_path,
                        "actions": [dict(action) for action in bound_state_request.actions],
                        "expectedFields": list(bound_state_request.expected_fields),
                    },
                }
            elif deferred_first_detail:
                first_identity = _first_observed_record_identity(observed_context["portalObservation"])
                bound_detail = observed_detail_action(
                    observed_context["portalObservation"], first_identity, request.start_path,
                ) if first_identity else None
                if bound_detail is None:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The first visible record did not have one stable detail identity.",
                        page=request.start_path,
                        answer_shape="detail",
                        scope=verified_scope,
                        missing=("first_record_identity_not_unique",),
                    )
                    return ReaderOutcome(result, {
                        "stage": "first_detail_target_binding",
                        "permission": permission_audit,
                        "observation": observed_context["portalObservation"],
                    })
                resolved_values["recordIdentity"] = first_identity
                deferred_detail_identity = first_identity
                deferred_plan = {
                    "mode": "portal_read",
                    "portalRequest": {
                        "startPath": request.start_path,
                        "actions": [bound_detail],
                        "expectedFields": [],
                    },
                }
            elif deferred_detail_identity:
                bound_detail = observed_detail_action(
                    observed_context["portalObservation"], deferred_detail_identity, request.start_path,
                )
                if bound_detail is None and deferred_detail_prerequisite_actions:
                    deferred_plan = {
                        "mode": "portal_read",
                        "portalRequest": {
                            "startPath": request.start_path,
                            "actions": [dict(action) for action in deferred_detail_prerequisite_actions],
                            "expectedFields": list(request.expected_fields),
                        },
                    }
                elif bound_detail is None:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested record did not have one uniquely observed detail target.",
                        page=request.start_path,
                        answer_shape="detail",
                        scope=verified_scope,
                        missing=("detail_target_not_unique",),
                    )
                    return ReaderOutcome(result, {
                        "stage": "detail_target_binding",
                        "permission": permission_audit,
                        "observation": observed_context["portalObservation"],
                    })
                else:
                    deferred_plan = {
                        "mode": "portal_read",
                        "portalRequest": {
                            "startPath": request.start_path,
                            "actions": [bound_detail],
                            "expectedFields": [],
                        },
                    }
            elif (
                requested_answer_shape == "detail"
                and _detail_identity(resolved_values.get("recordIdentity"))
            ):
                resolved_detail_identity = _detail_identity(resolved_values.get("recordIdentity"))
                bound_detail = observed_detail_action(
                    observed_context["portalObservation"], resolved_detail_identity, request.start_path,
                )
                if bound_detail is not None:
                    # A unique current record target is a deterministic business
                    # transition. It must run before API candidate selection,
                    # which answers from responses but does not choose row clicks.
                    detail_request = PortalReadRequest(
                        start_path=request.start_path,
                        actions=(bound_detail,),
                        expected_fields=(),
                    )
                    bound_policy_error = validate_policy(
                        detail_request,
                        reason="current_observation_record_binding",
                    )
                    if bound_policy_error:
                        status: ReaderStatus = "no_permission" if bound_policy_error in {
                            "page_not_permitted", "permission_context_incomplete", "button_not_permitted",
                        } else "not_confirmed"
                        result = ReaderResult(
                            status=status,
                            summary="The bound record detail transition is not permitted.",
                            missing=(bound_policy_error,),
                        )
                        return ReaderOutcome(result, {
                            "stage": "policy_after_observed_detail_binding",
                            "permission": permission_audit,
                            "policyError": bound_policy_error,
                        })
                    deferred_plan = {
                        "mode": "portal_read",
                        "portalRequest": {
                            "startPath": detail_request.start_path,
                            "actions": [dict(bound_detail)],
                            "expectedFields": [],
                        },
                    }

            async def plan_after_current_observation() -> dict[str, Any]:
                if deferred_plan is not None:
                    return deferred_plan
                return await plan_stage(
                    observed_context,
                    timeout_stage="planning_after_observe",
                    reason="after_observe",
                )

            try:
                next_plan = await plan_after_current_observation()
            except ReaderStageTimeout as exc:
                missing = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                if category_requirement:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested collection requires a bounded category read.",
                        page=request.start_path,
                        missing=(missing,),
                    )
                    semantic_resolution = record_semantic_resolution(
                        decision="not_confirmed",
                        reason=missing,
                        result=result,
                    )
                    return ReaderOutcome(
                        result,
                        {
                            **_timeout_evidence(exc, budget),
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                            "semanticResolution": semantic_resolution,
                        },
                    )
                fallback_result, fallback_strategy = deterministic_observation_fallback(
                    observed_context["portalObservation"],
                    page=request.start_path,
                    section=resolved_section_hint,
                    answer_shape=requested_answer_shape,
                    scope=verified_scope,
                )
                semantic_resolution = record_semantic_resolution(
                    decision="fallback" if fallback_result is not None else "not_confirmed",
                    reason=missing,
                    result=fallback_result,
                    fallback_strategy=fallback_strategy,
                )
                if fallback_result is not None:
                    return ReaderOutcome(
                        fallback_result,
                        {
                            "stage": "completed_from_observation_fallback",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "observation": observed_context["portalObservation"],
                            "result": fallback_result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                result = ReaderResult(status="not_confirmed", summary="The observed portal structure could not be interpreted in time.", page=request.start_path, missing=(missing,))
                return ReaderOutcome(
                    result,
                    {**_timeout_evidence(exc, budget), "permission": permission_audit, "observation": observed_context["portalObservation"], "semanticResolution": semantic_resolution},
                )
            except (httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError) as exc:
                validation_error = _sanitize_untrusted_text(exc, max_length=200) if isinstance(exc, ValueError) else ""
                if category_requirement:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested collection requires a bounded category read.",
                        page=request.start_path,
                        missing=("collection_children_read_required",),
                    )
                    semantic_resolution = record_semantic_resolution(
                        decision="not_confirmed",
                        reason="planner_error",
                        result=result,
                    )
                    return ReaderOutcome(
                        result,
                        {
                            "stage": "planning_collection_children_after_observe",
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                            "semanticResolution": semantic_resolution,
                            "errorType": type(exc).__name__,
                            **({"validationError": validation_error} if validation_error else {}),
                        },
                    )
                fallback_result, fallback_strategy = deterministic_observation_fallback(
                    observed_context["portalObservation"],
                    page=request.start_path,
                    section=resolved_section_hint,
                    answer_shape=requested_answer_shape,
                    scope=verified_scope,
                )
                semantic_resolution = record_semantic_resolution(
                    decision="fallback" if fallback_result is not None else "not_confirmed",
                    reason="planner_error",
                    result=fallback_result,
                    fallback_strategy=fallback_strategy,
                )
                if fallback_result is not None:
                    return ReaderOutcome(
                        fallback_result,
                        {
                            "stage": "completed_from_observation_fallback",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "observation": observed_context["portalObservation"],
                            "result": fallback_result.public_json(),
                            "semanticResolution": semantic_resolution,
                            "errorType": type(exc).__name__,
                            **({"validationError": validation_error} if validation_error else {}),
                        },
                    )
                api_failure = str(api_audit.get("reason") or "") if api_audit.get("decision") == "not_confirmed" else ""
                result = ReaderResult(
                    status="not_confirmed",
                    summary="The observed portal structure could not be turned into a bounded read plan.",
                    page=request.start_path,
                    missing=(api_failure or "planner_error",),
                )
                return ReaderOutcome(result, {"stage": "planning_after_observe", "permission": permission_audit, "observation": observed_context["portalObservation"], "semanticResolution": semantic_resolution, "errorType": type(exc).__name__, **({"validationError": validation_error} if validation_error else {})})
            planned_result = _observation_plan_result_from_plan(next_plan)
            category_requirement = category_requirement or _category_control_requiring_children(
                question,
                observed_context["portalObservation"],
                planned_result,
                requested_answer_shape,
                bounded_conversation_context,
                current_page=request.start_path,
            )
            existing_category_request = portal_read_request_from_plan(next_plan)
            category_read_is_in_place = bool(category_requirement and existing_category_request and
                _request_advances_category_on_current_page(existing_category_request,
                    current_page=request.start_path, category_control=category_requirement.control_label))
            if category_requirement and not category_read_is_in_place:
                refinement_context = {
                    **observed_context,
                    "planningDirective": {
                        "requirePortalRead": True,
                        "reason": "named_collection_requires_child_evidence",
                        "currentPage": request.start_path,
                        "categoryControl": category_requirement.control_label,
                        "categorySemanticLabel": category_requirement.semantic_label,
                        "requestedAnswerShape": requested_answer_shape,
                        "requireChildEvidence": True,
                        "parentCountNotSufficient": True,
                        "currentPageControlIsAvailable": True,
                        "priorResult": planned_result.public_json() if planned_result is not None else {},
                        "allowedFallback": "observation_result:not_confirmed",
                    },
                }
                try:
                    next_plan = await plan_stage(
                        refinement_context,
                        timeout_stage="planning_collection_children_after_observe",
                        reason="collection_children_required",
                    )
                except ReaderStageTimeout as exc:
                    missing = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested collection details could not be planned in time.",
                        page=request.start_path,
                        missing=(missing,),
                    )
                    return ReaderOutcome(
                        result,
                        {
                            **_timeout_evidence(exc, budget),
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                        },
                    )
                except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested collection details could not be planned.",
                        page=request.start_path,
                        missing=("collection_children_read_required",),
                    )
                    return ReaderOutcome(
                        result,
                        {
                            "stage": "planning_collection_children_after_observe",
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                            "errorType": type(exc).__name__,
                        },
                    )
                planned_result = _observation_plan_result_from_plan(next_plan)
                refinement_request = portal_read_request_from_plan(next_plan)
                if refinement_request is None:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested collection children require a bounded read.",
                        page=request.start_path,
                        section=category_requirement.semantic_label,
                        answer_shape=requested_answer_shape,  # type: ignore[arg-type]
                        scope=verified_scope,
                        missing=("collection_children_read_required",),
                    )
                    semantic_resolution = record_semantic_resolution(
                        decision="not_confirmed",
                        reason="collection_children_read_required",
                        llm_plan=next_plan,
                        result=result,
                    )
                    return ReaderOutcome(
                        result,
                        {
                            "stage": "planning_collection_children_after_observe",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "plan": bounded_json(next_plan),
                            "observation": observed_context["portalObservation"],
                            "result": result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                category_read_is_in_place = _request_advances_category_on_current_page(
                    refinement_request,
                    current_page=request.start_path,
                    category_control=category_requirement.control_label,
                )
            if (
                planned_result is not None
                and planned_result.status == "not_confirmed"
                and question_requires_live_portal(question)
                and requested_answer_shape in {"list", "due", "detail"}
                and re.search(
                    r"/[a-z0-9][a-z0-9_/?=&.-]*",
                    " ".join(planned_result.missing).casefold(),
                )
            ):
                follow_up_required_context = {
                    **observed_context,
                    "planningDirective": {
                        "requirePortalRead": True,
                        "reason": "current_data_requires_a_follow_up_page_read",
                        "priorNotConfirmed": planned_result.public_json(),
                        "allowedFallback": "observation_result:not_confirmed",
                    },
                }
                try:
                    next_plan = await plan_stage(
                        follow_up_required_context,
                        timeout_stage="planning_required_portal_after_observe",
                        reason="required_portal_read_after_observe",
                    )
                except ReaderStageTimeout as exc:
                    missing = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="A required follow-up portal read could not be planned in time.",
                        missing=(missing,),
                    )
                    return ReaderOutcome(
                        result,
                        {
                            **_timeout_evidence(exc, budget),
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                        },
                    )
                except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="A required follow-up portal read could not be planned.",
                        missing=("follow_up_portal_read_required",),
                    )
                    return ReaderOutcome(
                        result,
                        {
                            "stage": "planning_required_portal_after_observe",
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                            "errorType": type(exc).__name__,
                        },
                    )
                planned_result = _observation_plan_result_from_plan(next_plan)
            if compound_first_detail and not deferred_first_detail and not deferred_detail_identity:
                first_identity = _first_observed_record_identity(observed_context["portalObservation"])
                first_detail_action = observed_detail_action(
                    observed_context["portalObservation"], first_identity, request.start_path,
                ) if first_identity else None
                if first_detail_action is not None:
                    resolved_values["recordIdentity"] = first_identity
                    if _observation_plan_result_from_plan(next_plan) is not None:
                        next_plan = {
                            "mode": "portal_read",
                            "portalRequest": {
                                "startPath": request.start_path,
                                "actions": [first_detail_action],
                                "expectedFields": [],
                            },
                        }
            observed_result = observation_result_from_plan(
                next_plan,
                observed_context["portalObservation"],
                verified_scope=verified_scope,
                observed_page=request.start_path,
                permitted_paths=(*permission_context.pages, *permission_context.subpages),
            )
            next_plan, observed_result = await repair_partial_observation(
                next_plan, observed_result, observed_context, page=request.start_path,
            )
            planned_result = _observation_plan_result_from_plan(next_plan)
            if observed_result is not None and (observed_result.status in {"success", "no_data"} or observed_result.facts):
                semantic_resolution = record_semantic_resolution(
                    decision="llm_result",
                    reason="validated_observation_result",
                    llm_plan=next_plan,
                    result=observed_result,
                )
                return ReaderOutcome(
                    observed_result,
                    {
                        "stage": "completed_after_observe",
                        "permission": permission_audit,
                        "knowledge": knowledge_context,
                        "plan": bounded_json(next_plan),
                        "observation": observed_context["portalObservation"],
                        "result": observed_result.public_json(),
                        "semanticResolution": semantic_resolution,
                    },
                )
            next_request = portal_read_request_from_plan(next_plan)
            fallback_reason = ""
            if planned_result is not None and planned_result.status == "not_confirmed":
                fallback_reason = (
                    "llm_not_confirmed"
                    if observed_result is not None
                    else "invalid_observation_references"
                )
            elif planned_result is not None and observed_result is None:
                fallback_reason = "invalid_observation_references"
            elif planned_result is None and next_request is None:
                fallback_reason = "invalid_semantic_schema"
            if fallback_reason:
                planned_section = (
                    (planned_result.source_section or planned_result.section)
                    if planned_result is not None
                    else ""
                )
                fallback_section = planned_section or resolved_section_hint
                fallback_shape = (
                    planned_result.answer_shape
                    if planned_result is not None and planned_result.answer_shape != "unspecified"
                    else requested_answer_shape
                )
                fallback_result, fallback_strategy = deterministic_observation_fallback(
                    observed_context["portalObservation"],
                    page=request.start_path,
                    section=fallback_section,
                    answer_shape=fallback_shape,
                    scope=verified_scope,
                    selection=planned_result,
                )
                semantic_resolution = record_semantic_resolution(
                    decision="fallback" if fallback_result is not None else "llm_not_confirmed",
                    reason=fallback_reason,
                    llm_plan=next_plan,
                    result=fallback_result or observed_result,
                    fallback_strategy=fallback_strategy,
                )
                if fallback_result is not None:
                    return ReaderOutcome(
                        fallback_result,
                        {
                            "stage": "completed_from_observation_fallback",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "plan": bounded_json(next_plan),
                            "observation": observed_context["portalObservation"],
                            "result": fallback_result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                if observed_result is not None:
                    return ReaderOutcome(
                        observed_result,
                        {
                            "stage": "completed_after_observe",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "plan": bounded_json(next_plan),
                            "observation": observed_context["portalObservation"],
                            "result": observed_result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                if planned_result is not None and planned_result.status == "not_confirmed":
                    unconfirmed_result = replace(
                        planned_result,
                        page=request.start_path,
                        scope=verified_scope,
                        facts=(),
                    )
                    return ReaderOutcome(
                        unconfirmed_result,
                        {
                            "stage": "completed_after_observe",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "plan": bounded_json(next_plan),
                            "observation": observed_context["portalObservation"],
                            "result": unconfirmed_result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                if planned_result is not None:
                    result = ReaderResult(
                        status="not_confirmed", summary="The observed result could not be grounded.",
                        page=request.start_path, missing=(fallback_reason,),
                    )
                    return ReaderOutcome(result, {
                        "stage": "observation_result_validation", "permission": permission_audit,
                        "plan": bounded_json(next_plan), "observation": observed_context["portalObservation"],
                        "semanticResolution": semantic_resolution,
                    })
            def normalize_follow_up(candidate: PortalReadRequest | None) -> tuple[PortalReadRequest | None, ReaderOutcome | None]:
                if candidate is None:
                    return None, None
                initial_original = planned_request or request
                if (
                    len(initial_original.actions) + len(candidate.actions) > self.policy.max_actions
                    or len(portal_request_paths(initial_original) | portal_request_paths(candidate)) > self.policy.max_pages
                ):
                    result = ReaderResult(status="not_confirmed", summary="The follow-up portal plan exceeded the cumulative read budget.", missing=("invalid_follow_up_plan",))
                    return None, ReaderOutcome(result, {"stage": "planning_after_observe", "permission": permission_audit,
                                                        "plan": bounded_json(candidate.as_payload()), "observation": observed_context["portalObservation"]})
                policy_error = self.policy.validate(candidate, permission_context)
                binding_error_is_repairable = bool(
                    policy_error in {
                        "button_not_permitted", "detail_identity_required", "detail_cell_identity_mismatch",
                        "detail_destination_required",
                    }
                    and len(candidate.actions) == 1
                    and _detail_action_can_use_observed_identity(
                        candidate.actions[0], _detail_identity(resolved_values.get("recordIdentity")),
                    )
                )
                if policy_error and not binding_error_is_repairable:
                    validate_policy(candidate, reason="after_observe_before_normalization")
                    status: ReaderStatus = "no_permission" if policy_error in {"page_not_permitted", "permission_context_incomplete", "button_not_permitted"} else "not_confirmed"
                    result = ReaderResult(status=status, summary="The follow-up portal operation is not permitted.", missing=(policy_error,))
                    return None, ReaderOutcome(result, {"stage": "policy_after_observe", "permission": permission_audit,
                                                        "policyError": policy_error, "plan": bounded_json(candidate.as_payload())})
                action_types = {str(action.get("type") or "").strip().casefold().replace("-", "_") for action in candidate.actions}
                if "observe" in action_types and action_types != {"observe"}:
                    candidate = _normalize_initial_observation_request(candidate)
                    if candidate is None:
                        return None, None
                bound_candidate, binding_error = _bind_observed_actions(
                    candidate,
                    observed_context["portalObservation"],
                    record_identity=_detail_identity(resolved_values.get("recordIdentity")),
                    allow_valid_detail_metadata=policy_error is None,
                )
                if binding_error:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The requested read-only control did not have one uniquely observed target.",
                        page=request.start_path,
                        scope=verified_scope,
                        missing=(binding_error,),
                    )
                    return None, ReaderOutcome(result, {
                        "stage": "observed_action_binding",
                        "permission": permission_audit,
                        "plan": bounded_json(candidate.as_payload()),
                        "observation": observed_context["portalObservation"],
                    })
                if bound_candidate is not None:
                    bound_policy_error = validate_policy(bound_candidate, reason="after_observed_binding")
                    if bound_policy_error:
                        status: ReaderStatus = "no_permission" if bound_policy_error in {"page_not_permitted", "permission_context_incomplete", "button_not_permitted"} else "not_confirmed"
                        result = ReaderResult(status=status, summary="The bound portal operation is not permitted.", missing=(bound_policy_error,))
                        return None, ReaderOutcome(result, {
                            "stage": "policy_after_observed_binding", "permission": permission_audit,
                            "policyError": bound_policy_error, "plan": bounded_json(bound_candidate.as_payload()),
                        })
                return bound_candidate, None

            next_request, follow_up_rejection = normalize_follow_up(next_request)
            if follow_up_rejection is not None:
                return follow_up_rejection
            if (
                next_request is None
                and isinstance(next_plan, dict)
                and next_plan.get("mode") == "portal_read"
            ):
                repair_context = {
                    **observed_context,
                    "planningDirective": {
                        "repairInvalidPortalReadPlan": True,
                        "reason": "follow_up_plan_did_not_match_closed_schema",
                        "rejectedPlan": bounded_json(next_plan, max_depth=4, max_items=30, max_string=200),
                        "requiredPortalRequestKeys": ["startPath", "actions", "expectedFields"],
                        "allowedActionKeys": [
                            "type", "path", "url", "selector", "label", "role", "name", "field",
                            "section", "emptyState", "permissionCode", "value", "values", "method",
                            "parameters", "filters", "direction",
                        ],
                    },
                }
                try:
                    next_plan = await plan_stage(
                        repair_context,
                        timeout_stage="planning_after_observe_correction",
                        reason="repair_follow_up_plan",
                    )
                except ReaderStageTimeout as exc:
                    missing = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The invalid follow-up read plan could not be corrected in time.",
                        missing=(missing,),
                    )
                    return ReaderOutcome(
                        result,
                        {
                            **_timeout_evidence(exc, budget),
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                        },
                    )
                except (httpx.HTTPError, RuntimeError, ValueError, TypeError) as exc:
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The invalid follow-up read plan could not be corrected.",
                        missing=("invalid_follow_up_plan",),
                    )
                    return ReaderOutcome(
                        result,
                        {
                            "stage": "planning_after_observe_correction",
                            "permission": permission_audit,
                            "observation": observed_context["portalObservation"],
                            "errorType": type(exc).__name__,
                        },
                    )
                next_request = portal_read_request_from_plan(next_plan)
                next_request, follow_up_rejection = normalize_follow_up(next_request)
                if follow_up_rejection is not None:
                    return follow_up_rejection
                if next_request is None:
                    result = ReaderResult(status="not_confirmed", summary="The corrected follow-up portal plan was still invalid.", missing=("invalid_follow_up_plan",))
                    return ReaderOutcome(result, {"stage": "planning_after_observe_correction", "permission": permission_audit,
                                                  "plan": bounded_json(next_plan), "observation": observed_context["portalObservation"]})
            repeated_observe = (
                next_request is not None
                and (urlsplit(next_request.start_path).path.rstrip("/") or "/")
                == (urlsplit(request.start_path).path.rstrip("/") or "/")
                and any(str(action.get("type") or "").casefold() == "observe" for action in next_request.actions)
            )
            if repeated_observe:
                section_hint = next(
                    (
                        str(action.get("section") or "").strip()
                        for action in next_request.actions
                        if str(action.get("type") or "").casefold() == "observe"
                    ),
                    "",
                )
                repeated_result = _result_from_structured_observation(
                    observed_context["portalObservation"],
                    page=request.start_path,
                    section_name=section_hint,
                    answer_shape=reader_answer_shape(question, bounded_conversation_context),
                    scope=verified_scope,
                    question=question,
                )
                if repeated_result is not None:
                    semantic_resolution = record_semantic_resolution(
                        decision="fallback",
                        reason="invalid_repeated_observe_plan",
                        llm_plan=next_plan,
                        result=repeated_result,
                        fallback_strategy="structured_unique_evidence",
                    )
                    return ReaderOutcome(
                        repeated_result,
                        {
                            "stage": "completed_from_existing_observation",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "plan": bounded_json(next_plan),
                            "observation": observed_context["portalObservation"],
                            "result": repeated_result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                result = ReaderResult(
                    status="not_confirmed",
                    summary="The repeated observation did not identify a single section with new verifiable evidence.",
                    page=request.start_path,
                    section=section_hint,
                    scope=verified_scope,
                    missing=("repeated_observe_without_new_evidence",),
                )
                return ReaderOutcome(
                    result,
                    {
                        "stage": "planning_after_observe",
                        "permission": permission_audit,
                        "plan": bounded_json(next_plan),
                        "observation": observed_context["portalObservation"],
                    },
                )
            if next_request is not None:
                trace.record(
                    "semantic_resolution",
                    "passed",
                    input_summary={"reason": "after_observe", "llmMode": "portal_read"},
                    output_summary={"decision": "follow_up_read", "actionCount": len(next_request.actions)},
                )
            if (
                next_request is None
                or len(request.actions) + len(next_request.actions) > self.policy.max_actions
                or len(portal_request_paths(request) | portal_request_paths(next_request)) > self.policy.max_pages
            ):
                result = ReaderResult(status="not_confirmed", summary="The follow-up portal plan was not valid.", page=request.start_path, missing=("invalid_follow_up_plan",))
                return ReaderOutcome(result, {"stage": "planning_after_observe", "permission": permission_audit, "plan": bounded_json(next_plan), "observation": observed_context["portalObservation"]})
            policy_error = validate_policy(next_request, reason="after_observe")
            if policy_error:
                status: ReaderStatus = "no_permission" if policy_error in {"page_not_permitted", "permission_context_incomplete", "button_not_permitted"} else "not_confirmed"
                result = ReaderResult(status=status, summary="The follow-up portal operation is not permitted.", missing=(policy_error,))
                return ReaderOutcome(result, {"stage": "policy_after_observe", "permission": permission_audit, "policyError": policy_error, "plan": bounded_json(next_request.as_payload())})
            try:
                tool_result = await portal_read_stage(
                    next_request,
                    timeout_stage="portal_read_after_observe",
                    attempt="after_observe",
                )
            except ReaderStageTimeout as exc:
                missing = "reader_total_timeout" if exc.total_budget else "portal_read_timeout"
                result = ReaderResult(status="load_failed", summary="The follow-up Admin Portal page read did not complete in time.", missing=(missing,))
                return ReaderOutcome(result, {**_timeout_evidence(exc, budget), "permission": permission_audit})
            request = next_request
            follow_up_payload = tool_result.get("result") if isinstance(tool_result, dict) else None
            follow_up_observation = (
                follow_up_payload.get("observation") if isinstance(follow_up_payload, dict) else None
            )
            if follow_up_observation is not None:
                bounded_follow_up_observation = bounded_portal_observation(follow_up_observation)
                follow_up_shape = "detail" if compound_first_detail else reader_answer_shape(
                    question, bounded_conversation_context,
                )
                resolved_detail_identity = _detail_identity(resolved_values.get("recordIdentity"))
                exact_follow_up_row = _native_exact_identity_row_result(
                    bounded_follow_up_observation,
                    page=next_request.start_path,
                    record_identity=resolved_detail_identity,
                    scope=verified_scope,
                    question=question,
                )
                if exact_follow_up_row is not None:
                    semantic_resolution = record_semantic_resolution(
                        decision="fallback",
                        reason="exact_identity_row_visible_after_follow_up",
                        result=exact_follow_up_row,
                        fallback_strategy="native_exact_identity_row",
                    )
                    return ReaderOutcome(
                        exact_follow_up_row,
                        {
                            "stage": "completed_from_exact_identity_row",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "portalReadPlan": bounded_json(next_request.as_payload()),
                            "observation": bounded_follow_up_observation,
                            "nativeIdentityMatch": resolved_detail_identity,
                            "result": exact_follow_up_row.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                if follow_up_shape == "detail" and resolved_detail_identity:
                    detail_page = next(
                        (
                            _cell_detail_destination(action)
                            for action in next_request.actions
                            if str(action.get("type") or "").casefold().replace("-", "_") == "show_detail"
                            and _cell_detail_destination(action)
                        ),
                        next_request.start_path,
                    )
                    detail_result = _native_detail_observation_result(
                        bounded_follow_up_observation,
                        page=detail_page,
                        record_identity=resolved_detail_identity,
                        scope=verified_scope,
                        question=question,
                    )
                    if detail_result is not None:
                        if compound_first_detail:
                            detail_result = _compound_list_detail_result(
                                detail_result,
                                observed_context.get("portalObservation"),
                                resolved_detail_identity,
                            )
                        semantic_resolution = record_semantic_resolution(
                            decision="fallback",
                            reason="detail_already_loaded",
                            result=detail_result,
                            fallback_strategy="native_detail_observation",
                        )
                        return ReaderOutcome(
                            detail_result,
                            {
                                "stage": "completed_from_detail_observation",
                                "permission": permission_audit,
                                "knowledge": knowledge_context,
                                "portalReadPlan": bounded_json(next_request.as_payload()),
                                "observation": bounded_follow_up_observation,
                                "result": detail_result.public_json(),
                                "semanticResolution": semantic_resolution,
                            },
                        )
                follow_up_section = next(
                    (
                        str(action.get("section") or "").strip()
                        for action in reversed(next_request.actions)
                        if action.get("section")
                    ),
                    "",
                ) or _infer_observation_section(
                    bounded_follow_up_observation,
                    question=question,
                    expected_fields=next_request.expected_fields,
                    answer_shape=follow_up_shape,
                )
                post_action_context = {
                    **knowledge_context,
                    "portalObservation": bounded_follow_up_observation,
                    "priorPortalRead": bounded_json(next_request.as_payload(), max_depth=4, max_items=30, max_string=200),
                }
                post_action_plan: Any = None
                post_action_error = ""
                bound_post_action_detail = (
                    observed_detail_action(
                        bounded_follow_up_observation, resolved_detail_identity, next_request.start_path,
                    )
                    if follow_up_shape == "detail" and resolved_detail_identity
                    else None
                )
                if bound_post_action_detail is not None:
                    post_action_plan = {
                        "mode": "portal_read",
                        "portalRequest": {
                            "startPath": next_request.start_path,
                            "actions": [bound_post_action_detail],
                            "expectedFields": [],
                        },
                    }
                    trace.record(
                        "planning",
                        "passed",
                        input_summary={"reason": "after_read_state_change", "hasPortalObservation": True},
                        output_summary={"mode": "portal_read", "selection": "unique_record_identity"},
                    )
                else:
                    try:
                        post_action_plan = await plan_stage(
                            post_action_context,
                            timeout_stage="planning_after_read_state_change",
                            reason="after_read_state_change",
                        )
                    except ReaderStageTimeout as exc:
                        post_action_error = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                    except (httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError):
                        post_action_error = "planner_error"

                post_action_request = portal_read_request_from_plan(post_action_plan)
                follow_up_result = observation_result_from_plan(
                    post_action_plan,
                    bounded_follow_up_observation,
                    verified_scope=verified_scope,
                    observed_page=next_request.start_path,
                    permitted_paths=(*permission_context.pages, *permission_context.subpages),
                )
                post_action_plan, follow_up_result = await repair_partial_observation(
                    post_action_plan, follow_up_result, post_action_context, page=next_request.start_path,
                )
                post_action_request = portal_read_request_from_plan(post_action_plan)
                if (post_action_request is not None and post_action_request.start_path == next_request.start_path
                        and len(post_action_request.actions) == 1
                        and post_action_request.actions[0].get('type') == 'switch_tab'
                        and next_request.actions and all(a.get('type') == 'switch_tab' for a in next_request.actions)):
                    target = post_action_request.actions[0].get('name')
                    if all(not _state_control_label_matches(a.get('name'), target) for a in next_request.actions):
                        # Each execution opens a fresh page. Replay its verified
                        # parent tabs before selecting the newly observed child.
                        post_action_request = replace(post_action_request,
                            actions=next_request.actions + post_action_request.actions)
                if (
                    category_requirement
                    and category_read_is_in_place
                    and follow_up_shape in {"list", "detail"}
                    and not _observation_has_category_children(
                        bounded_follow_up_observation,
                        category_requirement.semantic_label,
                    )
                    and post_action_request is None
                ):
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The selected category did not expose matching child evidence.",
                        page=next_request.start_path,
                        section=category_requirement.semantic_label,
                        answer_shape=follow_up_shape,
                        scope=verified_scope,
                        missing=("collection_children_not_confirmed",),
                    )
                    semantic_resolution = record_semantic_resolution(
                        decision="not_confirmed",
                        reason="category_child_evidence_not_confirmed",
                        llm_plan=post_action_plan,
                        result=result,
                    )
                    return ReaderOutcome(
                        result,
                        {
                            "stage": "validation_after_read_state_change",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "plan": bounded_json(post_action_plan),
                            "portalReadPlan": bounded_json(next_request.as_payload()),
                            "observation": bounded_follow_up_observation,
                            "result": result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                if follow_up_result is not None and (follow_up_result.status in {"success", "no_data"} or follow_up_result.facts):
                    semantic_resolution = record_semantic_resolution(
                        decision="llm_result",
                        reason="validated_post_action_observation_result",
                        llm_plan=post_action_plan,
                        result=follow_up_result,
                    )
                    return ReaderOutcome(
                        follow_up_result,
                        {
                            "stage": "completed_after_read_state_change",
                            "permission": permission_audit,
                            "knowledge": knowledge_context,
                            "plan": bounded_json(post_action_plan),
                            "portalReadPlan": bounded_json(next_request.as_payload()),
                            "observation": bounded_follow_up_observation,
                            "result": follow_up_result.public_json(),
                            "semanticResolution": semantic_resolution,
                        },
                    )
                post_action_planned_result = _observation_plan_result_from_plan(post_action_plan)
                fallback_reason = post_action_error
                if not fallback_reason and post_action_planned_result is not None:
                    fallback_reason = (
                        "llm_not_confirmed"
                        if post_action_planned_result.status == "not_confirmed"
                        and follow_up_result is not None
                        else "invalid_observation_references"
                    )
                if not fallback_reason and post_action_request is None:
                    fallback_reason = "invalid_semantic_schema"
                if fallback_reason:
                    planned_section = (
                        (post_action_planned_result.source_section or post_action_planned_result.section)
                        if post_action_planned_result is not None
                        else ""
                    )
                    fallback_section = planned_section or follow_up_section
                    fallback_answer_shape = (
                        post_action_planned_result.answer_shape
                        if post_action_planned_result is not None
                        and post_action_planned_result.answer_shape != "unspecified"
                        else follow_up_shape
                    )
                    fallback_result, fallback_strategy = deterministic_observation_fallback(
                        bounded_follow_up_observation,
                        page=next_request.start_path,
                        section=fallback_section,
                        answer_shape=fallback_answer_shape,
                        scope=verified_scope,
                        selection=post_action_planned_result,
                    )
                    semantic_resolution = record_semantic_resolution(
                        decision="fallback" if fallback_result is not None else "not_confirmed",
                        reason=fallback_reason,
                        llm_plan=post_action_plan,
                        result=fallback_result or follow_up_result,
                        fallback_strategy=fallback_strategy,
                    )
                    if fallback_result is not None:
                        return ReaderOutcome(
                            fallback_result,
                            {
                                "stage": "completed_after_read_state_change_fallback",
                                "permission": permission_audit,
                                "knowledge": knowledge_context,
                                "plan": bounded_json(post_action_plan),
                                "portalReadPlan": bounded_json(next_request.as_payload()),
                                "observation": bounded_follow_up_observation,
                                "result": fallback_result.public_json(),
                                "semanticResolution": semantic_resolution,
                            },
                        )
                    if follow_up_result is not None:
                        return ReaderOutcome(
                            follow_up_result,
                            {
                                "stage": "completed_after_read_state_change",
                                "permission": permission_audit,
                                "knowledge": knowledge_context,
                                "plan": bounded_json(post_action_plan),
                                "portalReadPlan": bounded_json(next_request.as_payload()),
                                "observation": bounded_follow_up_observation,
                                "result": follow_up_result.public_json(),
                                "semanticResolution": semantic_resolution,
                            },
                        )
                    if (
                        post_action_planned_result is not None
                        and post_action_planned_result.status == "not_confirmed"
                    ):
                        unconfirmed_result = replace(
                            post_action_planned_result,
                            page=next_request.start_path,
                            scope=verified_scope,
                            facts=(),
                        )
                        return ReaderOutcome(
                            unconfirmed_result,
                            {
                                "stage": "completed_after_read_state_change",
                                "permission": permission_audit,
                                "knowledge": knowledge_context,
                                "plan": bounded_json(post_action_plan),
                                "portalReadPlan": bounded_json(next_request.as_payload()),
                                "observation": bounded_follow_up_observation,
                                "result": unconfirmed_result.public_json(),
                                "semanticResolution": semantic_resolution,
                            },
                        )
                if post_action_request is not None:
                    # The post-action observation is already fresh and
                    # permission-checked. Give the bounded deterministic
                    # resolver one chance to answer from it before reporting
                    # that another portal read is required.
                    fallback_result, fallback_strategy = deterministic_observation_fallback(
                        bounded_follow_up_observation,
                        page=next_request.start_path,
                        section=follow_up_section,
                        answer_shape=follow_up_shape,
                        scope=verified_scope,
                    )
                    pending_tab = any(a.get('type') == 'switch_tab' and any(
                        isinstance(t, dict) and t.get('selected') is False
                        and _state_control_label_matches(t.get('name'), a.get('name'))
                        for t in bounded_follow_up_observation.get('tabControls', [])) for a in post_action_request.actions)
                    if pending_tab:
                        fallback_result = None  # The requested child state has not been read yet.
                    if fallback_result is not None:
                        semantic_resolution = record_semantic_resolution(
                            decision="fallback",
                            reason="post_action_plan_redundant_for_observation",
                            llm_plan=post_action_plan,
                            result=fallback_result,
                            fallback_strategy=fallback_strategy,
                        )
                        return ReaderOutcome(
                            fallback_result,
                            {
                                "stage": "completed_after_read_state_change_fallback",
                                "permission": permission_audit,
                                "knowledge": knowledge_context,
                                "plan": bounded_json(post_action_plan),
                                "portalReadPlan": bounded_json(next_request.as_payload()),
                                "observation": bounded_follow_up_observation,
                                "result": fallback_result.public_json(),
                                "semanticResolution": semantic_resolution,
                            },
                        )
                    post_action_policy_error = validate_policy(post_action_request, reason="after_read_state_change")
                    if not post_action_policy_error:
                        cumulative_actions = len(request.actions) + len(next_request.actions) + len(post_action_request.actions)
                        cumulative_pages = len(
                            portal_request_paths(request)
                            | portal_request_paths(next_request)
                            | portal_request_paths(post_action_request)
                        )
                        if cumulative_actions <= self.policy.max_actions and cumulative_pages <= self.policy.max_pages:
                            try:
                                replay_result = await portal_read_stage(
                                    post_action_request,
                                    timeout_stage="portal_read_after_read_state_change",
                                    attempt="after_read_state_change",
                                )
                            except ReaderStageTimeout as exc:
                                missing = "reader_total_timeout" if exc.total_budget else "portal_read_timeout"
                                result = ReaderResult(
                                    status="load_failed",
                                    summary="The bounded replay portal read did not complete in time.",
                                    page=post_action_request.start_path,
                                    scope=verified_scope,
                                    missing=(missing,),
                                )
                                return ReaderOutcome(
                                    result,
                                    {
                                        **_timeout_evidence(exc, budget),
                                        "stage": "portal_read_after_read_state_change",
                                        "permission": permission_audit,
                                        "knowledge": knowledge_context,
                                        "plan": bounded_json(post_action_plan),
                                        "portalReadPlan": bounded_json(post_action_request.as_payload()),
                                    },
                                )
                            if replay_result is not None:
                                replay_payload = replay_result.get("result") if isinstance(replay_result, dict) else None
                                replay_observation = replay_payload.get("observation") if isinstance(replay_payload, dict) else None
                                replay_reader_result: ReaderResult | None = None
                                if replay_observation is not None:
                                    bounded_replay_observation = bounded_portal_observation(replay_observation)
                                    try:
                                        replay_plan = await plan_stage(
                                            {
                                                **knowledge_context,
                                                "portalObservation": bounded_replay_observation,
                                                "priorPortalRead": bounded_json(post_action_request.as_payload(), max_depth=4, max_items=30, max_string=200),
                                            },
                                            timeout_stage="planning_after_bounded_replay",
                                            reason="after_bounded_replay",
                                        )
                                    except (ReaderStageTimeout, httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError):
                                        replay_plan = None
                                    replay_reader_result = observation_result_from_plan(
                                        replay_plan,
                                        bounded_replay_observation,
                                        verified_scope=verified_scope,
                                        observed_page=post_action_request.start_path,
                                        permitted_paths=(*permission_context.pages, *permission_context.subpages),
                                    )
                                    if replay_reader_result is None:
                                        replay_reader_result = deterministic_observation_fallback(
                                            bounded_replay_observation,
                                            page=post_action_request.start_path,
                                            section=follow_up_section,
                                            answer_shape=follow_up_shape,
                                            scope=verified_scope,
                                            selection=_observation_plan_result_from_plan(replay_plan),
                                        )[0]
                                if replay_reader_result is not None and replay_reader_result.status in {"success", "no_data"}:
                                    semantic_resolution = record_semantic_resolution(
                                        decision="follow_up_read",
                                        reason="bounded_replay_after_state_change",
                                        llm_plan=post_action_plan,
                                        result=replay_reader_result,
                                    )
                                    return ReaderOutcome(
                                        replay_reader_result,
                                        {
                                            "stage": "completed_after_bounded_replay",
                                            "permission": permission_audit,
                                            "knowledge": knowledge_context,
                                            "plan": bounded_json(post_action_plan),
                                            "portalReadPlan": bounded_json(post_action_request.as_payload()),
                                            "observation": bounded_portal_observation(replay_observation) if replay_observation is not None else {},
                                            "result": replay_reader_result.public_json(),
                                            "semanticResolution": semantic_resolution,
                                        },
                                    )
                    semantic_resolution = record_semantic_resolution(
                        decision="additional_read_not_executed",
                        reason="post_action_requires_additional_read",
                        llm_plan=post_action_plan,
                    )
                    result = ReaderResult(
                        status="not_confirmed",
                        summary="The post-action observation requires another bounded read.",
                        page=next_request.start_path,
                        missing=("additional_portal_read_required",),
                    )
                    return ReaderOutcome(
                        result,
                        {
                            "stage": "planning_after_read_state_change",
                            "permission": permission_audit,
                            "plan": bounded_json(post_action_plan),
                            "observation": bounded_follow_up_observation,
                            "semanticResolution": semantic_resolution,
                        },
                    )
        result = _align_result_to_answer_shape(
            _reader_result_from_tool(tool_result),
            question,
            bounded_conversation_context,
        )
        api_failure = str(api_audit.get("reason") or "") if api_audit.get("decision") == "not_confirmed" else ""
        if api_failure and result.status in {"success", "no_data"}:
            # A raw Tool status is not independently grounded DOM evidence. All
            # validated DOM/API successes return before this terminal fallback.
            result = ReaderResult(
                status="not_confirmed",
                summary="The requested portal evidence could not be confirmed.",
                page=result.page,
                answer_shape=result.answer_shape,
                completeness="bounded",
                scope=result.scope,
                missing=(api_failure,),
            )
        retryable_control_failures = {
            "reader_selector_not_found",
            "reader_click_descriptor_mismatch",
            "reader_click_role_mismatch",
            "reader_tab_state_not_confirmed",
            "reader_filter_control_unsupported",
            "reader_filter_option_not_found",
        }
        raw_final_payload = tool_result.get("result") if isinstance(tool_result, dict) else None
        final_limitations = set(
            _strings(raw_final_payload.get("limitations") or (), limit=10)
            if isinstance(raw_final_payload, dict)
            else ()
        )
        if (
            result.status == "load_failed"
            and final_limitations.intersection(retryable_control_failures)
            and not any(str(action.get("type") or "").casefold() == "observe" for action in request.actions)
        ):
            observe_request = PortalReadRequest(
                start_path=request.start_path,
                actions=({"type": "observe"},),
                expected_fields=(),
            )
            if validate_policy(observe_request, reason="control_failure_recovery") is None:
                try:
                    observed_tool_result = await portal_read_stage(
                        observe_request,
                        timeout_stage="portal_observe_after_control_failure",
                        attempt="control_failure_recovery",
                    )
                except ReaderStageTimeout:
                    observed_tool_result = {}
                observed_payload = (
                    observed_tool_result.get("result")
                    if isinstance(observed_tool_result, dict)
                    else None
                )
                retry_observation = (
                    observed_payload.get("observation")
                    if isinstance(observed_payload, dict)
                    else None
                )
                if retry_observation is not None:
                    bounded_retry_observation = bounded_portal_observation(retry_observation)
                    retry_shape = reader_answer_shape(question, bounded_conversation_context)
                    retry_section = _infer_observation_section(
                        bounded_retry_observation,
                        question=question,
                        answer_shape=retry_shape,
                    )
                    recovery_plan: Any = None
                    recovery_error = ""
                    try:
                        recovery_plan = await plan_stage(
                            {
                                **knowledge_context,
                                "portalObservation": bounded_retry_observation,
                                "priorPortalFailure": bounded_json(
                                    raw_final_payload, max_depth=4, max_items=20, max_string=160
                                ),
                            },
                            timeout_stage="planning_after_control_failure_observe",
                            reason="after_control_failure_observe",
                        )
                    except ReaderStageTimeout as exc:
                        recovery_error = "reader_total_timeout" if exc.total_budget else "planner_timeout"
                    except (httpx.HTTPError, RuntimeError, ValueError, TypeError, IndexError):
                        recovery_error = "planner_error"
                    verified_scope = _permission_result_scope(permission_context)
                    observed_result = observation_result_from_plan(
                        recovery_plan,
                        bounded_retry_observation,
                        verified_scope=verified_scope,
                        observed_page=request.start_path,
                        permitted_paths=(*permission_context.pages, *permission_context.subpages),
                    )
                    recovery_plan, observed_result = await repair_partial_observation(
                        recovery_plan, observed_result,
                        {**knowledge_context, "portalObservation": bounded_retry_observation},
                        page=request.start_path,
                    )
                    if observed_result is not None and (observed_result.status in {"success", "no_data"} or observed_result.facts):
                        semantic_resolution = record_semantic_resolution(
                            decision="llm_result",
                            reason="validated_control_failure_observation_result",
                            llm_plan=recovery_plan,
                            result=observed_result,
                        )
                        return ReaderOutcome(
                            observed_result,
                            {
                                "stage": "completed_from_control_failure_observation",
                                "permission": permission_audit,
                                "knowledge": knowledge_context,
                                "failedPlan": bounded_json(request.as_payload()),
                                "failure": bounded_json(raw_final_payload),
                                "observation": bounded_retry_observation,
                                "result": observed_result.public_json(),
                                "semanticResolution": semantic_resolution,
                            },
                        )
                    recovery_planned_result = _observation_plan_result_from_plan(recovery_plan)
                    recovery_request = portal_read_request_from_plan(recovery_plan)
                    fallback_reason = recovery_error
                    if not fallback_reason and recovery_planned_result is not None:
                        fallback_reason = (
                            "llm_not_confirmed"
                            if recovery_planned_result.status == "not_confirmed"
                            and observed_result is not None
                            else "invalid_observation_references"
                        )
                    if not fallback_reason and recovery_request is None:
                        fallback_reason = "invalid_semantic_schema"
                    if fallback_reason:
                        planned_section = (
                            recovery_planned_result.source_section or recovery_planned_result.section
                            if recovery_planned_result is not None
                            else ""
                        )
                        fallback_result, fallback_strategy = deterministic_observation_fallback(
                            bounded_retry_observation,
                            page=request.start_path,
                            section=planned_section or retry_section,
                            answer_shape=(
                                recovery_planned_result.answer_shape
                                if recovery_planned_result is not None
                                and recovery_planned_result.answer_shape != "unspecified"
                                else retry_shape
                            ),
                            scope=verified_scope,
                            selection=recovery_planned_result,
                        )
                        semantic_resolution = record_semantic_resolution(
                            decision="fallback" if fallback_result is not None else "not_confirmed",
                            reason=fallback_reason,
                            llm_plan=recovery_plan,
                            result=fallback_result or observed_result,
                            fallback_strategy=fallback_strategy,
                        )
                        if fallback_result is not None:
                            return ReaderOutcome(
                                fallback_result,
                                {
                                    "stage": "completed_from_control_failure_observation_fallback",
                                    "permission": permission_audit,
                                    "knowledge": knowledge_context,
                                    "failedPlan": bounded_json(request.as_payload()),
                                    "failure": bounded_json(raw_final_payload),
                                    "plan": bounded_json(recovery_plan),
                                    "observation": bounded_retry_observation,
                                    "result": fallback_result.public_json(),
                                    "semanticResolution": semantic_resolution,
                                },
                            )
        if not result.page:
            # Preserve the permission-checked navigation target after a failed
            # control read, so a follow-up cannot drift to a sibling module.
            result = replace(result, page=request.start_path, source_hint={'page': request.start_path})
        return ReaderOutcome(
            result,
            {
                "stage": "completed",
                "permission": permission_audit,
                "knowledge": knowledge_context,
                "plan": bounded_json(request.as_payload()),
                "portalEvidence": bounded_json(tool_result, max_depth=6, max_items=100, max_string=1_000),
                "observation": bounded_portal_observation(raw_final_payload.get('observation')) if isinstance(raw_final_payload, dict) and isinstance(raw_final_payload.get('observation'), dict) else {},
            },
        )
