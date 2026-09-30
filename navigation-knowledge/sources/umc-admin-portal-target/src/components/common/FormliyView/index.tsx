// import "antd/dist/antd.less";
import { createForm, onFieldReact } from "@formily/core";
import "./index.less";
import { useEffect, useState, useMemo, useRef } from "react";
import type { ComponentProps, FC } from "react";
import { createSchemaField } from "@formily/react";
import {
  Form,
  Checkbox,
  Cascader,
  Editable,
  // Input,
  NumberPicker,
  Switch,
  Password,
  PreviewText,
  Reset,
  // Select,
  Space,
  Submit,
  TimePicker,
  Transfer,
  TreeSelect,
  // Upload,
  FormGrid as FormilyFormGrid,
  FormLayout,
  FormTab,
  FormCollapse,
  ArrayTable,
  ArrayCards,

  // Rate,
} from "@formily/antd";
import { Input } from '@/components/designable/src/components/Input/preview'
import DurationInput from "@/components/designable/src/components/DurationInput/DurationInput";

import { DatePicker } from "@/components/designable/src/components/DatePicker/preview";
import AddressPicker from "@/components/designable/src/components/AddressPicker/AddressPicker";
import EmiratePort from "@/components/designable/src/components/EmiratePort/EmiratePort";
import { Divider } from "@/components/designable/src/components/Divider/Divider";
import SelectTableSingleField from "@/components/designable/src/components/SelectTableSingle/SelectTableField";
import DataListInner from "@/components/designable/src/components/DataList/DataList";
import FilmsUrlsListField from "@/components/designable/src/components/UrlList/UrlList";
import PressCardSelectorInner from "@/components/designable/src/components/PressCardSelector/PressCardSelector";
import EquipmentListInner from "@/components/designable/src/components/EquipmentList/EquipmentList";
import { Select } from "@/components/designable/src/components/Select/preview";
import { MultiDropdown } from "@/components/designable/src/components/MultiDropdown/preview";
import CountryDropdown from "@/components/designable/src/components/CountryDropdown/CountryDropdown";
import Information from "@/components/designable/src/components/Information/Information";
import SelectTableField from "@/components/designable/src/components/SelectTable/SelectTableField";
import LanguageSelect from "@/components/designable/src/components/LanguageSelect/LanguageSelect";
import UploadDom from "@/components/designable/src/components/Upload/Upload";
import MultiFileDom from "@/components/designable/src/components/MultiFile/MultiFile";
import { DraftFileOrLinkField } from "@/components/designable/src/components/DraftFileOrLink/DraftFileOrLinkField";
import LanguageSelectMulti from "@/components/designable/src/components/LanguageSelectMulti/LanguageSelectMulti";
import IDSelectorField from "@/components/designable/src/components/IDSelector/IDSelectorField";
import { PublicationFormField } from "@/components/designable/src/components/PublicationForm/PublicationFormField";
import { BookTradingFormField } from "@/components/designable/src/components/BookTradingForm/BookTradingFormField";
import { MemberListField } from "@/components/designable/src/components/FilmingTeam/MemberListField";
import { AcquaintanceFormField } from "@/components/designable/src/components/AcquaintanceForm/AcquaintanceFormField";
import { FilmingLocationsField } from "@/components/designable/src/components/AddressList/AddressList";
import { DataFormField } from "@/components/designable/src/components/DataForm/DataFormField";
import { BookListUploadField } from "@/components/designable/src/components/BookList/BookListUploadField";
import { FileUploadGridField } from "@/components/designable/src/components/FileUploadGrid/FileUploadGridField";
import {ConfigProvider, Slider, Rate } from "antd";
import { Card as PreviewCard } from '@/components/designable/src/components/Card/preview'
import { getAntdLocale } from "@/utils/antdLocale";
import { DEFAULT_COUNTRY_DIAL_CODE } from "@/components/common/MobileNumberInput";
import {
  getSelectedActivityKeys,
  NEWSPAPER_MAGAZINE_DRAFT_HIDDEN_ACTIVITY_CODES,
  NEWSPAPER_REPRINT_ACTIVITY_CODES,
  PRESS_CARD_PERMIT_START_DATE_ACTIVITY_CODES,
} from "@/components/common/formilyActivityRules";
import { MobileNumberRuntimeProvider } from "@/components/designable/src/components/MobileNumberInput/MobileNumberRuntimeProvider";
import type { MobileNumberRuntimeConfigInput } from "@/components/designable/src/components/MobileNumberInput/runtimeContext";
import {
  FormLanguageProvider,
  type PortalFormLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { Radio, RadioGroupField } from "@/components/designable/src/components/Radio/preview";
import FormItemWithHtmlTooltip from "@/components/designable/src/components/FormItemWithHtmlTooltip";
import "@/components/designable/src/components/FormItemWithHtmlTooltip/index.less";
import { SocialMediaAccountField } from "@/components/designable/src/components/SocialMediaAccount/SocialMediaAccountField";
import { PersonsInChargeListField } from "@/components/designable/src/components/PersonsInChargeList/PersonsInChargeListField";
import {
  PartnerListField,
  type PartnerItem,
} from "@/components/designable/src/components/PartnerList/PartnerListField";
import { GameDistributionFormField } from "@/components/designable/src/components/GameDistributionForm/GameDistributionFormField";
import { VideoGamePackageFormField } from "@/components/designable/src/components/VideoGamePackageForm/VideoGamePackageFormField";
import { MoviePackageFormField } from "@/components/designable/src/components/MoviePackageForm/MoviePackageFormField";
import { FilmingPurposeFormField } from "@/components/designable/src/components/FilmingPurposeForm/FilmingPurposeFormField";
import { FilmRescreeningFormField } from "@/components/designable/src/components/FilmRescreeningForm/FilmRescreeningFormField";
import { FilmScreeningFormField } from "@/components/designable/src/components/FilmScreeningForm/FilmScreeningFormField";
import { FilmTrailerFormField } from "@/components/designable/src/components/FilmTrailerForm/FilmTrailerFormField";
import { LicenseTransferFormField } from "@/components/designable/src/components/LicenseTransferForm/LicenseTransferFormField";
import { LicenseInformationFormField } from "@/components/designable/src/components/LicenseInformationForm/LicenseInformationFormField";
import { TradeLicenseDetailsField } from "@/components/designable/src/components/TradeLicenseDetails/TradeLicenseDetailsField";
import { GuardianConsentDetailsField } from "@/components/designable/src/components/GuardianConsentDetails/GuardianConsentDetailsField";
import { NewpaperMagazineCirculationField } from "@/components/designable/src/components/NewpaperMagazineCirculation/NewpaperMagazineCirculationField";
import { BeneficiaryTypeField } from "@/components/designable/src/components/BeneficiaryType/BeneficiaryTypeField";
import { TransferInformationField } from "@/components/designable/src/components/TransferInformation/TransferInformationField";
import { SocialMediaManagerField } from "@/components/designable/src/components/SocialMediaManager/SocialMediaManagerField";
import { VideoField } from "@/components/designable/src/components/Video/VideoField";
import PosterAndTrailerPermitField from "@/components/designable/src/components/PosterAndTrailerPermit/PosterAndTrailerPermitField";
import { useServicesStore } from "@/store/services";
import { useTranslation } from "react-i18next";
import { ScriptPublicationFormField } from "@/components/designable/src/components/ScriptPublicationForm/ScriptPublicationFormField";
import { ProfileFormReviewField } from "@/components/designable/src/components/ProfileForm/ProfileFormReviewField";
import {
  MobileNumberInputField,
  type MobileNumberInputFieldProps,
} from "@/components/designable/src/components/MobileNumberInput/MobileNumberInputField";
import { ProfileFormField } from "@/components/designable/src/components/ProfileForm/ProfileFormField";
import {
  SERVICE_302,
  getService302SelectTableValue,
  hasService302BookActivity,
  hasService302OtherActivity,
} from "@/utils/service302Utils";
import { normalizeAdminReviewFormValues } from "./reviewFormValues";
import FormilyRenderSlotProvider from "./FormilyRenderSlotProvider";
import type { FormilyRenderSlot } from "./runtimeSlots";
import type { Service302MaterialStatusStateChange } from "@/utils/service302MaterialStatus";

type RuntimeFormGridComponent = FC<
  ComponentProps<typeof FormilyFormGrid>
> & {
  GridColumn: typeof FormilyFormGrid.GridColumn;
};
type DynamicSchemaNode = Record<string, unknown>;
const PERSONAL_PHOTO_TOOLTIP_SERVICE_CODES = new Set([1801, 1802, 8008]);
const PERSONAL_PHOTO_UPLOAD_UNIQUE_VALUE = "PersonalPhoto";
const isPlainRecord = (value: unknown): value is DynamicSchemaNode =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const isPersonalPhotoUpload = (node: DynamicSchemaNode): boolean =>
  node["x-component"] === "Upload" &&
  node.uniqueValue === PERSONAL_PHOTO_UPLOAD_UNIQUE_VALUE;
const withPersonalPhotoTooltip = (
  schemaNode: unknown,
  enabled: boolean,
): unknown => {
  if (Array.isArray(schemaNode)) {
    return schemaNode.map((item) => withPersonalPhotoTooltip(item, enabled));
  }
  if (!isPlainRecord(schemaNode)) {
    return schemaNode;
  }
  const nextNode: DynamicSchemaNode = { ...schemaNode };
  if (enabled && isPersonalPhotoUpload(schemaNode)) {
    const decoratorProps = isPlainRecord(schemaNode["x-decorator-props"])
      ? schemaNode["x-decorator-props"]
      : {};
    nextNode["x-decorator-props"] = {
      ...decoratorProps,
      personalPhotoTooltip: true,
    };
  }
  if (isPlainRecord(schemaNode.properties)) {
    nextNode.properties = Object.fromEntries(
      Object.entries(schemaNode.properties).map(([key, child]) => [
        key,
        withPersonalPhotoTooltip(child, enabled),
      ]),
    );
  }
  return nextNode;
};

const RuntimeGridColumn: typeof FormilyFormGrid.GridColumn = ({
  children,
  ...props
}) => {
  // Comment out the logic for filtering empty GridColumns. 
  // ----------Await confirmation from Canli.--------------
  
  // if (Children.count(children) === 0) {
  //   return null;
  // }

  return (
    <FormilyFormGrid.GridColumn {...props}>
      {children}
    </FormilyFormGrid.GridColumn>
  );
};

const RuntimeFormGrid = ((props) => (
  <FormilyFormGrid {...props} />
)) as RuntimeFormGridComponent;

RuntimeFormGrid.GridColumn = RuntimeGridColumn;

interface SchemaData {
  form: {
    labelCol: number;
    wrapperCol: number;
  };
  schema: object;
}

type SchemaNode = Record<string, unknown>;

function applyReadPrettyPattern(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(applyReadPrettyPattern);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const node = schema as SchemaNode;
  const nextNode = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      applyReadPrettyPattern(value),
    ]),
  ) as SchemaNode;

  if (typeof node["x-component"] === "string") {
    nextNode["x-pattern"] = "readPretty";
  }

  return nextNode;
}

type PreviewReactiveField = {
  visible?: boolean;
  display?: "visible" | "hidden" | "none";
  required?: boolean;
};

type PreviewFieldWithValues = PreviewReactiveField & {
  form: {
    values: Record<string, unknown>;
  };
};

const TRAINING_PROGRAM_CLASS = "training-program-card";
const GOVERNMENT_BOOK_MATERIAL_TYPE_ID = 17;
const BOOK_LIST_VISIBILITY_SERVICE_CODES = new Set([301]);
const BENEFICIARY_BOOK_LIST_MATERIAL_TYPE_IDS = new Set([4, 8, 17, 24]);
const COMPONENTS_WITH_INTERNAL_LABEL = new Set([
  "ProfileForm",
  "FilmTrailerForm",
  "PartnerList",
  "AddressList",
  "FilmingTeam",
]);

function shouldShowBookListUploadForMaterialTypes(
  formValues: Record<string, unknown> | null | undefined,
): boolean {
  const dataList = formValues?.dataList;
  if (!Array.isArray(dataList)) {
    return false;
  }

  return dataList.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const materialTypeId = Number(
      (item as { materialTypeId?: unknown }).materialTypeId,
    );
    return materialTypeId === GOVERNMENT_BOOK_MATERIAL_TYPE_ID;
  });
}

function shouldShowBookListUploadForService304(
  formValues: Record<string, unknown> | null | undefined,
): boolean {
  const beneficiaryTypeValue = formValues?.beneficiaryType;
  if (!beneficiaryTypeValue || typeof beneficiaryTypeValue !== "object") {
    return false;
  }

  const beneficiaryType = Number(
    (beneficiaryTypeValue as { beneficiaryType?: unknown }).beneficiaryType,
  );
  if (!Number.isFinite(beneficiaryType) || beneficiaryType === 4) {
    return false;
  }

  const materialList = (beneficiaryTypeValue as { materialList?: unknown }).materialList;
  if (!Array.isArray(materialList)) {
    return false;
  }

  return materialList.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const materialTypeId = Number(
      (item as { materialTypeId?: unknown }).materialTypeId,
    );
    return BENEFICIARY_BOOK_LIST_MATERIAL_TYPE_IDS.has(materialTypeId);
  });
}

function hasTrainingVideoField(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const current = node as SchemaNode;
  const componentProps =
    current["x-component-props"] &&
    typeof current["x-component-props"] === "object"
      ? (current["x-component-props"] as SchemaNode)
      : {};
  if (
    current.name === "TrainingVideoWatched" ||
    componentProps.uniqueValue === "TrainingVideoWatched"
  ) {
    return true;
  }
  return Object.values(current).some(hasTrainingVideoField);
}

function hasTrainingVideoNotice(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const current = node as SchemaNode;
  const componentProps =
    current["x-component-props"] &&
    typeof current["x-component-props"] === "object"
      ? (current["x-component-props"] as SchemaNode)
      : {};
  const text = String(componentProps.text ?? componentProps.textEn ?? "")
    .toLowerCase();

  if (
    current["x-component"] === "Information" &&
    text.includes("training program video")
  ) {
    return true;
  }

  return Object.values(current).some(hasTrainingVideoNotice);
}

function isTrainingVideoNode(key: string, node: unknown): node is SchemaNode {
  if (!node || typeof node !== "object") return false;
  const current = node as SchemaNode;
  const componentProps =
    current["x-component-props"] &&
    typeof current["x-component-props"] === "object"
      ? (current["x-component-props"] as SchemaNode)
      : {};

  return (
    key === "TrainingVideoWatched" ||
    current.name === "TrainingVideoWatched" ||
    componentProps.uniqueValue === "TrainingVideoWatched"
  );
}

function findTrainingVideoEntry(
  entries: Array<[string, unknown]>,
): [string, SchemaNode] | undefined {
  const explicitVideoEntry = entries.find(([key, value]) =>
    isTrainingVideoNode(key, value),
  );

  if (explicitVideoEntry && explicitVideoEntry[1] && typeof explicitVideoEntry[1] === "object") {
    return [explicitVideoEntry[0], explicitVideoEntry[1] as SchemaNode];
  }

  const videoEntries = entries.filter(([, value]) => {
    return (
      !!value &&
      typeof value === "object" &&
      (value as SchemaNode)["x-component"] === "Video"
    );
  });

  if (videoEntries.length !== 1) {
    return undefined;
  }

  return [videoEntries[0][0], videoEntries[0][1] as SchemaNode];
}

function mergeClassName(value: unknown, className: string): string {
  const classes = typeof value === "string" ? value.split(/\s+/) : [];
  return Array.from(new Set([...classes.filter(Boolean), className])).join(" ");
}

function hideVideoFieldLabels(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(hideVideoFieldLabels);
  }
  if (!node || typeof node !== "object") return node;

  const current = node as SchemaNode;
  const next: SchemaNode = {};
  Object.keys(current).forEach((key) => {
    next[key] = hideVideoFieldLabels(current[key]);
  });

  if (next["x-component"] === "Video") {
    next["x-decorator-props"] = {
      ...(next["x-decorator-props"] && typeof next["x-decorator-props"] === "object"
        ? (next["x-decorator-props"] as SchemaNode)
        : {}),
      colon: false,
      label: false,
    };
    delete next.title;
  }

  return next;
}

function hideComponentsWithInternalLabels(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(hideComponentsWithInternalLabels);
  }
  if (!node || typeof node !== "object") return node;

  const current = node as SchemaNode;
  const next: SchemaNode = {};
  Object.keys(current).forEach((key) => {
    next[key] = hideComponentsWithInternalLabels(current[key]);
  });

  if (
    typeof next["x-component"] === "string" &&
    COMPONENTS_WITH_INTERNAL_LABEL.has(next["x-component"])
  ) {
    next["x-decorator-props"] = {
      ...(next["x-decorator-props"] && typeof next["x-decorator-props"] === "object"
        ? (next["x-decorator-props"] as SchemaNode)
        : {}),
      colon: false,
      label: false,
    };
    delete next.title;
  }

  return next;
}

function groupTrainingVideoCardProperties(properties: SchemaNode): SchemaNode {
  const entries = Object.entries(properties);
  const cardEntry = entries.find(([, value]) => {
    return (
      !!value &&
      typeof value === "object" &&
      (value as SchemaNode)["x-component"] === "Card" &&
      hasTrainingVideoNotice(value)
    );
  });
  const videoEntry = findTrainingVideoEntry(entries);

  if (!cardEntry || !videoEntry) {
    return properties;
  }

  const [cardKey, cardValue] = cardEntry;
  const [videoKey, videoValue] = videoEntry;
  const cardNode = cardValue as SchemaNode;
  const cardProperties =
    cardNode.properties && typeof cardNode.properties === "object"
      ? (cardNode.properties as SchemaNode)
      : {};
  const nextProperties = { ...properties };

  nextProperties[cardKey] = normalizeTrainingVideoCardTitles({
    ...cardNode,
    properties: {
      ...cardProperties,
      [videoKey]: videoValue,
    },
  });
  delete nextProperties[videoKey];

  return nextProperties;
}

function normalizeTrainingVideoCardTitles(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(normalizeTrainingVideoCardTitles);
  }
  if (!node || typeof node !== "object") return node;

  const current = node as SchemaNode;
  const next: SchemaNode = {};
  Object.keys(current).forEach((key) => {
    next[key] = normalizeTrainingVideoCardTitles(current[key]);
  });

  if (next.properties && typeof next.properties === "object") {
    next.properties = groupTrainingVideoCardProperties(next.properties as SchemaNode);
  }

  const componentProps =
    next["x-component-props"] && typeof next["x-component-props"] === "object"
      ? (next["x-component-props"] as SchemaNode)
      : {};

  if (
    next["x-component"] === "Card" &&
    (hasTrainingVideoField(next) || hasTrainingVideoNotice(next))
  ) {
    next.properties = hideVideoFieldLabels(next.properties);
    next["x-component-props"] = {
      ...componentProps,
      className: mergeClassName(componentProps.className, TRAINING_PROGRAM_CLASS),
    };

  }

  return next;
}

export type DynamicFormMode = "designer" | "create-preview" | "review";

export interface FormliyViewProps {
  formData?: any;
  setFormInstance?: (form: any) => void;
  onValuesChange?: (values: any) => void;
  onUploadComplete?: (fileInfo: { name: string; fileType: number }) => void;
  onTotalFeeChange?: (fee: number) => void;
  disabled?: boolean;
  pattern?: "editable" | "disabled" | "readOnly" | "readPretty";
  serviceCode?: string | number | null;
  profileId?: string | number | null;
  applicationId?: number;
  applicationDetailId?: number;
  taskId?: string;
  materialStatusEditable?: boolean;
  reviewStepIndex?: number;
  onMaterialStatusStateChange?: (
    change: Service302MaterialStatusStateChange,
  ) => void;
  formMode?: DynamicFormMode;
  mobileNumberRuntimeConfig?: MobileNumberRuntimeConfigInput;
  service905OwnerPartners?: PartnerItem[];
  /** Supplies page-owned content to insertion points exposed by schema components. */
  renderSlot?: FormilyRenderSlot;
}

function FormliyView({
  formData,
  setFormInstance,
  onValuesChange,
  onUploadComplete,
  onTotalFeeChange,
  disabled = false,
  pattern,
  serviceCode: serviceCodeProp,
  profileId,
  applicationId,
  applicationDetailId,
  taskId,
  materialStatusEditable,
  reviewStepIndex,
  onMaterialStatusStateChange,
  formMode = "review",
  mobileNumberRuntimeConfig,
  service905OwnerPartners,
  renderSlot,
}: FormliyViewProps) {
  const { i18n } = useTranslation();
  const storedServiceCode = useServicesStore((state) => state.userInfo?.servicesCode);
  const serviceCode = serviceCodeProp ?? storedServiceCode;
  const uiLang: PortalFormLang = i18n.resolvedLanguage === "ar" ? "ar" : "en";
  const resolvedPattern = disabled ? "disabled" : (pattern ?? "editable");
  const resolvedMobileNumberRuntimeConfig = useMemo(
    () => ({
      defaultCountryCode:
        mobileNumberRuntimeConfig?.defaultCountryCode ??
        (formMode === "create-preview" ? DEFAULT_COUNTRY_DIAL_CODE : ""),
    }),
    [formMode, mobileNumberRuntimeConfig?.defaultCountryCode],
  );
  const onValuesChangeRef = useRef<FormliyViewProps["onValuesChange"]>();
  const onUploadCompleteRef = useRef<FormliyViewProps["onUploadComplete"]>();
  const onTotalFeeChangeRef = useRef<FormliyViewProps["onTotalFeeChange"]>();
  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  }, [onValuesChange]);
  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);
  useEffect(() => {
    onTotalFeeChangeRef.current = onTotalFeeChange;
  }, [onTotalFeeChange]);

  const parsedFormData = useMemo(() => {
    if (!formData || !formData.formData) return {};
    try {
      return JSON.parse(formData.formData) || {};
    } catch {
      return {};
    }
  }, [formData]);

  const initialValues = useMemo(
    () =>
      normalizeAdminReviewFormValues({
        schema: parsedFormData?.schema,
        formValues: parsedFormData?.formValues,
        modifyOriginalFormValues: parsedFormData?.modifyOriginalFormValues,
        serviceCode,
      }),
    [parsedFormData, serviceCode],
  );

  const form = useMemo(
    () =>
      createForm({
        initialValues,
        pattern: resolvedPattern,
        effects() {
          if (Number(serviceCode) === 1201 || Number(serviceCode) === 1204) {
            onFieldReact("OwnerApproval", (field) => {
              const selectedKeys = getSelectedActivityKeys(field.form.values);
              const hasReprint = selectedKeys.some((key) =>
                NEWSPAPER_REPRINT_ACTIVITY_CODES.has(key),
              );
              field.visible = hasReprint;
              field.display = hasReprint ? "visible" : "none";
              (field as typeof field & PreviewReactiveField).required =
                hasReprint;
            });

            onFieldReact("NewspaperMagazineUrl", (field) => {
              const selectedKeys = getSelectedActivityKeys(field.form.values);
              const hasElectronic = selectedKeys.includes("1020");
              field.visible = hasElectronic;
              field.display = hasElectronic ? "visible" : "none";
              (field as typeof field & PreviewReactiveField).required =
                hasElectronic;
            });

            onFieldReact("NewspaperOrMagzineDraft", (field) => {
              const selectedKeys = getSelectedActivityKeys(field.form.values);
              const shouldHide = selectedKeys.some((key) =>
                NEWSPAPER_MAGAZINE_DRAFT_HIDDEN_ACTIVITY_CODES.has(key),
              );
              field.visible = !shouldHide;
              field.display = shouldHide ? "none" : "visible";
            });
          }

          if (Number(serviceCode) === 1801) {
            onFieldReact("PermitStartDate", (field) => {
              const selectedKeys = getSelectedActivityKeys(field.form.values);
              const shouldShow = selectedKeys.some((key) =>
                PRESS_CARD_PERMIT_START_DATE_ACTIVITY_CODES.has(key),
              );
              const reactiveField = field as typeof field & PreviewReactiveField;

              reactiveField.visible = shouldShow;
              reactiveField.display = shouldShow ? "visible" : "none";
              reactiveField.required = shouldShow;
            });
          }

          if (Number(serviceCode) === SERVICE_302) {
            const syncService302Visibility = (
              fieldName: "bookListUpload" | "dataList",
              field: PreviewFieldWithValues,
            ) => {
              const selectValue = getService302SelectTableValue(
                field.form.values,
              );
              const hasBook = hasService302BookActivity(selectValue);
              const hasOther = hasService302OtherActivity(selectValue);
              const shouldShow = fieldName === "bookListUpload" ? hasBook : hasOther;

              field.visible = shouldShow;
              field.display = shouldShow ? "visible" : "none";
              field.required = shouldShow;
            };

            onFieldReact("bookListUpload", (field) => {
              syncService302Visibility(
                "bookListUpload",
                field as typeof field & PreviewReactiveField,
              );
            });

            onFieldReact("dataList", (field) => {
              syncService302Visibility(
                "dataList",
                field as typeof field & PreviewReactiveField,
              );
            });
          }

          if (BOOK_LIST_VISIBILITY_SERVICE_CODES.has(Number(serviceCode))) {
            onFieldReact("bookListUpload", (field) => {
              const shouldShow = shouldShowBookListUploadForMaterialTypes(
                (field as typeof field & PreviewFieldWithValues).form.values,
              );
              const reactiveField = field as typeof field & PreviewReactiveField;

              reactiveField.visible = shouldShow;
              reactiveField.display = shouldShow ? "visible" : "none";
              reactiveField.required = shouldShow;
            });
          }

          if (Number(serviceCode) === 304) {
            onFieldReact("bookListUpload", (field) => {
              const shouldShow = shouldShowBookListUploadForService304(
                (field as typeof field & PreviewFieldWithValues).form.values,
              );
              const reactiveField = field as typeof field & PreviewReactiveField;

              reactiveField.visible = shouldShow;
              reactiveField.display = shouldShow ? "visible" : "none";
              reactiveField.required = shouldShow;
            });
          }
        },
      }),
    [initialValues, resolvedPattern, serviceCode],
  );

  useEffect(() => {
    if (setFormInstance) {
      setFormInstance(form);
    }
  }, [form, setFormInstance]);

  useEffect(() => {
    if (form) {
      form.setPattern(resolvedPattern);
    }
  }, [form, resolvedPattern]);
  // const schema = JSON.parse(localStorage.getItem("formily-schema") || "{}");
  const [schemaData, setSchemaData] = useState<SchemaData>({
    form: {
      labelCol: 4,
      wrapperCol: 14,
    },
    schema: {},
  });
  const SchemaField = useMemo(
    () =>
      createSchemaField({
        components: {
          Input,
          DurationInput,
          FormItem: FormItemWithHtmlTooltip,
          DatePicker,
          Checkbox,
          Cascader,
          Editable,
          NumberPicker,
          Switch,
          Password,
          PreviewText,
          Radio,
          "Radio.Group": (props: any) => (
            <RadioGroupField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          Reset,
          Select,
          MultiDropdown,
          Space,
          Submit,
          TimePicker,
          Transfer,
          TreeSelect,
          Upload: (props: any) => (
            <UploadDom
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          MultiFile: MultiFileDom,
          DraftFileOrLink: DraftFileOrLinkField,
          FormGrid: RuntimeFormGrid,
          FormLayout,
          FormTab,
          FormCollapse,
          ArrayTable,
          ArrayCards,
          Card: PreviewCard,
          Slider,
          Rate,
          CountryDropdown: (props: any) => (
            <CountryDropdown
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          MobileNumberInput: (props: MobileNumberInputFieldProps) => (
            <MobileNumberInputField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          Information,
          SelectTable: (props: any) => (
            <SelectTableField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
            />
          ),
          SelectTableSingle: (props: any) => (
            <SelectTableSingleField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
            />
          ),
          AcquaintanceForm: (props: any) => (
            <AcquaintanceFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          LanguageSelect: (props: any) => (
            <LanguageSelect
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          LanguageSelectMulti: (props: any) => (
            <LanguageSelectMulti
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          IDSelector: (props: ComponentProps<typeof IDSelectorField>) => (
            <IDSelectorField {...props} serviceCode={serviceCode} />
          ),
          PublicationForm: (props: any) => (
            <PublicationFormField
              {...props}
              profileId={profileId}
              serviceCode={serviceCode}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          AddressList: FilmingLocationsField,
          DataForm: (props: Record<string, unknown>) => (
            <DataFormField
              {...props}
              disabled={
                resolvedPattern !== "editable" || Boolean(props.disabled)
              }
            />
          ),
          UrlList: FilmsUrlsListField,
          BookList: (props: any) => (
            <BookListUploadField {...props} serviceCode={serviceCode} />
          ),
          FileUploadGrid: FileUploadGridField,
          ScriptPublicationForm: (props: any) => (
            <ScriptPublicationFormField
              {...props}
              profileId={profileId}
              serviceCode={serviceCode}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          SocialMediaAccount: (props: Record<string, unknown>) => (
            <SocialMediaAccountField
              {...props}
              disabled={
                resolvedPattern !== "editable" || Boolean(props.disabled)
              }
              serviceCode={serviceCode}
            />
          ),
          EmiratePort: (props: any) => (
            <EmiratePort
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          DataList: (props: any) => (
            <DataListInner
              {...props}
              serviceCode={serviceCode}
              applicationId={applicationId}
              applicationDetailId={applicationDetailId}
              taskId={taskId}
              materialStatusEditable={materialStatusEditable}
              reviewStepIndex={reviewStepIndex}
              onMaterialStatusStateChange={onMaterialStatusStateChange}
            />
          ),
         
          PersonsInChargeList: PersonsInChargeListField,
          EquipmentList: (props: Record<string, unknown>) => (
            <EquipmentListInner
              {...props}
              disabled={
                resolvedPattern !== "editable" || Boolean(props.disabled)
              }
            />
          ),
          PartnerList: (props: any) => (
            <PartnerListField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
              service905OwnerPartners={service905OwnerPartners}
            />
          ),
          GameDistributionForm: (props: any) => (
            <GameDistributionFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          FilmRescreeningForm: (props: any) => (
            <FilmRescreeningFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              profileId={profileId}
              serviceCode={serviceCode}
            />
          ),
          FilmScreeningForm: (props: any) => (
            <FilmScreeningFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
            />
          ),
          FilmTrailerForm: (props: any) => (
            <FilmTrailerFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          ProfileForm:
            resolvedPattern !== "editable"
              ? ProfileFormReviewField
              : (props: {
                  disabled?: boolean;
                  [key: string]: unknown;
                }) => (
                  <ProfileFormField
                    {...props}
                    disabled={
                      resolvedPattern !== "editable" || props?.disabled
                    }
                  />
                ),
          LicenseTransferForm: (props: {
            disabled?: boolean;
            [key: string]: unknown;
          }) => (
            <LicenseTransferFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          LicenseInformationForm: LicenseInformationFormField,
          TransferInformation: (props: Record<string, unknown>) => (
            <TransferInformationField
              {...props}
              disabled={
                resolvedPattern !== "editable" || Boolean(props.disabled)
              }
            />
          ),
          FilmingTeam: (props: any) => (
            <MemberListField
              {...props}
              serviceCode={serviceCode}
              applicationId={applicationId}
            />
          ),
          BookTradingForm: (props: any) => (
            <BookTradingFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
            />
          ),
          Divider,
          SocialMediaManager: (props: Record<string, unknown>) => (
            <SocialMediaManagerField
              {...props}
              disabled={
                resolvedPattern !== "editable" || Boolean(props.disabled)
              }
            />
          ),
          AddressPicker,
          FilmingPurposeForm: (props: any) => (
            <FilmingPurposeFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
            />
          ),
          VideoGamePackageForm: (props: any) => (
            <VideoGamePackageFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          Video: VideoField,
          TradeLicenseDetails: (props: Record<string, unknown>) => (
            <TradeLicenseDetailsField
              {...props}
              disabled={
                resolvedPattern !== "editable" || Boolean(props.disabled)
              }
            />
          ),
          GuardianConsentDetails: (props: any) => (
            <GuardianConsentDetailsField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
            />
          ),
          MoviePackageForm: (props: any) => (
            <MoviePackageFormField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          NewpaperMagazineCirculation: (props: any) => (
            <NewpaperMagazineCirculationField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
              serviceCode={serviceCode}
            />
          ),
           BeneficiaryType: (props: any) => (
            <BeneficiaryTypeField
              {...props}
              disabled={resolvedPattern !== "editable" || props?.disabled}
            />
          ),
          PosterAndTrailerPermit: PosterAndTrailerPermitField,
          PressCardSelector: (props: Record<string, unknown>) => (
            <PressCardSelectorInner
              {...props}
              disabled={
                resolvedPattern !== "editable" || Boolean(props.disabled)
              }
            />
          ),
        },
      }),
    [
      applicationDetailId,
      applicationId,
      materialStatusEditable,
      onMaterialStatusStateChange,
      profileId,
      resolvedPattern,
      reviewStepIndex,
      service905OwnerPartners,
      serviceCode,
      taskId,
    ],
  );
  useEffect(() => {
    if (!formData || !formData.formData) {
      setSchemaData({
        form: {
          labelCol: 4,
          wrapperCol: 14,
        },
        schema: {},
      });
      return;
    }

    // const Moss = JSON.parse(localStorage.getItem("formily-schema") || "{}");
    const Moss = formData;
    // apply saved values for this step
    if (parsedFormData.formValues) {
      form.setValues(initialValues);
      form.reset(); // reset validation state
    } else {
      form.setValues({});
      form.reset();
    }
    try {
      const parsed = JSON.parse(Moss.formData) || {};
      const normalizedSchema = withPersonalPhotoTooltip(
        hideComponentsWithInternalLabels(
          normalizeTrainingVideoCardTitles(parsed.schema),
        ),
        PERSONAL_PHOTO_TOOLTIP_SERVICE_CODES.has(Number(serviceCode)),
      );
      setSchemaData({
        ...parsed,
        schema:
          resolvedPattern === "readPretty"
            ? (applyReadPrettyPattern(normalizedSchema) as object)
            : (normalizedSchema as object),
      });
    } catch (e) {
      console.error("Failed to parse formData:", e);
      setSchemaData({
        form: {
          labelCol: 4,
          wrapperCol: 14,
        },
        schema: {},
      });
    }
  }, [
    formData,
    form,
    initialValues,
    parsedFormData,
    resolvedPattern,
    serviceCode,
  ]);
  return (
    <FormilyRenderSlotProvider renderSlot={renderSlot}>
      <FormLanguageProvider
        uiLang={uiLang}
        contentLang={uiLang}
        host="runtime"
      >
        <MobileNumberRuntimeProvider config={resolvedMobileNumberRuntimeConfig}>
          <ConfigProvider
            direction={uiLang === "ar" ? "rtl" : "ltr"}
            locale={getAntdLocale(uiLang)}
          >
            <div className="FormliyView">
              <div
                style={{
                  boxSizing: "border-box",
                }}
                className="antformbody hide-scrollbar"
              >
                <Form
                  form={form}
                  layout="vertical"
                  labelCol={schemaData.form?.labelCol}
                  wrapperCol={schemaData.form?.wrapperCol}
                >
                  <SchemaField schema={schemaData.schema}></SchemaField>
                </Form>
              </div>
            </div>
          </ConfigProvider>
        </MobileNumberRuntimeProvider>
      </FormLanguageProvider>
    </FormilyRenderSlotProvider>
  );
}

export default FormliyView;
