import type { ISchema } from "@formily/react";
import i18n from "@/localization/config";

export const PressCardSelector: ISchema = {
  type: "object",
  properties: {
    "x-component-props.titleEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("PressCardSelector.designerPlaceholderTitle", {
          lng: "en",
        }),
      },
    },
    "x-component-props.titleAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("PressCardSelector.designerPlaceholderTitle", {
          lng: "ar",
        }),
      },
    },
    "x-component-props.placeholderEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("PressCardSelector.designerPlaceholderInput", {
          lng: "en",
        }),
      },
    },
    "x-component-props.placeholderAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("PressCardSelector.designerPlaceholderInput", {
          lng: "ar",
        }),
      },
    },
  },
};
