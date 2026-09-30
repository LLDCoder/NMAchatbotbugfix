---
name: react-frontend
description: Use this skill for React frontend implementation in the UMC Admin Portal repo when adding pages, modifying components, wiring APIs, adjusting table/form/modal/detail flows, or touching routing/state/styling on the frontend. Use if the request is page-level UI work in `src/`; do not use for backend-only, infra/build-tool, or repository-instruction-file changes.
---

# React Frontend

## Scope and stack

This repo is a React 17 + TypeScript admin portal built with Vite.
Use `@` imports for `src`.
Use Ant Design 4 as the default component system.
Use Less for styling, with colocated `index.less`.
Use React Router v5 (`Switch`, `Route`, `useHistory`) and the shared history helper where existing.
Use Zustand with `persist` for shared client state; keep page-local state local.
Use `i18next` for text and translation flows.

## Start with existing patterns

Read surrounding implementations before writing new code.
Prefer `src/pages`, `src/components/common`, and feature-matching `src/services`.
Check [`/Users/shaohai.li/Desktop/umc/umc-admin-portal/AGENTS.md`](/Users/shaohai.li/Desktop/umc/umc-admin-portal/AGENTS.md) for repo-level constraints.
Check [`/Users/shaohai.li/Desktop/umc/umc-admin-portal/src/routes/index.tsx`](/Users/shaohai.li/Desktop/umc/umc-admin-portal/src/routes/index.tsx) before any new page or navigation change.

## Implementation defaults

When adding a page, follow this order.
Create the page first in `src/pages/<PascalCase>/index.tsx` and companion `index.less`.
Add route registration in `src/routes/index.tsx` after the feature pattern is set.
Extract shared pieces into existing local folders (`components`, `type.ts`, `constants.ts`, `data.ts`) only when nearby pages already do so.
Use existing wrappers first: `TablePanel`, `FilterTable`, `FormPanel`, `CustomButton`, `CustomMessage`, `ConfirmModal`, `RejectModal`.
Use `@/utils/request` and module-specific files under `src/services` for API calls.
Keep request typing and response typing near the service module you extend.

For list pages, copy neighboring `TablePanel`/`FilterTable` request+pagination+action patterns and preserve row action semantics.
For form/detail pages, follow nearby `FormPanel` or Ant Design form usage with `Form.useForm()`, consistent validation, and existing loading/error handling.
For navigation and route-based actions, prefer `useHistory` and existing shared history utilities.

## API and state rules

Avoid inline `axios` usage in UI files.
Place CRUD calls in the closest `src/services/<domain>.ts` file.
Use local state hooks (`useState`, `useReducer`) for page-only behavior.
Use Zustand only when shared client state is required.

## Styling and UI consistency

Prefer local Less files and import shared style tokens from `@/styles/variables.less` when feature patterns do that.
When introducing layout containers, keep spacing, table headers, and action controls consistent with surrounding feature screens.
Treat Mantine and Formily/designable as selective dependencies.
Use them only in flows already depending on them, not as defaults for normal CRUD pages.

## Validation

When requested to verify, run: `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit`, and `npm run build` as available, then report results exactly as-is.
Do not treat project-wide existing failures as introduced by this change.
Focus fixes on files you changed in this task; do not refactor untouched files to satisfy global pass criteria.
There is no general `test` script in `package.json`.
If only one file is changed, prioritize targeted fixes in that file and keep scope local.
Do not add Chinese text in staged files because local pre-commit checks reject it.
