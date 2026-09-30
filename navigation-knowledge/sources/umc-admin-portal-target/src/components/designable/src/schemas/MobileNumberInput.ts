import type { ISchema } from "@formily/react";

export const MobileNumberInput: ISchema = {
  type: "object",
  properties: {
    titleEn: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
    },
    titleAr: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
    },
    disabled: {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
    },
    defaultCountryCode: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
    },
    placeholderEn: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
    },
    placeholderAr: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
    },
  },
};
