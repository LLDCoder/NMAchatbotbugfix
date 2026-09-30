import request from "@/utils/request"

export type DispositionReviewWorkflowAction = 201 | 202

export interface DispositionReviewPayload {
  workflowAction: DispositionReviewWorkflowAction
  reviewerComment?: string
  rejectReason?: string | number
  rejectReasonFile?: string[]
  hideFromCustomer?: boolean
}

export interface DispositionReviewResponse {
  success: boolean
  workflowAction: DispositionReviewWorkflowAction
  approvalResult: string
  adminStatus: string
  customerStatus: string
  customerSubStatus?: string | null
  applicationStatus: string
  requiresCustomerAction: boolean
}

export const reviewDispositionCase = (
  caseId: number,
  data: DispositionReviewPayload
) =>
  request.post<DispositionReviewResponse>(
    `/api/disposition-cases/${caseId}/review`,
    data
  )
