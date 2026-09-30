import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

import {
  ARABIC_LATIN_KEY_ALLOWLIST,
  ARABIC_LATIN_TOKEN_ALLOWLIST,
  DYNAMIC_I18N_REFERENCE_ALLOWLIST,
  compareLocaleResources,
  discoverLocalePairs,
  extractTranslationResourceRegistry,
  extractArabicLatinCandidates,
  extractExactI18nextLocaleComparisons,
  extractHardcodedUiCandidates,
  extractI18nDefaultValueCandidates,
  extractRawUserMessageCandidates,
  extractStaticI18nReferences,
  findNewI18nDefaultValueCandidates,
  findStaleI18nDefaultValueBaseline,
  findUncontrolledDynamicReferences,
  findDuplicateTopLevelOwners,
  findMissingStaticReferences,
  isValidResourceOwnerName,
  isI18nSourceExcluded,
  parseJsonResource,
  validateTranslationResourceRegistry,
} from "./i18n-check-core.mjs";

const loadProductionResourceBuilder = async () => {
  const source = await readFile(
    new URL("../src/localization/resourceBuilder.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "resourceBuilder.ts",
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
};

const loadLanguageHelpers = async () => {
  const source = await readFile(
    new URL("../src/localization/language.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "language.ts",
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
};

const flattenKeys = (value, prefix = "", result = new Set()) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => {
      flattenKeys(child, prefix ? `${prefix}.${key}` : key, result);
    });
  } else {
    result.add(prefix);
  }
  return result;
};

const createBuilderImport = (modulePath) =>
  `import { buildTranslationResources } ${"from"} ${JSON.stringify(modulePath)};`;

test("requires lowerCamel i18n resource owner names", () => {
  assert.equal(isValidResourceOwnerName("licensing"), true);
  assert.equal(isValidResourceOwnerName("personalCenter"), true);
  assert.equal(isValidResourceOwnerName("Licensing"), false);
  assert.equal(isValidResourceOwnerName("CMS"), false);
  assert.equal(isValidResourceOwnerName("my-requests"), false);
});

test("language helpers normalize Arabic locale variants consistently", async () => {
  const {
    isArabicLanguage,
    normalizePortalLanguage,
    toFormilyValidateLanguage,
  } = await loadLanguageHelpers();

  assert.equal(isArabicLanguage("ar"), true);
  assert.equal(isArabicLanguage("ar-AE"), true);
  assert.equal(isArabicLanguage("AR_ae"), true);
  assert.equal(isArabicLanguage("en-US"), false);
  assert.equal(normalizePortalLanguage("ar-AE"), "ar");
  assert.equal(normalizePortalLanguage("en-GB"), "en");
  assert.equal(toFormilyValidateLanguage("ar-AE"), "ar-AE");
  assert.equal(toFormilyValidateLanguage("en-US"), "en-US");
});

test("production resource builder rejects duplicate top-level owners", async () => {
  const { buildTranslationResources } = await loadProductionResourceBuilder();

  assert.throws(
    () =>
      buildTranslationResources([
        {
          owner: "locales",
          en: { applications: { title: "A" } },
          ar: { applications: { title: "أ" } },
        },
        {
          owner: "licensing",
          en: { applications: { title: "B" } },
          ar: { applications: { title: "ب" } },
        },
      ]),
    /Duplicate top-level key "applications".*"locales".*"licensing"/,
  );
});

test("production resource builder rejects legacy omission policies", async () => {
  const { buildTranslationResources } = await loadProductionResourceBuilder();

  assert.throws(
    () =>
      buildTranslationResources([
        {
          owner: "locales",
          omitTopLevelKeys: ["applications"],
          en: {
            common: { save: "Save" },
            applications: { approvalModals: { common: { cancel: "Cancel" } } },
          },
          ar: {
            common: { save: "حفظ" },
            applications: { approvalModals: { common: { cancel: "إلغاء" } } },
          },
        },
        {
          owner: "licensing",
          en: { applications: { title: "Applications" } },
          ar: { applications: { title: "الطلبات" } },
        },
      ]),
    /Duplicate top-level key "applications".*"locales".*"licensing"/,
  );
});

test("effective runtime keys include leaves from their unique owner", async () => {
  const { buildTranslationResources } = await loadProductionResourceBuilder();
  const resources = buildTranslationResources([
    {
      owner: "licensing",
      en: {
        applications: {
          title: "Applications",
          approvalModals: { common: { cancel: "Cancel" } },
        },
      },
      ar: {
        applications: {
          title: "الطلبات",
          approvalModals: { common: { cancel: "إلغاء" } },
        },
      },
    },
  ]);

  const issues = findMissingStaticReferences(
    new Map([
      [
        "applications.approvalModals.common.cancel",
        [{ file: "modal.tsx", line: 1, column: 1 }],
      ],
    ]),
    flattenKeys(resources.en.translation),
    flattenKeys(resources.ar.translation),
  );

  assert.deepEqual(issues, []);
});

test("findDuplicateTopLevelOwners reports every conflicting owner", () => {
  assert.deepEqual(
    findDuplicateTopLevelOwners("ar", [
      { owner: "locales", resource: { applications: {}, common: {} } },
      { owner: "licensing", resource: { applications: {} } },
      { owner: "shared", resource: { common: {} } },
    ]).map(({ category, key, owners }) => ({ category, key, owners })),
    [
      {
        category: "duplicate-top-level-owner",
        key: "applications",
        owners: ["locales", "licensing"],
      },
      {
        category: "duplicate-top-level-owner",
        key: "common",
        owners: ["locales", "shared"],
      },
    ],
  );
});

test("compareLocaleResources reports path, type, placeholder, and rich-text differences", () => {
  const issues = compareLocaleResources(
    {
      common: {
        onlyEnglish: "English",
        count: "{{count}} item",
        rich: "<strong>Hello</strong>",
        enabled: true,
      },
    },
    {
      common: {
        onlyArabic: "Arabic",
        count: "{{total}} عنصر",
        rich: "<em>مرحبا</em>",
        enabled: "نعم",
      },
    },
    { enOwner: "Example/en.json", arOwner: "Example/ar.json" },
  );

  assert.deepEqual(
    issues.map(({ category, key }) => [category, key]),
    [
      ["missing-in-ar", "common.onlyEnglish"],
      ["missing-in-en", "common.onlyArabic"],
      ["placeholder-mismatch", "common.count"],
      ["rich-text-tag-mismatch", "common.rich"],
      ["type-mismatch", "common.enabled"],
    ],
  );
});

test("compareLocaleResources deduplicates placeholders and detects structural type conflicts", () => {
  const issues = compareLocaleResources(
    {
      common: {
        repeated: "{{count}} of {{count}}",
        structure: { child: "value" },
      },
    },
    {
      common: {
        repeated: "{{count}}",
        structure: "قيمة",
      },
    },
  );

  assert.equal(
    issues.some(
      ({ category, key }) =>
        category === "placeholder-mismatch" && key === "common.repeated",
    ),
    false,
  );
  assert.equal(
    issues.some(
      ({ category, key }) =>
        category === "type-mismatch" && key === "common.structure",
    ),
    true,
  );
});

test("compareLocaleResources reports missing empty containers", () => {
  assert.deepEqual(
    compareLocaleResources(
      { common: { options: {} } },
      { common: {} },
    ).map(({ category, key }) => ({ category, key })),
    [{ category: "missing-in-ar", key: "common.options" }],
  );
});

test("parseJsonResource includes the source path in parse failures", () => {
  assert.deepEqual(parseJsonResource('{"ok": true}', "valid.json"), {
    resource: { ok: true },
    issues: [],
  });

  const invalid = parseJsonResource('{"broken": }', "broken.json");
  assert.equal(invalid.resource, null);
  assert.equal(invalid.issues.length, 1);
  assert.equal(invalid.issues[0].category, "json-parse-error");
  assert.equal(invalid.issues[0].file, "broken.json");
});

test("parseJsonResource reports duplicate properties at every object depth", () => {
  const parsed = parseJsonResource(
    '{"common":{"save":"Save","save":"Store"},"common":{"cancel":"Cancel"}}',
    "duplicate.json",
  );

  assert.deepEqual(
    parsed.issues.map(({ category, file, key }) => ({
      category,
      file,
      key,
    })),
    [
      {
        category: "duplicate-json-property",
        file: "duplicate.json",
        key: "common.save",
      },
      {
        category: "duplicate-json-property",
        file: "duplicate.json",
        key: "common",
      },
    ],
  );
});

test("extractStaticI18nReferences finds supported literals and counts dynamic calls", () => {
  const source = `
    const direct = t("common.save");
    const instance = i18n.t("common.cancel");
    const dynamic = t(\`status.\${status}\`);
    const route = {
      titleKey: "menu.dashboard",
      i18n: "menu.dashboard",
      labelKey: "dashboard.total",
      textKey: "common.active",
    };
    const generatedRoute = {
      titleKey: \`menu.\${pageName}\`,
    };
    const node = (
      <Trans
        i18nKey={ready ? "common.ready" : "common.pending"}
      />
    );
  `;

  const result = extractStaticI18nReferences(source, "src/routes/example.tsx");

  assert.deepEqual([...result.keys].sort(), [
    "common.active",
    "common.cancel",
    "common.pending",
    "common.ready",
    "common.save",
    "dashboard.total",
    "menu.dashboard",
  ]);
  assert.equal(result.dynamicReferences.length, 2);
  assert.match(result.dynamicReferences[0].expression, /status/);
  assert.match(result.dynamicReferences[1].expression, /pageName/);
});

test("extractStaticI18nReferences expands controlled dynamic key maps", () => {
  const source = `
    const NOTE_ACTION_TRANSLATION_KEYS = {
      addValue: "add",
      deleteValue: "delete",
      changeValue: "change",
    } as const;
    const label = t(
      \`applications.approvalModals.mediaReport.noteActions.\${NOTE_ACTION_TRANSLATION_KEYS[value]}\`,
    );
  `;

  const result = extractStaticI18nReferences(source, "modal.tsx");

  assert.deepEqual([...result.keys].sort(), [
    "applications.approvalModals.mediaReport.noteActions.add",
    "applications.approvalModals.mediaReport.noteActions.change",
    "applications.approvalModals.mediaReport.noteActions.delete",
  ]);
  assert.deepEqual(result.dynamicReferences, []);
});

test("extractStaticI18nReferences ignores obvious non-i18n t functions and properties", () => {
  const source = `
    const t = (value) => value.toUpperCase();
    const formatter = { t: (value) => value };
    t("ordinary.function");
    formatter.t("ordinary.property");
    i18n.t("common.save");
    i18next.t("common.cancel");
    i18nInstance.t("common.ready");
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "ordinary.ts").keys].sort(),
    ["common.cancel", "common.ready", "common.save"],
  );
});

test("extractStaticI18nReferences keeps translator calls outside a nested ordinary t scope", () => {
  const source = `
    const { t } = useTranslation();
    t("common.save");
    const render = () => {
      const t = "plain text";
      return t;
    };
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "component.tsx").keys],
    ["common.save"],
  );
});

test("extractStaticI18nReferences recognizes typed translator parameters", () => {
  const source = `
    const render = (t: (key: string) => string) => t("common.save");
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "helper.ts").keys],
    ["common.save"],
  );
});

test("extractStaticI18nReferences expands local prefixed translator wrappers", () => {
  const source = `
    const { i18n } = useTranslation();
    const t = (key: string) => i18n.t(\`IDSelector.\${key}\`, { lng });
    const label = t("optionEmiratesId");
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "labels.ts").keys],
    ["IDSelector.optionEmiratesId"],
  );
});

test("extractStaticI18nReferences recognizes useTranslation aliases and fixed translators", () => {
  const source = `
    const { t: translate } = useTranslation();
    const fixedT = i18n.getFixedT(language);
    const memoizedT = React.useMemo(() => i18n.getFixedT(language), [language]);
    translate("common.save");
    fixedT("common.cancel");
    memoizedT("common.ready");
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "component.tsx").keys].sort(),
    ["common.cancel", "common.ready", "common.save"],
  );
});

test("extractStaticI18nReferences recognizes React hook wrappers and fixed translator forwarding", () => {
  const source = `
    const fixedT = React.useMemo(() => i18n.getFixedT(language), [language]);
    const tx = React.useCallback(
      (key: string) => i18n.t(\`Example.\${key}\`),
      [],
    );
    const forward = React.useCallback(
      (key: string) => fixedT(key),
      [fixedT],
    );
    tx("missingLabel");
    forward("common.save");
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "component.tsx").keys].sort(),
    ["Example.missingLabel", "common.save"],
  );
});

test("extractStaticI18nReferences does not infer wrapped formatters or shadowed aliases", () => {
  const source = `
    const { t: translate } = useTranslation();
    const formatDate = wrapFormatter(i18n.getFixedT("ar"));
    translate("common.save");
    formatDate("YYYY-MM-DD");
    {
      const translate = (value: string) => value.toUpperCase();
      translate("ordinary.value");
    }
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "component.tsx").keys],
    ["common.save"],
  );
});

test("extractStaticI18nReferences ignores ordinary callback wrappers and function shadows", () => {
  const source = `
    const t = (value: string) => value.toUpperCase();
    const tx = React.useCallback(
      (key: string) => t(\`prefix.\${key}\`),
      [t],
    );
    tx("ordinary");

    const { t: translate } = useTranslation();
    translate("common.save");
    function inner() {
      function translate(value: string) {
        return value;
      }
      return translate("ordinary.value");
    }
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "component.tsx").keys],
    ["common.save"],
  );
});

test("extractStaticI18nReferences resolves named translation-key metadata", () => {
  const source = `
    const config = {
      translationKey: "definitely.missing.key",
      labelKey: "common.save",
    };
    t(config.translationKey);
    t(config.labelKey);
  `;

  const extracted = extractStaticI18nReferences(source, "component.tsx");

  assert.deepEqual([...extracted.keys].sort(), [
    "common.save",
    "definitely.missing.key",
  ]);
  assert.deepEqual(extracted.dynamicReferences, []);
});

test("extractStaticI18nReferences does not treat bare labelKey leaves as root keys", () => {
  const source = `
    const option = { labelKey: "optionEmiratesId" };
    const route = { labelKey: "dashboard.total" };
    const unknown = { labelKey: undefined };
  `;

  const extracted = extractStaticI18nReferences(source, "options.ts");
  assert.deepEqual([...extracted.keys], ["dashboard.total"]);
  assert.deepEqual(extracted.dynamicReferences, []);
});

test("extractStaticI18nReferences limits route properties to route files", () => {
  const source = `
    const value = {
      titleKey: "menu.dashboard",
      i18n: "menu.dashboard",
      labelKey: "dashboard.total",
      textKey: "common.active",
    };
  `;

  assert.deepEqual(
    [...extractStaticI18nReferences(source, "src/widgets/example.ts").keys].sort(),
    ["common.active", "dashboard.total"],
  );
  assert.deepEqual(
    [
      ...extractStaticI18nReferences(source, "src/routes/example.tsx").keys,
    ].sort(),
    ["common.active", "dashboard.total", "menu.dashboard"],
  );
});

test("findMissingStaticReferences reports the missing language without resolving dynamic keys", () => {
  const issues = findMissingStaticReferences(
    new Map([
      ["common.save", [{ file: "a.tsx", line: 1, column: 1 }]],
      ["common.cancel", [{ file: "b.tsx", line: 2, column: 1 }]],
      ["common.unknown", [{ file: "c.tsx", line: 3, column: 1 }]],
    ]),
    new Set(["common.save", "common.cancel"]),
    new Set(["common.save"]),
  );

  assert.deepEqual(
    issues.map(({ category, key }) => [category, key]),
    [
      ["static-key-missing-in-ar", "common.cancel"],
      ["static-key-missing-in-en", "common.unknown"],
      ["static-key-missing-in-ar", "common.unknown"],
    ],
  );
});

test("findUncontrolledDynamicReferences requires an explicit file and expression rule", () => {
  const references = [
    {
      file: "src/pages/ApplicationsDetails/hooks/useRecallApproval.ts",
      line: 1,
      column: 1,
      expression: "`applications.recallApproval.errors.${key}`",
    },
    {
      file: "src/pages/ApplicationsDetails/hooks/useRecallApproval.ts",
      line: 2,
      column: 1,
      expression: "keyFromApi",
    },
  ];

  assert.deepEqual(
    findUncontrolledDynamicReferences(
      references,
      DYNAMIC_I18N_REFERENCE_ALLOWLIST,
    ).map(({ category, file, expression }) => ({
      category,
      file,
      expression,
    })),
    [
      {
        category: "uncontrolled-dynamic-i18n-reference",
        file: "src/pages/ApplicationsDetails/hooks/useRecallApproval.ts",
        expression: "keyFromApi",
      },
    ],
  );
});

test("dynamic reference allowlist rejects API, URL, and unbounded metadata keys", () => {
  const references = [
    {
      file: "src/pages/Dashboard/components/DashboardWidgets.tsx",
      line: 1,
      column: 1,
      expression: "apiResponse.labelKey",
    },
    {
      file: "src/pages/Dashboard/components/DashboardControls.tsx",
      line: 2,
      column: 1,
      expression: "`Customer.statuses.${apiResponse.status}`",
    },
    {
      file: "src/routes/index.tsx",
      line: 3,
      column: 1,
      expression: "`menu.${searchParams.get(\"key\")}`",
    },
    {
      file: "src/pages/Example/index.tsx",
      line: 4,
      column: 1,
      expression: "STATUS_KEYS[apiResponse.status]",
    },
    {
      file: "src/pages/Example/index.tsx",
      line: 5,
      column: 1,
      expression: "resolveStatusKey(apiResponse.status)",
    },
    {
      file: "src/components/designable/src/components/NewField/index.tsx",
      line: 6,
      column: 1,
      expression: "key",
    },
    {
      file: "src/pages/Dashboard/components/DashboardWidgets.tsx",
      line: 7,
      column: 1,
      expression: "response.labelKey",
    },
    {
      file: "src/pages/Dashboard/components/DashboardControls.tsx",
      line: 8,
      column: 1,
      expression: "`Customer.statuses.${response.status}`",
    },
    {
      file: "src/pages/InspectionViolationDetails/index.tsx",
      line: 9,
      column: 1,
      expression: "STATUS_KEYS[response.status]",
    },
    {
      file: "src/services/contentReportsAnalytics.ts",
      line: 10,
      column: 1,
      expression: "resolveDeviceLabelKey(response.status)",
    },
    {
      file: "src/pages/ContentReportsAnalytics/components/DonutChartCard.tsx",
      line: 11,
      column: 1,
      expression: "data.labelKey",
    },
    {
      file: "src/pages/ContentReportsAnalytics/components/DonutChartCard.tsx",
      line: 12,
      column: 1,
      expression: "record.titleKey",
    },
  ];

  assert.equal(
    findUncontrolledDynamicReferences(
      references,
      DYNAMIC_I18N_REFERENCE_ALLOWLIST,
    ).length,
    references.length,
  );
});

test("extractHardcodedUiCandidates classifies visible English and ignores technical strings", () => {
  const source = `
    const node = (
      <>
        <Input placeholder="Search users" className="user-search" />
        <Button aria-label="Export report">Export Report</Button>
        <CustomButton text="Confirm" />
        <a href="/reports/export.csv">Download CSV</a>
      </>
    );
    CustomMessage.success("Saved successfully");
    const translated = t("common.save");
  `;

  assert.deepEqual(
    extractHardcodedUiCandidates(source, "component.tsx").map(
      ({ kind, value }) => ({ kind, value }),
    ),
    [
      { kind: "jsx-attribute", value: "Search users" },
      { kind: "jsx-attribute", value: "Export report" },
      { kind: "jsx-text", value: "Export Report" },
      { kind: "jsx-attribute", value: "Confirm" },
      { kind: "jsx-text", value: "Download CSV" },
      { kind: "message-call", value: "Saved successfully" },
    ],
  );
});

test("extractExactI18nextLocaleComparisons rejects locale-variant-unsafe checks", () => {
  const candidates = extractExactI18nextLocaleComparisons(
    `
      const isArabic = i18n.language === "ar";
      const isEnglish = "en" !== i18next.language;
      const editorLanguage = language === "ar";
      const safe = i18n.language.startsWith("ar");
    `,
    "src/example.tsx",
  );

  assert.deepEqual(
    candidates.map(({ expression }) => expression),
    ['i18n.language === "ar"', '"en" !== i18next.language'],
  );
});

test("extractRawUserMessageCandidates finds backend messages in visible sinks", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      message.error(error.message);
      CustomMessage.warning(result?.message || t("common.failed"));
      notification.error({ message: response.errorMessage });
      setFormValues({ message: response.message });
      console.error(error.message);
    `,
    "src/example.tsx",
  );

  assert.deepEqual(
    candidates.map(({ sink }) => sink),
    ["message.error", "CustomMessage.warning", "notification.error"],
  );
});

test("extractRawUserMessageCandidates follows backend messages through local aliases", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      const errorMessage = error?.response?.data?.message;
      CustomMessage.error(errorMessage);
      console.error(errorMessage);
    `,
    "src/example.tsx",
  );

  assert.deepEqual(
    candidates.map(({ sink }) => sink),
    ["CustomMessage.error"],
  );
});

test("extractRawUserMessageCandidates follows raw message helpers through aliases", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      const errorMessage = getApiErrorMessage(error);
      CustomMessage.error(errorMessage);
      const localizedMessage = t("common.requestFailed");
      CustomMessage.error(localizedMessage);
    `,
    "src/example.tsx",
  );

  assert.deepEqual(
    candidates.map(({ sink }) => sink),
    ["CustomMessage.error"],
  );
});

test("extractRawUserMessageCandidates respects safe aliases that shadow raw variables", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      const errorMessage = error?.response?.data?.message;
      {
        const errorMessage = t("common.requestFailed");
        CustomMessage.error(errorMessage);
      }
    `,
    "src/example.tsx",
  );

  assert.deepEqual(candidates, []);
});

test("extractRawUserMessageCandidates handles loop and var declaration scopes", () => {
  const safeLoopCandidates = extractRawUserMessageCandidates(
    `
      const errorMessage = error?.response?.data?.message;
      for (const errorMessage of localizedErrors) {
        CustomMessage.error(errorMessage);
      }
    `,
    "src/example.tsx",
  );
  const rawVarCandidates = extractRawUserMessageCandidates(
    `
      if (failed) {
        var errorMessage = error?.response?.data?.message;
      }
      CustomMessage.error(errorMessage);
    `,
    "src/example.tsx",
  );

  assert.deepEqual(safeLoopCandidates, []);
  assert.equal(rawVarCandidates.length, 1);
});

test("extractRawUserMessageCandidates follows destructured raw message aliases", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      const { message: errorMessage } = error.response.data;
      CustomMessage.error(errorMessage);
    `,
    "src/example.tsx",
  );

  assert.equal(candidates.length, 1);
});

test("extractRawUserMessageCandidates ignores localized helper result destructuring", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      const { message } = resolveExecutionError(error, t);
      CustomMessage.warning(message);
    `,
    "src/example.tsx",
  );

  assert.deepEqual(candidates, []);
});

test("extractRawUserMessageCandidates respects expression-body parameter shadowing", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      const errorMessage = error?.response?.data?.message;
      const render = (errorMessage) => CustomMessage.error(errorMessage);
    `,
    "src/example.tsx",
  );

  assert.deepEqual(candidates, []);
});

test("extractRawUserMessageCandidates follows raw messages through React state into JSX", () => {
  const candidates = extractRawUserMessageCandidates(
    `
      const [apiError, setApiError] = useState("");
      setApiError(response.failureReason);
      const [localValidation, setLocalValidation] = useState("");
      setLocalValidation(t("common.invalid"));

      return (
        <>
          <Alert message={apiError} />
          <span>{apiError}</span>
          <Alert message={localValidation} />
          {apiError ? <span>{t("common.failed")}</span> : null}
        </>
      );
    `,
    "src/example.tsx",
  );

  assert.deepEqual(
    candidates.map(({ sink }) => sink),
    ["JSX.message", "JSX.expression"],
  );
});

test("extractI18nDefaultValueCandidates rejects product-copy fallbacks", () => {
  const candidates = extractI18nDefaultValueCandidates(
    `
      const defaultValue = "Shorthand fallback";
      const options = { defaultValue: "Indirect fallback" };
      t("applications.title", { defaultValue: "Applications" });
      t("applications.subtitle", { defaultValue });
      t("applications.computed", { ["defaultValue"]: "Computed fallback" });
      t("applications.indirect", options);
      t("applications.unresolved", runtimeOptions);
      t("applications.count", { count: 2 });
      t("applications.title");
    `,
    "src/example.tsx",
  );

  assert.deepEqual(
    candidates.map(({ expression }) => expression),
    [
      't("applications.title", { defaultValue: "Applications" })',
      't("applications.subtitle", { defaultValue })',
      't("applications.computed", { ["defaultValue"]: "Computed fallback" })',
      't("applications.indirect", options)',
    ],
  );
});

test("defaultValue baseline only permits the recorded number of exact signatures", () => {
  const candidates = [
    { signature: "src/example.tsx|key|fallback" },
    { signature: "src/example.tsx|key|fallback" },
  ];

  assert.deepEqual(
    findNewI18nDefaultValueCandidates(candidates, [
      "src/example.tsx|key|fallback",
    ]),
    [candidates[1]],
  );
});

test("defaultValue baseline rejects stale signatures", () => {
  assert.deepEqual(
    findStaleI18nDefaultValueBaseline([], ["src/example.tsx|key|fallback"]),
    ["src/example.tsx|key|fallback"],
  );
});

test("extractHardcodedUiCandidates classifies visible table and empty-state properties", () => {
  const source = `
    const columns = [{ title: "English heading", dataIndex: "name" }];
    const locale = { emptyText: "No records" };
  `;

  assert.deepEqual(
    extractHardcodedUiCandidates(source, "component.tsx").map(
      ({ kind, value }) => ({ kind, value }),
    ),
    [
      { kind: "visible-property", value: "English heading" },
      { kind: "visible-property", value: "No records" },
    ],
  );
});

test("extractHardcodedUiCandidates ignores English definitions in designable locale modules", () => {
  const source = `
    const exampleLocale = {
      "en-US": {
        settings: {
          title: "Title",
        },
      },
      "ar-AE": {
        settings: {
          title: "العنوان",
        },
      },
    };
  `;

  assert.deepEqual(
    extractHardcodedUiCandidates(
      source,
      "src/components/designable/src/locales/Example.ts",
    ),
    [],
  );
});

test("extractHardcodedUiCandidates still rejects English in Arabic designable locale branches", () => {
  const source = `
    const exampleLocale = {
      "en-US": {
        settings: {
          title: "Title",
        },
      },
      "ar-AE": {
        settings: {
          title: "Untranslated title",
          gridSpan: "Grid Span",
          align: {
            dataSource: ["Left", "Right"],
          },
          type: {
            dataSource: [{ label: "Line", value: "line" }],
          },
        },
      },
    };
  `;

  assert.deepEqual(
    extractHardcodedUiCandidates(
      source,
      "src/components/designable/src/locales/Example.ts",
    ).map(({ kind, value }) => ({ kind, value })),
    [
      { kind: "visible-property", value: "Untranslated title" },
      { kind: "designable-arabic-locale", value: "Grid Span" },
      { kind: "designable-arabic-locale", value: "Left" },
      { kind: "designable-arabic-locale", value: "Right" },
      { kind: "visible-property", value: "Line" },
    ],
  );
});

test("extractHardcodedUiCandidates ignores technical object properties", () => {
  const source = `
    const buildConfig = {
      title: "Formily",
      label: "icon",
      description: "site",
      text: "GITHUB",
    };
    const requestOptions = {
      label: "internal",
      title: "payload",
    };
  `;

  assert.deepEqual(extractHardcodedUiCandidates(source, "config.ts"), []);
});

test("extractHardcodedUiCandidates ignores layout-only HTML entities", () => {
  assert.deepEqual(
    extractHardcodedUiCandidates(
      `const value = <span>: &nbsp;&nbsp; | &nbsp;&nbsp;</span>;`,
      "component.tsx",
    ),
    [],
  );
});

test("extractHardcodedUiCandidates classifies inline table configuration", () => {
  const source = `
    const table = (
      <Table
        columns={[{ title: "English heading" }]}
        locale={{ emptyText: "No records" }}
      />
    );
  `;

  assert.deepEqual(
    extractHardcodedUiCandidates(source, "component.tsx").map(
      ({ kind, value }) => ({ kind, value }),
    ),
    [
      { kind: "visible-property", value: "English heading" },
      { kind: "visible-property", value: "No records" },
    ],
  );
});

test("isI18nSourceExcluded ignores only documented unreachable source paths", () => {
  assert.equal(
    isI18nSourceExcluded("src/pages/AddNewService/index-base.tsx"),
    true,
  );
  assert.equal(
    isI18nSourceExcluded(
      "src/pages/AddNewService/components/FeeConfiguration.tsx",
    ),
    true,
  );
  assert.equal(
    isI18nSourceExcluded(
      "src/components/ProcessTree/NodeConfig/ConditionNodeConfig.tsx",
    ),
    true,
  );
  assert.equal(
    isI18nSourceExcluded(
      "src/components/common/CountrySelect/constants.ts",
    ),
    true,
  );
  assert.equal(
    isI18nSourceExcluded(
      "src/pages/ContentDashboard/components/PermitDistribution/index.tsx",
    ),
    true,
  );
  assert.equal(
    isI18nSourceExcluded("src/pages/InspectionTaskManagement/data.tsx"),
    true,
  );
  assert.equal(
    isI18nSourceExcluded("src/pages/ReportsAnalytics/index.tsx"),
    true,
  );
  assert.equal(
    isI18nSourceExcluded("src/pages/LicenseReports/components/LicenseTab.tsx"),
    true,
  );
  assert.equal(
    isI18nSourceExcluded("src/components/designable/playground/example.tsx"),
    true,
  );
  assert.equal(isI18nSourceExcluded("src/pages/example/Demo.tsx"), true);
  assert.equal(
    isI18nSourceExcluded("src/components/common/AddressSelector/example.tsx"),
    true,
  );
  assert.equal(
    isI18nSourceExcluded(
      "src/components/designable/src/components/EquipmentList/EquipmentList.tsx",
    ),
    false,
  );
  assert.equal(isI18nSourceExcluded("src/pages/AddNewService/index.tsx"), false);
});

test("discoverLocalePairs finds one-level language directories and missing sides", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "i18n-check-"));
  await mkdir(path.join(root, "Complete"));
  await mkdir(path.join(root, "EnglishOnly"));
  await writeFile(path.join(root, "Complete", "en.json"), "{}");
  await writeFile(path.join(root, "Complete", "ar.json"), "{}");
  await writeFile(path.join(root, "EnglishOnly", "en.json"), "{}");

  assert.deepEqual(
    (await discoverLocalePairs(root)).map((pair) => ({
      owner: pair.owner,
      hasEn: Boolean(pair.enPath),
      hasAr: Boolean(pair.arPath),
    })),
    [
      { owner: "Complete", hasEn: true, hasAr: true },
      { owner: "EnglishOnly", hasEn: true, hasAr: false },
    ],
  );
});

test("translation resource registry reports locale pairs that are not registered", () => {
  const localeImport = (name, owner, language) =>
    `import ${name} from ${JSON.stringify(`./${owner}/${language}.json`)};`;
  const registrySource = `
    ${createBuilderImport("./resourceBuilder")}
    ${localeImport("ar", "locales", "ar")}
    ${localeImport("en", "locales", "en")}
    export const translationResourceRegistry = [
      { owner: "locales", en, ar },
    ];
    export const resources = buildTranslationResources(
      translationResourceRegistry,
    );
  `;
  const registry = extractTranslationResourceRegistry(
    registrySource,
    "src/localization/resources.ts",
  );
  const issues = validateTranslationResourceRegistry(registry.entries, [
    {
      owner: "licensing",
      enPath: "/project/src/localization/licensing/en.json",
      arPath: "/project/src/localization/licensing/ar.json",
    },
    {
      owner: "locales",
      enPath: "/project/src/localization/locales/en.json",
      arPath: "/project/src/localization/locales/ar.json",
    },
  ]);

  assert.deepEqual(registry.issues, []);
  assert.deepEqual(
    issues.map(({ category, owner }) => ({ category, owner })),
    [{ category: "unregistered-locale-pair", owner: "licensing" }],
  );
});

test("translation resource registry requires owner and locale import paths to match", () => {
  const localeImport = (name, owner, language) =>
    `import ${name} from ${JSON.stringify(`./${owner}/${language}.json`)};`;
  const registrySource = `
    ${createBuilderImport("./resourceBuilder")}
    ${localeImport("licensingAr", "licensing", "ar")}
    ${localeImport("licensingEn", "customer", "en")}
    export const translationResourceRegistry = [
      { owner: "licensing", en: licensingEn, ar: licensingAr },
    ];
    export const resources = buildTranslationResources(
      translationResourceRegistry,
    );
  `;
  const registry = extractTranslationResourceRegistry(
    registrySource,
    "src/localization/resources.ts",
  );

  assert.deepEqual(
    registry.issues.map(
      ({ category, owner, language, importPath, expectedPath }) => ({
        category,
        owner,
        language,
        importPath,
        expectedPath,
      }),
    ),
    [
      {
        category: "registry-owner-import-mismatch",
        owner: "licensing",
        language: "en",
        importPath: "./customer/en.json",
        expectedPath: "./licensing/en.json",
      },
    ],
  );
});

test("translation resource registry validates the runtime resources export", () => {
  const validSource = `
    ${createBuilderImport("./resourceBuilder")}
    export const translationResourceRegistry = [];
    export const resources = buildTranslationResources(
      translationResourceRegistry,
    );
  `;
  const invalidSource = `
    ${createBuilderImport("./resourceBuilder")}
    export const translationResourceRegistry = [];
    export const resources = buildTranslationResources([]);
  `;
  const wrongBuilderSource = `
    ${createBuilderImport("./wrongBuilder")}
    export const translationResourceRegistry = [];
    export const resources = buildTranslationResources(
      translationResourceRegistry,
    );
  `;

  assert.deepEqual(
    extractTranslationResourceRegistry(validSource).issues,
    [],
  );
  assert.deepEqual(
    extractTranslationResourceRegistry(invalidSource).issues.map(
      ({ category }) => category,
    ),
    ["runtime-resource-binding-invalid"],
  );
  assert.deepEqual(
    extractTranslationResourceRegistry(wrongBuilderSource).issues.map(
      ({ category }) => category,
    ),
    ["runtime-resource-binding-invalid"],
  );
});

test("extractArabicLatinCandidates ignores explicit token and key allowlists", () => {
  assert.equal(ARABIC_LATIN_TOKEN_ALLOWLIST.has("PDF"), true);
  assert.equal(ARABIC_LATIN_TOKEN_ALLOWLIST.has("mp4"), true);
  assert.equal(
    ARABIC_LATIN_KEY_ALLOWLIST.has("BookList.templateSheetName"),
    true,
  );
  assert.equal(
    ARABIC_LATIN_KEY_ALLOWLIST.has("DraftFileOrLink.invalidUrl"),
    true,
  );

  const candidates = extractArabicLatinCandidates({
    BookList: { templateSheetName: "Books" },
    DraftFileOrLink: {
      invalidUrl: "يرجى إدخال رابط HTTP(S) صالح",
    },
    upload: "ارفع PDF. أو jpg أو .mp4 بحد أقصى 10 MB خلال MM دقيقة",
    untranslated: "Save changes",
    mixed: "خدمة Premium",
  });

  assert.deepEqual(
    candidates.map(({ key, tokens }) => ({ key, tokens })),
    [
      { key: "untranslated", tokens: ["Save", "changes"] },
      { key: "mixed", tokens: ["Premium"] },
    ],
  );
});
