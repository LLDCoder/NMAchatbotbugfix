import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const AUTH_STORAGE_KEYS = {
  TOKEN: "NMA_WORKSPACE_AUTH_TOKEN",
  REFRESH_TOKEN: "NMA_WORKSPACE_AUTH_REFRESH_TOKEN",
  TOKEN_EXPIRES: "NMA_WORKSPACE_AUTH_TOKEN_EXPIRES",
  USER_INFO: "NMA_WORKSPACE_AUTH_USER_INFO",
  UAE_PASS_SESSION: "NMA_WORKSPACE_AUTH_UAE_PASS_SESSION",
};
const AUTH_USER_STORAGE_KEY = "NMA_WORKSPACE_USER_STORAGE";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function loadMigration(localStorage, sessionStorage) {
  const source = fs.readFileSync(
    path.resolve("src/storage/migrateLegacyAuthStorage.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const testModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "@/storage/authStorage") {
      return { AUTH_STORAGE_KEYS, AUTH_USER_STORAGE_KEY };
    }
    throw new Error(`Unexpected module: ${specifier}`);
  };

  new Function(
    "exports",
    "module",
    "require",
    "localStorage",
    "sessionStorage",
    compiled,
  )(testModule.exports, testModule, require, localStorage, sessionStorage);
  return testModule.exports;
}

const legacyUser = JSON.stringify({
  state: {
    userInfo: {
      id: "admin-user",
      listSysPermission: [],
    },
  },
});

test("migrates an admin legacy session without changing stored values", () => {
  const token = JSON.stringify({ value: "token", timestamp: 1 });
  const refreshToken = JSON.stringify({ value: "refresh", timestamp: 2 });
  const tokenExpires = JSON.stringify({ value: 123456, timestamp: 3 });
  const localStorage = createStorage({
    "auth:token": token,
    "auth:tokenExpires": tokenExpires,
    "user-storage": legacyUser,
  });
  const sessionStorage = createStorage({ "auth:refreshToken": refreshToken });

  loadMigration(localStorage, sessionStorage).migrateLegacyAuthStorage();

  assert.equal(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN), token);
  assert.equal(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES), tokenExpires);
  assert.equal(sessionStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN), refreshToken);
  assert.equal(localStorage.getItem(AUTH_USER_STORAGE_KEY), legacyUser);
  assert.equal(localStorage.getItem("auth:token"), null);
  assert.equal(sessionStorage.getItem("auth:refreshToken"), null);
  assert.equal(localStorage.getItem("user-storage"), null);
});

test("does not migrate a customer or unidentifiable legacy session", () => {
  const customerUser = JSON.stringify({
    state: {
      userInfo: {
        id: "customer-user",
        userInvitation: {},
        userEstablishments: [],
      },
    },
  });

  for (const userStorage of [customerUser, "not-json", null]) {
    const localStorage = createStorage({
      "auth:token": "legacy-token",
      ...(userStorage ? { "user-storage": userStorage } : {}),
    });
    const sessionStorage = createStorage();

    loadMigration(localStorage, sessionStorage).migrateLegacyAuthStorage();

    assert.equal(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN), null);
    assert.equal(localStorage.getItem("auth:token"), "legacy-token");
  }
});

test("leaves corrupt or incomplete admin legacy auth untouched", () => {
  for (const authValues of [
    {
      "auth:token": "not-json",
      "auth:refreshToken": JSON.stringify({ value: "refresh", timestamp: 2 }),
      "auth:tokenExpires": JSON.stringify({ value: 123456, timestamp: 3 }),
    },
    {
      "auth:token": JSON.stringify({ value: "token", timestamp: 1 }),
      "auth:refreshToken": JSON.stringify({ value: "refresh", timestamp: 2 }),
    },
  ]) {
    const localStorage = createStorage({
      ...authValues,
      "user-storage": legacyUser,
    });
    const sessionStorage = createStorage();

    loadMigration(localStorage, sessionStorage).migrateLegacyAuthStorage();

    assert.equal(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN), null);
    assert.equal(localStorage.getItem("auth:token"), authValues["auth:token"]);
    assert.equal(localStorage.getItem("user-storage"), legacyUser);
  }
});

test("preserves existing admin namespaced values", () => {
  const localStorage = createStorage({
    "auth:token": "legacy-token",
    "user-storage": legacyUser,
    [AUTH_USER_STORAGE_KEY]: "current-user",
  });
  const sessionStorage = createStorage({
    [AUTH_STORAGE_KEYS.TOKEN]: "current-token",
  });

  loadMigration(localStorage, sessionStorage).migrateLegacyAuthStorage();

  assert.equal(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN), null);
  assert.equal(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN), "current-token");
  assert.equal(localStorage.getItem(AUTH_USER_STORAGE_KEY), "current-user");
  assert.equal(localStorage.getItem("auth:token"), "legacy-token");
  assert.equal(localStorage.getItem("user-storage"), legacyUser);
});
