import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const loadPageContentScroll = async () => {
  const source = await readFile(
    new URL("../src/layout/pageContentScroll.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "pageContentScroll.ts",
  }).outputText;

  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
};

test("records the latest Layout page scroll position", async () => {
  const { getPageContentScrollTop, recordPageContentScrollTop } =
    await loadPageContentScroll();

  recordPageContentScrollTop(735);

  assert.equal(getPageContentScrollTop(), 735);
});

test("requests restoring a specific Layout page scroll position", async () => {
  const dispatched = [];
  globalThis.window = {
    dispatchEvent(event) {
      dispatched.push(event);
      return true;
    },
  };
  const {
    PAGE_CONTENT_SCROLL_REQUEST_EVENT,
    requestPageContentScrollTo,
  } = await loadPageContentScroll();

  requestPageContentScrollTo(420);

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, PAGE_CONTENT_SCROLL_REQUEST_EVENT);
  assert.equal(dispatched[0].detail.top, 420);
  delete globalThis.window;
});
