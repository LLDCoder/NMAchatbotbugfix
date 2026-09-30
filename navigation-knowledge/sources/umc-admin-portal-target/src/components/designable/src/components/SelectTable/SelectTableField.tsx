// SelectTableField.tsx
import React, { useEffect, useMemo } from "react";
import { Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { FieldValidator } from "@formily/core";
import {
  observer,
  useField,
  useForm,
  RecursionField,
  useFieldSchema,
} from "@formily/react";
import AED from "@/assets/images/AED.png";
import "./styles.less";
import "@/components/common/FormliyView/index.less";
import { Card as AntdCard } from "antd";
import { MultiSelectDropdown, type OptionItem } from "@/components/common";
import { getEconomicActivitys } from "@/services/services";
import "../FormItemWithHtmlTooltip/index.less";
import { useServicesStore } from "@/store/services";
import i18n from "@/localization/config";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

function isNonEditablePattern(pattern: string | undefined) {
  return (
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty"
  );
}

const toValidatorList = (
  validator: FieldValidator | undefined,
): Exclude<FieldValidator, unknown[]>[] => {
  if (!validator) return [];

  return (Array.isArray(validator) ? validator : [validator]) as Exclude<
    FieldValidator,
    unknown[]
  >[];
};

// Service 903 can amend non-activity data, so adding activities is optional.
const OPTIONAL_ACTIVITY_SERVICE_CODES = new Set([903]);

export const SelectTableField: React.FC<any> = observer((props) => {
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const t = i18n.getFixedT(lang);
  const field = useField<any>();
  const schema = useFieldSchema();
  const servicesCode = useServicesStore((s) => s.userInfo?.servicesCode);
  const form = useForm();
  const {
    options = [],
    serviceCode: serviceCodeProp,
    tableTitle: tableTitleProp,
    activityTitleEn,
    activityTitleAr,
    activityTitle: legacyActivityTitleProp,
    cardTitle: legacyCardTitleProp,
    title: legacyTitleProp,
    activityLabelName: legacyActivityLabelNameProp,
    activityLabelNameEn,
    activityLabelNameAr,
    placeholder: legacyPlaceholderProp,
    placeholderEn,
    placeholderAr,
    activityConfiguration, // eslint-disable-line @typescript-eslint/no-unused-vars -- designer setter only; fee card commented
    allowRemovePrefilled: allowRemovePrefilledProp, // eslint-disable-line @typescript-eslint/no-unused-vars -- reserved for schema compatibility and future dropdown behavior
    allowAddOtherOptions: allowAddOtherOptionsProp, // eslint-disable-line @typescript-eslint/no-unused-vars -- reserved for schema compatibility and future dropdown behavior
    visible = true,
    editable = true,
    tableSize = "small", // eslint-disable-line @typescript-eslint/no-unused-vars -- fee card commented
    tableBordered = true, // eslint-disable-line @typescript-eslint/no-unused-vars -- fee card commented
    tableProps = {}, // eslint-disable-line @typescript-eslint/no-unused-vars -- fee card commented
    requiredMessage: requiredMessageProp,
    ...restSelectProps
  } = props;
  const isOptionalActivityService = OPTIONAL_ACTIVITY_SERVICE_CODES.has(
    Number(serviceCodeProp ?? servicesCode),
  );
  const isRequired =
    field.required === true && !isOptionalActivityService;

  const nestedAllowRemovePrefilled = (restSelectProps as any)?.["allowRemovePrefilled"];
  const nestedAllowAddOtherOptions = (restSelectProps as any)?.["allowAddOtherOptions"];
  void (allowRemovePrefilledProp ?? nestedAllowRemovePrefilled);
  void (allowAddOtherOptionsProp ?? nestedAllowAddOtherOptions);

  const getLegacyRuntimeDefaultFallback = (
    legacyValue: unknown,
    englishDefault: string,
  ) => {
    if (
      host === "runtime" &&
      lang === "ar" &&
      typeof legacyValue === "string" &&
      legacyValue.trim() === englishDefault
    ) {
      return undefined;
    }

    return legacyValue;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- fee card commented
  const tableTitle = tableTitleProp ?? t("SelectTable.defaultTableTitle");
  const defaultActivityLabelName = t("SelectTable.defaultActivityLabelName");
  const defaultActivityLabelNameEn = i18n.t(
    "SelectTable.defaultActivityLabelName",
    { lng: "en" },
  );
  const defaultPlaceholder = t("SelectTable.defaultPlaceholder");
  const defaultPlaceholderEn = i18n.t("SelectTable.defaultPlaceholder", {
    lng: "en",
  });
  const defaultActivityTitle = t("SelectTable.defaultActivityTitle");
  const defaultActivityTitleEn = i18n.t("SelectTable.defaultActivityTitle", {
    lng: "en",
  });

  const activityLabelName =
    getBilingualValueByLang({
      lang,
      host,
      en: activityLabelNameEn,
      ar: activityLabelNameAr,
      legacy: getLegacyRuntimeDefaultFallback(
        legacyActivityLabelNameProp,
        defaultActivityLabelNameEn,
      ),
      fallback: host === "designer" ? "" : defaultActivityLabelName,
    }) || (host === "designer" ? "" : defaultActivityLabelName);
  const placeholder =
    getBilingualValueByLang({
      lang,
      host,
      en: placeholderEn,
      ar: placeholderAr,
      legacy: getLegacyRuntimeDefaultFallback(
        legacyPlaceholderProp,
        defaultPlaceholderEn,
      ),
      fallback: host === "designer" ? "" : defaultPlaceholder,
    }) || (host === "designer" ? "" : defaultPlaceholder);
  const requiredMessage =
    requiredMessageProp ?? t("SelectTable.requiredMessage");

  const legacyActivityTitleValue =
    typeof legacyActivityTitleProp === "string" && legacyActivityTitleProp
      ? legacyActivityTitleProp
      : typeof legacyCardTitleProp === "string" && legacyCardTitleProp
        ? legacyCardTitleProp
        : typeof legacyTitleProp === "string" && legacyTitleProp
          ? legacyTitleProp
          : undefined;
  const activityTitle =
    getBilingualValueByLang({
      lang,
      host,
      en: activityTitleEn,
      ar: activityTitleAr,
      legacy: getLegacyRuntimeDefaultFallback(
        legacyActivityTitleValue,
        defaultActivityTitleEn,
      ),
      fallback: host === "designer" ? "" : defaultActivityTitle,
    }) || (host === "designer" ? "" : defaultActivityTitle);

  // Flatten children into MultiSelectDropdown option list
  // const optionsArr: OptionItem[] = useMemo(() => {
  //   console.log(options);

  //   const flat: OptionItem[] = [];
  //   (options || []).forEach((parent: any) => {
  //     if (!parent?.children?.length) return;
  //     parent.children.forEach((child: any) => {
  //       flat.push({
  //         id: String(child.key ?? child.value),
  //         label: String(child.label ?? child.value),
  //         value: String(child.key ?? child.value),
  //         price:
  //           child.fee !== undefined && child.fee !== null
  //             ? Number(child.fee)
  //             : undefined,
  //         category: String(parent.label ?? parent.value ?? ""),
  //       });
  //     });
  //   });
  //   return flat;
  // }, [options]);
  const [optionsArr, setOptionsArr] = React.useState<OptionItem[]>([]);

  useEffect(() => {
    if (servicesCode === null || servicesCode === undefined) {
      return;
    }
    let cancelled = false;
    getEconomicActivitys(String(servicesCode)).then((res) => {
      if (cancelled) return;
      const flat: OptionItem[] = [];
      (res.data || options).forEach((parent: any) => {
        const parentLabel =
          lang === "ar"
            ? String(parent.nameAr ?? parent.nameEn ?? parent.value ?? "")
            : String(parent.nameEn ?? parent.nameAr ?? parent.value ?? "");
        if (!parent?.childData?.length) {
          flat.push({
            id: String(parent.id),
            label: parentLabel,
            value: String(parent.id),
            price:
              parent.fee !== undefined && parent.fee !== null
                ? Number(parent.fee)
                : 1000,
            category: parentLabel,
          });
        } else {
          parent.childData.forEach((child: any) => {
            const childLabel =
              lang === "ar"
                ? String(child.nameAr ?? child.nameEn ?? child.value)
                : String(child.nameEn ?? child.nameAr ?? child.value);
            flat.push({
              id: String(child.id ?? child.value),
              label: childLabel,
              value: String(child.id ?? child.value),
              price:
                child.fee !== undefined && child.fee !== null
                  ? Number(child.fee)
                  : 1000,
              category: parentLabel,
            });
          });
        }
      });
      setOptionsArr(flat);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `options` is only a fallback when the API returns no list; omit from deps to avoid refetch churn
  }, [lang, servicesCode]);
  const optionMap = useMemo(() => {
    const map = new Map<string, OptionItem>();
    optionsArr.forEach((o) => map.set(String(o.value), o));
    return map;
  }, [optionsArr]);

  const fieldValue = field.value || {};
  const rawSelected = fieldValue.selectedKey;
  const selectedKey: string[] = (
    Array.isArray(rawSelected)
      ? rawSelected
      : rawSelected !== undefined && rawSelected !== null && rawSelected !== ""
      ? [rawSelected]
      : []
  ).map((k: string | number) => String(k));
  const tableData = useMemo(() => {
    const v = field.value;
    const td =
      v && typeof v === "object"
        ? (v as { tableData?: unknown }).tableData
        : undefined;
    return Array.isArray(td) ? td : [];
  }, [field.value]);

  // Ensure review/disabled views show labels even if options are still loading
  // or servicesCode is missing; align keys with saved table rows when possible.
  const dropdownOptions = useMemo(() => {
    const merged = new Map<string, OptionItem>();
    optionsArr.forEach((o) => merged.set(String(o.value), o));
    selectedKey.forEach((key, idx) => {
      if (merged.has(key)) return;
      const row = tableData[idx];
      const label =
        row?.Activity != null && String(row.Activity).trim() !== ""
          ? String(row.Activity)
          : key;
      merged.set(key, {
        id: key,
        label,
        value: key,
        price:
          row?.money !== undefined && row?.money !== null
            ? Number(row.money)
            : undefined,
        category: t("SelectTable.savedCategory"),
      });
    });
    return Array.from(merged.values());
  }, [optionsArr, selectedKey, tableData, t]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- fee card commented
  const totalFee = useMemo(() => {
    if (!Array.isArray(tableData)) return 0;
    return tableData.reduce((sum, row) => {
      const price = Number(row?.money ?? 0);
      return sum + (Number.isNaN(price) ? 0 : price);
    }, 0);
  }, [tableData]);

  // Required validation (no FormItem built-in feedback; we only render our own message)
  const requiredValidator = useMemo(() => {
    return (value: any) => {
      const selected = value?.selectedKey;
      if (Array.isArray(selected))
        return selected.length > 0 ? "" : requiredMessage;
      return selected ? "" : requiredMessage;
    };
  }, [requiredMessage]);

  useEffect(() => {
    if (!isOptionalActivityService) return;

    const originalRequired = field.required;
    field.setRequired(false);
    field.setSelfErrors([]);

    return () => {
      field.setRequired(originalRequired);
    };
  }, [field, isOptionalActivityService]);

  useEffect(() => {
    if (!isRequired) return;

    const validators = toValidatorList(field.validator);
    const originalFeedbackLayout = field.decoratorProps?.feedbackLayout;

    field.setValidator([...validators, requiredValidator]);
    // Disable FormItem built-in error rendering if field is wrapped by FormItem
    field.setDecoratorProps({
      ...field.decoratorProps,
      feedbackLayout: "none",
    });

    return () => {
      const remainingValidators = toValidatorList(field.validator).filter(
        (validator) => validator !== requiredValidator,
      );

      field.setValidator(remainingValidators);
      field.setDecoratorProps({
        ...field.decoratorProps,
        feedbackLayout: originalFeedbackLayout,
      });
    };
  }, [field, isRequired, requiredValidator]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- fee card commented
  const columns = useMemo(
    () => [
      {
        title: t("SelectTable.columnNumber"),
        dataIndex: "Number",
        key: "Number",
      },
      {
        title: t("SelectTable.columnActivity"),
        dataIndex: "Activity",
        key: "Activity",
      },
      {
        title: (
          <div className="moneybox">
            {t("SelectTable.feesInAED")} (<img className="aedicon" src={AED} />)
          </div>
        ),
        dataIndex: "money",
        key: "money",
      },
    ],
    [t]
  );

  const handleSelectChange = (values: string[]) => {
    const current = field.value || {};
    const nextTable = (values || [])
      .map((v) => optionMap.get(String(v)))
      .filter(Boolean)
      .map((o, idx) => ({
        Number: idx + 1,
        Activity: o!.label,
        money: o!.price,
      }));

    const next = {
      ...current,
      selectedKey: values,
      tableData: nextTable,
    };

    field.setValue(next);
    field.validate?.();
  };

  // Respect form-level review/disabled mode: nested fields can keep selfPattern "editable"
  // while the form is "disabled", so check both form.pattern and field.pattern.
  const isDisabled =
    isNonEditablePattern(form.pattern) ||
    isNonEditablePattern(field.pattern) ||
    restSelectProps?.disabled ||
    !editable;

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  return (
    <>
      <div className="dn-select-table">
        <AntdCard
         className="Formliy-AntCard" 
          title={
            <span data-content-editable="x-component-props.activityTitle">
              {activityTitle}
            </span>
          }
        >
          <div className="formtitle">
            {activityLabelName}
            {isRequired && <span className="required-icon">*</span>}
            {(() => {
              const dp = field.decoratorProps ?? {};
              const tip = getBilingualValueByLang({
                lang,
                host,
                en: dp.tooltipEn,
                ar: dp.tooltipAr,
                legacy: dp.tooltip,
                fallback: "",
              });
              if (!tip || typeof tip !== "string") return null;
              const stripped = tip.replace(/<[^>]*>/g, "").trim();
              if (!stripped && !/<img\s/i.test(tip) && !/<video\s/i.test(tip))
                return null;
              const content = /<[a-z][\s\S]*>/i.test(tip) ? (
                <div
                  className="html-tooltip-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(tip) }}
                  style={{ maxWidth: 800 }}
                />
              ) : (
                tip
              );
              return (
                <Tooltip title={content} overlayInnerStyle={{ maxWidth: 800 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      marginLeft: 4,
                      lineHeight: 1,
                    }}
                  >
                    <QuestionCircleOutlined
                      style={{
                        color: "rgba(0,0,0,0.45)",
                        cursor: "help",
                        fontSize: 14,
                      }}
                    />
                  </span>
                </Tooltip>
              );
            })()}
          </div>
          <MultiSelectDropdown
            required={isRequired}
            placeholder={placeholder}
            value={selectedKey}
            onChange={handleSelectChange}
            options={dropdownOptions}
            disabled={isDisabled}
          />
          {!!(field as any)?.selfErrors?.length && (
            <div style={{ marginTop: 6, color: "#EA4F49", fontSize: 12 }}>
              {(field as any).selfErrors?.[0]}
            </div>
          )}
        </AntdCard>
        {/* Custom Components Container - renders dropped children */}
        {schema?.properties && Object.keys(schema.properties).length > 0 && (
          <div className="select-table-custom-container">
            {Object.keys(schema.properties).map((key) => (
              <RecursionField
                key={key}
                name={key}
                schema={schema.properties[key]}
              />
            ))}
          </div>
        )}
        {/* {selectedKey.length != 0 && (
          <AntdCard
            className="ServiceFeesCard"
            title={
              <span data-content-editable="x-component-props.title">
                {tableTitle}
              </span>
            }
          >
            <ArrayBase disabled>
              <div className="tabletitle">
                <Table
                  className="formtable"
                  dataSource={tableData}
                  columns={columns}
                  pagination={false}
                  size={tableSize}
                  bordered={tableBordered}
                  {...tableProps}
                />
              </div>
            </ArrayBase>
            <div className="table-footer">
              <div className="total-label">{t("SelectTable.totalFee")}</div>
              <div className="total-amount">
                <img src={AEDG} />
                {totalFee.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </AntdCard>
        )} */}
      </div>
    </>
  );
});
export default SelectTableField;
