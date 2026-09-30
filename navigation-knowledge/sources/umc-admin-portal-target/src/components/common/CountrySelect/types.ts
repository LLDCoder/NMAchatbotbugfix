import type { SelectProps } from "antd";
export interface CountrySelectOption {
  key?: string;
  value: string;
  countryCode: string;
  label: string;
  secondaryLabel?: string;
  triggerLabel?: string;
  searchText?: string;
}
export interface CountryDialCodeOption {
  label: string;
  labelAr: string;
  value: string;
  abbreviation: string;
  countryCode: string;
}
export interface CountrySelectProps
  extends Omit<
    SelectProps<string | string[]>,
    "children" | "dropdownRender" | "filterOption" | "options"
  > {
  allowedCountryCodes?: readonly string[];
  labelMode?: "country" | "dialCode";
  language?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  secondaryLabelPrefix?: string;
}
