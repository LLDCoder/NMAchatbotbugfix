import type {
  ServiceEngineConfig,
  ServiceEngineReadinessResult,
  ServiceManualPricingType,
  ServicePricingSource,
  ServicePublishReadinessResponse,
} from "@/services/serviceApi";

export interface RuleSectionState {
  enabled: boolean;
  version: string;
  checkResult: ServiceEngineReadinessResult | null;
  checking: boolean;
  showContent?: boolean;
}

export interface RuleManualPricingDetailState {
  userTypeCode: string;
  amount: number | null;
  currencyCode: "AED";
}

export interface RulePricingState extends RuleSectionState {
  source: ServicePricingSource;
  manualPricingType: ServiceManualPricingType;
  manualPricingDetails: RuleManualPricingDetailState[];
  manualPricingReady?: boolean | null;
}

export interface RuleStateMap {
  configMode: "engine" | "simple";
  rowVersion?: string | null;
  business: RuleSectionState;
  pricing: RulePricingState;
  penalty: RuleSectionState;
}

export interface RuleConfigurationSaveResult {
  config: ServiceEngineConfig;
  readiness: ServicePublishReadinessResponse | null;
  requiredRulesConfigured: boolean;
}

export interface RuleConfigurationSaveOptions {
  silentSuccess?: boolean;
}

export interface RuleConfigurationSaveMeta {
  fromSave?: boolean;
}

export interface RuleConfigurationRef {
  save: (
    options?: RuleConfigurationSaveOptions,
  ) => Promise<RuleConfigurationSaveResult | null>;
}

export interface PricingUserTypeOption {
  value: string | number;
  label: string;
}

export interface RuleConfigurationProps {
  serviceCode: string | null;
  userType?: string;
  onRuleSaved?: (
    result: RuleConfigurationSaveResult | null,
    meta?: RuleConfigurationSaveMeta,
  ) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface RuleFieldErrors {
  business?: string;
  pricing?: string;
  penalty?: string;
}
