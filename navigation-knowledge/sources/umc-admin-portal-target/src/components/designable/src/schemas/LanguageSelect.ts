import { ISchema } from "@formily/react";

export const LanguageSelect: ISchema = {
  type: "object",
  properties: {
    allowClear: {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
    },
    showSearch: {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
    },
  },
};
