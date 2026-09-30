import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import type { TableProps } from "antd/lib/table"
import type { SorterResult } from "antd/lib/table/interface"
import { useTranslation } from "react-i18next"
import { CustomMessage } from "@/components/common"
import type { IFilterStore } from "@/components/common/FilterTable/type"
import { DEFAULT_PAGE_INFO, usePagination } from "@/hooks/usePagination"
import type {
  TeamManagementAdapterMode,
  TeamManagementScope,
  TeamManagementTaskItem,
  TeamManagementTaskPageParams,
  TeamTaskCategory,
  TeamTaskTab,
} from "@/services/teamManagement"
import { getTeamManagementTaskPage } from "@/services/teamManagement"
import {
  DEFAULT_SORT_BY_TAB,
  type TeamTaskSortState,
} from "../constants"
import { buildTeamTaskRequestPayload } from "../utils"
import type { TeamTasksPanelQueryParams } from "../type"

interface UseTeamTaskDataParams {
  activeFilterStore: IFilterStore
  activeTab: TeamTaskTab
  activeTaskSourceKey?: string
  categoryOptionsRef: MutableRefObject<
    Array<{ label: string; value: TeamTaskCategory }>
  >
  isApplicationTaskOnlyEnabled: boolean
  isControlledPanel: boolean
  mountedRef: MutableRefObject<boolean>
  pageRefreshToken: number
  resetTaskSelection: () => void
  scope: TeamManagementScope
  serviceAdapterMode: TeamManagementAdapterMode
  sourceDefaultCategory?: TeamTaskCategory
  taskTab?: TeamTaskTab
}

interface TeamTaskDataState {
  items: TeamManagementTaskItem[]
  taskTab: TeamTaskTab
}

export const useTeamTaskData = ({
  activeFilterStore,
  activeTab,
  activeTaskSourceKey,
  categoryOptionsRef,
  isApplicationTaskOnlyEnabled,
  isControlledPanel,
  mountedRef,
  pageRefreshToken,
  resetTaskSelection,
  scope,
  serviceAdapterMode,
  sourceDefaultCategory,
  taskTab,
}: UseTeamTaskDataParams) => {
  const { t } = useTranslation()
  const [taskData, setTaskData] = useState<TeamTaskDataState>({
    items: [],
    taskTab: activeTab,
  })
  const dataSource = taskData.taskTab === activeTab ? taskData.items : []
  const [loading, setLoading] = useState(false)
  const [pageInfo, setPage] = usePagination()
  const pageInfoRef = useRef(pageInfo)
  const previousPageRefreshTokenRef = useRef(pageRefreshToken)
  const sortStateRef = useRef<TeamTaskSortState>(DEFAULT_SORT_BY_TAB.todo)
  const tasksRequestIdRef = useRef(0)
  const initialTaskLoadRequestedRef = useRef(false)
  const previousApplicationTaskOnlyRef = useRef(isApplicationTaskOnlyEnabled)
  pageInfoRef.current = pageInfo

  const buildTaskRequestPayload = useCallback(
    (params?: TeamTasksPanelQueryParams): TeamManagementTaskPageParams =>
      buildTeamTaskRequestPayload({
        activeFilterStore,
        activeTab,
        activeTaskSourceKey,
        isApplicationTaskOnlyEnabled,
        pageSize: pageInfo.pageSize,
        params,
        scope,
        serviceAdapterMode,
        sortState: sortStateRef.current,
        sourceDefaultCategory,
      }),
    [
      activeFilterStore,
      activeTab,
      activeTaskSourceKey,
      isApplicationTaskOnlyEnabled,
      pageInfo.pageSize,
      scope,
      serviceAdapterMode,
      sourceDefaultCategory,
    ]
  )

  const loadTasks = useCallback(
    async (params?: TeamTasksPanelQueryParams) => {
      const requestId = tasksRequestIdRef.current + 1
      tasksRequestIdRef.current = requestId
      const requestPayload = buildTaskRequestPayload(params)

      if (mountedRef.current) {
        setTaskData({
          items: [],
          taskTab: requestPayload.taskTab,
        })
        setLoading(true)
      }

      try {
        const response = await getTeamManagementTaskPage(requestPayload)

        if (
          requestId !== tasksRequestIdRef.current ||
          !mountedRef.current
        ) {
          return
        }

        setTaskData({
          items: Array.isArray(response?.page?.items)
            ? response.page.items
            : [],
          taskTab: requestPayload.taskTab,
        })
        setPage({
          pageIndex: response?.page?.pageIndex ?? DEFAULT_PAGE_INFO.pageIndex,
          pageSize: response?.page?.pageSize ?? DEFAULT_PAGE_INFO.pageSize,
          total: response?.page?.total ?? DEFAULT_PAGE_INFO.total,
        })
      } catch {
        if (
          requestId !== tasksRequestIdRef.current ||
          !mountedRef.current
        ) {
          return
        }

        setTaskData({
          items: [],
          taskTab: requestPayload.taskTab,
        })
        setPage(DEFAULT_PAGE_INFO)
        CustomMessage.error(t("teamManagement.messages.failedToLoadTasks"))
      } finally {
        if (
          requestId === tasksRequestIdRef.current &&
          mountedRef.current
        ) {
          setLoading(false)
        }
      }
    },
    [buildTaskRequestPayload, mountedRef, setPage, t]
  )

  const handleTableChange = useCallback<
    NonNullable<TableProps<TeamManagementTaskItem>["onChange"]>
  >(
    (pagination, _filters, sorter, extra) => {
      const nextPageIndex = pagination.current || DEFAULT_PAGE_INFO.pageIndex
      const nextPageSize = pagination.pageSize || pageInfo.pageSize
      const hasPaginationChanged =
        nextPageIndex !== pageInfo.pageIndex ||
        nextPageSize !== pageInfo.pageSize
      let nextSortState = sortStateRef.current

      if (extra?.action === "sort") {
        const defaultSort = DEFAULT_SORT_BY_TAB[activeTab]
        const targetSorter = sorter as SorterResult<TeamManagementTaskItem>

        if (targetSorter.order === "ascend") {
          nextSortState = {
            sortBy: String(
              targetSorter.columnKey ||
                targetSorter.field ||
                defaultSort.sortBy
            ),
            sortDirection: 0,
          }
        } else if (targetSorter.order === "descend") {
          nextSortState = {
            sortBy: String(
              targetSorter.columnKey ||
                targetSorter.field ||
                defaultSort.sortBy
            ),
            sortDirection: 1,
          }
        } else {
          nextSortState = defaultSort
        }

        sortStateRef.current = nextSortState
      }

      if (hasPaginationChanged) {
        resetTaskSelection()
      }

      void loadTasks({
        pageIndex: nextPageIndex,
        pageSize: nextPageSize,
        ...nextSortState,
      })
    },
    [
      activeTab,
      loadTasks,
      pageInfo.pageIndex,
      pageInfo.pageSize,
      resetTaskSelection,
    ]
  )

  const requestTasks = useCallback(() => {
    resetTaskSelection()

    return loadTasks({
      pageIndex: 1,
      pageSize: pageInfo.pageSize,
    })
  }, [loadTasks, pageInfo.pageSize, resetTaskSelection])

  useEffect(() => {
    if (taskTab) {
      sortStateRef.current = DEFAULT_SORT_BY_TAB[taskTab]
    }
  }, [taskTab])

  useEffect(() => {
    if (scope !== "inspection" || isControlledPanel) {
      return
    }

    const nextCategory = sourceDefaultCategory
    const currentCategory = activeFilterStore.getFieldValue("category") as
      | TeamTaskCategory
      | undefined

    if (currentCategory === nextCategory) {
      return
    }

    activeFilterStore.setFieldValue("category", nextCategory)
  }, [
    activeFilterStore,
    isControlledPanel,
    scope,
    sourceDefaultCategory,
  ])

  useEffect(() => {
    if (isControlledPanel) {
      previousApplicationTaskOnlyRef.current = isApplicationTaskOnlyEnabled
      return
    }

    const wasApplicationTaskOnly = previousApplicationTaskOnlyRef.current
    const currentCategory = activeFilterStore.getFieldValue("category") as
      | TeamTaskCategory
      | undefined
    const isCurrentCategorySupported =
      !currentCategory ||
      categoryOptionsRef.current.some((item) => item.value === currentCategory)
    const nextCategory = isApplicationTaskOnlyEnabled
      ? "applications"
      : wasApplicationTaskOnly
        ? undefined
        : isCurrentCategorySupported
          ? currentCategory
          : undefined

    previousApplicationTaskOnlyRef.current = isApplicationTaskOnlyEnabled
    sortStateRef.current = DEFAULT_SORT_BY_TAB[activeTab]
    resetTaskSelection()

    if (
      scope === "inspection" &&
      sourceDefaultCategory !== undefined &&
      currentCategory !== sourceDefaultCategory
    ) {
      return
    }

    if (currentCategory !== nextCategory) {
      activeFilterStore.setFieldValue("category", nextCategory)
      return
    }

    void loadTasks({
      pageIndex: 1,
      pageSize: pageInfo.pageSize,
      ...DEFAULT_SORT_BY_TAB[activeTab],
    })
  }, [
    activeFilterStore,
    activeTab,
    activeTaskSourceKey,
    categoryOptionsRef,
    isApplicationTaskOnlyEnabled,
    isControlledPanel,
    loadTasks,
    pageInfo.pageSize,
    resetTaskSelection,
    scope,
    serviceAdapterMode,
    sourceDefaultCategory,
  ])

  useEffect(() => {
    if (isControlledPanel || initialTaskLoadRequestedRef.current) {
      return
    }

    initialTaskLoadRequestedRef.current = true

    if (tasksRequestIdRef.current > 0) {
      return
    }

    void loadTasks({
      pageIndex: 1,
      pageSize: pageInfo.pageSize,
      ...DEFAULT_SORT_BY_TAB[activeTab],
    })
  }, [activeTab, isControlledPanel, loadTasks, pageInfo.pageSize])

  useEffect(() => {
    if (previousPageRefreshTokenRef.current === pageRefreshToken) {
      return
    }

    previousPageRefreshTokenRef.current = pageRefreshToken

    if (isControlledPanel) {
      return
    }

    resetTaskSelection()
    void loadTasks({
      pageIndex: pageInfoRef.current.pageIndex,
      pageSize: pageInfoRef.current.pageSize,
      ...sortStateRef.current,
    })
  }, [
    isControlledPanel,
    loadTasks,
    pageRefreshToken,
    resetTaskSelection,
  ])

  return {
    buildTaskRequestPayload,
    dataSource,
    handleTableChange,
    loading,
    pageInfo,
    requestTasks,
  }
}
