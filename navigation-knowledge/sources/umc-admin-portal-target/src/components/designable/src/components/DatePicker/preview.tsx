import React, { forwardRef, useMemo } from "react";
import { DatePicker as FormilyDatePicker } from "@formily/antd";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { useField, useForm } from "@formily/react";
import moment from "moment";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  buildBilingualComponentDefaults,
  getBilingualValueByLang,
} from "@/components/designable/src/utils/bilingual";
import {
  mergeDisabledDateWithRestriction,
  type RestrictionSetterValue,
} from "@/components/designable/src/utils/dateRestriction";
import { resourceIcons } from "../../assets/resource-icons";

export const DATE_PICKER_DISPLAY_FORMAT = "DD/MM/YYYY";
export const DATE_PICKER_STORAGE_FORMAT = "YYYY-MM-DD";

function toPickerMoment(value: unknown) {
  if (moment.isMoment(value)) return value;
  if (typeof value !== "string" || !value) return value ?? null;

  const parsed = moment(
    value,
    [DATE_PICKER_STORAGE_FORMAT, DATE_PICKER_DISPLAY_FORMAT],
    true,
  );
  return parsed.isValid() ? parsed : null;
}

function toStorageDateValue(value: unknown) {
  if (moment.isMoment(value)) {
    return value.isValid() ? value.format(DATE_PICKER_STORAGE_FORMAT) : undefined;
  }
  return value ?? undefined;
}

function toPickerRangeValue(value: unknown) {
  if (!Array.isArray(value)) {
    return value ?? null;
  }

  const [start, end] = value;
  return [toPickerMoment(start), toPickerMoment(end)];
}

function toStorageRangeValue(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }

  const [start, end] = value.map((item) => toStorageDateValue(item));
  return start && end ? [start, end] : undefined;
}

type FormilyDatePickerProps = React.ComponentProps<typeof FormilyDatePicker>;
type DatePickerWithRestrictionProps = Omit<
  FormilyDatePickerProps,
  "value" | "onChange"
> & {
  restriction?: RestrictionSetterValue;
  placeholderEn?: string;
  placeholderAr?: string;
  value?: unknown;
  onChange?: (value: unknown, dateString: string | [string, string]) => void;
};
const FormilyDatePickerAny = FormilyDatePicker as any;

function getDesignerReadonlyProps(
  host: ReturnType<typeof useFormLanguageHost>,
  style: React.CSSProperties | undefined,
) {
  if (host !== "designer") {
    return {};
  }
  return {
    inputReadOnly: true,
    open: false,
    style: {
      ...style,
      pointerEvents: "none" as const,
    },
  };
}

function isNonEditablePattern(pattern: string | undefined) {
  return (
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty"
  );
}

const RestrictedDatePicker = forwardRef<any, DatePickerWithRestrictionProps>(
  (props, ref) => {
    const field = useField<any>();
    const form = useForm();
    const {
      restriction,
      disabledDate,
      placeholderEn,
      placeholderAr,
      style,
      value,
      onChange,
      ...rest
    } = props;
    const lang = useFormPreviewLang();
    const host = useFormLanguageHost();
    const designerReadonlyProps = getDesignerReadonlyProps(host, style);
    const isNonEditable =
      Boolean(rest.disabled) ||
      isNonEditablePattern(form.pattern) ||
      isNonEditablePattern(field.pattern);
    const resolvedPlaceholder =
      getBilingualValueByLang({
        lang,
        host,
        en: placeholderEn,
        ar: placeholderAr,
        fallback: host === "designer" ? "" : "Select date",
      }) || (host === "designer" ? "" : "Select date");
    const mergedDisabledDate = useMemo(
      () => mergeDisabledDateWithRestriction(restriction, disabledDate),
      [restriction, disabledDate],
    );
    const normalizedValue = useMemo(() => toPickerMoment(value), [value]);
    return (
      <FormilyDatePickerAny
        format={rest.format ?? DATE_PICKER_DISPLAY_FORMAT}
        ref={ref}
        {...rest}
        {...designerReadonlyProps}
        value={normalizedValue}
        disabled={isNonEditable || Boolean(rest.disabled)}
        inputReadOnly={
          isNonEditable ||
          Boolean(rest.inputReadOnly) ||
          Boolean((designerReadonlyProps as { inputReadOnly?: boolean }).inputReadOnly)
        }
        open={isNonEditable ? false : rest.open}
        disabledDate={mergedDisabledDate}
        placeholder={resolvedPlaceholder}
        onChange={(nextValue: unknown, dateString: string) =>
          onChange?.(toStorageDateValue(nextValue), dateString)
        }
      />
    );
  },
);

const RestrictedRangePicker = forwardRef<any, DatePickerWithRestrictionProps>(
  (props, ref) => {
    const field = useField<any>();
    const form = useForm();
    const {
      restriction,
      disabledDate,
      placeholderEn,
      placeholderAr,
      style,
      value,
      onChange,
      ...rest
    } = props;
    const lang = useFormPreviewLang();
    const host = useFormLanguageHost();
    const designerReadonlyProps = getDesignerReadonlyProps(host, style);
    const isNonEditable =
      Boolean(rest.disabled) ||
      isNonEditablePattern(form.pattern) ||
      isNonEditablePattern(field.pattern);
    const resolvedPlaceholder = useMemo((): [string, string] => {
      const raw =
        getBilingualValueByLang({
          lang,
          host,
          en: placeholderEn,
          ar: placeholderAr,
          fallback: host === "designer" ? "" : "Select date",
        }) || (host === "designer" ? "" : "Select date");
      if (raw.includes("，")) {
        const parts = raw.split("，");
        return [parts[0] ?? "", parts[1] ?? ""];
      }
      return [raw, raw];
    }, [host, lang, placeholderAr, placeholderEn]);
    const mergedDisabledDate = useMemo(
      () =>
        mergeDisabledDateWithRestriction(restriction, disabledDate, {
          allowTenDaysFromToday: false,
        }),
      [restriction, disabledDate],
    );
    const normalizedValue = useMemo(() => toPickerRangeValue(value), [value]);
    return (
      <FormilyDatePickerAny.RangePicker
        format={rest.format ?? DATE_PICKER_DISPLAY_FORMAT}
        ref={ref}
        {...rest}
        {...designerReadonlyProps}
        value={normalizedValue}
        disabled={isNonEditable || Boolean(rest.disabled)}
        inputReadOnly={
          isNonEditable ||
          Boolean(rest.inputReadOnly) ||
          Boolean((designerReadonlyProps as { inputReadOnly?: boolean }).inputReadOnly)
        }
        open={isNonEditable ? false : rest.open}
        disabledDate={mergedDisabledDate}
        placeholder={resolvedPlaceholder}
        onChange={(nextValue: unknown, dateStrings: [string, string]) =>
          onChange?.(toStorageRangeValue(nextValue), dateStrings)
        }
      />
    );
  },
);

function buildDatePickerDesignerProps(node: any) {
  const rawDecoratorProps = node?.props?.["x-decorator-props"];
  const decoratorProps =
    rawDecoratorProps && typeof rawDecoratorProps === "object" && !Array.isArray(rawDecoratorProps)
      ? rawDecoratorProps
      : {};
  return {
    defaultProps: {
      ...buildBilingualComponentDefaults(node, {
        defaultTitleEn: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "en" }),
        defaultTitleAr: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "ar" }),
        defaultPlaceholderEn: i18n.t("DatePicker.defaultPlaceholder", {
          lng: "en",
        }),
        defaultPlaceholderAr: i18n.t("DatePicker.defaultPlaceholder", {
          lng: "ar",
        }),
      }),
      "x-decorator-props": {
        ...decoratorProps,
        tooltipEn:
          typeof decoratorProps.tooltipEn === "string" ? decoratorProps.tooltipEn : "",
        tooltipAr:
          typeof decoratorProps.tooltipAr === "string" ? decoratorProps.tooltipAr : "",
      },
    },
    propsSchema: {
      type: "object",
      properties: {
        uniqueValue: {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "UniqueValueSetter",
        },
        "x-component-props.titleEn": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("DatePicker.designerPlaceholderTitle", { lng: "en" }),
          },
        },
        "x-component-props.titleAr": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("DatePicker.designerPlaceholderTitle", { lng: "ar" }),
          },
        },
        "x-decorator-props.tooltipEn": {
          type: "string",
          "x-decorator": "FormItem",
          "x-decorator-props": { colon: false, label: " " },
          "x-component": "DescriptionRichTextSetter",
          "x-component-props": {
            lang: "en",
          },
        },
        "x-decorator-props.tooltipAr": {
          type: "string",
          "x-decorator": "FormItem",
          "x-decorator-props": { colon: false, label: " " },
          "x-component-props": {
            lang: "ar",
          },
          "x-component": "DescriptionRichTextSetter",
        },
        "x-component-props.placeholderEn": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("DatePicker.designerPlaceholderInput", { lng: "en" }),
          },
        },
        "x-component-props.placeholderAr": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("DatePicker.designerPlaceholderInput", { lng: "ar" }),
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
        "x-component-props.restriction": {
          type: "object",
          "x-decorator": "FormItem",
          "x-component": "RestrictionSetter",
          "x-component-props": {
            showTenDaysFromToday:
              node?.props?.["x-component"] === "DatePicker",
          },
        },
      },
    },
  };
}

export const DatePicker = RestrictedDatePicker as typeof FormilyDatePicker &
  DnFC<DatePickerWithRestrictionProps>;

(DatePicker as any).RangePicker = RestrictedRangePicker;

DatePicker.Behavior = createBehavior(
  {
    name: "DatePicker",
    extends: ["Field"],
    selector: (node) => node.props?.["x-component"] === "DatePicker",
    designerProps: buildDatePickerDesignerProps,
    designerLocales: AllLocales.DatePicker,
  },
  {
    name: "DatePicker.RangePicker",
    extends: ["Field"],
    selector: (node) => node.props?.["x-component"] === "DatePicker.RangePicker",
    designerProps: buildDatePickerDesignerProps,
    designerLocales: AllLocales.DateRangePicker,
  }
);

DatePicker.Resource = createResource(
  {
    icon: resourceIcons.datePicker,
    elements: [
      {
        componentName: "Field",
        props: {
          type: "string",
          title: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "en" }),
          "x-decorator": "FormItem",
          "x-component": "DatePicker",
          "x-component-props": {
            titleEn: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "en" }),
            titleAr: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "ar" }),
            placeholderEn: i18n.t("DatePicker.defaultPlaceholder", { lng: "en" }),
            placeholderAr: i18n.t("DatePicker.defaultPlaceholder", { lng: "ar" }),
          },
        },
      },
    ],
  },
  {
    icon: resourceIcons.dateRange,
    elements: [
      {
        componentName: "Field",
        props: {
          type: "string[]",
          title: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "en" }),
          "x-decorator": "FormItem",
          "x-component": "DatePicker.RangePicker",
          "x-component-props": {
            titleEn: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "en" }),
            titleAr: i18n.t("DatePicker.defaultDatePickerTitle", { lng: "ar" }),
            placeholderEn: i18n.t("DatePicker.defaultPlaceholder", { lng: "en" }),
            placeholderAr: i18n.t("DatePicker.defaultPlaceholder", { lng: "ar" }),
          },
        },
      },
    ],
  }
);
