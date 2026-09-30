import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const loadTypeScriptModule = async (relativePath) => {
  const sourcePath = new URL(relativePath, import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
    loader: "ts",
    format: "esm",
    target: "node20",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
    "base64",
  )}`;
  return import(moduleUrl);
};

const createSessionStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");

const setGlobalProperty = (name, value) => {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
};

test.afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }

  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
  } else {
    delete globalThis.crypto;
  }
});

const FIXED_AUTHORIZE_URL =
  "https://stg-id.uaepass.ae/idshub/authorize?response_type=code&client_id=sandbox_stage&state=https%3A%2F%2Fadmin.example.com%2Flogin&scope=urn%3Auae%3Adigitalid%3Aprofile%3Ageneral&redirect_uri=https%3A%2F%2Fadmin.example.com%2Flogin";

test("uses the configured fixed state and stores it for the callback", async () => {
  setGlobalProperty("window", { sessionStorage: createSessionStorage() });

  const { createUAEPassLoginUrl, consumeUAEPassState } = await loadTypeScriptModule(
    "../src/pages/Login/uaePassState.ts",
  );

  const loginUrl = createUAEPassLoginUrl(FIXED_AUTHORIZE_URL, false);

  assert.equal(loginUrl, FIXED_AUTHORIZE_URL);
  assert.equal(consumeUAEPassState("https://admin.example.com/login"), true);
  assert.throws(
    () =>
      createUAEPassLoginUrl(
        "https://stg-id.uaepass.ae/idshub/authorize?state=https%3A%2F%2Fevil.example%2Flogin&redirect_uri=https%3A%2F%2Fadmin.example.com%2Flogin",
        false,
      ),
    /state/i,
  );
});

test("can opt into a fresh 48-character random state", async () => {
  const sessionStorage = createSessionStorage();
  setGlobalProperty("window", { sessionStorage });
  let nextByte = 1;
  setGlobalProperty("crypto", {
    getRandomValues: (bytes) => {
      bytes.fill(nextByte);
      nextByte += 1;
      return bytes;
    },
  });

  const { createUAEPassLoginUrl, consumeUAEPassState } = await loadTypeScriptModule(
    "../src/pages/Login/uaePassState.ts",
  );

  const firstState = new URL(
    createUAEPassLoginUrl(FIXED_AUTHORIZE_URL, true),
  ).searchParams.get("state");
  const secondState = new URL(
    createUAEPassLoginUrl(FIXED_AUTHORIZE_URL, true),
  ).searchParams.get("state");

  assert.match(firstState, /^[a-f0-9]{48}$/);
  assert.match(secondState, /^[a-f0-9]{48}$/);
  assert.notEqual(firstState, secondState);
  assert.equal(consumeUAEPassState(secondState), true);
});

test("rejects callback states that do not match the stored state and clears the old value", async () => {
  const sessionStorage = createSessionStorage();
  setGlobalProperty("window", { sessionStorage });

  const { createUAEPassLoginUrl, consumeUAEPassState } = await loadTypeScriptModule(
    "../src/pages/Login/uaePassState.ts",
  );

  createUAEPassLoginUrl(FIXED_AUTHORIZE_URL, false);

  assert.equal(consumeUAEPassState("attacker-state"), false);
  assert.equal(sessionStorage.getItem("auth:uaepass:oauth-state"), null);
  assert.equal(
    consumeUAEPassState("https://admin.example.com/login"),
    false,
  );
});

test("rejects stored UAE PASS state after 30 minutes", async () => {
  const sessionStorage = createSessionStorage();
  setGlobalProperty("window", { sessionStorage });
  const originalDateNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    const { createUAEPassLoginUrl, consumeUAEPassState } =
      await loadTypeScriptModule("../src/pages/Login/uaePassState.ts");

    createUAEPassLoginUrl(FIXED_AUTHORIZE_URL, false);
    now += 30 * 60 * 1000 + 1;

    assert.equal(
      consumeUAEPassState("https://admin.example.com/login"),
      false,
    );
    assert.equal(sessionStorage.getItem("auth:uaepass:oauth-state"), null);
  } finally {
    Date.now = originalDateNow;
  }
});

test("every UAE PASS environment fixes state to its redirect URI", async () => {
  const envPaths = [
    ".env.daypopdevelopment",
    ".env.daypopproduction",
    ".env.nma-development",
    ".env.nma-production",
    ".env.nma-staging",
  ];

  for (const envPath of envPaths) {
    const source = await readFile(new URL(`../${envPath}`, import.meta.url), "utf8");
    const authorizeUrl = source.match(/^VITE_UAE_PASS_URL=(.+)$/m)?.[1];

    assert.ok(authorizeUrl, `${envPath} must configure VITE_UAE_PASS_URL`);
    const url = new URL(authorizeUrl);
    assert.equal(
      url.searchParams.get("state"),
      url.searchParams.get("redirect_uri"),
      `${envPath} must fix UAE PASS state to redirect_uri`,
    );
  }

  const loginSource = await readFile(
    new URL("../src/pages/Login/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(loginSource, /createUAEPassLoginUrl\(import\.meta\.env\.VITE_UAE_PASS_URL \|\| ""\)/);
  assert.match(loginSource, /consumeUAEPassState\(state \|\| ""\)/);
  assert.match(
    loginSource,
    /const uaepassUrl = createUAEPassLoginUrl\([\s\S]*?\);\s*shouldResetLoading = false;\s*window\.location\.href = uaepassUrl;/,
  );
});
