/* eslint-disable @typescript-eslint/no-explicit-any -- Designable field props */
import { createBehavior, createResource } from "@designable/core";
import { type DnFC, useNodeIdProps } from "@designable/react";
import { observer } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { AllSchemas } from "../../schemas";
import { buildBilingualComponentDefaults } from "@/components/designable/src/utils/bilingual";
import {
  MobileNumberInputField,
  type MobileNumberInputFieldProps,
} from "./MobileNumberInputField";

const DEFAULT_TITLE_EN = "Mobile Number";
const DEFAULT_TITLE_AR = "رقم الهاتف المتحرك";
const DEFAULT_PLACEHOLDER_EN = "Enter mobile number";
const DEFAULT_PLACEHOLDER_AR = "أدخل رقم الهاتف المتحرك";

const buildMobileNumberInputDesignerDefaults = (node: any) =>
  buildBilingualComponentDefaults(node, {
    defaultTitleEn: DEFAULT_TITLE_EN,
    defaultTitleAr: DEFAULT_TITLE_AR,
    defaultPlaceholderEn: DEFAULT_PLACEHOLDER_EN,
    defaultPlaceholderAr: DEFAULT_PLACEHOLDER_AR,
  });

const mobileNumberFieldPropsSchema = {
  "x-component-props.titleEn": {
    type: "string",
    "x-decorator": "FormItem",
    "x-component": "Input",
    "x-component-props": {
      placeholder: DEFAULT_TITLE_EN,
    },
  },
  "x-component-props.titleAr": {
    type: "string",
    "x-decorator": "FormItem",
    "x-component": "Input",
    "x-component-props": {
      placeholder: DEFAULT_TITLE_AR,
    },
  },
  "x-component-props.placeholderEn": {
    type: "string",
    "x-decorator": "FormItem",
    "x-component": "Input",
    "x-component-props": {
      placeholder: DEFAULT_PLACEHOLDER_EN,
    },
  },
  "x-component-props.placeholderAr": {
    type: "string",
    "x-decorator": "FormItem",
    "x-component": "Input",
    "x-component-props": {
      placeholder: DEFAULT_PLACEHOLDER_AR,
    },
  },
};
const mobileNumberComponentPropsSchema = (
  AllSchemas.MobileNumberInput.properties || {}
) as Record<string, any>;

export const MobileNumberInput: DnFC<MobileNumberInputFieldProps> = observer(
  (props) => {
    const nodeId = useNodeIdProps();

    return (
      <div {...nodeId} className="designable-mobile-number-input-preview">
        <MobileNumberInputField {...props} />
      </div>
    );
  },
);

MobileNumberInput.Behavior = createBehavior({
  name: "MobileNumberInput",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "MobileNumberInput",
  designerProps(node: any) {
    return {
      defaultProps: buildMobileNumberInputDesignerDefaults(node),
      propsSchema: {
        type: "object",
        properties: {
          uniqueValue: {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "UniqueValueSetter",
          },
          ...mobileNumberFieldPropsSchema,
          "x-component-props.disabled":
            mobileNumberComponentPropsSchema.disabled,
          "x-component-props.defaultCountryCode":
            mobileNumberComponentPropsSchema.defaultCountryCode,
          "x-decorator-props.tooltipEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component-props": {
              lang: "en",
              placeholder: "Enter description",
            },
            "x-decorator-props": { colon: false, label: " " },
            "x-component": "DescriptionRichTextSetter",
          },
          "x-decorator-props.tooltipAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component-props": {
              lang: "ar",
              placeholder: "أدخل الوصف باللغة العربية",
            },
            "x-decorator-props": { colon: false, label: " " },
            "x-component": "DescriptionRichTextSetter",
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
  designerLocales: AllLocales.MobileNumberInput,
});

MobileNumberInput.Resource = createResource({
  icon: resourceIcons.mobileNumber,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "string",
        title: DEFAULT_TITLE_EN,
        "x-decorator": "FormItem",
        "x-component": "MobileNumberInput",
        "x-component-props": {
          titleEn: DEFAULT_TITLE_EN,
          titleAr: DEFAULT_TITLE_AR,
          title: DEFAULT_TITLE_EN,
          placeholderEn: DEFAULT_PLACEHOLDER_EN,
          placeholderAr: DEFAULT_PLACEHOLDER_AR,
          placeholder: DEFAULT_PLACEHOLDER_EN,
        },
      },
    },
  ],
});
