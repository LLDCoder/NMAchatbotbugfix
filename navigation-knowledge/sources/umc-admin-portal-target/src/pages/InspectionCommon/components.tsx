/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button, Card, Empty, Tooltip } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  formatDateTime,
  formatNumber,
  getPriorityClassName,
  getPriorityLabel,
  getRiskLevelClassName,
  getRiskLevelLabel,
  getStatusClassName,
  getTaskAddress,
  getTaskLicenseNumber,
  getTaskStatusLabel,
  getTaskTargetName,
  getTaskTargetTypeName,
  getViolationStatusClassName,
  getViolationStatusLabel,
} from "./helpers";

export function InspectionSectionCard({
  title,
  extra,
  children,
  blockClassName = "",
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  blockClassName?: string;
}) {
  return (
    <Card
      className={`inspection-shared-card ${blockClassName}`.trim()}
      bordered={false}
      bodyStyle={{ padding: 24 }}
    >
      <div className="inspection-shared-card__header">
        <div className="inspection-shared-card__title">{title}</div>
        {extra ? (
          <div className="inspection-shared-card__extra">{extra}</div>
        ) : null}
      </div>
      <div className="inspection-shared-card__body">{children}</div>
    </Card>
  );
}

export function InspectionStatCards({ items }: { items: Array<any> }) {
  return (
    <div className="inspection-shared-stats">
      {items.map((item) => (
        <div
          key={item.key || item.label}
          className="inspection-shared-stats__item"
        >
          <div className="inspection-shared-stats__value">
            {formatNumber(item.value)}
          </div>
          <div className="inspection-shared-stats__label">{item.label}</div>
          {item.hint ? (
            <div className="inspection-shared-stats__hint">{item.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function InspectionInfoGrid({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value?: ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={`inspection-shared-info-grid inspection-shared-info-grid--${columns}`}
    >
      {items.map((item) => (
        <div key={item.label} className="inspection-shared-info-grid__item">
          <div className="inspection-shared-info-grid__label">{item.label}</div>
          <div className="inspection-shared-info-grid__value">
            {item.value || "-"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InspectionStatusTag({
  status,
  className = "",
}: {
  status?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`inspection-shared-status-tag ${getStatusClassName(
        status,
      )} ${className}`.trim()}
    >
      {getTaskStatusLabel(status)}
    </span>
  );
}

export function InspectionPriorityTag({
  priority,
}: {
  priority?: string | null;
}) {
  return (
    <span
      className={`inspection-shared-priority-tag inspection-shared-priority-tag--${getPriorityClassName(
        priority,
      )}`}
    >
      {getPriorityLabel(priority)}
    </span>
  );
}

export function InspectionViolationStatusTag({
  status,
  label,
  className = "",
}: {
  status?: string | null;
  label?: ReactNode;
  className?: string;
}) {
  const content = label ?? getViolationStatusLabel(status);

  return (
    <OverflowTooltipText
      className={`inspection-shared-violation-tag inspection-shared-violation-tag--${getViolationStatusClassName(
        status,
      )} ${className}`.trim()}
    >
      {content}
    </OverflowTooltipText>
  );
}

function OverflowTooltipText({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const measureOverflow = useCallback(() => {
    const element = textRef.current;
    if (!element) return;

    setIsOverflowing(
      element.scrollWidth > element.clientWidth ||
      element.scrollHeight > element.clientHeight,
    );
  }, []);

  useEffect(() => {
    measureOverflow();

    const element = textRef.current;
    if (!element) return undefined;

    let frameId = 0;
    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measureOverflow);
    };

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(scheduleMeasure);
      observer.observe(element);
      if (element.parentElement) observer.observe(element.parentElement);

      return () => {
        if (frameId) window.cancelAnimationFrame(frameId);
        observer.disconnect();
      };
    }

    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [children, measureOverflow]);

  return (
    <Tooltip title={isOverflowing ? children : undefined}>
      <span className={className}>
        <span ref={textRef} className="inspection-shared-violation-tag__text">
          {children}
        </span>
      </span>
    </Tooltip>
  );
}

export function InspectionRiskTag({ level }: { level?: string | null }) {
  return (
    <span
      className={`inspection-shared-risk-tag inspection-shared-risk-tag--${getRiskLevelClassName(
        level,
      )}`}
    >
      {getRiskLevelLabel(level)}
    </span>
  );
}

export function InspectionSummaryStrip({
  items,
}: {
  items: Array<{ label: string; value?: ReactNode }>;
}) {
  return (
    <div className="inspection-shared-summary-strip">
      {items.map((item) => (
        <div key={item.label} className="inspection-shared-summary-strip__item">
          <div className="inspection-shared-summary-strip__label">
            {item.label}
          </div>
          <div className="inspection-shared-summary-strip__value">
            {item.value || "-"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InspectionTimeline({ items }: { items?: Array<any> }) {
  const { t } = useTranslation();

  if (!items || items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("inspection.shared.noTimelineEvents")}
      />
    );
  }

  return (
    <div className="inspection-shared-timeline">
      {items.map((item, index) => (
        <div
          key={`${item.titleEn || item.action}-${index}`}
          className="inspection-shared-timeline__item"
        >
          <div className="inspection-shared-timeline__line" />
          <div className="inspection-shared-timeline__dot" />
          <div className="inspection-shared-timeline__content">
            <div className="inspection-shared-timeline__title">
              {item.titleEn || item.action || t("inspection.shared.event")}
            </div>
            <div className="inspection-shared-timeline__time">
              {formatDateTime(item.time || item.actionAt)}
            </div>
            <div className="inspection-shared-timeline__description">
              {item.descriptionEn || item.remark || "-"}
            </div>
            {item.actor || item.operator ? (
              <div className="inspection-shared-timeline__actor">
                {item.actor || item.operator}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InspectionRiskFactors({ riskProfile }: { riskProfile?: any }) {
  const { t } = useTranslation();
  const factors =
    riskProfile?.riskFactors || riskProfile?.primaryRiskFactors || [];

  return (
    <div className="inspection-shared-risk-panel">
      <div className="inspection-shared-risk-panel__summary">
        <div className="inspection-shared-risk-panel__score">
          <span className="inspection-shared-risk-panel__score-value">
            {formatNumber(riskProfile?.riskScore)}
          </span>
          <span className="inspection-shared-risk-panel__score-label">
            {t("inspection.taskDetail.riskScore")}
          </span>
        </div>
        <InspectionRiskTag level={riskProfile?.riskLevel} />
      </div>
      <div className="inspection-shared-risk-panel__list">
        {factors.map((factor: any, index: number) => (
          <div
            key={`${factor.factorType || factor.factorName}-${index}`}
            className="inspection-shared-risk-panel__item"
          >
            <div className="inspection-shared-risk-panel__item-title">
              {factor.factorNameEn || factor.factorName || factor.factorType}
            </div>
            <div className="inspection-shared-risk-panel__item-description">
              {factor.details ||
                factor.description ||
                t("inspection.shared.noAdditionalDetail")}
            </div>
            {factor.contributionScore !== undefined ? (
              <div className="inspection-shared-risk-panel__item-score">
                {t("inspection.shared.contribution", {
                  value: formatNumber(factor.contributionScore),
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {riskProfile?.lastAssessmentDate ? (
        <div className="inspection-shared-risk-panel__footer">
          {t("inspection.shared.lastAssessment", {
            value: formatDateTime(riskProfile.lastAssessmentDate),
          })}
        </div>
      ) : null}
    </div>
  );
}

export function InspectionTargetOverview({ target }: { target?: any }) {
  const { t } = useTranslation();

  return (
    <div className="inspection-shared-target-overview">
      <div className="inspection-shared-target-overview__hero">
        <div>
          <div className="inspection-shared-target-overview__name">
            {getTaskTargetName({ inspectionTarget: target })}
          </div>
          <div className="inspection-shared-target-overview__meta">
            {getTaskTargetTypeName({ inspectionTarget: target })}
          </div>
        </div>
        <div className="inspection-shared-target-overview__badge">
          {getTaskLicenseNumber({ inspectionTarget: target })}
        </div>
      </div>
      <InspectionInfoGrid
        columns={1}
        items={[
          {
            label: t("inspection.shared.economicActivity"),
            value: target?.economicActivityName || "-",
          },
          {
            label: t("inspection.taskDetail.address"),
            value: getTaskAddress({ inspectionTarget: target }),
          },
          {
            label: t("inspection.shared.emirate"),
            value: target?.address?.emirateNameEn || "-",
          },
          {
            label: t("inspection.shared.coordinates"),
            value:
              target?.address?.latitude && target?.address?.longitude
                ? `${target.address.latitude}, ${target.address.longitude}`
                : "-",
          },
        ]}
      />
    </div>
  );
}

export function InspectionReasonList({ reasons }: { reasons?: Array<any> }) {
  const { t } = useTranslation();

  if (!reasons || reasons.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("inspection.shared.noItems")}
      />
    );
  }

  return (
    <div className="inspection-shared-reason-list">
      {reasons.map((reason, index) => (
        <div
          key={`${reason.violationId || reason.violationName || index}`}
          className="inspection-shared-reason-list__item"
        >
          <div className="inspection-shared-reason-list__head">
            <div className="inspection-shared-reason-list__title">
              {reason.violationName ||
                reason.title ||
                reason.descriptionEn ||
                t("inspection.shared.reason")}
            </div>
            {reason.status ? (
              <InspectionViolationStatusTag status={reason.status} />
            ) : null}
          </div>
          <div className="inspection-shared-reason-list__meta">
            {reason.severity || reason.level
              ? t("inspection.shared.severity", {
                  value: reason.severity || reason.level,
                })
              : t("inspection.shared.severityPending")}
            {reason.penaltyBasis ? ` • ${reason.penaltyBasis}` : ""}
          </div>
          {reason.notes || reason.description ? (
            <div className="inspection-shared-reason-list__notes">
              {reason.notes || reason.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function InspectionEmptyAction({
  title,
  description,
  buttonText,
  onClick,
}: {
  title: string;
  description: string;
  buttonText?: string;
  onClick?: () => void;
}) {
  return (
    <div className="inspection-shared-empty-action">
      <div className="inspection-shared-empty-action__title">{title}</div>
      <div className="inspection-shared-empty-action__description">
        {description}
      </div>
      {buttonText ? (
        <Button type="primary" onClick={onClick}>
          {buttonText}
        </Button>
      ) : null}
    </div>
  );
}
