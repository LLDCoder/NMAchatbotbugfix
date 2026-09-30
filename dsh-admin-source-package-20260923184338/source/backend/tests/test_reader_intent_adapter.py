import asyncio
import json

import httpx
import pytest

from app.config import Settings
from app.llm import LLMAdapter
from app.llm import _bind_explicit_list_request
from app.reader_intent import SLOT_NAMES


def _intent_result():
    slots = {
        name: {"source": "unspecified", "value": "", "evidence": ""}
        for name in SLOT_NAMES
    }
    slots["answerShape"] = {"source": "current", "value": "attention", "evidence": "attention"}
    return {"relation": "broaden", "slots": slots, "clarificationOptions": []}


def _adapter(monkeypatch, bodies, *, status=200):
    captured = []
    responses = iter(bodies)
    original_client = httpx.AsyncClient

    async def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(status, json=next(responses))

    def client_factory(**kwargs):
        return original_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", client_factory)
    adapter = LLMAdapter(Settings(
        _env_file=None,
        llm_base_url="https://llm.example.test",
        llm_api_key="test-key",
        llm_model="test-model",
    ))
    return adapter, captured


def _response(content):
    return {"choices": [{"message": {"content": content}}]}


def test_explicit_view_data_request_overrides_inherited_count_shape():
    candidate = _intent_result()
    candidate['slots']['answerShape'] = {
        'source': 'previous', 'value': 'count', 'evidence': 'count',
    }
    resolved = _bind_explicit_list_request(
        candidate, 'I now want to view the data in Final Approval',
    )
    assert resolved['slots']['answerShape'] == {
        'source': 'current', 'value': 'list', 'evidence': 'view',
    }


def test_intent_resolver_preserves_original_question_and_bounded_semantic_context(monkeypatch):
    question = "  Which of all my tasks need attention?\n"
    context = {"previousIntent": {
        "question": "Show pending enquiries",
        "intentContext": {"businessObject": "enquiries", "view": "pending"},
        "clarificationOptions": ["Previous enquiries", "All my tasks"],
    }}
    expected = _intent_result()
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(expected))])

    result = asyncio.run(adapter.resolve_admin_portal_intent(question, context))

    assert result == expected
    assert len(requests) == 1
    request = requests[0]
    assert json.loads(request["messages"][-1]["content"]) == {
        "question": question, "conversationContext": context,
    }
    assert request["model"] == "test-model"
    assert request["thinking"] == {"type": "disabled"}
    assert request["temperature"] == 0
    assert request["max_tokens"] == 1_400
    assert request["stream"] is False
    assert request["response_format"] == {"type": "json_object"}
    assert "tools" not in request
    prompt = request["messages"][0]["content"]
    assert "exact nonempty substring of the original current question" in prompt
    assert "source=previous" in prompt
    assert "All eight slots are required even when unspecified" in prompt
    assert "Omission is not removal" in prompt
    assert "businessFocus" in prompt
    assert "untrusted user-conversation data" in prompt
    assert "NEVER grants permissions" in prompt
    assert "only omitted conditions compatible with the current request" in prompt
    assert "must clear the old narrow business object" in prompt
    assert "not a confidence score" in prompt
    assert "exactly two distinct concise plain-string alternatives" in prompt
    assert "do not ask the same clarification repeatedly" in prompt
    assert "Never cite a page route, technical section ID" in prompt
    assert "An enum value is not its evidence" in prompt


@pytest.mark.parametrize("question,shape,quote", [
    ("Clear that task search and show three queued tasks again.", "list", "show"),
    ("Show me three records.", "list", "Show"),
    ("Please display these items.", "list", "display"),
    ("How many items are visible?", "count", "How many"),
    ("Find that same record again.", "detail", "Find"),
])
def test_enum_echo_is_bound_to_an_explicit_command_without_another_model_call(monkeypatch, question, shape, quote):
    candidate = _intent_result()
    candidate["slots"]["answerShape"] = {"source": "current", "value": shape, "evidence": shape}
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(candidate))])
    result = asyncio.run(adapter.resolve_admin_portal_intent(question, {}))
    assert result["slots"]["answerShape"] == {"source": "current", "value": shape, "evidence": quote}
    assert candidate["slots"]["answerShape"]["evidence"] == shape
    assert len(requests) == 1


@pytest.mark.parametrize("question,source,evidence", [
    ("Do not show these records.", "current", "list"),
    ("Explain what show means.", "current", "list"),
    ('The caption says "show records".', "current", "list"),
    ("Show records.", "previous", "list"),
    ("Show records.", "current", "invented evidence"),
    ("Which records are these?", "current", "list"),
])
def test_enum_quote_repair_does_not_bypass_other_provenance_failures(monkeypatch, question, source, evidence):
    candidate = _intent_result()
    candidate["slots"]["answerShape"] = {"source": source, "value": "list", "evidence": evidence}
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(candidate))] * 2)
    with pytest.raises(ValueError, match="absent from its declared source"):
        asyncio.run(adapter.resolve_admin_portal_intent(question, {}))
    assert len(requests) == 2


def test_enum_quote_repair_never_repairs_record_identity(monkeypatch):
    candidate = _intent_result()
    candidate["slots"]["answerShape"] = {"source": "current", "value": "list", "evidence": "list"}
    candidate["slots"]["recordIdentity"] = {"source": "current", "value": "REF-999", "evidence": "records"}
    adapter, _ = _adapter(monkeypatch, [_response(json.dumps(candidate))] * 2)
    with pytest.raises(ValueError, match="record identity is absent"):
        asyncio.run(adapter.resolve_admin_portal_intent("Show records.", {}))


def test_intent_resolver_does_not_truncate_original_question(monkeypatch):
    question = "x" * 10_001 + " attention"
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(_intent_result()))])

    asyncio.run(adapter.resolve_admin_portal_intent(question, {}))

    assert json.loads(requests[0]["messages"][-1]["content"])["question"] == question


@pytest.mark.parametrize("question", [
    "Find that same account by its Account ID.", "Find the same account.",
])
def test_explicit_same_selected_record_does_not_need_a_model_call(monkeypatch, question):
    adapter, requests = _adapter(monkeypatch, [])
    context = {"previousIntent": {"question": "Show accounts and identify one Account ID", "recordIdentity": "2026090300001"}}
    result = asyncio.run(adapter.resolve_admin_portal_intent(question, context))
    assert result['slots']['recordIdentity']['value'] == '2026090300001'
    assert result['slots']['answerShape']['value'] == ('list' if 'by its' in question else 'detail')
    assert requests == []


@pytest.mark.parametrize('question,context', [
    ('Find that same account by its Account ID.', {}),
    ('Find that same account by its Account ID.', {'previousIntent': {'question': 'Show tasks', 'recordIdentity': 'TASK-123'}}),
    ('Do not find that same account.', {'previousIntent': {'question': 'Show accounts', 'recordIdentity': 'ACC-123'}}),
    ('Find that same account in another department.', {'previousIntent': {'question': 'Show accounts', 'recordIdentity': 'ACC-123'}}),
    ('Find that same account by its External ID.', {'previousIntent': {'question': 'Show accounts and identify one Account ID', 'recordIdentity': 'ACC-123'}}),
    ('Find that same account by its Account ID.', {'previousIntent': {'question': 'Show accounts', 'intentContext': {'slots': {'recordIdentity': {'source': 'clear', 'value': '', 'evidence': 'clear'}}}}}),
])
def test_literal_reference_does_not_guess_identity_or_ignore_additional_constraints(question, context):
    from app.reader_intent import resolve_literal_same_record_reference
    assert resolve_literal_same_record_reference(question, context) is None


def test_intent_resolver_accepts_one_fenced_object(monkeypatch):
    expected = _intent_result()
    adapter, requests = _adapter(monkeypatch, [_response("```json\n" + json.dumps(expected) + "\n```")])

    assert asyncio.run(adapter.resolve_admin_portal_intent("attention", {})) == expected
    assert len(requests) == 1


def test_intent_syntax_retry_does_not_replay_invalid_model_output(monkeypatch):
    marker = "INVALID-MODEL-OUTPUT-DO-NOT-REPLAY"
    expected = _intent_result()
    adapter, requests = _adapter(monkeypatch, [
        _response(marker), _response(json.dumps(expected)),
    ])

    assert asyncio.run(adapter.resolve_admin_portal_intent("attention", {})) == expected
    assert len(requests) == 2
    assert marker not in json.dumps(requests[1])
    assert [item["role"] for item in requests[1]["messages"][-2:]] == ["system", "user"]
    assert "Retry the same intent-resolution request" in requests[1]["messages"][-1]["content"]
    assert '"question": "attention"' in requests[1]["messages"][-1]["content"]


def test_list_synonym_uses_actual_current_word_as_evidence(monkeypatch):
    expected = _intent_result()
    expected["relation"] = "refine"
    expected["slots"]["answerShape"] = {"source": "current", "value": "list", "evidence": "Show"}
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(expected))])
    result = asyncio.run(adapter.resolve_admin_portal_intent("Show me up to five of those cases.", {}))
    assert result["slots"]["answerShape"]["evidence"] == "Show"
    examples = [json.loads(message["content"]) for message in requests[0]["messages"] if message["role"] == "assistant"]
    assert any(example["slots"]["answerShape"] == expected["slots"]["answerShape"] for example in examples)


@pytest.mark.parametrize("question,options", [
    ("Which member and date criteria are present?", ["member criteria", "date criteria"]),
    ("Show account and profile fields", ["profile fields", "account fields"]),
])
def test_intent_retries_clarification_that_splits_explicit_conjunction(monkeypatch, question, options):
    expected = {"relation": "refine", "slots": {
        name: {"source": "unspecified", "value": "", "evidence": ""} for name in SLOT_NAMES
    }, "clarificationOptions": []}
    invalid = {**expected, "relation": "clarify", "clarificationOptions": options}
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(invalid)), _response(json.dumps(expected))])
    assert asyncio.run(adapter.resolve_admin_portal_intent(question, {})) == expected
    assert len(requests) == 2
    assert "preserve both requested criteria" in requests[1]["messages"][-2]["content"]


@pytest.mark.parametrize("question,options", [
    ("Show account and profile fields for my team or everyone", ["my team", "everyone"]),
    ("Which member or date criteria should I use?", ["member criteria", "date criteria"]),
    ("Compare fields and then show my work", ["all work", "previous work"]),
])
def test_other_scope_clarifications_remain_valid(question, options):
    from app.reader_intent import parse_intent_resolution

    payload = {"relation": "clarify", "slots": {
        name: {"source": "unspecified", "value": "", "evidence": ""} for name in SLOT_NAMES
    }, "clarificationOptions": options}
    assert parse_intent_resolution(payload, question, {}).relation == "clarify"


@pytest.mark.parametrize("content,error", [
    ("[]", ValueError),
    ('{"one":1} {"two":2}', json.JSONDecodeError),
    ("not JSON", json.JSONDecodeError),
    ("", ValueError),
])
def test_intent_resolver_stops_after_two_invalid_outputs(monkeypatch, content, error):
    adapter, requests = _adapter(monkeypatch, [_response(content), _response(content)])

    with pytest.raises(error):
        asyncio.run(adapter.resolve_admin_portal_intent("attention", {}))

    assert len(requests) == 2


def test_intent_resolver_does_not_retry_http_failures(monkeypatch):
    adapter, requests = _adapter(monkeypatch, [{"error": "unavailable"}], status=503)

    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(adapter.resolve_admin_portal_intent("attention", {}))

    assert len(requests) == 1


def test_intent_resolver_retries_closed_schema_errors_not_only_json_syntax(monkeypatch):
    expected = _intent_result()
    adapter, requests = _adapter(monkeypatch, [
        _response(json.dumps({"relation": "continue"})), _response(json.dumps(expected)),
    ])
    assert asyncio.run(adapter.resolve_admin_portal_intent("attention", {})) == expected
    assert len(requests) == 2
    assert "intent resolution has unexpected or missing keys" in requests[1]["messages"][-2]["content"]


def test_intent_examples_demonstrate_valid_clarification_and_state_replacement(monkeypatch):
    from app.reader_intent import parse_intent_resolution

    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(_intent_result()))])
    asyncio.run(adapter.resolve_admin_portal_intent("attention", {}))
    messages = requests[0]["messages"]
    examples = {}
    for index in range(1, len(messages) - 1, 2):
        sample = json.loads(messages[index]["content"])
        answer = json.loads(messages[index + 1]["content"])
        parse_intent_resolution(answer, sample["question"], sample["conversationContext"])
        examples[sample["question"]] = answer
    assert examples["What work needs attention?"]["relation"] == "clarify"
    assert examples["How about the completed ones?"]["slots"]["view"]["value"] == "Completed"
    assert examples["show me the list"]["slots"]["businessFocus"]["value"] == "Needs Review"
    assert examples["show me the blocked task list"]["slots"]["filter"]["value"] == "Blocked"


def test_adapter_returns_normalized_omissions_not_raw_model_clears(monkeypatch):
    candidate = _intent_result()
    candidate["relation"] = "refine"
    candidate["slots"].pop("businessFocus")
    candidate["slots"]["answerShape"] = {"source": "current", "value": "list", "evidence": "list"}
    context = {"previousIntent": {"businessFocus": "Needs Review", "answerShape": "attention"}}
    adapter, _ = _adapter(monkeypatch, [_response(json.dumps(candidate))])
    result = asyncio.run(adapter.resolve_admin_portal_intent("show me the list", context))
    assert result["slots"]["businessFocus"] == {
        "source": "previous", "value": "Needs Review", "evidence": "Needs Review",
    }
    assert result["slots"]["answerShape"]["value"] == "list"


@pytest.mark.parametrize('question', ['How about the completed applications?', 'What about completed applications?'])
def test_literal_view_followup_retains_prior_object_without_model_call(question):
    adapter = LLMAdapter(Settings(_env_file=None, llm_base_url='', llm_api_key=''))
    context = {'previousIntent': {'question': 'Show the application queue.', 'businessObject': 'Applications',
                                 'businessFocus': 'My Application Tasks', 'answerShape': 'list', 'view': 'To Do'}}
    result = asyncio.run(adapter.resolve_admin_portal_intent(question, context))
    assert result['relation'] == 'refine'
    assert result['slots']['businessObject']['value'] == 'Applications'
    assert result['slots']['businessFocus']['value'] == 'My Application Tasks'
    assert result['slots']['view']['source'] == 'current'
    assert result['slots']['view']['value'] == 'completed'


@pytest.mark.parametrize('question,identity', [
    ('How about completed refunds?', ''), ('How about completed applications today?', ''),
    ('How about completed applications?', 'REF-1'),
])
def test_complex_or_changed_view_followups_still_need_normal_resolution(question, identity):
    from app.reader_intent import resolve_literal_view_followup
    context = {'previousIntent': {'question': 'Show applications.', 'answerShape': 'list', 'recordIdentity': identity}}
    assert resolve_literal_view_followup(question, context) is None


def test_same_record_reference_accepts_prior_multiword_business_object():
    adapter = LLMAdapter(Settings(_env_file=None, llm_base_url='', llm_api_key=''))
    context = {'previousIntent': {'question': 'Give me one Task No. from the queued task list.',
        'businessObject': 'Inspection Task', 'businessFocus': 'Queued Tasks', 'recordIdentity': 'REF-1', 'answerShape': 'detail'}}
    result = asyncio.run(adapter.resolve_admin_portal_intent('Find that same inspection task by its Task No.', context))
    assert result['slots']['recordIdentity']['value'] == 'REF-1'


def test_same_record_qualifier_can_match_prior_route_without_using_route_as_evidence():
    adapter = LLMAdapter(Settings(_env_file=None, llm_base_url='', llm_api_key=''))
    context = {'previousIntent': {'question': 'Give me one Task No. from the queued task list.',
        'page': '/inspection/tasks', 'section': 'Queued Tasks', 'recordIdentity': 'REF-1', 'answerShape': 'detail'}}
    result = asyncio.run(adapter.resolve_admin_portal_intent('Find that same inspection task by its Task No.', context))
    assert result['slots']['recordIdentity']['value'] == 'REF-1'
    assert all('/inspection/tasks' not in slot['evidence'] for slot in result['slots'].values())


@pytest.mark.parametrize('page', ['', '/customer/tasks', '/inspection-records/tasks'])
def test_same_record_qualifier_cannot_switch_domain_or_use_a_partial_route_match(page):
    from app.reader_intent import resolve_literal_same_record_reference
    context = {'previousIntent': {'question': 'Give me one Task No. from the queued task list.',
        'page': page, 'section': 'Queued Tasks', 'recordIdentity': 'REF-1', 'answerShape': 'detail'}}
    assert resolve_literal_same_record_reference('Find that same inspection task by its Task No.', context) is None


def test_unconfigured_intent_resolver_fails_without_network():
    adapter = LLMAdapter(Settings(_env_file=None, llm_base_url="", llm_api_key=""))

    with pytest.raises(RuntimeError, match="intent resolver is not configured"):
        asyncio.run(adapter.resolve_admin_portal_intent("attention", {}))


@pytest.mark.parametrize("reference", ["", "Manual list title", "observation-region-999"])
def test_page_planner_repairs_missing_or_invented_evidence_reference(monkeypatch, reference):
    candidate = {"mode": "observation_result", "result": "success", "sourceSection": reference,
                 "facts": ["REF-1 Open"], "answerShape": "list"}
    corrected = {**candidate, "sourceSection": "observation-table-001"}
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(candidate)), _response(json.dumps(corrected))])
    knowledge = {"portalObservation": {"sectionSummaries": [{
        "nodeId": "observation-table-001", "rowSummaries": ["REF-1 Open"],
    }]}}
    assert asyncio.run(adapter.plan_admin_portal_read("Show records", {}, knowledge)) == corrected
    assert len(requests) == 2
    assert "EXISTING nodeId" in requests[1]["messages"][-2]["content"]
    assert "REF-1 Open" not in requests[1]["messages"][-2]["content"]


def test_reference_repair_does_not_invent_a_node_on_second_failure(monkeypatch):
    candidate = {"mode": "observation_result", "result": "success", "sourceSection": "missing"}
    adapter, requests = _adapter(monkeypatch, [_response(json.dumps(candidate))] * 2)
    with pytest.raises(ValueError, match="sourceSection"):
        asyncio.run(adapter.plan_admin_portal_read("Show records", {}, {
            "portalObservation": {"sectionSummaries": [{"nodeId": "observation-table-001"}]},
        }))
    assert len(requests) == 2


def test_page_planner_obeys_resolved_intent_instead_of_historical_page(monkeypatch):
    context = {
        "previousIntent": {"page": "/prior-page", "answerShape": "list"},
        "resolvedIntent": _intent_result(),
    }
    adapter, requests = _adapter(monkeypatch, [_response('{"mode":"portal_read","portalRequest":{}}')])

    asyncio.run(adapter.plan_admin_portal_read("attention", {}, {}, context))

    prompt = requests[0]["messages"][0]["content"]
    assert "Raw historical context must not override this resolved current task" in prompt
    assert "refill a cleared slot" in prompt
    assert "previous page is only an advisory entry hint" in prompt
    assert "A label alone does not override the current page" not in prompt
    assert "attention requires evidence of why an item needs attention" in prompt
    assert "A list can support attention" in prompt
    assert json.loads(requests[0]["messages"][1]["content"])["conversationContext"] == context


def test_intent_completion_review_requires_evidence_not_answer_shape_relabeling(monkeypatch):
    adapter, requests = _adapter(monkeypatch, [_response('{"mode":"observation_result","result":"not_confirmed"}')])
    knowledge = {
        "portalObservation": {"tables": []},
        "planningDirective": {
            "intentCompletionReview": True,
            "requestedAnswerShape": "attention",
            "priorCandidate": {"answerShape": "list"},
        },
    }

    asyncio.run(adapter.plan_admin_portal_read("attention", {}, knowledge, {"resolvedIntent": _intent_result()}))

    prompt = requests[0]["messages"][0]["content"]
    assert "Intent completion review" in prompt
    assert "Do not merely relabel an unsupported ordinary list as attention" in prompt
    assert "continue a documented permitted read within the budget" in prompt
    assert "Never restore a historical scope cleared by resolvedIntent" in prompt
    assert "has ALREADY been resolved" in prompt
    data = json.loads(requests[0]["messages"][1]["content"])
    assert data["originalQuestion"] == "attention"
    assert data["question"].startswith("Resolved task:")
    assert data["currentTask"] == {"answerShape": "attention"}
