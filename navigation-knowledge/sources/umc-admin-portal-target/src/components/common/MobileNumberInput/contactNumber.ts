export type ContactNumberSourceMode = "split" | "legacy" | "empty";

export interface ContactNumberValue {
  countryCode: string;
  phoneNumber: string;
}

export interface ContactNumberSnapshot {
  sourceMode: ContactNumberSourceMode;
  originalFullNumber: string;
  value: ContactNumberValue;
}

export type ContactNumberChangedField = "countryCode" | "phoneNumber";

export interface ContactNumberDraft {
  fullNumber: string;
  countryCode: string;
  localNumber: string;
}

export interface ContactNumberStorageFieldNames {
  fullNumber: string;
  countryCode: string;
  localNumber: string;
}

export interface ContactFormFieldNames {
  countryCode: string;
  phoneNumber: string;
}

const normalize = (value: unknown) =>
  String(value ?? "").replace(/\s+/g, "");
const toDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const normalizeCountryCodeForSubmission = (value: unknown) => {
  const digits = toDigits(value);
  return digits ? `+${digits}` : "";
};

export const createContactNumberSnapshot = ({
  countryCode,
  localNumber,
  fullNumber,
}: {
  countryCode?: unknown;
  localNumber?: unknown;
  fullNumber?: unknown;
}): ContactNumberSnapshot => {
  const code = normalize(countryCode);
  const local = normalize(localNumber);
  const originalFullNumber = normalize(fullNumber);

  if (local) {
    return {
      sourceMode: "split",
      originalFullNumber,
      value: { countryCode: code, phoneNumber: local },
    };
  }

  if (originalFullNumber) {
    return {
      sourceMode: "legacy",
      originalFullNumber,
      value: { countryCode: "", phoneNumber: originalFullNumber },
    };
  }

  return {
    sourceMode: "empty",
    originalFullNumber: "",
    value: { countryCode: code, phoneNumber: "" },
  };
};

export const buildContactNumberDraft = ({
  currentFullNumber,
  countryCode,
  localNumber,
  changedField,
  isValid,
}: {
  currentFullNumber?: unknown;
  countryCode?: unknown;
  localNumber?: unknown;
  changedField: ContactNumberChangedField;
  isValid: boolean;
}): ContactNumberDraft => {
  const normalizedFullNumber = normalize(currentFullNumber);
  const normalizedCountryCode = normalize(countryCode);
  const normalizedLocalNumber = normalize(localNumber);

  if (!normalizedLocalNumber) {
    return {
      fullNumber: "",
      countryCode:
        changedField === "countryCode" ? normalizedCountryCode : "",
      localNumber: "",
    };
  }

  const isUncorrectedLegacyValue =
    toDigits(normalizedFullNumber) === toDigits(normalizedLocalNumber);

  return {
    fullNumber: isValid
      ? `${normalizeCountryCodeForSubmission(normalizedCountryCode)}${toDigits(
          normalizedLocalNumber,
        )}`
      : isUncorrectedLegacyValue
        ? normalizedFullNumber
        : "",
    countryCode: normalizedCountryCode,
    localNumber: normalizedLocalNumber,
  };
};

export const toContactNumberDraftFields = (
  draft: ContactNumberDraft,
  fieldNames: ContactNumberStorageFieldNames,
): Record<string, string> => ({
  [fieldNames.fullNumber]: draft.fullNumber,
  [fieldNames.countryCode]: draft.countryCode,
  [fieldNames.localNumber]: draft.localNumber,
});

export const toContactFormValue = (
  snapshot: ContactNumberSnapshot,
  fieldNames: ContactFormFieldNames,
) => ({
  [fieldNames.countryCode]: snapshot.value.countryCode,
  [fieldNames.phoneNumber]: snapshot.value.phoneNumber,
});

export const readContactFormValue = (
  value: Record<string, unknown> | null | undefined,
  fieldNames: ContactFormFieldNames,
): ContactNumberValue => ({
  countryCode: normalize(value?.[fieldNames.countryCode]),
  phoneNumber: normalize(value?.[fieldNames.phoneNumber]),
});

export const isContactNumberChanged = (
  value: ContactNumberValue,
  initial: ContactNumberSnapshot,
) =>
  normalize(value.countryCode) !== normalize(initial.value.countryCode) ||
  normalize(value.phoneNumber) !== normalize(initial.value.phoneNumber);

export const buildContactNumberFields = ({
  value,
  initial,
  keys,
}: {
  value: ContactNumberValue;
  initial: ContactNumberSnapshot;
  keys: ContactNumberStorageFieldNames;
}): Record<string, string> => {
  const countryCode = normalizeCountryCodeForSubmission(value.countryCode);
  const localNumber = toDigits(value.phoneNumber);

  if (
    initial.sourceMode === "legacy" &&
    !isContactNumberChanged(value, initial)
  ) {
    return {
      [keys.fullNumber]: initial.originalFullNumber,
      [keys.countryCode]: "",
      [keys.localNumber]: "",
    };
  }

  if (!localNumber) {
    return {
      [keys.fullNumber]: "",
      [keys.countryCode]: "",
      [keys.localNumber]: "",
    };
  }

  if (!countryCode) {
    throw new Error("A country calling code is required for a mobile number.");
  }

  return {
    [keys.fullNumber]: `${countryCode}${localNumber}`,
    [keys.countryCode]: countryCode,
    [keys.localNumber]: localNumber,
  };
};

export const getContactNumberDisplay = (snapshot: ContactNumberSnapshot) => {
  if (snapshot.sourceMode === "split") {
    return `${snapshot.value.countryCode}${snapshot.value.phoneNumber}`.trim();
  }
  return snapshot.sourceMode === "legacy" ? snapshot.originalFullNumber : "";
};
