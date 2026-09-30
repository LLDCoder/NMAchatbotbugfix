import { ISchema } from "@formily/react";

export const RichText: ISchema = {
  type: "object",
  properties: {
    placeholder: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
    },
    height: {
      type: "number",
      "x-decorator": "FormItem",
      "x-component": "NumberPicker",
      "x-component-props": {
        defaultValue: 200,
      },
    },
    maxLength: {
      type: "number",
      "x-decorator": "FormItem",
      "x-component": "NumberPicker",
    },
  },
};


