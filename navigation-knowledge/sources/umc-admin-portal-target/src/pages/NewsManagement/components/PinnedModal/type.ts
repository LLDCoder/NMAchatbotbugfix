import type { IPinnedNewsItem } from "@/services/cms"

interface IProps {
  onOkCb?: () => void
  onCloseCb?: () => void
}

interface IPinnedTableProps {
  data: IPinnedNewsItem[]
  Remove?: (index: number) => void
  onSortChange?: (sortedData: IPinnedNewsItem[]) => void
}

interface IPinnedModalRef {
  show: () => void
}

export type { IPinnedModalRef, IProps, IPinnedTableProps }
