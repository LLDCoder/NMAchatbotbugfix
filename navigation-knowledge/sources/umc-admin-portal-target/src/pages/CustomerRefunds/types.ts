import type { SelfMonitorProgramInfo } from "@/components/common/SelfMonitorBadge";

export type RefundTabKey = "todo" | "completed";
export type RefundViewRole = "customer_happiness" | "business_department";

export type RefundCategory = string;

export type RefundStatus = string;

export type RefundSource = string;

export type RefundOriginChannel = string;

export type RefundAudience = "customer" | "internal";

export type RefundDepartmentActionMode = "process" | "send_back";

export interface RefundApplyFor {
  id: string;
  name: string;
  type?: "Individual" | "Commercial";
}

export interface RefundHandler {
  id: string;
  name: string;
  department: string;
  departmentId?: string;
}

export interface RefundAttachment {
  id: string;
  name: string;
  type: "jpg" | "jpeg" | "png" | "pdf";
  filePath?: string;
  url: string;
}

export interface RefundComment {
  id: string;
  kind: "system" | "message";
  audience: RefundAudience;
  senderUserId?: string;
  senderName?: string;
  senderPhotoUrl?: string;
  senderLabel?: string;
  senderDepartment?: string;
  sentAt: string;
  content: string;
  responseDeadline?: string;
  recommendation?: "Approve" | "Reject";
  notes?: string;
  attachments?: RefundAttachment[];
}

export type RefundBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export type RefundOverviewStatIcon =
  | "documents"
  | "partners"
  | "historicalApplications"
  | "historicalTickets"
  | "refund"
  | "appeal";

export interface RefundOverviewField {
  label: string;
  value: string;
  secondary?: string;
}

export interface RefundApplicantOverview {
  fullName: string;
  email: string;
  mobileNumber: string;
}

export interface RefundOverviewStat {
  key: string;
  label: string;
  count: number;
  icon: RefundOverviewStatIcon;
  tone?: "default" | "warning" | "danger";
}

export interface RefundOverviewAlert {
  key: string;
  label: string;
  count: number;
  tone: "warning" | "danger";
}

export interface RefundProfileOverview {
  profileType: string;
  /** Self-Monitor marker (replaces retired VIP label); null → no badge. */
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
  statusLabel: string;
  statusTone: RefundBadgeTone;
  fields: RefundOverviewField[];
  statistics: RefundOverviewStat[];
  alerts: RefundOverviewAlert[];
}

export interface RefundApplicationRelatedSection {
  title: "Related Application" | "Related Appeal";
  referenceNo: string;
  statusLabel: string;
  statusTone: RefundBadgeTone;
  fields: RefundOverviewField[];
}

export interface RefundApplicationOverview {
  statistics: RefundOverviewStat[];
  relatedSection?: RefundApplicationRelatedSection;
}

export type RefundTimelineDotTone = "active" | "inactive";

export type RefundTimelineTextTone =
  | "default"
  | "warning"
  | "danger"
  | "success";

export interface RefundTimelineTextSegment {
  text: string;
  tone?: RefundTimelineTextTone;
}

export interface RefundTimelineItem {
  id: string;
  eventCode?: string;
  title: string;
  changedAt: string;
  responseDeadline?: string;
  dotTone: RefundTimelineDotTone;
  actorLabel?: string;
  departmentLabel?: string;
  actionSegments?: RefundTimelineTextSegment[];
  description?: string;
  recommendationSegments?: RefundTimelineTextSegment[];
  note?: string;
  attachments?: RefundAttachment[];
  attachmentsCount?: number;
}

export interface RefundDetailBlocks {
  refundReason: string;
  notes?: string;
  responseDeadline?: string;
  relatedPaymentDescription: string;
  cardInformation?: string;
  email?: string;
  applicationNumber?: string;
  fineNumber?: string;
}

export interface RefundRelatedViolation {
  violationNo: string;
  violationType: string;
  violationDate: string;
  status: string;
}

export interface RefundRecord {
  refundId?: number;
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
  refundNo: string;
  applicationNumber?: string;
  statusId?: number;
  referenceNo: string;
  category: RefundCategory;
  categoryDisplay?: string;
  source: RefundSource;
  originChannel: RefundOriginChannel;
  applyFor: RefundApplyFor;
  amount: number;
  currency: string;
  status: RefundStatus;
  statusDisplay?: string;
  departmentDecision?: number | null;
  departmentRecommendation?: "Approve" | "Reject" | string;
  departmentRecommendationTypeId?: number;
  currentHandler: RefundHandler;
  lastUpdatedAt: string;
  assignedAt: string;
  slaHours?: number;
  rawSla?: string;
  responseDeadline?: string;
  refundReason: string;
  refundReasonDisplay?: string;
  notes?: string;
  attachments: RefundAttachment[];
  communicationRecords: RefundComment[];
  timeline: RefundTimelineItem[];
  relatedPayment: {
    transactionNo: string;
    status: string;
    transactionType: string;
    lastUpdatedAt: string;
    paymentMethod: string;
    cardInformation?: string;
    amountCharged: number;
    description: string;
  };
  applicantOverview: RefundApplicantOverview;
  profileOverview: RefundProfileOverview;
  applicationOverview: RefundApplicationOverview;
  relatedViolation?: RefundRelatedViolation;
}

export interface RefundListFilters {
  search: string;
  category?: RefundCategory;
  status?: RefundStatus;
  source?: RefundSource;
  handlerId?: string;
  startDate?: string;
  endDate?: string;
}

export interface RefundListQuery extends RefundListFilters {
  role: RefundViewRole;
  tab: RefundTabKey;
  pageIndex: number;
  pageSize: number;
  sortBy?: "sla" | "lastUpdatedAt";
  sortDirection?: "asc" | "desc";
}

export interface RefundListResult {
  items: RefundRecord[];
  total: number;
}

export interface RefundSummaryItem {
  key: string;
  label: string;
  count: number;
  iconKey:
    | "total"
    | "departmentProcessing"
    | "departmentProcessed"
    | "pendingCustomer"
    | "pendingRefund"
    | "refunded"
    | "rejected"
    | "cancelled";
}

export interface RefundFilterSelectOption {
  value: string;
  label: string;
}

export interface RefundFilterOptions {
  handlers: RefundHandler[];
  categories: RefundFilterSelectOption[];
  todoStatuses: RefundFilterSelectOption[];
  completedStatuses: RefundFilterSelectOption[];
  completedSources: RefundFilterSelectOption[];
}

export interface RefundStatusChangePayload {
  nextStatus:
    | "Department Processing"
    | "Pending Customer"
    | "Pending Refund"
    | "Rejected";
  departmentId?: string;
  roleId?: string;
  responseDeadline?: string;
  notes?: string;
  attachments?: RefundAttachment[];
}

export type RefundDepartmentProcessDecision = "Approve" | "Reject";

export interface RefundDepartmentProcessPayload {
  decision: RefundDepartmentProcessDecision;
  notes: string;
  attachments?: RefundAttachment[];
}

export interface RefundSendBackPayload {
  notes: string;
  attachments?: RefundAttachment[];
}

export type RefundDepartmentActionPayload =
  | RefundDepartmentProcessPayload
  | RefundSendBackPayload;

export interface RefundSendMessagePayload {
  audience: RefundAudience;
  content: string;
  attachments?: RefundAttachment[];
  senderName: string;
}
