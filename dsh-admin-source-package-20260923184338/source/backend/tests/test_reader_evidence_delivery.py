import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.portal_reader import AdminPortalReader, _observation_evidence_for_section
from app.principal import Principal
from app.service import DSHService, _format_remaining_minutes, reader_evidence_only_response, reader_natural_answer_is_grounded


PAGE = "/workspace"


def _candidate(
    name: str,
    *,
    trigger: str = "initial",
    policy: str = "allowed",
    response=None,
    response_truncated: bool = False,
) -> dict:
    candidate = {
        "operationKey": f"GET /api/records/{name}",
        "candidateKind": "business",
        "method": "GET",
        "pathTemplate": f"/api/records/{name}",
        "status": 200,
        "policyState": policy,
        "trigger": trigger,
        "triggers": [trigger],
        "swagger": {
            "operationId": f"read-{name}",
            "summary": "Read the records shown by the current view",
            "responseFields": ["items", "total"],
        },
    }
    if response is not None:
        candidate["responseEvidence"] = response
        candidate["responseEvidenceTruncated"] = response_truncated
    return candidate


def _observation(
    candidates=(),
    *,
    delta_candidates=(),
    selected_state="",
    rows=(),
    controls=(),
) -> dict:
    result = {
        "readHealth": {"healthy": True, "blocked": [], "failed": [], "pending": []},
        "apiDiscovery": {
            "candidates": list(candidates),
            "candidateCount": len(candidates),
            "truncated": False,
            "selectableBusinessTruncated": False,
            "selectableSupportTruncated": False,
            "deltaCandidates": list(delta_candidates),
            "deltaCandidateCount": len(delta_candidates),
            "deltaTruncated": False,
            "deltaSelectableBusinessTruncated": False,
            "deltaSelectableSupportTruncated": False,
            "safeControls": [],
        },
    }
    if selected_state or rows or controls:
        row_fields = [dict(row) for row in rows]
        result["sectionSummaries"] = [{
            "nodeId": "records-table",
            "kind": "table",
            "heading": "Records",
            "selectedState": selected_state,
            "controls": list(controls),
            "columnHeaders": list(row_fields[0]) if row_fields else ["Record", "State"],
            "rowFields": row_fields,
            "rowSummaries": ["; ".join(f"{key}: {value}" for key, value in row.items()) for row in row_fields],
        }]
    return result


def _read_plan(*actions: dict) -> dict:
    return {
        "mode": "portal_read",
        "portalRequest": {
            "startPath": PAGE,
            "actions": list(actions) or [{"type": "observe"}],
            "expectedFields": [],
        },
    }


class _Planner:
    def __init__(self, *plans: dict):
        self.plans = list(plans)
        self.calls = []

    async def plan_admin_portal_read(
        self, question, permission_context, knowledge_context, conversation_context=None,
    ):
        self.calls.append(knowledge_context)
        return self.plans.pop(0)


class _Gateway:
    def __init__(self, *observations: dict):
        self.observations = list(observations)
        self.portal_payloads = []

    async def get_user_info(self, principal):
        return {
            "ok": True,
            "result": {"data": {
                "id": principal.user_id,
                "rolesInfo": [{"roleName": "Reader"}],
                "listSysPermission": [{
                    "frontendRoute": PAGE,
                    "children": [],
                    "buttonList": [],
                }],
                "dataScope": {"scope": "personal"},
            }},
        }

    async def invoke(self, principal, tool_name, arguments, *, allowed_tools=None):
        if tool_name == "knowledge.search":
            return {"ok": True, "result": {"chunks": [{
                "content": "The Records view shows the signed-in user's current records.",
            }]}}
        self.portal_payloads.append(arguments)
        return {
            "ok": True,
            "result": {
                "result": "success",
                "facts": [],
                "observation": self.observations.pop(0),
            },
        }


def _run(planner: _Planner, gateway: _Gateway, question="Show my current records"):
    reader = AdminPortalReader(
        gateway,
        planner,
        portal_base_url="https://admin.example.test",
        knowledge_folder_id="kb",
    )
    principal = Principal(user_id="reader-1", tenant_id="tenant-1", request_id="request-1")
    return asyncio.run(reader.run(principal, question))


def _completed_action_observations(response: dict):
    initial_candidates = (_candidate("initial-a"), _candidate("initial-b"))
    initial = _observation(initial_candidates, selected_state="To Do", controls=("To Do", "Completed"))
    completed = _candidate(
        "completed",
        trigger="action:1:switch_tab",
        response=response,
    )
    after_action = _observation(
        (*initial_candidates, completed),
        delta_candidates=(completed,),
        selected_state="Completed",
    )
    return initial, after_action, completed


def test_unique_page_generated_delta_survives_non_closed_answer_json() -> None:
    response = {"data": {"items": [{"recordNo": "REC-571", "state": "Completed"}], "total": 571}}
    initial, after_action, completed = _completed_action_observations(response)
    planner = _Planner(
        _read_plan({"type": "switch_tab", "role": "tab", "name": "Completed"}),
        {
            "status": "ok",
            "data": {
                "total": 571,
                "records": [{"recordNo": "REC-571", "state": "Completed"}],
            },
            "presentation": "compact",
        },
    )

    outcome = _run(planner, _Gateway(initial, after_action), "Show my completed records")

    assert outcome.result.status == "success"
    assert "REC-571" in " ".join(outcome.result.facts)
    assert "571" in " ".join(outcome.result.facts)
    assert outcome.audit_evidence["apiSelection"]["selectedOperationKey"] == completed["operationKey"]
    assert len(planner.calls) == 2


def test_selected_api_evidence_needs_no_duplicate_dom_business_facts() -> None:
    response = {"payload": {"items": [{"recordNo": "REC-7", "state": "Completed"}], "total": 1}}
    initial, after_action, _ = _completed_action_observations(response)
    assert not after_action["sectionSummaries"][0]["rowSummaries"]
    planner = _Planner(
        _read_plan({"type": "switch_tab", "role": "tab", "name": "Completed"}),
        {"status": "ok", "records": [{"recordNo": "REC-7", "state": "Completed"}]},
    )

    outcome = _run(planner, _Gateway(initial, after_action), "Show my completed records")

    assert outcome.result.status == "success"
    assert "REC-7" in " ".join(outcome.result.facts)


def test_ambiguous_api_evidence_does_not_become_success_without_exact_selection() -> None:
    first = _candidate("personal", response={"items": [{"recordNo": "REC-P"}]})
    second = _candidate("team", response={"items": [{"recordNo": "REC-T"}]})
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {"status": "ok", "records": [{"recordNo": "REC-P"}]},
    )

    outcome = _run(planner, _Gateway(_observation((first, second))))

    assert outcome.result.status == "not_confirmed"
    assert not outcome.result.facts
    assert "REC-P" not in json.dumps(outcome.result.public_json())


def test_selected_api_evidence_cannot_support_an_unrelated_business_fact() -> None:
    candidate = _candidate(
        "open",
        response={"items": [{"recordNo": "REC-OPEN", "state": "Open"}]},
    )
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": candidate["operationKey"],
            "reasonCodes": ["trigger_matches_intent"],
        },
        {
            "mode": "observation_result",
            "result": "success",
            "answerShape": "detail",
            "facts": ["REC-INVENTED is Completed"],
            "missing": [],
        },
    )

    outcome = _run(planner, _Gateway(_observation((candidate,))), "Show REC-INVENTED details")
    public = outcome.result.public_json()

    assert not (public["result"] == "success" and "REC-INVENTED" in json.dumps(public))


def test_truncated_api_evidence_cannot_claim_an_unsupported_total() -> None:
    candidate = _candidate(
        "partial",
        response={"items": [{"recordNo": "REC-1", "state": "Completed"}]},
        response_truncated=True,
    )
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": candidate["operationKey"],
            "reasonCodes": ["trigger_matches_intent"],
        },
        {
            "mode": "observation_result",
            "result": "success",
            "answerShape": "count",
            "completeness": "complete",
            "facts": ["Total records: 571"],
            "missing": [],
        },
    )

    outcome = _run(planner, _Gateway(_observation((candidate,))), "How many current records are there?")
    public = outcome.result.public_json()

    assert public["completeness"] == "bounded"
    assert not (public["result"] == "success" and "571" in json.dumps(public))


def test_api_discovery_failure_does_not_suppress_sufficient_unique_dom_evidence() -> None:
    blocked = _candidate("blocked", policy="blocked")
    observation = _observation(
        (blocked,),
        selected_state="Completed",
        rows=({"Record": "REC-9", "State": "Completed"},),
        controls=("To Do", "Completed"),
    )
    fact = json.dumps({"Record": "REC-9", "State": "Completed"})
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "observation_result",
            "result": "success",
            "page": PAGE,
            "section": "Records",
            "sourceSection": "records-table",
            "selectedState": "Completed",
            "answerShape": "list",
            "facts": [fact],
            "missing": [],
        },
    )

    outcome = _run(planner, _Gateway(observation), "Show my completed records")

    assert outcome.result.status == "success"
    assert outcome.result.facts == (fact,)


def test_truncated_api_candidates_without_safe_drill_do_not_suppress_unique_dom_evidence() -> None:
    observation = _observation(
        tuple(_candidate(f"candidate-{index}") for index in range(12)),
        rows=({"Record": "REC-12", "State": "Open"},),
    )
    observation["apiDiscovery"].update({
        "truncated": True,
        "selectableBusinessTruncated": True,
    })
    assert not observation["apiDiscovery"]["safeControls"]
    fact = json.dumps({"Record": "REC-12", "State": "Open"})
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "observation_result",
            "result": "success",
            "page": PAGE,
            "section": "Records",
            "sourceSection": "records-table",
            "answerShape": "list",
            "facts": [fact],
            "missing": [],
        },
    )

    outcome = _run(planner, _Gateway(observation), "Show my current records")

    assert outcome.result.status == "success"
    assert outcome.result.source_section == "records-table"
    assert outcome.result.facts == (fact,)
    assert outcome.audit_evidence["apiSelection"]["reason"] == "no_safe_api_drill_control"


def test_post_drill_api_ambiguity_does_not_suppress_unique_dom_evidence() -> None:
    safe_control = {
        "controlId": "tab-completed",
        "label": "Completed",
        "action": {"type": "switch_tab", "role": "tab", "name": "Completed"},
    }
    initial_candidates = tuple(_candidate(f"initial-{index}") for index in range(12))
    initial = _observation(initial_candidates)
    initial["apiDiscovery"].update({
        "truncated": True,
        "selectableBusinessTruncated": True,
        "safeControls": [safe_control],
    })
    delta_candidates = tuple(
        _candidate(f"delta-{index}", trigger="action:1:switch_tab")
        for index in range(12)
    )
    after_drill = _observation(
        delta_candidates,
        delta_candidates=delta_candidates,
        selected_state="Completed",
        rows=({"Record": "REC-DRILL", "State": "Completed"},),
    )
    after_drill["apiDiscovery"].update({
        "deltaTruncated": True,
        "deltaSelectableBusinessTruncated": True,
        "safeControls": [safe_control],
    })
    fact = json.dumps({"Record": "REC-DRILL", "State": "Completed"})
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_drill",
            "controlId": "tab-completed",
            "reasonCodes": ["reduce_candidate_set"],
        },
        {
            "mode": "observation_result",
            "result": "success",
            "page": PAGE,
            "section": "Records",
            "sourceSection": "records-table",
            "selectedState": "Completed",
            "answerShape": "list",
            "facts": [fact],
            "missing": [],
        },
    )

    outcome = _run(planner, _Gateway(initial, after_drill), "Show my completed records")

    assert outcome.result.status == "success"
    assert outcome.result.source_section == "records-table"
    assert outcome.result.facts == (fact,)
    assert outcome.audit_evidence["apiSelection"]["reason"] == "api_candidates_still_ambiguous"
    assert outcome.audit_evidence["apiSelection"]["drillDepth"] == 1


def test_invalid_api_selection_recovers_to_unique_dom_evidence() -> None:
    observation = _observation(
        (_candidate("first"), _candidate("second")),
        rows=({"Record": "REC-DOM", "State": "Open"},),
    )
    fact = json.dumps({"Record": "REC-DOM", "State": "Open"})
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": "GET /api/records/not-observed",
            "reasonCodes": ["trigger_matches_intent"],
        },
        {
            "mode": "observation_result",
            "result": "success",
            "page": PAGE,
            "section": "Records",
            "sourceSection": "records-table",
            "answerShape": "list",
            "facts": [fact],
            "missing": [],
        },
    )

    outcome = _run(planner, _Gateway(observation), "Show my current records")

    assert outcome.result.status == "success"
    assert outcome.result.source_section == "records-table"
    assert outcome.result.facts == (fact,)
    assert outcome.audit_evidence["apiSelection"]["reason"] == "invalid_api_selection"


def test_public_result_is_bounded_and_hides_api_protocol_and_raw_response() -> None:
    response = {
        "items": [{"recordNo": f"REC-{index}", "state": "Completed"} for index in range(35)],
        "accessToken": "response-secret",
        "rawResponse": "private-wire-payload",
    }
    candidate = _candidate("bounded", response=response)
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": candidate["operationKey"],
            "reasonCodes": ["trigger_matches_intent"],
        },
        {
            "status": "ok",
            "operationKey": candidate["operationKey"],
            "rawResponse": "private-wire-payload",
            "records": response["items"],
        },
    )

    outcome = _run(planner, _Gateway(_observation((candidate,))))
    public = outcome.result.public_json()
    serialized = json.dumps(public)

    assert outcome.result.status == "success"
    assert len(public["facts"]) <= 20
    assert len(serialized.encode("utf-8")) <= 12_000
    assert candidate["operationKey"] not in serialized
    assert "operationKey" not in serialized
    assert "private-wire-payload" not in serialized
    assert "response-secret" not in serialized


def test_successful_reader_facts_have_a_deterministic_service_response() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "answerShape": "detail",
            "facts": ["Record REC-8 is Completed."],
            "missing": ["unsupported free-form claim"],
        },
        "en",
    )

    assert response is not None
    assert "Record REC-8 is Completed." in response
    assert "unsupported free-form claim" not in response


def test_deterministic_service_response_renders_numeric_json_facts() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "answerShape": "count",
            "facts": [json.dumps({"total": 571})],
            "missing": [],
        },
        "en",
    )

    assert response is not None
    assert "total" in response.casefold()
    assert "571" in response
    assert "- Total: 571" in response
 
 
def test_service_omits_placeholder_identity_but_keeps_zero_business_metric() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "answerShape": "attention",
            "facts": [json.dumps({
                "totalCount": 7,
                "urgentCount": 0,
                "taskNo": "ML-1-8007-0457147",
                "taskId": 0,
            })],
            "missing": [],
        },
        "en",
    )
 
    assert "Total Count: 7" in response
    assert "Urgent Count: 0" in response
    assert "ML-1-8007-0457147" in response
    assert "Task Id" not in response


def test_service_formats_remaining_minutes_without_exposing_the_raw_value() -> None:
    assert _format_remaining_minutes(2166) == "about 1 day and 12 hours remaining"
    assert _format_remaining_minutes(-2880) == "overdue by about 2 days"

    response = reader_evidence_only_response(
        {
            "result": "success",
            "answerShape": "attention",
            "facts": [json.dumps({"taskNo": "MC-2-1001-7396175", "remainingMinutes": 2166})],
            "missing": [],
        },
        "en",
    )

    assert "Remaining time: about 1 day and 12 hours remaining" in response
    assert "2166" not in response
 
 
def test_natural_answer_guard_rejects_invented_numbers_and_identifiers() -> None:
    verified = "There are 7 tasks. Task ML-1-8007-0457147 is awaiting External Approval."
 
    assert reader_natural_answer_is_grounded(
        "There are 7 tasks, including ML-1-8007-0457147.",
        verified,
        "What should I prioritize?",
    )
    assert not reader_natural_answer_is_grounded(
        "There are 8 tasks, including ML-1-9999.",
        verified,
        "What should I prioritize?",
    )
 
 
def test_natural_reader_response_uses_model_for_concise_grounded_answer() -> None:
    class _AnswerLLM:
        async def stream(self, messages):
            assert "Do not use a 'Confirmed details' heading" in messages[0]["content"]
            assert "Do not turn a routine capability question into a list of restrictions" in messages[0]["content"]
            assert "Never expose raw minute values" in messages[0]["content"]
            assert "may need attention" in messages[0]["content"]
            assert "What should I prioritize?" in messages[1]["content"]
            yield "You have 7 tasks. None is marked urgent, so review the 5 awaiting External Approval first."
 
    service = object.__new__(DSHService)
    service.settings = SimpleNamespace(
        llm_base_url="https://llm.example.test",
        llm_api_key="test",
        system_prompt="",
    )
    service.llm = _AnswerLLM()
    evidence = {
        "result": "success",
        "answerShape": "attention",
        "facts": [json.dumps({
            "totalCount": 7,
            "urgentCount": 0,
            "tabCounts.ExternalApproval": 5,
            "tabCounts.PendingModification": 2,
            "taskId": 0,
        })],
        "missing": [],
    }
 
    response, formatting_failed, strategy = asyncio.run(service._natural_reader_response(
        "What should I prioritize?",
        evidence,
        "en",
    ))
 
    assert not formatting_failed
    assert strategy == "llm_organized"
    assert response.startswith("You have 7 tasks.")
    assert "Task Id" not in response
    assert "Confirmed details" not in response
 
 
def test_natural_reader_response_falls_back_when_model_invents_a_fact() -> None:
    class _AnswerLLM:
        async def stream(self, messages):
            yield "You have 8 tasks. Start with ML-1-9999."
 
    service = object.__new__(DSHService)
    service.settings = SimpleNamespace(
        llm_base_url="https://llm.example.test",
        llm_api_key="test",
        system_prompt="",
    )
    service.llm = _AnswerLLM()
    evidence = {
        "result": "success",
        "answerShape": "attention",
        "facts": [json.dumps({"totalCount": 7})],
        "missing": [],
    }
 
    response, formatting_failed, strategy = asyncio.run(service._natural_reader_response(
        "Which tasks should I review?",
        evidence,
        "en",
    ))
 
    assert formatting_failed
    assert strategy == "deterministic_formatting_fallback"
    assert "Total Count: 7" in response
    assert "8" not in response
    assert "ML-1-9999" not in response


def test_due_fallback_keeps_only_relevant_business_evidence() -> None:
    response = {
        "isSuccess": True,
        "statusCode": 200,
        "message": "Request successful",
        "data": {
            "taskTabCounts": {"ServiceApplication": 24, "Refunds": 1},
            "slaDistribution": {"overdue": 1, "upcomingDue": 0, "onTime": 0},
            "priorityCards": [{
                "applicationNumber": "APP-4809",
                "title": "License application",
                "sla": {
                    "displayText": "6d Overdue",
                    "remainingMinutes": 9150,
                    "deadline": None,
                },
                "availableActions": [{
                    "actionCode": "open",
                    "actionLabel": "Open",
                    "actionUrl": "applications/4809?taskId=private-id",
                }],
            }],
            "serviceApplicationCard": {
                "totalTasks": 24,
                "doneToday": 2,
                "overdueTasks": 3,
            },
            "profileVerificationCard": "[truncated]",
        },
    }
    candidate = _candidate("dashboard", response=response)
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": candidate["operationKey"],
            "reasonCodes": ["trigger_matches_intent"],
        },
        {"status": "ok", "answer": "not closed result JSON"},
    )

    outcome = _run(planner, _Gateway(_observation((candidate,))), "Do I have any overdue tasks?")
    rendered = " ".join(outcome.result.facts)

    assert outcome.result.status == "success"
    assert "overdueTasks" in rendered or "Overdue" in rendered
    assert "displayText" not in rendered
    assert '"overdue":1' not in rendered
    assert "[truncated]" not in rendered
    assert "isSuccess" not in rendered
    assert "actionUrl" not in rendered
    assert "taskTabCounts" not in rendered


def test_upcoming_due_list_requires_record_identity_and_excludes_overdue_summaries() -> None:
    response = {
        "isSuccess": True,
        "data": {
            "priorityCards": [
                {
                    "applicationNumber": "APP-LATE",
                    "title": "Already late",
                    "sla": {"displayText": "2d Overdue", "remainingMinutes": -2880},
                },
                {
                    "applicationNumber": "APP-DUE-1",
                    "title": "Renewal review",
                    "sla": {"displayText": "Due in 19h", "remainingMinutes": 1140},
                },
                {
                    "applicationNumber": "APP-DUE-2",
                    "title": "Permit review",
                    "sla": {"displayText": "Due in 3d", "remainingMinutes": 4320},
                },
            ],
            "serviceApplicationCard": {"overdueTasks": 11, "totalTasks": 109},
        },
    }
    candidate = _candidate("dashboard-upcoming", response=response)
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": candidate["operationKey"],
            "reasonCodes": ["trigger_matches_intent"],
        },
        {"status": "ok", "answer": "not closed result JSON"},
    )

    outcome = _run(
        planner,
        _Gateway(_observation((candidate,))),
        "Which work items are approaching their deadlines?",
    )
    rendered = " ".join(outcome.result.facts)

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "due"
    assert "APP-DUE-1" in rendered
    assert "APP-DUE-2" in rendered
    assert "Due in 19h" in rendered
    assert "APP-LATE" not in rendered
    assert "overdueTasks" not in rendered
                                                  
                                                  
def test_same_heading_dom_wrappers_are_one_evidence_source_when_state_is_compatible() -> None:
    observation = {
        "regionSummaries": [
            {
                "nodeId": "my-tasks-outer",
                "kind": "region",
                "heading": "My Tasks",
                "rowFields": [{"Task": "APP-DUE-1", "Time Alert": "Due in 19h"}],
                "rowSummaries": ["Task: APP-DUE-1; Time Alert: Due in 19h"],
            },
            {
                "nodeId": "my-tasks-inner",
                "parentRef": "my-tasks-outer",
                "kind": "region",
                "heading": "My Tasks",
                "rowSummaries": ["Task: APP-DUE-2; Time Alert: Due in 1d"],
            },
            {
                "nodeId": "my-tasks-list",
                "parentRef": "my-tasks-inner",
                "kind": "region",
                "heading": "My Tasks",
                "rowFields": [{"Task": "APP-DUE-3", "Time Alert": "Due in 3d"}],
                "rowSummaries": ["Task: APP-DUE-3; Time Alert: Due in 3d"],
            },
        ],
    }
                                                  
    evidence = _observation_evidence_for_section(observation, "My Tasks")
                                                  
    assert evidence is not None
    assert evidence["rowSummaries"] == [
        "Task: APP-DUE-1; Time Alert: Due in 19h",
        "Task: APP-DUE-2; Time Alert: Due in 1d",
        "Task: APP-DUE-3; Time Alert: Due in 3d",
    ]
    assert evidence["rowFields"] == [
        {"Task": "APP-DUE-1", "Time Alert": "Due in 19h"},
        {"Task": "APP-DUE-3", "Time Alert": "Due in 3d"},
    ]
    assert evidence["nodeRefs"] == [
        "my-tasks-outer",
        "my-tasks-inner",
        "my-tasks-list",
    ]
                                                  
                                                  
def test_same_heading_dom_wrappers_remain_ambiguous_when_state_conflicts() -> None:
    observation = {
        "regionSummaries": [
            {
                "nodeId": "my-tasks-todo",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "To Do",
                "rowSummaries": ["Task: APP-DUE-1; Time Alert: Due in 19h"],
            },
            {
                "nodeId": "my-tasks-completed",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Completed",
                "rowSummaries": ["Task: APP-DONE; Time Alert: Completed"],
            },
        ],
    }
                                                  
    assert _observation_evidence_for_section(observation, "My Tasks") is None
                                                  
                                                  
def test_question_field_tokens_prefer_the_matching_response() -> None:
    attention = _candidate("needs-attention", response={
        "data": {"items": [{
            "taskNo": "TASK-7",
            "timeAlert": "Waiting 6d",
            "waitingMinutes": 9000,
        }]},
    })
    summary = _candidate("dashboard-summary", response={
        "data": {
            "serviceApplicationCard": {
                "totalTasks": 24,
                "doneToday": 12,
                "overdueTasks": 11,
            },
        },
    })
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": summary["operationKey"],
            "reasonCodes": ["response_fields_match_answer"],
        },
        {"status": "ok", "answer": "not closed result JSON"},
    )

    outcome = _run(
        planner,
        _Gateway(_observation((attention, summary))),
        "Do I have any overdue tasks?",
    )
    rendered = " ".join(outcome.result.facts)

    assert outcome.result.status == "success"
    assert '"serviceApplicationCard.overdueTasks":11' in rendered
    assert "waitingMinutes" not in rendered
    assert outcome.audit_evidence["apiSelection"]["selectedOperationKey"] == summary["operationKey"]
    assert len(planner.calls) == 3
    response = reader_evidence_only_response(outcome.result.public_json(), "en")
    assert "Service Application: 11 overdue tasks" in response


def test_unique_count_response_does_not_require_model_api_selection() -> None:
    unrelated = _candidate("profile-list", response={
        "data": {"items": [{"profileCode": "P-1", "status": "Pending Review"}]},
    })
    count = _candidate("profile-type-count", response={
        "data": {
            "total": 35,
            "individualCount": 10,
            "commercialCount": 7,
        },
    })
    planner = _Planner(
        _read_plan({"type": "observe"}),
        {
            "mode": "api_selection",
            "operationKey": count["operationKey"],
            "reasonCodes": ["response_fields_match_answer"],
        },
        {"status": "ok", "answer": "not closed result JSON"},
    )

    outcome = _run(
        planner,
        _Gateway(_observation((unrelated, count))),
        "How many profile verification tasks do I have?",
    )

    assert outcome.result.status == "success"
    assert outcome.result.facts == ('{"total":35}',)
    assert outcome.audit_evidence["apiSelection"]["selectedOperationKey"] == count["operationKey"]
    assert len(planner.calls) == 3


def test_service_never_delivers_legacy_truncation_or_transport_facts() -> None:
    response = reader_evidence_only_response(
        {
            "result": "not_confirmed",
            "facts": [
                json.dumps({"isSuccess": True}),
                json.dumps({"serviceApplicationCard": "[truncated]"}),
                json.dumps({"overdueTasks": 3}),
            ],
            "missing": ["partial"],
        },
        "en",
    )

    assert "isSuccess" not in response
    assert "[truncated]" not in response
    assert "Overdue Tasks: 3" in response


def test_service_humanizes_structured_api_field_names() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "page": "/dashboard",
            "answerShape": "due",
            "facts": [
                json.dumps({"overdueTasks": 11, "totalTasks": 109}),
                json.dumps({"overdueTasks": 0, "totalTasks": 3}),
            ],
            "missing": [],
        },
        "en",
    )

    assert "11 overdue tasks" in response
    assert "Total Tasks" not in response
    assert response.startswith("**Deadline status:**\n\n")
    assert "null" not in response
def test_service_renders_dashboard_overview_as_category_counts() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "page": "/dashboard",
            "answerShape": "overview",
            "facts": [
                json.dumps({
                    "serviceApplicationCard.totalCount": 24,
                    "serviceApplicationCard.totalTasks": 107,
                    "serviceApplicationCard.departmentStats": None,
                }),
                json.dumps({
                    "taskTabCounts.ServiceApplication": 24,
                    "taskTabCounts.ProfileVerification": 0,
                    "taskTabCounts.Enquiries": 1,
                    "taskTabCounts.Refunds": 1,
                    "taskTabCounts.Appeals": 0,
                }),
            ],
            "missing": [],
        },
        "en",
    )
    assert response.startswith("**Overview:**\n\n")
    assert "Task Tab Counts Service Application: 24" in response
    assert "Profile Verification: 0" in response
    assert "Total Tasks" not in response
    assert "Department Stats" not in response
def test_service_groups_current_metrics_and_repeated_period_trends() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "page": "/performance",
            "answerShape": "overview",
            "facts": [
                json.dumps({
                    "slaPerformance.slaComplianceRate": 91.66,
                    "slaPerformance.slaBreachRate": 8.34,
                    "slaPerformance.avgProcessingTimeDays": 0.34,
                    "slaPerformance.totalCompleted": 1043,
                    "slaPerformance.slaCompliant": 956,
                    "slaPerformance.slaBreached": 87,
                }),
                json.dumps({
                    "slaPerformanceTrend.period": "08-2026",
                    "slaPerformanceTrend.slaComplianceRate": 95.15,
                    "slaPerformanceTrend.avgProcessingTimeDays": 0.08,
                }),
                json.dumps({
                    "slaPerformanceTrend.period": "07-2026",
                    "slaPerformanceTrend.slaComplianceRate": 94.27,
                    "slaPerformanceTrend.avgProcessingTimeDays": 0.2,
                }),
            ],
            "missing": [],
        },
        "en",
    )
    assert response.startswith("**Overview:**\n\n**Current metrics:**")
    assert "Sla Performance Sla Compliance Rate" not in response
    assert "- Sla Compliance Rate: 91.66" in response
    assert "**Trend:**" in response
    assert "- **08-2026** — Sla Compliance Rate: 95.15; Avg Processing Time Days: 0.08" in response
    assert "1. Sla Performance" not in response
def test_service_formats_iso_datetimes_without_changing_timezone() -> None:
    response = reader_evidence_only_response(
        {
            "result": "success",
            "page": "/performance",
            "answerShape": "overview",
            "facts": [
                json.dumps({
                    "startDate": "2026-09-02T00:00:00",
                    "endDate": "2026-09-08T23:59:59",
                    "generatedAt": "2026-09-09T01:59:32Z",
                    "reviewedAt": "2026-09-09T05:59:32+04:00",
                    "period": "08-2026",
                    "duration": "1.2h",
                }),
            ],
            "missing": [],
        },
        "en",
    )
    assert "Start Date: 2026-09-02 00:00:00" in response
    assert "End Date: 2026-09-08 23:59:59" in response
    assert "Generated At: 2026-09-09 01:59:32 UTC" in response
    assert "Reviewed At: 2026-09-09 05:59:32 +04:00" in response
    assert "Period: 08-2026" in response
    assert "Duration: 1.2h" in response
