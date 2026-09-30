import React from "react";
import { Form } from "antd";
import {
  DEFAULT_COUNTRY_DIAL_CODE,
  DEFAULT_MOBILE_NUMBER_FIELD_NAMES,
} from "../constants";
import type {
  FormMobileNumberInputProps,
  MobileNumberValue,
} from "../types";
import { toMobileNumberValue, toSingleMobileNumberValue } from "../utils";
import MobileNumberControl from "./MobileNumberControl";

const FormMobileNumberInput: React.FC<FormMobileNumberInputProps> = (props) => {
  const {
    defaultCountryCode,
    placeholder,
    searchPlaceholder,
    emptyText,
    getPopupContainer,
    disabled = false,
    hasError = false,
  } = props;
  const resolvedDefaultCountryCode =
    defaultCountryCode?.trim() ?? DEFAULT_COUNTRY_DIAL_CODE;
  const { status } = Form.Item.useStatus();
  const fieldNames = props.singlePhoneField
    ? DEFAULT_MOBILE_NUMBER_FIELD_NAMES
    : props.fieldNames ?? DEFAULT_MOBILE_NUMBER_FIELD_NAMES;
  const currentValue = toMobileNumberValue(
    props.value,
    resolvedDefaultCountryCode,
    fieldNames,
  );
  const handleChange = (nextValue: MobileNumberValue) => {
    if (props.singlePhoneField) {
      props.onChange?.(toSingleMobileNumberValue(nextValue));
      return;
    }

    props.onChange?.({
      ...(props.value || {}),
      [fieldNames.countryCode]: nextValue.countryCode,
      [fieldNames.phoneNumber]: nextValue.phoneNumber,
    });
  };

  return (
    <MobileNumberControl
      value={currentValue}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      getPopupContainer={getPopupContainer}
      disabled={disabled}
      hasError={hasError || status === "error"}
      onChange={handleChange}
    />
  );
};

export default FormMobileNumberInput;
