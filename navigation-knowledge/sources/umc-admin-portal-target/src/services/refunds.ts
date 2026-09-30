import moment from "moment";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import request from "@/utils/request";

type RefundRequestConfig = Parameters<typeof request.get>[2];

export interface RefundsListParams {
  KewWorld?: string;
  StatusId?: number;
  StartTime?: string;
  EndTime?: string;
  PageSize: number;
  PageIndex: number;
  UserId?: string;
  ProfileId?: number;
  UserProfileId?: number;
  SortBy?: string;
  SortDirection?: 0 | 1;
}

export interface RefundStatusItemDto {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

export interface RefundsListItemDto {
  id: number;
  categoryId?: number | null;
  referenceNumber?: string | null;
  amount?: number | null;
  reasonId?: number | null;
  additionalComments?: string | null;
  attachmentsURL01?: string | null;
  attachmentsURL02?: string | null;
  attachmentsURL03?: string | null;
  applicationNumber?: string | null;
  statusId?: number | null;
  userId?: string | null;
  createdOn?: string | null;
  statusObj?: { id: number; nameEn: string; nameAr: string } | null;
  reasonObj?: { id: number; nameEn: string; nameAr: string } | null;
  categoryObj?: { id: number; nameEn: string; nameAr: string } | null;
}

export interface RefundsListResponseDto {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: RefundsListItemDto[];
}

export const getRefunds = (params: RefundsListParams) => {
  return request.get<RefundsListResponseDto>("/api/Refund/Management/Refunds", params);
};

export interface ProfileRefundsByUserProfileParams {
  userId?: string;
  profileId?: number;
  search?: string;
  applicationNumber?: string;
  categoryId?: number;
  statusId?: number;
  lastupdatedStartTime?: string;
  lastupdatedEndTime?: string;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 0 | 1;
}

export interface RefundValueObjDto {
  id?: number | null;
  nameEn?: string | null;
  nameAr?: string | null;
}

export interface ProfileRefundItemDto {
  id?: number | string | null;
  categoryId?: number | string | null;
  referenceNumber?: string | null;
  amount?: number | string | null;
  reasonId?: number | string | null;
  additionalComments?: string | null;
  attachmentsURL01?: string | null;
  attachmentsURL02?: string | null;
  attachmentsURL03?: string | null;
  applicationNumber?: string | null;
  statusId?: number | string | null;
  userId?: string | null;
  createdOn?: string | null;
  updateOn?: string | null;
  transactionTime?: string | null;
  applyFor?: string | null;
  rejectedReason?: string | null;
  statusObj?: RefundValueObjDto | null;
  reasonObj?: RefundValueObjDto | null;
  categoryObj?: RefundValueObjDto | null;
}

export interface ProfileRefundsByUserProfileResponse {
  items?: ProfileRefundItemDto[] | null;
  totalCount?: number | string | null;
  pageIndex?: number | string | null;
  pageSize?: number | string | null;
  total?: number | string | null;
  departmentProcessing?: number | string | null;
  departmentProcessingCount?: number | string | null;
  departmentProcessed?: number | string | null;
  departmentProcessedCount?: number | string | null;
  pendingCustomer?: number | string | null;
  pendingCustomerCount?: number | string | null;
  underReviewCount?: number | string | null;
  pendingRefundCount?: number | string | null;
  rejectedCount?: number | string | null;
  refundedCount?: number | string | null;
  cancelledCount?: number | string | null;
}

export const getProfileRefundsByUserProfile = (
  params: ProfileRefundsByUserProfileParams,
) => {
  return request.get<ProfileRefundsByUserProfileResponse>(
    "/api/admin/inspection/profile/refunds/by-user-profile",
    params,
  );
};

export const getRefundStatusOptions = () => {
  return request.get<RefundStatusItemDto[]>(
    "/api/Refund/ApplicationModel/Status",
  );
};

export interface RefundsStatusCountParams {
  userId?: string;
  profileId?: number;
}

export interface RefundsStatusCountDto {
  pendingApprovalCount?: number | null;
  approvedCount?: number | null;
  rejectedCount?: number | null;
  cancelledCount?: number | null;
  completedCount?: number | null;
}

export const getRefundsStatusCount = (params: RefundsStatusCountParams) => {
  return request.get<RefundsStatusCountDto>(
    "/api/Refund/Management/StatusCount",
    params,
  );
};

export interface AdminRefundTicketsParams {
  SeachKey?: string;
  CategoryId?: number;
  StatusId?: number;
  SourceTypeId?: number;
  StartDate?: string;
  EndDate?: string;
  IsCompleted?: boolean;
  PageSize: number;
  PageIndex: number;
  SortBy?: string;
  SortDirection?: 0 | 1;
}

export interface AdminRefundApplyForDto {
  userTypeId?: number | null;
  userName?: string | null;
  userNameAr?: string | null;
}

export interface AdminRefundTicketListItemDto {
  refundId?: number;
  applicationNo?: string | null;
  refundCategory?: string | null;
  refundCategoryObj?: AdminRefundStatusObjDto | null;
  referenceNo?: string | null;
  applyFor?: AdminRefundApplyForDto | null;
  amount?: number | null;
  sla?: string | null;
  slaObj?: AdminRefundStatusObjDto | null;
  currentHandler?: string | null;
  roleTypeObj?: AdminRefundStatusObjDto | null;
  status?: string | null;
  statusObj?: AdminRefundStatusObjDto | null;
  sourceType?: string | null;
  createdOn?: string | null;
  updateOn?: string | null;
  departmentId?: number | null;
  hasMessage?: boolean | null;
}

export interface AdminRefundTicketsResponseDto {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: AdminRefundTicketListItemDto[];
}

export interface AdminRefundStatusObjDto {
  id?: number | null;
  nameEn?: string | null;
  nameAr?: string | null;
}

export interface AdminRefundCommentDetailDto {
  commentId?: number;
  messageContent?: string | null;
  note?: string | null;
  attachments?: string[] | null;
  userId?: string | null;
  userName?: string | null;
  createdOn?: string | null;
  deadLine?: string | null;
  detpartInfoObj?: AdminRefundStatusObjDto | null;
  userProfileId?: number | null;
  isInternal?: boolean | null;
  photoUrl?: string | null;
  decisionTypeId?: number | null;
  decisionType?: AdminRefundStatusObjDto | null;
  commentTypeId?: number | null;
  commentTypeObj?: AdminRefundStatusObjDto | null;
  roleTypeId?: number | null;
  roleTypeObj?: AdminRefundStatusObjDto | null;
  isRead?: boolean | null;
}

export interface AdminRefundPaymentInfoDto {
  transactionNo?: string | null;
  statusId?: number | null;
  statusObj?: AdminRefundStatusObjDto | null;
  transactionTypeId?: number | null;
  transactionTypeObj?: AdminRefundStatusObjDto | null;
  paymentMethodId?: number | null;
  paymentMethodObj?: AdminRefundStatusObjDto | null;
  amount?: number | null;
  applyForObj?: AdminRefundApplyForDto | null;
  cardInfo?: string | null;
  desciption?: string | null;
  updateOn?: string | null;
}

export interface AdminRefundOverviewIdentityDto {
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

export interface AdminRefundDetailDto {
  id?: number;
  categoryId?: number | null;
  referenceNumber?: string | null;
  amount?: number | null;
  reasonId?: number | null;
  attachmentsURL01?: string | null;
  attachmentsURL02?: string | null;
  attachmentsURL03?: string | null;
  applicationNumber?: string | null;
  statusId?: number | null;
  userId?: string | null;
  profileId?: number | null;
  userProfileId?: number | null;
  userTypeId?: number | null;
  userTypeCode?: string | null;
  establishmentId?: number | null;
  individualId?: number | null;
  sla?: string | null;
  tanscationNo?: string | null;
  applyFor?: string | null;
  apllyFor?: string | null;
  establishmentName?: string | null;
  establishmentNameAr?: string | null;
  licenseNumber?: string | null;
  overviewIdentity?: AdminRefundOverviewIdentityDto | null;
  createdOn?: string | null;
  updateOn?: string | null;
  commentDetails?: AdminRefundCommentDetailDto[] | null;
  statusObj?: AdminRefundStatusObjDto | null;
  reasonObj?: AdminRefundStatusObjDto | null;
  categoryObj?: AdminRefundStatusObjDto | null;
  cardInfo?: string | null;
  sourceType?: string | null;
  paymentInfo?: AdminRefundPaymentInfoDto | null;
  slaEndTime?: string | null;
  platform?: string | null;
  currentHandlerName?: string | null;
  currentHandlerDepartmentName?: string | null;
  departmentDecision?: number | null;
}

export interface AdminRefundTimelineDecisionDto {
  decisionTypeId?: number | null;
  decisionTypeObj?: AdminRefundStatusObjDto | null;
  content?: string | null;
  attachments?: string[] | null;
}

export interface AdminRefundTimelineItemDto {
  refundId?: number | null;
  eventCode?: string | null;
  toStatusId?: number | null;
  changeStatusObj?: AdminRefundStatusObjDto | null;
  content?: string | null;
  createdUerName?: string | null;
  handlUserName?: string | null;
  handleDes?: string | null;
  departmentName?: string | null;
  changeOnTime?: string | null;
  deadLine?: string | null;
  responseDeadline?: string | null;
  departmentDeadLine?: string | null;
  refundDeptDecisionInfo?: AdminRefundTimelineDecisionDto | null;
}

export interface AdminRefundStatusChangeRequest {
  statusId: number;
  attachmentsURL01?: string;
  attachmentsURL02?: string;
  attachmentsURL03?: string;
  notes?: string;
  assignDeptId?: number;
  roleId?: string;
  deadLine?: string;
  decisionTypeId?: number;
  isInternal?: boolean;
}

export interface AdminRefundSendBackRequest {
  attachmentsURL01?: string;
  attachmentsURL02?: string;
  attachmentsURL03?: string;
  notes: string;
}

export interface AdminRefundStatisticsData {
  total?: number;
  departmentProcessingCount?: number;
  departmentProcessedCount?: number;
  pendingCustomerCount?: number;
  pendingRefundCount?: number;
  rejectedCount?: number;
  refundedCount?: number;
  cancelledCount?: number;
  isHappinessCenter?: boolean;
}

export interface AdminRefundStatisticsResponseDto {
  isSuccess?: boolean;
  statusCode?: number;
  message?: string;
  data?: AdminRefundStatisticsData | null;
}

export interface AdminRefundDepartmentDto {
  id?: number | string | null;
  nameEn?: string | null;
  nameAr?: string | null;
}

export interface AdminRefundDepartmentUserDto {
  userId?: string | null;
  userName?: string | null;
  departmentId?: number | string | null;
  departmentNameEn?: string | null;
  departmentNameAr?: string | null;
}

export interface AdminRefundConversationRequest {
  messageContent: string;
  isInternal: boolean;
  attachments?: string[];
}

export const getAdminRefundTickets = (
  params: AdminRefundTicketsParams,
  config?: RefundRequestConfig,
) => {
  return request.get<AdminRefundTicketsResponseDto>(
    "/api/Refund/Admin/Tickets",
    params,
    config,
  );
};

export const getAdminCustomerServiceRefundTickets = (
  params: AdminRefundTicketsParams,
  config?: RefundRequestConfig,
) => {
  return request.get<AdminRefundTicketsResponseDto>(
    "/api/Refund/Admin/Tickets/CustomerService",
    params,
    config,
  );
};

export const exportAdminRefundTickets = (params: AdminRefundTicketsParams) => {
  const fileName = `Refunds-${moment().format("DDMMYYYYHHmmss")}.csv`;
  return saveFileWithAxios("/api/Refund/Admin/Tickets/Export", fileName, params);
};

export const exportAdminCustomerServiceRefundTickets = (
  params: AdminRefundTicketsParams,
) => {
  const fileName = `Refunds-${moment().format("DDMMYYYYHHmmss")}.csv`;
  return saveFileWithAxios(
    "/api/Refund/Admin/Tickets/CustomerService/Export",
    fileName,
    params,
  );
};

export const getAdminRefundTicketDetail = (refundId: number | string) => {
  return request.get<AdminRefundDetailDto>(
    `/api/Refund/Admin/Tickets/${refundId}/Detail`,
  );
};

export const getAdminRefundTicketTimeline = (refundId: number | string) => {
  return request.get<AdminRefundTimelineItemDto[]>(
    `/api/Refund/Admin/Tickets/${refundId}/Timeline`,
    {},
    { skipErrorMessage: true },
  );
};

export const updateAdminRefundTicketStatus = (
  refundId: number | string,
  data: AdminRefundStatusChangeRequest,
) => {
  return request.post<boolean>(
    `/api/Refund/Admin/Tickets/${refundId}/Status`,
    data,
  );
};

export const transferAdminRefundTicketStatus = (
  refundId: number | string,
  data: AdminRefundStatusChangeRequest,
) => {
  return request.post<boolean>(
    `/api/Refund/Admin/Tickets/${refundId}/Status/Transfer`,
    data,
  );
};

export const sendBackAdminRefundTicket = (
  refundId: number | string,
  data: AdminRefundSendBackRequest,
) => {
  return request.post<boolean>(
    `/api/Refund/Admin/Tickets/${refundId}/Status/SendBack`,
    data,
  );
};

export const getAdminRefundTicketsStatistics = () => {
  return request.get<AdminRefundStatisticsResponseDto>(
    "/api/Refund/Admin/Tickets/Statistics",
  );
};

export const getAdminRefundCategories = () => {
  return request.get<RefundStatusItemDto[]>("/api/Refund/Admin/Types/Categories");
};

export const getAdminRefundSourceTypes = () => {
  return request.get<RefundStatusItemDto[]>("/api/Refund/Admin/Types/SourceType");
};

export const getAdminRefundStatusTypes = () => {
  return request.get<RefundStatusItemDto[]>("/api/Refund/Admin/Types/Status");
};

export const getAdminRefundDepartmentStatusTypes = () => {
  return request.get<RefundStatusItemDto[]>(
    "/api/Refund/Admin/Types/Department/Status",
  );
};

export const getAdminRefundDecisionTypes = () => {
  return request.get<RefundStatusItemDto[]>("/api/Refund/Types/DepartmentDecision");
};

export const getAdminRefundDepartments = () => {
  return request.get<AdminRefundDepartmentDto[]>("/api/Refund/Admin/Departments");
};

export const getAdminRefundDepartmentUsers = () => {
  return request.get<AdminRefundDepartmentUserDto[]>(
    "/api/Refund/Admin/User/Departments",
  );
};

export const createAdminRefundConversation = (
  refundId: number | string,
  data: AdminRefundConversationRequest,
) => {
  return request.post<boolean>(
    `/api/Refund/Admin/Tickets/${refundId}/Conversation`,
    data,
  );
};
