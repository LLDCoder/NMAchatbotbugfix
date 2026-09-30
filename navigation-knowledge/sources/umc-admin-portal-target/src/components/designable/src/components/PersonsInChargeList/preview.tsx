import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { PersonsInChargeListField } from "./PersonsInChargeListField";
import i18n from "@/localization/config";
import { asOptionalString } from "@/components/designable/src/utils/bilingual";

export const PersonsInChargeList: DnFC<
  React.ComponentProps<typeof PersonsInChargeListField>
> = PersonsInChargeListField;

function buildPersonsInChargeDesignerDefaults(
  node: { props?: Record<string, unknown> } | undefined,
) {
  const rawProps = node?.props ?? {};
  const xcpRaw = rawProps["x-component-props"];
  const base =
    typeof xcpRaw === "object" && xcpRaw !== null && !Array.isArray(xcpRaw)
      ? { ...(xcpRaw as Record<string, unknown>) }
      : {};

  const legacyTitle = asOptionalString(base.title);
  const legacyAddButtonLabel = asOptionalString(base.addButtonLabel);

  delete base.title;
  delete base.addButtonLabel;

  const titleEn =
    asOptionalString(base.titleEn) ??
    legacyTitle ??
    i18n.t("PersonsInChargeList.defaultTitle", { lng: "en" });
  const titleAr =
    asOptionalString(base.titleAr) ??
    i18n.t("PersonsInChargeList.defaultTitle", { lng: "ar" });
  const addButtonLabelEn =
    asOptionalString(base.addButtonLabelEn) ??
    legacyAddButtonLabel ??
    i18n.t("PersonsInChargeList.defaultAddButton", { lng: "en" });
  const addButtonLabelAr =
    asOptionalString(base.addButtonLabelAr) ??
    i18n.t("PersonsInChargeList.defaultAddButton", { lng: "ar" });

  return {
    ...rawProps,
    "x-component-props": {
      ...base,
      titleEn,
      titleAr,
      addButtonLabelEn,
      addButtonLabelAr,
    },
  };
}

PersonsInChargeList.Behavior = createBehavior({
  name: "PersonsInChargeList",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "PersonsInChargeList",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildPersonsInChargeDesignerDefaults(node),
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
                  titleEn: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                    "x-component-props": {
                      placeholder: i18n.t(
                        "PersonsInChargeList.designerPlaceholderTitleEn",
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
                        "PersonsInChargeList.designerPlaceholderTitleAr",
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
                        "PersonsInChargeList.designerPlaceholderAddButtonEn",
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
                        "PersonsInChargeList.designerPlaceholderAddButtonAr",
                        { lng: "ar" },
                      ),
                    },
                  },
                  maxMembers: {
                    type: "number",
                    "x-decorator": "FormItem",
                    "x-component": "NumberPicker",
                    "x-component-props": {
                      min: 1,
                    },
                  },
                  showEmiratesId: {
                    type: "boolean",
                    "x-decorator": "FormItem",
                    "x-component": "Switch",
                    "x-component-props": {
                      defaultChecked: true,
                    },
                  },
                  showUID: {
                    type: "boolean",
                    "x-decorator": "FormItem",
                    "x-component": "Switch",
                    "x-component-props": {
                      defaultChecked: false,
                    },
                  },
                  showPassport: {
                    type: "boolean",
                    "x-decorator": "FormItem",
                    "x-component": "Switch",
                    "x-component-props": {
                      defaultChecked: false,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  },
  designerLocales: AllLocales.PersonsInChargeList,
});

const defaultTitleEn = i18n.t("PersonsInChargeList.defaultTitle", { lng: "en" });
const defaultTitleAr = i18n.t("PersonsInChargeList.defaultTitle", { lng: "ar" });
const defaultAddButtonEn = i18n.t("PersonsInChargeList.defaultAddButton", {
  lng: "en",
});
const defaultAddButtonAr = i18n.t("PersonsInChargeList.defaultAddButton", {
  lng: "ar",
});

PersonsInChargeList.Resource = createResource({
  icon: resourceIcons.personInCharge,
  elements: [
    {
      componentName: "Field",
      props: {
        name: defaultTitleEn,
        "x-decorator": "FormItem",
        "x-component": "PersonsInChargeList",
        'x-decorator-props': { colon: false, label: false },
        "x-component-props": {
          title: defaultTitleEn,
          titleEn: defaultTitleEn,
          titleAr: defaultTitleAr,
          addButtonLabel: defaultAddButtonEn,
          addButtonLabelEn: defaultAddButtonEn,
          addButtonLabelAr: defaultAddButtonAr,
          showEmiratesId: true,
          showUID: false,
          showPassport: false,
        },
      },
    },
  ],
});
