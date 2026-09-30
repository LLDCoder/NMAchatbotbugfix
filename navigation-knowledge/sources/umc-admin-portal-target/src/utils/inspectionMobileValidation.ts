export type InspectionMobileValidationResult = {
  valid: boolean;
  normalizedValue?: string;
  reason?: "invalidFormat" | "invalidLength";
};

export const INSPECTION_MOBILE_MIN_LENGTH = 8;
export const INSPECTION_MOBILE_MAX_LENGTH = 15;

const INSPECTION_MOBILE_LENGTH_REGEX = new RegExp(
  `^\\d{${INSPECTION_MOBILE_MIN_LENGTH},${INSPECTION_MOBILE_MAX_LENGTH}}$`,
);

const normalizeInspectionMobileDigitCharacters = (value: unknown) => String(value ?? "")
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

export const normalizeInspectionMobileDigits = (
  value: unknown,
  maxLength?: number,
) => {
  const digits = normalizeInspectionMobileDigitCharacters(value).replace(/\D/g, "");

  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
};

export const sanitizeInspectionMobileValue = (value?: unknown) =>
  normalizeInspectionMobileDigits(value, INSPECTION_MOBILE_MAX_LENGTH);

export const getInspectionMobilePasteValue = ({
  currentValue,
  pastedValue,
  selectionStart,
  selectionEnd,
}: {
  currentValue: unknown;
  pastedValue: unknown;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}) => {
  const currentDigits = sanitizeInspectionMobileValue(currentValue);
  const pastedDigits = normalizeInspectionMobileDigits(pastedValue);

  if (!pastedDigits) return currentDigits;

  const startIndex = typeof selectionStart === "number"
    ? Math.min(Math.max(selectionStart, 0), currentDigits.length)
    : currentDigits.length;
  const endIndex = typeof selectionEnd === "number"
    ? Math.min(Math.max(selectionEnd, startIndex), currentDigits.length)
    : startIndex;

  return sanitizeInspectionMobileValue(
    `${currentDigits.slice(0, startIndex)}${pastedDigits}${currentDigits.slice(endIndex)}`,
  );
};

export const validateStrictMobileNumberValue = (
  value: unknown,
): InspectionMobileValidationResult => {
  const normalizedValue = normalizeInspectionMobileDigitCharacters(value).trim();

  if (!normalizedValue) {
    return { valid: true };
  }

  if (!/^\d+$/.test(normalizedValue)) {
    return { valid: false, reason: "invalidFormat" };
  }

  if (!INSPECTION_MOBILE_LENGTH_REGEX.test(normalizedValue)) {
    return { valid: false, reason: "invalidLength" };
  }

  return {
    valid: true,
    normalizedValue,
  };
};

export const validateStrictMobileNumberParts = (
  _dialCode: string,
  phoneNumber: unknown,
): InspectionMobileValidationResult => validateStrictMobileNumberValue(phoneNumber);
