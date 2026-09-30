import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { FileUploadGridField } from "./FileUploadGridField";
import i18n from "@/localization/config";

function defaultTitleEn() {
  return i18n.t("ImageList.defaultCardTitle", { lng: "en" });
}

function defaultTitleAr() {
  return i18n.t("ImageList.defaultCardTitle", { lng: "ar" });
}

function buildFileUploadGridDesignerDefaults(node: {
  props?: Record<string, unknown>;
}) {
  const xcp = (node.props?.["x-component-props"] ?? {}) as Record<
    string,
    unknown
  >;
  const legacyTitle =
    typeof node.props?.title === "string" ? node.props.title : undefined;

  return {
    title:
      legacyTitle ??
      (typeof xcp.titleEn === "string" ? xcp.titleEn : undefined) ??
      defaultTitleEn(),
    "x-component-props": {
      titleEn:
        (typeof xcp.titleEn === "string" ? xcp.titleEn : undefined) ??
        legacyTitle ??
        defaultTitleEn(),
      titleAr:
        (typeof xcp.titleAr === "string" ? xcp.titleAr : undefined) ??
        defaultTitleAr(),
      descriptionEn:
        typeof xcp.descriptionEn === "string" ? xcp.descriptionEn : "",
      descriptionAr:
        typeof xcp.descriptionAr === "string" ? xcp.descriptionAr : "",
      addButtonLabel:
        typeof xcp.addButtonLabel === "string" ? xcp.addButtonLabel : "",
      maxImages: (() => {
        const raw = xcp.maxImages;
        return typeof raw === "number" && Number.isFinite(raw)
          ? Math.min(12, Math.max(1, raw))
          : 4;
      })(),
    },
  };
}

export const FileUploadGrid: DnFC<Record<string, unknown>> = observer(
  (props) => {
    const nodeId = useNodeIdProps();
    return (
      <div {...nodeId} className="file-upload-grid-designable-preview-root">
        <FileUploadGridField {...props} />
      </div>
    );
  },
);

FileUploadGrid.Behavior = createBehavior({
  name: "FileUploadGrid",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "FileUploadGrid",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildFileUploadGridDesignerDefaults(node),
      propsSchema: AllSchemas.FileUploadGrid,
    };
  },
  designerLocales: AllLocales.FileUploadGrid,
});

FileUploadGrid.Resource = createResource({
  icon: resourceIcons.imageList,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "fileUploadGrid",
        title:'',
        "x-decorator": "FormItem",
        "x-component": "FileUploadGrid",
        "x-decorator-props": { colon: false, label: false },
        "x-component-props": {
          title: defaultTitleEn(),
          titleEn: defaultTitleEn(),
          titleAr: defaultTitleAr(),
          descriptionEn: "",
          descriptionAr: "",
          addButtonLabel: "",
          maxImages: 4,
        },
      },
    },
  ],
});
