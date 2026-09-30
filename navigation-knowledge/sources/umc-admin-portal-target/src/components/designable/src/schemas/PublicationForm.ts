import type { ISchema } from "@formily/react";
import i18n from "@/localization/config";

export const PublicationForm: ISchema = {
  type: "object",
  properties: {
    "x-component-props.titleEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        defaultValue: i18n.t("PublicationForm.defaultCardTitle", { lng: "en" }),
        placeholder: i18n.t("PublicationForm.designerPlaceholderLabel", {
          lng: "en",
        }),
      },
    },
    "x-component-props.titleAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        defaultValue: i18n.t("PublicationForm.defaultCardTitle", { lng: "ar" }),
        placeholder: i18n.t("PublicationForm.designerPlaceholderLabel", {
          lng: "ar",
        }),
      },
    },
  },
};
