import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Empty, Input, Spin, Upload } from "antd";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import type { RcFile } from "antd/es/upload";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CustomMessage,
  DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
  createOverviewQuickNavTarget,
  type OverviewQuickNavTarget as SharedOverviewQuickNavTarget,
} from "@/components/common";
import { KEEP_ALIVE_RESTORE_STATE_KEY } from "@/components/KeepAlive/constants";
import { readTeamManagementReturnLocation } from "@/pages/TeamManagement/teamManagementReturnState";
import {
  createDashboardReturnLocation,
  readDashboardReturnState,
} from "@/pages/Dashboard/dashboardReturnState";
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from "@/pages/TeamManagement/components/TeamTaskDetailReassignAction";
import FullScreen from "@/components/common/ApplicationOverviewCards/FullScreen/FullScreen";
import SelfMonitorBadge from "@/components/common/SelfMonitorBadge";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { INSPECTION_QUERY_KEYS } from "@/pages/InspectionCommon/constants";
import {
  buildInspectionPath,
  getViolationStatusClassName,
  getViolationStatusLabel,
  normalizeViolationStatus,
} from "@/pages/InspectionCommon/helpers";
import { getInspectionViolationBasicDetail } from "@/services/inspection";
import {
  cancelAllAppealViolationItems,
  changeInspectionAppealStatus,
  createInspectionAppealInternalNote,
  getInspectionAppealDetail,
  getInspectionAppealMessages,
  getInspectionAppealTimeline,
  type InspectionAppealMessageDto,
  type InspectionAppealTimelineItemDto,
  processInspectionAppeal,
  replyInspectionAppealToCustomer,
  sendBackInspectionAppeal,
} from "@/services/inspectionAppeals";
import AppealAttachments from "@/pages/CustomerAppeals/components/AppealAttachments";
import AppealDepartmentTransferModal from "@/pages/CustomerAppeals/components/AppealDepartmentTransferModal";
import AppealStatusModal from "@/pages/CustomerAppeals/components/AppealStatusModal";
import {
  APPEAL_ROLE_CONFIG,
  DEFAULT_APPEAL_VIEW_ROLE,
  type AppealRoleConfig,
} from "@/pages/CustomerAppeals/roleConfig";
import {
  useCanOpenCustomerAppealViolationDetail,
  useCustomerAppealsAccess,
} from "@/pages/CustomerAppeals/access";
import {
  canChangeStatus as canOpenChangeStatus,
  buildFallbackAppealDetailRecord,
  isAppealStatusAllowed,
  mapAppealAttachmentToWriteDto,
  mapAppealMessages,
  mapAppealTimeline,
  mapDepartmentCode,
  mapRecommendationToTypeId,
  mergeAppealDetail,
  resolveAllowedFinalStatuses,
} from "@/pages/CustomerAppeals/apiAdapter";
import {
  APPEAL_ACTION_ICON_MAP,
  APPEAL_DETAIL_TOP_ICON_MAP,
  buildAppealAttachmentAccessUrl,
  APPEAL_STATUS_ID_MAP,
  formatAppealDateTime,
  formatAppealDateTimeMinute,
  getAppealDecisionTranslationKey,
  getAppealDepartmentTranslationKey,
  getAppealReasonTranslationKey,
  getAppealSlaLabel,
  getAppealStatusClassName,
  getAppealStatusTranslationKey,
} from "@/pages/CustomerAppeals/utils";
import {
  APPEAL_ATTACHMENT_ACCEPT,
  APPEAL_MESSAGE_ATTACHMENT_MAX_COUNT,
  getAppealAttachmentValidationError,
  useAppealAttachmentUploadLock,
  uploadAppealAttachmentFile,
} from "@/pages/CustomerAppeals/upload";
import type {
  AppealAttachment,
  AppealAudience,
  AppealComment,
  AppealDepartmentProcessPayload,
  AppealHandler,
  AppealRecord,
  AppealSendBackPayload,
  AppealStatusChangePayload,
  AppealTimelineItem,
  AppealTimelineTextSegment,
  AppealViewRole,
} from "@/pages/CustomerAppeals/types";
import AttachmentListModal from "./components/AttachmentListModal";
import AttachmentsDisplay from "./components/AttachmentsDisplay";
import cardHeaderCollapseIcon from "@/pages/CustomerRefundsDetails/assets/icons/card_header_collapse.svg";
import cardHeaderExpandIcon from "@/pages/CustomerRefundsDetails/assets/icons/card_header_expand.svg";
import overviewAppealIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_appeal.svg";
import overviewDocumentsIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_documents.svg";
import overviewHistoricalApplicationsIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_historical_applications.svg";
import overviewHistoricalTicketsIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_historical_tickets.svg";
import overviewPartnersIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_partners.svg";
import overviewRefundIcon from "@/pages/CustomerRefundsDetails/assets/icons/overview_refund.svg";
import timelineActionIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_action.svg";
import timelineAttachmentIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_attachment.svg";
import timelineCalendarIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_calendar.svg";
import timelineUserIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_user.svg";
import type {
  IEstablishmentOverview,
  IProfileAndApplicantResponse,
  IUserIndividualProfile,
} from "@/services/userProfile";
import {
  getEstablishment,
  getUserIndividual,
  getUserProfileRelateApps,
  profileAndApplicant,
} from "@/services/userProfile";
import type { IRelateAppsResponse } from "@/services/tickets";
import {
  getAdminCustomerServiceRefundTickets,
  getAdminRefundTickets,
  type AdminRefundTicketListItemDto,
} from "@/services/refunds";
import "./index.less";

const CUSTOMER_APPEALS_PATH = "/happiness/appeals";
const CUSTOMER_APPEALS_VIOLATION_DETAIL_PATH =
  "/happiness/appeals/violationDetails";
const CUSTOMER_APPEALS_VIOLATION_ROUTE_FROM = "appeals";
const TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE = "teamManagementTask";
const TEAM_MANAGEMENT_TASK_TITLE_KEY = "menu.taskDetails";
const TEAM_MANAGEMENT_LIST_PATH_BY_SCOPE = {
  licensing: "/licensing/team-management",
  content: "/content/team-management",
  customer: "/happiness/team-management",
  inspection: "/inspection/tasks",
} as const;

type TeamManagementDetailScope =
  keyof typeof TEAM_MANAGEMENT_LIST_PATH_BY_SCOPE;

function getTeamManagementDetailScope(searchParams: URLSearchParams) {
  if (
    searchParams.get("breadcrumbMode") !==
    TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE
  ) {
    return null;
  }

  const scope = searchParams.get("teamManagementScope");
  if (
    scope &&
    Object.prototype.hasOwnProperty.call(
      TEAM_MANAGEMENT_LIST_PATH_BY_SCOPE,
      scope,
    )
  ) {
    return scope as TeamManagementDetailScope;
  }

  return null;
}

const getRefundDetailsViewRole = (appealViewRole: AppealViewRole) => (
  appealViewRole === "customer_happiness" ? "customer_happiness" : "business_department"
);

const RELATED_REFUND_LOOKUP_PAGE_SIZE = 20;

function getAdminRefundTicketItems(response: unknown): AdminRefundTicketListItemDto[] {
  const payload = (response as { data?: unknown } | null)?.data ?? response;
  const items = (payload as { items?: AdminRefundTicketListItemDto[] } | null)?.items;
  return Array.isArray(items) ? items : [];
}

async function resolveRelatedRefundId(
  refundNo: string,
  appealViewRole: AppealViewRole,
) {
  const trimmedRefundNo = String(refundNo ?? "").trim();
  if (!trimmedRefundNo) return undefined;

  const refundViewRole = getRefundDetailsViewRole(appealViewRole);
  const requestFns =
    refundViewRole === "customer_happiness"
      ? [getAdminCustomerServiceRefundTickets, getAdminRefundTickets]
      : [getAdminRefundTickets, getAdminCustomerServiceRefundTickets];

  for (const requestFn of requestFns) {
    for (const isCompleted of [false, true]) {
      try {
        const response = await requestFn(
          {
            SeachKey: trimmedRefundNo,
            IsCompleted: isCompleted,
            PageSize: RELATED_REFUND_LOOKUP_PAGE_SIZE,
            PageIndex: 1,
          },
          { skipErrorMessage: true },
        );
        const matchedItem = getAdminRefundTicketItems(response).find(
          (item) => String(item.applicationNo ?? "").trim() === trimmedRefundNo,
        );
        if (matchedItem?.refundId) return matchedItem.refundId;
      } catch {
        // Keep the original refundNo-only navigation as a fallback.
      }
    }
  }

  return undefined;
}

function buildAppealViolationDetailPath({
  violationId,
  violationNo,
}: {
  violationId?: number | string;
  violationNo?: string;
}) {
  return buildInspectionPath(CUSTOMER_APPEALS_VIOLATION_DETAIL_PATH, "", {
    [INSPECTION_QUERY_KEYS.from]: CUSTOMER_APPEALS_VIOLATION_ROUTE_FROM,
    [INSPECTION_QUERY_KEYS.violationId]: violationId,
    [INSPECTION_QUERY_KEYS.violationNo]: violationNo,
  });
}

const OVERVIEW_STAT_ICON_MAP = {
  documents: overviewDocumentsIcon,
  partners: overviewPartnersIcon,
  historicalApplications: overviewHistoricalApplicationsIcon,
  historicalTickets: overviewHistoricalTicketsIcon,
  refund: overviewRefundIcon,
  appeal: overviewAppealIcon,
} as const;

type ProfileAndApplicantOverviewData = IProfileAndApplicantResponse;
type AppealResolvedProfileType = "Individual" | "Commercial";

type OverviewExpandCard = "applicant" | "profile" | "application";
type OverviewQuickNavTarget = SharedOverviewQuickNavTarget;

const APPEAL_DEPARTMENTS: AppealHandler[] = [
  {
    id: "LicensingDepartment",
    name: "Licensing Department",
    department: "Licensing Department",
    departmentCode: "LicensingDepartment",
  },
  {
    id: "ContentDepartment",
    name: "Content Department",
    department: "Content Department",
    departmentCode: "ContentDepartment",
  },
  {
    id: "InspectionDepartment",
    name: "Inspection Department",
    department: "Inspection Department",
    departmentCode: "InspectionDepartment",
  },
];

function getDisplayValue(value?: string | number | null, fallback = "-") {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getPositiveNumberId(
  ...values: Array<string | number | null | undefined>
) {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }
  return undefined;
}

function unwrapRecordPayload(
  response?: Record<string, unknown> | { data?: unknown } | null,
) {
  if (!response || typeof response !== "object") return null;
  const payload = "data" in response ? response.data : response;
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

function getAppealViolationProfileId(
  violationPayload?: Record<string, unknown> | null,
) {
  return getPositiveNumberId(
    violationPayload?.profileId as string | number | null | undefined,
    violationPayload?.userProfileId as string | number | null | undefined,
  );
}

function resolveAppealProfileTypeFromUserTypeId(
  value?: number | string | null,
): AppealResolvedProfileType | undefined {
  const normalizedText = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalizedText === "individual") return "Individual";
  if (normalizedText === "commercial") return "Commercial";

  const normalizedValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : undefined;

  if (
    normalizedValue === undefined ||
    !Number.isFinite(normalizedValue) ||
    normalizedValue <= 0
  ) {
    return undefined;
  }

  if (normalizedValue === 1) return "Individual";
  return "Commercial";
}

function getFirstNonEmptyText(
  ...values: Array<string | number | null | undefined>
) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text && text !== "-") return text;
  }
  return "";
}

function getOverviewStatusTone(
  label?: string | null,
): AppealRecord["profileOverview"]["statusTone"] {
  const text = String(label ?? "").trim().toLowerCase();
  if (!text || text === "-") return "neutral";
  if (
    /approved|active|valid|success|verified|completed|paid/.test(text)
  ) {
    return "success";
  }
  if (
    /pending|review|processing|warning|submitted|progress|hold/.test(text)
  ) {
    return "warning";
  }
  if (
    /reject|inactive|expired|cancel|suspend|blocked|failed|invalid/.test(text)
  ) {
    return "danger";
  }
  return "neutral";
}

function getOverviewBadgeClassName(
  tone: AppealRecord["profileOverview"]["statusTone"],
) {
  if (tone === "success") return "is-success";
  if (tone === "warning" || tone === "gold") return "is-warning";
  if (tone === "danger") return "is-danger";
  return "is-neutral";
}

const RELATED_VIOLATION_STATUS_SET = new Set([
  "UNDER_APPEAL",
  "PAID",
  "PENDING_PAYMENT",
  "CANCELLED",
  "WARNING_ISSUED",
]);

function RelatedViolationStatusTag({
  status,
}: {
  status?: string | null;
}) {
  const displayStatus = normalizeViolationStatus(status);
  if (!RELATED_VIOLATION_STATUS_SET.has(displayStatus)) return null;

  return (
    <span
      className={`appeal-related-status-tag appeal-related-status-tag--${getViolationStatusClassName(
        displayStatus,
      )}`}
    >
      {getViolationStatusLabel(displayStatus)}
    </span>
  );
}

function DetailTopItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="appeal-detail-top-item">
      <div className="appeal-detail-top-item__icon-background">
        <img className="appeal-detail-top-item__icon" src={icon} alt="" />
      </div>
      <div className="appeal-detail-top-item__content">
        <div className="appeal-detail-top-item__label">{label}</div>
        <div className="appeal-detail-top-item__value">{value}</div>
      </div>
    </div>
  );
}

function RightSideCardHeader({
  title,
  open,
  onToggle,
  showExpandIcon = false,
  onExpand,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  showExpandIcon?: boolean;
  onExpand?: () => void;
}) {
  return (
    <button
      type="button"
      className="appeal-side-card__header appeal-side-card__header--figma"
      onClick={onToggle}
    >
      <span>{title}</span>
      <span className="appeal-side-card__header-actions">
        <span
          className={`appeal-side-card__chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        >
          <img src={cardHeaderCollapseIcon} alt="" />
        </span>
        {showExpandIcon && onExpand ? (
          <span
            className="appeal-side-card__expand"
            onClick={(event) => {
              event.stopPropagation();
              onExpand();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onExpand();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <img src={cardHeaderExpandIcon} alt="" />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function OverviewInfoField({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="appeal-overview-field">
      <div className="appeal-overview-field__label">{label}</div>
      <div className="appeal-overview-field__value">{value}</div>
      {secondary ? (
        <div className="appeal-overview-field__secondary">{secondary}</div>
      ) : null}
    </div>
  );
}

function OverviewStatPill({
  icon,
  label,
  count,
  tone = "default",
  onClick,
}: {
  icon: keyof typeof OVERVIEW_STAT_ICON_MAP;
  label: string;
  count: number;
  tone?: "default" | "warning" | "danger";
  onClick?: () => void;
}) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`appeal-overview-pill is-${tone} ${
        onClick ? "is-clickable" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="appeal-overview-pill__left">
        <img src={OVERVIEW_STAT_ICON_MAP[icon]} alt="" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <span className="appeal-overview-pill__count">{count}</span>
    </div>
  );
}

function ApplicantOverviewCard({
  fullName,
  email,
  mobileNumber,
}: {
  fullName: string;
  email: string;
  mobileNumber: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="appeal-side-card__content appeal-overview-content">
      <OverviewInfoField
        label={t("Customer.customerAppealsDetails.overview.fullName")}
        value={fullName}
      />
      <OverviewInfoField
        label={t("Customer.customerAppealsDetails.overview.email")}
        value={email}
      />
      <OverviewInfoField
        label={t("Customer.customerAppealsDetails.overview.mobileNumber")}
        value={mobileNumber}
      />
    </div>
  );
}

function ProfileOverviewCard({
  data,
  relatedViolation,
  onStatisticClick,
  onAlertClick,
  onRelatedViolationClick,
}: {
  data: AppealRecord["profileOverview"];
  relatedViolation?: AppealRecord["relatedViolation"];
  onStatisticClick?: (key: string) => void;
  onAlertClick?: (key: string) => void;
  onRelatedViolationClick?: (violationNo: string) => void;
}) {
  const { t } = useTranslation();
  const warningAlert =
    data.alerts.find((item) => item.key === "warnings") ?? data.alerts[0];
  const remainingAlerts = data.alerts.filter(
    (item) => item.key !== warningAlert?.key,
  );

  const renderAlertPill = (
    item: AppealRecord["profileOverview"]["alerts"][number],
  ) => (
    <div
      className={`appeal-overview-pill is-${item.tone} ${
        onAlertClick ? "is-clickable" : ""
      }`}
      key={item.key}
      onClick={() => onAlertClick?.(item.key)}
      role={onAlertClick ? "button" : undefined}
      tabIndex={onAlertClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onAlertClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAlertClick(item.key);
        }
      }}
    >
      <div className="appeal-overview-pill__left">
        <span>{item.label}</span>
      </div>
      <span className="appeal-overview-pill__count">{item.count}</span>
    </div>
  );

  return (
    <div className="appeal-side-card__content appeal-overview-content">
      <div className="appeal-profile-overview__topline">
        <span className="appeal-profile-overview__type">{data.profileType}</span>
        <span className="appeal-profile-overview__divider" />
        <SelfMonitorBadge program={data.selfMonitorProgram} />
        <span
          className={`appeal-profile-badge ${getOverviewBadgeClassName(
            data.statusTone,
          )}`}
        >
          {data.statusLabel}
        </span>
      </div>

      <div className="appeal-overview-field-list">
        {data.fields.map((field) => (
          <OverviewInfoField
            key={`${field.label}-${field.value}`}
            label={field.label}
            value={field.value}
            secondary={field.secondary}
          />
        ))}
      </div>

      <div className="appeal-overview-pill-list">
        {data.statistics.map((item) => (
          <OverviewStatPill
            key={item.key}
            icon={item.icon}
            label={item.label}
            count={item.count}
            tone={item.tone}
            onClick={() => onStatisticClick?.(item.key)}
          />
        ))}
      </div>

      <div className="appeal-overview-divider" />

      <div className="appeal-overview-alert-group">
        {warningAlert || relatedViolation ? (
          <div className="appeal-overview-alert-group__primary">
            {warningAlert ? renderAlertPill(warningAlert) : null}
            {relatedViolation ? (
              <div className="appeal-related-section">
                <div className="appeal-related-section__title">
                  {t("Customer.customerAppealsDetails.overview.relatedViolation")}
                </div>
                <div className="appeal-related-card">
                  <div className="appeal-related-card__top">
                    {onRelatedViolationClick &&
                    getDisplayValue(relatedViolation.violationNo) !== "-" ? (
                      <button
                        type="button"
                        className="appeal-related-card__reference is-link"
                        onClick={() =>
                          onRelatedViolationClick(
                            getDisplayValue(relatedViolation.violationNo),
                          )
                        }
                      >
                        {getDisplayValue(relatedViolation.violationNo)}
                      </button>
                    ) : (
                      <div className="appeal-related-card__reference">
                        {getDisplayValue(relatedViolation.violationNo)}
                      </div>
                    )}
                    <RelatedViolationStatusTag status={relatedViolation.status} />
                  </div>
                  <div className="appeal-overview-field-list appeal-overview-field-list--compact">
                    <OverviewInfoField
                      label={t("Customer.customerAppealsDetails.overview.violationType")}
                      value={getDisplayValue(relatedViolation.violationType)}
                    />
                    <OverviewInfoField
                      label={t("Customer.customerAppealsDetails.overview.violationDate")}
                      value={relatedViolation.violationDate
                        ? formatAppealDateTime(relatedViolation.violationDate)
                        : "-"}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {remainingAlerts.map(renderAlertPill)}
      </div>
    </div>
  );
}

function ApplicationOverviewCard({
  data,
  onStatisticClick,
}: {
  data: AppealRecord["applicationOverview"];
  onStatisticClick?: (key: string) => void;
}) {
  return (
    <div className="appeal-side-card__content appeal-overview-content">
      <div className="appeal-overview-pill-list">
        {data.statistics.map((item) => (
          <OverviewStatPill
            key={item.key}
            icon={item.icon}
            label={item.label}
            count={item.count}
            tone={item.tone}
            onClick={() => onStatisticClick?.(item.key)}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineSegments({
  segments,
}: {
  segments?: AppealTimelineTextSegment[];
}) {
  const { t } = useTranslation();

  if (!segments?.length) return null;

  const translateSegmentText = (segment: AppealTimelineTextSegment) => {
    const { text } = segment;
    if (segment.i18nKey) {
      return t(segment.i18nKey, {
        ...segment.i18nValues,
        defaultValue: text,
      });
    }

    const normalized = text.trim();
    const decisionKey = getAppealDecisionTranslationKey(normalized);
    if (decisionKey) {
      return t(decisionKey, { defaultValue: text });
    }
    if (normalized === "Department Recommendation:") {
      return t(
        "Customer.customerAppealsDetails.timeline.departmentRecommendationPrefix",
      );
    }
    if (normalized === "Problem Cause:") {
      return t("Customer.customerAppealsDetails.timeline.problemCausePrefix");
    }
    return text;
  };

  return (
    <span className="appeal-timeline__inline-text">
      {segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={[
            "appeal-timeline__segment",
            segment.breakBefore ? "appeal-timeline__segment--break" : "",
            segment.tone ? `is-${segment.tone}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {translateSegmentText(segment)}
        </span>
      ))}
    </span>
  );
}

function TimelineMetaRow({
  icon,
  children,
  indented = false,
}: {
  icon?: string;
  children: React.ReactNode;
  indented?: boolean;
}) {
  return (
    <div
      className={`appeal-timeline__meta-row ${
        indented ? "appeal-timeline__meta-row--indented" : ""
      }`}
    >
      {icon ? <img src={icon} alt="" /> : null}
      <div className="appeal-timeline__meta-text">{children}</div>
    </div>
  );
}

function AppealTimelineCard({
  items,
  onOpenAttachments,
  onOpenRefund,
  open,
  onToggle,
}: {
  items: AppealTimelineItem[];
  onOpenAttachments: (item: AppealTimelineItem) => void;
  onOpenRefund: (item: AppealTimelineItem) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const translateDepartment = (department?: string | null) => {
    const key = getAppealDepartmentTranslationKey(department);
    return key
      ? t(key, { defaultValue: department || "-" })
      : department || "-";
  };
  const translateReferenceLabel = (label?: string) => {
    if (label?.trim() === "Refund No.") {
      return t("Customer.customerAppealsDetails.timeline.refundNo");
    }
    return label;
  };

  return (
    <div className="appeal-timeline-card">
      <button
        type="button"
        className="appeal-timeline-card__header"
        onClick={onToggle}
      >
        <span>{t("Customer.customerAppealsDetails.timeline.title")}</span>
        <span
          className={`appeal-timeline-card__chevron ${
            open ? "is-open" : ""
          }`}
        >
          <img src={cardHeaderCollapseIcon} alt="" />
        </span>
      </button>
      {open ? (
        <div className="appeal-timeline">
          {items.length ? (
            items.map((item, index) => {
              const timelineAttachments = item.attachments ?? [];
              const attachmentCount =
                item.attachmentsCount ?? timelineAttachments.length;
              const shouldRenderInlineAttachments =
                timelineAttachments.length > 0 &&
                timelineAttachments.length < 3 &&
                timelineAttachments.length === attachmentCount;
              return (
                <div key={item.id} className="appeal-timeline__item">
                  <div className="appeal-timeline__marker">
                    {index > 0 ? (
                      <div className="appeal-timeline__marker-line appeal-timeline__marker-line--top" />
                    ) : null}
                    <div
                      className={`appeal-timeline__marker-dot ${
                        item.dotTone === "active" ? "is-active" : ""
                      }`}
                    />
                    {index < items.length - 1 ? (
                      <div className="appeal-timeline__marker-line appeal-timeline__marker-line--bottom" />
                    ) : null}
                  </div>
                  <div className="appeal-timeline__body">
                    <div className="appeal-timeline__title">
                      {(() => {
                        const titleKey =
                          item.titleI18nKey ||
                          getAppealStatusTranslationKey(item.title);
                        return titleKey
                          ? t(titleKey, { defaultValue: item.title })
                          : item.title;
                      })()}
                    </div>
                    {item.actorLabel ? (
                      <TimelineMetaRow icon={timelineUserIcon}>
                        {item.actorPrefix === "Submitted by"
                          ? t(
                              "Customer.customerAppealsDetails.timeline.submittedBy",
                            )
                          : t(
                              "Customer.customerAppealsDetails.timeline.currentHandler",
                            )}
                        : {item.actorLabel}
                      </TimelineMetaRow>
                    ) : null}
                    {item.departmentLabel ? (
                      <div className="appeal-timeline__department">
                        {translateDepartment(item.departmentLabel)}
                      </div>
                    ) : null}
                    {item.changedAt ? (
                      <TimelineMetaRow icon={timelineCalendarIcon}>
                        {formatAppealDateTime(item.changedAt)}
                      </TimelineMetaRow>
                    ) : null}
                    {item.actionSegments ? (
                      <TimelineMetaRow icon={timelineActionIcon}>
                        <TimelineSegments segments={item.actionSegments} />
                      </TimelineMetaRow>
                    ) : null}
                    {item.referenceNo ? (
                      <div className="appeal-timeline__reference">
                        <span>
                          {translateReferenceLabel(item.referenceLabel)}
                        </span>
                        {item.referenceType === "refund" ? (
                          <button
                            type="button"
                            className="appeal-timeline__reference-button"
                            aria-label={t(
                              "Customer.customerAppealsDetails.timeline.openRefundAria",
                              { refundNo: item.referenceNo },
                            )}
                            title={t(
                              "Customer.customerAppealsDetails.timeline.openRefundAria",
                              { refundNo: item.referenceNo },
                            )}
                            onClick={() => onOpenRefund(item)}
                          >
                            {item.referenceNo}
                          </button>
                        ) : (
                          <strong>{item.referenceNo}</strong>
                        )}
                      </div>
                    ) : null}
                    {item.recommendationSegments ? (
                      <>
                        <div className="appeal-timeline__divider" />
                        <TimelineMetaRow icon={timelineActionIcon}>
                          <TimelineSegments
                            segments={item.recommendationSegments}
                          />
                        </TimelineMetaRow>
                      </>
                    ) : null}
                    {item.problemCauseSegments ? (
                      <TimelineMetaRow icon={timelineActionIcon}>
                        <TimelineSegments
                          segments={item.problemCauseSegments}
                        />
                      </TimelineMetaRow>
                    ) : null}
                    {item.description || item.descriptionI18nKey ? (
                      <div className="appeal-timeline__note">
                        {item.descriptionI18nKey
                          ? t(item.descriptionI18nKey)
                          : item.description}
                      </div>
                    ) : null}
                    {item.note ? (
                      <div className="appeal-timeline__note">{item.note}</div>
                    ) : null}
                    {shouldRenderInlineAttachments ? (
                      <AttachmentsDisplay
                        attachments={timelineAttachments}
                        className="appeal-timeline__inline-attachments"
                        compact
                        variant="applicationInfo"
                      />
                    ) : attachmentCount ? (
                      <button
                        type="button"
                        className="appeal-timeline__attachments"
                        onClick={() => onOpenAttachments(item)}
                      >
                        <span className="appeal-timeline__attachments-left">
                          <img src={timelineAttachmentIcon} alt="" />
                          <span className="appeal-timeline__attachments-label">
                            {t(
                              "Customer.customerAppealsDetails.timeline.attachments",
                            )}
                          </span>
                        </span>
                        <span className="appeal-timeline__attachments-count">
                          {attachmentCount}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <Empty
              description={t(
                "Customer.customerAppealsDetails.timeline.noTimeline",
              )}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function AppealInfoCard({
  record,
  onViolationNumberClick,
}: {
  record: AppealRecord;
  onViolationNumberClick?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const reasonKey = getAppealReasonTranslationKey(record.appealReason);
  const appealReasonDisplay =
    record.appealReasonDisplay ||
    (reasonKey
      ? t(reasonKey, { defaultValue: record.appealReason })
      : record.appealReason);
  const violationNumber = getDisplayValue(record.violationNo);

  return (
    <section className="appeal-detail-card">
      <button
        type="button"
        className="appeal-detail-card__header appeal-detail-card__header--toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <h2>
          {t("Customer.customerAppealsDetails.sections.appealInformation")}
        </h2>
        <span
          className={`appeal-side-card__chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        >
          <img src={cardHeaderCollapseIcon} alt="" />
        </span>
      </button>
      {open && (
        <div className="appeal-info-grid">
          <div className="appeal-info-grid__item">
            <span>
              {t("Customer.customerAppealsDetails.sections.violationNumber")}
            </span>
            {onViolationNumberClick && violationNumber !== "-" ? (
              <button
                type="button"
                className="appeal-info-grid__violation-reference"
                aria-label={t(
                  "Customer.customerAppealsDetails.sections.openViolationAria",
                  { violationNumber },
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onViolationNumberClick();
                }}
              >
                {violationNumber}
              </button>
            ) : (
              <strong>{violationNumber}</strong>
            )}
          </div>
          <div className="appeal-info-grid__item">
            <span>
              {t("Customer.customerAppealsDetails.sections.appealReason")}
            </span>
            <strong>{appealReasonDisplay}</strong>
          </div>
          <div className="appeal-info-grid__item appeal-info-grid__item--wide">
            <span>{t("Customer.customerAppealsDetails.sections.notes")}</span>
            <strong>{record.notes || "-"}</strong>
          </div>
          <div className="appeal-info-grid__item appeal-info-grid__item--wide">
            <span>
              {t("Customer.customerAppealsDetails.sections.attachments")}
            </span>
            <AttachmentsDisplay
              attachments={record.attachments}
              variant="applicationInfo"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function AppealDetailButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "muted";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={`appeal-detail-button is-${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Spin size="small" className="appeal-detail-button__spinner" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

function normalizeCommentIdentityValue(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "";
  return text;
}

function getAppealCommentRoleClassName(label?: string) {
  const normalized = label?.toLocaleLowerCase() ?? "";
  if (
    normalized.includes("licensing") ||
    normalized.includes("inspection") ||
    normalized.includes("content") ||
    normalized.includes("business")
  ) {
    return "is-licensing";
  }
  if (normalized.includes("happiness")) return "is-happiness";
  return "is-customer";
}

function shouldShowInternalNoteTag(comment: AppealComment) {
  return comment.isInternalNote === true;
}

function resolveCommentSenderName(comment: AppealComment, systemLabel: string) {
  const senderName = normalizeCommentIdentityValue(comment.senderName);
  if (senderName && senderName !== "System") return senderName;
  if (comment.kind === "system") return systemLabel;
  return "-";
}

function getSystemCommentVariantClassName(comment: AppealComment) {
  const hasStructuredDetails = Boolean(
    comment.responseDeadline ||
      comment.recommendation ||
      comment.notes ||
      comment.attachments?.length,
  );
  return hasStructuredDetails ? "is-structured" : "is-note";
}

function unwrapAppealDetailArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? (data as T[]) : [];
}

type AppealCommunicationSummaryCardData = {
  title?: string;
  sentAt?: string;
  isInternalNote?: boolean;
  responseDeadline?: string;
  recommendation?: string;
  notes?: string;
  attachments?: AppealAttachment[];
};

function buildAppealCommunicationSummaryCardData(
  record?: AppealRecord | null,
): AppealCommunicationSummaryCardData {
  const initialComment = record?.communicationRecords?.[0];

  if (!initialComment) return {};

  return {
    title: normalizeCommentIdentityValue(initialComment.content),
    sentAt: initialComment.sentAt,
    isInternalNote: initialComment.isInternalNote,
    responseDeadline: initialComment.responseDeadline,
    recommendation: initialComment.recommendation,
    notes: normalizeCommentIdentityValue(initialComment.notes),
    attachments: initialComment.attachments,
  };
}

function hasAppealCommunicationSummaryContent(
  summary?: AppealCommunicationSummaryCardData | null,
) {
  if (!summary) return false;

  return Boolean(
    summary.title ||
      summary.sentAt ||
      summary.responseDeadline ||
      summary.recommendation ||
      summary.notes ||
      summary.attachments?.length,
  );
}

function AppealCommentAvatar({ avatarSrc }: { avatarSrc?: string }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const normalizedAvatarSrc = normalizeCommentIdentityValue(avatarSrc);
  const resolvedAvatarSrc = useMemo(() => {
    if (!normalizedAvatarSrc || loadFailed) {
      return APPEAL_ACTION_ICON_MAP.userAvatar;
    }

    return (
      buildAppealAttachmentAccessUrl(normalizedAvatarSrc) ||
      APPEAL_ACTION_ICON_MAP.userAvatar
    );
  }, [loadFailed, normalizedAvatarSrc]);

  useEffect(() => {
    setLoadFailed(false);
  }, [normalizedAvatarSrc]);

  return (
    <div
      className={`appeal-comment-avatar ${
        normalizedAvatarSrc && !loadFailed ? "has-photo" : ""
      }`}
    >
      <AuthenticatedDocumentImage
        src={resolvedAvatarSrc}
        alt=""
        onError={() => {
          setLoadFailed(true);
        }}
      />
    </div>
  );
}

function AppealCommentBlock({
  comment,
  translateDepartment,
}: {
  comment: AppealComment;
  translateDepartment: (department?: string | null) => string;
}) {
  const { t } = useTranslation();
  const internalNoteLabel = t(
    "Customer.customerAppealsDetails.communication.internalNote",
  );
  const systemLabel = t("Customer.customerAppeals.common.system");
  const displayRole = normalizeCommentIdentityValue(
    translateDepartment(comment.senderDepartment),
  );
  const showInternalNoteTag = shouldShowInternalNoteTag(comment);
  const senderName = resolveCommentSenderName(comment, systemLabel);
  const avatarSrc = normalizeCommentIdentityValue(comment.senderPhotoUrl);
  const recommendationKey = getAppealDecisionTranslationKey(
    comment.recommendation,
  );
  const recommendationLabel = recommendationKey
    ? t(recommendationKey, { defaultValue: comment.recommendation })
    : comment.recommendation;

  if (comment.kind === "system") {
    const systemVariantClassName = getSystemCommentVariantClassName(comment);

    return (
      <div
        className={`appeal-comment-block appeal-comment-block--system ${systemVariantClassName}`}
      >
        <div className={`appeal-comment-system ${systemVariantClassName}`}>
          <div className={`appeal-comment-system__top ${systemVariantClassName}`}>
            <div className="appeal-comment-system__title">{comment.content}</div>
            <div className="appeal-comment-system__meta">
              <span className="appeal-comment-tag">{internalNoteLabel}</span>
              <span>{formatAppealDateTime(comment.sentAt)}</span>
            </div>
          </div>
          {comment.responseDeadline ? (
            <div className="appeal-comment-subtext">
              <span className="appeal-comment-subtext__label">
                {t(
                  "Customer.customerAppealsDetails.communication.responseDeadline",
                )}
                :
              </span>{" "}
              <span className="appeal-comment-subtext__value">
                {formatAppealDateTimeMinute(comment.responseDeadline)}
              </span>
            </div>
          ) : null}
          {recommendationLabel ? (
            <div className="appeal-comment-subtext appeal-comment-recommendation">
              <span className="appeal-comment-recommendation__label">
                {t(
                  "Customer.customerAppealsDetails.communication.recommendedAction",
                )}
                :
              </span>
              <span
                className={`appeal-comment-recommendation__value ${
                  comment.recommendation === "Approve" ? "is-success" : "is-danger"
                }`}
              >
                {recommendationLabel}
              </span>
            </div>
          ) : null}
          {comment.notes ? (
            <div className="appeal-comment-subtext appeal-comment-note">
              {comment.notes}
            </div>
          ) : null}
        </div>
        {comment.attachments?.length ? (
          <AppealAttachments
            attachments={comment.attachments}
            compact
            variant="communication"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="appeal-comment-block">
      <div className="appeal-comment-message">
        <AppealCommentAvatar avatarSrc={avatarSrc} />
        <div className="appeal-comment-content">
          <div className="appeal-comment-header">
            <div className="appeal-comment-identity">
              <span className="appeal-comment-name">{senderName}</span>
              {displayRole ? (
                <span
                  className={`appeal-comment-role ${getAppealCommentRoleClassName(
                    displayRole,
                  )}`}
                >
                  {displayRole}
                </span>
              ) : null}
            </div>
            <div className="appeal-comment-meta-right">
              {showInternalNoteTag ? (
                <span className="appeal-comment-tag">{internalNoteLabel}</span>
              ) : null}
              <div className="appeal-comment-time">
                {formatAppealDateTime(comment.sentAt)}
              </div>
            </div>
          </div>
          {comment.content ? (
            <div className="appeal-comment-text">{comment.content}</div>
          ) : null}
          {recommendationLabel ? (
            <div className="appeal-comment-subtext appeal-comment-recommendation">
              <span className="appeal-comment-recommendation__label">
                {t(
                  "Customer.customerAppealsDetails.communication.departmentRecommendation",
                )}
                :
              </span>
              <span
                className={`appeal-comment-recommendation__value ${
                  comment.recommendation === "Approve" ? "is-success" : "is-danger"
                }`}
              >
                {recommendationLabel}
              </span>
            </div>
          ) : null}
          {comment.attachments?.length ? (
            <div className="appeal-comment-attachments">
              <AppealAttachments
                attachments={comment.attachments}
                compact
                variant="communication"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AppealCommunicationSummaryCard({
  summary,
}: {
  summary: AppealCommunicationSummaryCardData;
}) {
  const { t } = useTranslation();
  const recommendationKey = getAppealDecisionTranslationKey(
    summary.recommendation,
  );
  const recommendationLabel = recommendationKey
    ? t(recommendationKey, { defaultValue: summary.recommendation })
    : summary.recommendation;

  return (
    <div className="appeal-comment-block appeal-comment-block--system appeal-comment-block--summary is-summary">
      <div className="appeal-comment-system is-summary">
        <div className="appeal-comment-system__top is-summary">
          {summary.title ? (
            <div className="appeal-comment-system__title">{summary.title}</div>
          ) : null}
          <div className="appeal-comment-system__meta">
            {summary.isInternalNote ? (
              <span className="appeal-comment-tag">
                {t("Customer.customerAppealsDetails.communication.internalNote")}
              </span>
            ) : null}
            {summary.sentAt ? (
              <span>{formatAppealDateTime(summary.sentAt)}</span>
            ) : null}
          </div>
        </div>
        {summary.responseDeadline ? (
          <div className="appeal-comment-subtext">
            <span className="appeal-comment-subtext__label">
              {t("Customer.customerAppealsDetails.communication.responseDeadline")}:
            </span>{" "}
            <span className="appeal-comment-subtext__value">
              {formatAppealDateTimeMinute(summary.responseDeadline)}
            </span>
          </div>
        ) : null}
        {recommendationLabel ? (
          <div className="appeal-comment-subtext appeal-comment-recommendation">
            <span className="appeal-comment-recommendation__label">
              {t(
                "Customer.customerAppealsDetails.communication.recommendedAction",
              )}
              :
            </span>
            <span
              className={`appeal-comment-recommendation__value ${
                summary.recommendation === "Approve" ? "is-success" : "is-danger"
              }`}
            >
              {recommendationLabel}
            </span>
          </div>
        ) : null}
        {summary.notes ? (
          <div className="appeal-comment-subtext appeal-comment-note">
            {summary.notes}
          </div>
        ) : null}
      </div>
      {summary.attachments?.length ? (
        <AppealAttachments
          attachments={summary.attachments}
          compact
          variant="communication"
        />
      ) : null}
    </div>
  );
}

function CommunicationRecords({
  record,
  onSend,
  roleConfig,
  viewRole,
}: {
  record: AppealRecord;
  onSend: (
    content: string,
    audience: AppealAudience,
    attachments: AppealAttachment[],
  ) => Promise<void>;
  roleConfig: AppealRoleConfig;
  viewRole: AppealViewRole;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<AppealAttachment[]>([]);
  const [activeAudience, setActiveAudience] = useState<AppealAudience>(
    roleConfig.message.defaultAudience,
  );
  const [sending, setSending] = useState(false);
  const uploadResetVersionRef = useRef(0);
  const {
    attachmentUploading,
    isAttachmentUploading,
    reserveAttachmentUpload,
    releaseAttachmentUpload,
    resetAttachmentUploadLock,
  } = useAppealAttachmentUploadLock();
  const resetComposerAttachments = useCallback(() => {
    uploadResetVersionRef.current += 1;
    setAttachments([]);
    resetAttachmentUploadLock();
  }, [resetAttachmentUploadLock]);
  const translateDepartment = (department?: string | null) => {
    const key = getAppealDepartmentTranslationKey(department);
    return key
      ? t(key, { defaultValue: department || "-" })
      : department || "-";
  };
  const communicationSummaryCard = useMemo(
    () => buildAppealCommunicationSummaryCardData(record),
    [record],
  );
  const hasCommunicationSummary = hasAppealCommunicationSummaryContent(
    communicationSummaryCard,
  );
  const visibleCommunicationRecords = useMemo(() => {
    if (!hasCommunicationSummary) return record.communicationRecords;
    return record.communicationRecords.slice(1);
  }, [hasCommunicationSummary, record.communicationRecords]);
  const canCustomerReply = Boolean(
    roleConfig.message.allowCustomerAudience &&
      isAppealStatusAllowed(
        record,
        roleConfig.details.allowCustomerReplyStatuses,
      ),
  );
  const canInternalNote = Boolean(
    isAppealStatusAllowed(
      record,
      roleConfig.details.allowInternalNoteStatuses,
    ),
  );
  const hasMessageComposer = canCustomerReply || canInternalNote;
  const composerRecordKey = record.appealId ?? record.appealNo;
  const composerTabs = useMemo<Array<{ key: AppealAudience; label: string }>>(
    () => {
      const tabs: Array<{ key: AppealAudience; label: string }> = [];
      if (canCustomerReply) {
        tabs.push({
          key: "customer",
          label: t("Customer.customerAppealsDetails.communication.replyToCustomer"),
        });
      }
      if (canInternalNote) {
        tabs.push({
          key: "internal",
          label: t("Customer.customerAppealsDetails.communication.internalNote"),
        });
      }
      return tabs;
    },
    [canCustomerReply, canInternalNote, t],
  );
  const showComposerTabs = canCustomerReply || composerTabs.length > 1;
  const composerPlaceholder =
    activeAudience === "customer"
      ? t("Customer.customerAppealsDetails.communication.replyToCustomer")
      : viewRole === "department"
        ? t(
            "Customer.customerAppealsDetails.communication.departmentViewInternalNotePlaceholder",
          )
      : t(
          "Customer.customerAppealsDetails.communication.internalNotePlaceholder",
        );
  const canSendMessage = Boolean(
    hasMessageComposer &&
      composerTabs.some((item) => item.key === activeAudience) &&
      !attachmentUploading &&
      (message.trim() || attachments.length),
  );
  const attachmentUploadDisabled =
    attachmentUploading ||
    attachments.length >= APPEAL_MESSAGE_ATTACHMENT_MAX_COUNT;

  useEffect(() => {
    setActiveAudience(roleConfig.message.defaultAudience);
  }, [roleConfig.message.defaultAudience]);

  useEffect(() => {
    setMessage("");
    resetComposerAttachments();
  }, [composerRecordKey, resetComposerAttachments]);

  useEffect(() => {
    if (!hasMessageComposer || !composerTabs.length) return;
    const allowedAudience = composerTabs.map((item) => item.key);
    if (!allowedAudience.includes(activeAudience)) {
      setActiveAudience(composerTabs[0].key);
    }
  }, [activeAudience, composerTabs, hasMessageComposer]);

  const beforeUpload = (file: RcFile) => {
    if (isAttachmentUploading()) {
      return Upload.LIST_IGNORE;
    }

    const validationError = getAppealAttachmentValidationError(
      file,
      attachments.length,
      APPEAL_MESSAGE_ATTACHMENT_MAX_COUNT,
    );
    if (validationError) {
      const messageKey = validationError === "format"
        ? "Customer.customerAppeals.messages.invalidUploadFormat"
        : validationError === "size"
          ? "Customer.customerAppeals.messages.fileSizeExceeds"
          : "Customer.customerAppeals.messages.uploadLimit";
      CustomMessage.error(t(messageKey));
      return Upload.LIST_IGNORE;
    }
    if (!reserveAttachmentUpload(file)) {
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleUpload = async (options: UploadRequestOption) => {
    const file = options.file as RcFile;
    const uploadVersion = uploadResetVersionRef.current;
    try {
      const nextAttachment = await uploadAppealAttachmentFile(file);
      if (uploadVersion !== uploadResetVersionRef.current) return;
      setAttachments((current) => [...current, nextAttachment]);
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      if (uploadVersion !== uploadResetVersionRef.current) return;
      CustomMessage.error(t("Customer.customerAppeals.messages.uploadFailed"));
      options.onError?.(error as Error);
    } finally {
      releaseAttachmentUpload(file);
    }
  };

  const handleSendClick = async () => {
    if (!canSendMessage || sending) return;
    const allowedAudience = composerTabs.some(
      (item) => item.key === activeAudience,
    );
    const nextAudience =
      roleConfig.message.allowCustomerAudience &&
      activeAudience === "customer" &&
      allowedAudience
        ? "customer"
        : "internal";

    try {
      setSending(true);
      await onSend(message.trim(), nextAudience, attachments);
      setMessage("");
      resetComposerAttachments();
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="appeal-detail-card appeal-communication">
      <div className="appeal-detail-card__header">
        <h2>
          {t("Customer.customerAppealsDetails.sections.communicationRecords")}
        </h2>
      </div>
      <div
        className={`appeal-comments-list ${
          hasMessageComposer ? "has-composer" : "is-readonly"
        }`}
      >
        {hasCommunicationSummary ? (
          <AppealCommunicationSummaryCard summary={communicationSummaryCard} />
        ) : null}
        {visibleCommunicationRecords.length
          ? visibleCommunicationRecords.map((comment) => (
              <AppealCommentBlock
                key={comment.id}
                comment={comment}
                translateDepartment={translateDepartment}
              />
            ))
          : !hasCommunicationSummary && (
          <Empty
            className="appeal-comments-empty"
            description={t(
              "Customer.customerAppealsDetails.communication.noRecords",
            )}
          />
            )}
      </div>
      {hasMessageComposer ? (
        <div
          className={`appeal-message-composer ${
            activeAudience === "customer"
              ? "is-customer-reply"
              : "is-internal-note"
          }`}
        >
          <div
            className={`appeal-message-composer__shell ${
              activeAudience === "customer"
                ? "is-customer-reply"
                : "is-internal-note"
            }`}
          >
            {showComposerTabs ? (
              <div className="appeal-message-composer__tabs">
                {composerTabs.map((tab) => {
                  const selected = tab.key === activeAudience;
                  return (
                    <button
                      type="button"
                      key={tab.key}
                      className={`appeal-message-composer__tab ${
                        selected ? "is-active" : ""
                      }`}
                      onClick={() => setActiveAudience(tab.key)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div
              className={`appeal-message-composer__input-shell ${
                activeAudience === "customer"
                  ? "is-customer-reply"
                  : "is-internal-note"
              }`}
            >
              <Input.TextArea
                maxLength={1000}
                bordered={false}
                autoSize={{ minRows: 3, maxRows: 8 }}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="appeal-message-composer__textarea"
                placeholder={composerPlaceholder}
              />
              {attachments.length ? (
                <AppealAttachments
                  attachments={attachments}
                  compact
                  variant="composer"
                  onDelete={(attachmentId) => {
                    setAttachments((prev) =>
                      prev.filter((item) => item.id !== attachmentId),
                    );
                  }}
                />
              ) : null}
              <div className="appeal-message-composer__bottom">
                <div className="appeal-message-composer__counter">
                  {message.length}/1000
                </div>
                <div className="appeal-message-composer__actions">
                  <Upload
                    showUploadList={false}
                    beforeUpload={beforeUpload}
                    customRequest={handleUpload}
                    accept={APPEAL_ATTACHMENT_ACCEPT}
                    disabled={attachmentUploadDisabled}
                    maxCount={APPEAL_MESSAGE_ATTACHMENT_MAX_COUNT}
                  >
                    <span
                      className={`appeal-upload-button ${
                        attachments.length ? "has-attachments" : ""
                      } ${
                        attachmentUploadDisabled ? "is-disabled" : ""
                      }`}
                    >
                      <img src={APPEAL_ACTION_ICON_MAP.messageAttach} alt="" />
                    </span>
                  </Upload>
                  <AppealDetailButton
                    variant={canSendMessage && !sending ? "primary" : "muted"}
                    disabled={!canSendMessage || sending}
                    loading={sending}
                    onClick={handleSendClick}
                  >
                    {t("Customer.customerAppealsDetails.communication.send")}
                  </AppealDetailButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OverviewCard({
  title,
  children,
  open,
  onToggle,
  showExpandIcon = false,
  onExpand,
}: {
  title: string;
  children?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  showExpandIcon?: boolean;
  onExpand?: () => void;
}) {
  return (
    <section className={`appeal-side-card ${open ? "is-open" : ""}`}>
      <RightSideCardHeader
        title={title}
        open={open}
        onToggle={onToggle}
        showExpandIcon={showExpandIcon}
        onExpand={onExpand}
      />
      {open ? <div className="appeal-side-card__body">{children}</div> : null}
    </section>
  );
}

const CustomerAppealsDetails: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const customerAppealsAccess = useCustomerAppealsAccess();
  const hasInspectionViolationDetailAccess =
    useCanOpenCustomerAppealViolationDetail();
  const canOpenViolationDetail =
    customerAppealsAccess.hasAccess || hasInspectionViolationDetailAccess;
  const searchParams = useMemo(
    () => new URLSearchParams(history.location.search),
    [history.location.search],
  );
  const appealId = searchParams.get("appealId") || "";
  const teamManagementDetailScope = useMemo(
    () => getTeamManagementDetailScope(searchParams),
    [searchParams],
  );
  const shouldReturnToDashboard = searchParams.get("returnTo") === "dashboard";
  const [viewRole, setViewRole] = useState(
    DEFAULT_APPEAL_VIEW_ROLE,
  );
  const [roleReady, setRoleReady] = useState(false);
  const [roleAccessError, setRoleAccessError] = useState(false);
  const roleConfig =
    APPEAL_ROLE_CONFIG[viewRole] ??
    APPEAL_ROLE_CONFIG[DEFAULT_APPEAL_VIEW_ROLE];
  const translateStatus = useCallback(
    (status?: string | null) => {
      const key = getAppealStatusTranslationKey(status);
      return key ? t(key, { defaultValue: status || "-" }) : status || "-";
    },
    [t],
  );
  const slaLabels = useMemo(
    () => ({
      overdue: t("Customer.customerAppeals.sla.overdue"),
      remaining: t("Customer.customerAppeals.sla.remaining"),
    }),
    [t],
  );
  const [record, setRecord] = useState<AppealRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [departmentModalMode, setDepartmentModalMode] = useState<
    "process" | "send_back"
  >("process");
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [attachmentItem, setAttachmentItem] =
    useState<AppealTimelineItem | null>(null);
  const [applicantDetails, setApplicantDetails] =
    useState<IUserIndividualProfile | null>(null);
  const [establishmentDetails, setEstablishmentDetails] =
    useState<IEstablishmentOverview | null>(null);
  const [profileAndApplicantData, setProfileAndApplicantData] =
    useState<ProfileAndApplicantOverviewData | null>(null);
  const [overviewIdentifiers, setOverviewIdentifiers] = useState<{
    userId?: string;
    profileId?: number;
  }>({});
  const [applicationOverviewStats, setApplicationOverviewStats] = useState({
    historicalApplications: 0,
    historicalTickets: 0,
    refunds: 0,
    appeals: 0,
  });
  const [rightCardState, setRightCardState] = useState<{
    applicant: boolean;
    profile: boolean;
    application: boolean;
    timeline: boolean;
  }>(() => ({
    applicant: false,
    profile: false,
    application: false,
    timeline: false,
  }));
  const [expandedOverviewCard, setExpandedOverviewCard] =
    useState<OverviewExpandCard | null>(null);
  const [quickNavTarget, setQuickNavTarget] = useState<OverviewQuickNavTarget>({
    ...DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
  });

  useEffect(() => {
    if (customerAppealsAccess.loading) {
      setRoleReady(false);
      setRoleAccessError(false);
      return;
    }

    const nextRole = customerAppealsAccess.role;

    if (!nextRole) {
      setRoleAccessError(true);
      setRoleReady(true);
      return;
    }

    setViewRole(nextRole);
    setRoleAccessError(false);
    setRoleReady(true);
  }, [customerAppealsAccess.loading, customerAppealsAccess.role]);

  const loadDetail = useCallback(async () => {
    if (!appealId) return;
    setLoading(true);
    try {
      const [detail, messages, timeline] = await Promise.all([
        getInspectionAppealDetail(appealId, {
          skipErrorMessage: true,
        }).catch(() => null),
        getInspectionAppealMessages(appealId, {
          skipErrorMessage: true,
        }).catch(() => []),
        getInspectionAppealTimeline(appealId, {
          skipErrorMessage: true,
        }).catch(() => []),
      ]);
      setRecord((current) =>
        detail
          ? mergeAppealDetail(
              current ?? buildFallbackAppealDetailRecord(appealId),
              detail,
              messages,
              timeline,
            )
          : {
              ...(current ?? buildFallbackAppealDetailRecord(appealId)),
              communicationRecords: mapAppealMessages(
                unwrapAppealDetailArray<InspectionAppealMessageDto>(messages),
              ),
              timeline: mapAppealTimeline(
                unwrapAppealDetailArray<InspectionAppealTimelineItemDto>(
                  timeline,
                ),
              ),
            },
      );
    } finally {
      setLoading(false);
    }
  }, [appealId]);

  useEffect(() => {
    if (!roleReady || roleAccessError) return;
    loadDetail();
  }, [loadDetail, roleAccessError, roleReady]);

  useEffect(() => {
    if (!roleReady || roleAccessError) return;

    const params = new URLSearchParams(history.location.search);
    let changed = false;

    if (params.get("viewRole") !== viewRole) {
      params.set("viewRole", viewRole);
      changed = true;
    }
    if (teamManagementDetailScope) {
      if (params.get("pageTitleKey") !== TEAM_MANAGEMENT_TASK_TITLE_KEY) {
        params.set("pageTitleKey", TEAM_MANAGEMENT_TASK_TITLE_KEY);
        changed = true;
      }
      if (params.has("breadcrumbRootKey")) {
        params.delete("breadcrumbRootKey");
        changed = true;
      }
    } else if (
      params.get("pageTitleKey") !== roleConfig.ui.detailsPageTitleKey
    ) {
      params.set("pageTitleKey", roleConfig.ui.detailsPageTitleKey);
      changed = true;
    }
    if (
      !teamManagementDetailScope &&
      params.get("breadcrumbRootKey") !== roleConfig.ui.breadcrumbRootKey
    ) {
      params.set("breadcrumbRootKey", roleConfig.ui.breadcrumbRootKey);
      changed = true;
    }
    if (changed) {
      history.replace({
        pathname: history.location.pathname,
        search: params.toString(),
        state: history.location.state,
      });
    }
  }, [
    history,
    history.location.pathname,
    history.location.search,
    history.location.state,
    roleAccessError,
    roleConfig.ui.breadcrumbRootKey,
    roleConfig.ui.detailsPageTitleKey,
    roleReady,
    teamManagementDetailScope,
    viewRole,
  ]);

  useEffect(() => {
    let cancelled = false;

    const resetOverviewState = () => {
      setApplicantDetails(null);
      setEstablishmentDetails(null);
      setProfileAndApplicantData(null);
      setOverviewIdentifiers({});
      setApplicationOverviewStats({
        historicalApplications: 0,
        historicalTickets: 0,
        refunds: 0,
        appeals: 0,
      });
    };

    const loadOverviewState = async () => {
      if (!record) {
        resetOverviewState();
        return;
      }

      let resolvedUserId = record.userId;
      let resolvedProfileId = getPositiveNumberId(record.profileId);

      setOverviewIdentifiers({
        userId: resolvedUserId || undefined,
        profileId: resolvedProfileId,
      });

      if ((!resolvedUserId || !resolvedProfileId) && (record.violationId || record.violationNo)) {
        const violationRes = await getInspectionViolationBasicDetail({
          violationId: record.violationId ? String(record.violationId) : undefined,
          violationNo: record.violationNo && record.violationNo !== "-"
            ? record.violationNo
            : undefined,
        }).catch(() => null);

        if (cancelled) return;

        const violationPayload = unwrapRecordPayload(
          violationRes as Record<string, unknown> | { data?: unknown } | null,
        );
        const nextProfileId = getPositiveNumberId(
          resolvedProfileId,
          getAppealViolationProfileId(violationPayload),
        );

        resolvedProfileId = nextProfileId ?? resolvedProfileId;
      }

      setOverviewIdentifiers({
        userId: resolvedUserId || undefined,
        profileId: resolvedProfileId,
      });

      const profileAndApplicantRes = resolvedProfileId
        ? await profileAndApplicant(resolvedProfileId, {
            skipErrorMessage: true,
          }).catch(() => null)
        : null;

      if (cancelled) return;

      const profileAndApplicantPayload = ((
        profileAndApplicantRes as {
          data?: ProfileAndApplicantOverviewData | null;
        } | null
      )?.data ??
        profileAndApplicantRes) as ProfileAndApplicantOverviewData | null;
      const applicantUserId = getFirstNonEmptyText(
        profileAndApplicantPayload?.userId as string | number | null | undefined,
        resolvedUserId,
      );
      const applicantRes = applicantUserId
        ? await getUserIndividual(applicantUserId, {
            skipErrorMessage: true,
          }).catch(() => null)
        : null;

      if (cancelled) return;

      const applicantPayload =
        (applicantRes as { data?: unknown } | null)?.data ?? applicantRes;
      resolvedUserId = applicantUserId || resolvedUserId;
      setOverviewIdentifiers({
        userId: resolvedUserId || undefined,
        profileId: resolvedProfileId,
      });
      const profileTypeFromProfile =
        resolveAppealProfileTypeFromUserTypeId(
          profileAndApplicantPayload?.userTypeId,
        );
      const shouldLoadEstablishment =
        profileTypeFromProfile === "Commercial" && Boolean(resolvedProfileId);
      const establishmentRes = shouldLoadEstablishment
        ? await getEstablishment(resolvedProfileId as number, {
            skipErrorMessage: true,
          }).catch(() => null)
        : null;
      const establishmentPayload =
        (establishmentRes as { data?: unknown } | null)?.data ??
        establishmentRes;

      setApplicantDetails(
        applicantPayload && typeof applicantPayload === "object"
          ? (applicantPayload as IUserIndividualProfile)
          : null,
      );
      setProfileAndApplicantData(
        profileAndApplicantPayload &&
          typeof profileAndApplicantPayload === "object"
          ? profileAndApplicantPayload
          : null,
      );
      setEstablishmentDetails(
        establishmentPayload && typeof establishmentPayload === "object"
          ? (establishmentPayload as IEstablishmentOverview)
          : null,
      );

      const nextStats = {
        historicalApplications: 0,
        historicalTickets: 0,
        refunds: 0,
        appeals: 0,
      };

      if (resolvedProfileId) {
        try {
          const relateRes = await getUserProfileRelateApps(
            resolvedProfileId,
            undefined,
            { skipErrorMessage: true },
          );
          const relatePayload = ((
            relateRes as { data?: IRelateAppsResponse | null } | null
          )?.data ?? relateRes) as IRelateAppsResponse | null;

          nextStats.historicalApplications = Number(
            relatePayload?.applicationCount ?? 0,
          );
          nextStats.historicalTickets = Number(
            relatePayload?.enquiryServiceCount ?? 0,
          );
          nextStats.refunds = Number(relatePayload?.refundCount ?? 0);
          nextStats.appeals = Number(relatePayload?.appealCount ?? 0);
        } catch (error) {
          console.error(error);
        }
      }

      if (cancelled) return;

      setApplicationOverviewStats(nextStats);
    };

    loadOverviewState();

    return () => {
      cancelled = true;
    };
  }, [record]);

  const handleBack = () => {
    const dashboardReturnState = readDashboardReturnState(
      history.location.state,
    );

    if (dashboardReturnState) {
      history.push(createDashboardReturnLocation(dashboardReturnState));
      return;
    }

    if (shouldReturnToDashboard) {
      history.push("/dashboard");
      return;
    }

    if (teamManagementDetailScope) {
      if (readTeamManagementReturnLocation(history.location.state)) {
        history.goBack();
        return;
      }

      history.push(
        TEAM_MANAGEMENT_LIST_PATH_BY_SCOPE[teamManagementDetailScope],
      );
      return;
    }

    const params = new URLSearchParams();
    params.set("viewRole", viewRole);
    params.set("tab", searchParams.get("tab") || "todo");
    params.set("pageTitleKey", roleConfig.ui.listPageTitleKey);
    params.set("breadcrumbRootKey", roleConfig.ui.breadcrumbRootKey);
    history.push({
      pathname: CUSTOMER_APPEALS_PATH,
      search: `?${params.toString()}`,
      state: {
        [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
      },
    });
  };

  const handleSendMessage = async (
    content: string,
    audience: AppealAudience,
    attachments: AppealAttachment[],
  ) => {
    if (!appealId) return;
    const sentAudience =
      roleConfig.message.allowCustomerAudience && audience === "customer"
        ? "customer"
        : "internal";
    const payload = {
      body: content,
      attachments: attachments.map(mapAppealAttachmentToWriteDto),
    };
    if (sentAudience === "customer") {
      await replyInspectionAppealToCustomer(appealId, payload);
    } else {
      await createInspectionAppealInternalNote(appealId, payload);
    }
    CustomMessage.success(
      t("Customer.customerAppeals.messages.operationSuccessful"),
    );
    loadDetail();
  };

  const handleChangeStatus = async (payload: AppealStatusChangePayload) => {
    if (!appealId) return;
    await changeInspectionAppealStatus(appealId, {
      targetStatusId: APPEAL_STATUS_ID_MAP[payload.nextStatus],
      assignedDepartmentCode: mapDepartmentCode(payload.assignedDepartmentCode),
      responseDeadline: payload.responseDeadline,
      notes: payload.notes,
      attachments: payload.attachments?.map(mapAppealAttachmentToWriteDto),
    });
    CustomMessage.success(
      t("Customer.customerAppeals.messages.operationSuccessful"),
    );
    setStatusModalVisible(false);
    loadDetail();
  };

  const handleDepartmentAction = async (
    payload: AppealDepartmentProcessPayload | AppealSendBackPayload,
  ) => {
    if (!appealId) return;
    if (departmentModalMode === "process" && "decision" in payload) {
      if (payload.processMode === "cancel") {
        await cancelAllAppealViolationItems(appealId, {
          recommendationTypeId: mapRecommendationToTypeId(
            payload.decision,
            payload.recommendationTypeId,
          ),
          notes: payload.notes,
          attachments: (payload.attachments ?? []).map(mapAppealAttachmentToWriteDto),
        });
      } else {
        await processInspectionAppeal(appealId, {
          recommendationTypeId: mapRecommendationToTypeId(
            payload.decision,
            payload.recommendationTypeId,
          ),
          notes: payload.notes,
          adjustmentItems: payload.adjustmentItems ?? [],
          attachments: (payload.attachments ?? []).map(mapAppealAttachmentToWriteDto),
        });
      }
    } else {
      await sendBackInspectionAppeal(appealId, {
        notes: payload.notes,
        attachments: payload.attachments?.map(mapAppealAttachmentToWriteDto),
      });
    }
    CustomMessage.success(
      t("Customer.customerAppeals.messages.operationSuccessful"),
    );
    setDepartmentModalVisible(false);
    loadDetail();
  };

  const profileType = useMemo<AppealResolvedProfileType | undefined>(() => {
    const profileTypeFromProfile =
      resolveAppealProfileTypeFromUserTypeId(
        profileAndApplicantData?.userTypeId,
      );
    if (profileTypeFromProfile) return profileTypeFromProfile;
    if (!record) return undefined;
    const profileTypeFromRecord = resolveAppealProfileTypeFromUserTypeId(
      record.userTypeId ?? record.userTypeCode,
    );
    if (profileTypeFromRecord) return profileTypeFromRecord;
    if (record.profileOverview.profileType === "Commercial") {
      return "Commercial";
    }
    if (record.profileOverview.profileType === "Individual") {
      return "Individual";
    }
    return record.applyFor.type;
  }, [profileAndApplicantData?.userTypeId, record]);

  const applicantOverviewData = useMemo(() => {
    if (!record) {
      return {
        fullName: "-",
        email: "-",
        mobileNumber: "-",
      };
    }

    return {
      fullName: getDisplayValue(
        applicantDetails?.fullNameEn ??
          profileAndApplicantData?.personalName ??
          profileAndApplicantData?.userName ??
          record.applicantOverview.fullName ??
          record.applyFor.name,
      ),
      email: getDisplayValue(
        applicantDetails?.email ??
          profileAndApplicantData?.personalEmail ??
          profileAndApplicantData?.userEmail ??
          record.applicantOverview.email,
      ),
      mobileNumber: getDisplayValue(
        applicantDetails?.mobileNumber ??
          profileAndApplicantData?.personalPhoneNumber ??
          profileAndApplicantData?.phoneNumber ??
          record.applicantOverview.mobileNumber,
      ),
    };
  }, [applicantDetails, profileAndApplicantData, record]);

  const profileOverviewData = useMemo<AppealRecord["profileOverview"]>(() => {
    if (!record) {
      return {
        profileType: "-",
        statusLabel: "-",
        statusTone: "neutral",
        fields: [],
        statistics: [],
        alerts: [],
      };
    }

    if (!profileType) {
      const statusLabel = getDisplayValue(
        profileAndApplicantData?.profileStatusObj?.nameEn ??
          record.profileOverview.statusLabel,
      );

      return {
        profileType: "-",
        selfMonitorProgram: profileAndApplicantData?.selfMonitorProgram,
        statusLabel,
        statusTone: getOverviewStatusTone(statusLabel),
        fields: [],
        statistics: [],
        alerts: [],
      };
    }

    const isCommercial = profileType === "Commercial";
    const profileEstablishmentName = profileAndApplicantData?.establishmentName as
      | string
      | number
      | null
      | undefined;
    const profileLicenseNumber = profileAndApplicantData?.licenseNumber as
      | string
      | number
      | null
      | undefined;
    const recordEstablishmentName =
      record.establishmentName ?? record.establishmentNameAr;
    const fields = isCommercial
      ? [
          {
            label: t("Customer.customerAppealsDetails.overview.establishmentName"),
            value: getDisplayValue(
              profileEstablishmentName ??
                establishmentDetails?.establishmentName ??
                establishmentDetails?.nameEn ??
                establishmentDetails?.nameAr ??
                recordEstablishmentName ??
                record.profileOverview.fields[0]?.value ??
                record.applyFor.name,
            ),
          },
          {
            label: t(
              "Customer.customerAppealsDetails.overview.commercialLicenseNumber",
            ),
            value: getDisplayValue(
              profileLicenseNumber ??
                establishmentDetails?.licenseNumber ??
                record.licenseNumber ??
                record.profileOverview.fields[1]?.value,
            ),
          },
          {
            label: t("Customer.customerAppealsDetails.overview.emirate"),
            value: getDisplayValue(
              establishmentDetails?.emirateObj?.nameEn ??
                establishmentDetails?.establishmentEmirateName ??
                record.profileOverview.fields[2]?.value,
            ),
          },
        ]
      : [
          {
            label: t("Customer.customerAppealsDetails.overview.nationality"),
            value: getDisplayValue(applicantDetails?.nationalityInfo?.nameEn),
          },
          {
            label: t("Customer.customerAppealsDetails.overview.passportNumber"),
            value: getDisplayValue(applicantDetails?.passportNumber),
          },
          {
            label: t("Customer.customerAppealsDetails.overview.emirate"),
            value: getDisplayValue(applicantDetails?.emirateInfo?.nameEn),
          },
        ];

    const statistics = [
      {
        key: "documents",
        label: t("Customer.customerAppealsDetails.overview.documents"),
        count: Number(
          (isCommercial
            ? profileAndApplicantData?.establishmentDocumentCount
            : profileAndApplicantData?.documentCount) ?? 0,
        ),
        icon: "documents" as const,
      },
      {
        key: "partners",
        label: t("Customer.customerAppealsDetails.overview.partners"),
        count: Number(profileAndApplicantData?.partnerCount ?? 0),
        icon: "partners" as const,
      },
    ];

    const statusLabel = getDisplayValue(
      profileAndApplicantData?.profileStatusObj?.nameEn ??
        applicantDetails?.proFileStatus?.nameEn ??
        establishmentDetails?.status?.name ??
        record.profileOverview.statusLabel,
    );
    return {
      profileType: isCommercial
        ? t("Customer.profiles.chart.commercial")
        : t("Customer.profiles.chart.individual"),
      selfMonitorProgram: profileAndApplicantData?.selfMonitorProgram,
      statusLabel,
      statusTone: getOverviewStatusTone(statusLabel),
      fields,
      statistics,
      alerts: [
        {
          key: "warnings",
          label: t("Customer.customerAppealsDetails.overview.warningsViolations"),
          count: getDisplayValue(profileAndApplicantData?.violationCount),
          tone: "danger",
        },
        {
          key: "fines",
          label: t("Customer.customerAppealsDetails.overview.unpaidFines"),
          count: getDisplayValue(profileAndApplicantData?.unpaidFinesCount),
          tone: "warning",
        },
      ],
    };
  }, [
    applicantDetails,
    establishmentDetails,
    profileAndApplicantData,
    profileType,
    record,
    t,
  ]);

  const applicationOverviewData = useMemo<AppealRecord["applicationOverview"]>(
    () => {
      if (!record) {
        return { statistics: [] };
      }

      return {
        statistics: [
          {
            key: "historical-applications",
            label: t(
              "Customer.customerAppealsDetails.application.historicalApplications",
            ),
            count: applicationOverviewStats.historicalApplications,
            icon: "historicalApplications",
          },
          {
            key: "historical-tickets",
            label: t(
              "Customer.customerAppealsDetails.application.historicalTicketsEnquiry",
            ),
            count: applicationOverviewStats.historicalTickets,
            icon: "historicalTickets",
          },
          {
            key: "refund",
            label: t("Customer.customerAppealsDetails.application.refund"),
            count: applicationOverviewStats.refunds,
            icon: "refund",
          },
          {
            key: "appeal",
            label: t("Customer.customerAppealsDetails.application.appeal"),
            count: applicationOverviewStats.appeals,
            icon: "appeal",
          },
        ],
      };
    },
    [applicationOverviewStats, record, t],
  );

  const profileOverviewFieldMap = useMemo(() => {
    return profileOverviewData.fields.reduce<Record<string, string>>(
      (acc, field) => {
        acc[field.label] = field.value;
        return acc;
      },
      {},
    );
  }, [profileOverviewData.fields]);

  const fullScreenType = useMemo<AppealResolvedProfileType | undefined>(() => {
    if (expandedOverviewCard === "applicant") {
      return "Individual";
    }
    return profileType;
  }, [expandedOverviewCard, profileType]);

  const openOverviewFullScreen = useCallback(
    (card: OverviewExpandCard, target?: Partial<OverviewQuickNavTarget>) => {
      if (card !== "applicant" && !profileType) return;
      const defaultInitialTab =
        card === "application" ? "applications" : "basic-information";
      setQuickNavTarget(createOverviewQuickNavTarget(target, defaultInitialTab));
      setExpandedOverviewCard(card);
    },
    [profileType],
  );

  const handleProfileOverviewStatisticClick = useCallback(
    (key: string) => {
      if (key === "documents") {
        openOverviewFullScreen("profile", {
          initialTab: "basic-information",
          scrollToDocuments: true,
        });
        return;
      }
      if (key === "partners") {
        openOverviewFullScreen("profile", {
          initialTab: "basic-information",
          scrollToPartners: true,
        });
        return;
      }
      openOverviewFullScreen("profile");
    },
    [openOverviewFullScreen],
  );

  const handleProfileOverviewAlertClick = useCallback(
    (key: string) => {
      if (key === "warnings" || key === "fines") {
        openOverviewFullScreen("profile", {
          initialTab: "violations-fines",
        });
        return;
      }
      openOverviewFullScreen("profile");
    },
    [openOverviewFullScreen],
  );

  const handleApplicationOverviewStatisticClick = useCallback(
    (key: string) => {
      if (key === "historical-applications") {
        openOverviewFullScreen("application", { initialTab: "applications" });
        return;
      }
      if (key === "historical-tickets") {
        openOverviewFullScreen("application", { initialTab: "tickets" });
        return;
      }
      if (key === "refund") {
        openOverviewFullScreen("application", { initialTab: "refunds" });
        return;
      }
      if (key === "appeal") {
        openOverviewFullScreen("application", { initialTab: "appeal" });
        return;
      }
      openOverviewFullScreen("application");
    },
    [openOverviewFullScreen],
  );

  const navigateToRelatedViolationDetails = useCallback(
    (violationNo?: string) => {
      if (!record) return;

      const nextViolationNo = getDisplayValue(
        violationNo || record.relatedViolation?.violationNo || record.violationNo,
      );
      if (!record.violationId && nextViolationNo === "-") return;

      if (!canOpenViolationDetail) {
        CustomMessage.warning(t("response.error.403"));
        return;
      }

      history.push(
        buildAppealViolationDetailPath({
          violationId: record.violationId,
          violationNo: nextViolationNo === "-" ? undefined : nextViolationNo,
        }),
      );
    },
    [canOpenViolationDetail, history, record, t],
  );

  const navigateToRelatedRefundDetails = useCallback(
    async (item: AppealTimelineItem) => {
      if (!item.referenceNo) return;
      const params = new URLSearchParams();
      params.set("viewRole", getRefundDetailsViewRole(viewRole));
      params.set("refundNo", item.referenceNo);
      const refundId =
        item.refundRequestId ??
        (await resolveRelatedRefundId(item.referenceNo, viewRole));
      if (refundId) {
        params.set("refundId", String(refundId));
      }
      params.set("pageTitleKey", "menu.refundsDetails");
      params.set("breadcrumbRootKey", "menu.customer");
      history.push(`/happiness/refunds/refundsDetails?${params.toString()}`);
    },
    [history, viewRole],
  );

  const fullScreenApplicantData = useMemo(() => {
    if (applicantDetails) return applicantDetails;
    if (!record) return undefined;
    return {
      type: 1,
      userId:
        profileAndApplicantData?.userId ??
        overviewIdentifiers.userId ??
        record.userId ??
        "",
      proFileId: overviewIdentifiers.profileId ?? record.profileId ?? 0,
      fullNameEn: applicantOverviewData.fullName,
      email: applicantOverviewData.email,
      mobileNumber: applicantOverviewData.mobileNumber,
      personalName: applicantOverviewData.fullName,
      personalEmail: applicantOverviewData.email,
      personalPhoneNumber: applicantOverviewData.mobileNumber,
    } as unknown as IUserIndividualProfile;
  }, [
    applicantDetails,
    applicantOverviewData,
    overviewIdentifiers,
    profileAndApplicantData?.userId,
    record,
  ]);

  const fullScreenEstablishmentData = useMemo(() => {
    if (!record) return undefined;
    const profileEstablishmentName = profileAndApplicantData?.establishmentName as
      | string
      | number
      | null
      | undefined;
    const profileLicenseNumber = profileAndApplicantData?.licenseNumber as
      | string
      | number
      | null
      | undefined;
    if (establishmentDetails) {
      return {
        ...establishmentDetails,
        establishmentName:
          profileEstablishmentName ??
          record.establishmentName ??
          establishmentDetails.establishmentName,
        nameEn:
          profileEstablishmentName ??
          record.establishmentName ??
          establishmentDetails.nameEn,
        nameAr: record.establishmentNameAr ?? establishmentDetails.nameAr,
        licenseNumber:
          profileLicenseNumber ??
          record.licenseNumber ??
          establishmentDetails.licenseNumber,
      } as IEstablishmentOverview;
    }

    return {
      nameEn: profileEstablishmentName ??
        record.establishmentName ??
        profileOverviewFieldMap[
          t("Customer.customerAppealsDetails.overview.establishmentName")
        ] ?? record.applyFor.name,
      nameAr: record.establishmentNameAr ?? "",
      licenseNumber: profileLicenseNumber ??
        record.licenseNumber ??
        profileOverviewFieldMap[
          t("Customer.customerAppealsDetails.overview.commercialLicenseNumber")
        ],
      addressName:
        profileOverviewFieldMap[
          t("Customer.customerAppealsDetails.overview.emirate")
        ],
      emails: applicantOverviewData.email,
      establishmentMobile: applicantOverviewData.mobileNumber,
    } as unknown as IEstablishmentOverview;
  }, [
    applicantOverviewData,
    establishmentDetails,
    profileOverviewFieldMap,
    profileAndApplicantData,
    record,
    t,
  ]);

  const fullScreenProfileAndApplicantData = useMemo(() => {
    if (profileAndApplicantData) return profileAndApplicantData;
    if (!record) return undefined;
    return {
      selfMonitorProgram: profileOverviewData.selfMonitorProgram,
      profileStatusObj: {
        nameEn: profileOverviewData.statusLabel,
      },
    };
  }, [profileAndApplicantData, profileOverviewData, record]);

  if (!roleReady || (loading && !record)) {
    return (
      <div className="appeal-detail-page appeal-detail-page--loading">
        <Spin />
      </div>
    );
  }

  if (roleAccessError) {
    return (
      <div className="appeal-detail-page">
        <Empty
          description={t(
            "Customer.customerAppeals.messages.noAccessibleWorkbench",
          )}
        />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="appeal-detail-page">
        <Empty
          description={t(
            "Customer.customerAppealsDetails.messages.noAppealDetail",
          )}
        />
      </div>
    );
  }

  const canChangeStatus = canOpenChangeStatus(
    record,
    roleConfig.details.allowChangeStatusStatuses,
  ) && resolveAllowedFinalStatuses(record).length > 0;
  const canDepartmentAction =
    isAppealStatusAllowed(
      record,
      roleConfig.details.allowDepartmentActionStatuses,
    );
  const isDepartmentWorkbenchRole =
    viewRole === "department" || viewRole === "committee";

  return (
    <div className="appeal-detail-page">
      <div className="appeal-detail-scroll">
        <div className="appeal-detail-top">
          <div className="appeal-detail-top__scroll">
            <div className="appeal-detail-top__grid">
              <DetailTopItem
                icon={APPEAL_DETAIL_TOP_ICON_MAP.appealNo}
                label={t("Customer.customerAppealsDetails.top.appealNumber")}
                value={record.appealNo}
              />
              <DetailTopItem
                icon={APPEAL_DETAIL_TOP_ICON_MAP.sla}
                label={t("Customer.customerAppealsDetails.top.sla")}
                value={getAppealSlaLabel(record.slaHours, record.rawSla, slaLabels)}
              />
              <DetailTopItem
                icon={APPEAL_DETAIL_TOP_ICON_MAP.status}
                label={t("Customer.customerAppealsDetails.top.status")}
                value={
                  <span
                    className={`appeal-status-pill ${getAppealStatusClassName(
                      record.status,
                    )}`}
                  >
                    {record.statusDisplay ||
                      translateStatus(record.statusCode || record.status)}
                  </span>
                }
              />
              <DetailTopItem
                icon={APPEAL_DETAIL_TOP_ICON_MAP.lastUpdatedAt}
                label={t("Customer.customerAppealsDetails.top.lastUpdated")}
                value={formatAppealDateTime(record.lastUpdatedAt)}
              />
            </div>
          </div>
        </div>

        <div
          className={`appeal-detail-layout ${
            expandedOverviewCard ? "is-fullscreen-mode" : ""
          }`}
        >
          {expandedOverviewCard && fullScreenType ? (
            <div className="appeal-detail-fullscreen-wrap">
              <FullScreen
                type={fullScreenType}
                applicant={fullScreenApplicantData}
                establishment={fullScreenEstablishmentData}
                userId={
                  profileAndApplicantData?.userId ??
                  overviewIdentifiers.userId ??
                  record.userId
                }
                profileId={overviewIdentifiers.profileId ?? record.profileId}
                profileAndApplicantData={fullScreenProfileAndApplicantData}
                quickNav={quickNavTarget}
                visualVariant="figmaOverview"
                onClose={() => {
                  setExpandedOverviewCard(null);
                  setQuickNavTarget({
                    ...DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
                  });
                }}
              />
            </div>
          ) : (
            <>
              <main className="appeal-detail-layout__main">
                <AppealInfoCard
                  record={record}
                  onViolationNumberClick={() =>
                    navigateToRelatedViolationDetails(record.violationNo)
                  }
                />
                <CommunicationRecords
                  record={record}
                  onSend={handleSendMessage}
                  roleConfig={roleConfig}
                  viewRole={viewRole}
                />
              </main>
              <aside className="appeal-detail-layout__side">
                <div className="appeal-detail-layout__side-column">
                  <OverviewCard
                    title={t(
                      "Customer.customerAppealsDetails.side.applicantOverview",
                    )}
                    open={rightCardState.applicant}
                    onToggle={() =>
                      setRightCardState((prev) => ({
                        ...prev,
                        applicant: !prev.applicant,
                      }))
                    }
                    showExpandIcon
                    onExpand={() => openOverviewFullScreen("applicant")}
                  >
                    <ApplicantOverviewCard {...applicantOverviewData} />
                  </OverviewCard>
                  <OverviewCard
                    title={t("Customer.customerAppealsDetails.side.profileOverview")}
                    open={rightCardState.profile}
                    onToggle={() =>
                      setRightCardState((prev) => ({
                        ...prev,
                        profile: !prev.profile,
                      }))
                    }
                    showExpandIcon
                    onExpand={() => openOverviewFullScreen("profile")}
                  >
                    <ProfileOverviewCard
                      data={profileOverviewData}
                      relatedViolation={record.relatedViolation}
                      onStatisticClick={handleProfileOverviewStatisticClick}
                      onAlertClick={handleProfileOverviewAlertClick}
                      onRelatedViolationClick={navigateToRelatedViolationDetails}
                    />
                  </OverviewCard>
                </div>
                <div className="appeal-detail-layout__side-column">
                  <OverviewCard
                    title={t(
                      "Customer.customerAppealsDetails.side.applicationOverview",
                    )}
                    open={rightCardState.application}
                    onToggle={() =>
                      setRightCardState((prev) => ({
                        ...prev,
                        application: !prev.application,
                      }))
                    }
                    showExpandIcon
                    onExpand={() => openOverviewFullScreen("application")}
                  >
                    <ApplicationOverviewCard
                      data={applicationOverviewData}
                      onStatisticClick={handleApplicationOverviewStatisticClick}
                    />
                  </OverviewCard>
                  <AppealTimelineCard
                    items={record.timeline}
                    onOpenAttachments={setAttachmentItem}
                    onOpenRefund={navigateToRelatedRefundDetails}
                    open={rightCardState.timeline}
                    onToggle={() =>
                      setRightCardState((prev) => ({
                        ...prev,
                        timeline: !prev.timeline,
                      }))
                    }
                  />
                </div>
              </aside>
            </>
          )}
        </div>
      </div>

      <div className="appeal-detail-footer detail-action-footer">
        <button
          type="button"
          className="appeal-detail-footer__button appeal-detail-footer__button--secondary appeal-detail-footer__button--back"
          onClick={handleBack}
        >
          {t("Customer.customerAppealsDetails.footer.back")}
        </button>
        <div className="appeal-detail-footer__actions">
          {teamTaskDetailContext.shouldHideDefaultActions ? (
            <TeamTaskDetailReassignAction />
          ) : (
            <>
              <div className="appeal-detail-footer__status">
                <span className="appeal-detail-footer__status-label">
                  {t("Customer.customerAppealsDetails.footer.currentStatus")}:
                </span>
                <span className="appeal-detail-footer__status-value">
                  {record.statusDisplay ||
                    translateStatus(record.statusCode || record.status)}
                </span>
              </div>
              {viewRole === "customer_happiness" && canChangeStatus ? (
                <button
                  type="button"
                  className="appeal-detail-footer__button appeal-detail-footer__button--primary"
                  onClick={() => setStatusModalVisible(true)}
                >
                  <img src={APPEAL_ACTION_ICON_MAP.changeStatus} alt="" />
                  {t("Customer.customerAppealsDetails.footer.changeStatus")}
                </button>
              ) : null}
              {isDepartmentWorkbenchRole && canDepartmentAction ? (
                <>
                  <button
                    type="button"
                    className="appeal-detail-footer__button appeal-detail-footer__button--secondary appeal-detail-footer__button--send-back"
                    onClick={() => {
                      setDepartmentModalMode("send_back");
                      setDepartmentModalVisible(true);
                    }}
                  >
                    {t("Customer.customerAppealsDetails.footer.sendBack")}
                  </button>
                  <button
                    type="button"
                    className="appeal-detail-footer__button appeal-detail-footer__button--primary"
                    onClick={() => {
                      setDepartmentModalMode("process");
                      setDepartmentModalVisible(true);
                    }}
                  >
                    {t("Customer.customerAppealsDetails.footer.process")}
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      <AppealStatusModal
        visible={statusModalVisible}
        record={record}
        departments={APPEAL_DEPARTMENTS}
        onCancel={() => setStatusModalVisible(false)}
        onConfirm={handleChangeStatus}
      />
      <AppealDepartmentTransferModal
        visible={departmentModalVisible}
        mode={departmentModalMode}
        record={record}
        onCancel={() => setDepartmentModalVisible(false)}
        onConfirm={handleDepartmentAction}
      />
      <AttachmentListModal
        item={attachmentItem}
        onCancel={() => setAttachmentItem(null)}
      />
    </div>
  );
};

export default CustomerAppealsDetails;
