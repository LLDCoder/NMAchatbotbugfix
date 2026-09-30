import type { ISchema } from "@formily/react";

export const DurationInput: ISchema = {
  type: "object",
  properties: {
    autoFocus: {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
    },
    bordered: {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
      "x-component-props": {
        defaultChecked: true,
      },
    },
    size: {
      type: "string",
      enum: ["large", "small", "middle", null],
      "x-decorator": "FormItem",
      "x-component": "Select",
      "x-component-props": {
        defaultValue: "middle",
      },
    },
  },
};
