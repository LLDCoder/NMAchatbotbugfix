#!/usr/bin/env node
/*
  Measures whether text actually steps down between breakpoints.

  The first scoreboard counted text rendering at >= 16px at 1024. That conflates
  two different things: text that never migrated, and text that migrated and
  ramped 18 -> 16, which lands exactly on the threshold. /inspection/tasks showed
  the flaw -- its remaining 15 elements come from an 18px rule that would still
  count as unramped after a correct migration.

  So compare the element against itself instead. Pin the root font-size to 16px
  (the post-P6 state), measure at 1920, then at 1024. A migrated file steps down;
  an unmigrated one renders its 1920 value at both widths. The ratio needs no
  threshold and no assumption about what the right absolute size is.

  Elements are tagged at 1920 and re-read by tag at 1024, so the two passes are
  compared element by element rather than by document position, which reflow
  would otherwise shift.
*/
import fs from "node:fs";
/*
  Playwright is deliberately not a project dependency -- see scripts/rwd-audit.mjs.
    npm i -D playwright && npx playwright install chromium
*/
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright is not installed.\n\n  npm i -D playwright && npx playwright install chromium\n");
  process.exit(1);
}

const BASE = process.argv[2];
const TOKEN = process.argv[3];
if (!BASE || !TOKEN) {
  console.error("usage: node scripts/rwd-ramp-coverage.mjs <base-url> <token> [out.json]");
  process.exit(1);
}
const OUT = process.argv[4] || "";

const ROUTES = [
  "/system-management/roleManagement",
  "/licensing/licenses",
  "/licensing/applications",
  "/content/ContentLibrary",
  "/happiness/tickets",
  "/inspection/tasks",
  "/financial-payment/transactions",
  "/cms/pageManagement",
];

const TAG = (fn) => fn;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/?token=${encodeURIComponent(TOKEN)}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const settle = async () => {
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.documentElement.style.fontSize = "16px"; });
  await page.waitForTimeout(600);
};

const rows = [];
let gTotal = 0, gRamped = 0;

for (const route of ROUTES) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".layout", { timeout: 25000 }).catch(() => {});
  await settle();

  const at1920 = await page.evaluate(() => {
    const out = {};
    let i = 0;
    for (const el of document.querySelectorAll(".page-content__inner *")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const id = "p" + i++;
      el.setAttribute("data-probe", id);
      out[id] = parseFloat(cs.fontSize);
    }
    return out;
  });

  await page.setViewportSize({ width: 1024, height: 1366 });
  await settle();

  const at1024 = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("[data-probe]")) {
      out[el.getAttribute("data-probe")] = parseFloat(getComputedStyle(el).fontSize);
    }
    return out;
  });

  let total = 0, ramped = 0;
  for (const [id, big] of Object.entries(at1920)) {
    const small = at1024[id];
    if (small === undefined) continue; // element gone after reflow
    total++;
    if (small < big - 0.4) ramped++;
  }
  gTotal += total; gRamped += ramped;
  const pct = total ? ((ramped / total) * 100).toFixed(1) : "—";
  rows.push({ route, total, ramped });
  console.log(`${route.padEnd(40)} comparable=${String(total).padStart(4)}  stepped down=${String(ramped).padStart(4)} (${pct}%)`);
}

console.log(`\ntotal  comparable ${gTotal}  stepped down ${gRamped}  (${((gRamped / gTotal) * 100).toFixed(1)}%)`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ rows, gTotal, gRamped }, null, 2));
await browser.close();
