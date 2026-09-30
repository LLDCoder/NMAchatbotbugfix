"""Context regressions use synthetic pages/records; no business endpoint calls."""
import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest

from pydantic import ValidationError

from app.generic_reader import GenericKnowledgeReader, render_generic_answer, safe_text, semantic_history
from app.generic_reader_contracts import TaskSpec
from app.reader_context import (ReaderPageContext, bind_history, clock_context, context_from_state,
                                literal_choice, load_catalog, merge_task, page_hint, refine_task, save_intent)
from app.schemas import MessageCreate, WSMessage
from app.service import _reader_conversation_context
from app.principal import Principal
from test_generic_reader_v3 import Gateway, Planner


def task(**changes):
    data = dict(stage="task", businessObject="crystals", businessFocus="open", requestedScope="team",
                requestedGrain="crystal", requestedMeasures=["count"], groupBy=["status"],
                timeRange="next 30 days", filters=["color=blue"], outputShape="list", needsLiveData=True,
                readOnly=True, searchQuery="team crystals next thirty days", unresolvedSlots=[],
                recordIdentity="CR-123", view="To Do")
    return TaskSpec.model_validate({**data, **changes})


def history_for(value=None, question="Show my crystals."):
    value = merge_task(value or task(), {})
    state = save_intent(value, question, {}, "r1", "principal", "catalog", clock_context("UTC"))
    return semantic_history(context_from_state({"intentState": state}, question))


class ContextTests(unittest.TestCase):
    def test_long_current_question_retains_tail_and_redaction(self):
        question = "Describe the collection. " * 280 + "Only include CR-TAIL-999. Bearer token-secret"
        result = safe_text(question)
        self.assertIn("CR-TAIL-999", result)
        self.assertNotIn("token-secret", result)
        self.assertGreater(len(result), 6000)

    def test_long_prior_question_is_not_truncated_by_service_or_projection(self):
        question = "Prior condition. " * 400 + "TEAM-TAIL-123"
        state = save_intent(task(), question, {}, "r1", "principal", "catalog", clock_context("UTC"))
        events = [SimpleNamespace(event_type="user.message", event_json={"content": question}),
                  SimpleNamespace(event_type="reader.result", event_json={"intentState": state}),
                  SimpleNamespace(event_type="user.message", event_json={"content": "Group those by status"})]
        result = semantic_history(_reader_conversation_context(events, events[-1]))
        self.assertEqual(result["previousIntent"]["question"], question)
        self.assertEqual(result["previousIntent"]["requestedMeasures"], ["count"])

    def test_scope_alias_and_navigation_survive_but_live_facts_do_not(self):
        value = semantic_history({"previousIntent": {"scope": "team", "page": "/work/crystals",
            "priorFacts": ["OLD-DATA"], "question": "Show those", "recentIntents": [{"question": "Team view", "facts": ["OLD-DATA"]}]}})
        self.assertEqual(value["previousIntent"]["requestedScope"], "team")
        self.assertEqual(value["previousIntent"]["lastRead"]["page"], "/work/crystals")
        self.assertNotIn("OLD-DATA", json.dumps(value))

    def test_refine_inherits_scope_record_time_and_clears_filter(self):
        previous = history_for()
        updated = merge_task(task(contextRelation="refine", requestedScope="unknown", recordIdentity="",
            timeRange="unknown", groupBy=[], filters=[], slotUpdates=[
                {"field": "filters", "source": "clear", "value": [], "evidence": "remove the color filter"},
                {"field": "groupBy", "source": "current", "value": ["owner"], "evidence": "group by owner"}]), previous)
        self.assertEqual((updated.requestedScope, updated.recordIdentity, updated.timeRange),
                         ("team", "CR-123", "next 30 days"))
        self.assertEqual(updated.filters, [])
        self.assertEqual(updated.groupBy, ["owner"])
        again = merge_task(task(contextRelation="continue"), history_for(updated))
        self.assertEqual(again.filters, [])  # Explicit clear must never resurrect.

    def test_new_topic_does_not_inherit_old_conditions(self):
        result = merge_task(task(contextRelation="switch", requestedScope="personal", recordIdentity="NEW-987",
                                 filters=[], groupBy=[], timeRange="unknown"), history_for())
        self.assertEqual(result.recordIdentity, "NEW-987")
        self.assertEqual(result.filters, [])
        self.assertEqual(result.requestedScope, "personal")

    def test_forged_previous_slot_is_rejected(self):
        with self.assertRaises(ValueError):
            merge_task(task(contextRelation="continue", slotUpdates=[
                {"field": "requestedScope", "source": "previous", "value": "global"}]), history_for())

    def test_refinement_cannot_reset_draft_by_omitting_updates(self):
        draft = merge_task(task(filters=[], slotUpdates=[
            {"field": "filters", "source": "clear", "value": [], "evidence": "remove filters"}]), {})
        result = refine_task(draft, task(requestedScope="unknown", recordIdentity="", filters=["stale"]))
        self.assertEqual(result.requestedScope, "team")
        self.assertEqual(result.recordIdentity, "CR-123")
        self.assertEqual(result.filters, [])

    def test_reference_text_cannot_reclassify_the_requested_operation(self):
        # API instructions and words such as projected in a handbook do not
        # turn an explanation into a mutation, prediction or live-data request.
        draft = merge_task(task(needsLiveData=False, readOnly=True), {})
        candidate = task(needsLiveData=True, readOnly=False)
        result = refine_task(draft, candidate)
        self.assertFalse(result.needsLiveData)
        self.assertTrue(result.readOnly)

    def test_clarification_choice_restores_original_task(self):
        pending = task(requestedScope="unknown", unresolvedSlots=["requestedScope"], clarification={
            "question": "My tasks or team tasks?", "missingSlots": ["requestedScope"], "options": [
                {"id": "mine", "label": "My tasks", "updates": [{"field": "requestedScope", "source": "current", "value": "personal"}]},
                {"id": "team", "label": "Team tasks", "updates": [{"field": "requestedScope", "source": "current", "value": "team"}]}]})
        previous = history_for(pending, "Count blue crystals by status within thirty days.")
        choice = literal_choice("2", previous)
        result = merge_task(task(businessObject="unrelated", filters=[]), previous, choice)
        self.assertEqual(result.businessObject, "crystals")
        self.assertEqual(result.requestedScope, "team")
        self.assertEqual(result.filters, ["color=blue"])
        self.assertEqual(result.unresolvedSlots, [])
        self.assertIsNone(result.clarification)
        state = save_intent(result, "2", previous, "r2", "principal", "catalog", clock_context("UTC"))
        self.assertEqual(state["originalQuestion"], "Count blue crystals by status within thirty days.")
        self.assertIsNone(state["pendingClarification"])

    def test_identity_change_drops_old_context(self):
        self.assertEqual(bind_history(history_for(), "different-person", "catalog"), {})

    def test_catalog_change_invalidates_pending_option(self):
        previous = history_for()
        previous["previousIntent"]["pendingClarification"] = {"id": "old"}
        result = bind_history(previous, "principal", "new-catalog")
        self.assertNotIn("pendingClarification", result["previousIntent"])

    def test_transport_preserves_page_context_on_rest_and_ws(self):
        raw = {"content": "Read the selected item", "clientMessageId": "c1",
               "pageContext": {"route": "/work/crystals", "view": "To Do", "selectedRecordKeys": ["CR-123"],
                               "browserTimezone": "Asia/Dubai"}}
        self.assertEqual(MessageCreate.model_validate(raw).page_context.selectedRecordKeys, ["CR-123"])
        self.assertEqual(WSMessage.model_validate({"type": "message", **raw}).page_context.view, "To Do")

    def test_page_context_cannot_supply_authority_or_foreign_url(self):
        for raw in [{"route": "https://outside.test"}, {"route": "/work/crystals", "permissions": ["all"]},
                    {"route": "/work/crystals", "browserTimezone": "not/a/timezone"}]:
            with self.assertRaises(ValidationError):
                ReaderPageContext.model_validate(raw)

    def test_page_hint_requires_catalog_and_permission_and_remains_unverified(self):
        catalog = [{"routes": ["/work/crystals"], "parameters": ["code"]}]
        raw = {"route": "/work/crystals", "query": {"code": "CR-123", "secret": "never", "unknown": "drop"},
               "selectedRecordKeys": ["CR-123"]}
        result = page_hint(raw, catalog, lambda _: True)
        self.assertEqual(result["query"], {"code": "CR-123"})
        self.assertFalse(result["recordVerified"])
        self.assertNotIn("selectedRecordKeys", page_hint(raw, catalog, lambda _: False))

    def test_existing_catalog_is_only_page_inventory(self):
        with TemporaryDirectory() as directory:
            Path(directory, "page-catalog.json").write_text(json.dumps([
                {"name": "Crystals", "routes": [{"path": "/work/crystals"}], "queryParameters": [{"name": "code"}]},
                {"name": "Denied", "routes": [{"path": "/private"}]}]))
            catalog, version = load_catalog(directory, lambda route: route == "/work/crystals")
            self.assertEqual(len(catalog), 1)
            self.assertEqual(catalog[0]["parameters"], ["code"])
            self.assertEqual(len(version), 64)

    def test_reference_time_has_explicit_timezone_and_same_instant(self):
        clock = clock_context("Asia/Dubai")
        self.assertTrue(clock["businessNow"].endswith("+04:00"))
        self.assertTrue(clock["nowUtc"].endswith("+00:00"))

    def test_clarification_render_has_no_maintenance_json(self):
        text = render_generic_answer({"clarification": {"question": "Which record?", "options": []},
                                      "missing": ["intent_ambiguous"]})
        self.assertEqual(text, "Which record?")

    def test_full_reader_sends_original_question_to_refinement_and_routing(self):
        class CapturingPlanner(Planner):
            async def generic_reader_json(self, **kwargs):
                self.inputs = getattr(self, "inputs", []) + [kwargs["data"]]
                return await super().generic_reader_json(**kwargs)
        planner = CapturingPlanner()
        question = "Relevant information. " * 220 + "Include the final tail condition."
        reader = GenericKnowledgeReader(Gateway(), planner, portal_base_url="https://portal.test")
        outcome = asyncio.run(reader.run(Principal("person-1", "tenant", "request"), question))
        self.assertEqual([x["phase"] for x in planner.inputs if "phase" in x],
                         ["initial", "knowledge_refinement", "consistency_review"])
        for value in [x for x in planner.inputs if "question" in x]:
            self.assertEqual(value["question"], question)
            if value.get("phase") in {"initial", "knowledge_refinement"}:
                self.assertIn("referenceTime", value)
        self.assertEqual(outcome.result.public_json()["intentState"]["originalQuestion"], question)
        self.assertIn("task", semantic_history(context_from_state(outcome.result.public_json(), question))["previousIntent"])

    def test_clarification_stops_before_read_then_choice_resumes(self):
        class AskingPlanner(Planner):
            async def generic_reader_json(self, **kwargs):
                if kwargs["schema"]["properties"]["stage"]["const"] == "task":
                    return task(recordIdentity="", clarification={"question": "Which scope?", "missingSlots": ["requestedScope"], "options": [
                        {"id": "mine", "label": "My tasks", "updates": [{"field": "requestedScope", "source": "current", "value": "personal"}]},
                        {"id": "team", "label": "Team tasks", "updates": [{"field": "requestedScope", "source": "current", "value": "team"}]}]}).model_dump()
                return await super().generic_reader_json(**kwargs)
        gateway = Gateway()
        first = asyncio.run(GenericKnowledgeReader(gateway, AskingPlanner(), portal_base_url="https://portal.test").run(
            Principal("person-1", "tenant", "r1"), "Show tasks"))
        self.assertNotIn("admin.portal.read", gateway.events)
        context = context_from_state(first.result.public_json(), "Show tasks")
        second = asyncio.run(GenericKnowledgeReader(gateway, AskingPlanner(), portal_base_url="https://portal.test").run(
            Principal("person-1", "tenant", "r2"), "2", conversation_context=context))
        self.assertIn("admin.portal.read", gateway.events)
        self.assertIsNone(second.result.public_json()["intentState"]["pendingClarification"])
        self.assertEqual(second.result.public_json()["intentState"]["task"]["requestedScope"], "team")


if __name__ == "__main__":
    unittest.main()
