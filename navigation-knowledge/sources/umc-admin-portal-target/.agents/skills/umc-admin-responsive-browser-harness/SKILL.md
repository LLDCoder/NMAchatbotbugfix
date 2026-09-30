---
name: umc-admin-responsive-browser-harness
description: Use when auditing or verifying responsive UI changes in the UMC Admin Portal with a real browser, especially multi-route breakpoint sweeps, FilterTable or AntD Form toolbars, filter modals, overflow, clipped actions, placeholder typography, close-icon alignment, and reviewed before/after screenshots.
---

# UMC Admin Responsive Browser Harness

## Overview

Turn responsive UI claims into repeatable browser evidence. Use the project viewport matrix, exercise every relevant route state, run objective DOM probes, save screenshots, and visually review every artifact before reporting success.

**REQUIRED SUB-SKILL:** Use `playwright`.

For FilterTable or custom filter-toolbar implementation work, also use `maintaining-filtertable-responsive-ui`.

## Required Inputs

Resolve these inputs before starting:

| Input | Required value |
| --- | --- |
| Base URL | The fresh local server URL printed by Vite |
| Authentication | Credentials or an already authenticated Playwright CLI session authorized by the user |
| Routes | Exact route paths in scope |
| States | Relevant tabs, task states, modal states, and permission-dependent variants |
| Reference | The named project reference page or existing responsive contract |
| Output | `output/playwright/<task-name>/` |

Never store credentials in source, scripts, screenshots, or this skill.

Resolve values from the user request, `AGENTS.md`, the active Vite output, and the
responsive implementation skill before asking the user. If authentication,
permission role, test data, or the reference contract is still unknown and changes
the expected result, stop and report that exact blocker. Do not invent a role,
record, or responsive rule.

An accessible pre-change deployment is optional. When one is unavailable, preserve
the user's current worktree, record the failing DOM measurement and supplied issue
evidence, and compare behavior-sensitive network fingerprints before and after the
UI-only edit. Do not create a worktree, reset files, or reconstruct an old build
solely to manufacture before evidence.

## Viewport Matrix

Use the smallest matrix that proves the contract:

| Purpose | Viewport |
| --- | --- |
| Small-content band | `1024x900` |
| Reported compact issue | `1280x891` |
| Existing project band | `1440x900` |
| Intermediate regression | `1809x891` |
| Compact boundary | `1919x1080` |
| Desktop baseline | `1920x1080` |

Always include `1280`, `1919`, and `1920` for a structural `<1920px` change. Add the other widths when the user requests a sweep or when wrapping changes across the range.

## Workflow

1. Establish a failing baseline.
   - Start the requested mode as a fresh service and use the port Vite actually prints.
   - Open a named Playwright CLI session, log in through visible controls, and navigate to the exact route.
   - Reproduce the reported state and run a DOM probe that fails for the reported reason before editing.
   - Save a before screenshot when the current source or an accessible deployment still exposes the defect. Otherwise cite the user-supplied issue image and record why a new before screenshot cannot be produced safely.
2. Build a route-state matrix.
   - Run `node .agents/skills/umc-admin-responsive-browser-harness/scripts/extract-secondary-menu-routes.mjs` to obtain the static second-level route/page inventory.
   - Run `node .agents/skills/umc-admin-responsive-browser-harness/scripts/build-route-state-manifest.mjs` for the credential-free role/state execution manifest. Resolve `captured-1920-baseline` actions and `semantic-page-config` modal fields before claiming a state passed.
   - Compare it with menus actually visible for each authorized role. A direct URL does not prove menu reachability.
   - List each route with its default state, relevant tabs, Filter modal state, and any secondary panel that owns a different toolbar.
   - Store role names, route paths, tabs, expected actions, and modal field names only. Never store account identifiers or passwords.
   - Re-snapshot after every navigation, tab switch, or modal open.
   - Use snapshot refs for interactions. Use `run-code` only for deterministic measurements.
3. Probe objective invariants.
   - Read [probes.md](references/probes.md) before measuring.
   - Enumerate every explicit `.filter-table-header` and `.responsive-filter-toolbar`; do not stop after the first match.
   - Check document overflow, panel boundaries, toolbar child count, control and action rows, modal labels, placeholder computed styles, close-icon center delta, and the 12px toolbar-to-table gap at every tested width.
   - For a page-owned modal, configure equivalent root, item, and label
     selectors and run the same probe. A non-shared class name is not an
     exemption from modal invariants.
   - Record the returned values instead of relying on appearance alone.
4. Exercise behavior without changing it.
   - Verify Search timing, Select and RangePicker changes, Apply, Cancel, Reset, pagination, sorting, export, and permission-controlled actions that are in scope.
   - Treat the observed pre-change request count, timing, and serialization as the contract. Do not assume a debounce interval from naming or nearby code.
   - Skip permission-dependent actions when the authorized role or stable test data is not in scope, and report the untested branch explicitly.
   - Confirm compact-to-desktop resizing preserves selected values.
   - Capture a before/after request fingerprint for each exercised control: method, normalized URL, query keys, body keys, and request count. Never persist authorization headers or request bodies containing personal data.
   - Capture the visible desktop action inventory before editing and compare it at `1920px` after editing.
5. Capture after evidence.
   - Wait until visible `.ant-spin-spinning` elements disappear. If a page uses
     charts or skeleton animation, sample the target geometry twice at least
     300ms apart and capture only after two consecutive samples match.
   - Save screenshots with `<route-or-state>-<width>x<height>.png`.
   - Capture default and modal states separately.
   - Keep browser chrome out of screenshots unless the user explicitly requests it.
6. Review every screenshot.
   - Open every artifact and inspect control heights, spacing, wrapping, button text, action alignment, modal rows, table containment, and empty states.
   - A screenshot existing on disk is not evidence until it has been visually reviewed.
7. Close the named browser session and report exact results.

## Pass/Fail Contract

Fail the responsive audit when any of these occurs:

- `document.documentElement.scrollWidth` exceeds `clientWidth` by more than 1 CSS pixel.
- A control, action, or visible label crosses its panel boundary or is clipped.
- A compact FilterTable shows a different inline-filter count than its verified contract.
- A modal filter has an empty label.
- A modal filter label repeats its placeholder or uses empty-state wording such
  as `All ...` or `Select ...` instead of the established field name.
- An English modal label or placeholder uses sentence case where the module
  contract requires Title Case, for example `All statuses` instead of
  `All Statuses` or `Start date` instead of `Start Date`.
- Select and RangePicker placeholders differ in family, size, weight, or color at the same viewport.
- The visible close SVG and modal header vertical centers differ by more than 1 CSS pixel after animation.
- A modal item contains unexplained vertical space beyond its label, declared
  gap, and rendered control height.
- A normal modal item spans more than one track in the shared two-column grid,
  including a single-field modal that stretches across the full dialog.
- An action intended for the first toolbar row moves to a lower row.
- A responsive change alters request timing, serialization, filtering, export, pagination, permissions, or modal draft behavior.
- A registered toolbar is skipped because another toolbar appears first in the DOM.
- The table starts at a distance other than the verified 12px below a custom
  toolbar at any tested width, including the `1920px` desktop baseline.
- Visible same-row toolbar controls use inconsistent heights, such as a `48px`
  Search beside a `40px` compact Filter.
- A route is reported as menu-tested when it was reached only by direct URL.

Do not fail expected horizontal scrolling inside an AntD Table, a tab strip, or another container whose computed `overflow-x` is `auto` or `scroll`. Fail non-scrollable spill and document-level overflow.

## Screenshot Deliverable

At minimum, deliver:

- One compact and one desktop screenshot for every route.
- Boundary evidence at `1919` and `1920` for structural breakpoint changes.
- A Filter modal screenshot for every distinct filter configuration.
- Additional screenshots for tabs or states whose toolbar or table structure differs.

Place all artifacts under one task folder and link the reviewed screenshots in the final response.

## Console and Static Checks

- Capture browser console errors before and after the change.
- Separate known baseline warnings from newly introduced errors.
- Run the repository checks required by `AGENTS.md`.
- Do not fix unrelated historical errors to make the audit look clean.

## Common Mistakes

- Reusing an old server without confirming the active port or source state.
- Testing only `1280` and missing the `1919`/`1920` boundary.
- Clicking stale refs after a tab switch or modal transition.
- Reading normal input color instead of `::placeholder`.
- Measuring `.ant-modal-close` while ignoring the visible SVG.
- Treating a table scroll container as document overflow.
- Saving screenshots without opening and reviewing them.
- Running toolbar/table spacing and control-height probes only at compact widths
  while visually accepting a broken desktop screenshot.
- Capturing a loading overlay, skeleton, or an in-progress chart animation as
  final evidence.
- Claiming no new console errors without recording the baseline.
- Using an English-only label regex as proof for Arabic. Compare semantic i18n
  values and placeholder equality in the active locale.
- Saving credentials in a route-state manifest or browser helper.

## Example

```bash
playwright-cli -s=responsive-audit open http://localhost:5174/login --headed
playwright-cli -s=responsive-audit snapshot
# Fill authorized credentials using the current snapshot refs.
playwright-cli -s=responsive-audit goto http://localhost:5174/licensing/applications
playwright-cli -s=responsive-audit resize 1280 891
playwright-cli -s=responsive-audit snapshot
playwright-cli -s=responsive-audit screenshot \
  --filename=output/playwright/licensing-responsive/applications-1280x891.png
playwright-cli -s=responsive-audit close
```

Use the probe functions from [probes.md](references/probes.md) between navigation and screenshot commands.
