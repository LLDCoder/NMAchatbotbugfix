import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyRouteFailure,
  createRecoveryKey,
  extractMainModuleSrc,
  getRecoveryPendingRemainingMs,
  isCompatibleEntryPath,
  isRecoveryPendingTimestamp,
  normalizeRecoveryResource,
  RECOVERY_PENDING_WINDOW_MS,
  RECOVERY_RETRY_COOLDOWN_MS,
  shouldAttemptRecoveryReload,
} from "../src/utils/routeRecoveryPolicy.js";

test("classifyRouteFailure marks failed dynamic imports as stale-asset", () => {
  assert.equal(
    classifyRouteFailure(
      new TypeError(
        "Failed to fetch dynamically imported module: https://example.com/assets/index-CIkn4XrX.js",
      ),
    ),
    "stale-asset",
  );
});

test("classifyRouteFailure marks failed CSS preloads as stale-asset", () => {
  assert.equal(
    classifyRouteFailure(
      new Error("Unable to preload CSS for /assets/index-B4qq_3Hk.css"),
    ),
    "stale-asset",
  );
});

test("classifyRouteFailure keeps runtime errors as render-error", () => {
  assert.equal(
    classifyRouteFailure(
      new TypeError("Cannot read properties of undefined (reading 'name')"),
    ),
    "render-error",
  );
});

test("isRecoveryPendingTimestamp is true right after a recovery reload was triggered", () => {
  const now = 1_754_000_000_000;
  assert.equal(isRecoveryPendingTimestamp(now - 1_000, now), true);
});

test("isRecoveryPendingTimestamp is false once the pending window has elapsed", () => {
  const now = 1_754_000_000_000;
  assert.equal(
    isRecoveryPendingTimestamp(now - RECOVERY_PENDING_WINDOW_MS - 1, now),
    false,
  );
});

test("getRecoveryPendingRemainingMs returns only the remaining window", () => {
  const now = 1_754_000_000_000;
  assert.equal(
    getRecoveryPendingRemainingMs(now - 1_000, now),
    RECOVERY_PENDING_WINDOW_MS - 1_000,
  );
  assert.equal(
    getRecoveryPendingRemainingMs(now - RECOVERY_PENDING_WINDOW_MS, now),
    0,
  );
  assert.equal(getRecoveryPendingRemainingMs(0, now), 0);
});

test("getRecoveryPendingRemainingMs caps a future timestamp to one window", () => {
  const now = 1_754_000_000_000;
  assert.equal(
    getRecoveryPendingRemainingMs(now + 60_000, now),
    RECOVERY_PENDING_WINDOW_MS,
  );
});

test("shouldAttemptRecoveryReload allows the first attempt", () => {
  const now = 1_754_000_000_000;
  assert.equal(shouldAttemptRecoveryReload(0, now), true);
  assert.equal(shouldAttemptRecoveryReload(undefined, now), true);
  assert.equal(shouldAttemptRecoveryReload(Number.NaN, now), true);
});

test("shouldAttemptRecoveryReload blocks rapid repeats within the cooldown", () => {
  const now = 1_754_000_000_000;
  assert.equal(shouldAttemptRecoveryReload(now - 5_000, now), false);
  assert.equal(
    shouldAttemptRecoveryReload(now - RECOVERY_RETRY_COOLDOWN_MS + 1, now),
    false,
  );
});

test("shouldAttemptRecoveryReload allows recovery again after the cooldown", () => {
  const now = 1_754_000_000_000;
  assert.equal(
    shouldAttemptRecoveryReload(now - RECOVERY_RETRY_COOLDOWN_MS, now),
    true,
  );
  assert.equal(shouldAttemptRecoveryReload(now - 180_000, now), true);
});

test("recovery cooldown outlasts the pending window so holds cannot re-reload", () => {
  assert.ok(RECOVERY_RETRY_COOLDOWN_MS > RECOVERY_PENDING_WINDOW_MS);
});

test("isRecoveryPendingTimestamp is false without a recorded recovery", () => {
  const now = 1_754_000_000_000;
  assert.equal(isRecoveryPendingTimestamp(0, now), false);
  assert.equal(isRecoveryPendingTimestamp(undefined, now), false);
  assert.equal(isRecoveryPendingTimestamp(Number.NaN, now), false);
});

test("extractMainModuleSrc reads the vite entry script", () => {
  assert.equal(
    extractMainModuleSrc(
      '<head><script type="module" crossorigin src="/assets/main-Bf0sq0v9.js"></script></head>',
    ),
    "/assets/main-Bf0sq0v9.js",
  );
});

test("extractMainModuleSrc tolerates attribute order and single quotes", () => {
  assert.equal(
    extractMainModuleSrc(
      "<script src='/assets/main-abc.js' type='module'></script>",
    ),
    "/assets/main-abc.js",
  );
});

test("extractMainModuleSrc returns empty for foreign or script-less HTML", () => {
  assert.equal(extractMainModuleSrc("<html><body>maintenance</body></html>"), "");
  assert.equal(
    extractMainModuleSrc('<script src="/legacy/app.js"></script>'),
    "",
  );
  assert.equal(extractMainModuleSrc(""), "");
});

test("isCompatibleEntryPath accepts a rehashed entry from the same directory", () => {
  assert.equal(
    isCompatibleEntryPath("/assets/main-Bf0sq0v9.js", "/assets/main-CHXoSjr9.js"),
    true,
  );
});

test("isCompatibleEntryPath rejects foreign documents", () => {
  const current = "/assets/main-Bf0sq0v9.js";
  assert.equal(isCompatibleEntryPath(current, "/sso/assets/main-x.js"), false);
  assert.equal(isCompatibleEntryPath(current, "/assets/vendor-react-x.js"), false);
  assert.equal(isCompatibleEntryPath(current, "/assets/main-x.css"), false);
  assert.equal(isCompatibleEntryPath(current, ""), false);
  assert.equal(isCompatibleEntryPath("", "/assets/main-x.js"), false);
});

test("normalizeRecoveryResource extracts the failing asset URL from a message", () => {
  assert.equal(
    normalizeRecoveryResource(
      "Failed to fetch dynamically imported module: https://example.com/assets/index-abc.js",
    ),
    "https://example.com/assets/index-abc.js",
  );
  assert.equal(normalizeRecoveryResource("no url in here"), "no url in here");
});

test("createRecoveryKey combines fingerprint and normalized resource", () => {
  assert.equal(
    createRecoveryKey(
      "https://example.com/assets/main-a.js",
      "https://example.com/assets/index-b.js",
    ),
    "admin-portal:asset-recovery:https://example.com/assets/main-a.js:https://example.com/assets/index-b.js",
  );
});
