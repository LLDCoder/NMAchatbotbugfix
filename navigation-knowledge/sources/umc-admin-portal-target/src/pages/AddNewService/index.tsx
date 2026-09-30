import React, {
  Suspense,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import { Card, Form, Modal, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import request from "@/utils/request";
import {
  CustomButton,
  StepTabsHeader,
  StepTabsContent,
  CustomMessage,
  ConfirmModal,
} from "@/components/common";
import { KEEP_ALIVE_RESTORE_STATE_KEY } from "@/components/KeepAlive/constants";
import type { TabItem } from "@/components/common";
import ServiceStepIcon from "@/components/common/CustomStepTabs/ServiceStepIcon";
import Edit2 from "@/assets/icons/Edit2";
import Text from "@/assets/icons/Text";
import "./index.less";
import {
  addService,
  getAllServices,
  getServiceById,
  addServiceCertificate,
  getServiceEngineConfig,
  getServicePublishReadiness,
  getPrePublishTestAccount,
  updateServiceStatus,
  getTypeDictionaries,
  updateService,
  putSerivceCertificate,
  getMainHaveChildren,
  type TypeDictionary,
  type ServiceEngineConfig,
  type ServicePublishReadinessResponse,
  AddFormStep,
  getFormStepList,
  ServiceSaveForm,
  saveServiceRule,
} from "@/services/serviceApi";
import type {
  AddServiceParams,
  AddServiceResponse,
  UpdateServiceResponese,
  UpdateServiceParams,
} from "@/services/serviceApi";
import ServicesInformation from "./components/ServicesInformation";
import CertificateConfiguration from "./components/CertificateConfiguration";
import type { ICertificateConfigurationRefProps } from "./components/CertificateConfiguration";
import RuleConfiguration from "./components/RuleConfiguration";
import type {
  RuleConfigurationRef,
  RuleConfigurationSaveOptions,
  RuleConfigurationSaveResult,
} from "./components/RuleConfiguration";
import {
  PrePublishModal,
  PublishingModal,
  PublishModal,
  SuccessModal,
} from "./components/PublishModals";
import ProcessDesign from "@/components/common/ProcessDesign";
import type { IProcessDesignRef } from "@/components/common/ProcessDesign";
import { useServiceStore } from "@/store/service-store";
import type Playground from "@/components/designable/playground/main";
import { loadDesignablePlaygroundModule } from "@/components/designable/playground/preload";
import { resetStoredDesignerContentLang } from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import EventEmiiter from "@/utils/EventEmiiter";
import { useUserStore } from "@/store/user";
import WarningGold from "@/assets/icons/WarningGold";
import type { AxiosResponse } from "axios";
import clamp2 from "@/utils/clamp2";
import WG from "@/assets/images/warning-gold.png";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

type DesignablePlayProps = React.ComponentPropsWithoutRef<typeof Playground>;
type DesignablePlayRef = React.ElementRef<typeof Playground>;
// Set to true to let the page own scrolling; false keeps the designer canvas scrollbar.
const FORM_DESIGNER_USE_PAGE_SCROLL = false;

type ServiceCertificateRecord = {
  id?: unknown;
  templateId?: unknown;
  nameEn?: unknown;
  nameAr?: unknown;
  validityPeriod?: unknown;
  isUnifiedExpiry?: unknown;
  [key: string]: unknown;
};

interface AddNewServiceLocationState {
  backPath?: string;
  backSearch?: string;
  backState?: Record<string, unknown>;
}

type StepKey = "1" | "2" | "3" | "4" | "5";

type StepDirtyMap = Record<StepKey, boolean>;
type AddServiceCertificatePayload = Parameters<typeof addServiceCertificate>[0];
type UpdateServiceCertificatePayload = Parameters<typeof putSerivceCertificate>[0];
const CERTIFICATE_FORM_FIELD_NAMES = [
  "templateId",
  "cNameEn",
  "cNameAr",
  "validityPeriod",
  "certificateField1",
  "certificateField2",
  "formField1",
  "formField2",
] as const;

const getNormalizedOptionalText = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const getPrePublishTestAccountEmail = (response: unknown) => {
  if (!response || typeof response !== "object") {
    return "";
  }

  const payload = response as {
    testAccountEmail?: unknown;
    data?: { testAccountEmail?: unknown } | null;
  };

  return getNormalizedOptionalText(
    payload.testAccountEmail ?? payload.data?.testAccountEmail,
  );
};

const getCustomerPortalMediaLicenseUrl = (
  serviceId: unknown,
  serviceCode: unknown,
) => {
  if (typeof window === "undefined") {
    return "";
  }

  const normalizedServiceId = getNormalizedOptionalText(serviceId);
  const normalizedServiceCode = getNormalizedOptionalText(serviceCode);
  if (!normalizedServiceId || !normalizedServiceCode) {
    return "";
  }

  const accessPath = `/services/media-license?${new URLSearchParams({
    serviceId: normalizedServiceId,
    serviceCode: normalizedServiceCode,
  }).toString()}`;

  if (import.meta.env.DEV && window.location.origin === "http://localhost:5173") {
    return new URL(accessPath, "http://localhost:5174").toString();
  }

  const configuredCustomerPortalUrl = String(
    import.meta.env.VITE_CUSTOMER_PORTAL_URL ?? "",
  ).trim();
  if (!configuredCustomerPortalUrl) {
    return "";
  }

  try {
    return new URL(accessPath, configuredCustomerPortalUrl).toString();
  } catch {
    return "";
  }
};

const getCertificatePayloadValue = (value: unknown) =>
  value === undefined || value === null ? "" : value;

const getCertificateFormPayload = (values: Record<string, unknown>) => {
  const params = CERTIFICATE_FORM_FIELD_NAMES.reduce<Record<string, unknown>>(
    (acc, fieldName) => {
      acc[fieldName] = getCertificatePayloadValue(values[fieldName]);
      return acc;
    },
    {},
  );

  params["nameEn"] = params["cNameEn"] || "";
  params["nameAr"] = params["cNameAr"] || "";

  // templateId is an int on the backend, so an empty string breaks JSON model
  // binding (400). Send a number when a template is selected, otherwise drop
  // the field (auto-generate mode has no template and the backend accepts null).
  const templateId = Number(params["templateId"]);
  if (Number.isInteger(templateId) && templateId > 0) {
    params["templateId"] = templateId;
  } else {
    delete params["templateId"];
  }

  return params;
};

const normalizeCertificateUnifiedExpiry = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === "false" || normalizedValue === "0") {
      return false;
    }
    if (normalizedValue === "true" || normalizedValue === "1") {
      return true;
    }
  }

  return true;
};

const getServiceInfoTextValue = (
  source: Partial<{
    serviceFeeEn?: unknown;
    serviceFeeAr?: unknown;
    serviceFee?: unknown;
    feeDescriptionEn?: unknown;
    feeDescriptionAr?: unknown;
    serviceDeliveryTime?: unknown;
    serviceDeliveryTimeEn?: unknown;
    serviceDeliveryTimeAr?: unknown;
    deliveryTimeEn?: unknown;
    deliveryTimeAr?: unknown;
    termsAndConditions?: unknown;
    termsAndConditionsEn?: unknown;
    termsAndConditionsAr?: unknown;
    feeDescription?: unknown;
    deliveryTime?: unknown;
    termsConditions?: unknown;
    termsConditionsEn?: unknown;
    termsConditionsAr?: unknown;
  }> | null | undefined,
  keys: string[],
) => {
  if (!source) {
    return "";
  }

  for (const key of keys) {
    const value = source[key as keyof typeof source];
    if (value === null || value === undefined) {
      continue;
    }

    const normalizedValue = String(value).trim();
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
};

const getServiceCertificates = (
  data?: {
    serivceCertificates?: ServiceCertificateRecord[];
    serivceCertificateDtos?: ServiceCertificateRecord[];
  } | null,
): ServiceCertificateRecord[] => {
  const certificates = Array.isArray(data?.serivceCertificates)
    ? data.serivceCertificates.filter(Boolean)
    : [];
  const certificateDtos = Array.isArray(data?.serivceCertificateDtos)
    ? data.serivceCertificateDtos.filter(Boolean)
    : [];

  return certificates.length ? certificates : certificateDtos;
};

const hasCertificateConfiguration = (
  data?: {
    serivceCertificates?: ServiceCertificateRecord[];
    serivceCertificateDtos?: ServiceCertificateRecord[];
  } | null,
) =>
  getServiceCertificates(data).some(
    (item) => item?.id || item?.templateId || item?.nameEn || item?.nameAr,
  );

const getServiceInfoTextPayload = (
  values: Partial<{
    serviceFeeEn?: unknown;
    serviceFeeAr?: unknown;
    serviceDeliveryTimeEn?: unknown;
    serviceDeliveryTimeAr?: unknown;
    termsConditionsEn?: unknown;
    termsConditionsAr?: unknown;
  }>,
) => {
  const serviceFeeEn = getNormalizedOptionalText(values.serviceFeeEn);
  const serviceFeeAr = getNormalizedOptionalText(values.serviceFeeAr);
  const serviceDeliveryTimeEn = getNormalizedOptionalText(
    values.serviceDeliveryTimeEn,
  );
  const serviceDeliveryTimeAr = getNormalizedOptionalText(
    values.serviceDeliveryTimeAr,
  );
  const termsConditionsEn = getNormalizedOptionalText(
    values.termsConditionsEn,
  );
  const termsConditionsAr = getNormalizedOptionalText(
    values.termsConditionsAr,
  );

  return {
    serviceFeeEn,
    serviceFeeAr,
    serviceDeliveryTimeEn,
    serviceDeliveryTimeAr,
    termsConditionsEn,
    termsConditionsAr,
  };
};

const createInitialStepDirtyMap = (): StepDirtyMap => ({
  "1": false,
  "2": false,
  "3": false,
  "4": false,
  "5": false,
});

const isStepKey = (value: string): value is StepKey =>
  value === "1" ||
  value === "2" ||
  value === "3" ||
  value === "4" ||
  value === "5";

const LazyPlayInner = lazyWithRetry(loadDesignablePlaygroundModule);

const LazyPlay = React.forwardRef<DesignablePlayRef, DesignablePlayProps>(
  (props, ref) =>
    React.createElement(
      LazyPlayInner as unknown as React.ComponentType<
        DesignablePlayProps & React.RefAttributes<DesignablePlayRef>
      >,
      {
        ...props,
        ref,
      },
    ),
);

LazyPlay.displayName = "LazyPlay";

function DesignableLoadingFallback() {
  return (
    <div className="playground-loading">
      <Spin size="large" />
    </div>
  );
}

export default function AddNewService() {
  const { t } = useTranslation();
  const location = useLocation<AddNewServiceLocationState>();
  const [, update] = useState({});
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("1");
  const [loading, setLoading] = useState(false);
  const [isPrePublished, setIsPrePublished] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [, setCurrentServiceId] = useState<number | null>(null);
  const processDesignRef = React.useRef<IProcessDesignRef>(null);
  const certificateConfigurationRef =
    React.useRef<ICertificateConfigurationRefProps>(null);
  const ruleConfigurationRef = useRef<RuleConfigurationRef>(null);
  const [processLoading, setProcessLoading] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [leaveConfirmLoading, setLeaveConfirmLoading] = useState(false);
  const [stepDirtyMap, setStepDirtyMap] = useState<StepDirtyMap>(
    createInitialStepDirtyMap,
  );
  const setData = useServiceStore((state) => state.setData);
  const serviceData = useServiceStore((state) => state.serviceData);
  const resetSerivceData = useServiceStore((state) => state.resetSerivceData);
  const [prePublishModalVisible, setPrePublishModalVisible] = useState(false);
  const [prePublishTestAccount, setPrePublishTestAccount] = useState("");
  const [prePublishTestAccountLoading, setPrePublishTestAccountLoading] =
    useState(false);
  const [publishingModalVisible, setPublishingModalVisible] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);

  const [rulePrePublishReady, setRulePrePublishReady] = useState(false);
  const watchedServiceCode = Form.useWatch("code", form);
  const watchedUserType = Form.useWatch("userType", form);
  const currentServiceCode = String(
    watchedServiceCode ?? serviceData.serviceCode ?? "",
  ).trim();
  const hasServiceCode = Boolean(
    currentServiceCode,
  );
  const [successType, setSuccessType] = useState<
    "pre-publish" | "publish" | null
  >(null);
  const history = useHistory();
  const statusRef = useRef<TypeDictionary[] | null>(null);
  const [completedList, setCompletedList] = useState<string[]>([]);
  const userInfo = useUserStore((state) => state.userInfo);
  const allowNextNavigationRef = useRef(false);
  const searchParams = new URLSearchParams(location.search);
  const serviceIdFromUrl =
    getNormalizedOptionalText(searchParams.get("id")) ||
    getNormalizedOptionalText(searchParams.get("serviceId"));
  const serviceCodeFromUrl = String(
    searchParams.get("serviceCode") ?? "",
  ).trim();
  const customerPortalMediaLicenseUrl = getCustomerPortalMediaLicenseUrl(
    serviceIdFromUrl,
    serviceCodeFromUrl,
  );
  const pageType = (searchParams.get("type") || "").toLowerCase();
  const isDuplicateMode = pageType === "duplicate";
  const viewParam =
    searchParams.get("view") ??
    searchParams.get("isView") ??
    searchParams.get("isVie") ??
    "";
  const isView = ["1", "true"].includes(viewParam.toLowerCase());
  const from = searchParams.get("from");
  const duplicateSourceIdRef = useRef<number | null>(null);
  const duplicateSourceSnapshotRef = useRef<any>(null);
  const defaultBackState = {
    [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
  };
  const resetStepDirtyState = useCallback(() => {
    setStepDirtyMap(createInitialStepDirtyMap());
  }, []);
  const markStepDirty = useCallback((stepKey: StepKey, dirty: boolean) => {
    setStepDirtyMap((previous) => {
      if (previous[stepKey] === dirty) {
        return previous;
      }

      return {
        ...previous,
        [stepKey]: dirty,
      };
    });
  }, []);
  const navigateToServiceConfiguration = useCallback(() => {
    const state = location.state;
    const resolvedBackPath =
      typeof state?.backPath === "string" && state.backPath.trim()
        ? state.backPath.trim()
        : "/service-management/service-configuration";
    const resolvedBackSearch =
      typeof state?.backSearch === "string" ? state.backSearch : "";
    const resolvedBackState =
      state?.backState && typeof state.backState === "object"
        ? state.backState
        : resolvedBackPath === "/service-management/service-configuration"
          ? defaultBackState
          : undefined;

    history.push({
      pathname: resolvedBackPath,
      search: resolvedBackSearch,
      state: resolvedBackState,
    });
  }, [history, location.state]);
  const currentStepKey = isStepKey(activeTab) ? activeTab : "1";
  const isCurrentStepDirty = stepDirtyMap[currentStepKey] === true;
  const [currentServiceCertificate] = Array.isArray(
    serviceData.serivceCertificates,
  )
    ? (serviceData.serivceCertificates.filter(
        Boolean,
      ) as ServiceCertificateRecord[])
    : [];
  const certificateUnifiedExpiry = normalizeCertificateUnifiedExpiry(
    currentServiceCertificate?.isUnifiedExpiry,
  );
  const isCertificateConfigurationCompleted = useCallback(
    (steps: string[]) => steps.includes("4"),
    [],
  );

  const canPublishRuleConfiguration = useCallback(
    (readiness?: ServicePublishReadinessResponse | null) =>
      readiness?.canPublish === true,
    [],
  );

  const isRuleConfigurationLocallyConfigured = useCallback(
    (config?: ServiceEngineConfig | null) => {
      if (!config) {
        return false;
      }

      const businessEnabled = Boolean(
        config.businessRule?.enabled ?? config.ruleEnabled,
      );
      const businessVersion = String(
        config.businessRule?.version ?? config.ruleVersion ?? "",
      ).trim();
      const pricingSource = String(
        config.pricingRule?.source ?? (config.feeEnabled ? "engine" : "manual"),
      );
      const feeEngineVersion = String(
        config.pricingRule?.feeEngineVersion ?? config.feeVersion ?? "",
      ).trim();
      const manualPricingType = String(
        config.pricingRule?.manualPricingType ?? "free",
      );
      const manualPricingDetails = Array.isArray(config.pricingRule?.details)
        ? config.pricingRule?.details || []
        : [];
      const penaltyEnabled = Boolean(
        config.penaltyRule?.enabled ?? config.penaltyEnabled,
      );
      const penaltyVersion = String(
        config.penaltyRule?.version ?? config.penaltyVersion ?? "",
      ).trim();

      const businessConfigured = !businessEnabled || Boolean(businessVersion);
      const pricingConfigured =
        pricingSource === "engine"
          ? Boolean(feeEngineVersion)
          : manualPricingType === "free" || manualPricingDetails.length > 0;
      const penaltyConfigured = !penaltyEnabled || Boolean(penaltyVersion);

      return businessConfigured && pricingConfigured && penaltyConfigured;
    },
    [],
  );

  const isRuleConfigurationCompleted = useCallback(
    (
      readiness: ServicePublishReadinessResponse | null | undefined,
      fallback = false,
    ) => {
      return canPublishRuleConfiguration(readiness) || fallback;
    },
    [canPublishRuleConfiguration],
  );

  const getRuleBlockingReasonMessage = useCallback(
    (readiness?: ServicePublishReadinessResponse | null) => {
      const reasons = [
        ...(readiness?.blockingReasons || []),
        ...(readiness?.ruleEngine?.blockingReasons || []),
        ...(readiness?.feeEngine?.blockingReasons || []),
        ...(readiness?.penaltyEngine?.blockingReasons || []),
      ].filter(Boolean);

      return reasons.length
        ? reasons.join("\n")
        : t("addNewService.ruleConfiguration.messages.notReadyToPublish");
    },
    [t],
  );

  const handleRuleSaved = useCallback(
    (
      saveResult: RuleConfigurationSaveResult | null,
      meta?: { fromSave?: boolean },
    ) => {
      const rulePublishReady = canPublishRuleConfiguration(saveResult?.readiness);

      setCompletedList((previous) => {
        const certificateConfigured =
          isCertificateConfigurationCompleted(previous);

        setRulePrePublishReady(certificateConfigured && rulePublishReady);

        if (!meta?.fromSave) {
          return previous;
        }

        const ruleConfigured =
          saveResult?.requiredRulesConfigured === true ||
          canPublishRuleConfiguration(saveResult?.readiness);
        const shouldCompleteRule = ruleConfigured && certificateConfigured;
        const hasRuleCompleted = previous.includes("5");

        if (shouldCompleteRule === hasRuleCompleted) {
          return previous;
        }

        const next = new Set(previous);
        if (shouldCompleteRule) {
          next.add("5");
        } else {
          next.delete("5");
        }
        return Array.from(next);
      });
    },
    [canPublishRuleConfiguration, isCertificateConfigurationCompleted],
  );

  const handleRuleDirtyChange = useCallback(
    (dirty: boolean) => {
      markStepDirty("5", dirty);
      if (dirty) {
        setRulePrePublishReady(false);
      }
    },
    [markStepDirty],
  );

  const buildDuplicatedWorkflowBpmnJson = (params: {
    bpmnJson: string;
    processDefinitionKey: string;
    workflowNameEn: string;
  }) => {
    const { bpmnJson, processDefinitionKey, workflowNameEn } = params;
    try {
      const parsed = JSON.parse(bpmnJson);
      const definitions = parsed?.definitions;
      const process = definitions?.process;
      if (process && typeof process === "object") {
        process.id = processDefinitionKey;
        process.name = workflowNameEn;
        process.documentation = workflowNameEn;
      }
      if (definitions && typeof definitions === "object") {
        definitions.name = workflowNameEn;
      }
      return JSON.stringify(parsed);
    } catch {
      return bpmnJson;
    }
  };

  const syncServiceParamsToUrl = (
    nextCode: string,
    nextServiceId?: string | number | null,
  ) => {
    const normalizedServiceCode = String(nextCode ?? "").trim();
    const normalizedServiceId = String(nextServiceId ?? "").trim();

    if (!normalizedServiceCode && !normalizedServiceId) return;

    const params = new URLSearchParams(location.search);
    const currentServiceCode = String(params.get("serviceCode") ?? "").trim();
    const currentServiceId = String(
      params.get("id") || params.get("serviceId") || "",
    ).trim();

    if (
      currentServiceCode === normalizedServiceCode &&
      (!normalizedServiceId || currentServiceId === normalizedServiceId)
    ) {
      return;
    }

    if (normalizedServiceCode) {
      params.set("serviceCode", normalizedServiceCode);
    }
    if (normalizedServiceId) {
      params.set("id", normalizedServiceId);
    }
    history.replace({
      pathname: location.pathname,
      search: params.toString(),
      state: location.state,
    });
  };
  const [mode, setMode] = useState<{
    serviceInfo: string;
    serivceCertificate: string;
  }>({
    serviceInfo: from ?? "edit",
    serivceCertificate: from ?? "edit",
  });
  const [serviceNameDiv, setServiceNameDiv] = useState<HTMLDivElement | null>(
    null,
  );
  const [serviceConflictModalItem, setServiceConflictModalItem] = useState<{
    nameAr: string;
    nameEn: string;
    typeInfo: {
      nameAr: string;
      nameEn: string;
    };
  } | null>();
  useEffect(() => {
    return () => {
      allowNextNavigationRef.current = false;
      resetSerivceData();
      resetStoredDesignerContentLang();
    };
  }, [resetSerivceData]);

  const resolveServiceIdByCode = useCallback(
    async (serviceCode: string) => {
      const normalizedServiceCode = String(serviceCode ?? "").trim();

      if (!normalizedServiceCode) {
        return null;
      }

      try {
        const response = await getAllServices({
          pageIndex: 1,
          pageSize: 100,
          search: normalizedServiceCode,
        });
        const responseData: any = response?.data?.data || response?.data || {};
        const serviceItems = Array.isArray(responseData.items)
          ? responseData.items
          : [];

        for (const item of serviceItems) {
          const currentItemCode = String(item?.code ?? "").trim();
          if (currentItemCode === normalizedServiceCode && item?.id) {
            return String(item.id);
          }

          const childServices = Array.isArray(item?.serviceChildrens)
            ? item.serviceChildrens
            : [];
          const matchedChild = childServices.find(
            (child: any) =>
              String(child?.code ?? "").trim() === normalizedServiceCode &&
              child?.id,
          );

          if (matchedChild?.id) {
            return String(matchedChild.id);
          }
        }

        return null;
      } catch (error) {
        console.error("Failed to resolve service id by code:", error);
        return null;
      }
    },
    [],
  );

  async function init() {
    if (serviceIdFromUrl) {
      setIsEditMode(!isDuplicateMode);
      // const activeKey = sessionStorage.getItem(
      //   `service-active-${userInfo?.id}-${serviceCode}`,
      // );
      // if (activeKey) {
      //   setActiveTab(activeKey);
      // }
      duplicateSourceIdRef.current = isDuplicateMode
        ? Number(serviceIdFromUrl)
        : null;
      await loadServiceData(serviceIdFromUrl, false, {
        isDuplicate: isDuplicateMode,
      });
      return;
    }

    if (!serviceCodeFromUrl) {
      return;
    }

    setIsEditMode(!isDuplicateMode);

    let shouldResetLoading = true;
    try {
      setLoading(true);
      const resolvedServiceId = await resolveServiceIdByCode(serviceCodeFromUrl);

      if (!resolvedServiceId) {
        CustomMessage.error(
          t("addNewService.messages.loadFailed"),
        );
        return;
      }

      const nextParams = new URLSearchParams(location.search);
      nextParams.set("id", resolvedServiceId);
      nextParams.set("serviceCode", serviceCodeFromUrl);
      shouldResetLoading = false;
      history.replace({
        pathname: location.pathname,
        search: nextParams.toString(),
        state: location.state,
      });
    } catch (error) {
      console.error("Failed to initialize service data:", error);
      CustomMessage.error(
        t("addNewService.messages.loadFailed"),
      );
    } finally {
      if (shouldResetLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    init();
  }, [location.search]);

  useEffect(() => {
    getTypeDictionaries("ServiceConfigStatus").then((res) => {
      statusRef.current = res.data;
    });
  }, []);

  const loadServiceData = async (
    serviceId: string | number,
    isParentService?: boolean,
    options?: {
      isDuplicate?: boolean;
      evaluateRuleStepCompletion?: boolean;
    },
  ) => {
    try {
      setLoading(true);
      const response = await getServiceById(serviceId);

      const data = response.data || response;
      const isDuplicate = Boolean(options?.isDuplicate);
      if (isDuplicate) {
        duplicateSourceSnapshotRef.current = data;
      }

      const serviceStatus = String(data.status ?? "");
      const isPrePublished = serviceStatus === "4";
      const isPublish = serviceStatus === "5";
      setIsPrePublished(isPrePublished);
      setSuccessType(
        isPrePublished ? "pre-publish" : isPublish ? "publish" : successType,
      );

      if (data) {
        setLeaveConfirmVisible(false);
        setLeaveConfirmLoading(false);
        resetStepDirtyState();
        setCurrentServiceId(isDuplicate ? null : data.id);
        const certificates = getServiceCertificates(data);
        const [certificate] = certificates;
        // Save to localStorage
        const sdata: any = {
          serviceName: i18n.resolvedLanguage === "ar" ? data.nameAr : data.nameEn,
          nameEn: data.nameEn,
          nameAr: data.nameAr,
          serviceCategoryId: data.serviceCategoryId,
          department: data.department,
          scopes: data.scope || "",
          serviceFeeEn: getServiceInfoTextValue(data, [
            "serviceFeeEn",
            "serviceFee",
            "feeDescriptionEn",
            "feeDescription",
          ]),
          serviceFeeAr: getServiceInfoTextValue(data, [
            "serviceFeeAr",
            "feeDescriptionAr",
          ]),
          serviceDeliveryTimeEn: getServiceInfoTextValue(data, [
            "serviceDeliveryTimeEn",
            "serviceDeliveryTime",
            "deliveryTimeEn",
            "deliveryTime",
          ]),
          serviceDeliveryTimeAr: getServiceInfoTextValue(data, [
            "serviceDeliveryTimeAr",
            "deliveryTimeAr",
          ]),
          termsConditionsEn: getServiceInfoTextValue(data, [
            "termsConditionsEn",
            "termsAndConditionsEn",
            "termsAndConditions",
            "termsConditions",
          ]),
          termsConditionsAr: getServiceInfoTextValue(data, [
            "termsConditionsAr",
            "termsAndConditionsAr",
          ]),
          userType: data.userType || "",
          isLoginRequired: data.isLoginRequired,
          status: data.status,
          loadedAt: new Date().toISOString(),
          workflowConfigurations: data.workflowConfigurations || [],
          serivceCertificates: certificates,
          templateId: certificate?.templateId,
          createdAt: data.createAt,
        };
        const values: any = {
          nameEn: data.nameEn,
          nameAr: data.nameAr,
          serviceCategoryId: String(data.serviceCategoryId),
          serviceDescriptionEn: data.serviceDescriptionEn,
          serviceDescriptionAr: data.serviceDescriptionAr,
          serviceFeeEn: getServiceInfoTextValue(data, [
            "serviceFeeEn",
            "serviceFee",
            "feeDescriptionEn",
            "feeDescription",
          ]),
          serviceFeeAr: getServiceInfoTextValue(data, [
            "serviceFeeAr",
            "feeDescriptionAr",
          ]),
          serviceDeliveryTimeEn: getServiceInfoTextValue(data, [
            "serviceDeliveryTimeEn",
            "serviceDeliveryTime",
            "deliveryTimeEn",
            "deliveryTime",
          ]),
          serviceDeliveryTimeAr: getServiceInfoTextValue(data, [
            "serviceDeliveryTimeAr",
            "deliveryTimeAr",
          ]),
          termsConditionsEn: getServiceInfoTextValue(data, [
            "termsConditionsEn",
            "termsAndConditionsEn",
            "termsAndConditions",
            "termsConditions",
          ]),
          termsConditionsAr: getServiceInfoTextValue(data, [
            "termsConditionsAr",
            "termsAndConditionsAr",
          ]),
          scopes: data.scope,
          department: data.department,
          loginRequired: data.isLoginRequired ? "yes" : "no",
          userType: data.userType,
          status: data.status,
          formCode: data.formCode,
          workFlowCode: data.workFlowCode,
          feeCode: data.feeCode,
          certificateCode: data.certificateCode,
          ruleCode: data.ruleCode,
          cNameEn: certificate?.nameEn || '',
          cNameAr: certificate?.nameAr || '',
          validityPeriod: certificate?.validityPeriod || '',
          templateId: certificate?.templateId,

        }
        if(!isParentService){
          sdata.type = data.type;
          sdata.parentId = data.parentId;
          sdata.serviceId = isDuplicate ? null : data.id;
          sdata.serviceCode = isDuplicate ? "" : data.code;
          values.type = data.type;
          values.parentId = data.parentId;
          values.code = isDuplicate ? "" : data.code;
        }
        setData(sdata);
        
        form.setFieldsValue(values);
        
        let ruleConfig: ServiceEngineConfig | null = null;
        let ruleReadiness: ServicePublishReadinessResponse | null = null;
        if (!isDuplicate && String(data.code ?? "").trim()) {
          try {
            const configResponse = await getServiceEngineConfig(
              String(data.code).trim(),
            );
            ruleConfig = (configResponse.data ||
              configResponse) as ServiceEngineConfig;
          } catch {
            ruleConfig = null;
          }

          try {
            const readinessResponse = await getServicePublishReadiness(
              String(data.code).trim(),
            );
            ruleReadiness = (readinessResponse.data ||
              readinessResponse) as ServicePublishReadinessResponse;
          } catch {
            ruleReadiness = null;
          }
        }

        // Reset completedList before adding new items
        const certificateConfigured = hasCertificateConfiguration(data);
        const shouldEvaluateRuleStep = options?.evaluateRuleStepCompletion !== false;
        const ruleStepCompleteFromBackend =
          certificateConfigured &&
          isRuleConfigurationCompleted(
            ruleReadiness,
            isRuleConfigurationLocallyConfigured(ruleConfig),
          );

        setCompletedList((previousCompleted) => {
          const newCompletedList: string[] = [];

          if (certificateConfigured) {
            newCompletedList.push("4");
          }
          if (
            data.workflowConfigurations &&
            data.workflowConfigurations.filter(Boolean).length > 0
          ) {
            newCompletedList.push("3");
          }
          if (data.forms && data.forms.filter(Boolean).length > 0) {
            newCompletedList.push("2");
          }
          if (!isDuplicate && String(data.code ?? "").trim()) {
            newCompletedList.push("1");
          }

          if (shouldEvaluateRuleStep) {
            if (ruleStepCompleteFromBackend) {
              newCompletedList.push("5");
            }
          } else if (previousCompleted.includes("5")) {
            newCompletedList.push("5");
          }

          return newCompletedList;
        });
        setRulePrePublishReady(
          certificateConfigured && canPublishRuleConfiguration(ruleReadiness),
        );
        
      }
      return data;
    } catch (error: any) {
      console.error("Failed to load service data:", error);
      CustomMessage.error(t("addNewService.messages.loadFailed"));
    } finally {
      setLoading(false);
    }
  };
  const formRef = useRef<any>(null);
  const markCompletedStep = useCallback((stepKey: string) => {
    setCompletedList((previous) => {
      if (previous.includes(stepKey)) {
        return previous;
      }

      return [...previous, stepKey];
    });
  }, []);

  const formSave = async () => {
    try {
      if (!formRef.current) {
        return false;
      }

      await formRef.current.save();
      CustomMessage.success(t("addNewService.messages.formSaveSuccess"));
      markCompletedStep("2");
      return true;
    } catch (error: unknown) {
      console.error("Failed to save the service form:", error);
      CustomMessage.error(t("addNewService.messages.saveFailed"));
      return false;
    }
  };
  const saveRuleConfiguration = useCallback(
    async (options?: RuleConfigurationSaveOptions) => {
      const result = await ruleConfigurationRef.current?.save(options);
      return result || null;
    },
    [],
  );
  const handleSave = async (stepKey: StepKey = currentStepKey) => {
    try {
      let shouldMarkActiveTabCompleted = true;
      let fieldsToValidate: string[] = [];
      const certificateConfigurationData =
        stepKey === "4"
          ? certificateConfigurationRef.current?.getData()
          : undefined;
      const isUnifiedExpiry = certificateConfigurationData?.isUnifiedExpiry === true;

      if (stepKey === "1") {
        fieldsToValidate = [
          "serviceCategoryId",
          "nameEn",
          "nameAr",
          "serviceDescriptionEn",
          "serviceDescriptionAr",
          "serviceFeeEn",
          "serviceFeeAr",
          "serviceDeliveryTimeEn",
          "serviceDeliveryTimeAr",
          "termsConditionsEn",
          "termsConditionsAr",
          "type",
          "department",
          "parentId",
          "userTypes",
          "scopes",
          "code",
        ];
      } else if (stepKey === "4" && isUnifiedExpiry) {
        fieldsToValidate = ["cNameEn", "cNameAr", "validityPeriod"];
      }
      const values =
        stepKey === "4" && !isUnifiedExpiry
          ? {}
          : fieldsToValidate.length > 0
          ? await form.validateFields(fieldsToValidate)
          : await form.validateFields();
    
      setLoading(true);

      const allValues = form.getFieldsValue();

      const status = statusRef.current?.find((item) => item.nameEn === "Draft");
      if (stepKey === "1") {
        let response = {} as AxiosResponse<
          AddServiceResponse | UpdateServiceResponese,
          any,
          {}
        >;
        console.log(serviceData, '0000');
        
        if (serviceData.serviceId && mode.serviceInfo === "edit" && !isDuplicateMode) {
          const params: UpdateServiceParams = {
            nameEn: values.nameEn,
            nameAr: values.nameAr,
            serviceDescriptionEn: values.serviceDescriptionEn,
            serviceDescriptionAr: values.serviceDescriptionAr,
            ...getServiceInfoTextPayload(values),
            serviceCategoryId: values.serviceCategoryId,
            type: values.type,
            scope: allValues.scopes || "",
            department: values.department,
            isLoginRequired:
              allValues.loginRequired !== undefined
                ? allValues.loginRequired === "yes"
                : false,
            userType: allValues.userType || "",
            status: status?.code,
            id: serviceData.serviceId,
            code: values.code,
            parentId: allValues.parentId || null,
          };
          if (params.parentId) {
            const res = await getMainHaveChildren({
              serviceId: Number(params.parentId),
              typeCode: params.type,
              childServiceCode: serviceData.serviceCode,
            });
            if (res.data) {
              setServiceConflictModalItem(res.data as any);
              return;
            }
          }
          
          response = await updateService(params);
        } else {
          const params: AddServiceParams = {
            nameEn: values.nameEn,
            nameAr: values.nameAr,
            serviceDescriptionEn: values.serviceDescriptionEn,
            serviceDescriptionAr: values.serviceDescriptionAr,
            ...getServiceInfoTextPayload(values),
            serviceCategoryId: values.serviceCategoryId,
            type: values.type,
            scope: allValues.scopes || "",
            department: values.department,
            isLoginRequired:
              allValues.loginRequired !== undefined
                ? allValues.loginRequired === "yes"
                : false,
            userType: allValues.userType || "",
            status: status?.code,
            parentId: allValues.parentId || null,
            code: allValues.code || undefined,
          };
          if (params.parentId) {
            const res = await getMainHaveChildren({
              serviceId: Number(params.parentId),
              typeCode: params.type,
            });
            if (res.data) {
              setServiceConflictModalItem(res.data as any);
              return;
            }
          }
          response = await addService(params);
          localStorage.setItem("serviceCode", response.data?.code || "");
          setMode({
            ...mode,
            serviceInfo: "edit",
          });
          if (!isDuplicateMode) {
            loadServiceData(response.data.id);
          }
        }
        if ((response as any).statusCode === 200) {
          const serviceId = response.data?.id;
          const nextCode =
            response.data?.code ||
            values.code ||
            allValues.code ||
            serviceData.serviceCode ||
            "";
          if (serviceId) {
            setCurrentServiceId(serviceId);
            // Save service data to localStorage
            setData({
              ...serviceData,
              ...response.data,
              serviceId: serviceId,
              serviceCode: nextCode,
              serviceName:
                i18n.resolvedLanguage === "ar" ? values.nameAr : values.nameEn,
              nameEn: values.nameEn,
              nameAr: values.nameAr,
              serviceCategoryId: values.serviceCategoryId,
              type: values.type,
              department: values.department,
              // scopes: response.data?.scope || "",
              userType: allValues.userType || "",
              isLoginRequired:
                allValues.isLoginRequired !== undefined
                  ? allValues.isLoginRequired
                  : true,
              status: status?.code,
              createdAt: new Date().toISOString(),
            });
            if (nextCode) {
              localStorage.setItem("serviceCode", nextCode);
              syncServiceParamsToUrl(nextCode, serviceId);
            }
          }

          if (isDuplicateMode) {
            const sourceId = duplicateSourceIdRef.current;
            const sourceSnapshot = duplicateSourceSnapshotRef.current;

            if (sourceId && sourceSnapshot && serviceId) {
              // Copy steps 2/3/4/5 from source service into the newly created service.
              // If any copy step fails, stop immediately and keep the page in duplicate mode.
              const processKey = `Process_${Date.now()}`;

              // Step 2 - Forms (Form steps + schemas)
              const sourceStepsResp = await getFormStepList(sourceId);
              const sourceSteps: any[] = Array.isArray(sourceStepsResp.data)
                ? sourceStepsResp.data
                : [];
              for (const step of sourceSteps) {
                await AddFormStep({
                  id: 0,
                  NameEN: step.stepNameEN,
                  NameAR: step.stepNameAR,
                  code: "0",
                  serviceId,
                });
              }
              if (sourceSteps.length) {
                const newStepsResp = await getFormStepList(serviceId);
                const newSteps: any[] = Array.isArray(newStepsResp.data)
                  ? newStepsResp.data
                  : [];
                for (const newStep of newSteps) {
                  const match = sourceSteps.find(
                    (s) =>
                      s.stepNameEN === newStep.stepNameEN &&
                      s.stepNameAR === newStep.stepNameAR,
                  );
                  const schema =
                    match?.formsData ?? match?.forms?.formsData ?? match?.forms?.[0]?.formsData;
                  if (!schema) continue;
                  await ServiceSaveForm({
                    serviceId,
                    title: "",
                    description: "",
                    formsData: schema,
                    status: "",
                    version: "",
                    stepNameEN: newStep.stepNameEN,
                    stepNameAR: newStep.stepNameAR,
                    code: newStep.code ?? match?.code ?? "0",
                    stepId: newStep.id,
                  });
                }
              }

              // Step 3 - Workflow
              const sourceWorkflow = sourceSnapshot?.workflowConfigurations?.[0];
              if (
                sourceWorkflow?.bpmnJson &&
                Array.isArray(sourceWorkflow?.workflowNodes) &&
                sourceWorkflow.workflowNodes.length
              ) {
                const workflowNameEn = sourceSnapshot?.nameEn || values.nameEn;
                const workflowNameAr = sourceSnapshot?.nameAr || values.nameAr;
                const nextBpmnJson = buildDuplicatedWorkflowBpmnJson({
                  bpmnJson: sourceWorkflow.bpmnJson,
                  processDefinitionKey: processKey,
                  workflowNameEn,
                });
                // `workflowNodes` in service snapshot may include DB ids from the source service.
                // When duplicating, we must send node props without persisted identifiers.
                const nextWorkflowNodes = sourceWorkflow.workflowNodes.map(
                  (n: unknown) => {
                    if (!n || typeof n !== "object") return n;
                    const rest: Record<string, unknown> = {
                      ...(n as Record<string, unknown>),
                    };
                    delete rest.id;
                    return rest;
                  },
                );
                await request.post(
                  "/api/ServiceWorkflowConfigurationController/AddWorkflowConfiguration",
                  {
                    ProcessDefinitionKey: processKey,
                    serviceId,
                    WorkflowNameEn: workflowNameEn,
                    WorkflowNameAr: workflowNameAr,
                    bpmnJson: nextBpmnJson,
                    workflowNodes: nextWorkflowNodes,
                  },
                );
              }

              // Step 4 - Certificate
              const [sourceCertificate] = sourceSnapshot?.serivceCertificates || [];
              if (
                sourceCertificate?.templateId &&
                sourceCertificate?.nameEn &&
                sourceCertificate?.nameAr &&
                sourceCertificate?.validityPeriod
              ) {
                await addServiceCertificate({
                  serviceId,
                  templateId: sourceCertificate.templateId,
                  nameEn: sourceCertificate.nameEn,
                  nameAr: sourceCertificate.nameAr,
                  validityPeriod: sourceCertificate.validityPeriod,
                  status: sourceCertificate.status || "INACTIVE",
                  isUnifiedExpiry:
                    sourceCertificate.isUnifiedExpiry !== undefined
                      ? sourceCertificate.isUnifiedExpiry
                      : true,
                  // keep any extra backend-required fields if present
                  serivceCertificatesFields:
                    sourceCertificate.serivceCertificatesFields || [],
                  serivceCertificatesFieldsDtos:
                    sourceCertificate.serivceCertificatesFieldsDtos || [],
                } as any);
              }

              // Step 5 - Rules
              const ruleRecords: any[] = Array.isArray(sourceSnapshot?.serviceRuleRecord)
                ? sourceSnapshot.serviceRuleRecord
                : [];
              const versionByType: Record<string, string> = ruleRecords.reduce(
                (acc, r) => {
                  if (r?.ruleType && r?.version) acc[String(r.ruleType)] = String(r.version);
                  return acc;
                },
                {} as Record<string, string>,
              );
              const hasBusiness = Boolean(versionByType["BusinessRule"]);
              const hasPricing = Boolean(versionByType["PricingRule"]);
              const hasPenalty = Boolean(versionByType["PenaltyRule"]);
              const ruleJobs: { ruleType: string; isActive: boolean; version: string }[] = [];
              if (hasBusiness) {
                ruleJobs.push({
                  ruleType: "BusinessRule",
                  isActive: hasPricing,
                  version: versionByType["BusinessRule"],
                });
              }
              if (hasPricing) {
                ruleJobs.push({
                  ruleType: "PricingRule",
                  isActive: hasBusiness,
                  version: versionByType["PricingRule"],
                });
              }
              if (hasPenalty) {
                ruleJobs.push({
                  ruleType: "PenaltyRule",
                  isActive: true,
                  version: versionByType["PenaltyRule"],
                });
              }
              for (const job of ruleJobs) {
                await saveServiceRule({
                  ruleType: job.ruleType,
                  isActive: job.isActive,
                  serviceId,
                  version: job.version,
                });
              }

              // Replace URL: switch from duplicate source id to the newly created id and remove duplicate marker.
              const nextParams = new URLSearchParams(location.search);
              nextParams.set("id", String(serviceId));
              nextParams.set("serviceCode", String(nextCode || ""));
              nextParams.delete("type");
              history.replace({
                pathname: location.pathname,
                search: nextParams.toString(),
                state: location.state,
              });

              await loadServiceData(serviceId);
            }
          }

          CustomMessage.success(t("common.operationSuccess"));
          EventEmiiter.emit("save:serviceInfo");
        } else {
          console.error("Service information save was rejected:", response);
          CustomMessage.error(
            t("addNewService.messages.saveFailed"),
          );
          return false;
        }
      } else if (stepKey === "4") {
        // Certificate Configuration page
        if(isUnifiedExpiry && !certificateConfigurationRef.current?.hasTemplate()){
          CustomMessage.error(
            t("addNewService.messages.certificateTemplateRequired"),
          );
          return;
        }
        const params = {
          ...getCertificateFormPayload(allValues),
          ...(certificateConfigurationData || {
            isUnifiedExpiry: true,
            status: "INACTIVE",
          }),
          serviceId: serviceData.serviceId,
        };

        const [serivceCertificate] = serviceData.serivceCertificates || [];
        if (serivceCertificate && mode.serivceCertificate === "edit") {
          await putSerivceCertificate({
            ...(params as Omit<UpdateServiceCertificatePayload, "id">),
            id: serivceCertificate.id,
          });
        } else {
          await addServiceCertificate(params as AddServiceCertificatePayload);
          setMode((previous) => ({
            ...previous,
            serivceCertificate: "edit",
          }));
          if (serviceData.serviceId) {
            await loadServiceData(serviceData.serviceId, false, {
              evaluateRuleStepCompletion: false,
            });
          }
        }
        markCompletedStep("4");
        markStepDirty("4", false);
        CustomMessage.success(t("common.operationSuccess"));
      } else if(stepKey === "5") {
        shouldMarkActiveTabCompleted = false;
        const result = await saveRuleConfiguration();
        if (!result) {
          return;
        }
        markCompletedStep("5");
        markStepDirty("5", false);
      }
      if (shouldMarkActiveTabCompleted) {
        markCompletedStep(stepKey);
      }
      return true;
    } catch (error: any) {
      if (error.errorFields) {
        console.log(error.errorFields);
        CustomMessage.error(t("workflow.please.fillAll"));
      } else {
        if (stepKey === "1") {
          const respData = error?.response?.data;

          const respMessage: string | undefined =
            respData?.message ||
            respData?.Message ||
            error?.message;

          const keyMap: Record<string, "code" | "nameEn" | "nameAr"> = {
            code: "code",
            NameEn: "nameEn",
            NameAr: "nameAr",
          };

          const rawFieldBag =
            (respData?.data && typeof respData.data === "object" ? respData.data : undefined) ||
            respData?.errors ||
            respData?.Errors;

          const fieldErrors = Object.entries((rawFieldBag || {}) as Record<string, any>)
            .map(([k, v]) => {
              const name = keyMap[k];
              if (!name) return null;
              const hasBackendFieldError = Array.isArray(v)
                ? v.some(Boolean)
                : Boolean(v || respMessage);
              if (!hasBackendFieldError) return null;
              return {
                name,
                errors: [t("addNewService.messages.saveFailed")],
              };
            })
            .filter(Boolean) as { name: string; errors: string[] }[];

          if (fieldErrors.length) form.setFields(fieldErrors);
        } else {
          console.error("Failed to save service configuration:", error);
          CustomMessage.error(t("addNewService.messages.saveFailed"));
        }
      }
      return false;
    } finally {
      setLoading(false);
    }
  };
  const freshStatusRef = useRef(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === 116 || (e.ctrlKey && e.keyCode === 82)) {
        if (!isEditMode && !freshStatusRef.current) {
          e.preventDefault();
          freshStatusRef.current = true;
          const modal = Modal.confirm({
            centered: true,
            className: "unsaved-prompt",
            title: t("unsavedPrompt.title2"),
            content: t("unsavedPrompt.message2"),
            icon: <WarningGold className="warn-icon" />,
            okText: t("common.confirm"),
            cancelText: t("common.cancel"),
            onOk: () => {
              window.location.reload();
            },
            onCancel: () => {
              freshStatusRef.current = false;
              modal.destroy();
            },
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode]);

  const handlePrePublish = async () => {
    if (prePublishTestAccountLoading) {
      return;
    }

    try {
      setPrePublishTestAccountLoading(true);
      const response = await getPrePublishTestAccount();
      const testAccountEmail = getPrePublishTestAccountEmail(response);

      if (!testAccountEmail) {
        CustomMessage.error(
          t("addNewService.messages.testAccountEmailLoadFailed"),
        );
        return;
      }

      setPrePublishTestAccount(testAccountEmail);
      setPrePublishModalVisible(true);
    } catch {
      CustomMessage.error(
        t("addNewService.messages.testAccountEmailLoadFailed"),
      );
    } finally {
      setPrePublishTestAccountLoading(false);
    }
  };

  const handlePrePublishConfirm = async () => {
    try {
      setPublishProgress(0);
      setPrePublishModalVisible(false);
      setPublishingModalVisible(true);
      const saveResult = await saveRuleConfiguration({ silentSuccess: true });
      if (!saveResult) {
        setPublishingModalVisible(false);
        return;
      }
      if (!isCertificateConfigurationCompleted(completedList)) {
        CustomMessage.error(
          t("addNewService.messages.certificateConfigurationRequired"),
        );
        setPublishingModalVisible(false);
        return;
      }
      if (!canPublishRuleConfiguration(saveResult.readiness)) {
        CustomMessage.error(getRuleBlockingReasonMessage(saveResult.readiness));
        setPublishingModalVisible(false);
        return;
      }
      const status = statusRef.current?.find(
        (item) => item.nameEn === "Pre-published",
      );
      if (!status?.code) {
        CustomMessage.error(
          t("addNewService.messages.prePublishedStatusNotConfigured"),
        );
        setPublishingModalVisible(false);
        return;
      }
      const response = await updateServiceStatus({
        id: serviceData.serviceId!,
        status: status.code,
      });
      if (response.data) {
        setPublishProgress(100);
        setSuccessType("pre-publish");
        setSuccessModalVisible(true);
        setIsPrePublished(true);
        CustomMessage.success(t("addNewService.messages.prePublishSuccess"));
      } else {
        CustomMessage.error(t("addNewService.messages.prePublishFailed"));
      }
      setPublishingModalVisible(false);
    } catch {
      setPublishingModalVisible(false);
      CustomMessage.error(t("addNewService.messages.prePublishFailed"));
    }
  };

  const handlePublish = async () => {
    setPublishModalVisible(true);
  };
  const handlePublishConfirm = async () => {
    try {
      setPublishProgress(0);
      setPublishModalVisible(false);
      setPublishingModalVisible(true);
      const saveResult = await saveRuleConfiguration({ silentSuccess: true });
      if (!saveResult) {
        setPublishingModalVisible(false);
        return;
      }
      if (!isCertificateConfigurationCompleted(completedList)) {
        CustomMessage.error(
          t("addNewService.messages.certificateConfigurationRequired"),
        );
        setPublishingModalVisible(false);
        return;
      }
      if (!canPublishRuleConfiguration(saveResult.readiness)) {
        CustomMessage.error(getRuleBlockingReasonMessage(saveResult.readiness));
        setPublishingModalVisible(false);
        return;
      }
      const status = statusRef.current?.find(
        (item) => item.nameEn === "Published",
      );
      if (!status?.code) {
        CustomMessage.error(
          t("addNewService.messages.publishedStatusNotConfigured"),
        );
        setPublishingModalVisible(false);
        return;
      }
      const response = await updateServiceStatus({
        id: serviceData.serviceId!,
        status: status.code,
      });
      if (response.data) {
        setPublishProgress(100);
        setSuccessType("publish");
        setSuccessModalVisible(true);
        CustomMessage.success(t("addNewService.messages.publishSuccess"));
      } else {
        CustomMessage.error(t("addNewService.messages.publishFailed"));
      }
      setPublishingModalVisible(false);
    } catch {
      setPublishingModalVisible(false);
      CustomMessage.error(t("addNewService.messages.publishFailed"));
    }
  };
  const saveStepByKey = useCallback(
    async (stepKey: StepKey) => {
      if (stepKey === "2") {
        const result = await formSave();
        if (result) {
          markStepDirty("2", false);
        }
        return result;
      }

      if (stepKey === "3") {
        const result = await handleProcessSave();
        if (result) {
          markStepDirty("3", false);
        }
        return result;
      }

      const result = await handleSave(stepKey);
      if (result) {
        markStepDirty(stepKey, false);
      }
      return result;
    },
    [formSave, handleProcessSave, handleSave, markStepDirty],
  );
  const handleLeaveConfirmBack = useCallback(() => {
    setLeaveConfirmVisible(false);
    setLeaveConfirmLoading(false);
    allowNextNavigationRef.current = true;
    navigateToServiceConfiguration();
  }, [navigateToServiceConfiguration]);
  const handleLeaveConfirmSave = useCallback(async () => {
    if (!isStepKey(activeTab)) {
      setLeaveConfirmVisible(false);
      return;
    }

    try {
      setLeaveConfirmVisible(false);
      setLeaveConfirmLoading(true);
      await saveStepByKey(activeTab);
    } finally {
      setLeaveConfirmLoading(false);
    }
  }, [activeTab, saveStepByKey]);
  const attemptLeave = useCallback(() => {
    if (!isCurrentStepDirty) {
      navigateToServiceConfiguration();
      return;
    }

    setLeaveConfirmVisible(true);
  }, [isCurrentStepDirty, navigateToServiceConfiguration]);

  useEffect(() => {
    const unblock = history.block((nextLocation) => {
      if (allowNextNavigationRef.current) {
        allowNextNavigationRef.current = false;
        return undefined;
      }

      const nextPath = String(nextLocation?.pathname ?? "").trim();
      const currentPath = String(history.location.pathname ?? "").trim();

      if (!nextPath || nextPath === currentPath) {
        return undefined;
      }

      if (!isStepKey(activeTab) || !stepDirtyMap[activeTab]) {
        return undefined;
      }

      if (leaveConfirmVisible) {
        return false;
      }

      setLeaveConfirmVisible(true);
      return false;
    });

    return () => {
      allowNextNavigationRef.current = false;
      unblock();
    };
  }, [activeTab, history, leaveConfirmVisible, stepDirtyMap]);

  const tabItems: TabItem[] = [
    {
      key: "1",
      label: t("addNewService.tabs.servicesInformation"),
      icon: <Edit2 />,
      children: (
        <ServicesInformation
          form={form}
          onFormChange={() => update({})}
          loadServiceData={loadServiceData}
          onDirtyChange={(dirty) => markStepDirty("1", dirty)}
        />
      ),
    },
    {
      key: "2",
      label: t("addNewService.tabs.formConfiguration"),
      icon: <Text />,
      children: null,
    },
    {
      key: "3",
      label: t("addNewService.tabs.approvalWorkflow"),
      icon: <ServiceStepIcon type="workflow" />,
      children: (
        <div className="tab-content">
          <ProcessDesign
            ref={processDesignRef}
            onDirtyChange={(dirty) => markStepDirty("3", dirty)}
          />
        </div>
      ),
    },
    {
      key: "4",
      label: t("addNewService.tabs.certificateConfiguration"),
      icon: <ServiceStepIcon type="certificate" />,
      children: (
        <CertificateConfiguration
          form={form}
          isUnifiedExpiry={certificateUnifiedExpiry}
          ref={certificateConfigurationRef}
          onDirtyChange={(dirty) => markStepDirty("4", dirty)}
        />
      ),
    },
    {
      key: "5",
      label: t("addNewService.tabs.ruleConfiguration"),
      icon: <ServiceStepIcon type="rules" />,
      children: (
        <RuleConfiguration
          ref={ruleConfigurationRef}
          serviceCode={currentServiceCode || null}
          userType={String(watchedUserType ?? serviceData.userType ?? "")}
          onRuleSaved={handleRuleSaved}
          onDirtyChange={handleRuleDirtyChange}
        />
      ),
    }
  ];

  async function handleProcessSave() {
    if (processLoading) return;
    try {
      setProcessLoading(true);
      await processDesignRef.current?.save?.();
      CustomMessage.success(t("addNewService.messages.processSaveSuccess"));
      markCompletedStep("3");
      loadServiceData(serviceData.serviceId!, false, {
        evaluateRuleStepCompletion: false,
      });
      return true;
    } catch (error: unknown) {
      CustomMessage.error(t("addNewService.messages.saveFailed"));
      console.error("Process save failed", error);
      return false;
    } finally {
      setProcessLoading(false);
    }
  }
  const serviceName =
    i18n.resolvedLanguage === "ar"
      ? form.getFieldValue("nameAr")
      : form.getFieldValue("nameEn");
  const serviceConflictName =
    (i18n.resolvedLanguage === "ar"
      ? serviceConflictModalItem?.nameAr || serviceConflictModalItem?.nameEn
      : serviceConflictModalItem?.nameEn || serviceConflictModalItem?.nameAr) ||
    "-";
  const serviceConflictType =
    (i18n.resolvedLanguage === "ar"
      ? serviceConflictModalItem?.typeInfo?.nameAr ||
        serviceConflictModalItem?.typeInfo?.nameEn
      : serviceConflictModalItem?.typeInfo?.nameEn ||
        serviceConflictModalItem?.typeInfo?.nameAr) ||
    "-";
  useLayoutEffect(() => {
    if (serviceNameDiv) {
      serviceNameDiv.dataset.originalText = serviceName;
      clamp2(serviceNameDiv);
    }
  }, [serviceNameDiv, serviceName]);
  return (
    <div
      className={`add-new-service-container ${
        activeTab === "2" ? "flexdom" : ""
      } ${activeTab === "3" ? "workflowdom" : ""
      } ${
        activeTab === "2" && FORM_DESIGNER_USE_PAGE_SCROLL
          ? "add-new-service-container--form-page-scroll"
          : ""
      }`}
    >
      <Card className="service-name-card">
        {serviceName && (
          <h3
            ref={(e) => setServiceNameDiv(e)}
            title={serviceName}
            className="service-name"
          >
            {serviceName}
          </h3>
        )}
        <StepTabsHeader
          completedList={completedList}
          items={tabItems}
          activeKey={activeTab}
          onChange={(activeKey) => {
            if (!serviceData.serviceId) {
              CustomMessage.error(t("addNewService.messages.saveServiceFirst"));
              return;
            }
            if (
              activeKey === "5" &&
              !isCertificateConfigurationCompleted(completedList)
            ) {
              CustomMessage.error(
                t("addNewService.messages.certificateConfigurationRequired"),
              );
              return;
            }
            if(activeKey === '4' && serviceData.serivceCertificates){
              if(serviceData.serviceId || serviceIdFromUrl){
                loadServiceData(serviceData.serviceId || serviceIdFromUrl!, false, {
                  evaluateRuleStepCompletion: false,
                });
              }
            }
            if (serviceData.serviceCode) {
              sessionStorage.setItem(
                `service-active-${userInfo?.id}-${serviceData.serviceCode}`,
                activeKey,
              );
            }
            setActiveTab(activeKey);
          }}
        />
      </Card>

      {activeTab === "2" ? (
        <div className={`playgroundcontainer ${isView ? "page-disabled" : ""}`}>
          <Suspense fallback={<DesignableLoadingFallback />}>
            <LazyPlay
              ref={formRef}
              readOnly={isView}
              usePageScroll={FORM_DESIGNER_USE_PAGE_SCROLL}
              onDirtyChange={(dirty) => markStepDirty("2", dirty)}
            />
          </Suspense>
        </div>
      ) : activeTab === "3" ? (
        <div className="process-content-wrapper">
          <div className={`process-content ${isView ? "page-disabled" : ""}`}>
            <ProcessDesign
              ref={processDesignRef}
              onDirtyChange={(dirty) => markStepDirty("3", dirty)}
            />
          </div>
        </div>
      ) : activeTab === "4" ? (
        <Card
          className={`service-card service-card--segmented ${
            isView ? "page-disabled" : ""
          }`}
        >
          <CertificateConfiguration
            form={form}
            isUnifiedExpiry={certificateUnifiedExpiry}
            ref={certificateConfigurationRef}
            onDirtyChange={(dirty) => markStepDirty("4", dirty)}
          />
        </Card>
      ) : (
        <Card
          className={`service-card ${
            activeTab === "5" || activeTab === "1" ? "certificate-card" : ""
          } ${isView ? "page-disabled" : ""}`}
        >
          <StepTabsContent items={tabItems} activeKey={activeTab} />
        </Card>
      )}
      {!isView && (
        <div className="form-footer detail-action-footer">
          <CustomButton
            onClick={attemptLeave}
            text={t("common.back")}
            variant="outline"
          />
          <div className="form-footer-right">
            {activeTab === "5" ? (
            <>
              {successType !== "publish" && (
                <CustomButton
                  text={t("addNewService.buttons.save")}
                  variant="primary"
                  customClassName="saveBtn"
                  onClick={() => {
                    void saveStepByKey("5");
                  }}
                  loading={loading}
                  permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService3"
                  permissionRoutePath="/service-management/service-configuration/addnewservice"
                />
              )}
              {successType !== "pre-publish" && successType !== "publish" && (
                <CustomButton
                  text={t("addNewService.buttons.prePublish")}
                  variant="outline"
                  customClassName="saveBtn"
                  onClick={handlePrePublish}
                  loading={
                    loading ||
                    publishingModalVisible ||
                    prePublishTestAccountLoading
                  }
                  disabled={
                    !hasServiceCode ||
                    !rulePrePublishReady ||
                    loading ||
                    publishingModalVisible ||
                    prePublishTestAccountLoading
                  }
                  permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService4"
                  permissionRoutePath="/service-management/service-configuration/addnewservice"
                />
              )}

              {successType !== "publish" && (
                <CustomButton
                  text={t("addNewService.buttons.publish")}
                  variant="primary"
                  customClassName="saveBtn"
                  onClick={handlePublish}
                  loading={loading || publishingModalVisible}
                  disabled={
                    !hasServiceCode ||
                    !rulePrePublishReady ||
                    loading ||
                    publishingModalVisible ||
                    !isPrePublished
                  }
                  permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService5"
                  permissionRoutePath="/service-management/service-configuration/addnewservice"
                />
              )}
            </>
          ) : activeTab === "3" ? (
            <>
              <CustomButton
                customClassName="saveBtn"
                text={t("addNewService.buttons.test")}
                variant="outline"
              />
              <CustomButton
                text={t("addNewService.buttons.save")}
                variant="primary"
                customClassName="saveBtn"
                onClick={() => {
                  void saveStepByKey("3");
                }}
                loading={processLoading}
                permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService3"
                permissionRoutePath="/service-management/service-configuration/addnewservice"
              />
            </>
          ) : activeTab === "2" ? (
            //  Save
            <CustomButton
              text={t("addNewService.buttons.save")}
              variant="primary"
              customClassName="saveBtn"
              onClick={() => {
                void saveStepByKey("2");
              }}
              loading={loading}
              permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService3"
              permissionRoutePath="/service-management/service-configuration/addnewservice"
            />
          ) : (
            <CustomButton
              text={t("addNewService.buttons.save")}
              variant="primary"
              customClassName="saveBtn"
              onClick={() => {
                void saveStepByKey(currentStepKey);
              }}
              loading={loading}
              permissionCode="Service.ServiceConfiguration.AddNewService.SaveAddNewService3"
              permissionRoutePath="/service-management/service-configuration/addnewservice"
            />
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        visible={leaveConfirmVisible}
        type="warning"
        title={t("unsavedPrompt.title")}
        content={t("unsavedPrompt.message")}
        cancelText={t("common.back")}
        confirmText={t("common.save")}
        onCancel={handleLeaveConfirmBack}
        onConfirm={() => {
          void handleLeaveConfirmSave();
        }}
        loading={leaveConfirmLoading}
      />

      <PrePublishModal
        visible={prePublishModalVisible}
        onCancel={() => setPrePublishModalVisible(false)}
        onConfirm={handlePrePublishConfirm}
        testAccount={prePublishTestAccount}
      />

      <PublishingModal
        visible={publishingModalVisible}
        progress={publishProgress}
      />

      <PublishModal
        visible={publishModalVisible}
        onCancel={() => setPublishModalVisible(false)}
        onConfirm={handlePublishConfirm}
        serviceName={serviceName}
      />

      <SuccessModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        type={successType!}
        testAccount={prePublishTestAccount}
        accessLink={customerPortalMediaLicenseUrl}
      />

       <Modal
        centered
        className="service-conflict-modal"
        visible={!!serviceConflictModalItem}
        footer={
          <div>
            <CustomButton
              text={t("common.close")}
              onClick={() => setServiceConflictModalItem(null)}
            />
          </div>
        }
        closable={false}
        onCancel={() => setServiceConflictModalItem(null)}
      >
        <div className="service-conflict-modal-content">
          <div className="service-conflict-modal-icon">
            <img src={WG} />
          </div>
          <div>
            <div className="service-conflict-modal-title">
              {t("addNewService.serviceConflictModal.title")}
            </div>
            <div className="service-conflict-modal-desc">
              {t("addNewService.serviceConflictModal.description")}
            </div>
            <div className="service-conflict-modal-subtitle">
              {t("addNewService.serviceConflictModal.existingService")}
            </div>
            <div className="service-conflict-modal-serviceinfo">
              <div>
                <b>{t("addNewService.serviceConflictModal.serviceName")}:</b>{" "}
                {serviceConflictName}
              </div>
              <div>
                <b>{t("addNewService.serviceConflictModal.serviceType")}:</b>{" "}
                {serviceConflictType}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
