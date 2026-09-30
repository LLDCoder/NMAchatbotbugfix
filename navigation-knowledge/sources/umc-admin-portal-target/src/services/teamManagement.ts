import moment from "moment"
import {
  applicationIsLeader,
  applicationMyTeamComplatedPage,
  applicationMyTeamMemberTask,
  applicationMyTeamTodoPage,
  applicationUrgentCount,
  assignTaskUser,
  exportMyCompletedReview,
  exportMyTodoReview,
  type IMembersTasksDto,
} from "./application"
import { getContentIsLeader } from "./content"
import {
  exportContentTeamManagementTasks,
  getContentTeamManagementMetadata,
  getContentTeamManagementMembers,
  getContentTeamManagementReassignmentMembers,
  getContentTeamManagementSummary,
  markContentTeamManagementMemberEmergencyLeave,
  queryContentTeamManagementTasks,
  reassignContentTeamManagementTasks,
  resumeContentTeamManagementMemberWork,
  type ContentTeamManagementCategory,
  type ContentTeamManagementMemberCardDto,
  type ContentTeamManagementMemberMetricsDto,
  type ContentTeamManagementMetadataOptionDto,
  type ContentTeamManagementMembersResponse,
  type ContentTeamManagementTaskItemDto,
  type ContentTeamManagementTaskQueryPayload,
} from "./contentTeamManagement"
import {
  exportCustomerHappinessTeamManagementTasks,
  getCustomerHappinessTeamManagementMetadata,
  getCustomerHappinessTeamManagementMembers,
  getCustomerHappinessTeamManagementReassignmentMembers,
  getCustomerHappinessTeamManagementSummary,
  markCustomerHappinessTeamManagementMemberEmergencyLeave,
  queryCustomerHappinessTeamManagementTasks,
  reassignCustomerHappinessTeamManagementTasks,
  resumeCustomerHappinessTeamManagementMemberWork,
  type CustomerHappinessTeamManagementCategory,
  type CustomerHappinessTeamManagementMemberCardDto,
  type CustomerHappinessTeamManagementMemberMetricsDto,
  type CustomerHappinessTeamManagementMetadataOptionDto,
  type CustomerHappinessTeamManagementMembersResponse,
  type CustomerHappinessTeamManagementTaskItemDto,
  type CustomerHappinessTeamManagementTaskQueryPayload,
} from "./customerHappinessTeamManagement"
import {
  exportLicensingTeamManagementTasks,
  getLicensingTeamManagementMetadata,
  getLicensingTeamManagementMembers,
  getLicensingTeamManagementReassignmentMembers,
  getLicensingTeamManagementSummary,
  markLicensingTeamManagementMemberEmergencyLeave,
  processLicensingTeamManagementProfileVerification,
  queryLicensingTeamManagementTasks,
  reassignLicensingTeamManagementTasks,
  resumeLicensingTeamManagementMemberWork,
  type LicensingTeamManagementCategory,
  type LicensingTeamManagementMemberCardDto,
  type LicensingTeamManagementMemberMetricsDto,
  type LicensingTeamManagementMetadataOptionDto,
  type LicensingTeamManagementMembersResponse,
  type LicensingTeamManagementProfileVerificationProcessPayload,
  type LicensingTeamManagementTaskItemDto,
  type LicensingTeamManagementTaskQueryPayload,
} from "./licensingTeamManagement"
import {
  exportInspectionTeamManagementTasks,
  getInspectionTeamManagementMetadata,
  getInspectionTeamManagementMembers,
  getInspectionTeamManagementSummary,
  markInspectionTeamManagementMemberEmergencyLeave,
  queryInspectionTeamManagementTasks,
  reassignInspectionTeamManagementTasks,
  resumeInspectionTeamManagementMemberWork,
  type InspectionTeamManagementCategory,
  type InspectionTeamManagementTaskMode,
  type InspectionTeamManagementMemberCardDto,
  type InspectionTeamManagementMemberMetricsDto,
  type InspectionTeamManagementMetadataOptionDto,
  type InspectionTeamManagementMembersResponse,
  type InspectionTeamManagementTaskItemDto,
  type InspectionTeamManagementTaskQueryPayload,
} from "./inspectionTeamManagement"
import {
  applicationMyTeamMemberLeave,
  applicationMyTeamMemberReturn,
  applicationMyTeamMembers,
  type ITeamTasksDto,
} from "./team"
import { getUserInfo } from "./tickets"
import { ImageBaseUrl } from "@/utils/url"

export type TeamManagementScope =
  | "licensing"
  | "content"
  | "customer"
  | "inspection"

export type TeamManagementAdapterMode = "default" | "legacyLicensing"

export type TeamTaskCategory =
  | "applications"
  | "profileVerifications"
  | "enquiries"
  | "refunds"
  | "appeals"
  | "inspectionTasks"
  | "violations"

export type TeamTaskTab = "todo" | "completed"

export type MemberMetricCategory =
  | "all"
  | "applications"
  | "profileVerification"
  | "enquiries"
  | "appeals"
  | "refunds"
  | "inspectionTasks"
  | "violations"

const normalizeTeamManagementAvatarUrl = (value?: string | null) => {
  const raw = String(value ?? "").trim()

  if (!raw) {
    return null
  }

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw
  }

  if (raw.startsWith(ImageBaseUrl)) {
    return raw
  }

  // P8 Plan A: images served same-origin through the gateway (relative paths).
  const imageBaseUrl = ""

  if (raw.startsWith("/api/Document/Dowload")) {
    return imageBaseUrl ? `${imageBaseUrl}${raw}` : raw
  }

  if (raw.startsWith("/")) {
    return raw
  }

  return `${ImageBaseUrl}${raw}`
}

export interface TeamManagementSummaryParams {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  applicationTaskOnly?: boolean
}

export interface TeamManagementSummary {
  todoCount: number
  completedCount: number
  applicationsCount: number
  profileVerificationsCount: number
  enquiriesCount: number
  refundsCount: number
  appealsCount: number
  inspectionTasksCount: number
  violationsCount: number
  urgentCount: number
  categoryLabels?: Partial<Record<TeamTaskCategory, string>>
  categoryOptions?: TeamManagementOption[]
}

export interface TeamManagementTaskPageParams {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  taskTab: TeamTaskTab
  taskSourceKey?: string
  applicationTaskOnly?: boolean
  keyword?: string
  category?: TeamTaskCategory
  status?: string
  memberId?: string
  startTime?: string | null
  endTime?: string | null
  pageIndex?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: 0 | 1
}

export interface TeamManagementTaskItem {
  taskId: string
  sourceType?: string | null
  sourceId?: string | null
  userId?: string | null
  userTypeCode?: string | null
  applyForUserTypeId?: string | null
  assignedToUserId?: string | null
  taskNo: string
  taskCategory: TeamTaskCategory
  taskCategoryLabel?: string | null
  applyFor: string
  assignedTo: string
  status: string
  statusId?: string | null
  statusCode?: string | null
  statusLabel?: string | null
  statusDisplayOnly?: string | null
  lastUpdated: string
  slaDisplay?: string | null
  slaSortValue?: number | null
  slaRemainingMinutes?: number | null
  slaDueOn?: string | null
  slaIsOverdue?: boolean
  isUrgent?: boolean
  isOverdue?: boolean
  canReassign?: boolean
  profileIsVIP?: boolean
  detailTarget?: string | null
  detailRoutePath?: string | null
  detailRouteQuery?: Record<string, string | number | boolean | null | undefined>
}

export interface TeamManagementTaskPageResponse {
  page: {
    items: TeamManagementTaskItem[]
    pageIndex: number
    pageSize: number
    total: number
  }
  statusOptions: TeamManagementOption[]
}

export interface TeamManagementOption {
  label: string
  value: string
}

export interface TeamManagementTaskFilterOptions {
  categoryOptions: TeamManagementOption[]
  statusOptions: TeamManagementOption[]
  todoStatusOptions: TeamManagementOption[]
  completedStatusOptions: TeamManagementOption[]
}

export type TeamManagementExportParams = Omit<
  TeamManagementTaskPageParams,
  "pageIndex" | "pageSize" | "sortBy" | "sortDirection"
>

export interface TeamManagementMemberCardsParams {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  memberId?: string
  startTime?: string | null
  endTime?: string | null
  memberMetricCategory?: MemberMetricCategory
}

export interface TeamManagementMembersPanelDataParams {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  memberId?: string
  startTime?: string | null
  endTime?: string | null
}

export interface TeamManagementMemberMetrics {
  completedCount: number
  totalAssignedCount: number
  averageProcessingMinutes: number | null
  slaComplianceRate: number | null
  overdueTasksCount: number
}

export type TeamManagementMemberMetricsByCategory =
  Partial<Record<MemberMetricCategory, TeamManagementMemberMetrics>>

export type AssignedAreaStatus = 'unassigned' | 'assigned' | 'partial'

export interface TeamManagementAssignedAreaSelection {
  emirateIds: number[]
  regionIds: number[]
  areaIds: number[]
}

export interface TeamManagementMemberCard {
  memberId: string
  memberName: string
  avatarUrl?: string | null
  todoTaskCount: number
  isLeave: boolean
  leaveReason?: string | null
  leaveNotes?: string | null
  leaveCreatedOn?: string | null
  expectedReturnDate?: string | null
  assignedArea?: string | null
  assignedAreaStatus?: AssignedAreaStatus
  assignedAreaSelection?: TeamManagementAssignedAreaSelection
  metrics: TeamManagementMemberMetrics
  metricsByCategory?: TeamManagementMemberMetricsByCategory
}

export interface TeamManagementMemberOption {
  label: string
  value: string
}

export interface TeamManagementMembersPanelData {
  members: TeamManagementMemberOption[]
  cards: TeamManagementMemberCard[]
}

export interface TeamManagementScopedParams {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
}

export interface TeamManagementTaskFilterOptionsParams
  extends TeamManagementScopedParams {
  taskTab: TeamTaskTab
  taskSourceKey?: string
}

export interface TeamManagementMemberOptionsParams {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  assignableOnly?: boolean
  purpose?: "default" | "reassignment"
  sourceType?: string
  tasks?: TeamManagementReassignTask[]
}

export interface TeamManagementReassignTask {
  sourceType: string
  sourceId: string
}

export interface TeamManagementReassignPayload {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  memberId?: string
  assignedUserId?: string
  taskIds?: string[]
  tasks?: TeamManagementReassignTask[]
}

export interface TeamManagementMarkLeavePayload {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  memberId: string
  leaveType: string
  expectedReturnDate?: string
  briefDescription?: string
}

export interface TeamManagementResumeWorkPayload {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  memberId: string
}

export interface TeamManagementProcessProfileVerificationParams {
  scope: TeamManagementScope
  adapterMode?: TeamManagementAdapterMode
  profileId: number
  payload: LicensingTeamManagementProfileVerificationProcessPayload
}

export interface TeamManagementPermissionConfig {
  routePath: string
  export?: string
  reassign?: string
  confirmReassign?: string
  confirmMarkEmergencyLeave?: string
  resumeWork?: string
}

export interface TeamManagementCapabilities {
  supportsApplicationTaskOnly: boolean
  applicationTaskOnlyLocked: boolean
  defaultApplicationTaskOnly: boolean
  manualReassignSelection: boolean
  allowTaskExport: boolean
  allowTaskReassign: boolean
  allowTaskCreate: boolean
  allowMemberLeaveActions: boolean
  allowAssignedAreaActions: boolean
}

export interface TeamManagementScopeMeta {
  permissions: TeamManagementPermissionConfig
  capabilities: TeamManagementCapabilities
  supportedTaskCategories: TeamTaskCategory[]
  supportedMemberMetricCategories: MemberMetricCategory[]
}

interface TeamManagementScopeAdapter extends TeamManagementScopeMeta {
  checkAccess: () => Promise<boolean>
  getSummary: (
    params: TeamManagementSummaryParams
  ) => Promise<TeamManagementSummary>
  getTaskPage: (
    params: TeamManagementTaskPageParams
  ) => Promise<TeamManagementTaskPageResponse>
  exportTasks: (params: TeamManagementExportParams) => Promise<Blob | string>
  getMemberCards: (
    params: TeamManagementMemberCardsParams
  ) => Promise<TeamManagementMemberCard[]>
  getMembersPanelData: (
    params: TeamManagementMembersPanelDataParams
  ) => Promise<TeamManagementMembersPanelData>
  getTaskFilterOptions: (
    params: TeamManagementTaskFilterOptionsParams
  ) => Promise<TeamManagementTaskFilterOptions>
  getMemberOptions: (
    params: TeamManagementMemberOptionsParams
  ) => Promise<TeamManagementMemberOption[]>
  getLeaveReasonOptions: () => Promise<TeamManagementOption[]>
  reassignTasks: (payload: TeamManagementReassignPayload) => Promise<unknown>
  markEmergencyLeave: (
    payload: TeamManagementMarkLeavePayload
  ) => Promise<unknown>
  resumeWork: (payload: TeamManagementResumeWorkPayload) => Promise<unknown>
}

const DEFAULT_TEAM_TASK_PAGE = {
  items: [],
  pageIndex: 1,
  pageSize: 10,
  total: 0,
}

const DEFAULT_MEMBER_METRICS: TeamManagementMemberMetrics = {
  completedCount: 0,
  totalAssignedCount: 0,
  averageProcessingMinutes: null,
  slaComplianceRate: null,
  overdueTasksCount: 0,
}

const syncTeamManagementMemberCardNames = (
  cards: TeamManagementMemberCard[],
  members: TeamManagementMemberOption[]
) => {
  const memberNameById = new Map(
    members
      .filter((item) => item.value)
      .map((item) => [item.value, item.label])
  )

  return cards.map((item) => {
    const nextMemberName = memberNameById.get(item.memberId)

    if (!nextMemberName) {
      return item
    }

    return {
      ...item,
      memberName: nextMemberName,
    }
  })
}

const LEGACY_SUPPORTED_MEMBER_CATEGORIES = new Set<MemberMetricCategory>([
  "all",
  "applications",
])

const FULL_TEAM_TASK_CATEGORIES: TeamTaskCategory[] = [
  "applications",
  "profileVerifications",
  "enquiries",
  "refunds",
  "appeals",
]

const INSPECTION_TEAM_TASK_CATEGORIES: TeamTaskCategory[] = [
  "inspectionTasks",
  "violations",
  "enquiries",
  "refunds",
  "appeals",
]

const CONTENT_TEAM_TASK_CATEGORIES: TeamTaskCategory[] = [
  "applications",
  "enquiries",
  "refunds",
  "appeals",
]

const CUSTOMER_HAPPINESS_TEAM_TASK_CATEGORIES: TeamTaskCategory[] = [
  "enquiries",
  "refunds",
  "appeals",
]

const FULL_MEMBER_METRIC_CATEGORIES: MemberMetricCategory[] = [
  "all",
  "applications",
  "profileVerification",
  "enquiries",
  "appeals",
  "refunds",
]

const CONTENT_MEMBER_METRIC_CATEGORIES: MemberMetricCategory[] = [
  "all",
  "applications",
  "enquiries",
  "appeals",
  "refunds",
]

const CUSTOMER_HAPPINESS_MEMBER_METRIC_CATEGORIES: MemberMetricCategory[] = [
  "all",
  "enquiries",
  "appeals",
  "refunds",
]

const INSPECTION_MEMBER_METRIC_CATEGORIES: MemberMetricCategory[] = [
  "all",
  "inspectionTasks",
  "enquiries",
  "appeals",
  "refunds",
]

const LEGACY_MEMBER_METRIC_CATEGORIES: MemberMetricCategory[] = [
  "all",
  "applications",
]

const LEGACY_TEAM_MANAGEMENT_CAPABILITIES: TeamManagementCapabilities = {
  supportsApplicationTaskOnly: true,
  applicationTaskOnlyLocked: true,
  defaultApplicationTaskOnly: true,
  manualReassignSelection: true,
  allowTaskExport: true,
  allowTaskReassign: true,
  allowTaskCreate: true,
  allowMemberLeaveActions: true,
  allowAssignedAreaActions: true,
}

const LICENSING_TEAM_MANAGEMENT_PERMISSIONS: TeamManagementPermissionConfig = {
  routePath: "/licensing/team-management",
  export: "Licensing.TeamManagement.Export",
  reassign: "Licensing.TeamManagement.Reassign",
  confirmReassign: "Licensing.TeamManagement.ConfirmReassignTasksModal",
  confirmMarkEmergencyLeave:
    "Licensing.TeamManagement.ConfirmMarkEmergencyLeaveModal",
  resumeWork: "Licensing.TeamManagement.ConfirmResumeWorkModal",
}

const LICENSING_TEAM_MANAGEMENT_CAPABILITIES: TeamManagementCapabilities = {
  supportsApplicationTaskOnly: true,
  applicationTaskOnlyLocked: false,
  defaultApplicationTaskOnly: true,
  manualReassignSelection: true,
  allowTaskExport: true,
  allowTaskReassign: true,
  allowTaskCreate: true,
  allowMemberLeaveActions: true,
  allowAssignedAreaActions: true,
}

const CONTENT_TEAM_MANAGEMENT_PERMISSIONS: TeamManagementPermissionConfig = {
  routePath: "/content/team-management",
  reassign: "Content.TeamManagement.Reassign",
  confirmReassign: "Content.TeamManagement.ConfirmReassignTasksModal",
  confirmMarkEmergencyLeave: "Content.TeamManagement.ConfirmMarkEmergencyLeaveModal",
  resumeWork: "Content.TeamManagement.ConfirmResumeWorkModal",
}

const CONTENT_TEAM_MANAGEMENT_CAPABILITIES: TeamManagementCapabilities = {
  supportsApplicationTaskOnly: true,
  applicationTaskOnlyLocked: false,
  defaultApplicationTaskOnly: true,
  manualReassignSelection: true,
  allowTaskExport: true,
  allowTaskReassign: true,
  allowTaskCreate: true,
  allowMemberLeaveActions: true,
  allowAssignedAreaActions: true,
}

const CUSTOMER_HAPPINESS_TEAM_MANAGEMENT_PERMISSIONS: TeamManagementPermissionConfig =
  {
    routePath: "/happiness/team-management",
    export: "CustomerModule.TeamManagement.Export",
    reassign: "CustomerModule.TeamManagement.Reassign",
    confirmReassign: "CustomerModule.TeamManagement.ConfirmReassignTasksModal",
    confirmMarkEmergencyLeave:
      "CustomerModule.TeamManagement.ConfirmMarkEmergencyLeaveModal",
    resumeWork: "CustomerModule.TeamManagement.ConfirmResumeWorkModal",
  }

const CUSTOMER_HAPPINESS_TEAM_MANAGEMENT_CAPABILITIES: TeamManagementCapabilities =
  {
    supportsApplicationTaskOnly: false,
    applicationTaskOnlyLocked: true,
    defaultApplicationTaskOnly: false,
    manualReassignSelection: true,
    allowTaskExport: true,
    allowTaskReassign: true,
    allowTaskCreate: true,
    allowMemberLeaveActions: true,
    allowAssignedAreaActions: true,
  }

const INSPECTION_TEAM_MANAGEMENT_PERMISSIONS: TeamManagementPermissionConfig = {
  routePath: "/inspection/tasks",
}

const INSPECTION_TEAM_MANAGEMENT_CAPABILITIES: TeamManagementCapabilities = {
  supportsApplicationTaskOnly: false,
  applicationTaskOnlyLocked: true,
  defaultApplicationTaskOnly: false,
  manualReassignSelection: true,
  allowTaskExport: true,
  allowTaskReassign: true,
  allowTaskCreate: true,
  allowMemberLeaveActions: true,
  allowAssignedAreaActions: true,
}

const LEGACY_TEAM_MANAGEMENT_SUPPORTED_CATEGORIES: TeamTaskCategory[] = [
  "applications",
]

const checkLicensingTeamManagementAccess = async () => {
  const response = await applicationIsLeader()
  return Boolean(response?.data)
}

const checkContentTeamManagementAccess = async () => {
  const response = await getContentIsLeader()
  return Boolean(response?.data)
}

const checkCustomerTeamManagementAccess = async () => {
  const response = await getUserInfo()
  return Boolean(response?.data?.isLeader)
}

const checkInspectionTeamManagementAccess = async () => true

const getLicensingBackedTeamManagementSummary = async (
  params: TeamManagementSummaryParams
) => {
  const response = await getLicensingTeamManagementSummary({
    applicationTaskOnly: params.applicationTaskOnly,
  })

  const categories = Array.isArray(response?.categories)
    ? response.categories
    : []

  const categoryCounts = {
    applicationsCount: 0,
    profileVerificationsCount: 0,
    enquiriesCount: 0,
    refundsCount: 0,
    appealsCount: 0,
    inspectionTasksCount: 0,
    violationsCount: 0,
  }
  const categoryLabels: Partial<Record<TeamTaskCategory, string>> = {}
  const categoryOptions: TeamManagementOption[] = []

  categories.forEach((item) => {
    const count = Number(item?.todoCount ?? 0)
    switch (item?.category) {
      case "applications":
        categoryCounts.applicationsCount = count
        if (item?.categoryDisplay) {
          categoryLabels.applications = item.categoryDisplay
        }
        categoryOptions.push({
          label: String(item?.categoryDisplay || item?.category || "applications"),
          value: "applications",
        })
        break
      case "profileVerifications":
        categoryCounts.profileVerificationsCount = count
        if (item?.categoryDisplay) {
          categoryLabels.profileVerifications = item.categoryDisplay
        }
        categoryOptions.push({
          label: String(
            item?.categoryDisplay || item?.category || "profileVerifications"
          ),
          value: "profileVerifications",
        })
        break
      case "enquiries":
        categoryCounts.enquiriesCount = count
        if (item?.categoryDisplay) {
          categoryLabels.enquiries = item.categoryDisplay
        }
        categoryOptions.push({
          label: String(item?.categoryDisplay || item?.category || "enquiries"),
          value: "enquiries",
        })
        break
      case "refunds":
        categoryCounts.refundsCount = count
        if (item?.categoryDisplay) {
          categoryLabels.refunds = item.categoryDisplay
        }
        categoryOptions.push({
          label: String(item?.categoryDisplay || item?.category || "refunds"),
          value: "refunds",
        })
        break
      case "appeals":
        categoryCounts.appealsCount = count
        if (item?.categoryDisplay) {
          categoryLabels.appeals = item.categoryDisplay
        }
        categoryOptions.push({
          label: String(item?.categoryDisplay || item?.category || "appeals"),
          value: "appeals",
        })
        break
      default:
        break
    }
  })

  return {
    todoCount: Number(response?.todoCount ?? 0),
    completedCount: Number(response?.completedCount ?? 0),
    urgentCount: Number(response?.urgentCount ?? 0),
    categoryLabels,
    categoryOptions,
    ...categoryCounts,
  }
}

const getContentBackedTeamManagementSummary = async (
  params: TeamManagementSummaryParams
) => {
  const response = await getContentTeamManagementSummary({
    applicationTaskOnly: params.applicationTaskOnly,
  })

  return normalizeApiTeamManagementSummary(response)
}

const getCustomerHappinessBackedTeamManagementSummary = async () => {
  const response = await getCustomerHappinessTeamManagementSummary()

  return normalizeApiTeamManagementSummary(response)
}

const getInspectionBackedTeamManagementSummary = async () => {
  const response = await getInspectionTeamManagementSummary()

  return normalizeApiTeamManagementSummary(response)
}

const getLegacyTeamManagementSummary = async () => {
  const [urgentResponse, taskResponse] = await Promise.all([
    applicationUrgentCount(),
    applicationMyTeamTodoPage({
      pageIndex: 1,
      pageSize: 1,
      sortBy: "submissionTime",
      sortDirection: 1,
    }),
  ])
  const todoCount =
    Number(taskResponse?.data?.statusCount?.todoCount) ||
    Number(taskResponse?.data?.page?.total) ||
    0

  return {
    todoCount,
    completedCount: 0,
    applicationsCount: todoCount,
    profileVerificationsCount: 0,
    enquiriesCount: 0,
    refundsCount: 0,
    appealsCount: 0,
    inspectionTasksCount: 0,
    violationsCount: 0,
    urgentCount: Number(urgentResponse?.data ?? 0),
  }
}

const getLicensingBackedTeamManagementTaskPage = async (
  params: TeamManagementTaskPageParams
) => {
  const response = await queryLicensingTeamManagementTasks(
    buildLicensingTaskQueryPayload(params)
  )
  const page = response?.page || DEFAULT_TEAM_TASK_PAGE
  const items = Array.isArray(page.items)
    ? page.items.map(normalizeLicensingTaskItem)
    : []

  return {
    page: {
      items,
      pageIndex: page.pageIndex ?? DEFAULT_TEAM_TASK_PAGE.pageIndex,
      pageSize: page.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize,
      total: page.total ?? DEFAULT_TEAM_TASK_PAGE.total,
    },
    statusOptions: buildUniqueStatusOptions(items),
  }
}

const getContentBackedTeamManagementTaskPage = async (
  params: TeamManagementTaskPageParams
) => {
  const response = await queryContentTeamManagementTasks(
    buildContentTaskQueryPayload(params)
  )
  const page = response?.page || DEFAULT_TEAM_TASK_PAGE
  const items = Array.isArray(page.items)
    ? page.items.map(normalizeContentTaskItem)
    : []

  return {
    page: {
      items,
      pageIndex: page.pageIndex ?? DEFAULT_TEAM_TASK_PAGE.pageIndex,
      pageSize: page.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize,
      total: page.total ?? DEFAULT_TEAM_TASK_PAGE.total,
    },
    statusOptions: buildUniqueStatusOptions(items),
  }
}

const getCustomerHappinessBackedTeamManagementTaskPage = async (
  params: TeamManagementTaskPageParams
) => {
  const response = await queryCustomerHappinessTeamManagementTasks(
    buildCustomerHappinessTaskQueryPayload(params)
  )
  const page = response?.page || DEFAULT_TEAM_TASK_PAGE
  const items = Array.isArray(page.items)
    ? page.items.map(normalizeCustomerHappinessTaskItem)
    : []

  return {
    page: {
      items,
      pageIndex: page.pageIndex ?? DEFAULT_TEAM_TASK_PAGE.pageIndex,
      pageSize: page.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize,
      total: page.total ?? DEFAULT_TEAM_TASK_PAGE.total,
    },
    statusOptions: buildUniqueStatusOptions(items),
  }
}

const getInspectionBackedTeamManagementTaskPage = async (
  params: TeamManagementTaskPageParams
) => {
  const response = await queryInspectionTeamManagementTasks(
    buildInspectionTaskQueryPayload(params)
  )
  const page = response?.page || DEFAULT_TEAM_TASK_PAGE
  const items = Array.isArray(page.items)
    ? page.items.map(normalizeInspectionTaskItem)
    : []

  return {
    page: {
      items,
      pageIndex: page.pageIndex ?? DEFAULT_TEAM_TASK_PAGE.pageIndex,
      pageSize: page.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize,
      total: page.total ?? DEFAULT_TEAM_TASK_PAGE.total,
    },
    statusOptions: buildUniqueStatusOptions(items),
  }
}

const getLegacyTeamManagementTaskPage = async (
  params: TeamManagementTaskPageParams
) => {
  const response =
    params.taskTab === "completed"
      ? await applicationMyTeamComplatedPage(buildLegacyTaskRequestParams(params))
      : await applicationMyTeamTodoPage(buildLegacyTaskRequestParams(params))

  return normalizeLegacyTaskPageResponse(response)
}

const exportLicensingBackedTeamManagementTasks = async (
  params: TeamManagementExportParams
) =>
  exportLicensingTeamManagementTasks(buildLicensingTaskQueryPayload(params))

const exportContentBackedTeamManagementTasks = async (
  params: TeamManagementExportParams
) => exportContentTeamManagementTasks(buildContentTaskQueryPayload(params))

const exportCustomerHappinessBackedTeamManagementTasks = async (
  params: TeamManagementExportParams
) =>
  exportCustomerHappinessTeamManagementTasks(
    buildCustomerHappinessTaskQueryPayload(params)
  )

const exportInspectionBackedTeamManagementTasks = async (
  params: TeamManagementExportParams
) => exportInspectionTeamManagementTasks(buildInspectionTaskQueryPayload(params))

const exportLegacyTeamManagementTasks = async (
  params: TeamManagementExportParams
) => {
  const requestParams = {
    keyword: params.keyword || undefined,
    userId: params.memberId || undefined,
    processInstanceStatus: params.status || undefined,
    startTime: params.startTime ?? null,
    endTime: params.endTime ?? null,
  }

  return ((params.taskTab === "completed"
    ? exportMyCompletedReview(requestParams)
    : exportMyTodoReview(requestParams)) as unknown) as Promise<Blob | string>
}

const getLicensingBackedTeamManagementMemberCards = async (
  params: TeamManagementMemberCardsParams
) => {
  const response = await getLicensingTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatLicensingMemberDate(params.startTime),
    endDate: formatLicensingMemberDate(params.endTime),
  })

  return normalizeLicensingMemberCards(response, params.memberMetricCategory)
}

const getLicensingBackedTeamManagementMembersPanelData = async (
  params: TeamManagementMembersPanelDataParams
): Promise<TeamManagementMembersPanelData> => {
  const response = await getLicensingTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatLicensingMemberDate(params.startTime),
    endDate: formatLicensingMemberDate(params.endTime),
  })

  const members = normalizeLicensingTeamManagementMemberOptions(response?.members)
  const cards = syncTeamManagementMemberCardNames(
    normalizeLicensingMemberCards(response),
    members
  )

  return {
    members,
    cards,
  }
}

const getContentBackedTeamManagementMemberCards = async (
  params: TeamManagementMemberCardsParams
) => {
  const response = await getContentTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatTeamManagementMemberDate(params.startTime),
    endDate: formatTeamManagementMemberDate(params.endTime),
  })

  return normalizeContentMemberCards(response, params.memberMetricCategory)
}

const getContentBackedTeamManagementMembersPanelData = async (
  params: TeamManagementMembersPanelDataParams
): Promise<TeamManagementMembersPanelData> => {
  const response = await getContentTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatTeamManagementMemberDate(params.startTime),
    endDate: formatTeamManagementMemberDate(params.endTime),
  })

  const members = normalizeContentTeamManagementMemberOptions(response?.members)
  const cards = syncTeamManagementMemberCardNames(
    normalizeContentMemberCards(response),
    members
  )

  return {
    members,
    cards,
  }
}

const getCustomerHappinessBackedTeamManagementMemberCards = async (
  params: TeamManagementMemberCardsParams
) => {
  const response = await getCustomerHappinessTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatTeamManagementMemberDate(params.startTime),
    endDate: formatTeamManagementMemberDate(params.endTime),
  })

  return normalizeCustomerHappinessMemberCards(
    response,
    params.memberMetricCategory
  )
}

const getCustomerHappinessBackedTeamManagementMembersPanelData = async (
  params: TeamManagementMembersPanelDataParams
): Promise<TeamManagementMembersPanelData> => {
  const response = await getCustomerHappinessTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatTeamManagementMemberDate(params.startTime),
    endDate: formatTeamManagementMemberDate(params.endTime),
  })

  const members = normalizeCustomerHappinessTeamManagementMemberOptions(
    response?.members
  )
  const cards = syncTeamManagementMemberCardNames(
    normalizeCustomerHappinessMemberCards(response),
    members
  )

  return {
    members,
    cards,
  }
}

const getInspectionBackedTeamManagementMemberCards = async (
  params: TeamManagementMemberCardsParams
) => {
  const response = await getInspectionTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatTeamManagementMemberDate(params.startTime),
    endDate: formatTeamManagementMemberDate(params.endTime),
  })

  return normalizeInspectionMemberCards(response, params.memberMetricCategory)
}

const getInspectionBackedTeamManagementMembersPanelData = async (
  params: TeamManagementMembersPanelDataParams
): Promise<TeamManagementMembersPanelData> => {
  const response = await getInspectionTeamManagementMembers({
    memberId: params.memberId || undefined,
    startDate: formatTeamManagementMemberDate(params.startTime),
    endDate: formatTeamManagementMemberDate(params.endTime),
  })

  const members = normalizeInspectionTeamManagementMemberOptions(response?.members)
  const cards = syncTeamManagementMemberCardNames(
    normalizeInspectionMemberCards(response),
    members
  )

  return {
    members,
    cards,
  }
}

const buildTeamManagementTaskFilterOptions = (
  categoryOptions: TeamManagementOption[],
  todoStatusOptions: TeamManagementOption[],
  completedStatusOptions: TeamManagementOption[],
  taskTab: TeamTaskTab
): TeamManagementTaskFilterOptions => ({
  categoryOptions,
  statusOptions:
    taskTab === "completed"
      ? completedStatusOptions
      : todoStatusOptions,
  todoStatusOptions,
  completedStatusOptions,
})

const getLicensingBackedTeamManagementTaskFilterOptions = async (
  params: TeamManagementTaskFilterOptionsParams
): Promise<TeamManagementTaskFilterOptions> => {
  const response = await getLicensingTeamManagementMetadata()
  const categoryOptions = normalizeLicensingCategoryMetadataOptions(
    response?.categories
  )
  const todoStatusOptions = normalizeLicensingMetadataOptions(
    response?.todoStatuses
  )
  const completedStatusOptions = normalizeLicensingMetadataOptions(
    response?.completedStatuses
  )

  return buildTeamManagementTaskFilterOptions(
    categoryOptions,
    todoStatusOptions,
    completedStatusOptions,
    params.taskTab
  )
}

const getContentBackedTeamManagementTaskFilterOptions = async (
  params: TeamManagementTaskFilterOptionsParams
): Promise<TeamManagementTaskFilterOptions> => {
  const response = await getContentTeamManagementMetadata()
  const categoryOptions = normalizeContentCategoryMetadataOptions(
    response?.categories
  )
  const todoStatusOptions = normalizeContentMetadataOptions(
    response?.todoStatuses
  )
  const completedStatusOptions = normalizeContentMetadataOptions(
    response?.completedStatuses
  )

  return buildTeamManagementTaskFilterOptions(
    categoryOptions,
    todoStatusOptions,
    completedStatusOptions,
    params.taskTab
  )
}

const getCustomerHappinessBackedTeamManagementTaskFilterOptions = async (
  params: TeamManagementTaskFilterOptionsParams
): Promise<TeamManagementTaskFilterOptions> => {
  const response = await getCustomerHappinessTeamManagementMetadata()
  const categoryOptions =
    normalizeCustomerHappinessCategoryMetadataOptions(
      response?.categories
    )
  const todoStatusOptions = normalizeCustomerHappinessMetadataOptions(
    response?.todoStatuses
  )
  const completedStatusOptions =
    normalizeCustomerHappinessMetadataOptions(
      response?.completedStatuses
    )

  return buildTeamManagementTaskFilterOptions(
    categoryOptions,
    todoStatusOptions,
    completedStatusOptions,
    params.taskTab
  )
}

const getInspectionBackedTeamManagementTaskFilterOptions = async (
  params: TeamManagementTaskFilterOptionsParams
): Promise<TeamManagementTaskFilterOptions> => {
  const response = await getInspectionTeamManagementMetadata()
  const categoryOptions = normalizeInspectionCategoryMetadataOptions(
    response?.categories
  )
  const isOtherTaskSource =
    String(params.taskSourceKey || "").trim() === "other"
  const todoStatusOptions = normalizeInspectionMetadataOptions(
    isOtherTaskSource
      ? response?.otherTaskTodoStatuses ||
          response?.todoStatuses ||
          response?.statuses
      : response?.todoStatuses || response?.statuses
  )
  const completedStatusOptions = normalizeInspectionMetadataOptions(
    isOtherTaskSource
      ? response?.otherTaskCompletedStatuses ||
          response?.completedStatuses ||
          response?.statuses
      : response?.completedStatuses || response?.statuses
  )

  return buildTeamManagementTaskFilterOptions(
    categoryOptions,
    todoStatusOptions,
    completedStatusOptions,
    params.taskTab
  )
}

const getLicensingBackedTeamManagementLeaveReasonOptions = async (): Promise<TeamManagementOption[]> => {
  const response = await getLicensingTeamManagementMetadata()
  return normalizeLicensingMetadataOptions(response?.leaveReasons)
}

const getContentBackedTeamManagementLeaveReasonOptions = async (): Promise<TeamManagementOption[]> => {
  const response = await getContentTeamManagementMetadata()
  return normalizeContentMetadataOptions(response?.leaveReasons)
}

const getCustomerHappinessBackedTeamManagementLeaveReasonOptions = async (): Promise<TeamManagementOption[]> => {
  const response = await getCustomerHappinessTeamManagementMetadata()
  return normalizeCustomerHappinessMetadataOptions(response?.leaveReasons)
}

const getInspectionBackedTeamManagementLeaveReasonOptions = async (): Promise<TeamManagementOption[]> => {
  const response = await getInspectionTeamManagementMetadata()
  return normalizeInspectionMetadataOptions(response?.leaveReasons)
}

const getLegacyTeamManagementMemberCards = async (
  params: TeamManagementMemberCardsParams
) => {
  const response = await applicationMyTeamMemberTask({
    memberId: params.memberId || undefined,
    startTime: params.startTime ?? null,
    endTime: params.endTime ?? null,
  })
  const supportsMetrics =
    !params.memberMetricCategory ||
    LEGACY_SUPPORTED_MEMBER_CATEGORIES.has(params.memberMetricCategory)

  return (response?.data || []).map((item: IMembersTasksDto) =>
    normalizeLegacyMemberCard(item, supportsMetrics)
  )
}

const getLegacyTeamManagementMembersPanelData = async (
  params: TeamManagementMembersPanelDataParams
): Promise<TeamManagementMembersPanelData> => {
  const [members, cards] = await Promise.all([
    getLegacyTeamManagementMemberOptions({
      scope: params.scope,
      adapterMode: params.adapterMode,
    }),
    getLegacyTeamManagementMemberCards({
      scope: params.scope,
      adapterMode: params.adapterMode,
      memberId: params.memberId,
      startTime: params.startTime,
      endTime: params.endTime,
      memberMetricCategory: "all",
    }),
  ])

  return {
    members,
    cards,
  }
}

const getLicensingBackedTeamManagementMemberOptions = async (
  params: TeamManagementMemberOptionsParams
) => {
  const response =
    params.purpose === "reassignment"
      ? await getLicensingTeamManagementReassignmentMembers({
          sourceType: params.sourceType,
          tasks: params.tasks,
        })
      : await getLicensingTeamManagementMembers({})
  const members = Array.isArray(response)
    ? response
    : Array.isArray(response?.members)
      ? response.members
      : []

  return members.map((item) => ({
    label: String(item?.userName || "-"),
    value: String(item?.userId || ""),
  }))
}

const getContentBackedTeamManagementMemberOptions = async (
  params: TeamManagementMemberOptionsParams
) => {
  const response =
    params.purpose === "reassignment"
      ? await getContentTeamManagementReassignmentMembers({
          sourceType: params.sourceType,
          tasks: params.tasks,
        })
      : await getContentTeamManagementMembers({})
  const members = Array.isArray(response)
    ? response
    : Array.isArray(response?.members)
      ? response.members
      : []
  const leaveStatusByUserId = new Map(
    (Array.isArray(response) ? [] : response?.cards || []).map((item) => [
      String(item?.userId || ""),
      Boolean(item?.isOnLeave),
    ])
  )

  return members
    .filter((item) => {
      const userId = String(item?.userId || "")
      return !params.assignableOnly || leaveStatusByUserId.get(userId) !== true
    })
    .map((item) => ({
      label: String(item?.userName || "-"),
      value: String(item?.userId || ""),
    }))
}

const getCustomerHappinessBackedTeamManagementMemberOptions = async (
  params: TeamManagementMemberOptionsParams
) => {
  const response =
    params.purpose === "reassignment"
      ? await getCustomerHappinessTeamManagementReassignmentMembers({})
      : await getCustomerHappinessTeamManagementMembers({})
  const members = Array.isArray(response)
    ? response
    : Array.isArray(response?.members)
      ? response.members
      : []
  const leaveStatusByUserId = new Map(
    (Array.isArray(response) ? [] : response?.cards || []).map((item) => [
      String(item?.userId || ""),
      Boolean(item?.isOnLeave),
    ])
  )

  return members
    .filter((item) => {
      const userId = String(item?.userId || "")
      return !params.assignableOnly || leaveStatusByUserId.get(userId) !== true
    })
    .map((item) => ({
      label: String(item?.userName || "-"),
      value: String(item?.userId || ""),
    }))
}

const getInspectionBackedTeamManagementMemberOptions = async (
  params: TeamManagementMemberOptionsParams
) => {
  const response = await getInspectionTeamManagementMembers({})
  const leaveStatusByUserId = new Map(
    (response?.cards || []).map((item) => [
      String(item?.userId || ""),
      Boolean(item?.isOnLeave),
    ])
  )

  return (response?.members || [])
    .filter((item) => {
      const userId = String(item?.userId || "")
      return !params.assignableOnly || leaveStatusByUserId.get(userId) !== true
    })
    .map((item) => ({
      label: String(item?.userName || "-"),
      value: String(item?.userId || ""),
    }))
}

const getLegacyTeamManagementMemberOptions = async (
  params: TeamManagementMemberOptionsParams
) => {
  const response = await applicationMyTeamMembers(Boolean(params.assignableOnly))

  return (response?.data || []).map((item) => ({
    label: item.userName,
    value: item.userId,
  }))
}

const getLegacyTeamManagementTaskFilterOptions = async (
  params: TeamManagementTaskFilterOptionsParams
): Promise<TeamManagementTaskFilterOptions> =>
  buildTeamManagementTaskFilterOptions([], [], [], params.taskTab)

const getLegacyTeamManagementLeaveReasonOptions = async (): Promise<TeamManagementOption[]> => []

const reassignLicensingBackedTeamManagementTasks = async (
  payload: TeamManagementReassignPayload
) => {
  const tasks = normalizeTeamManagementReassignTasks(payload)
  const assignedUserId = requireTeamManagementMemberId(
    payload.assignedUserId || payload.memberId
  )

  if (!tasks.length) {
    throw new Error("No licensing tasks available for reassignment")
  }

  return reassignLicensingTeamManagementTasks({
    assignedUserId,
    tasks,
  })
}

const reassignContentBackedTeamManagementTasks = async (
  payload: TeamManagementReassignPayload
) => {
  const tasks = normalizeTeamManagementReassignTasks(payload)
  const assignedUserId = requireTeamManagementMemberId(
    payload.assignedUserId || payload.memberId
  )

  if (!tasks.length) {
    throw new Error("No content tasks available for reassignment")
  }

  return reassignContentTeamManagementTasks({
    assignedUserId,
    tasks,
  })
}

const reassignCustomerHappinessBackedTeamManagementTasks = async (
  payload: TeamManagementReassignPayload
) => {
  const tasks = normalizeTeamManagementReassignTasks(payload)
  const assignedUserId = requireTeamManagementMemberId(
    payload.assignedUserId || payload.memberId
  )

  if (!tasks.length) {
    throw new Error("No customer happiness tasks available for reassignment")
  }

  return reassignCustomerHappinessTeamManagementTasks({
    assignedUserId,
    tasks,
  })
}

const reassignLegacyTeamManagementTasks = async (
  payload: TeamManagementReassignPayload
) =>
  assignTaskUser(requireLegacyMemberId(payload.memberId), payload.taskIds || [])

const reassignInspectionBackedTeamManagementTasks = async (
  payload: TeamManagementReassignPayload
) => {
  const tasks = normalizeTeamManagementReassignTasks(payload)

  if (!tasks.length) {
    throw new Error("No inspection tasks available for reassignment")
  }

  return reassignInspectionTeamManagementTasks({
    tasks,
    assignedUsers: [
      {
        userId: requireTeamManagementMemberId(payload.memberId),
        isPrimary: true,
      },
    ],
  })
}

const markLicensingBackedTeamManagementEmergencyLeave = async (
  payload: TeamManagementMarkLeavePayload
) =>
  markLicensingTeamManagementMemberEmergencyLeave(payload.memberId, {
    leaveReasonCode: payload.leaveType,
    expectedReturnDate: payload.expectedReturnDate,
    notes: payload.briefDescription || "",
  })

const markContentBackedTeamManagementEmergencyLeave = async (
  payload: TeamManagementMarkLeavePayload
) =>
  markContentTeamManagementMemberEmergencyLeave(payload.memberId, {
    leaveReasonCode: payload.leaveType,
    expectedReturnDate: payload.expectedReturnDate,
    notes: payload.briefDescription || "",
  })

const markCustomerHappinessBackedTeamManagementEmergencyLeave = async (
  payload: TeamManagementMarkLeavePayload
) =>
  markCustomerHappinessTeamManagementMemberEmergencyLeave(payload.memberId, {
    leaveReasonCode: payload.leaveType,
    expectedReturnDate: payload.expectedReturnDate,
    notes: payload.briefDescription || "",
  })

const markLegacyTeamManagementEmergencyLeave = async (
  payload: TeamManagementMarkLeavePayload
) =>
  applicationMyTeamMemberLeave({
    userId: payload.memberId,
    leaveType: payload.leaveType,
    expectedReturnDate: payload.expectedReturnDate,
    briefDescription: payload.briefDescription || "",
  })

const markInspectionBackedTeamManagementEmergencyLeave = async (
  payload: TeamManagementMarkLeavePayload
) =>
  markInspectionTeamManagementMemberEmergencyLeave(payload.memberId, {
    leaveReasonCode: payload.leaveType,
    expectedReturnDate: payload.expectedReturnDate,
    notes: payload.briefDescription || "",
  })

const resumeLicensingBackedTeamManagementWork = async (
  payload: TeamManagementResumeWorkPayload
) => resumeLicensingTeamManagementMemberWork(payload.memberId)

const resumeContentBackedTeamManagementWork = async (
  payload: TeamManagementResumeWorkPayload
) => resumeContentTeamManagementMemberWork(payload.memberId)

const resumeCustomerHappinessBackedTeamManagementWork = async (
  payload: TeamManagementResumeWorkPayload
) => resumeCustomerHappinessTeamManagementMemberWork(payload.memberId)

const resumeLegacyTeamManagementWork = async (
  payload: TeamManagementResumeWorkPayload
) =>
  applicationMyTeamMemberReturn({
    userId: payload.memberId,
  })

const resumeInspectionBackedTeamManagementWork = async (
  payload: TeamManagementResumeWorkPayload
) => resumeInspectionTeamManagementMemberWork(payload.memberId)

const createLicensingTeamManagementAdapter = (
  checkAccess: TeamManagementScopeAdapter["checkAccess"]
): TeamManagementScopeAdapter => ({
  permissions: LICENSING_TEAM_MANAGEMENT_PERMISSIONS,
  capabilities: LICENSING_TEAM_MANAGEMENT_CAPABILITIES,
  supportedTaskCategories: FULL_TEAM_TASK_CATEGORIES,
  supportedMemberMetricCategories: FULL_MEMBER_METRIC_CATEGORIES,
  checkAccess,
  getSummary: getLicensingBackedTeamManagementSummary,
  getTaskPage: getLicensingBackedTeamManagementTaskPage,
  exportTasks: exportLicensingBackedTeamManagementTasks,
  getMemberCards: getLicensingBackedTeamManagementMemberCards,
  getMembersPanelData: getLicensingBackedTeamManagementMembersPanelData,
  getTaskFilterOptions: getLicensingBackedTeamManagementTaskFilterOptions,
  getMemberOptions: getLicensingBackedTeamManagementMemberOptions,
  getLeaveReasonOptions: getLicensingBackedTeamManagementLeaveReasonOptions,
  reassignTasks: reassignLicensingBackedTeamManagementTasks,
  markEmergencyLeave: markLicensingBackedTeamManagementEmergencyLeave,
  resumeWork: resumeLicensingBackedTeamManagementWork,
})

const createContentTeamManagementAdapter = (
  checkAccess: TeamManagementScopeAdapter["checkAccess"]
): TeamManagementScopeAdapter => ({
  permissions: CONTENT_TEAM_MANAGEMENT_PERMISSIONS,
  capabilities: CONTENT_TEAM_MANAGEMENT_CAPABILITIES,
  supportedTaskCategories: CONTENT_TEAM_TASK_CATEGORIES,
  supportedMemberMetricCategories: CONTENT_MEMBER_METRIC_CATEGORIES,
  checkAccess,
  getSummary: getContentBackedTeamManagementSummary,
  getTaskPage: getContentBackedTeamManagementTaskPage,
  exportTasks: exportContentBackedTeamManagementTasks,
  getMemberCards: getContentBackedTeamManagementMemberCards,
  getMembersPanelData: getContentBackedTeamManagementMembersPanelData,
  getTaskFilterOptions: getContentBackedTeamManagementTaskFilterOptions,
  getMemberOptions: getContentBackedTeamManagementMemberOptions,
  getLeaveReasonOptions: getContentBackedTeamManagementLeaveReasonOptions,
  reassignTasks: reassignContentBackedTeamManagementTasks,
  markEmergencyLeave: markContentBackedTeamManagementEmergencyLeave,
  resumeWork: resumeContentBackedTeamManagementWork,
})

const createCustomerHappinessTeamManagementAdapter = (
  checkAccess: TeamManagementScopeAdapter["checkAccess"]
): TeamManagementScopeAdapter => ({
  permissions: CUSTOMER_HAPPINESS_TEAM_MANAGEMENT_PERMISSIONS,
  capabilities: CUSTOMER_HAPPINESS_TEAM_MANAGEMENT_CAPABILITIES,
  supportedTaskCategories: CUSTOMER_HAPPINESS_TEAM_TASK_CATEGORIES,
  supportedMemberMetricCategories:
    CUSTOMER_HAPPINESS_MEMBER_METRIC_CATEGORIES,
  checkAccess,
  getSummary: getCustomerHappinessBackedTeamManagementSummary,
  getTaskPage: getCustomerHappinessBackedTeamManagementTaskPage,
  exportTasks: exportCustomerHappinessBackedTeamManagementTasks,
  getMemberCards: getCustomerHappinessBackedTeamManagementMemberCards,
  getMembersPanelData:
    getCustomerHappinessBackedTeamManagementMembersPanelData,
  getTaskFilterOptions:
    getCustomerHappinessBackedTeamManagementTaskFilterOptions,
  getMemberOptions: getCustomerHappinessBackedTeamManagementMemberOptions,
  getLeaveReasonOptions:
    getCustomerHappinessBackedTeamManagementLeaveReasonOptions,
  reassignTasks: reassignCustomerHappinessBackedTeamManagementTasks,
  markEmergencyLeave:
    markCustomerHappinessBackedTeamManagementEmergencyLeave,
  resumeWork: resumeCustomerHappinessBackedTeamManagementWork,
})

const createInspectionTeamManagementAdapter = (
  checkAccess: TeamManagementScopeAdapter["checkAccess"]
): TeamManagementScopeAdapter => ({
  permissions: INSPECTION_TEAM_MANAGEMENT_PERMISSIONS,
  capabilities: INSPECTION_TEAM_MANAGEMENT_CAPABILITIES,
  supportedTaskCategories: INSPECTION_TEAM_TASK_CATEGORIES,
  supportedMemberMetricCategories: INSPECTION_MEMBER_METRIC_CATEGORIES,
  checkAccess,
  getSummary: getInspectionBackedTeamManagementSummary,
  getTaskPage: getInspectionBackedTeamManagementTaskPage,
  exportTasks: exportInspectionBackedTeamManagementTasks,
  getMemberCards: getInspectionBackedTeamManagementMemberCards,
  getMembersPanelData: getInspectionBackedTeamManagementMembersPanelData,
  getTaskFilterOptions: getInspectionBackedTeamManagementTaskFilterOptions,
  getMemberOptions: getInspectionBackedTeamManagementMemberOptions,
  getLeaveReasonOptions: getInspectionBackedTeamManagementLeaveReasonOptions,
  reassignTasks: reassignInspectionBackedTeamManagementTasks,
  markEmergencyLeave: markInspectionBackedTeamManagementEmergencyLeave,
  resumeWork: resumeInspectionBackedTeamManagementWork,
})

const createLegacyDelegatedScopeAdapter = (
  checkAccess: TeamManagementScopeAdapter["checkAccess"]
): TeamManagementScopeAdapter => ({
  permissions: LICENSING_TEAM_MANAGEMENT_PERMISSIONS,
  capabilities: LEGACY_TEAM_MANAGEMENT_CAPABILITIES,
  supportedTaskCategories: LEGACY_TEAM_MANAGEMENT_SUPPORTED_CATEGORIES,
  supportedMemberMetricCategories: LEGACY_MEMBER_METRIC_CATEGORIES,
  checkAccess,
  getSummary: getLegacyTeamManagementSummary,
  getTaskPage: getLegacyTeamManagementTaskPage,
  exportTasks: exportLegacyTeamManagementTasks,
  getMemberCards: getLegacyTeamManagementMemberCards,
  getMembersPanelData: getLegacyTeamManagementMembersPanelData,
  getTaskFilterOptions: getLegacyTeamManagementTaskFilterOptions,
  getMemberOptions: getLegacyTeamManagementMemberOptions,
  getLeaveReasonOptions: getLegacyTeamManagementLeaveReasonOptions,
  reassignTasks: reassignLegacyTeamManagementTasks,
  markEmergencyLeave: markLegacyTeamManagementEmergencyLeave,
  resumeWork: resumeLegacyTeamManagementWork,
})

const TEAM_MANAGEMENT_SCOPE_ADAPTERS: Record<
  TeamManagementScope,
  TeamManagementScopeAdapter
> = {
  licensing: createLicensingTeamManagementAdapter(
    checkLicensingTeamManagementAccess
  ),
  content: createContentTeamManagementAdapter(checkContentTeamManagementAccess),
  customer: createCustomerHappinessTeamManagementAdapter(
    checkCustomerTeamManagementAccess
  ),
  inspection: createInspectionTeamManagementAdapter(
    checkInspectionTeamManagementAccess
  ),
}

const LEGACY_LICENSING_TEAM_MANAGEMENT_ADAPTER =
  createLegacyDelegatedScopeAdapter(checkLicensingTeamManagementAccess)

export const TEAM_MANAGEMENT_SCOPE_METADATA: Record<
  TeamManagementScope,
  TeamManagementScopeMeta
> = {
  licensing: {
    permissions: TEAM_MANAGEMENT_SCOPE_ADAPTERS.licensing.permissions,
    capabilities: TEAM_MANAGEMENT_SCOPE_ADAPTERS.licensing.capabilities,
    supportedTaskCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.licensing.supportedTaskCategories,
    supportedMemberMetricCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.licensing.supportedMemberMetricCategories,
  },
  content: {
    permissions: TEAM_MANAGEMENT_SCOPE_ADAPTERS.content.permissions,
    capabilities: TEAM_MANAGEMENT_SCOPE_ADAPTERS.content.capabilities,
    supportedTaskCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.content.supportedTaskCategories,
    supportedMemberMetricCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.content.supportedMemberMetricCategories,
  },
  customer: {
    permissions: TEAM_MANAGEMENT_SCOPE_ADAPTERS.customer.permissions,
    capabilities: TEAM_MANAGEMENT_SCOPE_ADAPTERS.customer.capabilities,
    supportedTaskCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.customer.supportedTaskCategories,
    supportedMemberMetricCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.customer.supportedMemberMetricCategories,
  },
  inspection: {
    permissions: TEAM_MANAGEMENT_SCOPE_ADAPTERS.inspection.permissions,
    capabilities: TEAM_MANAGEMENT_SCOPE_ADAPTERS.inspection.capabilities,
    supportedTaskCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.inspection.supportedTaskCategories,
    supportedMemberMetricCategories:
      TEAM_MANAGEMENT_SCOPE_ADAPTERS.inspection.supportedMemberMetricCategories,
  },
}

const getTeamManagementScopeAdapter = (
  scope: TeamManagementScope,
  adapterMode: TeamManagementAdapterMode = "default"
) => {
  if (scope === "licensing" && adapterMode === "legacyLicensing") {
    return LEGACY_LICENSING_TEAM_MANAGEMENT_ADAPTER
  }

  return TEAM_MANAGEMENT_SCOPE_ADAPTERS[scope]
}

const buildLicensingTaskQueryPayload = (
  params: TeamManagementTaskPageParams | TeamManagementExportParams
): LicensingTeamManagementTaskQueryPayload => ({
  view: params.taskTab,
  applicationTaskOnly: params.applicationTaskOnly,
  keyword: params.keyword || undefined,
  category: (params.category || "all") as LicensingTeamManagementCategory,
  status: normalizeLicensingStatusFilterValue(params.status),
  memberId: params.memberId || undefined,
  lastUpdatedFrom: params.startTime ?? undefined,
  lastUpdatedTo: params.endTime ?? undefined,
  pageIndex: "pageIndex" in params ? params.pageIndex ?? 1 : undefined,
  pageSize: "pageSize" in params ? params.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize : undefined,
  sortBy:
    "sortBy" in params ? mapTeamManagementApiSortField(params.sortBy) : undefined,
  sortDirection:
    "sortDirection" in params ? params.sortDirection ?? 1 : undefined,
})

const buildContentTaskQueryPayload = (
  params: TeamManagementTaskPageParams | TeamManagementExportParams
): ContentTeamManagementTaskQueryPayload => ({
  view: params.taskTab,
  applicationTaskOnly: params.applicationTaskOnly,
  keyword: params.keyword || undefined,
  category: (params.category || "all") as ContentTeamManagementCategory,
  status: normalizeStableCodeFilterValue(params.status),
  memberId: params.memberId || undefined,
  lastUpdatedFrom: params.startTime ?? undefined,
  lastUpdatedTo: params.endTime ?? undefined,
  pageIndex: "pageIndex" in params ? params.pageIndex ?? 1 : undefined,
  pageSize: "pageSize" in params ? params.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize : undefined,
  sortBy:
    "sortBy" in params ? mapTeamManagementApiSortField(params.sortBy) : undefined,
  sortDirection:
    "sortDirection" in params ? params.sortDirection ?? 1 : undefined,
})

const buildCustomerHappinessTaskQueryPayload = (
  params: TeamManagementTaskPageParams | TeamManagementExportParams
): CustomerHappinessTeamManagementTaskQueryPayload => ({
  view: params.taskTab,
  keyword: params.keyword || undefined,
  category:
    (params.category || "all") as CustomerHappinessTeamManagementCategory,
  status: normalizeStableCodeFilterValue(params.status),
  memberId: params.memberId || undefined,
  lastUpdatedFrom: params.startTime ?? undefined,
  lastUpdatedTo: params.endTime ?? undefined,
  pageIndex: "pageIndex" in params ? params.pageIndex ?? 1 : undefined,
  pageSize:
    "pageSize" in params
      ? params.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize
      : undefined,
  sortBy:
    "sortBy" in params ? mapTeamManagementApiSortField(params.sortBy) : undefined,
  sortDirection:
    "sortDirection" in params ? params.sortDirection ?? 1 : undefined,
})

const buildInspectionTaskQueryPayload = (
  params: TeamManagementTaskPageParams | TeamManagementExportParams
): InspectionTeamManagementTaskQueryPayload => ({
  view: params.taskTab,
  keyword: params.keyword || undefined,
  taskMode:
    String(params.taskSourceKey || "").trim() === "other"
      ? "otherTask"
      : ("inspectionTasks" as InspectionTeamManagementTaskMode),
  category: (params.category || undefined) as
    | InspectionTeamManagementCategory
    | undefined,
  status: normalizeStableCodeFilterValue(params.status),
  memberId: params.memberId || undefined,
  lastUpdatedFrom: params.startTime ?? undefined,
  lastUpdatedTo: params.endTime ?? undefined,
  pageIndex: "pageIndex" in params ? params.pageIndex ?? 1 : undefined,
  pageSize:
    "pageSize" in params
      ? params.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize
      : undefined,
  sortBy:
    "sortBy" in params ? mapTeamManagementApiSortField(params.sortBy) : undefined,
  sortDirection:
    "sortDirection" in params ? params.sortDirection ?? 1 : undefined,
})

const buildLegacyTaskRequestParams = (params: TeamManagementTaskPageParams) => ({
  pageIndex: params.pageIndex ?? 1,
  pageSize: params.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize,
  sortBy: mapLegacySortField(params.sortBy),
  sortDirection: params.sortDirection ?? 1,
  keyword: params.keyword || undefined,
  userId: params.memberId || undefined,
  processInstanceStatus: params.status || undefined,
  startTime: params.startTime ?? null,
  endTime: params.endTime ?? null,
})

const mapTeamManagementApiSortField = (sortBy?: string) => {
  switch (sortBy) {
    case "slaSortValue":
      return "sla"
    case "lastUpdated":
      return "lastUpdatedOn"
    default:
      return sortBy
  }
}

const mapLegacySortField = (sortBy?: string) => {
  switch (sortBy) {
    case "slaSortValue":
      return "sla"
    case "lastUpdated":
      return "submissionTime"
    default:
      return sortBy
  }
}

const normalizeLegacyTaskPageResponse = (
  response: Awaited<ReturnType<typeof applicationMyTeamTodoPage>>
): TeamManagementTaskPageResponse => {
  const page = response?.data?.page || DEFAULT_TEAM_TASK_PAGE
  const processInstanceStatus = Array.isArray(response?.data?.processInstanceStatus)
    ? response.data.processInstanceStatus
    : []

  return {
    page: {
      items: (page.items || []).map(normalizeLegacyTaskItem),
      pageIndex: page.pageIndex ?? DEFAULT_TEAM_TASK_PAGE.pageIndex,
      pageSize: page.pageSize ?? DEFAULT_TEAM_TASK_PAGE.pageSize,
      total: page.total ?? DEFAULT_TEAM_TASK_PAGE.total,
    },
    statusOptions: processInstanceStatus.map((item: string) => ({
      label: String(item || ""),
      value: String(item || ""),
    })),
  }
}

const normalizeLicensingTaskItem = (
  item: LicensingTeamManagementTaskItemDto
): TeamManagementTaskItem => {
  const sourceType = String(item?.sourceType || "")
  const sourceId = String(item?.sourceId || "")
  const taskId =
    sourceType && sourceId
      ? `${sourceType}::${sourceId}`
      : String(item?.taskNo || sourceId || "")
  const taskCategory = normalizeTeamManagementTaskCategory(
    item?.taskCategoryCode || item?.taskCategory
  )
  const detailNavigation = buildTeamManagementTaskDetailNavigation({
    scope: "licensing",
    taskCategory,
    sourceType,
    sourceId,
    taskNo: item?.taskNo,
    canReassign: item?.canReassign !== false,
    detailTarget: item?.detailTarget,
  })

  return {
    taskId,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
    userId: String(item?.userId || "").trim() || null,
    userTypeCode: String(item?.userTypeCode || "").trim() || null,
    applyForUserTypeId:
      item?.applyForUserTypeId == null
        ? null
        : String(item.applyForUserTypeId).trim() || null,
    assignedToUserId: String(item?.assignedToUserId || "").trim() || null,
    taskNo: String(item?.taskNo || "-"),
    taskCategory,
    taskCategoryLabel: item?.taskCategoryDisplay || null,
    applyFor: String(item?.applyFor || "-"),
    assignedTo: String(item?.assignedTo || "-"),
    status: String(item?.status || item?.statusDisplay || "-"),
    statusId:
      item?.statusId == null ? null : String(item.statusId).trim() || null,
    statusCode: item?.statusCode || null,
    statusLabel: item?.status || item?.statusDisplay || null,
    statusDisplayOnly: String(item?.statusDisplayOnly || "").trim() || null,
    lastUpdated: item?.lastUpdatedOn || "",
    slaDisplay: item?.sla?.displayText || "-",
    slaSortValue: normalizeNumber(item?.sla?.remainingMinutes),
    slaRemainingMinutes: normalizeNumber(item?.sla?.remainingMinutes),
    slaDueOn: item?.sla?.dueOn || null,
    slaIsOverdue: item?.sla?.isOverdue === true,
    isUrgent: Boolean(item?.isUrgent),
    isOverdue: Boolean(item?.sla?.isOverdue),
    canReassign: item?.canReassign !== false,
    ...detailNavigation,
  }
}

const normalizeContentTaskItem = (
  item: ContentTeamManagementTaskItemDto
): TeamManagementTaskItem => {
  const sourceType = String(item?.sourceType || "")
  const sourceId = String(item?.sourceId || "")
  const taskId =
    sourceType && sourceId
      ? `${sourceType}::${sourceId}`
      : String(item?.taskNo || sourceId || "")
  const taskCategory = normalizeTeamManagementTaskCategory(
    item?.taskCategoryCode || item?.taskCategory
  )
  const detailNavigation = buildTeamManagementTaskDetailNavigation({
    scope: "content",
    taskCategory,
    sourceType,
    sourceId,
    taskNo: item?.taskNo,
    canReassign: item?.canReassign !== false,
    detailTarget: item?.detailTarget,
  })

  return {
    taskId,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
    userId: String(item?.userId || "").trim() || null,
    applyForUserTypeId:
      item?.applyForUserTypeId == null
        ? null
        : String(item.applyForUserTypeId).trim() || null,
    assignedToUserId: String(item?.assignedToUserId || "").trim() || null,
    taskNo: String(item?.taskNo || "-"),
    taskCategory,
    taskCategoryLabel: item?.taskCategoryDisplay || null,
    applyFor: String(item?.applyFor || "-"),
    assignedTo: String(item?.assignedTo || "-"),
    status: String(item?.status || item?.statusDisplay || "-"),
    statusId:
      item?.statusId == null ? null : String(item.statusId).trim() || null,
    statusCode: item?.statusCode || null,
    statusLabel: item?.status || item?.statusDisplay || null,
    statusDisplayOnly: String(item?.statusDisplayOnly || "").trim() || null,
    lastUpdated: item?.lastUpdatedOn || "",
    slaDisplay: item?.sla?.displayText || "-",
    slaSortValue: normalizeNumber(item?.sla?.remainingMinutes),
    slaRemainingMinutes: normalizeNumber(item?.sla?.remainingMinutes),
    slaDueOn: item?.sla?.dueOn || null,
    slaIsOverdue: item?.sla?.isOverdue === true,
    isUrgent: Boolean(item?.isUrgent),
    isOverdue: Boolean(item?.sla?.isOverdue),
    canReassign: item?.canReassign !== false,
    ...detailNavigation,
  }
}

const normalizeCustomerHappinessTaskItem = (
  item: CustomerHappinessTeamManagementTaskItemDto
): TeamManagementTaskItem => {
  const sourceType = String(item?.sourceType || "")
  const sourceId = String(item?.sourceId || "")
  const taskId =
    sourceType && sourceId
      ? `${sourceType}::${sourceId}`
      : String(item?.taskNo || sourceId || "")
  const taskCategory = normalizeTeamManagementTaskCategory(
    item?.taskCategoryCode || item?.taskCategory
  )
  const detailNavigation = buildTeamManagementTaskDetailNavigation({
    scope: "customer",
    taskCategory,
    sourceType,
    sourceId,
    taskNo: item?.taskNo,
    canReassign: item?.canReassign !== false,
    detailTarget: item?.detailTarget,
  })

  return {
    taskId,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
    userId: String(item?.userId || "").trim() || null,
    applyForUserTypeId:
      item?.applyForUserTypeId == null
        ? null
        : String(item.applyForUserTypeId).trim() || null,
    assignedToUserId: String(item?.assignedToUserId || "").trim() || null,
    taskNo: String(item?.taskNo || "-"),
    taskCategory,
    taskCategoryLabel: item?.taskCategoryDisplay || null,
    applyFor: String(item?.applyFor || "-"),
    assignedTo: String(item?.assignedTo || "-"),
    status: String(item?.status || item?.statusDisplay || "-"),
    statusId:
      item?.statusId == null ? null : String(item.statusId).trim() || null,
    statusCode: item?.statusCode || null,
    statusLabel: item?.status || item?.statusDisplay || null,
    statusDisplayOnly: String(item?.statusDisplayOnly || "").trim() || null,
    lastUpdated: item?.lastUpdatedOn || "",
    slaDisplay: item?.sla?.displayText || "-",
    slaSortValue: normalizeNumber(item?.sla?.remainingMinutes),
    slaRemainingMinutes: normalizeNumber(item?.sla?.remainingMinutes),
    slaDueOn: item?.sla?.dueOn || null,
    slaIsOverdue: item?.sla?.isOverdue === true,
    isUrgent: Boolean(item?.isUrgent),
    isOverdue: Boolean(item?.sla?.isOverdue),
    canReassign: item?.canReassign !== false,
    ...detailNavigation,
  }
}

const normalizeInspectionTaskItem = (
  item: InspectionTeamManagementTaskItemDto
): TeamManagementTaskItem => {
  const sourceType = String(item?.sourceType || "")
  const sourceId = String(item?.sourceId || "")
  const taskCategory = normalizeTeamManagementTaskCategory(
    item?.taskCategoryCode || item?.taskCategory,
    "inspectionTasks"
  )
  const taskId =
    sourceType && sourceId
      ? `${sourceType}::${sourceId}`
      : String(item?.taskNo || sourceId || "")
  const assignedUsers = Array.isArray(item?.assignedUsers)
    ? item.assignedUsers
    : []
  const primaryAssignedUser = assignedUsers.find(
    (assignedUser) => assignedUser?.isPrimary
  )
  const fallbackAssignedUsersText = assignedUsers
    .map((assignedUser) => String(assignedUser?.userName || "").trim())
    .filter(Boolean)
    .join(", ")
  const detailNavigation =
    sourceType === "inspectionTask"
      ? {
          detailRoutePath: "/inspection/tasks/detail",
          detailRouteQuery: {
            taskId: sourceId || item?.taskNo || "",
            ...buildTeamManagementDetailContextQuery("inspection", {
              canReassign: item?.canReassign !== false,
              sourceType,
              sourceId,
            }),
          },
        }
      : buildTeamManagementTaskDetailNavigation({
          scope: "inspection",
          taskCategory,
          sourceType,
          sourceId,
          canReassign: item?.canReassign !== false,
          detailTarget: item?.detailTarget,
        })

  return {
    taskId,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
    userId: String(item?.userId || "").trim() || null,
    applyForUserTypeId:
      item?.applyForUserTypeId == null
        ? null
        : String(item.applyForUserTypeId).trim() || null,
    assignedToUserId: String(
      item?.primaryAssignedUserId ||
        item?.assignedToUserId ||
        item?.userId ||
        ""
    ).trim() || null,
    taskNo: String(item?.taskNo || "-"),
    taskCategory,
    taskCategoryLabel: item?.taskCategoryDisplay || null,
    applyFor: String(item?.applyFor || "-"),
    assignedTo: String(
      item?.assignedToDisplay ||
        item?.assignedTo ||
        item?.primaryAssignedUserName ||
        primaryAssignedUser?.userName ||
        fallbackAssignedUsersText ||
        "-"
    ),
    status: String(item?.status || item?.statusDisplay || "-"),
    statusId:
      item?.statusId == null ? null : String(item.statusId).trim() || null,
    statusCode: item?.statusCode || null,
    statusLabel: item?.status || item?.statusDisplay || null,
    statusDisplayOnly: String(item?.statusDisplayOnly || "").trim() || null,
    lastUpdated: item?.lastUpdatedOn || "",
    slaDisplay: item?.sla?.displayText || "-",
    slaSortValue: normalizeNumber(item?.sla?.remainingMinutes),
    slaRemainingMinutes: normalizeNumber(item?.sla?.remainingMinutes),
    slaDueOn: item?.sla?.dueOn || null,
    slaIsOverdue: item?.sla?.isOverdue === true,
    isUrgent: Boolean(item?.isUrgent),
    isOverdue: Boolean(item?.sla?.isOverdue),
    canReassign: item?.canReassign !== false,
    ...detailNavigation,
  }
}

const normalizeLegacyTaskItem = (
  item: ITeamTasksDto
): TeamManagementTaskItem => ({
  taskId: String(item?.taskId || item?.id || ""),
  taskNo: String(item?.applicationNumber || "-"),
  taskCategory: "applications",
  applyFor: String(item?.applyForEn || item?.applyForAr || "-"),
  userTypeCode: String(item?.userTypeCode || "").trim() || null,
  assignedTo: String(item?.assignedTo || "-"),
  status: String(item?.status || "-"),
  lastUpdated: item?.submissionTime || "",
  slaDisplay: item?.slaDescription || "-",
  slaSortValue:
    item?.sla == null || Number.isNaN(Number(item?.sla))
      ? null
      : Number(item.sla),
  slaRemainingMinutes:
    item?.sla == null || Number.isNaN(Number(item?.sla))
      ? null
      : Number(item.sla),
  slaDueOn: null,
  slaIsOverdue: Boolean(item?.isOverdue),
  isUrgent: Boolean(item?.isUrgent),
  isOverdue: Boolean(item?.isOverdue),
  canReassign: true,
  profileIsVIP: Boolean(item?.profileIsVIP),
  detailRoutePath: "/licensing/applications/applicationsDetails",
  detailRouteQuery: {
    taskId: item?.taskId || item?.id || item?.applicationNumber || "",
  },
})

const normalizeLicensingMemberCards = (
  response: LicensingTeamManagementMembersResponse,
  memberMetricCategory?: MemberMetricCategory
) =>
  (response?.cards || []).map((item) =>
    normalizeLicensingMemberCard(item, memberMetricCategory)
  )

const normalizeLicensingTeamManagementMemberOptions = (
  members?: LicensingTeamManagementMembersResponse["members"]
): TeamManagementMemberOption[] =>
  (members || []).map((item) => ({
    label: String(item?.userName || "-"),
    value: String(item?.userId || ""),
  }))

const normalizeLicensingMemberCard = (
  item: LicensingTeamManagementMemberCardDto,
  memberMetricCategory?: MemberMetricCategory
): TeamManagementMemberCard => {
  const metricsByCategory = {
    ...buildNormalizedMemberMetricsByCategory(
      item?.metricsByCategory,
      FULL_MEMBER_METRIC_CATEGORIES,
      mapMemberMetricCategoryToLicensingCategory,
      normalizeLicensingMemberMetrics
    ),
  }
  const fallbackAllMetrics = normalizeLicensingMemberFallbackMetrics(item)
  const leaveInfo = item?.leaveInfo || {}

  if (fallbackAllMetrics && !metricsByCategory.all) {
    metricsByCategory.all = fallbackAllMetrics
  }

  return {
    memberId: String(item?.userId || ""),
    memberName: String(item?.userName || "-"),
    avatarUrl: normalizeTeamManagementAvatarUrl(item?.avatarUrl),
    todoTaskCount: Number(item?.todoTaskCount ?? 0),
    isLeave: Boolean(item?.isOnLeave),
    leaveReason:
      leaveInfo.leaveReasonDisplay ||
      leaveInfo.reasonEn ||
      leaveInfo.reasonAr ||
      leaveInfo.leaveReasonCode ||
      null,
    leaveNotes: leaveInfo.notes || leaveInfo.briefDescription || null,
    leaveCreatedOn:
      leaveInfo.effectiveFrom ||
      leaveInfo.leaveCreatedOn ||
      leaveInfo.createdOn ||
      leaveInfo.createdAt ||
      null,
    expectedReturnDate: leaveInfo.expectedReturnDate || null,
    metrics: getDefaultNormalizedMemberMetrics(
      metricsByCategory,
      memberMetricCategory
    ),
    metricsByCategory,
  }
}

const normalizeContentMemberCards = (
  response: ContentTeamManagementMembersResponse,
  memberMetricCategory?: MemberMetricCategory
) =>
  (response?.cards || []).map((item) =>
    normalizeContentMemberCard(item, memberMetricCategory)
  )

const normalizeContentTeamManagementMemberOptions = (
  members?: ContentTeamManagementMembersResponse["members"]
): TeamManagementMemberOption[] =>
  (members || []).map((item) => ({
    label: String(item?.userName || "-"),
    value: String(item?.userId || ""),
  }))

const normalizeCustomerHappinessMemberCards = (
  response: CustomerHappinessTeamManagementMembersResponse,
  memberMetricCategory?: MemberMetricCategory
) =>
  (response?.cards || []).map((item) =>
    normalizeCustomerHappinessMemberCard(item, memberMetricCategory)
  )

const normalizeCustomerHappinessTeamManagementMemberOptions = (
  members?: CustomerHappinessTeamManagementMembersResponse["members"]
): TeamManagementMemberOption[] =>
  (members || []).map((item) => ({
    label: String(item?.userName || "-"),
    value: String(item?.userId || ""),
  }))

const normalizeInspectionMemberCards = (
  response: InspectionTeamManagementMembersResponse,
  memberMetricCategory?: MemberMetricCategory
) =>
  (response?.cards || []).map((item) =>
    normalizeInspectionMemberCard(item, memberMetricCategory)
  )

const normalizeInspectionTeamManagementMemberOptions = (
  members?: InspectionTeamManagementMembersResponse["members"]
): TeamManagementMemberOption[] =>
  (members || []).map((item) => ({
    label: String(item?.userName || "-"),
    value: String(item?.userId || ""),
  }))

const normalizeContentMemberCard = (
  item: ContentTeamManagementMemberCardDto,
  memberMetricCategory?: MemberMetricCategory
): TeamManagementMemberCard => {
  const metricsByCategory = buildNormalizedMemberMetricsByCategory(
    item?.metricsByCategory,
    CONTENT_MEMBER_METRIC_CATEGORIES,
    mapMemberMetricCategoryToContentCategory,
    normalizeContentMemberMetrics
  )
  const leaveInfo = item?.leaveInfo || {}

  return {
    memberId: String(item?.userId || ""),
    memberName: String(item?.userName || "-"),
    avatarUrl: normalizeTeamManagementAvatarUrl(item?.avatarUrl),
    todoTaskCount: Number(item?.todoTaskCount ?? 0),
    isLeave: Boolean(item?.isOnLeave),
    leaveReason:
      leaveInfo.leaveReasonDisplay ||
      leaveInfo.reasonEn ||
      leaveInfo.reasonAr ||
      leaveInfo.leaveReasonCode ||
      null,
    leaveNotes: leaveInfo.notes || leaveInfo.briefDescription || null,
    leaveCreatedOn:
      leaveInfo.effectiveFrom ||
      leaveInfo.leaveCreatedOn ||
      leaveInfo.createdOn ||
      leaveInfo.createdAt ||
      null,
    expectedReturnDate: leaveInfo.expectedReturnDate || null,
    metrics: getDefaultNormalizedMemberMetrics(
      metricsByCategory,
      memberMetricCategory
    ),
    metricsByCategory,
  }
}

const normalizeCustomerHappinessMemberCard = (
  item: CustomerHappinessTeamManagementMemberCardDto,
  memberMetricCategory?: MemberMetricCategory
): TeamManagementMemberCard => {
  const metricsByCategory = buildNormalizedMemberMetricsByCategory(
    item?.metricsByCategory,
    CUSTOMER_HAPPINESS_MEMBER_METRIC_CATEGORIES,
    mapMemberMetricCategoryToCustomerHappinessCategory,
    normalizeCustomerHappinessMemberMetrics
  )
  const leaveInfo = item?.leaveInfo || {}

  return {
    memberId: String(item?.userId || ""),
    memberName: String(item?.userName || "-"),
    avatarUrl: normalizeTeamManagementAvatarUrl(item?.avatarUrl),
    todoTaskCount: metricsByCategory.all
      ? Math.max(
          0,
          (metricsByCategory.all.totalAssignedCount ?? 0) -
            (metricsByCategory.all.completedCount ?? 0)
        )
      : Number(item?.todoTaskCount ?? 0),
    isLeave: Boolean(item?.isOnLeave),
    leaveReason:
      leaveInfo.leaveReasonDisplay ||
      leaveInfo.reasonEn ||
      leaveInfo.reasonAr ||
      leaveInfo.leaveReasonCode ||
      null,
    leaveNotes: leaveInfo.notes || leaveInfo.briefDescription || null,
    leaveCreatedOn:
      leaveInfo.effectiveFrom ||
      leaveInfo.leaveCreatedOn ||
      leaveInfo.createdOn ||
      leaveInfo.createdAt ||
      null,
    expectedReturnDate: leaveInfo.expectedReturnDate || null,
    metrics: getDefaultNormalizedMemberMetrics(
      metricsByCategory,
      memberMetricCategory
    ),
    metricsByCategory,
  }
}

const normalizeInspectionMemberCard = (
  item: InspectionTeamManagementMemberCardDto,
  memberMetricCategory?: MemberMetricCategory
): TeamManagementMemberCard => {
  const metricsByCategory = buildNormalizedMemberMetricsByCategory(
    item?.metricsByCategory,
    INSPECTION_MEMBER_METRIC_CATEGORIES,
    mapMemberMetricCategoryToInspectionCategory,
    normalizeInspectionMemberMetrics
  )
  const leaveInfo = item?.leaveInfo || {}

  return {
    memberId: String(item?.userId || ""),
    memberName: String(item?.userName || "-"),
    avatarUrl: normalizeTeamManagementAvatarUrl(item?.avatarUrl),
    todoTaskCount: Number(item?.todoTaskCount ?? 0),
    isLeave: Boolean(item?.isOnLeave),
    leaveReason:
      leaveInfo.leaveReasonDisplay ||
      leaveInfo.reasonEn ||
      leaveInfo.reasonAr ||
      leaveInfo.leaveReasonCode ||
      null,
    leaveNotes: leaveInfo.notes || leaveInfo.briefDescription || null,
    leaveCreatedOn:
      leaveInfo.effectiveFrom ||
      leaveInfo.leaveCreatedOn ||
      leaveInfo.createdOn ||
      leaveInfo.createdAt ||
      null,
    expectedReturnDate: leaveInfo.expectedReturnDate || null,
    assignedArea:
      item?.assignedAreaDisplay || item?.assignedAreaCode || null,
    assignedAreaStatus:
      item?.assignedAreaDisplay || item?.assignedAreaCode
        ? "assigned"
        : "unassigned",
    assignedAreaSelection: {
      emirateIds: item?.assignedEmirateIds || [],
      regionIds: item?.assignedRegionIds || [],
      areaIds: item?.assignedAreaIds || [],
    },
    metrics: getDefaultNormalizedMemberMetrics(
      metricsByCategory,
      memberMetricCategory
    ),
    metricsByCategory,
  }
}

const normalizeLegacyMemberCard = (
  item: IMembersTasksDto,
  supportsMetrics: boolean
): TeamManagementMemberCard => {
  const completedCount = Number(item?.completedTaskCount ?? 0)
  const totalAssignedCount = Number(item?.totalTaskCount ?? 0)
  const metrics = supportsMetrics
    ? {
        completedCount,
        totalAssignedCount,
        averageProcessingMinutes:
          item?.avgDuration == null || Number.isNaN(Number(item?.avgDuration))
            ? null
            : Number(item.avgDuration),
        slaComplianceRate:
          item?.sla == null || Number.isNaN(Number(item?.sla))
            ? null
            : Number(item.sla),
        overdueTasksCount: Number(item?.overdueCount ?? 0),
      }
    : { ...DEFAULT_MEMBER_METRICS }

  return {
    memberId: String(item?.userId || ""),
    memberName: String(item?.userName || "-"),
    avatarUrl: null,
    todoTaskCount: supportsMetrics
      ? Math.max(0, totalAssignedCount - completedCount)
      : 0,
    isLeave: Boolean(item?.isLeave),
    leaveReason: item?.leaveTypeNameEn || item?.leaveTypeNameAr || null,
    leaveNotes: item?.briefDescription || null,
    leaveCreatedOn: item?.leaveCreatedOn || null,
    expectedReturnDate: item?.expectedReturnDate || null,
    metrics,
    metricsByCategory: supportsMetrics
      ? {
          all: metrics,
          applications: metrics,
        }
      : {
          all: metrics,
        },
  }
}

const normalizeLicensingMemberMetrics = (
  item: LicensingTeamManagementMemberMetricsDto
): TeamManagementMemberMetrics => ({
  completedCount: Number(item?.completedTasks ?? 0),
  totalAssignedCount: Number(item?.totalAssignedTasks ?? 0),
  averageProcessingMinutes: normalizeNumber(item?.avgProcessingTime),
  slaComplianceRate: normalizeNumber(item?.slaCompliance),
  overdueTasksCount: Number(item?.overdueTasks ?? 0),
})

const normalizeLicensingMemberFallbackMetrics = (
  item: LicensingTeamManagementMemberCardDto
): TeamManagementMemberMetrics | null => {
  const hasFallbackMetrics = [
    item?.completedTasks,
    item?.totalAssignedTasks,
    item?.avgProcessingTime,
    item?.slaCompliance,
    item?.overdueTasks,
  ].some((value) => value != null)

  if (!hasFallbackMetrics) {
    return null
  }

  return normalizeLicensingMemberMetrics({
    completedTasks: item?.completedTasks,
    totalAssignedTasks: item?.totalAssignedTasks,
    avgProcessingTime: item?.avgProcessingTime,
    slaCompliance: item?.slaCompliance,
    overdueTasks: item?.overdueTasks,
  })
}

const normalizeContentMemberMetrics = (
  item: ContentTeamManagementMemberMetricsDto
): TeamManagementMemberMetrics => ({
  completedCount: Number(item?.completedTasks ?? 0),
  totalAssignedCount: Number(item?.totalAssignedTasks ?? 0),
  averageProcessingMinutes: normalizeNumber(item?.avgProcessingTime),
  slaComplianceRate: normalizeNumber(item?.slaCompliance),
  overdueTasksCount: Number(item?.overdueTasks ?? 0),
})

const normalizeCustomerHappinessMemberMetrics = (
  item: CustomerHappinessTeamManagementMemberMetricsDto
): TeamManagementMemberMetrics => ({
  completedCount: Number(item?.completedTasks ?? 0),
  totalAssignedCount: Number(item?.totalAssignedTasks ?? 0),
  averageProcessingMinutes: normalizeNumber(item?.avgProcessingTime),
  slaComplianceRate: normalizeNumber(item?.slaCompliance),
  overdueTasksCount: Number(item?.overdueTasks ?? 0),
})

const normalizeInspectionMemberMetrics = (
  item: InspectionTeamManagementMemberMetricsDto
): TeamManagementMemberMetrics => ({
  completedCount: Number(item?.completedTasks ?? 0),
  totalAssignedCount: Number(item?.totalAssignedTasks ?? 0),
  averageProcessingMinutes: normalizeNumber(item?.avgProcessingTime),
  slaComplianceRate: normalizeNumber(item?.slaCompliance),
  overdueTasksCount: Number(item?.overdueTasks ?? 0),
})

const buildNormalizedMemberMetricsByCategory = <
  TMetricsDto,
  TCategory extends string,
>(
  rawMetricsByCategory: Record<string, TMetricsDto | undefined> | null | undefined,
  supportedCategories: MemberMetricCategory[],
  mapCategory: (memberMetricCategory?: MemberMetricCategory) => TCategory,
  normalizeMetric: (item: TMetricsDto) => TeamManagementMemberMetrics
): TeamManagementMemberMetricsByCategory => {
  const normalizedMetrics: TeamManagementMemberMetricsByCategory = {}

  if (!rawMetricsByCategory || typeof rawMetricsByCategory !== "object") {
    return normalizedMetrics
  }

  supportedCategories.forEach((category) => {
    const rawMetric = rawMetricsByCategory[mapCategory(category)]

    if (!rawMetric) {
      return
    }

    normalizedMetrics[category] = normalizeMetric(rawMetric)
  })

  return normalizedMetrics
}

const getDefaultNormalizedMemberMetrics = (
  metricsByCategory: TeamManagementMemberMetricsByCategory,
  memberMetricCategory?: MemberMetricCategory
) => {
  if (metricsByCategory.all) {
    return metricsByCategory.all
  }

  if (memberMetricCategory && metricsByCategory[memberMetricCategory]) {
    return metricsByCategory[memberMetricCategory] as TeamManagementMemberMetrics
  }

  const firstAvailableMetrics = Object.values(metricsByCategory).find(
    (item) => Boolean(item)
  )

  return firstAvailableMetrics || { ...DEFAULT_MEMBER_METRICS }
}

const mapMemberMetricCategoryToLicensingCategory = (
  memberMetricCategory?: MemberMetricCategory
): LicensingTeamManagementCategory => {
  switch (memberMetricCategory) {
    case "profileVerification":
      return "profileVerifications"
    case "applications":
    case "enquiries":
    case "appeals":
    case "refunds":
      return memberMetricCategory
    case "all":
    default:
      return "all"
  }
}

const mapMemberMetricCategoryToContentCategory = (
  memberMetricCategory?: MemberMetricCategory
): ContentTeamManagementCategory => {
  switch (memberMetricCategory) {
    case "applications":
    case "enquiries":
    case "appeals":
    case "refunds":
      return memberMetricCategory
    case "all":
    case "profileVerification":
    default:
      return "all"
  }
}

const mapMemberMetricCategoryToCustomerHappinessCategory = (
  memberMetricCategory?: MemberMetricCategory
): CustomerHappinessTeamManagementCategory => {
  switch (memberMetricCategory) {
    case "enquiries":
    case "appeals":
    case "refunds":
      return memberMetricCategory
    case "all":
    case "applications":
    case "profileVerification":
    default:
      return "all"
  }
}

const mapMemberMetricCategoryToInspectionCategory = (
  memberMetricCategory?: MemberMetricCategory
): InspectionTeamManagementCategory => {
  switch (memberMetricCategory) {
    case "inspectionTasks":
    case "enquiries":
    case "appeals":
    case "refunds":
      return memberMetricCategory
    case "violations":
      return "violations"
    case "all":
    case "applications":
    case "profileVerification":
    default:
      return "all"
  }
}

interface ApiTeamManagementSummaryCategory {
  category?: string | null
  categoryDisplay?: string | null
  todoCount?: number | null
}

interface ApiTeamManagementSummary {
  todoCount?: number | null
  completedCount?: number | null
  urgentCount?: number | null
  categories?: ApiTeamManagementSummaryCategory[] | null
}

const normalizeApiTeamManagementSummary = (
  response?: ApiTeamManagementSummary | null
): TeamManagementSummary => {
  const categoryCounts = {
    applicationsCount: 0,
    profileVerificationsCount: 0,
    enquiriesCount: 0,
    refundsCount: 0,
    appealsCount: 0,
    inspectionTasksCount: 0,
    violationsCount: 0,
  }
  const categoryLabels: Partial<Record<TeamTaskCategory, string>> = {}
  const categoryOptions: TeamManagementOption[] = []
  const categories = Array.isArray(response?.categories)
    ? response.categories
    : []

  categories.forEach((item) => {
    const category = getTeamManagementTaskCategoryKey(item?.category)
    if (!category) {
      return
    }

    const count = Number(item?.todoCount ?? 0)
    if (category === "applications") {
      categoryCounts.applicationsCount = count
    }
    if (category === "profileVerifications") {
      categoryCounts.profileVerificationsCount = count
    }
    if (category === "enquiries") {
      categoryCounts.enquiriesCount = count
    }
    if (category === "refunds") {
      categoryCounts.refundsCount = count
    }
    if (category === "appeals") {
      categoryCounts.appealsCount = count
    }
    if (category === "inspectionTasks") {
      categoryCounts.inspectionTasksCount = count
    }
    if (category === "violations") {
      categoryCounts.violationsCount = count
    }
    if (item?.categoryDisplay) {
      categoryLabels[category] = item.categoryDisplay
    }

    categoryOptions.push({
      label: String(item?.categoryDisplay || item?.category || category),
      value: category,
    })
  })

  return {
    todoCount: Number(response?.todoCount ?? 0),
    completedCount: Number(response?.completedCount ?? 0),
    urgentCount: Number(response?.urgentCount ?? 0),
    categoryLabels,
    categoryOptions,
    ...categoryCounts,
  }
}

export const getTeamManagementTaskCategoryKey = (
  value?: string | null
): TeamTaskCategory | null => {
  const rawValue = String(value || "").trim()
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "")

  switch (normalizedValue) {
    case "profileverification":
    case "profileverifications":
    case "التحققمنالملفالشخصي":
      return "profileVerifications"
    case "enquiries":
    case "enquiry":
    case "enquiriescomplaints":
    case "enquirycomplaints":
    case "الاستفساراتأوالشكاوى":
    case "الاستفساراتوالشكاوى":
    case "الاستفسارات":
    case "الشكاوى":
      return "enquiries"
    case "refund":
    case "refunds":
    case "الاستردادات":
    case "الاسترداد":
      return "refunds"
    case "appeal":
    case "appeals":
    case "الطعون":
    case "الطعن":
      return "appeals"
    case "inspectiontask":
    case "inspectiontasks":
    case "التفتيش":
    case "مهامالتفتيش":
      return "inspectionTasks"
    case "violation":
    case "violations":
    case "المخالفات":
    case "المخالفة":
      return "violations"
    case "application":
    case "applications":
    case "serviceapplication":
    case "serviceapplications":
    case "الطلبات":
    case "طلب":
    case "طلباتالخدمة":
    case "طلبالخدمة":
      return "applications"
    default:
      if (rawValue === "all" || rawValue === "الكل") {
        return null
      }
      return null
  }
}

const normalizeTeamManagementTaskCategory = (
  value?: string | null,
  fallback: TeamTaskCategory = "applications"
): TeamTaskCategory => {
  return getTeamManagementTaskCategoryKey(value) || fallback
}

const normalizeLicensingStatusFilterValue = (value?: string | null) => {
  const normalizedValue = String(value || "").trim()
  if (!normalizedValue) {
    return undefined
  }

  const matchedStatusId = normalizedValue.match(/:(\d+)$/)
  if (matchedStatusId?.[1]) {
    return matchedStatusId[1]
  }

  return normalizedValue
}

const normalizeStableCodeFilterValue = (value?: string | null) => {
  const normalizedValue = String(value || "").trim()
  return normalizedValue || undefined
}

const normalizeTeamManagementMetadataOptions = <
  T extends { code?: string | null; display?: string | null }
>(
  items?: T[] | null
): TeamManagementOption[] =>
  (items || []).reduce<TeamManagementOption[]>((result, item) => {
    const value = String(item?.code || "").trim()
    if (!value) {
      return result
    }

    result.push({
      label: String(item?.display || value),
      value,
    })

    return result
  }, [])

const normalizeTeamManagementCategoryOptions = <
  T extends { code?: string | null; display?: string | null }
>(
  items?: T[] | null
): TeamManagementOption[] => {
  const optionByValue = new Map<TeamTaskCategory, TeamManagementOption>()

  for (const item of items || []) {
    const normalizedCategory =
      getTeamManagementTaskCategoryKey(item?.code) ||
      getTeamManagementTaskCategoryKey(item?.display)

    if (!normalizedCategory) {
      continue
    }

    if (optionByValue.has(normalizedCategory)) {
      continue
    }

    optionByValue.set(normalizedCategory, {
      label: String(item?.display || item?.code || normalizedCategory),
      value: normalizedCategory,
    })
  }

  return Array.from(optionByValue.values())
}

const normalizeLicensingMetadataOptions = (
  items?: LicensingTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementMetadataOptions(items)

const normalizeLicensingCategoryMetadataOptions = (
  items?: LicensingTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementCategoryOptions(items)

const normalizeContentMetadataOptions = (
  items?: ContentTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementMetadataOptions(items)

const normalizeContentCategoryMetadataOptions = (
  items?: ContentTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementMetadataOptions(
    items?.filter(
      (item) => {
        const code = String(item?.code || "").trim().toLowerCase()
        const display = String(item?.display || "").trim().toLowerCase()
        return (
          !["all", "الكل"].includes(code) &&
          !["all", "الكل"].includes(display)
        )
      }
    )
  )

const normalizeCustomerHappinessMetadataOptions = (
  items?: CustomerHappinessTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementMetadataOptions(items)

const normalizeCustomerHappinessCategoryMetadataOptions = (
  items?: CustomerHappinessTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementCategoryOptions(items)

const normalizeInspectionMetadataOptions = (
  items?: InspectionTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementMetadataOptions(items)

const normalizeInspectionCategoryMetadataOptions = (
  items?: InspectionTeamManagementMetadataOptionDto[] | null
): TeamManagementOption[] =>
  normalizeTeamManagementCategoryOptions(items)

const normalizeTeamManagementDetailTarget = (
  value: string | null | undefined,
  scope: TeamManagementScope
) => {
  const normalizedValue = String(value || "").trim()
  if (!normalizedValue) {
    return null
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    try {
      const url = new URL(normalizedValue)
      return `${url.pathname}${url.search}${url.hash}`
    } catch {
      return normalizedValue
    }
  }

  if (normalizedValue.startsWith("/")) {
    return normalizedValue
  }

  const sanitizedValue = normalizedValue.replace(/^\.?\//, "")
  if (
    ["licensing/", "content/", "happiness/", "inspection/"].some((prefix) =>
      sanitizedValue.startsWith(prefix)
    )
  ) {
    return `/${sanitizedValue}`
  }

  const scopePathPrefix: Record<TeamManagementScope, string> = {
    licensing: "/licensing",
    content: "/content",
    customer: "/happiness",
    inspection: "/inspection",
  }

  return `${scopePathPrefix[scope]}/${sanitizedValue}`
}

interface TeamManagementDetailRoutePreset {
  path: string
  fallbackQueryKey: string
}

export interface BuildTeamManagementTaskDetailNavigationParams {
  scope: TeamManagementScope
  taskCategory: TeamTaskCategory
  sourceType?: string
  sourceId?: string
  taskNo?: string
  canReassign?: boolean
  detailTarget?: string | null
}

interface ParsedTeamManagementDetailTarget {
  path: string | null
  query: Record<string, string>
}

const TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE = "teamManagementTask"

const parseTeamManagementDetailTarget = (
  value?: string | null
): ParsedTeamManagementDetailTarget => {
  const normalizedValue = String(value || "").trim()
  if (!normalizedValue) {
    return {
      path: null,
      query: {},
    }
  }

  try {
    const parsedUrl = new URL(normalizedValue, "https://team-management.local")
    const query: Record<string, string> = {}
    parsedUrl.searchParams.forEach((queryValue, key) => {
      if (!(key in query)) {
        query[key] = queryValue
      }
    })

    return {
      path: parsedUrl.pathname || null,
      query,
    }
  } catch {
    return {
      path: normalizedValue,
      query: {},
    }
  }
}

const createTeamManagementDetailRoutePreset = (
  path: string,
  fallbackQueryKey: string
): TeamManagementDetailRoutePreset => ({
  path,
  fallbackQueryKey,
})

const TEAM_MANAGEMENT_DETAIL_ROUTE_PRESETS: Partial<
  Record<
    TeamManagementScope,
    Partial<Record<TeamTaskCategory, TeamManagementDetailRoutePreset>>
  >
> = {
  licensing: {
    applications: createTeamManagementDetailRoutePreset(
      "/licensing/team-management/applicationsDetails",
      "taskId"
    ),
    profileVerifications: createTeamManagementDetailRoutePreset(
      "/licensing/team-management/profileDetails",
      "id"
    ),
    enquiries: createTeamManagementDetailRoutePreset(
      "/licensing/team-management/ticketsDetails",
      "id"
    ),
    refunds: createTeamManagementDetailRoutePreset(
      "/licensing/team-management/refundsDetails",
      "refundId"
    ),
    appeals: createTeamManagementDetailRoutePreset(
      "/licensing/team-management/appealsDetails",
      "appealId"
    ),
  },
  content: {
    applications: createTeamManagementDetailRoutePreset(
      "/content/team-management/applicationsDetails",
      "taskId"
    ),
    enquiries: createTeamManagementDetailRoutePreset(
      "/content/team-management/ticketsDetails",
      "id"
    ),
    refunds: createTeamManagementDetailRoutePreset(
      "/content/team-management/refundsDetails",
      "refundId"
    ),
    appeals: createTeamManagementDetailRoutePreset(
      "/content/team-management/appealsDetails",
      "appealId"
    ),
    violations: createTeamManagementDetailRoutePreset(
      "/content/team-management/violationsDetails",
      "violationId"
    ),
  },
  customer: {
    enquiries: createTeamManagementDetailRoutePreset(
      "/happiness/team-management/ticketsDetails",
      "id"
    ),
    refunds: createTeamManagementDetailRoutePreset(
      "/happiness/team-management/refundsDetails",
      "refundId"
    ),
    appeals: createTeamManagementDetailRoutePreset(
      "/happiness/team-management/appealsDetails",
      "appealId"
    ),
  },
  inspection: {
    enquiries: createTeamManagementDetailRoutePreset(
      "/inspection/tasks/ticketsDetails",
      "id"
    ),
    refunds: createTeamManagementDetailRoutePreset(
      "/inspection/tasks/refundsDetails",
      "refundId"
    ),
    appeals: createTeamManagementDetailRoutePreset(
      "/inspection/tasks/appealsDetails",
      "appealId"
    ),
    violations: createTeamManagementDetailRoutePreset(
      "/inspection/tasks/violationsDetails",
      "violationId"
    ),
  },
}

const getTeamManagementDetailRoutePreset = (
  scope: TeamManagementScope,
  taskCategory: TeamTaskCategory
): TeamManagementDetailRoutePreset | null =>
  TEAM_MANAGEMENT_DETAIL_ROUTE_PRESETS[scope]?.[taskCategory] || null

const buildTeamManagementDetailContextQuery = (
  scope: TeamManagementScope,
  options?: {
    canReassign?: boolean
    sourceType?: string
    sourceId?: string
  }
): Record<string, string> => ({
  breadcrumbMode: TEAM_MANAGEMENT_DETAIL_BREADCRUMB_MODE,
  teamManagementScope: scope,
  pageTitleKey: "menu.taskDetails",
  sourcePage: "teamManagement",
  canReassign: options?.canReassign ? "true" : "false",
  ...(options?.sourceType
    ? { teamTaskSourceType: String(options.sourceType).trim() }
    : {}),
  ...(options?.sourceId
    ? { teamTaskSourceId: String(options.sourceId).trim() }
    : {}),
})

export const buildTeamManagementTaskDetailNavigation = ({
  scope,
  taskCategory,
  sourceType,
  sourceId,
  taskNo,
  canReassign,
  detailTarget,
}: BuildTeamManagementTaskDetailNavigationParams): Partial<TeamManagementTaskItem> => {
  const normalizedDetailTarget = normalizeTeamManagementDetailTarget(
    detailTarget,
    scope
  )
  const preset = getTeamManagementDetailRoutePreset(scope, taskCategory)
  const parsedTarget = parseTeamManagementDetailTarget(normalizedDetailTarget)
  const sourceDetailId = String(sourceId || "").trim()
  const fallbackId =
    sourceDetailId ||
    (scope === "inspection" ? "" : String(taskNo || "").trim())
  const detailRouteQuery: Record<
    string,
    string | number | boolean | null | undefined
  > = {
    ...parsedTarget.query,
    ...buildTeamManagementDetailContextQuery(scope, {
      canReassign,
      sourceType,
      sourceId,
    }),
  }

  if (preset?.fallbackQueryKey) {
    if (fallbackId) {
      detailRouteQuery[preset.fallbackQueryKey] = fallbackId
    } else if (scope === "inspection") {
      delete detailRouteQuery[preset.fallbackQueryKey]
    }
  }

  const parsedTargetPath = parsedTarget.path
  if (
    parsedTargetPath &&
    preset?.path.toLowerCase() === parsedTargetPath.toLowerCase()
  ) {
    return {
      detailTarget: parsedTargetPath,
      detailRouteQuery,
    }
  }

  if (preset) {
    return {
      detailRoutePath: preset.path,
      detailRouteQuery,
    }
  }

  if (parsedTarget.path) {
    return {
      detailTarget: parsedTarget.path,
      detailRouteQuery,
    }
  }

  return {}
}

const buildUniqueStatusOptions = (items: TeamManagementTaskItem[]) =>
  Array.from(
    items.reduce<Map<string, TeamManagementOption>>((result, item) => {
      const value = String(item.statusCode || item.status || "").trim()
      if (!value || result.has(value)) {
        return result
      }

      result.set(value, {
        label: String(item.statusLabel || item.status || value),
        value,
      })

      return result
    }, new Map()).values()
  )

const parseTeamManagementTaskIdentifier = (taskId: string) => {
  const [sourceType, ...sourceIdParts] = String(taskId || "").split("::")
  const sourceId = sourceIdParts.join("::")

  if (!sourceType || !sourceId) {
    return null
  }

  return {
    sourceType,
    sourceId,
  }
}

const normalizeTeamManagementReassignTasks = (
  payload: TeamManagementReassignPayload
): TeamManagementReassignTask[] => {
  if (Array.isArray(payload.tasks) && payload.tasks.length) {
    return payload.tasks.reduce<TeamManagementReassignTask[]>((result, item) => {
      const sourceType = String(item?.sourceType || "").trim()
      const sourceId = String(item?.sourceId || "").trim()

      if (!sourceType || !sourceId) {
        return result
      }

      result.push({
        sourceType,
        sourceId,
      })

      return result
    }, [])
  }

  return (payload.taskIds || [])
    .map(parseTeamManagementTaskIdentifier)
    .filter(
      (
        item
      ): item is {
        sourceType: string
        sourceId: string
      } => Boolean(item)
    )
}

const requireLegacyMemberId = (memberId?: string) => {
  if (!memberId) {
    throw new Error("memberId is required")
  }

  return memberId
}

const requireTeamManagementMemberId = (memberId?: string) => {
  if (!memberId) {
    throw new Error("memberId is required")
  }

  return memberId
}

const formatTeamManagementMemberDate = (value?: string | null) => {
  if (!value) {
    return undefined
  }

  const dateValue = moment(value)
  if (!dateValue.isValid()) {
    return undefined
  }

  return dateValue.format("YYYY-MM-DD")
}

const formatLicensingMemberDate = formatTeamManagementMemberDate

const normalizeNumber = (value?: number | null) =>
  value == null || Number.isNaN(Number(value)) ? null : Number(value)

export const getTeamManagementScopeMeta = (scope: TeamManagementScope) =>
  TEAM_MANAGEMENT_SCOPE_METADATA[scope]

export const getResolvedTeamManagementScopeMeta = (
  scope: TeamManagementScope,
  adapterMode: TeamManagementAdapterMode = "default"
) => {
  const adapter = getTeamManagementScopeAdapter(scope, adapterMode)

  return {
    permissions: adapter.permissions,
    capabilities: adapter.capabilities,
    supportedTaskCategories: adapter.supportedTaskCategories,
    supportedMemberMetricCategories: adapter.supportedMemberMetricCategories,
  }
}

export const checkTeamManagementAccess = (
  scope: TeamManagementScope,
  adapterMode: TeamManagementAdapterMode = "default"
) => getTeamManagementScopeAdapter(scope, adapterMode).checkAccess()

export const getTeamManagementSummary = (
  params: TeamManagementSummaryParams
) => getTeamManagementScopeAdapter(params.scope, params.adapterMode).getSummary(params)

export const getTeamManagementTaskPage = (
  params: TeamManagementTaskPageParams
) => getTeamManagementScopeAdapter(params.scope, params.adapterMode).getTaskPage(params)

export const exportTeamManagementTasks = (params: TeamManagementExportParams) =>
  getTeamManagementScopeAdapter(params.scope, params.adapterMode).exportTasks(params)

export const getTeamManagementMemberCards = (
  params: TeamManagementMemberCardsParams
) => getTeamManagementScopeAdapter(params.scope, params.adapterMode).getMemberCards(params)

export const getTeamManagementMembersPanelData = (
  params: TeamManagementMembersPanelDataParams
) =>
  getTeamManagementScopeAdapter(
    params.scope,
    params.adapterMode
  ).getMembersPanelData(params)

export const getTeamManagementTaskFilterOptions = (
  params: TeamManagementTaskFilterOptionsParams
) =>
  getTeamManagementScopeAdapter(
    params.scope,
    params.adapterMode
  ).getTaskFilterOptions(params)

export const getTeamManagementMembers = async (
  params: TeamManagementMemberOptionsParams
): Promise<TeamManagementMemberOption[]> =>
  getTeamManagementScopeAdapter(params.scope, params.adapterMode).getMemberOptions(params)

export const getTeamManagementLeaveReasonOptions = (
  params: TeamManagementScopedParams
) =>
  getTeamManagementScopeAdapter(
    params.scope,
    params.adapterMode
  ).getLeaveReasonOptions()

export const reassignTeamManagementTasks = (
  payload: TeamManagementReassignPayload
) => getTeamManagementScopeAdapter(payload.scope, payload.adapterMode).reassignTasks(payload)

export const markTeamManagementMemberLeave = (
  payload: TeamManagementMarkLeavePayload
) => getTeamManagementScopeAdapter(payload.scope, payload.adapterMode).markEmergencyLeave(payload)

export const resumeTeamManagementMemberWork = (
  payload: TeamManagementResumeWorkPayload
) => getTeamManagementScopeAdapter(payload.scope, payload.adapterMode).resumeWork(payload)

export const processTeamManagementProfileVerification = ({
  scope,
  profileId,
  payload,
}: TeamManagementProcessProfileVerificationParams) => {
  if (scope !== "licensing") {
    throw new Error("Profile verification processing is only supported for licensing")
  }

  return processLicensingTeamManagementProfileVerification(profileId, payload)
}
