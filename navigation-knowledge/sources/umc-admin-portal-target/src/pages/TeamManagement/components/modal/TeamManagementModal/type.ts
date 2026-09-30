import type { ReactNode } from "react"
import type { ModalProps } from "antd"

export interface TeamManagementModalProps
  extends Omit<
    ModalProps,
    "className" | "footer" | "onCancel" | "title" | "visible" | "width"
  > {
  visible: boolean
  title: ReactNode
  onCancel: () => void
  onConfirm?: () => void
  children: ReactNode
  className?: string
  footer?: ReactNode | null
  width?: number
  loading?: boolean
  confirmDisabled?: boolean
  cancelDisabled?: boolean
  confirmText?: string
  cancelText?: string
  buttonWidth?: number
  confirmPermissionCode?: string
  permissionRoutePath?: string
}
