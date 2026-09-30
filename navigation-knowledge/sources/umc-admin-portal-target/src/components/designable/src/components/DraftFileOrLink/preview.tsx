import type { DnFC } from "@designable/react";
import { createBehavior, createResource } from "@designable/core";
import { AllLocales } from "../../locales";
import { resourceIcons } from "../../assets/resource-icons";
import { buildBilingualComponentDefaults } from "../../utils/bilingual";
import i18n from "@/localization/config";
import {
  DraftFileOrLinkField,
  type DraftFileOrLinkFieldProps,
} from "./DraftFileOrLinkField";

const DEFAULT_FILE_FORMATS = ["JPG", "JPEG", "PNG", "PDF", "DOCX", "MP4"];

function buildDraftFileOrLinkDesignerProps(node: {
  props?: Record<string, unknown>;
}) {
  return {
    defaultProps: buildBilingualComponentDefaults(node, {
      defaultTitleEn: i18n.t("DraftFileOrLink.defaultTitle", { lng: "en" }),
      defaultTitleAr: i18n.t("DraftFileOrLink.defaultTitle", { lng: "ar" }),
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
            placeholder: i18n.t("DraftFileOrLink.designerPlaceholderTitle", {
              lng: "en",
            }),
          },
        },
        "x-component-props.titleAr": {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("DraftFileOrLink.designerPlaceholderTitle", {
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
              default: DEFAULT_FILE_FORMATS,
              "x-component-props": {
                mode: "multiple",
                placeholder: i18n.t("DraftFileOrLink.fileFormatPlaceholder", {
                  lng: "en",
                }),
                options: DEFAULT_FILE_FORMATS.map((format) => ({
                  label: format,
                  value: format,
                })),
              },
            },
            fileSizeLimit: {
              type: "number",
              "x-decorator": "FormItem",
              "x-component": "NumberPicker",
              default: 5,
              "x-component-props": {
                min: 1,
                max: 100,
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
              "x-component-props": { lang: "en" },
            },
            tooltipAr: {
              type: "string",
              "x-decorator": "FormItem",
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
              "x-component-props": { lang: "ar" },
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
}

export const DraftFileOrLink =
  DraftFileOrLinkField as unknown as DnFC<DraftFileOrLinkFieldProps>;

DraftFileOrLink.Behavior = createBehavior({
  name: "DraftFileOrLink",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "DraftFileOrLink",
  designerProps: buildDraftFileOrLinkDesignerProps,
  designerLocales: AllLocales.DraftFileOrLink,
});

DraftFileOrLink.Resource = createResource({
  icon: resourceIcons.upload,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "string",
        title: i18n.t("DraftFileOrLink.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "DraftFileOrLink",
        "x-component-props": {
          titleEn: i18n.t("DraftFileOrLink.defaultTitle", { lng: "en" }),
          titleAr: i18n.t("DraftFileOrLink.defaultTitle", { lng: "ar" }),
          fileFormat: DEFAULT_FILE_FORMATS,
          fileSizeLimit: 5,
        },
        "x-decorator-props": {
          tooltipEn: "",
          tooltipAr: "",
        },
      },
    },
  ],
});
