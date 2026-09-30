import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.portal_reader import (
    PortalReadRequest,
    UserPermissionContext,
    _knowledge_route_recovery_request,
    reader_answer_shape,
)
from test_admin_portal_reader import (
    Gateway,
    Planner,
    run_reader,
    user_info_for_paths,
)


@pytest.mark.parametrize(
    "question",
    (
        "Which tasks are approaching their deadlines?",
        "Which work items have a deadline approaching?",
    ),
)
def test_approaching_deadline_questions_have_due_answer_shape(question: str) -> None:
    assert reader_answer_shape(question) == "due"


def _semantic_node(
    *,
    heading: str,
    page: str,
    node_type: str,
    meaning: str,
    use_when: str,
    distinguish_from: str,
    content: str,
    scope: str,
) -> dict:
    return {"content": f"""
## {heading}
- **section:** {heading}
- **page:** `{page}`
- **type:** {node_type}
- **meaning:** {meaning}
- **use when:** {use_when}
- **distinguish from:** {distinguish_from}
- **content:** {content}
- **scope:** {scope}
"""}


def _deadline_knowledge() -> dict:
    return {"chunks": [
        _semantic_node(
            heading="Assigned Work Deadlines",
            page="/work/items",
            node_type="list",
            meaning="A live task data surface containing assigned work and its deadline state.",
            use_when="Use for personal task questions about approaching deadlines.",
            distinguish_from="The Work module navigation and team-wide deadline reporting.",
            content="Task identity, deadline, and remaining time.",
            scope="Personal; rows are limited to the signed-in user's assigned tasks.",
        ),
        _semantic_node(
            heading="Work Module Navigation",
            page="/work",
            node_type="navigation",
            meaning="Navigation links for opening work areas; it is not a task data surface.",
            use_when="Use only to navigate between work areas.",
            distinguish_from="Do not use this node to answer which of my tasks are approaching their deadlines.",
            content="Module destinations and menu labels.",
            scope="Personal navigation visibility only; no task rows are represented.",
        ),
        _semantic_node(
            heading="Team Deadline Report",
            page="/reports/team-deadlines",
            node_type="list",
            meaning="A live team-wide task data surface containing deadline state.",
            use_when="Use for team task questions about approaching deadlines.",
            distinguish_from="Personal assigned work deadlines.",
            content="Team task identity, owner, deadline, and remaining time.",
            scope="Team; this does not establish the signed-in user's personal assigned tasks.",
        ),
    ]}


def _refuse_live_read() -> dict:
    return {
        "mode": "knowledge_only",
        "result": "not_confirmed",
        "answerShape": "due",
        "facts": [],
        "missing": ["live_portal_read_required"],
    }


def test_two_planner_refusals_recover_authorized_matching_data_surface() -> None:
    fact = json.dumps({"Task": "TASK-7", "Time Alert": "Due in 1 day"})
    observation = {
        "readHealth": {"healthy": True},
        "sectionSummaries": [{
            "nodeId": "deadline-table",
            "kind": "table",
            "heading": "Assigned Work Deadlines",
            "columnHeaders": ["Task", "Time Alert"],
            "rowFields": [{"Task": "TASK-7", "Time Alert": "Due in 1 day"}],
            "rowSummaries": ["Task: TASK-7; Time Alert: Due in 1 day"],
        }],
    }
    planner = Planner(
        _refuse_live_read(),
        _refuse_live_read(),
        {
            "mode": "observation_result",
            "result": "success",
            "page": "/work/items",
            "section": "Assigned Work Deadlines",
            "sourceSection": "deadline-table",
            "answerShape": "due",
            "scope": "personal",
            "facts": [fact],
            "missing": [],
        },
    )
    gateway = Gateway(
        info={
            "ok": True,
            "result": user_info_for_paths(
                "/work", "/work/items", "/reports/team-deadlines",
            ),
        },
        knowledge_result={"ok": True, "result": _deadline_knowledge()},
        portal_result={
            "ok": True,
            "result": {"result": "success", "observation": observation},
        },
    )

    outcome = run_reader(
        gateway,
        planner,
        question="Which of my tasks are approaching their deadlines?",
    )

    assert outcome.result.status == "success"
    assert outcome.result.answer_shape == "due"
    assert "TASK-7" in " ".join(outcome.result.facts)
    assert "Due in 1 day" in " ".join(outcome.result.facts)
    portal_calls = [call for call in gateway.calls if call[0] == "admin.portal.read"]
    assert len(portal_calls) == 1
    assert portal_calls[0][1]["startPath"] == "/work/items"
    assert planner.calls[1][2]["planningDirective"]["requirePortalRead"] is True


def test_route_recovery_refuses_genuinely_tied_matching_data_surfaces() -> None:
    first = _semantic_node(
        heading="Assigned Work Deadlines",
        page="/work/primary",
        node_type="list",
        meaning="A live personal task data surface containing deadline state.",
        use_when="Use for personal task questions about approaching deadlines.",
        distinguish_from="Other deadline lists only when their ownership differs.",
        content="Task identity, deadline, and remaining time.",
        scope="Personal; signed-in user's assigned tasks.",
    )
    second = _semantic_node(
        heading="Alternate Assigned Work Deadlines",
        page="/work/alternate",
        node_type="list",
        meaning="A live personal task data surface containing deadline state.",
        use_when="Use for personal task questions about approaching deadlines.",
        distinguish_from="Other deadline lists only when their ownership differs.",
        content="Task identity, deadline, and remaining time.",
        scope="Personal; signed-in user's assigned tasks.",
    )
    permissions = UserPermissionContext(
        roles=("Reader",),
        pages=("/work/primary", "/work/alternate"),
    )

    request = _knowledge_route_recovery_request(
        "Which of my tasks are approaching their deadlines?",
        {"chunks": [first, second]},
        permissions,
    )

    assert request is None


def test_matching_data_surface_recovery_returns_only_an_observe_request() -> None:
    permissions = UserPermissionContext(
        roles=("Reader",),
        pages=("/work", "/work/items", "/reports/team-deadlines"),
    )

    request = _knowledge_route_recovery_request(
        "Which of my tasks are approaching their deadlines?",
        _deadline_knowledge(),
        permissions,
    )

    assert request == PortalReadRequest(
        start_path="/work/items",
        actions=({"type": "observe"},),
        expected_fields=(),
    )
