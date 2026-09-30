/* eslint-disable @typescript-eslint/no-explicit-any -- Formily connect / designable Field props */
import type { ComponentProps } from "react";
import { Radio as FormilyRadio } from "@formily/antd";
import { connect, mapProps, mapReadPretty, observer } from "@formily/react";
import { PreviewText } from "@formily/antd";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import { buildBilingualComponentDefaults } from "@/components/designable/src/utils/bilingual";
import RadioGroupWithLayout from "./RadioGroupWithLayout";
import { resourceIcons } from "../../assets/resource-icons";

const RadioGroupInner = observer(RadioGroupWithLayout);

const ConnectedRadioGroup = connect(
  RadioGroupInner,
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
  mapReadPretty(PreviewText.Select),
);

export const Radio: DnFC<ComponentProps<typeof FormilyRadio>> =
  FormilyRadio as any;

(Radio as any).Group = ConnectedRadioGroup;

/** Typed export for SchemaField / designer component maps (`Radio.Group`). */
export const RadioGroupField = ConnectedRadioGroup;

Radio.Behavior = createBehavior({
  name: "Radio.Group",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "Radio.Group",
  designerProps(node) {
    return {
      defaultProps: buildBilingualComponentDefaults(node, {
        defaultTitleEn: i18n.t("SingleSelect.defaultTitle", { lng: "en" }),
        defaultTitleAr: i18n.t("SingleSelect.defaultTitle", { lng: "ar" }),
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
              placeholder: i18n.t("SingleSelect.designerPlaceholderTitle", {
                lng: "en",
              }),
            },
          },
          "x-component-props.titleAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("SingleSelect.designerPlaceholderTitle", {
                lng: "ar",
              }),
            },
          },
          "x-component-props": {
            type: "object",
            properties: {
              layout: {
                type: "string",
                "x-decorator": "FormItem",
                "x-component": "Select",
                "x-component-props": {
                  defaultValue: "horizontal",
                  options: [
                    {
                      label: i18n.t("SingleSelect.layoutHorizontal", {
                        lng: "en",
                      }),
                      value: "horizontal",
                    },
                    {
                      label: i18n.t("SingleSelect.layoutVertical", {
                        lng: "en",
                      }),
                      value: "vertical",
                    },
                  ],
                },
              },
            },
          },
          "x-decorator-props": {
            type: "object",
            properties: {
              tooltipEn: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": {
                  colon: false, label: " ",
                },
                "x-component-props": {
                  lang: 'en',
                },
                "x-component": "DescriptionRichTextSetter",
              },
              tooltipAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": {
                  colon: false, label: " ",
                },
                "x-component-props": {
                  lang: 'ar',
                },
                "x-component": "DescriptionRichTextSetter",
              },
            },
          },
          enum: {
            type: "array",
            "x-decorator": "FormItem",
            "x-component": "SingleSelectOptionsSetter",
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
  designerLocales: AllLocales.RadioGroup,
});

Radio.Resource = createResource({
  icon: resourceIcons.singleSelect,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "string",
        title: i18n.t("SingleSelect.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "Radio.Group",
        "x-component-props": {
          layout: "horizontal",
          titleEn: i18n.t("SingleSelect.defaultTitle", { lng: "en" }),
          titleAr: i18n.t("SingleSelect.defaultTitle", { lng: "ar" }),
        },
        enum: [
          {
            keyEn: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 1,
            }),
            keyAr: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 1,
            }),
            labelEn: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 1,
            }),
            labelAr: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 1,
            }),
            label: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 1,
            }),
            value: "Option 1",
          },
          {
            keyEn: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 2,
            }),
            keyAr: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 2,
            }),
            labelEn: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 2,
            }),
            labelAr: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "ar",
              num: 2,
            }),
            label: i18n.t("SingleSelectOptionsSetter.defaultOptionLabel", {
              lng: "en",
              num: 2,
            }),
            value: "Option 2",
          },
        ],
        default: "Option 1",
      },
    },
  ],
});
