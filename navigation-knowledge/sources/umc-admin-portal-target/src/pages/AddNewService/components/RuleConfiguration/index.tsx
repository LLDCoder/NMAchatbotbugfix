import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import {
  getAllUserType,
  getServiceEngineConfig,
  getServiceEngineReadiness,
  getServicePublishReadiness,
  saveServiceEngineConfig,
  type ServiceEngineConfig,
  type ServiceEngineKind,
  type ServiceEngineReadinessResult,
  type ServicePublishReadinessResponse,
  type TypeDictionary,
} from "@/services/serviceApi";
import BusinessRuleSection from "./BusinessRuleSection";
import PricingRuleSection from "./PricingRuleSection";
import PenaltyRuleSection from "./PenaltyRuleSection";
import type {
  RuleConfigurationProps,
  RuleConfigurationRef,
  RuleConfigurationSaveOptions,
  RuleConfigurationSaveResult,
  RuleFieldErrors,
  RulePricingState,
  RuleSectionState,
  RuleStateMap,
} from "./types";
import {
  applyReadinessToState,
  buildConfigSnapshotFromState,
  buildPayloadFromState,
  createEmptyRuleState,
  getPricingUserTypeOptions,
  isRequiredRulesConfigured,
  mapConfigToState,
  syncManualPricingDetailsWithUserTypes,
  trimVersion,
} from "./utils";
import "./RuleConfiguration.less";

export type {
  RuleConfigurationRef,
  RuleConfigurationSaveOptions,
  RuleConfigurationSaveResult,
} from "./types";

const RuleConfiguration = forwardRef<
  RuleConfigurationRef,
  RuleConfigurationProps
>(({ serviceCode, userType, onRuleSaved, onDirtyChange }, ref) => {
  const { i18n, t } = useTranslation();
  const [rules, setRules] = useState<RuleStateMap>(createEmptyRuleState);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RuleFieldErrors>({});
  const [serviceFeeAmount, setServiceFeeAmount] = useState<number | null>(null);
  const [userTypesData, setUserTypesData] = useState<TypeDictionary[]>([]);
  const onRuleSavedRef = useRef(onRuleSaved);

  const selectedUserTypes = useMemo(
    () => getPricingUserTypeOptions(userType, userTypesData, i18n.language),
    [i18n.language, userType, userTypesData],
  );

  useEffect(() => {
    if (!selectedUserTypes.length) {
      return;
    }

    setRules((previous) => ({
      ...previous,
      pricing: {
        ...previous.pricing,
        manualPricingDetails:
          previous.pricing.source === "manual" &&
          previous.pricing.manualPricingType === "paid"
            ? syncManualPricingDetailsWithUserTypes(
                previous.pricing.manualPricingDetails,
                selectedUserTypes,
              )
            : previous.pricing.manualPricingDetails,
      },
    }));
  }, [selectedUserTypes]);

  useEffect(() => {
    let cancelled = false;

    const loadUserTypes = async () => {
      try {
        const response = await getAllUserType();
        const data = Array.isArray(response) ? response : response?.data || [];

        if (!cancelled) {
          setUserTypesData(data);
        }
      } catch {
        if (!cancelled) {
          setUserTypesData([]);
        }
      }
    };

    void loadUserTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onRuleSavedRef.current = onRuleSaved;
  }, [onRuleSaved]);

  const updateParent = useCallback(
    (
      result: RuleConfigurationSaveResult | null,
      meta?: { fromSave?: boolean },
    ) => {
      onRuleSavedRef.current?.(result, meta);
    },
    [],
  );

  const updateBusiness = useCallback(
    (updater: (section: RuleSectionState) => RuleSectionState) => {
      setRules((previous) => ({
        ...previous,
        business: updater(previous.business),
      }));
    },
    [],
  );

  const updatePricing = useCallback(
    (updater: (section: RulePricingState) => RulePricingState) => {
      setRules((previous) => ({
        ...previous,
        pricing: updater(previous.pricing),
      }));
    },
    [],
  );

  const updatePenalty = useCallback(
    (updater: (section: RuleSectionState) => RuleSectionState) => {
      setRules((previous) => ({
        ...previous,
        penalty: updater(previous.penalty),
      }));
    },
    [],
  );

  const refreshRuleConfiguration = useCallback(async () => {
    if (!serviceCode) {
      return null;
    }

    const configResponse = await getServiceEngineConfig(serviceCode);
    const config = (configResponse.data ||
      configResponse) as ServiceEngineConfig;
    let readiness: ServicePublishReadinessResponse | null = null;

    try {
      const readinessResponse = await getServicePublishReadiness(serviceCode);
      readiness = (readinessResponse.data ||
        readinessResponse) as ServicePublishReadinessResponse;
    } catch {
      readiness = null;
    }

    setRules(applyReadinessToState(mapConfigToState(config), readiness));
    setFieldErrors({});
    setServiceFeeAmount(
      typeof config.serviceFeeAmount === "number"
        ? config.serviceFeeAmount
        : null,
    );

    const result: RuleConfigurationSaveResult = {
      config,
      readiness,
      requiredRulesConfigured: isRequiredRulesConfigured(config),
    };

    updateParent(result, { fromSave: false });
    return result;
  }, [serviceCode, updateParent]);

  const refreshRuleReadinessOnly = useCallback(async () => {
    if (!serviceCode) {
      return null;
    }

    try {
      const readinessResponse = await getServicePublishReadiness(serviceCode);
      return (readinessResponse.data ||
        readinessResponse) as ServicePublishReadinessResponse;
    } catch {
      return null;
    }
  }, [serviceCode]);

  const loadRuleConfiguration = useCallback(async () => {
    if (!serviceCode) {
      setRules(createEmptyRuleState());
      setFieldErrors({});
      setServiceFeeAmount(null);
      updateParent(null, { fromSave: false });
      return;
    }

    setLoading(true);

    try {
      await refreshRuleConfiguration();
    } catch (error: unknown) {
      const status = Number(
        (error as { response?: { status?: number } })?.response?.status,
      );

      if (status === 404) {
        setRules(createEmptyRuleState());
        setFieldErrors({});
        setServiceFeeAmount(null);
        updateParent(null, { fromSave: false });
      } else {
        console.error("Failed to load rule configuration:", error);
        CustomMessage.error(
          i18n.t("addNewService.ruleConfiguration.messages.loadFailed"),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [i18n, refreshRuleConfiguration, serviceCode, updateParent]);

  useEffect(() => {
    loadRuleConfiguration();
  }, [loadRuleConfiguration]);

  const handleBusinessVersionChange = useCallback(
    (value: string) => {
      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, business: undefined }));
      updateBusiness((section) => ({
        ...section,
        version: value,
        checkResult: null,
        showContent: section.enabled,
      }));
    },
    [onDirtyChange, updateBusiness],
  );

  const handlePricingVersionChange = useCallback(
    (value: string) => {
      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, pricing: undefined }));
      updatePricing((section) => ({
        ...section,
        enabled: true,
        version: value,
        checkResult: null,
      }));
    },
    [onDirtyChange, updatePricing],
  );

  const handlePenaltyVersionChange = useCallback(
    (value: string) => {
      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, penalty: undefined }));
      updatePenalty((section) => ({
        ...section,
        version: value,
        checkResult: null,
        showContent: section.enabled,
      }));
    },
    [onDirtyChange, updatePenalty],
  );

  const handleBusinessToggle = useCallback(
    (checked: boolean) => {
      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, business: undefined }));
      updateBusiness((section) => ({
        ...section,
        enabled: checked,
        checkResult: null,
        showContent: checked,
      }));
    },
    [onDirtyChange, updateBusiness],
  );

  const handlePricingSourceChange = useCallback(
    (source: "manual" | "engine") => {
      if (rules.pricing.source === source) {
        return;
      }

      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, pricing: undefined }));
      updatePricing((section) => ({
        ...section,
        source,
      }));
    },
    [onDirtyChange, rules.pricing.source, updatePricing],
  );

  const handleManualPricingTypeChange = useCallback(
    (manualPricingType: "free" | "paid") => {
      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, pricing: undefined }));
      updatePricing((section) => ({
        ...section,
        manualPricingType,
        checkResult: null,
        manualPricingDetails:
          manualPricingType === "paid"
            ? syncManualPricingDetailsWithUserTypes(
                section.manualPricingDetails,
                selectedUserTypes,
              )
            : [],
      }));
    },
    [onDirtyChange, selectedUserTypes, updatePricing],
  );

  const handleManualPricingDetailChange = useCallback(
    (userTypeCode: string, amount: number | null) => {
      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, pricing: undefined }));
      updatePricing((section) => {
        const normalizedCode = String(userTypeCode ?? "").trim();
        const syncedDetails = syncManualPricingDetailsWithUserTypes(
          section.manualPricingDetails,
          selectedUserTypes,
        );

        return {
          ...section,
          checkResult: null,
          manualPricingDetails: syncedDetails.map((item) =>
            item.userTypeCode === normalizedCode
              ? {
                  ...item,
                  amount,
                }
              : item,
          ),
        };
      });
    },
    [onDirtyChange, selectedUserTypes, updatePricing],
  );

  const handlePenaltyToggle = useCallback(
    (checked: boolean) => {
      onDirtyChange?.(true);
      setFieldErrors((previous) => ({ ...previous, penalty: undefined }));
      updatePenalty((section) => ({
        ...section,
        enabled: checked,
        checkResult: null,
        showContent: checked,
      }));
    },
    [onDirtyChange, updatePenalty],
  );

  const checkEngineReadiness = useCallback(
    async (
      engine: ServiceEngineKind,
      section: RuleSectionState,
      updateSection: (
        updater: (current: RuleSectionState) => RuleSectionState,
      ) => void,
      setFieldError: (message: string | undefined) => void,
    ) => {
      if (!serviceCode) {
        return;
      }

      const version = trimVersion(section.version);

      if (!version) {
        setFieldError(
          i18n.t("addNewService.ruleConfiguration.messages.versionRequired"),
        );
        return;
      }

      setFieldError(undefined);
      updateSection((currentSection) => ({
        ...currentSection,
        checking: true,
      }));

      try {
        const response = await getServiceEngineReadiness(
          serviceCode,
          engine,
          version,
        );
        const result = (response.data ||
          response) as ServiceEngineReadinessResult;

        updateSection((currentSection) => ({
          ...currentSection,
          checking: false,
          checkResult: result,
        }));
      } catch (error: unknown) {
        console.error("Rule readiness check failed:", error);
        CustomMessage.error(
          i18n.t(
            "addNewService.ruleConfiguration.messages.readinessCheckFailed",
          ),
        );
        updateSection((currentSection) => ({
          ...currentSection,
          checking: false,
        }));
      }
    },
    [i18n, serviceCode],
  );

  const handleBusinessCheck = useCallback(() => {
    checkEngineReadiness(
      "rule",
      rules.business,
      updateBusiness,
      (message) =>
        setFieldErrors((previous) => ({ ...previous, business: message })),
    );
  }, [checkEngineReadiness, rules.business, updateBusiness]);

  const handlePricingCheck = useCallback(() => {
    checkEngineReadiness(
      "fee",
      rules.pricing,
      (updater) => {
        updatePricing((section) => updater(section) as RulePricingState);
      },
      (message) =>
        setFieldErrors((previous) => ({ ...previous, pricing: message })),
    );
  }, [checkEngineReadiness, rules.pricing, updatePricing]);

  const handlePenaltyCheck = useCallback(() => {
    checkEngineReadiness(
      "penalty",
      rules.penalty,
      updatePenalty,
      (message) =>
        setFieldErrors((previous) => ({ ...previous, penalty: message })),
    );
  }, [checkEngineReadiness, rules.penalty, updatePenalty]);

  const saveConfiguration = useCallback(
    async (options?: RuleConfigurationSaveOptions) => {
      if (!serviceCode) {
        CustomMessage.error(
          i18n.t(
            "addNewService.ruleConfiguration.messages.serviceCodeRequired",
          ),
        );
        return null;
      }

      const nextErrors: RuleFieldErrors = {};
      const businessVersion = trimVersion(rules.business.version);
      const pricingVersion = trimVersion(rules.pricing.version);
      const penaltyVersion = trimVersion(rules.penalty.version);

      if (rules.business.enabled && !businessVersion) {
        nextErrors.business = i18n.t(
          "addNewService.ruleConfiguration.messages.versionRequired",
        );
      }

      if (rules.pricing.source === "engine" && !pricingVersion) {
        nextErrors.pricing = i18n.t(
          "addNewService.ruleConfiguration.messages.versionRequired",
        );
      }

      if (
        rules.pricing.source === "manual" &&
        rules.pricing.manualPricingType === "paid"
      ) {
        const syncedDetails = syncManualPricingDetailsWithUserTypes(
          rules.pricing.manualPricingDetails,
          selectedUserTypes,
        );
        const hasInvalidManualAmount = syncedDetails.some(
          (item) =>
            !item.userTypeCode ||
            typeof item.amount !== "number" ||
            item.amount <= 0 ||
            item.amount >= 1000000,
        );

        if (!selectedUserTypes.length || hasInvalidManualAmount) {
          nextErrors.pricing = i18n.t(
            "addNewService.ruleConfiguration.messages.validFeeRequired",
          );
        }
      }

      if (rules.penalty.enabled && !penaltyVersion) {
        nextErrors.penalty = i18n.t(
          "addNewService.ruleConfiguration.messages.versionRequired",
        );
      }

      setFieldErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        CustomMessage.error(i18n.t("workflow.please.fillAll"));
        return null;
      }

      const normalizedRules: RuleStateMap = {
        ...rules,
        pricing: {
          ...rules.pricing,
          manualPricingDetails:
            rules.pricing.source === "manual" &&
            rules.pricing.manualPricingType === "paid"
              ? syncManualPricingDetailsWithUserTypes(
                  rules.pricing.manualPricingDetails,
                  selectedUserTypes,
                )
              : [],
        },
      };

      try {
        setRules(normalizedRules);
        const saveResponse = await saveServiceEngineConfig(
          serviceCode,
          buildPayloadFromState(normalizedRules),
        );
        const responseConfig = (saveResponse.data ||
          saveResponse) as Partial<ServiceEngineConfig>;
        const configSnapshot = buildConfigSnapshotFromState(normalizedRules);
        const config: ServiceEngineConfig = {
          ...configSnapshot,
          serviceId: responseConfig?.serviceId ?? configSnapshot.serviceId,
          rowVersion: responseConfig?.rowVersion ?? configSnapshot.rowVersion,
          serviceFeeAmount:
            typeof responseConfig?.serviceFeeAmount === "number"
              ? responseConfig.serviceFeeAmount
              : configSnapshot.serviceFeeAmount,
          createdAt: responseConfig?.createdAt ?? configSnapshot.createdAt,
          createdBy: responseConfig?.createdBy ?? configSnapshot.createdBy,
          updatedAt: responseConfig?.updatedAt ?? configSnapshot.updatedAt,
          updatedBy: responseConfig?.updatedBy ?? configSnapshot.updatedBy,
        };
        const readiness = await refreshRuleReadinessOnly();
        const nextState = applyReadinessToState(
          mapConfigToState(config),
          readiness,
        );

        setRules(nextState);
        setFieldErrors({});
        setServiceFeeAmount(
          typeof config.serviceFeeAmount === "number"
            ? config.serviceFeeAmount
            : null,
        );

        const result: RuleConfigurationSaveResult = {
          config,
          readiness,
          requiredRulesConfigured: isRequiredRulesConfigured(config),
        };

        updateParent(result, { fromSave: true });
        if (!options?.silentSuccess) {
          CustomMessage.success(i18n.t("common.operationSuccess"));
        }
        return result;
      } catch (error: unknown) {
        console.error("Failed to save rule configuration:", error);
        CustomMessage.error(
          i18n.t("addNewService.ruleConfiguration.messages.saveFailed"),
        );
        return null;
      }
    },
    [
      refreshRuleReadinessOnly,
      i18n,
      rules,
      selectedUserTypes,
      serviceCode,
      updateParent,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      save: saveConfiguration,
    }),
    [saveConfiguration],
  );

  return (
    <div className="service-rule-config">
      {loading ? (
        <div className="service-rule-config__loading">
          {t("common.loading")}
        </div>
      ) : (
        <>
          <BusinessRuleSection
            state={rules.business}
            fieldError={fieldErrors.business}
            onVersionChange={handleBusinessVersionChange}
            onToggle={handleBusinessToggle}
            onCheck={handleBusinessCheck}
          />
          <PricingRuleSection
            state={rules.pricing}
            fieldError={fieldErrors.pricing}
            serviceFeeAmount={serviceFeeAmount}
            selectedUserTypes={selectedUserTypes}
            onSourceChange={handlePricingSourceChange}
            onManualPricingTypeChange={handleManualPricingTypeChange}
            onManualPricingDetailChange={handleManualPricingDetailChange}
            onVersionChange={handlePricingVersionChange}
            onCheck={handlePricingCheck}
          />
          <PenaltyRuleSection
            state={rules.penalty}
            fieldError={fieldErrors.penalty}
            onVersionChange={handlePenaltyVersionChange}
            onToggle={handlePenaltyToggle}
            onCheck={handlePenaltyCheck}
          />
        </>
      )}
    </div>
  );
});

RuleConfiguration.displayName = "RuleConfiguration";

export default RuleConfiguration;
