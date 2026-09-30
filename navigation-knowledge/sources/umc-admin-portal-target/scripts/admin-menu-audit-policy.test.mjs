import assert from "node:assert/strict";
import test from "node:test";

import { detectPageFailure } from "./admin-menu-audit-policy.mjs";

test("reports a visible route status result as a page failure", () => {
  assert.equal(
    detectPageFailure({
      routeStatusVisible: true,
      resultTitle: "404",
      diagnosticText: "",
    }),
    "route status displayed: 404",
  );
});

test("allows a normal rendered page", () => {
  assert.equal(
    detectPageFailure({
      routeStatusVisible: false,
      resultTitle: "",
      diagnosticText: "",
    }),
    "",
  );
});

test("ignores an inactive loading boundary without an error result", () => {
  assert.equal(
    detectPageFailure({
      routeStatusVisible: true,
      resultTitle: "",
      diagnosticText: "",
    }),
    "",
  );
});
