import json

import pytest

from app.portal_reader import _list_selection_review_context, observation_result_from_plan
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths


ROWS = [
    {"Record No.": "R-1", "Status": "Cancelled"},
    {"Record No.": "R-2", "Status": "Completed"},
]
OBSERVATION = {"sectionSummaries": [{
    "nodeId": "table-1", "kind": "table", "heading": "Records", "selectedState": "Completed",
    "controls": ["Completed"],
    "columnHeaders": ["Record No.", "Status"], "rowFields": ROWS,
    "rowSummaries": ["R-1 Cancelled", "R-2 Completed"],
}]}


def selection(*indices):
    return {
        "mode": "observation_result", "result": "success", "sourceSection": "table-1",
        "answerShape": "list", "selectedState": "Completed",
        "facts": [json.dumps(ROWS[index]) for index in indices],
    }


def test_partial_selection_requests_review_without_adding_rows_or_changing_context():
    context = {"portalObservation": OBSERVATION, "chunks": [{"content": "Queue and status differ."}]}
    reviewed = _list_selection_review_context(selection(1), context)
    assert reviewed is not None
    assert reviewed["portalObservation"] is OBSERVATION
    assert reviewed["chunks"] == context["chunks"]
    assert "planningDirective" not in context
    assert reviewed["planningDirective"]["priorSelection"]["facts"] == selection(1)["facts"]
    assert reviewed["planningDirective"]["observedRowCount"] == 2
    assert reviewed["planningDirective"]["selectedRowCount"] == 1


@pytest.mark.parametrize("plan", [selection(0, 1), selection(), {**selection(1), "answerShape": "detail"}])
def test_non_partial_list_does_not_request_review(plan):
    assert _list_selection_review_context(plan, {"portalObservation": OBSERVATION}) is None


def test_unbound_or_unselected_table_does_not_guess_omissions():
    for key in ("rowFields", "selectedState"):
        section = {k: v for k, v in OBSERVATION["sectionSummaries"][0].items() if k != key}
        assert _list_selection_review_context(selection(1), {"portalObservation": {"sectionSummaries": [section]}}) is None
    assert _list_selection_review_context({**selection(1), "facts": ['{"Status":"Unknown"}']}, {
        "portalObservation": OBSERVATION,
    }) is None


def test_non_unique_field_fact_cannot_pass_as_individual_records():
    section = {**OBSERVATION["sectionSummaries"][0], "rowFields": [
        *ROWS, {"Record No.": "R-3", "Status": "Completed"},
    ]}
    observation = {"sectionSummaries": [section]}
    ambiguous = {**selection(1), "facts": ['{"Status":"Completed"}']}
    assert _list_selection_review_context(ambiguous, {"portalObservation": observation}) is None
    assert observation_result_from_plan(ambiguous, observation) is None


@pytest.mark.parametrize("question,reviewed_indices", [
    ("Show records in the Completed view", (0, 1)),
    ("Show only records whose Status is Completed in the Completed view", (1,)),
    ("Show one record from the Completed view", (1,)),
])
def test_review_runs_once_and_respects_reducer_selection(question, reviewed_indices):
    planner = Planner(
        portal_plan_for("/records", [{"type": "switch_tab", "role": "tab", "name": "Completed"}]),
        selection(1), selection(*reviewed_indices),
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/records")},
        portal_result={"ok": True, "result": {"status": "not_confirmed", "observation": OBSERVATION}},
    )
    outcome = run_reader(gateway, planner, question=question)
    assert outcome.result.status == "success"
    assert outcome.result.facts == tuple(selection(*reviewed_indices)["facts"])
    assert outcome.result.completeness == "bounded"
    assert len(planner.calls) == 3
    assert planner.calls[2][2]["planningDirective"]["listSelectionReview"] is True
    assert gateway.events.count("admin.portal.read") == 2
    assert any(entry["stage"] == "list_selection_review" for entry in outcome.audit_evidence["qualityTrace"])
