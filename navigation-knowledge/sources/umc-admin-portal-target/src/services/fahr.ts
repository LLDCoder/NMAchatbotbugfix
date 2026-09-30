import request from "@/utils/request";
import type { AxiosResponse } from "axios";

const fahrBasePath = "/api/AdminFahr";

export type FahrRequestStatus =
  | "NotRequired"
  | "Pending"
  | "PartiallyDecided"
  | "AllDecided"
  | "PendingRfi"
  | "ClosedApproved"
  | "ClosedRejected"
  | "TriggerFailed";
export type FahrDecision =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "RFI"
  | "Revoke"
  | "Under Processing"
  | "Cancel";

export type FahrMilestoneStatus =
  | "Submitted"
  | "Received"
  | "Approved"
  | "Rejected"
  | "RFI"
  | "Revoked"
  | "Cancelled";

export type FahrPersonStatus =
  | "PushFailed"
  | "Pending"
  | "Approved"
  | "Rejected"
  | "RFI"
  | "CancelRequested"
  | "Revoke"
  | "Cancel"
  | "ApproveTransactionApplied"
  | "UnapplyTransactionApplied"
  | "TransactionApplied"
  | "TransactionUnapplied";

export interface FahrApiResponse<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: T | null;
}

export interface FahrLocalizedLabel {
  en: string;
  ar: string;
}

export interface FahrInteractionLog {
  id: number;
  direction: "Internal" | "Outbound" | "Inbound";
  action: string;
  actor: string | null;
  detail: string | null;
  createdAt: string | null;
  isMilestone: boolean;
  milestone: string | null;
  milestoneType?: "TransactionAction" | "ExternalReviewDecision" | null;
  milestoneLabel?: FahrLocalizedLabel | null;
  milestoneStatus?: FahrMilestoneStatus | null;
  milestoneStatusLabel?: FahrLocalizedLabel | null;
  description?: string | FahrLocalizedLabel | null;
  attachments?: Array<{
    fileName: string;
    fileKey: string;
    fileSize: number;
  }>;
  note?: string | null;
}

export interface FahrReviewSession {
  requestId: number;
  correlationId: string | null;
  serviceCode: string | null;
  triggerRuleCode: string | null;
  status: FahrRequestStatus;
  statusLabel?: FahrLocalizedLabel | null;
  triggerReason?: string | null;
  canExternalApprove?: boolean;
  canExternalReject?: boolean;
  externalDecisionDisabledReason?: string | null;
  triggeredAt: string | null;
  updatedAt: string | null;
  persons: FahrReviewTarget[];
}

export interface FahrReviewPermit {
  permitId: number;
  fileName: string | null;
  name?: string | null;
  fileId: string | null;
  contentType: string | null;
  receivedAt: string | null;
}

export interface FahrReviewTarget {
  targetId: number;
  personType: string;
  personRefId: number;
  emiratesId: string | null;
  passport: string | null;
  fullName: string | null;
  transactionRefNo: string | null;
  status: FahrPersonStatus;
  statusLabel?: FahrLocalizedLabel | null;
  statusReason: string | null;
  allowedActions?: string[];
  decision: FahrDecision;
  decisionLabel?: FahrLocalizedLabel | null;
  fahrReferenceNo: string | null;
  createdAt: string | null;
  decidedAt: string | null;
  permits: FahrReviewPermit[];
  interactionLogs: FahrInteractionLog[];
  registrationForm?: Record<string, unknown> | null;
}

export type FahrSupplementaryMaterialsScenario =
  | "RfiResponse"
  | "ReconsiderationAttachment";

export interface FahrSupplementaryMaterialsPayload {
  targetId: number;
  scenario: FahrSupplementaryMaterialsScenario;
  submittedBy?: string;
  note?: string;
  registrationForm?: Record<string, unknown>;
  attachments: string[];
}

export interface FahrSupplementaryMaterialsResult {
  success: boolean;
  targetId: number;
  scenario: FahrSupplementaryMaterialsScenario;
  targetDecision: FahrDecision;
  outboundAccepted: boolean;
  fahrReferenceNo: string | null;
  replyMessages: string | null;
  errorMessage?: string | null;
}

export interface FahrTargetActionPayload {
  targetId: number;
  note?: string;
  submittedBy?: string;
}

export interface FahrTargetActionResult {
  success: boolean;
  targetId: number;
  scenario:
    | "CancelApplication"
    | "TransactionApplied"
    | "TransactionUnapplied";
  outboundAccepted: boolean;
  personStatus: FahrPersonStatus;
  decision: FahrDecision;
  fahrReferenceNo: string | null;
  replyMessages: string | null;
  errorMessage?: string | null;
}

export interface FahrReviewRequestDetails
  extends Omit<FahrReviewSession, "persons"> {
  applicationId: number;
  targets: FahrReviewTarget[];
}

export interface FahrApplicationStatus {
  applicationId: number;
  sessions: FahrReviewSession[];
}

export interface FahrExternalApprovalEligibility {
  applicationId: number;
  eligible: boolean;
  requiresExternalApproval: boolean;
  requiresPersonSelection: boolean;
  showExternalApprovalDialog: boolean;
  status: string;
  ruleCode?: string | null;
  reason?: string | null;
  targetPersonCount?: number;
  targetPersonTypes?: string[];
}

export interface FahrExternalReviewReadiness {
  externalReviewAction: "Approve" | "Reject" | null;
  disabledReason?: string | null;
}

export type FahrExternalReviewDecision = "Approved" | "Rejected";

export interface FahrExternalReviewDecisionPayload {
  decision: FahrExternalReviewDecision;
  reason?: string;
  rejectReasonCode?: string;
  rejectReasonFile?: string;
  hideFromCustomer?: boolean;
}

export interface FahrExternalReviewDecisionResult {
  success: boolean;
  requestId: number;
  applicationId: number;
  decision: FahrExternalReviewDecision;
  requestStatus: "ClosedApproved" | "ClosedRejected";
  camundaResult: string;
}

export class FahrReviewOperationError extends Error {
  constructor() {
    super("FAHR review operation failed.");
    this.name = "FahrReviewOperationError";
  }
}

export function getFahrApplicationStatus(applicationId: number) {
  return request.get<
    FahrApiResponse<FahrApplicationStatus>,
    FahrApiResponse<FahrApplicationStatus>
  >(`${fahrBasePath}/Applications/${applicationId}/FahrStatus`);
}

export function getFahrExternalApprovalEligibility(applicationId: number) {
  return request.get<
    FahrApiResponse<FahrExternalApprovalEligibility>,
    FahrApiResponse<FahrExternalApprovalEligibility>
  >(
    `${fahrBasePath}/Applications/${applicationId}/ExternalApprovalEligibility`,
  );
}

export function getFahrExternalReviewReadiness(applicationId: number) {
  return request.get<
    FahrApiResponse<FahrExternalReviewReadiness>,
    FahrApiResponse<FahrExternalReviewReadiness>
  >(
    `${fahrBasePath}/Applications/${applicationId}/ExternalReviewReadiness`,
  );
}

export function getFahrPersonStatus(
  applicationId: number,
  personRefId: number,
  personType?: string,
) {
  return request.get<
    FahrApiResponse<FahrReviewTarget[]>,
    FahrApiResponse<FahrReviewTarget[]>
  >(
    `${fahrBasePath}/Applications/${applicationId}/Persons/${personRefId}/FahrStatus`,
    { personType },
  );
}

export function submitFahrExternalReviewDecision(
  applicationId: number,
  payload: FahrExternalReviewDecisionPayload,
) {
  return request.post<
    FahrApiResponse<FahrExternalReviewDecisionResult>,
    FahrApiResponse<FahrExternalReviewDecisionResult>
  >(
    `${fahrBasePath}/Applications/${applicationId}/ExternalReviewDecision`,
    payload,
  );
}

export function submitFahrSupplementaryMaterials(
  payload: FahrSupplementaryMaterialsPayload,
) {
  return request.post<
    FahrApiResponse<FahrSupplementaryMaterialsResult>,
    FahrApiResponse<FahrSupplementaryMaterialsResult>
  >(`${fahrBasePath}/Review/SupplementaryMaterials`, payload);
}

export function cancelFahrTransaction(payload: FahrTargetActionPayload) {
  return request.post<
    FahrApiResponse<FahrTargetActionResult>,
    FahrApiResponse<FahrTargetActionResult>
  >(`${fahrBasePath}/Review/CancelTransaction`, payload);
}

export function applyFahrTransaction(
  applicationId: number,
  payload: FahrTargetActionPayload,
) {
  return request.post<
    FahrApiResponse<FahrTargetActionResult>,
    FahrApiResponse<FahrTargetActionResult>
  >(`${fahrBasePath}/Applications/${applicationId}/ApplyTransaction`, payload);
}

export function unapplyFahrTransaction(
  applicationId: number,
  payload: Omit<FahrTargetActionPayload, "note">,
) {
  return request.post<
    FahrApiResponse<FahrTargetActionResult>,
    FahrApiResponse<FahrTargetActionResult>
  >(
    `${fahrBasePath}/Applications/${applicationId}/UnapplyTransaction`,
    payload,
  );
}

export function getFahrPermitFile(
  permitId: number,
): Promise<AxiosResponse<Blob>> {
  return request.getRaw<Blob>(
    `${fahrBasePath}/Permits/${permitId}/Download`,
    {},
    { responseType: "blob" },
  );
}
