export { default as FormMobileNumberInput } from "./components/FormMobileNumberInput";
export { default as StandaloneMobileNumberInput } from "./components/StandaloneMobileNumberInput";
export type {
  MobileNumberValue,
  MobileNumberFieldNames,
  MobileNumberFormValue,
  MobileNumberFormRuleOptions,
  MobileNumberFormRuleInstance,
  MobileNumberValidationErrorCode,
  MobileNumberValidationMessages,
  MobileNumberValidationResult,
  MobileNumberValidationValue,
  MobileNumberFormFieldName,
  SingleFormMobileNumberInputProps,
  SplitFormMobileNumberInputProps,
  FormMobileNumberInputProps,
  SingleStandaloneMobileNumberInputProps,
  SplitStandaloneMobileNumberInputProps,
  StandaloneMobileNumberInputProps,
  CountryDialCodeOption,
  MobileNumberParts,
} from "./types";

export {
  COUNTRY_DIAL_CODE_OPTIONS,
  COUNTRY_DIAL_CODE_OPTIONS_MAP,
  DEFAULT_COUNTRY_DIAL_CODE,
  DEFAULT_MOBILE_NUMBER_FIELD_NAMES,
  DEFAULT_MOBILE_NUMBER_VALIDATION_MESSAGES,
  PHONE_NUMBER_MAX_LENGTH,
} from "./constants";

export {
  combineInternationalMobileNumber,
  createMobileNumberFormRule,
  findCountryDialCodeOption,
  isValidMobileNumber,
  isValidSingleMobileNumber,
  normalizeEditedMobileLocalNumber,
  splitInternationalMobileNumber,
  validateMobileNumber,
} from "./utils";

export type {
  ContactNumberSourceMode,
  ContactNumberValue,
  ContactNumberSnapshot,
  ContactNumberChangedField,
  ContactNumberDraft,
  ContactNumberStorageFieldNames,
  ContactFormFieldNames,
} from "./contactNumber";

export {
  buildContactNumberDraft,
  buildContactNumberFields,
  createContactNumberSnapshot,
  getContactNumberDisplay,
  isContactNumberChanged,
  readContactFormValue,
  toContactFormValue,
  toContactNumberDraftFields,
} from "./contactNumber";
