import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  connect,
  mapProps,
  mapReadPretty,
  useField,
  useForm,
} from "@formily/react";
import { Checkbox, Select as AntdSelect } from "antd";
import type { DefaultOptionType, SelectProps } from "antd/es/select";
import { LoadingOutlined } from "@ant-design/icons";
import { PreviewText } from "@formily/antd";
import { useTranslation } from "react-i18next";
import { languageOptions as localLanguageOptions } from "./language";
import { getLanguages } from "../../../../../services/services";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  getReadOnlyMultiSelectProps,
  isNonEditablePattern,
} from "@/components/designable/src/utils/readOnlyMultiSelect";
import './index.less'
type LanguageOption = {
  id?: string | number;
  value?: string | number;
  label?: string;
  nameEn?: string;
  nameAr?: string;
  NameEn?: string;
  NameAr?: string;
};

type NormalizedLanguageOption = {
  label: string;
  value: string | number;
  nameEn?: string;
  nameAr?: string;
};

type LanguageSelectProps = {
  value?: unknown;
  onChange?: SelectProps<unknown, DefaultOptionType>["onChange"];
  placeholder?: unknown;
  placeholderEn?: unknown;
  placeholderAr?: unknown;
  multiple?: boolean;
  options?: LanguageOption[];
  dataSource?: LanguageOption[];
  disabled?: boolean;
  readOnly?: boolean;
  suffixIcon?: ReactNode;
  notFoundContent?: ReactNode;
  filterOption?:
    | boolean
    | ((input: string, option?: NormalizedLanguageOption) => boolean);
  [key: string]: unknown;
};

let cachedRemoteLanguageOptions: LanguageOption[] = [];

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function resolveLanguageSelectPlaceholder(
  props: {
    placeholderEn?: unknown;
    placeholderAr?: unknown;
    placeholder?: unknown;
  },
  lang: string | undefined,
): string | undefined {
  const isAr = (lang ?? "en").toLowerCase().startsWith("ar");
  const ph = isAr
    ? props.placeholderAr ?? props.placeholderEn ?? props.placeholder
    : props.placeholderEn ?? props.placeholderAr ?? props.placeholder;
  return typeof ph === "string" ? ph : undefined;
}

function normalizeLanguageOption(item: LanguageOption, isAr: boolean) {
  const value =
    item.id ?? item.value ?? item.nameEn ?? item.NameEn ?? item.label ?? "";
  const nameEn = normalizeText(item.nameEn ?? item.NameEn ?? item.label);
  const nameAr = normalizeText(item.nameAr ?? item.NameAr);
  const label = isAr ? nameAr || nameEn : nameEn || nameAr;

  return {
    label: label || normalizeText(value),
    value,
    nameEn,
    nameAr,
  };
}

function buildMergedOptions(
  options: LanguageOption[] | undefined,
  remoteLanguageOptions: LanguageOption[],
  isAr: boolean,
): NormalizedLanguageOption[] {
  const sourceOptions =
    options && options.length > 0
      ? options
      : remoteLanguageOptions.length > 0
      ? remoteLanguageOptions
      : localLanguageOptions;

  return sourceOptions.map((item: LanguageOption) =>
    normalizeLanguageOption(item, isAr),
  );
}

function normalizePrimitiveValue(value: unknown) {
  if (value === undefined || value === null) return undefined;

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return undefined;
    if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
      return Number(trimmedValue);
    }
    return trimmedValue;
  }

  return value as string | number;
}

function normalizeLanguageValue(value: unknown, multiple?: boolean) {
  if (multiple) {
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizePrimitiveValue(item))
        .filter(
          (item): item is string | number => item !== undefined && item !== "",
        );
    }

    if (typeof value === "string" && value.includes(",")) {
      return value
        .split(",")
        .map((item) => normalizePrimitiveValue(item))
        .filter(
          (item): item is string | number => item !== undefined && item !== "",
        );
    }

    const normalizedValue = normalizePrimitiveValue(value);
    return normalizedValue === undefined ? undefined : [normalizedValue];
  }

  if (Array.isArray(value)) {
    return normalizePrimitiveValue(value[0]);
  }

  return normalizePrimitiveValue(value);
}

const LanguageSelectReadPretty = (props: LanguageSelectProps) => {
  const { i18n } = useTranslation();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const displayLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18n.language);
  const isAr = displayLang === "ar";
  const [remoteLanguageOptions, setRemoteLanguageOptions] = useState<
    LanguageOption[]
  >(cachedRemoteLanguageOptions);

  useEffect(() => {
    if (cachedRemoteLanguageOptions.length > 0) {
      return;
    }

    getLanguages().then((res) => {
      const nextOptions = Array.isArray(res?.data) ? res.data : [];
      cachedRemoteLanguageOptions = nextOptions;
      setRemoteLanguageOptions(nextOptions);
    });
  }, []);

  const mergedOptions = useMemo(
    () => buildMergedOptions(props.options, remoteLanguageOptions, isAr),
    [isAr, props.options, remoteLanguageOptions],
  );
  const previewProps = { ...props } as Record<string, unknown>;
  delete previewProps.options;
  delete previewProps.dataSource;
  delete previewProps.placeholderEn;
  delete previewProps.placeholderAr;
  delete previewProps.filterOption;
  delete previewProps.multiple;

  return (
    <PreviewText.Select
      {...(previewProps as SelectProps<unknown, DefaultOptionType>)}
      value={normalizeLanguageValue(props.value, props.multiple)}
      options={mergedOptions as DefaultOptionType[]}
    />
  );
};

const LanguageSelectComponent = ({
  value,
  onChange,
  options,
  ...props
}: LanguageSelectProps) => {
  const field = useField();
  const form = useForm();
  const { i18n } = useTranslation();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const displayLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18n.language);
  const isAr = displayLang === "ar";
  const [remoteLanguageOptions, setRemoteLanguageOptions] = useState<
    LanguageOption[]
  >(cachedRemoteLanguageOptions);
  const {
    placeholderEn,
    placeholderAr,
    placeholder,
    multiple,
    filterOption: filterOptionProp,
    ...selectProps
  } = props;
  const resolvedPlaceholder =
    resolveLanguageSelectPlaceholder(
      { placeholderEn, placeholderAr, placeholder },
      displayLang,
    ) ?? placeholder;
  useEffect(() => {
    getLanguages().then((res) => {
      const nextOptions = Array.isArray(res?.data) ? res.data : [];
      cachedRemoteLanguageOptions = nextOptions;
      setRemoteLanguageOptions(nextOptions);
    });
  }, []);
  const mergedOptions = useMemo(
    () => buildMergedOptions(options, remoteLanguageOptions, isAr),
    [isAr, options, remoteLanguageOptions],
  );
  const isPatternReadOnly =
    isNonEditablePattern(field?.pattern) || isNonEditablePattern(form?.pattern);
  const isRuntimeMultiple =
    Boolean(multiple) && field?.designable === false;
  const isDisabled =
    Boolean(selectProps.disabled) ||
    Boolean(selectProps.readOnly) ||
    isPatternReadOnly;
  const antdSelectProps = selectProps as SelectProps<
    unknown,
    DefaultOptionType
  >;
  const controlledOpen =
    typeof antdSelectProps.open === "boolean"
      ? antdSelectProps.open
      : undefined;
  const controlledShowSearch =
    typeof antdSelectProps.showSearch === "boolean"
      ? antdSelectProps.showSearch
      : undefined;
  const resolvedFilterOption: SelectProps<
    unknown,
    DefaultOptionType
  >["filterOption"] =
    typeof filterOptionProp === "function"
      ? (input, option) =>
          filterOptionProp(
            input,
            option as NormalizedLanguageOption | undefined,
          )
      : filterOptionProp === false
      ? false
      : (input, option) => {
          const normalizedInput = String(input).toLowerCase();
          const normalizedOption = option as
            | NormalizedLanguageOption
            | undefined;
          return [
            normalizedOption?.label,
            normalizedOption?.nameEn,
            normalizedOption?.nameAr,
          ].some((text) =>
            String(text ?? "")
              .toLowerCase()
              .includes(normalizedInput),
          );
        };
  const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
    isMultiple: Boolean(multiple),
    isReadOnly: isPatternReadOnly,
    configuredMaxTagCount: antdSelectProps.maxTagCount,
    configuredMaxTagPlaceholder: antdSelectProps.maxTagPlaceholder,
    defaultMaxTagCount: 2,
  });
  const resolvedMaxTagCount = multiple
    ? isPatternReadOnly
      ? readOnlyMultiSelectProps.maxTagCount ?? 2
      : antdSelectProps.maxTagCount ?? (isDisabled ? undefined : 2)
    : 0;
  const normalizedValue = normalizeLanguageValue(value, multiple);
  const selectedValues: Array<string | number> = Array.isArray(normalizedValue)
    ? normalizedValue.filter(
        (item): item is string | number =>
          typeof item === "string" || typeof item === "number",
      )
    : [];
  const optionValues = mergedOptions
    .map((option) => option.value)
    .filter(
      (item): item is string | number =>
        typeof item === "string" || typeof item === "number",
    );
  const hasSelectedValues = optionValues.some((optionValue) =>
    selectedValues.includes(optionValue),
  );
  const allSelected =
    optionValues.length > 0 &&
    optionValues.every((optionValue) => selectedValues.includes(optionValue));
  const runtimeOptions = isRuntimeMultiple
    ? mergedOptions.map((option) => ({
        ...option,
        title: option.label,
        label: (
          <div className="language-select-multi-option">
            <Checkbox checked={selectedValues.includes(option.value)} />
            <span>{option.label}</span>
          </div>
        ),
      }))
    : mergedOptions;
  const handleSelectAll = (checked: boolean) => {
    if (isDisabled || !onChange || optionValues.length === 0) return;
    onChange(checked ? optionValues : [], []);
  };
  const renderDropdown = (menu: ReactNode) => {
    const renderedMenu = antdSelectProps.dropdownRender
      ? antdSelectProps.dropdownRender(menu)
      : menu;

    return (
      <div>
        <div className="language-select-multi-select-all">
          <Checkbox
            className={
              hasSelectedValues && !allSelected
                ? "language-select-multi-select-all-checkbox has-selection"
                : "language-select-multi-select-all-checkbox"
            }
            checked={allSelected}
            disabled={isDisabled || optionValues.length === 0}
            onChange={(event) => handleSelectAll(event.target.checked)}
          >
            {i18n.t("LanguageSelectMulti.selectAll", { lng: displayLang })}
          </Checkbox>
        </div>
        <div>{renderedMenu}</div>
      </div>
    );
  };
  const lockedSelectProps: SelectProps<unknown, DefaultOptionType> = {
    ...antdSelectProps,
    disabled: isDisabled,
    open: isDisabled ? false : controlledOpen,
    showSearch: isDisabled ? false : controlledShowSearch ?? true,
    maxTagPlaceholder: readOnlyMultiSelectProps.maxTagPlaceholder,
  };

  return (
    <AntdSelect
      mode={multiple ? "multiple" : undefined}
      value={normalizedValue}
      onChange={isDisabled ? undefined : onChange}
      options={runtimeOptions as DefaultOptionType[]}
      maxTagCount={resolvedMaxTagCount}
      {...lockedSelectProps}
      className={
        isRuntimeMultiple
          ? "LanguageSelect LanguageSelectRuntimeMulti"
          : "LanguageSelect"
      }
      dropdownClassName={
        isRuntimeMultiple
          ? "LanguageSelectdropdown LanguageSelectRuntimeMultiDropdown"
          : "LanguageSelectdropdown"
      }
      dropdownRender={
        isRuntimeMultiple ? renderDropdown : antdSelectProps.dropdownRender
      }
      placeholder={resolvedPlaceholder}
      filterOption={isDisabled ? false : resolvedFilterOption}
    />
  );
};

export const LanguageSelect = connect(
  LanguageSelectComponent,
  mapProps(
    {
      loading: true,
    },
    (props, field) => {
      const { options, dataSource, ...restProps } = props;
      const fieldState = field as unknown as
        | Record<string, unknown>
        | undefined;

      return {
        ...restProps,
        options: options || dataSource,
        suffixIcon:
          fieldState?.loading || fieldState?.validating ? (
            <LoadingOutlined />
          ) : (
            props.suffixIcon
          ),
      };
    },
  ),
  mapReadPretty((props) => {
    return <LanguageSelectReadPretty {...props} />;
  }),
);

export default LanguageSelect;
