import { Input } from "antd";
import { useTranslation } from "react-i18next";
import FreeIcon from "@/assets/images/ruleConfig-money.svg";
import PaidIcon from "@/assets/images/ruleConfig-paid.svg";
import AED from "@/assets/icons/Aed";
import type {
  PricingUserTypeOption,
  RuleManualPricingDetailState,
  RulePricingState,
} from "./types";
import RuleVersionPanel from "./RuleVersionPanel";
import { isRuleVersionActive } from "./utils";

type PricingConfigMode = "manual" | "engine";
type PricingType = "free" | "paid";

const PRICING_CONFIG_TABS: {
  key: PricingConfigMode;
  labelKey: string;
}[] = [
  {
    key: "manual",
    labelKey: "addNewService.ruleConfiguration.manualConfiguration",
  },
  {
    key: "engine",
    labelKey: "addNewService.ruleConfiguration.feeEngineConfiguration",
  },
];

const PRICING_TYPE_OPTIONS: {
  key: PricingType;
  titleKey: string;
  descriptionKey: string;
  icon: string;
}[] = [
  {
    key: "free",
    titleKey: "addNewService.ruleConfiguration.free",
    descriptionKey: "addNewService.ruleConfiguration.freeDescription",
    icon: FreeIcon,
  },
  {
    key: "paid",
    titleKey: "addNewService.ruleConfiguration.paid",
    descriptionKey: "addNewService.ruleConfiguration.paidDescription",
    icon: PaidIcon,
  },
];

export interface PricingRuleSectionProps {
  state: RulePricingState;
  fieldError?: string;
  serviceFeeAmount?: number | null;
  selectedUserTypes?: PricingUserTypeOption[];
  onSourceChange: (value: PricingConfigMode) => void;
  onManualPricingTypeChange: (value: PricingType) => void;
  onManualPricingDetailChange: (
    userTypeCode: string,
    amount: number | null,
  ) => void;
  onVersionChange: (value: string) => void;
  onCheck: () => void;
}

const DECIMAL_FEE_PATTERN = /^\d*(\.\d*)?$/;

const parseFeeInput = (raw: string): number | null => {
  if (!raw || raw === ".") {
    return null;
  }

  const nextValue = Number(raw);

  return Number.isFinite(nextValue) ? nextValue : null;
};

const getDetailAmount = (
  details: RuleManualPricingDetailState[],
  userTypeCode: string,
) => {
  const matched = details.find((item) => item.userTypeCode === userTypeCode);

  return matched?.amount ?? null;
};

const PricingRuleSection = ({
  state,
  fieldError,
  serviceFeeAmount,
  selectedUserTypes = [],
  onSourceChange,
  onManualPricingTypeChange,
  onManualPricingDetailChange,
  onVersionChange,
  onCheck,
}: PricingRuleSectionProps) => {
  const { t } = useTranslation();
  const active =
    state.source === "engine" ? isRuleVersionActive(state) : state.enabled;

  const handleUserTypeFeeChange = (userTypeCode: string, raw: string) => {
    if (!DECIMAL_FEE_PATTERN.test(raw)) {
      return;
    }

    onManualPricingDetailChange(userTypeCode, parseFeeInput(raw));
  };

  return (
    <section className="service-rule-config__section">
      <div className="service-rule-config__section-header pricing-rule-section__header">
        <div className="service-rule-config__title-group">
          <h3 className="service-rule-config__title">
            {t("addNewService.ruleConfiguration.pricingRule")}
          </h3>
          {state.source === "engine" ? (
            <span
              className={`service-rule-config__badge ${
                active
                  ? "service-rule-config__badge--active"
                  : "service-rule-config__badge--inactive"
              }`}
            >
              {active
                ? t("customStatusTag.active")
                : t("customStatusTag.inactive")}
            </span>
          ) : null}
        </div>
        <div className="service-rule-config__section-controls-tab">
          <div className="service-rule-config__config-tab-list" role="tablist">
            {PRICING_CONFIG_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={state.source === tab.key}
                className={`service-rule-config__config-tab-item${
                  state.source === tab.key
                    ? " service-rule-config__config-tab-item--active"
                    : ""
                }`}
                onClick={() => onSourceChange(tab.key)}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state.source === "manual" ? (
        <div className="service-rule-config__pricing-options">
          {PRICING_TYPE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`service-rule-config__pricing-option${
                state.manualPricingType === option.key
                  ? " service-rule-config__pricing-option--selected"
                  : ""
              }`}
              onClick={() => onManualPricingTypeChange(option.key)}
            >
              <div className="service-rule-config__pricing-option-content">
                <div className="service-rule-config__pricing-option-icon">
                  <img src={option.icon} alt="" />
                </div>
                <div className="service-rule-config__pricing-option-text">
                  <div className="service-rule-config__pricing-option-title">
                    {t(option.titleKey)}
                  </div>
                  <div className="service-rule-config__pricing-option-desc">
                    {t(option.descriptionKey)}
                  </div>
                </div>
              </div>
              <span
                className="service-rule-config__pricing-option-radio"
                aria-hidden="true"
              >
                {state.manualPricingType === option.key ? (
                  <span className="service-rule-config__pricing-option-radio-dot" />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {state.source === "manual" && state.manualPricingType === "free" ? (
        <div className="service-rule-config__free-summary">
          <div className="service-rule-config__free-summary-divider" />
          <div className="service-rule-config__free-summary-row">
            <span className="service-rule-config__free-summary-label">
              {t("addNewService.ruleConfiguration.freeSummary")}
            </span>
            <span className="service-rule-config__free-summary-fee">
              {t("addNewService.fields.serviceFee")}:{" "}
              <span className="service-rule-config__free-summary-fee-value">
                {serviceFeeAmount ?? 0} AED
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {state.source === "manual" && state.manualPricingType === "paid" ? (
        <div className="service-rule-config__paid-fee">
          <div className="service-rule-config__free-summary-divider" />
          <h4 className="service-rule-config__paid-fee-title">
            {t("addNewService.ruleConfiguration.feeAmountByUserType")}
          </h4>
          {selectedUserTypes.length ? (
            <div className="service-rule-config__paid-fee-table">
              <div className="service-rule-config__paid-fee-header">
                <span className="service-rule-config__paid-fee-header-cell">
                  {t(
                    "addNewService.ruleConfiguration.userTypeFromServiceInformation",
                  )}
                </span>
                <span className="service-rule-config__paid-fee-header-cell service-rule-config__paid-fee-header-cell--fee">
                  {t("addNewService.ruleConfiguration.fee")}
                  <span className="service-rule-config__paid-fee-required">
                    *
                  </span>
                  <span className="service-rule-config__paid-fee-currency">
                    (<AED withParentheses={false} />)
                  </span>
                </span>
              </div>
              {selectedUserTypes.map((userType) => {
                const userTypeCode = String(userType.value ?? "").trim();
                const amount = getDetailAmount(
                  state.manualPricingDetails,
                  userTypeCode,
                );

                return (
                  <div
                    key={userTypeCode || userType.label}
                    className="service-rule-config__paid-fee-row"
                  >
                    <span className="service-rule-config__paid-fee-label">
                      {userType.label}
                    </span>
                    <Input
                      className="service-rule-config__paid-fee-input"
                      value={amount ?? ""}
                      maxLength={9}
                      onChange={(event) =>
                        handleUserTypeFeeChange(
                          userTypeCode,
                          event.target.value,
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="service-rule-config__paid-fee-empty">
              {t("addNewService.ruleConfiguration.noUserTypes")}
            </p>
          )}
        </div>
      ) : null}

      {fieldError ? (
        <div className="service-rule-config__field-error">{fieldError}</div>
      ) : null}

      {state.source === "engine" && (
        <RuleVersionPanel
          version={state.version}
          checking={state.checking}
          fieldError={fieldError}
          required
          checkResult={state.checkResult}
          actionText={t("addNewService.ruleConfiguration.saveAndActivate")}
          onVersionChange={onVersionChange}
          onCheck={onCheck}
        />
      )}
    </section>
  );
};

export default PricingRuleSection;
