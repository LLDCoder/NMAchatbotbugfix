/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { Tooltip } from "antd";
import SelfMonitorBadge, {
  type SelfMonitorProgramInfo,
} from "@/components/common/SelfMonitorBadge";
import {
  PROFILE_STATUS_ICONS,
  resolveProfileStatusIconKey,
} from "@/components/common/ApplicationOverviewCards/profileStatusIcon";
import overviewDocumentsIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_documents.svg";
import overviewPartnersIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_partners.svg";

import "./TargetOverviewCard.less";

export type TargetOverviewBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral";
export type TargetOverviewPillTone = "default" | "warning" | "danger";
export type TargetOverviewStatIcon = "documents" | "partners";

type TargetOverviewStatPillTone = Exclude<TargetOverviewPillTone, "default">;

export type TargetOverviewData = {
  profileType: string;
  /** Self-Monitor marker (replaces the retired VIP label); null → no badge. */
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
  statusLabel: string;
  /**
   * Backend profile status code (`profileStatusObj.id`). When present the
   * status renders as the shared icon + tooltip used by Profile Overview;
   * without it the card falls back to the legacy text badge.
   */
  statusCode?: number | null;
  statusTone: TargetOverviewBadgeTone;
  fields: Array<{
    label: string;
    value: string;
    secondary?: string;
  }>;
  statistics: Array<{
    key: string;
    icon: TargetOverviewStatIcon;
    label: string;
    count: number | string;
    tone?: TargetOverviewPillTone;
  }>;
  alerts: Array<{
    key: string;
    label: string;
    count: number | string;
    tone: TargetOverviewStatPillTone;
  }>;
};

export const getTargetOverviewStatusTone = (
  statusLabel?: string | null,
  normalizedTaskStatus?: string
): TargetOverviewBadgeTone => {
  const status = String(
    statusLabel || normalizedTaskStatus || ""
  ).toLowerCase();
  if (!status || status === "-") return "neutral";
  if (status.includes("cancelled") || status.includes("inactive")) {
    return "neutral";
  }
  if (
    status.includes("active") ||
    status.includes("valid") ||
    status.includes("completed") ||
    status.includes("approved")
  ) {
    return "success";
  }
  if (
    status.includes("failed") ||
    status.includes("violation") ||
    status.includes("rejected") ||
    status.includes("expired")
  ) {
    return "danger";
  }
  if (
    status.includes("pending") ||
    status.includes("progress") ||
    status.includes("queued") ||
    status.includes("warning")
  ) {
    return "warning";
  }
  return "neutral";
};

const TARGET_OVERVIEW_STAT_ICON_MAP: Record<TargetOverviewStatIcon, string> = {
  documents: overviewDocumentsIcon,
  partners: overviewPartnersIcon,
};

const getBadgeClassName = (tone: TargetOverviewBadgeTone) => {
  if (tone === "success") return "is-success";
  if (tone === "warning") return "is-warning";
  if (tone === "danger") return "is-danger";
  return "is-neutral";
};

function TargetOverviewInfoField({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="inspection-common-target-overview-field">
      <div className="inspection-common-target-overview-field-label">
        {label}
      </div>
      <div className="inspection-common-target-overview-field-value">
        {value}
      </div>
      {secondary ? (
        <div className="inspection-common-target-overview-field-secondary">
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

function TargetOverviewStatPill({
  icon,
  label,
  count,
  tone = "default",
  onClick,
}: {
  icon?: TargetOverviewStatIcon;
  label: string;
  count: number | string;
  tone?: TargetOverviewPillTone;
  onClick?: () => void;
}) {
  const isClickable = Boolean(onClick);
  const className = `inspection-common-target-overview-pill is-${tone}${
    isClickable ? " is-clickable" : ""
  }`;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={className}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="inspection-common-target-overview-pill-left">
        {icon ? <img src={TARGET_OVERVIEW_STAT_ICON_MAP[icon]} alt="" /> : null}
        <span>{label}</span>
      </div>
      <span className="inspection-common-target-overview-pill-count">
        {count}
      </span>
    </div>
  );
}

function TargetOverviewCard({
  data,
  isExpanded = false,
  onStatisticClick,
  onAlertClick,
}: {
  data: TargetOverviewData;
  isExpanded?: boolean;
  onStatisticClick?: (key: string) => void;
  onAlertClick?: (key: string) => void;
}) {
  const statusIconKey = resolveProfileStatusIconKey(data.statusCode);
  const statusIcon = PROFILE_STATUS_ICONS[statusIconKey];
  const warningAlert =
    data.alerts.find((item) => item.key === "warnings") ?? data.alerts[0];
  const remainingAlerts = data.alerts.filter(
    (item) => item.key !== warningAlert?.key
  );

  return (
    <div
      className={`inspection-common-target-overview ${
        isExpanded ? "is-expanded" : ""
      }`}
    >
      {/* Two rows, as in Profile Overview: the status icon sits beside the
          profile type, and the Self-Monitor badge gets its own line below.
          The legacy text badge is the fallback when the backend status code
          maps to no icon. */}
      <div className="inspection-common-target-overview-heading">
        <div className="inspection-common-target-overview-topline">
          {statusIcon ? (
            <Tooltip placement="top" title={data.statusLabel}>
              <img
                className={`inspection-common-target-overview-status-icon status_id_${statusIconKey}`}
                src={statusIcon}
                alt={data.statusLabel}
              />
            </Tooltip>
          ) : null}
          <span className="inspection-common-target-overview-type">
            {data.profileType}
          </span>
          {statusIcon ? null : (
            <>
              <span className="inspection-common-target-overview-divider" />
              <span
                className={`inspection-common-target-overview-badge ${getBadgeClassName(
                  data.statusTone
                )}`}
              >
                {data.statusLabel}
              </span>
            </>
          )}
        </div>

        <div className="inspection-common-target-overview-tags">
          <SelfMonitorBadge program={data.selfMonitorProgram} />
        </div>
      </div>

      <div className="inspection-common-target-overview-field-list">
        {data.fields.map((field) => (
          <TargetOverviewInfoField
            key={field.label}
            label={field.label}
            value={field.value}
            secondary={field.secondary}
          />
        ))}
      </div>

      <div className="inspection-common-target-overview-pill-list">
        {data.statistics.map((item) => (
          <TargetOverviewStatPill
            key={item.key}
            icon={item.icon}
            label={item.label}
            count={item.count}
            tone={item.tone}
            onClick={
              onStatisticClick ? () => onStatisticClick(item.key) : undefined
            }
          />
        ))}
      </div>

      <div className="inspection-common-target-overview-divider-line" />

      <div className="inspection-common-target-overview-alert-group">
        {warningAlert ? (
          <div className="inspection-common-target-overview-alert-primary">
            <TargetOverviewStatPill
              key={warningAlert.key}
              label={warningAlert.label}
              count={warningAlert.count}
              tone={warningAlert.tone}
              onClick={
                onAlertClick ? () => onAlertClick(warningAlert.key) : undefined
              }
            />
          </div>
        ) : null}
        {remainingAlerts.map((item) => (
          <TargetOverviewStatPill
            key={item.key}
            label={item.label}
            count={item.count}
            tone={item.tone}
            onClick={onAlertClick ? () => onAlertClick(item.key) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export { TargetOverviewCard };
