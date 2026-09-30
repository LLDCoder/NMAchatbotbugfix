export type OptionValue = string | number;

export interface SelectOption {
  label: string;
  value: OptionValue;
  disabled?: boolean;
  establishmentCount?: number;
}

export interface SelectAllDropdownProps {
  value?: OptionValue[];
  onChange?: (values: OptionValue[]) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  showSearch?: boolean;
  maxTagCount?: number | "responsive";
  compactMoreTag?: boolean;
  className?: string;
  showSelectAll?: boolean;
  selectionDisplay?: "tags" | "text";
  clearable?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
  selectAllLabel?: string;
  tagRemovable?: boolean;
  getPopupContainer?: () => HTMLElement;
  dropdownPanelClassName?: string;
  tagCountDisplay?: "parentheses" | "space";
}
