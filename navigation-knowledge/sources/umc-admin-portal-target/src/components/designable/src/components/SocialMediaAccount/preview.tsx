import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import type { ISchema } from "@formily/react";
import { AllLocales } from "../../locales";
import { SocialMediaAccountField } from "./SocialMediaAccountField";
import i18n from "@/localization/config";
import { asOptionalString } from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

export const SocialMediaAccount: DnFC<
  React.ComponentProps<typeof SocialMediaAccountField>
> = SocialMediaAccountField;

const socialMediaAccountSchema: ISchema = {
  type: "object",
  properties: {
    "field-group": {
      type: "void",
      "x-component": "CollapseItem",
      properties: {
        "x-component-props": {
          type: "object",
          properties: {
            titleEn: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "SocialMediaAccount.designerPlaceholderTitleEn",
                  { lng: "en" },
                ),
              },
            },
            titleAr: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "SocialMediaAccount.designerPlaceholderTitleAr",
                  { lng: "ar" },
                ),
              },
            },
            addButtonLabelEn: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "SocialMediaAccount.designerPlaceholderAddButtonEn",
                  { lng: "en" },
                ),
              },
            },
            addButtonLabelAr: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "SocialMediaAccount.designerPlaceholderAddButtonAr",
                  { lng: "ar" },
                ),
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
  },
};

function buildSocialMediaAccountDesignerDefaults(node: {
  props?: Record<string, unknown>;
}) {
  const rawProps = node?.props ?? {};
  const xcpRaw = rawProps["x-component-props"];
  const xdpRaw = rawProps["x-decorator-props"];
  const base =
    typeof xcpRaw === "object" && xcpRaw !== null && !Array.isArray(xcpRaw)
      ? { ...(xcpRaw as Record<string, unknown>) }
      : {};
  const decorator =
    typeof xdpRaw === "object" && xdpRaw !== null && !Array.isArray(xdpRaw)
      ? { ...(xdpRaw as Record<string, unknown>) }
      : {};

  const legacyLabelName = asOptionalString(base.labelName);
  const legacyAddButtonLabel = asOptionalString(base.addButtonLabel);
  const legacyTooltip = asOptionalString(decorator.tooltip);

  delete base.labelName;
  delete base.addButtonLabel;

  return {
    ...rawProps,
    name:
      typeof rawProps.name === "string" && rawProps.name !== ""
        ? rawProps.name
        : "socialMediaAccounts",
    "x-component-props": {
      ...base,
      titleEn:
        asOptionalString(base.titleEn) ??
        legacyLabelName ??
        i18n.t("SocialMediaAccount.defaultTitle", { lng: "en" }),
      titleAr:
        asOptionalString(base.titleAr) ??
        i18n.t("SocialMediaAccount.defaultTitle", { lng: "ar" }),
      addButtonLabelEn:
        asOptionalString(base.addButtonLabelEn) ??
        legacyAddButtonLabel ??
        i18n.t("SocialMediaAccount.defaultAddButtonLabel", { lng: "en" }),
      addButtonLabelAr:
        asOptionalString(base.addButtonLabelAr) ??
        i18n.t("SocialMediaAccount.defaultAddButtonLabel", { lng: "ar" }),
    },
    "x-decorator-props": {
      ...decorator,
      tooltipEn: asOptionalString(decorator.tooltipEn) ?? legacyTooltip ?? "",
      tooltipAr: asOptionalString(decorator.tooltipAr) ?? legacyTooltip ?? "",
    },
  };
}

SocialMediaAccount.Behavior = createBehavior({
  name: "SocialMediaAccount",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "SocialMediaAccount",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildSocialMediaAccountDesignerDefaults(node),
      propsSchema: socialMediaAccountSchema,
    };
  },
  designerLocales: AllLocales.SocialMediaAccount,
});

SocialMediaAccount.Resource = createResource({
  icon: resourceIcons.socialMediaAccount,
  // title:'',
  elements: [
    {
      componentName: "Field",
      props: {
        // name: "",
        "x-decorator": "FormItem",
        "x-component": "SocialMediaAccount",
        "x-component-props": {
          labelName: i18n.t("SocialMediaAccount.defaultTitle", { lng: "en" }),
          titleEn: i18n.t("SocialMediaAccount.defaultTitle", {
            lng: "en",
          }),
          titleAr: i18n.t("SocialMediaAccount.defaultTitle", {
            lng: "ar",
          }),
          addButtonLabel: i18n.t("SocialMediaAccount.defaultAddButtonLabel", {
            lng: "en",
          }),
          addButtonLabelEn: i18n.t("SocialMediaAccount.defaultAddButtonLabel", {
            lng: "en",
          }),
          addButtonLabelAr: i18n.t("SocialMediaAccount.defaultAddButtonLabel", {
            lng: "ar",
          }),
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
