import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const modulePath = path.resolve("src/utils/uaePassLogoutResponse.ts");
const source = fs.readFileSync(modulePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const testModule = { exports: {} };

new Function("exports", "module", compiled)(testModule.exports, testModule);

const { resolveUaePassLogoutUrl } = testModule.exports;

const logoutNoticeModulePath = path.resolve("src/utils/logoutNotice.ts");
const logoutNoticeSource = fs.readFileSync(logoutNoticeModulePath, "utf8");
const compiledLogoutNotice = ts.transpileModule(logoutNoticeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const logoutNoticeTestModule = { exports: {} };

new Function("exports", "module", compiledLogoutNotice)(
  logoutNoticeTestModule.exports,
  logoutNoticeTestModule,
);

const {
  consumeLogoutNotice,
  shouldReloadLoginAfterLogoutFailure,
  storeLogoutNotice,
} = logoutNoticeTestModule.exports;

test("returns a trimmed HTTPS logout URL for a successful response", () => {
  assert.equal(
    resolveUaePassLogoutUrl({
      isSuccess: true,
      statusCode: 200,
      message: "Request successful",
      data: " https://stg-id.uaepass.ae/idshub/logout?redirect_uri=https://portal.example ",
    }),
    "https://stg-id.uaepass.ae/idshub/logout?redirect_uri=https://portal.example",
  );
});

test("rejects unsuccessful or invalid logout responses", () => {
  const cases = [
    null,
    { isSuccess: false, statusCode: 200, data: "https://example.com" },
    { isSuccess: true, statusCode: 500, data: "https://example.com" },
    { isSuccess: true, statusCode: 200, data: "" },
    { isSuccess: true, statusCode: 200, data: "not-a-url" },
    { isSuccess: true, statusCode: 200, data: "http://example.com" },
    { isSuccess: true, statusCode: 200, data: "javascript:alert(1)" },
  ];

  for (const value of cases) {
    assert.equal(resolveUaePassLogoutUrl(value), null);
  }
});

test("keeps the logout notice until an external logout roundtrip finishes", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  storeLogoutNotice(storage, "Session expired");

  assert.equal(consumeLogoutNotice(storage, true), null);
  assert.equal(consumeLogoutNotice(storage, false), "Session expired");
  assert.equal(consumeLogoutNotice(storage, false), null);
});

test("does not reload login after another tab establishes a new session", () => {
  assert.equal(
    shouldReloadLoginAfterLogoutFailure(null, "new-session-token", true),
    false,
  );
  assert.equal(shouldReloadLoginAfterLogoutFailure(null, "", true), true);
});
