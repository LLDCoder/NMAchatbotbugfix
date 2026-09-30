import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { SocialMediaManagerField } from "./SocialMediaManagerField";

export const SocialMediaManager: DnFC<
  React.ComponentProps<typeof SocialMediaManagerField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="social-media-manager-designable-preview-root">
      <SocialMediaManagerField {...props} />
    </div>
  );
});

const emptyPropsSchema: ISchema = {
  type: "object",
  properties: {
    "x-component-props.editable": {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
      "x-component-props": {
        defaultChecked: true,
      },
    },
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
};

SocialMediaManager.Behavior = createBehavior({
  name: "SocialMediaManager",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "SocialMediaManager",
  designerProps: {
    propsSchema: emptyPropsSchema,
  },
  designerLocales: AllLocales.SocialMediaManager,
});

SocialMediaManager.Resource = createResource({
  icon: resourceIcons.socialMediaManager,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "socialMediaManager",
        "x-decorator": "FormItem",
        "x-component": "SocialMediaManager",
        "x-component-props": {
          editable: true,
          showEmiratesId: true,
          showUID: true,
          showPassport: true,
        },
      },
    },
  ],
});
