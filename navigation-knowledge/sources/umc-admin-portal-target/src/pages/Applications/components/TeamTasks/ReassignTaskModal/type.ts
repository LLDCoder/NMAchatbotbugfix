interface IReassignTaskModalRef {
  show: () => void
}

interface IProps {
  title?: string
  taskIds: string[]
  onOkCb?: () => void
}

export type { IReassignTaskModalRef, IProps }
