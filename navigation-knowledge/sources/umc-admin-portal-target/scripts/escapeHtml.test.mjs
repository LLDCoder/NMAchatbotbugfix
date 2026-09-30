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

const { escapeHtml } = await loadTypeScriptModule("../src/utils/escapeHtml.ts");

test("escapes tooltip text payloads before they reach HTML tooltips", () => {
  assert.equal(
    escapeHtml(`</div><img src=x onerror="alert('xss')">`),
    "&lt;/div&gt;&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;",
  );
});

test("normalizes nullish and plain text values without injecting markup", () => {
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml("Revenue Trend"), "Revenue Trend");
  assert.equal(escapeHtml("A&B"), "A&amp;B");
});
