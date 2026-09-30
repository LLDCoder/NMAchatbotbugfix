import { useEffect } from "react";
import {
  type IDSelectorValue,
  type IdSelectorType,
  type PassportMode,
  validateArabicFullName,
  validateContactArea,
  validateEmailAddress,
  validateEnglishFullName,
  validateEmiratesId,
  validateOccupation,
  validatePassportType,
  validatePassportNumber,
  validatePhoneNumberField,
  validatePlaceOfIssueAr,
  validatePlaceOfIssueEn,
  validateFutureDateField,
  validateUid,
} from "./idSelectorUtils";
import { useIDSelectorLabels } from "./useIdSelectorLabels";
import {
  createContactNumberSnapshot,
  validateMobileNumber,
} from "@/components/common/MobileNumberInput";

interface ValidatorSubField {
  setValidator: (validator: (value: unknown) => string) => void;
  setFeedback: (feedback: { type: string; messages: string[] }) => void;
}

interface ValidatorField {
  value?: unknown;
  address: string;
  query: (pattern: string) => { take: () => ValidatorSubField | undefined };
}

interface UseIdSelectorValidatorsParams {
  field: ValidatorField;
  current: IDSelectorValue;
  currentType: IdSelectorType;
  passportMode: PassportMode;
  showList: boolean;
}

type RuleMap = Partial<Record<keyof IDSelectorValue, (value: unknown) => string>>;

const CLEAR_FIELDS_BY_TYPE: Record<IdSelectorType, Array<keyof IDSelectorValue>> = {
  emiratesId: [
    "uid",
    "passportNumber",
    "passportExpiryDate",
    "visaExpiryDate",
    "Passport",
    "Visa",
    "PassportScan",
    "passportType",
    "placeOfIssueEn",
    "placeOfIssueAr",
    "addressPicker",
    "mobileNo",
    "mobileNoCountryCode",
    "mobileNoLocalNumber",
    "telephoneNo",
    "telephoneNoCountryCode",
    "telephoneNoLocalNumber",
    "fax",
    "workNo",
    "workNoCountryCode",
    "workNoLocalNumber",
    "areaCode",
    "emailAddress",
  ],
  uid: [
    "emiratesId",
    "passportNumber",
    "emiratesIdexpiryDate",
    "EmiratesID",
    "PassportScan",
    "passportType",
    "placeOfIssueEn",
    "placeOfIssueAr",
    "addressPicker",
    "mobileNo",
    "mobileNoCountryCode",
    "mobileNoLocalNumber",
    "telephoneNo",
    "telephoneNoCountryCode",
    "telephoneNoLocalNumber",
    "fax",
    "workNo",
    "workNoCountryCode",
    "workNoLocalNumber",
    "areaCode",
    "emailAddress",
  ],
  passport: [
    "emiratesId",
    "uid",
    "emiratesIdexpiryDate",
    "visaExpiryDate",
    "EmiratesID",
    "Passport",
    "Visa",
  ],
};

export const useIdSelectorValidators = ({
  field,
  current,
  currentType,
  passportMode,
  showList,
}: UseIdSelectorValidatorsParams) => {
  const labels = useIDSelectorLabels();

  useEffect(() => {
    const setupSubFieldValidator = (
      fieldName: keyof IDSelectorValue,
      validator: (value: unknown) => string,
    ) => {
      const subField = field.query(`${field.address}.${fieldName}`).take();
      if (subField) {
        subField.setValidator(validator);
      }
    };

    const clearSubFieldValidator = (fieldName: keyof IDSelectorValue) => {
      const subField = field.query(`${field.address}.${fieldName}`).take();
      if (subField) {
        subField.setValidator(() => "");
        subField.setFeedback({ type: "error", messages: [] });
      }
    };

    const value = (field.value || {}) as IDSelectorValue;
    const mobileSnapshot = createContactNumberSnapshot({
      countryCode: current.mobileNoCountryCode,
      localNumber: current.mobileNoLocalNumber,
      fullNumber: current.mobileNo,
    });
    const telephoneSnapshot = createContactNumberSnapshot({
      countryCode: current.telephoneNoCountryCode,
      localNumber: current.telephoneNoLocalNumber,
      fullNumber: current.telephoneNo,
    });
    const workSnapshot = createContactNumberSnapshot({
      countryCode: current.workNoCountryCode,
      localNumber: current.workNoLocalNumber,
      fullNumber: current.workNo,
    });
    const validateContactSnapshot = (
      snapshot: ReturnType<typeof createContactNumberSnapshot>,
      fieldValue: unknown,
    ) => {
      const validation = validateMobileNumber({
        countryCode: snapshot.value.countryCode,
        phoneNumber: String(snapshot.value.phoneNumber || fieldValue || ""),
      });
      if (validation.isValid) return "";
      return validation.errorCode === "REQUIRED"
        ? labels.valPhoneNumberRequired
        : labels.valPhoneNumberInvalid;
    };
    const type = value.type || currentType;
    const hasDetails =
      showList &&
      (!!value.emiratesId || !!value.uid || !!value.passportNumber);

    const baseRules: Record<IdSelectorType, RuleMap> = {
      emiratesId: {
        dateOfBirth: (fieldValue) => (!fieldValue ? labels.valDate : ""),
        emiratesId: (fieldValue) =>
          validateEmiratesId(String(fieldValue || ""), labels),
      },
      uid: {
        dateOfBirth: (fieldValue) => (!fieldValue ? labels.valDate : ""),
        uid: (fieldValue) => validateUid(String(fieldValue || ""), labels),
      },
      passport: {
        dateOfBirth: (fieldValue) => (!fieldValue ? labels.valDate : ""),
        passportNumber: (fieldValue) =>
          validatePassportNumber(String(fieldValue || ""), labels),
      },
    };

    const detailRules: Record<IdSelectorType, RuleMap> = {
      emiratesId: {
        fullNameArabic: (fieldValue) =>
          validateArabicFullName(String(fieldValue || ""), labels),
        fullNameEnglish: (fieldValue) =>
          validateEnglishFullName(String(fieldValue || ""), labels),
        nationality: (fieldValue) => (!fieldValue ? labels.valNationality : ""),
        gender: (fieldValue) => (!fieldValue ? labels.valGender : ""),
        occupation: (fieldValue) =>
          validateOccupation(String(fieldValue || ""), labels),
        emiratesIdexpiryDate: (fieldValue) => (!fieldValue ? labels.valDate : ""),
        PersonalPhoto: (fieldValue) => (!fieldValue ? labels.valRequired : ""),
        EmiratesID: (fieldValue) => (!fieldValue ? labels.valRequired : ""),
      },
      uid: {
        fullNameArabic: (fieldValue) =>
          validateArabicFullName(String(fieldValue || ""), labels),
        fullNameEnglish: (fieldValue) =>
          validateEnglishFullName(String(fieldValue || ""), labels),
        nationality: (fieldValue) => (!fieldValue ? labels.valNationality : ""),
        gender: (fieldValue) => (!fieldValue ? labels.valGender : ""),
        occupation: (fieldValue) =>
          validateOccupation(String(fieldValue || ""), labels),
        passportExpiryDate: (fieldValue) => (!fieldValue ? labels.valDate : ""),
        visaExpiryDate: (fieldValue) => (!fieldValue ? labels.valDate : ""),
        PersonalPhoto: (fieldValue) => (!fieldValue ? labels.valRequired : ""),
        Passport: (fieldValue) => (!fieldValue ? labels.valRequired : ""),
        Visa: (fieldValue) => (!fieldValue ? labels.valRequired : ""),
      },
      passport: {
        fullNameArabic: (fieldValue) =>
          validateArabicFullName(String(fieldValue || ""), labels),
        fullNameEnglish: (fieldValue) =>
          validateEnglishFullName(String(fieldValue || ""), labels),
        nationality: (fieldValue) => (!fieldValue ? labels.valNationality : ""),
        gender: (fieldValue) => (!fieldValue ? labels.valGender : ""),
        occupation: (fieldValue) =>
          validateOccupation(String(fieldValue || ""), labels),
        passportExpiryDate: (fieldValue) =>
          passportMode === "filmingTeam"
            ? validateFutureDateField(fieldValue as string | undefined, labels)
            : !fieldValue
              ? labels.valDate
              : "",
        PersonalPhoto: (fieldValue) => (!fieldValue ? labels.valRequired : ""),
        PassportScan: (fieldValue) => (!fieldValue ? labels.valRequired : ""),
        ...(passportMode === "filmingTeam"
          ? {
              passportType: (fieldValue: unknown) =>
                validatePassportType(String(fieldValue || ""), labels),
              placeOfIssueEn: (fieldValue: unknown) =>
                validatePlaceOfIssueEn(String(fieldValue || ""), labels),
              placeOfIssueAr: (fieldValue: unknown) =>
                validatePlaceOfIssueAr(String(fieldValue || ""), labels),
              mobileNo: (fieldValue: unknown) => {
                return validateContactSnapshot(mobileSnapshot, fieldValue);
              },
              telephoneNo: (fieldValue: unknown) =>
                validateContactSnapshot(telephoneSnapshot, fieldValue),
              fax: (fieldValue: unknown) =>
                validatePhoneNumberField(String(fieldValue || ""), labels),
              workNo: (fieldValue: unknown) =>
                validateContactSnapshot(workSnapshot, fieldValue),
              areaCode: (fieldValue: unknown) =>
                validateContactArea(String(fieldValue || ""), labels),
              emailAddress: (fieldValue: unknown) =>
                validateEmailAddress(String(fieldValue || ""), labels),
            }
          : {}),
      },
    };

    const rules = hasDetails
      ? { ...baseRules[type], ...detailRules[type] }
      : baseRules[type];

    Object.entries(rules).forEach(([fieldName, validator]) => {
      if (validator) {
        setupSubFieldValidator(
          fieldName as keyof IDSelectorValue,
          validator,
        );
      }
    });

    CLEAR_FIELDS_BY_TYPE[type].forEach(clearSubFieldValidator);
  }, [current, currentType, field, labels, passportMode, showList]);
};

export default useIdSelectorValidators;
