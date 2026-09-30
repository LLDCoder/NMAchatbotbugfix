import type { ISchema } from "@formily/react";
import i18n from "@/localization/config";

/**
 * Designer settings schema for Video (flat paths like Select preview).
 * Defaults are applied via preview.tsx `defaultProps`, not via RichText-style
 * defaultValue props here, to avoid reverting user input on re-render.
 */
export const Video: ISchema = {
  type: "object",
  properties: {
    uniqueValue: {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "UniqueValueSetter",
    },
    "x-component-props.titleEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("Video.designerPlaceholderTitleEn", { lng: "en" }),
      },
    },
    "x-component-props.titleAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t("Video.designerPlaceholderTitleAr", { lng: "ar" }),
      },
    },
    "x-component-props.description": {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
      default: false,
    },
    "x-decorator-props.tooltipEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-decorator-props": { colon: false, label: " " },
      "x-component": "DescriptionRichTextSetter",
      "x-reactions": {
        dependencies: ["x-component-props.description"],
        fulfill: {
          state: {
            display: "{{ $deps[0] ? 'visible' : 'hidden' }}",
          },
        },
      },
      "x-component-props": {
        lang: "en",
        placeholder: i18n.t("Video.designerPlaceholderTooltipEn", {
          lng: "en",
        }),
      },
    },
    "x-decorator-props.tooltipAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-decorator-props": { colon: false, label: " " },
      "x-component": "DescriptionRichTextSetter",
      "x-reactions": {
        dependencies: ["x-component-props.description"],
        fulfill: {
          state: {
            display: "{{ $deps[0] ? 'visible' : 'hidden' }}",
          },
        },
      },
      "x-component-props": {
        lang: "ar",
        placeholder: i18n.t("Video.designerPlaceholderTooltipAr", {
          lng: "ar",
        }),
      },
    },
    "x-component-props.videoUrl": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "VideoUploadSetter",
      "x-decorator-props": {
        asterisk: true,
      },
    },
    "video-validation-divider": {
      type: "void",
      "x-component": "FormItem",
      "x-component-props": {
        colon: false,
        style: {
          marginTop: 16,
          marginBottom: 8,
          fontWeight: 500,
          fontSize: 14,
          color: "#333",
        },
        children: i18n.t("Video.validationSection"),
      },
    },
    "x-component-props.requiredViewing": {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
      default: true,
      "x-decorator-props": {
        tooltip: i18n.t("Video.requiredViewingTooltip"),
      },
    },
    "video-permissions-divider": {
      type: "void",
      "x-component": "FormItem",
      "x-component-props": {
        colon: false,
        style: {
          marginTop: 16,
          marginBottom: 8,
          fontWeight: 500,
          fontSize: 14,
          color: "#333",
        },
        children: i18n.t("Video.permissionsSection"),
      },
    },
    "x-component-props.visible": {
      type: "boolean",
      "x-decorator": "FormItem",
      "x-component": "Switch",
      default: true,
    },
  },
};
