import type { ITaskStatus } from "@/components/BusinessCmps/TasksPanel/type"
import request from "@/utils/request"

// --------- entity ----------
interface ITaskDetails {
  id: number
  applicationNumber: string
  serviceId: number
  serviceCode: number | string
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
  aiResult: string
  assignee: string
  assignedTo: string
  applyForAr: string
  applyForEn: string
  status: string
  statusId:number
  submissionTime: string
  lastUpdatedTime?: string | null
  userTypeCode: string
  applicationDetailId: number
  processInstanceId: string
  oldProcessInstanceId: string
  taskId: string
  taskStatus: string
  myDecision?: string | null
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
  profileIsVIP: boolean
}

interface ITimelineAttachment {
  fileName?: string | null
  key?: string | null
}

interface ITimeline {
  nodeType?: string | null
  title?: string | null
  serviceCode?: number | string | null
  userId?: string | null
  userName?: string | null
  userRole?: string | null
  taskId?: number | string | null
  approvalAction?: number | string | null
  workflowAction?: number | string | null
  workflowActionLabel?: number | string | null
  approveAction?: number | string | null
  rejectAction?: number | string | null
  actionCode?: number | string | null
  serviceConfigAction?: number | string | null
  approvalResult?: string | null
  approvalResultCode?: number | string | null
  approvalTime?: string | null
  duration?: number | string | null
  reasonEn?: string | null
  reasonAr?: string | null
  rejectReasonCode?: string | number | null
  reasonFile?: string | null
  approvalComment?: string | null
  customerComment?: string | null
  isSelf: boolean
  attachments?: Array<string | ITimelineAttachment> | null
  obligationLetterUrl?: string | null
  externalOrganization?: string | null
  prompt?: string | null
  promptCode?: string | null
  itemsApproved?: number | string | null
  itemsRejected?: number | string | null
  terminalReasonVisible?: boolean | null
  autoCreatedInspectionTask?: boolean | null
  serviceConfigDepartmentName?: string | null
  serviceConfigDepartmentNameEn?: string | null
  serviceConfigDepartmentNameAr?: string | null
  departmentName?: string | null
  departmentNameEn?: string | null
  departmentNameAr?: string | null
  department?: string | null
  customerName?: string | null
  customerNameEn?: string | null
  customerNameAr?: string | null
  customer?: string | null
  applicantName?: string | null
  disposalMethod?: string | null
  inspectionTaskId?: number | string | null
  inspectionTaskNo?: string | null
  supervisorReportUrl?: string | null
  supervisorReportFile?: string | null
  contentReportPdfFileName?: string | null
  contentReportPdfUrl?: string | null
  mediaMaterialReportUrl?: string | null
  mediaMaterialReportFile?: string | null
}

interface IAIFiles {
  id: number
  title: string
  authorName: string
  isbn: string
  nationalDepositoryNo: string
  versionNumber: number
  subjectId: number
  printYear: number
  isApproved: number
  subjectSubCategoryId: number
  aiStatus: number
  aiResult: string
  filePath: string
  fileType: string
}

interface ITeamMemberTaskDetail {
  userId: string
  userName: string
  totalTaskCount: number
  completedTaskCount: number
  maxWorkTaskCount: number
  workload: string
  avgDuration: number
  avgDurationDescription: string
  sla: number
  overdueCount: number
  isLeave: boolean
  leaveTypeNameAr: string
  leaveTypeNameEn: string
  briefDescription: string
  expectedReturnDate: string
  leaveCreatedOn: string
}

type TTeamTasks = ITaskDetails & { isUrgent: boolean }

// --------- request / response ---------
interface IRequestParams {
  pageSize?: number
  pageIndex?: number
  sortBy?: string
  sortDirection?: number
  keyword?: string
  serviceCodes?: string | string[]
  processInstanceStatus?: string
  approvalStatus?: string[] | null
  startTime?: string | null
  endTime?: string | null
}

interface IApproveParams {
  serviceId?: number
  applicationId?: number
  applicationDetailId?: number
  instanceId?: string
  taskId?: string
  approvalAction?: string
  workflowAction?: number
  workflowActionLabel?: string
  action?: number
  approvalComment?: string
  rejectReasonCode?: string
  rejectReasonFile?: string[]
  hideFromCustomer?: boolean
  actionPayload?: Record<string, unknown>

}

export interface UpdateApplicationMaterialStatusParams {
  applicationId: number
  applicationDetailId: number
  taskId: string
  materialId: string
  materialIndex: number
  status: 0 | 1
}

export interface UpdateApplicationMaterialStatusResponse {
  isSuccess?: boolean
  statusCode?: number
  message?: string
  data?: {
    materialId: string
    status: 0 | 1
  } | null
}

export interface ContentApproveResponse {
  isSuccess?: boolean
  statusCode?: number
  message?: string
  data?: {
    success?: boolean
    nextTaskId?: string | null
  } | null
}

interface ITeamMemberTaskParams {
  keyword?: string
  memberId?: string
  startTime?: string | null
  endTime?: string | null
}

type TTeamExportParams = Omit<IRequestParams, "serviceTypeId"> & {
  userId: string
}

type TTeamReqParams = Omit<IRequestParams, "serviceTypeId"> & {
  userId: string
}

interface IPageData<T extends object> {
  pageIndex: number
  pageSize: number
  total: number
  items: T[]
}

interface ContentServiceOption {
  serviceCode: string
  serviceNameEn: string
  serviceNameAr: string
}

interface IResponseEntityForPage {
  statusCount: ITaskStatus
  processInstanceStatus: string[]
  approvalStatus?: string[]
  myDecisionOptions?: Array<string | null>
  serviceOptions?: ContentServiceOption[];
  page: IPageData<ITaskDetails>
}

interface IResponseEntityForTeamPage {
  statusCount: ITaskStatus
  processInstanceStatus: string[]
  approvalStatus?: string[]
  page: IPageData<TTeamTasks>
}

interface IResponseEntityForDetail {
  aiRawResponseJson:string
  detail: ITaskDetails
  formData: string
  applicationTimeline: ITimeline[]
  bookList: IAIFiles[]
  applicationFiles?: IAIFiles[]
  isFirstApprovalRejected?: boolean | number | string | null
  dispositionCase?: {
    caseId?: number | null
  } | null
}

export type {
  ITaskDetails,
  ITimeline,
  ITimelineAttachment,
  IAIFiles,
  ITeamMemberTaskDetail,
  IRequestParams,
  ContentServiceOption,
  IApproveParams,
  ITeamMemberTaskParams,
  TTeamExportParams,
  IResponseEntityForDetail,
  TTeamTasks,
  TTeamReqParams,
}

export const getMyTodoPageTasks = (data: IRequestParams) =>
  request.post<IResponseEntityForPage>("/api/Content/MyTodoPage", data)

export const getMyCompletedPageTasks = (data: IRequestParams) =>
  request.post<IResponseEntityForPage>("/api/Content/MyComplatedPage", data)

export const getReviewTaskDetail = (taskId: string) =>
  request.get<IResponseEntityForDetail>(`/api/Content/MyReviewDetail/${taskId}`)

export const approveTask = (data: IApproveParams) =>
  request.post<ContentApproveResponse, ContentApproveResponse>(
    "/api/Content/ApproveV2",
    data
  )

export const updateApplicationMaterialStatus = (
  data: UpdateApplicationMaterialStatusParams
) =>
  request.put<
    UpdateApplicationMaterialStatusResponse,
    UpdateApplicationMaterialStatusResponse
  >(
    `/api/Content/ApplicationMaterials/${encodeURIComponent(data.materialId)}/Status`,
    data
  )

export const exportMyTodoReview = (data: IRequestParams) =>
  request.post("/api/Content/ExportMyTodoReview", data, { responseType: 'blob' })

export const exportMyCompletedReview = (data: IRequestParams) =>
  request.post("/api/Content/ExportMyCompletedReview", data, { responseType: 'blob' })

export const getMyTeamTodoPageTasks = (data: IRequestParams) =>
  request.post<IResponseEntityForTeamPage>("/api/Content/MyTeamTodoPage", data)

export const getMyTeamCompletedPageTasks = (data: IRequestParams) =>
  request.post<IResponseEntityForTeamPage>(
    "/api/Content/MyTeamComplatedPage",
    data
  )

export const getMyTeamMemberTasks = (data: ITeamMemberTaskParams) =>
  request.post<ITeamMemberTaskDetail[]>("/api/Content/MyTeamMemberTask", data)

export const exportMyTeamTodoReview = (data: TTeamExportParams) =>
  request.post("/api/Content/ExportMyTeamTodoReview", data, { responseType: "blob" })

export const exportMyTeamCompletedReview = (data: TTeamExportParams) =>
  request.post("/api/Content/ExportMyTeamCompletedReview", data, { responseType: "blob" })

export const getContentIsLeader = () =>
  request.get<boolean>("/api/Content/IsLeader")

export const getContentUrgentCount = () =>
  request.get<number>("/api/Content/UrgenCount")
