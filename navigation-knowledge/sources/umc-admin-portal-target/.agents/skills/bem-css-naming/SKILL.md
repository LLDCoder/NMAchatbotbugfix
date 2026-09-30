---
name: bem-css-naming
description: Enforce BEM-style class naming, avoid inline styles by default, and require explicit, searchable nested selectors in CSS, Less, Sass, and SCSS for React and Vue codebases. Use when writing new component/page styles, refactoring existing stylesheets, renaming class names, reviewing frontend styling quality, or updating JSX, TSX, Vue SFC templates, inline style usage, or class bindings that must stay aligned with BEM. Trigger for requests about BEM, CSS naming conventions, inline-style cleanup, Less or SCSS nesting, style refactors, reusable class naming, Vue or React component styling, or keeping selectors easy to search and debug.
---

# BEM CSS Naming

Apply these rules whenever you create or refactor stylesheet code in React, Vue, or framework-agnostic frontend projects.

## Core Rules

- Use BEM naming for custom classes: `block`, `block__element`, `block--modifier`.
- Choose one clear block name per component, page section, or feature area.
- Keep block names stable and semantic. Prefer `user-card`, `order-filter`, `page-header`. Avoid vague names like `box`, `item`, `content`.
- Use elements only for parts that belong to the block. Example: `user-card__title`, `user-card__actions`.
- Use modifiers only for meaningful variants or states. Example: `user-card--compact`, `filter-form__field--error`.
- Keep class names explicit in both stylesheet files and markup so global search can find them directly.
- Apply the same naming rule across JSX, TSX, Vue SFC `<template>`, and dynamic class bindings such as `className`, `class`, and `:class`.
- Avoid inline styles by default. Prefer classes, modifiers, CSS variables, or stylesheet-based state selectors.
- Use inline styles only when the user explicitly requires them or when a truly dynamic runtime value cannot be expressed cleanly through class switching or CSS variables.
- Do not add media-query styles unless the user explicitly requests them.
- Small icons must use assets returned by the Figma MCP. Do not substitute approximate local icons or Ant Design icons.

## Nesting Rules

- Prefer flat selectors when nesting adds no value.
- If a preprocessor is already in use and nesting improves readability, nest only complete selectors or simple pseudo/state selectors.
- Keep nested selectors explicit. Write the full class name literally.
- Allow `&` only for pseudo classes, pseudo elements, state combinations on the same node, or attribute selectors on the same selector.
- Do not use abbreviated selector construction such as `&__element`, `&--modifier`, `&-suffix`, or similar omitted forms.

## Allowed Patterns

```less
.user-card {
  padding: 16px;

  &:hover {
    box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
  }

  &.is-loading {
    opacity: 0.6;
  }

  .user-card__header {
    display: flex;
  }

  .user-card__title {
    font-weight: 600;
  }
}

.user-card--compact {
  padding: 8px;
}
```

## Forbidden Patterns

```less
.user-card {
  &__header {
    display: flex;
  }

  &__title {
    font-weight: 600;
  }

  &--compact {
    padding: 8px;
  }

  &-extra {
    margin-left: 8px;
  }
}
```

Reason: these forms hide the real class name from plain-text search, make debugging slower, and reduce readability during maintenance.

## Workflow

When adding new styles:

1. Identify the block name first.
2. Name child parts with explicit `block__element` classes.
3. Name variants with explicit `block--modifier` classes.
4. Update JSX, TSX, Vue templates, or class-binding expressions so class names match the stylesheet exactly.
5. Scan the stylesheet for abbreviated nesting and replace it before finishing.

When refactoring existing styles:

1. Keep behavior unchanged unless the user asks for visual or structural changes.
2. Replace hidden selector construction with explicit class names.
3. Move inline styles into stylesheet classes, modifiers, or CSS variables whenever that can be done safely.
4. Rename React `className`, Vue `class` and `:class` usages together with stylesheet selectors.
5. Reduce over-nesting while preserving necessary scope.
6. Leave third-party library selectors unchanged unless the task explicitly requires otherwise.

## Review Checklist

- Does every custom class follow BEM or a deliberate utility naming pattern approved by the task?
- Is every BEM class name searchable as literal text in the stylesheet?
- Are `&__`, `&--`, `&-` and similar shortcut expansions absent?
- Is `&` used only for same-selector pseudo/state combinations?
- Are inline styles absent unless the task explicitly needs them or the value is truly runtime-only?
- Do React markup, Vue templates, and styles use the same explicit class names?
