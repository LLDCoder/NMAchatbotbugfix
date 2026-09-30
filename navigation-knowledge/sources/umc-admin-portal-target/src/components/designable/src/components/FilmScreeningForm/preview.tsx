import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { FilmScreeningFormField } from "./FilmScreeningFormField";

export const FilmScreeningForm: DnFC<
  React.ComponentProps<typeof FilmScreeningFormField>
> = FilmScreeningFormField;

const filmScreeningFormSchema: ISchema = {
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

FilmScreeningForm.Behavior = createBehavior({
  name: "FilmScreeningForm",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "FilmScreeningForm",
  designerProps: {
    propsSchema: filmScreeningFormSchema,
  },
  designerLocales: AllLocales.FilmScreeningForm,
});

FilmScreeningForm.Resource = createResource({
  icon: resourceIcons.filmScreeningForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Film Screening Form",
        "x-decorator": "FormItem",
        "x-component": "FilmScreeningForm",
      },
    },
  ],
});
