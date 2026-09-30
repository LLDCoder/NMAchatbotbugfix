import type { ITaskDetails } from "@/services/content"

interface IExternalApprovalProps {
  current: ITaskDetails
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  onAfterConfirm?: (
    values: IFieldType,
    nextTaskId?: string | null,
  ) => Promise<void> | void
  confirmPermissionCode?: string
  permissionRoutePath?: string
  type:number
}

interface IReason {
  label: string
  value: string
}

interface IFieldType {
  organization: string
  notes?: string
}

interface IExternalApprovalRef {
  show: () => void
}

export type {
  IExternalApprovalProps,
  IReason,
  IExternalApprovalRef,
  IFieldType,
}
