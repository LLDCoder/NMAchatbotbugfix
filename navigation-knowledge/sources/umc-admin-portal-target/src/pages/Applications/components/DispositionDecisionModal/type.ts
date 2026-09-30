import type { IApplicationInfo } from "@/store/app-store"
import type { WorkflowActionIntent } from "../../utils/workflowActionRouting"

interface IDispositionDecisionModalProps {
  current: IApplicationInfo
  onOkCb?: () => void
  confirmPermissionCode?:
    | string
    | ((intent: WorkflowActionIntent) => string | undefined)
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
