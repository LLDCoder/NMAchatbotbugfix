import * as React from "react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { observer, useField, useForm } from "@formily/react";
import {
  Button,
  Modal,
  Table,
  Form,
  Select,
  Input,
  Pagination,
  Row,
  Col,
  Card as AntdCard,
  Tooltip,
  message,
} from "antd";
import {
  ExclamationCircleFilled,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
// @ts-expect-error -- legacy JS module without bundled typings
import { languageOptions } from "../LanguageSelectMulti/language";
import "../FormItemWithHtmlTooltip/index.less";
import {
  getLanguages,
  getMaterialTypes,
  type MaterialTypeLookupItem,
} from "../../../../../services/services";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { useUserStore } from "@/store/user";
import {
  SERVICE_302,
  SERVICE302_ALLOWED_OTHER_MATERIAL_CODES,
  createService302MaterialDuplicateKey,
} from "@/utils/service302Utils";
import type {
  DataListSourceConfig,
  DropdownOption,
} from "./Setter/DataListSourceSetter";
import "./DataList.less";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  getBilingualValueByLang,
  getEditableTitlePathByLang,
} from "@/components/designable/src/utils/bilingual";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";
import { normalizeDataListMaxItems } from "./dataListRules";
import { emiratesIdToDisplay } from "@/utils/emiratesId";
import { updateApplicationMaterialStatus } from "@/services/content";
import {
  createMaterialId,
  ensureService302MaterialIds,
  getService302MaterialLocatorKey,
  isService302NewspapersMagazinesMaterial,
  normalizeService302MaterialStatus,
  type Service302MaterialStatus,
  type Service302MaterialStatusStateChange,
} from "@/utils/service302MaterialStatus";

type DataRecord = Record<
  string,
  string | number | boolean | null | undefined
>;
type SelectOption = { label: string; value: string; saveLabel?: string };
type MaterialTypeOption = SelectOption & { code?: string };
type LanguageOption = SelectOption & { nameEn?: string; nameAr?: string };
type RawLookupItem = Record<string, unknown>;

type DataListProps = {
  value?: DataRecord[];
  onChange?: (value: DataRecord[]) => void;
  fieldSource?: DataListSourceConfig;
  addButtonText?: string;
  addButtonTextEn?: string;
  addButtonTextAr?: string;
  designMode?: boolean;
  title?: string;
  titleEn?: string;
  titleAr?: string;
  serviceCode?: number | string;
  maxItems?: number;
  /**
   * Authored in the designer and published in the schema; the applicant portal
   * enforces it (spec 7.1 / AC-09). Admin review is read-only so it does not
   * validate here, but the prop is declared to keep the contract explicit.
   */
  minItems?: number;
  uniqueLanguageRequired?: boolean;
  applicationId?: number;
  applicationDetailId?: number;
  taskId?: string;
  materialStatusEditable?: boolean;
  reviewStepIndex?: number;
  onMaterialStatusStateChange?: (
    change: Service302MaterialStatusStateChange,
  ) => void;
};

type FormilyFieldLike = {
  decoratorProps?: Record<string, unknown>;
  value?: unknown;
  pattern?: string;
  setValue?: (value: DataRecord[]) => void;
};

const PAGE_SIZE = 10;
const getFieldKey = (
  field: string | { fieldName: string; fieldKey?: string },
) => {
  if (typeof field === "object") {
    const explicitKey = field.fieldKey?.trim();
    if (explicitKey) {
      return explicitKey;
    }
    return field.fieldName.toLowerCase().replace(/\s+/g, "_");
  }
  return field.toLowerCase().replace(/\s+/g, "_");
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

function isHtmlTooltip(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function isEffectivelyEmptyTip(html: string): boolean {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return (
    stripped.length === 0 && !/<img\s/i.test(html) && !/<video\s/i.test(html)
  );
}

const getLocalizedName = (item: RawLookupItem, isAr: boolean) => {
  const candidates = isAr
    ? [
        item.nameAr,
        item.NameAr,
        item.labelAr,
        item.fullNameAr,
        item.nameEn,
        item.NameEn,
        item.labelEn,
        item.fullNameEn,
        item.name,
        item.label,
      ]
    : [
        item.nameEn,
        item.NameEn,
        item.labelEn,
        item.fullNameEn,
        item.nameAr,
        item.NameAr,
        item.labelAr,
        item.fullNameAr,
        item.name,
        item.label,
      ];
  return normalizeText(
    candidates.find((candidate) => normalizeText(candidate)),
  );
};

const isEquipmentList = (fieldSource?: DataListSourceConfig) =>
  fieldSource?.dataSource === "equipment_list";

const isMaterialList = (fieldSource?: DataListSourceConfig) =>
  fieldSource?.dataSource === "material_list";

const isLanguagesNameList = (fieldSource?: DataListSourceConfig) =>
  fieldSource?.dataSource === "languages_name_list";

const isListOfTrainees = (fieldSource?: DataListSourceConfig) =>
  fieldSource?.dataSource === "list_of_trainees";

const FIELD_NAME_TO_I18N_KEY: Record<string, string> = {
  Equipment: "equipment",
  Number: "number",
  Title: "title",
  Language: "language",
  "Number Of Title": "numberOfTitle",
  "Suggested Name": "suggestedName",
  "Publication Title": "publicationTitle",
  "Full Name": "fullName",
  "Emirates ID Number": "emiratesIdNumber",
  "Mobile Number": "mobileNumber",
  Email: "email",
};

const getEquipmentOptions = (
  fieldSource?: DataListSourceConfig,
): DropdownOption[] => {
  if (!isEquipmentList(fieldSource)) return [];
  return (
    fieldSource!.fields.find((f) => f.fieldName === "Equipment")?.options || []
  );
};

/** Matches "Other" in default equipment options (label Other, numeric id 12). */
const OTHER_EQUIPMENT_VALUE = "12";

const findEquipmentOption = (
  val: string | number | boolean | undefined | null,
  options: DropdownOption[],
): DropdownOption | undefined => {
  if (val == null || val === "") return undefined;
  const s = String(val);
  return options.find((o) => o.value === s || o.label === s);
};

const findMaterialTypeOption = (
  val: string | number | boolean | undefined | null,
  options: MaterialTypeOption[],
): MaterialTypeOption | undefined => {
  if (val == null || val === "") return undefined;
  const s = String(val).trim();
  return options.find(
    (o) =>
      o.value === s ||
      o.label === s ||
      o.saveLabel === s ||
      o.code === s,
  );
};

const findLanguageOption = (
  val: string | number | boolean | undefined | null,
  options: LanguageOption[],
): LanguageOption | undefined => {
  if (val == null || val === "") return undefined;
  const normalizedValue = String(val).trim().toLowerCase();
  return options.find((option) =>
    [
      option.value,
      option.label,
      option.saveLabel,
      option.nameEn,
      option.nameAr,
    ]
      .filter(Boolean)
      .some(
        (candidate) =>
          String(candidate).trim().toLowerCase() === normalizedValue,
      ),
  );
};

const getMaterialTypeDisplayValue = (
  record: DataRecord,
  options: MaterialTypeOption[],
) => {
  const opt =
    findMaterialTypeOption(record.customMaterialId, options) ||
    findMaterialTypeOption(record.materialTypeId, options) ||
    findMaterialTypeOption(record.material_type, options) ||
    findMaterialTypeOption(record.materialType, options) ||
    findMaterialTypeOption(record.materialTypeCode, options) ||
    findMaterialTypeOption(record.materialTypeName, options) ||
    findMaterialTypeOption(record.materialTypeNameEn, options) ||
    findMaterialTypeOption(record.materialTypeNameAr, options);

  if (opt?.label) {
    return opt.label;
  }

  if (
    typeof record.materialTypeName === "string" &&
    record.materialTypeName.trim()
  ) {
    return record.materialTypeName;
  }

  if (
    typeof record.materialTypeNameEn === "string" &&
    record.materialTypeNameEn.trim()
  ) {
    return record.materialTypeNameEn;
  }

  if (
    typeof record.materialTypeNameAr === "string" &&
    record.materialTypeNameAr.trim()
  ) {
    return record.materialTypeNameAr;
  }

  if (typeof record.material_type === "string" && record.material_type.trim()) {
    return record.material_type;
  }

  if (typeof record.materialType === "string" && record.materialType.trim()) {
    return record.materialType;
  }

  if (
    typeof record.materialTypeCode === "string" &&
    record.materialTypeCode.trim()
  ) {
    return record.materialTypeCode;
  }

  if (record.materialTypeId != null && record.materialTypeId !== "") {
    return String(record.materialTypeId);
  }

  return "";
};

const getEquipmentIdValue = (record: DataRecord) =>
  record.photoEquipmentId ?? record.PhotoEquipmentId ?? record.equipmentId;

const getEquipmentDescriptionValue = (record: DataRecord) =>
  record.otherText ?? record.Description ?? record.description;

const normalizeEquipmentRecord = (
  record: DataRecord,
  options: DropdownOption[],
): DataRecord => {
  const equipmentId = getEquipmentIdValue(record);
  const hasEquipmentId =
    equipmentId !== undefined && equipmentId !== null && equipmentId !== "";
  if (hasEquipmentId) {
    return record;
  }
  const opt =
    findEquipmentOption(record.equipment, options) ||
    findEquipmentOption(getEquipmentIdValue(record), options);
  if (!opt) {
    return record;
  }
  return {
    ...record,
    equipmentId: Number(opt.value),
    photoEquipmentId: Number(opt.value),
    PhotoEquipmentId: Number(opt.value),
    equipment: opt.label,
  };
};

const normalizeEquipmentData = (
  rows: DataRecord[],
  fieldSource?: DataListSourceConfig,
): DataRecord[] => {
  if (!isEquipmentList(fieldSource) || rows.length === 0) {
    return rows;
  }
  const options = getEquipmentOptions(fieldSource);
  if (options.length === 0) {
    return rows;
  }
  return rows.map((row) => normalizeEquipmentRecord(row, options));
};

const areDataRecordsEqual = (left: DataRecord[], right: DataRecord[]) => {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
};

/** ， antd 4 Form.Item  */
const NumberOnlyInput: React.FC<
  React.ComponentProps<typeof Input> & { maxLength?: number }
> = ({ onChange, ...rest }) => (
  <Input
    {...rest}
    onChange={(e) => {
      const digitsOnly = e.target.value.replace(/\D/g, "");
      (e.target as HTMLInputElement).value = digitsOnly;
      onChange?.(e);
    }}
  />
);

const DataListInner: React.FC<DataListProps> = observer(
  ({
    value = [],
    onChange,
    fieldSource,
    addButtonText,
    addButtonTextEn,
    addButtonTextAr,
    designMode,
    title,
    titleEn,
    titleAr,
    serviceCode,
    maxItems,
    applicationId,
    applicationDetailId,
    taskId,
    materialStatusEditable = false,
    reviewStepIndex = 0,
    onMaterialStatusStateChange,
  }) => {
    const { t, i18n } = useTranslation();
    const formilyField = useField() as unknown as FormilyFieldLike;
    const form = useForm();
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const previewLang =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18n.language);
    const lngOpt = previewLang === "ar" ? "ar" : "en";
    const isAr = previewLang === "ar";
    const tl = useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(i18n.t(key, { lng: lngOpt, ...options })),
      [i18n, lngOpt],
    );
    const tx = useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(i18n.t(`DataList.${key}`, { lng: lngOpt, ...options })),
      [i18n, lngOpt],
    );
    const fieldValue = useMemo(
      () =>
        (Array.isArray(formilyField.value)
          ? formilyField.value
          : value) as DataRecord[],
      [formilyField.value, value],
    );

    const generatedMaterialIdsRef = useRef(new Map<number, string>());
    const normalizeRowsWithMaterialIds = useCallback(
      (rows: DataRecord[]) =>
        ensureService302MaterialIds(rows, generatedMaterialIdsRef.current),
      [],
    );
    const [data, setData] = useState<DataRecord[]>(() =>
      normalizeRowsWithMaterialIds(fieldValue),
    );
    const dataRef = useRef(data);
    dataRef.current = data;
    const [modalVisible, setModalVisible] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [savingMaterialIds, setSavingMaterialIds] = useState<Set<string>>(
      () => new Set(),
    );
    const savingMaterialIdsRef = useRef(new Set<string>());
    const [modalForm] = Form.useForm();
    const equipmentFormValue = Form.useWatch("equipment", modalForm);
    const materialTypeFormValue = Form.useWatch("material_type", modalForm);
    const currentProfileId = useUserStore((state) => state.currentProfileId);
    const userInfo = useUserStore((state) => state.userInfo);
    const isService302Mode = Number(serviceCode) === SERVICE_302;
    const isFormLocked =
      form?.pattern === "disabled" ||
      form?.pattern === "readOnly" ||
      form?.pattern === "readPretty";
    const isDisabled =
      Boolean(designMode) ||
      formilyField.pattern === "disabled" ||
      formilyField.pattern === "readOnly" ||
      formilyField.pattern === "readPretty" ||
      isFormLocked;
    const showMaterialType = isMaterialList(fieldSource) || isService302Mode;
    const usesMaterialLanguageIds = isMaterialList(fieldSource);
    const showLanguageId =
      isLanguagesNameList(fieldSource) || usesMaterialLanguageIds;
    const canEditMaterialStatuses =
      isService302Mode &&
      materialStatusEditable &&
      !designMode &&
      Number.isFinite(Number(applicationId)) &&
      Number.isFinite(Number(applicationDetailId)) &&
      Boolean(taskId);
    const resolveFieldDisplayLabel = useCallback(
      (fieldName: string) =>
        FIELD_NAME_TO_I18N_KEY[fieldName]
          ? String(
              i18n.t(
                `DataList.sourceSetter.fieldLabels.${FIELD_NAME_TO_I18N_KEY[fieldName]}`,
                { lng: lngOpt },
              ),
            )
          : fieldName,
      [i18n, lngOpt],
    );
    const resolvedCardTitle = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: title,
      fallback: i18n.t("DataList.defaultTitle", {
        lng: lngOpt,
      }),
    });
    const resolvedAddButtonLabel = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: addButtonTextEn,
      ar: addButtonTextAr,
      legacy: addButtonText,
      fallback: i18n.t("DataList.defaultAddButton", {
        lng: lngOpt,
      }),
    });
    const editableTitleProp = getEditableTitlePathByLang(previewLang);
    const decoratorProps = (formilyField.decoratorProps ?? {}) as Record<
      string,
      unknown
    >;
    const descriptionTipRaw = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: decoratorProps.tooltipEn,
      ar: decoratorProps.tooltipAr,
      legacy: decoratorProps.tooltip,
      fallback: "",
    });
    const descriptionTipEl = useMemo(() => {
      if (
        typeof descriptionTipRaw !== "string" ||
        isEffectivelyEmptyTip(descriptionTipRaw)
      ) {
        return null;
      }
      const content = isHtmlTooltip(descriptionTipRaw) ? (
        <div
          className="html-tooltip-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(descriptionTipRaw) }}
          style={{ maxWidth: 800 }}
        />
      ) : (
        descriptionTipRaw
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
    }, [descriptionTipRaw]);
    const effectiveFieldSource = useMemo(() => {
      if (!isService302Mode || !fieldSource || !isMaterialList(fieldSource)) {
        return fieldSource;
      }

      const baseFields = Array.isArray(fieldSource.fields)
        ? fieldSource.fields
        : [];
      const hasTitleField = baseFields.some(
        (field) => field.fieldName === "Title",
      );
      const hasLanguageField = baseFields.some(
        (field) => field.fieldName === "Language",
      );
      const hasCountField = baseFields.some(
        (field) => field.fieldName === "Number Of Title",
      );

      return {
        ...fieldSource,
        fields: [
          ...(hasTitleField
            ? []
            : [
                {
                  fieldName: "Title",
                  fieldType: "string",
                  required: true,
                  placeholderText: "Enter Title",
                  listVisible: true,
                  formVisible: true,
                  displayType: "Text Input",
                },
              ]),
          ...(hasLanguageField
            ? []
            : [
                {
                  fieldName: "Language",
                  fieldType: "string",
                  required: true,
                  placeholderText: "Select Language",
                  listVisible: true,
                  formVisible: true,
                  displayType: "Dropdown",
                  options: [],
                },
              ]),
          ...(hasCountField
            ? []
            : [
                {
                  fieldName: "Number Of Title",
                  fieldType: "string",
                  required: true,
                  placeholderText: "Enter Number Of Title",
                  listVisible: true,
                  formVisible: true,
                  displayType: "Text Input",
                },
              ]),
          ...baseFields.filter((field) =>
            ["Title", "Language", "Number Of Title"].includes(field.fieldName),
          ),
        ],
      } as DataListSourceConfig;
    }, [fieldSource, isService302Mode]);

    const equipmentOptions = useMemo(
      () => getEquipmentOptions(effectiveFieldSource),
      [effectiveFieldSource],
    );
    const [materialTypeItemsRaw, setMaterialTypeItemsRaw] = useState<
      MaterialTypeLookupItem[]
    >([]);
    const [materialTypesLoading, setMaterialTypesLoading] = useState(false);
    const [languageItemsRaw, setLanguageItemsRaw] = useState<RawLookupItem[]>(
      [],
    );
    const [languagesLoading, setLanguagesLoading] = useState(false);
    const materialTypeOptions = useMemo<MaterialTypeOption[]>(
      () =>
        materialTypeItemsRaw
          .map((item) => ({
            value: String(item.id),
            label:
              getLocalizedName(item as unknown as RawLookupItem, isAr) ||
              item.code ||
              String(item.id),
            saveLabel:
              item.nameEn || item.nameAr || item.code || String(item.id),
            code: item.code,
          }))
          .filter((item) => {
            if (!isService302Mode) {
              return true;
            }

            const normalizedCode = String(item.code || "").toUpperCase();
            if (!SERVICE302_ALLOWED_OTHER_MATERIAL_CODES.has(normalizedCode)) {
              return false;
            }

            return normalizedCode !== "BK";
          }),
      [isAr, isService302Mode, materialTypeItemsRaw],
    );
    const languageSelectOptions = useMemo<LanguageOption[]>(
      () =>
        languageItemsRaw
          .filter((item) => item?.id != null && normalizeText(item.nameEn))
          .map((item) => {
            const nameEn = normalizeText(item.nameEn);
            const nameAr = normalizeText(item.nameAr);
            return {
              value: String(item.id),
              label: getLocalizedName(item, isAr) || nameEn,
              saveLabel: nameEn,
              nameEn,
              nameAr,
            };
          }),
      [isAr, languageItemsRaw],
    );
    const currentUserTypeId = useMemo(() => {
      if (!currentProfileId) return "";

      const establishmentUserType = userInfo.userEstablishments?.find(
        (item) => String(item.userProfileId) === String(currentProfileId),
      )?.userTypeId;
      if (establishmentUserType) {
        return String(establishmentUserType);
      }

      if (
        userInfo.userInvitation?.userProfileId &&
        String(userInfo.userInvitation.userProfileId) ===
          String(currentProfileId)
      ) {
        return String(userInfo.userInvitation.userTypeId || "");
      }

      return "";
    }, [
      currentProfileId,
      userInfo.userEstablishments,
      userInfo.userInvitation,
    ]);

    useEffect(() => {
      if (designMode) {
        if (
          effectiveFieldSource?.fields &&
          effectiveFieldSource.fields.length > 0
        ) {
          const rows: DataRecord[] = [];
          const previewRowCount = isLanguagesNameList(effectiveFieldSource)
            ? Math.min(3, normalizeDataListMaxItems(maxItems) ?? 3)
            : 3;
          for (let r = 0; r < previewRowCount; r++) {
            const row: DataRecord = {};
            effectiveFieldSource.fields.forEach((field) => {
              const key = getFieldKey(field);
              if (field.displayType === "Dropdown" && field.options?.[0]) {
                row[key] = field.options[r % field.options.length]?.value || "";
              } else {
                const fieldLabel = FIELD_NAME_TO_I18N_KEY[field.fieldName]
                  ? String(
                      i18n.t(
                        `DataList.sourceSetter.fieldLabels.${
                          FIELD_NAME_TO_I18N_KEY[field.fieldName]
                        }`,
                        { lng: lngOpt },
                      ),
                    )
                  : field.fieldName;
                row[key] = i18n.t("DataList.designSampleRow", {
                  lng: lngOpt,
                  field: fieldLabel,
                });
              }
            });
            rows.push(row);
          }
          if (!areDataRecordsEqual(data, rows)) {
            setData(rows);
          }
        } else {
          if (data.length > 0) {
            setData([]);
          }
        }
      } else {
        const normalized = normalizeRowsWithMaterialIds(
          normalizeEquipmentData(fieldValue || [], effectiveFieldSource),
        );
        if (!areDataRecordsEqual(data, normalized)) {
          setData(normalized);
        }
        if (
          !isDisabled &&
          !areDataRecordsEqual(normalized, fieldValue || [])
        ) {
          formilyField.setValue?.(normalized);
          onChange?.(normalized);
        }
      }
    }, [
      data,
      fieldValue,
      designMode,
      effectiveFieldSource,
      formilyField,
      onChange,
      i18n,
      lngOpt,
      maxItems,
      isDisabled,
      normalizeRowsWithMaterialIds,
    ]);

    useEffect(() => {
      if (
        designMode ||
        !showLanguageId ||
        (!usesMaterialLanguageIds && !modalVisible)
      ) {
        return;
      }

      let cancelled = false;
      setLanguagesLoading(true);

      getLanguages()
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray((res as { data?: unknown })?.data)
            ? (res as { data?: RawLookupItem[] }).data ?? []
            : [];
          setLanguageItemsRaw(list);
        })
        .catch(() => {
          if (!cancelled) {
            setLanguageItemsRaw([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLanguagesLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [designMode, modalVisible, showLanguageId, usesMaterialLanguageIds]);

    useEffect(() => {
      if (
        !modalVisible ||
        !usesMaterialLanguageIds ||
        languageSelectOptions.length === 0
      ) {
        return;
      }

      const currentLanguage = modalForm.getFieldValue("language");
      const languageOption = findLanguageOption(
        currentLanguage,
        languageSelectOptions,
      );
      if (
        languageOption &&
        String(currentLanguage) !== languageOption.value
      ) {
        modalForm.setFieldsValue({
          language: languageOption.value,
          languageId: Number(languageOption.value),
        });
      }
    }, [
      languageSelectOptions,
      modalForm,
      modalVisible,
      usesMaterialLanguageIds,
    ]);

    useEffect(() => {
      if (designMode || !showMaterialType || !currentUserTypeId) {
        return;
      }

      let cancelled = false;
      setMaterialTypesLoading(true);

      getMaterialTypes(currentUserTypeId)
        .then((res: { data?: MaterialTypeLookupItem[] }) => {
          if (cancelled) return;
          setMaterialTypeItemsRaw(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(() => {
          if (!cancelled) {
            setMaterialTypeItemsRaw([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setMaterialTypesLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [currentUserTypeId, designMode, showMaterialType]);

    const triggerChange = useCallback(
      (next: DataRecord[]) => {
        dataRef.current = next;
        setData(next);
        formilyField.setValue?.(next);
        onChange?.(next);
      },
      [formilyField, onChange],
    );

    const openAddModal = useCallback(() => {
      if (designMode || isDisabled) return;
      setIsViewMode(false);
      setEditingIndex(null);
      modalForm.resetFields();
      setModalVisible(true);
    }, [designMode, isDisabled, modalForm]);

    const openRecordModal = useCallback(
      (record: DataRecord, index: number, viewOnly: boolean) => {
        if (designMode || (isDisabled && !viewOnly)) return;
        setIsViewMode(viewOnly);
        setEditingIndex(index);
        const formValues = { ...record };
        if (isEquipmentList(effectiveFieldSource)) {
          const opt =
            findEquipmentOption(
              getEquipmentIdValue(record),
              equipmentOptions,
            ) || findEquipmentOption(record.equipment, equipmentOptions);
          if (opt) {
            formValues.equipment = opt.value;
            formValues.equipmentId = Number(opt.value);
            formValues.photoEquipmentId = Number(opt.value);
            formValues.PhotoEquipmentId = Number(opt.value);
          }
        }
        if (showMaterialType) {
          const materialTypeOption =
            findMaterialTypeOption(
              record.customMaterialId,
              materialTypeOptions,
            ) ||
            findMaterialTypeOption(
              record.materialTypeId,
              materialTypeOptions,
            ) ||
            findMaterialTypeOption(record.material_type, materialTypeOptions) ||
            findMaterialTypeOption(record.materialType, materialTypeOptions) ||
            findMaterialTypeOption(
              record.materialTypeCode,
              materialTypeOptions,
            ) ||
            findMaterialTypeOption(
              record.materialTypeName,
              materialTypeOptions,
            ) ||
            findMaterialTypeOption(
              record.materialTypeNameEn,
              materialTypeOptions,
            ) ||
            findMaterialTypeOption(
              record.materialTypeNameAr,
              materialTypeOptions,
            );
          if (materialTypeOption) {
            formValues.material_type = viewOnly
              ? materialTypeOption.label
              : materialTypeOption.value;
            formValues.materialTypeId = Number(materialTypeOption.value);
            if (materialTypeOption.code !== undefined) {
              formValues.materialTypeCode = materialTypeOption.code;
            } else {
              delete formValues.materialTypeCode;
            }
          } else if (viewOnly) {
            formValues.material_type = getMaterialTypeDisplayValue(
              record,
              materialTypeOptions,
            );
          } else if (
            record.materialTypeId != null &&
            record.materialTypeId !== ""
          ) {
            formValues.material_type = String(record.materialTypeId);
            formValues.materialTypeId = Number(record.materialTypeId);
            if (typeof record.materialTypeCode === "string") {
              formValues.materialTypeCode = record.materialTypeCode;
            } else {
              delete formValues.materialTypeCode;
            }
          }
        }
        if (showLanguageId) {
          const languageOption =
            findLanguageOption(record.languageId, languageSelectOptions) ||
            findLanguageOption(record.language, languageSelectOptions);
          if (languageOption) {
            formValues.language = languageOption.value;
            formValues.languageId = Number(languageOption.value);
          } else if (usesMaterialLanguageIds) {
            const rawLanguage = record.languageId ?? record.language;
            if (rawLanguage != null && rawLanguage !== "") {
              formValues.language = String(rawLanguage);
              const numericLanguageId = Number(rawLanguage);
              if (Number.isFinite(numericLanguageId)) {
                formValues.languageId = numericLanguageId;
              } else {
                delete formValues.languageId;
              }
            }
          } else if (record.languageId != null && record.languageId !== "") {
            formValues.language = String(record.languageId);
            formValues.languageId = Number(record.languageId);
          }
        }
        modalForm.setFieldsValue(formValues);
        setModalVisible(true);
      },
      [
        designMode,
        effectiveFieldSource,
        equipmentOptions,
        modalForm,
        isDisabled,
        languageSelectOptions,
        materialTypeOptions,
        showLanguageId,
        showMaterialType,
        usesMaterialLanguageIds,
      ],
    );

    const confirmDelete = useCallback(
      (index: number) => {
        if (designMode || isDisabled) return;
        setDeletingIndex(index);
        setDeleteModalVisible(true);
      },
      [designMode, isDisabled],
    );

    const handleDeleteConfirm = useCallback(() => {
      if (isDisabled) return;
      if (deletingIndex == null) return;
      const next = data.filter((_, i) => i !== deletingIndex);
      triggerChange(next);
      setDeleteModalVisible(false);
      setDeletingIndex(null);
      if (next.length > 0 && (currentPage - 1) * PAGE_SIZE >= next.length) {
        setCurrentPage(Math.max(1, Math.ceil(next.length / PAGE_SIZE)));
      }
    }, [currentPage, data, deletingIndex, isDisabled, triggerChange]);

    const handleOk = async () => {
      if (isDisabled) return;
      try {
        const values = await modalForm.validateFields();
        const item: DataRecord = { ...values };
        const existingItem =
          editingIndex == null ? undefined : data[editingIndex];
        item.materialId =
          normalizeText(existingItem?.materialId) || createMaterialId();
        const existingStatus = normalizeService302MaterialStatus(
          existingItem?.status,
        );
        if (existingStatus !== undefined) {
          item.status = existingStatus;
        }
        if (isEquipmentList(effectiveFieldSource)) {
          const opt = findEquipmentOption(values.equipment, equipmentOptions);
          if (opt) {
            item.equipment = opt.label;
            item.equipmentId = Number(opt.value);
            item.photoEquipmentId = Number(opt.value);
            item.PhotoEquipmentId = Number(opt.value);
            item.photoEquipmentNameEn = opt.label;
            if (opt.value === OTHER_EQUIPMENT_VALUE) {
              const description = String(values.description ?? "").trim();
              item.description = description;
              item.Description = description;
              item.otherText = description;
            } else {
              delete item.description;
              delete item.Description;
              delete item.otherText;
            }
          }
        }
        if (showMaterialType) {
          const opt = findMaterialTypeOption(
            values.material_type,
            materialTypeOptions,
          );
          if (opt) {
            item.material_type = opt.saveLabel ?? opt.label;
            item.materialTypeId = Number(opt.value);
            item.materialTypeCode = opt.code ?? "";
          }
        }
        if (showLanguageId) {
          const opt = findLanguageOption(
            values.language,
            languageSelectOptions,
          );
          if (opt) {
            item.language = usesMaterialLanguageIds
              ? Number(opt.value)
              : opt.saveLabel ?? opt.label;
            item.languageId = Number(opt.value);
          }
        }

        if (isService302Mode) {
          const duplicateKey = createService302MaterialDuplicateKey(
            item as Record<string, unknown>,
          );
          const hasDuplicate = data.some((row, index) => {
            if (editingIndex != null && index === editingIndex) {
              return false;
            }
            return (
              createService302MaterialDuplicateKey(
                row as Record<string, unknown>,
              ) === duplicateKey
            );
          });

          if (hasDuplicate) {
            message.error(t("DataList.validation.duplicateMaterial"));
            return;
          }
        }

        const next = [...data];
        if (editingIndex != null) {
          next[editingIndex] = item;
        } else {
          next.push(item);
        }
        triggerChange(next);
        setModalVisible(false);
        if (editingIndex == null) {
          setCurrentPage(Math.ceil(next.length / PAGE_SIZE));
        }
      } catch {
        // validation failed
      }
    };

    const handleMaterialStatusChange = useCallback(
      async (
        record: DataRecord,
        materialIndex: number,
        nextStatus: Service302MaterialStatus,
      ) => {
        const materialId = normalizeText(record.materialId);
        const previousStatus = normalizeService302MaterialStatus(record.status);
        if (
          !canEditMaterialStatuses ||
          !materialId ||
          savingMaterialIdsRef.current.has(materialId) ||
          previousStatus === nextStatus
        ) {
          return;
        }

        const locatorKey = getService302MaterialLocatorKey(
          reviewStepIndex,
          materialIndex,
        );
        const applyStatus = (
          status: Service302MaterialStatus | undefined,
          nextMaterialId = materialId,
        ) => {
          const next = dataRef.current.map((item, index) => {
            if (index !== materialIndex) return item;
            const nextItem: DataRecord = {
              ...item,
              materialId: nextMaterialId,
            };
            if (status === undefined) {
              delete nextItem.status;
            } else {
              nextItem.status = status;
            }
            return nextItem;
          });
          triggerChange(next);
        };

        savingMaterialIdsRef.current.add(materialId);
        applyStatus(nextStatus);
        setSavingMaterialIds((current) => {
          const next = new Set(current);
          next.add(materialId);
          return next;
        });
        onMaterialStatusStateChange?.({
          locatorKey,
          materialId,
          assigned: true,
          saving: true,
        });

        try {
          const response = await updateApplicationMaterialStatus({
            applicationId: Number(applicationId),
            applicationDetailId: Number(applicationDetailId),
            taskId: String(taskId),
            materialId,
            materialIndex,
            status: nextStatus,
          });
          const savedMaterialId =
            normalizeText(response?.data?.materialId) || materialId;
          const savedStatus =
            normalizeService302MaterialStatus(response?.data?.status) ??
            nextStatus;
          applyStatus(savedStatus, savedMaterialId);
          onMaterialStatusStateChange?.({
            locatorKey,
            materialId: savedMaterialId,
            assigned: true,
            saving: false,
          });
        } catch (error) {
          console.error("Failed to save application material status:", error);
          applyStatus(previousStatus);
          onMaterialStatusStateChange?.({
            locatorKey,
            materialId,
            assigned: previousStatus !== undefined,
            saving: false,
          });
          message.error(tx("materialStatusSaveFailed"));
        } finally {
          savingMaterialIdsRef.current.delete(materialId);
          setSavingMaterialIds((current) => {
            const next = new Set(current);
            next.delete(materialId);
            return next;
          });
        }
      },
      [
        applicationDetailId,
        applicationId,
        canEditMaterialStatuses,
        onMaterialStatusStateChange,
        reviewStepIndex,
        taskId,
        triggerChange,
        tx,
      ],
    );

    const hasNewspapersMagazinesRows = useMemo(
      () =>
        isService302Mode &&
        data.some((row) => isService302NewspapersMagazinesMaterial(row)),
      [data, isService302Mode],
    );

    const columns = useMemo(() => {
      const cols: ColumnsType<DataRecord> = [];

      if (showMaterialType) {
        const hasMaterialTypeColumn = cols.some(
          (col) => col.key === "material_type",
        );
        if (!hasMaterialTypeColumn) {
          cols.push({
            title: t("DataList.materialType"),
            dataIndex: "material_type",
            key: "material_type",
            ellipsis: true,
            render: (_: string | number | boolean, record: DataRecord) =>
              getMaterialTypeDisplayValue(record, materialTypeOptions),
          });
        }
      }

      if (effectiveFieldSource?.fields) {
        const traineeVariant = isListOfTrainees(effectiveFieldSource);
        effectiveFieldSource.fields
          .filter((field) => field.listVisible)
          .forEach((field) => {
            // For the List of Trainees variant, prefer the fixed camelCase
            // fieldKey (fullName / emiratesIdNumber / ...) so the read-only
            // column dataIndex matches the applicant-saved record key; other
            // data sources keep the fieldName-derived key.
            const key = traineeVariant
              ? getFieldKey(field)
              : getFieldKey(field.fieldName);
            cols.push({
              title: resolveFieldDisplayLabel(field.fieldName),
              dataIndex: key,
              key,
              ellipsis: true,
              render: (val: string | number | boolean, record: DataRecord) => {
                if (
                  traineeVariant &&
                  (field.fieldKey === "emiratesIdNumber" ||
                    field.displayType === "Emirates ID")
                ) {
                  // Read-only Emirates ID: format stored value (raw 15 digits
                  // or already masked) with the system-wide 784-XXXX-XXXXXXX-X
                  // mask; incomplete values fall back to the raw string.
                  const formatted = emiratesIdToDisplay(
                    val as string | number,
                  );
                  return formatted || val;
                }
                if (
                  field.fieldName === "Equipment" &&
                  isEquipmentList(effectiveFieldSource)
                ) {
                  const opts = field.options || [];
                  const opt =
                    findEquipmentOption(val, opts) ||
                    findEquipmentOption(getEquipmentIdValue(record), opts) ||
                    findEquipmentOption(record.equipment, opts);
                  const baseLabel = opt?.label ?? String(val ?? "");
                  const isOther =
                    opt?.value === OTHER_EQUIPMENT_VALUE ||
                    String(getEquipmentIdValue(record)) ===
                      OTHER_EQUIPMENT_VALUE ||
                    baseLabel === "Other";
                  const desc =
                    typeof getEquipmentDescriptionValue(record) === "string"
                      ? String(getEquipmentDescriptionValue(record)).trim()
                      : "";
                  if (isOther && desc) {
                    return tx("equipmentOtherWithDescription", {
                      description: desc,
                    });
                  }
                  return baseLabel || val;
                }
                if (field.displayType === "Dropdown") {
                  const opts: DropdownOption[] =
                    field.fieldName === "Language" &&
                    showLanguageId
                      ? languageSelectOptions
                      : field.fieldName === "Language"
                      ? (languageOptions as DropdownOption[])
                      : field.options || [];
                  const opt =
                    field.fieldName === "Language" &&
                    showLanguageId
                      ? findLanguageOption(
                          record.languageId ?? val,
                          opts as LanguageOption[],
                        ) ||
                        findLanguageOption(
                          record.language,
                          opts as LanguageOption[],
                        )
                      : opts?.find((o) => o.value === val);
                  return opt?.label || val;
                }
                return val;
              },
            });
          });
      }

      if (hasNewspapersMagazinesRows) {
        cols.push({
          title: tx("materialStatus"),
          dataIndex: "status",
          key: "material_status",
          width: 170,
          render: (value: unknown, record: DataRecord, index: number) => {
            if (!isService302NewspapersMagazinesMaterial(record)) {
              return "-";
            }

            const status = normalizeService302MaterialStatus(value);
            const materialId = normalizeText(record.materialId);
            const materialIndex = (currentPage - 1) * PAGE_SIZE + index;
            if (canEditMaterialStatuses) {
              const selectStatusModifier =
                status === 1
                  ? "datalist-material-status__select--approved"
                  : status === 0
                  ? "datalist-material-status__select--rejected"
                  : "";
              return (
                <Select
                  className={`datalist-material-status__select ${selectStatusModifier}`.trim()}
                  dropdownClassName="datalist-material-status__dropdown"
                  value={status}
                  placeholder={tx("materialStatusPlaceholder")}
                  loading={savingMaterialIds.has(materialId)}
                  disabled={savingMaterialIds.has(materialId)}
                  options={[
                    {
                      className:
                        "datalist-material-status__option datalist-material-status__option--approved",
                      label: tx("materialStatusApproved"),
                      value: 1,
                    },
                    {
                      className:
                        "datalist-material-status__option datalist-material-status__option--rejected",
                      label: tx("materialStatusRejected"),
                      value: 0,
                    },
                  ]}
                  onChange={(nextStatus: Service302MaterialStatus) =>
                    void handleMaterialStatusChange(
                      record,
                      materialIndex,
                      nextStatus,
                    )
                  }
                />
              );
            }

            if (status === undefined) return "-";
            const statusModifier =
              status === 1
                ? "datalist-material-status__pill--approved"
                : "datalist-material-status__pill--rejected";
            return (
              <span
                className={`datalist-material-status__pill ${statusModifier}`}
              >
                {status === 1
                  ? tx("materialStatusApproved")
                  : tx("materialStatusRejected")}
              </span>
            );
          },
        });
      }

      if (!designMode) {
        cols.push({
          title: tx("actions"),
          key: "actions",
          width: 140,
          render: (_: unknown, record: DataRecord, index: number) => {
            const realIndex = (currentPage - 1) * PAGE_SIZE + index;
            return (
              <span className="datalist-actions">
                {isDisabled ? (
                  <Button
                    type="link"
                    className="datalist-actions__view"
                    onClick={() => openRecordModal(record, realIndex, true)}
                  >
                    {tx("view")}
                  </Button>
                ) : (
                  <>
                    <a
                      className="action-edit"
                      onClick={() =>
                        openRecordModal(record, realIndex, false)
                      }
                    >
                      {tx("edit")}
                    </a>
                    <a
                      className="action-delete"
                      onClick={() => confirmDelete(realIndex)}
                    >
                      {tx("delete")}
                    </a>
                  </>
                )}
              </span>
            );
          },
        });
      }

      return cols;
    }, [
      effectiveFieldSource,
      currentPage,
      designMode,
      isDisabled,
      openRecordModal,
      confirmDelete,
      languageSelectOptions,
      materialTypeOptions,
      resolveFieldDisplayLabel,
      showLanguageId,
      showMaterialType,
      canEditMaterialStatuses,
      handleMaterialStatusChange,
      hasNewspapersMagazinesRows,
      savingMaterialIds,
      t,
      tx,
    ]);

    const handleEquipmentChange = useCallback(
      (val: string) => {
        const opt = findEquipmentOption(val, equipmentOptions);
        if (opt) {
          modalForm.setFieldsValue({
            equipmentId: Number(opt.value),
            photoEquipmentId: Number(opt.value),
            PhotoEquipmentId: Number(opt.value),
          });
        }
        if (val !== OTHER_EQUIPMENT_VALUE) {
          modalForm.setFieldsValue({
            description: undefined,
            Description: undefined,
            otherText: undefined,
          });
        }
      },
      [equipmentOptions, modalForm],
    );

    const selectedMaterialTypeOption = useMemo(
      () => findMaterialTypeOption(materialTypeFormValue, materialTypeOptions),
      [materialTypeFormValue, materialTypeOptions],
    );

    const shouldRequireService302Title =
      !isService302Mode || selectedMaterialTypeOption?.code !== "MG";

    const renderFormItems = () => {
      if (!effectiveFieldSource?.fields) return null;
      const showEquipmentId = isEquipmentList(effectiveFieldSource);
      return (
        <Row gutter={24}>
          {showEquipmentId && (
            <>
              <Form.Item name="equipmentId" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="photoEquipmentId" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="PhotoEquipmentId" hidden>
                <Input />
              </Form.Item>
            </>
          )}
          {showLanguageId && (
            <Form.Item name="languageId" hidden>
              <Input />
            </Form.Item>
          )}
          {showMaterialType && (
            <>
              <Form.Item name="materialTypeId" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="materialTypeCode" hidden>
                <Input />
              </Form.Item>
              <Col span={12} key="material_type">
                <Form.Item
                  label={t("DataList.materialType")}
                  name="material_type"
                  rules={[
                    {
                      required: true,
                      message: t("DataList.validation.selectMaterialType"),
                    },
                  ]}
                >
                  {isViewMode ? (
                    <Input />
                  ) : (
                    <Select
                      className="umc-select-arrow-manual"
                      placeholder={t("DataList.placeholders.selectMaterialType")}
                      loading={materialTypesLoading}
                      showSearch
                      options={materialTypeOptions}
                      optionFilterProp="label"
                    />
                  )}
                </Form.Item>
              </Col>
            </>
          )}
          {effectiveFieldSource.fields
            .filter((field) => field.formVisible)
            .flatMap((field) => {
              const key = getFieldKey(field);
              const isEquipmentField =
                field.fieldName === "Equipment" && showEquipmentId;
              const isTitleField = field.fieldName === "Title";
              const isNumericField = [
                "Number",
                "Number Of Title",
                "Quantity",
              ].includes(field.fieldName);
              const isLanguageField = field.fieldName === "Language";
              const isDropdownField = field.displayType === "Dropdown";
              const isTitleRequired = isTitleField
                ? shouldRequireService302Title
                : field.required;
              const displayLabel = resolveFieldDisplayLabel(field.fieldName);
              const mainCol = (
                <Col span={12} key={key}>
                  <Form.Item
                    label={displayLabel}
                    name={key}
                    rules={[
                      {
                        required: isTitleRequired,
                        message:
                          field.displayType === "Dropdown"
                            ? tx("validateSelectField", { field: displayLabel })
                            : tx("validateEnterField", { field: displayLabel }),
                      },
                      ...(["Suggested Name", "Title"].includes(field.fieldName)
                        ? [
                            {
                              pattern: /^.{0,200}$/,
                              message: tx("validateMaxChars200"),
                            },
                          ]
                        : []),
                      ...(isNumericField
                        ? [
                            {
                              pattern: /^[1-9]\d{0,4}$/,
                              message: tx("validateNaturalNumber99999"),
                            },
                          ]
                        : []),
                    ]}
                  >
                    {isDropdownField ? (
                      <Select
                        placeholder={field.placeholderText}
                        onChange={
                          isEquipmentField ? handleEquipmentChange : undefined
                        }
                        loading={
                          isLanguageField && showLanguageId
                            ? languagesLoading
                            : false
                        }
                      >
                        {(
                          (isLanguageField
                            ? showLanguageId
                              ? languageSelectOptions
                              : (languageOptions as DropdownOption[])
                            : isEquipmentField
                            ? equipmentOptions
                            : field.options || []) as DropdownOption[]
                        ).map((opt) => (
                          <Select.Option key={opt.value} value={opt.value}>
                            {opt.label}
                          </Select.Option>
                        ))}
                      </Select>
                    ) : isNumericField ? (
                      <NumberOnlyInput
                        placeholder={field.placeholderText}
                        maxLength={15}
                      />
                    ) : (
                      <Input placeholder={field.placeholderText} />
                    )}
                  </Form.Item>
                </Col>
              );
              if (
                isEquipmentField &&
                equipmentFormValue === OTHER_EQUIPMENT_VALUE
              ) {
                return [
                  mainCol,
                  <Col span={12} key="equipment-other-description">
                    <Form.Item
                      label={tx("labelDescription")}
                      name="description"
                      rules={[
                        {
                          required: true,
                          message: tx("validateEnterDescription"),
                        },
                        {
                          pattern: /^.{1,100}$/,
                          message: tx("validateMaxChars100"),
                        },
                      ]}
                    >
                      <Input
                        placeholder={tx("placeholderDescribeEquipment")}
                        maxLength={100}
                      />
                    </Form.Item>
                  </Col>,
                ];
              }
              return [mainCol];
            })}
        </Row>
      );
    };

    const getModalTitle = () => {
      if (isViewMode) return tx("view");
      if (editingIndex != null) return tx("modalEdit");
      const ds = effectiveFieldSource?.dataSource;
      if (ds === "equipment_list") return tx("modalAddEquipmentSource");
      if (ds === "material_list") return tx("modalAddMaterialSource");
      if (ds === "languages_name_list")
        return tx("modalAddLanguagesNameSource");
      if (ds === "list_of_trainees") return tx("modalAddTraineeSource");
      return tx("modalAddNew");
    };

    const pagedData = useMemo(() => {
      const start = (currentPage - 1) * PAGE_SIZE;
      return data.slice(start, start + PAGE_SIZE);
    }, [data, currentPage]);

    const hasConfig =
      effectiveFieldSource?.fields && effectiveFieldSource.fields.length > 0;
    const paginationShowTotal = useCallback(
      (total: number, range: [number, number]) =>
        tx("paginationRangeOfTotal", {
          start: range[0],
          end: range[1],
          total,
        }),
      [tx],
    );

    return (
      <div className="datalist-wrapper">
        <AntdCard
          title={
            <div className="datalist-inner-header">
              <div className="datalist-inner-header-box">
                <div
                  className="datalist-inner-title"
                  data-content-editable={editableTitleProp}
                >
                  {resolvedCardTitle}
                  <span className="required-icon">*</span>
                </div>
                {descriptionTipEl}
              </div>
              {!isDisabled && !designMode && (
                <Button
                  type="primary"
                  className="datalist-add-btn"
                  onClick={openAddModal}
                  disabled={!hasConfig}
                >
                  {resolvedAddButtonLabel}
                </Button>
              )}
            </div>
          }
          className="datalist-card"
        >
          {hasConfig ? (
            <>
              {data.length > 0 ? (
                <>
                  <Table
                    rowKey={(record, index) =>
                      normalizeText(record.materialId) || `row-${index}`
                    }
                    columns={columns}
                    dataSource={pagedData}
                    pagination={false}
                    className="datalist-table"
                    tableLayout="fixed"
                  />
                  {data.length > PAGE_SIZE && (
                    <div className="datalist-pagination">
                      <Pagination
                        current={currentPage}
                        pageSize={PAGE_SIZE}
                        total={data.length}
                        onChange={setCurrentPage}
                        size="small"
                        showTotal={paginationShowTotal}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="datalist-empty">
                  <EmptyBox title={tx("noDataAvailable")} />
                </div>
              )}
            </>
          ) : (
            <div className="datalist-empty">
              <EmptyBox
                title={i18n.t("DataList.configureDataSourceFirst", {
                  lng: lngOpt,
                })}
              />
            </div>
          )}
        </AntdCard>

        {/* Add / Edit Modal */}
        <Modal
          centered
          title={getModalTitle()}
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          destroyOnClose
          className="datalist-form-modal"
          maskClosable={false}
          getContainer={() => document.body}
          width={900}
        >
          <Form
            form={modalForm}
            layout="vertical"
            disabled={isViewMode}
            className="Formily-Modal-Form"
          >
            {renderFormItems()}
          </Form>
          <div className="modal-footer-custom">
            <Button
              onClick={() => setModalVisible(false)}
              className="cancel-btn"
            >
              {isViewMode
                ? tx("close")
                : tl("DataList.sourceSetter.cancel")}
            </Button>
            {!isViewMode && (
              <Button type="primary" onClick={handleOk} className="save-btn">
                {editingIndex != null
                  ? tl("DataList.sourceSetter.save")
                  : tx("confirm")}
              </Button>
            )}
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          centered
          title={null}
          visible={deleteModalVisible}
          onCancel={() => setDeleteModalVisible(false)}
          footer={null}
          destroyOnClose
          className="datalist-delete-modal"
          width={480}
          maskClosable={false}
          getContainer={() => document.body}
          closable={false}
        >
          <div className="delete-modal-content">
            <div className="delete-modal-icon">
              <ExclamationCircleFilled />
            </div>
            <div className="delete-modal-body">
              <div className="delete-modal-title">
                {tx("deleteRecordTitle")}
              </div>
              <div className="delete-modal-desc">
                {tx("deleteRecordConfirm")}
              </div>
            </div>
          </div>
          <div className="delete-modal-footer">
            <Button
              onClick={() => setDeleteModalVisible(false)}
              className="cancel-btn"
            >
              {tl("DataList.sourceSetter.cancel")}
            </Button>
            <Button
              type="primary"
              danger
              onClick={handleDeleteConfirm}
              className="confirm-btn"
            >
              {tx("confirm")}
            </Button>
          </div>
        </Modal>
      </div>
    );
  },
);

export type { DataListProps };

export default DataListInner;
