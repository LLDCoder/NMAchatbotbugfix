import { useCallback, useState } from "react"

interface IPageInfo {
  total: number
  pageSize: number
  pageIndex: number
}

type IPagination = [IPageInfo, (args: Partial<IPageInfo>) => void]

export const DEFAULT_PAGE_INFO = {
  total: 0,
  pageSize: 10,
  pageIndex: 1,
}
/**
 * pagination hook
 */
export const usePagination = (): IPagination => {
  const [pageInfo, setPageInfo] = useState<IPageInfo>(DEFAULT_PAGE_INFO)

  const setPage = useCallback((args: Partial<IPageInfo>) => {
    setPageInfo((previous) => ({
      ...previous,
      ...args,
    }))
  }, [])

  return [pageInfo, setPage]
}
