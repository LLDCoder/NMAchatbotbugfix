from copy import deepcopy
from types import SimpleNamespace

import pytest

from app.reader_intent import SLOT_NAMES, parse_intent_resolution
from app.service import _reader_conversation_context, _reader_focus_anchor, reader_evidence_only_response


def event(seq, kind, payload):
    return SimpleNamespace(seq=seq, event_type=kind, event_json=payload)


def intent(relation="broaden", **values):
    return {
        "relation": relation,
        "slots": {
            name: {"source": "current", "value": values[name], "evidence": values[name]}
            if name in values else {"source": "clear", "value": "", "evidence": ""}
            for name in SLOT_NAMES
        },
        "clarificationOptions": [],
    }


def clarification_result():
    context = intent("clarify")
    context["clarificationOptions"] = ["these appeals", "all your tasks"]
    return {
        "result": "not_confirmed", "facts": [], "missing": ["intent_ambiguous"],
        "intentContext": context,
        "clarificationOptions": list(context["clarificationOptions"]),
    }


@pytest.mark.parametrize("language,expected", [
    ("en", 'Do you mean "these appeals" or "all your tasks"?'),
    ("zh", "你指的是“these appeals”，还是“all your tasks”？"),
    ("ar", "هل تقصد «these appeals» أم «all your tasks»؟"),
])
def test_marked_matching_clarification_uses_fixed_question(language, expected):
    assert reader_evidence_only_response(clarification_result(), language) == expected


@pytest.mark.parametrize("change", [
    lambda result: result.pop("intentContext"),
    lambda result: result.pop("clarificationOptions"),
    lambda result: result.update(missing=[]),
    lambda result: result.update(missing=["intent_ambiguous", "other_missing"]),
    lambda result: result["intentContext"].update(relation="broaden"),
    lambda result: result.update(clarificationOptions=["some other object", "all your tasks"]),
    lambda result: result["intentContext"].update(clarificationOptions=[]),
])
def test_unmarked_or_mismatched_options_do_not_replace_failure_response(change):
    result = clarification_result()
    change(result)
    assert reader_evidence_only_response(result, "en") == "I could not confirm the requested information."


@pytest.mark.parametrize("options", [
    None, [], ["one"], ["one", "ONE"], ["https://example.com", "tasks"],
    ["<b>appeals</b>", "tasks"], ["appeals\nnew line", "tasks"],
    ["password=not-a-real-secret", "tasks"], ["x" * 121, "tasks"],
])
def test_invalid_but_matching_options_remain_generic_failure(options):
    result = clarification_result()
    result["clarificationOptions"] = options
    result["intentContext"]["clarificationOptions"] = options
    assert reader_evidence_only_response(result, "en") == "I could not confirm the requested information."


@pytest.mark.parametrize("status,expected", [
    ("load_failed", "I could not load the requested information."),
    ("no_permission", "You do not have permission to read the requested information."),
    ("no_data", "No matching information is available for the requested scope."),
])
def test_other_outcomes_cannot_be_replaced_by_clarification(status, expected):
    result = clarification_result()
    result["result"] = status
    assert reader_evidence_only_response(result, "en") == expected


def test_existing_verified_facts_are_not_discarded_by_clarification_labels():
    result = clarification_result()
    result["facts"] = ["A confirmed business fact."]
    response = reader_evidence_only_response(result, "en")
    assert "A confirmed business fact." in response
    assert "Do you mean" not in response


@pytest.mark.parametrize("status", ["not_confirmed", "load_failed", "no_data", "no_permission"])
def test_modern_cleared_slots_survive_failure_without_resurrecting_older_anchors(status):
    old_user = event(1, "user.message", {"content": "Show team appeals"})
    old_result = event(2, "reader.result", {
        "result": "success", "businessObject": "appeals", "recordIdentity": "REF-100",
        "scope": "team", "page": "/old-appeals", "view": "To Do",
        "dateRange": "last week", "filter": "Overdue", "answerShape": "detail",
        "facts": ["Record No. REF-100", "Private previous record data"],
    })
    changed_user = event(3, "user.message", {"content": "Show all tasks instead"})
    modern = intent("broaden", businessObject="tasks")
    changed_result = event(4, "reader.result", {
        "result": status, "intentContext": modern, "scope": "team",
        "recordIdentity": "REF-100", "page": "/old-appeals", "facts": ["Record No. REF-100"],
    })
    current = event(5, "user.message", {"content": "Try again"})
    result = _reader_conversation_context([old_user, old_result, changed_user, changed_result, current], current)
    previous = result["previousIntent"]
    assert previous["businessObject"] == "tasks"
    assert previous["intentContext"] == modern
    assert previous["resultStatus"] == status
    for name in ("recordIdentity", "requestedScope", "scope", "dateRange", "filter", "view", "page", "recentIntents"):
        assert name not in previous
    assert "REF-100" not in str(result)
    assert "Private previous record data" not in str(result)
    assert "/old-appeals" not in str(result)


def test_modern_noncleared_semantic_conditions_remain_independently_available():
    previous_user = event(1, "user.message", {"content": "Show REF-41 for my team"})
    modern = intent("refine", recordIdentity="REF-41", requestedScope="team")
    modern["slots"]["recordIdentity"]["source"] = "previous"
    previous_result = event(2, "reader.result", {
        "result": "load_failed", "intentContext": modern, "facts": [],
    })
    current = event(3, "user.message", {"content": "Try again"})
    context = _reader_conversation_context([previous_user, previous_result, current], current)
    previous = context["previousIntent"]
    assert previous["recordIdentity"] == "REF-41"
    assert previous["requestedScope"] == "team"
    assert "businessObject" not in previous
    assert "scope" not in previous


def test_clarification_reply_retains_options_as_semantics_without_previous_records():
    initial = event(1, "user.message", {"content": "Show my appeals"})
    initial_result = event(2, "reader.result", {
        "result": "success", "recordIdentity": "REF-100", "scope": "team",
    })
    previous = event(3, "user.message", {"content": "What tasks need attention?"})
    result = clarification_result()
    previous_result = event(4, "reader.result", result)
    current = event(5, "user.message", {"content": "The second option"})
    context = _reader_conversation_context([initial, initial_result, previous, previous_result, current], current)
    assert context["previousIntent"]["clarificationOptions"] == ["these appeals", "all your tasks"]
    assert context["previousIntent"]["intentContext"] == result["intentContext"]
    assert "REF-100" not in str(context)
    assert "scope" not in context["previousIntent"]
    resolved = intent("broaden")
    resolved["slots"]["businessObject"] = {
        "source": "previous", "value": "tasks", "evidence": "all your tasks",
    }
    assert parse_intent_resolution(resolved, "The second option", context).public_json() == resolved


def test_modern_context_does_not_mutate_stored_intent_metadata():
    previous = event(1, "user.message", {"content": "What tasks need attention?"})
    payload = clarification_result()
    original = deepcopy(payload)
    result = event(2, "reader.result", payload)
    current = event(3, "user.message", {"content": "The second option"})
    context = _reader_conversation_context([previous, result, current], current)
    context["previousIntent"]["intentContext"]["slots"]["businessObject"]["value"] = "changed"
    assert payload == original


@pytest.mark.parametrize("marker", ["intent_resolution_invalid", "intent_resolution_timeout"])
def test_resolver_failure_is_history_boundary_not_permission_to_restore_previous_record(marker):
    older = event(1, "user.message", {"content": "Show team appeals"})
    older_result = event(2, "reader.result", {
        "result": "success", "businessObject": "appeals", "recordIdentity": "REF-100",
        "scope": "team", "page": "/old-appeals", "answerShape": "detail",
        "facts": ["Record No. REF-100"],
    })
    failed_request = event(3, "user.message", {"content": "Then show all my tasks"})
    failed_result = event(4, "reader.result", {
        "result": "not_confirmed", "facts": [], "missing": [marker],
    })
    current = event(5, "user.message", {"content": "Try again"})
    context = _reader_conversation_context([older, older_result, failed_request, failed_result, current], current)
    assert context == {"previousIntent": {
        "question": "Then show all my tasks", "resultStatus": "not_confirmed",
    }}


def test_failed_intent_request_retained_within_provenance_length_bound():
    previous = event(1, "user.message", {"content": "Then " + "x" * 800})
    result = event(2, "reader.result", {"result": "not_confirmed", "missing": ["intent_resolution_invalid"]})
    current = event(3, "user.message", {"content": "Try again"})
    context = _reader_conversation_context([previous, result, current], current)
    assert len(context["previousIntent"]["question"]) == 500
    assert set(context["previousIntent"]) == {"question", "resultStatus"}


@pytest.mark.parametrize("resolved_shape,result_shape,facts", [
    ("list", "list", ["Record No. REF-100"]),
    ("overview", "overview", ["Record No. REF-100"]),
    ("detail", "list", ["Record No. REF-100"]),
    ("list", "detail", ["Record No. REF-100"]),
    ("detail", "detail", ["Record No. REF-100", "Record No. REF-101"]),
    ("detail", "detail", []),
])
def test_success_does_not_implicitly_restore_first_identity_after_clear(resolved_shape, result_shape, facts):
    previous = event(1, "user.message", {"content": "Show all tasks"})
    result = event(2, "reader.result", {
        "result": "success", "intentContext": intent(answerShape=resolved_shape),
        "answerShape": result_shape, "facts": facts,
    })
    current = event(3, "user.message", {"content": "Which need attention?"})
    context = _reader_conversation_context([previous, result, current], current)
    assert "recordIdentity" not in context["previousIntent"]


def test_successful_explicit_single_detail_can_establish_new_observed_identity():
    previous = event(1, "user.message", {"content": "Show the first task's details"})
    result = event(2, "reader.result", {
        "result": "success", "intentContext": intent(answerShape="detail"),
        "answerShape": "detail", "facts": ["Record No. REF-200 Pending"],
    })
    current = event(3, "user.message", {"content": "Find the same record"})
    context = _reader_conversation_context([previous, result, current], current)
    assert context["previousIntent"]["recordIdentity"] == "REF-200"
    assert context["previousIntent"]["intentContext"]["slots"]["recordIdentity"]["source"] == "clear"


@pytest.mark.parametrize("question", [
    "From the transaction list, give me one Transaction No. and its status.",
    "Show me a single record with its status.",
    "Provide an example record and its status.",
    "Show the transactions and identify one Transaction No. without extra personal details.",
    "从列表给我一条记录及其状态。",
    "展示一笔交易和状态。",
    "أعطني رقم معاملة واحد وحالتها",
    "اعرض سجلا واحدا",
])
def test_explicit_one_record_list_can_support_find_same_follow_up(question):
    previous = event(1, "user.message", {"content": question})
    result = event(2, "reader.result", {
        "result": "success", "intentContext": intent(answerShape="list"),
        "answerShape": "list", "facts": ['{"Transaction No.": "TX-12345", "Status": "Paid"}'],
    })
    current = event(3, "user.message", {"content": "Find the same transaction"})
    context = _reader_conversation_context([previous, result, current], current)
    assert context["previousIntent"]["recordIdentity"] == "TX-12345"
    assert "facts" not in context["previousIntent"]
    assert "Paid" not in str(context)
    follow_up = intent("continue")
    follow_up["slots"]["recordIdentity"] = {"source": "previous", "value": "TX-12345", "evidence": "TX-12345"}
    parsed = parse_intent_resolution(follow_up, "Find the same transaction", context).public_json()
    assert parsed["slots"]["recordIdentity"] == follow_up["slots"]["recordIdentity"]
    assert parsed["slots"]["answerShape"] == {"source": "previous", "value": "list", "evidence": "list"}
    assert "facts" not in str(parsed) and "Paid" not in str(parsed)


def test_identify_one_account_retains_numeric_id_not_the_column_label():
    previous = event(1, "user.message", {"content": "Show the customer accounts and identify one Account ID without revealing extra personal details."})
    result = event(2, "reader.result", {
        "result": "success", "answerShape": "list", "intentContext": intent(answerShape="list"),
        "facts": ['{"Account ID": "2026090300001", "Name": "Example"}'],
    })
    current = event(3, "user.message", {"content": "Find that same account by its Account ID."})
    context = _reader_conversation_context([previous, result, current], current)
    assert context["previousIntent"]["recordIdentity"] == "2026090300001"
    assert "Example" not in str(context)


def test_requested_single_account_is_presented_as_one_record_before_context_selection():
    from app.service import _reader_select_requested_single_record
    question = 'Show the customer accounts and identify one Account ID without revealing extra personal details.'
    raw = {'result': 'success', 'answerShape': 'list', 'facts': [
        '{"Account ID":"2026090300001"}', '{"Account ID":"2026090100001"}',
    ]}
    selected = _reader_select_requested_single_record(raw, question)
    assert selected['facts'] == raw['facts'][:1]
    assert len(raw['facts']) == 2
    previous = event(1, 'user.message', {'content': question})
    current = event(3, 'user.message', {'content': 'Find that same account by its Account ID.'})
    context = _reader_conversation_context([previous, event(2, 'reader.result', selected), current], current)
    assert context['previousIntent']['recordIdentity'] == '2026090300001'


@pytest.mark.parametrize('question', ['Show all accounts', 'Show one month of accounts',
                                   'Show one account and three more', 'Show one account and the total'])
def test_single_presentation_does_not_narrow_other_requests(question):
    from app.service import _reader_select_requested_single_record
    result = {'result': 'success', 'answerShape': 'list', 'facts': [
        '{"Account ID":"2026090300001"}', '{"Account ID":"2026090100001"}',
    ]}
    assert _reader_select_requested_single_record(result, question) == result


@pytest.mark.parametrize("question", [
    "Show all transactions", "Show one month of transactions", "Show one day's tasks",
    "显示一个月的记录", "أعطني معاملات شهر واحد",
])
def test_broad_or_time_bounded_list_with_one_observed_row_does_not_acquire_identity(question):
    previous = event(1, "user.message", {"content": question})
    result = event(2, "reader.result", {
        "result": "success", "intentContext": intent(answerShape="list"),
        "answerShape": "list", "facts": ['{"Transaction No.": "TX-12345", "Status": "Paid"}'],
    })
    current = event(3, "user.message", {"content": "Which need attention?"})
    context = _reader_conversation_context([previous, result, current], current)
    assert "recordIdentity" not in context["previousIntent"]


def verified_attention():
    return {
        "result": "success", "answerShape": "attention", "page": "/dashboard",
        "section": "Needs Manager Attention", "sourceSection": "observation-table-001",
        "selectedState": "Blocked", "recordIdentity": "REF-OLD", "view": "Blocked",
        "filter": "old filter", "dateRange": "last week", "scope": "team",
        "facts": ["Urgent 0", "Blocked 4", "Private row detail"],
    }


def test_screenshot_attention_then_list_keeps_verified_focus_as_advisory_only():
    initial = event(1, "user.message", {"content": "What tasks show I pay attention?"})
    result = event(2, "reader.result", verified_attention())
    follow_up = event(3, "user.message", {"content": "show me the list"})
    context = _reader_conversation_context([initial, result, follow_up], follow_up)
    previous = context["previousIntent"]
    assert previous["businessFocus"] == "Needs Manager Attention"
    resolved = parse_intent_resolution(intent("refine", answerShape="list"), "show me the list", context)
    assert resolved.public_json()["slots"]["businessFocus"]["value"] == "Needs Manager Attention"
    assert resolved.planner_context(context)["sourceHint"] == {"page": "/dashboard", "section": "Needs Manager Attention"}
    assert "Private row detail" not in str(context)


def test_screenshot_failed_legacy_list_then_blocked_list_recovers_only_verified_focus():
    initial = event(1, "user.message", {"content": "What tasks show I pay attention?"})
    first_result = event(2, "reader.result", verified_attention())
    second = event(3, "user.message", {"content": "show me the list"})
    legacy = intent("refine", answerShape="list")
    legacy["slots"].pop("businessFocus")
    failed = event(4, "reader.result", {"result": "not_confirmed", "facts": [], "intentContext": legacy})
    current = event(5, "user.message", {"content": "show me the blocked task list"})
    context = _reader_conversation_context([initial, first_result, second, failed, current], current)
    previous = context["previousIntent"]
    assert previous["businessFocus"] == "Needs Manager Attention"
    assert previous["sourceHint"] == {"page": "/dashboard", "section": "Needs Manager Attention"}
    for name in ("recordIdentity", "view", "filter", "dateRange", "scope", "facts", "page"):
        assert name not in previous
    assert "REF-OLD" not in str(context) and "Private row detail" not in str(context)
    resolved = parse_intent_resolution(intent("refine", businessObject="task", view="blocked", answerShape="list"),
                                       "show me the blocked task list", context)
    assert resolved.public_json()["slots"]["businessFocus"]["value"] == "Needs Manager Attention"
    assert resolved.public_json()["slots"]["view"]["value"] == "blocked"


@pytest.mark.parametrize("boundary", [
    {"result": "not_confirmed", "intentContext": intent("switch")},
    {"result": "not_confirmed", "intentContext": intent("broaden")},
    {"result": "not_confirmed", "intentContext": intent("clarify")},
    {"result": "not_confirmed", "intentContext": {"relation": "refine", "slots": {"businessFocus": {
        "source": "clear", "value": "", "evidence": "all categories",
    }}}},
    {"result": "not_confirmed", "missing": ["intent_resolution_invalid"]},
    {"result": "not_confirmed", "missing": ["intent_resolution_timeout"]},
    {"result": "not_confirmed", "intentContext": "broken"},
    {"result": "not_confirmed", "intentContext": {"slots": []}},
    {"result": "not_confirmed", "intentContext": {"slots": {"businessFocus": []}}},
    ["not a result"],
])
def test_focus_history_recovery_stops_at_semantic_or_malformed_boundaries(boundary):
    history = [
        event(1, "user.message", {"content": "What needs attention?"}),
        event(2, "reader.result", verified_attention()),
        event(3, "user.message", {"content": "A different request"}),
        event(4, "reader.result", boundary),
        event(5, "user.message", {"content": "Show the list"}),
        event(6, "reader.result", {"result": "not_confirmed", "intentContext": intent("refine", answerShape="list")}),
        event(7, "user.message", {"content": "Try again"}),
    ]
    previous = _reader_conversation_context(history, history[-1])["previousIntent"]
    assert "businessFocus" not in previous and "sourceHint" not in previous
    assert "REF-OLD" not in str(previous)


@pytest.mark.parametrize("status", ["success", "no_data", "not_confirmed"])
def test_current_explicit_focus_clear_never_recreates_focus_from_own_or_older_section(status):
    cleared = intent("refine", answerShape="list")
    cleared["slots"]["businessFocus"] = {"source": "clear", "value": "", "evidence": "all categories"}
    result = {**verified_attention(), "result": status, "intentContext": cleared}
    history = [event(1, "user.message", {"content": "Show all categories"}), event(2, "reader.result", result),
               event(3, "user.message", {"content": "Show the list"})]
    previous = _reader_conversation_context(history, history[-1])["previousIntent"]
    assert "businessFocus" not in previous and "sourceHint" not in previous


@pytest.mark.parametrize("patch", [
    {"page": "http://[bad"}, {"page": "https://other.example/dashboard"},
    {"page": "//other.example/dashboard"}, {"page": "/dashboard?access_token=secret"},
    {"page": "/" + "x" * 241}, {"page": "password=secret"},
    {"section": "observation-table-001"}, {"section": "table-123"},
    {"section": "cookie=secret"}, {"section": "name\nmore"}, {"section": {"name": "Tasks"}},
])
def test_focus_anchor_rejects_bad_routes_technical_ids_and_credentials(patch):
    result = {**verified_attention(), **patch}
    assert _reader_focus_anchor(result) == {}


@pytest.mark.parametrize("candidate", [None, [], "bad", {"result": "not_confirmed"}])
def test_focus_anchor_rejects_non_verified_or_malformed_results(candidate):
    assert _reader_focus_anchor(candidate) == {}


def test_persisted_source_hint_is_revalidated_and_stripped_to_advisory_fields():
    history = [event(1, "user.message", {"content": "Show the list"}), event(2, "reader.result", {
        "result": "not_confirmed", "intentContext": intent("refine", answerShape="list"),
        "sourceHint": {"page": "/dashboard", "section": "Needs Manager Attention", "facts": ["old row"], "permissions": ["all"]},
    }), event(3, "user.message", {"content": "Try again"})]
    previous = _reader_conversation_context(history, history[-1])["previousIntent"]
    assert previous["sourceHint"] == {"page": "/dashboard", "section": "Needs Manager Attention"}
    assert previous["businessFocus"] == "Needs Manager Attention"
    assert "old row" not in str(previous) and "permissions" not in str(previous)
    history[1].event_json["sourceHint"]["page"] = "http://[bad"
    previous = _reader_conversation_context(history, history[-1])["previousIntent"]
    assert "sourceHint" not in previous


@pytest.mark.parametrize("persisted_hint", [False, True])
def test_changed_focus_after_failed_refine_does_not_recover_incompatible_old_section(persisted_hint):
    first = event(1, "user.message", {"content": "Show Pending work"})
    old_result = event(2, "reader.result", {
        "result": "success", "page": "/work", "section": "Pending work", "answerShape": "list",
    })
    second = event(3, "user.message", {"content": "Show Completed work"})
    failed_payload = {"result": "not_confirmed", "intentContext": intent("refine", businessFocus="Completed work", answerShape="list")}
    if persisted_hint:
        failed_payload["sourceHint"] = {"page": "/work", "section": "Pending work"}
    failed = event(4, "reader.result", failed_payload)
    current = event(5, "user.message", {"content": "show the list"})
    context = _reader_conversation_context([first, old_result, second, failed, current], current)
    assert context["previousIntent"]["businessFocus"] == "Completed work"
    assert "sourceHint" not in context["previousIntent"]
    resolved = parse_intent_resolution(intent("refine", answerShape="list"), "show the list", context)
    planner = resolved.planner_context(context)
    assert planner["resolvedIntent"]["slots"]["businessFocus"]["value"] == "Completed work"
    assert "Pending work" not in str(planner)


@pytest.mark.parametrize("facts", [["Task No. T-100 Pending"], ["Task No. T-100 Pending", "Task No. T-101 Pending"]])
def test_first_turn_list_does_not_implicitly_narrow_followup_to_first_identity(facts):
    history = [event(1, "user.message", {"content": "Show my task list"}), event(2, "reader.result", {
        "result": "success", "page": "/work", "section": "Tasks", "answerShape": "list", "facts": facts,
    }), event(3, "user.message", {"content": "show the list"})]
    context = _reader_conversation_context(history, history[-1])
    assert "recordIdentity" not in context["previousIntent"]
    resolved = parse_intent_resolution(intent("refine", answerShape="list"), "show the list", context)
    assert resolved.public_json()["slots"]["recordIdentity"]["value"] == ""
    assert "T-100" not in str(context) and "T-101" not in str(context)


@pytest.mark.parametrize("question,shape", [
    ("Show the first task's details", "detail"),
    ("Give me one task and its status", "list"),
    ("展示一条记录和状态", "list"),
])
def test_first_turn_explicit_single_result_keeps_identity_for_same_record(question, shape):
    history = [event(1, "user.message", {"content": question}), event(2, "reader.result", {
        "result": "success", "page": "/work", "section": "Tasks", "answerShape": shape,
        "facts": ["Task No. T-100 Pending"],
    }), event(3, "user.message", {"content": "Find the same record"})]
    context = _reader_conversation_context(history, history[-1])
    assert context["previousIntent"]["recordIdentity"] == "T-100"
    follow_up = intent("continue")
    resolved = parse_intent_resolution(follow_up, "Find the same record", context)
    assert resolved.public_json()["slots"]["recordIdentity"] == {"source": "previous", "value": "T-100", "evidence": "T-100"}
    assert "Pending" not in str(context) and "facts" not in context["previousIntent"]


@pytest.mark.parametrize("status,facts", [
    ("not_confirmed", ["Task No. T-100 Pending"]),
    ("success", ["Task No. T-100 Pending", "Task No. T-101 Pending"]),
])
def test_first_turn_detail_identity_requires_one_verified_fact(status, facts):
    history = [event(1, "user.message", {"content": "Show the task details"}), event(2, "reader.result", {
        "result": status, "page": "/work", "section": "Tasks", "answerShape": "detail", "facts": facts,
    }), event(3, "user.message", {"content": "Find the same record"})]
    assert "recordIdentity" not in _reader_conversation_context(history, history[-1])["previousIntent"]
