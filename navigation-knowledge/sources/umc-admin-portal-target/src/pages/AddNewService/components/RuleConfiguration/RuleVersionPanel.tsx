import { Button, Input } from "antd";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PermissionGuard } from "@/components/common";
import type { ServiceEngineReadinessResult } from "@/services/serviceApi";
import { getSummaryText, trimVersion } from "./utils";

export interface RuleVersionPanelProps {
  version: string;
  checking: boolean;
  fieldError?: string;
  required?: boolean;
  checkResult: ServiceEngineReadinessResult | null;
  actionText?: string;
  onVersionChange: (value: string) => void;
  onCheck: () => void;
}

const renderMarkdownSummary = (markdown: string) => {
  return (
    <div className="service-rule-config__markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // eslint-disable-next-line
          p: ({ node, ...props }) => (
            <p className="service-rule-config__markdown-paragraph" {...props} />
          ),
          // eslint-disable-next-line
          table: ({ node, ...props }) => (
            <table className="service-rule-config__markdown-table" {...props} />
          ),
          // eslint-disable-next-line
          code: ({ node, inline, className, children, ...props }) =>
            inline ? (
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              <pre className="service-rule-config__summary-text">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

const RuleVersionPanel = ({
  version,
  checking,
  fieldError,
  required,
  checkResult,
  actionText,
  onVersionChange,
  onCheck,
}: RuleVersionPanelProps) => {
  const { t } = useTranslation();
  const summaryText = getSummaryText(checkResult);
  const blockingReasons = checkResult?.blockingReasons || [];
  const normalizedVersion = trimVersion(version);
  const checkDisabled = checking || !normalizedVersion;

  return (
    <div className="service-rule-config__section-body">
      <label className="service-rule-config__label">
        {t("serviceConfiguration.expanded.version")}
        {required ? (
          <span className="service-rule-config__required-mark" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="service-rule-config__editor-row">
        <Input
          maxLength={20}
          className="service-rule-config__input"
          placeholder={t(
            "addNewService.ruleConfiguration.versionPlaceholder",
          )}
          value={version}
          onChange={(event) => onVersionChange(event.target.value)}
        />
        <PermissionGuard
          permissionCode="Service.ServiceConfiguration.AddNewService.Check"
          routePath="/service-management/service-configuration/addnewservice"
        >
          <Button
            className="service-rule-config__check-button"
            onClick={onCheck}
            loading={checking}
            disabled={checkDisabled}
          >
            {actionText || t("addNewService.ruleConfiguration.check")}
          </Button>
        </PermissionGuard>
      </div>

      {fieldError ? (
        <div className="service-rule-config__field-error">{fieldError}</div>
      ) : null}

      {checkResult ? (
        <div className="service-rule-config__result-card">
          <div className="service-rule-config__result-grid">
            <div className="service-rule-config__result-item">
              <span className="service-rule-config__result-label">
                {t("serviceConfiguration.table.status")}
              </span>
              <span
                className={`service-rule-config__status-pill service-rule-config__status-pill--${String(
                  checkResult.status || "unknown",
                ).toLowerCase()}`}
              >
                {checkResult.status}
              </span>
            </div>
            <div className="service-rule-config__result-item">
              <span className="service-rule-config__result-label">
                {t("addNewService.ruleConfiguration.canPublish")}
              </span>
              <span className="service-rule-config__result-value">
                {checkResult.canPublish
                  ? t("addNewService.loginRequired.yes")
                  : t("addNewService.loginRequired.no")}
              </span>
            </div>
            <div className="service-rule-config__result-item">
              <span className="service-rule-config__result-label">
                {t("addNewService.ruleConfiguration.expectedVersion")}
              </span>
              <span className="service-rule-config__result-value">
                {checkResult.expectedVersion || "-"}
              </span>
            </div>
            <div className="service-rule-config__result-item">
              <span className="service-rule-config__result-label">
                {t("addNewService.ruleConfiguration.activeVersion")}
              </span>
              <span className="service-rule-config__result-value">
                {checkResult.activeVersion || "-"}
              </span>
            </div>
          </div>

          {blockingReasons.length > 0 ? (
            <div className="service-rule-config__blockers">
              <h4 className="service-rule-config__result-title">
                {t("addNewService.ruleConfiguration.blockingReasons")}
              </h4>
              <ul className="service-rule-config__blocker-list">
                {blockingReasons.map((reason) => (
                  <li className="service-rule-config__blocker-item" key={reason}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summaryText ? (
            <div className="service-rule-config__summary">
              <h4 className="service-rule-config__result-title">
                {t("addNewService.ruleConfiguration.summary")}
              </h4>
              <div className="service-rule-config__summary-text">
                {renderMarkdownSummary(summaryText)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default RuleVersionPanel;
