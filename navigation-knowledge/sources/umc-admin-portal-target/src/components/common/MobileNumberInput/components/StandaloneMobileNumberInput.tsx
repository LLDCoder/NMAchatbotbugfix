import React, { useMemo, useState } from "react";
import type {
  MobileNumberValue,
  StandaloneMobileNumberInputProps,
} from "../types";
import { DEFAULT_COUNTRY_DIAL_CODE } from "../constants";
import { toMobileNumberValue, toSingleMobileNumberValue } from "../utils";
import MobileNumberControl from "./MobileNumberControl";

const StandaloneMobileNumberInput: React.FC<
  StandaloneMobileNumberInputProps
> = ({
  defaultCountryCode,
  defaultPhoneNumber,
  placeholder,
  searchPlaceholder,
  emptyText,
  getPopupContainer,
  disabled = false,
  hasError = false,
  singlePhoneField,
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
}) => {
  const resolvedDefaultCountryCode =
    defaultCountryCode?.trim() || DEFAULT_COUNTRY_DIAL_CODE;
  const [internalValue, setInternalValue] = useState<MobileNumberValue>(() =>
    singlePhoneField
      ? toMobileNumberValue(defaultPhoneNumber, resolvedDefaultCountryCode)
      : {
          countryCode: resolvedDefaultCountryCode,
          phoneNumber: defaultPhoneNumber || "",
        },
  );
  const currentValue = useMemo<MobileNumberValue>(() => {
    if (singlePhoneField) {
      return phoneNumber === undefined
        ? internalValue
        : toMobileNumberValue(phoneNumber, resolvedDefaultCountryCode);
    }

    return {
      countryCode:
        countryCode || internalValue.countryCode || resolvedDefaultCountryCode,
      phoneNumber: phoneNumber ?? internalValue.phoneNumber,
    };
  }, [
    countryCode,
    internalValue,
    phoneNumber,
    resolvedDefaultCountryCode,
    singlePhoneField,
  ]);

  const handleChange = (
    nextValue: MobileNumberValue,
    changedField: keyof MobileNumberValue,
  ) => {
    if (singlePhoneField) {
      if (phoneNumber === undefined) {
        setInternalValue(nextValue);
      }

      if (changedField === "countryCode") {
        onCountryCodeChange?.(nextValue.countryCode);
      }
      onPhoneNumberChange?.(toSingleMobileNumberValue(nextValue));
      return;
    }

    if (countryCode === undefined || phoneNumber === undefined) {
      setInternalValue((currentInternalValue) => ({
        countryCode:
          countryCode === undefined
            ? nextValue.countryCode
            : currentInternalValue.countryCode,
        phoneNumber:
          phoneNumber === undefined
            ? nextValue.phoneNumber
            : currentInternalValue.phoneNumber,
      }));
    }

    if (changedField === "countryCode") {
      onCountryCodeChange?.(nextValue.countryCode);
      return;
    }

    onPhoneNumberChange?.(nextValue.phoneNumber);
  };

  return (
    <MobileNumberControl
      value={currentValue}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      getPopupContainer={getPopupContainer}
      disabled={disabled}
      hasError={hasError}
      onChange={handleChange}
    />
  );
};

export default StandaloneMobileNumberInput;
