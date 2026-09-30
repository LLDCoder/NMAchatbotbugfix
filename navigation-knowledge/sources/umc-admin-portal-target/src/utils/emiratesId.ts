/** UAE Emirates ID: 15 digits, display format 784-XXXX-XXXXXXX-X */

export const EMIRATES_ID_DIGIT_COUNT = 15;

export const EMIRATES_ID_DISPLAY_MAX_LENGTH = 18;

const COMPLETE_EID_PATTERN = /^784-\d{4}-\d{7}-\d$/;

export function extractEmiratesIdDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, EMIRATES_ID_DIGIT_COUNT);
}

export function formatEmiratesIdDigits(digits: string): string {
  const d = extractEmiratesIdDigits(digits);
  if (!d) return "";
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 14) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14, 15)}`;
}

export function emiratesIdToDisplay(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "";
  return formatEmiratesIdDigits(String(value));
}

export function isCompleteEmiratesId(value: string | null | undefined): boolean {
  if (value == null) return false;
  return COMPLETE_EID_PATTERN.test(String(value).trim());
}

export function emiratesIdDigitsForApi(value: string | null | undefined): string {
  return extractEmiratesIdDigits(String(value ?? ""));
}
