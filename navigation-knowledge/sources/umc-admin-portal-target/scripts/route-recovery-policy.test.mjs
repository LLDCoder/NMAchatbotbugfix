import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRouteFailure,
  createRecoveryKey,
  normalizeRecoveryResource,
  sanitizeDiagnosticRouteKey,
} from "../src/utils/routeRecoveryPolicy.js";

test("classifies missing route modules as unavailable pages", () => {
  assert.equal(
    classifyRouteFailure(new Error('[routes] Page module not found for "Refunds"')),
    "page-unavailable",
  );
});

test("classifies stale dynamic imports as reloadable assets", () => {
  assert.equal(
    classifyRouteFailure(new Error("Failed to fetch dynamically imported module")),
    "stale-asset",
  );
});

test("keeps render failures distinct from route failures", () => {
  assert.equal(
    classifyRouteFailure(new Error("Cannot read properties of undefined")),
    "render-error",
  );
});

test("scopes a stale asset recovery marker to the build and failed resource", () => {
  assert.equal(
    createRecoveryKey("main-abcd.js", "https://portal/assets/refunds-old.js"),
    "admin-portal:asset-recovery:main-abcd.js:https://portal/assets/refunds-old.js",
  );
});

test("normalizes dynamic import messages and asset events to the same resource", () => {
  const resource = "https://portal/assets/refunds-old.js";
  assert.equal(
    normalizeRecoveryResource(
      `Failed to fetch dynamically imported module: ${resource}`,
    ),
    resource,
  );
  assert.equal(normalizeRecoveryResource(resource), resource);
});

test("removes query and hash data from diagnostic route keys", () => {
  assert.equal(
    sanitizeDiagnosticRouteKey(
      "/happiness/refunds?refundId=123&email=user@example.com#details",
    ),
    "/happiness/refunds",
  );
});
