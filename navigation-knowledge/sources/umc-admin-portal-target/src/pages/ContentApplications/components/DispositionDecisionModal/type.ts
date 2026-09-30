import type { ITaskDetails } from "@/services/content"
import type { WorkflowActionIntent } from "../../utils/workflowActionRouting"

interface IDispositionDecisionModalProps {
  current: ITaskDetails
  onOkCb?: () => void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IDispositionDecisionModalRef {
  show: (intent: WorkflowActionIntent) => void
}

interface IFieldType {
  attachment?: string[]
  notes?: string
  rejectReason?: string
  hideFromCustomer?:boolean
}

interface IRejectDispositionReasonOption {
  label: string
  value: string
}

export type {
  IDispositionDecisionModalProps,
  IDispositionDecisionModalRef,
  IFieldType,
  IRejectDispositionReasonOption,
}
