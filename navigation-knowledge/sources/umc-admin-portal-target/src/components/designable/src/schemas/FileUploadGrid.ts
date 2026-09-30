import type { ISchema } from "@formily/react";
import i18n from "@/localization/config";

export const FileUploadGrid: ISchema = {
  type: "object",
  properties: {
    "x-component-props.titleEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        defaultValue: i18n.t("ImageList.defaultCardTitle", { lng: "en" }),
        placeholder: i18n.t("ImageList.designerPlaceholderTitleEn", {
          lng: "en",
        }),
      },
    },
    "x-component-props.titleAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        defaultValue: i18n.t("ImageList.defaultCardTitle", { lng: "ar" }),
        placeholder: i18n.t("ImageList.designerPlaceholderTitleAr", {
          lng: "ar",
        }),
      },
    },
    "x-component-props.descriptionEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-decorator-props": { colon: false, label: " " },
      "x-component": "DescriptionRichTextSetter",
      "x-component-props": {
        lang: "en",
        placeholder: i18n.t("ImageList.designerPlaceholderDescriptionEn", {
          lng: "en",
        }),
      },
    },
    "x-component-props.descriptionAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-decorator-props": { colon: false, label: " " },
      "x-component": "DescriptionRichTextSetter",
      "x-component-props": {
        lang: "ar",
        placeholder: i18n.t("ImageList.designerPlaceholderDescriptionAr", {
          lng: "ar",
        }),
      },
    },
    "x-component-props.addButtonLabelEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("ImageList.designerPlaceholderAddButton"),
      },
    },
    "x-component-props.addButtonLabelAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("ImageList.designerPlaceholderAddButton", {
          lng: "ar",
        }),
        lng: "ar",
      },
    },
    "x-component-props.maxImages": {
      type: "number",
      default: 4,
      "x-decorator": "FormItem",
      "x-decorator-props": {
        tooltip: i18n.t("ImageList.designerMaxImagesTooltip"),
      },
      "x-component": "NumberPicker",
      "x-component-props": {
        min: 1,
        max: 12,
      },
    },
  },
};
