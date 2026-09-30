import asyncio
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from pydantic import ValidationError

from app.config import Settings
from app.llm import LLMAdapter
from app.message_compression import (MessageCompressionError, compression_failure_message,
                                     message_source_hash, prepare_reader_input)
from app.principal import Principal
from app.schemas import MessageCreate, WSMessage
from app.service import DSHService, _reader_conversation_context


CONSTRAINTS = "Only my record HC-02-2026-5239576, from 2026-09-01 to 2026-09-24, at most 5 items. Do not include refunds. Clear the status filter. Group by owner; answer in English."
LONG = "Background explanation is repeated. " * 650 + CONSTRAINTS


def fake_llm(candidate=None, error=None):
    return SimpleNamespace(settings=SimpleNamespace(llm_model="test-model"),
                           compress_user_message=AsyncMock(return_value=candidate or {"summary": CONSTRAINTS, "complete": True},
                                                          side_effect=error))


def event(kind, data, seq):
    return SimpleNamespace(event_type=kind, event_json=data, seq=seq)


class CompressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_threshold_has_no_model_call_and_no_text_changes(self):
        llm = fake_llm()
        for question in ("short", "中" * 10_000):
            self.assertEqual(await prepare_reader_input(question, llm, timeout_seconds=1), (question, None))
        llm.compress_user_message.assert_not_awaited()

    async def test_long_input_full_tail_sent_once_with_redaction_and_metadata(self):
        llm = fake_llm()
        question = LONG + " Bearer super-secret-token"
        summary, meta = await prepare_reader_input(question, llm, timeout_seconds=1)
        self.assertEqual(summary, CONSTRAINTS)
        llm.compress_user_message.assert_awaited_once()
        sent = llm.compress_user_message.call_args.args[0]
        self.assertIn(CONSTRAINTS, sent)
        self.assertGreater(len(sent), 20_000)
        self.assertNotIn("super-secret-token", sent)
        self.assertEqual(meta["sourceSha256"], message_source_hash(question))
        self.assertEqual(meta["originalChars"], len(question))
        self.assertEqual(meta["effectiveChars"], len(summary))
        self.assertLessEqual(meta["startedAt"], meta["completedAt"])
        self.assertGreaterEqual(meta["durationMs"], 0)

    async def test_invalid_summaries_fail_without_retry_or_truncation(self):
        for candidate, code in [
            ({"summary": CONSTRAINTS, "complete": False}, "incomplete_summary"),
            ({"summary": "", "complete": True}, "invalid_summary"),
            ({"summary": 42, "complete": True}, "invalid_summary"),
            ({"summary": "x" * 10_001, "complete": True}, "summary_too_long"),
            ({"summary": "my records", "complete": True}, "missing_numeric_literals"),
            ({"summary": CONSTRAINTS.replace("5 items", "15 items"), "complete": True}, "missing_numeric_literals"),
        ]:
            with self.subTest(code=code):
                llm = fake_llm(candidate)
                with self.assertRaises(MessageCompressionError) as failure:
                    await prepare_reader_input(LONG, llm, timeout_seconds=1)
                self.assertEqual(failure.exception.code, code)
                self.assertEqual(failure.exception.metadata["status"], "failed")
                llm.compress_user_message.assert_awaited_once()

    async def test_dependency_and_parse_errors_are_explicit_and_never_retry(self):
        for error, code in [(httpx.ConnectError("offline"), "compression_unavailable"),
                            (httpx.ReadTimeout("slow"), "compression_timeout"),
                            (ValueError("invalid JSON"), "invalid_summary"),
                            (MessageCompressionError("model_not_configured"), "model_not_configured")]:
            with self.subTest(code=code):
                llm = fake_llm(error=error)
                with self.assertRaises(MessageCompressionError) as failure:
                    await prepare_reader_input(LONG, llm, timeout_seconds=1)
                self.assertEqual(failure.exception.code, code)
                llm.compress_user_message.assert_awaited_once()

    async def test_wall_timeout_and_cancellation(self):
        async def stalled(_):
            await asyncio.sleep(30)
        llm = fake_llm()
        llm.compress_user_message.side_effect = stalled
        with self.assertRaises(MessageCompressionError) as failure:
            await prepare_reader_input(LONG, llm, timeout_seconds=0.001)
        self.assertEqual(failure.exception.code, "compression_timeout")
        llm.compress_user_message.assert_awaited_once()
        llm.compress_user_message.side_effect = asyncio.CancelledError
        with self.assertRaises(asyncio.CancelledError):
            await prepare_reader_input(LONG, llm, timeout_seconds=1)

    async def test_rest_and_ws_preserve_long_input_and_reject_empty(self):
        for schema, extra in [(MessageCreate, {}), (WSMessage, {"type": "message"})]:
            self.assertEqual(schema(content=LONG, clientMessageId="m-1", **extra).content, LONG)
            with self.assertRaises(ValidationError):
                schema(content="   ", clientMessageId="m-1", **extra)

    async def test_http_adapter_sends_one_request_with_full_input(self):
        requests = []
        def respond(request):
            requests.append(json.loads(request.content))
            return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {
                "content": json.dumps({"summary": CONSTRAINTS, "complete": True})}}],
                "usage": {"prompt_tokens": 12000, "completion_tokens": 90, "total_tokens": 12090}})
        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        llm = LLMAdapter(Settings(llm_base_url="https://test.invalid/v1", llm_api_key="test", llm_model="test"))
        with patch("app.llm.httpx.AsyncClient", return_value=client):
            summary, meta = await prepare_reader_input(LONG, llm, timeout_seconds=1)
        self.assertEqual(summary, CONSTRAINTS)
        self.assertEqual(len(requests), 1)
        payload = json.loads(requests[0]["messages"][1]["content"])
        self.assertEqual(payload["message"], LONG)
        self.assertIn("HC-02-2026-5239576", payload["numericLiterals"])
        self.assertNotIn("tools", requests[0])
        self.assertEqual(meta["usage"]["total_tokens"], 12090)

    async def test_http_adapter_rejects_malformed_or_cut_off_output_once(self):
        for body in [[], {"choices": [{"message": {"content": "not JSON"}}]},
                     {"choices": [{"finish_reason": "length", "message": {"content": json.dumps({"summary": CONSTRAINTS, "complete": True})}}]}]:
            requests = []
            def respond(request):
                requests.append(request)
                return httpx.Response(200, json=body)
            client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
            llm = LLMAdapter(Settings(llm_base_url="https://test.invalid/v1", llm_api_key="test"))
            with patch("app.llm.httpx.AsyncClient", return_value=client):
                with self.assertRaises(MessageCompressionError):
                    await prepare_reader_input(LONG, llm, timeout_seconds=1)
            self.assertEqual(len(requests), 1)

    async def test_followup_uses_saved_summary_not_original(self):
        _, meta = await prepare_reader_input(LONG, fake_llm(), timeout_seconds=1)
        history = [event("user.message", {"content": LONG}, 1),
                   event("reader.input_compression", {**meta, "userSeq": 1}, 2),
                   event("reader.result", {"result": "not_confirmed"}, 3),
                   event("user.message", {"content": "Group those by status"}, 4)]
        context = _reader_conversation_context(history, history[-1])
        self.assertEqual(context["previousIntent"]["question"], CONSTRAINTS)
        self.assertNotIn("Background explanation", json.dumps(context))
        for field, value in [("userSeq", 99), ("sourceSha256", "wrong"), ("status", "failed")]:
            history[1].event_json = {**meta, "userSeq": 1, field: value}
            self.assertEqual(_reader_conversation_context(history, history[-1]), {})

    async def test_legacy_recent_history_reuses_summary(self):
        _, meta = await prepare_reader_input(LONG, fake_llm(), timeout_seconds=1)
        history = [event("user.message", {"content": LONG}, 1),
                   event("reader.input_compression", {**meta, "userSeq": 1}, 2),
                   event("reader.result", {"result": "not_confirmed"}, 3),
                   event("user.message", {"content": "Group those by status"}, 4),
                   event("reader.result", {"result": "not_confirmed"}, 5),
                   event("user.message", {"content": "And by owner"}, 6)]
        context = _reader_conversation_context(history, history[-1])
        self.assertEqual(context["previousIntent"]["recentIntents"][0]["question"], CONSTRAINTS)

    async def test_service_persists_compression_outcome(self):
        for fail in (False, True):
            service = object.__new__(DSHService)
            service.settings = SimpleNamespace(llm_timeout_seconds=1)
            service.llm = fake_llm(error=ValueError("bad") if fail else None)
            service.append_status = AsyncMock()
            service.append_event = AsyncMock()
            conversation = SimpleNamespace(runtime_id="rt")
            user = event("user.message", {"content": LONG}, 7)
            args = (None, conversation, user, LONG, Principal("u", "t", "r"), "en", 2)
            if fail:
                with self.assertRaises(MessageCompressionError):
                    await service._prepare_reader_question(*args)
            else:
                self.assertEqual(await service._prepare_reader_question(*args), CONSTRAINTS)
            service.append_event.assert_awaited_once()
            payload = service.append_event.call_args.args[3]
            self.assertEqual(payload["status"], "failed" if fail else "compressed")
            self.assertEqual(payload["userSeq"], 7)
            self.assertEqual(payload["requestId"], "r")
            self.assertEqual(user.event_json["content"], LONG)

    async def test_failure_messages_support_all_portal_languages(self):
        self.assertIn("原文已保留", compression_failure_message("zh"))
        self.assertIn("original message is saved", compression_failure_message("en"))
        self.assertIn("تم حفظ", compression_failure_message("ar"))
        self.assertEqual(compression_failure_message("unknown"), compression_failure_message("en"))

    async def test_turn_uses_summary_and_stops_before_reader_on_compression_failure(self):
        for fail in (False, True):
            with self.subTest(fail=fail):
                service = object.__new__(DSHService)
                service.settings = Settings(reader_pipeline="generic_v3", llm_timeout_seconds=1)
                service.llm = fake_llm(error=ValueError("invalid JSON") if fail else None)
                service.tool_gateway = SimpleNamespace()
                service.runtime_manager = SimpleNamespace(get=lambda _: None)
                service.writer_lock_for = lambda _: asyncio.Lock()
                conversation = SimpleNamespace(runtime_id="rt", status="BUSY", last_error=None)
                history = [event("user.message", {"content": LONG}, 1)]
                service.get_owned_conversation = AsyncMock(return_value=conversation)
                service.list_events = AsyncMock(side_effect=lambda *args, **kwargs: list(history))
                service._published_generic_skill = AsyncMock(return_value=SimpleNamespace(
                    allowed_tools=["knowledge.search", "admin.portal.read"]))
                async def append(db, conv, kind, data):
                    history.append(event(kind, data, len(history) + 1))
                service.append_event = AsyncMock(side_effect=append)
                service.append_audit = AsyncMock()
                service.publish_stream_event = AsyncMock()
                db = SimpleNamespace(commit=AsyncMock())
                db_context = MagicMock()
                db_context.__aenter__ = AsyncMock(return_value=db)
                db_context.__aexit__ = AsyncMock(return_value=False)
                result = SimpleNamespace(public_json=lambda: {"result": "success", "facts": [], "missing": []})
                reader = SimpleNamespace(run=AsyncMock(return_value=SimpleNamespace(result=result, audit_evidence={})), intent_state=None)
                with patch("app.service.SessionLocal", return_value=db_context), \
                     patch("app.service.GenericKnowledgeReader", return_value=reader), \
                     patch("app.service.render_generic_answer", return_value="Verified reply"):
                    await service._run_turn(Principal("u", "t", "r"), "conversation")
                self.assertEqual(history[0].event_json["content"], LONG)
                self.assertEqual(history[-1].event_type, "turn.completed")
                self.assertEqual(conversation.status, "READY")
                if fail:
                    reader.run.assert_not_awaited()
                    answer = next(item.event_json["content"] for item in history if item.event_type == "assistant.message")
                    self.assertIn("original message is saved", answer)
                else:
                    reader.run.assert_awaited_once()
                    self.assertEqual(reader.run.call_args.args[1], CONSTRAINTS)


if __name__ == "__main__":
    unittest.main()
