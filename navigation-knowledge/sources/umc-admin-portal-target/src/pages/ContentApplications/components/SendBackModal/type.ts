interface ICurrent {
  serviceId: number,
  id: number,
  applicationDetailId: number,
  processInstanceId: string,
  taskId: string,
}



interface ISendBackProps {
  current: ICurrent
  onOkCb?: () => void
  confirmPermissionCode?: string
  permissionRoutePath?: string
}

interface INode {
  label: string
  value: string
}

interface IFieldType {
  fallbackNode: string
  notes?: string
}

interface ISendBackModalRef {
  show: () => void
}

export type { ISendBackProps, INode, ISendBackModalRef, IFieldType }
