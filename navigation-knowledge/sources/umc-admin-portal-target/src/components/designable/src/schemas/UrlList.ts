import { ISchema } from "@formily/react";

export const UrlList: ISchema = {
  type: "object",
  properties: {
    "x-component-props": {
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        addButtonText: {
          type: "string",
          title: "Add Button Label",
          default: "Add New",
          "x-decorator": "FormItem",
          "x-component": "Input",
        },
        maxItems: {
          type: "number",
          title: "Max Items",
          default: 3,
          "x-decorator": "FormItem",
          "x-component": "InputNumber",
          "x-decorator-props": {
            tooltip: "Maximum Quantity: 12",
          },
          "x-component-props": {
            min: 1,
            max: 12,
          },
        },
        fileSizeLimit: {
          type: "number",
          title: "Max File Size (MB)",
          default: 100,
          "x-decorator": "FormItem",
          "x-component": "InputNumber",
          "x-decorator-props": {
            tooltip: "Default: 100MB, configurable up to 200MB",
          },
          "x-component-props": {
            min: 1,
            max: 200,
          },
        },
      },
    },
  },
};
