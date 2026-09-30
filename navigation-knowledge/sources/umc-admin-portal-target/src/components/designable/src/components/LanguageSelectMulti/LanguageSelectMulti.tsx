import { useEffect, useMemo, useRef, useState } from "react";
import "@/components/designable/src/components/LanguageSelect/index.less";

import {
  connect,
  mapProps,
  mapReadPretty,
  useField,
  useForm,
} from "@formily/react";
import { Select as AntdSelect, Checkbox } from "antd";
import type { SelectProps } from "antd/es/select";
import { LoadingOutlined } from "@ant-design/icons";
import { PreviewText } from "@formily/antd";
// import { languageOptions } from "./language";
import { getLanguages } from "../../../../../services/services";
import { useTranslation } from "react-i18next";
import { useMaxTagCountForFormilyGrid } from "@/components/designable/src/utils/useMaxTagCountForFormilyGrid";
import {
  getReadOnlyMultiSelectProps,
  isNonEditablePattern,
} from "@/components/designable/src/utils/readOnlyMultiSelect";
type LanguageOption = {
  id?: string | number;
  value?: string | number;
  label?: string;
  nameEn?: string;
  nameAr?: string;
  NameEn?: string;
  NameAr?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function resolveLanguageSelectMultiPlaceholder(
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
    item.id ?? item.value ?? item.nameEn ?? item.NameEn ?? item.label;
  const nameEn = normalizeText(item.nameEn ?? item.NameEn ?? item.label);
  const nameAr = normalizeText(item.nameAr ?? item.NameAr);
  const label = isAr ? nameAr || nameEn : nameEn || nameAr;

  return {
    ...item,
    label: label || normalizeText(value),
    value,
  };
}

type LanguageSelectMultiProps = SelectProps<any, any> & {
  placeholderEn?: unknown;
  placeholderAr?: unknown;
  placeholder?: unknown;
  titleEn?: unknown;
  titleAr?: unknown;
  options?: LanguageOption[];
  dataSource?: LanguageOption[];
};

const LanguageSelectComponent = ({
  value,
  onChange,
  options,
  ...props
}: LanguageSelectMultiProps) => {
  const field = useField();
  const form = useForm();
  const { t, i18n } = useTranslation();
  const isAr = Boolean(i18n.language?.startsWith("ar"));
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);
  const {
    placeholderEn,
    placeholderAr,
    titleEn: _titleEn,
    titleAr: _titleAr,
    placeholder,
    maxTagCount: configuredMaxTagCount,
    maxTagPlaceholder: configuredMaxTagPlaceholder,
    ...selectProps
  } = props;
  void _titleEn;
  void _titleAr;
  const resolvedPlaceholder =
    resolveLanguageSelectMultiPlaceholder(
      { placeholderEn, placeholderAr, placeholder },
      i18n.language,
    ) ?? placeholder;
  const isRuntimeMultiSelect = field?.designable === false;
  useEffect(() => {
    getLanguages()
      .then((res) => {
        const nextOptions = Array.isArray(res?.data) ? res.data : [];
        setLanguageOptions(nextOptions);
      })
      .catch(() => {
        setLanguageOptions([]);
      });
  }, []);
  const mergedOptions = useMemo(
    () =>
      (options && options.length > 0 ? options : languageOptions).map(
        (item: LanguageOption) => normalizeLanguageOption(item, isAr),
      ),
    [isAr, languageOptions, options],
  );

  const selectedValues: Array<string | number> = Array.isArray(value)
    ? value.filter(
        (item): item is string | number =>
          typeof item === "string" || typeof item === "number",
      )
    : typeof value === "string" || typeof value === "number"
    ? [value]
    : [];

  const optionValues = mergedOptions
    .map((opt) => opt.value)
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
  const isPatternReadOnly =
    isNonEditablePattern(field?.pattern) || isNonEditablePattern(form?.pattern);
  const isDisabled = Boolean(selectProps.disabled) || isPatternReadOnly;

  const handleSelectAll = (checked: boolean) => {
    if (isDisabled) return;
    if (!onChange) return;
    if (checked) {
      onChange(optionValues, []);
    } else {
      onChange([], []);
    }
  };

  const optionsWithCheckbox = mergedOptions.map((opt) => {
    const optionValue = opt.value as string | number;

    return {
      ...opt,
      title: normalizeText(opt.label),
      label: (
        <div className="language-multi-option">
          <Checkbox
            className="language-multi-option-checkbox"
            checked={selectedValues.includes(optionValue)}
            disabled={!isRuntimeMultiSelect}
          />
          <span style={isRuntimeMultiSelect ? undefined : { marginLeft: 8 }}>
            {opt.label}
          </span>
        </div>
      ),
      value: optionValue,
    };
  });
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const dynamicMaxTagCount = useMaxTagCountForFormilyGrid(wrapperRef);
  const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
    isMultiple: true,
    isReadOnly: isPatternReadOnly,
    configuredMaxTagCount,
    configuredMaxTagPlaceholder,
    defaultMaxTagCount: dynamicMaxTagCount,
  });
  const maxTagCount = isPatternReadOnly
    ? readOnlyMultiSelectProps.maxTagCount
    : configuredMaxTagCount ?? (isDisabled ? undefined : dynamicMaxTagCount);
  const titleText = selectedValues
    .map((v) => {
      const opt = mergedOptions.find(
        (o) => o.value === v || String(o.value) === String(v),
      );
      const lbl = opt?.label;
      if (typeof lbl === "string" || typeof lbl === "number") {
        return String(lbl);
      }
      return v == null ? "" : String(v);
    })
    .filter(Boolean)
    .join(", ");
  return (
    <span
      ref={wrapperRef}
      style={{
        display: "inline-block",
        width: "100%",
        verticalAlign: "top",
      }}
      title={titleText}
      className="Formily-multi-select"
    >
      <AntdSelect
        {...selectProps}
        value={selectedValues}
        disabled={isDisabled}
        onChange={onChange}
        className={[
          selectProps.className,
          "LanguageSelect",
          isRuntimeMultiSelect ? "LanguageSelectMulti" : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
        dropdownClassName={[
          selectProps.dropdownClassName,
          "LanguageSelectdropdown",
          isRuntimeMultiSelect ? "LanguageSelectMultiDropdown" : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
        showArrow
        mode="multiple"
        maxTagCount={maxTagCount}
        options={optionsWithCheckbox}
        dropdownRender={(menu) => (
          <div>
            <div style={{ padding: "4px 8px" }}>
              <Checkbox
                className={
                  hasSelectedValues
                    ? "language-multi-select-all-checkbox language-multi-select-all-checkbox-has-selection"
                    : "language-multi-select-all-checkbox"
                }
                checked={allSelected}
                disabled={isDisabled || optionValues.length === 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              >
                {t("LanguageSelectMulti.selectAll")}
              </Checkbox>
            </div>
            <div>{menu}</div>
          </div>
        )}
        showSearch={selectProps.showSearch ?? true}
        optionFilterProp={selectProps.optionFilterProp ?? "title"}
        maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
        placeholder={resolvedPlaceholder}
        notFoundContent={
          selectProps.notFoundContent ?? t("LanguageSelectMulti.notFound")
        }
      />
    </span>
  );
};

export const LanguageSelectMulti = connect(
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
    return <PreviewText.Select {...props} />;
  }),
);

export default LanguageSelectMulti;
