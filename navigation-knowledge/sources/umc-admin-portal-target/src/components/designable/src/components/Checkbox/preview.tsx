/* eslint-disable @typescript-eslint/no-explicit-any -- Formily connect / designable Field props */
import type { ComponentProps } from "react";
import { Checkbox as FormilyCheckbox } from "@formily/antd";
import { connect, mapProps, observer } from "@formily/react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import { buildBilingualComponentDefaults } from "@/components/designable/src/utils/bilingual";
import CheckboxGroupWithLayout from "./CheckboxGroupWithLayout";
import { resourceIcons } from "../../assets/resource-icons";

const CheckboxGroupInner = observer(CheckboxGroupWithLayout);

const ConnectedCheckboxGroup = connect(
  CheckboxGroupInner,
  mapProps((props: Record<string, unknown>, field: any) => {
    const opts =
      props.options ??
      props.dataSource ??
      field?.dataSource ??
      field?.componentProps?.options;
    return {
      ...props,
      ...(opts != null ? { options: opts, dataSource: opts } : {}),
    };
  }),
);

export const Checkbox: DnFC<ComponentProps<typeof FormilyCheckbox>> =
  FormilyCheckbox as any;

(Checkbox as any).Group = ConnectedCheckboxGroup;

/** Typed export for SchemaField / designer component maps (`Checkbox.Group`). */
export const CheckboxGroupField = ConnectedCheckboxGroup;

Checkbox.Behavior = createBehavior({
  name: "Checkbox.Group",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "Checkbox.Group",
  designerProps(node) {
    return {
      defaultProps: buildBilingualComponentDefaults(node, {
        defaultTitleEn: i18n.t("MultiSelect.defaultTitle", { lng: "en" }),
        defaultTitleAr: i18n.t("MultiSelect.defaultTitle", { lng: "ar" }),
      }),
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
              placeholder: i18n.t("MultiSelect.designerPlaceholderTitle", {
                lng: "en",
              }),
            },
          },
          "x-component-props.titleAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("MultiSelect.designerPlaceholderTitle", {
                lng: "ar",
              }),
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
                  lang: "en",
                },
                "x-component": "DescriptionRichTextSetter",
              },
              tooltipAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component-props": {
                  lang: "ar",
                },
                "x-component": "DescriptionRichTextSetter",
              },
            },
          },
          enum: {
            type: "array",
            "x-decorator": "FormItem",
            "x-component-props": {
              showDescriptionSection: false,
            },
            "x-component": "MultiSelectOptionsSetter",
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
  designerLocales: AllLocales.CheckboxGroup,
});

Checkbox.Resource = createResource({
  icon: resourceIcons.multiSelect,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "Array<string | number>",
        title: i18n.t("MultiSelect.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "Checkbox.Group",
        "x-component-props": {
          titleEn: i18n.t("MultiSelect.defaultTitle", { lng: "en" }),
          titleAr: i18n.t("MultiSelect.defaultTitle", { lng: "ar" }),
        },
        enum: [
          {
            keyEn: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 1,
            }),
            keyAr: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 1,
            }),
            labelEn: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 1,
            }),
            labelAr: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 1,
            }),
            label: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 1,
            }),
            value: "Option 1",
          },
          {
            keyEn: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 2,
            }),
            keyAr: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 2,
            }),
            labelEn: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 2,
            }),
            labelAr: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 2,
            }),
            label: i18n.t("MultiSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 2,
            }),
            value: "Option 2",
          },
        ],
      },
    },
  ],
});
