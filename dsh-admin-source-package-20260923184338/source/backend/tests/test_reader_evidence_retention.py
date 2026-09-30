import json

import pytest

from app.portal_reader import (
    ReaderResult, ReaderStageTimeout, _reconcile_verified_answer_shape,
    _selected_view_list_fallback, observation_result_from_plan,
)
from app.service import reader_evidence_only_response
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths
from test_reader_intent_flow import IntentPlanner, resolution, slot


def result_plan(facts, *, section="Application Details", shape="detail", status="success", missing=()):
    return {
        "mode": "observation_result", "result": status, "page": "/licensing",
        "section": section, "sourceSection": section, "answerShape": shape,
        "facts": list(facts), "missing": list(missing),
    }


def execute(observation, plan, question="What are the status and reviewer of REF-101?"):
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/licensing")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )
    return run_reader(
        gateway, Planner(portal_plan_for("/licensing", [{"type": "observe"}]), plan), question=question,
    )


def detail_observation():
    return {"readHealth": {"healthy": True}, "regionSummaries": [{
        "heading": "Application Details", "summaries": ["Reference REF-101", "Status Pending Review"],
    }]}


def test_partial_result_keeps_only_independently_supported_facts():
    plan = result_plan(
        ["Status Pending Review", "Reviewer Alice"], status="not_confirmed", missing=["reviewer_unavailable"],
    )
    outcome = execute(detail_observation(), plan)
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == ("Status Pending Review",)
    assert "reviewer_unavailable" in outcome.result.missing
    answer = reader_evidence_only_response(outcome.result.public_json(), "en")
    assert "Status Pending Review" in answer
    assert "Alice" not in answer
    assert "remaining" in answer.casefold()


@pytest.mark.parametrize("change", [
    {"sourceSection": "Other region"}, {"page": "/restricted"}, {"selectedState": "Completed"},
])
def test_partial_facts_with_invalid_provenance_are_not_returned(change):
    obs = detail_observation()
    obs["regionSummaries"][0]["selectedState"] = "Pending Review"
    plan = {**result_plan(["Status Pending Review"], status="not_confirmed", missing=["reviewer_unavailable"]), **change}
    assert observation_result_from_plan(plan, obs, observed_page="/licensing", permitted_paths=("/licensing",)) is None
    assert not execute(obs, plan).result.facts


@pytest.mark.parametrize("subject", ["Retry request", "Loading permit", "Forbidden content complaint"])
def test_business_text_does_not_turn_a_healthy_observation_into_a_page_error(subject):
    fact = f"Reference REF-101; Status Pending Review; Subject {subject}"
    obs = {"readHealth": {"healthy": True}, "sectionSummaries": [{
        "nodeId": "table-1", "kind": "table", "heading": "Applications", "rowSummaries": [fact],
    }]}
    outcome = execute(obs, result_plan([fact], section="table-1", shape="list"), "Show application records")
    assert outcome.result.status == "success"
    assert outcome.result.facts == (fact,)


@pytest.mark.parametrize("observation", [
    {"headings": ["Error 500"], "rowSummaries": ["REF-101 Pending Review"]},
    {"headings": ["Applications"], "rowSummaries": ["Loading..."]},
    {"headings": ["Access denied"]},
])
def test_actual_error_or_loading_surface_still_blocks(observation):
    outcome = execute(observation, result_plan(["REF-101 Pending Review"]))
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.missing == ("observation_page_not_confirmed",)
    assert not outcome.result.facts


def filtered_observation(selected_state="Pending Review"):
    return {"readHealth": {"healthy": True}, "sectionSummaries": [{
        "nodeId": "table-1", "kind": "table", "heading": "Applications", "selectedState": selected_state,
        "columnHeaders": ["Reference", "Status"],
        "rowSummaries": ["Reference: REF-101; Status: Pending Review"],
        "rowFields": [{"Reference": "REF-101", "Status": "Pending Review"}],
    }]}


def test_selected_view_list_fallback_is_not_disabled_by_the_view_name():
    plan = result_plan(["Reference: REF-101; Status: Pending Review"], section="table-1", shape="list")
    outcome = execute(filtered_observation(), plan, "Show pending application records")
    assert outcome.result.status == "success"
    assert json.loads(outcome.result.facts[0]) == {"Reference": "REF-101", "Status": "Pending Review"}


@pytest.mark.parametrize("state,question", [
    ("Completed", "Show pending application records"),
    ("", "Show pending application records"),
    ("Pending Review", "Show pending application records assigned to Alice"),
    ("Pending Review", "Show pending application records today"),
    ("Pending Review", "Show pending application records over 100"),
])
def test_selected_view_fallback_does_not_invent_unverified_constraints(state, question):
    plan = result_plan([], section="table-1", shape="list", status="not_confirmed", missing=["selection_unconfirmed"])
    outcome = execute(filtered_observation(state), plan, question)
    assert outcome.result.status == "not_confirmed"
    assert not outcome.result.facts


@pytest.mark.parametrize("shape", ["list", "due"])
def test_overdue_rows_answer_due_questions_despite_a_list_label(shape):
    obs = {"readHealth": {"healthy": True}, "sectionSummaries": [{
        "nodeId": "table-1", "kind": "table", "heading": "Overdue Tasks", "rowSummaries": ["REF-101 3d Overdue"],
    }]}
    candidate = result_plan(["REF-101 3d Overdue"], section="table-1", shape=shape)
    intent = resolution("refine", businessObject=slot("tasks", source="previous"), answerShape=slot("due", "overdue"))
    history = {"previousIntent": {"businessObject": "tasks", "answerShape": "list", "page": "/licensing"}}
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": obs}})
    outcome = run_reader(gateway, IntentPlanner(intent, portal_plan_for("/licensing", [{"type": "observe"}]), candidate, candidate),
                         question="Which tasks are overdue?", conversation_context=history)
    assert outcome.result.status == "success"
    assert outcome.result.facts == ("REF-101 3d Overdue",)
    assert outcome.result.answer_shape == "due"


def test_attention_paraphrase_failure_retains_counts_without_claiming_prioritized_rows():
    obs = {"readHealth": {"healthy": True}, "regionSummaries": [{
        "heading": "Needs Manager Attention", "controls": ["Urgent 0", "Blocked 6"], "selectedState": "Urgent 0",
    }]}
    plan = result_plan([
        "Urgent 0: There are no urgent items needing manager attention.",
        "Blocked 6: There are 6 blocked items that need manager attention.",
    ], section="Needs Manager Attention", shape="attention")
    outcome = execute(obs, plan, "What should I prioritize today?")
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == ("Urgent 0", "Blocked 6")
    assert outcome.result.missing == ("attention_details_not_confirmed",)
    assert "invalid_follow_up_plan" not in outcome.result.missing


def test_unsupported_detail_is_not_misclassified_as_a_followup_plan_error():
    outcome = execute(detail_observation(), result_plan(["Status Completed"]))
    assert outcome.result.status == "not_confirmed"
    assert not outcome.result.facts
    assert outcome.result.missing == ("invalid_observation_references",)


@pytest.mark.parametrize("error", [RuntimeError("unavailable"), ReaderStageTimeout("review", 1, total_budget=False)])
def test_failed_completion_review_preserves_prior_grounded_fields(error):
    class FailingReviewPlanner(IntentPlanner):
        async def plan_admin_portal_read(self, *args, **kwargs):
            if len(self.calls) == 2:
                raise error
            return await super().plan_admin_portal_read(*args, **kwargs)

    candidate = result_plan(["Status Pending Review"], shape="overview")
    intent = resolution("refine", answerShape=slot("detail", "details"))
    history = {"previousIntent": {"businessObject": "tasks", "answerShape": "list", "page": "/licensing"}}
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": detail_observation()}})
    outcome = run_reader(gateway, FailingReviewPlanner(intent, portal_plan_for("/licensing", [{"type": "observe"}]), candidate),
                         question="Show the task details", conversation_context=history)
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == ("Status Pending Review",)
    assert "completion_review_unavailable" in outcome.result.missing


@pytest.mark.parametrize("question,fact", [
    ("Which tasks are overdue today?", "REF-101 3d Overdue"),
    ("Which tasks are overdue?", "REF-101 Pending Review"),
    ("Which tasks are overdue?", "REF-101 Not Overdue"),
    ("Which tasks are overdue?", "REF-101 Overdue 0"),
])
def test_shape_reconciliation_does_not_invent_temporal_evidence(question, fact):
    result = _reconcile_verified_answer_shape(
        ReaderResult(status="success", summary="", answer_shape="list", facts=(fact,)), "due", question,
    )
    assert result.status == "not_confirmed"
    assert result.answer_shape == "list"
    assert result.facts == (fact,)


def test_unrelated_loading_region_does_not_discard_confirmed_details():
    obs = detail_observation()
    obs["readHealth"] = {"healthy": False, "pending": ["/api/other-region"]}
    obs["regionSummaries"].append({"heading": "Other Report", "summaries": ["Loading..."]})
    outcome = execute(obs, result_plan(["Status Pending Review"]))
    assert outcome.result.status == "success"
    assert outcome.result.facts == ("Status Pending Review",)


def test_selected_loading_region_does_not_supply_a_business_fact():
    obs = {"regionSummaries": [{"heading": "Application Details", "summaries": ["Loading..."]}]}
    outcome = execute(obs, result_plan(["Loading..."]))
    assert outcome.result.status == "not_confirmed"
    assert not outcome.result.facts


def test_fallback_does_not_upgrade_a_grounded_partial_result_to_complete():
    fact = json.dumps({"Reference": "REF-101", "Status": "Pending Review"})
    outcome = execute(filtered_observation(), result_plan(
        [fact], section="table-1", shape="list", status="not_confirmed", missing=["remaining_fields_unavailable"],
    ), "Show pending application records")
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == (fact,)
    assert outcome.result.missing == ("remaining_fields_unavailable",)


@pytest.mark.parametrize("repair_available", [True, False])
def test_rejected_attention_detail_gets_one_grounding_review_without_losing_counts(repair_available):
    raw_card = "Pending Review 1d Overdue Ground Photography Permit within the UAE Peter"
    obs = {"regionSummaries": [{"heading": "My Tasks", "controls": ["Service Application 1", raw_card]}]}
    candidate = result_plan([
        "Service Application 1",
        "Task No.: Ground Photography Permit within the UAE; Assignee: Peter; SLA: 1d Overdue",
    ], section="My Tasks", shape="attention")
    plans = [portal_plan_for("/licensing", [{"type": "observe"}]), candidate]
    if repair_available:
        plans.append(result_plan(["Service Application 1", raw_card], section="My Tasks", shape="attention"))
    planner = Planner(*plans)
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": obs}})
    outcome = run_reader(gateway, planner, question="What should I prioritize today?")
    assert len(planner.calls) == 3
    assert planner.calls[-1][2]["planningDirective"]["repairObservationGrounding"] is True
    if repair_available:
        assert outcome.result.status == "success"
        assert outcome.result.facts == ("Service Application 1", raw_card)
    else:
        assert outcome.result.status == "not_confirmed"
        assert outcome.result.facts == ("Service Application 1",)


@pytest.mark.parametrize("heading", ["My Tasks", "Needs Manager Attention"])
def test_correct_counts_alone_do_not_establish_individual_priorities(heading):
    obs = {"regionSummaries": [{"heading": heading, "controls": ["Service Application 1"]}]}
    outcome = execute(obs, result_plan(["Service Application 1"], section=heading, shape="attention"),
                      "What should I prioritize today?")
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == ("Service Application 1",)
    assert "attention_details_not_confirmed" in outcome.result.missing


@pytest.mark.parametrize("filter_value,accepted", [("Pending", True), ("Completed", False), ("Pending assigned to Alice", False)])
def test_resolved_filter_may_be_proven_by_the_current_selected_view(filter_value, accepted):
    context = {"resolvedIntent": resolution("refine", filter=slot(filter_value))}
    result = _selected_view_list_fallback(
        filtered_observation(), section_name="table-1", question="Show pending application records",
        page="/licensing", scope="unknown", conversation_context=context,
    )
    assert (result is not None) is accepted


def test_selected_view_fallback_rejects_indistinguishable_native_rows():
    obs = filtered_observation()
    table = obs["sectionSummaries"][0]
    table["rowFields"].append(dict(table["rowFields"][0]))
    assert _selected_view_list_fallback(
        obs, section_name="table-1", question="Show pending application records", page="/licensing",
        scope="unknown", conversation_context={},
    ) is None


def test_partial_native_rows_are_rendered_as_labeled_values_not_json():
    answer = reader_evidence_only_response({
        "result": "not_confirmed", "facts": [json.dumps({"Reference": "REF-101", "Status": "Pending Review"})],
    }, "en")
    assert "Reference: REF-101" in answer
    assert "Status: Pending Review" in answer
    assert "{" not in answer


def test_partial_result_with_ambiguous_heading_gets_a_node_reference_repair():
    obs = {"regionSummaries": [
        {"nodeId": "outer", "kind": "region", "heading": "My Tasks", "controls": ["Service Application 1", "Other 3"]},
        {"nodeId": "inner", "kind": "region", "heading": "My Tasks", "controls": ["Service Application 1"]},
    ]}
    candidate = result_plan(["Service Application 1"], section="My Tasks", shape="attention",
                            status="not_confirmed", missing=["priority_details_unavailable"])
    corrected = {**candidate, "sourceSection": "inner"}
    planner = Planner(portal_plan_for("/licensing", [{"type": "observe"}]), candidate, corrected)
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": obs}})
    outcome = run_reader(gateway, planner, question="What should I prioritize today?")
    assert len(planner.calls) == 3
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.source_section == "inner"
    assert outcome.result.facts == ("Service Application 1",)
