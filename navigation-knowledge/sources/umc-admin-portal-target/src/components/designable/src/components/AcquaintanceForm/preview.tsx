import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { createFieldSchema } from "../Field";
import { AcquaintanceFormField } from "./AcquaintanceFormField";
import { resourceIcons } from "../../assets/resource-icons";

export const AcquaintanceForm: DnFC<
  React.ComponentProps<typeof AcquaintanceFormField>
> = AcquaintanceFormField;

AcquaintanceForm.Behavior = createBehavior({
  name: "AcquaintanceForm",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "AcquaintanceForm",
  designerProps: {
    propsSchema: AllSchemas.AcquaintanceForm,
  },
  designerLocales: AllLocales.AcquaintanceForm,
});

AcquaintanceForm.Resource = createResource({
  icon: resourceIcons.acquaintanceForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "acquaintanceForm",
        "x-decorator": "FormItem",
        "x-decorator-props": { colon: false, label: false },
        "x-component": "AcquaintanceForm",
      },
    },
  ],
});
