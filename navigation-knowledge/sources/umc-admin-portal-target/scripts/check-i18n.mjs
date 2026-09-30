import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { I18N_DEFAULT_VALUE_BASELINE } from "./i18n-default-value-baseline.mjs";
import {
  ARABIC_LATIN_KEY_ALLOWLIST,
  ARABIC_LATIN_TOKEN_ALLOWLIST,
  DYNAMIC_I18N_REFERENCE_ALLOWLIST,
  compareLocaleResources,
  discoverLocalePairs,
  extractArabicLatinCandidates,
  extractExactI18nextLocaleComparisons,
  extractHardcodedUiCandidates,
  extractI18nDefaultValueCandidates,
  extractRawUserMessageCandidates,
  extractStaticI18nReferences,
  extractTranslationResourceRegistry,
  findNewI18nDefaultValueCandidates,
  findStaleI18nDefaultValueBaseline,
  findDuplicateTopLevelOwners,
  findMissingStaticReferences,
  findUncontrolledDynamicReferences,
  isValidResourceOwnerName,
  isI18nSourceExcluded,
  parseJsonResource,
  validateTranslationResourceRegistry,
} from "./i18n-check-core.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const i18nRoot = path.join(projectRoot, "src", "localization");
const sourceRoot = path.join(projectRoot, "src");
const MAX_DETAILS_PER_CATEGORY = process.argv.includes("--verbose")
  ? Number.POSITIVE_INFINITY
  : 20;
const strict = process.argv.includes("--strict");

const loadProductionResourceBuilder = async () => {
  const source = await readFile(
    path.join(i18nRoot, "resourceBuilder.ts"),
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

const flattenLeafKeys = (value, prefix = "", result = new Set()) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => {
      flattenLeafKeys(child, prefix ? `${prefix}.${key}` : key, result);
    });
    return result;
  }

  result.add(prefix);
  return result;
};

const collectSourceFiles = async (directory, result = []) => {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(entryPath, result);
    } else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) {
      result.push(entryPath);
    }
  }
  return result;
};

const toProjectPath = (filePath) =>
  path.relative(projectRoot, filePath).split(path.sep).join("/");

const describeIssue = (issue) => {
  switch (issue.category) {
    case "duplicate-top-level-owner":
      return `${issue.language}:${issue.key} owners=${issue.owners.join(",")}`;
    case "missing-in-ar":
    case "missing-in-en":
    case "type-mismatch":
    case "placeholder-mismatch":
    case "rich-text-tag-mismatch":
      return `${issue.enOwner} <> ${issue.arOwner}: ${issue.key}`;
    case "static-key-missing-in-en":
    case "static-key-missing-in-ar": {
      const location = issue.locations[0];
      return `${issue.key} at ${location.file}:${location.line}:${location.column}`;
    }
    case "missing-locale-file":
      return `${issue.owner}: missing ${issue.language}.json`;
    case "unregistered-locale-pair":
      return `${issue.owner}: locale pair is not in translationResourceRegistry`;
    case "registry-owner-missing-locale-pair":
      return `${issue.owner}: registry owner has no locale directory`;
    case "registry-owner-missing-locale-file":
      return `${issue.owner}: registry owner is missing ${issue.language}.json`;
    case "registry-owner-import-mismatch":
      return `${issue.owner}:${issue.language} imports ${issue.importPath}, expected ${issue.expectedPath}`;
    case "resource-owner-name-invalid":
      return `${issue.owner}: i18n resource owner must use lowerCamelCase`;
    case "duplicate-registry-owner":
      return `${issue.owner}: duplicate translationResourceRegistry owner`;
    case "registry-declaration-invalid":
    case "registry-entry-invalid":
      return `${issue.file}: invalid translationResourceRegistry`;
    case "runtime-resource-binding-invalid":
      return `${issue.file}: resources must be built from translationResourceRegistry`;
    case "uncontrolled-dynamic-i18n-reference":
      return `${issue.expression} at ${issue.file}:${issue.line}:${issue.column}`;
    case "json-parse-error":
    case "json-root-type-error":
      return `${issue.file}: ${issue.message}`;
    case "duplicate-json-property":
      return `${issue.file}: ${issue.key}`;
    case "arabic-latin-residual":
      return `${issue.owner}:${issue.key} tokens=${issue.tokens.join(",")}`;
    case "exact-i18next-locale-comparison":
    case "raw-user-message":
    case "i18n-default-value":
    case "hardcoded-user-visible-text":
      return `${issue.expression ?? issue.value} at ${issue.file}:${issue.line}:${issue.column}`;
    default:
      return JSON.stringify(issue);
  }
};

const main = async () => {
  const pairs = await discoverLocalePairs(i18nRoot);
  const failures = [];
  const enEntries = [];
  const arEntries = [];
  const resourcesByOwner = new Map();
  const latinCandidates = [];

  for (const pair of pairs) {
    if (!pair.enPath) {
      failures.push({
        category: "missing-locale-file",
        owner: pair.owner,
        language: "en",
      });
    }
    if (!pair.arPath) {
      failures.push({
        category: "missing-locale-file",
        owner: pair.owner,
        language: "ar",
      });
    }

    let enResource = null;
    let arResource = null;
    if (pair.enPath) {
      const parsed = parseJsonResource(
        await readFile(pair.enPath, "utf8"),
        toProjectPath(pair.enPath),
      );
      failures.push(...parsed.issues);
      enResource = parsed.resource;
      if (enResource) {
        enEntries.push({ owner: pair.owner, resource: enResource });
      }
    }
    if (pair.arPath) {
      const parsed = parseJsonResource(
        await readFile(pair.arPath, "utf8"),
        toProjectPath(pair.arPath),
      );
      failures.push(...parsed.issues);
      arResource = parsed.resource;
      if (arResource) {
        arEntries.push({ owner: pair.owner, resource: arResource });
        latinCandidates.push(
          ...extractArabicLatinCandidates(arResource).map((candidate) => ({
            ...candidate,
            owner: pair.owner,
          })),
        );
      }
    }

    if (enResource && arResource) {
      resourcesByOwner.set(pair.owner, { en: enResource, ar: arResource });
      failures.push(
        ...compareLocaleResources(enResource, arResource, {
          enOwner: toProjectPath(pair.enPath),
          arOwner: toProjectPath(pair.arPath),
        }),
      );
    }
  }

  failures.push(...findDuplicateTopLevelOwners("en", enEntries));
  failures.push(...findDuplicateTopLevelOwners("ar", arEntries));

  const registryPath = path.join(i18nRoot, "resources.ts");
  const registry = extractTranslationResourceRegistry(
    await readFile(registryPath, "utf8"),
    toProjectPath(registryPath),
  );
  failures.push(...registry.issues);
  new Set([
    ...pairs.map(({ owner }) => owner),
    ...registry.entries.map(({ owner }) => owner),
  ]).forEach((owner) => {
    if (!isValidResourceOwnerName(owner)) {
      failures.push({
        category: "resource-owner-name-invalid",
        owner,
      });
    }
  });
  failures.push(
    ...validateTranslationResourceRegistry(registry.entries, pairs),
  );
  const runtimeEntries = registry.entries.flatMap(({ owner }) => {
    const resources = resourcesByOwner.get(owner);
    return resources ? [{ owner, ...resources }] : [];
  });

  const { buildTranslationResources } = await loadProductionResourceBuilder();
  const effectiveResources = buildTranslationResources(runtimeEntries);
  const enKeys = flattenLeafKeys(effectiveResources.en.translation);
  const arKeys = flattenLeafKeys(effectiveResources.ar.translation);

  const references = new Map();
  const dynamicReferences = [];
  const hardcodedUiCandidates = [];
  const i18nDefaultValueCandidates = [];
  const exactLocaleComparisons = [];
  const rawUserMessageCandidates = [];
  const sourceFiles = (await collectSourceFiles(sourceRoot))
    .filter((sourceFile) => !isI18nSourceExcluded(toProjectPath(sourceFile)))
    .sort();
  for (const sourceFile of sourceFiles) {
    const projectPath = toProjectPath(sourceFile);
    const source = await readFile(sourceFile, "utf8");
    const extracted = extractStaticI18nReferences(
      source,
      projectPath,
    );
    extracted.references.forEach((locations, key) => {
      const existing = references.get(key) ?? [];
      existing.push(...locations);
      references.set(key, existing);
    });
    dynamicReferences.push(...extracted.dynamicReferences);
    hardcodedUiCandidates.push(
      ...extractHardcodedUiCandidates(source, projectPath),
    );
    i18nDefaultValueCandidates.push(
      ...extractI18nDefaultValueCandidates(source, projectPath),
    );
    exactLocaleComparisons.push(
      ...extractExactI18nextLocaleComparisons(source, projectPath),
    );
    rawUserMessageCandidates.push(
      ...extractRawUserMessageCandidates(source, projectPath),
    );
  }
  failures.push(...findMissingStaticReferences(references, enKeys, arKeys));
  const uncontrolledDynamicReferences = findUncontrolledDynamicReferences(
    dynamicReferences,
    DYNAMIC_I18N_REFERENCE_ALLOWLIST,
  );
  const newI18nDefaultValueCandidates =
    findNewI18nDefaultValueCandidates(
      i18nDefaultValueCandidates,
      I18N_DEFAULT_VALUE_BASELINE,
    );
  const staleI18nDefaultValueBaseline =
    findStaleI18nDefaultValueBaseline(
      i18nDefaultValueCandidates,
      I18N_DEFAULT_VALUE_BASELINE,
    );
  failures.push(...uncontrolledDynamicReferences);
  failures.push(
    ...latinCandidates.map((candidate) => ({
      category: "arabic-latin-residual",
      ...candidate,
    })),
  );
  if (strict) {
    failures.push(...exactLocaleComparisons);
    failures.push(...rawUserMessageCandidates);
    failures.push(...newI18nDefaultValueCandidates);
    failures.push(
      ...staleI18nDefaultValueBaseline.map((signature) => ({
        category: "i18n-default-value-stale-baseline",
        expression: signature,
        file: "scripts/i18n-default-value-baseline.mjs",
      })),
    );
    failures.push(
      ...hardcodedUiCandidates.map((candidate) => ({
        category: "hardcoded-user-visible-text",
        expression: candidate.value,
        ...candidate,
      })),
    );
  }

  const failuresByCategory = new Map();
  failures.forEach((issue) => {
    const categoryIssues = failuresByCategory.get(issue.category) ?? [];
    categoryIssues.push(issue);
    failuresByCategory.set(issue.category, categoryIssues);
  });

  console.log(
    `Checked ${pairs.length} locale pairs, ${sourceFiles.length} source files, and ${references.size} unique static keys.`,
  );
  console.log(
    `Dynamic i18n references: ${dynamicReferences.length} (${uncontrolledDynamicReferences.length} uncontrolled)`,
  );
  console.log(
    `Hardcoded English UI candidates (informational): ${hardcodedUiCandidates.length}`,
  );
  console.log(
    `Exact i18next locale comparisons: ${exactLocaleComparisons.length}`,
  );
  console.log(
    `Raw user-message candidates: ${rawUserMessageCandidates.length}`,
  );
  console.log(
    `i18n defaultValue candidates: ${i18nDefaultValueCandidates.length} (${newI18nDefaultValueCandidates.length} new, ${i18nDefaultValueCandidates.length - newI18nDefaultValueCandidates.length} baseline, ${staleI18nDefaultValueBaseline.length} stale baseline)`,
  );
  console.log(
    `Arabic Latin residuals: ${latinCandidates.length}`,
  );
  console.log(
    `Arabic Latin allowlist: ${[...ARABIC_LATIN_TOKEN_ALLOWLIST].join(", ")}`,
  );
  console.log(
    `Arabic Latin key allowlist: ${[...ARABIC_LATIN_KEY_ALLOWLIST].join(", ")}`,
  );

  if (latinCandidates.length > 0) {
    console.log("Arabic Latin candidate samples:");
    latinCandidates.slice(0, MAX_DETAILS_PER_CATEGORY).forEach((candidate) => {
      console.log(
        `  - ${candidate.owner}:${candidate.key} tokens=${candidate.tokens.join(",")}`,
      );
    });
    if (latinCandidates.length > MAX_DETAILS_PER_CATEGORY) {
      console.log(
        `  ... ${latinCandidates.length - MAX_DETAILS_PER_CATEGORY} more candidate(s)`,
      );
    }
  }

  if (hardcodedUiCandidates.length > 0) {
    console.log("Hardcoded English UI candidate samples:");
    hardcodedUiCandidates
      .slice(0, MAX_DETAILS_PER_CATEGORY)
      .forEach((candidate) => {
        console.log(
          `  - ${candidate.value} at ${candidate.file}:${candidate.line}:${candidate.column}`,
        );
      });
    if (hardcodedUiCandidates.length > MAX_DETAILS_PER_CATEGORY) {
      console.log(
        `  ... ${hardcodedUiCandidates.length - MAX_DETAILS_PER_CATEGORY} more candidate(s)`,
      );
    }
  }

  if (i18nDefaultValueCandidates.length > 0) {
    console.log("i18n defaultValue candidate samples:");
    i18nDefaultValueCandidates
      .slice(0, MAX_DETAILS_PER_CATEGORY)
      .forEach((candidate) => {
        const status = newI18nDefaultValueCandidates.includes(candidate)
          ? "new"
          : "baseline";
        console.log(
          `  - [${status}] ${candidate.expression} at ${candidate.file}:${candidate.line}:${candidate.column}`,
        );
      });
    if (i18nDefaultValueCandidates.length > MAX_DETAILS_PER_CATEGORY) {
      console.log(
        `  ... ${i18nDefaultValueCandidates.length - MAX_DETAILS_PER_CATEGORY} more candidate(s)`,
      );
    }
  }

  if (failures.length === 0) {
    console.log("i18n check passed.");
    return;
  }

  console.error(`i18n check failed with ${failures.length} issue(s):`);
  for (const [category, issues] of failuresByCategory) {
    console.error(`- ${category}: ${issues.length}`);
    issues.slice(0, MAX_DETAILS_PER_CATEGORY).forEach((issue) => {
      console.error(`  - ${describeIssue(issue)}`);
    });
    if (issues.length > MAX_DETAILS_PER_CATEGORY) {
      console.error(
        `  ... ${issues.length - MAX_DETAILS_PER_CATEGORY} more issue(s)`,
      );
    }
  }
  process.exitCode = 1;
};

await main();
