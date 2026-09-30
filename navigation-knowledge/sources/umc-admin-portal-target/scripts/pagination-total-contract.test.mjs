import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const componentPath = resolve("src/components/common/PaginationTotal/index.tsx");
const bundlePath = join(tmpdir(), "pagination-total-contract.cjs");
const esbuildPath = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "esbuild.cmd" : "esbuild",
);

const loadComponent = () => {
  assert.ok(existsSync(componentPath), "PaginationTotal component should exist");
  execFileSync(
    esbuildPath,
    [
      componentPath,
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--loader:.less=text",
      `--outfile=${bundlePath}`,
    ],
    { stdio: "inherit" },
  );
  delete require.cache[bundlePath];
  return require(bundlePath).default;
};

test("PaginationTotal renders the total and page count in two divs", () => {
  const PaginationTotal = loadComponent();
  const markup = renderToStaticMarkup(
    React.createElement(PaginationTotal, {
      label: "Total",
      total: 29,
      current: 1,
      pageSize: 10,
    }),
  );

  assert.match(markup, /pagination-total/);
  assert.match(markup, /<div>Total 29<\/div><div>1\/3<\/div>/);
});

test("PaginationTotal keeps one page for empty totals", () => {
  const PaginationTotal = loadComponent();
  const markup = renderToStaticMarkup(
    React.createElement(PaginationTotal, {
      label: "Total",
      total: 0,
      current: 1,
      pageSize: 10,
    }),
  );

  assert.match(markup, /<div>Total 0<\/div><div>1\/1<\/div>/);
});

test.after(() => {
  rmSync(bundlePath, { force: true });
});
