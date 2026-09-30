/* eslint-disable @typescript-eslint/no-explicit-any -- Formily connect / field props */
import React, { useMemo, useEffect, useState, useRef } from "react";

import { Checkbox, Select as AntdSelect, type SelectProps } from "antd";
import {
  connect,
  mapProps,
  mapReadPretty,
  observer,
  useField,
  useForm,
} from "@formily/react";
import { PreviewText } from "@formily/antd";
import { LoadingOutlined } from "@ant-design/icons";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import { resourceIcons } from "../../assets/resource-icons";
import "./preview.less";
import { getLookupData } from "@/services/services";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  buildBilingualComponentDefaults,
  getBilingualValueByLang,
  normalizeBilingualComponentProps,
} from "@/components/designable/src/utils/bilingual";
import { useMaxTagCountForFormilyGrid } from "@/components/designable/src/utils/useMaxTagCountForFormilyGrid";
import {
  getReadOnlyMultiSelectProps,
  isNonEditablePattern,
} from "@/components/designable/src/utils/readOnlyMultiSelect";

interface MultiDropdownInternalProps {
  value?: any;
  onChange?: (value: any) => void;
  dataSource?: any[];
  Source?: string;
  [key: string]: any;
}

const MultiDropdownInternalBase: React.FC<MultiDropdownInternalProps> = ({
  dataSource,
  value,
  Source,
  onChange,
  ...props
}) => {
  const field = useField<any>();
  const form = useForm();
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const [remoteItems, setRemoteItems] = useState<Record<string, unknown>[]>(
    [],
  );
  useEffect(() => {
    if (!Source) {
      setRemoteItems([]);
      return;
    }
    let cancelled = false;
    getLookupData(Source)
      .then((res: { data?: unknown }) => {
        const raw = res?.data;
        const arr = Array.isArray(raw) ? raw : [];
        if (cancelled) return;
        setRemoteItems(
          arr.map((row: { NameEn?: string; NameAr?: string; Id?: unknown }) => ({
            labelEn: row?.NameEn,
            labelAr:
              typeof row?.NameAr === "string" && row.NameAr !== ""
                ? row.NameAr
                : row?.NameEn,
            label: row?.NameEn ?? "",
            value: row?.Id,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setRemoteItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [Source]);

  const items = Source
    ? remoteItems
    : Array.isArray(dataSource)
      ? dataSource
      : [];
  const normalizedProps = normalizeBilingualComponentProps(props, {
    lang,
    host,
    placeholderFallback: "",
  });
  const {
    title: _omitTitleProp,
    maxTagCount: configuredMaxTagCount,
    maxTagPlaceholder: configuredMaxTagPlaceholder,
    ...selectRestNormalized
  } = normalizedProps as Record<string, unknown> & { title?: unknown };
  void _omitTitleProp;
  const selectRuntimeProps = selectRestNormalized as Record<string, any>;
  const controlledOpen =
    typeof selectRuntimeProps.open === "boolean"
      ? selectRuntimeProps.open
      : undefined;
  const controlledShowSearch =
    typeof selectRuntimeProps.showSearch === "boolean"
      ? selectRuntimeProps.showSearch
      : undefined;
  const isPatternReadOnly =
    isNonEditablePattern(form.pattern) ||
    isNonEditablePattern(field.pattern);
  const isNonEditable =
    Boolean(selectRestNormalized.disabled) ||
    Boolean(selectRestNormalized.readOnly) ||
    isPatternReadOnly;
  const isRuntimeMultiSelect = field?.designable === false;

  const resolveLabel = (item: Record<string, unknown>) =>
    getBilingualValueByLang({
      lang,
      host,
      en: typeof item.labelEn === "string" ? item.labelEn : undefined,
      ar: typeof item.labelAr === "string" ? item.labelAr : undefined,
      legacy: typeof item.label === "string" ? item.label : undefined,
      fallback: "",
    }) || (typeof item.label === "string" ? item.label : "");

  const resolveDescription = (item: Record<string, unknown>) =>
    getBilingualValueByLang({
      lang,
      host,
      en:
        typeof item.descriptionEn === "string"
          ? item.descriptionEn
          : undefined,
      ar:
        typeof item.descriptionAr === "string"
          ? item.descriptionAr
          : undefined,
      legacy:
        typeof item.description === "string" ? item.description : undefined,
      fallback: "",
    });

  const hasDescriptions = items.some(
    (item: Record<string, unknown>) =>
      Boolean(item.showDescription) && resolveDescription(item) !== "",
  );
  const selectedValues: Array<string | number> = Array.isArray(value)
    ? value.filter(
        (item): item is string | number =>
          typeof item === "string" || typeof item === "number",
      )
    : typeof value === "string" || typeof value === "number"
    ? [value]
    : [];
  const optionValues = items
    .map((item) => (item as Record<string, unknown>).value)
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

  const handleSelectAll = (checked: boolean) => {
    if (isNonEditable || !onChange) return;
    onChange(checked ? optionValues : []);
  };

  const multiProps = {
    mode: "multiple" as const,
    ...selectRestNormalized,
    disabled: isNonEditable,
    open: isNonEditable ? false : controlledOpen,
    showSearch: isNonEditable ? false : controlledShowSearch,
  };
  const selectClassName = [
    "MultiDropdown",
    isRuntimeMultiSelect ? "MultiDropdownRuntimeMulti" : "",
    typeof selectRuntimeProps.className === "string"
      ? selectRuntimeProps.className
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const dropdownClassName = [
    "MultiDropdowndropdown",
    isRuntimeMultiSelect ? "MultiDropdownRuntimeMultiDropdown" : "",
    typeof selectRuntimeProps.dropdownClassName === "string"
      ? selectRuntimeProps.dropdownClassName
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const renderOptionContent = (item: Record<string, unknown>) => {
    const optionValue = item.value;
    const isSelected =
      (typeof optionValue === "string" || typeof optionValue === "number") &&
      selectedValues.includes(optionValue);
    const textLabel = resolveLabel(item);
    const textDesc = resolveDescription(item);
    const showDescription = Boolean(item.showDescription) && textDesc !== "";

    return (
      <div
        className={
          showDescription
            ? "multi-dropdown-option multi-dropdown-option-with-desc"
            : "multi-dropdown-option"
        }
      >
        <Checkbox
          className="multi-dropdown-option-checkbox"
          checked={isSelected}
          disabled={!isRuntimeMultiSelect}
        />
        {showDescription ? (
          <div className="select-option-with-desc">
            <div className="select-option-title">{textLabel}</div>
            <div className="select-option-desc">{textDesc}</div>
          </div>
        ) : (
          <span>{textLabel}</span>
        )}
      </div>
    );
  };
  const renderSelectionContent = (label: React.ReactNode) => (
    <div className="multi-dropdown-selection-item">
      <Checkbox checked />
      <span>{label}</span>
    </div>
  );
  const renderDropdown = (menu: React.ReactNode) => {
    const customDropdownRender = selectRuntimeProps.dropdownRender;
    const renderedMenu =
      typeof customDropdownRender === "function"
        ? customDropdownRender(menu)
        : menu;

    return (
      <div>
        <div className="multi-dropdown-select-all">
          <Checkbox
            className={
              hasSelectedValues
                ? "multi-dropdown-select-all-checkbox multi-dropdown-select-all-checkbox-has-selection"
                : "multi-dropdown-select-all-checkbox"
            }
            checked={allSelected}
            disabled={isNonEditable || optionValues.length === 0}
            onChange={(event) => handleSelectAll(event.target.checked)}
          >
            {i18n.t("LanguageSelectMulti.selectAll", { lng: lang })}
          </Checkbox>
        </div>
        <div>{renderedMenu}</div>
      </div>
    );
  };

  const titleText = useMemo(() => {
    const list =
      Source && Array.isArray(remoteItems) && remoteItems.length > 0
        ? remoteItems
        : Array.isArray(dataSource)
          ? dataSource
          : [];
    const vals = Array.isArray(value)
      ? value
      : value != null && value !== ""
        ? [value]
        : [];
    if (!vals.length) return "";
    return vals
      .map((v) => {
        const opt = list.find((o: Record<string, unknown>) => {
          const key = o.value as unknown;
          return v === key || String(v) === String(key);
        });
        const lbl = opt ? resolveLabel(opt) : "";
        return lbl || (v == null ? "" : String(v));
      })
      .filter(Boolean)
      .join(", ");
  }, [value, dataSource, Source, remoteItems, lang, host]);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const dynamicMaxTagCount = useMaxTagCountForFormilyGrid(wrapperRef);
  const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
    isMultiple: true,
    isReadOnly: isPatternReadOnly,
    configuredMaxTagCount: configuredMaxTagCount as SelectProps<unknown>["maxTagCount"],
    configuredMaxTagPlaceholder: configuredMaxTagPlaceholder as SelectProps<unknown>["maxTagPlaceholder"],
    defaultMaxTagCount: dynamicMaxTagCount,
  });
  const maxTagCount = isPatternReadOnly
    ? readOnlyMultiSelectProps.maxTagCount
    : (configuredMaxTagCount as SelectProps<unknown>["maxTagCount"]) ??
      (isNonEditable ? undefined : dynamicMaxTagCount);

  return (
    <span
      ref={wrapperRef}
      style={{ display: "inline-block", width: "100%", verticalAlign: "top" }}
      title={titleText}
      className="Formily-multi-select"
    >
      <AntdSelect
        {...multiProps}
        value={selectedValues}
        onChange={onChange}
        optionLabelProp="label"
        maxTagCount={maxTagCount}
        maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
        showArrow={true}
        listHeight={hasDescriptions ? 300 : undefined}
        className={selectClassName}
        dropdownClassName={dropdownClassName}
        dropdownRender={renderDropdown}
      >
        {items.map((item: Record<string, unknown>) => {
          const v = (item as { value: unknown }).value;
          const textLabel = resolveLabel(item);
          return (
            <AntdSelect.Option
              key={String(v)}
              value={v as any}
              label={
                isRuntimeMultiSelect
                  ? renderSelectionContent(textLabel)
                  : textLabel
              }
              title={textLabel}
            >
              {renderOptionContent(item)}
            </AntdSelect.Option>
          );
        })}
      </AntdSelect>
    </span>
  );
};

const MultiDropdownInternal = observer(MultiDropdownInternalBase);

const FormilyCustomMultiDropdown = connect(
  MultiDropdownInternal,
  mapProps({ loading: true }, (props, field) => {
    return {
      ...props,
      dataSource: (field as any)?.dataSource,
      suffixIcon:
        (field as any)?.["loading"] || (field as any)?.["validating"] ? (
          <LoadingOutlined />
        ) : (
          props.suffixIcon
        ),
    };
  }),
  mapReadPretty(PreviewText.Select),
);

export const MultiDropdown: DnFC<React.ComponentProps<typeof AntdSelect>> =
  FormilyCustomMultiDropdown as any;

MultiDropdown.Behavior = createBehavior({
  name: "MultiDropdown",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "MultiDropdown",
  designerProps(node) {
    return {
      defaultProps: buildBilingualComponentDefaults(node, {
        defaultTitleEn: i18n.t("MultiDropdown.defaultTitle", { lng: "en" }),
        defaultTitleAr: i18n.t("MultiDropdown.defaultTitle", { lng: "ar" }),
        defaultPlaceholderEn: i18n.t("MultiDropdown.defaultPlaceholder", {
          lng: "en",
        }),
        defaultPlaceholderAr: i18n.t("MultiDropdown.defaultPlaceholder", {
          lng: "ar",
        }),
      }),
      propsSchema: {
        type: "object",
        properties: {
          uniqueValue: {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "UniqueValueSetter",
          },
          "x-component-props.Source": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "OptionsSourceSetter",
          },
          "x-component-props.titleEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              lang:'en',
              placeholder: i18n.t("MultiDropdown.designerPlaceholderTitle", { lng: "en" }),
            },
          },
          "x-component-props.titleAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              lang:'ar',
              placeholder: i18n.t("MultiDropdown.designerPlaceholderTitle", { lng: "ar" }),
            },
          },
          "x-decorator-props": {
            type: "object",
            properties: {
              tooltipEn: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component": "DescriptionRichTextSetter",
              },
              tooltipAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component": "DescriptionRichTextSetter",
              },
            },
          },
          "x-component-props.placeholderEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("MultiDropdown.designerPlaceholderInput", { lng: "en" }),
            },
          },
          "x-component-props.placeholderAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("MultiDropdown.designerPlaceholderInput", { lng: "ar" }),
            },
          },
          enum: {
            type: "array",
            "x-decorator": "FormItem",
            "x-component": "MultiSelectOptionsSetter",
            "x-reactions": {
              dependencies: ["x-component-props.Source"],
              fulfill: {
                state: { disabled: "{{!!$deps[0]}}" },
              },
            },
          },
          "x-decorator-props.style": {
            type: "void",
            properties: {
              "style.width": {
                type: "string",
                "x-decorator": "FormItem",
                "x-component": "FieldWidthSetter",
              },
            },
          },
          required: {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "Switch",
          },
          "x-display": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "StringSwitchSetter",
            default: "visible",
            "x-component-props": {
              checkedValue: "visible",
              unCheckedValue: "none",
            },
          },
          "x-pattern": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "StringSwitchSetter",
            default: "editable",
            "x-component-props": {
              checkedValue: "editable",
              unCheckedValue: "readOnly",
            },
          },
        },
      },
    };
  },
  designerLocales: AllLocales.MultiDropdown,
});

MultiDropdown.Resource = createResource({
  icon: resourceIcons.multipleDropdown,
  elements: [
    {
      componentName: "Field",
      props: {
        title: i18n.t("MultiDropdown.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "MultiDropdown",
        "x-component-props": {
          titleEn: i18n.t("MultiDropdown.defaultTitle", { lng: "en" }),
          titleAr: i18n.t("MultiDropdown.defaultTitle", { lng: "ar" }),
          placeholderEn: i18n.t("MultiDropdown.defaultPlaceholder", { lng: "en" }),
          placeholderAr: i18n.t("MultiDropdown.defaultPlaceholder", { lng: "ar" }),
        },
      },
    },
  ],
});
