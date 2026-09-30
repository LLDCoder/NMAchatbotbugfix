import asyncio

import pytest

from app.portal_reader import ReaderTimeoutBudget
from app.reader_intent import SLOT_NAMES
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths


HISTORY = {"previousIntent": {
    "question": "Show appeals in To Do", "businessObject": "appeals", "view": "To Do",
    "page": "/happiness/appeals", "recordIdentity": "REF-41", "answerShape": "list",
}}


def resolution(relation="broaden", **values):
    return {
        "relation": relation,
        "slots": {name: values.get(name, {"source": "clear", "value": "", "evidence": ""})
                  for name in SLOT_NAMES},
        "clarificationOptions": [],
    }


def slot(value, evidence=None, source="current"):
    return {"source": source, "value": value, "evidence": evidence or value}


class IntentPlanner(Planner):
    def __init__(self, intent, *plans, events=None):
        super().__init__(*plans)
        self.intent = intent
        self.events = events if events is not None else []
        self.intent_calls = []
        self.contexts = []

    async def resolve_admin_portal_intent(self, question, context):
        self.events.append("resolve_intent")
        self.intent_calls.append((question, context))
        return self.intent

    async def plan_admin_portal_read(self, question, permission_context, knowledge_context, conversation_context=None):
        self.contexts.append(conversation_context)
        return await super().plan_admin_portal_read(question, permission_context, knowledge_context, conversation_context)


def test_broader_task_discards_old_page_identity_and_view_before_retrieval():
    events = []
    intent = resolution(businessObject=slot("tasks"), answerShape=slot("attention"))
    planner = IntentPlanner(intent, portal_plan_for("/dashboard"), events=events)
    gateway = Gateway(events=events, info={"ok": True, "result": user_info_for_paths("/dashboard")},
                      portal_result={"ok": True, "result": {
                          "result": "success", "page": "/dashboard", "answerShape": "attention",
                          "facts": ["REF-8 requires attention"],
                      }})
    outcome = run_reader(gateway, planner, question="Show all my tasks needing attention", conversation_context=HISTORY)
    assert events[:3] == ["GetUserInfo", "resolve_intent", "knowledge.search"]
    query = gateway.calls[0][1]["query"]
    for old in ("appeals", "/happiness", "REF-41", "To Do"):
        assert old not in query
        assert old not in str(planner.contexts)
    assert planner.contexts[0] == {"resolvedIntent": intent}
    assert outcome.result.status == "success"
    assert outcome.result.public_json()["intentContext"] == intent


def test_first_turn_does_not_pay_for_history_resolution():
    planner = IntentPlanner(None, portal_plan_for("/licensing"))
    assert run_reader(Gateway(), planner).result.status == "success"
    assert planner.intent_calls == []


def test_literal_completed_followup_bypasses_unavailable_model_intent_resolution():
    history = {"previousIntent": {
        "question": "Show application tasks in To Do", "businessObject": "application tasks",
        "view": "To Do", "page": "/licensing/applications", "answerShape": "list",
    }}
    completed_intent = resolution("refine", businessObject=slot("application tasks", source="previous"),
                                  view=slot("Completed"), answerShape=slot("list", source="previous"))
    observation = {"readHealth": {"healthy": True}, "tabControls": [
        {"name": "To Do", "selected": True}, {"name": "Completed", "selected": False},
    ], "sectionSummaries": [{"nodeId": "tasks", "kind": "table", "selectedState": "To Do",
                               "columnHeaders": ["Application No.", "Status"],
                               "rowFields": [{"Application No.": "APP-1", "Status": "Pending"}],
                               "rowSummaries": ["APP-1 Pending"]}]}
    planner = IntentPlanner(completed_intent, portal_plan_for("/licensing/applications", [{"type": "observe"}]))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing/applications")},
                      portal_result={"ok": True, "result": {"result": "success", "observation": observation}})
    run_reader(gateway, planner, question="How about the completed application tasks?", conversation_context=history)
    assert planner.intent_calls == []


def test_literal_record_field_followup_keeps_verified_identity_without_model_resolution():
    history = {"previousIntent": {
        "question": "View details for license LIC-100", "businessObject": "license",
        "recordIdentity": "LIC-100", "page": "/licensing/license/details", "answerShape": "detail",
    }}
    planner = IntentPlanner(None, portal_plan_for("/licensing/license/details"))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing/license/details")})
    runnym = "What are the issuance, effective date, expiration date, and remaining days?"
    run_reader(gateway, planner, question=runnym, conversation_context=history)
    assert planner.intent_calls == []
    assert planner.contexts[0]["resolvedIntent"]["slots"]["recordIdentity"]["value"] == "LIC-100"


@pytest.mark.parametrize("destination", ["/work/overview", "/work/review"])
def test_attention_to_list_keeps_focus_and_candidate_source_without_requiring_that_route(destination):
    history = {"previousIntent": {
        "question": "What needs review?", "answerShape": "attention", "resultStatus": "success",
        "page": "/work/overview", "section": "Needs Review",
    }}
    candidate = resolution("refine", answerShape=slot("list"))
    planner = IntentPlanner(candidate, portal_plan_for(destination))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/work/overview", "/work/review")},
                      portal_result={"ok": True, "result": {
                          "result": "success", "page": destination, "section": "Needs Review",
                          "answerShape": "list", "facts": ["Task No. T-100 Waiting for review"],
                      }})
    outcome = run_reader(gateway, planner, question="show me the list", conversation_context=history)
    context = planner.contexts[0]
    assert gateway.events[:3] == ["GetUserInfo", "knowledge.search", "admin.portal.read"]
    assert context["resolvedIntent"]["slots"]["businessFocus"]["value"] == "Needs Review"
    assert context["sourceHint"] == {"page": "/work/overview", "section": "Needs Review"}
    assert "Needs Review" in gateway.calls[0][1]["query"]
    assert "/work/overview" in gateway.calls[0][1]["query"]
    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "list"
    assert outcome.result.public_json()["sourceHint"] == context["sourceHint"]


def test_source_hint_cannot_authorize_an_unpermitted_page():
    history = {"previousIntent": {"businessFocus": "Needs Review", "answerShape": "attention",
                                   "sourceHint": {"page": "/restricted", "section": "Needs Review"}}}
    candidate = resolution("refine", answerShape=slot("list"))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/work")})
    outcome = run_reader(gateway, IntentPlanner(candidate, portal_plan_for("/restricted")),
                         question="show me the list", conversation_context=history)
    assert outcome.result.status == "no_permission"
    assert "admin.portal.read" not in gateway.events


def test_attention_counts_do_not_pass_as_a_followup_list():
    history = {"previousIntent": {"businessFocus": "Needs Review", "answerShape": "attention"}}
    candidate = resolution("refine", answerShape=slot("list"))
    gateway = Gateway(portal_result={"ok": True, "result": {
        "result": "success", "answerShape": "attention", "facts": ["Needs Review 4"],
    }})
    outcome = run_reader(gateway, IntentPlanner(candidate, portal_plan_for("/licensing")),
                         question="show me the list", conversation_context=history)
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == ("Needs Review 4",)
    assert outcome.result.answer_shape == "attention"
    assert "answer_intent_mismatch" in outcome.result.missing


def test_refinement_inherits_only_needed_business_object():
    intent = resolution("refine", businessObject=slot("appeals", source="previous"), view=slot("Completed"),
                        recordIdentity={"source": "clear", "value": "", "evidence": "Completed"})
    planner = IntentPlanner(intent, portal_plan_for("/happiness/appeals"))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/happiness/appeals")})
    run_reader(gateway, planner, question="Completed?", conversation_context=HISTORY)
    query = gateway.calls[0][1]["query"]
    assert "appeals" in query and "Completed" in query
    assert "REF-41" not in query and "To Do" not in query


def test_ambiguous_scope_stops_before_retrieval_and_preserves_clarification():
    intent = resolution("clarify", answerShape=slot("attention"))
    intent["clarificationOptions"] = ["the previous appeals", "all your tasks"]
    planner = IntentPlanner(intent)
    gateway = Gateway()
    outcome = run_reader(gateway, planner, question="What tasks need attention?", conversation_context=HISTORY)
    assert gateway.events == ["GetUserInfo"]
    assert planner.calls == []
    assert outcome.result.missing == ("intent_ambiguous",)
    assert outcome.result.public_json()["clarificationOptions"] == intent["clarificationOptions"]
    assert outcome.audit_evidence["result"] == outcome.result.public_json()


def test_selected_ordinal_passes_actual_options_but_not_old_page_to_planning():
    pending = resolution("clarify", answerShape=slot("attention"))
    pending["clarificationOptions"] = ["the previous appeals", "tasks across categories"]
    history = {"previousIntent": {"question": "What tasks need attention?", "intentContext": pending,
                                   "page": "/happiness/appeals", "recordIdentity": "REF-41"}}
    selected = resolution("broaden", businessObject=slot("tasks", "The second option"),
                          answerShape=slot("attention", source="previous"))
    planner = IntentPlanner(selected, portal_plan_for("/licensing"))
    run_reader(Gateway(), planner, question="The second option", conversation_context=history)
    assert planner.contexts[0]["resolvedChoiceOptions"] == pending["clarificationOptions"]
    assert "previousIntent" not in planner.contexts[0]
    assert "/happiness/appeals" not in str(planner.contexts[0])
    assert "REF-41" not in str(planner.contexts[0])


def test_invalid_resolution_never_reverts_to_inherit_everything():
    gateway = Gateway()
    outcome = run_reader(gateway, IntentPlanner({"relation": "continue"}),
                         question="What next?", conversation_context=HISTORY)
    assert outcome.result.missing == ("intent_resolution_invalid",)
    assert gateway.calls == []


def test_resolution_timeout_is_bounded_and_does_not_read_pages():
    class SlowPlanner(IntentPlanner):
        async def resolve_admin_portal_intent(self, question, context):
            await asyncio.sleep(1)

    gateway = Gateway()
    outcome = run_reader(gateway, SlowPlanner(None), question="What next?", conversation_context=HISTORY,
                         timeout_budget=ReaderTimeoutBudget(planner_seconds=0.01))
    assert outcome.result.missing == ("intent_resolution_timeout",)
    assert gateway.calls == []


def test_requested_global_scope_does_not_grant_page_permission():
    intent = resolution("switch", businessObject=slot("tasks"), requestedScope=slot("global", "all"))
    gateway = Gateway(info={"ok": True, "result": user_info_for_paths("/licensing")})
    outcome = run_reader(gateway, IntentPlanner(intent, portal_plan_for("/finance")),
                         question="Show all tasks", conversation_context=HISTORY)
    assert outcome.result.status == "no_permission"
    assert "admin.portal.read" not in gateway.events


def test_completed_followup_cannot_be_answered_only_from_a_manual_definition():
    fact = "Completed cases remain available in the Completed queue."
    intent = resolution("refine", businessObject=slot("appeals", source="previous"),
                        view=slot("Completed"), answerShape=slot("list", source="previous"))
    candidate = {"mode": "knowledge_only", "result": "success", "facts": [fact], "answerShape": "list"}
    planner = IntentPlanner(intent, candidate, portal_plan_for("/licensing"))
    gateway = Gateway(knowledge_result={"ok": True, "result": {"chunks": [{"chunk": {"content": fact}}]}})
    run_reader(gateway, planner, question="Completed?", conversation_context=HISTORY)
    assert "admin.portal.read" in gateway.events
    assert planner.calls[1][2]["planningDirective"]["requirePortalRead"] is True


def test_attention_fallback_cannot_relabel_an_ordinary_completed_list():
    intent = resolution("continue", businessObject=slot("appeals", source="previous"),
                        answerShape=slot("attention"))
    planner = IntentPlanner(intent, portal_plan_for("/licensing", [{"type": "observe", "section": "Records"}]))
    gateway = Gateway(portal_result={"ok": True, "result": {
        "result": "success", "observation": {"sectionSummaries": [{
            "heading": "Records", "rowSummaries": ["REF-1 Closed"], "selectedState": "Completed",
        }]},
    }})
    outcome = run_reader(gateway, planner, question="Which of these need attention?", conversation_context=HISTORY)
    assert outcome.result.status == "not_confirmed"
    assert not outcome.result.facts


@pytest.mark.parametrize("question,evidence", [
    ("What does this status mean?", "mean"),
    ("How do I filter by date?", "How do I"),
    ("Explain the documented workflow", "Explain"),
])
def test_conceptual_followup_still_accepts_grounded_manual_evidence(question, evidence):
    fact = "Use the date filter to select a date range."
    intent = resolution("refine", answerShape=slot("detail", evidence),
                        recordIdentity={"source": "clear", "value": "", "evidence": evidence})
    planner = IntentPlanner(intent, {"mode": "knowledge_only", "result": "success",
                                    "answerShape": "detail", "facts": [fact]})
    gateway = Gateway(knowledge_result={"ok": True, "result": {"chunks": [{"chunk": {"content": fact}}]}})
    outcome = run_reader(gateway, planner, question=question, conversation_context=HISTORY)
    assert outcome.result.status == "success"
    assert gateway.events == ["GetUserInfo", "knowledge.search"]


def test_mismatched_gateway_result_cannot_pass_or_leave_a_success_audit():
    intent = resolution(businessObject=slot("tasks"), answerShape=slot("attention"))
    gateway = Gateway(portal_result={"ok": True, "result": {
        "result": "success", "answerShape": "list", "facts": ["A pending record"],
    }})
    outcome = run_reader(gateway, IntentPlanner(intent, portal_plan_for("/licensing")),
                         question="What tasks need attention?", conversation_context=HISTORY)
    assert outcome.result.status == "not_confirmed"
    assert outcome.result.missing == ("answer_intent_mismatch",)
    assert outcome.audit_evidence["result"]["result"] == "not_confirmed"


@pytest.mark.parametrize("repaired_shape,expected_status", [("detail", "success"), ("list", "not_confirmed")])
def test_completion_review_has_one_retry_and_checks_final_shape(repaired_shape, expected_status):
    fact = "A task records the responsible reviewer."
    intent = resolution("refine", businessObject=slot("tasks"), answerShape=slot("detail"))
    candidate = {"mode": "knowledge_only", "result": "success", "facts": [fact], "answerShape": "list"}
    planner = IntentPlanner(intent, candidate, {**candidate, "answerShape": repaired_shape})
    gateway = Gateway(knowledge_result={"ok": True, "result": {"chunks": [{"chunk": {"content": fact}}]}})
    outcome = run_reader(gateway, planner, question="Explain tasks in detail from the manual", conversation_context=HISTORY)
    assert len(planner.calls) == 2
    directive = planner.calls[1][2]["planningDirective"]
    assert directive["intentCompletionReview"] is True
    assert directive["requestedAnswerShape"] == "detail"
    assert outcome.result.status == expected_status


def test_resolved_ordinal_with_candidate_facts_gets_one_completion_review():
    fact = "A task records the responsible reviewer."
    intent = resolution("continue", businessObject=slot("appeals", source="previous"),
                        answerShape=slot("detail", "detail"))
    candidate = {"mode": "knowledge_only", "result": "not_confirmed", "facts": [fact],
                 "missing": ["previous choices unavailable"], "answerShape": "detail"}
    planner = IntentPlanner(intent, candidate, {**candidate, "result": "success", "missing": []})
    gateway = Gateway(knowledge_result={"ok": True, "result": {"chunks": [{"chunk": {"content": fact}}]}})
    result = run_reader(gateway, planner, question="Explain that option in detail", conversation_context=HISTORY)
    assert result.result.status == "success"
    assert len(planner.calls) == 2
    assert planner.calls[1][2]["planningDirective"]["intentCompletionReview"] is True
