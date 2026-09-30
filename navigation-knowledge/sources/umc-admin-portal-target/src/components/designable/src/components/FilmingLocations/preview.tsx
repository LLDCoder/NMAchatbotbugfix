import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { createFieldSchema } from "../Field";
import { FilmingLocationsField } from "./FilmingLocationsField";

export const FilmingLocations: DnFC<
  React.ComponentProps<typeof FilmingLocationsField>
> = FilmingLocationsField;

FilmingLocations.Behavior = createBehavior({
  name: "FilmingLocations",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "FilmingLocations",
  designerProps: {
    propsSchema: createFieldSchema(AllSchemas.FilmingLocations),
  },
  designerLocales: AllLocales.FilmingLocations,
});

FilmingLocations.Resource = createResource({
  icon: "SelectSource",
  elements: [
    {
      componentName: "Field",
      props: {
        name: "filmingLocations",
        required: true,
        "x-decorator": "FormItem",
        "x-component": "FilmingLocations",
      },
    },
  ],
});
