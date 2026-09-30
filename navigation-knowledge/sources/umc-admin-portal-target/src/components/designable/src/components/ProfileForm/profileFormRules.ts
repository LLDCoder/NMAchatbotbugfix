export interface ProfileFormValues {
  hasTradeLicense: true;
  commercialLicenseNumber: string;
  licenseExpiryDate: string;
}

export const getProfileFormDesignerPreviewValues = (): ProfileFormValues => ({
  hasTradeLicense: true,
  commercialLicenseNumber: "CN-123456",
  licenseExpiryDate: "2026-12-31",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function resolveProfileFormReviewValue(
  fieldValue: unknown,
  formValues: Record<string, unknown>,
): Record<string, unknown> {
  const submittedValue = formValues.ProfileForm ?? formValues["Profile Form"];
  if (isRecord(submittedValue)) {
    return submittedValue;
  }

  return isRecord(fieldValue) ? fieldValue : {};
}

export function normalizeProfileFormReviewDocumentValue(
  value: unknown,
): string | string[] | undefined {
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }
  if (!Array.isArray(value)) return undefined;

  const documents = value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
  return documents.length > 0 ? documents : undefined;
}
