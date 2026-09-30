import React from "react";
import { Card as AntdCard } from "antd";
import { createBehavior, createResource } from "@designable/core";
import {
  DnFC,
  TreeNodeWidget,
  useTreeNode,
  useNodeIdProps,
} from "@designable/react";
import { AllLocales } from "../../locales";
import { observer } from "@formily/react";
import { ArrayBase } from "@formily/antd";
import "./styles.less";
import { MultiSelectDropdown } from "@/components/common";
import { renderDesignerTooltipIcon } from "../DesignerTooltip";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

export const SelectTableSingle: DnFC<Record<string, unknown>> = observer(() => {
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const t = i18n.getFixedT(lang);
  const node = useTreeNode();
  const nodeId = useNodeIdProps();

  const xcp = node?.props?.["x-component-props"] || {};
  const xdp = node?.props?.["x-decorator-props"] || {};

  const activityLabelName =
    getBilingualValueByLang({
      lang,
      host,
      en: xcp.activityLabelNameEn,
      ar: xcp.activityLabelNameAr,
      legacy: xcp.activityLabelName,
      fallback:
        host === "designer" ? "" : t("SelectTableSingle.defaultActivityLabelName"),
    }) ||
    (host === "designer" ? "" : t("SelectTableSingle.defaultActivityLabelName"));
  const placeholder =
    getBilingualValueByLang({
      lang,
      host,
      en: xcp.placeholderEn,
      ar: xcp.placeholderAr,
      legacy: xcp.placeholder,
      fallback:
        host === "designer" ? "" : t("SelectTableSingle.defaultPlaceholder"),
    }) || (host === "designer" ? "" : t("SelectTableSingle.defaultPlaceholder"));
  const tooltipHtml = getBilingualValueByLang({
    lang,
    host,
    en: xdp.tooltipEn,
    ar: xdp.tooltipAr,
    legacy: xdp.tooltip,
    fallback: "",
  });
  const activityTitle =
    getBilingualValueByLang({
      lang,
      host,
      en: xcp.activityTitleEn,
      ar: xcp.activityTitleAr,
      legacy:
        typeof xcp.activityTitle === "string"
          ? xcp.activityTitle
          : typeof xcp.cardTitle === "string"
            ? xcp.cardTitle
            : typeof xcp.title === "string"
              ? xcp.title
              : undefined,
      fallback:
        host === "designer" ? "" : t("SelectTableSingle.defaultActivityTitle"),
    }) ||
    (host === "designer" ? "" : t("SelectTableSingle.defaultActivityTitle"));

  return (
    <div {...nodeId} className="dn-select-table-wrapper">
      <div className="dn-select-table">
        <AntdCard  className="Formliy-AntCard" title={activityTitle} style={{ marginBottom: 16 }}>
          <div className="formtitle">
            {activityLabelName}
<span className="required-icon">*</span>
            {renderDesignerTooltipIcon(tooltipHtml)}
          </div>
          <MultiSelectDropdown
            required
            placeholder={placeholder}
            disabled={true}
            value={undefined}
            options={[]}
            multiple={false}
          />
        </AntdCard>
        {node.children.length > 0 && (
          <div className="select-table-children-container">
            {node.children.map((child) => (
              <TreeNodeWidget key={child.id} node={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

ArrayBase.mixin?.(SelectTableSingle);

SelectTableSingle.Behavior = createBehavior({
  name: "SelectTableSingle",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "SelectTableSingle",
  designerProps(node) {
    const xcp = node.props?.["x-component-props"] || {};
    const xdp = node.props?.["x-decorator-props"] || {};
    const legacyTooltip =
      typeof xdp.tooltip === "string" ? xdp.tooltip : undefined;
    return {
      droppable: true,
      defaultProps: {
        "x-component-props": {
          activityTitleEn:
            xcp.activityTitleEn ??
            xcp.activityTitle ??
            i18n.t("SelectTableSingle.defaultActivityTitle", { lng: "en" }),
          activityTitleAr:
            xcp.activityTitleAr ??
            i18n.t("SelectTableSingle.defaultActivityTitle", { lng: "ar" }),
          activityLabelNameEn:
            xcp.activityLabelNameEn ??
            xcp.activityLabelName ??
            i18n.t("SelectTableSingle.defaultActivityLabelName", { lng: "en" }),
          activityLabelNameAr:
            xcp.activityLabelNameAr ??
            i18n.t("SelectTableSingle.defaultActivityLabelName", { lng: "ar" }),
          placeholderEn:
            xcp.placeholderEn ??
            xcp.placeholder ??
            i18n.t("SelectTableSingle.defaultPlaceholder", { lng: "en" }),
          placeholderAr:
            xcp.placeholderAr ??
            i18n.t("SelectTableSingle.defaultPlaceholder", { lng: "ar" }),
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
      },
      propsSchema: {
        type: "object",
        properties: {
          "x-component-props.activityTitleEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t(
                "SelectTableSingle.designerPlaceholderActivityTitle",
                { lng: "en" },
              ),
            },
          },
          "x-component-props.activityTitleAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t(
                "SelectTableSingle.designerPlaceholderActivityTitle",
                { lng: "ar" },
              ),
            },
          },
          "x-component-props.activityLabelNameEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t(
                "SelectTableSingle.designerPlaceholderLabelName",
                { lng: "en" },
              ),
            },
          },
          "x-component-props.activityLabelNameAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t(
                "SelectTableSingle.designerPlaceholderLabelName",
                { lng: "ar" },
              ),
            },
          },
          "x-decorator-props": {
            type: "object",
            properties: {
              tooltipEn: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component-props": {
                  lang: "en",
                },
                "x-component": "DescriptionRichTextSetter",
              },
              tooltipAr: {
                type: "string",
                "x-decorator": "FormItem",
                "x-decorator-props": { colon: false, label: " " },
                "x-component-props": {
                  lang: "ar",
                },
                "x-component": "DescriptionRichTextSetter",
              },
            },
          },
          "x-component-props.placeholderEn": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("SelectTableSingle.designerPlaceholderInput", {
                lng: "en",
              }),
            },
          },
          "x-component-props.placeholderAr": {
            type: "string",
            "x-decorator": "FormItem",
            "x-component": "Input",
            "x-component-props": {
              placeholder: i18n.t("SelectTableSingle.designerPlaceholderInput", {
                lng: "ar",
              }),
            },
          },
          "x-component-props.activityConfiguration": {
            type: "object",
            "x-decorator": "FormItem",
            "x-component": "ActivityConfigurationSetter",
          },
          required: {
            type: "boolean",
            "x-decorator": "FormItem",
            "x-component": "Switch",
          },
          "x-display": {
            type: "string",
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
  designerLocales: AllLocales.SelectTableSingle,
});

SelectTableSingle.Resource = createResource({
  icon: resourceIcons.singleActivity,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "SelectTableSingle",
        "x-decorator": "FormItem",
        "x-component": "SelectTableSingle",
        "x-component-props": {
          activityTitle: i18n.t("SelectTableSingle.defaultActivityTitle", {
            lng: "en",
          }),
          activityLabelName: i18n.t("SelectTableSingle.defaultActivityLabelName", {
            lng: "en",
          }),
          placeholder: i18n.t("SelectTableSingle.defaultPlaceholder", {
            lng: "en",
          }),
          activityTitleEn: i18n.t("SelectTableSingle.defaultActivityTitle", {
            lng: "en",
          }),
          activityTitleAr: i18n.t("SelectTableSingle.defaultActivityTitle", {
            lng: "ar",
          }),
          activityLabelNameEn: i18n.t(
            "SelectTableSingle.defaultActivityLabelName",
            { lng: "en" },
          ),
          activityLabelNameAr: i18n.t(
            "SelectTableSingle.defaultActivityLabelName",
            { lng: "ar" },
          ),
          placeholderEn: i18n.t("SelectTableSingle.defaultPlaceholder", {
            lng: "en",
          }),
          placeholderAr: i18n.t("SelectTableSingle.defaultPlaceholder", {
            lng: "ar",
          }),
          visible: true,
          editable: true,
        },
        "x-decorator-props": {
          tooltipEn: "",
          tooltipAr: "",
        },
      },
    },
  ],
});

export default SelectTableSingle;
