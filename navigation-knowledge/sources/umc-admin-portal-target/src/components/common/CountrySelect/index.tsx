import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { Select } from "antd";
import { useMemo, useRef, useState } from "react";
import { CountryFlag } from "./CountryFlag";
import { COUNTRY_DIAL_CODE_OPTIONS } from "./constants";
import type { CountrySelectProps } from "./types";
import "./styles.less";
export type {
  CountryDialCodeOption,
  CountrySelectOption,
  CountrySelectProps,
} from "./types";
export {
  COUNTRY_DIAL_CODE_OPTIONS,
  COUNTRY_DIAL_CODE_OPTIONS_MAP,
  DEFAULT_COUNTRY_DIAL_CODE,
} from "./constants";
export { CountryFlag };
const CountrySelect = ({
  allowedCountryCodes,
  labelMode = "country",
  language,
  searchPlaceholder,
  emptyText,
  secondaryLabelPrefix,
  dropdownClassName,
  className,
  onDropdownVisibleChange,
  ...props
}: CountrySelectProps) => {
  const [searchValue, setSearchValue] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const isArabic = language?.toLowerCase().startsWith("ar");
  const options = useMemo(
    () =>
      COUNTRY_DIAL_CODE_OPTIONS.filter(
        (country) =>
          !allowedCountryCodes ||
          allowedCountryCodes.includes(country.countryCode),
      ).map((country) => {
        const label = isArabic ? country.labelAr : country.label;
        return {
          key: country.countryCode,
          value: country.countryCode,
          countryCode: country.countryCode,
          label,
          secondaryLabel:
            labelMode === "dialCode" ? country.value : country.countryCode,
          triggerLabel:
            labelMode === "dialCode"
              ? `(${country.value}) ${country.abbreviation}`
              : label,
          searchText: `${country.label} ${country.labelAr} ${country.abbreviation} ${country.value}`,
        };
      }),
    [allowedCountryCodes, isArabic, labelMode],
  );
  const search = searchValue.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      search
        ? options.filter((option) =>
            `${option.label} ${option.secondaryLabel ?? ""} ${option.countryCode} ${option.searchText ?? ""}`
              .toLowerCase()
              .includes(search),
          )
        : options,
    [options, search],
  );
  return (
    <Select
      {...props}
      showSearch={false}
      filterOption={false}
      optionLabelProp={props.optionLabelProp ?? "triggerLabel"}
      dropdownClassName={`country-select__dropdown${dropdownClassName ? ` ${dropdownClassName}` : ""}`}
      notFoundContent={<div className="country-select__empty">{emptyText}</div>}
      onDropdownVisibleChange={(open) => {
        if (!open) setSearchValue("");
        onDropdownVisibleChange?.(open);
      }}
      dropdownRender={(menu) => (
        <div className="country-select__panel">
          <div
            className="country-select__search"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              searchRef.current?.focus();
            }}
          >
            <SearchOutlined />
            <input
              ref={searchRef}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
            {searchValue ? (
              <button
                aria-label={searchPlaceholder}
                type="button"
                onClick={() => {
                  setSearchValue("");
                  searchRef.current?.focus();
                }}
              >
                <CloseOutlined />
              </button>
            ) : null}
          </div>
          <div className="country-select__menu">{menu}</div>
        </div>
      )}
      className={`umc-select-arrow-manual${className ? ` ${className}` : ""}`}
    >
      {filteredOptions.map((option) => (
        <Select.Option
          key={option.key ?? option.value}
          value={option.value}
          label={option.label}
          triggerLabel={option.triggerLabel ?? option.label}
          className="country-select__option-item"
        >
          <div className="country-select__option">
            <CountryFlag countryCode={option.countryCode} />
            <div className="country-select__labels">
              <span>{option.label}</span>
              <small>
                {secondaryLabelPrefix
                  ? `${secondaryLabelPrefix} ${option.secondaryLabel ?? option.countryCode}`
                  : option.secondaryLabel}
              </small>
            </div>
          </div>
        </Select.Option>
      ))}
    </Select>
  );
};
export default CountrySelect;
