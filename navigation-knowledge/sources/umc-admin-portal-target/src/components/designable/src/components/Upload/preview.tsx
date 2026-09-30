import * as React from "react";
import UploadDom from "./Upload";
import DocumentViewer from "../../../../common/DocumentViewer/index";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import { buildBilingualComponentDefaults } from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

function buildUploadDesignerProps(node: any) {
  return {
    defaultProps: buildBilingualComponentDefaults(node, {
      defaultTitleEn: i18n.t("Upload.defaultTitle", { lng: "en" }),
      defaultTitleAr: i18n.t("Upload.defaultTitle", { lng: "ar" }),
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
            placeholder: i18n.t("Upload.designerPlaceholderTitle", { lng: "en" }),
          },
        },
        "x-component-props.titleAr": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("Upload.designerPlaceholderTitle", { lng: "ar" }),
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
                placeholder: i18n.t("Upload.fileFormatPlaceholder", { lng: "en" }),
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
                lang: 'en'
              },
            },
            tooltipAr: {
              type: "string",
              "x-decorator": "FormItem",
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
              "x-component-props": {
                lang: 'ar'
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
          // default: "editable", // Do not set default to avoid review page showing "editable" pattern 
          "x-component-props": {
            checkedValue: "editable",
            unCheckedValue: "readOnly",
          },
        },
      },
    },
  };
}

export const Upload: DnFC<React.ComponentProps<typeof DocumentViewer>> =
  UploadDom as any;

Upload.Behavior = createBehavior(
  {
    name: "Upload",
    extends: ["Field"],
    selector: (node) => node.props?.["x-component"] === "Upload",
    designerProps: buildUploadDesignerProps,
    designerLocales: AllLocales.Upload,
  },
  {
    name: "Upload.Dragger",
    extends: ["Field"],
    selector: (node) => node.props?.["x-component"] === "Upload.Dragger",
    designerProps: buildUploadDesignerProps,
    designerLocales: AllLocales.UploadDragger,
  }
);

Upload.Resource = createResource(
  {
    icon: resourceIcons.upload,
    elements: [
      {
        componentName: "Field",
        props: {
          type: "Array<object>",
          title: i18n.t("Upload.defaultTitle", { lng: "en" }),
          "x-decorator": "FormItem",
          "x-component": "Upload",
          "x-component-props": {
            titleEn: i18n.t("Upload.defaultTitle", { lng: "en" }),
            titleAr: i18n.t("Upload.defaultTitle", { lng: "ar" }),
            textContent: i18n.t("Upload.defaultTitle", { lng: "en" }),
            fileSizeLimit: 5,
          },
        },
      },
    ],
  },
  {
    icon: resourceIcons.uploadDragger,
    elements: [
      {
        componentName: "Field",
        props: {
          type: "Array<object>",
          title: i18n.t("Upload.defaultDraggerTitle", { lng: "en" }),
          "x-decorator": "FormItem",
          "x-component": "Upload.Dragger",
          "x-component-props": {
            titleEn: i18n.t("Upload.defaultDraggerTitle", { lng: "en" }),
            titleAr: i18n.t("Upload.defaultDraggerTitle", { lng: "ar" }),
            textContent: i18n.t("Upload.defaultDraggerTitle", { lng: "en" }),
            fileSizeLimit: 5,
          },
        },
      },
    ],
  }
);
