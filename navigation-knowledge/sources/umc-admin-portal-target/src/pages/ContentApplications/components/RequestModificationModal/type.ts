import type { IAIFiles } from "@/services/content"

interface ICurrent {
  id: number
  serviceId: number
  applicationDetailId: number
  processInstanceId: string
  taskId: string
}

interface IRequestProps {
  current: ICurrent
  modificationFiles?: IAIFiles[]
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IReason {
  label: string
  value: string
}

interface IFieldType {
  rejectReason: string[]
  approvalComment: string
}

interface IRequestModalRef {
  show: () => void
}

export type { IRequestProps, IReason, IRequestModalRef, IFieldType }
