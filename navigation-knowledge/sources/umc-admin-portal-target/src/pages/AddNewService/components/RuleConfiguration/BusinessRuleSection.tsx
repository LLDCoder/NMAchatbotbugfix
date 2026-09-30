import { Switch } from "antd";
import { useTranslation } from "react-i18next";
import type { RuleSectionState } from "./types";
import RuleVersionPanel from "./RuleVersionPanel";
import { isRuleVersionActive } from "./utils";

export interface BusinessRuleSectionProps {
  state: RuleSectionState;
  fieldError?: string;
  onVersionChange: (value: string) => void;
  onToggle: (checked: boolean) => void;
  onCheck: () => void;
}

const BusinessRuleSection = ({
  state,
  fieldError,
  onVersionChange,
  onToggle,
  onCheck,
}: BusinessRuleSectionProps) => {
  const { t } = useTranslation();
  const active = isRuleVersionActive(state);

  return (
    <section className="service-rule-config__section">
      <div className="service-rule-config__section-header">
        <div className="service-rule-config__title-group">
          <h3 className="service-rule-config__title">
            {t("addNewService.ruleConfiguration.businessRule")}
          </h3>
          {state.enabled ? (
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
        <Switch checked={state.enabled} onChange={onToggle} />
      </div>

      {state.showContent ? (
        <RuleVersionPanel
          version={state.version}
          checking={state.checking}
          fieldError={fieldError}
          required
          checkResult={state.checkResult}
          onVersionChange={onVersionChange}
          onCheck={onCheck}
        />
      ) : null}
    </section>
  );
};

export default BusinessRuleSection;
