interface IProps {
  userId: string
  onOkCb?: (values: IFieldType) => void
}

interface IFieldType {
  leaveType: string
  expectedReturnDate: string
  briefDescription: string
}

type ILeaveType = { label: string; value: string }

export type { IProps, IFieldType, ILeaveType }
