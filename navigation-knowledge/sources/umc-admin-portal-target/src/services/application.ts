import request from "@/utils/request"
import type { IApplicationInfo } from "@/store/app-store"
import type { ITeamTasksDto } from "./team"
import { MOCK_APPLICATION_MY_TODO_PAGE_RESPONSE } from "./mocks/applicationMyTodoPage"

export interface ApplicationPageData<TItem> {
  pageIndex: number
  pageSize: number
  total: number
  items: TItem[]
}

export interface ApplicationTaskStatusCount {
  todoCount: number
  pendingReviewCount: number
  pendingModificationCount: number
  externalApproveCount: number
  completedCount: number
  pendingDispositionCount: number
  dispositionVerificationCount: number
}

export interface ApplicationTaskPageData<TItem> {
  statusCount: ApplicationTaskStatusCount
  processInstanceStatus: string[]
  approvalStatus: Array<string | null>
  myDecisionOptions?: Array<string | null>
  page: ApplicationPageData<TItem>
}

export interface ApplicationTaskPageResponse<TItem> {
  isSuccess: boolean
  statusCode: number
  message: string
  data: ApplicationTaskPageData<TItem>
}

export type ITaskStatus = ApplicationTaskStatusCount
export interface TodoPageQueryParams {
  pageSize: number
  pageIndex: number
  sortBy?: string
  sortDirection?: number
  keyword?: string
  startTime?: string | null
  endTime?: string | null
  type?: string
  processInstanceStatus?: string
}

export interface TaskActionDto {
  serviceId: number
  applicationId: number
  applicationDetailId: number
  taskId: string
  approvalAction?: string
  approvalComment?: string
  instanceId: string
  workflowAction: number
  workflowActionLabel?: string
  rejectReasonCode?: string
  rejectReasonFile?: string[]
  actionPayload?: Record<string, unknown>
  hideFromCustomer?:boolean
}

export interface WorkflowActionExecuteResult {
  success?: boolean
  workflowAction?: number
  workflowActionLabel?: string
  approvalResult?: string
  adminStatus?: string
  customerStatus?: string
  customerSubStatus?: string
  processInstanceStatus?: string
  applicationStatus?: string
  nextTaskId?: string | null
  requiresCustomerAction?: boolean
  customerAction?: string
  dueDate?: string
}

export interface WorkflowActionExecuteResponse {
  isSuccess?: boolean
  statusCode?: number
  message?: string
  data?: WorkflowActionExecuteResult | null
}

const WORKFLOW_ACTION_FAILED_MESSAGE = "Workflow action failed"

export const assertWorkflowActionSucceeded = (
  response: WorkflowActionExecuteResponse | undefined
) => {
  const result = response?.data

  if (response?.isSuccess === false || result?.success === false) {
    throw (
      result?.approvalResult ||
        result?.adminStatus ||
        result?.applicationStatus ||
        result?.processInstanceStatus ||
        response?.message ||
        WORKFLOW_ACTION_FAILED_MESSAGE
    )
  }

  return response
}

export interface LegacyTaskActionDto {
  serviceId: number
  applicationId: number
  applicationDetailId: number
  taskId: string
  approvalAction?: string
  approvalComment?: string
  rejectReasonCode?: string
  rejectReasonFile?: string[]
  instanceId: string
  workflowAction: number
}
export interface extraTaskActionDto {
  serviceId: number
  applicationId: number
  applicationDetailId: number
  taskId: string
  approvalAction?: string
  approvalComment?: string
  rejectReasonCode?: string
  rejectReasonFile?: string[]
  instanceId: string
  workflowAction?: number
  workflowActionLabel?: string
  actionPayload?: Record<string, unknown>
  WorkflowAction?: number
}

export interface IMembersTasksDto {
  userId: string
  userName: string
  totalTaskCount: number
  completedTaskCount: number
  maxWorkTaskCount: number
  workload: string
  avgDuration: number
  sla: number
  overdueCount: number
  isLeave: boolean
  leaveTypeNameAr: string
  leaveTypeNameEn: string
  briefDescription: string
  expectedReturnDate: string
  leaveCreatedOn: string
}

export type TTeamTodoPageQueryParams = Partial<TodoPageQueryParams> & {
  approvalStatus?: string
  userId?: string
}

export interface IMembersTaskQueryParams {
  memberId?: string
  keyword?: string
  startTime?: string | null
  endTime?: string | null
}

interface IResData {
  page: ApplicationPageData<ITeamTasksDto>
  processInstanceStatus: string[]
  statusCount: ITaskStatus
}

export interface IDetails {
  id: number
  applicationNumber: string
  serviceId: number
  serviceNameEn: string
  serviceNameAr: string
  serviceCategoryNameEn: string
  serviceCategoryNameAr: string
  serviceTypeId: string
  serviceTypeNameEn: string
  serviceTypeNameAr: string
  sla: number
  slaDescription: string
  aiStatus: number
  assignee: string
  assignedTo: string
  applyForAr: string
  applyForEn: string
  status: string
  submissionTime: string
  userTypeCode: string
  applicationDetailId: number
  processInstanceId: string
  oldProcessInstanceId: string
  taskId: string
  taskStatus: string
  taskCreatedTime: string
  taskDueTime: string
  taskApprovalAt: string
  taskApprovalDepartment: number
  taskApprovalRole: string
  buttonJson: string
  dispositionCaseId?: number | null
  dispositionCase?: {
    caseId?: number | null
  } | null
  duration: number
  isOverdue: boolean
  sort: number
  profileId: number
  userId: string
}

export interface ITimeline {
  title: string
  userId: string
  userName: string
  approvalTime: string
  duration: number
  isSelf: boolean
  reasonEn: string,
  reasonAr: string,
  approvalComment: string,
  reasonFile: string,
  contentReportPdfFileName?: string | null,
}

export interface IApplicationDeliveryInfo {
  id: number
  applicationId: number
  applicationDetailId: number
  courierId: number
  courierNameEn: string | null
  courierNameAr: string | null
  recipientName: string
  emirateId: number | null
  emirateNameEn: string | null
  emirateNameAr: string | null
  regionId: number | null
  regionNameEn: string | null
  regionNameAr: string | null
  areaId: number
  areaNameEn: string | null
  areaNameAr: string | null
  street: string
  addressEn: string | null
  addressAr: string | null
  mobile: string
  mobileCountryCode: string | null
  mobileLocalNumber: string | null
  createdOn: string
  updatedOn: string | null
}

export interface IReviewData {
  detail: IDetails
  formData: string
  applicationTimeline: ITimeline[]
  deliveryInfo: IApplicationDeliveryInfo | null
  bookList: Array<{
    filePath: string
  }>
  dispositionCase?: {
    caseId?: number | null
  } | null
}

export interface RecallApprovalApiResponse<T> {
  isSuccess: boolean
  statusCode: number
  message: string
  data: T | null
}

export type RecallApprovalStatus =
  | "Processing"
  | "SubmissionPrepared"
  | "RestartSubmitted"
  | "Completed"
  | "Failed"
  | "ManualReview"

export interface RecallApprovalEligibilityDto {
  applicationId: number
  isEligible: boolean
  disabledReason: string | null
  pendingPaymentAt: string | null
  recallDeadline: string | null
  lastApprovalTaskId: string | null
}

export interface RecallApprovalSubmitDto {
  recallRequestId: string
  applicationId: number
  status: RecallApprovalStatus
  isIdempotentReplay: boolean
  newTaskId: string | null
  startedOn: string | null
}

export interface IServiceType {
  id: number
  code: string
  scope: string
  nameEn: string
  nameAr: string
  isShown: boolean
  descAr: string
  descEn: string
}

export interface IApplicationStatus {
  id?: number | string | null
  code?: string | null
  nameEn?: string | null
  nameAr?: string | null
  isShown?: boolean | null
}

export type ITaskIds = string[]

export const applicationMyTodoPage = (data: TodoPageQueryParams) => {
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_MOCK_APPLICATION_TODO_PAGE === "true"
  ) {
    return Promise.resolve(MOCK_APPLICATION_MY_TODO_PAGE_RESPONSE)
  }

  return request.post<
    ApplicationTaskPageResponse<IApplicationInfo>,
    ApplicationTaskPageResponse<IApplicationInfo>
  >("/api/Application/MyTodoPage", data)
}

export const applicationMyComplatedPage = (data: TodoPageQueryParams) =>
  request.post<
    ApplicationTaskPageResponse<IApplicationInfo>,
    ApplicationTaskPageResponse<IApplicationInfo>
  >("/api/Application/MyComplatedPage", data)

export const applicationMyApplications = () =>
  request.get("/api/Application/MyApplications")

export const applicationMyReviewDetail = (applicationId: string) =>
  request.get<IReviewData>(`/api/Application/MyReviewDetail/${applicationId}`)

export const getRecallApprovalEligibility = (applicationId: number) =>
  request.get<
    RecallApprovalApiResponse<RecallApprovalEligibilityDto>,
    RecallApprovalApiResponse<RecallApprovalEligibilityDto>
  >(
    `/api/Application/${applicationId}/recall-approval/eligibility`,
    {},
    { skipErrorMessage: true }
  )

export const submitRecallApproval = (
  applicationId: number,
  reason: string,
  idempotencyKey: string
) =>
  request.post<
    RecallApprovalApiResponse<RecallApprovalSubmitDto>,
    RecallApprovalApiResponse<RecallApprovalSubmitDto>
  >(
    `/api/Application/${applicationId}/recall-approval`,
    { reason: reason.trim() },
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      skipErrorMessage: true,
    }
  )

export const taskApprovalAction = (data: TaskActionDto) =>
  request
    .post<WorkflowActionExecuteResponse, WorkflowActionExecuteResponse>(
      "/api/Application/ApproveV2",
      data
    )
    .then(assertWorkflowActionSucceeded)
export const ExternaltaskApprovalAction = (data: TaskActionDto) =>
  request.post("/api/CamundaTask/ExternalApprovalAction", data)

export const legacyTaskApprovalAction = (data: LegacyTaskActionDto) =>
  request
    .post<WorkflowActionExecuteResponse, WorkflowActionExecuteResponse>(
      "/api/Application/ApproveV2",
      data
    )
    .then(assertWorkflowActionSucceeded)
export const extraTaskApprovalAction = (data: extraTaskActionDto) =>
  request
    .post<WorkflowActionExecuteResponse, WorkflowActionExecuteResponse>(
      "/api/Application/ApproveV2",
      data
    )
    .then(assertWorkflowActionSucceeded)
export const applicationMyTeamTodoPage = (data: TTeamTodoPageQueryParams) =>
  request.post<IResData>("/api/Application/MyTeamTodoPage", data)

export const applicationMyTeamComplatedPage = (
  data: TTeamTodoPageQueryParams
) => request.post<IResData>("/api/Application/MyTeamComplatedPage", data)

export const applicationMyTeamMemberTask = (data: IMembersTaskQueryParams) =>
  request.post<IMembersTasksDto[]>("/api/Application/MyTeamMemberTask", data)

export const getServiceConfigServiceType = () =>
  request.get<IServiceType[]>(
    "/api/TypeDictionary/GetTypeDictionaries/ServiceConfigServiceType"
  )

export const applicationIsLeader = () =>
  request.get("/api/Application/IsLeader")

export const applicationUrgentCount = () =>
  request.get("/api/Application/UrgenCount")

export const assignTaskUser = (userId: string, data: ITaskIds) =>
  request.put(`/api/CamundaTask/AssignmentTaskUser?userId=${userId}`, data)

export const exportMyTodoReview = (data: TTeamTodoPageQueryParams) =>
  request.post("/api/Application/ExportMyTodoReview", data)

export const exportMyCompletedReview = (data: TTeamTodoPageQueryParams) =>
  request.post("/api/Application/ExportMyCompletedReview", data)

export const getApplicationStatuses = () =>
  request.get<IApplicationStatus[]>(
    "/api/TypeDictionary/GetTypeDictionaries/ApprovalNodeOrder"
  )

export const getApprovalNodeOrderStatuses = () =>
  request.get<IApplicationStatus[]>(
    "/api/TypeDictionary/GetTypeDictionaries/ApprovalNodeOrder"
  )

export type ApplicationPageByProfileSortField = "sla" | "lastUpdatedTime"

export interface ApplicationPageByProfileParams {
  pageSize: number
  pageIndex: number
  sortBy?: ApplicationPageByProfileSortField
  sortDirection?: 0 | 1
  userId?: string
  profileId?: number
  keyword?: string
  serviceType?: string
  processInstanceStatus?: string
  processInstanceStatusCode?: string
  submissionStartTime?: string
  submissionEndTime?: string
}

export interface ApplicationPageByProfileReport {
  totalCount: number
  licenseCount: number
  contentCount: number
  processingCount?: number
  completedCount?: number
  rejectedCount?: number
  cancelledCount?: number
}

export interface ApplicationPageByProfileItem {
  applicationId?: number | string | null
  applicationNumber?: string | null
  serviceName?: string | null
  serviceCategoryName?: string | null
  type?: string | null
  typeName?: string | null
  status?: string | null
  statusId?: number | string | null
  submissionTime?: string | null
  lastUpdatedTime?: string | null
  createdOn?: string | null
  updatedOn?: string | null
  lastUpdatedOn?: string | null
  lastUpdatedAt?: string | null
  lastUpdated?: string | null
  sla?: number | null
  slaDescription?: string | null
  serviceDepartment?: string | null
  serviceDepartmentId?: number | string | null
  serviceCode?: string | number | null
  taskId?: string | number | null
  statusCode?: string | null
  statusDisplay?: string | null
  userTypeCode?: string | null
  sourceType?: string | null
  sourceId?: string | number | null
  taskNo?: string | null
  taskCategory?: string | null
  taskCategoryCode?: string | null
  taskCategoryDisplay?: string | null
  assignedToUserId?: string | null
  assignedTo?: string | null
  isUrgent?: boolean | null
  canReassign?: boolean | null
  detailTarget?: string | null
  slaInfo?: {
    remainingMinutes?: number | null
    displayText?: string | null
    isOverdue?: boolean | null
    dueOn?: string | null
  } | null
  applyFor?: string | null
  applyForEn?: string | null
  applyForAr?: string | null
  applyForType?: string | null
  profileName?: string | null
}

export interface ApplicationPageByProfilePage {
  pageIndex: number
  pageSize: number
  total: number
  items: ApplicationPageByProfileItem[]
}

export interface ApplicationPageByProfileResponse {
  report: ApplicationPageByProfileReport
  page: ApplicationPageByProfilePage
  processInstanceStatus?: string[]
}

export const applicationPageByProfile = (data: ApplicationPageByProfileParams) =>
  request.post<ApplicationPageByProfileResponse, ApplicationPageByProfileResponse>(
    "/api/Application/ApplicationPageByProfile",
    data
  )

export interface ApplicationSummaryDto {
  applicationId: number
  applicationNumber: string
  serviceName: string
  appliedFor: string
  submissionTime: string
  status?: string
  applicationStatusId?: number
  applicationStatusName?: string
  refundCount?: number
  enquiryCount?: number
  appealCount?: number
  applicationsCount?: number
}

export interface ApplicationSummaryResponse {
  isSuccess?: boolean
  statusCode?: number
  message?: string
  data?: ApplicationSummaryDto | null
}

export const getRefundApplicationSummary = (applicationId: number) =>
  request.get<ApplicationSummaryResponse>(
    `/api/Refund/Admin/ApplicationSummary/${applicationId}`,
    {},
    { skipErrorMessage: true }
  )
