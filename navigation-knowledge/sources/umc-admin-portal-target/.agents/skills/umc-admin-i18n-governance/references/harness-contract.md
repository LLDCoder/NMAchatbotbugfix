# Admin i18n Harness Contract

## Strict checks

`npm run check:i18n:strict` blocks:

- invalid/duplicate JSON and missing locale files;
- English/Arabic path, type, interpolation, or rich-text mismatch;
- duplicate owners, unregistered resources, registry import drift, or runtime builder drift;
- missing literal keys and uncontrolled dynamic expressions;
- unexpected Latin residuals in Arabic resources;
- raw backend/exception messages reaching visible sinks;
- exact `i18n.language === "ar"|"en"` comparisons;
- every high-confidence user-visible hardcoded-text candidate.

Designable TypeScript locale modules are handled structurally: the audit ignores
the `en-US` definition branch, but still checks high-confidence visible values
inside the corresponding `ar-AE` UI configuration. Do not exclude the whole
`src/components/designable/src/locales` directory. When a new locale object
shape falls outside the current configuration detector, add a failing fixture
before extending the rule.

Every new rule starts with a failing fixture in `scripts/check-i18n.test.mjs`.
There is no accepted hardcoded-text baseline. If strict mode reports candidates,
classify and fix user-visible text or add a narrow, path-specific exclusion with
evidence that the value is technical or unreachable.

Workflow action objects may contain a canonical English `label` that is sent to
the API. Keep it in a clearly named `*_API_LABEL` constant with a contract
comment; never translate or render that constant. UI must resolve a `labelKey`
or use a separately localized modal. Do not add a broad hardcoded-text
exclusion for workflow files.

## Raw message boundary

Raw sources include exception/response `message`, `errorMessage`, `customMessage`, and `failureReason`, plus known raw-message helpers. Visible sinks include AntD `message`/`notification`, `CustomMessage`, visible JSX props, and high-confidence error/message state.

The current AST rule follows direct known sinks, scope-aware local variable
aliases (including `var`, loop bindings, function parameters, and direct
destructuring of raw message properties from backend containers), and same-file
`useState` destructuring where a raw property is passed directly to the setter
and the scalar state appears in visible JSX. It respects safe shadowing in
nested scopes. It does not follow assignments after declaration, object state,
`useReducer`, Zustand, nested result objects, transformations, cross-file
state, wrapper callbacks, or re-exported helpers. These paths require manual
review unless a failing fixture first extends the detector.

The hardcoded-text rule also does not follow user-visible labels, placeholders,
or option text imported from configuration or schema modules into JSX. Review
configuration producers and render consumers together. Preserve canonical
stored/API values and translate only at the display boundary, as done by
DataList and EquipmentList.

```ts
catch (error) {
  console.error("Failed to save refund:", error);
  CustomMessage.error(t("Finance.financialRefunds.messages.executionFailed"));
}
```

Only an API contract verified in both languages may authorize backend text.

The audit reports `t(key, "fallback")`, direct object options (including
shorthand and computed `defaultValue` properties), and locally resolvable
options objects containing `defaultValue`. Existing candidates are tracked by
exact file/key/fallback signatures as migration debt, not examples for new
code. Strict mode rejects every new signature, any duplicate beyond the
recorded count, and stale baseline entries after a fallback is removed. Options
passed through function parameters, imports, or other unresolved expressions
remain a manual boundary; review those wrappers and their callers together.
New or modified code must remove the fallback and use complete English/Arabic
resources.

## Dynamic keys

Prefer finite maps containing base key, complete values/contexts, producer file, both resources, and route/state evidence. A file-and-expression allowlist only proves that the expression was reviewed; it does not prove that its runtime value domain is finite or fully translated. A broad prefix is an uncertainty boundary, never proof of use. New dynamic expressions require a narrow file-and-expression rule and a negative fixture.

The current `DYNAMIC_I18N_REFERENCE_ALLOWLIST` does not expand or validate every
runtime value. Therefore `0 uncontrolled` means only that expression paths are
registered; it is not evidence that dynamic resources are complete.

## Deletion contract

Delete only when:

1. no literal, route, schema, utility, test, or registry reference exists;
2. no dynamic producer or backend mapping can emit the key;
3. English and Arabic affected routes/states show no raw key or fallback;
4. both locale values and empty parents are removed together;
5. a ledger records key, owner, searches, producer conclusion, route, state, language, date, and replacement.

Moved keys retaining the same runtime path are owner migrations, not runtime deletions. Legacy deletions without browser evidence must be restored or left explicitly unapproved.
An unapproved ledger entry is not permission to keep the value deleted in a
release candidate; restore it before approval when authenticated evidence cannot
be obtained.

## Manual boundary

The Harness cannot approve Arabic naturalness, legal meaning, future backend codes, permission-only routes, RTL visuals, or external schema behavior. Report these separately.
