import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC } from "@designable/react";
import { ISchema } from "@formily/react";
import { AllLocales } from "../../locales";
import { MemberListField } from "./MemberListField";
import i18n from "@/localization/config";
import { resourceIcons } from "../../assets/resource-icons";

export const FilmingTeam: DnFC<
  React.ComponentProps<typeof MemberListField>
> = MemberListField;

const memberListSchema: ISchema = {
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
              title: "Label Name",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t("FilmingTeam.designerPlaceholderLabelName", {
                  lng: "en",
                }),
              },
            },
            labelNameAr: {
              type: "string",
              title: "Label Name(Ar)",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t("FilmingTeam.designerPlaceholderLabelName", {
                  lng: "ar",
                }),
              },
            },
            existingMemberButtonLabelEn: {
              type: "string",
              title: "Existing Member Button Label",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "FilmingTeam.designerPlaceholderExistingMemberButtonLabel",
                  { lng: "en" },
                ),
              },
            },
            existingMemberButtonLabelAr: {
              type: "string",
              title: "Existing Member Button Label(Ar)",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "FilmingTeam.designerPlaceholderExistingMemberButtonLabel",
                  { lng: "ar" },
                ),
              },
            },
            newMemberButtonLabelEn: {
              type: "string",
              title: "New Member Button Label",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "FilmingTeam.designerPlaceholderNewMemberButtonLabel",
                  { lng: "en" },
                ),
              },
            },
            newMemberButtonLabelAr: {
              type: "string",
              title: "New Member Button Label(Ar)",
              "x-decorator": "FormItem",
              "x-component": "Input",
              "x-component-props": {
                placeholder: i18n.t(
                  "FilmingTeam.designerPlaceholderNewMemberButtonLabel",
                  { lng: "ar" },
                ),
              },
            },
            memberLimits: {
              type: "number",
              title: "Member Limits",
              "x-decorator": "FormItem",
              "x-component": "NumberPicker",
              "x-component-props": {
                min: 1,
              },
            },
            showEmiratesId: {
              type: "boolean",
              title: "Emirates ID",
              "x-decorator": "FormItem",
              "x-component": "Switch",
              "x-component-props": {
                defaultChecked: true,
              },
            },
            showUID: {
              type: "boolean",
              title: "UAE Unified Number (UID)",
              "x-decorator": "FormItem",
              "x-component": "Switch",
              "x-component-props": {
                defaultChecked: true,
              },
            },
            showPassport: {
              type: "boolean",
              title: "Passport",
              "x-decorator": "FormItem",
              "x-component": "Switch",
              "x-component-props": {
                defaultChecked: true,
              },
            },
          },
        },
      },
    },
  },
};

FilmingTeam.Behavior = createBehavior({
  name: "FilmingTeam",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "FilmingTeam",
  designerProps(node) {
    const xcp = node.props?.["x-component-props"] || {};
    return {
      defaultProps: {
        "x-component-props": {
          labelNameEn:
            xcp.labelNameEn ??
            xcp.labelName ??
            i18n.t("FilmingTeam.defaultLabelName", { lng: "en" }),
          labelNameAr:
            xcp.labelNameAr ??
            i18n.t("FilmingTeam.defaultLabelName", { lng: "ar" }),
          existingMemberButtonLabelEn:
            xcp.existingMemberButtonLabelEn ??
            xcp.existingMemberButtonLabel ??
            i18n.t("FilmingTeam.defaultExistingMemberButtonLabel", {
              lng: "en",
            }),
          existingMemberButtonLabelAr:
            xcp.existingMemberButtonLabelAr ??
            i18n.t("FilmingTeam.defaultExistingMemberButtonLabel", {
              lng: "ar",
            }),
          newMemberButtonLabelEn:
            xcp.newMemberButtonLabelEn ??
            xcp.newMemberButtonLabel ??
            i18n.t("FilmingTeam.defaultNewMemberButtonLabel", { lng: "en" }),
          newMemberButtonLabelAr:
            xcp.newMemberButtonLabelAr ??
            i18n.t("FilmingTeam.defaultNewMemberButtonLabel", { lng: "ar" }),
        },
      },
      propsSchema: memberListSchema,
    };
  },
  designerLocales: AllLocales.FilmingTeam,
});

FilmingTeam.Resource = createResource({
  icon: resourceIcons.filmingTeam,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Filming Team",
        "x-decorator": "FormItem",
        "x-component": "FilmingTeam",
        "x-component-props": {
          labelName: i18n.t("FilmingTeam.defaultLabelName", {
            lng: "en",
          }),
          labelNameEn: i18n.t("FilmingTeam.defaultLabelName", {
            lng: "en",
          }),
          labelNameAr: i18n.t("FilmingTeam.defaultLabelName", {
            lng: "ar",
          }),
          existingMemberButtonLabel: i18n.t(
            "FilmingTeam.defaultExistingMemberButtonLabel",
            {
              lng: "en",
            },
          ),
          existingMemberButtonLabelEn: i18n.t(
            "FilmingTeam.defaultExistingMemberButtonLabel",
            {
              lng: "en",
            },
          ),
          existingMemberButtonLabelAr: i18n.t(
            "FilmingTeam.defaultExistingMemberButtonLabel",
            {
              lng: "ar",
            },
          ),
          newMemberButtonLabel: i18n.t(
            "FilmingTeam.defaultNewMemberButtonLabel",
            {
              lng: "en",
            },
          ),
          newMemberButtonLabelEn: i18n.t(
            "FilmingTeam.defaultNewMemberButtonLabel",
            {
              lng: "en",
            },
          ),
          newMemberButtonLabelAr: i18n.t(
            "FilmingTeam.defaultNewMemberButtonLabel",
            {
              lng: "ar",
            },
          ),
          showEmiratesId: true,
          showUID: true,
          showPassport: true,
        },
      },
    },
  ],
});
