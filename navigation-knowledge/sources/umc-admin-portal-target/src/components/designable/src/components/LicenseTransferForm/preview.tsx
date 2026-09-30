import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { LicenseTransferFormField } from "./LicenseTransferFormField";

const DEFAULT_ALERT_MESSAGE_EN =
  "License transfer is subject to approval. The recipient must have a valid UAE Media Council account and meet all eligibility requirements.";
const DEFAULT_ALERT_MESSAGE_AR =
  "\u064a\u062e\u0636\u0639\u0020\u0646\u0642\u0644\u0020\u0627\u0644\u0631\u062e\u0635\u0629\u0020\u0644\u0644\u0645\u0648\u0627\u0641\u0642\u0629\u002e\u0020\u064a\u062c\u0628\u0020\u0623\u0646\u0020\u064a\u0643\u0648\u0646\u0020\u0644\u062f\u0649\u0020\u0627\u0644\u0645\u0633\u062a\u0644\u0645\u0020\u062d\u0633\u0627\u0628\u0020\u0635\u0627\u0644\u062d\u0020\u0644\u062f\u0649\u0020\u0645\u062c\u0644\u0633\u0020\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a\u0020\u0644\u0644\u0625\u0639\u0644\u0627\u0645\u0020\u0648\u0623\u0646\u0020\u064a\u0633\u062a\u0648\u0641\u064a\u0020\u062c\u0645\u064a\u0639\u0020\u0645\u062a\u0637\u0644\u0628\u0627\u062a\u0020\u0627\u0644\u0623\u0647\u0644\u064a\u0629\u002e";

function buildLicenseTransferFormDesignerDefaults(node: {
  props?: Record<string, unknown>;
}) {
  const xcp = (node.props?.["x-component-props"] ?? {}) as Record<
    string,
    unknown
  >;
  const legacyAlertMessage =
    typeof xcp.alertMessage === "string" ? xcp.alertMessage : undefined;

  return {
    "x-component-props": {
      ...xcp,
      alertMessageEn:
        (typeof xcp.alertMessageEn === "string"
          ? xcp.alertMessageEn
          : undefined) ??
        legacyAlertMessage ??
        DEFAULT_ALERT_MESSAGE_EN,
      alertMessageAr:
        (typeof xcp.alertMessageAr === "string"
          ? xcp.alertMessageAr
          : undefined) ?? DEFAULT_ALERT_MESSAGE_AR,
    },
  };
}

export const LicenseTransferForm: DnFC<
  React.ComponentProps<typeof LicenseTransferFormField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="license-transfer-form-designable-preview-root">
      <LicenseTransferFormField {...props} />
    </div>
  );
});

const licenseTransferFormSchema: ISchema = {
  type: "object",
  properties: {
    "field-group": {
      type: "void",
      "x-component": "CollapseItem",
      properties: {
        "x-component-props": {
          type: "object",
          properties: {
            alertMessageEn: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input.TextArea",
              "x-component-props": {
                rows: 3,
              },
              default: DEFAULT_ALERT_MESSAGE_EN,
            },
            alertMessageAr: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input.TextArea",
              "x-component-props": {
                rows: 3,
              },
              default: DEFAULT_ALERT_MESSAGE_AR,
            },
          },
        },
      },
    },
  },
};

LicenseTransferForm.Behavior = createBehavior({
  name: "LicenseTransferForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "LicenseTransferForm",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildLicenseTransferFormDesignerDefaults(node),
      propsSchema: licenseTransferFormSchema,
    };
  },
  designerLocales: AllLocales.LicenseTransferForm,
});

LicenseTransferForm.Resource = createResource({
  icon: resourceIcons.licenseTransferForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "License Transfer Form",
        "x-decorator": "FormItem",
        "x-component": "LicenseTransferForm",
        "x-component-props": {
          alertMessageEn: DEFAULT_ALERT_MESSAGE_EN,
          alertMessageAr: DEFAULT_ALERT_MESSAGE_AR,
        },
      },
    },
  ],
});
