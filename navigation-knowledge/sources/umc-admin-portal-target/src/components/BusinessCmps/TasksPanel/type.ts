interface ITaskStatus {
  completedCount: number
  externalApproveCount: number
  pendingModificationCount: number
  pendingReviewCount: number
  todoCount: number
  pendingDispositionCount: number
  dispositionVerificationCount: number
}

interface IProps {
  status: ITaskStatus
  variant?: "default" | "applicationStatistics"
}

export type { ITaskStatus, IProps }
