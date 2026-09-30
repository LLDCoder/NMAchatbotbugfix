import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps } from "@designable/react";
import type { DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { GameDistributionFormField } from "./GameDistributionFormField";

export const GameDistributionForm: DnFC<
  React.ComponentProps<typeof GameDistributionFormField>
> = observer((props) => {
  const nodeId = useNodeIdProps();

  return (
    <div {...nodeId} className="game-distribution-form-designable-preview-root">
      <GameDistributionFormField {...props} />
    </div>
  );
});

const gameDistributionFormSchema: ISchema = {
  type: "object",
  properties: {
    "field-group": {
      type: "void",
      "x-component": "CollapseItem",
      properties: {
        "x-component-props": {
          type: "object",
          properties: {},
        },
      },
    },
  },
};

GameDistributionForm.Behavior = createBehavior({
  name: "GameDistributionForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "GameDistributionForm",
  designerProps: {
    propsSchema: gameDistributionFormSchema,
  },
  designerLocales: AllLocales.GameDistributionForm,
});

GameDistributionForm.Resource = createResource({
  icon: resourceIcons.gameDistributionForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Game Distribution Form",
        "x-decorator": "FormItem",
        "x-component": "GameDistributionForm",
      },
    },
  ],
});
