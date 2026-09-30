/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useState, type MutableRefObject } from "react"
import { CustomMessage } from "@/components/common"
import type { IFilterStore } from "@/components/common/FilterTable/type"
import {
  queryInspectionTeamManagementTasks,
  type InspectionTeamManagementTaskQueryPayload,
} from "@/services/inspectionTeamManagement"
import {
  buildInspectionTeamTaskQueryCacheKey,
  buildInspectionTeamTaskQueryResult,
  createDefaultInspectionTeamTaskViewState,
} from "../utils"
import type {
  InspectionTeamTaskQueryResult,
  InspectionTeamTaskRow,
  InspectionTeamTaskViewState,
  TeamTaskView,
} from "../type"

const inspectionTeamTaskQueryRequestMap = new Map<
  string,
  Promise<InspectionTeamTaskQueryResult>
>()

export const clearInspectionTeamTaskQueryCache = () => {
  inspectionTeamTaskQueryRequestMap.clear()
}

interface UseInspectionTeamTaskDataParams {
  completedFilterStore: IFilterStore
  mountedRef: MutableRefObject<boolean>
  taskTab: TeamTaskView
  todoFilterStore: IFilterStore
  t: (key: string, options?: Record<string, unknown>) => string
}

export const useInspectionTeamTaskData = ({
  completedFilterStore,
  mountedRef,
  taskTab,
  todoFilterStore,
  t,
}: UseInspectionTeamTaskDataParams) => {
  const [rows, setRows] = useState<Record<TeamTaskView, InspectionTeamTaskRow[]>>({
    todo: [],
    completed: [],
  })
  const [loading, setLoading] = useState<Record<TeamTaskView, boolean>>({
    todo: false,
    completed: false,
  })
  const [viewState, setViewState] = useState<
    Record<TeamTaskView, InspectionTeamTaskViewState>
  >({
    todo: createDefaultInspectionTeamTaskViewState("todo"),
    completed: createDefaultInspectionTeamTaskViewState("completed"),
  })
  const latestTaskRequestIdRef = useRef<Record<TeamTaskView, number>>({
    todo: 0,
    completed: 0,
  })

  const applyTaskQueryResult = useCallback(
    (
      view: TeamTaskView,
      requestId: number,
      nextResult: InspectionTeamTaskQueryResult
    ) => {
      if (!mountedRef.current || latestTaskRequestIdRef.current[view] !== requestId) {
        return
      }

      setRows((previous) => ({
        ...previous,
        [view]: nextResult.rows,
      }))
      setViewState((previous) => {
        const currentViewState = previous[view]
        const nextViewState = nextResult.viewState

        if (
          currentViewState.pageIndex === nextViewState.pageIndex &&
          currentViewState.pageSize === nextViewState.pageSize &&
          currentViewState.total === nextViewState.total &&
          currentViewState.sortBy === nextViewState.sortBy &&
          currentViewState.sortDirection === nextViewState.sortDirection
        ) {
          return previous
        }

        return {
          ...previous,
          [view]: nextViewState,
        }
      })
    },
    [mountedRef]
  )

  const buildQueryPayload = useCallback(
    (
      view: TeamTaskView,
      overrides?: Partial<InspectionTeamManagementTaskQueryPayload>
    ): InspectionTeamManagementTaskQueryPayload => {
      const filterStore = view === "completed" ? completedFilterStore : todoFilterStore
      const values = filterStore.getFieldsValue()
      const dueDateRange = Array.isArray(values.dueDateRange)
        ? values.dueDateRange
        : []
      const creationTimeRange = Array.isArray(values.creationTimeRange)
        ? values.creationTimeRange
        : []
      const nextState = viewState[view]

      return {
        view,
        taskMode: "inspectionTasks",
        keyword: values.keyword || undefined,
        status: values.status || undefined,
        reason: values.reason || undefined,
        emirate: values.emirate || undefined,
        areaId: values.area || undefined,
        inspectionMethod: values.inspectionMethod || undefined,
        priorityId: values.priority || undefined,
        dueDateFrom: dueDateRange[0]?.format?.("YYYY-MM-DD[T]00:00:00"),
        dueDateTo: dueDateRange[1]?.format?.("YYYY-MM-DD[T]23:59:59"),
        assignedInspectorId: values.assignedInspector || undefined,
        createdBy: values.createdBy || undefined,
        createdOnFrom: creationTimeRange[0]?.format?.("YYYY-MM-DD[T]00:00:00"),
        createdOnTo: creationTimeRange[1]?.format?.("YYYY-MM-DD[T]23:59:59"),
        pageIndex: overrides?.pageIndex ?? nextState.pageIndex,
        pageSize: overrides?.pageSize ?? nextState.pageSize,
        sortBy: overrides?.sortBy ?? nextState.sortBy,
        sortDirection: overrides?.sortDirection ?? nextState.sortDirection,
        ...overrides,
      }
    },
    [completedFilterStore, todoFilterStore, viewState]
  )

  const loadTasks = useCallback(
    async (
      view: TeamTaskView,
      overrides?: Partial<InspectionTeamManagementTaskQueryPayload>,
      options?: { force?: boolean }
    ) => {
      const payload = buildQueryPayload(view, overrides)
      const cacheKey = buildInspectionTeamTaskQueryCacheKey(payload)
      const requestId = latestTaskRequestIdRef.current[view] + 1
      latestTaskRequestIdRef.current[view] = requestId

      setLoading((previous) => ({
        ...previous,
        [view]: true,
      }))

      try {
        let taskRequest = !options?.force
          ? inspectionTeamTaskQueryRequestMap.get(cacheKey)
          : undefined

        if (!taskRequest) {
          taskRequest = queryInspectionTeamManagementTasks(payload)
            .then((response) => {
              return buildInspectionTeamTaskQueryResult(
                view,
                payload,
                response,
                t
              )
            })
            .finally(() => {
              if (inspectionTeamTaskQueryRequestMap.get(cacheKey) === taskRequest) {
                inspectionTeamTaskQueryRequestMap.delete(cacheKey)
              }
            })

          inspectionTeamTaskQueryRequestMap.set(cacheKey, taskRequest)
        }

        const nextResult = await taskRequest
        applyTaskQueryResult(view, requestId, nextResult)
      } catch {
        if (!mountedRef.current || latestTaskRequestIdRef.current[view] !== requestId) {
          return
        }

        setRows((previous) => ({
          ...previous,
          [view]: [],
        }))
        setViewState((previous) => ({
          ...previous,
          [view]: {
            ...previous[view],
            pageIndex: overrides?.pageIndex ?? previous[view].pageIndex,
            pageSize: overrides?.pageSize ?? previous[view].pageSize,
            total: 0,
          },
        }))
        CustomMessage.error(t("teamManagement.messages.failedToLoadTasks"))
      } finally {
        if (!mountedRef.current || latestTaskRequestIdRef.current[view] !== requestId) {
          return
        }

        setLoading((previous) => ({
          ...previous,
          [view]: false,
        }))
      }
    },
    [applyTaskQueryResult, buildQueryPayload, mountedRef, t]
  )

  return {
    activeLoading: loading[taskTab],
    activeRows: rows[taskTab],
    activeViewState: viewState[taskTab],
    buildQueryPayload,
    loadTasks,
    rows,
    setViewState,
  }
}
