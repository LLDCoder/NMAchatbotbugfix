import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Empty, Input, Spin, Upload } from "antd";
import type { RcFile } from "antd/lib/upload";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { createPermissionPathSet, normalizeRoutePath } from "@/routes/access";
import { useUserStore } from "@/store/user";
import {
  ApplicationOverviewCards,
  ApplicationOverviewDataProvider,
  type ApplicationOverviewProfileData,
  useApplicationOverviewData,
  useApplicationOverviewFullScreenController,
  CustomMessage,
  PermissionGuard,
} from "@/components/common";
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from "@/pages/TeamManagement/components/TeamTaskDetailReassignAction";
import { KEEP_ALIVE_RESTORE_STATE_KEY } from "@/components/KeepAlive/constants";
import { readTeamManagementReturnLocation } from "@/pages/TeamManagement/teamManagementReturnState";
import {
  createDashboardReturnLocation,
  readDashboardReturnState,
} from "@/pages/Dashboard/dashboardReturnState";
import { fileUpload } from "@/services/media";
import type {
  AdminRefundDetailDto,
  AdminRefundTicketListItemDto,
  AdminRefundTimelineItemDto,
  RefundStatusItemDto,
} from "@/services/refunds";
import {
  getAdminCustomerServiceRefundTickets,
  createAdminRefundConversation,
  getAdminRefundTicketDetail,
  getAdminRefundTickets,
  getAdminRefundTicketTimeline,
  getAdminRefundDepartments,
  getAdminRefundDepartmentStatusTypes,
  getAdminRefundDepartmentUsers,
  getAdminRefundTicketsStatistics,
  getAdminRefundStatusTypes,
  sendBackAdminRefundTicket,
  transferAdminRefundTicketStatus,
  updateAdminRefundTicketStatus,
} from "@/services/refunds";
import { ExpandArrowIcon } from "@/pages/CustomerRefunds/components/RefundIcons";
import RefundStatusModal from "@/pages/CustomerRefunds/components/RefundStatusModal";
import RefundAttachments from "@/pages/CustomerRefunds/components/RefundAttachments";
import RefundDepartmentProcessModal from "@/pages/CustomerRefunds/components/RefundDepartmentProcessModal";
import currencyNeutralIcon from "@/pages/CustomerRefunds/assets/icons/currency_neutral.svg";
import currencyDangerIcon from "@/pages/CustomerRefunds/assets/icons/currency_danger.svg";
import cardHeaderCollapseIcon from "@/pages/CustomerRefundsDetails/assets/icons/card_header_collapse.svg";
import cardHeaderExpandIcon from "@/pages/CustomerRefundsDetails/assets/icons/card_header_expand.svg";
import timelineActionIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_action.svg";
import timelineAttachmentIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_attachment.svg";
import timelineCalendarIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_calendar.svg";
import timelineUserIcon from "@/pages/CustomerRefundsDetails/assets/icons/timeline_user.svg";
import AttachmentListModal from "@/pages/CustomerRefundsDetails/components/AttachmentListModal";
import AttachmentsDisplay from "@/pages/CustomerRefundsDetails/components/AttachmentsDisplay";
import FullScreen from "@/components/common/ApplicationOverviewCards/FullScreen/FullScreen";
import type {
  IEstablishmentOverview,
  IProfileAndApplicantResponse,
  IUserIndividualProfile,
} from "@/services/userProfile";
import {
  getEstablishment,
  getUserIndividual,
  profileAndApplicant,
} from "@/services/userProfile";
import { getTaskType, type IRelateAppsResponse } from "@/services/tickets";
import {
  getRefundApplicationSummary,
  type ApplicationSummaryDto,
} from "@/services/application";
import {
  DEFAULT_REFUND_VIEW_ROLE,
  getRefundViewRoleFromSearchParams,
  REFUND_ROLE_CONFIG,
} from "@/pages/CustomerRefunds/roleConfig";
import {
  mapAdminDepartmentsToHandlers,
  mapAdminDepartmentUsersToHandlers,
  mapAdminRefundListItemToRecord,
  mergeAdminRefundDetail,
  mapStatusNameToId,
  mapProcessDecisionToId,
  resolveRefundViewRole,
  resolveAllowedRefundFinalStatuses,
  canShowRefundChangeStatusAction,
} from "@/pages/CustomerRefunds/apiAdapter";
import {
  DETAIL_TOP_ICON_MAP,
  REFUND_ACTION_ICON_MAP,
  buildRefundAttachmentAccessUrl,
  formatDateTime,
  formatDateTimeMinute,
  getSlaCompletionLabel,
  getStatusClassName,
} from "@/pages/CustomerRefunds/utils";
import { ImageBaseUrl } from "@/utils/url";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import formatMoney from "@/utils/formatMoney";
import type {
  RefundAttachment,
  RefundAudience,
  RefundComment,
  RefundFilterOptions,
  RefundHandler,
  RefundRecord,
  RefundDepartmentActionMode,
  RefundDepartmentActionPayload,
  RefundStatusChangePayload,
  RefundTimelineItem,
  RefundTimelineTextSegment,
  RefundViewRole,
} from "@/pages/CustomerRefunds/types";
import "@/pages/CustomerRefunds/index.less";
import "./index.less";

const APP_INFO_OPEN_STORAGE_KEY =
  "customerRefundsDetails:refundApplicationInfoOpen";

const APPLICATION_DETAIL_ROUTE_MAP: Record<number, string> = {
  1: "/licensing/applications/applicationsDetails",
  2: "/content/ContentApplications/ContentApplicationsDetails",
};

const TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE = "teamManagementTask";
const TEAM_MANAGEMENT_BACK_PATH_BY_SCOPE = {
  licensing: "/licensing/team-management",
  content: "/content/team-management",
  customer: "/happiness/team-management",
  inspection: "/inspection/tasks",
} as const;

type TeamManagementBreadcrumbScope =
  keyof typeof TEAM_MANAGEMENT_BACK_PATH_BY_SCOPE;

function isTeamManagementBreadcrumbScope(
  value: string | null,
): value is TeamManagementBreadcrumbScope {
  return Boolean(
    value &&
      Object.prototype.hasOwnProperty.call(
        TEAM_MANAGEMENT_BACK_PATH_BY_SCOPE,
        value,
      ),
  );
}

function buildCommentAvatarSrc(fileName?: string | null) {
  const value = String(fileName ?? "").trim();
  if (!value) return undefined;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("blob:")) {
    return value;
  }
  return `${ImageBaseUrl}${encodeURIComponent(value)}`;
}

function normalizeCommentIdentityValue(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "";
  return text;
}

type RelatedApplicationOverviewDetail = {
  id?: number;
  applicationNumber?: string | null;
  serviceNameEn?: string | null;
  serviceNameAr?: string | null;
  applyForEn?: string | null;
  applyForAr?: string | null;
  status?: string | null;
  submissionTime?: string | null;
  taskCreatedTime?: string | null;
};

type ProfileAndApplicantOverviewData = IProfileAndApplicantResponse;
type RefundResolvedProfileType = "Individual" | "Commercial";

type RelatedApplicationTaskLookup = {
  applicationId?: number;
  taskId?: string;
  departmentId?: number;
};

function unwrapTaskLookupPayload(
  response?:
    | RelatedApplicationTaskLookup
    | {
        data?:
          | RelatedApplicationTaskLookup
          | { data?: RelatedApplicationTaskLookup };
      }
    | null,
) {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  if ("data" in response && response.data) {
    const nested = response.data;
    if (
      nested &&
      typeof nested === "object" &&
      "data" in nested &&
      nested.data
    ) {
      return nested.data as RelatedApplicationTaskLookup;
    }
    return nested as RelatedApplicationTaskLookup;
  }

  return response as RelatedApplicationTaskLookup;
}

function getDisplayValue(value?: string | number | null, fallback = "-") {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  return undefined;
}

function resolveRefundProfileTypeFromUserTypeId(
  value?: number | string | null,
): RefundResolvedProfileType | undefined {
  const normalizedText = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalizedText === "individual") {
    return "Individual";
  }
  if (normalizedText === "commercial") {
    return "Commercial";
  }

  const normalizedValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : undefined;

  if (normalizedValue === undefined || !Number.isFinite(normalizedValue)) {
    return undefined;
  }

  if (normalizedValue === 1) {
    return "Individual";
  }

  if (normalizedValue === 2 || normalizedValue === 5) {
    return "Commercial";
  }

  return undefined;
}

function getFirstNonEmptyText(
  ...values: Array<string | number | null | undefined>
) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text && text !== "-") {
      return text;
    }
  }

  return "";
}

function hasMeaningfulOverviewDetail(
  detail?: RelatedApplicationOverviewDetail | null,
) {
  if (!detail) return false;

  return Boolean(
    getFirstNonEmptyText(
      detail.applicationNumber,
      detail.serviceNameEn,
      detail.serviceNameAr,
      detail.applyForEn,
      detail.applyForAr,
      detail.status,
      detail.submissionTime,
      detail.taskCreatedTime,
    ),
  );
}

function normalizeRelatedApplicationOverviewDetail(
  detail?: RelatedApplicationOverviewDetail | null,
  fallbackReferenceNo?: string,
): RelatedApplicationOverviewDetail | null {
  if (!detail) return null;

  const normalizedDetail: RelatedApplicationOverviewDetail = {
    ...detail,
    applicationNumber: getFirstNonEmptyText(
      detail.applicationNumber,
      fallbackReferenceNo,
    ),
    serviceNameEn: getFirstNonEmptyText(
      detail.serviceNameEn,
      detail.serviceNameAr,
    ),
    serviceNameAr: getFirstNonEmptyText(
      detail.serviceNameAr,
      detail.serviceNameEn,
    ),
    applyForEn: getFirstNonEmptyText(detail.applyForEn, detail.applyForAr),
    applyForAr: getFirstNonEmptyText(detail.applyForAr, detail.applyForEn),
    status: getFirstNonEmptyText(detail.status),
    submissionTime: getFirstNonEmptyText(
      detail.submissionTime,
      detail.taskCreatedTime,
    ),
    taskCreatedTime: getFirstNonEmptyText(
      detail.taskCreatedTime,
      detail.submissionTime,
    ),
  };

  return hasMeaningfulOverviewDetail(normalizedDetail)
    ? normalizedDetail
    : null;
}

async function loadAdminRefundListRecordByNo(
  refundNo: string,
  viewRole: RefundViewRole,
): Promise<RefundRecord | null> {
  const trimmedRefundNo = String(refundNo ?? "").trim();
  if (!trimmedRefundNo) return null;

  const primaryRequestFn =
    viewRole === "customer_happiness"
      ? getAdminCustomerServiceRefundTickets
      : getAdminRefundTickets;
  const secondaryRequestFn =
    viewRole === "customer_happiness"
      ? getAdminRefundTickets
      : getAdminCustomerServiceRefundTickets;

  for (const requestFn of [primaryRequestFn, secondaryRequestFn]) {
    const responses = await Promise.all(
      [false, true].map((isCompleted) =>
        requestFn(
          {
            SeachKey: trimmedRefundNo,
            IsCompleted: isCompleted,
            PageSize: 20,
            PageIndex: 1,
          },
          { skipErrorMessage: true },
        ).catch(() => null),
      ),
    );

    for (const response of responses) {
      const payload = (response as { data?: unknown } | null)?.data ?? response;
      const payloadItems = (payload as { items?: AdminRefundTicketListItemDto[] })
        ?.items;
      const items: AdminRefundTicketListItemDto[] = Array.isArray(payloadItems)
        ? payloadItems
        : [];
      const matchedItem = items.find(
        (item) => String(item?.applicationNo ?? "").trim() === trimmedRefundNo,
      );

      if (matchedItem) {
        return mapAdminRefundListItemToRecord(matchedItem);
      }
    }
  }

  return null;
}

function getRefundReferenceLabel(category?: string | null) {
  return String(category ?? "")
    .toLowerCase()
    .includes("fine")
    ? "fineNumber"
    : "applicationNumber";
}

function DetailButton({
  children,
  onClick,
  icon,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: "primary" | "outline" | "muted";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={`refund-detail-button is-${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Spin size="small" className="refund-detail-button__spinner" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
}

function RefundDetailInfoRow({
  label,
  value,
  danger = false,
  fullWidth = false,
  valueClassName,
}: {
  label: string;
  value?: React.ReactNode;
  danger?: boolean;
  fullWidth?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={`refund-details-info-item ${fullWidth ? "is-full-width" : ""}`}
    >
      <div className="refund-details-info-label">{label}</div>
      <div
        className={`refund-details-info-value ${danger ? "is-danger" : ""} ${
          valueClassName ?? ""
        }`}
      >
        {value === undefined || value === null || value === "" ? "-" : value}
      </div>
    </div>
  );
}

function RefundCurrencyValue({
  value,
  danger = false,
}: {
  value: string;
  danger?: boolean;
}) {
  return (
    <span className={`refund-currency-value ${danger ? "is-danger" : ""}`}>
      <img
        src={danger ? currencyDangerIcon : currencyNeutralIcon}
        alt=""
        className="refund-currency-icon"
      />
      <span>{value}</span>
    </span>
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
      className="refund-side-card-header refund-side-card-header-figma"
      onClick={onToggle}
    >
      <span>{title}</span>
      <span className="refund-side-card-header-actions">
        <span
          className={`refund-card-chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        >
          <img src={cardHeaderCollapseIcon} alt="" />
        </span>
        {showExpandIcon && onExpand ? (
          <span
            className="refund-card-expand"
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

function TimelineText({
  segments,
  className,
}: {
  segments?: RefundTimelineTextSegment[];
  className?: string;
}) {
  if (!segments?.length) return null;

  return (
    <div className={className}>
      {segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={`refund-timeline-segment ${
            segment.tone ? `is-${segment.tone}` : ""
          }`}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}

function TimelineMetaRow({
  icon,
  text,
  className,
}: {
  icon: "user" | "calendar" | "action";
  text?: React.ReactNode;
  className?: string;
}) {
  const iconSrc =
    icon === "user"
      ? timelineUserIcon
      : icon === "calendar"
      ? timelineCalendarIcon
      : timelineActionIcon;

  if (!text) return null;

  return (
    <div className={`refund-timeline-meta-row ${className ?? ""}`}>
      <img src={iconSrc} alt="" aria-hidden="true" />
      <div className="refund-timeline-meta-text">{text}</div>
    </div>
  );
}

function RefundTimelineCard({
  items,
  onOpenAttachments,
}: {
  items: RefundTimelineItem[];
  onOpenAttachments: (item: RefundTimelineItem) => void;
}) {
  const { t } = useTranslation();
  if (!items.length) {
    return (
      <div className="refund-side-card-content refund-overview-content">
        <Empty
          className="refund-comments-empty"
          description={t("Customer.customerRefundsDetails.timeline.noTimeline")}
        />
      </div>
    );
  }

  return (
    <div className="refund-timeline-list">
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const timelineAttachments = item.attachments ?? [];
        const attachmentCount =
          item.attachments?.length ?? item.attachmentsCount ?? 0;
        const shouldRenderInlineAttachments =
          timelineAttachments.length > 0 &&
          timelineAttachments.length < 3 &&
          timelineAttachments.length === attachmentCount;
        const isCancelled = item.eventCode === "cancelled";

        return (
          <div className="refund-timeline-item" key={item.id}>
            <div className="refund-timeline-marker">
              {!isFirst ? (
                <span className="refund-timeline-marker-line is-top" />
              ) : null}
              <span
                className={`refund-timeline-marker-dot is-${item.dotTone}`}
              />
              {!isLast ? (
                <span className="refund-timeline-marker-line is-bottom" />
              ) : null}
            </div>
            <div className="refund-timeline-body">
              <div className="refund-timeline-title">{item.title}</div>
              {!isCancelled && item.actorLabel ? (
                <TimelineMetaRow icon="user" text={item.actorLabel} />
              ) : null}
              {!isCancelled && item.departmentLabel ? (
                <div className="refund-timeline-department">
                  {item.departmentLabel}
                </div>
              ) : null}
              <TimelineMetaRow
                icon="calendar"
                text={formatDateTime(item.changedAt)}
              />
              {item.actionSegments?.length ? (
                <TimelineMetaRow
                  icon="action"
                  text={
                    <TimelineText
                      segments={item.actionSegments}
                      className="refund-timeline-inline-text"
                    />
                  }
                />
              ) : null}
              {!isCancelled && item.recommendationSegments?.length ? (
                <>
                  <div className="refund-timeline-note-divider" />
                  <TimelineMetaRow
                    icon="action"
                    className="is-recommendation"
                    text={
                      <TimelineText
                        segments={item.recommendationSegments}
                        className="refund-timeline-inline-text"
                      />
                    }
                  />
                </>
              ) : null}
              {!isCancelled && item.description ? (
                <div className="refund-timeline-note">{item.description}</div>
              ) : null}
              {!isCancelled && item.note ? (
                <div className="refund-timeline-note">{item.note}</div>
              ) : null}
              {!isCancelled && shouldRenderInlineAttachments ? (
                <AttachmentsDisplay
                  attachments={timelineAttachments}
                  className="refund-timeline-inline-attachments"
                  compact
                  variant="applicationInfo"
                />
              ) : !isCancelled && attachmentCount ? (
                <button
                  type="button"
                  className="refund-timeline-attachments"
                  onClick={() => onOpenAttachments(item)}
                >
                  <div className="refund-timeline-attachments-left">
                    <img
                      src={timelineAttachmentIcon}
                      alt=""
                      aria-hidden="true"
                    />
                    <span>{t("Customer.customerRefundsDetails.common.attachments")}</span>
                  </div>
                  <span>{attachmentCount}</span>
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getCommentRoleClassName(label?: string) {
  if (label?.toLocaleLowerCase()?.includes("licensing")) return "is-licensing";
  if (label?.toLocaleLowerCase()?.includes("business")) return "is-licensing";
  if (label?.toLocaleLowerCase()?.includes("content")) return "is-licensing";
  if (label?.toLocaleLowerCase()?.includes("happiness")) return "is-happiness";
  return "is-customer";
}

function getRecommendationDisplayText(
  recommendation: string | undefined,
  t: TFunction,
) {
  if (recommendation === "Approve") {
    return t("Customer.customerRefunds.departmentModal.approve");
  }

  if (recommendation === "Reject") {
    return t("Customer.customerRefunds.departmentModal.reject");
  }

  return recommendation || "";
}

function getCommentDisplayRole(
  comment: RefundComment,
  internalNoteLabel: string,
) {
  const senderDepartment = normalizeCommentIdentityValue(
    comment.senderDepartment,
  );
  if (senderDepartment) {
    return senderDepartment;
  }

  const senderLabel = normalizeCommentIdentityValue(comment.senderLabel);
  if (senderLabel && senderLabel !== internalNoteLabel) {
    return senderLabel;
  }

  return "";
}

function shouldShowInternalNoteTag(comment: RefundComment) {
  if (comment.kind === "system") {
    return true;
  }

  if (comment.audience === "internal") {
    return true;
  }

  return false;
}

function resolveCommentSenderName(comment: RefundComment) {
  const senderName = normalizeCommentIdentityValue(comment.senderName);
  if (senderName) return senderName;

  return "-";
}

function resolveCommentAvatarSrc(comment: RefundComment) {
  const senderPhotoUrl = buildCommentAvatarSrc(comment.senderPhotoUrl);
  if (senderPhotoUrl) return senderPhotoUrl;

  return undefined;
}

type RefundCommunicationSummaryCardData = {
  title?: string;
  sentAt?: string;
  responseDeadline?: string;
  recommendation?: string;
  notes?: string;
  attachments?: RefundAttachment[];
};

interface CustomerRefundsDetailsBodyProps {
  record: RefundRecord;
  appInfoOpen: boolean;
  setAppInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRelatedPaymentCompleted: boolean;
  communicationSummaryCard: RefundCommunicationSummaryCardData;
  hasCommunicationSummary: boolean;
  visibleCommunicationRecords: RefundComment[];
  hasMessageComposer: boolean;
  activeAudience: RefundAudience;
  composerTabs: Array<{ key: RefundAudience; label: string }>;
  showComposerTabs: boolean;
  setActiveAudience: React.Dispatch<React.SetStateAction<RefundAudience>>;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  composerPlaceholder: string;
  attachments: RefundAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<RefundAttachment[]>>;
  beforeUpload: (file: RcFile) => boolean;
  handleUpload: (options: UploadRequestOption) => Promise<void>;
  canSendMessage: boolean;
  sending: boolean;
  handleSendMessage: () => Promise<void>;
  applicationOverviewApplicantDataOverride?: ApplicationOverviewProfileData;
  applicationOverviewRelatedSectionData?: IRelateAppsResponse;
  refundTimelineAdditionalCard: React.ReactNode;
  fullScreenApplicantData?: IUserIndividualProfile;
  fullScreenEstablishmentData?: IEstablishmentOverview;
  fullScreenProfileAndApplicantData?: ProfileAndApplicantOverviewData;
}

const CustomerRefundsDetailsBody: React.FC<
  CustomerRefundsDetailsBodyProps
> = ({
  record,
  appInfoOpen,
  setAppInfoOpen,
  isRelatedPaymentCompleted,
  communicationSummaryCard,
  hasCommunicationSummary,
  visibleCommunicationRecords,
  hasMessageComposer,
  activeAudience,
  composerTabs,
  showComposerTabs,
  setActiveAudience,
  message,
  setMessage,
  composerPlaceholder,
  attachments,
  setAttachments,
  beforeUpload,
  handleUpload,
  canSendMessage,
  sending,
  handleSendMessage,
  applicationOverviewApplicantDataOverride,
  applicationOverviewRelatedSectionData,
  refundTimelineAdditionalCard,
  fullScreenApplicantData,
  fullScreenEstablishmentData,
  fullScreenProfileAndApplicantData,
}) => {
  const {
    userProfileId,
    applicationOverviewRelatedSectionData: userProfileRelatedSectionData,
  } = useApplicationOverviewData();
  const overviewFullScreen = useApplicationOverviewFullScreenController();
  const history = useHistory();
  const { t } = useTranslation();
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  );
  const permissionPathSet = useMemo(
    () => createPermissionPathSet(permissions),
    [permissions],
  );
  const {
    profileAndApplicantData: controllerProfileAndApplicantData,
    ...overviewFullScreenProps
  } = overviewFullScreen.fullScreenProps;
  const resolvedApplicationOverviewRelatedSectionData =
    applicationOverviewRelatedSectionData
      ? {
          ...applicationOverviewRelatedSectionData,
          applicationCount: userProfileRelatedSectionData?.applicationCount,
          enquiryServiceCount:
            userProfileRelatedSectionData?.enquiryServiceCount,
          refundCount: userProfileRelatedSectionData?.refundCount,
          appealCount: userProfileRelatedSectionData?.appealCount,
        }
      : userProfileRelatedSectionData ?? undefined;
  const handleRelatedApplicationReferenceClick = useCallback(
    async (applicationNo: string) => {
      try {
        const response = await getTaskType({ applicationNo });
        const payload = unwrapTaskLookupPayload(
          response as
            | RelatedApplicationTaskLookup
            | {
                data?:
                  | RelatedApplicationTaskLookup
                  | { data?: RelatedApplicationTaskLookup };
              }
            | null,
        );
        const targetRoute =
          payload?.departmentId !== undefined
            ? APPLICATION_DETAIL_ROUTE_MAP[payload.departmentId]
            : undefined;

        if (targetRoute && payload?.taskId) {
          if (!permissionPathSet.has(normalizeRoutePath(targetRoute))) {
            CustomMessage.warning(t("response.error.403"));
            return;
          }

          history.push(`${targetRoute}?taskId=${payload.taskId}`);
          return;
        }
      } catch {
        // Use the shared warning below for failed lookups.
      }

      CustomMessage.warning(
        t("Customer.customerRefunds.messages.relatedApplicationNotFound"),
      );
    },
    [history, permissionPathSet, t],
  );

  return (
    <div
      className={`refund-details-layout ${
        overviewFullScreen.isFullScreen ? "is-fullscreen-mode" : ""
      }`}
    >
      {overviewFullScreen.isFullScreen ? (
        <div className="refund-details-fullscreen-wrap">
          <FullScreen
            type={overviewFullScreen.fullScreenType}
            applicant={fullScreenApplicantData}
            establishment={fullScreenEstablishmentData}
            userId={record.userId}
            userProfileId={userProfileId}
            profileId={record.profileId}
            profileAndApplicantData={
              controllerProfileAndApplicantData ??
              fullScreenProfileAndApplicantData
            }
            visualVariant="figmaOverview"
            {...overviewFullScreenProps}
          />
        </div>
      ) : (
        <>
          <div className="refund-details-main">
            <div className="refund-section-card refund-section-collapsible">
              <button
                type="button"
                className="refund-section-header"
                onClick={() => setAppInfoOpen((prev) => !prev)}
              >
                <span>
                  {t(
                    "Customer.customerRefundsDetails.sections.refundApplicationInformation",
                  )}
                </span>
                <ExpandArrowIcon open={appInfoOpen} />
              </button>
              {appInfoOpen && (
                <div className="refund-section-content">
                  <div className="refund-details-info-grid refund-details-info-grid-main">
                    <RefundDetailInfoRow
                      label={t("Customer.customerRefundsDetails.top.refundCategory")}
                      value={record.categoryDisplay || record.category}
                    />
                    <RefundDetailInfoRow
                      label={t(
                        `Customer.customerRefundsDetails.sections.${getRefundReferenceLabel(
                          record.category,
                        )}`,
                      )}
                      value={record.referenceNo || undefined}
                      valueClassName="is-highlight"
                    />
                    <RefundDetailInfoRow
                      label={t("Customer.customerRefundsDetails.sections.refundReason")}
                      value={
                        record.refundReasonDisplay ||
                        record.refundReason ||
                        undefined
                      }
                    />
                    <RefundDetailInfoRow
                      label={t("Customer.customerRefundsDetails.sections.refundAmount")}
                      value={
                        <RefundCurrencyValue
                          value={String(formatMoney(Math.abs(record.amount)))}
                          danger={false}
                        />
                      }
                    />
                    <RefundDetailInfoRow
                      label={t("Customer.customerRefundsDetails.common.attachments")}
                      value={
                        <AttachmentsDisplay
                          attachments={record.attachments}
                          compact
                          variant="applicationInfo"
                        />
                      }
                      fullWidth
                      valueClassName="has-attachments"
                    />
                    <RefundDetailInfoRow
                      label={t("Customer.profileDetail.modals.notes")}
                      value={record.notes || undefined}
                      fullWidth
                    />
                  </div>

                  <div className="refund-related-payment">
                    <div className="refund-related-title">
                      {t(
                        "Customer.customerRefundsDetails.sections.relatedPaymentInformation",
                      )}
                    </div>
                    <div className="refund-details-info-grid refund-details-info-grid-related">
                      <RefundDetailInfoRow
                        label={t(
                          "Customer.customerRefundsDetails.sections.transactionNumber",
                        )}
                        value={record.relatedPayment.transactionNo || undefined}
                      />
                      <RefundDetailInfoRow
                        label={t("Customer.customerRefundsDetails.top.status")}
                        value={record.relatedPayment.status || undefined}
                        valueClassName={
                          isRelatedPaymentCompleted ? "is-success" : undefined
                        }
                      />
                      <RefundDetailInfoRow
                        label={t(
                          "Customer.customerRefundsDetails.sections.transactionType",
                        )}
                        value={record.relatedPayment.transactionType || undefined}
                      />
                      <RefundDetailInfoRow
                        label={t(
                          "Customer.customerRefundsDetails.sections.lastUpdatedTime",
                        )}
                        value={
                          record.relatedPayment.lastUpdatedAt
                            ? formatDateTime(record.relatedPayment.lastUpdatedAt)
                            : undefined
                        }
                      />
                      <RefundDetailInfoRow
                        label={t(
                          "Customer.customerRefundsDetails.sections.paymentMethod",
                        )}
                        value={record.relatedPayment.paymentMethod || undefined}
                      />
                      <RefundDetailInfoRow
                        label={t(
                          "Customer.customerRefundsDetails.sections.cardInformation",
                        )}
                        value={record.relatedPayment.cardInformation || undefined}
                      />
                      <RefundDetailInfoRow
                        label={t(
                          "Customer.customerRefundsDetails.sections.amountCharged",
                        )}
                        value={
                          record.relatedPayment.amountCharged ? (
                            <RefundCurrencyValue
                              value={String(formatMoney(Math.abs(
                                record.relatedPayment.amountCharged,
                              )))}
                              danger
                            />
                          ) : undefined
                        }
                        valueClassName="is-danger"
                      />
                      <RefundDetailInfoRow
                        label={t("Customer.customerRefundsDetails.top.applyFor")}
                        value={record.applyFor.name || undefined}
                      />
                    </div>
                    <div className="refund-related-divider" />
                    <div className="refund-details-info-grid refund-details-info-grid-description">
                      <RefundDetailInfoRow
                        label={t("Customer.customerRefundsDetails.sections.description")}
                        value={record.relatedPayment.description || undefined}
                        fullWidth
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="refund-section-card">
              <div className="refund-section-title">
                {t("Customer.customerRefundsDetails.sections.communicationRecords")}
              </div>
              <div
                className={`refund-comments-list ${
                  hasMessageComposer ? "has-composer" : "is-readonly"
                }`}
              >
                {hasCommunicationSummary ? (
                  <RefundCommunicationSummaryCard
                    summary={communicationSummaryCard}
                  />
                ) : null}
                {visibleCommunicationRecords.length
                  ? visibleCommunicationRecords.map((comment) => (
                      <RefundCommentBlock comment={comment} key={comment.id} />
                    ))
                  : !hasCommunicationSummary && (
                      <Empty
                        className="refund-comments-empty"
                        description={t(
                          "Customer.customerRefundsDetails.communication.noRecords",
                        )}
                      />
                    )}
              </div>

              {hasMessageComposer && (
                <div
                  className={`refund-message-composer ${
                    activeAudience === "customer"
                      ? "is-customer-reply"
                      : "is-internal-note"
                  }`}
                >
                  <div
                    className={`refund-message-composer-shell ${
                      activeAudience === "customer"
                        ? "is-customer-reply"
                        : "is-internal-note"
                    }`}
                  >
                    {showComposerTabs ? (
                      <div className="refund-message-composer-tabs">
                        {composerTabs.map((tab) => {
                          const selected = tab.key === activeAudience;
                          return (
                            <button
                              type="button"
                              key={tab.key}
                              className={`refund-message-tab ${
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
                      className={`refund-message-input-shell ${
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
                        className="no-textarea-ui"
                        placeholder={composerPlaceholder}
                      />
                      {attachments.length ? (
                        <RefundAttachments
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
                      <div className="refund-composer-bottom">
                        <div className="refund-composer-counter">
                          {message.length}/1000
                        </div>
                        <div className="refund-composer-actions">
                          <Upload
                            showUploadList={false}
                            beforeUpload={beforeUpload}
                            customRequest={handleUpload}
                            accept=".jpg,.jpeg,.png,.pdf"
                            disabled={attachments.length >= 3}
                          >
                            <span
                              className={`refund-upload-button is-square ${
                                attachments.length ? "has-attachments" : ""
                              } ${
                                attachments.length >= 3 ? "is-disabled" : ""
                              }`}
                            >
                              <img
                                src={REFUND_ACTION_ICON_MAP.messageAttach}
                                alt=""
                              />
                            </span>
                          </Upload>
                          <PermissionGuard
                            permissionCode="CustomerModule.Refunds.RefundsDetails.Send"
                            routePath="/happiness/refunds/refundsDetails"
                          >
                            <DetailButton
                              variant={
                                canSendMessage && !sending
                                  ? "primary"
                                  : "muted"
                              }
                              disabled={!canSendMessage || sending}
                              loading={sending}
                              onClick={handleSendMessage}
                            >
                              {t("Customer.customerRefundsDetails.communication.send")}
                            </DetailButton>
                          </PermissionGuard>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="refund-details-side">
            <ApplicationOverviewCards
              profileOverviewDefaultExpanded
              additionalCards={refundTimelineAdditionalCard}
              {...overviewFullScreen.applicationOverviewCardProps}
              showApplicantExpandButton
              applicantOverviewDataOverride={
                applicationOverviewApplicantDataOverride
              }
              applicationOverviewRelatedSectionData={
                resolvedApplicationOverviewRelatedSectionData
              }
              onRelatedApplicationReferenceClick={
                handleRelatedApplicationReferenceClick
              }
              currentApplicationNumber={record.referenceNo}
              currentServiceId={record.applyFor.id}
            />
          </div>
        </>
      )}
    </div>
  );
};

function buildCommunicationSummaryCardData(
  record?: RefundRecord | null,
): RefundCommunicationSummaryCardData {
  const initialComment = record?.communicationRecords?.[0];

  if (initialComment) {
    return {
      title: normalizeCommentIdentityValue(initialComment.content),
      sentAt: initialComment.sentAt,
      responseDeadline:
        initialComment.responseDeadline || record?.responseDeadline,
      recommendation: initialComment.recommendation,
      notes: normalizeCommentIdentityValue(initialComment.notes),
      attachments: initialComment.attachments,
    };
  }

  return {};
}

function hasCommunicationSummaryContent(
  summary?: RefundCommunicationSummaryCardData | null,
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

function getSystemCommentVariantClassName(comment: RefundComment) {
  const hasStructuredDetails = Boolean(
    comment.responseDeadline ||
      comment.recommendation ||
      comment.notes ||
      comment.attachments?.length,
  );

  return hasStructuredDetails ? "is-structured" : "is-note";
}

function RefundCommentAvatar({ avatarSrc }: { avatarSrc?: string }) {
  return (
    <div className={`refund-comment-avatar${avatarSrc ? " has-photo" : ""}`}>
      <AuthenticatedDocumentImage
        src={avatarSrc}
        fallbackSrc={REFUND_ACTION_ICON_MAP.userAvatar}
        alt=""
      />
    </div>
  );
}

function RefundCommentBlock({ comment }: { comment: RefundComment }) {
  const { t } = useTranslation();
  const internalNoteLabel = t(
    "Customer.customerRefundsDetails.communication.internalNote",
  );
  const displayRole = getCommentDisplayRole(comment, internalNoteLabel);
  const showInternalNoteTag = shouldShowInternalNoteTag(comment);
  const senderName = resolveCommentSenderName(comment);
  const avatarSrc = resolveCommentAvatarSrc(comment);

  if (comment.kind === "system") {
    const systemVariantClassName = getSystemCommentVariantClassName(comment);

    return (
      <div
        className={`refund-comment-block refund-comment-block-system ${systemVariantClassName}`}
      >
        <div className={`refund-comment-system ${systemVariantClassName}`}>
          <div
            className={`refund-comment-system-top ${systemVariantClassName}`}
          >
            <div className="refund-comment-system-title">{comment.content}</div>
            <div className="refund-comment-system-meta">
              <span className="refund-comment-tag">{internalNoteLabel}</span>
              <span>{formatDateTime(comment.sentAt)}</span>
            </div>
          </div>
          {comment.responseDeadline && (
            <div className="refund-comment-subtext">
              <span className="refund-comment-subtext-label">
                {t("Customer.customerRefundsDetails.communication.responseDeadline")}:
              </span>{" "}
              <span className="refund-comment-subtext-value">
                {formatDateTimeMinute(comment.responseDeadline)}
              </span>
            </div>
          )}
          {comment.recommendation && (
            <div className="refund-comment-subtext refund-comment-recommendation">
              <span className="refund-comment-recommendation-label">
                {t("Customer.customerRefundsDetails.communication.recommendedAction")}:
              </span>
              <span
                className={`refund-comment-recommendation-value${comment.recommendation === "Approve" ? " is-approve" : ""}`}
              >
                {getRecommendationDisplayText(comment.recommendation, t)}
              </span>
            </div>
          )}
          {comment.notes ? (
            <div className="refund-comment-subtext refund-comment-note">
              {comment.notes}
            </div>
          ) : null}
        </div>
        {comment.attachments?.length ? (
          <RefundAttachments
            attachments={comment.attachments}
            compact
            variant="communication"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="refund-comment-block">
      <div className="refund-comment-message">
        <RefundCommentAvatar avatarSrc={avatarSrc} />
        <div className="refund-comment-content">
          <div className="refund-comment-header">
            <div className="refund-comment-identity">
              <span className="refund-comment-name">{senderName}</span>
              {displayRole ? (
                <span
                  className={`refund-comment-role ${getCommentRoleClassName(
                    displayRole,
                  )}`}
                >
                  {displayRole}
                </span>
              ) : null}
            </div>
            <div className="refund-comment-meta-right">
              {showInternalNoteTag ? (
                <span className="refund-comment-tag">{internalNoteLabel}</span>
              ) : null}
              <div className="refund-comment-time">
                {formatDateTime(comment.sentAt)}
              </div>
            </div>
          </div>
          {comment.content ? (
            <div className="refund-comment-text">{comment.content}</div>
          ) : null}
          {comment.notes ? (
            <div className="refund-comment-subtext refund-comment-note">
              {comment.notes}
            </div>
          ) : null}
          {comment.recommendation ? (
            <div className="refund-comment-subtext refund-comment-recommendation">
              <span className="refund-comment-recommendation-label">
                {t("Customer.customerRefundsDetails.communication.recommendedAction")}:
              </span>
              <span
                className={`refund-comment-recommendation-value${comment.recommendation === "Approve" ? " is-approve" : ""}`}
              >
                {getRecommendationDisplayText(comment.recommendation, t)}
              </span>
            </div>
          ) : null}
          {comment.attachments?.length ? (
            <RefundAttachments
              attachments={comment.attachments}
              compact
              variant="communication"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RefundCommunicationSummaryCard({
  summary,
}: {
  summary: RefundCommunicationSummaryCardData;
}) {
  const { t } = useTranslation();
  return (
    <div className="refund-comment-block refund-comment-block-system refund-comment-block-summary is-summary">
      <div className="refund-comment-system is-summary">
        <div className="refund-comment-system-top is-summary">
          {summary.title ? (
            <div className="refund-comment-system-title">{summary.title}</div>
          ) : null}
          <div className="refund-comment-system-meta">
            <span className="refund-comment-tag">
              {t("Customer.customerRefundsDetails.communication.internalNote")}
            </span>
            {summary.sentAt ? (
              <span>{formatDateTime(summary.sentAt)}</span>
            ) : null}
          </div>
        </div>
        {summary.responseDeadline ? (
          <div className="refund-comment-subtext">
            <span className="refund-comment-subtext-label">
              {t("Customer.customerRefundsDetails.communication.responseDeadline")}:
            </span>{" "}
            <span className="refund-comment-subtext-value">
              {formatDateTimeMinute(summary.responseDeadline)}
            </span>
          </div>
        ) : null}
        {summary.recommendation ? (
          <div className="refund-comment-subtext refund-comment-recommendation">
            <span className="refund-comment-recommendation-label">
              {t("Customer.customerRefundsDetails.communication.recommendedAction")}:
            </span>
            <span
              className={`refund-comment-recommendation-value${summary.recommendation === "Approve" ? " is-approve" : ""}`}
            >
              {getRecommendationDisplayText(summary.recommendation, t)}
            </span>
          </div>
        ) : null}
        {summary.notes ? (
          <div className="refund-comment-subtext refund-comment-note">
            {summary.notes}
          </div>
        ) : null}
      </div>
      {summary.attachments?.length ? (
        <RefundAttachments
          attachments={summary.attachments}
          compact
          variant="communication"
        />
      ) : null}
    </div>
  );
}

const CustomerRefundsDetails: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const queryViewRole = useMemo(
    () => getRefundViewRoleFromSearchParams(searchParams),
    [searchParams],
  );
  const fallbackViewRole = queryViewRole ?? DEFAULT_REFUND_VIEW_ROLE;
  const hasExplicitRoleFromQuery = queryViewRole !== undefined;
  const [viewRole, setViewRole] = useState<RefundViewRole>(fallbackViewRole);
  const [roleReady, setRoleReady] = useState(hasExplicitRoleFromQuery);
  const roleConfig =
    REFUND_ROLE_CONFIG[viewRole] ??
    REFUND_ROLE_CONFIG[DEFAULT_REFUND_VIEW_ROLE];
  const isBusinessRole = viewRole === "business_department";
  const [record, setRecord] = useState<RefundRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);
  const [allowedFinalStatuses, setAllowedFinalStatuses] = useState<
    RefundStatusChangePayload["nextStatus"][]
  >([]);
  const [departmentActionOpen, setDepartmentActionOpen] = useState(false);
  const [departmentActionMode, setDepartmentActionMode] =
    useState<RefundDepartmentActionMode>("process");
  const [filterOptions, setFilterOptions] = useState<RefundFilterOptions>({
    handlers: [],
    categories: [],
    todoStatuses: [],
    completedStatuses: [],
    completedSources: [],
  });
  const [departmentHandlers, setDepartmentHandlers] = useState<RefundHandler[]>(
    [],
  );
  const [statusOptions, setStatusOptions] = useState<RefundStatusItemDto[]>([]);
  const [applicantDetails, setApplicantDetails] =
    useState<IUserIndividualProfile | null>(null);
  const [establishmentDetails, setEstablishmentDetails] =
    useState<IEstablishmentOverview | null>(null);
  const [profileAndApplicantData, setProfileAndApplicantData] =
    useState<ProfileAndApplicantOverviewData | null>(null);
  const [applicationOverviewDetail, setApplicationOverviewDetail] =
    useState<RelatedApplicationOverviewDetail | null>(null);
  const [applicationOverviewStats, setApplicationOverviewStats] = useState({
    historicalApplications: 0,
    historicalTickets: 0,
    refunds: 0,
    appeals: 0,
  });
  const [appInfoOpen, setAppInfoOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedValue = window.sessionStorage.getItem(
      APP_INFO_OPEN_STORAGE_KEY,
    );
    if (storedValue === null) return false;
    return storedValue === "true";
  });
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<RefundAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [activeAudience, setActiveAudience] = useState<RefundAudience>(
    roleConfig.message.defaultAudience,
  );
  const [selectedTimelineItem, setSelectedTimelineItem] =
    useState<RefundTimelineItem | null>(null);
  const viewRoleRef = useRef(viewRole);
  const communicationSummaryCard = useMemo(
    () => buildCommunicationSummaryCardData(record),
    [record],
  );
  const hasCommunicationSummary = hasCommunicationSummaryContent(
    communicationSummaryCard,
  );
  const visibleCommunicationRecords = useMemo(() => {
    if (!record) return [];
    if (!hasCommunicationSummary) {
      return record.communicationRecords;
    }

    return record.communicationRecords.slice(1);
  }, [hasCommunicationSummary, record]);

  const refundParams = searchParams;
  const refundNo = useMemo(() => {
    return refundParams.get("refundNo") ?? "";
  }, [refundParams]);
  const refundId = useMemo(() => {
    const value = refundParams.get("refundId");
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [refundParams]);
  const teamManagementScope = useMemo(() => {
    const scope = searchParams.get("teamManagementScope");
    return isTeamManagementBreadcrumbScope(scope) ? scope : null;
  }, [searchParams]);
  const teamManagementBackPath = useMemo(() => {
    if (
      searchParams.get("breadcrumbMode") !==
        TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE ||
      !teamManagementScope
    ) {
      return "";
    }

    return TEAM_MANAGEMENT_BACK_PATH_BY_SCOPE[teamManagementScope];
  }, [searchParams, teamManagementScope]);
  const shouldReturnToDashboard = searchParams.get("returnTo") === "dashboard";

  useEffect(() => {
    if (!roleReady) return;

    const params = new URLSearchParams(location.search);
    let changed = false;
    if (params.get("viewRole") !== viewRole) {
      params.set("viewRole", viewRole);
      changed = true;
    }
    if (params.get("pageTitleKey") !== roleConfig.ui.detailsPageTitleKey) {
      params.set("pageTitleKey", roleConfig.ui.detailsPageTitleKey);
      changed = true;
    }
    if (params.get("breadcrumbRootKey") !== roleConfig.ui.breadcrumbRootKey) {
      params.set("breadcrumbRootKey", roleConfig.ui.breadcrumbRootKey);
      changed = true;
    }
    if (!changed) return;
    history.replace({
      pathname: location.pathname,
      search: params.toString(),
      state: location.state,
    });
  }, [
    history,
    location.pathname,
    location.search,
    location.state,
    roleReady,
    roleConfig.ui.breadcrumbRootKey,
    roleConfig.ui.detailsPageTitleKey,
    viewRole,
  ]);

  const canChangeStatus = canShowRefundChangeStatusAction(
    record,
    roleConfig.details.allowChangeStatusStatuses,
  );
  const canDepartmentAction = Boolean(
    record?.refundId &&
      roleConfig.details.allowDepartmentActionStatuses.includes(record.status),
  );
  const canCustomerReply = Boolean(
    record &&
      roleConfig.details.allowCustomerReplyStatuses.includes(record.status),
  );
  const canInternalNote = Boolean(
    record &&
      roleConfig.details.allowInternalNoteStatuses.includes(record.status),
  );
  const hasMessageComposer = canCustomerReply || canInternalNote;
  const showFooterStatus = Boolean(
    !isBusinessRole &&
      roleConfig.details.allowCustomerReplyStatuses.includes(
        record?.status ?? "",
      ),
  );

  const composerTabs = useMemo<
    Array<{ key: RefundAudience; label: string }>
  >(() => {
    const tabs: Array<{ key: RefundAudience; label: string }> = [];
    if (canCustomerReply) {
      tabs.push({
        key: "customer",
        label: t("Customer.customerRefundsDetails.communication.replyToCustomer"),
      });
    }
    if (canInternalNote) {
      tabs.push({
        key: "internal",
        label: t("Customer.customerRefundsDetails.communication.internalNote"),
      });
    }
    return tabs;
  }, [canCustomerReply, canInternalNote, t]);
  const showComposerTabs = canCustomerReply || (composerTabs.length > 1);
  const composerPlaceholder =
    activeAudience === "customer"
      ? t("Customer.customerRefundsDetails.communication.replyToCustomer")
      : t("Customer.customerRefundsDetails.communication.internalNotePlaceholder");

  const canSendMessage = Boolean(
    hasMessageComposer &&
      composerTabs.some((item) => item.key === activeAudience) &&
      (message.trim() || attachments.length),
  );

  const syncRefundIdToUrl = useCallback(
    (nextRefundId?: number | null) => {
      if (nextRefundId === undefined || nextRefundId === null) return;
      const params = new URLSearchParams(location.search);
      const normalizedRefundId = String(nextRefundId);
      let changed = false;

      if (params.get("refundId") !== normalizedRefundId) {
        params.set("refundId", normalizedRefundId);
        changed = true;
      }

      if (
        teamManagementScope &&
        params.get("teamTaskSourceType") === "refund" &&
        !params.get("teamTaskSourceId")
      ) {
        params.set("teamTaskSourceId", normalizedRefundId);
        changed = true;
      }

      if (!changed) return;
      history.replace({
        pathname: location.pathname,
        search: params.toString(),
        state: location.state,
      });
    },
    [
      history,
      location.pathname,
      location.search,
      location.state,
      teamManagementScope,
    ],
  );

  const handleBack = useCallback(() => {
    const dashboardReturnState = readDashboardReturnState(location.state);

    if (dashboardReturnState) {
      history.push(createDashboardReturnLocation(dashboardReturnState));
      return;
    }

    if (shouldReturnToDashboard) {
      history.push("/dashboard");
      return;
    }

    if (teamManagementBackPath) {
      if (readTeamManagementReturnLocation(location.state)) {
        history.goBack();
        return;
      }

      history.push(teamManagementBackPath);
      return;
    }

    history.push("/happiness/refunds", {
      [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
    });
  }, [history, location.state, shouldReturnToDashboard, teamManagementBackPath]);

  useEffect(() => {
    viewRoleRef.current = viewRole;
  }, [viewRole]);

  useEffect(() => {
    if (!hasExplicitRoleFromQuery) return;
    setRoleReady(true);
    setViewRole((prev) =>
      prev === fallbackViewRole ? prev : fallbackViewRole,
    );
  }, [fallbackViewRole, hasExplicitRoleFromQuery]);

  const loadRecord = useCallback(
    async (
      fallbackViewRole?: RefundViewRole,
      options?: { showLoading?: boolean },
    ): Promise<RefundRecord | null> => {
      if (!refundNo && refundId === undefined) {
        setRecord(null);
        setLoading(false);
        return null;
      }

      const shouldShowLoading = options?.showLoading ?? true;

      if (shouldShowLoading) {
        setLoading(true);
      }
      try {
        const effectiveViewRole = fallbackViewRole ?? viewRoleRef.current;
        const listRecord = refundNo
          ? await loadAdminRefundListRecordByNo(refundNo, effectiveViewRole)
          : null;
        const effectiveRefundId = refundId ?? listRecord?.refundId;

        if (effectiveRefundId === undefined) {
          setRecord(null);
          return null;
        }

        syncRefundIdToUrl(effectiveRefundId);

        const detailResponse = await getAdminRefundTicketDetail(effectiveRefundId);
        const detailPayload =
          (detailResponse as { data?: unknown })?.data ?? detailResponse;
        let timelineItems: AdminRefundTimelineItemDto[] = [];

        try {
          const timelineResponse = await getAdminRefundTicketTimeline(effectiveRefundId);
          const timelinePayload =
            (timelineResponse as { data?: unknown })?.data ?? timelineResponse;
          timelineItems = Array.isArray(timelinePayload) ? timelinePayload : [];
        } catch {
          timelineItems = [];
        }

        const nextRecord = mergeAdminRefundDetail(
          null,
          detailPayload,
          timelineItems,
        );
        setRecord(nextRecord);
        return nextRecord;
      } catch (error) {
        console.error(error);
        setRecord(null);
        return null;
      } finally {
        if (shouldShowLoading) {
          setLoading(false);
        }
      }
    },
    [refundId, refundNo, syncRefundIdToUrl],
  );

  useEffect(() => {
    let cancelled = false;
    const loadPageContext = async () => {
      try {
        const statsResponse = await getAdminRefundTicketsStatistics();

        if (cancelled) return;

        const statsPayload =
          (statsResponse as { data?: unknown })?.data ?? statsResponse;
        const nextRole = hasExplicitRoleFromQuery
          ? fallbackViewRole
          : resolveRefundViewRole(statsPayload);
        const statusRequest =
          nextRole === "customer_happiness"
            ? getAdminRefundStatusTypes()
            : getAdminRefundDepartmentStatusTypes();
        const [handlersRes, departmentsRes, statusRes] =
          await Promise.all([
            getAdminRefundDepartmentUsers(),
            getAdminRefundDepartments(),
            statusRequest,
          ]);

        if (cancelled) return;

        const handlersPayload =
          (handlersRes as { data?: unknown })?.data ?? handlersRes;
        const departmentsPayload =
          (departmentsRes as { data?: unknown })?.data ?? departmentsRes;
        const statusPayload =
          (statusRes as { data?: unknown })?.data ?? statusRes;
        const statusList = Array.isArray(statusPayload) ? statusPayload : [];

        setViewRole(nextRole);
        setFilterOptions({
          handlers: mapAdminDepartmentUsersToHandlers(
            Array.isArray(handlersPayload) ? handlersPayload : [],
          ),
          categories: [],
          todoStatuses: [],
          completedStatuses: [],
          completedSources: [],
        });
        setDepartmentHandlers(
          mapAdminDepartmentsToHandlers(
            Array.isArray(departmentsPayload) ? departmentsPayload : [],
          ),
        );
        setStatusOptions(statusList);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
      } finally {
        if (!cancelled) {
          setRoleReady(true);
        }
      }
    };

    loadPageContext();
    return () => {
      cancelled = true;
    };
  }, [fallbackViewRole, hasExplicitRoleFromQuery]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  useEffect(() => {
    if (refundId !== undefined) return;
    loadRecord(viewRole);
  }, [loadRecord, refundId, viewRole]);

  useEffect(() => {
    setActiveAudience(roleConfig.message.defaultAudience);
  }, [roleConfig.message.defaultAudience]);

  useEffect(() => {
    if (!hasMessageComposer) return;
    const allowedAudience = composerTabs.map((item) => item.key);
    if (!allowedAudience.includes(activeAudience)) {
      setActiveAudience(composerTabs[0].key);
    }
  }, [activeAudience, composerTabs, hasMessageComposer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      APP_INFO_OPEN_STORAGE_KEY,
      String(appInfoOpen),
    );
  }, [appInfoOpen]);

  useEffect(() => {
    if (!record) return;
    setSelectedTimelineItem(null);
  }, [record]);

  useEffect(() => {
    let cancelled = false;

    const resetOverviewState = () => {
      setApplicantDetails(null);
      setEstablishmentDetails(null);
      setProfileAndApplicantData(null);
      setApplicationOverviewDetail(null);
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

      resetOverviewState();

      const [applicantRes, profileAndApplicantRes] = await Promise.all([
        record.userId
          ? getUserIndividual(record.userId).catch(() => null)
          : null,
        record.profileId
          ? profileAndApplicant(record.profileId).catch(() => null)
          : null,
      ]);

      if (cancelled) return;

      const applicantPayload =
        (applicantRes as { data?: unknown } | null)?.data ?? applicantRes;
      const profileAndApplicantPayload = ((
        profileAndApplicantRes as {
          data?: ProfileAndApplicantOverviewData;
        } | null
      )?.data ??
        profileAndApplicantRes) as ProfileAndApplicantOverviewData | null;
      const profileTypeFromProfile =
        resolveRefundProfileTypeFromUserTypeId(
          profileAndApplicantPayload?.userTypeId,
        );
      const shouldLoadEstablishment =
        profileTypeFromProfile === "Commercial" && Boolean(record.profileId);
      const establishmentRes = shouldLoadEstablishment
        ? await getEstablishment(record.profileId as number).catch(() => null)
        : null;
      const establishmentPayload =
        (establishmentRes as { data?: unknown } | null)?.data ??
        establishmentRes;

      if (cancelled) return;

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
      let nextRelatedApplicationDetail: RelatedApplicationOverviewDetail | null =
        null;

      if (record.referenceNo) {
        try {
          const taskTypeRes = await getTaskType({
            applicationNo: record.referenceNo,
          });
          const taskTypePayload = unwrapTaskLookupPayload(
            taskTypeRes as
              | RelatedApplicationTaskLookup
              | {
                  data?:
                    | RelatedApplicationTaskLookup
                    | { data?: RelatedApplicationTaskLookup };
                }
              | null,
          );

          if (taskTypePayload?.applicationId) {
            const summaryRes = await getRefundApplicationSummary(
              taskTypePayload.applicationId,
            ).catch((error) => {
              console.error(error);
              return null;
            });

            const summaryPayload = ((
              summaryRes as { data?: ApplicationSummaryDto | null } | null
            )?.data ?? summaryRes) as ApplicationSummaryDto | null;

            nextRelatedApplicationDetail =
              normalizeRelatedApplicationOverviewDetail(
                summaryPayload
                  ? {
                      id: summaryPayload.applicationId,
                      applicationNumber: summaryPayload.applicationNumber,
                      serviceNameEn: summaryPayload.serviceName,
                      serviceNameAr: summaryPayload.serviceName,
                      applyForEn: summaryPayload.appliedFor,
                      applyForAr: summaryPayload.appliedFor,
                      status:
                        summaryPayload.applicationStatusName ??
                        summaryPayload.status,
                      submissionTime: summaryPayload.submissionTime,
                    }
                  : null,
                record.referenceNo,
              );

            nextStats.historicalApplications = Number(
              summaryPayload?.applicationsCount ?? 0,
            );
            nextStats.historicalTickets = Number(
              summaryPayload?.enquiryCount ?? 0,
            );
            nextStats.refunds = Number(summaryPayload?.refundCount ?? 0);
            nextStats.appeals = Number(summaryPayload?.appealCount ?? 0);
          }
        } catch (error) {
          console.error(error);
        }
      }

      if (cancelled) return;

      setApplicationOverviewDetail(nextRelatedApplicationDetail);
      setApplicationOverviewStats(nextStats);
    };

    loadOverviewState();

    return () => {
      cancelled = true;
    };
  }, [record]);

  const profileType = useMemo<RefundResolvedProfileType | undefined>(() => {
    const profileTypeFromProfile =
      resolveRefundProfileTypeFromUserTypeId(
        profileAndApplicantData?.userTypeId,
      );
    if (profileTypeFromProfile) return profileTypeFromProfile;
    if (!record) return undefined;
    const profileTypeFromRecord = resolveRefundProfileTypeFromUserTypeId(
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

  const fallbackApplicantFullName = useMemo(
    () =>
      getFirstNonEmptyText(
        applicantDetails?.fullNameEn,
        record?.applicantOverview.fullName,
        record?.applyFor.name,
      ) || "-",
    [applicantDetails?.fullNameEn, record],
  );

  const fallbackApplicantEmail = useMemo(
    () =>
      getFirstNonEmptyText(
        applicantDetails?.email,
        record?.applicantOverview.email,
      ) || "-",
    [applicantDetails?.email, record],
  );

  const fallbackApplicantMobileNumber = useMemo(
    () =>
      getFirstNonEmptyText(
        applicantDetails?.mobileNumber,
        record?.applicantOverview.mobileNumber,
      ) || "-",
    [applicantDetails?.mobileNumber, record],
  );

  const applicationOverviewApplicantDataOverride = useMemo<
    ApplicationOverviewProfileData | undefined
  >(() => {
    if (profileAndApplicantData) {
      return profileAndApplicantData;
    }

    if (!record) {
      return undefined;
    }

    return {
      userId: record.userId,
      userProfileId: record.userProfileId ?? record.profileId,
      userTypeId:
        record.userTypeId ??
        (profileType === "Commercial"
          ? 5
          : profileType === "Individual"
            ? 1
            : undefined),
      userName:
        fallbackApplicantFullName !== "-" ? fallbackApplicantFullName : undefined,
      userEmail:
        fallbackApplicantEmail !== "-" ? fallbackApplicantEmail : undefined,
      phoneNumber:
        fallbackApplicantMobileNumber !== "-"
          ? fallbackApplicantMobileNumber
          : undefined,
      personalName:
        fallbackApplicantFullName !== "-" ? fallbackApplicantFullName : undefined,
      personalEmail:
        fallbackApplicantEmail !== "-" ? fallbackApplicantEmail : undefined,
      personalPhoneNumber:
        fallbackApplicantMobileNumber !== "-"
          ? fallbackApplicantMobileNumber
          : undefined,
    };
  }, [
    fallbackApplicantEmail,
    fallbackApplicantFullName,
    fallbackApplicantMobileNumber,
    profileAndApplicantData,
    profileType,
    record,
  ]);

  const applicationOverviewRelatedSectionData = useMemo<
    IRelateAppsResponse | undefined
  >(() => {
    if (!record) {
      return undefined;
    }

    const relatedApplication =
      applicationOverviewDetail &&
      (applicationOverviewDetail.applicationNumber ||
        applicationOverviewDetail.serviceNameEn ||
        applicationOverviewDetail.serviceNameAr ||
        applicationOverviewDetail.applyForEn ||
        applicationOverviewDetail.applyForAr ||
        applicationOverviewDetail.status ||
        applicationOverviewDetail.submissionTime)
        ? [
            {
              id: applicationOverviewDetail.id,
              applicationNumber:
                applicationOverviewDetail.applicationNumber ??
                record.referenceNo,
              applicationNo:
                applicationOverviewDetail.applicationNumber ??
                record.referenceNo,
              serviceId: toFiniteNumber(record.applyFor.id),
              serviceNameEn: applicationOverviewDetail.serviceNameEn,
              serviceNameAr: applicationOverviewDetail.serviceNameAr,
              applyForEn: applicationOverviewDetail.applyForEn,
              applyForAr: applicationOverviewDetail.applyForAr,
              status: applicationOverviewDetail.status,
              submissionTime: applicationOverviewDetail.submissionTime,
              taskCreatedTime: applicationOverviewDetail.taskCreatedTime,
            },
          ]
        : [];

    return {
      profileId: record.profileId ?? null,
      userTypeId:
        toFiniteNumber(profileAndApplicantData?.userTypeId) ??
        toFiniteNumber(record.userTypeId) ??
        null,
      type: profileType ?? null,
      enquiryServiceCount: applicationOverviewStats.historicalTickets,
      refundCount: applicationOverviewStats.refunds,
      appealCount: applicationOverviewStats.appeals,
      applicationCount: applicationOverviewStats.historicalApplications,
      applications: relatedApplication,
      enquiryServices: [],
      refunds: [],
      appeals: [],
    };
  }, [
    applicationOverviewDetail,
    applicationOverviewStats,
    profileAndApplicantData?.userTypeId,
    profileType,
    record,
  ]);

  const isRelatedPaymentCompleted = useMemo(() => {
    const normalized = String(record?.relatedPayment.status ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    return (
      normalized === "completed" ||
      normalized === t("Customer.customerRefundsDetails.dynamic.completed")
        .trim()
        .toLowerCase()
    );
  }, [record?.relatedPayment.status, t]);

  const fullScreenApplicantData = useMemo(() => {
    if (applicantDetails) return applicantDetails;
    if (!record) return undefined;
    return {
      type: 1,
      userId: record.userId ?? "",
      proFileId: record.profileId ?? 0,
      fullNameEn: fallbackApplicantFullName,
      email: fallbackApplicantEmail,
      mobileNumber: fallbackApplicantMobileNumber,
      personalName: fallbackApplicantFullName,
      personalEmail: fallbackApplicantEmail,
      personalPhoneNumber: fallbackApplicantMobileNumber,
    } as unknown as IUserIndividualProfile;
  }, [
    applicantDetails,
    fallbackApplicantEmail,
    fallbackApplicantFullName,
    fallbackApplicantMobileNumber,
    record,
  ]);

  const fullScreenEstablishmentData = useMemo(() => {
    if (establishmentDetails) return establishmentDetails;
    if (!record) return undefined;
    return {
      nameEn: record.establishmentName ?? record.applyFor.name,
      nameAr: record.establishmentNameAr ?? "",
      licenseNumber: record.licenseNumber,
      addressName: undefined,
      emails:
        fallbackApplicantEmail !== "-" ? fallbackApplicantEmail : undefined,
      establishmentMobile:
        fallbackApplicantMobileNumber !== "-"
          ? fallbackApplicantMobileNumber
          : undefined,
    } as unknown as IEstablishmentOverview;
  }, [
    establishmentDetails,
    fallbackApplicantEmail,
    fallbackApplicantMobileNumber,
    record,
  ]);

  const fullScreenProfileAndApplicantData = useMemo(() => {
    if (profileAndApplicantData) return profileAndApplicantData;
    if (!record) return undefined;
    return {
      selfMonitorProgram: record.profileOverview.selfMonitorProgram,
      profileStatusObj: {
        nameEn: getDisplayValue(
          applicantDetails?.proFileStatus?.nameEn ??
            establishmentDetails?.status?.name,
        ),
      },
    };
  }, [applicantDetails?.proFileStatus?.nameEn, establishmentDetails?.status?.name, profileAndApplicantData, record]);

  const refundTimelineAdditionalCard = useMemo(
    () => (
      <div className="refund-side-card refund-timeline-additional-card">
        <RightSideCardHeader
          title={t("Customer.customerRefundsDetails.side.refundTimeline")}
          open={isTimelineOpen}
          onToggle={() => setIsTimelineOpen((prev) => !prev)}
        />
        {isTimelineOpen ? (
          <RefundTimelineCard
            items={record?.timeline ?? []}
            onOpenAttachments={setSelectedTimelineItem}
          />
        ) : null}
      </div>
    ),
    [isTimelineOpen, record?.timeline, t],
  );

  const beforeUpload = (file: RcFile) => {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".pdf"].includes(extension)) {
      CustomMessage.error(t("Customer.customerRefunds.messages.invalidUploadFormat"));
      return false;
    }
    if (file.size / 1024 / 1024 > 5) {
      CustomMessage.error(t("Customer.customerRefunds.messages.fileSizeExceeds"));
      return false;
    }
    if (attachments.length >= 3) {
      CustomMessage.error(t("Customer.customerRefunds.messages.uploadLimit"));
      return false;
    }
    return true;
  };

  const handleUpload = async (options: UploadRequestOption) => {
    const file = options.file as RcFile;
    const type = file.name
      .slice(file.name.lastIndexOf(".") + 1)
      .toLowerCase() as RefundAttachment["type"];
    const formData = new FormData();
    formData.append("files", file);

    try {
      const response = (await fileUpload(formData)) as {
        data?: string[] | string;
      };
      const uploadedUrl = response?.data?.[0] ?? response?.data ?? "";
      const nextAttachment: RefundAttachment = {
        id: `${file.uid}-${Date.now()}`,
        name: file.name,
        type,
        filePath: String(uploadedUrl ?? ""),
        url: buildRefundAttachmentAccessUrl(String(uploadedUrl ?? "")),
      };
      setAttachments((prev) => [...prev, nextAttachment]);
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      CustomMessage.error(t("Customer.customerRefunds.messages.uploadFailed"));
      options.onError?.(error as Error);
    }
  };

  const getAttachmentPayload = useCallback(
    (attachmentList?: RefundAttachment[]) => {
      const urls = (attachmentList ?? [])
        .map((item) => item.filePath || item.url)
        .filter(Boolean);
      return {
        attachmentsURL01: urls[0],
        attachmentsURL02: urls[1],
        attachmentsURL03: urls[2],
      };
    },
    [],
  );

  const openDepartmentActionModal = (mode: RefundDepartmentActionMode) => {
    setDepartmentActionMode(mode);
    setDepartmentActionOpen(true);
  };

  const openStatusModal = async () => {
    if (!record?.refundId) return;

    try {
      const [detailResponse, timelineResponse] = await Promise.all([
        getAdminRefundTicketDetail(record.refundId),
        getAdminRefundTicketTimeline(record.refundId),
      ]);
      const detailPayload =
        ((detailResponse as { data?: AdminRefundDetailDto })?.data ??
          detailResponse) as AdminRefundDetailDto;
      const timelinePayload =
        ((timelineResponse as { data?: AdminRefundTimelineItemDto[] })?.data ??
          timelineResponse) as AdminRefundTimelineItemDto[];
      const timelineItems = Array.isArray(timelinePayload)
        ? timelinePayload
        : [];
      const nextRecord = mergeAdminRefundDetail(
        record,
        detailPayload,
        timelineItems,
      );
      const nextAllowedStatuses =
        resolveAllowedRefundFinalStatuses(nextRecord);

      if (!nextAllowedStatuses.length) {
        CustomMessage.warning(
          t("Customer.customerRefunds.messages.statusChangeUnavailable"),
        );
        return;
      }

      setRecord(nextRecord);
      setAllowedFinalStatuses(nextAllowedStatuses);
      setStatusOpen(true);
    } catch {
      CustomMessage.warning(
        t("Customer.customerRefunds.messages.statusChangeUnavailable"),
      );
    }
  };

  const handleSendMessage = async () => {
    if (!record || !canSendMessage) return;
    const sentMessageContent = message.trim();
    const sentAudience = activeAudience;
    try {
      setSending(true);
      if (record.refundId) {
        await createAdminRefundConversation(record.refundId, {
          messageContent: sentMessageContent,
          isInternal: sentAudience === "internal",
          attachments: attachments
            .map((item) => item.filePath || item.url)
            .filter(Boolean),
        });
        await loadRecord(undefined, { showLoading: false });
      } else {
        CustomMessage.error(
          t("Customer.customerRefundsDetails.messages.unableToSendWithoutRefundId"),
        );
        return;
      }
      setMessage("");
      setAttachments([]);
      CustomMessage.success(
        t("Customer.customerRefundsDetails.messages.sendSuccessful"),
      );
    } finally {
      setSending(false);
    }
  };

  const handleStatusSubmit = async (payload: RefundStatusChangePayload) => {
    if (!record?.refundId) return;
    const statusId = mapStatusNameToId(payload.nextStatus, statusOptions);
    if (!statusId) {
      CustomMessage.error(
        t("Customer.customerRefunds.messages.statusMappingUnavailable"),
      );
      return;
    }
    await updateAdminRefundTicketStatus(record.refundId, {
      statusId,
      ...getAttachmentPayload(payload.attachments),
      notes: payload.notes,
      assignDeptId: payload.departmentId
        ? Number(payload.departmentId)
        : undefined,
      deadLine: payload.responseDeadline,
      isInternal: payload.nextStatus === "Department Processing",
    });
    setStatusOpen(false);
    setAllowedFinalStatuses([]);
    await loadRecord();
    CustomMessage.success(t("Customer.customerRefunds.messages.operationSuccessful"));
  };

  const handleDepartmentActionSubmit = async (
    payload: RefundDepartmentActionPayload,
  ) => {
    if (!record?.refundId) return;

    if (departmentActionMode === "process") {
      if (!("decision" in payload)) return;
      const statusId = mapStatusNameToId("Department Processed", statusOptions);
      const decisionTypeId = mapProcessDecisionToId(payload.decision);

      if (!statusId || !decisionTypeId) {
        CustomMessage.error(
          t("Customer.customerRefunds.messages.statusMappingUnavailable"),
        );
        return;
      }

      await transferAdminRefundTicketStatus(record.refundId, {
        statusId,
        ...getAttachmentPayload(payload.attachments),
        notes: payload.notes,
        decisionTypeId,
        isInternal: true,
      });
    } else {
      await sendBackAdminRefundTicket(record.refundId, {
        ...getAttachmentPayload(payload.attachments),
        notes: payload.notes,
      });
    }

    setDepartmentActionOpen(false);
    await loadRecord();
    CustomMessage.success(t("Customer.customerRefunds.messages.operationSuccessful"));
  };

  if (loading) {
    return (
      <div className="customer-refunds-details customer-refunds-details-loading">
        <Spin />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="customer-refunds-details customer-refunds-details-empty">
        <Empty
          description={t("Customer.customerRefundsDetails.messages.recordNotFound")}
        />
      </div>
    );
  }

  const topItems = [
    {
      label: t("Customer.customerRefundsDetails.top.refundNumber"),
      value: record.refundNo,
      icon: DETAIL_TOP_ICON_MAP.refundNo,
    },
    {
      label: t("Customer.customerRefundsDetails.top.refundCategory"),
      value: record.categoryDisplay || record.category,
      icon: DETAIL_TOP_ICON_MAP.category,
    },
    {
      label: t("Customer.customerRefundsDetails.top.sla"),
      value:
        isBusinessRole &&
        !roleConfig.list.tabStatuses.todo.includes(record.status)
          ? getSlaCompletionLabel(record.slaHours, record.rawSla, t)
          : record.rawSla || "-",
      icon: DETAIL_TOP_ICON_MAP.sla,
    },
    {
      label: t("Customer.customerRefundsDetails.top.status"),
      value: (
        <span
          className={`refund-status-pill ${getStatusClassName(record.status)}`}
        >
          {record.statusDisplay || record.status}
        </span>
      ),
      icon: DETAIL_TOP_ICON_MAP.status,
    },
    {
      label: t("Customer.customerRefundsDetails.top.lastUpdated"),
      value: formatDateTime(record.lastUpdatedAt),
      icon: DETAIL_TOP_ICON_MAP.lastUpdatedAt,
    },
  ];

  return (
    <div className="customer-refunds-details">
      <div className="customer-refunds-details-scroll">
        <div className="refund-detail-top-card">
          <div className="refund-origin-chip">
            {record.originChannel || record.source || "-"}
          </div>
          <div className="refund-detail-top-scroll">
            <div className="refund-detail-top-grid">
              {topItems.map((item) => (
                <div className="refund-detail-top-item" key={item.label}>
                  <div className="refund-detail-top-icon">
                    <img src={item.icon} alt="" />
                  </div>
                  <div>
                    <div className="refund-detail-top-label">{item.label}</div>
                    <div className="refund-detail-top-value">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ApplicationOverviewDataProvider
          userProfileId={record.profileId}
          profileAndApplicantData={profileAndApplicantData}
        >
          <CustomerRefundsDetailsBody
            record={record}
            appInfoOpen={appInfoOpen}
            setAppInfoOpen={setAppInfoOpen}
            isRelatedPaymentCompleted={isRelatedPaymentCompleted}
            communicationSummaryCard={communicationSummaryCard}
            hasCommunicationSummary={hasCommunicationSummary}
            visibleCommunicationRecords={visibleCommunicationRecords}
            hasMessageComposer={hasMessageComposer}
            activeAudience={activeAudience}
            composerTabs={composerTabs}
            showComposerTabs={showComposerTabs}
            setActiveAudience={setActiveAudience}
            message={message}
            setMessage={setMessage}
            composerPlaceholder={composerPlaceholder}
            attachments={attachments}
            setAttachments={setAttachments}
            beforeUpload={beforeUpload}
            handleUpload={handleUpload}
            canSendMessage={canSendMessage}
            sending={sending}
            handleSendMessage={handleSendMessage}
            applicationOverviewApplicantDataOverride={
              applicationOverviewApplicantDataOverride
            }
            applicationOverviewRelatedSectionData={
              applicationOverviewRelatedSectionData
            }
            refundTimelineAdditionalCard={refundTimelineAdditionalCard}
            fullScreenApplicantData={fullScreenApplicantData}
            fullScreenEstablishmentData={fullScreenEstablishmentData}
            fullScreenProfileAndApplicantData={fullScreenProfileAndApplicantData}
          />
        </ApplicationOverviewDataProvider>
      </div>

      {(teamTaskDetailContext.shouldHideDefaultActions ||
        canChangeStatus ||
        (isBusinessRole && canDepartmentAction)) && (
        <div className="refund-detail-footer detail-action-footer">
        <DetailButton variant="outline" onClick={handleBack}>
          {t("common.back")}
        </DetailButton>
        <div className="refund-footer-right">
          {teamTaskDetailContext.shouldHideDefaultActions ? (
            <TeamTaskDetailReassignAction />
          ) : (
            <>
              {showFooterStatus ? (
                <div className="refund-footer-status">
                  <span className="refund-footer-status-label">
                    {t("Customer.customerRefundsDetails.footer.currentStatus")}:
                  </span>
                  <span className="refund-footer-status-value">
                    {record.statusDisplay || record.status}
                  </span>
                </div>
              ) : null}
              {canChangeStatus ? (
                <DetailButton
                  variant="primary"
                  onClick={() => {
                    void openStatusModal();
                  }}
                >
                  {t("Customer.customerRefunds.actions.changeStatus")}
                </DetailButton>
              ) : null}
              {isBusinessRole && canDepartmentAction ? (
                <DetailButton
                  variant="outline"
                  onClick={() => openDepartmentActionModal("send_back")}
                >
                  {t("Customer.customerRefunds.actions.sendBack")}
                </DetailButton>
              ) : null}
              {isBusinessRole && canDepartmentAction ? (
                <DetailButton
                  variant="primary"
                  onClick={() => openDepartmentActionModal("process")}
                >
                  {t("Customer.customerRefunds.actions.process")}
                </DetailButton>
              ) : null}
            </>
          )}
        </div>
        </div>
      )}

      <RefundStatusModal
        open={statusOpen}
        record={record}
        handlers={
          departmentHandlers.length
            ? departmentHandlers
            : filterOptions.handlers
        }
        onCancel={() => {
          setStatusOpen(false);
          setAllowedFinalStatuses([]);
        }}
        allowedStatuses={allowedFinalStatuses}
        onSubmit={handleStatusSubmit}
      />
      <RefundDepartmentProcessModal
        open={departmentActionOpen}
        mode={departmentActionMode}
        record={record}
        onCancel={() => setDepartmentActionOpen(false)}
        onSubmit={handleDepartmentActionSubmit}
      />
      <AttachmentListModal
        item={selectedTimelineItem}
        onCancel={() => setSelectedTimelineItem(null)}
      />
    </div>
  );
};

export default CustomerRefundsDetails;
