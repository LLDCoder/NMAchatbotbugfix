from copy import deepcopy

import pytest

from app.reader_intent import (
    SLOT_NAMES, clarification_question, format_clarification_options, parse_intent_resolution,
    semantic_source_hint,
)


CONTEXT = {"previousIntent": {
    "question": "Show current appeals for my team, including record REF-41",
    "businessObject": "appeals", "recordIdentity": "REF-41", "view": "To Do",
    "requestedScope": "team", "answerShape": "list", "page": "/old-page",
    "sourceSection": "Appeals", "facts": ["REF-99"],
}}


def plan(relation="continue", **slots):
    return {
        "relation": relation,
        "slots": {
            name: slots.get(name, {"source": "clear", "value": "", "evidence": ""})
            for name in SLOT_NAMES
        },
        "clarificationOptions": [],
    }


def slot(value, evidence=None, source="current"):
    return {"source": source, "value": value, "evidence": evidence or value}


@pytest.mark.parametrize("relation,question,slots", [
    ("continue", "Which of these need attention?", {
        "businessObject": slot("appeals", source="previous"),
        "answerShape": slot("attention"),
    }),
    ("refine", "How about the completed ones?", {
        "businessObject": slot("appeals", source="previous"),
        "view": slot("Completed", "completed"),
    }),
    ("switch", "What about refunds?", {"businessObject": slot("refunds")}),
    ("broaden", "Show all my tasks", {
        "businessObject": slot("tasks"), "requestedScope": slot("personal", "my"),
    }),
])
def test_relations_apply_condition_deltas_and_limit_advisory_source_hint(relation, question, slots):
    payload = plan(relation, **slots)
    resolution = parse_intent_resolution(payload, question, CONTEXT)
    resolved = resolution.public_json()
    for name, value in slots.items():
        assert resolved["slots"][name] == value
    if relation in {"continue", "refine"}:
        assert resolved["slots"]["businessFocus"] == slot("Appeals", source="previous")
        assert resolution.planner_context(CONTEXT)["sourceHint"] == {"page": "/old-page", "section": "Appeals"}
    else:
        assert "/old-page" not in str(resolution.planner_context(CONTEXT))
    public = resolution.public_json()
    public["slots"]["businessObject"]["value"] = "mutated"
    assert resolution.public_json() == resolved


def test_clarification_allows_cleared_slots_and_uses_fixed_localized_question():
    payload = plan("clarify")
    payload["clarificationOptions"] = ["the previous appeals", "all your tasks"]
    resolution = parse_intent_resolution(payload, "What tasks need attention?", CONTEXT)
    assert clarification_question(resolution, "en") == 'Do you mean "the previous appeals" or "all your tasks"?'
    assert "你指的是" in clarification_question(resolution, "zh")
    assert "هل تقصد" in clarification_question(resolution, "ar")
    assert clarification_question(resolution, "unknown") == clarification_question(resolution, "en")


def test_clarification_context_can_be_used_by_next_answer_without_old_page_or_facts():
    previous = plan("clarify", businessObject=slot("appeals", source="previous"))
    previous["clarificationOptions"] = ["the previous appeals", "all your tasks"]
    context = {"previousIntent": {"question": "What tasks need attention?", "intentContext": previous}}
    payload = plan("broaden", businessObject=slot("tasks", "all your tasks", "previous"))
    resolved = parse_intent_resolution(payload, "The second option", context)
    assert resolved.public_json() == payload
    assert resolved.planner_context(context)["resolvedChoiceOptions"] == previous["clarificationOptions"]
    assert "previousIntent" not in resolved.planner_context(context)


def test_unicode_and_whitespace_normalized_evidence():
    payload = plan("continue", businessObject=slot("appeals", "APPEALS"))
    assert parse_intent_resolution(payload, "Show\n ＡＰＰＥＡＬＳ", {}).public_json() == payload


@pytest.mark.parametrize("source,value,evidence,question,context", [
    ("current", "REF-42", "REF-42", "Find REF-42", CONTEXT),
    ("previous", "REF-41", "record REF-41", "Find the same record", CONTEXT),
    ("previous", "REF-41", "REF-41", "Find it", {"previousIntent": {
        "intentContext": plan(recordIdentity=slot("REF-41")),
    }}),
])
def test_record_identity_is_bound_to_current_literal_or_known_previous_identity(source, value, evidence, question, context):
    payload = plan(recordIdentity=slot(value, evidence, source))
    assert parse_intent_resolution(payload, question, context).public_json()["slots"]["recordIdentity"] == payload["slots"]["recordIdentity"]


@pytest.mark.parametrize("value,evidence,source,question", [
    ("REF-99", "appeals", "previous", "Find it"),
    ("REF-42", "same", "current", "Find the same record"),
    ("REF-41", "Find it", "previous", "Find it"),
    ("REF-4", "REF-41", "current", "Find REF-41"),
])
def test_invented_or_unbound_record_identity_is_rejected(value, evidence, source, question):
    with pytest.raises(ValueError):
        parse_intent_resolution(plan(recordIdentity=slot(value, evidence, source)), question, CONTEXT)


@pytest.mark.parametrize("change", [
    lambda p: p.pop("slots"),
    lambda p: p.update(permissions=["admin"]),
    lambda p: p.update(relation="inherit_all"),
    lambda p: p["slots"].pop("filter"),
    lambda p: p["slots"].update(page=slot("/old-page")),
    lambda p: p["slots"].update(filter={"source": "history", "value": "a", "evidence": "a"}),
    lambda p: p["slots"].update(filter={"source": "clear", "value": "a", "evidence": ""}),
    lambda p: p["slots"].update(filter={"source": "clear", "value": "", "evidence": "not requested"}),
    lambda p: p["slots"].update(filter={"source": "unspecified", "value": "a", "evidence": ""}),
    lambda p: p["slots"].update(filter={"source": "unspecified", "value": "", "evidence": "a"}),
    lambda p: p["slots"].update(filter={"source": "current", "value": "", "evidence": "a"}),
    lambda p: p["slots"].update(filter={"source": "current", "value": "a"}),
    lambda p: p["slots"].update(filter={**slot("a"), "permissions": "all"}),
    lambda p: p["slots"].update(filter=slot("x" * 241, "a")),
    lambda p: p["slots"].update(filter=slot("a", "x" * 501)),
    lambda p: p["slots"].update(requestedScope=slot("admin", "a")),
    lambda p: p["slots"].update(answerShape=slot("export", "a")),
    lambda p: p.update(clarificationOptions=["first", "second"]),
])
def test_closed_schema_and_bounds(change):
    payload = plan()
    change(payload)
    with pytest.raises(ValueError):
        parse_intent_resolution(payload, "a", CONTEXT)


@pytest.mark.parametrize("evidence", ["/old-page", "Appeals sourceSection", "REF-99", "invented"])
def test_prior_navigation_and_fact_bundle_cannot_supply_provenance(evidence):
    with pytest.raises(ValueError):
        parse_intent_resolution(plan(filter=slot("filtered", evidence, "previous")), "Continue", CONTEXT)


@pytest.mark.parametrize("options", [
    [], ["one"], ["one", "two", "three"], ["one", "ONE"],
    ["line\nbreak", "two"], ["https://example.com", "two"],
    ["<b>one</b>", "two"], ["```one```", "two"], ["password=secret123", "two"],
    ["x" * 121, "two"], ["hidden\u202e", "two"],
    ["mailto:person@example.com", "two"], ["javascript:alert(1)", "two"],
])
def test_unsafe_or_invalid_clarification_options_are_rejected(options):
    payload = plan("clarify")
    payload["clarificationOptions"] = options
    with pytest.raises(ValueError):
        parse_intent_resolution(payload, "Which tasks?", CONTEXT)


def test_previous_credential_like_metadata_cannot_be_inherited():
    context = deepcopy(CONTEXT)
    context["previousIntent"]["filter"] = "password=not-a-real-secret"
    with pytest.raises(ValueError):
        parse_intent_resolution(plan(filter=slot("secret", "password=not-a-real-secret", "previous")), "Continue", context)


def test_non_clarifying_resolution_cannot_render_clarification():
    with pytest.raises(ValueError):
        clarification_question(parse_intent_resolution(plan(), "Continue", {}), "en")


def test_standalone_formatter_revalidates_labels_without_needing_provenance():
    assert format_clarification_options(("these appeals", "all tasks"), "en") == 'Do you mean "these appeals" or "all tasks"?'
    with pytest.raises(ValueError):
        format_clarification_options(("<script>bad</script>", "all tasks"), "en")


@pytest.mark.parametrize("omitted_source", ["unspecified", "clear"])
def test_format_only_list_retains_confirmed_focus_view_and_filter(omitted_source):
    context = {"previousIntent": {
        "question": "What tasks need attention?", "businessObject": "tasks",
        "businessFocus": "Needs Manager Attention", "view": "Blocked",
        "filter": "waiting on customer", "answerShape": "attention",
        "page": "/dashboard", "section": "Needs Manager Attention",
    }}
    payload = plan("refine", answerShape=slot("list"))
    for name in SLOT_NAMES:
        if name != "answerShape":
            payload["slots"][name] = {"source": omitted_source, "value": "", "evidence": ""}
    resolved = parse_intent_resolution(payload, "show me the list", context)
    slots = resolved.public_json()["slots"]
    for name in ("businessObject", "businessFocus", "view", "filter"):
        assert slots[name] == slot(context["previousIntent"][name], source="previous")
    assert slots["recordIdentity"]["value"] == ""
    assert slots["answerShape"] == slot("list")
    planner = resolved.planner_context(context)
    assert planner["sourceHint"] == {"page": "/dashboard", "section": "Needs Manager Attention"}
    assert "question" not in planner and "previousIntent" not in planner


def test_explicit_clear_is_grounded_in_current_request_and_not_reinherited():
    context = deepcopy(CONTEXT)
    context["previousIntent"]["filter"] = "Blocked"
    payload = plan("refine", filter={"source": "clear", "value": "", "evidence": "without that filter"})
    resolved = parse_intent_resolution(payload, "Show the list without that filter", context)
    assert resolved.public_json()["slots"]["filter"] == payload["slots"]["filter"]
    assert resolved.public_json()["slots"]["businessObject"]["value"] == "appeals"


@pytest.mark.parametrize("relation", ["switch", "broaden"])
def test_switch_and_broaden_do_not_restore_old_focus_or_navigation_hint(relation):
    payload = plan(relation, businessObject=slot("tasks"), businessFocus=slot("Appeals", source="previous"))
    resolved = parse_intent_resolution(payload, "Show all tasks", CONTEXT)
    assert resolved.public_json()["slots"]["businessFocus"] == {"source": "unspecified", "value": "", "evidence": ""}
    assert resolved.public_json()["slots"]["recordIdentity"]["value"] == ""
    assert "sourceHint" not in resolved.planner_context(CONTEXT)


def test_legacy_seven_slot_payload_is_accepted_and_focus_recovered_from_human_section():
    payload = plan("refine", answerShape=slot("list"))
    payload["slots"].pop("businessFocus")
    resolved = parse_intent_resolution(payload, "show me the list", CONTEXT)
    assert resolved.public_json()["slots"]["businessFocus"] == slot("Appeals", source="previous")
    assert set(resolved.public_json()["slots"]) == set(SLOT_NAMES)


@pytest.mark.parametrize("section", ["observation-table-001", "observation-region-7", "table-123", "/dashboard"])
def test_technical_section_ids_are_neither_business_focus_nor_provenance(section):
    context = {"previousIntent": {"sourceSection": section, "page": "/dashboard"}}
    resolved = parse_intent_resolution(plan("refine"), "List them", context)
    assert resolved.public_json()["slots"]["businessFocus"]["value"] == ""
    assert semantic_source_hint(context) == {"page": "/dashboard"}
    with pytest.raises(ValueError):
        parse_intent_resolution(plan(businessFocus=slot(section, source="previous")), "List them", context)


def test_explicit_focus_clear_or_new_focus_drops_old_source_hint():
    cleared = {"source": "clear", "value": "", "evidence": "not just Appeals"}
    resolved = parse_intent_resolution(plan("refine", businessFocus=cleared), "Show tasks, not just Appeals", CONTEXT)
    assert "sourceHint" not in resolved.planner_context(CONTEXT)
    resolved = parse_intent_resolution(plan("refine", businessFocus=slot("Refunds")), "Show Refunds", CONTEXT)
    assert "sourceHint" not in resolved.planner_context(CONTEXT)


def test_source_hint_is_bounded_and_does_not_forward_authority_or_facts():
    context = {"previousIntent": {"sourceHint": {
        "page": "/dashboard", "section": "Needs Manager Attention",
        "permissions": ["all"], "facts": ["one", "two"],
    }}}
    assert semantic_source_hint(context) == {"page": "/dashboard", "section": "Needs Manager Attention"}
    context["previousIntent"]["sourceHint"]["page"] = "//untrusted.example"
    assert semantic_source_hint(context) == {"section": "Needs Manager Attention"}


def test_auto_inheritance_does_not_infer_record_identity_from_fact_bundles():
    context = {"previousIntent": {"businessObject": "tasks", "facts": [{"value": "REF-99"}]}}
    resolved = parse_intent_resolution(plan("continue"), "Show its details", context)
    assert resolved.public_json()["slots"]["recordIdentity"]["value"] == ""


def test_previous_explicit_clear_overrides_stale_top_level_value():
    context = deepcopy(CONTEXT)
    context["previousIntent"]["intentContext"] = plan("refine", businessFocus={
        "source": "clear", "value": "", "evidence": "all categories",
    })
    resolved = parse_intent_resolution(plan("continue"), "Show a list", context)
    assert resolved.public_json()["slots"]["businessFocus"]["value"] == ""
    assert "sourceHint" not in resolved.planner_context(context)


def test_human_source_hint_section_can_supply_focus_provenance():
    context = {"previousIntent": {"sourceHint": {"page": "/dashboard", "section": "Needs Manager Attention"}}}
    payload = plan("refine", businessFocus=slot("Needs Manager Attention", source="previous"))
    resolved = parse_intent_resolution(payload, "Show that list", context)
    assert resolved.public_json()["slots"]["businessFocus"] == payload["slots"]["businessFocus"]


def test_previous_explicit_identity_clear_does_not_allow_stale_identity_inheritance():
    context = deepcopy(CONTEXT)
    context["previousIntent"]["intentContext"] = plan("refine", recordIdentity={
        "source": "clear", "value": "", "evidence": "all records",
    })
    with pytest.raises(ValueError):
        parse_intent_resolution(plan(recordIdentity=slot("REF-41", source="previous")), "Show it", context)


def test_observed_result_scope_is_not_an_inherited_requested_ownership():
    from app.reader_intent import bind_literal_intent_quotes
    context={'previousIntent':{'question':'What does service satisfaction show?', 'scope':'global'}}
    payload=plan('refine', requestedScope=slot('global', source='previous'),
                 answerShape=slot('overview', evidence='summary'))
    question='Show a bounded current summary of service satisfaction, without emails or mobile numbers.'
    repaired=bind_literal_intent_quotes(payload,question,context)
    resolved=parse_intent_resolution(repaired,question,context).public_json()
    assert resolved['slots']['requestedScope']['source']=='unspecified'
    assert resolved['slots']['answerShape']==payload['slots']['answerShape']
    assert payload['slots']['requestedScope']['value']=='global'


@pytest.mark.parametrize('prior',[
    {'question':'Show global totals.', 'scope':'global'},
    {'question':'Show records.', 'scope':'global', 'requestedScope':'global'},
])
def test_real_requested_scope_survives_observed_scope_repair(prior):
    from app.reader_intent import bind_literal_intent_quotes
    payload=plan('continue',requestedScope=slot('global',source='previous'))
    assert bind_literal_intent_quotes(payload,'Show the summary.',{'previousIntent':prior})==payload


def test_unrelated_invalid_ownership_still_fails_validation():
    from app.reader_intent import bind_literal_intent_quotes
    context={'previousIntent':{'question':'What do the metrics mean?', 'scope':'global'}}
    payload=plan('continue',requestedScope=slot('personal',source='previous'))
    repaired=bind_literal_intent_quotes(payload,'Show the summary.',context)
    with pytest.raises(ValueError):parse_intent_resolution(repaired,'Show the summary.',context)
