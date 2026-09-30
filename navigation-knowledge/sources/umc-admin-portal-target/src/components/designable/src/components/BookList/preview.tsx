import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { observer } from "@formily/react";
import { BookListUploadField } from "./BookListUploadField";
import i18n from "@/localization/config";

function buildBookListDesignerDefaults(node: {
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
      i18n.t("BookList.defaultCardTitle", { lng: "en" }),
    "x-component-props": {
      titleEn:
        (typeof xcp.titleEn === "string" ? xcp.titleEn : undefined) ??
        legacyTitle ??
        i18n.t("BookList.defaultCardTitle", { lng: "en" }),
      titleAr:
        (typeof xcp.titleAr === "string" ? xcp.titleAr : undefined) ??
        i18n.t("BookList.defaultCardTitle", { lng: "ar" }),
      descriptionEn:
        (typeof xcp.descriptionEn === "string" ? xcp.descriptionEn : undefined) ??
        "",
      descriptionAr:
        (typeof xcp.descriptionAr === "string" ? xcp.descriptionAr : undefined) ??
        "",
    },
  };
}

export const BookList: DnFC<Record<string, unknown>> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div {...nodeId} className="book-list-designable-preview-root">
      <BookListUploadField {...props} />
    </div>
  );
});

BookList.Behavior = createBehavior({
  name: "BookList",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "BookList",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildBookListDesignerDefaults(node),
      propsSchema: AllSchemas.BookList,
    };
  },
  designerLocales: AllLocales.BookList,
});

BookList.Resource = createResource({
  icon: resourceIcons.bookList,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "bookListUpload",
        title: '',
        "x-decorator": "FormItem",
        "x-decorator-props": { colon: false, label: false },
        "x-component": "BookList",
        "x-component-props": {
          title: i18n.t("BookList.defaultCardTitle", { lng: "en" }),
          titleEn: i18n.t("BookList.defaultCardTitle", { lng: "en" }),
          titleAr: i18n.t("BookList.defaultCardTitle", { lng: "ar" }),
          descriptionEn: "",
          descriptionAr: "",
        },
      },
    },
  ],
});
