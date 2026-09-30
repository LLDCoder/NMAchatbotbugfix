import { DownOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CountrySelect, {
  COUNTRY_DIAL_CODE_OPTIONS,
} from "@/components/common/CountrySelect";
import type { CountryDialCodePickerProps } from "../types";
import { findCountryDialCodeOption } from "../utils";


const CountryDialCodePicker: React.FC<CountryDialCodePickerProps> = ({
  value,
  disabled = false,
  hasError = false,
  searchPlaceholder,
  emptyText,
  getPopupContainer,
  onChange,
}) => {
  const { i18n, t } = useTranslation();
  const resolvedSearchPlaceholder =
    searchPlaceholder || t("mobileNumberInput.countrySearchPlaceholder");
  const resolvedEmptyText =
    emptyText || t("mobileNumberInput.countrySearchEmpty");
  const [selectedCountryCode, setSelectedCountryCode] = useState(
    () => findCountryDialCodeOption(value)?.countryCode,
  );
  const selectedOption =
    COUNTRY_DIAL_CODE_OPTIONS.find(
      (option) =>
        option.value === value && option.countryCode === selectedCountryCode,
    ) || findCountryDialCodeOption(value);

  useEffect(() => {
    setSelectedCountryCode((currentCountryCode) => {
      const currentOption = COUNTRY_DIAL_CODE_OPTIONS.find(
        (option) => option.countryCode === currentCountryCode,
      );
      return currentOption?.value === value
        ? currentCountryCode
        : findCountryDialCodeOption(value)?.countryCode;
    });
  }, [value]);

  const handleChange = (countryCode: string | string[]) => {
    if (typeof countryCode !== "string") return;
    const option = COUNTRY_DIAL_CODE_OPTIONS.find(
      (item) => item.countryCode === countryCode,
    );
    if (!option) return;
    setSelectedCountryCode(option.countryCode);
    onChange(option.value);
  };

  return (
    <div className="mobile-number-input__country-picker">
      <CountrySelect
        labelMode="dialCode"
        language={i18n.language}
        searchPlaceholder={resolvedSearchPlaceholder}
        emptyText={resolvedEmptyText}
        showArrow={!disabled}
        value={selectedOption?.countryCode}
        disabled={disabled}
        optionLabelProp="triggerLabel"
        placeholder={resolvedSearchPlaceholder}
        className={`mobile-number-input__country-select${
          hasError ? " mobile-number-input__country-select--error" : ""
        }`}
        dropdownClassName="mobile-number-input__country-dropdown"
        dropdownMatchSelectWidth={400}
        listHeight={272}
        listItemHeight={60}
        suffixIcon={<DownOutlined />}
        getPopupContainer={getPopupContainer}
        onChange={handleChange}
      />
    </div>
  );
};

export default CountryDialCodePicker;
