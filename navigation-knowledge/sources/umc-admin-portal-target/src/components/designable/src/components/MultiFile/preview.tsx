import * as React from "react";
import MultiFileDom from "./MultiFile";
import DocumentViewer from "../../../../common/DocumentViewer/index";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import { buildBilingualComponentDefaults } from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

function buildMultiFileDesignerProps(node: unknown) {
  return {
    defaultProps: buildBilingualComponentDefaults(node, {
      defaultTitleEn: i18n.t("MultiFile.defaultTitle", { lng: "en" }),
      defaultTitleAr: i18n.t("MultiFile.defaultTitle", { lng: "ar" }),
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
            lang: "en",
            placeholder: i18n.t("MultiFile.designerPlaceholderTitle", {
              lng: "en",
            }),
          },
        },
        "x-component-props.titleAr": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            lang: "ar",
            placeholder: i18n.t("MultiFile.designerPlaceholderTitle", {
              lng: "ar",
            }),
          },
        },
        "x-component-props": {
          type: "object",
          properties: {
            fileFormat: {
              type: "array",
              "x-decorator": "FormItem",
              "x-component": "Select",
              "x-component-props": {
                mode: "multiple",
                placeholder: i18n.t("MultiFile.fileFormatPlaceholder", {
                  lng: "en",
                }),
                options: [
                  { label: "JPG", value: "JPG" },
                  { label: "JPEG", value: "JPEG" },
                  { label: "PNG", value: "PNG" },
                  { label: "PDF", value: "PDF" },
                  { label: "DOCX", value: "DOCX" },
                  { label: "MP4", value: "MP4" },
                ],
              },
            },
            fileSizeLimit: {
              type: "number",
              "x-decorator": "FormItem",
              "x-component": "NumberPicker",
              "x-component-props": {
                min: 1,
                max: 100,
                defaultValue: 5,
                className: "fileSizeLimit",
              },
            },
            maxCount: {
              type: "number",
              "x-decorator": "FormItem",
              "x-component": "NumberPicker",
              "x-component-props": {
                min: 2,
                max: 5,
                defaultValue: 2,
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
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
              "x-component-props": {
                lang: "en",
              },
            },
            tooltipAr: {
              type: "string",
              "x-decorator": "FormItem",
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
              "x-component-props": {
                lang: "ar",
              },
            },
          },
        },
        required: {
          type: "boolean",
          "x-decorator": "FormItem",
          "x-component": "Switch",
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
}

export const MultiFile: DnFC<React.ComponentProps<typeof DocumentViewer>> =
  MultiFileDom as unknown as DnFC<React.ComponentProps<typeof DocumentViewer>>;

MultiFile.Behavior = createBehavior({
  name: "MultiFile",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "MultiFile",
  designerProps: buildMultiFileDesignerProps,
  designerLocales: AllLocales.MultiFile,
});

MultiFile.Resource = createResource({
  icon: resourceIcons.multiFile,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "Array<object>",
        title: i18n.t("MultiFile.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "MultiFile",
        "x-component-props": {
          titleEn: i18n.t("MultiFile.defaultTitle", { lng: "en" }),
          titleAr: i18n.t("MultiFile.defaultTitle", { lng: "ar" }),
          fileSizeLimit: 5,
          maxCount: 2,
        },
      },
    },
  ],
});
