import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { connect, mapProps } from "@formily/react";
import type { DnFC } from "@designable/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import PressCardSelectorInner from "./PressCardSelector";
import i18n from "@/localization/config";
import { buildBilingualComponentDefaults } from "@/components/designable/src/utils/bilingual";

function defaultTitleEn() {
  return i18n.t("PressCardSelector.defaultTitle", { lng: "en" });
}

function defaultTitleAr() {
  return i18n.t("PressCardSelector.defaultTitle", { lng: "ar" });
}

function defaultPlaceholderEn() {
  return i18n.t("PressCardSelector.defaultPlaceholder", { lng: "en" });
}

function defaultPlaceholderAr() {
  return i18n.t("PressCardSelector.defaultPlaceholder", { lng: "ar" });
}

export const PressCardSelector: DnFC<
  React.ComponentProps<typeof PressCardSelectorInner>
> = connect(
  PressCardSelectorInner,
  mapProps((props, field) => ({
    ...props,
    designMode: field?.designable ? true : false,
  })),
);

PressCardSelector.Behavior = createBehavior({
  name: "PressCardSelector",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "PressCardSelector",
  designerProps(node) {
    return {
      defaultProps: buildBilingualComponentDefaults(node, {
        defaultTitleEn: defaultTitleEn(),
        defaultTitleAr: defaultTitleAr(),
        defaultPlaceholderEn: defaultPlaceholderEn(),
        defaultPlaceholderAr: defaultPlaceholderAr(),
      }),
      propsSchema: AllSchemas.PressCardSelector,
    };
  },
  designerLocales: AllLocales.PressCardSelector,
});

PressCardSelector.Resource = createResource({
  icon: resourceIcons.pressCardSelector,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "string",
        name: "pressCardSelector",
        title: defaultTitleEn(),
        "x-decorator": "FormItem",
        "x-component": "PressCardSelector",
        "x-component-props": {
          titleEn: defaultTitleEn(),
          titleAr: defaultTitleAr(),
          placeholderEn: defaultPlaceholderEn(),
          placeholderAr: defaultPlaceholderAr(),
        },
      },
    },
  ],
});

export default PressCardSelector;
