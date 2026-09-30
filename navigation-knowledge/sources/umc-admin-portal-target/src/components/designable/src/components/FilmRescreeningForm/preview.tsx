import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { FilmRescreeningFormField } from "./FilmRescreeningFormField";

export const FilmRescreeningForm: DnFC<
  React.ComponentProps<typeof FilmRescreeningFormField>
> = FilmRescreeningFormField;

const filmRescreeningFormSchema: ISchema = {
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

FilmRescreeningForm.Behavior = createBehavior({
  name: "FilmRescreeningForm",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "FilmRescreeningForm",
  designerProps: {
    propsSchema: filmRescreeningFormSchema,
  },
  designerLocales: AllLocales.FilmRescreeningForm,
});

FilmRescreeningForm.Resource = createResource({
  icon: resourceIcons.filmRescreeningForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Film Re-screening Form",
        "x-decorator": "FormItem",
        "x-component": "FilmRescreeningForm",
      },
    },
  ],
});
