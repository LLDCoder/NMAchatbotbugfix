/* eslint-disable @typescript-eslint/no-explicit-any -- Formily connect / designable Field props */
import React from "react";
import { Input as AntdInput } from "antd";
import {
  connect,
  mapReadPretty,
  observer,
  useField,
} from "@formily/react";
import { PreviewText } from "@formily/antd";
import { LoadingOutlined } from "@ant-design/icons";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  buildBilingualComponentDefaults,
  normalizeBilingualComponentProps,
} from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

interface WordLimitConfig {
  enabled: boolean;
  limit: number;
}

function applyWordLimit(props: Record<string, any>): Record<string, any> {
  const { wordLimitConfig, ...rest } = props;
  const cfg = wordLimitConfig as WordLimitConfig | undefined;
  if (cfg?.enabled && cfg.limit > 0) {
    rest.maxLength = Math.floor(cfg.limit);
  }
  return rest;
}

function applyRtl(props: Record<string, any>): Record<string, any> {
  const { rtl, className, ...rest } = props;
  if (!rtl) return { className, ...rest };
  const cls = [className, "Formily-Input-rtl"].filter(Boolean).join(" ");
  return { ...rest, className: cls };
}

function stripI18nInputProps(props: Record<string, any>): Record<string, any> {
  const rest = { ...props };
  delete rest.placeholderEn;
  delete rest.placeholderAr;
  delete rest.titleEn;
  delete rest.titleAr;
  return rest;
}

function buildInputDesignerDefaults(
  node: any,
  defaultTitleNs: "Input" | "TextArea",
) {
  return buildBilingualComponentDefaults(node, {
    defaultTitleEn: i18n.t(`${defaultTitleNs}.defaultFieldTitle`, { lng: "en" }),
    defaultTitleAr: i18n.t(`${defaultTitleNs}.defaultFieldTitle`, { lng: "ar" }),
    defaultPlaceholderEn: "",
    defaultPlaceholderAr: "",
  });
}

function inputFieldPropsSchema(defaultTitleNs: "Input" | "TextArea") {
  const ns = defaultTitleNs;
  return {
    "x-component-props.titleEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t(`${ns}.designerPlaceholderTitle`, { lng: "en" }),
      },
    },
    "x-component-props.titleAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t(`${ns}.designerPlaceholderTitle`, { lng: "ar" }),
      },
    },
    "x-component-props.placeholderEn": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t(`${ns}.designerPlaceholderInput`, { lng: "en" }),
      },
    },
    "x-component-props.placeholderAr": {
      type: "string",
      "x-decorator": "FormItem",
      "x-component": "Input",
      "x-component-props": {
        placeholder: i18n.t(`${ns}.designerPlaceholderInput`, { lng: "ar" }),
      },
    },
  };
}

const InputInner = observer((props: any) => {
  const field = useField() as any;
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const stripped = stripI18nInputProps(props);
  const applied = applyRtl(
    applyWordLimit({
      ...normalizeBilingualComponentProps(
        {
          ...stripped,
          placeholderEn: props.placeholderEn,
          placeholderAr: props.placeholderAr,
          placeholder: props.placeholder,
        },
        {
          lang,
          host,
          placeholderFallback: "",
        },
      ),
    }),
  );
  return React.createElement(AntdInput, {
    ...applied,
    suffix: React.createElement(
      "span",
      null,
      field?.loading || field?.validating
        ? React.createElement(LoadingOutlined)
        : applied.suffix,
    ),
  });
});

const TextAreaInner = observer((props: any) => {
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const stripped = stripI18nInputProps(props);
  const applied = applyRtl(
    applyWordLimit({
      ...normalizeBilingualComponentProps(
        {
          ...stripped,
          placeholderEn: props.placeholderEn,
          placeholderAr: props.placeholderAr,
          placeholder: props.placeholder,
        },
        {
          lang,
          host,
          placeholderFallback: "",
        },
      ),
    }),
  );
  return React.createElement(AntdInput.TextArea, applied);
});

export const Input: DnFC<any> = connect(
  InputInner,
  mapReadPretty(PreviewText.Input),
) as any;

(Input as any).TextArea = connect(
  TextAreaInner,
  mapReadPretty(PreviewText.Input),
);

Input.Behavior = createBehavior(
  {
    name: "Input",
    extends: ["Field"],
    selector: (node) => node.props?.["x-component"] === "Input",
    designerProps(node: any) {
      return {
        defaultProps: buildInputDesignerDefaults(node, "Input"),
        propsSchema: {
          type: "object",
          properties: {
            uniqueValue: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "UniqueValueSetter",
            },
            ...inputFieldPropsSchema("Input"),
            "x-decorator-props.tooltipEn": {
              type: "string",
              "x-decorator": "FormItem",
              "x-component-props": {
                lang:'en',
                placeholder: i18n.t("Input.designerPlaceholderTooltipEn", {
                  lng: "en",
                }),
              },
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
            },
            "x-decorator-props.tooltipAr": {
              type: "string",
              "x-decorator": "FormItem",
              "x-component-props": {
                placeholder: i18n.t("Input.designerPlaceholderTooltipAr", {
                  lng: "ar",
                }),
                lang:'ar',
              },
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
            },
            "x-component-props.wordLimitConfig": {
              type: "object",
              "x-decorator": "FormItem",
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "WordLimitSetter",
            },
            "x-validator": {
              type: "array",
              "x-component": "ValidatorSetter",
            },
            "x-decorator-props.style": {
              type: "void",
              properties: {
                "style.width": {
                  type: "string",
                  "x-decorator": "FormItem",
                  "x-component": "FieldWidthSetter",
                },
              },
            },
            required: {
              type: "boolean",
              "x-decorator": "FormItem",
              "x-component": "Switch",
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
          },
        },
      };
    },
    designerLocales: AllLocales.Input,
  },
  {
    name: "Input.TextArea",
    extends: ["Field"],
    selector: (node) => node.props?.["x-component"] === "Input.TextArea",
    designerProps(node: any) {
      return {
        defaultProps: buildInputDesignerDefaults(node, "TextArea"),
        propsSchema: {
          type: "object",
          properties: {
            uniqueValue: {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "UniqueValueSetter",
            },
            ...inputFieldPropsSchema("TextArea"),
            "x-decorator-props.tooltipEn": {
              type: "string",
              "x-decorator": "FormItem",
              "x-component-props": {
                placeholder: i18n.t("Input.designerPlaceholderTooltipEn", {
                  lng: "en",
                }),
                lang:'en',
              },
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
            },
            "x-decorator-props.tooltipAr": {
              type: "string",
              "x-decorator": "FormItem",
              "x-component-props": {
                placeholder: i18n.t("Input.designerPlaceholderTooltipAr", {
                  lng: "ar",
                }),
                lang:'ar',
              },
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "DescriptionRichTextSetter",
            },
            "x-component-props.wordLimitConfig": {
              type: "object",
              "x-decorator": "FormItem",
              "x-decorator-props": { colon: false, label: " " },
              "x-component": "WordLimitSetter",
              "x-component-props": {
                max: 1000,
              },
            },
            "x-validator": {
              type: "array",
              "x-component": "ValidatorSetter",
            },
            "x-decorator-props.style": {
              type: "void",
              properties: {
                "style.width": {
                  type: "string",
                  "x-decorator": "FormItem",
                  "x-component": "FieldWidthSetter",
                },
              },
            },
            required: {
              type: "boolean",
              "x-decorator": "FormItem",
              "x-component": "Switch",
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
          },
        },
      };
    },
    designerLocales: AllLocales.TextArea,
  },
);

Input.Resource = createResource(
  {
    icon: resourceIcons.textInput,
    elements: [
      {
        componentName: "Field",
        props: {
          type: "string",
          title: i18n.t("Input.defaultFieldTitle", { lng: "en" }),
          "x-decorator": "FormItem",
          "x-component": "Input",
          "x-component-props": {
            titleEn: i18n.t("Input.defaultFieldTitle", { lng: "en" }),
            titleAr: i18n.t("Input.defaultFieldTitle", { lng: "ar" }),
            title: i18n.t(`Input.defaultFieldTitle`, { lng: "en" }),
            placeholderEn: i18n.t(`Input.designerPlaceholderInput`, { lng: "en" }),
            placeholderAr: i18n.t(`Input.designerPlaceholderInput`, { lng: "ar" }),
            placeholder: i18n.t(`Input.designerPlaceholderInput`, { lng: "en" }),

          },
        },
      },
    ],
  },
  {
    icon: resourceIcons.textArea,
    elements: [
      {
        componentName: "Field",
        props: {
          type: "string",
          title: i18n.t("TextArea.defaultFieldTitle", { lng: "en" }),
          "x-decorator": "FormItem",
          "x-component": "Input.TextArea",
          "x-component-props": {
            titleEn: i18n.t("TextArea.defaultFieldTitle", { lng: "en" }),
            titleAr: i18n.t("TextArea.defaultFieldTitle", { lng: "ar" }),
            title: i18n.t(`TextArea.defaultFieldTitle`, { lng: "en" }),
            placeholderEn: i18n.t(`Input.designerPlaceholderInput`, { lng: "en" }),
            placeholderAr: i18n.t(`Input.designerPlaceholderInput`, { lng: "ar" }),
            placeholder: i18n.t(`TextArea.designerPlaceholderInput`, { lng: "en" }),
          },
        },
      },
    ],
  },
);
