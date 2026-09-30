interface ICurrent {
  id: number
  serviceId: number
  applicationDetailId: number
  processInstanceId: string
  taskId: string
  buttonJson?: string
}

interface IProps {
  current: ICurrent
  onOkCb?: (nextTaskId?: string | null) => void | Promise<void>
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
