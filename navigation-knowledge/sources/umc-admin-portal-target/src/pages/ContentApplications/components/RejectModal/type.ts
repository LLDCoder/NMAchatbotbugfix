import type { WorkflowActionConfig } from "@/constants/workflowActions"

interface ICurrent {
  id: number
  serviceId: number
  applicationDetailId: number
  processInstanceId: string
  taskId: string
  buttonJson: string
}

interface IRejectProps {
  current: ICurrent
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IReason {
  label: string
  value: string
}

interface IRejectOptions {
  titleKey: string
}

type IRejectStatus = boolean | WorkflowActionConfig

interface IFieldType {
  rejectReason: string
  rejectReasonFile: string[]
  approvalComment: string
  organization?: string
  hideFromCustomer?: boolean
  isShowRejectNotes?: boolean
}

interface IRejectModalRef {
  show: () => void
}

export type {
  IRejectProps,
  IReason,
  IRejectModalRef,
  IFieldType,
  IRejectOptions,
  IRejectStatus,
}
