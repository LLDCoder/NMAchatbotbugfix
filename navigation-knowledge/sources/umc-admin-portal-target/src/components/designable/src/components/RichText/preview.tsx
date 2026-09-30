import React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { createFieldSchema } from "../Field";
import { RichText as RichTextComponent } from "./RichText";

export const RichText: DnFC<React.ComponentProps<typeof RichTextComponent>> =
  RichTextComponent;

RichText.Behavior = createBehavior({
  name: "RichText",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "RichText",
  designerProps: {
    propsSchema: createFieldSchema(AllSchemas.RichText),
  },
  designerLocales: AllLocales.RichText,
});

RichText.Resource = createResource({
  icon: "TextAreaSource",
  elements: [
    {
      componentName: "Field",
      props: {
        type: "string",
        title: "RichText",
        "x-decorator": "FormItem",
        "x-component": "RichText",
      },
    },
  ],
});


