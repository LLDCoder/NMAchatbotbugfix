import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { MoviePackageFormField } from "./MoviePackageFormField";

export const MoviePackageForm: DnFC<
  React.ComponentProps<typeof MoviePackageFormField>
> = MoviePackageFormField;

const moviePackageFormSchema: ISchema = {
  type: "object",
  properties: {},
};

MoviePackageForm.Behavior = createBehavior({
  name: "MoviePackageForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "MoviePackageForm",
  designerProps: {
    propsSchema: moviePackageFormSchema,
  },
  designerLocales: AllLocales.MoviePackageForm,
});

MoviePackageForm.Resource = createResource({
  icon: resourceIcons.moviePackageForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "moviePackageForm",
        // No `type: "object"`: that path uses `Container` (`DroppableWidget` with
        // default `placeholder: true`), which replaces content with a gray block when
        // the tree has no child nodes. Match IDSelector and other advanced forms.
        "x-decorator": "FormItem",
        "x-component": "MoviePackageForm",
      },
    },
  ],
});

export default MoviePackageForm;
