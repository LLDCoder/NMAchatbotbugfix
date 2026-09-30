/* eslint-disable @typescript-eslint/no-explicit-any -- Formily connect / designable Field props */
import React from "react";
import { observer } from "@formily/react";
import { createBehavior, createResource } from "@designable/core";
import { type DnFC } from "@designable/react";
import { AllLocales } from "../../locales";
import { AllSchemas } from "../../schemas";
import { LanguageSelectMulti as ConnectedLanguageSelectMulti } from "./LanguageSelectMulti";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  buildBilingualComponentDefaults,
  getBilingualValueByLang,
} from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

function stripLanguageSelectMultiI18nProps(
  props: Record<string, any>,
): Record<string, any> {
  const rest = { ...props };
  delete rest.placeholderEn;
  delete rest.placeholderAr;
  delete rest.titleEn;
  delete rest.titleAr;
  return rest;
}

function buildLanguageSelectMultiDesignerDefaults(node: any) {
  return buildBilingualComponentDefaults(node, {
    defaultTitleEn: i18n.t("LanguageSelectMulti.defaultLabelName", {
      lng: "en",
    }),
    defaultTitleAr: i18n.t("LanguageSelectMulti.defaultLabelName", {
      lng: "ar",
    }),
    defaultPlaceholderEn: i18n.t("LanguageSelectMulti.defaultPlaceholder", {
      lng: "en",
    }),
    defaultPlaceholderAr: i18n.t("LanguageSelectMulti.defaultPlaceholder", {
      lng: "ar",
    }),
  });
}

function languageSelectMultiFieldPropsSchema() {
  const ns = "LanguageSelectMulti";
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

const LanguageSelectMultiInner = observer((props: any) => {
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const stripped = stripLanguageSelectMultiI18nProps(props);
  const placeholder = getBilingualValueByLang({
    lang,
    host,
    en: props.placeholderEn,
    ar: props.placeholderAr,
    legacy: props.placeholder,
    fallback: "",
  });
  return React.createElement(ConnectedLanguageSelectMulti as any, {
    ...stripped,
    placeholder,
  });
});

export const LanguageSelectMulti: DnFC<any> = LanguageSelectMultiInner as any;

LanguageSelectMulti.Behavior = createBehavior({
  name: "LanguageSelectMulti",
  extends: ["Field"],
  selector: (node) =>
    node.props?.["x-component"] === "LanguageSelectMulti",
  designerProps(node: any) {
    return {
      defaultProps: {
        name: "Languages",
        ...buildLanguageSelectMultiDesignerDefaults(node),
      },
      propsSchema: {
        type: "object",
        properties: {
          uniqueValue: {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "UniqueValueSetter",
          },
          ...languageSelectMultiFieldPropsSchema(),
          "x-component-props": {
            type: "object",
            properties: AllSchemas.LanguageSelectMulti.properties,
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
                  lang: 'en'
                },
              },
              tooltipAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component": "DescriptionRichTextSetter",
                "x-component-props": {
                  lang: 'ar'
                },
              },
            },
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
          "x-validator": {
            type: "array",
            "x-component": "ValidatorSetter",
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
          "x-pattern": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "StringSwitchSetter",
            default: "editable",
            "x-component-props": {
              checkedValue: "editable",
              unCheckedValue: "readOnly",
            },
          },
        },
      },
    };
  },
  designerLocales: AllLocales.LanguageSelectMulti,
});

LanguageSelectMulti.Resource = createResource({
  icon: resourceIcons.multipleLanguages,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "Languages",
        title: i18n.t("LanguageSelectMulti.defaultLabelTitle", { lng: "en" }),
        "x-decorator": "FormItem",
        "x-component": "LanguageSelectMulti",
        "x-component-props": {
          titleEn: i18n.t("LanguageSelectMulti.defaultLabelTitle", {
            lng: "en",
          }),
          titleAr: i18n.t("LanguageSelectMulti.defaultLabelTitle", {
            lng: "ar",
          }),
          placeholderEn: i18n.t("LanguageSelectMulti.defaultPlaceholder", {
            lng: "en",
          }),
          placeholderAr: i18n.t("LanguageSelectMulti.defaultPlaceholder", {
            lng: "ar",
          }),
        },
      },
    },
  ],
});
