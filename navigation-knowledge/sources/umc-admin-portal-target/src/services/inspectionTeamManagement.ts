import request from "@/utils/request"
import {
  mapTaskUpsertPayload,
  type InspectionTaskUpsertPayload,
} from "./inspection"
import type { ApiResponse } from "./userManagement"

export type InspectionTeamManagementView = "todo" | "completed"

export type InspectionTeamManagementCategory =
  | "all"
  | "inspectionTasks"
  | "violations"
  | "appeals"
  | "enquiries"
  | "refunds"

export type InspectionTeamManagementTaskMode =
  | "inspectionTasks"
  | "otherTask"

export interface InspectionTeamManagementMetadataOptionDto {
  code?: string | null
  display?: string | null
}

export interface InspectionTeamManagementLocationOptionDto
  extends InspectionTeamManagementMetadataOptionDto {
  id: number
  parentId?: number | null
  nameEn?: string | null
  nameAr?: string | null
  emirateId?: number | null
  regionId?: number | null
  requiresRegion?: boolean | null
}

export interface InspectionTeamManagementGeographyDto {
  emirates?: InspectionTeamManagementLocationOptionDto[] | null
  regions?: InspectionTeamManagementLocationOptionDto[] | null
  areas?: InspectionTeamManagementLocationOptionDto[] | null
}

export interface InspectionTeamManagementMetadataDto {
  categories?: InspectionTeamManagementMetadataOptionDto[] | null
  statuses?: InspectionTeamManagementMetadataOptionDto[] | null
  todoStatuses?: InspectionTeamManagementMetadataOptionDto[] | null
  completedStatuses?: InspectionTeamManagementMetadataOptionDto[] | null
  otherTaskTodoStatuses?: InspectionTeamManagementMetadataOptionDto[] | null
  otherTaskCompletedStatuses?: InspectionTeamManagementMetadataOptionDto[] | null
  leaveReasons?: InspectionTeamManagementMetadataOptionDto[] | null
  reasons?: InspectionTeamManagementMetadataOptionDto[] | null
  assignedAreas?: InspectionTeamManagementMetadataOptionDto[] | null
  emirates?: InspectionTeamManagementMetadataOptionDto[] | null
  authorities?: InspectionTeamManagementMetadataOptionDto[] | null
  inspectionMethods?: InspectionTeamManagementMetadataOptionDto[] | null
  priorities?: InspectionTeamManagementMetadataOptionDto[] | null
  inspectors?: InspectionTeamManagementMetadataOptionDto[] | null
  createdByUsers?: InspectionTeamManagementMetadataOptionDto[] | null
  geography?: InspectionTeamManagementGeographyDto | null
}

export interface InspectionTeamManagementSummaryCategoryDto {
  category?: string | null
  categoryDisplay?: string | null
  todoCount?: number | null
  completedCount?: number | null
}

export interface InspectionTeamManagementSummaryStatusCardDto {
  code?: string | null
  display?: string | null
  count?: number | null
}

export interface InspectionTeamManagementSummaryDto {
  todoCount?: number | null
  completedCount?: number | null
  urgentCount?: number | null
  categories?: InspectionTeamManagementSummaryCategoryDto[] | null
  statusCards?: InspectionTeamManagementSummaryStatusCardDto[] | null
}

export interface InspectionTeamManagementTaskQueryPayload {
  view: InspectionTeamManagementView
  keyword?: string
  taskMode?: InspectionTeamManagementTaskMode
  category?: InspectionTeamManagementCategory
  status?: string
  reason?: string
  emirate?: string
  authority?: string
  areaId?: string
  inspectionMethod?: string
  priorityId?: string
  dueDateFrom?: string
  dueDateTo?: string
  assignedInspectorId?: string
  createdBy?: string
  assignedTimeFrom?: string
  assignedTimeTo?: string
  createdOnFrom?: string
  createdOnTo?: string
  memberId?: string
  lastUpdatedFrom?: string
  lastUpdatedTo?: string
  pageIndex?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: 0 | 1
}

export interface InspectionTeamManagementTaskSlaDto {
  remainingMinutes?: number | null
  displayText?: string | null
  isOverdue?: boolean | null
  dueOn?: string | null
}

export interface InspectionTeamManagementAssignedUserDto {
  userId?: string | null
  userName?: string | null
  isPrimary?: boolean | null
}

export interface InspectionTeamManagementTaskItemDto {
  sourceType?: string | null
  sourceId?: string | null
  userId?: string | null
  applyForUserTypeId?: string | number | null
  taskNo?: string | null
  taskId?: string | null
  taskCategory?: string | null
  taskCategoryCode?: string | null
  taskCategoryDisplay?: string | null
  applyFor?: string | null
  inspectionTarget?: string | null
  inspectionTargetName?: string | null
  inspectionTargetDisplay?: string | null
  inspectionReason?: string | null
  inspectionReasonCode?: string | null
  inspectionReasonDisplay?: string | null
  sla?: InspectionTeamManagementTaskSlaDto | null
  assignedToUserId?: string | null
  assignedTo?: string | null
  primaryAssignedUserId?: string | null
  primaryAssignedUserName?: string | null
  assignedToDisplay?: string | null
  assignedUserCount?: number | null
  assignedUsers?: InspectionTeamManagementAssignedUserDto[] | null
  status?: string | null
  statusId?: string | number | null
  statusCode?: string | null
  statusDisplay?: string | null
  statusDisplayOnly?: string | null
  priority?: string | null
  priorityCode?: string | null
  priorityDisplay?: string | null
  dueDate?: string | null
  emirate?: string | null
  emirateDisplay?: string | null
  authority?: string | null
  authorityDisplay?: string | null
  areaId?: number | null
  area?: string | null
  areaDisplay?: string | null
  assignedTime?: string | null
  assignedTimeDisplay?: string | null
  inspectionMethod?: string | null
  inspectionMethodCode?: string | null
  inspectionMethodDisplay?: string | null
  createdBy?: string | null
  createdByCode?: string | null
  createdByDisplay?: string | null
  lastUpdatedOn?: string | null
  isUrgent?: boolean | null
  canReassign?: boolean | null
  availableActions?: string[] | null
  detailTarget?: string | null
}

export interface InspectionTeamManagementTaskPageDto {
  data?: InspectionTeamManagementTaskItemDto[] | null
  items?: InspectionTeamManagementTaskItemDto[] | null
  total?: number | null
  pageIndex?: number | null
  pageSize?: number | null
}

export interface InspectionTeamManagementTaskQueryResponse {
  page?: InspectionTeamManagementTaskPageDto | null
}

export interface InspectionTeamManagementReassignTaskDto {
  sourceType: string
  sourceId: string
}

export interface InspectionTeamManagementAssignedUserPayload {
  userId: string
  isPrimary: boolean
}

export interface InspectionTeamManagementReassignPayload {
  tasks: InspectionTeamManagementReassignTaskDto[]
  assignedUsers: InspectionTeamManagementAssignedUserPayload[]
}

export interface InspectionTeamManagementMemberMetricsDto {
  completedTasks?: number | null
  totalAssignedTasks?: number | null
  avgProcessingTime?: number | null
  slaCompliance?: number | null
  overdueTasks?: number | null
}

export interface InspectionTeamManagementLeaveInfoDto {
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

export interface InspectionTeamManagementMemberCardDto {
  userId?: string | null
  userName?: string | null
  avatarUrl?: string | null
  isOnLeave?: boolean | null
  leaveInfo?: InspectionTeamManagementLeaveInfoDto | null
  assignedAreaCode?: string | null
  assignedAreaDisplay?: string | null
  assignedEmirateIds?: number[] | null
  assignedRegionIds?: number[] | null
  assignedAreaIds?: number[] | null
  todoTaskCount?: number | null
  metricsByCategory?: Record<
    string,
    InspectionTeamManagementMemberMetricsDto | undefined
  > | null
}

export interface InspectionTeamManagementMemberOptionDto {
  userId?: string | null
  userName?: string | null
}

export interface InspectionTeamManagementMembersQuery {
  memberId?: string
  startDate?: string
  endDate?: string
}

export interface InspectionTeamManagementMembersResponse {
  startDate?: string | null
  endDate?: string | null
  members?: InspectionTeamManagementMemberOptionDto[] | null
  cards?: InspectionTeamManagementMemberCardDto[] | null
}

export interface InspectionTeamManagementEmergencyLeavePayload {
  leaveReasonCode: string
  expectedReturnDate?: string
  notes?: string
}

export interface InspectionTeamManagementDuplicateTaskPayload {
  dueDate?: string
  copyAssignments?: boolean
}

export interface InspectionTeamManagementAssignedAreaNode {
  emirateId?: number | null
  regionId?: number | null
  communityId?: number | null
}

export interface InspectionTeamManagementAssignedAreaPayload {
  nodes: InspectionTeamManagementAssignedAreaNode[]
}

export interface InspectionTeamManagementAssignedAreaResponse {
  userId?: string | null
  areaDisplay?: string | null
  nodes?: InspectionTeamManagementAssignedAreaNode[] | null
  assignedEmirateIds?: number[] | null
  assignedRegionIds?: number[] | null
  assignedAreaIds?: number[] | null
  isAssigned?: boolean | null
}

type InspectionTeamManagementApiResult<T> = T | ApiResponse<T>

const getInspectionTeamManagementRequestConfig = (skipErrorMessage = false) => ({
  skipErrorMessage,
})

const isWrappedInspectionTeamManagementResponse = <T,>(
  response: InspectionTeamManagementApiResult<T>
): response is ApiResponse<T> =>
  Boolean(
    response &&
      typeof response === "object" &&
      "isSuccess" in response &&
      "statusCode" in response &&
      "data" in response
  )

const unwrapInspectionTeamManagementResponse = <T,>(
  response: InspectionTeamManagementApiResult<T>
): T => {
  if (isWrappedInspectionTeamManagementResponse(response)) {
    return (response.data ?? ({} as T)) as T
  }

  return response
}

const normalizeInspectionTeamManagementTaskQueryResponse = (
  response: InspectionTeamManagementTaskQueryResponse
) => {
  const page = response?.page || {}
  const data = Array.isArray(page?.data)
    ? page.data
    : Array.isArray(page?.items)
      ? page.items
      : []

  return {
    ...response,
    page: {
      ...page,
      data,
      items: data,
    },
  }
}

export const getInspectionTeamManagementSummary = () =>
  request
    .get<
      InspectionTeamManagementApiResult<InspectionTeamManagementSummaryDto>,
      InspectionTeamManagementApiResult<InspectionTeamManagementSummaryDto>
    >(
      "/api/inspection/team-management/summary",
      {},
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)

export const getInspectionTeamManagementMetadata = () =>
  request
    .get<
      InspectionTeamManagementApiResult<InspectionTeamManagementMetadataDto>,
      InspectionTeamManagementApiResult<InspectionTeamManagementMetadataDto>
    >(
      "/api/inspection/team-management/metadata",
      {},
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)

export const queryInspectionTeamManagementTasks = (
  data: InspectionTeamManagementTaskQueryPayload
) =>
  request
    .post<
      InspectionTeamManagementApiResult<InspectionTeamManagementTaskQueryResponse>,
      InspectionTeamManagementApiResult<InspectionTeamManagementTaskQueryResponse>
    >(
      "/api/inspection/team-management/tasks/query",
      data,
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)
    .then(normalizeInspectionTeamManagementTaskQueryResponse)

export const exportInspectionTeamManagementTasks = (
  data: InspectionTeamManagementTaskQueryPayload
) =>
  request.post<Blob, Blob>(
    "/api/inspection/team-management/tasks/export",
    data,
    {
      ...getInspectionTeamManagementRequestConfig(),
      responseType: "blob",
    }
  )

export const reassignInspectionTeamManagementTasks = (
  data: InspectionTeamManagementReassignPayload
) =>
  request.post(
    "/api/inspection/team-management/tasks/reassign",
    data,
    getInspectionTeamManagementRequestConfig()
  )

export const createInspectionTeamManagementTask = async (
  data: InspectionTaskUpsertPayload
) => {
  const payload = await mapTaskUpsertPayload(data)

  return request
    .post<
      InspectionTeamManagementApiResult<{ taskId?: number | string | null }>,
      InspectionTeamManagementApiResult<{ taskId?: number | string | null }>
    >(
      "/api/inspection/team-management/inspection-tasks",
      payload,
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)
}

export const editInspectionTeamManagementTask = async (
  taskId: string | number,
  data: InspectionTaskUpsertPayload
) => {
  const payload = await mapTaskUpsertPayload(data)

  return request
    .post<
      InspectionTeamManagementApiResult<{ updated?: boolean | null }>,
      InspectionTeamManagementApiResult<{ updated?: boolean | null }>
    >(
      `/api/inspection/team-management/inspection-tasks/${encodeURIComponent(
        String(taskId || "")
      )}/edit`,
      payload,
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)
}

export const duplicateInspectionTeamManagementTask = (
  taskId: string | number,
  data: InspectionTeamManagementDuplicateTaskPayload
) =>
  request
    .post<
      InspectionTeamManagementApiResult<{ taskId?: number | string | null }>,
      InspectionTeamManagementApiResult<{ taskId?: number | string | null }>
    >(
      `/api/inspection/team-management/inspection-tasks/${encodeURIComponent(
        String(taskId || "")
      )}/duplicate`,
      {
        dueDate: data?.dueDate,
        copyAssignments: data?.copyAssignments ?? true,
      },
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)

export const getInspectionTeamManagementMembers = (
  params: InspectionTeamManagementMembersQuery
) =>
  request
    .get<
      InspectionTeamManagementApiResult<InspectionTeamManagementMembersResponse>,
      InspectionTeamManagementApiResult<InspectionTeamManagementMembersResponse>
    >(
      "/api/inspection/team-management/members",
      params,
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)

export const markInspectionTeamManagementMemberEmergencyLeave = (
  userId: string,
  data: InspectionTeamManagementEmergencyLeavePayload
) =>
  request.post(
    `/api/inspection/team-management/members/${userId}/emergency-leave`,
    data,
    getInspectionTeamManagementRequestConfig()
  )

export const resumeInspectionTeamManagementMemberWork = (userId: string) =>
  request.post(
    `/api/inspection/team-management/members/${userId}/resume-work`,
    {},
    getInspectionTeamManagementRequestConfig()
  )

export const assignInspectionTeamManagementMemberArea = (
  userId: string,
  data: InspectionTeamManagementAssignedAreaPayload
) =>
  request
    .post<
      InspectionTeamManagementApiResult<InspectionTeamManagementAssignedAreaResponse>,
      InspectionTeamManagementApiResult<InspectionTeamManagementAssignedAreaResponse>
    >(
      `/api/inspection/team-management/members/${userId}/assigned-area`,
      data,
      getInspectionTeamManagementRequestConfig()
    )
    .then(unwrapInspectionTeamManagementResponse)
