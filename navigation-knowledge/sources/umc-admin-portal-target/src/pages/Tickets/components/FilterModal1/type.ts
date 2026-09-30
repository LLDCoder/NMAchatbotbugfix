interface IStatus {
  label: string;
  value: string;
}

interface IFilterParams {
  approvalStatus: string[],
  startTime: string | null,
  endTime: string | null
}

interface IProps {
  approvalStatus: IStatus[]
  onSuccess?: (params: IFilterParams) => void
}

interface IFilterModalRef {
  show: () => void
}

export type { IStatus, IProps, IFilterModalRef }