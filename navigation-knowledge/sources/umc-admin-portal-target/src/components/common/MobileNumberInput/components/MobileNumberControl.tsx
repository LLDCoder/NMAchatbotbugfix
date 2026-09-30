import React from "react";
import { Input } from "antd";
import { PHONE_NUMBER_MAX_LENGTH } from "../constants";
import type { MobileNumberValue } from "../types";
import { normalizeEditedMobileLocalNumber } from "../utils";
import CountryDialCodePicker from "./CountryDialCodePicker";
import "../styles.less";

interface MobileNumberControlProps {
  value: MobileNumberValue;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  disabled?: boolean;
  hasError?: boolean;
  onChange: (
    value: MobileNumberValue,
    changedField: keyof MobileNumberValue,
  ) => void;
}

const MobileNumberControl: React.FC<MobileNumberControlProps> = ({
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  getPopupContainer,
  disabled = false,
  hasError = false,
  onChange,
}) => {
  const handleCountryCodeChange = (countryCode: string) => {
    onChange({
      countryCode,
      phoneNumber: value.phoneNumber,
    }, "countryCode");
  };

  const handlePhoneNumberChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    onChange({
      countryCode: value.countryCode,
      phoneNumber: event.target.value.replace(/\s+/g, ""),
    }, "phoneNumber");
  };

  const handlePhoneNumberBlur = () => {
    const phoneNumber = normalizeEditedMobileLocalNumber(
      value.countryCode,
      value.phoneNumber,
    );

    if (phoneNumber !== value.phoneNumber) {
      onChange({
        countryCode: value.countryCode,
        phoneNumber,
      }, "phoneNumber");
    }
  };

  return (
    <div
      className={`mobile-number-input${
        hasError ? " mobile-number-input--error" : ""
      }${disabled ? " mobile-number-input--disabled" : ""}`}
    >
      <Input
        addonBefore={
          <CountryDialCodePicker
            value={value.countryCode}
            disabled={disabled}
            onChange={handleCountryCodeChange}
            hasError={hasError}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            getPopupContainer={getPopupContainer}
          />
        }
        placeholder={placeholder}
        value={value.phoneNumber.replace(/\s+/g, "")}
        disabled={disabled}
        maxLength={PHONE_NUMBER_MAX_LENGTH}
        status={hasError ? "error" : undefined}
        onChange={handlePhoneNumberChange}
        onBlur={handlePhoneNumberBlur}
        className="mobile-number-input__control"
      />
    </div>
  );
};

export default MobileNumberControl;
