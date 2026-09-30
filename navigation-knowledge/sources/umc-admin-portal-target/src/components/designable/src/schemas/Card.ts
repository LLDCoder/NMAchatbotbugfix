import type { ISchema } from "@formily/react";
import i18n from "@/localization/config";

export const Card: ISchema & { Addition?: ISchema } = {
  type: "object",
  properties: {
    "field-group": {
      type: "void",
      "x-component": "CollapseItem",
      properties: {
        "x-component-props": {
          type: "object",
          properties: {
            titleEn: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                maxLength: 200,
              },
            },
            titleAr: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                maxLength: 200,
              },
            },
          },
        },
        /** Mirror targets for x-reactions (Formily requires fields to exist). Card reads descTooltip* from component props. */
        "x-component-props.descTooltipEn": {
          type: "string",
          "x-hidden": true,
        },
        "x-component-props.descTooltipAr": {
          type: "string",
          "x-hidden": true,
        },
        "x-decorator-props.tooltipEn": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component-props": {
            lang: "en",
            placeholder: i18n.t("Input.designerPlaceholderTooltipEn", {
              lng: "en",
            }),
          },
          "x-reactions": {
            dependencies: ["x-decorator-props.tooltipEn"],
            target: "x-component-props.descTooltipEn",
            fulfill: {
              state: {
                value: "{{$deps[0]}}",
              },
            },
          },
          "x-decorator-props": { colon: false, label: " " },
          "x-component": "DescriptionRichTextSetter",
        },
        "x-decorator-props.tooltipAr": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component-props": {
            lang: "ar",
            placeholder: i18n.t("Input.designerPlaceholderTooltipAr", {
              lng: "ar",
            }),
          },
          "x-reactions": {
            dependencies: ["x-decorator-props.tooltipAr"],
            target: "x-component-props.descTooltipAr",
            fulfill: {
              state: {
                value: "{{$deps[0]}}",
              },
            },
          },
          "x-decorator-props": { colon: false, label: " " },
          "x-component": "DescriptionRichTextSetter",
        },

        "x-display": {
          type: "boolean",
          "x-decorator": "FormItem",
          "x-component": "StringSwitchSetter",
          default: "visible",
          "x-component-props": {
            checkedValue: "visible",
            unCheckedValue: "none",
          },
        },
      },
    },
  },
};
