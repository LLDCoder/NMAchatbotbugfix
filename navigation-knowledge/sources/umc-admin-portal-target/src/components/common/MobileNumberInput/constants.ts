import type {
  MobileNumberFieldNames,
  MobileNumberValidationMessages,
} from "./types";
export {
  COUNTRY_DIAL_CODE_OPTIONS,
  COUNTRY_DIAL_CODE_OPTIONS_MAP,
  DEFAULT_COUNTRY_DIAL_CODE,
} from "@/components/common/CountrySelect/constants";
export const DEFAULT_MOBILE_NUMBER_FIELD_NAMES: MobileNumberFieldNames = {
  countryCode: "countryCode",
  phoneNumber: "phoneNumber",
};
export const PHONE_NUMBER_MAX_LENGTH = 30;
export const DEFAULT_MOBILE_NUMBER_VALIDATION_MESSAGES: MobileNumberValidationMessages =
  {
    REQUIRED: "This field is required",
    INVALID_COUNTRY: "Please select or enter a valid country code",
    NOT_A_NUMBER: "Please enter a valid mobile number",
    TOO_SHORT: "Please enter a valid mobile number",
    TOO_LONG: "Please enter a valid mobile number",
    INVALID_LENGTH: "Please enter a valid mobile number",
    INVALID_FORMAT: "Please enter a valid mobile number",
  };
export const COUNTRY_PANEL_PREFERRED_HEIGHT = 360;
export const COUNTRY_PANEL_VIEWPORT_GAP = 16;
