import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import type { ISchema } from "@formily/react";
import { connect, mapProps, observer } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { BeneficiaryTypeField } from "./BeneficiaryTypeField";

const beneficiaryTypeSchema: ISchema = {
  type: "object",
  properties: {},
};

const ConnectedBeneficiaryType: DnFC<React.ComponentProps<typeof BeneficiaryTypeField>> = connect(
  BeneficiaryTypeField,
  mapProps((props, field) => ({
    ...props,
    designMode: field?.designable ? true : false,
  })),
);

export const BeneficiaryType: DnFC<React.ComponentProps<typeof BeneficiaryTypeField>> = observer(
  (props) => {
    const nodeId = useNodeIdProps();

    return (
      <div {...nodeId} className="beneficiary-type-designable-preview-root">
        <ConnectedBeneficiaryType {...props} />
      </div>
    );
  },
);

BeneficiaryType.Behavior = createBehavior({
  name: "BeneficiaryType",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "BeneficiaryType",
  designerProps: {
    propsSchema: beneficiaryTypeSchema,
  },
  designerLocales: AllLocales.BeneficiaryType,
});

BeneficiaryType.Resource = createResource({
  icon: resourceIcons.beneficiaryType,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "beneficiaryType",
        "x-decorator": "FormItem",
        "x-component": "BeneficiaryType",
      },
    },
  ],
});

export default BeneficiaryType;
