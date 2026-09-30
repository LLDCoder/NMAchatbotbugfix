import {
  isValidPhoneNumber,
  parseDigits,
  validatePhoneNumberLength,
} from "libphonenumber-js";
import type { Rule } from "antd/lib/form";
import i18next from "@/localization/config";
import {
  COUNTRY_DIAL_CODE_OPTIONS_MAP,
  DEFAULT_MOBILE_NUMBER_FIELD_NAMES,
  DEFAULT_MOBILE_NUMBER_VALIDATION_MESSAGES,
} from "./constants";
import type {
  MobileNumberFormValue,
  MobileNumberParts,
  MobileNumberFormRuleOptions,
  MobileNumberValidationErrorCode,
  MobileNumberValidationMessages,
  MobileNumberValidationResult,
  MobileNumberValidationValue,
  MobileNumberValue,
} from "./types";

/**
 * Finds the country dial code option that exactly matches the trimmed value.
 * Returns null when the value is empty or unsupported.
 */
export const findCountryDialCodeOption = (
  value: string | null | undefined,
) => {
  const normalizedValue = String(value || "").trim();

  return COUNTRY_DIAL_CODE_OPTIONS_MAP.get(normalizedValue) || null;
};

/**
 * Combines a country calling code and national number into an international
 * phone number, stripping all non-digit characters from both parts.
 */
export const combineInternationalMobileNumber = (
  countryCode: string,
  phoneNumber: string,
) => {
  const callingCodeDigits = parseDigits(countryCode);
  const phoneNumberDigits = parseDigits(phoneNumber);

  return callingCodeDigits && phoneNumberDigits
    ? `+${callingCodeDigits}${phoneNumberDigits}`
    : "";
};

/**
 * Normalizes a user-edited local-number value. Legacy complete values stay
 * untouched until editing; once edited, a duplicated selected dial code is
 * removed only when the remaining national number is valid.
 */
export const normalizeEditedMobileLocalNumber = (
  countryCode: string,
  phoneNumber: string,
) => {
  const callingCodeDigits = parseDigits(countryCode);
  const phoneNumberDigits = parseDigits(phoneNumber);

  if (!callingCodeDigits || !phoneNumberDigits) return phoneNumberDigits;

  if (
    String(phoneNumber).trim().startsWith("+") &&
    phoneNumberDigits.startsWith(callingCodeDigits)
  ) {
    return phoneNumberDigits.slice(callingCodeDigits.length);
  }

  const directNumber = `+${callingCodeDigits}${phoneNumberDigits}`;
  if (isValidPhoneNumber(directNumber)) return phoneNumberDigits;

  if (phoneNumberDigits.startsWith(callingCodeDigits)) {
    const localNumber = phoneNumberDigits.slice(callingCodeDigits.length);
    if (isValidPhoneNumber(`+${callingCodeDigits}${localNumber}`)) {
      return localNumber;
    }
  }

  return phoneNumberDigits;
};

/**
 * Splits an international phone number into its calling code and national
 * number without rewriting the original national-number characters.
 */
export const splitInternationalMobileNumber = (
  phoneNumber: string,
  defaultCountryCode: string,
): MobileNumberParts => {
  const normalizedPhoneNumber = String(phoneNumber || "");
  const maxCountryDialCodeLength = Math.max(
    ...Array.from(COUNTRY_DIAL_CODE_OPTIONS_MAP.keys(), (code) =>
      parseDigits(code).length,
    ),
  );

  if (!normalizedPhoneNumber) {
    return {
      countryCode: defaultCountryCode,
      phoneNumber: "",
    };
  }
  if (normalizedPhoneNumber.startsWith("+")) {
    for (
      let digitCount = maxCountryDialCodeLength;
      digitCount >= 1;
      digitCount -= 1
    ) {
      const countryCode = normalizedPhoneNumber.slice(0, digitCount + 1);

      if (COUNTRY_DIAL_CODE_OPTIONS_MAP.has(countryCode)) {
        return {
          countryCode,
          phoneNumber: normalizedPhoneNumber.slice(countryCode.length),
        };
      }
    }
  }

  return {
    countryCode: defaultCountryCode,
    phoneNumber: normalizedPhoneNumber,
  };
};

/** Converts either public value mode to the component's split value model. */
export const toMobileNumberValue = (
  value: MobileNumberFormValue | string | undefined,
  defaultCountryCode: string,
  fieldNames = DEFAULT_MOBILE_NUMBER_FIELD_NAMES,
): MobileNumberValue => {
  if (typeof value === "string") {
    return splitInternationalMobileNumber(value, defaultCountryCode);
  }

  const formValue = value as Record<string, unknown> | undefined;
  const hasCountryCode = Boolean(
    formValue &&
      Object.prototype.hasOwnProperty.call(formValue, fieldNames.countryCode),
  );
  const storedCountryCode = String(
    formValue?.[fieldNames.countryCode] ?? "",
  ).trim();

  return {
    countryCode: hasCountryCode
      ? storedCountryCode || defaultCountryCode
      : defaultCountryCode,
    phoneNumber: String(formValue?.[fieldNames.phoneNumber] ?? ""),
  };
};

/** Serializes the split value model for single-field mode. */
export const toSingleMobileNumberValue = (value: MobileNumberValue) => {
  const countryCode = String(value.countryCode || "").trim();

  return countryCode ? `${countryCode}${value.phoneNumber}` : value.phoneNumber;
};

const getMobileNumberValidationErrorCode = (
  value: MobileNumberValidationValue,
): MobileNumberValidationErrorCode | null => {
  let internationalPhoneNumber: string;

  if (typeof value === "string") {
    internationalPhoneNumber = value.trim();

    if (
      !internationalPhoneNumber ||
      COUNTRY_DIAL_CODE_OPTIONS_MAP.has(internationalPhoneNumber)
    ) {
      return "REQUIRED";
    }
  } else {
    const mobileNumberValue = toMobileNumberValue(value ?? undefined, "");
    const countryCode = String(mobileNumberValue.countryCode || "").trim();
    const phoneNumber = String(mobileNumberValue.phoneNumber || "").trim();

    if (!phoneNumber) {
      return "REQUIRED";
    }

    if (!COUNTRY_DIAL_CODE_OPTIONS_MAP.has(countryCode)) {
      return "INVALID_COUNTRY";
    }

    internationalPhoneNumber = `${countryCode}${phoneNumber}`;
  }

  const lengthError = validatePhoneNumberLength(internationalPhoneNumber);

  if (lengthError) {
    return lengthError;
  }

  return isValidPhoneNumber(internationalPhoneNumber)
    ? null
    : "INVALID_FORMAT";
};

/** Validates separate calling-code and national-number values as one number. */
export const isValidMobileNumber = (
  countryCode: string,
  phoneNumberValue: string,
) =>
  getMobileNumberValidationErrorCode({
    countryCode,
    phoneNumber: phoneNumberValue,
  }) === null;

/** Validates a complete phone number stored in a single field. */
export const isValidSingleMobileNumber = (phoneNumber: string) =>
  getMobileNumberValidationErrorCode(phoneNumber) === null;

/** Returns a detailed error code and display message for either public value mode. */
export const validateMobileNumber = (
  value: MobileNumberValidationValue,
  messageOverrides: Partial<MobileNumberValidationMessages> = {},
): MobileNumberValidationResult => {
  const errorCode = getMobileNumberValidationErrorCode(value);
  const translatedMessage = errorCode
    ? i18next.t(`common.mobileNumberValidation.${errorCode}`)
    : "";
  const hasTranslatedMessage = errorCode
    ? i18next.exists(`common.mobileNumberValidation.${errorCode}`)
    : false;

  return {
    isValid: errorCode === null,
    errorCode,
    message: errorCode
      ? messageOverrides[errorCode] ??
        (hasTranslatedMessage
          ? translatedMessage
          : DEFAULT_MOBILE_NUMBER_VALIDATION_MESSAGES[errorCode])
      : "",
  };
};

/** Creates an AntD Form rule backed by the detailed validation result. */
export const createMobileNumberFormRule = (
  options: MobileNumberFormRuleOptions = {},
): Rule => {
  const {
    countryCodeField,
    fieldNames = DEFAULT_MOBILE_NUMBER_FIELD_NAMES,
    messageOverrides,
    required = false,
    shouldValidate,
  } = options;

  return (form) => ({
    validator: (_rule, fieldValue) => {
      const validationValue: MobileNumberValidationValue =
        countryCodeField === undefined
          ? fieldValue && typeof fieldValue === "object"
            ? toMobileNumberValue(
                fieldValue as MobileNumberFormValue,
                "",
                fieldNames,
              )
            : (fieldValue as MobileNumberValidationValue)
          : {
              countryCode: form.getFieldValue(countryCodeField),
              phoneNumber: String(fieldValue ?? ""),
            };

      if (shouldValidate && !shouldValidate(validationValue, form)) {
        return Promise.resolve();
      }

      const validation = validateMobileNumber(
        validationValue,
        messageOverrides,
      );

      if (validation.errorCode === "REQUIRED" && !required) {
        return Promise.resolve();
      }

      return validation.isValid
        ? Promise.resolve()
        : Promise.reject(new Error(validation.message));
    },
  });
};
