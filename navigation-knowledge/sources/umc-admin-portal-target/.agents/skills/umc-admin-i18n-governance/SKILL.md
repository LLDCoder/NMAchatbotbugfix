---
name: umc-admin-i18n-governance
description: Use when adding, changing, reviewing, translating, or deleting user-visible English or Arabic text, i18next resources, dynamic keys, locale handling, RTL behavior, or backend error messages in the UMC Admin Portal.
---

# UMC Admin i18n Governance

## Purpose

Keep Admin Portal English and UAE-government Arabic correct, maintainable, and evidence-backed while preserving the single `translation` namespace and explicit resource registry.

## Required References

Read [standards.md](references/standards.md) before changing copy, locale selection, RTL, bilingual API fields, AntD locale, or Formily validation language.

Read [harness-contract.md](references/harness-contract.md) before changing the audit, adding dynamic keys, deleting resources, or claiming the review is complete.

## Invariants

- Preserve the single `translation` namespace and `translationResourceRegistry`.
- Keep module resource directories, registry owners, and locale import paths
  aligned and named with lowerCamelCase.
- Keep Git's filesystem-detected `core.ignorecase` setting.
- Perform case-only renames through a temporary path in two `git mv` steps,
  commit them atomically with every path reference, and validate a clean clone
  on a case-sensitive filesystem.
- Change English and Arabic together. English is the semantic baseline for normal product copy.
- Use formal Modern Standard Arabic suitable for UAE government services.
- Never display raw `error.message`, `response.message`, `result.message`, or helper output that can contain backend text. Log diagnostics and show a stable i18n key.
- Use `i18n.resolvedLanguage` or `isArabicLanguage(...)` for runtime locale branching. Editor-owned strict `"en" | "ar"` state is a separate finite domain.
- Let `<html dir>` and AntD `ConfigProvider direction` own application direction. Never inject global `* { direction: rtl }`.
- Keep AntD at 4.22.8 and use its v4 locale/direction APIs.
- Do not delete keys from string-search evidence alone.
- Do not introduce cross-repository runtime dependencies or broad allowlists.

## Workflow

1. Classify the source as product copy, backend-managed content, bilingual API fields, or authority-locked content. Stop if the source cannot be proven.
2. Inspect the owning component, both locale files, resource registry, dynamic producer, route, and relevant error/empty/modal states.
3. Add a failing fixture before changing a Harness rule or fixing a regression that can be isolated.
4. Make the smallest module-scoped change. Keep API fields, request values, permissions, workflow, approvals, payments, and refunds unchanged.
5. Run:

```bash
npm run check:i18n:strict
npm run test:i18n
npm run check:import-case
npm run check:designable-local-assets
```

6. Run targeted ESLint, typecheck, build, and `git diff --check`. Separate existing failures from new failures.
7. At `1920x1200`, verify affected English and Arabic routes, `ar-AE`, refresh persistence, AntD popups, Formily validation, mixed-direction IDs/emails/amounts, raw keys, raw backend errors, and console/network failures.
8. Record dynamic and deletion evidence. If authenticated runtime evidence is unavailable, retain or restore the key.

## Review Output

Report changed modules, terminology decisions, strict/test/build/browser results, remaining strict hardcoded-text debt, dynamic domains, deletion evidence, and backend/legal blockers. A passing Harness proves structure, not Arabic semantics or complete runtime coverage.
