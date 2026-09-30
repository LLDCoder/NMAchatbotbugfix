import request from "@/utils/request"
import type { ApiResponse } from "./userManagement"

// P8 Plan A: route through the gateway (relative /api). No per-service base URL override.
export const CUSTOMER_HAPPINESS_TEAM_MANAGEMENT_BASE_URL = ""

export type CustomerHappinessTeamManagementView = "todo" | "completed"

export type CustomerHappinessTeamManagementCategory =
  | "all"
  | "enquiries"
  | "refunds"
  | "appeals"

export interface CustomerHappinessTeamManagementMetadataOptionDto {
  code?: string | null
  display?: string | null
}

export interface CustomerHappinessTeamManagementMetadataDto {
  categories?: CustomerHappinessTeamManagementMetadataOptionDto[]
  statuses?: CustomerHappinessTeamManagementMetadataOptionDto[]
  todoStatuses?: CustomerHappinessTeamManagementMetadataOptionDto[]
  completedStatuses?: CustomerHappinessTeamManagementMetadataOptionDto[]
  leaveReasons?: CustomerHappinessTeamManagementMetadataOptionDto[]
}

export interface CustomerHappinessTeamManagementSummaryCategoryDto {
  category:
    | Exclude<CustomerHappinessTeamManagementCategory, "all">
    | (string & {})
  categoryDisplay?: string | null
  todoCount?: number | null
  completedCount?: number | null
}

export interface CustomerHappinessTeamManagementSummaryDto {
  todoCount?: number | null
  completedCount?: number | null
  urgentCount?: number | null
  categories?: CustomerHappinessTeamManagementSummaryCategoryDto[] | null
}

export interface CustomerHappinessTeamManagementTaskQueryPayload {
  view: CustomerHappinessTeamManagementView
  keyword?: string
  category?: CustomerHappinessTeamManagementCategory
  status?: string
  memberId?: string
  lastUpdatedFrom?: string
  lastUpdatedTo?: string
  pageIndex?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: 0 | 1
}

export interface CustomerHappinessTeamManagementTaskSlaDto {
  remainingMinutes?: number | null
  displayText?: string | null
  isOverdue?: boolean
  dueOn?: string | null
}

export interface CustomerHappinessTeamManagementTaskItemDto {
  sourceType?: string
  sourceId?: string
  userId?: string | null
  applyForUserTypeId?: string | number | null
  taskNo?: string
  taskCategory?: string
  taskCategoryCode?: string
  taskCategoryDisplay?: string | null
  applyFor?: string
  sla?: CustomerHappinessTeamManagementTaskSlaDto | null
  assignedToUserId?: string | null
  assignedTo?: string | null
  status?: string | null
  statusId?: string | number | null
  statusCode?: string | null
  statusDisplay?: string | null
  statusDisplayOnly?: string | null
  lastUpdatedOn?: string | null
  isUrgent?: boolean
  canReassign?: boolean
  detailTarget?: string | null
}

export interface CustomerHappinessTeamManagementTaskPageDto {
  items?: CustomerHappinessTeamManagementTaskItemDto[] | null
  total?: number | null
  pageIndex?: number | null
  pageSize?: number | null
}

export interface CustomerHappinessTeamManagementTaskQueryResponse {
  page?: CustomerHappinessTeamManagementTaskPageDto | null
}

export interface CustomerHappinessTeamManagementReassignTaskDto {
  sourceType: string
  sourceId: string
}

export interface CustomerHappinessTeamManagementReassignPayload {
  assignedUserId: string
  tasks: CustomerHappinessTeamManagementReassignTaskDto[]
}

export interface CustomerHappinessTeamManagementMemberMetricsDto {
  completedTasks?: number | null
  totalAssignedTasks?: number | null
  avgProcessingTime?: number | null
  slaCompliance?: number | null
  overdueTasks?: number | null
}

export interface CustomerHappinessTeamManagementLeaveInfoDto {
  leaveReasonCode?: string | null
  leaveReasonDisplay?: string | null
  reasonEn?: string | null
  reasonAr?: string | null
  notes?: string | null
  briefDescription?: string | null
  effectiveFrom?: string | null
  leaveCreatedOn?: string | null
  createdOn?: string | null
  createdAt?: string | null
  expectedReturnDate?: string | null
}

export interface CustomerHappinessTeamManagementMemberCardDto {
  userId?: string | null
  userName?: string | null
  avatarUrl?: string | null
  isOnLeave?: boolean
  leaveInfo?: CustomerHappinessTeamManagementLeaveInfoDto | null
  todoTaskCount?: number | null
  metricsByCategory?: Record<
    string,
    CustomerHappinessTeamManagementMemberMetricsDto | undefined
  >
}

export interface CustomerHappinessTeamManagementMemberOptionDto {
  userId?: string | null
  userName?: string | null
}

export interface CustomerHappinessTeamManagementMembersQuery {
  memberId?: string
  startDate?: string
  endDate?: string
}

export interface CustomerHappinessTeamManagementMembersResponse {
  startDate?: string | null
  endDate?: string | null
  members?: CustomerHappinessTeamManagementMemberOptionDto[] | null
  cards?: CustomerHappinessTeamManagementMemberCardDto[] | null
}

export type CustomerHappinessTeamManagementReassignmentMembersResponse =
  | CustomerHappinessTeamManagementMembersResponse
  | CustomerHappinessTeamManagementMemberOptionDto[]

export interface CustomerHappinessTeamManagementEmergencyLeavePayload {
  leaveReasonCode: string
  expectedReturnDate?: string
  notes?: string
}

type CustomerHappinessTeamManagementApiResult<T> = T | ApiResponse<T>

const getCustomerHappinessTeamManagementRequestConfig = (
  skipErrorMessage = false
) => ({
  baseURL: CUSTOMER_HAPPINESS_TEAM_MANAGEMENT_BASE_URL || undefined,
  skipErrorMessage,
})

const isWrappedCustomerHappinessTeamManagementResponse = <T,>(
  response: CustomerHappinessTeamManagementApiResult<T>
): response is ApiResponse<T> =>
  Boolean(
    response &&
      typeof response === "object" &&
      "isSuccess" in response &&
      "statusCode" in response &&
      "data" in response
  )

const unwrapCustomerHappinessTeamManagementResponse = <T,>(
  response: CustomerHappinessTeamManagementApiResult<T>
): T => {
  if (isWrappedCustomerHappinessTeamManagementResponse(response)) {
    return (response.data ?? ({} as T)) as T
  }

  return response
}

export const getCustomerHappinessTeamManagementSummary = () =>
  request
    .get<
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementSummaryDto>,
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementSummaryDto>
    >(
      "/api/customer-happiness/team-management/summary",
      {},
      getCustomerHappinessTeamManagementRequestConfig()
    )
    .then(unwrapCustomerHappinessTeamManagementResponse)

export const getCustomerHappinessTeamManagementMetadata = () =>
  request
    .get<
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementMetadataDto>,
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementMetadataDto>
    >(
      "/api/customer-happiness/team-management/metadata",
      {},
      getCustomerHappinessTeamManagementRequestConfig()
    )
    .then(unwrapCustomerHappinessTeamManagementResponse)

export const queryCustomerHappinessTeamManagementTasks = (
  data: CustomerHappinessTeamManagementTaskQueryPayload
) =>
  request
    .post<
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementTaskQueryResponse>,
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementTaskQueryResponse>
    >(
      "/api/customer-happiness/team-management/tasks/query",
      data,
      getCustomerHappinessTeamManagementRequestConfig()
    )
    .then(unwrapCustomerHappinessTeamManagementResponse)

export const exportCustomerHappinessTeamManagementTasks = (
  data: CustomerHappinessTeamManagementTaskQueryPayload
) =>
  request.post<Blob, Blob>(
    "/api/customer-happiness/team-management/tasks/export",
    data,
    {
      ...getCustomerHappinessTeamManagementRequestConfig(),
      responseType: "blob",
    }
  )

export const reassignCustomerHappinessTeamManagementTasks = (
  data: CustomerHappinessTeamManagementReassignPayload
) =>
  request.post(
    "/api/customer-happiness/team-management/tasks/reassign",
    data,
    getCustomerHappinessTeamManagementRequestConfig()
  )

export const getCustomerHappinessTeamManagementMembers = (
  params: CustomerHappinessTeamManagementMembersQuery
) =>
  request
    .get<
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementMembersResponse>,
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementMembersResponse>
    >(
      "/api/customer-happiness/team-management/members",
      params,
      getCustomerHappinessTeamManagementRequestConfig()
    )
    .then(unwrapCustomerHappinessTeamManagementResponse)

export const getCustomerHappinessTeamManagementReassignmentMembers = (
  params: CustomerHappinessTeamManagementMembersQuery
) =>
  request
    .get<
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementReassignmentMembersResponse>,
      CustomerHappinessTeamManagementApiResult<CustomerHappinessTeamManagementReassignmentMembersResponse>
    >(
      "/api/customer-happiness/team-management/members/reassignment",
      params,
      getCustomerHappinessTeamManagementRequestConfig()
    )
    .then(unwrapCustomerHappinessTeamManagementResponse)

export const markCustomerHappinessTeamManagementMemberEmergencyLeave = (
  userId: string,
  data: CustomerHappinessTeamManagementEmergencyLeavePayload
) =>
  request.post(
    `/api/customer-happiness/team-management/members/${userId}/emergency-leave`,
    data,
    getCustomerHappinessTeamManagementRequestConfig()
  )

export const resumeCustomerHappinessTeamManagementMemberWork = (
  userId: string
) =>
  request.post(
    `/api/customer-happiness/team-management/members/${userId}/resume-work`,
    {},
    getCustomerHappinessTeamManagementRequestConfig()
  )
