import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import type { ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { ProfileFormField } from "./ProfileFormField";
import i18n from "@/localization/config";

function defaultTitleEn() {
  return i18n.t("ProfileForm.defaultCardTitle", { lng: "en" });
}

function defaultTitleAr() {
  return i18n.t("ProfileForm.defaultCardTitle", { lng: "ar" });
}

function buildProfileFormDesignerDefaults(node: {
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

export const ProfileForm: DnFC<
  React.ComponentProps<typeof ProfileFormField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="profile-form-designable-preview-root">
      <ProfileFormField {...props} />
    </div>
  );
});

const profileFormSchema: ISchema = {
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

ProfileForm.Behavior = createBehavior({
  name: "ProfileForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "ProfileForm",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildProfileFormDesignerDefaults(node),
      propsSchema: profileFormSchema,
    };
  },
  designerLocales: AllLocales.ProfileForm,
});

ProfileForm.Resource = createResource({
  icon: resourceIcons.profileForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Profile Form",
        title: "",
        "x-decorator": "FormItem",
        "x-component": "ProfileForm",
        "x-component-props": {
          titleEn: defaultTitleEn(),
          titleAr: defaultTitleAr(),
        },
      },
    },
  ],
});
