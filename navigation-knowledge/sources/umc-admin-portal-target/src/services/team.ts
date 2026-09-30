import request from "@/utils/request"

interface ITeamTasksDto {
  id: number
  applicationNumber: string
  serviceNameEn: string
  serviceNameAr: string
  serviceCategoryNameEn: string
  serviceCategoryNameAr: string
  serviceTypeEn: string
  serviceTypeAr: string
  sla: number
  slaDescription: string
  applyForAr: string
  applyForEn: string
  assignee: string
  assignedTo: string
  status: string
  submissionTime: string
  taskId: string
  applicationDetailId: number
  userTypeCode: string
  processInstanceId: string
  taskStatus: string
  duration: number
  approvalTime: string
  isOverdue: boolean
  taskCreatedTime: string
  isUrgent: boolean
  profileIsVIP: boolean
}

interface IMembersQueryParams {
  userId: string
  userName: string
}

interface ITeamMemberLeavePayload extends Pick<IMembersQueryParams, "userId"> {
  leaveType?: string
  expectedReturnDate?: string
  briefDescription?: string
}

export type { ITeamTasksDto, IMembersQueryParams, ITeamMemberLeavePayload }

export const applicationMyTeamMembers = (data: Boolean = false) =>
  request.get<IMembersQueryParams[]>(`/api/Team/MyTeamMembers?isLeave=${data}`)

export const applicationMyTeamMemberLeave = (
  data: ITeamMemberLeavePayload
) => request.post("/api/Team/MyTeamMemberLeave", data)

export const applicationMyTeamMemberReturn = (
  data: Pick<IMembersQueryParams, "userId">
) => request.get("/api/Team/MyTeamMemberReturn", data)
