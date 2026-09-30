import React from "react";
import { createBehavior, createResource } from "@designable/core";
import { DnFC, useTreeNode, useNodeIdProps } from "@designable/react";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { observer } from "@formily/react";
import VideoPlayerCore from "./components/VideoPlayerCore";
import "./styles.less";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

function resolveTitle(
  xcp: Record<string, unknown>,
  lang: string,
  host: "designer" | "runtime",
): string {
  const raw = getBilingualValueByLang({
    lang: lang === "ar" ? "ar" : "en",
    host,
    en: xcp.titleEn,
    ar: xcp.titleAr,
    legacy: typeof xcp.labelName === "string" ? xcp.labelName : undefined,
    fallback: "",
  });
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }
  if (host === "designer") {
    return "";
  }
  return i18n.t("Video.defaultTitle", {
    lng: lang === "ar" ? "ar" : "en",
  });
}

function buildVideoDesignerDefaults(node: any) {
  const xcp = (node.props?.["x-component-props"] ?? {}) as Record<
    string,
    unknown
  >;
  const xdp = (node.props?.["x-decorator-props"] ?? {}) as Record<
    string,
    unknown
  >;
  const legacyTitle =
    typeof node.props?.title === "string" ? node.props.title : undefined;
  const legacyLabelName =
    typeof xcp.labelName === "string" ? xcp.labelName : undefined;
  const legacyTooltip =
    typeof xdp.tooltip === "string" ? xdp.tooltip : undefined;

  return {
    title:
      legacyTitle ??
      (typeof xcp.titleEn === "string" ? xcp.titleEn : undefined) ??
      legacyLabelName ??
      i18n.t("Video.defaultTitle", { lng: "en" }),
    "x-component-props": {
      titleEn:
        (typeof xcp.titleEn === "string" ? xcp.titleEn : undefined) ??
        legacyTitle ??
        legacyLabelName ??
        i18n.t("Video.defaultTitle", { lng: "en" }),
      titleAr:
        (typeof xcp.titleAr === "string" ? xcp.titleAr : undefined) ??
        i18n.t("Video.defaultTitle", { lng: "ar" }),
      description: xcp.description ?? false,
      videoUrl: xcp.videoUrl,
      requiredViewing: xcp.requiredViewing ?? true,
      visible: xcp.visible ?? true,
    },
    "x-decorator-props": {
      tooltipEn:
        (typeof xdp.tooltipEn === "string" ? xdp.tooltipEn : undefined) ??
        legacyTooltip ??
        "",
      tooltipAr:
        (typeof xdp.tooltipAr === "string" ? xdp.tooltipAr : undefined) ??
        legacyTooltip ??
        "",
    },
  };
}

export const Video: DnFC<any> = observer(() => {
  const node = useTreeNode();
  const nodeId = useNodeIdProps();
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();

  const xcp = (node?.props?.["x-component-props"] ??
    {}) as Record<string, unknown>;
  const labelText = resolveTitle(xcp, lang, host);
  const { videoUrl } = xcp;
  void labelText;

  return (
    <div {...nodeId} className="video-field-wrapper">
      <div className="video-field-container">
        {/* <div className="video-field-label">
          {showTooltip ? (
            <Tooltip title={tooltipTitle}>{labelEl}</Tooltip>
          ) : (
            labelEl
          )}
        </div> */}

        <div className="video-field-content">
          <VideoPlayerCore videoUrl={videoUrl as string | undefined} />
        </div>
      </div>
    </div>
  );
});

Video.Behavior = createBehavior({
  name: "Video",
  extends: ["Field"],
  selector: (node) => node.props["x-component"] === "Video",
  designerProps(node: any) {
    return {
      defaultProps: buildVideoDesignerDefaults(node),
      propsSchema: AllSchemas.Video,
    };
  },
  designerLocales: AllLocales.Video,
});

Video.Resource = createResource({
  icon: resourceIcons.video,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Video",
        title: i18n.t("Video.defaultTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "Video",
        "x-component-props": {
          title: i18n.t("Video.defaultTitle", { lng: "en" }),
          titleEn: i18n.t("Video.defaultTitle", { lng: "en" }),
          titleAr: i18n.t("Video.defaultTitle", { lng: "ar" }),
          description: true,
          requiredViewing: true,
          visible: true,
        },
        "x-decorator-props": {
          tooltip: '',
          tooltipEn: "",
          tooltipAr: "", 
        },
      },
    },
  ],
});

export default Video;
