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

const { openIsolatedBlankUrl } = await loadTypeScriptModule(
  "../src/utils/openIsolatedBlankUrl.ts",
);

test("opens preview links with noopener and clears opener", () => {
  const calls = [];
  const openedWindow = { opener: { location: "original" } };

  const result = openIsolatedBlankUrl(
    "https://events.example/register",
    (...args) => {
      calls.push(args);
      return openedWindow;
    },
  );

  assert.equal(result, true);
  assert.deepEqual(calls, [
    ["https://events.example/register", "_blank", "noopener,noreferrer"],
  ]);
  assert.equal(openedWindow.opener, null);
});

test("keeps working when the browser returns a restricted WindowProxy", () => {
  const openedWindow = {};
  Object.defineProperty(openedWindow, "opener", {
    set() {
      throw new Error("restricted proxy");
    },
  });

  assert.equal(
    openIsolatedBlankUrl(
      "https://events.example/register",
      () => openedWindow,
    ),
    true,
  );
});
