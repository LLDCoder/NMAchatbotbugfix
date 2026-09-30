#!/usr/bin/env node
/**
 * Compares two rwd-audit reports sample by sample.
 *
 * Usage:
 *   node scripts/rwd-compare.mjs <before-dir> <after-dir> [--all]
 *
 * Reports the metric that matters -- real spill, separated from the horizontal
 * scrolling the design asks for and from antd's ellipsis clipping. The raw
 * overflow total stopped being useful once P4 added table scrolling on purpose:
 * it counts that scrolling as overflow, so a change that fixes real spill can
 * read as flat or worse.
 *
 * Samples that redirected are excluded by default. They measured a fallback
 * page, so counting them files one page's pixels under another's name. --all
 * keeps them, for comparison with reports produced before the sweep recorded
 * where a sample landed.
 *
 * See docs/responsive-migration.md.
 */
import fs from "node:fs";

const load = (d) => JSON.parse(fs.readFileSync(`${d}/report.json`, "utf8"));
const dirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (dirs.length !== 2) {
  console.error("usage: node scripts/rwd-compare.mjs <before-dir> <after-dir> [--all]");
  process.exit(1);
}
const A = load(dirs[0]);
const B = load(dirs[1]);
const ALL = process.argv.includes("--all");

const key = (r) => `${r.bp}|${r.route}`;
const norm = (u) => String(u || "").replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";

/* Old reports predate the `valid` field; fall back to comparing the landing URL. */
const isValid = (r) => {
  if (r.valid !== undefined) return r.valid;
  if (!r.url) return true;
  return norm(r.route) === norm(r.url);
};

/*
  Older reports predate overflowKind and have to be recomputed from
  innerOverflow, which differs from it in two ways at once:

    - innerOverflow keeps only the eight worst elements per sample, while
      overflowKind is summed over every overflowing element
    - its records carry no `scroller`, so an element scrolled by an ancestor
      cannot be told apart from one that genuinely spills

  Both are reported rather than silently mixed. The first inflates nothing and
  deflates the old side; the second inflates the old side's spill. Comparing
  across the boundary shows a direction, not a magnitude.
*/
const kindOf = (r) => {
  if (r.overflowKind) return { ...r.overflowKind, exact: true };
  const k = { scroll: 0, ellipsis: 0, clipped: 0, spill: 0, vendor: 0, exact: false };
  const VENDOR = /^gm-|\.gm-style|simplebar-height-auto-observer/;
  for (const e of r.innerOverflow || []) {
    const o = e.over || 0;
    if (VENDOR.test(e.sel)) k.vendor += o;
    else if (e.overflowX === "auto" || e.overflowX === "scroll") k.scroll += o;
    else if (e.scroller) k.scroll += o;
    else if (e.overflowX === "hidden") {
      if (/ellipsis/.test(e.sel)) k.ellipsis += o;
      else k.clipped += o;
    } else k.spill += o;
  }
  return k;
};

const mapA = new Map(A.filter((r) => ALL || isValid(r)).map((r) => [key(r), r]));

let missing = 0, same = 0;
const better = [], worse = [];
const totals = { a: { scroll: 0, ellipsis: 0, clipped: 0, spill: 0, vendor: 0 }, b: { scroll: 0, ellipsis: 0, clipped: 0, spill: 0, vendor: 0 } };
let approx = false;

for (const b of B) {
  if (!ALL && !isValid(b)) continue;
  const a = mapA.get(key(b));
  if (!a) { missing++; continue; }
  const ka = kindOf(a), kb = kindOf(b);
  if (!ka.exact || !kb.exact) approx = true;
  for (const f of ["scroll", "ellipsis", "clipped", "spill", "vendor"]) {
    totals.a[f] += ka[f]; totals.b[f] += kb[f];
  }
  const d = kb.spill - ka.spill;
  if (d <= -5) better.push({ k: key(b), a: ka.spill, b: kb.spill, d });
  else if (d >= 5) worse.push({ k: key(b), a: ka.spill, b: kb.spill, d });
  else same++;
}

const fails = B.filter((r) => !r.ok).length;
const skew = B.filter((r) => (r.deviations || []).length).length;
const routesOver = (rep) =>
  new Set(rep.filter((r) => (ALL || isValid(r)) && ((kindOf(r).spill) > 10)).map((r) => r.route)).size;

console.log(
  `samples ${B.length}  failed ${fails}  skeleton deviations ${skew}  no baseline ${missing}` +
  (ALL ? "  (--all: redirected samples included)" : `  redirected excluded ${B.filter((r) => !isValid(r)).length}`)
);
if (approx) {
  console.log("note: one side predates overflowKind. Its figures are recomputed from the eight");
  console.log("      worst elements per sample and cannot account for ancestor scrolling, so its");
  console.log("      totals are narrower and its spill higher. Read the direction, not the delta.");
}

console.log("\n                     before      after");
for (const [label, f] of [["intended scrolling", "scroll"], ["ellipsis clipping", "ellipsis"], ["clipped (hidden)", "clipped"], ["vendor internals", "vendor"], ["REAL SPILL", "spill"]]) {
  console.log(`  ${label.padEnd(20)} ${String(totals.a[f]).padStart(7)}   ${String(totals.b[f]).padStart(8)}`);
}
console.log(`\nreal spill: ${better.length} better, ${worse.length} worse, ${same} unchanged`);
console.log(`routes with real spill over 10px: ${routesOver(A)} -> ${routesOver(B)}`);

const show = (title, arr, sign) => {
  if (!arr.length) return;
  console.log(`\n-- ${title} (${arr.length}) --`);
  arr.sort((x, y) => sign * (x.d - y.d)).slice(0, 20).forEach((r) =>
    console.log(`  ${String(r.d > 0 ? "+" + r.d : r.d).padStart(7)}  ${r.a}->${r.b}  ${r.k}`)
  );
};
show("worse", worse, -1);
show("better", better, 1);
