import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourceUrl = new URL(
  "../src/pages/BroadcastEdit/sendPayload.ts",
  import.meta.url,
);
const source = await readFile(sourceUrl, "utf8");
const { code } = await transformWithEsbuild(source, sourceUrl.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const { buildBroadcastSendPayload } = await import(moduleUrl);

const basePayload = {
  type: "2",
  channels: "1,2,3",
  protalType: "2",
  publishType: "1",
  templateName: "Broadcast preview",
  emailBodyEn: "<p>Preview email body</p>",
  smsen: "Preview SMS body",
  inAppMessageEn: "Preview message",
  expireTime: "2026-08-06T23:59:59",
  showBox: true,
};

test("includes DraftAndTest and an existing draft id", () => {
  const payload = buildBroadcastSendPayload(basePayload, "DraftAndTest", {
    id: 123,
    userId: "admin-user-id",
  });

  assert.equal(payload.operation, "DraftAndTest");
  assert.equal(payload.id, 123);
  assert.equal(payload.createOn, "admin-user-id");
  assert.equal(payload.type, "2");
});

test("omits id for a new Publish request", () => {
  const payload = buildBroadcastSendPayload(basePayload, "Publish", {
    userId: "admin-user-id",
  });

  assert.equal(payload.operation, "Publish");
  assert.equal("id" in payload, false);
  assert.equal(payload.createOn, "admin-user-id");
  assert.equal("email" in payload, false);
  assert.equal("phone" in payload, false);
  assert.equal("profileId" in payload, false);
});
