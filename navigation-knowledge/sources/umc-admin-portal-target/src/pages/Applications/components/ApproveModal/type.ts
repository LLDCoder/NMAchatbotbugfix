import type { IApplicationInfo } from "@/store/app-store"

interface IProps {
  current: IApplicationInfo
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  onExternalApprove?: (values: IFieldType) => Promise<void> | void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IApproveModalRef {
  show: () => void
}

interface IFieldType {
  attachments: string[]
  notes: string
  organization?: string
}

export type { IProps, IApproveModalRef, IFieldType }
