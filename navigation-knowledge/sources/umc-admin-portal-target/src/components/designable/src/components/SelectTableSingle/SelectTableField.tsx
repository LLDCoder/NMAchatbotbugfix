// SelectTableSingleField.tsx
import React, { useEffect, useMemo } from "react";
import { Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
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

type SelectTableSingleValue = {
  selectedKey?: unknown;
  tableData?: unknown;
};

export const SelectTableSingleField: React.FC<any> = observer((props) => {
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const t = i18n.getFixedT(lang);
  const field = useField<any>();
  const schema = useFieldSchema();
  const servicesCode = useServicesStore((s) => s.userInfo?.servicesCode);
  const form = useForm();
  const {
    options = [],
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
    activityConfiguration, // eslint-disable-line @typescript-eslint/no-unused-vars -- designer only; fee card commented
    visible = true,
    editable = true,
    tableSize = "small", // eslint-disable-line @typescript-eslint/no-unused-vars -- fee card commented
    tableBordered = true, // eslint-disable-line @typescript-eslint/no-unused-vars -- fee card commented
    tableProps = {}, // eslint-disable-line @typescript-eslint/no-unused-vars -- fee card commented
    requiredMessage: requiredMessageProp,
    ...restSelectProps
  } = props;

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
  const tableTitle = tableTitleProp ?? t("SelectTableSingle.defaultTableTitle");
  const defaultActivityLabelName = t("SelectTableSingle.defaultActivityLabelName");
  const defaultActivityLabelNameEn = i18n.t(
    "SelectTableSingle.defaultActivityLabelName",
    { lng: "en" },
  );
  const defaultPlaceholder = t("SelectTableSingle.defaultPlaceholder");
  const defaultPlaceholderEn = i18n.t(
    "SelectTableSingle.defaultPlaceholder",
    { lng: "en" },
  );
  const defaultActivityTitle = t("SelectTableSingle.defaultActivityTitle");
  const defaultActivityTitleEn = i18n.t(
    "SelectTableSingle.defaultActivityTitle",
    { lng: "en" },
  );
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
    }) ||
    (host === "designer" ? "" : defaultActivityLabelName);
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
    requiredMessageProp ?? t("SelectTableSingle.requiredMessage");

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
    }) ||
    (host === "designer" ? "" : defaultActivityTitle);

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

  const fieldValue = useMemo<SelectTableSingleValue>(
    () =>
      field.value && typeof field.value === "object"
        ? (field.value as SelectTableSingleValue)
        : {},
    [field.value],
  );
  const rawSelected = fieldValue.selectedKey;
  const tableData = useMemo(() => {
    const td = fieldValue.tableData;
    return Array.isArray(td) ? td : [];
  }, [fieldValue]);
  const selectedKeyFromValue: string[] = (
    Array.isArray(rawSelected)
      ? rawSelected
      : rawSelected !== undefined && rawSelected !== null && rawSelected !== ""
        ? [rawSelected]
        : []
  ).map((k: string | number) => String(k));
  const selectedKey =
    selectedKeyFromValue.length > 0
      ? selectedKeyFromValue
      : tableData
          .map((row) =>
            row && typeof row === "object"
              ? (row as {
                  Id?: unknown;
                  id?: unknown;
                  value?: unknown;
                  ActivityId?: unknown;
                  activityId?: unknown;
                }).Id ??
                (row as { id?: unknown }).id ??
                (row as { value?: unknown }).value ??
                (row as { ActivityId?: unknown }).ActivityId ??
                (row as { activityId?: unknown }).activityId
              : undefined,
          )
          .filter((key) => key !== undefined && key !== null && key !== "")
          .map(String);

  // Ensure review/disabled views can still render saved selections even when
  // the activity API is unavailable or no longer contains the historical item.
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
        category: t("SelectTableSingle.savedCategory"),
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

  const requiredValidator = useMemo(() => {
    return (value: any) => {
      const selected = value?.selectedKey;
      if (Array.isArray(selected))
        return selected.length > 0 ? "" : requiredMessage;
      return selected ? "" : requiredMessage;
    };
  }, [requiredMessage]);

  useEffect(() => {
    field.required = true;
    field.setValidator(requiredValidator);
    (field as any).decoratorProps = {
      ...(field as any).decoratorProps,
      feedbackLayout: "none",
    };
  }, [field, requiredValidator]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- fee card commented
  const columns = useMemo(
    () => [
      {
        title: t("SelectTableSingle.columnNumber"),
        dataIndex: "Number",
        key: "Number",
      },
      {
        title: t("SelectTableSingle.columnActivity"),
        dataIndex: "Activity",
        key: "Activity",
      },
      {
        title: (
          <div className="moneybox">
            {t("SelectTableSingle.feesInAED")} (
            <img className="aedicon" src={AED} />)
          </div>
        ),
        dataIndex: "money",
        key: "money",
      },
    ],
    [t],
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

  const isDisabled =
    isNonEditablePattern(form.pattern) ||
    isNonEditablePattern(field.pattern) ||
    restSelectProps?.disabled ||
    !editable;

  if (!visible) {
    return null;
  }

  return (
    <>
      <div className="dn-select-table">
        <AntdCard
         className="Formliy-AntCard" 
          title={
            <span
              data-content-editable={
                lang === "ar"
                  ? "x-component-props.activityTitleAr"
                  : "x-component-props.activityTitleEn"
              }
            >
              {activityTitle}
            </span>
          }
        >
          <div className="formtitle">
            {activityLabelName}
<span className="required-icon">*</span>
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
            required
            placeholder={placeholder}
            value={selectedKey}
            onChange={handleSelectChange}
            options={dropdownOptions}
            disabled={isDisabled}
            multiple={false}
          />
          {!!(field as any)?.selfErrors?.length && (
            <div style={{ marginTop: 6, color: "#EA4F49", fontSize: 12 }}>
              {(field as any).selfErrors?.[0]}
            </div>
          )}
        </AntdCard>
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
              <div className="total-label">{t("SelectTableSingle.totalFee")}</div>
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

export default SelectTableSingleField;
