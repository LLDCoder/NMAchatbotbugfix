
import { ISchema } from "@formily/react";
import DataSourceSetter from "../components/EquipmentList/Setter/DataSource";

export const EquipmentList: ISchema = {
  type: "object",
  properties: {
    fieldSource: {
      type: "object",
      "x-decorator": "FormItem",
      "x-component": DataSourceSetter,
    },
    addButtonText: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
    }
  },
};


