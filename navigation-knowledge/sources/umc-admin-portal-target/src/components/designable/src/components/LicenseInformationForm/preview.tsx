import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { LicenseInformationFormField } from "./LicenseInformationFormField";

export const LicenseInformationForm: DnFC<
  React.ComponentProps<typeof LicenseInformationFormField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="license-information-form-designable-preview-root">
      <LicenseInformationFormField {...props} />
    </div>
  );
});

const licenseInformationFormSchema: ISchema = {
  type: "object",
  properties: {},
};

LicenseInformationForm.Behavior = createBehavior({
  name: "LicenseInformationForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "LicenseInformationForm",
  designerProps: {
    propsSchema: licenseInformationFormSchema,
  },
  designerLocales: AllLocales.LicenseInformationForm,
});

LicenseInformationForm.Resource = createResource({
  icon: resourceIcons.licenseInformationForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "License Information Form",
        "x-decorator": "FormItem",
        "x-component": "LicenseInformationForm",
      },
    },
  ],
});
