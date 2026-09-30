import asyncio

from app.portal_reader import (
    AdminPortalReader,
    PortalReadRequest,
    UserPermissionContext,
    _api_discovery_is_truncated,
    _knowledge_route_recovery_request,
    _relevant_selectable_api_candidates,
    _selected_api_answer_plan,
    api_drill_request_from_plan,
    api_selection_from_plan,
    bounded_portal_observation,
)
from app.principal import Principal
from app.tool_gateway import ToolGateway


def _candidate(
    index: int,
    *,
    kind: str = "business",
    policy: str = "allowed",
    trigger: str = "initial",
) -> dict:
    return {
        "operationKey": f"GET /api/tasks/{index}",
        "candidateKind": kind,
        "method": "GET",
        "pathTemplate": f"/api/tasks/{index}",
        "status": 200,
        "policyState": policy,
        "trigger": trigger,
        "triggers": [trigger],
        "swagger": {"tags": ["Tasks"], "responseFields": ["items"]},
    }


def _observation(
    candidates: list[dict], *, controls=None, selected_state="To Do", delta_candidates=None,
) -> dict:
    if delta_candidates is None:
        delta_candidates = [
            candidate for candidate in candidates
            if str(candidate.get("trigger") or "").casefold().startswith("action:")
        ]
    return {
        "apiDiscovery": {
            "candidates": candidates,
            "candidateCount": len(candidates),
            "truncated": False,
            "selectableBusinessTruncated": False,
            "selectableSupportTruncated": False,
            "deltaCandidates": delta_candidates,
            "deltaCandidateCount": len(delta_candidates),
            "deltaTruncated": False,
            "deltaSelectableBusinessTruncated": False,
            "deltaSelectableSupportTruncated": False,
            "safeControls": controls or [],
        },
        "sectionSummaries": [{
            "nodeId": "table-1",
            "kind": "table",
            "heading": "My Tasks",
            "selectedState": selected_state,
            "columnHeaders": ["Task", "Status"],
            "rowSummaries": ["TASK-1 Pending"],
        }],
    }


def test_relevant_candidates_deduplicate_allowed_business_and_ignore_support_by_default() -> None:
    business = _candidate(1)
    observation = _observation([
        business,
        dict(business),
        _candidate(2, kind="support"),
        _candidate(3, policy="blocked"),
        _candidate(4, policy="bypassed"),
    ])

    ordinary = _relevant_selectable_api_candidates(observation, "Show my current tasks", {})
    enum_request = _relevant_selectable_api_candidates(observation, "Which status options are available?", {})

    assert [item["operationKey"] for item in ordinary] == [
        business["operationKey"], "GET /api/tasks/4",
    ]
    assert [item["candidateKind"] for item in enum_request] == ["business", "support", "business"]
    assert enum_request[-1]["policyState"] == "bypassed"


def test_relevant_candidates_exclude_pending_failed_and_unhealthy_responses() -> None:
    pending = _candidate(1)
    pending.pop("status")
    failed = {**_candidate(2), "status": 500}
    unhealthy = {**_candidate(3), "responseHealth": "unhealthy"}
    healthy = {**_candidate(4), "responseHealth": {"status": "healthy"}}

    candidates = _relevant_selectable_api_candidates(
        _observation([pending, failed, unhealthy, healthy]), "Show my current tasks", {},
    )

    assert [item["operationKey"] for item in candidates] == ["GET /api/tasks/4"]


def test_duplicate_operation_retains_post_action_trigger_for_delta_selection() -> None:
    initial = _candidate(1)
    after_action = _candidate(1, trigger="action:1:switch_tab")

    candidates = _relevant_selectable_api_candidates(
        _observation([initial, after_action]), "Show my completed tasks", {},
    )

    assert len(candidates) == 1
    assert candidates[0]["trigger"] == "action:1:switch_tab"
    assert candidates[0]["triggers"] == ["initial", "action:1:switch_tab"]


def test_reader_delta_uses_explicit_gateway_delta_not_action_trigger_history() -> None:
    repeated = _candidate(1, trigger="action:1:switch_tab")
    added = _candidate(2, trigger="action:1:switch_tab")
    observation = _observation([repeated, added], delta_candidates=[added])

    candidates = _relevant_selectable_api_candidates(
        observation, "Show completed tasks", {}, delta_only=True,
    )

    assert [item["operationKey"] for item in candidates] == [added["operationKey"]]


def test_support_truncation_does_not_force_drill_for_business_question() -> None:
    discovery = _observation([_candidate(1)])["apiDiscovery"]
    discovery.update({"truncated": True, "selectableSupportTruncated": True})

    assert _api_discovery_is_truncated(
        discovery, include_support=False, delta_only=False,
    ) is False
    assert _api_discovery_is_truncated(
        discovery, include_support=True, delta_only=False,
    ) is True


def test_api_selection_normalizes_harmless_shape_but_requires_current_candidate() -> None:
    candidates = _relevant_selectable_api_candidates(_observation([_candidate(1)]), "Show tasks", {})
    valid = {
        "mode": "api_selection",
        "operationKey": candidates[0]["operationKey"],
        "reasonCodes": ["trigger_matches_intent", "swagger_schema_matches_answer"],
    }

    assert api_selection_from_plan(valid, candidates) is not None
    assert api_selection_from_plan({**valid, "operationKey": "GET /api/other"}, candidates) is None
    normalized = api_selection_from_plan(
        {
            **valid,
            "selectedOperationKey": valid["operationKey"],
            "path": "/api/tasks/1",
            "reasonCodes": ["model_preference"],
        },
        candidates,
    )
    assert normalized is not None
    selected, reason_codes = normalized
    assert selected["operationKey"] == valid["operationKey"]
    assert reason_codes == ("trigger_matches_intent",)


def test_route_recovery_chooses_unique_permitted_page_from_knowledge() -> None:
    knowledge_context = {
        "chunks": [
            {
                "content": """
                ## Performance
                - **page:** `/dashboard`
                - **scope:** Personal performance for the signed-in user.
                Current ratings and recent performance are loaded on this page.
                """,
            },
            {
                "content": """
                ## Reports
                - **page:** `/licensing/reports-analytics`
                Aggregate team performance reports and historical totals.
                """,
            },
        ],
    }
    permissions = UserPermissionContext(
        roles=("Licensing Officer",),
        pages=("/dashboard", "/licensing/reports-analytics"),
    )

    request = _knowledge_route_recovery_request(
        "how about my recently performance?",
        knowledge_context,
        permissions,
    )

    assert request == PortalReadRequest(
        start_path="/dashboard",
        actions=({"type": "observe"},),
        expected_fields=(),
    )


def test_api_response_keeps_its_own_depth_budget_inside_observation() -> None:
    candidate = _candidate(1)
    candidate["responseEvidence"] = {
        "data": {
            "summary": {
                "slaComplianceRate": 89.34,
                "averageProcessingTime": "5.9h",
            },
            "startDate": "2026-08-10T04:00:00",
            "endDate": "2026-09-09T03:59:59",
        },
    }
    candidate["responseEvidenceTruncated"] = False

    projected = bounded_portal_observation(_observation([candidate]))
    evidence = projected["apiDiscovery"]["candidates"][0]["responseEvidence"]

    assert evidence["data"]["summary"]["slaComplianceRate"] == 89.34
    assert evidence["data"]["summary"]["averageProcessingTime"] == "5.9h"
    assert evidence["data"]["startDate"] == "2026-08-10T04:00:00"


def test_tool_gateway_preserves_deep_api_evidence_for_portal_reader() -> None:
    candidate = _candidate(1)
    candidate["responseEvidence"] = {
        "data": {
            "summary": {
                "slaComplianceRate": 89.34,
                "averageProcessingTime": "5.9h",
            },
        },
    }
    candidate["responseEvidenceTruncated"] = False

    class Platform:
        portal_base_url = "https://admin.example.test"

        async def admin_portal_read(self, *args, **kwargs):
            return {"status": "not_confirmed", "observation": _observation([candidate])}

    gateway = ToolGateway(None, Platform())
    principal = Principal(user_id="admin-7", tenant_id="tenant-1", request_id="request-1")
    projected = asyncio.run(gateway.invoke(
        principal,
        "admin.portal.read",
        {"startPath": "/dashboard", "actions": [{"type": "observe"}]},
    ))
    evidence = projected["result"]["observation"]["apiDiscovery"]["candidates"][0]["responseEvidence"]

    assert evidence["data"]["summary"]["slaComplianceRate"] == 89.34
    assert evidence["data"]["summary"]["averageProcessingTime"] == "5.9h"


def test_api_drill_resolves_only_an_observed_control_id() -> None:
    observation = _observation(
        [_candidate(index) for index in range(11)],
        controls=[{
            "controlId": "tab-completed",
            "label": "Completed",
            "action": {"type": "switch_tab", "role": "tab", "name": "Completed"},
        }],
    )
    plan = {
        "mode": "api_drill",
        "controlId": "tab-completed",
        "reasonCodes": ["control_matches_intent", "reduce_candidate_set"],
    }

    resolved = api_drill_request_from_plan(plan, observation, start_path="/dashboard")

    assert resolved is not None
    request, control_id, _ = resolved
    assert request == PortalReadRequest(
        start_path="/dashboard",
        actions=({"type": "switch_tab", "role": "tab", "name": "Completed"},),
    )
    assert control_id == "tab-completed"
    assert api_drill_request_from_plan({**plan, "controlId": "invented"}, observation, start_path="/dashboard") is None


class _Planner:
    def __init__(self, plans):
        self.plans = list(plans)
        self.calls = []

    async def plan_admin_portal_read(self, question, permission_context, knowledge_context, conversation_context=None):
        self.calls.append(knowledge_context)
        return self.plans.pop(0)


class _Gateway:
    def __init__(self, observations):
        self.observations = list(observations)
        self.portal_payloads = []

    async def get_user_info(self, principal):
        return {
            "ok": True,
            "result": {
                "data": {
                    "id": principal.user_id,
                    "rolesInfo": [{"roleName": "Reader"}],
                    "listSysPermission": [{"frontendRoute": "/dashboard", "children": [], "buttonList": []}],
                }
            },
        }

    async def invoke(self, principal, tool_name, arguments, *, allowed_tools=None):
        if tool_name == "knowledge.search":
            return {"ok": True, "result": {"chunks": [{"content": "My Tasks is the current user's task table."}]}}
        self.portal_payloads.append(arguments)
        return {
            "ok": True,
            "result": {"result": "success", "facts": [], "observation": self.observations.pop(0)},
        }


def _run(planner, gateway, question="Show my current tasks"):
    reader = AdminPortalReader(
        gateway,
        planner,
        portal_base_url="https://admin.example.test",
        knowledge_folder_id="kb",
    )
    principal = Principal(user_id="admin-7", tenant_id="tenant-1", request_id="request-1")
    return asyncio.run(reader.run(principal, question))


def _observe_plan() -> dict:
    return {
        "mode": "portal_read",
        "portalRequest": {"startPath": "/dashboard", "actions": [{"type": "observe"}], "expectedFields": []},
    }


def _result_plan(selected_state="To Do") -> dict:
    return {
        "mode": "observation_result",
        "result": "success",
        "page": "/dashboard",
        "section": "My Tasks",
        "sourceSection": "table-1",
        "answerShape": "list",
        "completeness": "bounded",
        "selectedState": selected_state,
        "scope": "personal",
        "facts": ["TASK-1 Pending"],
        "workflowState": "",
        "missing": [],
    }


def test_reader_selects_bypassed_operation_internally_without_adding_it_to_tool_payload() -> None:
    observation = _observation([_candidate(1, policy="bypassed"), _candidate(2)])
    planner = _Planner([
        _observe_plan(),
        {"mode": "api_selection", "operationKey": "GET /api/tasks/1", "reasonCodes": ["trigger_matches_intent"]},
        _result_plan(),
    ])
    gateway = _Gateway([observation])

    outcome = _run(planner, gateway)

    assert outcome.result.status == "success"
    assert outcome.audit_evidence["apiSelection"]["selectedOperationKey"] == "GET /api/tasks/1"
    assert outcome.audit_evidence["apiSelection"]["selectedPolicyState"] == "bypassed"
    assert outcome.audit_evidence["apiSelection"]["maxCandidatesBeforeDrill"] == 10
    assert planner.calls[1]["planningDirective"]["apiCandidateDecision"] == "select"
    assert planner.calls[1]["planningDirective"]["selectableApiCandidates"][0]["policyState"] == "bypassed"
    assert planner.calls[2]["planningDirective"]["apiCandidateDecision"] == "use_selected"
    assert "operationKey" not in gateway.portal_payloads[0]
    assert len(gateway.portal_payloads) == 1


def test_selected_api_response_is_primary_evidence_without_duplicate_dom_rows() -> None:
    candidate = _candidate(1)
    candidate["responseEvidence"] = {
        "payload": {"records": [{
            "taskNo": "ML-1-8007",
            "waitingOn": "External Authority",
            "status": "External Approval",
            "waitingDays": 6,
        }]},
    }
    candidate["responseEvidenceTruncated"] = False
    observation = _observation([candidate])
    observation["sectionSummaries"] = [{
        "nodeId": "attention-counts",
        "kind": "region",
        "heading": "Needs Your Attention",
        "controls": ["All 7", "External Approval 5", "Pending Modification 2"],
    }]
    planner = _Planner([
        _observe_plan(),
        {"mode": "api_selection", "operationKey": candidate["operationKey"], "reasonCodes": ["trigger_matches_intent"]},
        {
            "mode": "observation_result",
            "status": "success",
            "answerShape": "attention",
            "answer": "ML-1-8007 is waiting on External Authority in External Approval for 6 days.",
            "harmlessExplanation": "Derived from the selected response",
        },
    ])
    gateway = _Gateway([observation])

    outcome = _run(planner, gateway, question="what tasks should I pay attention?")

    assert outcome.result.status == "success"
    assert len(outcome.result.facts) == 1
    assert '"records.taskNo":"ML-1-8007"' in outcome.result.facts[0]
    assert '"records.waitingOn":"External Authority"' in outcome.result.facts[0]
    assert candidate["operationKey"] not in str(outcome.result.public_json())
    assert outcome.audit_evidence["apiSelection"]["selectedOperationKey"] == candidate["operationKey"]
    selected_call = planner.calls[1]
    assert selected_call["portalObservation"]["apiEvidence"]["data"] == candidate["responseEvidence"]
    assert "sectionSummaries" not in selected_call["portalObservation"]
    assert "responseEvidence" not in selected_call["planningDirective"]["selectedApiCandidate"]


def test_unique_response_triggered_by_a_normal_state_action_skips_redundant_api_selection() -> None:
    completed = _candidate(9, trigger="action:1:switch_tab")
    completed["responseEvidence"] = {
        "data": {"page": {"items": [{"taskNo": "TASK-9", "status": "Completed"}], "total": 1}},
    }
    completed["responseEvidenceTruncated"] = False
    observation = _observation(
        [_candidate(1), _candidate(2), completed],
        selected_state="Completed",
        delta_candidates=[completed],
    )
    initial_observation = _observation(
        [_candidate(1), _candidate(2)],
        controls=[{
            "controlId": "tab-completed",
            "label": "Completed",
            "action": {"type": "switch_tab", "role": "tab", "name": "Completed"},
        }],
        delta_candidates=[],
    )
    planner = _Planner([
        {
            "mode": "portal_read",
            "portalRequest": {
                "startPath": "/dashboard",
                "actions": [{"type": "switch_tab", "role": "tab", "name": "Completed"}],
                "expectedFields": [],
            },
        },
        {
            "status": "ok",
            "completedTasks": [{"taskNo": "TASK-9", "status": "Completed"}],
            "display": {"columns": ["taskNo", "status"]},
        },
    ])
    gateway = _Gateway([initial_observation, observation])

    outcome = _run(planner, gateway, question="Show my completed current tasks")

    assert outcome.result.status == "success"
    assert "TASK-9" in outcome.result.facts[0]
    assert outcome.audit_evidence["apiSelection"]["selectedOperationKey"] == completed["operationKey"]
    assert len(planner.calls) == 2
    assert planner.calls[1]["portalObservation"]["apiEvidence"]["data"] == completed["responseEvidence"]
    assert planner.calls[1]["planningDirective"]["apiCandidateDecision"] == "use_selected"
    assert gateway.portal_payloads[0]["actions"] == [{"type": "observe"}]
    assert gateway.portal_payloads[1]["actions"] == [
        {"type": "switch_tab", "role": "tab", "name": "Completed"},
    ]


def test_selected_api_answer_normalization_does_not_accept_a_new_read_plan() -> None:
    plan = {
        "mode": "portal_read",
        "portalRequest": {
            "startPath": "/dashboard",
            "actions": [{"type": "switch_tab", "name": "Invented"}],
        },
    }

    assert _selected_api_answer_plan(plan, answer_shape="list") is None


def test_no_selectable_api_candidate_does_not_suppress_sufficient_unique_dom_evidence() -> None:
    observation = _observation([
        _candidate(1, policy="blocked"),
        {**_candidate(2), "status": 500},
        _candidate(3, kind="support"),
    ])
    planner = _Planner([_observe_plan(), _result_plan()])
    gateway = _Gateway([observation])

    outcome = _run(planner, gateway)

    assert outcome.result.status == "success"
    assert outcome.result.facts == ("TASK-1 Pending",)
    assert outcome.audit_evidence["apiSelection"]["decision"] == "not_confirmed"
    assert outcome.audit_evidence["apiSelection"]["reason"] == "no_selectable_api_candidates"
    assert len(planner.calls) == 2


def test_reader_rejects_selection_outside_current_candidate_set() -> None:
    planner = _Planner([
        _observe_plan(),
        {"mode": "api_selection", "operationKey": "GET /api/invented", "reasonCodes": ["trigger_matches_intent"]},
        {
            "mode": "observation_result", "result": "not_confirmed", "facts": [],
            "missing": ["invalid_api_selection"],
        },
    ])
    observation = _observation([_candidate(1)])
    observation["sectionSummaries"] = []
    gateway = _Gateway([observation])

    outcome = _run(planner, gateway)

    assert outcome.result.status == "not_confirmed"
    assert outcome.result.missing == ("invalid_api_selection",)
    assert len(gateway.portal_payloads) == 1


def test_reader_drills_once_then_selects_from_reduced_candidates() -> None:
    controls = [{
        "controlId": "tab-completed",
        "label": "Completed",
        "action": {"type": "switch_tab", "role": "tab", "name": "Completed"},
    }]
    initial = _observation([_candidate(index) for index in range(11)], controls=controls)
    initial["apiDiscovery"].update({"truncated": True, "selectableBusinessTruncated": True})
    narrowed = _observation([
        _candidate(7, trigger="action:1:switch_tab"),
        _candidate(8, trigger="action:1:switch_tab"),
    ], selected_state="Completed")
    planner = _Planner([
        _observe_plan(),
        {"mode": "api_drill", "controlId": "tab-completed", "reasonCodes": ["reduce_candidate_set"]},
        {"mode": "api_selection", "operationKey": "GET /api/tasks/7", "reasonCodes": ["trigger_matches_intent"]},
        _result_plan(selected_state="Completed"),
    ])
    gateway = _Gateway([initial, narrowed])

    outcome = _run(planner, gateway, question="Show my completed current tasks")

    assert outcome.result.status == "success"
    assert len(gateway.portal_payloads) == 2
    assert gateway.portal_payloads[1]["actions"] == [
        {"type": "switch_tab", "role": "tab", "name": "Completed"}
    ]
    assert outcome.audit_evidence["apiSelection"]["drillDepth"] == 1
    assert outcome.audit_evidence["apiSelection"]["selectedOperationKey"] == "GET /api/tasks/7"
    assert len(planner.calls) == 4


def test_reader_rejects_candidate_set_still_over_limit_after_one_drill() -> None:
    controls = [{
        "controlId": "tab-completed",
        "label": "Completed",
        "action": {"type": "switch_tab", "role": "tab", "name": "Completed"},
    }]
    crowded = _observation([_candidate(index) for index in range(11)], controls=controls)
    crowded["apiDiscovery"].update({"truncated": True, "selectableBusinessTruncated": True})
    crowded_delta = _observation([
        _candidate(index + 20, trigger="action:1:switch_tab") for index in range(11)
    ], controls=controls)
    crowded_delta["apiDiscovery"].update({
        "deltaTruncated": True,
        "deltaSelectableBusinessTruncated": True,
    })
    crowded_delta["sectionSummaries"] = []
    planner = _Planner([
        _observe_plan(),
        {"mode": "api_drill", "controlId": "tab-completed", "reasonCodes": ["reduce_candidate_set"]},
        {
            "mode": "observation_result", "result": "not_confirmed", "facts": [],
            "missing": ["api_candidates_still_ambiguous"],
        },
    ])
    gateway = _Gateway([crowded, crowded_delta])

    outcome = _run(planner, gateway, question="Show my specific completed task list")

    assert outcome.result.status == "not_confirmed"
    assert outcome.result.missing == ("api_candidates_still_ambiguous",)
    assert len(gateway.portal_payloads) == 2
    assert outcome.audit_evidence["apiSelection"]["drillDepth"] == 1
    assert outcome.audit_evidence["apiSelection"]["decision"] == "not_confirmed"


def test_reader_uses_only_post_action_delta_candidates_after_drill() -> None:
    controls = [{
        "controlId": "tab-completed",
        "label": "Completed",
        "action": {"type": "switch_tab", "role": "tab", "name": "Completed"},
    }]
    initial_candidates = [_candidate(index) for index in range(11)]
    initial_observation = _observation(initial_candidates, controls=controls)
    initial_observation["apiDiscovery"].update({
        "truncated": True,
        "selectableBusinessTruncated": True,
    })
    mixed_follow_up = _observation([
        *initial_candidates,
        _candidate(99, trigger="action:1:switch_tab"),
    ], selected_state="Completed", delta_candidates=[_candidate(99, trigger="action:1:switch_tab")])
    planner = _Planner([
        _observe_plan(),
        {"mode": "api_drill", "controlId": "tab-completed", "reasonCodes": ["reduce_candidate_set"]},
        {"mode": "api_selection", "operationKey": "GET /api/tasks/99", "reasonCodes": ["trigger_matches_intent"]},
        _result_plan(selected_state="Completed"),
    ])
    gateway = _Gateway([initial_observation, mixed_follow_up])

    outcome = _run(planner, gateway, question="Show my completed current tasks")

    selection_call = planner.calls[2]["planningDirective"]
    assert selection_call["selectableCandidateCount"] == 1
    assert [item["operationKey"] for item in selection_call["selectableApiCandidates"]] == ["GET /api/tasks/99"]
    assert outcome.result.status == "success"
