export const NEWSPAPER_REPRINT_ACTIVITY_CODES: ReadonlySet<string> = new Set([
  "1015",
  "1016",
  "1017",
  "1018",
  "1019",
  "1020",
  "1030",
  "1032",
]);

export const PRESS_CARD_PERMIT_START_DATE_ACTIVITY_CODES: ReadonlySet<string> =
  new Set(["2035"]);

export const PRESS_CARD_REGULAR_ACTIVITY_CODE = "2036";
export const PRESS_CARD_TEMPORARY_ACTIVITY_CODE = "2035";

export type PressCardIdSelectorType = "emiratesId" | "passport";

export const NEWSPAPER_MAGAZINE_DRAFT_HIDDEN_ACTIVITY_CODES: ReadonlySet<string> =
  new Set(["2093", "2094", "2095", "2096", "2097", "2098", "2099"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeSelectedActivityKeys(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];

  return values
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export function getSelectedActivityKeys(formValues: unknown): string[] {
  if (!isRecord(formValues)) return [];

  const selectedActivity = formValues.SelectTableSingle;
  if (!isRecord(selectedActivity)) return [];

  return normalizeSelectedActivityKeys(selectedActivity.selectedKey);
}

export function getPressCardIdSelectorType(
  formValues: unknown,
): PressCardIdSelectorType | undefined {
  const selectedActivityKeys = getSelectedActivityKeys(formValues);

  if (selectedActivityKeys.includes(PRESS_CARD_REGULAR_ACTIVITY_CODE)) {
    return "emiratesId";
  }

  if (selectedActivityKeys.includes(PRESS_CARD_TEMPORARY_ACTIVITY_CODE)) {
    return "passport";
  }

  return undefined;
}

export function hasSelectedActivityCode(
  formilySteps: unknown,
  activityCodes: ReadonlySet<string>,
): boolean {
  if (!Array.isArray(formilySteps) || formilySteps.length === 0) return false;

  return formilySteps.some((step) => {
    if (!isRecord(step)) return false;

    const rawFormData = step.formData;
    let parsedFormData: unknown = rawFormData;

    if (typeof rawFormData === "string") {
      try {
        parsedFormData = JSON.parse(rawFormData);
      } catch {
        return false;
      }
    }

    if (!isRecord(parsedFormData)) return false;

    return getSelectedActivityKeys(parsedFormData.formValues).some((key) =>
      activityCodes.has(key),
    );
  });
}
