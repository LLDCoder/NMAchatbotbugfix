import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { PartnerListField } from "./PartnerListField";
import i18n from "@/localization/config";
import { asOptionalString } from "@/components/designable/src/utils/bilingual";

export const PartnerList: DnFC<React.ComponentProps<typeof PartnerListField>> =
  PartnerListField;

function buildPartnerListDesignerDefaults(
  node: { props?: Record<string, unknown> } | undefined,
) {
  const rawProps = node?.props ?? {};
  const xcpRaw = rawProps["x-component-props"];
  const xdpRaw = rawProps["x-decorator-props"];
  const xcp =
    typeof xcpRaw === "object" && xcpRaw !== null && !Array.isArray(xcpRaw)
      ? { ...(xcpRaw as Record<string, unknown>) }
      : {};
  const xdp =
    typeof xdpRaw === "object" && xdpRaw !== null && !Array.isArray(xdpRaw)
      ? { ...(xdpRaw as Record<string, unknown>) }
      : {};

  const legacyLabelName = asOptionalString(xcp.labelName);
  const legacyAddButtonLabel = asOptionalString(xcp.addButtonLabel);
  const legacyDescription = asOptionalString(xcp.description);
  const legacyTooltip = asOptionalString(xdp.tooltip);

  delete xcp.labelName;
  delete xcp.addButtonLabel;
  delete xcp.description;
  delete xdp.tooltip;

  const labelNameEn =
    asOptionalString(xcp.labelNameEn) ??
    legacyLabelName ??
    i18n.t("PartnerList.defaultLabelName", { lng: "en" });
  const labelNameAr =
    asOptionalString(xcp.labelNameAr) ??
    i18n.t("PartnerList.defaultLabelName", { lng: "ar" });
  const addButtonLabelEn =
    asOptionalString(xcp.addButtonLabelEn) ??
    legacyAddButtonLabel ??
    i18n.t("PartnerList.defaultAddButton", { lng: "en" });
  const addButtonLabelAr =
    asOptionalString(xcp.addButtonLabelAr) ??
    i18n.t("PartnerList.defaultAddButton", { lng: "ar" });
  const tooltipEn =
    asOptionalString(xdp.tooltipEn) ?? legacyTooltip ?? legacyDescription ?? "";
  const tooltipAr = asOptionalString(xdp.tooltipAr) ?? "";

  return {
    ...rawProps,
    "x-component-props": {
      ...xcp,
      labelNameEn,
      labelNameAr,
      addButtonLabelEn,
      addButtonLabelAr,
    },
    "x-decorator-props": {
      ...xdp,
      tooltipEn,
      tooltipAr,
    },
  };
}

PartnerList.Behavior = createBehavior({
  name: "PartnerList",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "PartnerList",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildPartnerListDesignerDefaults(node),
      propsSchema: {
        type: "object",
        properties: {
          "field-group": {
            type: "void",
            "x-component": "CollapseItem",
            properties: {
              "x-component-props": {
                type: "object",
                properties: {
                  labelNameEn: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                    "x-component-props": {
                      placeholder: i18n.t(
                        "PartnerList.designerPlaceholderLabelNameEn",
                        { lng: "en" },
                      ),
                    },
                  },
                  labelNameAr: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                    "x-component-props": {
                      placeholder: i18n.t(
                        "PartnerList.designerPlaceholderLabelNameAr",
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
                        "PartnerList.designerPlaceholderAddButtonEn",
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
                        "PartnerList.designerPlaceholderAddButtonAr",
                        { lng: "ar" },
                      ),
                    },
                  },
                  showEmiratesId: {
                    type: "boolean",
                    "x-decorator": "FormItem",
                    "x-component": "Switch",
                    "x-component-props": {
                      defaultChecked: true,
                    },
                    default: true,
                  },
                  showUID: {
                    type: "boolean",
                    "x-decorator": "FormItem",
                    "x-component": "Switch",
                    "x-component-props": {
                      defaultChecked: true,
                    },
                    default: true,
                  },
                  showPassport: {
                    type: "boolean",
                    "x-decorator": "FormItem",
                    "x-component": "Switch",
                    "x-component-props": {
                      defaultChecked: true,
                    },
                    default: true,
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
                    "x-component-props": {
                      lang: "en",
                    },
                    "x-component": "DescriptionRichTextSetter",
                  },
                  tooltipAr: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-decorator-props": { colon: false, label: " " },
                    "x-component-props": {
                      lang: "ar",
                    },
                    "x-component": "DescriptionRichTextSetter",
                  },
                },
              },
            },
          },
        },
      },
    };
  },
  designerLocales: AllLocales.PartnerList,
});

const defaultLabelNameEn = i18n.t("PartnerList.defaultLabelName", {
  lng: "en",
});
const defaultLabelNameAr = i18n.t("PartnerList.defaultLabelName", {
  lng: "ar",
});
const defaultAddButtonEn = i18n.t("PartnerList.defaultAddButton", {
  lng: "en",
});
const defaultAddButtonAr = i18n.t("PartnerList.defaultAddButton", {
  lng: "ar",
});

PartnerList.Resource = createResource({
  icon: resourceIcons.partnerList,
  elements: [
    {
      componentName: "Field",
      props: {
        name: defaultLabelNameEn,
        "x-decorator": "FormItem",
        "x-component": "PartnerList",
        "x-component-props": {
          labelName: defaultLabelNameEn,
          labelNameEn: defaultLabelNameEn,
          labelNameAr: defaultLabelNameAr,
          addButtonLabel: defaultAddButtonEn,
          addButtonLabelEn: defaultAddButtonEn,
          addButtonLabelAr: defaultAddButtonAr,
          showEmiratesId: true,
          showUID: true,
          showPassport: true,
        },
        "x-decorator-props": {
          tooltipEn: "",
          tooltipAr: "",
          label: false,
          colon: false,
        },
      },
    },
  ],
});
