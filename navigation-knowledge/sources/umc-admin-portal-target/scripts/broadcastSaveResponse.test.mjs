import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const require = createRequire(import.meta.url);
const sourcePath = fileURLToPath(
  new URL("../src/pages/BroadcastEdit/saveResponse.ts", import.meta.url),
);
const source = await readFile(sourcePath, "utf8");
const { code } = await transformWithEsbuild(source, sourcePath, {
  loader: "ts",
  format: "cjs",
  target: "node20",
});
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { isSuccessfulBroadcastResponse } = module.exports;

test("accepts supported successful broadcast response shapes", () => {
  assert.equal(isSuccessfulBroadcastResponse(true), true);
  assert.equal(isSuccessfulBroadcastResponse({ data: true }), true);
  assert.equal(isSuccessfulBroadcastResponse({ isSuccess: true }), true);
  assert.equal(isSuccessfulBroadcastResponse({ statusCode: 200 }), true);
  assert.equal(isSuccessfulBroadcastResponse({ statusCode: "201" }), true);
  assert.equal(isSuccessfulBroadcastResponse({ isSuccess: true, statusCode: 200 }), true);
});

test("explicit failure fields take precedence over successful status codes", () => {
  assert.equal(isSuccessfulBroadcastResponse({ isSuccess: false, statusCode: 200 }), false);
  assert.equal(isSuccessfulBroadcastResponse({ data: false, statusCode: 200 }), false);
  assert.equal(isSuccessfulBroadcastResponse({ isSuccess: false, data: true }), false);
});

test("rejects failed or malformed broadcast response shapes", () => {
  assert.equal(isSuccessfulBroadcastResponse(false), false);
  assert.equal(isSuccessfulBroadcastResponse({ data: false }), false);
  assert.equal(isSuccessfulBroadcastResponse({ statusCode: 400 }), false);
  assert.equal(isSuccessfulBroadcastResponse({ statusCode: "500" }), false);
  assert.equal(isSuccessfulBroadcastResponse({ statusCode: "ok" }), false);
  assert.equal(isSuccessfulBroadcastResponse(null), false);
});
