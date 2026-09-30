import moment from "moment";
import isPureArabic from "@/utils/isPureArabic";
import type { IDSelectorLabels } from "./useIdSelectorLabels";

export type IdSelectorType = "emiratesId" | "uid" | "passport";
export type PassportMode = "default" | "filmingTeam";

export interface AddressPickerValue {
  emirateId?: number;
  regionId?: number;
  areaId?: number;
  street?: string;
}

export interface IDSelectorFieldProps {
  showEmiratesId?: boolean;
  showUID?: boolean;
  showPassport?: boolean;
  serviceCode?: string | number | null;
  onIcpLoadedChange?: (loaded: boolean) => void;
  disabled?: boolean;
  editableFieldKeys?: Array<keyof IDSelectorValue>;
  passportMode?: PassportMode;
}

export interface IDSelectorOption {
  label: string;
  value: IdSelectorType;
}

export interface IcpPersonProfile {
  birthDate?: string;
  unifiedNumber?: string;
  identityCard?: { emiratesId?: string; expiryDate?: string };
  immigrationFile?: { expiryDate?: string };
  nationality?: { id?: number };
  gender?: { descriptionEnglish?: string; id?: string | number };
  occupation?: {
    descriptionEnglish?: string;
    nameEn?: string;
    id?: string | number;
  };
  passport?: { passportNo?: string; expiryDate?: string };
  personName?: {
    fullNameArabic?: string;
    fullNameEnglish?: string;
  };
}

export interface IDSelectorValue {
  type?: IdSelectorType;
  dateOfBirth?: string;
  emiratesId?: string;
  uid?: string;
  passportNumber?: string;
  emirateId?: number;
  regionId?: number;
  areaId?: number;
  street?: string;
  fullNameArabic?: string;
  fullNameEnglish?: string;
  nationality?: number | string;
  gender?: string;
  occupation?: string;
  emiratesIdexpiryDate?: string;
  passportExpiryDate?: string;
  visaExpiryDate?: string;
  PersonalPhoto?: string;
  EmiratesID?: string;
  Passport?: string;
  Visa?: string;
  PassportScan?: string;
  passportType?: string;
  placeOfIssueEn?: string;
  placeOfIssueAr?: string;
  addressPicker?: AddressPickerValue;
  mobileNo?: string;
  mobileNoCountryCode?: string;
  mobileNoLocalNumber?: string;
  telephoneNo?: string;
  telephoneNoCountryCode?: string;
  telephoneNoLocalNumber?: string;
  fax?: string;
  workNo?: string;
  workNoCountryCode?: string;
  workNoLocalNumber?: string;
  areaCode?: string;
  emailAddress?: string;
}

export interface NationalityOption {
  id: number;
  nameEn: string;
  nameAr?: string;
  numericCode?: string | number | null;
}

export type QueryStatus = "idle" | "loading" | "success" | "error";

export interface LookupState {
  status: QueryStatus;
  signature?: string;
  message?: string;
}

export type LookupStateMap = Record<IdSelectorType, LookupState>;

export interface SectionCommonProps {
  current: IDSelectorValue;
  showList: boolean;
  showQueryButton: boolean;
  isFieldEditable: (key: keyof IDSelectorValue) => boolean;
  nationalityList: NationalityOption[];
  passportMode: PassportMode;
  onFieldChange: <K extends keyof IDSelectorValue>(
    key: K,
    value: IDSelectorValue[K],
  ) => void;
  onFieldsChange: (
    value: Partial<IDSelectorValue>,
    editableKey: keyof IDSelectorValue,
  ) => void;
  onQuery: () => void;
  queryLoading: boolean;
  isQuerySuccess: boolean;
}

export const ID_OPTIONS: IDSelectorOption[] = [
  { label: "Emirates ID", value: "emiratesId" },
  { label: "UAE Unified Number (UID)", value: "uid" },
  { label: "Passport", value: "passport" },
];

export const EMIRATES_ID_REGEX = /^784\d{4}\d{7}\d$/;
export const UID_MAX_LENGTH = 15;
export const EMIRATES_ID_MAX_LENGTH = 18;
export const PASSPORT_NUMBER_MAX_LENGTH = 20;
export const FULL_NAME_MAX_LENGTH = 100;
export const OCCUPATION_MAX_LENGTH = 100;
export const PASSPORT_TYPE_MAX_LENGTH = 100;
export const PLACE_OF_ISSUE_MAX_LENGTH = 100;
export const CONTACT_AREA_MAX_LENGTH = 100;
export const PHONE_MAX_LENGTH = 15;

export const QUERY_FIELD_BY_TYPE: Record<IdSelectorType, keyof IDSelectorValue> = {
  emiratesId: "emiratesId",
  uid: "uid",
  passport: "passportNumber",
};

export const DETAIL_FIELDS_BY_TYPE: Record<
  IdSelectorType,
  Array<keyof IDSelectorValue>
> = {
  emiratesId: [
    "fullNameArabic",
    "fullNameEnglish",
    "nationality",
    "gender",
    "occupation",
    "emiratesIdexpiryDate",
    "PersonalPhoto",
    "EmiratesID",
  ],
  uid: [
    "fullNameArabic",
    "fullNameEnglish",
    "nationality",
    "gender",
    "occupation",
    "passportExpiryDate",
    "visaExpiryDate",
    "PersonalPhoto",
    "Passport",
    "Visa",
  ],
  passport: [
    "fullNameArabic",
    "fullNameEnglish",
    "nationality",
    "gender",
    "occupation",
    "passportExpiryDate",
    "PersonalPhoto",
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
};

export const SUB_FIELD_NAMES: Array<keyof IDSelectorValue> = [
  "dateOfBirth",
  "emiratesId",
  "uid",
  "passportNumber",
  "fullNameArabic",
  "fullNameEnglish",
  "nationality",
  "gender",
  "occupation",
  "emiratesIdexpiryDate",
  "passportExpiryDate",
  "visaExpiryDate",
  "PersonalPhoto",
  "EmiratesID",
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
];

export const INITIAL_LOOKUP_STATE_MAP: LookupStateMap = {
  emiratesId: { status: "idle" },
  uid: { status: "idle" },
  passport: { status: "idle" },
};

export const formatUidInput = (value: string): string => {
  return value.replace(/\D/g, "").slice(0, UID_MAX_LENGTH);
};

export const validateEmiratesId = (
  value: string,
  labels: Pick<IDSelectorLabels, "valEnterEmiratesId" | "valValidEmiratesId">,
): string => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return labels.valEnterEmiratesId;
  const digitsOnly = trimmedValue.replace(/\D/g, "");
  return EMIRATES_ID_REGEX.test(digitsOnly) ? "" : labels.valValidEmiratesId;
};

export const validateUid = (
  value: string,
  labels: Pick<IDSelectorLabels, "valEnterUid">,
): string => {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  return digitsOnly ? "" : labels.valEnterUid;
};

export const validatePassportNumber = (
  value: string,
  labels: Pick<IDSelectorLabels, "valEnterPassport">,
): string => {
  return String(value || "").trim() ? "" : labels.valEnterPassport;
};

export const validateArabicFullName = (
  value: string,
  labels: Pick<IDSelectorLabels, "valFullNameAr">,
): string => {
  return String(value || "").trim() ? "" : labels.valFullNameAr;
};

export const validateEnglishFullName = (
  value: string,
  labels: Pick<IDSelectorLabels, "valFullNameEn">,
): string => {
  return String(value || "").trim() ? "" : labels.valFullNameEn;
};

export const validateOccupation = (
  value: string,
  labels: Pick<IDSelectorLabels, "valOccupation">,
): string => {
  return String(value || "").trim() ? "" : labels.valOccupation;
};

export const validatePassportType = (
  value: string,
  labels: Pick<
    IDSelectorLabels,
    "valPassportTypeRequired" | "valPassportTypeMax"
  >,
): string => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return labels.valPassportTypeRequired;
  if (trimmedValue.length > PASSPORT_TYPE_MAX_LENGTH) {
    return labels.valPassportTypeMax;
  }
  return "";
};

export const validatePlaceOfIssueEn = (
  value: string,
  labels: Pick<
    IDSelectorLabels,
    | "valPlaceOfIssueEnRequired"
    | "valPlaceOfIssueEnMax"
    | "valPlaceOfIssueEnInvalid"
  >,
): string => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return labels.valPlaceOfIssueEnRequired;
  if (trimmedValue.length > PLACE_OF_ISSUE_MAX_LENGTH) {
    return labels.valPlaceOfIssueEnMax;
  }
  return /^[A-Za-z\s]+$/.test(trimmedValue)
    ? ""
    : labels.valPlaceOfIssueEnInvalid;
};

export const validatePlaceOfIssueAr = (
  value: string,
  labels: Pick<
    IDSelectorLabels,
    | "valPlaceOfIssueArRequired"
    | "valPlaceOfIssueArMax"
    | "valPlaceOfIssueArInvalid"
  >,
): string => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return labels.valPlaceOfIssueArRequired;
  if (trimmedValue.length > PLACE_OF_ISSUE_MAX_LENGTH) {
    return labels.valPlaceOfIssueArMax;
  }
  return isPureArabic(trimmedValue) ? "" : labels.valPlaceOfIssueArInvalid;
};

export const validatePhoneNumberField = (
  value: string,
  labels: Pick<IDSelectorLabels, "valPhoneNumberRequired" | "valPhoneNumberInvalid">,
): string => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return labels.valPhoneNumberRequired;
  return /^\d{1,15}$/.test(trimmedValue) ? "" : labels.valPhoneNumberInvalid;
};

export const formatNumericInput = (value: string, maxLength = PHONE_MAX_LENGTH) => {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
};

export const validateContactArea = (
  value: string,
  labels: Pick<
    IDSelectorLabels,
    "valContactAreaRequired" | "valContactAreaMax"
  >,
): string => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return labels.valContactAreaRequired;
  if (trimmedValue.length > CONTACT_AREA_MAX_LENGTH) {
    return labels.valContactAreaMax;
  }
  return "";
};

export const validateEmailAddress = (
  value: string,
  labels: Pick<
    IDSelectorLabels,
    "valEmailAddressRequired" | "valEmailAddressInvalid"
  >,
): string => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return labels.valEmailAddressRequired;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
    ? ""
    : labels.valEmailAddressInvalid;
};

export const disableFutureDate = (currentDate: moment.Moment | null) => {
  if (!currentDate) return false;
  return currentDate.isAfter(moment().endOf("day"));
};

export const disablePastDate = (currentDate: moment.Moment | null) => {
  if (!currentDate) return false;
  return currentDate.isBefore(moment().startOf("day"));
};

export const validateFutureDateField = (
  value: string | undefined,
  labels: Pick<IDSelectorLabels, "valDate" | "valPassportExpiryFuture">,
): string => {
  if (!value) return labels.valDate;
  return moment(value).isBefore(moment().startOf("day"))
    ? labels.valPassportExpiryFuture
    : "";
};

export const getErrorMessage = (
  error: unknown,
  fallback: string,
) => {
  if ((error as { message?: string })?.message) {
    return (error as { message: string }).message;
  }
  const responseMessage = (
    error as { response?: { data?: { message?: string } } }
  )?.response?.data?.message;
  if (responseMessage) return responseMessage;
  return fallback;
};

export const getAvailableOptions = ({
  showEmiratesId = true,
  showUID = false,
  showPassport = false,
}: Pick<
  IDSelectorFieldProps,
  "showEmiratesId" | "showUID" | "showPassport"
>): IDSelectorOption[] => {
  return ID_OPTIONS.filter((option) => {
    if (option.value === "emiratesId") return showEmiratesId !== false;
    if (option.value === "uid") return showUID === true;
    if (option.value === "passport") return showPassport === true;
    return true;
  });
};

export const resolveCurrentType = (
  value: IDSelectorValue,
  options: IDSelectorOption[],
): IdSelectorType => {
  const type = value.type;
  if (type && options.some((option) => option.value === type)) {
    return type;
  }
  return options[0]?.value ?? "emiratesId";
};

export const normalizeIdSelectorValue = (
  value: IDSelectorValue,
  passportMode: PassportMode,
): IDSelectorValue => {
  if (passportMode !== "filmingTeam") {
    return value;
  }

  const hasNestedAddress =
    !!value.addressPicker &&
    Object.values(value.addressPicker).some((item) => item != null && item !== "");

  if (hasNestedAddress) {
    return value;
  }

  const hasLegacyAddress =
    value.emirateId != null ||
    value.regionId != null ||
    value.areaId != null ||
    !!String(value.street || "").trim();

  if (!hasLegacyAddress) {
    return value;
  }

  return {
    ...value,
    addressPicker: {
      emirateId: value.emirateId,
      regionId: value.regionId,
      areaId: value.areaId,
      street: value.street,
    },
  };
};

export const withLegacyAddressFields = (
  value: IDSelectorValue,
  passportMode: PassportMode,
): IDSelectorValue => {
  if (passportMode !== "filmingTeam" || !value.addressPicker) {
    return value;
  }

  return {
    ...value,
    emirateId: value.addressPicker.emirateId,
    regionId: value.addressPicker.regionId,
    areaId: value.addressPicker.areaId,
    street: value.addressPicker.street,
  };
};

export const getQuerySignature = (
  type: IdSelectorType,
  value: IDSelectorValue,
) => {
  const identifier = String(value[QUERY_FIELD_BY_TYPE[type]] || "").trim();
  return [type, value.dateOfBirth || "", identifier].join("|");
};

export const isLookupFresh = (
  type: IdSelectorType,
  lookupState: LookupState,
  value: IDSelectorValue,
) => {
  return (
    lookupState.status === "success" &&
    lookupState.signature === getQuerySignature(type, value)
  );
};

export const getShowList = (
  type: IdSelectorType,
  lookupState: LookupState,
  value: IDSelectorValue,
) => {
  const hasMeaningfulValue = (fieldValue: unknown): boolean => {
    if (fieldValue == null) return false;
    if (typeof fieldValue === "string") return fieldValue.trim() !== "";
    if (Array.isArray(fieldValue)) return fieldValue.some(hasMeaningfulValue);
    if (typeof fieldValue === "object") {
      return Object.values(fieldValue as Record<string, unknown>).some(
        hasMeaningfulValue,
      );
    }
    return true;
  };

  const hasIdentifier = !!value[QUERY_FIELD_BY_TYPE[type]];
  const hasSavedDetails = DETAIL_FIELDS_BY_TYPE[type].some(
    (fieldName) => hasMeaningfulValue(value[fieldName]),
  );

  if (hasSavedDetails) {
    return true;
  }

  return hasIdentifier && isLookupFresh(type, lookupState, value);
};

export const mapIcpGender = (value?: unknown) => {
  const genderEnglish = String(value || "").toLowerCase().trim();
  if (genderEnglish === "male" || genderEnglish === "m") return "male";
  if (genderEnglish === "female" || genderEnglish === "f") return "female";
  return undefined;
};

export const mapIcpNationalityId = (
  nationalityId: number | undefined,
  nationalityList: NationalityOption[],
) => {
  return nationalityList.find(
    (nationality) =>
      String(nationality.numericCode) === String(nationalityId ?? ""),
  )?.id;
};

export const formatIcpDate = (value?: string) => {
  return value ? moment(value).format("YYYY-MM-DD") : undefined;
};

const readText = (...values: Array<unknown>) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return undefined;
};

export const mergeIcpProfileIntoValue = (
  type: IdSelectorType,
  currentValue: IDSelectorValue,
  personProfile: IcpPersonProfile,
  nationalityList: NationalityOption[],
): IDSelectorValue => {
  const mappedGender = mapIcpGender(
    personProfile.gender?.descriptionEnglish || personProfile.gender?.id,
  );
  const mappedNationalityId = mapIcpNationalityId(
    personProfile.nationality?.id,
    nationalityList,
  );
  const occupationValue = readText(
    personProfile.occupation?.descriptionEnglish,
    personProfile.occupation?.nameEn,
    personProfile.occupation?.id,
  );

  if (type === "emiratesId") {
    return {
      ...currentValue,
      type,
      dateOfBirth: formatIcpDate(personProfile.birthDate) || currentValue.dateOfBirth,
      fullNameArabic:
        personProfile.personName?.fullNameArabic || currentValue.fullNameArabic,
      fullNameEnglish:
        personProfile.personName?.fullNameEnglish || currentValue.fullNameEnglish,
      nationality: mappedNationalityId ?? currentValue.nationality ?? undefined,
      gender: mappedGender || currentValue.gender,
      occupation: occupationValue || currentValue.occupation,
      emiratesIdexpiryDate:
        formatIcpDate(
          personProfile.identityCard?.expiryDate ||
            personProfile.immigrationFile?.expiryDate,
        ) || currentValue.emiratesIdexpiryDate,
    };
  }

  if (type === "uid") {
    return {
      ...currentValue,
      type,
      uid: personProfile.unifiedNumber || currentValue.uid,
      emiratesId: personProfile.identityCard?.emiratesId || currentValue.emiratesId,
      dateOfBirth: formatIcpDate(personProfile.birthDate) || currentValue.dateOfBirth,
      fullNameArabic:
        personProfile.personName?.fullNameArabic || currentValue.fullNameArabic,
      fullNameEnglish:
        personProfile.personName?.fullNameEnglish || currentValue.fullNameEnglish,
      nationality: mappedNationalityId ?? currentValue.nationality ?? undefined,
      gender: mappedGender || currentValue.gender,
      occupation: occupationValue || currentValue.occupation,
      passportNumber:
        personProfile.passport?.passportNo || currentValue.passportNumber,
      passportExpiryDate:
        formatIcpDate(personProfile.passport?.expiryDate) ||
        currentValue.passportExpiryDate,
      visaExpiryDate:
        formatIcpDate(
          personProfile.identityCard?.expiryDate ||
            personProfile.immigrationFile?.expiryDate,
        ) || currentValue.visaExpiryDate,
    };
  }

  return {
    ...currentValue,
    type,
    passportNumber:
      personProfile.passport?.passportNo || currentValue.passportNumber,
    dateOfBirth: formatIcpDate(personProfile.birthDate) || currentValue.dateOfBirth,
    fullNameArabic:
      personProfile.personName?.fullNameArabic || currentValue.fullNameArabic,
    fullNameEnglish:
      personProfile.personName?.fullNameEnglish || currentValue.fullNameEnglish,
    nationality: mappedNationalityId ?? currentValue.nationality ?? undefined,
    gender: mappedGender || currentValue.gender,
    occupation: occupationValue || currentValue.occupation,
    passportExpiryDate:
      formatIcpDate(personProfile.passport?.expiryDate) ||
      currentValue.passportExpiryDate,
  };
};

export const getQueryValidationErrors = (
  type: IdSelectorType,
  value: IDSelectorValue,
  labels: IDSelectorLabels,
) => {
  const errors: Partial<Record<keyof IDSelectorValue, string>> = {};

  if (!value.dateOfBirth) {
    errors.dateOfBirth = labels.valDate;
  }

  if (type === "emiratesId") {
    const message = validateEmiratesId(String(value.emiratesId || ""), labels);
    if (message) errors.emiratesId = message;
  } else if (type === "uid") {
    const message = validateUid(String(value.uid || ""), labels);
    if (message) errors.uid = message;
  } else if (type === "passport") {
    const message = validatePassportNumber(
      String(value.passportNumber || ""),
      labels,
    );
    if (message) errors.passportNumber = message;
  }

  return errors;
};
