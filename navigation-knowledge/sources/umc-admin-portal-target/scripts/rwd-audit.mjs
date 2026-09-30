#!/usr/bin/env node
/**
 * Responsive regression sweep.
 *
 * Loads every route at each of the four supported breakpoints and records:
 *   1. horizontal overflow, both page-level and per element, classified by
 *      whether anything is actually able to scroll it
 *   2. the layout skeleton (side spacing / sider / gap / content width) against
 *      the design spec
 *   3. a screenshot
 *
 * This is the only objective check the responsive migration has. Programmatic
 * measurement can falsify a claim but never confirm one -- three "fixed"
 * conclusions during the migration were overturned, every time by a screenshot
 * or a controlled experiment. Read the shots.
 *
 * Usage:
 *   node scripts/rwd-audit.mjs --base http://localhost:5177 --token <TOKEN> \
 *        [--routes 10] [--out ./rwd-audit] [--routes-file <path>] [--unscaled]
 *
 * The token comes from localStorage in a logged-in browser; the app accepts it
 * as ?token= (src/services/authBootstrap.ts).
 *
 * See docs/responsive-migration.md.
 */
import fs from "node:fs";
import path from "node:path";

/*
  Playwright is deliberately not a dependency of this project. It is a large
  install that every CI run would pay for, while this sweep is run by hand a few
  times per change to the layout. Install it when you need it:

    npm i -D playwright && npx playwright install chromium

  Promoting it to devDependencies is a team call, not something this script
  should force.
*/
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright is not installed.\n");
  console.error("  npm i -D playwright && npx playwright install chromium\n");
  console.error("It is intentionally not a project dependency -- see the note at the top of this file.");
  process.exit(1);
}

// ---------- args ----------
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:5177").replace(/\/$/, "");
const TOKEN = arg("token", "");
const LIMIT = Number(arg("routes", "0")) || Infinity;
/*
  --unscaled pins the root font-size at 16px. While the app still scaled itself
  proportionally this simulated the state after that scaling was removed, so a
  batch could be judged on its end state rather than on the transitional one.

  Scaling is gone now (P6), so the flag is a no-op against current code. It is
  kept because every baseline in the migration was recorded with it, and those
  reports are only comparable to a run made the same way.
*/
const UNSCALED = process.argv.includes("--unscaled");
const OUT = path.resolve(arg("out", "./rwd-audit"));
const ROUTES_JSON = arg(
  "routes-file",
  path.join(path.dirname(new URL(import.meta.url).pathname), "rwd-routes.json")
);

// ---------- design spec, confirmed with the designer ----------
const SPEC = [
  { name: "1024", w: 1024, margin: 12, sider: 56, gap: 12 },
  { name: "1280", w: 1280, margin: 16, sider: 56, gap: 16 },
  { name: "1440", w: 1440, margin: 24, sider: 96, gap: 24 },
  { name: "1920", w: 1920, margin: 122, sider: 132, gap: 24 },
];
const HEIGHT = { 1024: 1366, 1280: 800, 1440: 960, 1920: 1080 };

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

const routes = JSON.parse(fs.readFileSync(ROUTES_JSON, "utf8"))
  .map((r) => r.path)
  .filter((p) => p && !p.includes(":"))
  .slice(0, LIMIT);

console.log(`${routes.length} routes x ${SPEC.length} breakpoints = ${routes.length * SPEC.length} samples`);
if (!TOKEN) console.log("!  no --token given; protected routes will redirect to /login");

const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });

// Inject the token once; the app persists it to localStorage from there.
if (TOKEN) {
  await page.goto(`${BASE}/?token=${encodeURIComponent(TOKEN)}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

const rows = [];

for (const bp of SPEC) {
  await page.setViewportSize({ width: bp.w, height: HEIGHT[bp.w] });

  for (const route of routes) {
    consoleErrors.length = 0;
    const rec = { bp: bp.name, route, ok: true };
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });

      /*
        Lazy chunks plus real API calls make a fixed wait unreliable -- wait for
        the shell, or for the login form, to actually appear. Waiting too little
        here is not a harmless approximation: a weaker probe written during the
        migration read the app mid-redirect and produced a confident, wrong
        conclusion about which routes were reachable.
      */
      const shell = await Promise.race([
        page.waitForSelector(".layout", { timeout: 25000 }).then(() => "app").catch(() => null),
        page.waitForSelector("input[type=password]", { timeout: 25000 }).then(() => "login").catch(() => null),
      ]);
      rec.shell = shell || "timeout";
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(800);

      rec.url = page.url().replace(BASE, "");
      rec.redirectedToLogin = /login/i.test(page.url());

      /*
        A sample that redirected measured the fallback page, not the route it is
        filed under. Without this check the sweep silently attributed one page's
        pixels to another; on one run that was 120 of 352 samples.

        Query strings and trailing slashes are stripped first -- the app appends
        things like ?tab=, which is not a redirect.
      */
      const norm = (u) => u.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
      rec.landed = norm(rec.url);
      rec.valid = norm(route) === rec.landed;

      if (UNSCALED) {
        await page.evaluate(() => { document.documentElement.style.fontSize = "16px"; });
        await page.waitForTimeout(600); // let the reflow settle
      }

      const probe = await page.evaluate(() => {
        const de = document.documentElement;
        const overflowPx = de.scrollWidth - de.clientWidth;

        const describe = (el) =>
          el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : "") +
          (typeof el.className === "string" && el.className
            ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
            : "");

        /*
          Page-level scrollWidth misses the overflow that matters most here: the
          content area sits inside SimpleBar, so content too wide for it
          overflows within a scroll container and never reaches the document.
          Scan every box whose scrollWidth exceeds its clientWidth instead.
        */
        const innerOver = [];
        document.querySelectorAll("*").forEach((el) => {
          const over = el.scrollWidth - el.clientWidth;
          if (over <= 1 || el.clientWidth === 0) return;
          const cs = getComputedStyle(el);
          if (cs.display === "inline") return;

          /*
            An element whose only oversized content is an absolutely positioned
            child is an anchor, not a container -- the child was deliberately
            placed outside it and something further up reserves the room. The
            bar charts do this: .reports-bar-meta sits at calc(100% + 8px) off
            the fill anchor while the track reserves 100px of padding for it.
            Counting it made a page that renders correctly at 960 report 1,726px
            of spill.
          */
          const oversizedKids = [...el.children].filter(
            (c) => c.getBoundingClientRect().right > el.getBoundingClientRect().right + 1
          );
          if (oversizedKids.length && oversizedKids.every((c) => getComputedStyle(c).position === "absolute")) return;

          /*
            An element inside a scroll container is not spilling -- the container
            scrolls it. The dashboard's task row is exactly that: a carousel
            inside SimpleBar, visually correct at every width, which the earlier
            classifier counted as 7,716px of spill because it only looked at the
            element's own overflow-x. Walk up and find out whether anything can
            actually scroll this.
          */
          let scroller = null;
          let vendor = null;
          for (let a = el; a && a !== document.body; a = a.parentElement) {
            /*
              Third-party widgets that size their own internals. Google Maps
              builds a canvas 1.5x its container for panning and clips it; every
              node between the map root and the canvas reports the same overflow,
              and most of them carry no class at all, so matching on the
              element's own selector catches only one of five. Ask whether the
              element sits inside such a widget instead.
            */
            if (!vendor && a !== el && /(^|\s)gm-style(\s|$)/.test(a.className || "")) {
              vendor = describe(a);
            }
            /*
              The wrappers *above* the widget report the same overflow, because
              their child is oversized. On the inspection visit page that is an
              unclassed div sitting between the clipping frame and the map,
              reporting the map's own 543px.
            */
            if (!vendor && a === el && el.querySelector(".gm-style")) {
              vendor = "contains .gm-style";
            }
            if (a === el) continue;
            const ax = getComputedStyle(a).overflowX;
            if (!scroller && (ax === "auto" || ax === "scroll") && a.scrollWidth - a.clientWidth > 1) {
              scroller = describe(a);
            }
            if (scroller && vendor) break;
          }

          innerOver.push({
            sel: describe(el),
            over,
            box: el.clientWidth,
            need: el.scrollWidth,
            overflowX: cs.overflowX,
            scroller,
            vendor,
          });
        });
        innerOver.sort((a, b) => b.over - a.over);

        // Elements that actually push the document wider.
        const culprits = [];
        if (overflowPx > 1) {
          const vw = de.clientWidth;
          document.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.right > vw + 1 || r.left < -1) {
              culprits.push({ sel: describe(el), right: Math.round(r.right), w: Math.round(r.width) });
            }
          });
        }

        /*
          Skeleton measurement.

          Note this measures .page-content__inner rather than .layout-content:
          the latter is flex:1 with padding-inline-end 0, so it runs to the
          viewport edge to keep the scrollbar flush, and is not the visual
          content area. The real content width comes from the inner wrapper's
          min(100% - scroll-edge-spacing, --layout-visual-content-width), and the
          right margin follows from it. Measuring the outer box reads 1642 where
          the spec says 1520.
        */
        const sider = document.querySelector(".layout > :first-child");
        const outer = document.querySelector(".layout-content");
        const inner = document.querySelector(".page-content__inner")
          || document.querySelector(".layout-content__inner");
        const m = (el) => (el ? el.getBoundingClientRect() : null);
        const sb = m(sider), ob = m(outer), ib = m(inner);

        /*
          Overflow split by whether it is a defect, which the raw total cannot
          show.

          Third-party widgets that size their own internals are excluded. Google
          Maps builds a canvas 1.5x its container on purpose, for panning, and
          the container clips it -- measured at 502 -> 753 and 1086 -> 1629,
          exactly 50% at both. Counting that as spill made
          /inspection/tasks/execution the worst route in the app, and made it
          look worse the wider the viewport got, which is backwards for a
          responsive defect and was the clue that the reading was wrong.
        */
        const VENDOR_INTERNALS = /gm-style|simplebar-height-auto-observer/;

        const kind = { scroll: 0, ellipsis: 0, clipped: 0, spill: 0, vendor: 0 };
        for (const e of innerOver) {
          if (e.vendor || VENDOR_INTERNALS.test(e.sel)) kind.vendor += e.over;
          else if (e.overflowX === "auto" || e.overflowX === "scroll") kind.scroll += e.over;
          else if (e.scroller) kind.scroll += e.over;           // scrolled by an ancestor
          else if (e.overflowX === "hidden") {
            if (/ellipsis/.test(e.sel)) kind.ellipsis += e.over;
            else kind.clipped += e.over;
          } else kind.spill += e.over;
        }

        return {
          overflowPx,
          innerOverflow: innerOver.slice(0, 8),
          innerWorst: innerOver.length ? innerOver[0].over : 0,
          overflowKind: kind,
          rootFontSize: parseFloat(getComputedStyle(de).fontSize),
          culprits: culprits.slice(0, 6),
          measured: sb && ob && ib ? {
            marginLeft: Math.round(sb.left),
            sider: Math.round(sb.width),
            gap: Math.round(ob.left - sb.right),
            content: Math.round(ib.width),
            marginRight: Math.round(de.clientWidth - ib.right),
            outerWidth: Math.round(ob.width),
          } : null,
        };
      });

      Object.assign(rec, probe);

      if (probe.measured) {
        const dev = [];
        if (probe.measured.marginLeft !== bp.margin) dev.push(`margin ${probe.measured.marginLeft}!=${bp.margin}`);
        if (probe.measured.sider !== bp.sider) dev.push(`sider ${probe.measured.sider}!=${bp.sider}`);
        if (probe.measured.gap !== bp.gap) dev.push(`gap ${probe.measured.gap}!=${bp.gap}`);
        rec.deviations = dev;
      }
      rec.consoleErrors = consoleErrors.slice(0, 3);

      const slug = route.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") || "root";
      await page.screenshot({ path: path.join(OUT, "shots", `${bp.name}__${slug}.png`), fullPage: false });
    } catch (e) {
      rec.ok = false;
      rec.error = String(e).split("\n")[0].slice(0, 160);
    }
    rows.push(rec);
    const flag = !rec.ok
      ? "ERR   "
      : rec.valid === false
      ? "SKIP  "
      : rec.overflowPx > 1
      ? `PAGE+${rec.overflowPx}`
      : rec.innerWorst > 1
      ? `IN+${rec.innerWorst}`
      : "  ok  ";
    const note = rec.valid === false ? `\t-> ${rec.landed}` : "";
    console.log(`  [${bp.name}] ${flag}\t${route}${note}`);
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(rows, null, 2));

// ---------- summary ----------
const valid = rows.filter((r) => r.valid !== false);
const invalid = rows.filter((r) => r.valid === false);
const overflow = valid.filter((r) => r.overflowPx > 1);

console.log("\n====== summary ======");
console.log(`${rows.length} samples, ${rows.filter((r) => !r.ok).length} failed, ${overflow.length} with page-level overflow`);
console.log(`root font-size observed: ${[...new Set(rows.map((r) => r.rootFontSize).filter(Boolean))].join(", ")}px`);

if (invalid.length) {
  const list = [...new Set(invalid.map((r) => `${r.route}  ->  ${r.landed}`))].sort();
  console.log(`\n! ${invalid.length}/${rows.length} samples did not land on the route requested (${list.length} routes), counted as invalid:`);
  list.forEach((s) => console.log(`    ${s}`));
  console.log("  They measured a fallback page and cannot be filed under their route name.");
}

/*
  The headline overflow number is not a defect count. Most of it is horizontal
  scrolling the design asks for, plus antd's ellipsis clipping. Splitting it is
  the only way to see whether a change helped: after P4 added table scrolling,
  the raw total stopped moving while real spill kept falling.
*/
const total = valid.reduce((a, r) => {
  const k = r.overflowKind || {};
  a.scroll += k.scroll || 0; a.ellipsis += k.ellipsis || 0;
  a.clipped += k.clipped || 0; a.spill += k.spill || 0; a.vendor += k.vendor || 0;
  return a;
}, { scroll: 0, ellipsis: 0, clipped: 0, spill: 0, vendor: 0 });

console.log("\n-- overflow by intent (valid samples) --");
console.log(`  intended scrolling  ${String(total.scroll).padStart(7)}   not a defect`);
console.log(`  ellipsis clipping   ${String(total.ellipsis).padStart(7)}   not a defect`);
console.log(`  clipped (hidden)    ${String(total.clipped).padStart(7)}   needs review`);
console.log(`  vendor internals    ${String(total.vendor).padStart(7)}   not a defect (maps canvas etc.)`);
console.log(`  REAL SPILL          ${String(total.spill).padStart(7)}   the number that matters`);

const skew = valid.filter((r) => (r.deviations || []).length);
console.log(`\nskeleton deviations: ${skew.length} / ${valid.length}`);
skew.slice(0, 10).forEach((r) => console.log(`  [${r.bp}] ${r.route}  ${r.deviations.join(", ")}`));

const spillRows = valid
  .map((r) => ({ r, spill: (r.overflowKind || {}).spill || 0 }))
  .filter((x) => x.spill > 10)
  .sort((a, b) => b.spill - a.spill);

if (spillRows.length) {
  console.log(`\n-- worst real spill (${spillRows.length} samples over 10px) --`);
  spillRows.slice(0, 20).forEach(({ r, spill }) =>
    console.log(`  +${String(spill).padStart(6)}  [${r.bp}] ${r.route}`)
  );
}

console.log(`\nreport: ${path.join(OUT, "report.json")}`);
console.log(`shots:  ${path.join(OUT, "shots")}`);
