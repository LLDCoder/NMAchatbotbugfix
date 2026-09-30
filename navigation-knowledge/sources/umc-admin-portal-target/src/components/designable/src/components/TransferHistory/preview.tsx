import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { TransferHistoryField } from "./TransferHistoryField";

export const TransferHistory: DnFC<
  React.ComponentProps<typeof TransferHistoryField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="transfer-history-designable-preview-root">
      <TransferHistoryField {...props} />
    </div>
  );
});

const transferHistorySchema: ISchema = {
  type: "object",
  properties: {},
};

TransferHistory.Behavior = createBehavior({
  name: "TransferHistory",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "TransferHistory",
  designerProps: {
    propsSchema: transferHistorySchema,
  },
  designerLocales: AllLocales.TransferHistory,
});

TransferHistory.Resource = createResource({
  icon: resourceIcons.transferHistory,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "TransferHistory",
        "x-decorator": "FormItem",
        "x-component": "TransferHistory",
      },
    },
  ],
});
