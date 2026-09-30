import type { IApplicationInfo } from "@/store/app-store"

interface IRejectExportProps {
  current: IApplicationInfo
  onOkCb?: () => void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IReason {
  label: string
  value: string
}

interface IFieldType {
  rejectReason: string
  rejectReasonFile: string
  approvalComment: string
}

interface IRejectExportRef {
  show: () => void
}

export type { IRejectExportProps, IReason, IRejectExportRef, IFieldType }
