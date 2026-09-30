/* eslint-disable @typescript-eslint/no-explicit-any -- Formily connect / field props */
import React, { useEffect, useMemo, useState } from "react";

import { Checkbox, Select as AntdSelect } from "antd";
import type { SelectProps } from "antd/es/select";
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
import {
  getArtistWorkTypesByServiceCode,
  getLookupData,
} from "@/services/services";
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
import { useServicesStore } from "@/store/services";
import { extractLookupItems } from "@/utils/lookupOptions";
import {
  getReadOnlyMultiSelectProps,
  isNonEditablePattern,
} from "@/components/designable/src/utils/readOnlyMultiSelect";

interface SelectInternalProps {
  value?: any;
  onChange?: (value: any) => void;
  dataSource?: any[];
  Source?: string;
  [key: string]: any;
}

type SelectOption = Record<string, unknown> & {
  label?: string;
  value: string | number;
  labelEn?: string;
  labelAr?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLookupSelectOptions(input: unknown): SelectOption[] {
  return extractLookupItems(input).reduce<SelectOption[]>((result, item) => {
    const value = item.Id ?? item.value ?? item.id;
    if (value === undefined || value === null) {
      return result;
    }

    const labelEn = normalizeText(
      item.NameEn ?? item.nameEn ?? item.labelEn ?? item.label ?? item.name,
    );
    const labelAr = normalizeText(item.NameAr ?? item.nameAr);
    const fallbackLabel = labelEn || labelAr || normalizeText(value);

    result.push({
      ...item,
      label: fallbackLabel,
      labelEn: labelEn || fallbackLabel,
      labelAr: labelAr || labelEn || fallbackLabel,
      value,
    });
    return result;
  }, []);
}

function normalizeArtistWorkTypeOptions(input: unknown): SelectOption[] {
  return extractLookupItems(input).reduce<SelectOption[]>((result, item) => {
    const labelEn = normalizeText(item.NameEn ?? item.nameEn);
    const labelAr = normalizeText(item.NameAr ?? item.nameAr);
    const value = item.Id ?? item.id ?? item.value ?? labelEn ?? labelAr;
    const fallbackLabel = labelEn || labelAr || normalizeText(value);

    if (!fallbackLabel || value === undefined || value === null) {
      return result;
    }

    result.push({
      ...item,
      label: fallbackLabel,
      labelEn: labelEn || fallbackLabel,
      labelAr: labelAr || labelEn || fallbackLabel,
      value,
    });
    return result;
  }, []);
}

function useSelectItems(
  dataSource: unknown,
  Source: string | undefined,
  serviceCode: string | number | null | undefined,
) {
  const [remoteItems, setRemoteItems] = useState<SelectOption[]>([]);
  const isArtistWorkTypeSource = Source === "ArtistWorkTypes";
  const localItems = useMemo(
    () => (Array.isArray(dataSource) ? (dataSource as SelectOption[]) : []),
    [dataSource],
  );

  useEffect(() => {
    if (!Source) {
      setRemoteItems([]);
      return;
    }

    let cancelled = false;
    const loadOptions = async () => {
      try {
        if (isArtistWorkTypeSource) {
          const res = await getArtistWorkTypesByServiceCode(serviceCode);
          if (!cancelled) {
            setRemoteItems(normalizeArtistWorkTypeOptions(res));
          }
          return;
        }

        const res = await getLookupData(Source);
        if (!cancelled) {
          setRemoteItems(normalizeLookupSelectOptions(res));
        }
      } catch (error) {
        console.error("[Designable Select] failed to load select options", error);
        if (!cancelled) {
          setRemoteItems([]);
        }
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [Source, isArtistWorkTypeSource, serviceCode]);

  return Source
    ? remoteItems.length > 0
      ? remoteItems
      : localItems
    : localItems;
}

function resolveSelectOptionValue(
  targetValue: unknown,
  items: SelectOption[],
): unknown {
  const matchedItem = items.find((item) => {
    return item.value === targetValue || String(item.value) === String(targetValue);
  });

  return matchedItem ? matchedItem.value : targetValue;
}

function normalizeSelectValueByItems(value: unknown, items: SelectOption[]) {
  if (Array.isArray(value)) {
    return value.map((item) => resolveSelectOptionValue(item, items));
  }

  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return {
      ...(value as Record<string, unknown>),
      value: resolveSelectOptionValue(
        (value as Record<string, unknown>).value,
        items,
      ),
    };
  }

  return resolveSelectOptionValue(value, items);
}

const SelectInternalBase: React.FC<SelectInternalProps> = ({
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
  const serviceCode = useServicesStore((state) => state.userInfo.servicesCode);
  const items = useSelectItems(dataSource, Source, serviceCode);
  const normalizedValue = useMemo(
    () => normalizeSelectValueByItems(value, items),
    [items, value],
  );
  const normalizedProps = normalizeBilingualComponentProps(props, {
    lang,
    host,
    placeholderFallback: "",
  });
  const {
    title: _omitTitleProp,
    options: rawOptionsProp,
    maxTagCount: configuredMaxTagCount,
    maxTagPlaceholder: configuredMaxTagPlaceholder,
    ...baseSelectComponentProps
  } = normalizedProps as Record<string, unknown> & {
    title?: unknown;
    options?: unknown;
    maxTagCount?: SelectProps<unknown, any>["maxTagCount"];
    maxTagPlaceholder?: SelectProps<unknown, any>["maxTagPlaceholder"];
  };
  void _omitTitleProp;
  const selectComponentProps =
    Source || rawOptionsProp === undefined
      ? baseSelectComponentProps
      : { ...baseSelectComponentProps, options: rawOptionsProp };
  const selectRuntimeProps = selectComponentProps as Record<string, any>;
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
    Boolean(selectComponentProps.disabled) ||
    Boolean(selectComponentProps.readOnly) ||
    isPatternReadOnly;
  const isMultiple =
    selectRuntimeProps.mode === "multiple" ||
    selectRuntimeProps.mode === "tags";
  const isRuntimeMultiple =
    selectRuntimeProps.mode === "multiple" && field?.designable === false;
  const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
    isMultiple,
    isReadOnly: isPatternReadOnly,
    configuredMaxTagCount,
    configuredMaxTagPlaceholder,
  });
  const lockedSelectProps = {
    ...selectComponentProps,
    disabled: isNonEditable,
    open: isNonEditable ? false : controlledOpen,
    showSearch: isNonEditable ? false : controlledShowSearch,
    maxTagCount: readOnlyMultiSelectProps.maxTagCount,
    maxTagPlaceholder: readOnlyMultiSelectProps.maxTagPlaceholder,
  };

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
      en: typeof item.descriptionEn === "string" ? item.descriptionEn : undefined,
      ar: typeof item.descriptionAr === "string" ? item.descriptionAr : undefined,
      legacy: typeof item.description === "string" ? item.description : undefined,
      fallback: "",
    });

  const hasDescriptions = items.some(
    (item: Record<string, unknown>) =>
      Boolean(item.showDescription) && resolveDescription(item) !== "",
  );
  const selectedValues: Array<string | number> = Array.isArray(normalizedValue)
    ? normalizedValue.filter(
        (item): item is string | number =>
          typeof item === "string" || typeof item === "number",
      )
    : typeof normalizedValue === "string" || typeof normalizedValue === "number"
    ? [normalizedValue]
    : [];
  const optionValues = items
    .map((item) => item.value)
    .filter(
      (item): item is string | number =>
        typeof item === "string" || typeof item === "number",
    );
  const allSelected =
    optionValues.length > 0 &&
    optionValues.every((optionValue) => selectedValues.includes(optionValue));
  const hasSelectedValues = optionValues.some((optionValue) =>
    selectedValues.includes(optionValue),
  );
  const selectClassName = [
    typeof lockedSelectProps.className === "string"
      ? lockedSelectProps.className
      : "",
    isRuntimeMultiple ? "designable-select-runtime-multi" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const dropdownClassName = [
    typeof lockedSelectProps.dropdownClassName === "string"
      ? lockedSelectProps.dropdownClassName
      : "",
    isRuntimeMultiple ? "designable-select-runtime-multi-dropdown" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const handleSelectAll = (checked: boolean) => {
    if (isNonEditable || !onChange || optionValues.length === 0) return;
    onChange(checked ? optionValues : []);
  };
  const renderSelectionContent = (label: React.ReactNode) => (
    <div className="designable-select-runtime-multi-selection-item">
      <Checkbox checked />
      <span>{label}</span>
    </div>
  );
  const renderOptionContent = (
    label: React.ReactNode,
    optionValue: string | number,
    description?: React.ReactNode,
  ) => (
    <div
      className={
        description
          ? "designable-select-runtime-multi-option designable-select-runtime-multi-option-with-desc"
          : "designable-select-runtime-multi-option"
      }
    >
      <Checkbox checked={selectedValues.includes(optionValue)} />
      {description ? (
        <div className="select-option-with-desc">
          <div className="select-option-title">{label}</div>
          <div className="select-option-desc">{description}</div>
        </div>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
  const renderDropdown = (menu: React.ReactNode) => {
    const renderedMenu =
      typeof lockedSelectProps.dropdownRender === "function"
        ? lockedSelectProps.dropdownRender(menu)
        : menu;

    return (
      <div>
        <div className="designable-select-runtime-multi-select-all">
          <Checkbox
            className={
              hasSelectedValues && !allSelected
                ? "designable-select-runtime-multi-select-all-checkbox has-selection"
                : "designable-select-runtime-multi-select-all-checkbox"
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

  if (!hasDescriptions) {
    return (
      <AntdSelect
        value={normalizedValue}
        onChange={onChange}
        options={items.map((item) => ({
          label: isRuntimeMultiple
            ? renderOptionContent(
                resolveLabel(item as Record<string, unknown>),
                (item as { value: string | number }).value,
              )
            : resolveLabel(item as Record<string, unknown>),
          title: resolveLabel(item as Record<string, unknown>),
          value: (item as { value: unknown }).value,
        }))}
        {...lockedSelectProps}
        className={selectClassName || undefined}
        dropdownClassName={dropdownClassName || undefined}
        dropdownRender={
          isRuntimeMultiple ? renderDropdown : lockedSelectProps.dropdownRender
        }
        optionFilterProp={
          isRuntimeMultiple ? "title" : lockedSelectProps.optionFilterProp
        }
      />
    );
  }

  return (
    <AntdSelect
      value={normalizedValue}
      onChange={onChange}
      optionLabelProp="label"
      listHeight={300}
      {...lockedSelectProps}
      className={selectClassName || undefined}
      dropdownClassName={dropdownClassName || undefined}
      dropdownRender={
        isRuntimeMultiple ? renderDropdown : lockedSelectProps.dropdownRender
      }
      optionFilterProp={
        isRuntimeMultiple ? "title" : lockedSelectProps.optionFilterProp
      }
    >
      {items.map((item: Record<string, unknown>) => {
        const v = (item as { value: unknown }).value;
        const textLabel = resolveLabel(item);
        const textDesc = resolveDescription(item);
        return (
          <AntdSelect.Option
            key={String(v)}
            value={v as any}
            label={
              isRuntimeMultiple
                ? renderSelectionContent(textLabel)
                : textLabel
            }
            title={textLabel}
          >
            {isRuntimeMultiple ? (
              renderOptionContent(
                textLabel,
                v as string | number,
                item.showDescription && textDesc ? textDesc : undefined,
              )
            ) : item.showDescription && textDesc ? (
              <div className="select-option-with-desc">
                <div className="select-option-title">{textLabel}</div>
                <div className="select-option-desc">{textDesc}</div>
              </div>
            ) : (
              textLabel
            )}
          </AntdSelect.Option>
        );
      })}
    </AntdSelect>
  );
};

const SelectInternal = observer(SelectInternalBase);

const SelectReadPretty = observer((props: SelectInternalProps) => {
  const field = useField<any>();
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const serviceCode = useServicesStore((state) => state.userInfo.servicesCode);
  const items = useSelectItems(
    props.dataSource ?? field?.dataSource,
    props.Source,
    serviceCode,
  );
  const normalizedValue = useMemo(
    () => normalizeSelectValueByItems(props.value, items),
    [items, props.value],
  );

  const previewProps = { ...props } as Record<string, unknown>;
  delete previewProps.dataSource;
  delete previewProps.Source;
  const selectedValues = Array.isArray(normalizedValue)
    ? normalizedValue
    : [normalizedValue];
  const displayValue = selectedValues
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => {
      const normalizedItem = items.find(
        (item) => String(item.value) === String(value),
      );

      if (!normalizedItem) {
        return String(value);
      }

      return (
        getBilingualValueByLang({
          lang,
          host,
          en:
            typeof normalizedItem.labelEn === "string"
              ? normalizedItem.labelEn
              : undefined,
          ar:
            typeof normalizedItem.labelAr === "string"
              ? normalizedItem.labelAr
              : undefined,
          legacy:
            typeof normalizedItem.label === "string"
              ? normalizedItem.label
              : undefined,
          fallback: "",
        }) || String(value)
      );
    })
    .join(", ");

  return (
    <PreviewText.Input
      {...previewProps}
      value={displayValue}
    />
  );
});

const FormilyCustomSelect = connect(
  SelectInternal,
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
  mapReadPretty(SelectReadPretty),
);

export const Select: DnFC<React.ComponentProps<typeof AntdSelect>> =
  FormilyCustomSelect as any;

Select.Behavior = createBehavior({
  name: "Select",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "Select",
  designerProps(node) {
    return {
      defaultProps: buildBilingualComponentDefaults(node, {
        defaultTitleEn: i18n.t("Select.defaultTitle", { lng: "en" }),
        defaultTitleAr: i18n.t("Select.defaultTitle", { lng: "ar" }),
        defaultPlaceholderEn: i18n.t("Select.defaultPlaceholder", { lng: "en" }),
        defaultPlaceholderAr: i18n.t("Select.defaultPlaceholder", { lng: "ar" }),
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
              placeholder: i18n.t("Select.designerPlaceholderTitle", { lng: "en" }),
            },
          },
          "x-component-props.titleAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("Select.designerPlaceholderTitle", { lng: "ar" }),
            },
          },
          "x-decorator-props": {
            type: "object",
            properties: {
              tooltipEn: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component-props": {
                  lang: 'en',
                },
                "x-component": "DescriptionRichTextSetter",
              },
              tooltipAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component-props": {
                  lang: 'ar',
                },
                "x-component": "DescriptionRichTextSetter",
              },
            },
          },
          "x-component-props.placeholderEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("Select.designerPlaceholderInput", { lng: "en" }),
            },
          },
          "x-component-props.placeholderAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("Select.designerPlaceholderInput", { lng: "ar" }),
            },
          },
          enum: {
            type: "array",
            "x-decorator": "FormItem",
            "x-component": "SelectOptionsSetter",
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
  designerLocales: AllLocales.Select,
});

Select.Resource = createResource({
  icon: resourceIcons.singleDropdown,
  elements: [
    {
      componentName: "Field",
      props: {
        title: i18n.t("Select.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "Select",
        "x-component-props": {
          titleEn: i18n.t("Select.defaultTitle", { lng: "en" }),
          titleAr: i18n.t("Select.defaultTitle", { lng: "ar" }),
          placeholderEn: i18n.t("Select.defaultPlaceholder", { lng: "en" }),
          placeholderAr: i18n.t("Select.defaultPlaceholder", { lng: "ar" }),
        },
      },
    },
  ],
});
