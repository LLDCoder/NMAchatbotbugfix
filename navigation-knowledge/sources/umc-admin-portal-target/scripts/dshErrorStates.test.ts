import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getDshChatErrorPresentation,
  getDshRuntimeError,
  getDshSocketError,
} from "../src/components/AIChatBot/model/dshErrors";
import { DshApiError } from "../src/services/dshChat";

test("mock REST and local failures map to actions and distinct bilingual copy", () => {
  const locales = ["en", "ar"].map((language) => JSON.parse(readFileSync(
    `src/localization/aiChatBot/${language}.json`, "utf8",
  )) as { aiChatBot: { chat: { errors: Record<string, string> & { titles: Record<string, string> } } } });
  const cases = [
    [new DshApiError("network", "server diagnostic"), "network", true, false],
    [new DshApiError("network", "server diagnostic", undefined, "incomplete"), "incomplete", true, false],
    [new DshApiError("network", "server diagnostic", undefined, "configuration"), "configuration", false, false],
    [new DshApiError("http", "server diagnostic", 401), "sessionExpired", false, false],
    [new DshApiError("http", "server diagnostic", 403), "forbidden", false, false],
    [new DshApiError("http", "server diagnostic", 404), "notFound", false, true],
    [new DshApiError("http", "server diagnostic", 408), "unavailable", true, false],
    [new DshApiError("http", "server diagnostic", 429), "unavailable", true, false],
    [new DshApiError("http", "server diagnostic", 500), "unavailable", true, false],
    [new DshApiError("http", "server diagnostic", 503), "unavailable", true, false],
    [new DshApiError("protocol", "server diagnostic"), "protocol", true, false],
    [new DshApiError("protocol", "server diagnostic", undefined, "runtime_failed"), "generic", true, false],
    [new Error("server diagnostic"), "generic", true, false],
  ] as const;

  for (const [error, kind, retryable, startNewChat] of cases) {
    const presentation = getDshChatErrorPresentation(error);
    assert.equal(presentation.kind, kind);
    assert.equal(presentation.retryable, retryable);
    assert.equal(presentation.startNewChat === true, startNewChat);
    const copyKind = kind === "protocol" ? "generic" : kind;
    assert.equal(presentation.titleKey, `aiChatBot.chat.errors.titles.${copyKind}`);
    assert.equal(presentation.messageKey, `aiChatBot.chat.errors.${copyKind}`);
    for (const locale of locales) {
      assert.ok(locale.aiChatBot.chat.errors.titles[copyKind]);
      assert.ok(locale.aiChatBot.chat.errors[copyKind]);
      assert.notEqual(locale.aiChatBot.chat.errors.titles[copyKind], locale.aiChatBot.chat.errors[copyKind]);
      assert.ok(!locale.aiChatBot.chat.errors[copyKind].includes("server diagnostic"));
    }
  }
});

test("admin DSH WebSocket codes map to actionable errors without exposing payloads", () => {
  for (const [code, expected] of [
    ["conversation_not_found", "notFound"],
    ["umc_token_required", "sessionExpired"],
    ["identity_mismatch", "sessionExpired"],
    ["missing_user_identity", "unavailable"],
    ["authentication_failed", "sessionExpired"],
    ["permission_denied", "forbidden"],
    ["identity_dependency_timeout", "unavailable"],
    ["unknown_code", "protocol"],
  ] as const) {
    const error = getDshSocketError(code);
    assert.equal(getDshChatErrorPresentation(error).kind, expected);
    assert.ok(!error.message.includes(code));
  }
});

test("runtime.error ends the turn with incomplete or generic guidance", () => {
  const runtime = { code: "runtime_failed", error: "RuntimeError", detail: "private server diagnostic" };
  assert.equal(getDshChatErrorPresentation(getDshRuntimeError(runtime, false)).kind, "generic");
  assert.equal(getDshChatErrorPresentation(getDshRuntimeError(runtime, true)).kind, "incomplete");
  assert.equal(getDshChatErrorPresentation(getDshRuntimeError({}, false)).kind, "protocol");
  assert.ok(!getDshRuntimeError(runtime, false).message.includes(runtime.detail));
});
