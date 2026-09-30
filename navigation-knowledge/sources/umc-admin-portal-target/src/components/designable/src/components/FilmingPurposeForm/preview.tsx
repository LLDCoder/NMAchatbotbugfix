import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { FilmingPurposeFormField } from "./FilmingPurposeFormField";

export const FilmingPurposeForm: DnFC<
  React.ComponentProps<typeof FilmingPurposeFormField>
> = FilmingPurposeFormField;

const filmingPurposeFormSchema: ISchema = {
  type: "object",
  properties: {
    "x-component-props.restriction": {
      type: "object",
      "x-decorator": "FormItem",
      "x-component": "RestrictionSetter",
      "x-component-props": {
        showTenDaysFromToday: true,
        showWithinSixMonthsFromToday: true,
      },
    },
    "x-component-props.duration": {
      type: "number",
      "x-decorator": "FormItem",
      "x-component": "NumberPicker",
      "x-component-props": {
        min: 1,
        max: 90,
        precision: 0,
      },
    },
  },
};

FilmingPurposeForm.Behavior = createBehavior({
  name: "FilmingPurposeForm",
  extends: ["Field"],
  selector: (node) =>
    node.props?.["x-component"] === "FilmingPurposeForm",
  designerProps: {
    propsSchema: filmingPurposeFormSchema,
  },
  designerLocales: (AllLocales as any).FilmingPurposeForm,
});

FilmingPurposeForm.Resource = createResource({
  icon: resourceIcons.filmingPurposeForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "FilmingPurpose",
        "x-decorator": "FormItem",
        "x-component": "FilmingPurposeForm",
      },
    },
  ],
});
