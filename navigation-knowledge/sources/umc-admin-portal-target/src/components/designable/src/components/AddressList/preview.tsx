import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import { FilmingLocationsField } from "./AddressList";
import i18n from "@/localization/config";
import { asOptionalString } from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

const addressListPropsSchema = {
  type: "object",
  properties: {
    "x-component-props": {
      type: "object",
      properties: {
        labelNameEn: {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("AddressList.designerPlaceholderLabelNameEn", {
              lng: "en",
            }),
          },
        },
        labelNameAr: {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t("AddressList.designerPlaceholderLabelNameAr", {
              lng: "ar",
            }),
          },
        },
        addButtonLabelEn: {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t(
              "AddressList.designerPlaceholderAddButtonEn",
              {
                lng: "en",
              },
            ),
          },
        },
        addButtonLabelAr: {
          type: "string",
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            placeholder: i18n.t(
              "AddressList.designerPlaceholderAddButtonAr",
              {
                lng: "ar",
              },
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
    "x-display": {
      type: "boolean",
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
};

function buildAddressListDesignerDefaults(node: {
  props?: Record<string, unknown>;
} | undefined) {
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
  delete decorator.tooltip;

  return {
    ...rawProps,
    name:
      typeof rawProps.name === "string" && rawProps.name !== ""
        ? rawProps.name
        : "filmingLocations",
    "x-component-props": {
      ...base,
      labelNameEn:
        asOptionalString(base.labelNameEn) ??
        legacyLabelName ??
        i18n.t("AddressList.defaultLabelName", { lng: "en" }),
      labelNameAr:
        asOptionalString(base.labelNameAr) ??
        i18n.t("AddressList.defaultLabelName", { lng: "ar" }),
      addButtonLabelEn:
        asOptionalString(base.addButtonLabelEn) ??
        legacyAddButtonLabel ??
        i18n.t("AddressList.defaultAddButton", { lng: "en" }),
      addButtonLabelAr:
        asOptionalString(base.addButtonLabelAr) ??
        i18n.t("AddressList.defaultAddButton", { lng: "ar" }),
    },
    "x-decorator-props": {
      ...decorator,
      tooltipEn:
        asOptionalString(decorator.tooltipEn) ?? legacyTooltip ?? "",
      tooltipAr:
        asOptionalString(decorator.tooltipAr) ?? legacyTooltip ?? "",
    },
  };
}

export const AddressList: DnFC<
  React.ComponentProps<typeof FilmingLocationsField>
> = FilmingLocationsField;

AddressList.Behavior = createBehavior({
  name: "AddressList",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "AddressList",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildAddressListDesignerDefaults(node),
      propsSchema: addressListPropsSchema,
    };
  },
  designerLocales: AllLocales.AddressList,
});

const defaultLabelNameEn = i18n.t("AddressList.defaultLabelName", { lng: "en" });
const defaultLabelNameAr = i18n.t("AddressList.defaultLabelName", { lng: "ar" });
const defaultAddButtonEn = i18n.t("AddressList.defaultAddButton", {
  lng: "en",
});
const defaultAddButtonAr = i18n.t("AddressList.defaultAddButton", {
  lng: "ar",
});

AddressList.Resource = createResource({
  icon: resourceIcons.addressList,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "filmingLocations",
        "x-decorator": "FormItem",
        "x-component": "AddressList",
        "x-decorator-props": {
          label: false,
          tooltipEn: "",
          tooltipAr: "",
        },
        "x-display": "visible",
        "x-pattern": "editable",
        "x-component-props": {
          labelName: defaultLabelNameEn,
          labelNameEn: defaultLabelNameEn,
          labelNameAr: defaultLabelNameAr,
          addButtonLabel: defaultAddButtonEn,
          addButtonLabelEn: defaultAddButtonEn,
          addButtonLabelAr: defaultAddButtonAr,
        },
      },
    },
  ],
});
