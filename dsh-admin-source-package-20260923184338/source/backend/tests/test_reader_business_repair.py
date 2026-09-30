import asyncio
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.portal_reader import (
    ReaderTimeoutBudget,
    ReaderOutcome,
    ReaderResult,
    _compound_list_detail_result,
    _documented_detail_destination,
    _native_detail_observation_result,
    _native_metric_overview,
    _native_profile_type_count,
    _native_queue_counts,
    observation_result_from_plan,
)
from app.tool_gateway import ToolGateway
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, principal, run_reader, user_info_for_paths


def _observation(*, healthy=True, rows=()):
    return {
        "readHealth": {"healthy": healthy, "blocked": [], "failed": [], "pending": []},
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "Applications",
            "rowSummaries": list(rows),
        }],
    }


def _metric_observation(values):
    return {
        "readHealth": {"healthy": True},
        "sectionSummaries": [{
            "nodeId": "observation-metrics-001", "kind": "metrics", "heading": "Summary",
            "summaries": [f"{label} {value}" for label, value in values],
        }],
    }


def test_metric_overview_keeps_one_rendered_status_region_and_repairs_partial_answer():
    observation = _metric_observation([
        ("Total", "85"), ("Active", "56"), ("Expire Soon", "2"),
        ("Expired", "17"), ("Cancelled", "10"), ("Suspended", "0"),
    ])
    outcome = ReaderOutcome(
        ReaderResult(status="success", summary="", page="/licensing/licenses", answer_shape="count", facts=("Total: 85",)),
        {"observation": observation},
    )
    repaired = _native_metric_overview(outcome, "What is the current status breakdown of licenses?")
    assert repaired.result.status == "success"
    assert repaired.result.answer_shape == "overview"
    assert "Total: 85" in repaired.result.facts
    assert "Active: 56" in repaired.result.facts
    assert "Expired: 17" in repaired.result.facts
    assert repaired.result.source_section == "observation-metrics-001"


def test_queue_count_repair_requires_both_requested_views():
    observation = _metric_observation([("To Do", "70"), ("Completed", "664")])
    outcome = ReaderOutcome(
        ReaderResult(status="success", summary="", page="/licensing/applications", answer_shape="count", facts=("Completed: 664",)),
        {"observation": observation},
    )
    repaired = _native_queue_counts(outcome, "How many pending and completed application tasks are there?")
    assert repaired.result.facts == ("To Do: 70", "Completed: 664")
    assert repaired.result.answer_shape == "count"


def test_profile_type_count_does_not_return_total_profile_rows():
    observation = _metric_observation([
        ("Total", "31"), ("Individual", "0"), ("Commercial", "14"),
        ("Free Zone", "8"), ("Talent Agency", "1"), ("Government", "1"),
    ])
    outcome = ReaderOutcome(
        ReaderResult(status="success", summary="", page="/licensing/profile", answer_shape="count", facts=("Total: 31",)),
        {"observation": observation},
    )
    repaired = _native_profile_type_count(outcome, "How many user types have profile verification?")
    assert repaired.result.status == "success"
    assert repaired.result.facts[0].startswith("5 user types")
    assert "Total: 31" not in repaired.result.facts


def test_documented_detail_destination_uses_the_exact_permitted_route():
    knowledge = {"ok": True, "chunks": [{"content": """
## Semantic node: License detail
- **section:** License detail
- **page:** `/licensing/license/licenseDatails`, entered from a permitted visible row on `/licensing/licenses`
- **type:** read-only license detail
"""}]}

    destination = _documented_detail_destination(
        knowledge,
        "/licensing/licenses",
        ("/licensing/licenses", "/licensing/license/LicenseDatails"),
    )

    assert destination == "/licensing/license/LicenseDatails"


def test_native_license_detail_uses_the_matching_rendered_card():
    observation = {
        "sectionSummaries": [{
            "nodeId": "license-card",
            "kind": "cards",
            "cardSummaries": [
                "Media License | Active | License Number | 8929867 | Issuance Date | 03/09/2027 | "
                "Effective Date | 03/09/2027 | Expiry Date | 02/09/2028 | Days Remaining | 722",
            ],
        }],
    }

    result = _native_detail_observation_result(
        observation,
        page="/licensing/license/LicenseDatails",
        record_identity="8929867",
        scope="unknown",
    )

    assert result is not None
    assert result.status == "success"
    assert result.answer_shape == "detail"
    assert result.page == "/licensing/license/LicenseDatails"
    assert result.public_json()["recordIdentity"] == "8929867"
    assert json.loads(result.facts[0]) == {
        "License Name": "Media License",
        "Status": "Active",
        "License Number": "8929867",
        "Issuance Date": "03/09/2027",
        "Effective Date": "03/09/2027",
        "Expiry Date": "02/09/2028",
        "Days Remaining": "722",
    }


def test_compound_list_detail_keeps_visible_rows_and_first_detail():
    detail = ReaderResult(
        status="success",
        summary="",
        page="/licensing/license/LicenseDatails",
        answer_shape="detail",
        facts=('{' + '"License Number":"8929867","Days Remaining":"722"' + '}',),
    )
    list_observation = {
        "sectionSummaries": [{
            "nodeId": "licenses",
            "kind": "table",
            "columnHeaders": ["License No.", "Status"],
            "rowFields": [
                {"License No.": "8929867", "Status": "Active"},
                {"License No.": "4930086", "Status": "Active"},
            ],
        }],
    }

    combined = _compound_list_detail_result(detail, list_observation, "8929867")

    assert len(combined.facts) == 4
    assert combined.facts[0].startswith("First visible record details:")
    assert "Days Remaining: 722" in combined.facts[0]
    assert json.loads(combined.facts[1])["License No."] == "8929867"
    assert json.loads(combined.facts[2])["License No."] == "4930086"
    assert "not the complete collection" in combined.facts[3]
    assert combined.record_identity == "8929867"


def test_health_false_observation_keeps_loaded_rows_and_does_not_fallback_to_no_data() -> None:
    observation = _observation(healthy=False, rows=("APP-100 Pending Review",))
    planner = Planner(
        portal_plan_for("/licensing/applications", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/licensing/applications",
            "section": "Applications",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "facts": ["APP-100 Pending Review"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/licensing/applications")},
        portal_result={"ok": True, "result": {"result": "not_confirmed", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="Show my application records")

    assert outcome.result.facts == ("APP-100 Pending Review",)
    assert outcome.result.status == "success"
    assert outcome.result.status != "no_data"


def test_health_false_empty_observation_cannot_be_reduced_to_no_data() -> None:
    observation = _observation(healthy=False)
    planner = Planner(
        portal_plan_for("/licensing/applications", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "no_data",
            "page": "/licensing/applications",
            "section": "Applications",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "facts": [],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/licensing/applications")},
        portal_result={"ok": True, "result": {"result": "not_confirmed", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="Show my application records")

    assert outcome.result.status == "not_confirmed"
    assert outcome.result.status != "no_data"


def test_early_observation_failure_retains_bounded_source_versions_without_chunk_text() -> None:
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/records")},
        knowledge_result={"ok": True, "result": {"chunks": [
            {"source_name": "Admin-User-Manual-v1.md", "content": "Private reference passage."},
        ]}},
        portal_result={"ok": True, "result": {"status": "load_failed", "observation": {}}},
    )
    planner = Planner(portal_plan_for("/records", [{"type": "observe"}]))
    outcome = run_reader(gateway, planner, question="Show the current records")
    assert outcome.result.status == "load_failed"
    assert "knowledge" not in outcome.audit_evidence
    trace = outcome.audit_evidence["qualityTrace"]
    retrieval = next(entry for entry in trace if entry["stage"] == "knowledge_retrieval")
    assert retrieval["output"]["sourceNames"] == ["Admin-User-Manual-v1.md"]
    assert "Private reference passage" not in json.dumps(trace)


@pytest.mark.parametrize("trailing_observe", [False, True])
def test_initial_state_change_observes_then_binds_the_unique_current_control(trailing_observe) -> None:
    observation = _observation(rows=("APP-200 Completed",))
    observation["sectionSummaries"][0]["selectedState"] = "Completed"
    observation["controls"] = ["To Do", "Completed"]
    planner = Planner(
        portal_plan_for("/licensing/applications", [
            {"type": "switch_tab", "role": "tab", "name": "Completed"},
            *([{"type": "observe"}] if trailing_observe else []),
        ]),
        {
            "mode": "observation_result", "result": "success", "page": "/licensing/applications",
            "section": "Applications", "sourceSection": "observation-table-001", "selectedState": "Completed",
            "answerShape": "list", "facts": ["APP-200 Completed"], "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/licensing/applications")},
        portal_result={"ok": True, "result": {
            "status": "not_confirmed", "facts": [], "missing": ["Application No.", "Status"],
            "observation": observation,
        }},
    )
    outcome = run_reader(gateway, planner, question="Show the completed applications")
    assert outcome.result.status == "success"
    assert outcome.result.facts == ("APP-200 Completed",)
    assert outcome.result.selected_state == "Completed"
    assert gateway.events.count("admin.portal.read") == 2
    assert gateway.calls[-2][1]["actions"] == [{"type": "observe"}]
    assert gateway.calls[-1][1]["actions"] == [{"type": "switch_tab", "role": "tab", "name": "Completed"}]
    assert planner.calls[1][2]["priorPortalRead"]["actions"][0]["name"] == "Completed"
    assert outcome.audit_evidence["observation"]


def test_initial_state_change_is_not_executed_when_current_control_is_not_unique() -> None:
    observation = _observation(rows=("APP-100 Pending",))
    observation["sectionSummaries"] = [
        {"nodeId": "one", "kind": "table", "heading": "My Tasks", "selectedState": "To Do", "controls": ["Completed"]},
        {"nodeId": "two", "kind": "table", "heading": "Team Tasks", "selectedState": "To Do", "controls": ["Completed"]},
    ]
    planner = Planner(portal_plan_for("/licensing/applications", [
        {"type": "switch_tab", "role": "tab", "name": "Completed", "section": "Invented"},
        {"type": "query", "section": "Invented / Completed"},
    ]))
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/licensing/applications")},
        portal_result={"ok": True, "result": {"result": "not_confirmed", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="Show the completed applications")

    assert outcome.result.status == "not_confirmed"
    assert outcome.result.missing == ("state_control_not_unique",)
    assert gateway.events.count("admin.portal.read") == 1
    assert gateway.calls[-1][1]["actions"] == [{"type": "observe"}]


def test_headingless_table_keeps_its_node_identity_and_native_row_facts() -> None:
    observation = {"sectionSummaries": [{
        "nodeId": "table-1", "kind": "table", "heading": "",
        "columnHeaders": ["Record No.", "Status"], "rowSummaries": ["R-100 Open"],
    }]}
    plan = {
        "mode": "observation_result", "result": "success", "sourceSection": "table-1",
        "answerShape": "list", "completeness": "complete", "facts": ["R-100 Open"],
    }
    result = observation_result_from_plan(plan, observation)
    assert result is not None and result.status == "success"
    assert result.completeness == "bounded"
    assert observation_result_from_plan({**plan, "sourceSection": "unknown-table"}, observation) is None


def test_native_row_fields_prevent_column_splitting_cross_row_join_and_duplicate_keys() -> None:
    rows = [
        {"Record No.": "R-100", "Customer": "George Business", "Issue Category": "General", "Status": "Open"},
        {"Record No.": "R-200", "Customer": "Another Business", "Issue Category": "Other", "Status": "Closed"},
    ]
    observation = {"sectionSummaries": [{
        "nodeId": "table-1", "kind": "table", "heading": "", "columnHeaders": list(rows[0]),
        "rowSummaries": ["R-100 George Business General Open", "R-200 Another Business Other Closed"],
        "rowFields": rows,
    }]}
    plan = {"mode": "observation_result", "result": "success", "sourceSection": "table-1", "answerShape": "list"}
    good = json.dumps({"Record No.": "R-100", "Status": "Open"})
    result = observation_result_from_plan({**plan, "facts": [good]}, observation)
    assert result is not None and result.facts == (good,)
    for bad in (
        json.dumps({"Record No.": "R-100", "Customer": "George", "Issue Category": "Business"}),
        json.dumps({"Record No.": "R-100", "Status": "Closed"}),
        '{"Record No.":"R-100","Status":"Closed","Status":"Open"}',
        "Record No.: R-100, Customer: George, Issue Category: Business",
    ):
        assert observation_result_from_plan({**plan, "facts": [bad]}, observation) is None


def test_structured_cells_survive_both_tool_and_planner_projection_without_secrets() -> None:
    observation = {"sectionSummaries": [{
        "nodeId": "table-1", "kind": "table", "heading": "", "columnHeaders": ["Record No.", "Status"],
        "rowSummaries": ["R-100 Open"], "rowFields": [{"Record No.": "R-100", "Status": "Open", "password": "secret"}],
    }]}
    class Platform:
        portal_base_url = "https://admin.example.test"

        async def admin_portal_read(self, *args, **kwargs):
            return {"status": "not_confirmed", "observation": observation}

    initial = portal_plan_for("/licensing/applications", [{"type": "observe"}])
    projected = asyncio.run(ToolGateway(None, Platform()).invoke(principal(), "admin.portal.read", initial["portalRequest"]))
    planner = Planner(initial, {
        "mode": "observation_result", "result": "success", "sourceSection": "table-1", "answerShape": "list",
        "facts": [json.dumps({"Record No.": "R-100", "Status": "Open"})],
    })
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing/applications")}, portal_result=projected)
    outcome = run_reader(gateway, planner, question="Show my application records")
    assert outcome.result.status == "success"
    cells = planner.calls[1][2]["portalObservation"]["sectionSummaries"][0]["rowFields"]
    assert cells == [{"Record No.": "R-100", "Status": "Open"}]
    assert "secret" not in str(projected)


def test_redundant_observe_normalization_does_not_hide_unsafe_metadata() -> None:
    planner = Planner(portal_plan_for("/licensing/applications", [
        {"type": "switch_tab", "role": "tab", "name": "Completed"},
        {"type": "observe", "method": "POST"},
    ]))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing/applications")})
    outcome = run_reader(gateway, planner, question="Show the completed applications")
    assert outcome.result.status != "success"
    assert "admin.portal.read" not in gateway.events


def test_portal_stage_timeout_is_load_failed() -> None:
    class SlowGateway(Gateway):
        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "admin.portal.read":
                await asyncio.sleep(0.05)
            return await super().invoke(current_principal, tool_name, arguments, allowed_tools=allowed_tools)

    planner = Planner(portal_plan_for("/licensing/applications", [{"type": "observe"}]))
    gateway = SlowGateway(info={"ok": True, "result": user_info_for_paths("/licensing/applications")})
    budget = ReaderTimeoutBudget(
        total_seconds=2,
        get_user_info_seconds=1,
        knowledge_search_seconds=1,
        planner_seconds=1,
        portal_read_seconds=0.001,
    )

    outcome = run_reader(
        gateway,
        planner,
        timeout_budget=budget,
        question="Show my application records",
    )

    assert outcome.result.status == "load_failed"


def test_policy_rejects_excessive_actions_before_dispatch() -> None:
    actions = [{"type": "observe"}] * 13
    planner = Planner(portal_plan_for("/licensing/applications", actions))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing/applications")})

    outcome = run_reader(gateway, planner, question="Show my application records")

    assert outcome.result.status == "not_confirmed"
    assert gateway.events.count("admin.portal.read") == 0


class SequencedGateway(Gateway):
    def __init__(self, observations, **kwargs):
        super().__init__(**kwargs)
        self.observations = list(observations)

    async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
        if tool_name == "knowledge.search":
            return await super().invoke(current_principal, tool_name, arguments, allowed_tools=allowed_tools)
        self.events.append(tool_name)
        self.calls.append((tool_name, arguments, allowed_tools))
        if tool_name == "admin.portal.read":
            value = self.observations.pop(0)
            return {"ok": True, "result": value}
        return self.portal_result


def _three_read_plans(*, third_actions=None):
    third_actions = third_actions or [{"type": "query", "role": "row", "name": "Application No."}]
    return (
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        {
            "mode": "observation_result", "result": "success", "page": "/dashboard",
            "section": "My Tasks", "sourceSection": "observation-region-001",
            "answerShape": "overview", "facts": ["Enquiries & Complaints 2"], "missing": [],
        },
        portal_plan_for("/dashboard", [{"type": "switch_tab", "role": "tab", "name": "Enquiries & Complaints 2"}]),
        portal_plan_for("/licensing/applications", third_actions),
        {
            "mode": "observation_result", "result": "success", "page": "/licensing/applications",
            "section": "Applications", "sourceSection": "observation-table-001",
            "answerShape": "list", "facts": ["EC-101 Open"], "missing": [],
        },
    )


def _three_read_observations():
    return [
        {"result": "success", "observation": {"regionSummaries": [{"nodeId": "observation-region-001", "heading": "My Tasks", "controls": ["Enquiries & Complaints 2"]}]}},
        {"result": "success", "observation": {"regionSummaries": [{"nodeId": "observation-region-001", "heading": "My Tasks", "selectedState": "Enquiries & Complaints 2", "controls": ["Enquiries & Complaints 2"]}]}},
        {"result": "not_confirmed", "observation": {"readHealth": {"healthy": False}, "sectionSummaries": [{"nodeId": "observation-table-001", "kind": "table", "heading": "Applications", "rowSummaries": ["EC-101 Open"]}]}},
    ]


def test_three_reads_replay_rows_from_not_confirmed_observation() -> None:
    plans = _three_read_plans()
    planner = Planner(*plans)
    gateway = SequencedGateway(
        _three_read_observations(),
        info={"ok": True, "result": user_info_for_paths("/dashboard", "/licensing/applications")},
    )

    outcome = run_reader(
        gateway, planner, question="show me the list",
        conversation_context={"previousIntent": {"question": "How about my enquiries tasks?", "answerShape": "overview", "page": "/dashboard", "section": "My Tasks"}},
    )

    assert gateway.events.count("admin.portal.read") == 3
    assert outcome.audit_evidence["stage"] == "completed_after_bounded_replay"
    assert outcome.result.facts == ("EC-101 Open",)


def test_third_read_timeout_is_load_failed() -> None:
    class SlowThirdGateway(SequencedGateway):
        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "admin.portal.read" and self.events.count("admin.portal.read") >= 2:
                await asyncio.sleep(0.05)
            return await super().invoke(current_principal, tool_name, arguments, allowed_tools=allowed_tools)

    planner = Planner(*_three_read_plans())
    gateway = SlowThirdGateway(_three_read_observations(), info={"ok": True, "result": user_info_for_paths("/dashboard", "/licensing/applications")})
    budget = ReaderTimeoutBudget(total_seconds=2, get_user_info_seconds=1, knowledge_search_seconds=1, planner_seconds=1, portal_read_seconds=0.001)

    outcome = run_reader(gateway, planner, timeout_budget=budget, question="show me the list", conversation_context={"previousIntent": {"question": "How about my enquiries tasks?", "answerShape": "overview", "page": "/dashboard", "section": "My Tasks"}})

    assert outcome.result.status == "load_failed"
    assert gateway.events.count("admin.portal.read") == 2
    assert outcome.audit_evidence["stage"] == "portal_read_after_read_state_change"
    assert outcome.result.missing == ("portal_read_timeout",)


def test_cumulative_action_limit_blocks_third_read() -> None:
    plans = _three_read_plans(third_actions=[{"type": "query", "role": "row", "name": "Application No."}] * 11)
    planner = Planner(*plans)
    gateway = SequencedGateway(_three_read_observations(), info={"ok": True, "result": user_info_for_paths("/dashboard", "/licensing/applications")})

    outcome = run_reader(gateway, planner, question="show me the list", conversation_context={"previousIntent": {"question": "How about my enquiries tasks?", "answerShape": "overview", "page": "/dashboard", "section": "My Tasks"}})

    assert outcome.result.status == "not_confirmed"
    assert gateway.events.count("admin.portal.read") == 2


def _follow_up_tab_case(actions, *, repair_actions=None, initial_actions=None):
    initial = portal_plan_for("/work", initial_actions or [{"type": "observe"}])
    follow_up = portal_plan_for("/work", actions)
    plans = [initial, follow_up]
    if repair_actions is not None:
        plans.append(portal_plan_for("/work", repair_actions))
    plans.append({
        "mode": "observation_result", "result": "success", "page": "/work", "section": "Applications",
        "sourceSection": "observation-table-001", "selectedState": "Blocked", "answerShape": "list",
        "facts": ["APP-200 Blocked"], "missing": [],
    })
    rows = _observation(rows=("APP-200 Blocked",))
    rows["sectionSummaries"][0]["selectedState"] = "Blocked"
    initial_observation = _observation()
    initial_observation["regionSummaries"] = [{
        "nodeId": "observation-region-001", "kind": "region", "heading": "Applications",
        "controls": ["Blocked", "Urgent"], "selectedState": "To Do",
    }]
    observations = [
        {"result": "not_confirmed", "observation": initial_observation},
        {"result": "not_confirmed", "observation": rows},
    ]
    if any(action.get("type") == "switch_tab" for action in initial_actions or []):
        observations[1] = {"result": "not_confirmed", "observation": initial_observation}
    gateway = SequencedGateway(
        observations,
        info={"ok": True, "result": user_info_for_paths("/work")},
    )
    planner = Planner(*plans)
    return gateway, planner


def test_follow_up_switch_and_pure_observe_preserves_action_without_llm_schema_repair():
    switch = {"type": "switch_tab", "role": "tab", "name": "Blocked"}
    gateway, planner = _follow_up_tab_case([switch, {"type": "observe"}])
    outcome = run_reader(gateway, planner, question="show me the blocked task list")
    assert outcome.result.status == "success"
    assert outcome.result.facts == ("APP-200 Blocked",)
    assert gateway.events.count("admin.portal.read") == 2
    assert gateway.calls[-1][1]["actions"] == [switch]
    assert len(planner.calls) == 3
    assert all(not call[2].get("planningDirective", {}).get("repairInvalidPortalReadPlan") for call in planner.calls)


def test_follow_up_switch_uses_unique_observed_control_instead_of_planner_locator_hints():
    requested = {
        "type": "switch_tab", "role": "tab", "name": "Blocked",
        "section": "Invented Section", "selector": "[data-state='blocked']",
    }
    gateway, planner = _follow_up_tab_case([requested])

    outcome = run_reader(gateway, planner, question="show me the blocked task list")

    assert outcome.result.status == "success"
    assert gateway.calls[-1][1]["actions"] == [
        {"type": "switch_tab", "role": "tab", "name": "Blocked"},
    ]


def test_follow_up_trailing_observe_unsafe_metadata_is_rejected_before_normalization_or_repair():
    gateway, planner = _follow_up_tab_case([
        {"type": "switch_tab", "role": "tab", "name": "Blocked"}, {"type": "observe", "method": "POST"},
    ])
    outcome = run_reader(gateway, planner, question="show me the blocked task list")
    assert outcome.result.status == "not_confirmed"
    assert outcome.audit_evidence["stage"] == "policy_after_observe"
    assert gateway.events.count("admin.portal.read") == 1
    assert len(planner.calls) == 2


@pytest.mark.parametrize("initial_actions,follow_up_count", [
    ([{"type": "observe"}], 11),
    ([{"type": "switch_tab", "role": "tab", "name": "Urgent"}, {"type": "observe"}], 10),
])
def test_follow_up_original_action_budget_is_checked_before_dropping_observe(initial_actions, follow_up_count):
    gateway, planner = _follow_up_tab_case([
        *([{"type": "switch_tab", "role": "tab", "name": "Blocked"}] * follow_up_count), {"type": "observe"},
    ], initial_actions=initial_actions)
    outcome = run_reader(gateway, planner, question="show me the blocked task list")
    assert outcome.result.status == "not_confirmed"
    initial_state_change = any(action.get("type") == "switch_tab" for action in initial_actions)
    assert outcome.result.missing == (
        ("additional_portal_read_required",) if initial_state_change else ("invalid_follow_up_plan",)
    )
    expected_reads = 2 if initial_state_change else 1
    assert gateway.events.count("admin.portal.read") == expected_reads
    assert len(planner.calls) == 2


@pytest.mark.parametrize("invalid_actions", [
    [{"type": "query", "role": "row", "name": "Blocked"}, {"type": "observe"}],
    [{"type": "observe"}, {"type": "switch_tab", "role": "tab", "name": "Blocked"}],
    [{"type": "switch_tab", "role": "tab", "name": "Urgent"}, {"type": "observe"}, {"type": "switch_tab", "role": "tab", "name": "Blocked"}],
])
def test_invalid_mixed_follow_up_still_requires_repair_and_repeated_invalid_repair_is_rejected(invalid_actions):
    gateway, planner = _follow_up_tab_case(invalid_actions, repair_actions=invalid_actions)
    outcome = run_reader(gateway, planner, question="show me the blocked task list")
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.missing == ("invalid_follow_up_plan",)
    assert gateway.events.count("admin.portal.read") == 1
    assert planner.calls[2][2]["planningDirective"]["repairInvalidPortalReadPlan"]


def test_corrected_follow_up_switch_with_pure_observe_uses_same_safe_normalization():
    switch = {"type": "switch_tab", "role": "tab", "name": "Blocked"}
    gateway, planner = _follow_up_tab_case([{"type": "observe"}, switch], repair_actions=[switch, {"type": "observe"}])
    outcome = run_reader(gateway, planner, question="show me the blocked task list")
    assert outcome.result.status == "success"
    assert outcome.result.facts == ("APP-200 Blocked",)
    assert gateway.calls[-1][1]["actions"] == [switch]
    assert len(planner.calls) == 4


def test_record_detail_missing_model_binding_fields_is_resolved_from_current_observation():
    initial = portal_plan_for("/records", [
        {"type": "query", "role": "row", "name": "Application No."},
        {"type": "show_detail", "role": "cell", "name": "APP-123"},
    ])
    detail_result = {
        "mode": "observation_result", "result": "success", "sourceSection": "detail-region",
        "answerShape": "detail", "facts": ["APP-123 Status Completed"], "missing": [],
    }
    planner = Planner(initial, detail_result)
    list_observation = _observation(rows=("APP-123 Completed", "APP-456 Pending"))
    detail_observation = {
        "readHealth": {"healthy": True, "blocked": [], "failed": [], "pending": []},
        "regionSummaries": [{
            "nodeId": "detail-region", "kind": "region", "heading": "Application Details",
            "cardSummaries": ["APP-123 Status Completed"],
        }],
    }
    gateway = SequencedGateway(
        [
            {"result": "not_confirmed", "observation": list_observation},
            {"result": "not_confirmed", "observation": detail_observation},
        ],
        info={"ok": True, "result": user_info_for_paths("/records", "/records/detail")},
    )
    context = {"resolvedIntent": {"relation": "continue", "slots": {
        "recordIdentity": {"source": "current", "value": "APP-123", "evidence": "APP-123"},
        "answerShape": {"source": "current", "value": "detail", "evidence": "detail"},
    }}}

    outcome = run_reader(
        gateway,
        planner,
        question="show APP-123 detail",
        conversation_context=context,
    )

    assert outcome.result.status == "success"
    assert gateway.events.count("admin.portal.read") == 2
    assert gateway.calls[-1][1]["actions"] == [
        {"type": "show_detail", "role": "cell", "name": "APP-123", "value": "APP-123"},
    ]


def test_compound_list_then_first_detail_binds_first_native_row_before_click():
    initial = portal_plan_for("/records", [
        {"type": "query", "role": "row", "name": "Record No."},
        {"type": "show_detail", "role": "cell", "name": "first one"},
    ])
    detail_result = {
        "mode": "observation_result", "result": "success", "sourceSection": "detail-region",
        "answerShape": "detail", "facts": ["REC-100 Status Active"], "missing": [],
    }
    planner = Planner(initial, detail_result)
    list_observation = {
        "readHealth": {"healthy": True},
        "sectionSummaries": [{
            "nodeId": "records", "kind": "table", "columnHeaders": ["Record No.", "Status"],
            "rowFields": [{"Record No.": "REC-100", "Status": "Active"},
                          {"Record No.": "REC-200", "Status": "Expired"}],
            "rowSummaries": ["REC-100 Active", "REC-200 Expired"],
        }],
    }
    detail_observation = {
        "readHealth": {"healthy": True},
        "regionSummaries": [{"nodeId": "detail-region", "kind": "region",
                              "heading": "Record Details", "cardSummaries": ["REC-100 Status Active"]}],
    }
    gateway = SequencedGateway([
        {"result": "not_confirmed", "observation": list_observation},
        {"result": "not_confirmed", "observation": detail_observation},
    ], info={"ok": True, "result": user_info_for_paths("/records", "/records/detail")})

    outcome = run_reader(gateway, planner, question="List several records. View details of the first one.")

    assert outcome.result.status == "success"
    assert gateway.calls[-1][1]["actions"] == [
        {"type": "show_detail", "role": "cell", "name": "REC-100", "value": "REC-100"},
    ]


def test_compound_first_detail_overrides_a_list_only_post_observe_result():
    list_result = {
        "mode": "observation_result", "result": "success", "sourceSection": "records",
        "answerShape": "list", "facts": [json.dumps({"Record No.": "REC-100", "Status": "Active"})],
        "missing": [],
    }
    detail_result = {
        "mode": "observation_result", "result": "success", "sourceSection": "detail-region",
        "answerShape": "detail", "facts": ["REC-100 Issuance Date 01/09/2026"], "missing": [],
    }
    planner = Planner(portal_plan_for("/records", [{"type": "observe"}]), list_result, detail_result)
    list_observation = {
        "readHealth": {"healthy": True},
        "sectionSummaries": [{
            "nodeId": "records", "kind": "table", "columnHeaders": ["Record No.", "Status"],
            "rowFields": [{"Record No.": "REC-100", "Status": "Active"}],
            "rowSummaries": ["REC-100 Active"],
        }],
    }
    detail_observation = {
        "readHealth": {"healthy": True},
        "regionSummaries": [{"nodeId": "detail-region", "kind": "region",
                              "heading": "Record Details", "cardSummaries": ["REC-100 Issuance Date 01/09/2026"]}],
    }
    gateway = SequencedGateway([
        {"result": "not_confirmed", "observation": list_observation},
        {"result": "not_confirmed", "observation": detail_observation},
    ], info={"ok": True, "result": user_info_for_paths("/records", "/records/detail")})

    outcome = run_reader(gateway, planner, question="List several records. View details of the first one.")

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "detail"
    assert "Issuance Date" in outcome.result.facts[0]
    assert gateway.calls[-1][1]["actions"] == [
        {"type": "show_detail", "role": "cell", "name": "REC-100", "value": "REC-100"},
    ]


def test_filter_then_detail_recovers_identity_from_exact_question_value():
    initial = portal_plan_for("/records", [
        {"type": "filter", "role": "textbox", "name": "Application No.", "value": "APP-123"},
        {"type": "show_detail", "role": "cell", "name": "Application No."},
    ])
    detail_result = {
        "mode": "observation_result", "result": "success", "sourceSection": "detail-region",
        "answerShape": "detail", "facts": ["APP-123 Status Completed"], "missing": [],
    }
    planner = Planner(initial, detail_result)
    unfiltered_observation = _observation(rows=("APP-456 Pending",))
    filtered_observation = _observation(rows=("APP-123 Completed",))
    detail_observation = {
        "readHealth": {"healthy": True, "blocked": [], "failed": [], "pending": []},
        "regionSummaries": [{
            "nodeId": "detail-region", "kind": "region", "heading": "Application Details",
            "cardSummaries": ["APP-123 Status Completed"],
        }],
    }
    gateway = SequencedGateway(
        [
            {"result": "not_confirmed", "observation": unfiltered_observation},
            {"result": "not_confirmed", "observation": filtered_observation},
            {"result": "not_confirmed", "observation": detail_observation},
        ],
        info={"ok": True, "result": user_info_for_paths("/records", "/records/detail")},
    )

    outcome = run_reader(gateway, planner, question="show details for APP-123")

    assert outcome.result.status == "success"
    assert gateway.events.count("admin.portal.read") == 3
    portal_calls = [arguments for tool_name, arguments, _allowed in gateway.calls if tool_name == "admin.portal.read"]
    assert portal_calls[0]["actions"] == [{"type": "observe"}]
    assert portal_calls[1]["actions"] == [
        {"type": "filter", "role": "textbox", "name": "Application No.", "value": "APP-123"},
    ]
    assert portal_calls[2]["actions"] == [
        {"type": "show_detail", "role": "cell", "name": "APP-123", "value": "APP-123"},
    ]


def test_loaded_application_detail_is_delivered_without_replaying_show_detail():
    observation = {
        "apiDiscovery": {
            "candidates": [{
                "operationKey": "GET /api/Application/MyReviewDetail/{taskId}",
                "candidateKind": "business",
                "method": "GET",
                "status": 200,
                "responseEvidenceTruncated": True,
                "responseEvidence": {
                    "data": {
                        "detail": {
                            "applicationNumber": "ML-1-7-6577159",
                            "serviceNameEn": "Ground Photography Permit within the UAE",
                            "serviceCategoryNameEn": "Filming Permit",
                            "serviceTypeNameEn": "New",
                            "status": "Final Approval",
                            "slaDescription": "5d Overdue",
                            "applyForEn": "Peter",
                            "submissionTime": "2026-09-03T06:20:54",
                            "taskId": "private-task-id",
                        }
                    },
                    "isSuccess": True,
                },
            }],
            "deltaCandidates": [],
        },
    }

    result = _native_detail_observation_result(
        observation,
        page="/licensing/applications",
        record_identity="ML-1-7-6577159",
        scope="team",
    )

    assert result is not None
    assert result.status == "success"
    assert result.answer_shape == "detail"
    fields = json.loads(result.facts[0])
    assert fields == {
        "Application No.": "ML-1-7-6577159",
        "Service Name": "Ground Photography Permit within the UAE",
        "Service Category": "Filming Permit",
        "Type": "New",
        "Status": "Final Approval",
        "SLA": "5d Overdue",
        "Apply For": "Peter",
        "Submission Time": "2026-09-03T06:20:54",
    }


def test_unique_current_record_detail_is_bound_before_api_candidate_selection():
    initial = portal_plan_for("/records", [{"type": "observe"}])
    detail_result = {
        "mode": "observation_result", "result": "success", "sourceSection": "detail-region",
        "answerShape": "detail", "facts": ["APP-123 Status Completed"], "missing": [],
    }
    planner = Planner(initial, detail_result)
    list_observation = _observation(rows=("APP-123 Completed", "APP-456 Pending"))
    list_observation["apiDiscovery"] = {
        "candidateCount": 2,
        "truncated": False,
        "candidates": [
            {"operationKey": "GET /api/records", "candidateKind": "business", "method": "GET", "pathTemplate": "/api/records", "status": 200, "policyState": "allowed", "trigger": "initial", "swagger": {}},
            {"operationKey": "GET /api/profile", "candidateKind": "business", "method": "GET", "pathTemplate": "/api/profile", "status": 200, "policyState": "allowed", "trigger": "initial", "swagger": {}},
        ],
        "deltaCandidates": [],
    }
    detail_observation = {
        "readHealth": {"healthy": True, "blocked": [], "failed": [], "pending": []},
        "regionSummaries": [{
            "nodeId": "detail-region", "kind": "region", "heading": "Application Details",
            "cardSummaries": ["APP-123 Status Completed"],
        }],
    }
    gateway = SequencedGateway(
        [
            {"result": "not_confirmed", "observation": list_observation},
            {"result": "not_confirmed", "observation": detail_observation},
        ],
        info={"ok": True, "result": user_info_for_paths("/records", "/records/detail")},
    )
    context = {"resolvedIntent": {"relation": "continue", "slots": {
        "recordIdentity": {"source": "current", "value": "APP-123", "evidence": "APP-123"},
        "answerShape": {"source": "current", "value": "detail", "evidence": "detail"},
    }}}

    outcome = run_reader(
        gateway,
        planner,
        question="show APP-123 detail",
        conversation_context=context,
    )

    assert outcome.result.status == "success"
    assert gateway.calls[-1][1]["actions"] == [
        {"type": "show_detail", "role": "cell", "name": "APP-123", "value": "APP-123"},
    ]
    assert len(planner.calls) == 2


@pytest.mark.parametrize("corrected_actions,stage", [
    ([{"type": "switch_tab", "role": "tab", "name": "Blocked"}, {"type": "observe", "method": "POST"}], "policy_after_observe"),
    ([{"type": "switch_tab", "role": "tab", "name": "Blocked"}] * 11 + [{"type": "observe"}], "planning_after_observe"),
])
def test_corrected_follow_up_still_validates_raw_policy_and_raw_cumulative_budget(corrected_actions, stage):
    switch = {"type": "switch_tab", "role": "tab", "name": "Blocked"}
    gateway, planner = _follow_up_tab_case([{"type": "observe"}, switch], repair_actions=corrected_actions)
    outcome = run_reader(gateway, planner, question="show me the blocked task list")
    assert outcome.result.status == "not_confirmed"
    assert outcome.audit_evidence["stage"] == stage
    assert gateway.events.count("admin.portal.read") == 1
    assert len(planner.calls) == 3
