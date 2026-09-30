interface ICurrent {
  id: number
  serviceId: number
  applicationDetailId: number
  processInstanceId: string
  taskId: string
  buttonJson: string
}

interface IRejectProps {
  current?: ICurrent
  onOkCb?: () => void
  onCloseCb?: () => void
}

interface IFieldType {
  rejectReason: string
}

interface IRejectModalRef {
  show: () => void
  setId: (id: number) => void
}
interface NewsRejectModalRef {
  setId: () => void
  Id: number
}
export type { IRejectProps, IRejectModalRef, IFieldType,NewsRejectModalRef }
