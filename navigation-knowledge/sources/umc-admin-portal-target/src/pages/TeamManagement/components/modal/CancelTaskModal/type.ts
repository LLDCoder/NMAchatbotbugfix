import type { ReactNode } from "react"

export interface CancelTaskModalProps {
  visible: boolean
  title: ReactNode
  content: ReactNode
  cancelText: ReactNode
  confirmText: ReactNode
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}
