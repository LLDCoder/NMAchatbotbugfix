import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { connect, mapProps } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { AllSchemas } from "../../schemas";
import { PosterAndTrailerPermitField } from "./PosterAndTrailerPermitField";

const DEFAULT_POSTER_TITLE_EN = "Film Poster";
const DEFAULT_POSTER_TITLE_AR = "ملصق الفيلم";
const DEFAULT_TRAILER_TITLE_EN = "Film Trailer";
const DEFAULT_TRAILER_TITLE_AR = "المقطع الدعائي للفيلم";

export const PosterAndTrailerPermit: DnFC<
  React.ComponentProps<typeof PosterAndTrailerPermitField>
> = connect(
  PosterAndTrailerPermitField,
  mapProps((props, field) => ({
    ...props,
    designMode: field?.designable ? true : false,
  }))
);

PosterAndTrailerPermit.Behavior = createBehavior({
  name: "PosterAndTrailerPermit",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "PosterAndTrailerPermit",
  designerProps(node) {
    const xcp = (node.props?.["x-component-props"] ?? {}) as Record<
      string,
      unknown
    >;
    return {
      defaultProps: {
        name: "posterAndTrailerPermit",
        "x-component-props": {
          posterTitleEn:
            (typeof xcp.posterTitleEn === "string" && xcp.posterTitleEn) ||
            DEFAULT_POSTER_TITLE_EN,
          posterTitleAr:
            (typeof xcp.posterTitleAr === "string" && xcp.posterTitleAr) ||
            DEFAULT_POSTER_TITLE_AR,
          trailerTitleEn:
            (typeof xcp.trailerTitleEn === "string" && xcp.trailerTitleEn) ||
            DEFAULT_TRAILER_TITLE_EN,
          trailerTitleAr:
            (typeof xcp.trailerTitleAr === "string" && xcp.trailerTitleAr) ||
            DEFAULT_TRAILER_TITLE_AR,
          posterMaxCount:
            typeof xcp.posterMaxCount === "number" ? xcp.posterMaxCount : 4,
          trailerMaxCount:
            typeof xcp.trailerMaxCount === "number" ? xcp.trailerMaxCount : 3,
        },
      },
      propsSchema: AllSchemas.PosterAndTrailerPermit,
    };
  },
  designerLocales: AllLocales.PosterAndTrailerPermit,
});

PosterAndTrailerPermit.Resource = createResource({
  title: {
    "en-US": "Poster & Trailer",
    "ar-AE": "الملصق والمقطع الدعائي",
  },
  icon: resourceIcons.posterTrailer,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "posterAndTrailerPermit",
        "x-decorator": "FormItem",
        "x-component": "PosterAndTrailerPermit",
        "x-component-props": {
          posterTitleEn: DEFAULT_POSTER_TITLE_EN,
          posterTitleAr: DEFAULT_POSTER_TITLE_AR,
          trailerTitleEn: DEFAULT_TRAILER_TITLE_EN,
          trailerTitleAr: DEFAULT_TRAILER_TITLE_AR,
          posterMaxCount: 4,
          trailerMaxCount: 3,
        },
      },
    },
  ],
});

export default PosterAndTrailerPermit;
