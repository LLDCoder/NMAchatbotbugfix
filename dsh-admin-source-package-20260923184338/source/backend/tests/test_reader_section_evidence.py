import pytest

from app.portal_reader import (
    ReaderResult,
    knowledge_search_query,
    observation_fallback_result,
    observation_result_from_plan,
    permission_context_from_user_info,
    reader_answer_shape,
)
from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info, user_info_for_paths


def structured_observation():
    return {
        "sectionSummaries": [
            {
                "heading": "Queue Overview",
                "columnHeaders": ["Category", "Count"],
                "rowSummaries": [],
                "emptyState": "No data",
            },
            {
                "heading": "Items Requiring Review",
                "columnHeaders": ["Reference", "Status"],
                "rowSummaries": ["REF-101 Pending Review"],
                "emptyState": "",
            },
        ]
    }


def test_observation_fact_must_come_from_the_planned_section() -> None:
    result = observation_result_from_plan(
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/work",
            "section": "Queue Overview",
            "answerShape": "overview",
            "facts": ["REF-101 Pending Review"],
            "missing": [],
        },
        structured_observation(),
    )

    assert result is None


def test_no_data_must_come_from_the_planned_section() -> None:
    wrong_section = observation_result_from_plan(
        {
            "mode": "observation_result",
            "result": "no_data",
            "page": "/work",
            "section": "Items Requiring Review",
            "answerShape": "list",
            "facts": [],
            "missing": [],
        },
        structured_observation(),
    )
    exact_section = observation_result_from_plan(
        {
            "mode": "observation_result",
            "result": "no_data",
            "page": "/work",
            "section": "Queue Overview",
            "answerShape": "overview",
            "facts": [],
            "missing": [],
        },
        structured_observation(),
    )

    assert wrong_section is None
    assert exact_section is not None
    assert exact_section.status == "no_data"
    assert exact_section.source_section == "Queue Overview"


def test_unhealthy_read_health_does_not_become_no_data() -> None:
    plan = {
        "mode": "observation_result", "result": "no_data", "page": "/work",
        "section": "Queue Overview", "answerShape": "overview", "facts": [], "missing": [],
    }
    observation = {
        **structured_observation(),
        "readHealth": {"healthy": False, "failed": ["/work"]},
    }

    assert observation_result_from_plan(plan, observation) is None


def test_section_scoped_observe_falls_back_only_after_semantic_planner_error() -> None:
    planner = Planner(portal_plan_for("/work", [{"type": "observe", "section": "Items Requiring Review"}]))
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {"result": "success", "observation": structured_observation()},
        },
    )

    outcome = run_reader(gateway, planner, question="Show my records")

    assert outcome.result.status == "success"
    assert outcome.result.facts == ("REF-101 Pending Review",)
    assert outcome.result.source_section == "Items Requiring Review"
    assert outcome.result.completeness == "bounded"
    assert outcome.audit_evidence["stage"] == "completed_from_observation_fallback"
    assert outcome.audit_evidence["semanticResolution"]["reason"] == "planner_error"
    assert len(planner.calls) == 2


def test_repeated_observe_without_unique_section_is_not_an_invalid_plan() -> None:
    planner = Planner(
        portal_plan_for("/work", [{"type": "observe"}]),
        portal_plan_for("/work", [{"type": "observe"}]),
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {"result": "success", "observation": structured_observation()},
        },
    )

    outcome = run_reader(gateway, planner, question="Show portal information")

    assert outcome.result.status == "not_confirmed"
    assert outcome.result.missing == ("repeated_observe_without_new_evidence",)
    assert "invalid_follow_up_plan" not in outcome.result.missing


@pytest.mark.parametrize("status", ["load_failed", "no_permission"])
def test_observation_preserves_terminal_reader_status(status: str) -> None:
    planner = Planner(portal_plan_for("/work", [{"type": "observe"}]))
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {"result": status, "observation": {"headings": ["Work"]}},
        },
    )

    outcome = run_reader(gateway, planner)

    assert outcome.result.status == status


def test_generic_answer_shape_is_added_to_retrieval_and_inherited_for_follow_up() -> None:
    context = permission_context_from_user_info(user_info())
    follow_up = {"previousIntent": {"answerShape": "list", "page": "/work", "section": "Items"}}

    assert "Requested answer shape: overview" in knowledge_search_query(
        "Show my licensing tasks overview", context
    )
    assert "Requested answer shape: overview" in knowledge_search_query(
        "Show me my tasks?", context
    )
    assert "Requested answer shape: attention" in knowledge_search_query(
        "What should I pay attention to?", context
    )
    assert reader_answer_shape("How about enquiries?", follow_up) == "list"
    assert "Requested answer shape: list" in knowledge_search_query(
        "How about enquiries?", context, follow_up
    )
    assert knowledge_search_query("How about enquiries?", context, follow_up).startswith(
        "Admin Portal work page user manual"
    )
    assert "Previous page is a candidate source, not a scope constraint" in knowledge_search_query(
        "How about enquiries?", context, follow_up
    )


def test_public_result_exposes_bounded_source_contract() -> None:
    payload = ReaderResult(
        status="success",
        summary="Found.",
        page="/work",
        section="Items",
        source_section="Items",
        answer_shape="list",
        completeness="bounded",
        selected_state="Open tab",
        facts=("REF-101",),
    ).public_json()

    assert payload["sourceSection"] == "Items"
    assert payload["answerShape"] == "list"
    assert payload["completeness"] == "bounded"
    assert payload["selectedState"] == "Open tab"


def test_count_requires_an_explicit_total_in_the_same_section() -> None:
    with_total = {
        "sectionSummaries": [{
            "heading": "Assigned Work",
            "rowSummaries": ["REF-101 Pending Review"],
        }],
        "regionSummaries": [{
            "heading": "Assigned Work",
            "summaries": ["Total 17"],
        }],
    }
    without_total = {
        "sectionSummaries": [{
            "heading": "Assigned Work",
            "rowSummaries": ["REF-101 Pending Review", "REF-102 Pending Review"],
        }],
    }
    success_plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/work",
        "section": "Assigned Work",
        "answerShape": "count",
        "facts": ["Total 17"],
        "missing": [],
    }

    success = observation_result_from_plan(success_plan, with_total)
    unsupported = observation_result_from_plan(success_plan, without_total)

    assert success is not None
    assert success.facts == ("Total 17",)
    assert "REF-101" not in " ".join(success.facts)
    assert unsupported is None


def test_overview_fallback_cannot_use_list_or_attention_rows() -> None:
    observation = {
        "regionSummaries": [{
            "heading": "Work Overview",
            "controls": ["Open 8", "Closed 3"],
        }],
        "sectionSummaries": [{
            "heading": "Items Requiring Review",
            "rowSummaries": ["REF-101 Pending Review"],
        }],
    }

    overview = observation_fallback_result(
        "Show my dashboard overview",
        observation,
        page="/work",
        section="Work Overview",
    )
    wrong_section = observation_fallback_result(
        "Show my dashboard overview",
        observation,
        page="/work",
        section="Items Requiring Review",
    )

    assert overview is not None
    assert overview.facts == ("Open 8", "Closed 3")
    assert "REF-101" not in overview.facts
    assert wrong_section is None


def test_overview_fallback_prefers_category_counts_over_task_cards() -> None:
    observation = {
        "regionSummaries": [{
            "heading": "My Work",
            "controls": [
                "Applications 14",
                "Reviews 2",
                "REF-101 Pending Review 2d Overdue Service Name Assignee",
            ],
        }],
    }

    overview = observation_fallback_result(
        "Show me my tasks",
        observation,
        page="/work",
        section="My Work",
        answer_shape="overview",
    )

    assert overview is not None
    assert overview.facts == ("Applications 14", "Reviews 2")


def test_category_overview_returns_only_the_matching_category_count() -> None:
    observation = {
        "regionSummaries": [{
            "heading": "My Work",
            "controls": [
                "Applications 14",
                "Enquiries & Complaints 2",
                "Refunds 3",
                "REF-101 Pending Review 2d Overdue Service Name Assignee",
            ],
        }],
    }

    overview = observation_fallback_result(
        "How about enquiries tasks?",
        observation,
        page="/work",
        section="My Work",
        answer_shape="overview",
    )

    assert overview is not None
    assert overview.facts == ("Enquiries & Complaints 2",)


def test_unscoped_observe_infers_count_section_from_expected_fields() -> None:
    plan = portal_plan_for("/work", [{"type": "observe"}])
    plan["portalRequest"]["expectedFields"] = [
        "My Work",
        "Items Requiring Review",
        "work item count",
    ]
    planner = Planner(
        plan,
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/work",
            "section": "My Work",
            "answerShape": "count",
            "facts": ["Applications 14", "Reviews 2"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {
                "result": "success",
                "observation": {
                    "regionSummaries": [
                        {
                            "heading": "My Work",
                            "controls": ["Applications 14", "Reviews 2", "Pending Review Due in 1d Record"],
                        },
                        {"heading": "Items Requiring Review", "controls": ["All 3"]},
                    ]
                },
            },
        },
    )

    outcome = run_reader(gateway, planner, question="How many work items do I have?")

    assert outcome.result.status == "success"
    assert outcome.result.source_section == "My Work"
    assert outcome.result.answer_shape == "count"
    assert outcome.result.facts == ("Applications 14", "Reviews 2")
    assert len(planner.calls) == 2


def test_unscoped_observe_infers_attention_section_without_using_overview_counts() -> None:
    plan = portal_plan_for("/work", [{"type": "observe"}])
    plan["portalRequest"]["expectedFields"] = ["Items Requiring Review rows"]
    planner = Planner(plan)
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {
                "result": "success",
                "observation": {
                    "regionSummaries": [{"heading": "My Work", "controls": ["Applications 14"]}],
                    "sectionSummaries": [{
                        "heading": "Items Requiring Review",
                        "rowSummaries": ["REF-101 Pending Review"],
                    }],
                },
            },
        },
    )

    outcome = run_reader(gateway, planner, question="What requires my attention?")

    assert outcome.result.status == "success"
    assert outcome.result.source_section == "Items Requiring Review"
    assert outcome.result.answer_shape == "attention"
    assert outcome.result.facts == ("REF-101 Pending Review",)
    assert "Applications 14" not in outcome.result.facts


def test_due_soon_observation_excludes_overdue_items() -> None:
    plan = portal_plan_for("/work", [{"type": "observe"}])
    plan["portalRequest"]["expectedFields"] = ["My Work task cards with due dates"]
    planner = Planner(plan)
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {
                "result": "success",
                "observation": {
                    "regionSummaries": [{
                        "heading": "My Work",
                        "controls": [
                            "Pending Review 2d Overdue Record A",
                            "Pending Review Due in 1d Record B",
                        ],
                    }],
                },
            },
        },
    )

    outcome = run_reader(gateway, planner, question="Are any work items due soon?")

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "due"
    assert outcome.result.facts == ("Pending Review Due in 1d Record B",)


def test_repeated_observe_due_soon_excludes_overdue_items() -> None:
    planner = Planner(
        portal_plan_for("/work", [{"type": "observe"}]),
        portal_plan_for("/work", [{"type": "observe"}]),
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {
                "result": "success",
                "observation": {
                    "rowSummaries": [
                        "Pending Review 2d Overdue Record A",
                        "Pending Review Due in 1d Record B",
                    ],
                },
            },
        },
    )

    outcome = run_reader(
        gateway,
        planner,
        question="现在有即将到期的 application tasks 么",
    )

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "due"
    assert outcome.result.facts == ("Pending Review Due in 1d Record B",)


def test_headingless_single_list_is_semantically_resolved_as_due_soon() -> None:
    planner = Planner(
        portal_plan_for("/work", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/work",
            "answerShape": "due",
            "facts": ["Pending Review Due in 1d Record B"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {
                "result": "not_confirmed",
                "observation": {
                    "rowSummaries": [
                        "Pending Review 2d Overdue Record A",
                        "Pending Review Due in 1d Record B",
                    ],
                    "sectionSummaries": [{
                        "heading": "",
                        "rowSummaries": [
                            "Pending Review 2d Overdue Record A",
                            "Pending Review Due in 1d Record B",
                        ],
                    }],
                },
            },
        },
    )

    outcome = run_reader(
        gateway,
        planner,
        question="现在有即将到期的 application tasks 么",
    )

    assert outcome.result.status == "success"
    assert outcome.result.facts == ("Pending Review Due in 1d Record B",)
    assert outcome.audit_evidence["stage"] == "completed_after_observe"
    assert len(planner.calls) == 2


def test_due_section_is_inferred_from_unique_due_evidence_for_non_latin_question() -> None:
    plan = portal_plan_for("/work", [{"type": "observe"}])
    plan["portalRequest"]["expectedFields"] = ["task cards"]
    planner = Planner(plan)
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {
                "result": "success",
                "observation": {
                    "regionSummaries": [
                        {"heading": "Summary", "controls": ["Applications 14"]},
                        {
                            "heading": "My Work",
                            "controls": [
                                "Pending Review 2d Overdue Record A",
                                "Pending Review Due in 1d Record B",
                            ],
                        },
                    ],
                },
            },
        },
    )

    outcome = run_reader(gateway, planner, question="现在有即将到期的 application tasks 么")

    assert outcome.result.status == "success"
    assert outcome.result.source_section == "My Work"
    assert outcome.result.facts == ("Pending Review Due in 1d Record B",)


def test_category_list_switches_tab_and_uses_verified_post_action_observation() -> None:
    initial_plan = portal_plan_for("/work", [{"type": "observe"}])
    initial_plan["portalRequest"]["expectedFields"] = ["My Work"]
    switch_plan = portal_plan_for(
        "/work",
        [{
            "type": "switch_tab",
            "role": "tab",
            "name": "Enquiries & Complaints 2",
            "section": "My Work",
        }],
    )
    switch_plan["portalRequest"]["expectedFields"] = []
    invalid_switch_plan = {
        "mode": "portal_read",
        "portalRequest": {
            "startPath": "/work",
            "actions": [
                {"type": "navigate", "role": "My Work", "section": "My Work"},
                {"type": "observe", "role": "My Work"},
            ],
            "expectedFields": ["task cards"],
        },
    }
    post_action_result = {
        "mode": "observation_result",
        "result": "success",
        "page": "/work",
        "section": "Task List",
        "sourceSection": "observation-table-001",
        "answerShape": "list",
        "selectedState": "Enquiries & Complaints 2",
        "facts": ["ENQ-202 Open Enquiry Service"],
        "missing": [],
    }
    planner = Planner(initial_plan, invalid_switch_plan, switch_plan, post_action_result)

    class SequentialGateway(Gateway):
        def __init__(self):
            super().__init__(info={"ok": True, "result": user_info_for_paths("/work")})
            self.portal_results = [
                {
                    "ok": True,
                    "result": {
                        "result": "not_confirmed",
                            "observation": {
                                "regionSummaries": [{
                                    "nodeId": "observation-region-001",
                                    "kind": "region",
                                    "heading": "My Work",
                                "selectedState": "Applications 14",
                                "controls": [
                                    "Applications 14",
                                    "Enquiries & Complaints 2",
                                    "REF-101 Pending Review Application Service",
                                ],
                            }],
                        },
                    },
                },
                {
                    "ok": True,
                    "result": {
                        "result": "not_confirmed",
                            "observation": {
                                "regionSummaries": [{
                                    "nodeId": "observation-region-001",
                                    "kind": "region",
                                    "heading": "My Work",
                                "selectedState": "Enquiries & Complaints 2",
                                "controls": [
                                    "Applications 14",
                                    "Enquiries & Complaints 2",
                                    ],
                                }],
                                "sectionSummaries": [{
                                    "nodeId": "observation-table-001",
                                    "kind": "table",
                                    "parentRef": "observation-region-001",
                                    "heading": "Task List",
                                    "rowSummaries": ["ENQ-202 Open Enquiry Service"],
                                }],
                        },
                    },
                },
            ]

        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "knowledge.search":
                return await super().invoke(
                    current_principal,
                    tool_name,
                    arguments,
                    allowed_tools=allowed_tools,
                )
            self.events.append(tool_name)
            self.calls.append((tool_name, arguments, allowed_tools))
            return self.portal_results.pop(0)

    outcome = run_reader(
        SequentialGateway(),
        planner,
        question="Show me the enquiries tasks list",
    )

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "list"
    assert outcome.result.selected_state == "Enquiries & Complaints 2"
    assert outcome.result.facts == ("ENQ-202 Open Enquiry Service",)
    assert outcome.audit_evidence["stage"] == "completed_after_read_state_change"
    assert outcome.audit_evidence["semanticResolution"]["decision"] == "llm_result"


def test_single_observed_list_with_explicit_empty_state_returns_no_data() -> None:
    plan = portal_plan_for("/records", [{"type": "observe"}])
    plan["portalRequest"]["expectedFields"] = ["records"]
    planner = Planner(plan)
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/records")},
        portal_result={
            "ok": True,
            "result": {
                "result": "not_confirmed",
                "observation": {
                    "columnHeaders": ["Record No.", "Status"],
                    "rowSummaries": [],
                    "sectionSummaries": [{
                        "heading": "",
                        "columnHeaders": ["Record No.", "Status"],
                        "rowSummaries": [],
                        "emptyState": "No Data",
                    }],
                },
            },
        },
    )

    outcome = run_reader(gateway, planner, question="Show me the records list")

    assert outcome.result.status == "no_data"
    assert outcome.result.answer_shape == "list"
    assert outcome.result.facts == ()


def test_final_alignment_preserves_verified_tool_rows_for_semantic_answering() -> None:
    planner = Planner(portal_plan_for(
        "/work",
        [{"type": "query", "field": "Task cards"}],
    ))
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={
            "ok": True,
            "result": {
                "result": "success",
                "page": "/work",
                "facts": [
                    "REF-101 Pending Review Due in 1d",
                    "REF-102 Pending Review 2d Overdue",
                ],
            },
        },
    )

    outcome = run_reader(
        gateway,
        planner,
        question="现在有即将到期的 application tasks 么",
    )

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "due"
    assert outcome.result.facts == (
        "REF-101 Pending Review Due in 1d",
        "REF-102 Pending Review 2d Overdue",
    )


def test_stale_read_control_falls_back_to_bounded_observation() -> None:
    planner = Planner(
        portal_plan_for(
            "/work",
            [
                {"type": "switch_tab", "role": "tab", "name": "To Do"},
                {"type": "filter", "field": "SLA", "value": "Due in 1"},
            ],
        ),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/work",
            "answerShape": "due",
            "facts": ["REF-101 Pending Review Due in 1d"],
            "missing": [],
        },
    )

    class SequentialGateway(Gateway):
        def __init__(self):
            super().__init__(info={"ok": True, "result": user_info_for_paths("/work")})
            self.portal_results = [
                {
                    "ok": True,
                    "result": {
                        "status": "load_failed",
                        "limitations": ["reader_selector_not_found"],
                    },
                },
                {
                    "ok": True,
                    "result": {
                        "status": "not_confirmed",
                        "observation": {
                            "rowSummaries": [
                                "REF-101 Pending Review Due in 1d",
                                "REF-102 Pending Review 2d Overdue",
                            ],
                        },
                    },
                },
            ]

        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "knowledge.search":
                return await super().invoke(
                    current_principal,
                    tool_name,
                    arguments,
                    allowed_tools=allowed_tools,
                )
            self.events.append(tool_name)
            self.calls.append((tool_name, arguments, allowed_tools))
            return self.portal_results.pop(0)

    outcome = run_reader(
        SequentialGateway(),
        planner,
        question="现在有即将到期的 application tasks 么",
    )

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "due"
    assert outcome.result.facts == ("REF-101 Pending Review Due in 1d",)
    assert outcome.audit_evidence["stage"] == "completed_from_control_failure_observation"
    assert outcome.audit_evidence["semanticResolution"]["decision"] == "llm_result"


def test_observation_not_confirmed_replans_required_live_destination_read() -> None:
    initial_plan = portal_plan_for("/dashboard", [{"type": "observe"}])
    not_confirmed = {
        "mode": "observation_result",
        "result": "not_confirmed",
        "page": "",
        "section": "",
        "facts": [],
        "missing": ["A current read of /work/items is required."],
    }
    destination_plan = portal_plan_for(
        "/work/items",
        [{"type": "query", "field": "Task rows"}],
    )
    planner = Planner(initial_plan, not_confirmed, destination_plan)

    class SequentialGateway(Gateway):
        def __init__(self):
            super().__init__(info={"ok": True, "result": user_info_for_paths("/dashboard", "/work/items")})
            self.portal_results = [
                {
                    "ok": True,
                    "result": {
                        "status": "not_confirmed",
                        "observation": {
                            "regionSummaries": [{
                                "heading": "My Work",
                                "controls": ["Applications 2"],
                            }],
                        },
                    },
                },
                {
                    "ok": True,
                    "result": {
                        "status": "success",
                        "page": "/work/items",
                        "facts": ["REF-101 Pending Review"],
                    },
                },
            ]

        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "knowledge.search":
                return await super().invoke(
                    current_principal,
                    tool_name,
                    arguments,
                    allowed_tools=allowed_tools,
                )
            self.events.append(tool_name)
            self.calls.append((tool_name, arguments, allowed_tools))
            return self.portal_results.pop(0)

    outcome = run_reader(
        SequentialGateway(),
        planner,
        question="Show me the application tasks list",
    )

    assert outcome.result.status == "success"
    assert outcome.result.page == "/work/items"
    assert outcome.result.answer_shape == "list"
    assert outcome.result.facts == ("REF-101 Pending Review",)
    assert len(planner.calls) == 3
