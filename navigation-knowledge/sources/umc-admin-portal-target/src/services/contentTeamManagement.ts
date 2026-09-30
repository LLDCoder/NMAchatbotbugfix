import request from "@/utils/request"
import type { ApiResponse } from "./userManagement"

// P8 Plan A: route through the gateway (relative /api). No per-service base URL override;
// requests fall through to the shared axios instance's relative baseURL.
export const CONTENT_TEAM_MANAGEMENT_BASE_URL = ""

export type ContentTeamManagementView = "todo" | "completed"

export type ContentTeamManagementCategory =
  | "all"
  | "applications"
  | "enquiries"
  | "refunds"
  | "appeals"

export interface ContentTeamManagementSummaryQuery {
  applicationTaskOnly?: boolean
}

export interface ContentTeamManagementSummaryCategoryDto {
  category: Exclude<ContentTeamManagementCategory, "all"> | (string & {})
  categoryDisplay?: string | null
  todoCount: number
  completedCount: number
}

export interface ContentTeamManagementMetadataOptionDto {
  code?: string | null
  display?: string | null
}

export interface ContentTeamManagementMetadataDto {
  categories?: ContentTeamManagementMetadataOptionDto[]
  statuses?: ContentTeamManagementMetadataOptionDto[]
  todoStatuses?: ContentTeamManagementMetadataOptionDto[]
  completedStatuses?: ContentTeamManagementMetadataOptionDto[]
  leaveReasons?: ContentTeamManagementMetadataOptionDto[]
}

export interface ContentTeamManagementSummaryDto {
  todoCount: number
  completedCount: number
  urgentCount: number
  categories: ContentTeamManagementSummaryCategoryDto[]
}

export interface ContentTeamManagementTaskQueryPayload {
  view: ContentTeamManagementView
  applicationTaskOnly?: boolean
  keyword?: string
  category?: ContentTeamManagementCategory
  status?: string
  memberId?: string
  lastUpdatedFrom?: string
  lastUpdatedTo?: string
  pageIndex?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: 0 | 1
}

export interface ContentTeamManagementTaskSlaDto {
  remainingMinutes?: number | null
  displayText?: string | null
  isOverdue?: boolean
  dueOn?: string | null
}

export interface ContentTeamManagementTaskItemDto {
  sourceType?: string
  sourceId?: string
  userId?: string
  applyForUserTypeId?: string | number | null
  taskNo?: string
  taskCategory?: string
  taskCategoryCode?: string
  taskCategoryDisplay?: string | null
  applyFor?: string
  sla?: ContentTeamManagementTaskSlaDto | null
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

export interface ContentTeamManagementTaskPageDto {
  items: ContentTeamManagementTaskItemDto[]
  total: number
  pageIndex: number
  pageSize: number
}

export interface ContentTeamManagementTaskQueryResponse {
  page: ContentTeamManagementTaskPageDto
}

export interface ContentTeamManagementReassignTaskDto {
  sourceType: string
  sourceId: string
}

export interface ContentTeamManagementReassignPayload {
  assignedUserId: string
  tasks: ContentTeamManagementReassignTaskDto[]
}

export interface ContentTeamManagementMemberMetricsDto {
  completedTasks?: number | null
  totalAssignedTasks?: number | null
  avgProcessingTime?: number | null
  slaCompliance?: number | null
  overdueTasks?: number | null
}

export interface ContentTeamManagementLeaveInfoDto {
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

export interface ContentTeamManagementMemberCardDto {
  userId?: string
  userName?: string
  avatarUrl?: string | null
  isOnLeave?: boolean
  leaveInfo?: ContentTeamManagementLeaveInfoDto | null
  todoTaskCount?: number | null
  metricsByCategory?: Record<
    string,
    ContentTeamManagementMemberMetricsDto | undefined
  >
}

export interface ContentTeamManagementMemberOptionDto {
  userId?: string
  userName?: string
}

export interface ContentTeamManagementMembersQuery {
  memberId?: string
  startDate?: string
  endDate?: string
  sourceType?: string
  tasks?: ContentTeamManagementReassignTaskDto[]
}

export interface ContentTeamManagementMembersResponse {
  startDate?: string
  endDate?: string
  members: ContentTeamManagementMemberOptionDto[]
  cards: ContentTeamManagementMemberCardDto[]
}

export type ContentTeamManagementReassignmentMembersResponse =
  | ContentTeamManagementMembersResponse
  | ContentTeamManagementMemberOptionDto[]

export interface ContentTeamManagementEmergencyLeavePayload {
  leaveReasonCode: string
  expectedReturnDate?: string
  notes?: string
}

type ContentTeamManagementApiResult<T> = T | ApiResponse<T>

const getContentTeamManagementRequestConfig = (skipErrorMessage = false) => ({
  baseURL: CONTENT_TEAM_MANAGEMENT_BASE_URL || undefined,
  skipErrorMessage,
})

const isWrappedContentTeamManagementResponse = <T,>(
  response: ContentTeamManagementApiResult<T>
): response is ApiResponse<T> =>
  Boolean(
    response &&
      typeof response === "object" &&
      "isSuccess" in response &&
      "statusCode" in response &&
      "data" in response
  )

const unwrapContentTeamManagementResponse = <T,>(
  response: ContentTeamManagementApiResult<T>
): T => {
  if (isWrappedContentTeamManagementResponse(response)) {
    return (response.data ?? ({} as T)) as T
  }

  return response
}

export const getContentTeamManagementSummary = (
  params: ContentTeamManagementSummaryQuery
) =>
  request
    .get<
      ContentTeamManagementApiResult<ContentTeamManagementSummaryDto>,
      ContentTeamManagementApiResult<ContentTeamManagementSummaryDto>
    >(
      "/api/content/team-management/summary",
      params,
      getContentTeamManagementRequestConfig()
    )
    .then(unwrapContentTeamManagementResponse)

export const getContentTeamManagementMetadata = () =>
  request
    .get<
      ContentTeamManagementApiResult<ContentTeamManagementMetadataDto>,
      ContentTeamManagementApiResult<ContentTeamManagementMetadataDto>
    >(
      "/api/content/team-management/metadata",
      {},
      getContentTeamManagementRequestConfig()
    )
    .then(unwrapContentTeamManagementResponse)

export const queryContentTeamManagementTasks = (
  data: ContentTeamManagementTaskQueryPayload
) =>
  request
    .post<
      ContentTeamManagementApiResult<ContentTeamManagementTaskQueryResponse>,
      ContentTeamManagementApiResult<ContentTeamManagementTaskQueryResponse>
    >(
      "/api/content/team-management/tasks/query",
      data,
      getContentTeamManagementRequestConfig()
    )
    .then(unwrapContentTeamManagementResponse)

export const exportContentTeamManagementTasks = (
  data: ContentTeamManagementTaskQueryPayload
) =>
  request.post<Blob, Blob>(
    "/api/content/team-management/tasks/export",
    data,
    {
      ...getContentTeamManagementRequestConfig(),
      responseType: "blob",
    }
  )

export const reassignContentTeamManagementTasks = (
  data: ContentTeamManagementReassignPayload
) =>
  request.post(
    "/api/content/team-management/tasks/reassign",
    data,
    getContentTeamManagementRequestConfig()
  )

export const getContentTeamManagementMembers = (
  params: ContentTeamManagementMembersQuery
) =>
  request
    .get<
      ContentTeamManagementApiResult<ContentTeamManagementMembersResponse>,
      ContentTeamManagementApiResult<ContentTeamManagementMembersResponse>
    >(
      "/api/content/team-management/members",
      params,
      getContentTeamManagementRequestConfig()
    )
    .then(unwrapContentTeamManagementResponse)

export const getContentTeamManagementReassignmentMembers = (
  params: ContentTeamManagementMembersQuery
) => {
  if (params.tasks?.length) {
    return request
      .post<
        ContentTeamManagementApiResult<ContentTeamManagementReassignmentMembersResponse>,
        ContentTeamManagementApiResult<ContentTeamManagementReassignmentMembersResponse>
      >(
        "/api/content/team-management/members/reassignment/query",
        {
          sourceType: params.sourceType,
          tasks: params.tasks,
        },
        getContentTeamManagementRequestConfig()
      )
      .then(unwrapContentTeamManagementResponse)
  }

  return request
    .get<
      ContentTeamManagementApiResult<ContentTeamManagementReassignmentMembersResponse>,
      ContentTeamManagementApiResult<ContentTeamManagementReassignmentMembersResponse>
    >(
      "/api/content/team-management/members/reassignment",
      params,
      getContentTeamManagementRequestConfig()
    )
    .then(unwrapContentTeamManagementResponse)
}

export const markContentTeamManagementMemberEmergencyLeave = (
  userId: string,
  data: ContentTeamManagementEmergencyLeavePayload
) =>
  request.post(
    `/api/content/team-management/members/${userId}/emergency-leave`,
    data,
    getContentTeamManagementRequestConfig()
  )

export const resumeContentTeamManagementMemberWork = (userId: string) =>
  request.post(
    `/api/content/team-management/members/${userId}/resume-work`,
    {},
    getContentTeamManagementRequestConfig()
  )
