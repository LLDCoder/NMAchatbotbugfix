import type React from "react";
import type { SelfMonitorProgramInfo } from "@/components/common/SelfMonitorBadge";

export interface InfoItem {
  key: string;
  label: string;
  value: React.ReactNode;
  span?: number;
  fullWidth?: boolean;
}

export interface ProfileStats {
  apps: number;
  tickets: number;
  refund: number;
  appeal: number;
  violations: number;
  fines: number;
}

export interface ProfileItem {
  id: string;
  profileId: string;
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
  photoUrl?: string;
  profileName: string;
  profileNameAr: string;
  profileType: string;
  userTypeCode?: string;
  emirate: string;
  status: string;
  tier: string;
  stats: ProfileStats;
  createdTime: string;
  emiratesId: string;
  uid: string;
  passportNumber: string;
}

export interface ApplicationItem {
  id: string;
  applicationNo: string;
  applicationType: string;
  submissionDate: string;
  status: string;
  serviceName?: string;
  serviceCategory?: string;
  type?: string;
  sla?: string;
  submissionTime?: string;
}

export interface PaymentItem {
  id: string;
  paymentId: string;
  amount: string | number;
  paymentMethod: string;
  paymentMethodId?: string | number;
  paymentDate: string;
  status: string;
  statusId?: string | number;
  statusLabel?: string;
  statusSubLabel?: string;
  transactionNo?: string;
  transactionType?: string;
  transactionTypeId?: string | number;
  amountCharged?: string;
  refundCategory?: string;
  applyFor?: string;
  applyForType?: string;
  transactionTime?: string;
}

export interface PaymentCountStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  pendingCompleted: number;
  refundinProgress: number;
  totalFinesPaid: number;
  totalRefunds: number;
  totalRecharge: number;
  serviceApplicationFees: number;
  totalSpending: number;
}

export interface LicenseItem {
  id: number | string | null;
  applicationNumber: string;
  licenseNumber: string;
  licenseType: string;
  licenseTypeAr: string;
  /** Already localized and ", "-joined by the backend; no Ar counterpart. */
  mediaActivity: string;
  applicant: string;
  applicantType: string;
  issuanceTime: string;
  expirationTime: string;
  status: string;
  daysRemaining: number;
  certificateUrl: string;
  certificatePassword: string;
  disabledReason: string;
  remarks: string;
}

export interface TicketItem {
  id: string;
  detailsId?: number;
  ticketNo: string;
  reopen?: boolean;
  type: string;
  applicationNo?: string;
  serviceName: string;
  status: string;
  reopenTimes: number;
  issueCategory?: string;
  currentHandler?: string;
  customer?: string;
  customerTypeId?: number;
  customerTypeCode?: string;
  priority?: string;
  statusName?: string;
  lastUpdated?: string;
  createdOn?: string;
}

export interface ViolationFineItem {
  id: string;
  fineNo: string;
  inspectionNo: string;
  violationType: string;
  violationTypeId?: string | number;
  fineAmount: string;
  status: string;
  statusId?: string | number;
  issueDate: string;
  paymentDate: string;
  paidTime?: string;
  violator?: string;
  applyFor?: string;
  sourceTask?: string;
  sourceTaskId?: string | number;
  reportedBy?: string;
  creationTime?: string;
}

export interface RefundItem {
  id: string;
  refundNo: string;
  applicationNo: string;
  referenceNo?: string;
  applyFor?: string;
  amount: string;
  refundCategory: string;
  categoryId?: string | number;
  status: string;
  statusId?: string | number;
  requestDate: string;
  transactionTime?: string;
  lastUpdated?: string;
}

export interface AppealItem {
  id: string;
  appealNo: string;
  fineNo: string;
  violationNo?: string;
  appealCategory: string;
  appealReason?: string;
  applyFor?: string;
  status: string;
  statusId?: string | number;
  requestDate: string;
  submissionTime?: string;
  lastUpdated?: string;
}

export interface InspectionOverviewItem {
  id: string;
  taskNo: string;
  inspectionTarget: string;
  inspectionTargetMeta?: string;
  inspectionTargetType?: "Individual" | "Establishment" | "Government" | string;
  inspectionReason: string;
  priority: string;
  dueDate: string;
  status: string;
  statusKey?: keyof InspectionOverviewStats;
  assignedTime: string;
  inspector?: string;
}

export interface InspectionOverviewStats {
  queued: number;
  pendingVisit: number;
  inProgress: number;
  accessFailed: number;
  completed: number;
  cancelled: number;
}

export type InspectionNoFullScanFilters = {
  reasonId?: string;
  statusId?: string;
  priorityId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  assignedTimeFrom?: string;
  assignedTimeTo?: string;
  assignedInspectorId?: string;
};

export type InspectionNoFullScanSelectOption = {
  label: string;
  value: string;
};

export interface DocumentItem {
  key: string;
  label: string;
  url?: string;
}

export interface OverviewRowItem {
  id: string;
  applicationId?: string | number;
  applicationNumber?: string;
  applicationNo: string;
  serviceName: string;
  serviceCategory: string;
  type: string;
  sla: string;
  status?: string;
  statusId?: string | number;
  statusCode?: string;
  applyFor?: string;
  applyForType?: string;
  submissionTime?: string;
  lastUpdatedTime?: string;
  serviceDepartment?: string;
  serviceDepartmentId?: string | number;
  serviceCode?: string | number;
  taskId?: string | number;
}
