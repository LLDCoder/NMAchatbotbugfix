import assert from "node:assert/strict";
import test from "node:test";
import {
  getDataListRuleViolation,
  hasReachedDataListMaxItems,
  isDuplicateDataListLanguage,
  isSameDataListLanguage,
  normalizeDataListMaxItems,
} from "../src/components/designable/src/components/DataList/dataListRules.ts";

test("normalizes only positive integer max item values", () => {
  assert.equal(normalizeDataListMaxItems(1), 1);
  assert.equal(normalizeDataListMaxItems(12), 12);
  assert.equal(normalizeDataListMaxItems(undefined), undefined);
  assert.equal(normalizeDataListMaxItems(null), undefined);
  assert.equal(normalizeDataListMaxItems("2"), undefined);
  assert.equal(normalizeDataListMaxItems(0), undefined);
  assert.equal(normalizeDataListMaxItems(-1), undefined);
  assert.equal(normalizeDataListMaxItems(1.5), undefined);
  assert.equal(normalizeDataListMaxItems(Number.POSITIVE_INFINITY), undefined);
});

test("reports the max as reached at the configured item count", () => {
  assert.equal(hasReachedDataListMaxItems(1, 2), false);
  assert.equal(hasReachedDataListMaxItems(2, 2), true);
  assert.equal(hasReachedDataListMaxItems(3, 2), true);
  assert.equal(hasReachedDataListMaxItems(3, undefined), false);
});

test("compares matching language ids before language names", () => {
  assert.equal(
    isSameDataListLanguage(
      { languageId: 6, language: "English" },
      { languageId: "6", language: "Arabic" },
    ),
    true,
  );
  assert.equal(
    isSameDataListLanguage(
      { languageId: 6, language: "English" },
      { languageId: 7, language: "English" },
    ),
    false,
  );
});

test("falls back to normalized language names for legacy rows", () => {
  assert.equal(
    isSameDataListLanguage(
      { language: " English " },
      { languageId: 6, language: "english" },
    ),
    true,
  );
  assert.equal(
    isSameDataListLanguage({ language: "" }, { language: "" }),
    false,
  );
});

test("excludes the edited row when checking a language candidate", () => {
  const rows = [
    { languageId: 6, language: "English" },
    { languageId: 7, language: "Arabic" },
  ];

  assert.equal(isDuplicateDataListLanguage(rows, rows[0], 0), false);
  assert.equal(
    isDuplicateDataListLanguage(
      rows,
      { languageId: 6, language: "English" },
      1,
    ),
    true,
  );
});

test("gives max item violations priority over duplicate languages", () => {
  const rows = [
    { languageId: 6, language: "English" },
    { languageId: 6, language: "English" },
  ];

  assert.deepEqual(
    getDataListRuleViolation(rows, {
      maxItems: 1,
      uniqueLanguageRequired: true,
    }),
    { type: "maxItems", maxItems: 1 },
  );
  assert.deepEqual(
    getDataListRuleViolation(rows, {
      maxItems: 2,
      uniqueLanguageRequired: true,
    }),
    { type: "duplicateLanguage" },
  );
  assert.equal(
    getDataListRuleViolation(rows, {
      maxItems: 2,
      uniqueLanguageRequired: false,
    }),
    undefined,
  );
});
