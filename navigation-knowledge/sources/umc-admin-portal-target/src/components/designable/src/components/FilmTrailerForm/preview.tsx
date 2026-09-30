import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { FilmTrailerFormField } from "./FilmTrailerFormField";
import i18n from "@/localization/config";

function defaultTitleEn() {
  return i18n.t("FilmTrailerForm.defaultCardTitle", { lng: "en" });
}

function defaultTitleAr() {
  return i18n.t("FilmTrailerForm.defaultCardTitle", { lng: "ar" });
}

function buildFilmTrailerFormDesignerDefaults(node: {
  props?: Record<string, unknown>;
}) {
  const xcp = (node.props?.["x-component-props"] ?? {}) as Record<
    string,
    unknown
  >;
  const legacyTitle =
    typeof node.props?.title === "string" ? node.props.title : undefined;
  const legacyComponentTitle =
    typeof xcp.title === "string" ? xcp.title : undefined;

  return {
    title:
      legacyTitle ??
      (typeof xcp.titleEn === "string" ? xcp.titleEn : undefined) ??
      defaultTitleEn(),
    "x-component-props": {
      titleEn:
        (typeof xcp.titleEn === "string" ? xcp.titleEn : undefined) ??
        legacyTitle ??
        legacyComponentTitle ??
        defaultTitleEn(),
      titleAr:
        (typeof xcp.titleAr === "string" ? xcp.titleAr : undefined) ??
        defaultTitleAr(),
    },
  };
}

export const FilmTrailerForm: DnFC<
  React.ComponentProps<typeof FilmTrailerFormField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="film-trailer-form-designable-preview-root">
      <FilmTrailerFormField {...props} />
    </div>
  );
});

const filmTrailerFormSchema: ISchema = {
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

FilmTrailerForm.Behavior = createBehavior({
  name: "FilmTrailerForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "FilmTrailerForm",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildFilmTrailerFormDesignerDefaults(node),
      propsSchema: filmTrailerFormSchema,
    };
  },
  designerLocales: AllLocales.FilmTrailerForm,
});

FilmTrailerForm.Resource = createResource({
  icon: resourceIcons.filmAgeRating,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Film Age Rating",
        title:"",
        "x-component": "FilmTrailerForm",
        "x-component-props": {
          titleEn: defaultTitleEn(),
          titleAr: defaultTitleAr(),
        },
      },
    },
  ],
});
