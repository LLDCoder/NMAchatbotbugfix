import type { ValidatePhoneNumberLengthResult } from "libphonenumber-js";
import type { RuleRender } from "antd/lib/form";

export type { CountryDialCodeOption } from "@/components/common/CountrySelect/types";

export interface CountryDialCodePickerProps {
  value: string;
  disabled?: boolean;
  hasError?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  onChange: (value: string) => void;
}

export interface MobileNumberParts {
  countryCode: string;
  phoneNumber: string;
}

export interface MobileNumberValue {
  countryCode: string;
  phoneNumber: string;
}

export interface MobileNumberFieldNames {
  countryCode: string;
  phoneNumber: string;
}

export type MobileNumberFormValue =
  | MobileNumberValue
  | Record<string, unknown>;

export type MobileNumberValidationValue =
  | MobileNumberValue
  | string
  | null
  | undefined;

export type MobileNumberValidationErrorCode =
  | "REQUIRED"
  | ValidatePhoneNumberLengthResult
  | "INVALID_FORMAT";

export type MobileNumberValidationMessages = Record<
  MobileNumberValidationErrorCode,
  string
>;

export interface MobileNumberValidationResult {
  isValid: boolean;
  errorCode: MobileNumberValidationErrorCode | null;
  message: string;
}

export type MobileNumberFormFieldName =
  | string
  | number
  | Array<string | number>;

export type MobileNumberFormRuleInstance = Parameters<RuleRender>[0];

export interface MobileNumberFormRuleOptions {
  countryCodeField?: MobileNumberFormFieldName;
  fieldNames?: MobileNumberFieldNames;
  messageOverrides?: Partial<MobileNumberValidationMessages>;
  /** Reject an empty mobile number. Optional fields still validate non-empty values. */
  required?: boolean;
  shouldValidate?: (
    value: MobileNumberValidationValue,
    form: MobileNumberFormRuleInstance
  ) => boolean;
}

interface MobileNumberInputSharedProps {
  defaultCountryCode?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Mounts the country-code popover in a page-specific container when needed. */
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  disabled?: boolean;
  hasError?: boolean;
}

interface StandaloneMobileNumberInputChangeProps {
  onCountryCodeChange?: (value: string) => void;
  onPhoneNumberChange?: (value: string) => void;
}

export interface SplitFormMobileNumberInputProps
  extends MobileNumberInputSharedProps {
  singlePhoneField?: false;
  fieldNames?: MobileNumberFieldNames;
  /** Controlled value injected by an AntD Form.Item. */
  value?: MobileNumberFormValue;
  /** Change handler injected by an AntD Form.Item. */
  onChange?: (value: MobileNumberFormValue) => void;
}

export interface SingleFormMobileNumberInputProps
  extends MobileNumberInputSharedProps {
  /** Uses only fieldNames.fullNumber; countryCode and localNumber are ignored. */
  singlePhoneField: true;
  /** Controlled international number injected by an AntD Form.Item. */
  value?: string;
  /** Change handler injected by an AntD Form.Item. */
  onChange?: (value: string) => void;
}

export interface SplitStandaloneMobileNumberInputProps
  extends MobileNumberInputSharedProps,
    StandaloneMobileNumberInputChangeProps {
  singlePhoneField?: false;
  countryCode?: string;
  phoneNumber?: string;
  defaultPhoneNumber?: string;
}

export interface SingleStandaloneMobileNumberInputProps
  extends MobileNumberInputSharedProps,
    StandaloneMobileNumberInputChangeProps {
  singlePhoneField: true;
  countryCode?: never;
  phoneNumber?: string;
  defaultPhoneNumber?: string;
}

export type FormMobileNumberInputProps =
  | SplitFormMobileNumberInputProps
  | SingleFormMobileNumberInputProps;

export type StandaloneMobileNumberInputProps =
  | SplitStandaloneMobileNumberInputProps
  | SingleStandaloneMobileNumberInputProps;

export type CountryPopoverPlacement = "topLeft" | "bottomLeft";
