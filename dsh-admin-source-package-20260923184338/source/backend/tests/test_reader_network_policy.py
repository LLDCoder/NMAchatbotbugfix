import asyncio
import copy
import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from test_platform_portal_reader import FakeRoute, gateway, read_request


@pytest.fixture(autouse=True)
def enforce_whitelist_for_test(monkeypatch):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", True)


@pytest.mark.parametrize("value,expected", [("true", True), ("1", True), ("false", False), ("0", False), (" FALSE ", False)])
def test_whitelist_boolean_is_explicit(monkeypatch, value, expected):
    monkeypatch.setenv("PORTAL_READER_WHITELIST_ENABLED", value)
    assert gateway._reader_whitelist_enabled() is expected


def test_missing_switch_defaults_to_enforcement(monkeypatch):
    monkeypatch.delenv("PORTAL_READER_WHITELIST_ENABLED", raising=False)
    assert gateway._reader_whitelist_enabled() is True


@pytest.mark.parametrize('method,path,expected', [
    ('GET', '/api/Team/MyTeamMembers?isLeave=false', True),
    ('POST', '/api/Team/MyTeamMembers', False),
    ('GET', '/api/Team/MyTeamMemberReturn?userId=test', False),
    ('POST', '/api/Team/MyTeamMemberLeave', False),
])
def test_managed_roster_registration_does_not_enable_neighbor_mutations(method, path, expected):
    request = FakeRoute(method, 'https://admin.example.test' + path, 'fetch').request
    assert gateway._reader_api_configured_policy_allows(request, 'https://admin.example.test') is expected


@pytest.mark.parametrize('path', [
    '/api/admin/finance/transactions/TXN-123',
    '/api/admin/payments/refunds/RFD-123',
    '/api/admin/payments/refunds/statistics',
    '/api/admin/inspection/violations/123/timeline',
    '/api/Enquiry/Management/123/Timeline',
    '/api/UserManagement/GetRegionList/7',
    '/api/Application/123/recall-approval/eligibility',
])
def test_reviewed_detail_dependencies_keep_method_and_origin_limits(path):
    for method, origin, expected in [('GET', 'https://admin.example.test', True),
                                     ('POST', 'https://admin.example.test', False),
                                     ('GET', 'https://outside.example.test', False)]:
        request = FakeRoute(method, origin + path, 'fetch').request
        assert gateway._reader_api_configured_policy_allows(request, 'https://admin.example.test') is expected


@pytest.mark.parametrize('path', [
    '/api/admin/finance/transactions/export',
    '/api/admin/payments/refunds/RFD-123/execute',
    '/api/admin/inspection/violations/123/decide',
    '/api/Enquiry/Management/123/Conversation',
    '/api/Application/123/recall-approval',
    '/api/LicenseManagement/export-2026',
])
def test_detail_registration_does_not_enable_adjacent_actions(path):
    for method in ('GET', 'POST'):
        request = FakeRoute(method, 'https://admin.example.test' + path, 'fetch').request
        assert not gateway._reader_api_configured_policy_allows(request, 'https://admin.example.test')


def test_array_transport_proof_distinguishes_type_changes():
    original = {'rows': [{'enabled': True}]}
    captured = {'rows': [{'enabled': 1}]}
    proof = gateway._reader_field_evidence(original, captured)['/rows']
    assert proof['status'] == 'bounded'
    assert proof['valueHash'] == gateway._collection_digest(captured['rows'])


@pytest.mark.parametrize("value", ["", "offf", "yes", "disabled", "2"])
def test_invalid_switch_never_silently_disables_policy(monkeypatch, value):
    monkeypatch.setenv("PORTAL_READER_WHITELIST_ENABLED", value)
    with pytest.raises(ValueError, match="PORTAL_READER_WHITELIST_ENABLED"):
        gateway._reader_whitelist_enabled()


def test_bundled_policy_is_the_runtime_source():
    policy = gateway._load_reader_network_policy(gateway.READER_NETWORK_POLICY_FILE)
    assert frozenset(policy["allowedMethods"]["GET"]) == gateway.READER_READ_ONLY_GET_PATHS
    assert frozenset(policy["allowedMethods"]["POST"]) == gateway.READER_READ_ONLY_POST_PATHS
    assert frozenset(policy["blockedExactPaths"]) == gateway.READER_BLOCKED_EXACT_PATHS
    assert frozenset(policy["staticFetchPaths"]) == gateway.READER_STATIC_FETCH_PATHS


def test_policy_can_be_loaded_from_an_independent_file(tmp_path):
    policy = copy.deepcopy(gateway.READER_NETWORK_POLICY)
    policy["allowedMethods"]["POST"].append("/api/example/search")
    path = tmp_path / "policy.json"
    path.write_text(json.dumps(policy))
    loaded = gateway._load_reader_network_policy(path)
    assert "/api/example/search" in loaded["allowedMethods"]["POST"]
    assert "/api/example/search" not in gateway.READER_READ_ONLY_POST_PATHS


@pytest.mark.parametrize("bad_path", ["/api/*", "/api/items?all=true", "/api/items#all", "https://elsewhere/api/items", "//elsewhere/api/items", "/api/items/../export", "/api/%2e%2e/items", "/api/items\\export", "/outside/items", "/api/items/"])
def test_policy_rejects_broad_or_ambiguous_paths(tmp_path, bad_path):
    policy = copy.deepcopy(gateway.READER_NETWORK_POLICY)
    policy["allowedMethods"]["GET"].append(bad_path)
    path = tmp_path / "policy.json"
    path.write_text(json.dumps(policy))
    with pytest.raises(ValueError):
        gateway._load_reader_network_policy(path)


@pytest.mark.parametrize("change", ["version", "unknown_key", "method", "duplicate", "conflict", "not_list", "post_template"])
def test_invalid_policy_fails_closed(tmp_path, change):
    policy = copy.deepcopy(gateway.READER_NETWORK_POLICY)
    if change == "version":
        policy["version"] = True
    elif change == "unknown_key":
        policy["allowAll"] = True
    elif change == "method":
        policy["allowedMethods"]["DELETE"] = ["/api/items"]
    elif change == "duplicate":
        policy["allowedMethods"]["GET"] *= 2
    elif change == "conflict":
        policy["allowedMethods"]["GET"].append(policy["blockedExactPaths"][0])
    elif change == "not_list":
        policy["allowedMethods"]["GET"] = "/api/items"
    else:
        policy["allowedMethods"]["POST"].append("/api/items/:id")
    path = tmp_path / "policy.json"
    path.write_text(json.dumps(policy))
    with pytest.raises(ValueError):
        gateway._load_reader_network_policy(path)


def test_missing_or_malformed_policy_never_becomes_allow_all(tmp_path):
    with pytest.raises(FileNotFoundError):
        gateway._load_reader_network_policy(tmp_path / "missing.json")
    path = tmp_path / "policy.json"
    path.write_text("{")
    with pytest.raises(ValueError):
        gateway._load_reader_network_policy(path)


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/admin/inspection/appeals/customer-happiness/todo"),
    ("POST", "/api/unknown/query"),
    ("POST", "/api/admin/inspection/tasks"),
    ("PUT", "/api/example/42"),
    ("PATCH", "/api/example/42"),
    ("DELETE", "/api/example/42"),
    ("OPTIONS", "/api/example/42"),
    ("GET", "/api/Document/Download"),
    ("POST", "/api/clientlog/report"),
    ("GET", "/runtime.json"),
])
def test_disabled_whitelist_bypasses_method_path_policy_only_in_mock(monkeypatch, method, path):
    route = FakeRoute(method, "https://admin.example.test" + path, "fetch")
    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test"))
    assert route.result[0] == "abort"
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", False)
    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test"))
    assert route.result == ("continue", None)


@pytest.mark.parametrize("enabled", [True, False])
def test_guard_health_uses_actual_switch_decision(monkeypatch, enabled):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", enabled)
    path = "/api/admin/inspection/appeals/customer-happiness/todo"
    route = FakeRoute("GET", "https://admin.example.test" + path)
    health = {"blocked": [], "pending": {}}
    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))
    assert health["blocked"] == ([path] if enabled else [])
    assert health["pending"] == ({} if enabled else {id(route.request): path})


@pytest.mark.parametrize("enabled", [True, False])
def test_cross_origin_navigation_and_stream_guards_remain(monkeypatch, enabled):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", enabled)
    for url, resource_type in [
        ("https://outside.example.test/api/items", "fetch"),
        ("https://admin.example.test/unauthorized-page", "document"),
        ("https://admin.example.test/events", "eventsource"),
        ("wss://admin.example.test/socket", "websocket"),
    ]:
        route = FakeRoute("GET", url, resource_type)
        asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", frozenset({"/licensing"})))
        assert route.result[0] == "abort"


@pytest.mark.parametrize("action", ["approve", "submit", "delete", "assign", "send", "export", "upload", "download"])
def test_network_opt_out_does_not_authorize_mutating_reader_actions(monkeypatch, action):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", False)
    with pytest.raises(HTTPException):
        gateway._validate_reader_request(read_request([{"type": action}]))


@pytest.mark.parametrize("enabled", [True, False])
def test_health_exposes_active_mode_and_config(monkeypatch, enabled):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", enabled)
    health = asyncio.run(gateway.healthz())
    assert health["readerWhitelistEnabled"] is enabled
    assert health["readerNetworkMode"] == ("allowlist" if enabled else "same-origin-unrestricted")
    assert Path(health["readerWhitelistFile"]).name == "reader-network-policy.json"
    assert Path(health["readerOperationCatalogFile"]).name == "reader-operation-catalog.json"
    assert health["readerOperationCatalogCount"] == len(gateway.READER_OPERATION_CATALOG)


def test_api_discovery_deduplicates_normalized_operations_and_preserves_triggers():
    health = {"blocked": [], "pending": {}}
    first = FakeRoute(
        "GET",
        "https://admin.example.test/api/LicenseManagement/123?access_token=never-return-this",
    )
    asyncio.run(gateway._guard_reader_request(first, "https://admin.example.test", reader_health=health))
    gateway._reader_api_discovery_response_seen(health, first.request, 200)

    page = type("Page", (), {"_reader_health": health})()
    gateway._reader_set_api_discovery_trigger(page, "action:1:switch_tab")
    second = FakeRoute(
        "GET",
        "https://admin.example.test/api/LicenseManagement/456?page=2&token=also-secret",
    )
    asyncio.run(gateway._guard_reader_request(second, "https://admin.example.test", reader_health=health))
    gateway._reader_api_discovery_response_seen(health, second.request, 204)

    discovery = gateway._reader_api_discovery_snapshot(page)
    assert discovery == {
        "candidates": [{
            "operationKey": "GET /api/LicenseManagement/:id",
            "method": "GET",
            "path": "/api/LicenseManagement/:id",
            "pathTemplate": "/api/LicenseManagement/:id",
            "status": 204,
            "policyState": "allowed",
            "candidateKind": "business",
            "trigger": "action:1:switch_tab",
            "triggers": ["initial", "action:1:switch_tab"],
        }],
        "candidateCount": 1,
        "truncated": False,
        "selectableBusinessTruncated": False,
        "selectableSupportTruncated": False,
        "deltaCandidates": [],
        "deltaCandidateCount": 0,
        "deltaTruncated": False,
        "deltaSelectableBusinessTruncated": False,
        "deltaSelectableSupportTruncated": False,
    }
    assert "never-return-this" not in str(discovery)
    assert "also-secret" not in str(discovery)


def test_api_discovery_captures_arbitrary_bounded_json_response_as_candidate_evidence():
    health = {"blocked": [], "pending": {}}
    route = FakeRoute("GET", "https://admin.example.test/api/tasks/current")
    gateway._reader_record_api_candidate(
        health, route.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    operation_key = gateway._reader_api_discovery_response_seen(health, route.request, 200)

    class FakeResponse:
        headers = {"content-type": "application/json"}

        async def body(self):
            return json.dumps({
                "payload": {
                    "records": [{"taskNo": "TASK-7", "waitingOn": "Customer"}],
                    "performance": {"recent": 92.5},
                },
                "accessToken": "never-return-this",
            }).encode()

    asyncio.run(gateway._reader_capture_api_response_evidence(
        health, FakeResponse(), operation_key,
    ))

    candidate = gateway._reader_api_discovery_snapshot(
        type("Page", (), {"_reader_health": health})()
    )["candidates"][0]
    assert candidate["responseEvidence"] == {
        "payload": {
            "records": [{"taskNo": "TASK-7", "waitingOn": "Customer"}],
            "performance": {"recent": 92.5},
        },
    }
    assert candidate["responseEvidenceTruncated"] is False
    assert "never-return-this" not in str(candidate)


def test_api_evidence_budget_preserves_summary_siblings_after_large_record_list():
    payload = {
        "isSuccess": True,
        "data": {
            "priorityCards": [
                {
                    "applicationNumber": f"APP-{index}",
                    "title": "Application requiring review",
                    "sla": {
                        "displayText": "6d Overdue",
                        "remainingMinutes": 9150,
                        "history": [{"state": f"step-{step}"} for step in range(20)],
                    },
                }
                for index in range(20)
            ],
            "serviceApplicationCard": {
                "totalTasks": 24,
                "doneToday": 2,
                "overdueTasks": 3,
            },
            "refundCard": {"totalCount": 1, "overdueTasks": 0},
        },
    }

    evidence, truncated = gateway._reader_bounded_api_evidence(payload)

    assert truncated is True
    assert evidence["data"]["serviceApplicationCard"]["overdueTasks"] == 3
    assert evidence["data"]["refundCard"]["totalCount"] == 1
    assert "[truncated]" not in json.dumps(evidence)


def test_api_discovery_records_blocked_without_executing_or_exposing_request_data():
    health = {"blocked": [], "pending": {}}
    route = FakeRoute(
        "POST",
        "https://admin.example.test/api/example/99?authorization=Bearer+query-secret",
    )
    route.request.headers = {"Authorization": "Bearer header-secret"}
    route.request.post_data = '{"token":"body-secret"}'

    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))

    discovery = gateway._reader_api_discovery_snapshot(type("Page", (), {"_reader_health": health})())
    assert route.result == ("abort", "blockedbyclient")
    assert discovery["candidates"] == [{
        "operationKey": "POST /api/example/:id",
        "method": "POST",
        "path": "/api/example/:id",
        "pathTemplate": "/api/example/:id",
        "status": None,
        "policyState": "blocked",
        "candidateKind": "business",
        "trigger": "initial",
        "triggers": ["initial"],
    }]
    encoded = str(discovery)
    assert all(secret not in encoded for secret in ("query-secret", "header-secret", "body-secret"))


def test_api_discovery_redacts_short_record_ids_but_keeps_api_versions():
    health = {"blocked": [], "pending": {}}
    route = FakeRoute(
        "GET",
        "https://admin.example.test/api/v2/example/APP123/details",
    )

    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))

    discovery = gateway._reader_api_discovery_snapshot(type("Page", (), {"_reader_health": health})())
    assert discovery["candidates"][0]["operationKey"] == "GET /api/v2/example/:id/details"
    assert "APP123" not in str(discovery)


def test_api_template_does_not_authorize_export_shaped_as_record_id(monkeypatch):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", True)
    health = {"blocked": [], "pending": {}}
    route = FakeRoute(
        "GET",
        "https://admin.example.test/api/LicenseManagement/export",
    )

    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))

    assert route.result == ("abort", "blockedbyclient")
    candidate = gateway._reader_api_discovery_snapshot(type("Page", (), {"_reader_health": health})())["candidates"][0]
    assert candidate["policyState"] == "blocked"


def test_api_discovery_filters_get_user_info_and_explicit_background_logs():
    health = {"blocked": [], "pending": {}}
    for method, path in (
        ("POST", "/api/AdminUser/GetUserInfo"),
        ("POST", "/api/clientlog/report"),
        ("GET", "/api/SignalR/GetNotificationInfoList"),
    ):
        route = FakeRoute(method, "https://admin.example.test" + path)
        asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))

    assert gateway._reader_api_discovery_snapshot(
        type("Page", (), {"_reader_health": health})()
    ) == {
        "candidates": [], "candidateCount": 0, "truncated": False,
        "selectableBusinessTruncated": False, "selectableSupportTruncated": False,
        "deltaCandidates": [], "deltaCandidateCount": 0, "deltaTruncated": False,
        "deltaSelectableBusinessTruncated": False, "deltaSelectableSupportTruncated": False,
    }


def test_optional_operation_catalog_adds_bounded_swagger_metadata(monkeypatch, tmp_path):
    catalog_path = tmp_path / "operations.json"
    catalog_path.write_text(json.dumps({"operations": [{
        "method": "GET",
        "path": "/api/example/{itemId}",
        "tags": ["Example"],
        "requestFields": ["itemId", "includeDetails"],
        "responseFields": ["id", "status"],
        "classification": "read_only",
        "requestSchemas": ["ExampleRequest"],
        "responseSchemas": ["ExampleResponse"],
    }]}))
    monkeypatch.setattr(
        gateway, "READER_OPERATION_CATALOG", gateway._load_reader_operation_catalog(catalog_path),
    )
    health = {"blocked": [], "pending": {}}
    route = FakeRoute("GET", "https://admin.example.test/api/example/alpha")

    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))
    candidate = gateway._reader_api_discovery_snapshot(
        type("Page", (), {"_reader_health": health})()
    )["candidates"][0]

    assert candidate["operationKey"] == "GET /api/example/{itemId}"
    assert candidate["policyState"] == "blocked"
    assert candidate["candidateKind"] == "business"
    assert candidate["swagger"] == {
        "tags": ["Example"],
        "requestSchemas": ["ExampleRequest"],
        "requestFields": ["itemId", "includeDetails"],
        "responseSchemas": ["ExampleResponse"],
        "responseFields": ["id", "status"],
        "classification": "read_only",
    }


@pytest.mark.parametrize("path", [
    "/api/Lookup/GetLookupData",
    "/api/TypeDictionary/GetTypeDictionaries/CertificateStatus",
    "/api/admin/finance/lookups/payment-methods",
])
def test_api_discovery_marks_lookup_and_dictionary_candidates_as_support(path):
    health = {"blocked": [], "pending": {}}
    route = FakeRoute("GET", "https://admin.example.test" + path)

    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))

    candidate = gateway._reader_api_discovery_snapshot(
        type("Page", (), {"_reader_health": health})()
    )["candidates"][0]
    assert candidate["candidateKind"] == "support"


def test_api_discovery_is_bounded_to_32_unique_candidates(monkeypatch):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", False)
    health = {"blocked": [], "pending": {}}
    for index in range(gateway.READER_MAX_API_CANDIDATES + 1):
        suffix = chr(97 + index // 26) + chr(97 + index % 26)
        route = FakeRoute("GET", f"https://admin.example.test/api/example/operation-{suffix}")
        asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))

    discovery = gateway._reader_api_discovery_snapshot(
        type("Page", (), {"_reader_health": health})()
    )
    assert discovery["candidateCount"] == gateway.READER_MAX_API_CANDIDATES
    assert len(discovery["candidates"]) == gateway.READER_MAX_API_CANDIDATES
    assert discovery["truncated"] is True


def test_support_candidates_cannot_displace_allowed_business_candidates():
    health = {"blocked": [], "pending": {}}
    for index in range(gateway.READER_MAX_API_CANDIDATES):
        suffix = chr(97 + index // 26) + chr(97 + index % 26)
        route = FakeRoute("GET", f"https://admin.example.test/api/lookup/option-{suffix}")
        gateway._reader_record_api_candidate(
            health, route.request, "https://admin.example.test", allowed=True, policy_state="allowed",
        )
        gateway._reader_api_discovery_response_seen(health, route.request, 200)

    business = FakeRoute("GET", "https://admin.example.test/api/orders/current")
    gateway._reader_record_api_candidate(
        health, business.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, business.request, 200)

    discovery = gateway._reader_api_discovery_snapshot(type("Page", (), {"_reader_health": health})())
    assert discovery["candidateCount"] == gateway.READER_MAX_API_CANDIDATES
    assert "GET /api/orders/current" in {item["operationKey"] for item in discovery["candidates"]}
    assert discovery["selectableBusinessTruncated"] is False
    assert discovery["selectableSupportTruncated"] is True


def test_disabled_mode_bypassed_business_has_same_storage_priority_as_allowlisted_business(monkeypatch):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", False)
    health = {"blocked": [], "pending": {}}
    for index in range(gateway.READER_MAX_API_CANDIDATES):
        suffix = chr(97 + index // 26) + chr(97 + index % 26)
        route = FakeRoute("GET", f"https://admin.example.test/api/lookup/option-{suffix}")
        gateway._reader_record_api_candidate(
            health, route.request, "https://admin.example.test", allowed=True, policy_state="allowed",
        )
    business = FakeRoute("GET", "https://admin.example.test/api/unlisted-business/current")
    gateway._reader_record_api_candidate(
        health, business.request, "https://admin.example.test", allowed=True, policy_state="bypassed",
    )
    gateway._reader_api_discovery_response_seen(health, business.request, 200)

    discovery = gateway._reader_api_discovery_snapshot(type("Page", (), {"_reader_health": health})())
    selected = next(item for item in discovery["candidates"] if item["operationKey"].endswith("/current"))
    assert selected["policyState"] == "bypassed"
    assert discovery["selectableBusinessTruncated"] is False


def test_blocked_candidates_cannot_displace_allowed_business_candidates():
    health = {"blocked": [], "pending": {}}
    for index in range(gateway.READER_MAX_API_CANDIDATES):
        suffix = chr(97 + index // 26) + chr(97 + index % 26)
        route = FakeRoute("POST", f"https://admin.example.test/api/blocked/operation-{suffix}")
        gateway._reader_record_api_candidate(
            health, route.request, "https://admin.example.test", allowed=False, policy_state="blocked",
        )

    business = FakeRoute("GET", "https://admin.example.test/api/orders/current")
    gateway._reader_record_api_candidate(
        health, business.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, business.request, 200)

    discovery = gateway._reader_api_discovery_snapshot(type("Page", (), {"_reader_health": health})())
    assert "GET /api/orders/current" in {item["operationKey"] for item in discovery["candidates"]}
    assert discovery["selectableBusinessTruncated"] is False


def test_action_delta_excludes_preexisting_operation_even_when_it_polls_again():
    health = {"blocked": [], "pending": {}}
    initial = FakeRoute("GET", "https://admin.example.test/api/tasks/current")
    gateway._reader_record_api_candidate(
        health, initial.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, initial.request, 200)
    page = type("Page", (), {"_reader_health": health})()
    gateway._reader_set_api_discovery_trigger(page, "action:1:switch_tab")

    repeated = FakeRoute("GET", "https://admin.example.test/api/tasks/current?page=2")
    added = FakeRoute("GET", "https://admin.example.test/api/tasks/completed")
    for route in (repeated, added):
        gateway._reader_record_api_candidate(
            health, route.request, "https://admin.example.test", allowed=True, policy_state="allowed",
        )
        gateway._reader_api_discovery_response_seen(health, route.request, 200)

    discovery = gateway._reader_api_discovery_snapshot(page)
    assert discovery["deltaCandidateCount"] == 1
    assert [item["operationKey"] for item in discovery["deltaCandidates"]] == [
        "GET /api/tasks/completed"
    ]


def test_action_delta_includes_preexisting_operation_only_when_health_materially_changes():
    health = {"blocked": [], "pending": {}}
    route = FakeRoute("GET", "https://admin.example.test/api/tasks/current")
    gateway._reader_record_api_candidate(
        health, route.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, route.request, 500)
    page = type("Page", (), {"_reader_health": health})()
    gateway._reader_set_api_discovery_trigger(page, "action:1:switch_tab")

    retried = FakeRoute("GET", "https://admin.example.test/api/tasks/current")
    gateway._reader_record_api_candidate(
        health, retried.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, retried.request, 200)

    discovery = gateway._reader_api_discovery_snapshot(page)
    assert [item["operationKey"] for item in discovery["deltaCandidates"]] == [
        "GET /api/tasks/current"
    ]


def test_action_delta_detects_business_filter_change_but_ignores_pagination_and_secrets():
    health = {"blocked": [], "pending": {}}
    initial = FakeRoute(
        "GET", "https://admin.example.test/api/tasks?status=todo&page=1&access_token=secret-one",
    )
    gateway._reader_record_api_candidate(
        health, initial.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, initial.request, 200)
    page = type("Page", (), {"_reader_health": health})()
    gateway._reader_set_api_discovery_trigger(page, "action:1:switch_tab")

    pagination_only = FakeRoute(
        "GET", "https://admin.example.test/api/tasks?status=todo&page=2&access_token=secret-two",
    )
    gateway._reader_record_api_candidate(
        health, pagination_only.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, pagination_only.request, 200)
    assert gateway._reader_api_discovery_snapshot(page)["deltaCandidates"] == []

    changed_filter = FakeRoute(
        "GET", "https://admin.example.test/api/tasks?status=completed&page=1&access_token=secret-three",
    )
    gateway._reader_record_api_candidate(
        health, changed_filter.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )
    gateway._reader_api_discovery_response_seen(health, changed_filter.request, 200)

    discovery = gateway._reader_api_discovery_snapshot(page)
    assert [item["operationKey"] for item in discovery["deltaCandidates"]] == ["GET /api/tasks"]
    assert "todo" not in str(discovery)
    assert "completed" not in str(discovery)
    assert "secret" not in str(discovery)


@pytest.mark.parametrize("path", [
    "/api/Enquiry/EnquiryTypes",
    "/api/Enquiry/PriorityType",
    "/api/UserManagement/UserProfile/Status",
    "/api/UserManagement/UserProfile/UserTypes",
])
def test_api_discovery_marks_leaf_enum_resources_as_support(path):
    health = {"blocked": [], "pending": {}}
    route = FakeRoute("GET", "https://admin.example.test" + path)
    gateway._reader_record_api_candidate(
        health, route.request, "https://admin.example.test", allowed=True, policy_state="allowed",
    )

    candidate = gateway._reader_api_discovery_snapshot(
        type("Page", (), {"_reader_health": health})()
    )["candidates"][0]
    assert candidate["candidateKind"] == "support"


def test_disabled_whitelist_marks_unconfigured_candidate_as_bypassed(monkeypatch):
    monkeypatch.setattr(gateway, "READER_WHITELIST_ENABLED", False)
    health = {"blocked": [], "pending": {}}
    route = FakeRoute("POST", "https://admin.example.test/api/unconfigured/search")

    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test", reader_health=health))

    candidate = gateway._reader_api_discovery_snapshot(
        type("Page", (), {"_reader_health": health})()
    )["candidates"][0]
    assert route.result == ("continue", None)
    assert candidate["policyState"] == "bypassed"
