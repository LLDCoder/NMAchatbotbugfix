import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { observer, useField, useForm, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Checkbox, Input, Select, Row, Col, Radio, Card as AntdCard } from "antd";
import "./index.less";
import { LanguageSelect as LanguageSelectComponent } from "../LanguageSelect/LanguageSelect";
import { DraftFileOrLinkField } from "../DraftFileOrLink/DraftFileOrLinkField";
import type { DraftFileOrLinkType } from "../DraftFileOrLink/schemaContract";
import DocumentViewer from "@/components/common/DocumentViewer";
import AIText from "../../../../../assets/images/AIText.svg";

import {
  getSubjectList,
  getSubjectSubList,
  getLookupData,
  getLanguages,
} from "../../../../../services/services";
import { getPublicationTypeByProfileId } from "@/services/userProfile.ts";
import { analyzeBookMaterial } from "@/services/myRequest";
import { CustomMessage } from "@/components/common";
import { useServicesStore } from "@/store/services";
import { useTranslation } from "react-i18next";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  getBilingualValueByLang,
  getEditableTitlePathByLang,
} from "@/components/designable/src/utils/bilingual";
import {
  getReadOnlyMultiSelectProps,
  isNonEditablePattern,
} from "@/components/designable/src/utils/readOnlyMultiSelect";
import i18n from "@/localization/config";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";

const { Option } = Select;
interface Subject {
  id: number;
  Id?: number;
  nameAr: string;
  nameEn: string;
  NameAr?: string;
  NameEn?: string;
  code: string;
  descAr: string | null;
  descEn: string | null;
}
type PublicationFormValue = {
  typeOfPublication?: string;
  publicationTitle?: string;
  language?: string;
  AIMaterialRecognition?: string;
  AIMaterialRecognitionType?: DraftFileOrLinkType;
  AIMaterialRecognitionPassword?: string;
  AIGeneratedFieldKeys?: string[];
  OriginalFileName?: string;
  AIMaterialRecognitionAnalysisStatus?: string;
  AIMaterialRecognitionMappingWarnings?: string[];
  UploadObligationLetter?: string | string[];
  [key: string]: any;
};
type OptionType = {
  label: string;
  value: number | string;
  [key: string]: any;
};

type PublicationTypeKind =
  | "unselected"
  | "book"
  | "map"
  | "brochures_and_posters"
  | "unknown";

const AI_OPTION_FIELDS = new Set([
  "SubjectCategory",
  "SubjectSubCategory",
  "Language",
  "AuthorName",
  "PublicationTitle",
]);

const BOOK_ONLY_FIELD_NAMES = [
  "ArticleType",
  "IssueNumbe",
  "PublishMethod",
  "CoverTypes",
  "SubjectCategory",
  "SubjectSubCategory",
] as const;

const BOOK_TYPE_MATCHERS = new Set(["1", "bk", "book"]);
const MAP_TYPE_MATCHERS = new Set(["2", "mp", "map"]);
const BROCHURES_AND_POSTERS_TYPE_MATCHERS = new Set([
  "6",
  "ot",
  "brochures and posters",
]);

function normalizeText(value?: string | number | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getPublicationTypeKind(
  typeValue: unknown,
  selectedOption?: OptionType,
): PublicationTypeKind {
  const matcherCandidates = [
    typeValue,
    selectedOption?.value,
    selectedOption?.label,
    selectedOption?.code,
    selectedOption?.nameEn,
    selectedOption?.NameEn,
  ]
    .map((item) => normalizeText(item as string | number | null))
    .filter(Boolean);

  if (matcherCandidates.length === 0) {
    return "unselected";
  }

  if (matcherCandidates.some((item) => BOOK_TYPE_MATCHERS.has(item))) {
    return "book";
  }

  if (matcherCandidates.some((item) => MAP_TYPE_MATCHERS.has(item))) {
    return "map";
  }

  if (
    matcherCandidates.some((item) =>
      BROCHURES_AND_POSTERS_TYPE_MATCHERS.has(item),
    )
  ) {
    return "brochures_and_posters";
  }

  return "unknown";
}

function extractResponseArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    const data = (res as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

function normalizeOptionLabel(value: unknown) {
  return normalizeText(value as string | number | null);
}

function findOptionValueByLabel(options: OptionType[], targetLabel: unknown) {
  const normalizedTargetLabel = normalizeOptionLabel(targetLabel);
  if (!normalizedTargetLabel) return undefined;

  return options.find(
    (option) => normalizeOptionLabel(option.label) === normalizedTargetLabel,
  )?.value;
}

function findOptionValuesByLabels(
  options: OptionType[],
  targetLabels: unknown,
) {
  const normalizedLabels = (
    Array.isArray(targetLabels) ? targetLabels : [targetLabels]
  )
    .map((item) => normalizeOptionLabel(item))
    .filter((item) => item !== "");

  if (normalizedLabels.length === 0) {
    return [];
  }

  return normalizedLabels
    .map(
      (label) =>
        options.find((option) => normalizeOptionLabel(option.label) === label)
          ?.value,
    )
    .filter(
      (value): value is string | number =>
        value !== undefined && value !== null && value !== "",
    );
}

function ensureOptionForValue(
  options: OptionType[],
  value: unknown,
): OptionType[] {
  if (value === undefined || value === null || value === "") {
    return options;
  }

  const values = Array.isArray(value) ? value : [value];
  const nextOptions = [...options];

  values.forEach((item) => {
    const hasExistingOption = nextOptions.some(
      (option) =>
        String(option.value) === String(item) ||
        normalizeOptionLabel(option.label) === normalizeOptionLabel(item),
    );

    if (!hasExistingOption) {
      nextOptions.push({
        label: String(item),
        value: item as string | number,
      });
    }
  });

  return nextOptions;
}

export const PublicationFormField: React.FC<any> = observer((props) => {
  const { titleEn, titleAr, title, ...restProps } = props;
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const field = useField<any>();
  const form = useForm();
  if (!field) {
    return null;
  }
  const isReadOnlyMode =
    isNonEditablePattern(field.pattern) ||
    isNonEditablePattern(form.pattern);
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const isAr = previewLang === "ar";
  const i18nLng = previewLang === "ar" ? "ar" : "en";
  const tf = React.useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`PublicationForm.${key}`, {
          lng: i18nLng,
          ...(options ?? {}),
        }),
      ),
    [i18nLng],
  );
  const displayCardTitle = useMemo(() => {
    const raw = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: typeof title === "string" ? title : undefined,
      fallback: "",
    });
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed.length > 0) {
      return trimmed;
    }
    if (host === "designer") {
      return "";
    }
    return i18n.t("PublicationForm.defaultCardTitle", {
      lng: previewLang === "ar" ? "ar" : "en",
    });
  }, [previewLang, host, titleEn, titleAr, title]);
  const editableTitlePath = getEditableTitlePathByLang(previewLang);
  const uploadPlaceholder = i18n.t("PublicationForm.uploadPlaceholder", {
    lng: previewLang === "ar" ? "ar" : "en",
  });
  useEffect(() => {
    field.decoratorProps = {
      ...field.decoratorProps,
      colon: false,
      label: false,
    };
  }, [field]);
  const storeServiceCode = useServicesStore((state) => state.userInfo.servicesCode);
  const serviceCode = props.serviceCode ?? storeServiceCode;
  const current: PublicationFormValue = field.value || {};
  const [SubjectCategoryOptions, setSubjectCategoryOptions] = useState<
    OptionType[]
  >([]);
  const [typeOfPublicationOptions, settypeOfPublicationOptions] = useState<
    OptionType[]
  >([]);
  const [PublishMethodOptions, setPublishMethodOptions] = useState<
    OptionType[]
  >([]);
  const [CoverTypeOptions, setCoverTypeOptions] = useState<OptionType[]>([]);
  const [LanguageOptions, setLanguageOptions] = useState<OptionType[]>([]);
  const [SubjectSubCategoryOptions, setSubjectSubCategoryOptions] = useState<
    OptionType[]
  >([]);
  const mapLookupOption = React.useCallback(
    (item: Subject, value: string | number) => ({
      label:
        preferLocalizedEnAr(
          isAr,
          item.nameEn ?? item.NameEn,
          item.nameAr ?? item.NameAr,
        ) || String(value),
      value,
      ...item,
    }),
    [isAr],
  );
  useEffect(() => {
    getSubjectList().then((res) => {
      setSubjectCategoryOptions(
        extractResponseArray<Subject>(res).map((item) =>
          mapLookupOption(item, item.id),
        ),
      );
    });
    getLookupData("PublishMethods").then((res) => {
      setPublishMethodOptions(
        extractResponseArray<Subject>(res).map((item) =>
          mapLookupOption(item, item.Id ?? item.id),
        ),
      );
    });
    getLookupData("CoverTypes").then((res) => {
      setCoverTypeOptions(
        extractResponseArray<Subject>(res).map((item) =>
          mapLookupOption(item, item.Id ?? item.id),
        ),
      );
    });
    getLanguages().then((res) => {
      setLanguageOptions(
        extractResponseArray<Subject>(res).map((item) =>
          mapLookupOption(item, item.Id ?? item.id),
        ),
      );
    });

    getPublicationTypeByProfileId().then((res) => {
      settypeOfPublicationOptions(
        extractResponseArray<Subject>(res).map((item) =>
          mapLookupOption(item, item.Id ?? item.id),
        ),
      );
    });
  }, [mapLookupOption]);

  const getSelectedTypeOfPublicationOption = React.useCallback(
    (typeValue?: string | number | null) =>
      typeOfPublicationOptions.find(
        (item) =>
          String(item.value) === String(typeValue ?? "") ||
          normalizeOptionLabel(item.id) === normalizeOptionLabel(typeValue) ||
          normalizeOptionLabel(item.code) === normalizeOptionLabel(typeValue) ||
          normalizeOptionLabel(item.label) === normalizeOptionLabel(typeValue),
      ),
    [typeOfPublicationOptions],
  );

  const selectedTypeOfPublicationOption = React.useMemo(
    () => getSelectedTypeOfPublicationOption(current.TypeOfPublication),
    [current.TypeOfPublication, getSelectedTypeOfPublicationOption],
  );

  const publicationTypeKind = React.useMemo(
    () =>
      getPublicationTypeKind(
        current.TypeOfPublication,
        selectedTypeOfPublicationOption,
      ),
    [current.TypeOfPublication, selectedTypeOfPublicationOption],
  );

  const isBookType = publicationTypeKind === "book";

  useEffect(() => {
    const fetchSubjectSubList = async () => {
      if (isBookType && current.SubjectCategory) {
        try {
          const res = await getSubjectSubList();
          const filteredOptions = extractResponseArray<Subject>(res)
            .filter(
              (item: any) => item.subjectCategoryId === current.SubjectCategory,
            )
            .map((item: any) => ({
              label:
                preferLocalizedEnAr(
                  isAr,
                  item.nameEn ?? item.NameEn,
                  item.nameAr ?? item.NameAr,
                ) || String(item.id),
              value: item.id,
              ...item,
            }));
          setSubjectSubCategoryOptions(
            ensureOptionForValue(filteredOptions, current.SubjectSubCategory),
          );
        } catch (error) {
          console.error("Failed to fetch subject sub list:", error);
          setSubjectSubCategoryOptions(
            ensureOptionForValue([], current.SubjectSubCategory),
          );
        }
      } else {
        setSubjectSubCategoryOptions(
          ensureOptionForValue([], current.SubjectSubCategory),
        );
      }
    };

    fetchSubjectSubList();
  }, [current.SubjectCategory, current.SubjectSubCategory, isAr, isBookType]);
  const shouldShowCoverTypes =
    isBookType &&
    (Array.isArray(current.PublishMethod)
      ? current.PublishMethod.some((item) => String(item) === "1")
      : String(current.PublishMethod ?? "") === "1");

  const aiGeneratedFieldKeys = Array.isArray(current.AIGeneratedFieldKeys)
    ? current.AIGeneratedFieldKeys.filter(
        (key): key is string =>
          typeof key === "string" && AI_OPTION_FIELDS.has(key),
      )
    : [];
  const shouldShowAiIndicator = (name: string) =>
    aiGeneratedFieldKeys.includes(name);
  const subjectCategoryDisplayOptions = React.useMemo(
    () => ensureOptionForValue(SubjectCategoryOptions, current.SubjectCategory),
    [SubjectCategoryOptions, current.SubjectCategory],
  );
  const subjectSubCategoryDisplayOptions = React.useMemo(
    () =>
      ensureOptionForValue(
        SubjectSubCategoryOptions,
        current.SubjectSubCategory,
      ),
    [SubjectSubCategoryOptions, current.SubjectSubCategory],
  );
  const languageDisplayOptions = React.useMemo(
    () => ensureOptionForValue(LanguageOptions, current.Language),
    [LanguageOptions, current.Language],
  );
  const resetFieldState = React.useCallback(
    (name: string) => {
      const targetField =
        (field.query(`${field.address}.${name}`).take() as any) ||
        (field.query(name).take() as any);
      if (!targetField) return;

      targetField.setFeedback?.({
        type: "error",
        messages: [],
      });
      targetField.setValidator?.(() => "");
      targetField.setValue?.(undefined);
      targetField.setState?.((state: any) => {
        state.required = false;
        state.selfErrors = [];
        state.selfWarnings = [];
        state.selfSuccesses = [];
        state.selfValidating = false;
        state.validating = false;
      });
    },
    [field],
  );
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  useEffect(() => {
    if (
      isBookType &&
      (current.ArticleType === undefined ||
        current.ArticleType === null ||
        current.ArticleType === "")
    ) {
      handleFieldChange("ArticleType", "Original");
    }
  }, [current.ArticleType, isBookType]);
  const handleFieldChange = (key: string, value: any) => {
    const newValue = {
      ...current,
      [key]: value,
    };

    if (key === "SubjectCategory") {
      newValue.SubjectSubCategory = undefined;
      setSubjectSubCategoryOptions([]);
    }
    if (key === "Language") {
      newValue.Language = value.join(",");
    }
    if (key === "TypeOfPublication") {
      const nextTypeOption = getSelectedTypeOfPublicationOption(value);
      const nextTypeKind = getPublicationTypeKind(value, nextTypeOption);
      const isLeavingBook =
        publicationTypeKind === "book" && nextTypeKind !== "book";
      const isEnteringBook =
        publicationTypeKind !== "book" && nextTypeKind === "book";

      if (isLeavingBook) {
        BOOK_ONLY_FIELD_NAMES.forEach((name) => {
          delete newValue[name];
          resetFieldState(name);
        });
        delete newValue.AIGeneratedFieldKeys;
        delete newValue.AIMaterialRecognitionAnalysisStatus;
        delete newValue.AIMaterialRecognitionMappingWarnings;
        setSubjectSubCategoryOptions([]);
      }

      if (isEnteringBook && !newValue.ArticleType) {
        newValue.ArticleType = "Original";
      }
    }
    if (key === "AIMaterialRecognition") {
      delete newValue.AIGeneratedFieldKeys;
      delete newValue.AIMaterialRecognitionAnalysisStatus;
      delete newValue.AIMaterialRecognitionMappingWarnings;
      delete newValue.OriginalFileName;
    }
    if (key === "PublishMethod") {
      const shouldKeepCoverTypes = Array.isArray(value)
        ? value.some((item) => String(item) === "1")
        : String(value ?? "") === "1";

      if (!shouldKeepCoverTypes) {
        delete newValue.CoverTypes;
        resetFieldState("CoverTypes");
      }
    }
    field.setValue(newValue);
  };

  const handleMaterialChange = (value: string) => {
    const latestValue: PublicationFormValue = field.value || {};
    const newValue: PublicationFormValue = {
      ...latestValue,
      AIMaterialRecognition: value,
    };

    delete newValue.AIGeneratedFieldKeys;
    delete newValue.AIMaterialRecognitionAnalysisStatus;
    delete newValue.AIMaterialRecognitionMappingWarnings;
    delete newValue.OriginalFileName;
    field.setValue(newValue);
  };

  const handleUploadMaterialAnalysisSuccess = React.useCallback(
    async (fileData: Array<{ url: string; name: string }>) => {
      const uploadedFile = fileData[0];
      const normalizedServiceCode = Number(serviceCode || 0);
      const currentTypeOption = getSelectedTypeOfPublicationOption(
        current.TypeOfPublication,
      );
      const currentTypeKind = getPublicationTypeKind(
        current.TypeOfPublication,
        currentTypeOption,
      );
      if (
        !uploadedFile?.url ||
        !normalizedServiceCode ||
        currentTypeKind !== "book"
      ) {
        return;
      }
      setAiAnalyzing(true);

      try {
        const response = await analyzeBookMaterial({
          filePath: uploadedFile.url,
          typeOfPublication: String(current.TypeOfPublication ?? ""),
          serviceCode: normalizedServiceCode,
          originalFileName:uploadedFile.name,
        });

        if (!response?.isSuccess) {
          throw new Error(
            response?.message || tf("aiAnalysisFailedShort"),
          );
        }
        const analysisData = response?.data || {};
        const generatedFields: Record<string, unknown> =
          analysisData.aiGeneratedFields &&
          typeof analysisData.aiGeneratedFields === "object"
            ? (analysisData.aiGeneratedFields as Record<string, unknown>)
            : {};
        const generatedLabels: Record<string, unknown> =
          analysisData.aiGeneratedLabels &&
          typeof analysisData.aiGeneratedLabels === "object"
            ? (analysisData.aiGeneratedLabels as Record<string, unknown>)
            : {};
        const labelBackfilledValues: Record<string, unknown> = {
          PublicationTitle:
            generatedLabels.PublicationTitle ??
            generatedFields.PublicationTitle,
          AuthorName: generatedLabels.AuthorName ?? generatedFields.AuthorName,
        };
        const languageLabel = generatedLabels.Language;
        const mappedLanguageIds = findOptionValuesByLabels(
          LanguageOptions,
          languageLabel,
        );
        if (mappedLanguageIds.length > 0) {
          labelBackfilledValues.Language = mappedLanguageIds;
        }

        const subjectCategoryLabel = generatedLabels.SubjectCategory;
        if (
          subjectCategoryLabel !== undefined &&
          subjectCategoryLabel !== null &&
          subjectCategoryLabel !== ""
        ) {
          labelBackfilledValues.SubjectCategory =
            findOptionValueByLabel(
              SubjectCategoryOptions,
              subjectCategoryLabel,
            ) ?? subjectCategoryLabel;
        }

        const subjectSubCategoryLabel = generatedLabels.SubjectSubCategory;
        if (
          subjectSubCategoryLabel !== undefined &&
          subjectSubCategoryLabel !== null &&
          subjectSubCategoryLabel !== ""
        ) {
          labelBackfilledValues.SubjectSubCategory =
            findOptionValueByLabel(
              SubjectSubCategoryOptions,
              subjectSubCategoryLabel,
            ) ?? subjectSubCategoryLabel;
        }

        const generatedFieldKeys = Array.isArray(
          analysisData.aiGeneratedFieldKeys,
        )
          ? analysisData.aiGeneratedFieldKeys.filter(
              (key): key is string =>
                typeof key === "string" && AI_OPTION_FIELDS.has(key),
            )
          : [];
        const aiIndicatorFieldKeys = Array.from(
          new Set([
            ...generatedFieldKeys,
            ...Object.keys(labelBackfilledValues).filter((key) =>
              AI_OPTION_FIELDS.has(key),
            ),
          ]),
        );
        const mappingWarnings = Array.isArray(analysisData.mappingWarnings)
          ? analysisData.mappingWarnings
          : [];
        const latestValue: PublicationFormValue = field.value || {};

        field.setValue({
          ...latestValue,
          AIMaterialRecognition: uploadedFile.url,
          OriginalFileName: uploadedFile.name || "",
          ...labelBackfilledValues,
          AIGeneratedFieldKeys: aiIndicatorFieldKeys,
          AIMaterialRecognitionAnalysisStatus:
            analysisData.analysisStatus || "completed",
          AIMaterialRecognitionMappingWarnings: mappingWarnings,
        });

        if (mappingWarnings.length > 0) {
          CustomMessage.warning(
            tf("aiAnalysisCompletedReview"),
          );
        } else if (aiIndicatorFieldKeys.length > 0) {
          CustomMessage.success(tf("aiAnalysisCompleted"));
        }
      } catch (error) {
        console.error("AI material analysis failed:", error);
        CustomMessage.error(tf("aiAnalysisFailed"));
      } finally {
        setAiAnalyzing(false);
      }
    },
    [
      LanguageOptions,
      SubjectCategoryOptions,
      SubjectSubCategoryOptions,
      current.TypeOfPublication,
      field,
      getSelectedTypeOfPublicationOption,
      serviceCode,
      tf,
    ],
  );

  const renderTextInput = (
    name: string,
    label: string,
    required: boolean = true,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) {
            return tf("validation.required", { label });
          }
          return "";
        }}
      >
        <div
          className={`ant-formily-item-label ${
            shouldShowAiIndicator(name) ? "AI-flex" : ""
          }`}
        >
          <div>
            {label}
<span className="required-icon">*</span>
          </div>
          {shouldShowAiIndicator(name) && (
            <img src={AIText} className="AI-formily-icon" />
          )}
        </div>
        <Input
          disabled={props.disabled}
          className={`ant-input-affix-wrapper ${
            shouldShowAiIndicator(name) ? "AI-formily AI-formily-Input" : ""
          }`}
          placeholder={tf("placeholder.enter", {
            label: i18nLng === "ar" ? label : label.toLowerCase(),
          })}
          value={current[name] || null}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          maxLength={256}
        />
      </Field>
    );
  };

  type RenderSelectConfig = {
    /**  id  */
    mode?: "multiple";
  };

  const renderSelect = (
    name: string,
    label: string,
    options: { label: string; value: string | number }[],
    required: boolean = true,
    config?: RenderSelectConfig,
  ) => {
    const multiple = config?.mode === "multiple";
    const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
      isMultiple: multiple,
      isReadOnly: isReadOnlyMode,
      configuredMaxTagCount: multiple ? 3 : undefined,
      defaultMaxTagCount: 3,
    });
    const raw = current[name];
    const selectValue = multiple
      ? Array.isArray(raw)
        ? raw
        : raw !== undefined && raw !== null && raw !== ""
        ? [raw as string | number]
        : []
      : raw;
    const isRuntimeMultiple = multiple && field?.designable === false;
    const selectedValues: Array<string | number> = Array.isArray(selectValue)
      ? selectValue
      : [];
    const allSelected =
      options.length > 0 &&
      options.every((option) => selectedValues.includes(option.value));
    const hasSelectedValues = options.some((option) =>
      selectedValues.includes(option.value),
    );
    const handleSelectAll = (checked: boolean) => {
      if (!isRuntimeMultiple || props.disabled || options.length === 0) return;
      handleFieldChange(
        name,
        checked ? options.map((option) => option.value) : [],
      );
    };

    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (!required) return "";
          if (multiple) {
            if (!value || (Array.isArray(value) && value.length === 0)) {
              return tf("validation.required", { label });
            }
          } else if (value === undefined || value === null || value === "") {
            return tf("validation.required", { label });
          }
          return "";
        }}
      >
        <div
          className={`ant-formily-item-label ${
            shouldShowAiIndicator(name) ? "AI-flex" : ""
          }`}
        >
          <div>
            {label}
<span className="required-icon">*</span>
          </div>
          {shouldShowAiIndicator(name) && (
            <img src={AIText} className="AI-formily-icon" />
          )}
        </div>
        <Select
          mode={multiple ? "multiple" : undefined}
          maxTagCount={readOnlyMultiSelectProps.maxTagCount}
          maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
          className={
            isRuntimeMultiple
              ? `publication-multi-select${
                  shouldShowAiIndicator(name) ? " AI-formily" : ""
                }`
              : shouldShowAiIndicator(name)
              ? "AI-formily"
              : undefined
          }
          disabled={props.disabled}
          placeholder={tf("placeholder.select", {
            label: i18nLng === "ar" ? label : label.toLowerCase(),
          })}
          value={selectValue}
          onChange={(value) => handleFieldChange(name, value)}
          showSearch
          optionFilterProp={isRuntimeMultiple ? "title" : "children"}
          optionLabelProp={isRuntimeMultiple ? "label" : undefined}
          dropdownClassName={
            isRuntimeMultiple
              ? "publication-multi-select-dropdown"
              : undefined
          }
          dropdownRender={
            isRuntimeMultiple
              ? (menu) => (
                  <div>
                    <div className="publication-multi-select-all">
                      <Checkbox
                        className={
                          hasSelectedValues && !allSelected
                            ? "publication-multi-select-all-checkbox has-selection"
                            : "publication-multi-select-all-checkbox"
                        }
                        checked={allSelected}
                        disabled={props.disabled || options.length === 0}
                        onChange={(event) =>
                          handleSelectAll(event.target.checked)
                        }
                      >
                        {i18n.t("LanguageSelectMulti.selectAll", {
                          lng: i18nLng,
                        })}
                      </Checkbox>
                    </div>
                    <div>{menu}</div>
                  </div>
                )
              : undefined
          }
        >
          {options.map((o) => (
            <Option
              key={String(o.value)}
              value={o.value}
              title={o.label}
              label={
                isRuntimeMultiple ? (
                  <div className="publication-multi-selection-item">
                    <Checkbox checked />
                    <span>{o.label}</span>
                  </div>
                ) : undefined
              }
            >
              {isRuntimeMultiple ? (
                <div className="publication-multi-option">
                  <Checkbox checked={selectedValues.includes(o.value)} />
                  <span>{o.label}</span>
                </div>
              ) : (
                o.label
              )}
            </Option>
          ))}
        </Select>
      </Field>
    );
  };

  const renderLanguageSelect = (
    name: string,
    label: string,
    required: boolean = true,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) {
            return tf("validation.required", { label });
          }
          return "";
        }}
      >
        <div
          className={`ant-formily-item-label ${
            shouldShowAiIndicator(name) ? "AI-flex" : ""
          }`}
        >
          <div>
            {label}
<span className="required-icon">*</span>
          </div>
          {shouldShowAiIndicator(name) && (
            <img src={AIText} className="AI-formily-icon" />
          )}
        </div>
        <LanguageSelectComponent
          options={languageDisplayOptions}
          className={shouldShowAiIndicator(name) && " AI-formily"}
          disabled={props.disabled}
          multiple={true}
          placeholder={tf("placeholder.select", {
            label: i18nLng === "ar" ? label : label.toLowerCase(),
          })}
          value={
            current[name]
              ? typeof current[name] === "string"
                ? current[name]
                    .split(",")
                    .map((v: string) => Number(v.trim()) || v.trim())
                : current[name]
              : undefined
          }
          onChange={(value: string | number | Array<string | number>) =>
            handleFieldChange(name, value)
          }
        />
      </Field>
    );
  };
  const renderUpload = (
    name: string,
    label: string,
    required: boolean = true,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) {
            return tf("validation.required", { label });
          }
          return "";
        }}
      >
        <div className="ant-formily-item-label  AI-flex">
          <div>
            {label}
<span className="required-icon">*</span>
          </div>
        </div>
        <div className="ant-formily-upload">
          {" "}
          <DraftFileOrLinkField
            disabled={props.disabled}
            readOnly={props.readOnly}
            value={String(current[name] ?? "")}
            onChange={handleMaterialChange}
            fileFormat={["PDF"]}
            fileSizeLimit={100}
            uploadPlaceholder={String(uploadPlaceholder)}
            uploadTip=""
            invalidFileTypeMessage={String(tf("validation.pdfOnly"))}
            maxSizeErrorMessage={String(
              tf("validation.fileSize", { size: 100 }),
            )}
            onFileUploadSuccess={handleUploadMaterialAnalysisSuccess}
          />
        </div>
        {name === "AIMaterialRecognition" && aiAnalyzing ? (
          <div style={{ marginTop: 8, color: "#92722A", fontSize: 12 }}>
            {tf("aiAnalysisInProgress")}
          </div>
        ) : null}
      </Field>
    );
  };
  const renderObligationLetterUpload = () => (
    <Field name="UploadObligationLetter" decorator={[FormItem]}>
      <div className="ant-formily-item-label AI-flex">
        <div>{tf("label.uploadObligationLetter")}</div>
      </div>
      <div className="ant-formily-upload">
        <DocumentViewer
          hasDelete
          disabled={props.disabled || props.readOnly}
          value={current.UploadObligationLetter}
          onChange={(value) =>
            handleFieldChange("UploadObligationLetter", value)
          }
          uploadConfig={{
            maxCount: 1,
            maxSize: 5,
            accept: ".pdf",
            uploadTip: tf("tooltipUploadObligationLetter"),
            invalidFileTypeMessage: tf("validation.pdfOnly"),
            maxSizeErrorMessage: tf("validation.fileSize", { size: 5 }),
          }}
        />
      </div>
    </Field>
  );
  const renderCheck = (
    name: string,
    label: string,
    required: boolean = true,
  ) => {
    const fieldValue = current[name] || "Original";

    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) {
            return tf("validation.required", { label });
          }
          return "";
        }}
      >
        <div className="ant-formily-item-label  AI-flex">
          <div>
            {" "}
            {label}
<span className="required-icon">*</span>
          </div>
        </div>
        <Radio.Group
          className="ant-formily-radio"
          disabled={props.disabled}
          value={fieldValue}
          onChange={(e) => handleFieldChange(name, e.target.value)}
        >
          <Radio value="Original">{tf("original")}</Radio>
          <Radio value="Translated">{tf("translated")}</Radio>
        </Radio.Group>
      </Field>
    );
  };
  const renderNumberTextInput = (
    name: string,
    label: string,
    required: boolean = true,
    isNumberOnly: boolean = false,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (isNumberOnly) {
        // Allow only numbers (including decimal numbers)
        if (/^\d*\.?\d*$/.test(value) || value === "") {
          handleFieldChange(name, value);
        }
      } else {
        handleFieldChange(name, value);
      }
    };

    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) {
            return tf("validation.required", { label });
          }
          return "";
        }}
      >
        <div className="ant-formily-item-label  AI-flex">
          <div>
            {label}
<span className="required-icon">*</span>
          </div>
        </div>
        <Input
          disabled={props.disabled}
          className="ant-input-affix-wrapper"
          placeholder={tf("placeholder.enter", {
            label: i18nLng === "ar" ? label : label.toLowerCase(),
          })}
          value={current[name] || null}
          onChange={handleChange}
          maxLength={256}
        />
      </Field>
    );
  };

  return (
    <div className="publication-form-container" {...restProps}>
      <AntdCard
        title={
          <span data-content-editable={editableTitlePath}>
            {displayCardTitle}
          </span>
        }
      >
        <Row gutter={[24, 24]}>
          <Col span={12}>
            {renderSelect(
              "TypeOfPublication",
              tf("label.typeOfPublication"),
              typeOfPublicationOptions,
              true,
            )}
          </Col>
          <Col span={12}>
            {renderLanguageSelect(
              "Language",
              tf("label.language"),
              true,
            )}
          </Col>
          {isBookType && (
            <>
              <Col span={12}>
                {renderCheck(
                  "ArticleType",
                  tf("label.articleType"),
                  true,
                )}
              </Col>{" "}
            </>
          )}

          <Col span={12}>
            {renderTextInput(
              "PublicationTitle",
              tf("label.publicationTitle"),
              true,
            )}
          </Col>
          {isBookType && (
            <>
              {" "}
              <Col span={12}>
                {renderNumberTextInput(
                  "IssueNumbe",
                  tf("label.issueNumber"),
                  true,
                )}
              </Col>
              <Col span={12}>
                {renderSelect(
                  "PublishMethod",
                  tf("label.publishMethod"),
                  PublishMethodOptions,
                  true,
                  { mode: "multiple" },
                )}
              </Col>
              {shouldShowCoverTypes && (
                <Col span={12}>
                  {renderSelect(
                    "CoverTypes",
                    tf("label.coverType"),
                    CoverTypeOptions,
                    true,
                    { mode: "multiple" },
                  )}
                </Col>
              )}
            </>
          )}
          <Col span={12}>
            {renderTextInput(
              "AuthorName",
              tf("label.authorName"),
              true,
            )}
          </Col>
          <Col span={12}>
            {renderUpload(
              "AIMaterialRecognition",
              tf("label.uploadMaterial"),
              true,
            )}
          </Col>
          <Col span={12}>{renderObligationLetterUpload()}</Col>
          {isBookType && (
            <>
              {" "}
              <Col span={12}>
                {renderSelect(
                  "SubjectCategory",
                  tf("label.subjectCategory"),
                  subjectCategoryDisplayOptions,
                  true,
                )}
              </Col>
              <Col span={12}>
                {renderSelect(
                  "SubjectSubCategory",
                  tf("label.subjectSubCategory"),
                  subjectSubCategoryDisplayOptions,
                  true,
                )}
              </Col>{" "}
            </>
          )}
        </Row>
      </AntdCard>
    </div>
  );
});

PublicationFormField.displayName = "PublicationFormField";

export default PublicationFormField;
