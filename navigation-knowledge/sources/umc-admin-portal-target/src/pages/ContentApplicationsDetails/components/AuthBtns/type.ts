import type { ITaskDetails } from "@/services/content"

interface IBtnsEvent {
  reject?: () => void
  requestModification?: () => void
  approve?: () => void
  changeStatus?: () => void
  sendBack?: () => void
  externalApprove?: () => void
}

interface IProps {
  details?: ITaskDetails
  btnsEvent?: IBtnsEvent
}

export type { IProps }
