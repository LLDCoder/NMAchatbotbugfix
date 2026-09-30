import type { IApproveParams, ITaskDetails } from "@/services/content"
import type { TaskActionDto } from "@/services/application"
import {
  CONDITIONAL_MATERIAL_DISPOSITION_SERVICE_CODE,
  DEFAULT_APPROVE_ACTION,
  DEFAULT_REJECT_ACTION,
  WORKFLOW_APPROVE_ACTION_OPTIONS,
  WORKFLOW_REJECT_ACTION_OPTIONS,
  type WorkflowActionOption,
  resolveWorkflowActionConfig,
  safeParseWorkflowActions,
} from "@/constants/workflowActions"

export type WorkflowActionIntent = "approve" | "reject"

export const DISPOSITION_APPROVE_WORKFLOW_ACTION = 201
export const DISPOSITION_REJECT_WORKFLOW_ACTION = 202

export type WorkflowActionRoute =
  | "directConfirm"
  | "approveApplicationModal"
  | "rejectApplicationModal"
  | "externalApproveApplicationModal"
  | "externalRejectApplicationModal"
  | "mediaMaterialReportModal"
  | "dispositionApproveModal"
  | "dispositionApproveConfirmModal"
  | "dispositionRejectModal"
  | "requestModificationModal"

export interface ResolvedWorkflowAction {
  intent: WorkflowActionIntent
  route: WorkflowActionRoute
  config: WorkflowActionOption
}

const MEDIA_REPORT_APPROVE_ACTIONS = [3, 4, 5, 6]
const MEDIA_REPORT_REJECT_ACTIONS = [104, 105, 106, 107]

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

export const isDispositionVerificationStatus = (status?: string | null) =>
  ["dispositionverification", "underverification"].includes(
    (status || "").replace(/\s+/g, "").toLowerCase()
  )

export const isConditionalMaterialDispositionService = (
  serviceCode?: string | number | null
) =>
  String(serviceCode ?? "").trim() ===
  String(CONDITIONAL_MATERIAL_DISPOSITION_SERVICE_CODE)

export const resolveTaskWorkflowAction = (
  task:
    | {
        buttonJson?: string | null
        status?: string | null
        statusId?: string | number | null
        taskStatus?: string | null
        serviceCode?: string | number | null
      }
    | undefined,
  intent: WorkflowActionIntent
): ResolvedWorkflowAction => {
  const btnStatus = safeParseWorkflowActions(task?.buttonJson)
  const isExternalApprovalStatus = task?.statusId == 11
  const isDispositionVerification =
    isDispositionVerificationStatus(task?.status) ||
    isDispositionVerificationStatus(task?.taskStatus)

  if (intent === "approve") {
    if (isDispositionVerification) {
      // Service 302 skips the disposition form and only needs a light confirm.
      if (isConditionalMaterialDispositionService(task?.serviceCode)) {
        return {
          intent,
          config: DISPOSITION_APPROVE_PROOF_ACTION,
          route: "dispositionApproveConfirmModal",
        }
      }

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
    const isMediaReportApproveAction = MEDIA_REPORT_APPROVE_ACTIONS.includes(
      config.action
    )

    return {
      intent,
      config,
      route: isMediaReportApproveAction
        ? isExternalApprovalStatus
          ? "externalApproveApplicationModal"
          : "mediaMaterialReportModal"
        : "approveApplicationModal",
    }
  }

  if (isDispositionVerification) {
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

  if (config.action === 200) {
    return { intent, config, route: "requestModificationModal" }
  }

  const isMediaReportRejectAction = MEDIA_REPORT_REJECT_ACTIONS.includes(
    config.action
  )

  return {
    intent,
    config,
    route: isMediaReportRejectAction
      ? isExternalApprovalStatus
        ? "externalRejectApplicationModal"
        : "mediaMaterialReportModal"
      : "rejectApplicationModal",
  }
}

export const buildWorkflowApprovalPayload = (
  task: Partial<ITaskDetails>,
  action: WorkflowActionOption,
  extra?: Partial<IApproveParams>
): IApproveParams => ({
  serviceId: task.serviceId,
  applicationId: task.id,
  applicationDetailId: task.applicationDetailId,
  instanceId: task.processInstanceId,
  taskId: task.taskId,
  workflowAction: action.action,
  workflowActionLabel: action.label,
  ...extra,
})

export const buildExternalWorkflowApprovalPayload = (
  task: Partial<ITaskDetails>,
  action: WorkflowActionOption,
  extra?: Partial<TaskActionDto>
): TaskActionDto => ({
  serviceId: Number(task.serviceId),
  applicationId: Number(task.id),
  applicationDetailId: Number(task.applicationDetailId),
  instanceId: task.processInstanceId || "",
  taskId: task.taskId || "",
  workflowAction: action.action,
  workflowActionLabel: action.label,
  ...extra,
})

export const buildWorkflowActionPayload = (payload: {
  detailedReport?: string
  ageClassification?: string | number
  classificationIds?: number[]
  notes?: unknown[]
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
  }
}
