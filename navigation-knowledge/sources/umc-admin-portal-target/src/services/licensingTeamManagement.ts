import request from "@/utils/request"
import type { ApiResponse } from "./userManagement"

// P8 Plan A: route through the gateway (relative /api). No per-service base URL override.
export const LICENSING_TEAM_MANAGEMENT_BASE_URL = ""

export type LicensingTeamManagementView = "todo" | "completed"

export type LicensingTeamManagementCategory =
  | "all"
  | "applications"
  | "profileVerifications"
  | "enquiries"
  | "refunds"
  | "appeals"

export interface LicensingTeamManagementSummaryQuery {
  applicationTaskOnly?: boolean
}

export interface LicensingTeamManagementSummaryCategoryDto {
  category: Exclude<LicensingTeamManagementCategory, "all"> | (string & {})
  categoryDisplay?: string | null
  todoCount: number
  completedCount: number
}

export interface LicensingTeamManagementMetadataOptionDto {
  code?: string | null
  display?: string | null
}

export interface LicensingTeamManagementMetadataDto {
  categories?: LicensingTeamManagementMetadataOptionDto[]
  statuses?: LicensingTeamManagementMetadataOptionDto[]
  todoStatuses?: LicensingTeamManagementMetadataOptionDto[]
  completedStatuses?: LicensingTeamManagementMetadataOptionDto[]
  leaveReasons?: LicensingTeamManagementMetadataOptionDto[]
}

export interface LicensingTeamManagementSummaryDto {
  todoCount: number
  completedCount: number
  urgentCount: number
  categories: LicensingTeamManagementSummaryCategoryDto[]
}

export interface LicensingTeamManagementTaskQueryPayload {
  view: LicensingTeamManagementView
  applicationTaskOnly?: boolean
  keyword?: string
  category?: LicensingTeamManagementCategory
  status?: string
  memberId?: string
  lastUpdatedFrom?: string
  lastUpdatedTo?: string
  pageIndex?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: 0 | 1
}

export interface LicensingTeamManagementTaskSlaDto {
  remainingMinutes?: number | null
  displayText?: string | null
  isOverdue?: boolean
  dueOn?: string | null
}

export interface LicensingTeamManagementTaskItemDto {
  sourceType?: string
  sourceId?: string
  userId?: string
  userTypeCode?: string | null
  applyForUserTypeId?: string | number | null
  taskNo?: string
  taskCategory?: string
  taskCategoryCode?: string
  taskCategoryDisplay?: string | null
  applyFor?: string
  sla?: LicensingTeamManagementTaskSlaDto | null
  assignedToUserId?: string
  assignedTo?: string
  status?: string
  statusId?: string | number | null
  statusCode?: string
  statusDisplay?: string | null
  statusDisplayOnly?: string | null
  lastUpdatedOn?: string
  isUrgent?: boolean
  canReassign?: boolean
  detailTarget?: string
}

export interface LicensingTeamManagementTaskPageDto {
  items: LicensingTeamManagementTaskItemDto[]
  total: number
  pageIndex: number
  pageSize: number
}

export interface LicensingTeamManagementTaskQueryResponse {
  page: LicensingTeamManagementTaskPageDto
}

export interface LicensingTeamManagementReassignTaskDto {
  sourceType: string
  sourceId: string
}

export interface LicensingTeamManagementReassignPayload {
  assignedUserId: string
  tasks: LicensingTeamManagementReassignTaskDto[]
}

export interface LicensingTeamManagementMemberMetricsDto {
  completedTasks?: number | null
  totalAssignedTasks?: number | null
  avgProcessingTime?: number | null
  slaCompliance?: number | null
  overdueTasks?: number | null
}

export interface LicensingTeamManagementLeaveInfoDto {
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

export interface LicensingTeamManagementMemberCardDto {
  userId?: string
  userName?: string
  avatarUrl?: string | null
  isOnLeave?: boolean
  leaveInfo?: LicensingTeamManagementLeaveInfoDto | null
  todoTaskCount?: number | null
  completedTasks?: number | null
  totalAssignedTasks?: number | null
  avgProcessingTime?: number | null
  slaCompliance?: number | null
  overdueTasks?: number | null
  metricsByCategory?: Record<
    string,
    LicensingTeamManagementMemberMetricsDto | undefined
  >
}

export interface LicensingTeamManagementMemberOptionDto {
  userId?: string
  userName?: string
}

export interface LicensingTeamManagementMembersQuery {
  memberId?: string
  startDate?: string
  endDate?: string
  sourceType?: string
  tasks?: LicensingTeamManagementReassignTaskDto[]
}

export interface LicensingTeamManagementMembersResponse {
  startDate?: string
  endDate?: string
  members: LicensingTeamManagementMemberOptionDto[]
  cards: LicensingTeamManagementMemberCardDto[]
}

export type LicensingTeamManagementReassignmentMembersResponse =
  | LicensingTeamManagementMembersResponse
  | LicensingTeamManagementMemberOptionDto[]

export interface LicensingTeamManagementEmergencyLeavePayload {
  leaveReasonCode: string
  expectedReturnDate?: string
  notes?: string
}

export interface LicensingTeamManagementProfileVerificationProcessPayload {
  statusId: number
  remark?: string | null
}

type LicensingTeamManagementApiResult<T> = T | ApiResponse<T>

const getLicensingTeamManagementRequestConfig = (skipErrorMessage = false) => ({
  baseURL: LICENSING_TEAM_MANAGEMENT_BASE_URL || undefined,
  skipErrorMessage,
})

const isWrappedLicensingTeamManagementResponse = <T,>(
  response: LicensingTeamManagementApiResult<T>
): response is ApiResponse<T> =>
  Boolean(
    response &&
      typeof response === "object" &&
      "isSuccess" in response &&
      "statusCode" in response &&
      "data" in response
  )

const unwrapLicensingTeamManagementResponse = <T,>(
  response: LicensingTeamManagementApiResult<T>
): T => {
  if (isWrappedLicensingTeamManagementResponse(response)) {
    return (response.data ?? ({} as T)) as T
  }

  return response
}

export const getLicensingTeamManagementSummary = (
  params: LicensingTeamManagementSummaryQuery
) =>
  request
    .get<
      LicensingTeamManagementApiResult<LicensingTeamManagementSummaryDto>,
      LicensingTeamManagementApiResult<LicensingTeamManagementSummaryDto>
    >(
      "/api/licensing/team-management/summary",
      params,
      getLicensingTeamManagementRequestConfig()
    )
    .then(unwrapLicensingTeamManagementResponse)

export const getLicensingTeamManagementMetadata = () =>
  request
    .get<
      LicensingTeamManagementApiResult<LicensingTeamManagementMetadataDto>,
      LicensingTeamManagementApiResult<LicensingTeamManagementMetadataDto>
    >(
      "/api/licensing/team-management/metadata",
      {},
      getLicensingTeamManagementRequestConfig()
    )
    .then(unwrapLicensingTeamManagementResponse)

export const queryLicensingTeamManagementTasks = (
  data: LicensingTeamManagementTaskQueryPayload
) =>
  request
    .post<
      LicensingTeamManagementApiResult<LicensingTeamManagementTaskQueryResponse>,
      LicensingTeamManagementApiResult<LicensingTeamManagementTaskQueryResponse>
    >(
      "/api/licensing/team-management/tasks/query",
      data,
      getLicensingTeamManagementRequestConfig()
    )
    .then(unwrapLicensingTeamManagementResponse)

export const exportLicensingTeamManagementTasks = (
  data: LicensingTeamManagementTaskQueryPayload
) =>
  request.post<Blob, Blob>(
    "/api/licensing/team-management/tasks/export",
    data,
    {
      ...getLicensingTeamManagementRequestConfig(),
      responseType: "blob",
    }
  )

export const reassignLicensingTeamManagementTasks = (
  data: LicensingTeamManagementReassignPayload
) =>
  request.post(
    "/api/licensing/team-management/tasks/reassign",
    data,
    getLicensingTeamManagementRequestConfig()
  )

export const getLicensingTeamManagementMembers = (
  params: LicensingTeamManagementMembersQuery
) =>
  request
    .get<
      LicensingTeamManagementApiResult<LicensingTeamManagementMembersResponse>,
      LicensingTeamManagementApiResult<LicensingTeamManagementMembersResponse>
    >(
      "/api/licensing/team-management/members",
      params,
      getLicensingTeamManagementRequestConfig()
    )
    .then(unwrapLicensingTeamManagementResponse)

export const getLicensingTeamManagementReassignmentMembers = (
  params: LicensingTeamManagementMembersQuery
) =>
  params.tasks?.length
    ? request
        .post<
          LicensingTeamManagementApiResult<LicensingTeamManagementReassignmentMembersResponse>,
          LicensingTeamManagementApiResult<LicensingTeamManagementReassignmentMembersResponse>
        >(
          "/api/licensing/team-management/members/reassignment/query",
          {
            sourceType: params.sourceType,
            tasks: params.tasks,
          },
          getLicensingTeamManagementRequestConfig()
        )
        .then(unwrapLicensingTeamManagementResponse)
    : request
        .get<
          LicensingTeamManagementApiResult<LicensingTeamManagementReassignmentMembersResponse>,
          LicensingTeamManagementApiResult<LicensingTeamManagementReassignmentMembersResponse>
        >(
          "/api/licensing/team-management/members/reassignment",
          params,
          getLicensingTeamManagementRequestConfig()
        )
        .then(unwrapLicensingTeamManagementResponse)

export const markLicensingTeamManagementMemberEmergencyLeave = (
  userId: string,
  data: LicensingTeamManagementEmergencyLeavePayload
) =>
  request.post(
    `/api/licensing/team-management/members/${userId}/emergency-leave`,
    data,
    getLicensingTeamManagementRequestConfig()
  )

export const resumeLicensingTeamManagementMemberWork = (userId: string) =>
  request.post(
    `/api/licensing/team-management/members/${userId}/resume-work`,
    {},
    getLicensingTeamManagementRequestConfig()
  )

export const processLicensingTeamManagementProfileVerification = (
  profileId: number,
  data: LicensingTeamManagementProfileVerificationProcessPayload
) =>
  request.post<ApiResponse<boolean>>(
    `/api/UserManagement/UserProfile/${profileId}/Process`,
    data,
    getLicensingTeamManagementRequestConfig()
  )
