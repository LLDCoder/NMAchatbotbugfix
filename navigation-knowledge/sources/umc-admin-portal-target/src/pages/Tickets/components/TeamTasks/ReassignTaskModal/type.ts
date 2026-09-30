interface IReassignTaskModalRef {
  show: () => void;
}

interface IProps {
  title?: string;
  id: number | null;
  onOkCb?: () => void;
}

export type { IReassignTaskModalRef, IProps }
