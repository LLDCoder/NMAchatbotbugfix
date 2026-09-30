import request from "@/utils/request"

interface IFallbackNodeReqParams {
  instanceId: string
  serviceId: number
}

interface ISendbackParams {
  serviceId: number,
  applicationId: number,
  applicationDetailId: number,
  instanceId: string,
  currentTaskId: string,
  rollbackNodeId: string,
  remarks: string
}

interface ICamundaTask {
  taskId: string,
  processInstanceId: string,
  taskDefinitionKey: string,
  nodeName: string,
  assignee: string,
  status: string,
  variables: string,
  approvalDepartment: number,
  approvalRole: string,
  createdTime: string,
  dueDate: string,
  executionId: string,
  processDefinitionId: string,
  caseExecutionId: string,
  approvalAt: string,
  applicationId: number
}

// Send Back candidate nodes: user-task nodes already passed by a human approver (Approval /
// RejectedWithReview), excluding the current active node, filtered by the caller's module Send Back
// permission. Backend resolves the set from ApprovalRecords, so reject-with-review nodes are
// included (the legacy taskStatusId=15 query missed them, producing an empty dropdown).
export const getFallbackNode = (params: IFallbackNodeReqParams) => {
  const { instanceId, serviceId } = params
  return request.get<ICamundaTask[]>(`/api/CamundaTask/GetSendBackFallbackNodes?instanceId=${instanceId}&serviceId=${serviceId}`)
}

export const sendBackTask = (params: ISendbackParams) => {
  return request.post(`/api/CamundaTask/TaskSendBack`, params)
}