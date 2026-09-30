import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { connect, mapProps } from "@formily/react";
import { DnFC } from "@designable/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import FilmsUrlsListField from "./UrlList";
import i18n from "@/localization/config";
import { asOptionalString } from "@/components/designable/src/utils/bilingual";

function buildUrlListDesignerDefaults(
  node:
    | {
        props?: Record<string, unknown>;
      }
    | undefined,
) {
  const rawProps = node?.props ?? {};
  const xcpRaw = rawProps["x-component-props"];
  const xdpRaw = rawProps["x-decorator-props"];
  const componentProps =
    typeof xcpRaw === "object" && xcpRaw !== null && !Array.isArray(xcpRaw)
      ? { ...(xcpRaw as Record<string, unknown>) }
      : {};
  const decoratorProps =
    typeof xdpRaw === "object" && xdpRaw !== null && !Array.isArray(xdpRaw)
      ? { ...(xdpRaw as Record<string, unknown>) }
      : {};

  const legacyTitle =
    asOptionalString(componentProps.title) ?? asOptionalString(rawProps.title);
  const legacyAddButtonText = asOptionalString(componentProps.addButtonText);
  const legacyTooltip = asOptionalString(decoratorProps.tooltip);

  delete componentProps.title;
  delete componentProps.addButtonText;
  delete decoratorProps.tooltip;

  return {
    ...rawProps,
    title: "",
    name:
      typeof rawProps.name === "string" && rawProps.name !== ""
        ? rawProps.name
        : "urlList",
    "x-component-props": {
      ...componentProps,
      titleEn:
        asOptionalString(componentProps.titleEn) ??
        legacyTitle ??
        i18n.t("UrlList.defaultTitle", { lng: "en" }),
      titleAr:
        asOptionalString(componentProps.titleAr) ??
        i18n.t("UrlList.defaultTitle", { lng: "ar" }),
      addButtonTextEn:
        asOptionalString(componentProps.addButtonTextEn) ??
        legacyAddButtonText ??
        i18n.t("UrlList.defaultAddButton", { lng: "en" }),
      addButtonTextAr:
        asOptionalString(componentProps.addButtonTextAr) ??
        i18n.t("UrlList.defaultAddButton", { lng: "ar" }),
    },
    "x-decorator-props": {
      ...decoratorProps,
      tooltipEn:
        asOptionalString(decoratorProps.tooltipEn) ?? legacyTooltip ?? "",
      tooltipAr:
        asOptionalString(decoratorProps.tooltipAr) ?? legacyTooltip ?? "",
    },
  };
}

export const UrlList: DnFC<React.ComponentProps<typeof FilmsUrlsListField>> = connect(
  FilmsUrlsListField,
  mapProps((props, field) => {
    return {
      ...props,
      designMode: field?.designable ? true : false,
    };
  }),
);

UrlList.Behavior = createBehavior({
  name: "UrlList",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "UrlList",
  designerProps(node) {
    return {
      defaultProps: buildUrlListDesignerDefaults(node),
      propsSchema: {
        type: "object",
        properties: {
          "x-component-props": {
            type: "object",
            properties: {
              titleEn: {
                type: "string",
                "x-decorator": "FormItem",
                "x-component": "Input",
                "x-component-props": {
                  placeholder: i18n.t("UrlList.designerPlaceholderTitleEn", {
                    lng: "en",
                  }),
                },
              },
              titleAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-component": "Input",
                "x-component-props": {
                  placeholder: i18n.t("UrlList.designerPlaceholderTitleAr", {
                    lng: "ar",
                  }),
                },
              },
              addButtonTextEn: {
                type: "string",
                "x-decorator": "FormItem",
                "x-component": "Input",
                "x-component-props": {
                  placeholder: i18n.t(
                    "UrlList.designerPlaceholderAddButtonEn",
                    { lng: "en" },
                  ),
                },
              },
              addButtonTextAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-component": "Input",
                "x-component-props": {
                  placeholder: i18n.t(
                    "UrlList.designerPlaceholderAddButtonAr",
                    { lng: "ar" },
                  ),
                },
              },
              maxItems: {
                type: "number",
                "x-decorator": "FormItem",
                "x-component": "NumberPicker",
                default: 3,
                "x-decorator-props": {
                  tooltip: "Maximum Quantity: 12",
                },
                "x-component-props": {
                  min: 1,
                  max: 12,
                },
              },
              fileSizeLimit: {
                type: "number",
                "x-decorator": "FormItem",
                "x-component": "NumberPicker",
                default: 100,
                "x-decorator-props": {
                  tooltip: "Default: 100MB, configurable up to 200MB",
                },
                "x-component-props": {
                  min: 1,
                  max: 200,
                },
              },
            },
          },
          "x-decorator-props": {
            type: "object",
            properties: {
              tooltipEn: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component": "DescriptionRichTextSetter",
                "x-component-props": {
                  lang: "en",
                },
              },
              tooltipAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component": "DescriptionRichTextSetter",
                "x-component-props": {
                  lang: "ar",
                },
              },
            },
          },
          required: {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "Switch",
          },
          "x-display": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "StringSwitchSetter",
            default: "visible",
            "x-component-props": {
              checkedValue: "visible",
              unCheckedValue: "none",
            },
          },
          "x-pattern": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "StringSwitchSetter",
            default: "editable",
            "x-component-props": {
              checkedValue: "editable",
              unCheckedValue: "disabled",
            },
          },
        },
      },
    };
  },
  designerLocales: AllLocales.UrlList,
});

const defaultTitleEn = i18n.t("UrlList.defaultTitle", { lng: "en" });
const defaultTitleAr = i18n.t("UrlList.defaultTitle", { lng: "ar" });
const defaultAddButtonEn = i18n.t("UrlList.defaultAddButton", { lng: "en" });
const defaultAddButtonAr = i18n.t("UrlList.defaultAddButton", { lng: "ar" });

UrlList.Resource = createResource({
  title: "",
  icon: resourceIcons.urlList,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "array",
        name: "urlList",
        "x-decorator": "FormItem",
        "x-component": "UrlList",
        "x-component-props": {
          addButtonText: defaultAddButtonEn,
          addButtonTextEn: defaultAddButtonEn,
          addButtonTextAr: defaultAddButtonAr,
          maxItems: 3,
          title: defaultTitleEn,
          titleEn: defaultTitleEn,
          titleAr: defaultTitleAr,
          fileSizeLimit: 100,
        },
        "x-decorator-props": {
          tooltip: "",
          tooltipEn: "",
          tooltipAr: "",
          colon: false,
          label: false,
        },
      },
    },
  ],
});

export default UrlList;
