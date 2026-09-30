import type { ISchema } from "@formily/react";
import i18n from "@/localization/config";

export const BookList: ISchema = {
  type: "object",
  properties: {
    "x-component-props.titleEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("BookList.designerPlaceholderTitleEn", {
          lng: "en",
        }),
      },
    },
    "x-component-props.titleAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("BookList.designerPlaceholderTitleAr", {
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
        placeholder: i18n.t("BookList.designerPlaceholderDescriptionEn", {
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
        placeholder: i18n.t("BookList.designerPlaceholderDescriptionAr", {
          lng: "ar",
        }),
      },
    },
  },
};
