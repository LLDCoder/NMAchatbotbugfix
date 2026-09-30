import type { ISchema } from "@formily/react";

export const LanguageSelectMulti: ISchema = {
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
