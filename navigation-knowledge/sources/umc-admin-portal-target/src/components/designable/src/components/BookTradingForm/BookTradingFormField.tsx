import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import {
  Input,
  Select,
  Row,
  Col,
  Radio,
  Card as AntdCard,
  Tooltip,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import {
  resolveBookCollectTypeKindById,
  type BookCollectTypeKind,
} from "@/utils/bookCollectTypeKind";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import CustomMessage from "../../../../../components/common/CustomMessage";
import { analyzeBookMaterial } from "@/services/myRequest";

const { Option } = Select;
import { LanguageSelect as LanguageSelectComponent } from "../LanguageSelect/LanguageSelect";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";

import {
  getAgeClassifications,
  getLanguages,
  getLookupData,
  getPrintingPermitByProfileId,
  getRegulateEntryByProfileId,
  getSubjectList,
  getSubjectSubList,
  type AgeClassificationDto,
} from "../../../../../services/services";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import { useUserStore } from "@/store/user";
import { DraftFileOrLinkField } from "../DraftFileOrLink/DraftFileOrLinkField";
import type { DraftFileOrLinkType } from "../DraftFileOrLink/schemaContract";

interface Subject {
  id: number;
  nameAr: string;
  nameEn: string;
  code: string;
  descAr: string | null;
  descEn: string | null;
}

interface SubjectSubCategory {
  id: number;
  nameEn: string;
  nameAr?: string;
  subjectCategoryId: number;
  [key: string]: unknown;
}

type BookTradingFormValue = {
  AgeClassification?: string | number;
  HowDidYouGetTheBook?: string | number;
  BookType?: string;
  PublicationsPrintingPermit?: string;
  RegulateEntryMediaMaterial?: string;
  PleaseSelectBook?: string;
  NumberOfCopies?: string;
  UploadMaterial?: string;
  UploadMaterialType?: DraftFileOrLinkType;
  UploadMaterialPassword?: string;
  BookTitle?: string;
  AuthorName?: string;
  NationalDepositoryNo?: string;
  ISBN?: string;
  PrintYear?: string;
  VersionNumber?: string;
  Language?: string | Array<string | number>;
  SubjectCategory?: number;
  SubjectSubCategory?: number;
  DistributorAgency?: string;
  UploadPurchaseInvoice?: string;
  UploadObligationLetter?: string | string[];
  [key: string]: unknown;
};

type OptionType = {
  label: string;
  value: number | string;
  [key: string]: unknown;
};

type LocalizedLookupItem = {
  id?: number | string;
  Id?: number | string;
  nameEn?: string;
  nameAr?: string;
  NameEn?: string;
  NameAr?: string;
  descEn?: string | null;
  descAr?: string | null;
  [key: string]: unknown;
};

type ValidationResult = string | void;
type BookTradingFieldValidator = (value: unknown) => ValidationResult;

type UploadFieldConfig = {
  accept: string;
  maxSize: number;
  uploadTip: string;
  invalidFileTypeMessage: string;
  maxSizeErrorMessage: string;
};

type BookTradingFormFieldProps = {
  disabled?: boolean;
  serviceCode?: number | string;
  [key: string]: unknown;
};

type BookTradingField = {
  value?: BookTradingFormValue;
  setValue: (value?: BookTradingFormValue) => void;
  address: string;
  query: (address: string) => {
    take: () => unknown;
  };
};

type NestedFieldState = {
  selfErrors?: unknown[];
  selfWarnings?: unknown[];
  selfSuccesses?: unknown[];
  selfValidating?: boolean;
  validating?: boolean;
  visible?: boolean;
  display?: string;
  required?: boolean;
};

type NestedFieldController = {
  setValidator?: (validator: BookTradingFieldValidator) => void;
  setFeedback?: (feedback: { type: string; messages: string[] }) => void;
  setState?: (setter: (state: NestedFieldState) => void) => void;
};

type BookCollectTypeLookupItem = {
  Id?: number | string;
  NameEn?: string;
  NameAr?: string;
  IsShow?: boolean;
};

const BOOK_AGE_CLASSIFICATION_MEDIA_MATERIAL_TYPE_ID = 9;

type ConditionalBookTradingFieldName =
  | "PublicationsPrintingPermit"
  | "UploadMaterial"
  | "RegulateEntryMediaMaterial"
  | "PleaseSelectBook"
  | "BookTitle"
  | "AuthorName"
  | "NationalDepositoryNo"
  | "ISBN"
  | "PrintYear"
  | "VersionNumber"
  | "Language"
  | "SubjectCategory"
  | "SubjectSubCategory"
  | "DistributorAgency"
  | "NumberOfCopies"
  | "UploadPurchaseInvoice";

type ConditionalFieldConfig = {
  name: ConditionalBookTradingFieldName;
  visible: boolean;
  required: boolean;
  disabled: boolean;
  emptyValue: BookTradingFormValue[ConditionalBookTradingFieldName];
  requiredMessage: string;
  validators: BookTradingFieldValidator[];
  validator: BookTradingFieldValidator;
};

const BOOK_TYPE_VALUES = ["Paper", "Electronic"] as const;

const ISBN_PATTERN =
  /^(?:\d{9}[\dXx]|\d{3}-?\d{1,5}-?\d{1,7}-?\d{1,7}-?[\dXx])$/;
const CURRENT_YEAR = new Date().getFullYear();

const UPLOAD_MATERIAL_BASE_CONFIG = {
  accept: ".pdf",
  maxSize: 100,
};

const UPLOAD_PURCHASE_INVOICE_BASE_CONFIG = {
  accept: ".pdf,.jpg,.png",
  maxSize: 10,
};

const UPLOAD_OBLIGATION_LETTER_BASE_CONFIG = {
  accept: ".pdf",
  maxSize: 5,
};

const isEmptyValue = (value: unknown) => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const extractResponseArray = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object" && "data" in response) {
    const data = (response as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
};

const normalizeLookupLabel = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const collectLookupLabels = (option: OptionType) =>
  [
    option.label,
    (option as LocalizedLookupItem).nameEn,
    (option as LocalizedLookupItem).nameAr,
    (option as LocalizedLookupItem).NameEn,
    (option as LocalizedLookupItem).NameAr,
  ]
    .map((value) => normalizeLookupLabel(value))
    .filter(Boolean);

const findOptionValueByLookupLabels = (
  options: OptionType[],
  targetLabel: unknown,
) => {
  const normalizedTarget = normalizeLookupLabel(targetLabel);
  if (!normalizedTarget) return undefined;

  return options.find((option) =>
    collectLookupLabels(option).includes(normalizedTarget),
  )?.value;
};

const findOptionValuesByLookupLabels = (
  options: OptionType[],
  targetLabels: unknown,
) => {
  const normalizedLabels = (Array.isArray(targetLabels)
    ? targetLabels
    : [targetLabels]
  )
    .map((value) => normalizeLookupLabel(value))
    .filter(Boolean);

  if (normalizedLabels.length === 0) {
    return [];
  }

  return normalizedLabels
    .map(
      (label) =>
        options.find((option) => collectLookupLabels(option).includes(label))
          ?.value,
    )
    .filter(
      (value): value is string | number =>
        value !== undefined && value !== null && value !== "",
    );
};

const getStringLengthValidator =
  (maxLength: number, message: string) =>
  (value: unknown): ValidationResult => {
    if (isEmptyValue(value)) return;
    return String(value).length > maxLength ? message : undefined;
  };

const getRequiredValidator =
  (required: boolean, message: string) =>
  (value: unknown): ValidationResult => {
    if (!required) return;
    return isEmptyValue(value) ? message : undefined;
  };

const runValidationPipeline = (
  value: unknown,
  validators: Array<BookTradingFieldValidator | undefined>,
) => {
  for (const validator of validators) {
    if (!validator) continue;
    const result = validator(value);
    if (result) return result;
  }
  return "";
};

const NO_OP_VALIDATOR: BookTradingFieldValidator = () => "";

const getPatternValidator =
  (pattern: RegExp, message: string): BookTradingFieldValidator =>
  (value) => {
    if (isEmptyValue(value)) return;
    return pattern.test(String(value)) ? undefined : message;
  };

const createConditionalFieldValidator = ({
  visible,
  required,
  disabled,
  validators = [],
  requiredMessage,
}: Pick<
  ConditionalFieldConfig,
  "visible" | "required" | "disabled" | "validators"
> & {
  requiredMessage: string;
}): BookTradingFieldValidator => {
  if (!visible || disabled) {
    return NO_OP_VALIDATOR;
  }

  return (value) =>
    runValidationPipeline(value, [
      getRequiredValidator(required, requiredMessage),
      ...validators,
    ]);
};

const toOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const normalizedValue = String(value).trim();
  return normalizedValue ? normalizedValue : undefined;
};

const toOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) ? normalizedValue : undefined;
};

const toLanguageIds = (value: unknown) => {
  if (typeof value === "string") {
    const languageIds = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return languageIds.length > 0 ? languageIds : undefined;
  }

  if (!Array.isArray(value)) return undefined;

  const languageIds = value.filter(
    (languageId): languageId is string | number =>
      languageId !== undefined && languageId !== null && languageId !== "",
  );

  return languageIds.length > 0 ? languageIds : undefined;
};

const buildPrintingPermitPrefill = (
  permit?: Partial<Record<string, unknown>>,
): Partial<BookTradingFormValue> => ({
  BookTitle: toOptionalString(permit?.title),
  AuthorName: toOptionalString(permit?.authorName),
  VersionNumber: toOptionalString(permit?.editionNumber),
  NationalDepositoryNo: toOptionalString(permit?.nationalDepositoryNo),
  ISBN: toOptionalString(permit?.isbn),
  PrintYear: toOptionalString(permit?.printYear),
  Language: toLanguageIds(permit?.languageIds),
  SubjectCategory: toOptionalNumber(permit?.subjectCategoryId),
  SubjectSubCategory: toOptionalNumber(permit?.subjectSubCategoryId),
  DistributorAgency: toOptionalString(permit?.distributor),
});

export const BookTradingFormField: React.FC<BookTradingFormFieldProps> = observer(
  (props) => {
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const { i18n: i18nReact } = useTranslation();
    const previewLang =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18nReact.language);
    const i18nLng = previewLang === "ar" ? "ar" : "en";
    const tf = useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(
          i18n.t(`BookTradingForm.${key}`, {
            lng: i18nLng,
            ...(options ?? {}),
          }),
        ),
      [i18nLng],
    );
    const displayCardTitle = useMemo(
      () =>
        i18n.t("BookTradingForm.defaultCardTitle", {
          lng: i18nLng,
        }),
      [i18nLng],
    );
    const field = useField<BookTradingField>();
    if (!field) {
      return null;
    }

    const isAr = i18nLng === "ar";
    const currentProfileId = useUserStore((state) => state.currentProfileId);
    const current = (field.value || {}) as BookTradingFormValue;
    const [subjectCategoryRows, setSubjectCategoryRows] = useState<Subject[]>([]);
    const [subjectSubCategoryRows, setSubjectSubCategoryRows] = useState<
      SubjectSubCategory[]
    >([]);
    const [languageOptions, setLanguageOptions] = useState<OptionType[]>([]);
    const [bookCollectTypeRows, setBookCollectTypeRows] = useState<
      BookCollectTypeLookupItem[]
    >([]);
    const [printingPermitRows, setPrintingPermitRows] = useState<
      Array<Record<string, unknown>>
    >([]);
    const [regulateEntryRows, setRegulateEntryRows] = useState<
      Array<Record<string, unknown>>
    >([]);
    const [bookSelectOptions, setBookSelectOptions] = useState<OptionType[]>([]);
    const [ageClassificationRows, setAgeClassificationRows] = useState<
      AgeClassificationDto[]
    >([]);
    const [
      isAgeClassificationLookupSettled,
      setIsAgeClassificationLookupSettled,
    ] = useState(false);
    const requiredMessageForLabel = useCallback(
      (label: string) => tf("validationRequired", { label }),
      [tf],
    );

    useEffect(() => {
      getSubjectList().then((res) => {
        const subjectList = extractResponseArray<Subject>(res);
        setSubjectCategoryRows(subjectList);
      });

      getLanguages().then((res) => {
        const rows = extractResponseArray<LocalizedLookupItem>(res);
        setLanguageOptions(
          rows.map((item) => {
            const value = item.Id ?? item.id ?? "";
            return {
              label:
                preferLocalizedEnAr(
                  isAr,
                  item.nameEn ?? item.NameEn,
                  item.nameAr ?? item.NameAr,
                ) || String(value),
              value,
              ...item,
            };
          }),
        );
      });

      getLookupData("BookCollectTypes", props.serviceCode).then((res) => {
        const lookupList = Array.isArray(res?.data)
          ? (res.data as BookCollectTypeLookupItem[])
          : [];
        setBookCollectTypeRows(lookupList);
      });
    }, [isAr, props.serviceCode]);

    useEffect(() => {
      const profileId = String(currentProfileId || "").trim();
      if (!profileId) {
        setPrintingPermitRows([]);
        setRegulateEntryRows([]);
        return;
      }

      getPrintingPermitByProfileId(profileId, 1)
        .then((res) => {
          const rows = Array.isArray(res?.data)
            ? (res.data as Array<Record<string, unknown>>)
            : [];
          setPrintingPermitRows(rows);
        })
        .catch(() => {
          setPrintingPermitRows([]);
        });

      getRegulateEntryByProfileId(profileId)
        .then((res) => {
          const rows = Array.isArray(res?.data)
            ? (res.data as Array<Record<string, unknown>>)
            : [];
          setRegulateEntryRows(rows);
        })
        .catch(() => {
          setRegulateEntryRows([]);
        });
    }, [currentProfileId]);

    useEffect(() => {
      const fetchSubjectSubList = async () => {
        if (current.SubjectCategory) {
          try {
            const res = await getSubjectSubList();
            const subjectSubList = (res.data || []) as SubjectSubCategory[];
            setSubjectSubCategoryRows(subjectSubList);
          } catch (error) {
            console.error("Failed to fetch subject sub list:", error);
            setSubjectSubCategoryRows([]);
          }
        } else {
          setSubjectSubCategoryRows([]);
        }
      };

      fetchSubjectSubList();
    }, [current.SubjectCategory]);

    useEffect(() => {
      // TODO: Load BookSelectOptions based on RegulateEntryMediaMaterial
      // and populate book-driven editable fields after a book is selected.
      if (!current.RegulateEntryMediaMaterial) {
        setBookSelectOptions([]);
      }
    }, [current.RegulateEntryMediaMaterial]);

    const resolvePermitOptionLabel = React.useCallback(
      (item: Record<string, unknown>) => {
        const localizedName = preferLocalizedEnAr(
          isAr,
          String(item.nameEn ?? item.NameEn ?? ""),
          String(item.nameAr ?? item.NameAr ?? ""),
        );

        return (
          localizedName ||
          String(
            item.ApplicationNumber ||
              item.applicationNumber ||
              item.PermitNumber ||
              item.permitNumber ||
              item.Id ||
              item.id ||
              "",
          )
        );
      },
      [isAr],
    );

    const subjectCategoryOptions = useMemo<OptionType[]>(
      () =>
        subjectCategoryRows.map((item) => ({
          label: preferLocalizedEnAr(isAr, item.nameEn, item.nameAr) || String(item.id),
          value: item.id,
          ...item,
        })),
      [isAr, subjectCategoryRows],
    );

    const subjectSubCategoryOptions = useMemo<OptionType[]>(
      () =>
        subjectSubCategoryRows
          .filter((item) => item.subjectCategoryId === current.SubjectCategory)
          .map((item) => ({
            label:
              preferLocalizedEnAr(isAr, item.nameEn, item.nameAr) ||
              String(item.id),
            value: item.id,
            ...item,
          })),
      [current.SubjectCategory, isAr, subjectSubCategoryRows],
    );

    const bookCollectTypeOptions = useMemo<OptionType[]>(
      () =>
        bookCollectTypeRows
          .filter((item) => item?.IsShow !== false)
          .map((item) => ({
            label:
              preferLocalizedEnAr(
                isAr,
                String(item.NameEn ?? ""),
                String(item.NameAr ?? ""),
              ) || String(item.Id || ""),
            value: item.Id ?? "",
            kind: resolveBookCollectTypeKindById(item),
            ...item,
          })),
      [bookCollectTypeRows, isAr],
    );

    const printingPermitOptions = useMemo<OptionType[]>(
      () =>
        printingPermitRows.map((item) => ({
          label:
            String(
              item.ApplicationNumber ||
                item.applicationNumber ||
                item.PermitNumber ||
                item.permitNumber ||
                item.Id ||
                item.id ||
                "",
            ) || resolvePermitOptionLabel(item),
          value: String(
            item.ApplicationNumber ||
              item.applicationNumber ||
              item.PermitNumber ||
              item.permitNumber ||
              item.Id ||
              item.id ||
              "",
          ),
          ...item,
        })),
      [printingPermitRows, resolvePermitOptionLabel],
    );

    const regulateEntryOptions = useMemo<OptionType[]>(
      () =>
        regulateEntryRows.map((item) => ({
          label: resolvePermitOptionLabel(item),
          value:
            (item.id as string | number | undefined) ??
            (item.Id as string | number | undefined) ??
            (item.applicationNumber as string | number | undefined) ??
            (item.ApplicationNumber as string | number | undefined) ??
            "",
          ...item,
        })),
      [regulateEntryRows, resolvePermitOptionLabel],
    );

    const bookTypeOptions = useMemo(
      () =>
        BOOK_TYPE_VALUES.map((value) => ({
          label:
            value === "Paper"
              ? tf("optionBookTypePaper")
              : tf("optionBookTypeElectronic"),
          value,
        })),
      [tf],
    );

    const uploadMaterialConfig = useMemo<UploadFieldConfig>(() => {
      const uploadTip = tf("tooltipUploadMaterial");
      return {
        ...UPLOAD_MATERIAL_BASE_CONFIG,
        uploadTip,
        invalidFileTypeMessage: uploadTip,
        maxSizeErrorMessage: uploadTip,
      };
    }, [tf]);

    const uploadPurchaseInvoiceConfig = useMemo<UploadFieldConfig>(() => {
      const uploadTip = tf("tooltipUploadFileInfo");
      return {
        ...UPLOAD_PURCHASE_INVOICE_BASE_CONFIG,
        uploadTip,
        invalidFileTypeMessage: uploadTip,
        maxSizeErrorMessage: uploadTip,
      };
    }, [tf]);

    const uploadObligationLetterConfig = useMemo<UploadFieldConfig>(() => {
      const uploadTip = tf("tooltipUploadObligationLetter");
      return {
        ...UPLOAD_OBLIGATION_LETTER_BASE_CONFIG,
        uploadTip,
        invalidFileTypeMessage: uploadTip,
        maxSizeErrorMessage: uploadTip,
      };
    }, [tf]);

    const nationalDepositoryValidator = useMemo(
      () =>
        getPatternValidator(
          /^[A-Za-z0-9]+$/,
          tf("validationNationalDepository"),
        ),
      [tf],
    );

    const isbnValidator = useMemo(
      () => getPatternValidator(ISBN_PATTERN, tf("validationISBN")),
      [tf],
    );

    const printYearValidator = useMemo<BookTradingFieldValidator>(
      () => (value) => {
        if (isEmptyValue(value)) return;
        if (!/^\d{4}$/.test(String(value))) {
          return tf("validationPrintYear");
        }

        const year = Number(value);
        if (year < 1900 || year > CURRENT_YEAR) {
          return tf("validationPrintYear");
        }
      },
      [tf],
    );

    const numberOfCopiesValidator = useMemo<BookTradingFieldValidator>(
      () => (value) => {
        if (isEmptyValue(value)) return;
        if (!/^[1-9]\d*$/.test(String(value))) {
          return tf("validationCopiesPositiveInteger");
        }

        if (String(value).length > 10) {
          return tf("validationCopiesMaxDigits");
        }

        const count = Number(value);
        if (count < 1 || count > 9999999999) {
          return tf("validationCopiesBetween");
        }
      },
      [tf],
    );

    const selectedOption = current.HowDidYouGetTheBook;
    const selectedBookCollectType = bookCollectTypeOptions.find(
      (option) => String(option.value) === String(current.HowDidYouGetTheBook ?? ""),
    );
    const selectedBookCollectTypeKind = (selectedBookCollectType?.kind ||
      "Unknown") as BookCollectTypeKind;
    const isPrintingPermit = selectedBookCollectTypeKind === "PrintingPermit";
    const isRegulateEntry = selectedBookCollectTypeKind === "RegulateEntryPermit";
    const isBookFair = selectedBookCollectTypeKind === "BookFair";
    const isLocalDistributor = selectedBookCollectTypeKind === "LocalDistributor";
    const isSampleForTest = selectedBookCollectTypeKind === "SampleForTest";
    const isElectronicBookType = current.BookType === "Electronic";
    const isService204RegulateEntry =
      Number(props.serviceCode) === 204 && isRegulateEntry;
    const showSubmittedAgeClassification =
      Boolean(props.disabled) &&
      isService204RegulateEntry &&
      !isEmptyValue(current.AgeClassification);

    useEffect(() => {
      if (!showSubmittedAgeClassification) {
        setAgeClassificationRows([]);
        setIsAgeClassificationLookupSettled(false);
        return;
      }

      let active = true;
      setIsAgeClassificationLookupSettled(false);
      getAgeClassifications(BOOK_AGE_CLASSIFICATION_MEDIA_MATERIAL_TYPE_ID)
        .then((res) => {
          if (active) {
            setAgeClassificationRows(
              Array.isArray(res?.data) ? res.data : [],
            );
            setIsAgeClassificationLookupSettled(true);
          }
        })
        .catch(() => {
          if (active) {
            setAgeClassificationRows([]);
            setIsAgeClassificationLookupSettled(true);
          }
        });

      return () => {
        active = false;
      };
    }, [showSubmittedAgeClassification]);

    const submittedAgeClassificationOptions = useMemo(() => {
      const submittedValue = current.AgeClassification;
      if (isEmptyValue(submittedValue)) return [];

      const matchingItem = ageClassificationRows.find(
        (item) => String(item.id) === String(submittedValue),
      );
      return [
        {
          label:
            preferLocalizedEnAr(
              isAr,
              matchingItem?.nameEn,
              matchingItem?.nameAr,
            ) || String(submittedValue),
          value: submittedValue,
        },
      ];
    }, [ageClassificationRows, current.AgeClassification, isAr]);
    const showUploadPurchaseInvoice = isBookFair || isLocalDistributor;
    const showNumberOfCopies =
      isRegulateEntry || isBookFair || isLocalDistributor || isSampleForTest;
    const showUploadMaterial = isElectronicBookType;
    const showPleaseSelectBook =
      isRegulateEntry && !!current.RegulateEntryMediaMaterial;
    const readonlyPleaseSelectBookValue =
      props.disabled ? toOptionalString(current.BookTitle) : undefined;
    const pleaseSelectBookOptions = useMemo<OptionType[]>(() => {
      if (!readonlyPleaseSelectBookValue) {
        return bookSelectOptions;
      }

      const hasReadonlyOption = bookSelectOptions.some(
        (option) => String(option.value) === readonlyPleaseSelectBookValue,
      );

      if (hasReadonlyOption) {
        return bookSelectOptions;
      }

      return [
        ...bookSelectOptions,
        {
          label: readonlyPleaseSelectBookValue,
          value: readonlyPleaseSelectBookValue,
        },
      ];
    }, [bookSelectOptions, readonlyPleaseSelectBookValue]);
    const shouldShowDetails = !!selectedBookCollectType || !isEmptyValue(selectedOption);
    const isBookTypeLocked = isService204RegulateEntry;
    const printingPermitReadonlyFields = useMemo(
      () =>
        new Set([
          "BookTitle",
          "AuthorName",
          "NationalDepositoryNo",
          "ISBN",
          "Language",
          "SubjectCategory",
        ]),
      [],
    );

    useEffect(() => {
      if (!isService204RegulateEntry || current.BookType === "Paper") {
        return;
      }

      const latestValue = (field.value || {}) as BookTradingFormValue;
      field.setValue({
        ...latestValue,
        BookType: "Paper",
        UploadMaterial: undefined,
        UploadMaterialType: undefined,
        UploadMaterialPassword: undefined,
      });
    }, [current.BookType, field, isService204RegulateEntry]);

    const getFieldDisabled = React.useCallback(
      (name: string, readonly = false) => {
        if (props.disabled) return true;
        if (name === "BookType" && isBookTypeLocked) return true;
        if (name === "NumberOfCopies" && isRegulateEntry) return true;
        if (isPrintingPermit && printingPermitReadonlyFields.has(name)) {
          return true;
        }
        return readonly;
      },
      [isBookTypeLocked, isPrintingPermit, isRegulateEntry, props.disabled, printingPermitReadonlyFields],
    );

    const getInputValue = (name: string) => {
      const value = current[name];
      return typeof value === "string" || typeof value === "number"
        ? value
        : undefined;
    };

    const getUploadValue = (name: string) => {
      const value = current[name];
      return typeof value === "string" || Array.isArray(value) ? value : undefined;
    };

    const handleUploadMaterialAnalysisSuccess = React.useCallback(
      async (fileData: Array<{ url: string; name: string }>) => {
        const uploadedFile = fileData[0];
        const normalizedServiceCode = Number(props.serviceCode || 0);

        if (!uploadedFile?.url || !normalizedServiceCode) {
          return;
        }

        try {
          const response = await analyzeBookMaterial({
            filePath: uploadedFile.url,
            serviceCode: normalizedServiceCode,
          });

          if (!response?.isSuccess) {
            throw new Error(response?.message || tf("aiAnalysisFailedShort"));
          }

          const analysisData = response?.data || {};
          const generatedFields =
            analysisData.aiGeneratedFields &&
            typeof analysisData.aiGeneratedFields === "object"
              ? (analysisData.aiGeneratedFields as Record<string, unknown>)
              : {};
          const generatedLabels =
            analysisData.aiGeneratedLabels &&
            typeof analysisData.aiGeneratedLabels === "object"
              ? (analysisData.aiGeneratedLabels as Record<string, unknown>)
              : {};

          const pickGeneratedValue = (...keys: string[]) => {
            for (const key of keys) {
              const labelValue = generatedLabels[key];
              if (!isEmptyValue(labelValue)) {
                return labelValue;
              }
            }

            for (const key of keys) {
              const fieldValue = generatedFields[key];
              if (!isEmptyValue(fieldValue)) {
                return fieldValue;
              }
            }

            return undefined;
          };

          const nextValuePatch: Partial<BookTradingFormValue> = {
            UploadMaterial: uploadedFile.url,
          };

          const bookTitle = toOptionalString(
            pickGeneratedValue("BookTitle", "PublicationTitle", "Title"),
          );
          if (bookTitle) {
            nextValuePatch.BookTitle = bookTitle;
          }

          const authorName = toOptionalString(
            pickGeneratedValue("AuthorName", "authorName"),
          );
          if (authorName) {
            nextValuePatch.AuthorName = authorName;
          }

          const nationalDepositoryNo = toOptionalString(
            pickGeneratedValue("NationalDepositoryNo", "nationalDepositoryNo"),
          );
          if (nationalDepositoryNo) {
            nextValuePatch.NationalDepositoryNo = nationalDepositoryNo;
          }

          const isbn = toOptionalString(pickGeneratedValue("ISBN", "isbn"));
          if (isbn) {
            nextValuePatch.ISBN = isbn;
          }

          const languageValue = pickGeneratedValue(
            "Language",
            "Languages",
            "languageIds",
          );
          const languageIds =
            toLanguageIds(languageValue) ||
            findOptionValuesByLookupLabels(languageOptions, languageValue);
          if (languageIds && languageIds.length > 0) {
            nextValuePatch.Language = languageIds;
          }

          const subjectCategoryValue = pickGeneratedValue(
            "SubjectCategory",
            "subjectCategoryId",
          );
          const mappedSubjectCategory =
            findOptionValueByLookupLabels(
              subjectCategoryOptions,
              subjectCategoryValue,
            ) ?? toOptionalNumber(subjectCategoryValue);
          if (mappedSubjectCategory !== undefined) {
            nextValuePatch.SubjectCategory = mappedSubjectCategory;
          }

          const subjectSubCategoryValue = pickGeneratedValue(
            "SubjectSubCategory",
            "subjectSubCategoryId",
          );
          if (!isEmptyValue(subjectSubCategoryValue)) {
            let availableOptions = subjectSubCategoryOptions;

            if (availableOptions.length === 0) {
              try {
                const allRows = extractResponseArray<SubjectSubCategory>(
                  await getSubjectSubList(),
                );
                const targetCategoryId =
                  nextValuePatch.SubjectCategory ?? current.SubjectCategory;
                availableOptions = allRows
                  .filter(
                    (item) =>
                      !targetCategoryId ||
                      item.subjectCategoryId === targetCategoryId,
                  )
                  .map((item) => ({
                    label:
                      preferLocalizedEnAr(isAr, item.nameEn, item.nameAr) ||
                      String(item.id),
                    value: item.id,
                    ...item,
                  }));
              } catch (error) {
                console.error(
                  "Failed to fetch subject sub category options for AI mapping:",
                  error,
                );
              }
            }

            const mappedSubjectSubCategory =
              findOptionValueByLookupLabels(
                availableOptions,
                subjectSubCategoryValue,
              ) ?? toOptionalNumber(subjectSubCategoryValue);

            if (mappedSubjectSubCategory !== undefined) {
              nextValuePatch.SubjectSubCategory = mappedSubjectSubCategory;
            }
          }

          const latestValue = (field.value || {}) as BookTradingFormValue;
          field.setValue({
            ...latestValue,
            ...nextValuePatch,
          });

          const mappingWarnings = Array.isArray(analysisData.mappingWarnings)
            ? analysisData.mappingWarnings
            : [];
          const backfilledKeys = Object.keys(nextValuePatch).filter(
            (key) => key !== "UploadMaterial",
          );

          if (mappingWarnings.length > 0) {
            CustomMessage.warning(
              tf("aiAnalysisCompletedReview"),
            );
          } else if (backfilledKeys.length > 0) {
            CustomMessage.success(tf("aiAnalysisCompleted"));
          }
        } catch (error) {
          console.error("AI material analysis failed:", error);
          CustomMessage.error(tf("aiAnalysisFailed"));
        }
      },
      [
        current.SubjectCategory,
        field,
        isAr,
        languageOptions,
        props.serviceCode,
        subjectCategoryOptions,
        subjectSubCategoryOptions,
        tf,
      ],
    );

    const handleFieldChange = (key: string, value: unknown) => {
      const nextValue = {
        ...current,
        [key]: value,
      };

      console.log("Field change:", { key, value, nextValue });

      if (key === "HowDidYouGetTheBook") {
        const nextSelectedBookCollectType = bookCollectTypeOptions.find(
          (option) => String(option.value) === String(value ?? ""),
        );
        const nextSelectedBookCollectTypeKind = (nextSelectedBookCollectType?.kind ||
          "Unknown") as BookCollectTypeKind;

        if (nextSelectedBookCollectTypeKind !== "RegulateEntryPermit") {
          nextValue.RegulateEntryMediaMaterial = undefined;
          nextValue.PleaseSelectBook = undefined;
        }

        if (nextSelectedBookCollectTypeKind === "PrintingPermit") {
          nextValue.NumberOfCopies = undefined;
        }

        if (
          nextSelectedBookCollectTypeKind !== "BookFair" &&
          nextSelectedBookCollectTypeKind !== "LocalDistributor"
        ) {
          nextValue.UploadPurchaseInvoice = undefined;
        }

        if (
          Number(props.serviceCode) === 204 &&
          nextSelectedBookCollectTypeKind === "RegulateEntryPermit"
        ) {
          nextValue.BookType = "Paper";
          nextValue.UploadMaterial = undefined;
          nextValue.UploadMaterialType = undefined;
          nextValue.UploadMaterialPassword = undefined;
        }

        if (nextSelectedBookCollectTypeKind === "SampleForTest") {
          // TODO: Set Sample For Test defaults when the business values are confirmed.
        }
      }

      if (key === "SubjectCategory") {
        nextValue.SubjectSubCategory = undefined;
        setSubjectSubCategoryRows([]);
      }

      if (key === "RegulateEntryMediaMaterial") {
        nextValue.PleaseSelectBook = undefined;
        // TODO: Fetch books for the selected regulate entry permit and prefill NumberOfCopies.
        setBookSelectOptions([]);
      }

      if (key === "PublicationsPrintingPermit") {
        const selectedPermit = printingPermitOptions.find(
          (option) => String(option.value) === String(value ?? ""),
        );

        Object.assign(nextValue, buildPrintingPermitPrefill(selectedPermit));
      }

      if (key === "PleaseSelectBook") {
        // TODO: Populate editable book detail fields from the selected regulate-entry book.
      }

      if (key === "BookType") {
        if (value === "Paper") {
          nextValue.UploadMaterial = undefined;
          nextValue.UploadMaterialType = undefined;
          nextValue.UploadMaterialPassword = undefined;
        }
      }

      if (key === "UploadMaterial") {
        // TODO: Trigger AI extraction for Electronic books and prefill supported fields.
      }

      if (key === "Language") {
        nextValue.Language =
          typeof value === "string"
            ? value
            : Array.isArray(value)
              ? value.join(",")
              : undefined;
      }

      field.setValue(nextValue);
    };

    const renderTextInput = (
      name: string,
      label: string,
      placeholder: string,
      options?: {
        required?: boolean;
        disabled?: boolean;
        maxLength?: number;
        validator?: BookTradingFieldValidator;
      },
    ) => {
      const required = options?.required ?? true;
      const disabled = options?.disabled ?? false;
      const maxLength = options?.maxLength;

      return (
        <Field name={name} decorator={[FormItem]} validator={options?.validator}>
          <div className="ant-formily-item-label">
            <div>
              {label}
              {required && (
    <span className="required-icon">*</span>
              )}
            </div>
          </div>
          <Input
            disabled={getFieldDisabled(name, disabled)}
            className="ant-input-affix-wrapper"
            placeholder={placeholder}
            maxLength={maxLength}
            value={getInputValue(name)}
            onChange={(e) => handleFieldChange(name, e.target.value)}
          />
        </Field>
      );
    };

    const renderNumberInput = (
      name: string,
      label: string,
      placeholder: string,
      options?: {
        required?: boolean;
        disabled?: boolean;
        validator?: BookTradingFieldValidator;
      },
    ) => {
      const required = options?.required ?? true;
      const disabled = options?.disabled ?? false;

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if ((/^\d*$/.test(value) || value === "") && value.length <= 10) {
          handleFieldChange(name, value);
        }
      };

      return (
        <Field name={name} decorator={[FormItem]} validator={options?.validator}>
          <div className="ant-formily-item-label">
            <div>
              {label}
              {required && (
    <span className="required-icon">*</span>
              )}
            </div>
          </div>
          <Input
            disabled={getFieldDisabled(name, disabled)}
            className="ant-input-affix-wrapper"
            placeholder={placeholder}
            value={getInputValue(name)}
            onChange={handleChange}
          />
        </Field>
      );
    };

    const renderSelect = (
      name: string,
      label: string,
      placeholder: string,
      options: OptionType[],
      config?: {
        required?: boolean;
        disabled?: boolean;
        showDescription?: boolean;
        valueOverride?: unknown;
        validator?: BookTradingFieldValidator;
      },
    ) => {
      const required = config?.required ?? true;
      const disabled = config?.disabled ?? false;
      const showDescription = config?.showDescription ?? false;
      const value =
        config?.valueOverride !== undefined ? config.valueOverride : current[name];

      return (
        <Field name={name} decorator={[FormItem]} validator={config?.validator}>
          <div className="ant-formily-item-label">
            <div>
              {label}
              {required && (
    <span className="required-icon">*</span>
              )}
            </div>
          </div>
          <Select
            disabled={getFieldDisabled(name, disabled)}
            placeholder={placeholder}
            value={value}
            onChange={(value: unknown) => handleFieldChange(name, value)}
            showSearch
            optionLabelProp="optionLabel"
            optionFilterProp="children"
            className="umc-select-arrow-manual"
          >
            {options.map((option) => {
              const description = showDescription
                ? String(
                    (isAr ? option.descAr : option.descEn) ||
                      (isAr ? option.descEn : option.descAr) ||
                      "",
                  ).trim()
                : "";

              return (
                <Option
                  key={option.value}
                  value={option.value}
                  optionLabel={option.label}
                >
                  <div style={{ whiteSpace: "normal", lineHeight: 1.5 }}>
                    <div>{option.label}</div>
                    {description ? (
                      <div
                        style={{
                          color: "rgba(0, 0, 0, 0.65)",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        {description}
                      </div>
                    ) : null}
                  </div>
                </Option>
              );
            })}
          </Select>
        </Field>
      );
    };

    const renderLanguageSelect = (
      name: string,
      label: string,
      placeholder: string,
      config?: {
        required?: boolean;
        disabled?: boolean;
        validator?: BookTradingFieldValidator;
      },
    ) => {
      const required = config?.required ?? true;
      const disabled = config?.disabled ?? false;

      return (
        <Field name={name} decorator={[FormItem]} validator={config?.validator}>
          <div className="ant-formily-item-label">
            <div>
              {label}
              {required && (
    <span className="required-icon">*</span>
              )}
            </div>
          </div>
          <LanguageSelectComponent
            disabled={getFieldDisabled(name, disabled)}
            multiple={true}
            placeholder={placeholder}
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
      uploadConfig: UploadFieldConfig,
      options?: {
        required?: boolean;
        disabled?: boolean;
        showTooltip?: boolean;
        tooltipTitle?: string;
        validator?: BookTradingFieldValidator;
      },
    ) => {
      const required = options?.required ?? true;
      const disabled = options?.disabled ?? false;
      const showTooltip = options?.showTooltip ?? false;

      return (
        <Field name={name} decorator={[FormItem]} validator={options?.validator}>
          <div className="ant-formily-item-label AI-flex">
            <span>
              {label}
              {required && (
    <span className="required-icon">*</span>
              )}
              {showTooltip && (
                <Tooltip title={options?.tooltipTitle || uploadConfig.uploadTip}>
                  <QuestionCircleOutlined
                    style={{ marginLeft: 4, color: "#999" }}
                  />
                </Tooltip>
              )}
            </span>
          </div>
          <div className="ant-formily-upload">
            <DocumentViewer
              hasDelete={true}
              disabled={getFieldDisabled(name, disabled)}
              value={getUploadValue(name)}
              onChange={(value: string | string[]) => handleFieldChange(name, value)}
              uploadConfig={{
                maxCount: 1,
                maxSize: uploadConfig.maxSize,
                accept: uploadConfig.accept,
                uploadTip: uploadConfig.uploadTip,
                invalidFileTypeMessage: uploadConfig.invalidFileTypeMessage,
                maxSizeErrorMessage: uploadConfig.maxSizeErrorMessage,
                onUploadSuccess:
                  name === "UploadMaterial"
                    ? handleUploadMaterialAnalysisSuccess
                    : undefined,
              }}
            />
          </div>
        </Field>
      );
    };

    const renderFileOrLink = (
      name: "UploadMaterial",
      label: string,
      uploadConfig: UploadFieldConfig,
      options?: {
        required?: boolean;
        disabled?: boolean;
        showTooltip?: boolean;
        tooltipTitle?: string;
        validator?: BookTradingFieldValidator;
      },
    ) => {
      const required = options?.required ?? true;
      const disabled = options?.disabled ?? false;
      const showTooltip = options?.showTooltip ?? false;

      return (
        <Field name={name} decorator={[FormItem]} validator={options?.validator}>
          <div className="ant-formily-item-label AI-flex">
            <span>
              {label}
              {required && <span className="required-icon">*</span>}
              {showTooltip && (
                <Tooltip title={options?.tooltipTitle || uploadConfig.uploadTip}>
                  <QuestionCircleOutlined
                    style={{ marginLeft: 4, color: "#999" }}
                  />
                </Tooltip>
              )}
            </span>
          </div>
          <div className="ant-formily-upload">
            <DraftFileOrLinkField
              disabled={getFieldDisabled(name, disabled)}
              value={String(current[name] ?? "")}
              onChange={(value) => handleFieldChange(name, value)}
              fileFormat={["PDF"]}
              fileSizeLimit={uploadConfig.maxSize}
              uploadTip={uploadConfig.uploadTip}
              invalidFileTypeMessage={uploadConfig.invalidFileTypeMessage}
              maxSizeErrorMessage={uploadConfig.maxSizeErrorMessage}
              onFileUploadSuccess={handleUploadMaterialAnalysisSuccess}
            />
          </div>
        </Field>
      );
    };

    const renderRadioGroup = (
      name: string,
      label: string,
      options: { label: string; value: string }[],
      config?: {
        required?: boolean;
        disabled?: boolean;
        validator?: BookTradingFieldValidator;
      },
    ) => {
      const required = config?.required ?? true;
      const disabled = config?.disabled ?? false;

      return (
        <Field name={name} decorator={[FormItem]} validator={config?.validator}>
          <div className="ant-formily-item-label">
            <div>
              {label}
              {required && (
    <span className="required-icon">*</span>
              )}
            </div>
          </div>
          <Radio.Group
            className="ant-formily-radio"
            disabled={getFieldDisabled(name, disabled)}
            value={current[name]}
            onChange={(e) => handleFieldChange(name, e.target.value)}
          >
            {options.map((option) => (
              <Radio key={option.value} value={option.value}>
                {option.label}
              </Radio>
            ))}
          </Radio.Group>
        </Field>
      );
    };

    const getNestedField = React.useCallback(
      (name: ConditionalBookTradingFieldName) =>
        field.query(`${field.address}.${name}`).take() as
          | NestedFieldController
          | undefined,
      [field],
    );

    const clearFieldFeedbackState = React.useCallback(
      (targetField?: NestedFieldController) => {
        targetField?.setFeedback?.({
          type: "error",
          messages: [],
        });
        targetField?.setState?.((state) => {
          state.selfErrors = [];
          state.selfWarnings = [];
          state.selfSuccesses = [];
          state.selfValidating = false;
          state.validating = false;
        });
      },
      [],
    );

    const isSameValue = React.useCallback((left: unknown, right: unknown) => {
      if (Array.isArray(left) && Array.isArray(right)) {
        return (
          left.length === right.length &&
          left.every((item, index) => item === right[index])
        );
      }

      return left === right;
    }, []);

    const conditionalFieldConfigs = useMemo<
      Record<ConditionalBookTradingFieldName, ConditionalFieldConfig>
    >(() => {
      const createConfig = (
        name: ConditionalBookTradingFieldName,
        options: Omit<ConditionalFieldConfig, "name" | "validator">,
      ): ConditionalFieldConfig => ({
        name,
        ...options,
        validator: createConditionalFieldValidator({
          ...options,
          requiredMessage: options.requiredMessage,
        }),
      });

      const printingPermitDisabled = getFieldDisabled(
        "PublicationsPrintingPermit",
      );
      const uploadMaterialDisabled = getFieldDisabled("UploadMaterial");
      const regulateEntryDisabled = getFieldDisabled(
        "RegulateEntryMediaMaterial",
      );
      const selectBookDisabled = getFieldDisabled("PleaseSelectBook");
      const bookTitleDisabled = getFieldDisabled("BookTitle");
      const authorNameDisabled = getFieldDisabled("AuthorName");
      const nationalDepositoryDisabled = getFieldDisabled(
        "NationalDepositoryNo",
      );
      const isbnDisabled = getFieldDisabled("ISBN");
      const printYearDisabled = getFieldDisabled("PrintYear");
      const versionNumberDisabled = getFieldDisabled("VersionNumber");
      const languageDisabled = getFieldDisabled("Language");
      const subjectCategoryDisabled = getFieldDisabled("SubjectCategory");
      const subjectSubCategoryDisabled = getFieldDisabled("SubjectSubCategory");
      const distributorAgencyDisabled = getFieldDisabled("DistributorAgency");
      const numberOfCopiesDisabled = getFieldDisabled(
        "NumberOfCopies",
        isRegulateEntry,
      );
      const uploadPurchaseInvoiceDisabled = getFieldDisabled(
        "UploadPurchaseInvoice",
      );
      const shouldShowRequired = (visible: boolean, disabled: boolean) =>
        visible && (!disabled || Boolean(props.disabled));

      return {
        PublicationsPrintingPermit: createConfig("PublicationsPrintingPermit", {
          visible: isPrintingPermit,
          required: shouldShowRequired(
            isPrintingPermit,
            printingPermitDisabled,
          ),
          disabled: printingPermitDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(
            tf("labelPublicationsPrintingPermit"),
          ),
          validators: [],
        }),
        UploadMaterial: createConfig("UploadMaterial", {
          visible: showUploadMaterial,
          required: shouldShowRequired(
            showUploadMaterial,
            uploadMaterialDisabled,
          ),
          disabled: uploadMaterialDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelUploadMaterial")),
          validators: [],
        }),
        RegulateEntryMediaMaterial: createConfig("RegulateEntryMediaMaterial", {
          visible: isRegulateEntry,
          required: shouldShowRequired(
            isRegulateEntry,
            regulateEntryDisabled,
          ),
          disabled: regulateEntryDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(
            tf("labelRegulateEntryMediaMaterial"),
          ),
          validators: [],
        }),
        PleaseSelectBook: createConfig("PleaseSelectBook", {
          visible: showPleaseSelectBook,
          required: shouldShowRequired(
            showPleaseSelectBook,
            selectBookDisabled,
          ),
          disabled: selectBookDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelPleaseSelectBook")),
          validators: [],
        }),
        BookTitle: createConfig("BookTitle", {
          visible: shouldShowDetails,
          required: shouldShowRequired(shouldShowDetails, bookTitleDisabled),
          disabled: bookTitleDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelBookTitle")),
          validators: [
            getStringLengthValidator(
              200,
              tf("validationMaxChars", { max: 200 }),
            ),
          ],
        }),
        AuthorName: createConfig("AuthorName", {
          visible: shouldShowDetails,
          required: shouldShowRequired(shouldShowDetails, authorNameDisabled),
          disabled: authorNameDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelAuthorName")),
          validators: [
            getStringLengthValidator(
              100,
              tf("validationMaxChars", { max: 100 }),
            ),
          ],
        }),
        NationalDepositoryNo: createConfig("NationalDepositoryNo", {
          visible: shouldShowDetails,
          required: false,
          disabled: nationalDepositoryDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(
            tf("labelNationalDepositoryNo"),
          ),
          validators: [
            getStringLengthValidator(
              50,
              tf("validationMaxChars", { max: 50 }),
            ),
            nationalDepositoryValidator,
          ],
        }),
        ISBN: createConfig("ISBN", {
          visible: shouldShowDetails,
          required: false,
          disabled: isbnDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelISBN")),
          validators: [
            getStringLengthValidator(
              20,
              tf("validationMaxChars", { max: 20 }),
            ),
            isbnValidator,
          ],
        }),
        PrintYear: createConfig("PrintYear", {
          visible: shouldShowDetails,
          required: shouldShowRequired(shouldShowDetails, printYearDisabled),
          disabled: printYearDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelPrintYear")),
          validators: [
            getStringLengthValidator(
              4,
              tf("validationMaxChars", { max: 4 }),
            ),
            printYearValidator,
          ],
        }),
        VersionNumber: createConfig("VersionNumber", {
          visible: shouldShowDetails,
          required: shouldShowRequired(
            shouldShowDetails,
            versionNumberDisabled,
          ),
          disabled: versionNumberDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelVersionNumber")),
          validators: [
            getStringLengthValidator(
              20,
              tf("validationMaxChars", { max: 20 }),
            ),
          ],
        }),
        Language: createConfig("Language", {
          visible: shouldShowDetails,
          required: shouldShowRequired(shouldShowDetails, languageDisabled),
          disabled: languageDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelLanguages")),
          validators: [],
        }),
        SubjectCategory: createConfig("SubjectCategory", {
          visible: shouldShowDetails,
          required: shouldShowRequired(
            shouldShowDetails,
            subjectCategoryDisabled,
          ),
          disabled: subjectCategoryDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelSubjectCategory")),
          validators: [],
        }),
        SubjectSubCategory: createConfig("SubjectSubCategory", {
          visible: shouldShowDetails,
          required: shouldShowRequired(
            shouldShowDetails,
            subjectSubCategoryDisabled,
          ),
          disabled: subjectSubCategoryDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(
            tf("labelSubjectSubCategory"),
          ),
          validators: [],
        }),
        DistributorAgency: createConfig("DistributorAgency", {
          visible: shouldShowDetails,
          required: false,
          disabled: distributorAgencyDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(
            tf("labelDistributorAgency"),
          ),
          validators: [
            getStringLengthValidator(
              200,
              tf("validationMaxChars", { max: 200 }),
            ),
          ],
        }),
        NumberOfCopies: createConfig("NumberOfCopies", {
          visible: showNumberOfCopies,
          required: shouldShowRequired(
            showNumberOfCopies,
            numberOfCopiesDisabled,
          ),
          disabled: numberOfCopiesDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(tf("labelNumberOfCopies")),
          validators: [numberOfCopiesValidator],
        }),
        UploadPurchaseInvoice: createConfig("UploadPurchaseInvoice", {
          visible: showUploadPurchaseInvoice,
          required: shouldShowRequired(
            showUploadPurchaseInvoice,
            uploadPurchaseInvoiceDisabled,
          ),
          disabled: uploadPurchaseInvoiceDisabled,
          emptyValue: undefined,
          requiredMessage: requiredMessageForLabel(
            tf("labelUploadPurchaseInvoice"),
          ),
          validators: [],
        }),
      };
    }, [
      getFieldDisabled,
      isbnValidator,
      isPrintingPermit,
      isRegulateEntry,
      nationalDepositoryValidator,
      numberOfCopiesValidator,
      printYearValidator,
      props.disabled,
      requiredMessageForLabel,
      shouldShowDetails,
      showNumberOfCopies,
      showPleaseSelectBook,
      showUploadMaterial,
      showUploadPurchaseInvoice,
      tf,
    ]);

    useEffect(() => {
      const latestValue = (field.value || {}) as BookTradingFormValue;
      const hiddenValuePatch: Partial<BookTradingFormValue> = {};

      Object.values(conditionalFieldConfigs).forEach((config) => {
        const targetField = getNestedField(config.name);

        if (targetField) {
          targetField.setValidator?.(config.validator);
          targetField.setState?.((state) => {
            state.visible = config.visible;
            state.display = config.visible ? "visible" : "none";
            state.required = config.required;
          });
          clearFieldFeedbackState(targetField);
        }

        if (
          !props.disabled &&
          !config.visible &&
          !isSameValue(latestValue[config.name], config.emptyValue)
        ) {
          (hiddenValuePatch as Record<string, unknown>)[config.name] =
            config.emptyValue;
        }
      });

      if (!props.disabled && !showUploadMaterial) {
        if (latestValue.UploadMaterialType !== undefined) {
          hiddenValuePatch.UploadMaterialType = undefined;
        }
        if (latestValue.UploadMaterialPassword !== undefined) {
          hiddenValuePatch.UploadMaterialPassword = undefined;
        }
      }

      if (Object.keys(hiddenValuePatch).length > 0) {
        field.setValue({
          ...latestValue,
          ...hiddenValuePatch,
        });
      }
    }, [
      clearFieldFeedbackState,
      conditionalFieldConfigs,
      field,
      getNestedField,
      isSameValue,
      props.disabled,
      showUploadMaterial,
    ]);

    const howDidYouGetRequiredValidator = useMemo(
      () =>
        createConditionalFieldValidator({
          visible: true,
          required: true,
          disabled: false,
          validators: [],
          requiredMessage: requiredMessageForLabel(
            tf("labelHowDidYouGetTheBook"),
          ),
        }),
      [requiredMessageForLabel, tf],
    );

    const bookTypeRequiredValidator = useMemo(
      () =>
        createConditionalFieldValidator({
          visible: true,
          required: true,
          disabled: false,
          validators: [],
          requiredMessage: requiredMessageForLabel(tf("labelBookType")),
        }),
      [requiredMessageForLabel, tf],
    );

    const renderConditionalCol = (
      visible: boolean,
      children: React.ReactNode,
      span = 12,
    ) => {
      if (!visible) {
        return null;
      }

      return <Col span={span}>{children}</Col>;
    };

    return (
      <div className="book-trading-form-container">
        <AntdCard
          title={
            <span data-content-editable="x-component-props.title">
              {displayCardTitle}
            </span>
          }
        >
          <Row gutter={[24, 24]}>
            <Col span={12}>
              {renderSelect(
                "HowDidYouGetTheBook",
                tf("labelHowDidYouGetTheBook"),
                tf("phHowDidYouGetTheBook"),
                bookCollectTypeOptions,
                { validator: howDidYouGetRequiredValidator },
              )}
            </Col>

            <Col span={12}>
              {renderRadioGroup("BookType", tf("labelBookType"), bookTypeOptions, {
                validator: bookTypeRequiredValidator,
              })}
            </Col>

            {renderConditionalCol(
              isPrintingPermit,
              renderSelect(
                "PublicationsPrintingPermit",
                tf("labelPublicationsPrintingPermit"),
                tf("phPublicationsPrintingPermit"),
                printingPermitOptions,
                conditionalFieldConfigs.PublicationsPrintingPermit,
              ),
            )}

            {renderConditionalCol(
              showUploadMaterial,
              renderFileOrLink(
                "UploadMaterial",
                tf("labelUploadMaterial"),
                uploadMaterialConfig,
                {
                  required: conditionalFieldConfigs.UploadMaterial.required,
                  disabled: conditionalFieldConfigs.UploadMaterial.disabled,
                  showTooltip: true,
                  validator: conditionalFieldConfigs.UploadMaterial.validator,
                },
              ),
            )}

            {renderConditionalCol(
              isRegulateEntry,
              renderSelect(
                "RegulateEntryMediaMaterial",
                tf("labelRegulateEntryMediaMaterial"),
                tf("phRegulateEntryMediaMaterial"),
                regulateEntryOptions,
                conditionalFieldConfigs.RegulateEntryMediaMaterial,
              ),
            )}

            {renderConditionalCol(
              showPleaseSelectBook,
              renderSelect(
                "PleaseSelectBook",
                tf("labelPleaseSelectBook"),
                tf("phPleaseSelectBook"),
                pleaseSelectBookOptions,
                {
                  ...conditionalFieldConfigs.PleaseSelectBook,
                  valueOverride: readonlyPleaseSelectBookValue,
                },
              ),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderTextInput("BookTitle", tf("labelBookTitle"), tf("phBookTitle"), {
                required: conditionalFieldConfigs.BookTitle.required,
                disabled: conditionalFieldConfigs.BookTitle.disabled,
                maxLength: 200,
                validator: conditionalFieldConfigs.BookTitle.validator,
              }),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderTextInput("AuthorName", tf("labelAuthorName"), tf("phAuthorName"), {
                required: conditionalFieldConfigs.AuthorName.required,
                disabled: conditionalFieldConfigs.AuthorName.disabled,
                maxLength: 100,
                validator: conditionalFieldConfigs.AuthorName.validator,
              }),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderTextInput(
                "NationalDepositoryNo",
                tf("labelNationalDepositoryNo"),
                tf("phNationalDepositoryNo"),
                {
                  required: false,
                  disabled:
                    conditionalFieldConfigs.NationalDepositoryNo.disabled,
                  maxLength: 50,
                  validator:
                    conditionalFieldConfigs.NationalDepositoryNo.validator,
                },
              ),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderTextInput("ISBN", tf("labelISBN"), tf("phISBN"), {
                required: false,
                disabled: conditionalFieldConfigs.ISBN.disabled,
                maxLength: 20,
                validator: conditionalFieldConfigs.ISBN.validator,
              }),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderTextInput("PrintYear", tf("labelPrintYear"), tf("phPrintYear"), {
                required: conditionalFieldConfigs.PrintYear.required,
                disabled: conditionalFieldConfigs.PrintYear.disabled,
                maxLength: 4,
                validator: conditionalFieldConfigs.PrintYear.validator,
              }),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderTextInput(
                "VersionNumber",
                tf("labelVersionNumber"),
                tf("phVersionNumber"),
                {
                  required: conditionalFieldConfigs.VersionNumber.required,
                  disabled: conditionalFieldConfigs.VersionNumber.disabled,
                  maxLength: 20,
                  validator: conditionalFieldConfigs.VersionNumber.validator,
                },
              ),
            )}

            {renderConditionalCol(
              showNumberOfCopies,
              renderNumberInput(
                "NumberOfCopies",
                tf("labelNumberOfCopies"),
                tf("phNumberOfCopies"),
                {
                  required: conditionalFieldConfigs.NumberOfCopies.required,
                  disabled: isRegulateEntry,
                  validator: conditionalFieldConfigs.NumberOfCopies.validator,
                },
              ),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderLanguageSelect(
                "Language",
                tf("labelLanguages"),
                tf("phLanguages"),
                {
                  required: conditionalFieldConfigs.Language.required,
                  disabled: conditionalFieldConfigs.Language.disabled,
                  validator: conditionalFieldConfigs.Language.validator,
                },
              ),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderSelect(
                "SubjectCategory",
                tf("labelSubjectCategory"),
                tf("phSubjectCategory"),
                subjectCategoryOptions,
                {
                  required: conditionalFieldConfigs.SubjectCategory.required,
                  disabled: conditionalFieldConfigs.SubjectCategory.disabled,
                  showDescription: true,
                  validator: conditionalFieldConfigs.SubjectCategory.validator,
                },
              ),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderSelect(
                "SubjectSubCategory",
                tf("labelSubjectSubCategory"),
                tf("phSubjectSubCategory"),
                subjectSubCategoryOptions,
                {
                  required:
                    conditionalFieldConfigs.SubjectSubCategory.required,
                  disabled:
                    conditionalFieldConfigs.SubjectSubCategory.disabled,
                  validator:
                    conditionalFieldConfigs.SubjectSubCategory.validator,
                },
              ),
            )}

            {renderConditionalCol(
              showSubmittedAgeClassification &&
                isAgeClassificationLookupSettled,
              renderSelect(
                "AgeClassification",
                tf("labelAgeClassification"),
                tf("phAgeClassification"),
                submittedAgeClassificationOptions,
                {
                  disabled: true,
                },
              ),
            )}

            {renderConditionalCol(
              shouldShowDetails,
              renderTextInput(
                "DistributorAgency",
                tf("labelDistributorAgency"),
                tf("phDistributorAgency"),
                {
                  required: false,
                  disabled: conditionalFieldConfigs.DistributorAgency.disabled,
                  maxLength: 200,
                  validator:
                    conditionalFieldConfigs.DistributorAgency.validator,
                },
              ),
            )}

            {renderConditionalCol(
              showUploadPurchaseInvoice,
              renderUpload(
                "UploadPurchaseInvoice",
                tf("labelUploadPurchaseInvoice"),
                uploadPurchaseInvoiceConfig,
                {
                  required:
                    conditionalFieldConfigs.UploadPurchaseInvoice.required,
                  disabled:
                    conditionalFieldConfigs.UploadPurchaseInvoice.disabled,
                  validator:
                    conditionalFieldConfigs.UploadPurchaseInvoice.validator,
                },
              ),
            )}

            <Col span={12}>
              {renderUpload(
                "UploadObligationLetter",
                tf("labelUploadObligationLetter"),
                uploadObligationLetterConfig,
                {
                  required: false,
                  showTooltip: true,
                },
              )}
            </Col>
          </Row>
        </AntdCard>
      </div>
    );
  },
);

BookTradingFormField.displayName = "BookTradingFormField";

export default BookTradingFormField;
