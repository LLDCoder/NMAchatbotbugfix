---
name: antd-4-compatibility
description: Review, implement, or debug Ant Design 4.22 compatibility in UMC React portals. Use when changing AntD components, adding UI code from current AntD docs, reviewing build/runtime errors, or investigating blank screens involving Dropdown, Menu, Modal, Drawer, Tooltip, Popover, Popconfirm, Select-like dropdowns, Table filters/actions, DatePicker, message/notification APIs, or any suspected AntD 5 API drift in a project pinned to antd@4.22.8.
---

# AntD 4.22 Compatibility

## How To Use This Skill

When a task touches AntD components in this repository, explicitly ask:

```text
Use the local skill at .agents/skills/antd-4-compatibility to review this change for AntD 4.22 compatibility.
```

The request can be written in any language. For reliable triggering, include the literal skill path `.agents/skills/antd-4-compatibility` or the skill name `antd-4-compatibility`.

For a broader sweep, ask:

```text
Use .agents/skills/antd-4-compatibility to scan src for AntD 5-style APIs and fix only real AntD 4.22 compatibility risks.
```

If automatic triggering is required across unrelated Codex sessions, copy or install this skill under the configured Codex skills directory. Keeping it in this repository is still useful as version-controlled project guidance.

## Project Baseline

This project uses `antd@4.22.8`. Treat local package types as authoritative. Do not copy APIs from the latest Ant Design documentation unless they exist in this repository's installed `node_modules/antd` types.

Check the current version before making compatibility decisions:

```bash
cat package.json | rg '"antd"'
```

Before implementing or changing AntD components, query the exact v4 API with the installed `@ant-design/cli` package:

```bash
npx antd --version 4.22.8 info <component> --detail --format markdown
npx antd --version 4.22.8 doc <component> --format markdown
npx antd --version 4.22.8 demo <component> [name] --format markdown
```

Use `npx antd --version 4.22.8 changelog ...` or `npx antd --version 4.22.8 migrate ...` only to understand compatibility or migration notes. Do not apply AntD v5/v6 APIs unless the task explicitly requests a migration.

If a prop is uncertain, inspect the installed declaration file:

```bash
rg -n "interface .*Props| open\\?:| visible\\?:| menu\\?:| overlay\\?:" node_modules/antd/es/<component>
```

## Common AntD 5 Drift To Avoid

Inspect context before editing. These patterns are suspicious in this AntD 4.22 project:

```bash
rg -n "menu=\\{|open=\\{|onOpenChange=|afterOpenChange=|popup(Render|ClassName|Style)=|rootClassName=|classNames=\\{|styles=\\{|destroyOnHidden|variant=|App\\.useApp|theme=\\{" src
```

Do not blindly replace every hit. Some local wrapper components may intentionally expose `open`; match wrapper prop interfaces before changing callers.

## Component Compatibility Matrix

### Dropdown

Use:

- `overlay={<Menu />}`
- `visible`
- `onVisibleChange`
- `destroyPopupOnHide`

Avoid unless local types prove otherwise:

- `menu={{ items }}`
- `open`
- `onOpenChange`
- `destroyOnHidden`

AntD 4.22 `Dropdown` expects `overlay` to resolve to one React element. Passing AntD 5-style `menu` can leave `overlay` undefined and trigger `React.Children.only expected to receive a single React element child`, often causing a blank screen.

### Menu

Use:

- `items={[{ key, label }]}`
- `onClick={({ key }) => ...}`

Allowed but less preferred:

- `<Menu.Item>`
- `<Menu.SubMenu>`

Prefer `items` when changing code because AntD 4.22 supports it and child items can produce migration warnings. For action menus, validate runtime keys before calling business logic when keys can come from external data.

### Modal

Use:

- `visible`
- `onCancel`
- `afterClose`
- `destroyOnClose`
- `bodyStyle`
- `wrapClassName`

Avoid:

- `open`
- `afterOpenChange`
- `destroyOnHidden`
- `classNames`
- `styles`

For local wrapper components, follow the wrapper interface. If the wrapper accepts `visible`, callers must pass `visible`, not `open`.

### Drawer

Use:

- `visible`
- `onClose`
- `afterVisibleChange`
- `className`
- `style`
- `drawerStyle`
- `bodyStyle`
- `headerStyle`
- `footerStyle`

Avoid:

- `open`
- `onOpenChange`
- `afterOpenChange`
- `rootClassName`
- `rootStyle`
- `classNames`
- `styles`

### Tooltip, Popover, And Popconfirm

Use:

- `visible`
- `onVisibleChange`
- `overlayClassName`
- `overlayStyle`
- `overlayInnerStyle`
- `destroyTooltipOnHide`

Avoid:

- `open`
- `onOpenChange`
- `destroyOnHidden`
- `classNames`
- `styles`
- `fresh`

Keep a single valid React child as the trigger. If the child is conditionally rendered, wrap it so the overlay component still receives one stable element.

### Select-Like Components

For `Select` and related dropdown components, prefer AntD 4 naming:

- `dropdownRender`
- `dropdownClassName`
- `dropdownStyle`
- `dropdownMatchSelectWidth`
- `onDropdownVisibleChange`

Avoid AntD 5 naming unless local declarations support it:

- `popupRender`
- `popupClassName`
- `popupStyle`
- `onOpenChange`
- `variant`
- `classNames`
- `styles`

For option data, `options` is supported by the underlying rc-select in this project, but verify the target component before replacing existing `<Select.Option>` code.

### Table

Use AntD 4 filter visibility names:

- `filterDropdownVisible`
- `onFilterDropdownVisibleChange`

Avoid AntD 5 names unless local declarations support them:

- `filterDropdownOpen`
- `onFilterDropdownOpenChange`
- `rowHoverable`
- `hidden`
- `minWidth`

For table row action dropdowns, apply the `Dropdown overlay={<Menu />}` rule.

### DatePicker And RangePicker

This project uses the AntD 4 Moment-based picker stack. Use `moment` values unless the component is explicitly custom-wired for another date library.

Avoid introducing Dayjs-only assumptions from AntD 5 examples.

### Message, Notification, And App Context

Do not introduce AntD 5 `App.useApp()` patterns in this project unless the installed AntD package exports and supports them.

Prefer existing local helpers such as `CustomMessage` when the surrounding code already uses them.

## Fix Patterns

### Dropdown Action Menu

Use this AntD 4.22-compatible pattern:

```tsx
import { Dropdown, Menu } from "antd";

const renderActionMenu = (
  actions: ActionType[],
  onAction: (action: ActionType) => void,
) => (
  <Menu
    onClick={({ key }) => {
      const action = String(key);
      if (!isActionType(action)) return;
      onAction(action);
    }}
    items={actions.map((action) => ({
      key: action,
      label: ACTION_LABELS[action],
    }))}
  />
);

<Dropdown
  trigger={["click"]}
  overlayClassName="actions-dropdown"
  overlay={renderActionMenu(moreActions, handleAction)}
>
  <button type="button" className="more-button">
    <MoreOutlined />
  </button>
</Dropdown>
```

Do not use this AntD 5-style pattern:

```tsx
<Dropdown
  menu={{
    onClick: ({ key }) => handleAction(key),
    items,
  }}
>
  <button type="button" />
</Dropdown>
```

### Modal Visibility

Use:

```tsx
<Modal visible={visible} onCancel={onCancel}>
  ...
</Modal>
```

Avoid:

```tsx
<Modal open={visible} />
<Modal open={visible} visible={visible} />
```

## Review Workflow

1. Confirm the AntD version.
2. Query the target component with `@ant-design/cli` using `--version 4.22.8`.
3. Scan for common AntD 5 drift patterns.
4. Inspect local component prop types in `node_modules/antd/es/...` for any uncertain API.
5. Fix only compatibility risks that affect the changed area or are clearly unsafe.
6. Preserve existing styling, routes, services, DTOs, action grouping, and business behavior unless the task explicitly asks for broader changes.
7. Re-run the targeted scan after edits.

## Validation

Run available project checks after compatibility edits:

```bash
npm run build
npm run lint
npm run check:import-case
```

If a check has existing project-wide failures, report that clearly and focus fixes on files changed by the task.

For UI regressions, use the matching browser test flow when the affected page is reachable:

- Admin portal: log in at `http://localhost:5173/login`.
- Customer portal: log in at `http://localhost:5174/login`.
- Navigate to the changed route.
- Open the changed Dropdown, Modal, Drawer, Popover, Tooltip, Select dropdown, Table filter, or DatePicker.
- Check that the page does not blank and that the console has no new AntD, React, `Dropdown`, `Modal`, `React.Children.only`, or unsupported prop errors.

Known background errors such as SignalR CORS failures or unrelated image 500 responses should be noted but not treated as regressions unless they changed with the patch.
