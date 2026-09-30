import type { InspectionAppealProcessAdjustmentItemDto } from "@/services/inspectionAppeals";
import type { SelfMonitorProgramInfo } from "@/components/common/SelfMonitorBadge";

export type AppealTabKey = "todo" | "completed";
export type AppealViewRole = "customer_happiness" | "department" | "committee";
export type AppealAudience = "customer" | "internal";
export type AppealProfileType = "Individual" | "Commercial";

export type AppealStatus =
  | "Pending"
  | "Resolved"
  | "Department Processing"
  | "Department Processed"
  | "Pending Customer"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | string;

export type AppealBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "gold";

export type AppealTimelineDotTone = "active" | "inactive";
export type AppealTimelineTextTone =
  | "default"
  | "warning"
  | "danger"
  | "success"
  | "primary";

export interface AppealApplyFor {
  id: string;
  name: string;
  type?: AppealProfileType;
  labelKey?: string;
  labelOptions?: Record<string, string>;
}

export interface AppealHandler {
  id: string;
  name: string;
  department: string;
  departmentCode?: string;
}

export interface AppealAttachment {
  id: string;
  name: string;
  type: "jpg" | "jpeg" | "png" | "pdf";
  filePath?: string;
  url: string;
  contentType?: string;
}

export interface AppealComment {
  id: string;
  kind: "system" | "message";
  audience: AppealAudience;
  isInternalNote?: boolean;
  senderUserId?: string;
  senderName?: string;
  senderPhotoUrl?: string;
  senderDepartment?: string;
  senderDepartmentCode?: string;
  sentAt: string;
  content: string;
  responseDeadline?: string;
  recommendation?: "Approve" | "Reject";
  reviewResult?: string;
  notes?: string;
  attachments?: AppealAttachment[];
}

export interface AppealTimelineTextSegment {
  text: string;
  breakBefore?: boolean;
  tone?: AppealTimelineTextTone;
  i18nKey?: string;
  i18nValues?: Record<string, string | number>;
}

export interface AppealTimelineItem {
  id: string;
  title: string;
  titleI18nKey?: string;
  changedAt: string;
  responseDeadline?: string;
  dotTone: AppealTimelineDotTone;
  actorLabel?: string;
  actorPrefix?: "Current Handler" | "Submitted by";
  departmentLabel?: string;
  actionSegments?: AppealTimelineTextSegment[];
  referenceType?: "refund";
  refundRequestId?: number | string;
  referenceLabel?: string;
  referenceNo?: string;
  description?: string;
  descriptionI18nKey?: string;
  recommendationSegments?: AppealTimelineTextSegment[];
  problemCauseSegments?: AppealTimelineTextSegment[];
  note?: string;
  attachments?: AppealAttachment[];
  attachmentsCount?: number;
}

export interface AppealOverviewField {
  label: string;
  value: string;
  secondary?: string;
  labelKey?: string;
}

export type AppealOverviewStatIcon =
  | "documents"
  | "partners"
  | "historicalApplications"
  | "historicalTickets"
  | "refund"
  | "appeal";

export interface AppealOverviewStat {
  key: string;
  label: string;
  count: number;
  icon: AppealOverviewStatIcon;
  tone?: "default" | "warning" | "danger";
}

export interface AppealOverviewAlert {
  key: string;
  label: string;
  count: number | string;
  tone: "warning" | "danger";
}

export interface AppealProfileOverview {
  profileType: string;
  /** Self-Monitor marker (replaces retired VIP label); null → no badge. */
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
  statusLabel: string;
  statusTone: AppealBadgeTone;
  fields: AppealOverviewField[];
  statistics: AppealOverviewStat[];
  alerts: AppealOverviewAlert[];
}

export interface AppealApplicationOverview {
  statistics: AppealOverviewStat[];
}

export interface AppealRelatedViolation {
  violationNo: string;
  violationType: string;
  violationDate: string;
  status: string;
}

export interface AppealRefundSummary {
  refundNo?: string;
  refundAmount?: number;
  refundScope?: string;
  failureReason?: string;
  retryCount?: number;
  lastRetryOn?: string;
}

export interface AppealAdjustment {
  violationItemId?: number | string | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  currentDegreeCode?: string | null;
  requestedDegreeCode?: string | null;
  isSelected?: boolean | null;
  isCancelled?: boolean | null;
  proposedDegree?: number | string | null;
  proposedFineAmount?: number | string | null;
  proposedViolationStatusId?: number | string | null;
  amount?: number | null;
  notes?: string | null;
}

export interface AppealRecord {
  appealId?: number | string;
  sourceTaskId?: number | string;
  taskId?: number | string;
  violationId?: number | string;
  violationTypeId?: number | string;
  violationStatusId?: number | string;
  violationStatusName?: string;
  violationFineAmount?: number;
  hasPaidFine?: boolean;
  userId?: string;
  profileId?: number;
  userProfileId?: number;
  userTypeId?: number;
  userTypeCode?: string;
  establishmentId?: number;
  individualId?: number;
  establishmentName?: string;
  establishmentNameAr?: string;
  licenseNumber?: string;
  applicationNo?: string;
  appealNo: string;
  violationNo: string;
  appealReason: string;
  appealReasonDisplay?: string;
  statusId?: number;
  statusCode?: string;
  status: AppealStatus;
  statusDisplay?: string;
  applyFor: AppealApplyFor;
  currentHandler: AppealHandler;
  ownerHandler?: AppealHandler;
  assignedAt: string;
  lastUpdatedAt: string;
  responseDeadline?: string;
  slaDeadline?: string;
  slaHours?: number;
  rawSla?: string;
  notes?: string;
  attachments: AppealAttachment[];
  communicationRecords: AppealComment[];
  timeline: AppealTimelineItem[];
  departmentRecommendation?: "Approve" | "Reject" | string;
  departmentRecommendationTypeId?: number;
  departmentRecommendationTypeCode?: string;
  finalDecision?: string;
  refund?: AppealRefundSummary;
  adjustments?: AppealAdjustment[];
  applicantOverview: {
    fullName: string;
    email: string;
    mobileNumber: string;
  };
  profileOverview: AppealProfileOverview;
  applicationOverview: AppealApplicationOverview;
  relatedViolation?: AppealRelatedViolation;
}

export interface AppealListFilters {
  search: string;
  appealReason?: string;
  statusId?: number | "all";
  handlerId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AppealListQuery extends AppealListFilters {
  role: AppealViewRole;
  tab: AppealTabKey;
  pageIndex: number;
  pageSize: number;
  sortBy?: "sla" | "lastUpdatedAt" | "status";
  sortDirection?: "asc" | "desc";
}

export interface AppealListResult {
  items: AppealRecord[];
  total: number;
}

export interface AppealSummaryItem {
  key: string;
  label: string;
  count: number;
  iconKey:
    | "total"
    | "departmentProcessing"
    | "departmentProcessed"
    | "pendingCustomer"
    | "approved"
    | "rejected"
    | "cancelled";
}

export interface AppealFilterOptions {
  handlers: AppealHandler[];
  appealReasons: string[];
  todoStatuses: AppealStatus[];
  completedStatuses: AppealStatus[];
  departments: AppealHandler[];
}

export interface AppealStatusChangePayload {
  nextStatus: "Department Processing" | "Pending Customer" | "Approved" | "Rejected";
  assignedDepartmentCode?: string;
  roleId?: string;
  responseDeadline?: string;
  notes?: string;
  attachments?: AppealAttachment[];
}

export type AppealDepartmentDecision = "Approve" | "Reject";
export type AppealViolationProcessMode = "modify" | "cancel";
export type AppealProcessAdjustmentItem =
  InspectionAppealProcessAdjustmentItemDto;

export interface AppealDepartmentProcessPayload {
  decision: AppealDepartmentDecision;
  recommendationTypeId?: number;
  processMode?: AppealViolationProcessMode;
  notes: string;
  attachments?: AppealAttachment[];
  adjustmentItems?: AppealProcessAdjustmentItem[];
}

export interface AppealSendBackPayload {
  notes: string;
  attachments?: AppealAttachment[];
}

export interface AppealSendMessagePayload {
  audience: AppealAudience;
  content: string;
  attachments?: AppealAttachment[];
}
