import type { ISchema } from "@formily/react";
import i18n from "@/localization/config";

/**
 * Setters under x-component-props for the Information component.
 *
 * IMPORTANT: do NOT set `defaultValue` on the RichText setters here. Formily
 * re-applies the schema default on every settings-form re-render and silently
 * reverts user edits, which is what caused "Content modifications only fire
 * once" earlier. Defaults are seeded via `Resource` in preview.tsx instead.
 *
 */
export const Information: ISchema = {
  type: "object",
  properties: {
    Style: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "StyleSelector",
      "x-component-props": {
        defaultValue: "warning",
      },
    },
    textEn: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "RichText",
      "x-component-props": {
        placeholder: i18n.t("Information.designerHintTextEn", { lng: "en" }),
      },
    },
    textAr: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "RichText",
      "x-component-props": {
        placeholder: i18n.t("Information.designerHintTextAr", { lng: "ar" }),
      },
    },
  },
};
