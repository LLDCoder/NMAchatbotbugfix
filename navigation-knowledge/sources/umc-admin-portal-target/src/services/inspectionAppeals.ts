import moment from "moment";
import type { ApiResponse } from "@/services/inspection";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import request from "@/utils/request";

export type InspectionAppealWorkbenchRole =
  | "customer_happiness"
  | "department"
  | "committee";

export type InspectionAppealWorkbenchTab = "todo" | "completed";

export interface InspectionAppealListParams {
  search?: string;
  appealReason?: string;
  statusId?: number;
  lastUpdatedFrom?: string;
  lastUpdatedTo?: string;
  currentHandlerUserId?: string;
  pageIndex: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc" | 0 | 1;
}

export interface InspectionTargetAppealListParams {
  establishmentId?: number | string;
  individualId?: number | string;
  taskId?: number | string;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  violationTypeId?: number | string;
  statusId?: number | string;
  pageNumber?: number;
  pageSize?: number;
  sortField?: string;
  sortDescending?: boolean;
}

export interface InspectionProfileAppealListParams {
  userId?: string;
  profileId?: number;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  violationTypeId?: number;
  statusId?: number;
  taskId?: number;
  approvalTimeFrom?: string;
  approvalTimeTo?: string;
  paidTimeFrom?: string;
  paidTimeTo?: string;
}

export interface InspectionProfileAppealItemDto {
  id?: number | string | null;
  appealNo?: string | null;
  appealReason?: string | null;
  violationNo?: string | null;
  applyFor?: string | null;
  fineAmount?: number | string | null;
  beforeAppealAdjustedFineAmount?: number | string | null;
  submissionDate?: string | null;
  statusId?: number | string | null;
  status?: string | null;
  lastUpdatedOn?: string | null;
}

export interface InspectionProfileAppealStatusStatDto {
  statusId?: number | string | null;
  statusName?: string | null;
  count?: number | string | null;
}

export interface InspectionProfileAppealListResponseDto {
  total?: number | string | null;
  pageNumber?: number | string | null;
  pageSize?: number | string | null;
  items?: InspectionProfileAppealItemDto[] | null;
  statuses?: InspectionProfileAppealStatusStatDto[] | null;
}

export interface InspectionProfileAppealResponseEnvelope {
  isSuccess?: boolean;
  statusCode?: number | string | null;
  message?: string | null;
  data?:
    | InspectionProfileAppealListResponseDto
    | { data?: InspectionProfileAppealListResponseDto | null }
    | null;
}

export interface InspectionAppealAttachmentDto {
  id?: number | string | null;
  fileName?: string | null;
  name?: string | null;
  fileUrl?: string | null;
  url?: string | null;
  filePath?: string | null;
  contentType?: string | null;
}

export interface InspectionAppealStatusDto {
  id?: number | null;
  nameEn?: string | null;
  nameAr?: string | null;
  code?: string | null;
}

export interface InspectionAppealLookupOption {
  id: number | string;
  code?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  isMock?: boolean | null;
}

export interface InspectionAppealApplyForDto {
  id?: number | string | null;
  userId?: string | null;
  profileId?: number | null;
  name?: string | null;
  userName?: string | null;
  fullName?: string | null;
  profileName?: string | null;
  type?: string | null;
  userType?: string | null;
  userTypeId?: number | null;
  oldFineAmount?: number | null;
  newFineAmount?: number | null;
  oldViolationStatusId?: number | null;
  newViolationStatusId?: number | null;
  oldViolationStatusName?: string | null;
  newViolationStatusName?: string | null;
}

export interface InspectionAppealViolationDto {
  id?: number | string | null;
  violationId?: number | string | null;
  violationNumber?: string | null;
  sourceTaskId?: number | string | null;
  taskId?: number | string | null;
  violationNo?: string | null;
  violationTypeId?: number | null;
  violationType?: string | null;
  violationTypeName?: string | null;
  violatorType?: string | null;
  violatorName?: string | null;
  statusId?: number | null;
  status?: string | null;
  statusName?: string | null;
  fineAmount?: number | null;
  violationDate?: string | null;
  createdOn?: string | null;
}

export interface InspectionAppealDepartmentDto {
  code?: string | null;
  name?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
}

export interface InspectionAppealDepartmentRecommendationDto {
  recommendationTypeId?: number | null;
  recommendationTypeCode?: string | null;
  note?: string | null;
  recommendedByUserId?: string | null;
  recommendedByName?: string | null;
  recommendedOn?: string | null;
}

export interface InspectionAppealHandlerDto {
  userId?: string | null;
  id?: string | null;
  userName?: string | null;
  name?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  departmentNameEn?: string | null;
  departmentNameAr?: string | null;
}

export interface InspectionAppealOverviewIdentityDto {
  userId?: string | null;
  profileId?: number | null;
  userProfileId?: number | null;
  userTypeId?: number | null;
  userTypeCode?: string | null;
  establishmentId?: number | null;
  individualId?: number | null;
  establishmentName?: string | null;
  establishmentNameAr?: string | null;
  licenseNumber?: string | null;
}

export interface InspectionAppealSlaDto {
  isVisible?: boolean | null;
  statusCode?: string | null;
  displayText?: string | null;
  startedOn?: string | null;
  dueOn?: string | null;
  completedOn?: string | null;
}

export interface InspectionAppealListItemDto {
  id?: number | string | null;
  appealId?: number | string | null;
  sourceTaskId?: number | string | null;
  taskId?: number | string | null;
  userId?: string | null;
  profileId?: number | null;
  userProfileId?: number | null;
  userTypeId?: number | null;
  userTypeCode?: string | null;
  establishmentId?: number | null;
  individualId?: number | null;
  establishmentName?: string | null;
  establishmentNameAr?: string | null;
  licenseNumber?: string | null;
  overviewIdentity?: InspectionAppealOverviewIdentityDto | null;
  appealNo?: string | null;
  appealNumber?: string | null;
  applicationNo?: string | null;
  violationId?: number | string | null;
  violationNo?: string | null;
  violationNumber?: string | null;
  appealReason?: string | null;
  reason?: string | null;
  applyFor?: InspectionAppealApplyForDto | string | null;
  violation?: InspectionAppealViolationDto | null;
  statusId?: number | null;
  statusCode?: string | null;
  status?: string | null;
  statusName?: string | null;
  statusObj?: InspectionAppealStatusDto | null;
  displayStatusCode?: string | null;
  currentHandler?: InspectionAppealHandlerDto | string | null;
  currentHandlerUserId?: string | null;
  currentHandlerUserName?: string | null;
  currentDepartment?: InspectionAppealDepartmentDto | null;
  currentDepartmentCode?: string | null;
  currentDepartmentName?: string | null;
  ownerHandler?: InspectionAppealHandlerDto | null;
  ownerDepartment?: InspectionAppealDepartmentDto | null;
  ownerHandlerUserName?: string | null;
  ownerDepartmentName?: string | null;
  recommendationTypeId?: number | null;
  recommendationTypeCode?: string | null;
  departmentRecommendation?:
    | string
    | InspectionAppealDepartmentRecommendationDto
    | null;
  departmentRecommendationTypeId?: number | null;
  departmentRecommendationTypeCode?: string | null;
  fineAmount?: number | null;
  submissionDate?: string | null;
  sla?: string | InspectionAppealSlaDto | null;
  slaHours?: number | null;
  slaDueOn?: string | null;
  responseDeadline?: string | null;
  assignedOn?: string | null;
  lastUpdated?: string | null;
  lastUpdatedAt?: string | null;
  lastUpdatedOn?: string | null;
  updateOn?: string | null;
  requestDate?: string | null;
  createdOn?: string | null;
}

export interface InspectionAppealListResponseDto {
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  totalCount?: number;
  items?: InspectionAppealListItemDto[] | null;
  data?: InspectionAppealListItemDto[] | null;
}

export interface InspectionTargetAppealListResponseDto {
  total?: number;
  totalCount?: number;
  pageIndex?: number;
  pageNumber?: number;
  pageSize?: number;
  items?: InspectionAppealListItemDto[] | null;
  data?: InspectionAppealListItemDto[] | null;
}

export interface InspectionAppealStatsDto {
  total?: number | null;
  totalCount?: number | null;
  todoCount?: number | null;
  completedCount?: number | null;
  departmentProcessingCount?: number | null;
  departmentProcessedCount?: number | null;
  pendingCustomerCount?: number | null;
  approvedCount?: number | null;
  rejectedCount?: number | null;
  cancelledCount?: number | null;
  resolvedCount?: number | null;
  pendingCount?: number | null;
}

export interface InspectionAppealMessageDto {
  id?: number | string | null;
  messageId?: number | string | null;
  body?: string | null;
  content?: string | null;
  messageContent?: string | null;
  messageTypeCode?: string | null;
  isInternal?: boolean | null;
  isInternalNote?: boolean | null;
  isSystemMessage?: boolean | null;
  isCustomerVisible?: boolean | null;
  visibilityScopeCode?: string | null;
  isSystemEvent?: boolean | null;
  senderUserId?: string | null;
  senderUserName?: string | null;
  senderName?: string | null;
  senderPhotoUrl?: string | null;
  senderDepartmentCode?: string | null;
  senderDepartmentName?: string | null;
  currentDepartmentCode?: string | null;
  currentDepartmentName?: string | null;
  targetDepartmentCode?: string | null;
  targetDepartmentName?: string | null;
  actionTypeCode?: string | null;
  fromStatusId?: number | null;
  toStatusId?: number | null;
  recommendationTypeId?: number | null;
  recommendationTypeCode?: string | null;
  reviewResultCode?: string | null;
  reason?: string | null;
  note?: string | null;
  deadline?: string | null;
  responseDeadline?: string | null;
  relatedEventCode?: string | null;
  attachments?: InspectionAppealAttachmentDto[] | null;
  createdOn?: string | null;
}

export interface InspectionAppealTimelineItemDto {
  id?: number | string | null;
  eventCode?: string | null;
  eventName?: string | null;
  isSystemEvent?: boolean | null;
  displayStatusCode?: string | null;
  content?: string | null;
  fromStatusId?: number | null;
  toStatusId?: number | null;
  actionTypeCode?: string | null;
  handlerUserId?: string | null;
  handlerUserName?: string | null;
  handlerDepartmentCode?: string | null;
  handlerDepartmentName?: string | null;
  targetHandlerUserId?: string | null;
  targetHandlerUserName?: string | null;
  targetDepartmentCode?: string | null;
  targetDepartmentName?: string | null;
  recommendationTypeId?: number | null;
  recommendationTypeCode?: string | null;
  reviewResultCode?: string | null;
  reason?: string | null;
  note?: string | null;
  refundRequestId?: number | string | null;
  refundNo?: string | null;
  deadline?: string | null;
  responseDeadline?: string | null;
  attachments?: InspectionAppealAttachmentDto[] | null;
  createdOn?: string | null;
}

export interface InspectionAppealAdjustmentDto {
  violationItemId?: number | string | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  currentDegreeCode?: string | null;
  requestedDegreeCode?: string | null;
  oldDegree?: number | string | null;
  newDegree?: number | string | null;
  oldFineAmount?: number | string | null;
  newFineAmount?: number | string | null;
  oldViolationStatusId?: number | string | null;
  newViolationStatusId?: number | string | null;
  isSelected?: boolean | null;
  isCancelled?: boolean | null;
  proposedDegree?: number | string | null;
  proposedFineAmount?: number | string | null;
  proposedViolationStatusId?: number | string | null;
  amount?: number | null;
  notes?: string | null;
}

export interface InspectionAppealViolationItemPenaltyStandardDto {
  degree1FineAmount?: number | string | null;
  degree2FineAmount?: number | string | null;
  degree3FineAmount?: number | string | null;
  degree4FineAmount?: number | string | null;
  penaltyStandardId?: number | string | null;
  violationItemId?: number | string | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  violationTypeId?: number | string | null;
  rectificationWindowDays?: number | null;
  resetWindowMonths?: number | null;
  additionalPenaltyAction?: string | null;
  notes?: string | null;
  isActive?: boolean | null;
  displayOrder?: number | null;
}

export interface InspectionAppealViolationItemDto {
  id?: number | string | null;
  taskId?: number | string | null;
  taskChecklistItemId?: number | string | null;
  checklistCode?: string | null;
  checklistName?: string | null;
  recordedAt?: string | null;
  violationItemId?: number | string | null;
  violationItemCode?: string | null;
  violationItemName?: string | null;
  violationDescription?: string | null;
  violationDescriptionEn?: string | null;
  violationDescriptionAr?: string | null;
  violationTypeId?: number | string | null;
  violationTypeCode?: string | null;
  violationTypeName?: string | null;
  appealResult?: string | null;
  oldDegree?: number | string | null;
  newDegree?: number | string | null;
  fineAmount?: number | string | null;
  beforeAppealAdjustedFineAmount?: number | string | null;
  notes?: string | null;
  contentPenaltyStandard?: InspectionAppealViolationItemPenaltyStandardDto | null;
}

export interface InspectionAppealViolationItemsDto {
  appealId?: number | string | null;
  violationId?: number | string | null;
  sourceTaskId?: number | string | null;
  items?: InspectionAppealViolationItemDto[] | null;
}

export interface InspectionAppealRefundDto {
  refundNo?: string | null;
  refundAmount?: number | null;
  refundScope?: string | null;
  statusId?: number | string | null;
  refundStatusId?: number | string | null;
  status?: string | null;
  statusCode?: string | null;
  statusName?: string | null;
  refundStatus?: string | null;
  refundStatusCode?: string | null;
  refundStatusName?: string | null;
  statusObj?: InspectionAppealStatusDto | null;
  refundStatusObj?: InspectionAppealStatusDto | null;
  triggerStatusId?: number | null;
  triggeredOn?: string | null;
  failureReason?: string | null;
  retryCount?: number | null;
  lastRetryOn?: string | null;
}

export interface InspectionAppealFinalDecisionDto {
  decisionTypeId?: number | null;
  decisionTypeCode?: string | null;
  notes?: string | null;
  decidedOn?: string | null;
  decidedByUserName?: string | null;
}

export interface InspectionAppealDepartmentActionDto {
  id?: number | string | null;
  actionTypeCode?: string | null;
  recommendationTypeId?: number | null;
  recommendationTypeCode?: string | null;
  department?: InspectionAppealDepartmentDto | null;
  actionByUserId?: string | null;
  actionByName?: string | null;
  notes?: string | null;
  responseDeadline?: string | null;
  relatedTimelineEventCode?: string | null;
  actionOn?: string | null;
  createdOn?: string | null;
  createdByUserName?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  adjustments?: InspectionAppealAdjustmentDto[] | null;
  attachments?: InspectionAppealAttachmentDto[] | null;
}

export interface InspectionAppealDetailDto extends InspectionAppealListItemDto {
  isViolationPaid?: boolean | null;
  violationId?: number | string | null;
  violationTypeId?: number | string | null;
  violationStatusId?: number | string | null;
  violationStatusName?: string | null;
  violationFineAmount?: number | null;
  notes?: string | null;
  appealReasonRemark?: string | null;
  attachments?: InspectionAppealAttachmentDto[] | null;
  attachmentUrl1?: string | null;
  attachmentUrl2?: string | null;
  attachmentUrl3?: string | null;
  messages?: InspectionAppealMessageDto[] | null;
  timeline?: InspectionAppealTimelineItemDto[] | null;
  departmentActions?: InspectionAppealDepartmentActionDto[] | null;
  adjustments?: InspectionAppealAdjustmentDto[] | null;
  refund?: InspectionAppealRefundDto | null;
  finalDecision?: InspectionAppealFinalDecisionDto | null;
  departmentRecommendation?:
    | string
    | InspectionAppealDepartmentRecommendationDto
    | null;
  departmentRecommendationTypeId?: number | null;
  departmentRecommendationTypeCode?: string | null;
  applicantEmail?: string | null;
  applicantMobileNumber?: string | null;
  profileType?: string | null;
  profileStatus?: string | null;
  establishmentName?: string | null;
  commercialLicenseNumber?: string | null;
  emirate?: string | null;
  relatedViolation?: {
    violationNo?: string | null;
    violationType?: string | null;
    violationTypeName?: string | null;
    violationDate?: string | null;
    createdOn?: string | null;
    status?: string | null;
    statusName?: string | null;
  } | null;
}

export interface InspectionAppealWriteAttachmentDto {
  fileName: string;
  fileUrl: string;
  contentType?: string;
}

export interface InspectionAppealMessageRequest {
  body: string;
  attachments?: InspectionAppealWriteAttachmentDto[];
}

export interface InspectionAppealInternalNoteRequest {
  body: string;
  attachments?: InspectionAppealWriteAttachmentDto[];
}

type InspectionAppealReadRequestConfig = {
  skipErrorMessage?: boolean;
};

export interface InspectionAppealProcessAdjustmentItemDto {
  violationItemId?: number | string | null;
  violationItemCode: string;
  isSelected: boolean;
  proposedDegree: number;
  proposedFineAmount?: number;
  proposedViolationStatusId?: number | string | null;
  notes?: string | null;
}

export interface InspectionAppealProcessRequest {
  recommendationTypeId: number;
  notes: string;
  adjustmentItems?: InspectionAppealProcessAdjustmentItemDto[];
  attachments?: InspectionAppealWriteAttachmentDto[];
}

export interface SaveAdjustedAppealViolationItemDto {
  violationItemId?: number | string | null;
  violationItemCode: string;
  violationItemName: string;
  decisionTypeId: 1 | 2;
  degree: number;
  fineAmount: number;
  notes?: string | null;
}

export interface SaveAdjustedAppealViolationItemsRequest {
  appealId: number | string;
  taskId: number | string;
  violationId: number | string;
  items: SaveAdjustedAppealViolationItemDto[];
}

export interface SaveAdjustedAppealViolationItemsResponse {
  appealId?: number | string | null;
  taskId?: number | string | null;
  violationId?: number | string | null;
  items?: Array<
    SaveAdjustedAppealViolationItemDto & {
      id?: number | string | null;
      appealResult?: number | string | null;
      oldDegree?: number | string | null;
      newDegree?: number | string | null;
      [key: string]: unknown;
    }
  > | null;
}

export interface CancelAllAppealViolationItemsRequest {
  recommendationTypeId: number;
  notes: string;
  attachments?: InspectionAppealWriteAttachmentDto[];
}

export interface CancelAllAppealViolationItemsResponse {
  appealId?: number | string | null;
  resultingStatusId?: number | string | null;
  resultingStatusCode?: string | null;
  resultingStatusName?: string | null;
  finalDecision?: Record<string, unknown> | null;
  refund?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface InspectionAppealSendBackRequest {
  notes: string;
  attachments?: InspectionAppealWriteAttachmentDto[];
}

export interface InspectionAppealChangeStatusRequest {
  targetStatusId: number;
  assignedDepartmentCode?: string;
  roleId?: string;
  responseDeadline?: string;
  notes?: string;
  attachments?: InspectionAppealWriteAttachmentDto[];
}

const ROLE_SEGMENT: Record<InspectionAppealWorkbenchRole, string> = {
  customer_happiness: "customer-happiness",
  department: "departments",
  committee: "departments",
};

function normalizeInspectionAppealLookupOptions(
  response:
    | ApiResponse<InspectionAppealLookupOption[]>
    | InspectionAppealLookupOption[]
    | null
    | undefined,
) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object" && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

export const getInspectionAppealReasons = async () => {
  const response = await request.get<
    ApiResponse<InspectionAppealLookupOption[]>,
    ApiResponse<InspectionAppealLookupOption[]>
  >(
    "/api/admin/inspection/lookup/appeal-reasons",
    {},
    { skipErrorMessage: true },
  );
  return normalizeInspectionAppealLookupOptions(response);
};

export const getInspectionAppealStatuses = async () => {
  const response = await request.get<
    ApiResponse<InspectionAppealLookupOption[]>,
    ApiResponse<InspectionAppealLookupOption[]>
  >(
    "/api/admin/inspection/lookup/appeal-statuses",
    {},
    { skipErrorMessage: true },
  );
  return normalizeInspectionAppealLookupOptions(response);
};

export const getInspectionAppealList = (
  role: InspectionAppealWorkbenchRole,
  tab: InspectionAppealWorkbenchTab,
  params: InspectionAppealListParams,
) =>
  request.get<InspectionAppealListResponseDto>(
    `/api/admin/inspection/appeals/${ROLE_SEGMENT[role]}/${tab}`,
    params,
  );

export const getInspectionViolationAppeal = (violationId: number | string) =>
  request.get<InspectionAppealListItemDto | null>(
    `/api/admin/inspection/violations/${encodeURIComponent(String(violationId))}/appeal`,
    {},
    { skipErrorMessage: true },
  );

export const getInspectionTargetAppeals = (
  params: InspectionTargetAppealListParams,
) =>
  request.get<InspectionTargetAppealListResponseDto>(
    "/api/admin/inspection/appeals/by-target",
    params,
    { skipErrorMessage: true },
  );

export const getInspectionProfileAppeals = (
  params: InspectionProfileAppealListParams,
) =>
  request.get<
    InspectionProfileAppealListResponseDto | InspectionProfileAppealResponseEnvelope
  >(
    "/api/admin/inspection/profile/appeal/by-user-profile",
    params,
  );

export const getInspectionAppealStats = (
  role: InspectionAppealWorkbenchRole,
  config: { skipErrorMessage?: boolean } = {},
) =>
  request.get<InspectionAppealStatsDto>(
    `/api/admin/inspection/appeals/${ROLE_SEGMENT[role]}/stats`,
    {},
    config,
  );

export const exportInspectionAppealList = (
  role: InspectionAppealWorkbenchRole,
  tab: InspectionAppealWorkbenchTab,
  params: InspectionAppealListParams,
) => {
  const fileName = `Appeals-${moment().format("DDMMYYYYHHmmss")}.csv`;
  return saveFileWithAxios(
    `/api/admin/inspection/appeals/${ROLE_SEGMENT[role]}/${tab}/export`,
    fileName,
    params,
  );
};

export const getInspectionAppealDetail = (
  appealId: number | string,
  config: InspectionAppealReadRequestConfig = {},
) =>
  request.get<InspectionAppealDetailDto>(
    `/api/admin/inspection/appeals/${appealId}`,
    {},
    config,
  );

export const getInspectionAppealViolationItems = (
  appealId: number | string,
  config: InspectionAppealReadRequestConfig = {},
) =>
  request.get<ApiResponse<InspectionAppealViolationItemsDto> | InspectionAppealViolationItemsDto>(
    `/api/admin/inspection/appeals/${appealId}/violation-items`,
    {},
    config,
  );

export const getInspectionAppealMessages = (
  appealId: number | string,
  config: InspectionAppealReadRequestConfig = {},
) =>
  request.get<InspectionAppealMessageDto[]>(
    `/api/admin/inspection/appeals/${appealId}/messages`,
    {},
    config,
  );

export const getInspectionAppealTimeline = (
  appealId: number | string,
  config: InspectionAppealReadRequestConfig = {},
) =>
  request.get<InspectionAppealTimelineItemDto[]>(
    `/api/admin/inspection/appeals/${appealId}/timeline`,
    {},
    config,
  );

export const replyInspectionAppealToCustomer = (
  appealId: number | string,
  data: InspectionAppealMessageRequest,
) =>
  request.post<boolean>(
    `/api/admin/inspection/appeals/${appealId}/messages/reply-to-customer`,
    data,
  );

export const createInspectionAppealInternalNote = (
  appealId: number | string,
  data: InspectionAppealInternalNoteRequest,
) =>
  request.post<boolean>(
    `/api/admin/inspection/appeals/${appealId}/messages/internal-note`,
    data,
  );

export const processInspectionAppeal = (
  appealId: number | string,
  data: InspectionAppealProcessRequest,
) =>
  request.post<boolean>(
    `/api/admin/inspection/appeals/${appealId}/process`,
    data,
  );

export const saveAdjustedAppealViolationItems = (
  appealId: number | string,
  data: SaveAdjustedAppealViolationItemsRequest,
) =>
  request.post<
    ApiResponse<SaveAdjustedAppealViolationItemsResponse>,
    ApiResponse<SaveAdjustedAppealViolationItemsResponse>
  >(
    `/api/admin/inspection/appeals/${appealId}/violation-items`,
    data,
  );

export const cancelAllAppealViolationItems = (
  appealId: number | string,
  data: CancelAllAppealViolationItemsRequest,
) =>
  request.post<
    ApiResponse<CancelAllAppealViolationItemsResponse>,
    ApiResponse<CancelAllAppealViolationItemsResponse>
  >(
    `/api/admin/inspection/appeals/${appealId}/cancel-all`,
    data,
  );

export const sendBackInspectionAppeal = (
  appealId: number | string,
  data: InspectionAppealSendBackRequest,
) =>
  request.post<boolean>(
    `/api/admin/inspection/appeals/${appealId}/send-back`,
    data,
  );

export const changeInspectionAppealStatus = (
  appealId: number | string,
  data: InspectionAppealChangeStatusRequest,
) =>
  request.post<boolean>(
    `/api/admin/inspection/appeals/${appealId}/change-status`,
    data,
  );

export const retryInspectionAppealRefund = (appealId: number | string) =>
  request.post<InspectionAppealRefundDto>(
    `/api/admin/inspection/appeals/${appealId}/refunds/retry`,
  );
