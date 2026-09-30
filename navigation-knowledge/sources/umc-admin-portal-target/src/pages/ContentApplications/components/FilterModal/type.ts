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
  /** Called after user clears filters in the modal (footer Reset). */
  onReset?: () => void
}

interface IFilterModalRef {
  show: () => void
  /** Clears modal field state (e.g. toolbar Reset while modal is closed). */
  clear: () => void
}

export type { IStatus, IProps, IFilterModalRef, IFilterParams }