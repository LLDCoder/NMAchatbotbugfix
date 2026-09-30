export type DataListRuleRecord = Record<string, unknown>;

export type DataListRuleOptions = {
  maxItems?: unknown;
  uniqueLanguageRequired?: boolean;
};

export type DataListRuleViolation =
  | { type: "maxItems"; maxItems: number }
  | { type: "duplicateLanguage" };

const normalizeLanguageId = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") {
    return "";
  }
  return String(value).trim();
};

const normalizeLanguageName = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const normalizeDataListMaxItems = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value >= 1
    ? value
    : undefined;

export const hasReachedDataListMaxItems = (
  itemCount: number,
  maxItems: unknown,
) => {
  const normalizedMaxItems = normalizeDataListMaxItems(maxItems);
  return (
    normalizedMaxItems !== undefined && itemCount >= normalizedMaxItems
  );
};

export const isSameDataListLanguage = (
  left: DataListRuleRecord,
  right: DataListRuleRecord,
) => {
  const leftId = normalizeLanguageId(left.languageId);
  const rightId = normalizeLanguageId(right.languageId);

  if (leftId && rightId) {
    return leftId === rightId;
  }

  const leftName = normalizeLanguageName(left.language);
  const rightName = normalizeLanguageName(right.language);
  return Boolean(leftName && rightName && leftName === rightName);
};

export const isDuplicateDataListLanguage = (
  rows: DataListRuleRecord[],
  candidate: DataListRuleRecord,
  excludedIndex?: number | null,
) =>
  rows.some(
    (row, index) =>
      index !== excludedIndex && isSameDataListLanguage(row, candidate),
  );

const hasDuplicateDataListLanguages = (rows: DataListRuleRecord[]) =>
  rows.some((row, index) =>
    isDuplicateDataListLanguage(rows, row, index),
  );

export const getDataListRuleViolation = (
  value: unknown,
  options: DataListRuleOptions,
): DataListRuleViolation | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const maxItems = normalizeDataListMaxItems(options.maxItems);
  if (maxItems !== undefined && value.length > maxItems) {
    return { type: "maxItems", maxItems };
  }

  if (
    options.uniqueLanguageRequired === true &&
    hasDuplicateDataListLanguages(value)
  ) {
    return { type: "duplicateLanguage" };
  }

  return undefined;
};
