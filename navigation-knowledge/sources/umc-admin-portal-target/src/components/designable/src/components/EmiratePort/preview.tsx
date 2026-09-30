import React from "react";
import { EmiratePort as EmiratePortComponent } from "./EmiratePort";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import {
  buildBilingualComponentDefaults,
} from "@/components/designable/src/utils/bilingual";

export const EmiratePort: DnFC<React.ComponentProps<typeof EmiratePortComponent>> =
  EmiratePortComponent;

EmiratePort.Behavior = createBehavior({
  name: "EmiratePort",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "EmiratePort",
  designerProps(node) {
    return {
      defaultProps: buildBilingualComponentDefaults(node, {
        defaultTitleEn: i18n.t("EmiratePort.defaultTitle", { lng: "en" }),
        defaultTitleAr: i18n.t("EmiratePort.defaultTitle", { lng: "ar" }),
        defaultPlaceholderEn: i18n.t("EmiratePort.defaultPlaceholder", { lng: "en" }),
        defaultPlaceholderAr: i18n.t("EmiratePort.defaultPlaceholder", { lng: "ar" }),
      }),
      propsSchema: {
        type: "object",
        properties: {
          uniqueValue: {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "UniqueValueSetter",
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
          "x-component-props.placeholderEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("EmiratePort.designerPlaceholderInput", { lng: "en" }),
            },
          },
          "x-component-props.placeholderAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("EmiratePort.designerPlaceholderInput", { lng: "ar" }),
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
  designerLocales: AllLocales.EmiratePort,
});

EmiratePort.Resource = createResource({
  icon: resourceIcons.emiratePort,
  elements: [
    {
      componentName: "Field",
      props: {
        title: i18n.t("EmiratePort.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "EmiratePort",
        "x-component-props": {
          placeholderEn: i18n.t("EmiratePort.defaultPlaceholder", { lng: "en" }),
          placeholderAr: i18n.t("EmiratePort.defaultPlaceholder", { lng: "ar" }),
        },
      },
    },
  ],
});

export default EmiratePort;
