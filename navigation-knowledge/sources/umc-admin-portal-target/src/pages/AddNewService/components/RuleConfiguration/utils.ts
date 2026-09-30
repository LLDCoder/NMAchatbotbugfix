import type {
  ServiceEngineConfig,
  ServiceEngineConfigPayload,
  ServiceEngineReadinessResult,
  ServiceManualPricingType,
  ServicePricingSource,
  ServicePublishReadinessResponse,
  TypeDictionary,
} from "@/services/serviceApi";
import type {
  PricingUserTypeOption,
  RuleManualPricingDetailState,
  RulePricingState,
  RuleSectionState,
  RuleStateMap,
} from "./types";

export const parseUserTypeCodes = (userType?: string | null): string[] => {
  if (!userType) {
    return [];
  }

  return userType
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

interface TypeDictionaryForPricing {
  label: string;
  value: string;
}

interface TypeDictionaryForPricingItem {
  userType: string;
  dictionary: TypeDictionaryForPricing[];
  language: string;
}

const MOCK_PRICING_USER_TYPE_DICTIONARY: TypeDictionaryForPricingItem = {
  userType: "99",
  language: "en",
  dictionary: [
    { label: "Commercial Entity", value: "2" },
    { label: "Government Entity", value: "3" },
    { label: "Non-Profit Organization", value: "4" },
    { label: "Free Zone", value: "5" },
    { label: "Shipping company / Clearing Agency", value: "6" },
  ],
};

const ESTABLISHMENT_USER_TYPE_CODE = "99";

export const getPricingUserTypeOptions = (
  userType: string | undefined | null,
  fallbackDictionary: TypeDictionary[],
  language: string,
): PricingUserTypeOption[] => {
  const selectedCodes = parseUserTypeCodes(userType).filter(
    (code) => code !== ESTABLISHMENT_USER_TYPE_CODE,
  );

  if (!selectedCodes.length) {
    return [];
  }

  const dictionaryOptions = selectedCodes
    .map((code) => {
      const matched = fallbackDictionary.find(
        (item) => String(item?.code ?? "").trim() === code,
      );

      if (!matched) {
        return null;
      }

      return {
        value: code,
        label:
          language === "ar"
            ? matched.nameAr || matched.nameEn || code
            : matched.nameEn || matched.nameAr || code,
      };
    })
    .filter(Boolean) as PricingUserTypeOption[];

  if (dictionaryOptions.length === selectedCodes.length) {
    return dictionaryOptions;
  }

  return selectedCodes.map((code) => {
    const fallback = MOCK_PRICING_USER_TYPE_DICTIONARY.dictionary.find(
      (item) => String(item.value) === code,
    );

    return {
      value: code,
      label: fallback?.label || code,
    };
  });
};

export const trimVersion = (value: string) => value.trim();

const READY_STATUS_SET = new Set(["ready", "readytopublish"]);

export const isRuleVersionActive = (section: RuleSectionState) => {
  const version = trimVersion(section.version);
  const expectedVersion = trimVersion(
    section.checkResult?.expectedVersion || "",
  );
  const status = String(section.checkResult?.status || "").toLowerCase();

  return Boolean(
    section.enabled &&
      version &&
      expectedVersion === version &&
      section.checkResult?.canPublish &&
      READY_STATUS_SET.has(status),
  );
};

export const createEmptySectionState = (): RuleSectionState => ({
  enabled: false,
  version: "",
  checkResult: null,
  checking: false,
  showContent: false,
});

export const createEmptyPricingState = (): RulePricingState => ({
  ...createEmptySectionState(),
  enabled: true,
  showContent: true,
  source: "manual",
  manualPricingType: "free",
  manualPricingDetails: [],
  manualPricingReady: null,
});

export const createEmptyRuleState = (): RuleStateMap => ({
  configMode: "simple",
  rowVersion: null,
  business: createEmptySectionState(),
  pricing: createEmptyPricingState(),
  penalty: createEmptySectionState(),
});

const normalizeConfigMode = (
  value?: string | null,
): "engine" | "simple" => (value === "engine" ? "engine" : "simple");

const normalizePricingSource = (
  value?: string | null,
): ServicePricingSource => (value === "engine" ? "engine" : "manual");

const normalizeManualPricingType = (
  value?: string | null,
): ServiceManualPricingType => (value === "paid" ? "paid" : "free");

export const normalizeManualPricingDetails = (
  details:
    | Array<{
        userTypeCode?: string | null;
        amount?: number | string | null;
        currencyCode?: string | null;
      }>
    | null
    | undefined,
): RuleManualPricingDetailState[] => {
  if (!Array.isArray(details)) {
    return [];
  }

  return details
    .map((item) => {
      const userTypeCode = String(item?.userTypeCode ?? "").trim();
      const rawAmount = item?.amount;
      const amount =
        typeof rawAmount === "number"
          ? rawAmount
          : rawAmount === null || rawAmount === undefined || rawAmount === ""
            ? null
            : Number(rawAmount);

      if (!userTypeCode) {
        return null;
      }

      return {
        userTypeCode,
        amount: Number.isFinite(amount) ? amount : null,
        currencyCode: "AED" as const,
      };
    })
    .filter(Boolean) as RuleManualPricingDetailState[];
};

export const syncManualPricingDetailsWithUserTypes = (
  details: RuleManualPricingDetailState[],
  selectedUserTypes: PricingUserTypeOption[],
): RuleManualPricingDetailState[] => {
  if (!selectedUserTypes.length) {
    return [];
  }

  return selectedUserTypes.map((userType) => {
    const userTypeCode = String(userType.value ?? "").trim();
    const matched = details.find((item) => item.userTypeCode === userTypeCode);

    return {
      userTypeCode,
      amount: matched?.amount ?? null,
      currencyCode: "AED",
    };
  });
};

export const isRequiredRulesConfigured = (config: ServiceEngineConfig) => {
  const businessEnabled = Boolean(
    config.businessRule?.enabled ?? config.ruleEnabled,
  );
  const businessVersion = String(
    config.businessRule?.version ?? config.ruleVersion ?? "",
  ).trim();
  const pricingSource = normalizePricingSource(
    config.pricingRule?.source ?? (config.feeEnabled ? "engine" : "manual"),
  );
  const feeEngineVersion = String(
    config.pricingRule?.feeEngineVersion ?? config.feeVersion ?? "",
  ).trim();
  const manualPricingType = normalizeManualPricingType(
    config.pricingRule?.manualPricingType,
  );
  const manualPricingDetails = normalizeManualPricingDetails(
    config.pricingRule?.details,
  );
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
};

export const mapConfigToState = (config: ServiceEngineConfig): RuleStateMap => {
  const businessEnabled = Boolean(
    config.businessRule?.enabled ?? config.ruleEnabled,
  );
  const businessVersion = config.businessRule?.version ?? config.ruleVersion ?? "";
  const pricingSource = normalizePricingSource(
    config.pricingRule?.source ?? (config.feeEnabled ? "engine" : "manual"),
  );
  const pricingVersion =
    config.pricingRule?.feeEngineVersion ?? config.feeVersion ?? "";
  const penaltyEnabled = Boolean(
    config.penaltyRule?.enabled ?? config.penaltyEnabled,
  );
  const penaltyVersion =
    config.penaltyRule?.version ?? config.penaltyVersion ?? "";

  return {
    configMode: normalizeConfigMode(config.configMode),
    rowVersion: config.rowVersion ?? null,
    business: {
      enabled: businessEnabled,
      version: businessVersion,
      checkResult: null,
      checking: false,
      showContent: businessEnabled,
    },
    pricing: {
      enabled:
        pricingSource === "manual" ||
        Boolean(config.feeEnabled ?? pricingVersion),
      version: pricingVersion,
      checkResult: null,
      checking: false,
      showContent: true,
      source: pricingSource,
      manualPricingType: normalizeManualPricingType(
        config.pricingRule?.manualPricingType,
      ),
      manualPricingDetails: normalizeManualPricingDetails(
        config.pricingRule?.details,
      ),
      manualPricingReady: config.pricingRule?.manualPricingReady ?? null,
    },
    penalty: {
      enabled: penaltyEnabled,
      version: penaltyVersion,
      checkResult: null,
      checking: false,
      showContent: penaltyEnabled,
    },
  };
};

export const buildPayloadFromState = (
  state: RuleStateMap,
): ServiceEngineConfigPayload => {
  const businessVersion = trimVersion(state.business.version);
  const pricingVersion = trimVersion(state.pricing.version);
  const penaltyVersion = trimVersion(state.penalty.version);
  const businessRuleVersion =
    state.business.enabled && businessVersion ? businessVersion : null;
  const feeEngineVersion =
    state.pricing.source === "engine" && pricingVersion ? pricingVersion : null;
  const penaltyVersionValue =
    state.penalty.enabled && penaltyVersion ? penaltyVersion : null;
  const manualPricingDetails =
    state.pricing.source === "manual" &&
    state.pricing.manualPricingType === "paid"
      ? state.pricing.manualPricingDetails.map((item) => ({
          userTypeCode: item.userTypeCode,
          amount: item.amount,
          currencyCode: item.currencyCode,
        }))
      : [];

  return {
    configMode: state.configMode,
    businessRuleEnabled: state.business.enabled,
    businessRuleVersion,
    pricingSource: state.pricing.source,
    manualPricingType:
      state.pricing.source === "manual"
        ? state.pricing.manualPricingType
        : null,
    manualPricingDetails,
    feeEngineVersion,
    penaltyRuleEnabled: state.penalty.enabled,
    penaltyVersion: penaltyVersionValue,
    rowVersion: state.rowVersion ?? null,
    ruleEnabled: state.business.enabled,
    ruleVersion: businessRuleVersion,
    feeEnabled: state.pricing.source === "engine" && Boolean(feeEngineVersion),
    feeVersion: feeEngineVersion,
    penaltyEnabled: state.penalty.enabled,
  };
};

export const buildConfigSnapshotFromState = (
  state: RuleStateMap,
): ServiceEngineConfig => {
  const payload = buildPayloadFromState(state);

  return {
    serviceId: 0,
    configMode: payload.configMode,
    rowVersion: payload.rowVersion ?? null,
    businessRule: {
      enabled: payload.businessRuleEnabled,
      version: payload.businessRuleVersion,
    },
    pricingRule: {
      source: payload.pricingSource,
      manualPricingType: payload.manualPricingType,
      feeEngineVersion: payload.feeEngineVersion,
      manualPricingReady: state.pricing.manualPricingReady ?? null,
      details: payload.manualPricingDetails,
    },
    penaltyRule: {
      enabled: payload.penaltyRuleEnabled,
      version: payload.penaltyVersion,
    },
    ruleEnabled: payload.ruleEnabled ?? payload.businessRuleEnabled,
    ruleVersion: payload.ruleVersion ?? payload.businessRuleVersion,
    feeEnabled: payload.feeEnabled ?? false,
    feeVersion: payload.feeVersion ?? payload.feeEngineVersion,
    penaltyEnabled: payload.penaltyEnabled ?? payload.penaltyRuleEnabled,
    penaltyVersion: payload.penaltyVersion,
    serviceFeeAmount: null,
  };
};

const isToggleSectionConfigured = (section: RuleSectionState) => {
  const version = trimVersion(section.version);

  if (!section.enabled) {
    return true;
  }

  return Boolean(version);
};

export const isBusinessRuleReadyToSave = (section: RuleSectionState) =>
  isToggleSectionConfigured(section);

export const isPricingRuleReadyToSave = (section: RulePricingState) => {
  if (section.source === "manual") {
    if (section.manualPricingType === "free") {
      return true;
    }

    return (
      section.manualPricingDetails.length > 0 &&
      section.manualPricingDetails.every(
        (item) =>
          item.userTypeCode &&
          typeof item.amount === "number" &&
          item.amount > 0 &&
          item.amount < 1000000,
      )
    );
  }

  const version = trimVersion(section.version);

  return Boolean(version);
};

export const isPenaltyRuleReadyToSave = (section: RuleSectionState) =>
  isToggleSectionConfigured(section);

export const canSaveRuleConfiguration = (rules: RuleStateMap) =>
  isBusinessRuleReadyToSave(rules.business) &&
  isPricingRuleReadyToSave(rules.pricing) &&
  isPenaltyRuleReadyToSave(rules.penalty);

const shouldApplyEngineReadiness = (
  section: RuleSectionState,
  result?: ServiceEngineReadinessResult | null,
) => {
  const version = trimVersion(section.version);

  if (!section.enabled || !version || !result) {
    return false;
  }

  return trimVersion(result.expectedVersion || "") === version;
};

export const applyReadinessToState = (
  currentState: RuleStateMap,
  readiness: ServicePublishReadinessResponse | null,
): RuleStateMap => ({
  ...currentState,
  business: {
    ...currentState.business,
    checkResult: shouldApplyEngineReadiness(
      currentState.business,
      readiness?.ruleEngine,
    )
      ? readiness?.ruleEngine ?? null
      : null,
  },
  pricing: {
    ...currentState.pricing,
    checkResult:
      currentState.pricing.source === "engine" &&
      shouldApplyEngineReadiness(currentState.pricing, readiness?.feeEngine)
        ? readiness?.feeEngine ?? null
        : null,
  },
  penalty: {
    ...currentState.penalty,
    checkResult: shouldApplyEngineReadiness(
      currentState.penalty,
      readiness?.penaltyEngine,
    )
      ? readiness?.penaltyEngine ?? null
      : null,
  },
});

export const getSummaryText = (result: ServiceEngineReadinessResult | null) =>
  result?.scopeSummaryMarkdown || result?.scopeSummary || "";

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const responseData = error.response.data;

    if (typeof responseData === "string" && responseData.trim()) {
      return responseData.trim();
    }

    if (responseData && typeof responseData === "object") {
      const message =
        (responseData as Record<string, unknown>).message ||
        (responseData as Record<string, unknown>).errorMessage ||
        (responseData as Record<string, unknown>).detail;

      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};
