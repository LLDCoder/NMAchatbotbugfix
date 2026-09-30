import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import type { ISchema } from "@formily/react";
import { connect, mapProps } from "@formily/react";
import { observer } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { GuardianConsentDetailsField } from "./GuardianConsentDetailsField";

const guardianConsentDetailsComponentSchema: ISchema = {
  type: "object",
  properties: {},
};

const ConnectedGuardianConsentDetails: DnFC<
  React.ComponentProps<typeof GuardianConsentDetailsField>
> = connect(
  GuardianConsentDetailsField,
  mapProps((props, field) => ({
    ...props,
    designMode: field?.designable ? true : false,
  }))
);

export const GuardianConsentDetails: DnFC<
  React.ComponentProps<typeof GuardianConsentDetailsField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="guardian-consent-details-designable-preview-root">
      <ConnectedGuardianConsentDetails {...props} />
    </div>
  );
});

GuardianConsentDetails.Behavior = createBehavior({
  name: "GuardianConsentDetails",
  extends: ["Field"],
  selector: (node) =>
    node.props?.["x-component"] === "GuardianConsentDetails",
  designerProps: {
    propsSchema: guardianConsentDetailsComponentSchema,
  },
  designerLocales: AllLocales.GuardianConsentDetails,
});

GuardianConsentDetails.Resource = createResource({
  icon: resourceIcons.guardianConsentDetails,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "guardianConsentDetails",
        "x-decorator": "FormItem",
        "x-component": "GuardianConsentDetails",
      },
    },
  ],
});

export default GuardianConsentDetails;
