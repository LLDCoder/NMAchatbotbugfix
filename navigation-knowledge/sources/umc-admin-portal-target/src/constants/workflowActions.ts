import i18n from '@/localization/config'
import { normalizePortalLanguage } from "@/localization/language"

export interface WorkflowActionConfig {
  label: string
  action: number
}

export interface WorkflowActionOption extends WorkflowActionConfig {
  approvalAction: string
  labelKey: string
}

const CONDITIONAL_MATERIAL_DISPOSITION_ACTION =
  "ApproveWithConditionalMaterialDisposition"
export const CONDITIONAL_MATERIAL_DISPOSITION_SERVICE_CODE = "302"

const translateWorkflowAction = (labelKey: string, language?: string | null) =>
  i18n.t(
    labelKey,
    language ? { lng: normalizePortalLanguage(language) } : undefined
  )

const normalizeWorkflowActionLabel = (value?: string) =>
  (value || "").trim().toLowerCase()

const getWorkflowActionDefaultLabels = (labelKey: string) =>
  ["en", "ar"]
    .map((lng) => i18n.t(labelKey, { lng }))
    .filter((label): label is string => typeof label === "string" && !!label)

const isWorkflowActionDefaultLabel = (
  label: string,
  option: WorkflowActionOption
) => {
  const normalizedLabel = normalizeWorkflowActionLabel(label)

  return getWorkflowActionDefaultLabels(option.labelKey).some(
    (defaultLabel) =>
      normalizeWorkflowActionLabel(defaultLabel) === normalizedLabel
  )
}

const createWorkflowActionOption = (
  labelKey: string,
  action: number,
  approvalAction: string,
  language?: string | null
): WorkflowActionOption => ({
  label: translateWorkflowAction(labelKey, language),
  labelKey,
  action,
  approvalAction,
})

const localizeWorkflowActionOption = (
  option: WorkflowActionOption,
  language?: string | null
): WorkflowActionOption => ({
  ...option,
  label: translateWorkflowAction(option.labelKey, language),
})

const WORKFLOW_APPROVE_ACTION_DEFINITIONS = [
  {
    labelKey: "workflowActions.approveDirectly",
    action: 1,
    approvalAction: "Approval",
  },
  // {
  //   labelKey: "workflowActions.approveWithConditionalMaterialDisposition",
  //   action: 2,
  //   approvalAction: CONDITIONAL_MATERIAL_DISPOSITION_ACTION,
  // },
  {
    labelKey: "workflowActions.bookContentApproval",
    action: 3,
    approvalAction: "BookContentApproval",
  },
  {
    labelKey: "workflowActions.cinemaVisualMediaContentApproval",
    action: 4,
    approvalAction: "CinemaVisualMediaContentApproval",
  },
  {
    labelKey: "workflowActions.videoGameContentApproval",
    action: 5,
    approvalAction: "VideoGameContentApproval",
  },
  {
    labelKey: "workflowActions.newspaperMagazineOtherMediaContentApproval",
    action: 6,
    approvalAction: "NewspaperMagazineOtherMediaContentApproval",
  },
]

const WORKFLOW_REJECT_ACTION_DEFINITIONS = [
  {
    labelKey: "workflowActions.rejectDirectly",
    action: 101,
    approvalAction: "Rejected",
  },
  {
    labelKey: "workflowActions.rejectAndRouteToNextStep",
    action: 102,
    approvalAction: "RejectedWithReview",
  },
  // {
  //   labelKey: "workflowActions.rejectWithMaterialDisposition",
  //   action: 103,
  //   approvalAction: "RejectedWithMaterialDisposition",
  // },
  {
    labelKey: "workflowActions.bookContentRejection",
    action: 104,
    approvalAction: "BookContentRejection",
  },
  {
    labelKey: "workflowActions.cinemaVisualMediaContentRejection",
    action: 105,
    approvalAction: "CinemaVisualMediaContentRejection",
  },
  {
    labelKey: "workflowActions.videoGameContentRejection",
    action: 106,
    approvalAction: "VideoGameContentRejection",
  },
  {
    labelKey: "workflowActions.newspaperMagazineOtherMediaContentRejection",
    action: 107,
    approvalAction: "NewspaperMagazineOtherMediaContentRejection",
  },
  {
    labelKey: "workflowActions.requestModification",
    action: 200,
    approvalAction: "RequestModification",
  },
]

export const WORKFLOW_APPROVE_ACTION_OPTIONS: WorkflowActionOption[] =
  WORKFLOW_APPROVE_ACTION_DEFINITIONS.map((item) =>
    createWorkflowActionOption(item.labelKey, item.action, item.approvalAction)
  )

export const WORKFLOW_REJECT_ACTION_OPTIONS: WorkflowActionOption[] =
  WORKFLOW_REJECT_ACTION_DEFINITIONS.map((item) =>
    createWorkflowActionOption(item.labelKey, item.action, item.approvalAction)
  )

export const getWorkflowApproveActionOptions = (
  serviceCode?: string | null,
  language?: string | null
): WorkflowActionOption[] =>
  WORKFLOW_APPROVE_ACTION_DEFINITIONS.filter(
    (item) =>
      item.approvalAction !== CONDITIONAL_MATERIAL_DISPOSITION_ACTION ||
      serviceCode === CONDITIONAL_MATERIAL_DISPOSITION_SERVICE_CODE
  ).map((item) =>
    createWorkflowActionOption(item.labelKey, item.action, item.approvalAction, language)
  )

export const getWorkflowRejectActionOptions = (
  language?: string | null
): WorkflowActionOption[] =>
  WORKFLOW_REJECT_ACTION_DEFINITIONS.map((item) =>
    createWorkflowActionOption(item.labelKey, item.action, item.approvalAction, language)
  )

export const DEFAULT_APPROVE_ACTION = WORKFLOW_APPROVE_ACTION_OPTIONS[0]
export const DEFAULT_REJECT_ACTION = WORKFLOW_REJECT_ACTION_OPTIONS[0]

const LEGACY_REJECT_ACTION_MAP: Record<string, WorkflowActionOption> = {
  "1": WORKFLOW_REJECT_ACTION_OPTIONS[0],
  "2": WORKFLOW_REJECT_ACTION_OPTIONS[1],
}

const findActionOption = (
  options: WorkflowActionOption[],
  action: unknown
) => options.find((item) => String(item.action) === String(action))

export const resolveWorkflowActionConfig = (
  value: unknown,
  fallback: WorkflowActionOption,
  options: WorkflowActionOption[],
  language?: string | null
): WorkflowActionOption => {
  if (!value || typeof value === "boolean") {
    return localizeWorkflowActionOption(fallback, language)
  }

  const rawAction = (value as Partial<WorkflowActionConfig>).action
  const isRejectOptions =
    fallback.action === DEFAULT_REJECT_ACTION.action ||
    options.some((item) => item.action === DEFAULT_REJECT_ACTION.action)
  const legacyAction =
    isRejectOptions
      ? LEGACY_REJECT_ACTION_MAP[String(rawAction)]
      : undefined
  const matchedAction = legacyAction || findActionOption(options, rawAction)

  if (matchedAction) {
    const savedLabel =
      typeof (value as Partial<WorkflowActionConfig>).label === "string"
        ? (value as Partial<WorkflowActionConfig>).label as string
        : ""

    return {
      ...matchedAction,
      label:
        savedLabel && !isWorkflowActionDefaultLabel(savedLabel, matchedAction)
          ? savedLabel
          : translateWorkflowAction(matchedAction.labelKey, language),
    }
  }

  return localizeWorkflowActionOption(fallback, language)
}

export const safeParseWorkflowActions = (buttonJson?: string | null) => {
  if (!buttonJson) return {}

  try {
    return JSON.parse(buttonJson) as Record<string, unknown>
  } catch (error) {
    console.error("Failed to parse workflow actions:", error)
    return {}
  }
}
