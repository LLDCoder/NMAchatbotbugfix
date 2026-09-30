import {
  DEFAULT_APPROVE_ACTION,
  DEFAULT_REJECT_ACTION,
  WORKFLOW_APPROVE_ACTION_OPTIONS,
  WORKFLOW_REJECT_ACTION_OPTIONS,
  resolveWorkflowActionConfig,
  safeParseWorkflowActions,
  type WorkflowActionOption,
} from "@/constants/workflowActions"
import type { IApplicationInfo } from "@/store/app-store"
import type { TaskActionDto } from "@/services/application"

export type WorkflowActionIntent = "approve" | "reject"

export type WorkflowActionRoute =
  | "approveApplicationModal"
  | "rejectApplicationModal"
  | "mediaMaterialReportModal"
  | "dispositionApproveModal"
  | "dispositionRejectModal"

export interface ResolvedWorkflowAction {
  intent: WorkflowActionIntent
  route: WorkflowActionRoute
  config: WorkflowActionOption
}

export type ApplicationTaskLike = Partial<IApplicationInfo> & {
  applicationDetailId?: number
  processInstanceId?: string
  workflowScenario?: string | null
}

const MEDIA_REPORT_APPROVE_ACTIONS = [3, 4, 5, 6]
const MEDIA_REPORT_REJECT_ACTIONS = [104, 105, 106, 107]
export const DISPOSITION_APPROVE_WORKFLOW_ACTION = 201
export const DISPOSITION_REJECT_WORKFLOW_ACTION = 202

// Canonical backend workflow labels; do not translate or render directly.
const DISPOSITION_APPROVE_PROOF_API_LABEL = "Approve Disposition Proof"
const DISPOSITION_REJECT_PROOF_API_LABEL = "Reject Disposition Proof"

const DISPOSITION_APPROVE_PROOF_ACTION: WorkflowActionOption = {
  label: DISPOSITION_APPROVE_PROOF_API_LABEL,
  labelKey: "workflowActions.approveDirectly",
  action: DISPOSITION_APPROVE_WORKFLOW_ACTION,
  approvalAction: "ApproveDispositionProof",
}
const DISPOSITION_REJECT_PROOF_ACTION: WorkflowActionOption = {
  label: DISPOSITION_REJECT_PROOF_API_LABEL,
  labelKey: "workflowActions.rejectDirectly",
  action: DISPOSITION_REJECT_WORKFLOW_ACTION,
  approvalAction: "RejectDispositionProof",
}

export const normalizeTaskAttachmentFileName = (
  value?: string | string[] | null
): string[] | undefined => {
  if (!value) return undefined
  const files = Array.isArray(value)
    ? value.filter(Boolean)
    : value.split(";").map((item) => item.trim()).filter(Boolean)

  return files.length > 0 ? files : undefined
}

const normalizeStatus = (status?: string | null) =>
  (status || "").replace(/\s+/g, "").toLowerCase()

export const isDispositionVerificationStatus = (status?: string | null) =>
  ["dispositionverification", "underverification"].includes(
    normalizeStatus(status)
  )

export const resolveApplicationWorkflowAction = (
  task: ApplicationTaskLike | undefined,
  intent: WorkflowActionIntent
): ResolvedWorkflowAction => {
  const btnStatus = safeParseWorkflowActions(task?.buttonJson)

  if (intent === "approve") {
    if (isDispositionVerificationStatus(task?.status)) {
      return {
        intent,
        config: DISPOSITION_APPROVE_PROOF_ACTION,
        route: "dispositionApproveModal",
      }
    }

    const config = resolveWorkflowActionConfig(
      btnStatus.approve,
      DEFAULT_APPROVE_ACTION,
      WORKFLOW_APPROVE_ACTION_OPTIONS
    )

    return {
      intent,
      config,
      route: MEDIA_REPORT_APPROVE_ACTIONS.includes(config.action)
        ? "mediaMaterialReportModal"
        : "approveApplicationModal",
    }
  }

  if (isDispositionVerificationStatus(task?.status)) {
    return {
      intent,
      config: DISPOSITION_REJECT_PROOF_ACTION,
      route: "dispositionRejectModal",
    }
  }

  const config = resolveWorkflowActionConfig(
    btnStatus.reject,
    DEFAULT_REJECT_ACTION,
    WORKFLOW_REJECT_ACTION_OPTIONS
  )

  return {
    intent,
    config,
    route: MEDIA_REPORT_REJECT_ACTIONS.includes(config.action)
      ? "mediaMaterialReportModal"
      : "rejectApplicationModal",
  }
}

export const buildApplicationApprovalPayload = (
  task: ApplicationTaskLike,
  action: WorkflowActionOption,
  extra?: Partial<TaskActionDto>
): TaskActionDto => ({
  serviceId: Number(task.serviceId),
  applicationId: Number(task.id),
  applicationDetailId: Number(task.applicationDetailId),
  instanceId: task.processInstanceId || "",
  taskId: task.taskId || "",
  workflowAction: action.action,
  ...extra,
})

export const buildApplicationActionPayload = (payload: {
  detailedReport?: string
  ageClassification?: string | number
  classificationIds?: number[]
  notes?: unknown[]
  organizationCode?: string
}) => {
  return {
    ...(payload.detailedReport ? { detailedReport: payload.detailedReport } : {}),
    ...(payload.ageClassification
      ? { ageClassification: payload.ageClassification }
      : {}),
    ...(payload.classificationIds
      ? { classificationIds: payload.classificationIds }
      : {}),
    ...(payload.notes ? { notes: payload.notes } : {}),
    ...(payload.organizationCode
      ? { organizationCode: payload.organizationCode }
      : {}),
  }
}
