import { createBehavior, createResource } from "@designable/core";
import { connect, mapProps } from "@formily/react";
import type { DnFC } from "@designable/react";
import DataListInner from "./DataList";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import { asOptionalString } from "@/components/designable/src/utils/bilingual";
import { resourceIcons } from "../../assets/resource-icons";

function buildDataListDesignerDefaults(node: { props?: Record<string, unknown> } | undefined) {
  const rawProps = node?.props ?? {};
  const xcpRaw = rawProps["x-component-props"];
  const base =
    typeof xcpRaw === "object" && xcpRaw !== null && !Array.isArray(xcpRaw)
      ? { ...(xcpRaw as Record<string, unknown>) }
      : {};

  const legacyTitle = asOptionalString(base.title);
  const legacyAdd = asOptionalString(base.addButtonText);
  delete base.title;
  delete base.addButtonText;

  const titleEn =
    asOptionalString(base.titleEn) ??
    legacyTitle ??
    i18n.t("DataList.defaultTitle", { lng: "en" });
  const titleAr =
    asOptionalString(base.titleAr) ??
    i18n.t("DataList.defaultTitle", { lng: "ar" });

  const addButtonTextEn =
    asOptionalString(base.addButtonTextEn) ??
    legacyAdd ??
    i18n.t("DataList.defaultAddButton", { lng: "en" });
  const addButtonTextAr =
    asOptionalString(base.addButtonTextAr) ??
    i18n.t("DataList.defaultAddButton", { lng: "ar" });

  return {
    ...rawProps,
    title: "",
    name:
      typeof rawProps["name"] === "string" && rawProps["name"] !== ""
        ? rawProps["name"]
        : "dataList",
    "x-component-props": {
      ...base,
      titleEn,
      titleAr,
      addButtonTextEn,
      addButtonTextAr,
    },
  };
}

export const DataList: DnFC<React.ComponentProps<typeof DataListInner>> =
  connect(
    DataListInner,
    mapProps((props, field) => {
      return {
        ...props,
        designMode: field?.designable ? true : false,
      };
    }),
  );

DataList.Behavior = createBehavior({
  name: "DataList",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "DataList",
  designerProps(node: { props?: Record<string, unknown> }) {
    return {
      defaultProps: buildDataListDesignerDefaults(node),
      propsSchema: {
        type: "object",
        properties: {
          "field-group": {
            type: "void",
            "x-component": "CollapseItem",
            properties: {
              "x-component-props": {
                type: "object",
                properties: {
                  titleEn: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                    "x-component-props": {
                      placeholder: i18n.t(
                        "DataList.designerPlaceholderTitleEn",
                        { lng: "en" },
                      ),
                    },
                  },
                  titleAr: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                    "x-component-props": {
                      placeholder: i18n.t(
                        "DataList.designerPlaceholderTitleAr",
                        { lng: "ar" },
                      ),
                    },
                  },
                  addButtonTextEn: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                    "x-component-props": {
                      placeholder: i18n.t(
                        "DataList.designerPlaceholderAddButtonEn",
                        { lng: "en" },
                      ),
                    },
                  },
                  addButtonTextAr: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                    "x-component-props": {
                      placeholder: i18n.t(
                        "DataList.designerPlaceholderAddButtonAr",
                        { lng: "ar" },
                      ),
                    },
                  },
                  fieldSource: {
                    type: "object",
                    "x-decorator": "FormItem",
                    "x-component": "DataListSourceSetter",
                  },
                  maxItems: {
                    type: "number",
                    "x-decorator": "FormItem",
                    "x-component": "NumberPicker",
                    "x-component-props": {
                      className: "data-list-max-items-setter",
                      min: 1,
                      precision: 0,
                    },
                    "x-reactions": {
                      dependencies: [
                        "x-component-props.fieldSource#value.dataSource",
                      ],
                      fulfill: {
                        state: {
                          display:
                            "{{$deps[0] === 'languages_name_list' ? 'visible' : 'hidden'}}",
                        },
                      },
                    },
                  },
                  minItems: {
                    type: "number",
                    default: 2,
                    "x-decorator": "FormItem",
                    "x-component": "NumberPicker",
                    "x-component-props": {
                      className: "data-list-min-items-setter",
                      min: 1,
                      precision: 0,
                    },
                    // Self-Monitor requires at least two trainees (spec 7.1 /
                    // AC-09). The applicant portal enforces this from the
                    // published schema, so the value has to be authorable here.
                    "x-reactions": {
                      dependencies: [
                        "x-component-props.fieldSource#value.dataSource",
                      ],
                      fulfill: {
                        state: {
                          display:
                            "{{$deps[0] === 'list_of_trainees' ? 'visible' : 'hidden'}}",
                        },
                      },
                    },
                  },
                  uniqueLanguageRequired: {
                    type: "boolean",
                    default: false,
                    "x-decorator": "FormItem",
                    "x-component": "Switch",
                    "x-reactions": {
                      dependencies: [
                        "x-component-props.fieldSource#value.dataSource",
                      ],
                      fulfill: {
                        state: {
                          display:
                            "{{$deps[0] === 'languages_name_list' ? 'visible' : 'hidden'}}",
                        },
                      },
                    },
                  },
                },
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
                      lang: "en",
                    },
                  },
                  tooltipAr: {
                    type: "string",
                    "x-decorator": "FormItem",
                    "x-decorator-props": { colon: false, label: " " },
                    "x-component": "DescriptionRichTextSetter",
                    "x-component-props": {
                      lang: "ar",
                    },
                  },
                },
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
                  unCheckedValue: "disabled",
                },
              },
            },
          },
        },
      },
    };
  },
  designerLocales: AllLocales.DataList,
});

const defaultTitleEn = i18n.t("DataList.defaultTitle", { lng: "en" });
const defaultTitleAr = i18n.t("DataList.defaultTitle", { lng: "ar" });
const defaultAddEn = i18n.t("DataList.defaultAddButton", { lng: "en" });
const defaultAddAr = i18n.t("DataList.defaultAddButton", { lng: "ar" });

DataList.Resource = createResource({
  // title: {
  //   "en-US": defaultTitleEn,
  //   "ar-AE": defaultTitleAr,
  // },
  icon: resourceIcons.dataList,
  elements: [
    {
      componentName: "Field",
      props: {
        type: "array",
        title: "",
        'x-decorator': 'FormItem',
        'x-decorator-props': { colon: false, label: false },
        "x-component": "DataList",
        "x-component-props": {
          title: defaultTitleEn,
          titleEn: defaultTitleEn,
          titleAr: defaultTitleAr,
          addButtonText: defaultAddEn,
          addButtonTextEn: defaultAddEn,
          addButtonTextAr: defaultAddAr,
        },
      },
    },
  ],
});

export default DataList;
