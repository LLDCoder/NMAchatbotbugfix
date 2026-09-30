import type { IApplicationInfo } from "@/store/app-store"

interface IRequestProps {
  current: IApplicationInfo
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IReason {
  label: string
  value: string
}

interface IFieldType {
  rejectReason: string
  approvalComment: string
  attachList: Record<string, any>[]
}

interface IRequestModalRef {
  show: () => void
}

export type { IRequestProps, IReason, IRequestModalRef, IFieldType }
