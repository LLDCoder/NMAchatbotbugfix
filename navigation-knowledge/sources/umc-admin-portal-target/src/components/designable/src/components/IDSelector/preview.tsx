import React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { observer } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { IDSelectorField } from "./IDSelectorField";

type IDSelectorFieldProps = React.ComponentProps<typeof IDSelectorField>;

const IDSelectorCanvas = observer((props: IDSelectorFieldProps) => {
  return <IDSelectorField {...props} />;
});

export const IDSelector: DnFC<IDSelectorFieldProps> = IDSelectorCanvas;

IDSelector.Behavior = createBehavior({
  name: "IDSelector",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "IDSelector",
  designerProps(_node: unknown) {
    return {
      propsSchema: {
        type: "object",
        properties: {
          "x-component-props.showEmiratesId": {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "Switch",
            "x-component-props": {
              defaultChecked: true,
            },
          },
          "x-component-props.showUID": {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "Switch",
            "x-component-props": {
              defaultChecked: true,
            },
          },
          "x-component-props.showPassport": {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "Switch",
            "x-component-props": {
              defaultChecked: true,
            },
          },
          required: {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "Switch",
          },
          "x-display": {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "StringSwitchSetter",
            default: "visible",
            "x-component-props": {
              checkedValue: "visible",
              unCheckedValue: "none",
            },
          },
        },
      },
    };
  },
  designerLocales: AllLocales.IDSelector,
});

IDSelector.Resource = createResource({
  icon: resourceIcons.idSelector,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "idSelector",
        "x-decorator": "FormItem",
        "x-component": "IDSelector",
        "x-component-props": {
          showEmiratesId: true,
          showUID: true,
          showPassport: false,
        },
      },
    },
  ],
});
