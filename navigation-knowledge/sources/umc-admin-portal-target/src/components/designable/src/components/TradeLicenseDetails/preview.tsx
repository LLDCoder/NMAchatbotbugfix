import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { TradeLicenseDetailsField } from "./TradeLicenseDetailsField";

export const TradeLicenseDetails: DnFC<
  React.ComponentProps<typeof TradeLicenseDetailsField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="trade-license-details-designable-preview-root">
      <TradeLicenseDetailsField {...props} />
    </div>
  );
});

const tradeLicenseDetailsSchema: ISchema = {
  type: "object",
  properties: {},
};

TradeLicenseDetails.Behavior = createBehavior({
  name: "TradeLicenseDetails",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "TradeLicenseDetails",
  designerProps: {
    propsSchema: tradeLicenseDetailsSchema,
  },
  designerLocales: AllLocales.TradeLicenseDetails,
});

TradeLicenseDetails.Resource = createResource({
  icon: resourceIcons.tradeLicenseDetails,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Trade License Details",
        "x-decorator": "FormItem",
        "x-component": "TradeLicenseDetails",
      },
    },
  ],
});
