import pytest

from test_admin_portal_reader import Gateway, Planner, portal_plan_for, run_reader, user_info_for_paths


def test_service_application_observation_uses_validated_llm_overview_without_fallback() -> None:
    observation = {
        "regionSummaries": [
            {
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "controls": ["Service Application 14", "Enquiries & Complaints 2"],
            },
            {
                "nodeId": "observation-region-002",
                "kind": "region",
                "heading": "Service Application",
                "controls": ["Pending Review 12", "External Approval 2"],
            },
        ]
    }
    planner = Planner(
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/dashboard",
            "section": "Service Application",
            "sourceSection": "observation-region-002",
            "answerShape": "overview",
            "facts": ["Pending Review 12"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/dashboard")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="How about the service application tasks?")

    assert outcome.result.facts == ("Pending Review 12",)
    assert outcome.result.answer_shape == "overview"
    assert outcome.audit_evidence["semanticResolution"]["decision"] == "llm_result"
    assert outcome.audit_evidence["semanticResolution"]["fallbackUsed"] is False
    assert len(planner.calls) == 2
    assert planner.calls[1][2]["chunks"] == [{"content": "Admin Portal manual"}]
    assert "knowledge" not in planner.calls[1][2]


def test_enquiries_post_action_observation_is_resolved_by_llm_as_a_list() -> None:
    observations = [
        {
            "regionSummaries": [{
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "controls": ["Service Application 14", "Enquiries & Complaints 2"],
            }],
        },
        {
            "regionSummaries": [{
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Enquiries & Complaints 2",
                "controls": ["Service Application 14", "Enquiries & Complaints 2"],
            }],
            "sectionSummaries": [{
                "nodeId": "observation-table-001",
                "kind": "table",
                "parentRef": "observation-region-001",
                "heading": "Enquiries & Complaints",
                "selectedState": "Enquiries & Complaints",
                "rowSummaries": ["EC-101 Open", "EC-102 In Progress"],
            }],
        },
    ]

    class SequencedGateway(Gateway):
        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "knowledge.search":
                return await super().invoke(
                    current_principal, tool_name, arguments, allowed_tools=allowed_tools
                )
            self.events.append(tool_name)
            self.calls.append((tool_name, arguments, allowed_tools))
            observation = observations.pop(0)
            return {"ok": True, "result": {"result": "success", "observation": observation}}

    planner = Planner(
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        portal_plan_for("/dashboard", [{"type": "switch_tab", "role": "tab", "name": "Enquiries & Complaints 2"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/dashboard",
            "section": "Enquiries & Complaints",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "selectedState": "Enquiries & Complaints",
            "facts": ["EC-101 Open", "EC-102 In Progress"],
            "missing": [],
        },
    )
    gateway = SequencedGateway(info={"ok": True, "result": user_info_for_paths("/dashboard")})

    outcome = run_reader(gateway, planner, question="What about Enquiries & Complaints items?")

    assert outcome.result.facts == ("EC-101 Open", "EC-102 In Progress")
    assert outcome.result.answer_shape == "list"
    assert outcome.audit_evidence["stage"] == "completed_after_read_state_change"
    assert outcome.audit_evidence["semanticResolution"]["decision"] == "llm_result"
    assert len(planner.calls) == 3
    assert planner.calls[2][2]["chunks"] == [{"content": "Admin Portal manual"}]
    assert "knowledge" not in planner.calls[2][2]


def test_explicit_list_follow_up_allows_permitted_module_read_before_success() -> None:
    observations = [
        {
            "regionSummaries": [{
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Service Application 14",
                "controls": [
                    "Service Application 14",
                    "Profile Verification 0",
                    "Enquiries & Complaints 2",
                    "Refunds 1",
                    "Appeals 3",
                ],
            }],
            "sectionSummaries": [{
                "nodeId": "observation-table-001",
                "kind": "table",
                "parentRef": "observation-region-001",
                "heading": "Task List",
                "rowSummaries": ["SA-101 Pending Review"],
            }],
        },
        {
            "sectionSummaries": [{
                "nodeId": "observation-table-001",
                "kind": "table",
                "heading": "Applications",
                "rowSummaries": ["EC-101 Open", "EC-102 In Progress"],
            }],
        },
    ]

    class SequencedGateway(Gateway):
        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "knowledge.search":
                return await super().invoke(
                    current_principal, tool_name, arguments, allowed_tools=allowed_tools
                )
            self.events.append(tool_name)
            self.calls.append((tool_name, arguments, allowed_tools))
            observation = observations.pop(0)
            return {"ok": True, "result": {"result": "success", "observation": observation}}

    planner = Planner(
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/dashboard",
            "section": "My Tasks",
            "sourceSection": "observation-region-001",
            "answerShape": "unspecified",
            "facts": [
                "Service Application 14, Profile Verification 0, Enquiries & Complaints 2, "
                "Refunds 1, Appeals 3; the current rows belong to Service Application."
            ],
            "missing": [],
        },
        portal_plan_for(
            "/licensing/applications",
            [{"type": "observe"}],
        ),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/licensing/applications",
            "section": "Applications",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "facts": ["EC-101 Open", "EC-102 In Progress"],
            "missing": [],
        },
    )
    gateway = SequencedGateway(
        info={"ok": True, "result": user_info_for_paths("/dashboard", "/licensing/applications")}
    )

    outcome = run_reader(
        gateway,
        planner,
        question="show me the list",
        conversation_context={
            "previousIntent": {
                "question": "how about my enquiries tasks?",
                "answerShape": "overview",
                "page": "/dashboard",
                "section": "My Tasks",
                "sourceSection": "observation-region-001",
                "selectedState": "Service Application 14",
            }
        },
    )

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "list"
    assert outcome.result.facts == (
        "EC-101 Open",
        "EC-102 In Progress",
    )
    directive = planner.calls[2][2]["planningDirective"]
    assert directive["reason"] == "named_collection_requires_child_evidence"
    assert directive["categoryControl"] == "Enquiries & Complaints 2"
    assert directive["categorySemanticLabel"] == "Enquiries & Complaints"
    assert directive["requestedAnswerShape"] == "list"
    assert directive["requireChildEvidence"] is True
    assert directive["currentPageControlIsAvailable"] is True
    assert directive["parentCountNotSufficient"] is True
    assert gateway.events.count("admin.portal.read") == 2


def test_current_explicit_category_takes_priority_over_previous_category() -> None:
    from app.portal_reader import _category_control_requiring_children

    observation = {
        "regionSummaries": [{
            "nodeId": "observation-region-001",
            "kind": "region",
            "heading": "My Tasks",
            "selectedState": "Refunds 1",
            "controls": [
                "Service Application 14",
                "Enquiries & Complaints 2",
                "Refunds 1",
            ],
        }]
    }

    requirement = _category_control_requiring_children(
        "show me the Service Application list",
        observation,
        None,
        "list",
        {
            "previousIntent": {
                "question": "how about my enquiries tasks?",
                "section": "Enquiries & Complaints",
            }
        },
    )

    assert requirement is not None
    assert requirement.semantic_label == "Service Application"
    assert requirement.control_label == "Service Application 14"


def test_category_action_requires_exact_runtime_locator_label() -> None:
    from app.portal_reader import PortalReadRequest, _request_advances_category_on_current_page

    request = PortalReadRequest(
        "/dashboard",
        ({
            "type": "switch_tab",
            "role": "tab",
            "name": "Enquiries & Complaints",
            "section": "Enquiries & Complaints 2",
        },),
    )

    assert not _request_advances_category_on_current_page(
        request,
        current_page="/dashboard",
        category_control="Enquiries & Complaints 2",
    )


@pytest.mark.parametrize(
    ("question", "expected_shape"),
    [("show me the list", "list"), ("show me the details", "detail")],
)
def test_parent_count_cannot_be_returned_when_required_category_action_is_missing(
    question: str,
    expected_shape: str,
) -> None:
    observation = {
        "regionSummaries": [
            {
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Enquiries & Complaints",
                "controls": ["Service Application 14", "Enquiries & Complaints 2"],
            },
        ],
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "parentRef": "observation-region-001",
            "heading": "Task List",
            "rowSummaries": ["EC-101 Open"],
        }],
    }
    stale_success = {
        "mode": "observation_result",
        "result": "success",
        "page": "/dashboard",
        "section": "My Tasks",
        "sourceSection": "observation-region-001",
        "answerShape": "unspecified",
        "facts": ["Service Application 14"],
        "missing": [],
    }
    planner = Planner(
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        stale_success,
        stale_success,
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/dashboard")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(
        gateway,
        planner,
        question=question,
        conversation_context={
            "previousIntent": {
                "question": "How are the service application tasks?",
                "answerShape": "overview",
                "page": "/dashboard",
                "section": "Service Application",
            }
        },
    )

    assert outcome.result.status == "not_confirmed"
    assert outcome.result.answer_shape == expected_shape
    assert outcome.result.facts == ()
    assert outcome.result.missing == ("collection_children_read_required",)
    assert outcome.audit_evidence["stage"] == "planning_collection_children_after_observe"
    assert outcome.audit_evidence["semanticResolution"]["reason"] == "collection_children_read_required"
    assert gateway.events.count("admin.portal.read") == 1


def test_explicit_count_follow_up_accepts_matching_parent_count_without_child_read() -> None:
    observation = {
        "regionSummaries": [{
            "nodeId": "observation-region-001",
            "kind": "region",
            "heading": "My Tasks",
            "selectedState": "Enquiries & Complaints",
            "controls": ["Service Application 14", "Enquiries & Complaints 2"],
        }]
    }
    planner = Planner(
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/dashboard",
            "section": "My Tasks",
            "sourceSection": "observation-region-001",
            "answerShape": "count",
            "facts": ["Service Application 14"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/dashboard")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(
        gateway,
        planner,
        question="how many are there?",
        conversation_context={
            "previousIntent": {
                "question": "How are the service application tasks?",
                "answerShape": "overview",
                "page": "/dashboard",
                "section": "Service Application",
            }
        },
    )

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "count"
    assert outcome.result.facts == ("Service Application 14",)
    assert len(planner.calls) == 2
    assert gateway.events.count("admin.portal.read") == 1


def test_post_action_rows_under_different_parent_selected_state_are_not_returned() -> None:
    mismatched_observation = {
        "regionSummaries": [{
            "nodeId": "observation-region-001",
            "kind": "region",
            "heading": "My Tasks",
            "selectedState": "Enquiries & Complaints",
            "controls": ["Service Application 14", "Enquiries & Complaints 2"],
        }],
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "parentRef": "observation-region-001",
            "heading": "My Tasks",
            "rowSummaries": ["EC-101 Open"],
        }],
    }

    class SequencedGateway(Gateway):
        async def invoke(self, current_principal, tool_name, arguments, *, allowed_tools=None):
            if tool_name == "knowledge.search":
                return await super().invoke(
                    current_principal, tool_name, arguments, allowed_tools=allowed_tools
                )
            self.events.append(tool_name)
            self.calls.append((tool_name, arguments, allowed_tools))
            return {
                "ok": True,
                "result": {"result": "success", "observation": mismatched_observation},
            }

    planner = Planner(
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/dashboard",
            "section": "My Tasks",
            "sourceSection": "observation-region-001",
            "answerShape": "unspecified",
            "facts": ["Service Application 14"],
            "missing": [],
        },
        portal_plan_for(
            "/dashboard",
            [{"type": "switch_tab", "role": "tab", "name": "Service Application 14"}],
        ),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/dashboard",
            "section": "My Tasks",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "facts": ["EC-101 Open"],
            "missing": [],
        },
    )
    gateway = SequencedGateway(
        info={"ok": True, "result": user_info_for_paths("/dashboard")}
    )

    outcome = run_reader(
        gateway,
        planner,
        question="show me the list",
        conversation_context={
            "previousIntent": {
                "question": "How are the service application tasks?",
                "answerShape": "overview",
                "page": "/dashboard",
                "section": "Service Application",
            }
        },
    )

    assert outcome.result.status == "not_confirmed"
    assert outcome.result.facts == ()
    assert outcome.result.missing == ("collection_children_not_confirmed",)
    assert outcome.audit_evidence["stage"] == "validation_after_read_state_change"
    assert outcome.audit_evidence["semanticResolution"]["reason"] == "category_child_evidence_not_confirmed"
    assert gateway.events.count("admin.portal.read") == 2


def test_source_node_uses_parent_selected_state_without_merging_same_heading_siblings() -> None:
    from app.portal_reader import observation_result_from_plan

    observation = {
        "regionSummaries": [
            {
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Service Application",
            },
            {
                "nodeId": "observation-region-002",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Enquiries & Complaints",
            },
        ],
        "sectionSummaries": [
            {
                "nodeId": "observation-table-001",
                "kind": "table",
                "parentRef": "observation-region-001",
                "heading": "Task List",
                "rowSummaries": ["SA-101 Pending Review"],
            },
            {
                "nodeId": "observation-table-002",
                "kind": "table",
                "parentRef": "observation-region-002",
                "heading": "Task List",
                "rowSummaries": ["EC-101 Open"],
            },
        ],
    }
    base_plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/dashboard",
        "section": "Task List",
        "sourceSection": "observation-table-002",
        "answerShape": "list",
        "selectedState": "Enquiries & Complaints",
        "missing": [],
    }

    valid = observation_result_from_plan(
        {**base_plan, "facts": ["EC-101 Open"]},
        observation,
        observed_page="/dashboard",
        permitted_paths=("/dashboard",),
    )
    cross_sibling = observation_result_from_plan(
        {**base_plan, "facts": ["SA-101 Pending Review"]},
        observation,
        observed_page="/dashboard",
        permitted_paths=("/dashboard",),
    )
    state_resolved_heading = observation_result_from_plan(
        {**base_plan, "sourceSection": "Task List", "facts": ["EC-101 Open"]},
        observation,
        observed_page="/dashboard",
        permitted_paths=("/dashboard",),
    )

    assert valid is not None
    assert valid.selected_state == "Enquiries & Complaints"
    assert cross_sibling is None
    assert state_resolved_heading is not None
    assert state_resolved_heading.source_section == "observation-table-002"
    assert observation_result_from_plan(
        {**base_plan, "sourceSection": "Task List", "selectedState": "", "facts": ["EC-101 Open"]},
        observation, observed_page="/dashboard", permitted_paths=("/dashboard",),
    ) is None


def test_identical_same_heading_semantic_nodes_can_support_one_llm_result() -> None:
    repeated_region = {
        "kind": "region",
        "heading": "My Tasks",
        "sourceSection": "My Tasks",
        "selectedState": "Service Application 14",
        "controls": [
            "Service Application 14",
            "Enquiries & Complaints 2",
            "Refunds 1",
        ],
    }
    observation = {
        "regionSummaries": [
            {**repeated_region, "nodeId": f"observation-region-{index:03d}"}
            for index in range(1, 4)
        ]
    }
    plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/dashboard",
        "section": "My Tasks",
        "sourceSection": "My Tasks",
        "answerShape": "overview",
        "selectedState": "Service Application 14",
        "facts": ["My Tasks shows Enquiries & Complaints: 2"],
        "missing": [],
    }

    planner = Planner(
        portal_plan_for("/dashboard", [{"type": "observe"}]),
        plan,
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/dashboard")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="how about my enquiries tasks?")

    assert outcome.result.status == "success"
    assert outcome.result.facts == ("My Tasks shows Enquiries & Complaints: 2",)
    assert outcome.result.source_section == "observation-region-001"
    assert outcome.audit_evidence["stage"] == "completed_after_observe"
    assert outcome.audit_evidence["semanticResolution"]["decision"] == "llm_result"
    assert gateway.events.count("admin.portal.read") == 1


def test_distinct_same_heading_semantic_nodes_remain_ambiguous() -> None:
    from app.portal_reader import observation_result_from_plan

    observation = {
        "regionSummaries": [
            {
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "controls": ["Enquiries & Complaints 2"],
            },
            {
                "nodeId": "observation-region-002",
                "kind": "region",
                "heading": "My Tasks",
                "controls": ["Enquiries & Complaints 3"],
            },
        ]
    }
    plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/dashboard",
        "section": "My Tasks",
        "sourceSection": "My Tasks",
        "answerShape": "overview",
        "facts": ["Enquiries & Complaints 2"],
        "missing": [],
    }

    assert observation_result_from_plan(
        plan,
        observation,
        observed_page="/dashboard",
        permitted_paths=("/dashboard",),
    ) is None


def test_same_heading_child_nodes_with_distinct_parent_state_remain_ambiguous() -> None:
    from app.portal_reader import observation_result_from_plan

    observation = {
        "regionSummaries": [
            {
                "nodeId": "observation-region-001",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Service Application 14",
            },
            {
                "nodeId": "observation-region-002",
                "kind": "region",
                "heading": "My Tasks",
                "selectedState": "Enquiries & Complaints 2",
            },
        ],
        "sectionSummaries": [
            {
                "nodeId": "observation-table-001",
                "kind": "table",
                "parentRef": "observation-region-001",
                "heading": "Task List",
                "rowSummaries": ["REF-101 Open"],
            },
            {
                "nodeId": "observation-table-002",
                "kind": "table",
                "parentRef": "observation-region-002",
                "heading": "Task List",
                "rowSummaries": ["REF-101 Open"],
            },
        ],
    }
    plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/dashboard",
        "section": "Task List",
        "sourceSection": "Task List",
        "answerShape": "list",
        "facts": ["REF-101 Open"],
        "missing": [],
    }

    assert observation_result_from_plan(
        plan,
        observation,
        observed_page="/dashboard",
        permitted_paths=("/dashboard",),
    ) is None


def test_dangling_parent_reference_does_not_reject_direct_table_evidence() -> None:
    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "parentRef": "missing-region",
            "heading": "Queue",
            "rowSummaries": ["REF-101 Open"],
        }]
    }
    planner = Planner(
        portal_plan_for("/work", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/work",
            "section": "Queue",
            "facts": ["REF-101 Open"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="List assigned items")

    assert outcome.result.status == "success"
    assert outcome.result.facts == ("REF-101 Open",)
    assert outcome.audit_evidence["semanticResolution"]["decision"] == "llm_result"


def test_same_heading_region_and_table_use_the_table_as_attention_evidence() -> None:
    from app.portal_reader import observation_result_from_plan

    observation = {
        "regionSummaries": [{
            "nodeId": "observation-region-010",
            "kind": "region",
            "heading": "Needs Your Attention",
            "controls": ["All 4", "External Approval 2"],
        }],
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "parentRef": "observation-region-010",
            "heading": "Needs Your Attention",
            "columnHeaders": ["Task No.", "Status", "Time Alert"],
            "rowSummaries": ["ML-1-8007-0457147 External Approval Waiting 4d"],
        }],
    }
    plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/dashboard",
        "section": "Needs Your Attention",
        "sourceSection": "Needs Your Attention",
        "answerShape": "attention",
        "selectedState": "All",
        "facts": ["ML-1-8007-0457147 External Approval Waiting 4d"],
        "missing": [],
    }

    result = observation_result_from_plan(
        plan,
        observation,
        observed_page="/dashboard",
        permitted_paths=("/dashboard",),
    )

    assert result is not None
    assert result.status == "success"
    assert result.facts == ("ML-1-8007-0457147 External Approval Waiting 4d",)


def test_list_result_with_only_headers_defers_to_bounded_row_fallback() -> None:
    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "Applications",
            "columnHeaders": ["Application No.", "Service Name", "Status"],
            "rowSummaries": ["ML-101 Renewal Pending Review", "ML-102 Permit External Approval"],
        }]
    }
    planner = Planner(
        portal_plan_for("/licensing/applications", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/licensing/applications",
            "section": "Applications",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "facts": ["List columns: Application No., Service Name, Status"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/licensing/applications")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="show me my application task list")

    assert outcome.result.status == "success"
    assert outcome.result.facts == (
        "ML-101 Renewal Pending Review",
        "ML-102 Permit External Approval",
    )
    assert outcome.audit_evidence["stage"] == "completed_from_observation_fallback"


def test_single_empty_table_can_confirm_no_data_when_its_parent_was_trimmed() -> None:
    from app.portal_reader import observation_result_from_plan

    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "parentRef": "observation-region-002",
            "heading": "",
            "emptyState": "No Data",
            "columnHeaders": ["Ticket No.", "Status"],
        }]
    }
    plan = {
        "mode": "observation_result",
        "result": "no_data",
        "page": "/happiness/tickets",
        "section": "Enquiries & Complaints",
        "answerShape": "overview",
        "facts": [],
        "missing": [],
    }

    result = observation_result_from_plan(
        plan,
        observation,
        observed_page="/happiness/tickets",
        permitted_paths=("/happiness/tickets",),
    )

    assert result is not None
    assert result.status == "no_data"


def test_not_confirmed_llm_result_uses_structured_fallback_after_llm_validation() -> None:
    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "Assigned Items",
            "rowSummaries": ["REF-101 Open"],
        }]
    }
    planner = Planner(
        portal_plan_for("/work", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "not_confirmed",
            "page": "/work",
            "section": "Assigned Items",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "facts": [],
            "missing": ["semantic_choice_not_confirmed"],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="List my assigned items")

    assert outcome.result.facts == ("REF-101 Open",)
    assert outcome.audit_evidence["stage"] == "completed_from_observation_fallback"
    resolution = outcome.audit_evidence["semanticResolution"]
    assert resolution["decision"] == "fallback"
    assert resolution["reason"] == "llm_not_confirmed"
    assert resolution["llmMode"] == "observation_result"
    assert resolution["llmSelection"] == {
        "resultStatus": "not_confirmed",
        "section": "Assigned Items",
        "sourceSection": "observation-table-001",
        "answerShape": "list",
    }
    assert resolution["validation"] == "not_applicable"
    assert resolution["fallbackUsed"] is True
    assert resolution["fallbackStrategy"] == "structured_unique_evidence"


def test_invalid_llm_evidence_reference_falls_back_but_valid_result_does_not() -> None:
    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "Assigned Items",
            "rowSummaries": ["REF-101 Open", "REF-102 Pending"],
        }]
    }
    planner = Planner(
        portal_plan_for("/work", [{"type": "observe"}]),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/work",
            "section": "Assigned Items",
            "sourceSection": "observation-table-001",
            "answerShape": "list",
            "facts": ["REF-999 Missing"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="List my assigned items")

    assert outcome.result.facts == ("REF-101 Open", "REF-102 Pending")
    assert outcome.audit_evidence["semanticResolution"]["decision"] == "fallback"
    assert outcome.audit_evidence["semanticResolution"]["reason"] == "invalid_observation_references"
    assert outcome.audit_evidence["semanticResolution"]["validation"] == "failed"


def test_post_observe_knowledge_only_is_invalid_schema_not_a_compatibility_result() -> None:
    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "Assigned Items",
            "rowSummaries": ["REF-101 Open", "REF-102 Pending"],
        }]
    }
    planner = Planner(
        portal_plan_for("/work", [{"type": "observe"}]),
        {
            "mode": "knowledge_only",
            "result": "success",
            "page": "/work",
            "section": "Assigned Items",
            "facts": ["REF-101 Open"],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={"ok": True, "result": user_info_for_paths("/work")},
        portal_result={"ok": True, "result": {"result": "success", "observation": observation}},
    )

    outcome = run_reader(gateway, planner, question="List my assigned items")

    assert outcome.result.facts == ("REF-101 Open", "REF-102 Pending")
    resolution = outcome.audit_evidence["semanticResolution"]
    assert resolution["decision"] == "fallback"
    assert resolution["reason"] == "invalid_semantic_schema"
    assert resolution["llmMode"] == "knowledge_only"
    assert resolution["llmSelection"] == {}
    assert resolution["validation"] == "failed"
    assert resolution["fallbackUsed"] is True


def test_observation_result_rejects_unpermitted_or_different_page_reference() -> None:
    # The orchestration test above proves the positive path; this guards the
    # deterministic permission check independently of planner behavior.
    from app.portal_reader import observation_result_from_plan

    plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/other",
        "section": "Queue",
        "facts": ["Open 1"],
        "missing": [],
    }
    observation = {"regionSummaries": [{"heading": "Queue", "controls": ["Open 1"]}]}

    assert observation_result_from_plan(
        plan,
        observation,
        observed_page="/work",
        permitted_paths=("/work",),
    ) is None
