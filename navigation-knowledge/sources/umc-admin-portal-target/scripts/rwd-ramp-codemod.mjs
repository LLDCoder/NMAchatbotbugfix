#!/usr/bin/env node
/*
  Applies the design's unambiguous step-downs to a LESS/CSS file, by inserting a
  nested `@media (max-width: 1919.98px)` block at the end of each rule that has
  rampable declarations. LESS bubbles nested media queries out, so the transform
  stays local to one block and never needs to reconstruct selector paths.

  It also stamps the `@rwd-literal-px` directive on every file it migrates, so
  the breakpoints and the switch that makes them meaningful never come apart.
  See the note above `withDirective` below.

  See RAMPS for what steps down. font-size and border-radius follow the spec
  exactly; gap, padding and line-height take a default where the spec lists more
  than one target for the same source value.

  Excluded on purpose:
    width          not covered by the spec at all.
    height         48->32 and 48->40 both exist and depend on the button's role,
                   so a wrong guess is structural rather than a few px.

  Usage:
    node ramp-codemod.mjs <file...>            dry run, prints planned edits
    node ramp-codemod.mjs --write <file...>    apply
    node ramp-codemod.mjs --check <file...>    exit 1 if any file would change
*/
import fs from "node:fs";

const BREAKPOINT = "@media (max-width: 1919.98px)";
const MARKER = "rwd-ramp";
const DIRECTIVE = "@rwd-literal-px";

const RAMPS = {
  // Spec-exact.
  "font-size": { 20: 18, 18: 16, 16: 14, 14: 12, 12: 10 },
  "border-radius": { 20: 10, 16: 10 },

  /*
    Default mappings, not spec-exact. The spec lists 16->12, 24->16, 24->12,
    16->8 and 20->12 without saying which applies where, so these take the more
    frequent target for each source value.

    Applying a default beats leaving the value alone. At 1024 an unramped 24px
    gap is 8-12px larger than any documented target, whereas guessing 16 when
    12 was meant is 4px out. The regression sweep catches structural damage;
    a 4px spacing difference is a design review item, not a defect.
  */
  gap: { 24: 16, 20: 12, 16: 12, 12: 8 },
  "row-gap": { 24: 16, 20: 12, 16: 12, 12: 8 },
  "column-gap": { 24: 16, 20: 12, 16: 12, 12: 8 },
  padding: { 24: 12, 20: 12, 16: 12, 12: 8 },
  "line-height": { 24: 20, 20: 16, 18: 16, 16: 14 },
};

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));

/* A declaration we know how to ramp: single px value, not a var, not a shorthand. */
const DECL = /^(\s*)([a-z-]+)\s*:\s*(\d+)px\s*;/;

function transform(src) {
  const lines = src.split("\n");
  const out = [];
  const edits = [];

  // Stack of blocks currently open. Each holds the ramped decls found directly
  // inside it, and the indent to emit them at.
  const stack = [];
  let inComment = false;
  let inMedia = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track block comments so px inside prose is never touched.
    if (!inComment && trimmed.includes("/*") && !trimmed.includes("*/")) inComment = true;
    else if (inComment && trimmed.includes("*/")) inComment = false;
    const isComment = inComment || trimmed.startsWith("//") || trimmed.startsWith("/*");

    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    // Never ramp inside an existing media query -- those values are already
    // breakpoint-specific, and re-ramping them would compound.
    const opensMedia = /@media/.test(line) && opens > 0;

    if (!isComment && !inMedia) {
      const m = line.match(DECL);
      if (m && stack.length) {
        const [, indent, prop, valStr] = m;
        const ramp = RAMPS[prop];
        const val = Number(valStr);
        if (ramp && ramp[val] !== undefined) {
          stack[stack.length - 1].ramped.push({ indent, prop, from: val, to: ramp[val] });
          edits.push({ line: i + 1, prop, from: val, to: ramp[val] });
        }
      }
    }

    // Emit pending ramps just before the block closes.
    if (closes > 0 && stack.length) {
      const top = stack[stack.length - 1];
      if (top.ramped.length && !inMedia) {
        /*
          A block's final declaration may legally omit its semicolon. Inserting
          an @media straight after one makes the declaration swallow it, and
          LESS reports "Unrecognised input". Terminate it first.
        */
        for (let j = out.length - 1; j >= 0; j--) {
          const prev = out[j].trim();
          if (!prev) continue;
          if (/[;{}]$/.test(prev) || prev.startsWith("//") || prev.endsWith("*/")) break;
          if (/^[a-z-]+\s*:/i.test(prev)) out[j] = out[j] + ";";
          break;
        }
        const pad = top.indent + "  ";
        out.push(`${pad}/* ${MARKER} */`);
        out.push(`${pad}${BREAKPOINT} {`);
        for (const r of top.ramped) out.push(`${pad}  ${r.prop}: ${r.to}px;`);
        out.push(`${pad}}`);
      }
    }

    out.push(line);

    for (let k = 0; k < opens; k++) {
      if (opensMedia && k === 0) inMedia++;
      else stack.push({ ramped: [], indent: line.match(/^\s*/)[0] });
    }
    for (let k = 0; k < closes; k++) {
      if (inMedia > 0 && stack.length === 0) inMedia--;
      else if (stack.length) stack.pop();
      else if (inMedia > 0) inMedia--;
    }
  }

  return { code: out.join("\n"), edits };
}

/*
  Migrating a file means two things that must never come apart: it declares the
  px-literal directive, and its values step down at the breakpoint. A file with
  breakpoints but no directive still gets its px rewritten to rem, so the ramps
  fight the scaling instead of replacing it -- silently, and only below 1920.
  scripts/check-rwd-directive.mjs enforces the pairing; this codemod produces it.
*/
const withDirective = (src, file) =>
  src.includes(DIRECTIVE) ? src : `/* ${DIRECTIVE} -- see postcss.config.js */\n${src}`;

let changed = 0;
let marked = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (src.includes(MARKER)) {
    console.log(`  skip (already ramped)  ${f}`);
    continue;
  }
  /*
    A file that already carries the 1920 breakpoint was migrated by hand. Its
    author decided what steps down and by how much; re-ramping it emits a second
    block with the same declarations (CustomButton produced 8 exact duplicates).
    Leave those files to the human who wrote them -- but still ensure the switch.
  */
  if (src.includes(BREAKPOINT)) {
    const out = withDirective(src, f);
    if (out !== src) { marked++; if (WRITE) fs.writeFileSync(f, out); }
    console.log(`  skip (hand-migrated)   ${f}`);
    continue;
  }
  const { code, edits } = transform(src);
  if (!edits.length) {
    /*
      No rampable declaration does not mean "do not migrate". The file still has
      to stop scaling; it simply has nothing the spec says to step down.
    */
    const out = withDirective(src, f);
    if (out !== src) { marked++; if (WRITE) fs.writeFileSync(f, out); }
    console.log(`  no rampable decls      ${f}  (switch ${WRITE ? "added" : "would be added"})`);
    continue;
  }
  changed++;
  const summary = edits.reduce((a, e) => {
    const k = `${e.prop} ${e.from}->${e.to}`;
    a[k] = (a[k] || 0) + 1;
    return a;
  }, {});
  console.log(`  ${WRITE ? "wrote" : "would ramp"} ${String(edits.length).padStart(3)}  ${f}`);
  Object.entries(summary).sort((a, b) => b[1] - a[1]).forEach(([k, n]) =>
    console.log(`        ${k}  x${n}`)
  );
  if (WRITE) fs.writeFileSync(f, withDirective(code, f));
}

console.log(`\n${changed} file(s) ${WRITE ? "ramped" : "would ramp"}` + (marked ? `, ${marked} switch-only` : ""));
if (CHECK && changed) process.exit(1);
