---
name: maintaining-filtertable-responsive-ui
description: Use when changing UMC Admin Portal modules that use src/components/common/FilterTable, Ant Design 4 Modal, or a custom AntD Form toolbar and show width-dependent wrapping, misplaced actions, missing filter labels, misaligned close icons, or inconsistent Select and RangePicker placeholder typography.
---

# Maintaining FilterTable Responsive UI

## Overview

Preserve the repository's existing responsive contract instead of inventing new breakpoints or visual rules. Separate page-owned toolbar behavior from shared FilterTable modal invariants, make the smallest scoped change, and prove the result in a real browser.

**REQUIRED SUB-SKILLS:** Use `react-frontend`, `antd-4-compatibility`, and `playwright`.

## Workflow

1. Reproduce the issue before editing.
   - Start the requested mode, normally `npm run dev:daypop`, and use the port printed by Vite.
   - Use authorized credentials from the task; never store credentials in this skill or source.
   - Inspect the affected module, `src/components/common/FilterTable`, project RWD styles, and the named reference page such as `/happiness/tickets`.
   - Record a failing DOM assertion or computed-style measurement and a before screenshot.
2. Determine ownership before changing code.
   - Page filter configuration owns labels and business-specific filter content.
   - The page may set `maxVisibleFilters` only when it does not follow an existing shared responsive mode.
   - Shared `FilterTable` responsive modes own reusable toolbar sizing, wrapping, and filter-collapse behavior.
   - Shared opt-in BEM toolbar classes own reusable compact layout for custom AntD Form toolbars that must preserve page-owned form behavior.
   - Page Less owns only module-specific exceptions that cannot be represented by a shared mode.
   - Shared `FilterTable/index.less` owns invariants that must hold in every FilterTable modal.
   - Do not move a page-only exception into global CSS.
3. Inspect the cascade rather than guessing.
   - Search with `rg` for the exact class and property.
   - Measure `getComputedStyle()` and bounding boxes in Playwright.
   - When the winner is unclear, use the browser CSS protocol to inspect matched rules and specificity.
4. Implement the minimum change and verify every relevant tab, task state, and filter mode on the target page.

## Action Preservation Gate

Treat the reference page as evidence for responsive layout, sizing, and
placement—not as a source of target-page business controls.

Before editing, record the target toolbar's existing actions at the desktop
baseline. After editing:

- The `1920px` action inventory must be identical to the pre-change target.
- Compact mode may add a Filter trigger only when hiding existing inline fields
  would otherwise make those fields unreachable.
- That Filter trigger may expose only the target page's existing filter fields.
- Do not introduce Reset, Add, bulk actions, export variants, or request
  semantics from the reference page.
- If an existing action becomes compact-only, prove that desktop behavior and
  permissions remain unchanged.

This gate takes precedence over visual similarity to the reference.

## Responsive Contract

| Concern | Required behavior |
| --- | --- |
| Breakpoints | Reuse existing project breakpoints. For the current responsive ramp, compact styles use `max-width: 1919.98px` and the baseline desktop width is `1920px`. Verify the target module and reference page before applying the same visible-filter count elsewhere. |
| Modal labels | Every control that can enter the filter modal must use `{ label, element }`. The label names the field (`Status`, `User Type`, `Submission Time`); the placeholder describes the empty value (`All Statuses`, `All User Types`, `Start date`). Resolve both from existing i18n keys for the same business field. Never reuse an `All ...`, `Select ...`, `Search ...`, or date-boundary placeholder as the label. |
| Inline filters | Prefer an existing shared responsive mode. Use `maxVisibleFilters` only for a verified exception, and keep search visible when that is the established module pattern. |
| Shared toolbar mode | Use the `responsiveToolbar` prop when the module follows the standard Applications-style contract: below `1920px`, keep the first filter inline and move the remaining filters into the modal. Do not duplicate `window.matchMedia` state or the matching toolbar Less in the page. |
| Custom Form toolbar | First verify the reference layout and the target page's existing actions separately. If compact mode moves secondary fields into a modal, use `responsive-filter-toolbar__field--compact-hidden`, mirror those fields in the modal with explicit labels, and expose only the minimum compact-only Filter trigger required to reach them. Keep Export in `responsive-filter-toolbar__action`. Never copy Reset, Add, or another business action merely because the reference page has it. Preserve the target page's Form, serialization, request timing, permissions, and export behavior. The current contract keeps `12px` between every registered toolbar row and its table at both compact and desktop widths, matching `/happiness/tickets`; measure both bounding boxes at every tested breakpoint instead of inferring this spacing from a screenshot. |
| Toolbar control height | A registered custom toolbar uses `40px` visible controls below `1920px` and preserves its verified `48px` desktop baseline at `1920px` and above. Search, compact Filter, Reset, and same-row actions must not mix heights. Page selectors that set desktop control height must not outrank the shared compact modifier. |
| Centered simple actions | Use the explicit `responsive-filter-toolbar--center-actions` modifier only for a single-row Search/action or report toolbar whose legacy control container is taller than its visible 40px controls. Multi-row compact toolbars keep first-row alignment instead. |
| Flex width isolation | A page control may use `flex-basis` as a desktop width. When that control is moved beneath a column wrapper, the basis becomes height. The responsive item/modal wrapper must neutralize child flex sizing (`flex: none`) and own the width. Reject tall Search controls and modal grid rows with unexplained blank space. |
| Placeholder typography | Within FilterTable modals, Select and RangePicker placeholders must resolve to the same family, size, weight, and color. Current contract: `Inter, sans-serif`, `400`, `#797e86`; `12px` below 1920 and `14px` at 1920 and above. |
| Modal field width | Filter dialogs use a two-column field grid. A single field occupies the first column and leaves the second column empty; it must not automatically span the full dialog width. Use a page-specific full-width modifier only when an existing verified design explicitly requires it. |
| English capitalization | English filter labels and placeholders follow the module's established Title Case convention: `Refund Category`, `All Categories`, `All Statuses`, `Current Handler`, `Start Date`, and `End Date`. Reject sentence-case variants such as `All categories` or `Start date` in the same dialog. Correct the existing English i18n value instead of hard-coding transformed text in the component. Do not apply English casing rules to Arabic or other locales. |
| Close icon | The visible SVG center must match the modal-header center. Global `src/App.less` adds `margin-top: 18px` to `.ant-modal-close-x`; FilterTable must reset it to `0` and use flex centering. Verify the actual header height before copying a fixed height to another modal. |
| Specificity | Scope overrides through `.filter-modal-content`. Applications page Select rules can outrank a two-class modal selector, so target the actual selector chain before considering `!important`. |
| Ant Design | This repository uses `antd@4.22.8`. Modal uses `visible`, not AntD 5 `open`. Treat installed declarations as authoritative. |

## Filter Configuration Example

```tsx
{
  label: t("applications.tableColumns.type"),
  element: (
    <Select
      key="select-type"
      placeholder={t("serviceConfiguration.filters.allType")}
      className="filters-select"
      options={types}
      allowClear
    />
  ),
}
```

Use existing i18n keys. Verify the label against the corresponding table column,
form field, or established module terminology. Keep the empty-state wording in
`placeholder`; do not derive either string from the other. Do not add guessed
labels, fields, options, or fallback business data.

## Reuse Architecture

Use four layers and keep their responsibilities separate:

1. Page configuration supplies business-specific filters, labels, options, request mapping, and actions.
2. `FilterTable` owns structural responsive behavior that changes the rendered filter split. It uses the shared `useMediaQuery` hook internally and exposes semantic opt-in props such as `responsiveToolbar`.
3. `FilterTable/index.less` owns the matching reusable modifier styles, currently `.filter-table--responsive-toolbar`.
4. `src/styles/rwd/filter-toolbar.css` owns explicit opt-in BEM layout classes for custom Form toolbars. The page retains Form state, serialization, debounce, Apply/Cancel/Reset, permissions, and API mapping.

The broad attribute and class-based selectors already present in `filter-toolbar.css` are legacy migration safeguards, not the extension API. Do not change them without cascade evidence from the target issue, and do not add new broad selectors. New FilterTable consumers use `responsiveToolbar`; new custom toolbars use the explicit BEM classes.

## Whole-Menu Migration Decision

Classify every secondary-menu toolbar before editing it. The classification is
per rendered toolbar or tab, not merely per route.

| Existing structure | Required path |
| --- | --- |
| `FilterTable` with multiple fields | Add explicit semantic `{ label, element }` entries and opt into `responsiveToolbar`. |
| Custom toolbar with an existing Filter modal | Preserve the page Form and handlers; reuse the shared modal presentation or the explicit BEM layout only. |
| Custom toolbar without a Filter modal | Add a compact Filter only when secondary fields are hidden and would otherwise become unreachable. Keep draft/apply mapping page-owned. |
| Search-only or Search + action toolbar | Use wrap-only BEM layout. Do not add Filter or Reset. |
| Reports page | Change only internal list/table toolbars. Leave the report header dimension/time filter unchanged unless the task explicitly includes it. |

Before and after each migration, inventory the desktop actions and the fields
for every tab, role, and task state. A route-level check is insufficient when
tabs render different toolbar DOM. Do not infer that two similarly named
modules share actions or filter fields.

When a custom page needs the shared dialog presentation, use
`ResponsiveFilterModal`. It owns only Modal structure and visual invariants.
The caller owns values, validation, draft copying, Apply/Cancel/Reset behavior,
request timing, serialization, permissions, and action visibility.
If an existing business modal cannot use the shared component, it must still
pass the same semantic-label, 48px control-height, placeholder typography,
close-center, and unexplained-row-space probes. Configure the Harness with that
modal's root/item/label selectors instead of skipping it.
Use a field's `compactOnly` presentation flag when the field must remain in the
stable dialog DOM but be visible only below the compact breakpoint. Do not
change an existing Apply request mapping merely to eliminate a viewport check
that already gates compact-only parameters.

Do not add a compact Filter merely to make a page resemble another module.
Its only valid purpose is to keep existing hidden secondary filters reachable.
Do not add missing desktop fields or enable commented-out toolbars.

Do not call a viewport hook in each page merely to calculate `maxVisibleFilters`. The page should opt into the shared mode:

```tsx
<FilterTable
  responsiveToolbar
  tableFilters={tableFilterConfigs}
  {...tableProps}
/>
```

Use CSS media queries directly when only dimensions, spacing, wrapping, or typography change. Use the shared `useMediaQuery` hook only inside a common component when the breakpoint changes the React tree or component behavior. Keep the mode opt-in until representative consumers have been migrated and verified; changing the default can silently alter untested modules.

For a custom Form toolbar, preserve its existing controls and handlers. When the
verified reference uses structural filter collapse, add semantic layout classes
and render the page-owned modal fields from the same values:

```tsx
<Row className="responsive-filter-toolbar">
  <div className="responsive-filter-toolbar__controls">
    <Form.Item className="responsive-filter-toolbar__field responsive-filter-toolbar__field--search">
      <Input />
    </Form.Item>
    <Form.Item className="responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden">
      <Select />
    </Form.Item>
    <CustomButton customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__compact-only">
      {t("common.filter")}
    </CustomButton>
  </div>
  <CustomButton customClassName="responsive-filter-toolbar__action" />
</Row>
```

Opening the modal copies the currently applied secondary values into a draft
form. Cancel discards the draft. Apply copies the draft back to the existing
toolbar form and invokes the page's existing request mapping exactly once.
If the target already has Reset, it clears both forms and invokes the existing
reset request. Do not introduce Reset when it was not part of the target page.
CSS may hide the inline secondary fields because they must remain registered for
desktop resizing; a page-level media-query hook is unnecessary when the rendered
tree is stable.

Do not migrate a custom Form to `FilterTable` solely for responsive styling.
Do not add page-level `matchMedia` state solely to change widths, gaps, wrapping, or action alignment.
Before editing page Less, search for descendant flex rules such as `flex-basis` on controls. A control inside a column wrapper can turn a desktop width basis into an unintended compact height.
The same check applies inside `ResponsiveFilterModal`: page classes are retained
on cloned controls, so their toolbar flex sizing must not influence modal row
height.

## Browser Verification

Test at least `1280x891`, the reported problem width, and `1920x1080`. For structural breakpoint changes, also test `1024`, `1440`, `1809`, `1919`, and `1920` widths.

For every relevant tab, task state, and filter mode on the target page:

- Assert the exact `.filter-modal-item-label` text and count.
- Assert label semantics separately from placeholder text. Reject labels that
  start with translated equivalents of `All` or `Select`, or that equal their
  control's placeholder. Verify each label against the module's existing table
  column or form-field i18n key.
- In the English locale, compare every multi-word label and placeholder against
  the module's established Title Case vocabulary. Inspect all words in
  `All ...`, `Select ...`, `Start Date`, and `End Date`; a capitalized first
  word alone is not sufficient.
- Assert the visible toolbar action names at `1919px` and `1920px`; the desktop
  list must match the target's pre-change baseline, and compact-only additions
  must be limited to the necessary Filter trigger.
- When reusing an existing advanced-filter modal, gate compact-only mirrored
  fields at modal-open time. The 1920px modal field inventory must remain
  identical to its baseline. Do not spread a modal Form value object into API
  params: picker Moments and UI-only draft keys can leak into serialization.
  Preserve the page's existing explicit request-field mapping and append only
  the compact fields that were previously inline.
- The `responsive-filter-toolbar__action` element must be the toolbar's direct
  grid child. Do not put the action class only on `CustomButton`: permission
  handling may insert a wrapper, leaving the actual grid item unpositioned and
  dropping Export to a new row. Wrap the existing action in a semantic action
  container without changing its permission props or click handler.
- Assert Select and RangePicker placeholder computed styles are identical.
- Read RangePicker placeholder color and typography from `getComputedStyle(input, "::placeholder")`; the normal input style does not prove placeholder parity.
- Assert the vertical center delta between `.ant-modal-header` and `.ant-modal-close-x svg` is at most 1 CSS pixel after the modal animation finishes.
- Check toolbar overflow, clipped button text, control height, Export alignment, table scroll containment, modal layout, and RTL if the changed styles are directional.
- Compare every modal item's rendered height with its label, gap, and control
  height. Unexpected excess space is a failure even when the next row remains
  inside the dialog; it commonly means a page-level width `flex-basis` became a
  column height.
- Compare each modal item width with the computed two-column track width. A
  one-field modal must keep one track and leave the second track empty; reject
  an accidental `grid-column: 1 / -1` or a page rule that stretches the field
  across the dialog.
- For every affix Search in a registered toolbar, assert that its prefix icon
  and input text remain on the same flex row and that their vertical center
  difference is at most 1px. Measuring only the wrapper height misses the
  common failure where a broad toolbar selector applies `flex-wrap: wrap` to
  the AntD affix wrapper and pushes the placeholder below its icon.
- For every custom Form toolbar followed by a table, assert that the table top
  is `12px` below the toolbar row bottom at every tested width, including the
  `1920px` desktop baseline. Measure the row container rather than an individual
  button. Also assert that all visible same-row controls use the breakpoint's
  verified height; a `48px` Search beside a `40px` compact Filter is a failure.
  Re-check the named reference page before changing these shared values.
- Save after screenshots under `output/playwright/<task>/` and visually inspect every screenshot before delivery.
- If shared FilterTable CSS changes, smoke-test the target plus one representative consumer such as `/licensing/profile`. Do not expand this into a full consumer sweep unless evidence or the user requires it.
- Review browser console errors and distinguish pre-existing warnings from introduced failures.
- Treat overflow inside a deliberate `overflow-x: auto|scroll` table or tab strip as contained scrolling. Fail document overflow, clipped controls, non-scrollable spill, and content that crosses its panel boundary.

## Common Mistakes

- Copying `/happiness/tickets` CSS without confirming component structure and breakpoint ownership.
- Copying actions from the reference page that did not exist on the target page.
- Treating a wrapped row as correct when the verified reference collapses secondary controls into Filter.
- Adding page-local `matchMedia` effects and repeating the same responsive toolbar CSS.
- Moving a custom Form into `FilterTable` and accidentally changing debounce, draft, request, or export behavior.
- Applying `flex-basis` intended as width to a control inside a column-direction responsive wrapper.
- Allowing a responsive FilterTable page to inherit a legacy CMS/page stacking
  override after it has explicitly opted into `responsiveToolbar`.
- Passing bare Select elements and assuming placeholders always become modal labels.
- Reviewing label semantics but overlooking inconsistent English Title Case in
  the placeholder text.
- Copying `All Statuses`, `All Types`, `All User Types`, `Select ...`, or a date
  boundary placeholder into `label` merely because the text is already translated.
- Tightening the shared `FilterItem` type while migrating only selected consumers; keep compatibility and make the target page configurations explicit.
- Centering the close button while leaving the icon's global `margin-top` intact.
- Comparing appearance only, without checking computed typography and the visible SVG center.
- Adding broad global selectors or `!important` before identifying the winning rule.
- Treating expected table horizontal scrolling as page overflow.
- Checking the `12px` toolbar-to-table gap only in compact mode and accepting a
  desktop toolbar whose bottom edge touches or overlaps the table header.
- Measuring the toolbar row height without comparing the Search, Filter, and
  action control heights individually.
- Expanding the task to unrelated type, lint, or legacy CSS cleanup.
- Auditing only the default tab while another tab renders a different toolbar.
- Treating a report header time/dimension control as a list toolbar.
- Adding Filter to a Search-only toolbar or enabling a commented-out toolbar.
- Recording credentials in a route manifest, script, screenshot name, or skill.

## Delivery Checks

Run the narrowest relevant checks and report exact results:

```bash
git diff --check
npx eslint <changed-tsx-files>
npm run typecheck
npm run build:daypop
```

Review the final diff for unrelated changes. Do not run `git add`, commit, or create a worktree unless the user explicitly requests it.
Read `git status --short` accurately: the first status column is staged and the second is unstaged. Never report files as staged when only the second column contains `M`.
