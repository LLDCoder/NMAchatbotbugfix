from copy import deepcopy

import pytest

from app.portal_reader import observation_result_from_plan
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths
from test_reader_evidence_retention import execute, result_plan


def view_observation(region="Personal Queue", category="Requests"):
    controls = [f"{category} 1", "Pending Review 2d Overdue REF-101"]
    return {"readHealth": {"healthy": True}, "regionSummaries": [
        {"nodeId": "outer", "kind": "region", "heading": region, "controls": controls},
        {"nodeId": "active", "kind": "region", "heading": region,
         "selectedState": f"{category} 1", "controls": controls},
        {"nodeId": "other", "kind": "region", "heading": category,
         "controls": ["Pending Review 17", "External Review 6"]},
    ]}


def selection(region="Personal Queue", category="Requests"):
    return {**result_plan(["Pending Review 2d Overdue REF-101"], section=region, shape="attention"),
            "sourceSection": f"{category} 1", "selectedState": f"{category} 1"}


@pytest.mark.parametrize("region,category", [
    ("Personal Queue", "Requests"), ("Assigned Work", "Applications"), ("Review Inbox", "Reports"),
])
def test_control_source_is_bound_within_region_and_observed_state(region, category):
    outcome = execute(view_observation(region, category), selection(region, category), "Which work requires attention?")
    assert outcome.result.status == "success"
    assert outcome.result.source_section == "active"
    assert outcome.result.section == region
    assert outcome.result.selected_state == f"{category} 1"
    assert outcome.result.facts == ("Pending Review 2d Overdue REF-101",)


def test_repeated_heading_is_disambiguated_by_observed_state():
    plan = {**selection(), "sourceSection": "Personal Queue"}
    result = observation_result_from_plan(plan, view_observation())
    assert result is not None
    assert result.source_section == "active"


@pytest.mark.parametrize("source", ["Personal Queue", "Requests", "Requests 1", "active"])
def test_selected_view_label_can_omit_its_observed_count_badge(source):
    plan = {**selection(), "sourceSection": source, "selectedState": "Requests"}
    result = observation_result_from_plan(plan, view_observation())
    assert result is not None
    assert result.source_section == "active"
    assert result.selected_state == "Requests 1"


@pytest.mark.parametrize("state", ["Requests 2", "Request", "Request 1", "Requests Completed"])
def test_view_badge_matching_does_not_allow_prefixes_or_conflicting_counts(state):
    plan = {**selection(), "sourceSection": "active", "selectedState": state}
    assert observation_result_from_plan(plan, view_observation()) is None


def test_view_badge_normalization_requires_the_observed_control():
    observation = view_observation()
    observation["regionSummaries"][1]["controls"] = ["Pending Review 2d Overdue REF-101"]
    plan = {**selection(), "sourceSection": "active", "selectedState": "Requests"}
    assert observation_result_from_plan(plan, observation) is None


@pytest.mark.parametrize("source", ["Requests 1", "Personal Queue"])
def test_active_state_does_not_choose_between_different_same_state_sources(source):
    observation = view_observation()
    duplicate = deepcopy(observation["regionSummaries"][1])
    duplicate.update(nodeId="another-active", controls=["Requests 1", "Pending Review 2d Overdue REF-202"])
    observation["regionSummaries"].append(duplicate)
    assert observation_result_from_plan({**selection(), "sourceSection": source}, observation) is None


@pytest.mark.parametrize("change", [
    {"sourceSection": "other"},
    {"sourceSection": "Requests Completed"},
    {"sourceSection": "missing-node"},
    {"sourceSection": "Requests 2"},
    {"sourceSection": "active", "selectedState": "Completed"},
    {"sourceSection": "Personal Queue", "selectedState": "Completed"},
    {"page": "/restricted"},
])
def test_bad_source_or_view_cannot_escape_region_via_fallback(change):
    # A count-shaped fallback must not pull a plausible count from the other region.
    plan = {**selection(), "answerShape": "count", "facts": ["Pending Review 17"], **change}
    outcome = execute(view_observation(), plan, "How many pending requests are in my queue?")
    assert outcome.result.status == "not_confirmed"
    assert not outcome.result.facts


def test_explicit_child_node_retains_parent_view_and_region_constraint():
    observation = view_observation()
    observation["sectionSummaries"] = [{
        "nodeId": "child", "parentRef": "active", "kind": "table", "heading": "Records",
        "rowSummaries": ["REF-101 Pending Review"],
    }]
    plan = {**selection(), "sourceSection": "child", "answerShape": "list", "facts": ["REF-101 Pending Review"]}
    result = observation_result_from_plan(plan, observation)
    assert result is not None
    assert result.source_section == "child"
    assert result.selected_state == "Requests 1"


def test_declared_child_heading_resolves_only_inside_parent():
    observation = view_observation()
    observation["sectionSummaries"] = [{
        "nodeId": "child", "parentRef": "active", "kind": "table", "heading": "Records",
        "rowSummaries": ["REF-101 Pending Review"],
    }, {
        "nodeId": "other-child", "parentRef": "other", "kind": "table", "heading": "Records",
        "rowSummaries": ["REF-999 Completed"],
    }]
    plan = {**selection(), "sourceSection": "Records", "answerShape": "list", "facts": ["REF-101 Pending Review"]}
    result = observation_result_from_plan(plan, observation)
    assert result is not None
    assert result.source_section == "child"


def test_cycle_in_parent_refs_does_not_escape_declared_region():
    observation = view_observation()
    observation["regionSummaries"].extend([
        {"nodeId": "cycle-a", "parentRef": "cycle-b", "heading": "Other records"},
        {"nodeId": "cycle-b", "parentRef": "cycle-a", "heading": "Other records"},
    ])
    assert observation_result_from_plan({**selection(), "sourceSection": "cycle-a"}, observation) is None


def test_source_binding_does_not_relax_field_or_number_grounding():
    plan = {**selection(), "facts": ["Pending Review 2d Overdue REF-101", "Assigned To Alice", "Requests 17"]}
    result = observation_result_from_plan(plan, view_observation())
    assert result is not None
    assert result.status == "not_confirmed"
    assert result.source_section == "active"
    assert result.facts == ("Pending Review 2d Overdue REF-101",)


def test_count_fallback_with_category_label_stays_within_bound_region():
    plan = {**selection(), "sourceSection": "Requests", "answerShape": "count", "facts": ["Pending Review 17"]}
    outcome = execute(view_observation(), plan, "How many requests are in my queue?")
    assert outcome.result.status == "success"
    assert outcome.result.facts == ("Requests 1",)


def test_grounding_repair_receives_resolved_node_and_raw_evidence():
    candidate = {**selection(), "facts": ["Task: REF-101; SLA: 2d Overdue; Status: Pending Review"]}
    corrected = {**selection(), "sourceSection": "active"}
    planner = Planner(portal_plan_for("/licensing", [{"type": "observe"}]), candidate, corrected)
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": view_observation()}})
    outcome = run_reader(gateway, planner, question="Which work requires attention?")
    directive = planner.calls[-1][2]["planningDirective"]
    assert directive["boundSource"]["nodeId"] == "active"
    assert directive["boundSource"]["selectedState"] == "Requests 1"
    assert directive["boundSource"]["controls"] == ["Requests 1", "Pending Review 2d Overdue REF-101"]
    repair_observation = planner.calls[-1][2]["portalObservation"]
    assert [node["nodeId"] for node in repair_observation["sectionSummaries"]] == ["active"]
    assert "regionSummaries" not in repair_observation
    assert repair_observation["readHealth"] == {"healthy": True}
    assert outcome.result.status == "success"
    assert outcome.result.source_section == "active"
    trace = next(item for item in outcome.audit_evidence["qualityTrace"] if item["stage"] == "observation_grounding")
    assert trace["input"]["boundSource"] == "active"


def test_failed_repair_remains_visible_in_audit_and_cannot_leak_another_region():
    candidate = {**selection(), "facts": ["Assigned To Alice"]}
    outcome = execute(view_observation(), candidate, "Which work requires attention?")
    assert outcome.result.status == "not_confirmed"
    assert not outcome.result.facts
    trace = next(item for item in outcome.audit_evidence["qualityTrace"] if item["stage"] == "observation_grounding")
    assert trace["failureCode"] == "grounding_repair_unavailable"


def test_active_control_without_declared_region_is_not_guessed_globally():
    plan = {**selection(), "section": "", "facts": ["Pending Review 17"]}
    assert observation_result_from_plan(plan, view_observation()) is None


def test_equivalent_duplicate_active_regions_share_a_canonical_source():
    observation = view_observation()
    duplicate = deepcopy(observation["regionSummaries"][1])
    duplicate["nodeId"] = "duplicate-active"
    observation["regionSummaries"].append(duplicate)
    result = observation_result_from_plan(selection(), observation)
    assert result is not None
    assert result.source_section == "active"


@pytest.mark.parametrize("repaired", [
    {**selection(), "section": "Requests", "sourceSection": "other", "selectedState": "",
     "answerShape": "count", "facts": ["Pending Review 17"]},
    {**selection(), "sourceSection": "active", "facts": ["Assigned To Alice"]},
])
def test_repair_cannot_change_bound_region_or_introduce_unsupported_fields(repaired):
    candidate = {**selection(), "facts": ["Requests 1", "Assigned To Alice"]}
    planner = Planner(portal_plan_for("/licensing", [{"type": "observe"}]), candidate, repaired)
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": view_observation()}})
    outcome = run_reader(gateway, planner, question="Which work requires attention?")
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == ("Requests 1",)
    assert outcome.result.source_section == "active"
    trace = next(item for item in outcome.audit_evidence["qualityTrace"] if item["stage"] == "observation_grounding")
    assert trace["failureCode"] in {"grounding_repair_source_changed", "grounding_repair_rejected"}
