import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useFilter } from "@/components/common/FilterTable"
import type { TeamTaskCategory, TeamTaskTab } from "@/services/teamManagement"
import type {
  TeamTasksPanelProps,
  UseTeamTasksPanelResult,
} from "./type"
import { DEFAULT_TASK_FILTER_CONTAINER_CLS } from "./constants"
import {
  getInspectionSourceCategory,
  hasExternallyControlledTaskData,
} from "./utils"
import { useTeamTaskActions } from "./hooks/useTeamTaskActions"
import { useTeamTaskData } from "./hooks/useTeamTaskData"
import { useTeamTaskOptions } from "./hooks/useTeamTaskOptions"
import { useTeamTaskSelection } from "./hooks/useTeamTaskSelection"
import { useTeamTaskTableConfig } from "./hooks/useTeamTaskTableConfig"

export const useTeamTasksPanel = (
  props: TeamTasksPanelProps
): UseTeamTasksPanelResult => {
  const {
    scopeConfig,
    serviceAdapterMode = "default",
    applicationTaskOnly,
    refreshToken,
    taskTab,
    onTaskTabChange,
    onCreateTask,
    createTaskText,
    activeTaskSourceKey,
    taskSourcePanelConfigs,
    onOpenReassign,
  } = props

  const [todoFilterStore] = useFilter()
  const [completedFilterStore] = useFilter()
  const [internalActiveTab, setInternalActiveTab] =
    useState<TeamTaskTab>("todo")
  const previousFilterStoresInitializedRef = useRef(false)
  const categoryOptionsRef = useRef<
    Array<{ label: string; value: TeamTaskCategory }>
  >([])
  const mountedRef = useRef(true)
  const scope = scopeConfig.scope
  const activeTab = taskTab ?? internalActiveTab
  const activePanelConfig = activeTaskSourceKey
    ? taskSourcePanelConfigs?.[activeTaskSourceKey]
    : undefined
  const hasCustomFilterStore = Boolean(activePanelConfig?.filterStore)
  const activeFilterStore =
    activePanelConfig?.filterStore ??
    (activeTab === "completed" ? completedFilterStore : todoFilterStore)
  const isControlledPanel = hasExternallyControlledTaskData(activePanelConfig)
  const isInspectionSourceView =
    scope === "inspection" && activeTaskSourceKey === "inspection"
  const isInspectionOtherSourceView =
    scope === "inspection" && activeTaskSourceKey === "other"
  const sourceDefaultCategory =
    scope === "inspection"
      ? getInspectionSourceCategory(activeTaskSourceKey)
      : undefined
  const isApplicationTaskOnlyEnabled =
    applicationTaskOnly && scopeConfig.capabilities.supportsApplicationTaskOnly
  const canReassignTasks =
    scopeConfig.capabilities.allowTaskReassign && !isInspectionSourceView
  const canExportTasks = scopeConfig.capabilities.allowTaskExport
  const canCreateTask =
    scope === "inspection"
      ? scopeConfig.capabilities.allowTaskCreate && !isInspectionOtherSourceView
      : scopeConfig.capabilities.allowTaskCreate
  const filterTableRenderKey = useMemo(
    () =>
      [
        "team-management-filter-table",
        activeTaskSourceKey || "default",
        activeTab,
        hasCustomFilterStore ? "custom-store" : "internal-store",
      ].join("-"),
    [activeTab, activeTaskSourceKey, hasCustomFilterStore]
  )

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const {
    resetTaskSelection,
    rowSelection,
    renderSelectionTip,
  } = useTeamTaskSelection({
    activeTab,
    canReassignTasks,
    mountedRef,
    onOpenReassign,
    scopeConfig,
  })

  useEffect(() => {
    if (hasCustomFilterStore) {
      return
    }

    if (!previousFilterStoresInitializedRef.current) {
      previousFilterStoresInitializedRef.current = true
      return
    }

    todoFilterStore.resetFields()
    completedFilterStore.resetFields()
  }, [
    completedFilterStore,
    hasCustomFilterStore,
    scope,
    serviceAdapterMode,
    todoFilterStore,
  ])

  const {
    defaultTableFilters,
    ensureMemberOptionsLoaded,
  } = useTeamTaskOptions({
    activeFilterStore,
    activeTab,
    activeTaskSourceKey,
    categoryOptionsRef,
    isApplicationTaskOnlyEnabled,
    isControlledPanel,
    mountedRef,
    scope,
    scopeConfig,
    serviceAdapterMode,
  })

  useEffect(() => {
    if (hasCustomFilterStore) {
      return
    }

    const inactiveFilterStore =
      activeTab === "completed" ? todoFilterStore : completedFilterStore

    inactiveFilterStore.resetFields()
  }, [
    activeTab,
    completedFilterStore,
    hasCustomFilterStore,
    todoFilterStore,
  ])

  const {
    buildTaskRequestPayload,
    dataSource,
    handleTableChange,
    loading,
    pageInfo,
    requestTasks,
  } = useTeamTaskData({
    activeFilterStore,
    activeTab,
    activeTaskSourceKey,
    categoryOptionsRef,
    isApplicationTaskOnlyEnabled,
    isControlledPanel,
    mountedRef,
    pageRefreshToken: refreshToken,
    resetTaskSelection,
    scope,
    serviceAdapterMode,
    sourceDefaultCategory,
    taskTab,
  })

  const { resolvedTableConfigs } = useTeamTaskTableConfig({
    activePanelConfig,
    activeTab,
    canReassignTasks,
    dataSource,
    handleTableChange,
    onOpenReassign,
    pageInfo,
    rowSelection,
    scope,
    scopeConfig,
  })

  const { extraActions } = useTeamTaskActions({
    activePanelConfig,
    activeTab,
    buildTaskRequestPayload,
    canCreateTask,
    canExportTasks,
    createTaskText,
    onCreateTask,
    scopeConfig,
  })

  const resolvedTableFilters =
    activePanelConfig?.tableFilters ?? defaultTableFilters
  const resolvedLoading = activePanelConfig?.loading ?? loading
  const resolvedRequest = activePanelConfig?.request || requestTasks
  const resolvedRenderSelectionTip =
    activePanelConfig?.renderSelectionTip || renderSelectionTip
  const resolvedFilterTableContainerCls = [
    DEFAULT_TASK_FILTER_CONTAINER_CLS,
    activePanelConfig?.filterTableContainerCls,
  ]
    .filter(Boolean)
    .join(" ")

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = key as TeamTaskTab
      if (!hasCustomFilterStore) {
        activeFilterStore.resetFields()
        const nextFilterStore =
          nextTab === "completed" ? completedFilterStore : todoFilterStore
        if (nextFilterStore !== activeFilterStore) {
          nextFilterStore.resetFields()
        }
      }

      if (!taskTab) {
        setInternalActiveTab(nextTab)
      }

      onTaskTabChange?.(nextTab)
    },
    [
      activeFilterStore,
      completedFilterStore,
      hasCustomFilterStore,
      onTaskTabChange,
      taskTab,
      todoFilterStore,
    ]
  )

  return {
    activeTab,
    activePanelConfig,
    filterTableRenderKey,
    handleTabChange,
    resolvedTableConfigs,
    resolvedTableFilters,
    resolvedFilterStore: activeFilterStore,
    resolvedLoading,
    resolvedRequest,
    resolvedRenderSelectionTip,
    resolvedFilterTableContainerCls,
    extraActions,
    ensureMemberOptionsLoaded,
  }
}

export default useTeamTasksPanel
