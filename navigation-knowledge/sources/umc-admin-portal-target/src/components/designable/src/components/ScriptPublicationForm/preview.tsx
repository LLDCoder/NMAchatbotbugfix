import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { ScriptPublicationFormField } from "./ScriptPublicationFormField";

export const ScriptPublicationForm: DnFC<
  React.ComponentProps<typeof ScriptPublicationFormField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="script-publication-form-designable-preview-root">
      <ScriptPublicationFormField {...props} />
    </div>
  );
});

const scriptPublicationFormSchema: ISchema = {
  type: "object",
  properties: {},
};

ScriptPublicationForm.Behavior = createBehavior({
  name: "ScriptPublicationForm",
  extends: ["Field"],
  selector: (node) =>
    node.props?.["x-component"] === "ScriptPublicationForm",
  designerProps: {
    propsSchema: scriptPublicationFormSchema,
  },
  designerLocales: AllLocales.ScriptPublicationForm,
});

ScriptPublicationForm.Resource = createResource({
  icon: resourceIcons.scriptPublicationForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "ScriptPublicationForm",
        "x-decorator": "FormItem",
        "x-component": "ScriptPublicationForm",
      },
    },
  ],
});
