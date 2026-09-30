import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { TransferInformationField } from "./TransferInformationField";

export const TransferInformation: DnFC<
  React.ComponentProps<typeof TransferInformationField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="transfer-information-designable-preview-root">
      <TransferInformationField {...props} />
    </div>
  );
});

const transferInformationSchema: ISchema = {
  type: "object",
  properties: {},
};

TransferInformation.Behavior = createBehavior({
  name: "TransferInformation",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "TransferInformation",
  designerProps: {
    propsSchema: transferInformationSchema,
  },
  designerLocales: AllLocales.TransferInformation,
});

TransferInformation.Resource = createResource({
  icon: resourceIcons.transferInformation,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Transfer Information",
        "x-decorator": "FormItem",
        "x-component": "TransferInformation",
      },
    },
  ],
});
