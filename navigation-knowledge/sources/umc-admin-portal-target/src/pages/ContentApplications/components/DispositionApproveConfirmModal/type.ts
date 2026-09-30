import type { ITaskDetails } from "@/services/content"

interface IDispositionApproveConfirmModalProps {
  current: ITaskDetails
  onOkCb?: () => void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface IDispositionApproveConfirmModalRef {
  show: () => void
}

export type {
  IDispositionApproveConfirmModalProps,
  IDispositionApproveConfirmModalRef,
}
