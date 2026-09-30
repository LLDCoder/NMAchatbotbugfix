import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const modulePath = path.resolve("src/utils/authSessionSync.ts");
const source = fs.readFileSync(modulePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

function loadModule(windowObject = {}) {
  const testModule = { exports: {} };
  new Function("exports", "module", "window", compiled)(
    testModule.exports,
    testModule,
    windowObject,
  );
  return testModule.exports;
}

const {
  parseAuthSessionSyncMessage,
  shouldPublishUrlTokenLogin,
} = loadModule();

test("parses valid login and logout synchronization messages", () => {
  assert.equal(
    parseAuthSessionSyncMessage(
      JSON.stringify({
        eventId: "event-login",
        action: "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGIN",
      }),
    ),
    "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGIN",
  );
  assert.equal(
    parseAuthSessionSyncMessage(
      JSON.stringify({
        eventId: "event-logout",
        action: "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGOUT",
      }),
    ),
    "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGOUT",
  );
});

test("ignores empty, malformed, incomplete, and unknown messages", () => {
  const invalidMessages = [
    null,
    "",
    "not-json",
    JSON.stringify(null),
    JSON.stringify({ eventId: "", action: "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGIN" }),
    JSON.stringify({ eventId: "   ", action: "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGIN" }),
    JSON.stringify({ eventId: "event-login" }),
    JSON.stringify({ eventId: "event-generic-login", action: "login" }),
    JSON.stringify({ eventId: "event-generic-logout", action: "logout" }),
    JSON.stringify({ eventId: "event-unknown", action: "refresh" }),
  ];

  for (const message of invalidMessages) {
    assert.equal(parseAuthSessionSyncMessage(message), null);
  }
});

test("publishes URL token login only when it establishes a different session", () => {
  assert.equal(shouldPublishUrlTokenLogin("new-token", ""), true);
  assert.equal(shouldPublishUrlTokenLogin("new-token", "old-token"), true);
  assert.equal(shouldPublishUrlTokenLogin("same-token", "same-token"), false);
  assert.equal(shouldPublishUrlTokenLogin("", "cached-token"), false);
});

test("subscribes only to Workspace synchronization events", () => {
  const listeners = new Map();
  const localStorage = {};
  const windowObject = {
    localStorage,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  const { subscribeAuthSessionSync } = loadModule(windowObject);
  const actions = [];
  const unsubscribe = subscribeAuthSessionSync((action) => actions.push(action));
  const handleStorage = listeners.get("storage");

  handleStorage({
    key: "NMA_SERVICES_AUTH_SESSION_SYNC_EVENT",
    newValue: JSON.stringify({
      eventId: "customer-logout",
      action: "@@NMA_SERVICES_AUTH_SESSION_SYNC/LOGOUT",
    }),
    storageArea: localStorage,
  });
  handleStorage({
    key: "NMA_WORKSPACE_AUTH_SESSION_SYNC_EVENT",
    newValue: JSON.stringify({
      eventId: "workspace-logout",
      action: "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGOUT",
    }),
    storageArea: localStorage,
  });

  assert.deepEqual(actions, ["@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGOUT"]);
  unsubscribe();
  assert.equal(listeners.has("storage"), false);
});
