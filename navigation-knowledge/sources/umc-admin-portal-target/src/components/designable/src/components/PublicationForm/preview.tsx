import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, useTreeNode, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { PublicationFormField } from "./PublicationFormField";
import i18n from "@/localization/config";
import { resourceIcons } from "../../assets/resource-icons";

function defaultTitleEn() {
  return i18n.t("PublicationForm.defaultCardTitle", { lng: "en" });
}

function defaultTitleAr() {
  return i18n.t("PublicationForm.defaultCardTitle", { lng: "ar" });
}

function buildPublicationFormDesignerDefaults(node: {
  props?: Record<string, unknown>;
}) {
  const rawProps = node.props ?? {};
  const xcpRaw = node.props?.["x-component-props"] ?? {};
  const xcp =
    typeof xcpRaw === "object" && xcpRaw !== null && !Array.isArray(xcpRaw)
      ? { ...(xcpRaw as Record<string, unknown>) }
      : {};
  const legacyTitle =
    typeof rawProps.title === "string" ? rawProps.title : undefined;
  const legacyComponentTitle =
    typeof xcp.title === "string" ? xcp.title : undefined;
  delete xcp.title;

  return {
    ...rawProps,
    title: "",
    "x-component-props": {
      ...xcp,
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

export const PublicationForm: DnFC<Record<string, unknown>> = observer(
  (props) => {
    const nodeId = useNodeIdProps();
    const node = useTreeNode();

    React.useEffect(() => {
      const rawProps = node?.props as Record<string, unknown> | undefined;
      if (!rawProps) return;

      const xcpRaw = rawProps["x-component-props"];
      const xcp =
        typeof xcpRaw === "object" && xcpRaw !== null && !Array.isArray(xcpRaw)
          ? { ...(xcpRaw as Record<string, unknown>) }
          : {};
      const xdpRaw = rawProps["x-decorator-props"];
      const xdp =
        typeof xdpRaw === "object" && xdpRaw !== null && !Array.isArray(xdpRaw)
          ? { ...(xdpRaw as Record<string, unknown>) }
          : {};
      const legacyTitle =
        typeof rawProps.title === "string"
          ? rawProps.title
          : typeof xcp.title === "string"
          ? xcp.title
          : undefined;

      let changed = false;

      if (legacyTitle && typeof xcp.titleEn !== "string") {
        xcp.titleEn = legacyTitle;
        changed = true;
      }
      if ("title" in xcp) {
        delete xcp.title;
        changed = true;
      }
      if (rawProps.title !== "") {
        rawProps.title = "";
        changed = true;
      }
      if (xdp.label !== false || xdp.colon !== false) {
        rawProps["x-decorator-props"] = {
          ...xdp,
          label: false,
          colon: false,
        };
        changed = true;
      }
      if (changed) {
        rawProps["x-component-props"] = xcp;
      }
    }, [node]);

    return (
      <div {...nodeId} className="publication-form-designable-preview-root">
        <PublicationFormField {...props} />
      </div>
    );
  },
);

PublicationForm.Behavior = createBehavior({
  name: "PublicationForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "PublicationForm",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildPublicationFormDesignerDefaults(node),
      propsSchema: AllSchemas.PublicationForm,
    };
  },
  designerLocales: AllLocales.PublicationForm,
});

PublicationForm.Resource = createResource({
  icon: resourceIcons.publicationForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Printing Permit",
        title: '',
        "x-decorator": "FormItem",
        "x-component": "PublicationForm",
        'x-decorator-props': { colon: false, label: false },
        "x-component-props": {
          titleEn: defaultTitleEn(),
          titleAr: defaultTitleAr(),
        },
      },
    },
  ],
});
