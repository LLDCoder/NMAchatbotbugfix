import type { IApplicationInfo } from "@/store/app-store"

interface IRejectProps {
  current: IApplicationInfo
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  onExternalReject?: (values: IFieldType) => Promise<void> | void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IReason {
  label: string
  value: string
}

interface IFieldType {
  rejectReason: string
  rejectReasonFile: string[]
  approvalComment: string
  organization?: string
  isShowRejectNotes?: boolean
  hideFromCustomer?:boolean
}

interface IRejectModalRef {
  show: () => void
}

export type { IRejectProps, IReason, IRejectModalRef, IFieldType }
