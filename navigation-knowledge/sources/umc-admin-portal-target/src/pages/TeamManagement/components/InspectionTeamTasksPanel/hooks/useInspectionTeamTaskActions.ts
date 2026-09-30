/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react"
import { useHistory } from "react-router-dom"
import { CustomMessage } from "@/components/common"
import { cancelInspectionTask } from "@/services/inspection"
import {
  exportInspectionTeamManagementTasks,
  type InspectionTeamManagementTaskQueryPayload,
} from "@/services/inspectionTeamManagement"
import {
  buildInspectionPath,
} from "@/pages/InspectionCommon/helpers"
import {
  INSPECTION_PATHS,
  INSPECTION_QUERY_KEYS,
} from "@/pages/InspectionCommon/constants"
import { downloadBlobFile } from "@/pages/InspectionCommon/csvExport"
import type { InspectionTaskModalMode } from "../../InspectionTaskModal"
import {
  getDefaultDuplicateDueDate,
  getInspectionTeamTaskStatusCode,
  isInspectionTeamTaskEditable,
} from "../utils"
import { getInspectionTeamTaskListActionKeys } from "../taskActionKeys"
import { clearInspectionTeamTaskQueryCache } from "./useInspectionTeamTaskData"
import type {
  InspectionTeamTaskRow,
  InspectionTeamTaskViewState,
  TaskAction,
  TeamTaskView,
} from "../type"

interface UseInspectionTeamTaskActionsParams {
  activeViewState: InspectionTeamTaskViewState
  buildQueryPayload: (
    view: TeamTaskView,
    overrides?: Partial<InspectionTeamManagementTaskQueryPayload>
  ) => InspectionTeamManagementTaskQueryPayload
  effectiveSearch: string
  ensureTaskInspectorOptionsLoaded: () => Promise<void>
  loadTasks: (
    view: TeamTaskView,
    overrides?: Partial<InspectionTeamManagementTaskQueryPayload>,
    options?: { force?: boolean }
  ) => Promise<void>
  onTaskChanged?: () => void | Promise<void>
  t: (key: string) => string
  taskTab: TeamTaskView
}

export const useInspectionTeamTaskActions = ({
  activeViewState,
  buildQueryPayload,
  effectiveSearch,
  ensureTaskInspectorOptionsLoaded,
  loadTasks,
  onTaskChanged,
  t,
  taskTab,
}: UseInspectionTeamTaskActionsParams) => {
  const history = useHistory()
  const [taskModalVisible, setTaskModalVisible] = useState(false)
  const [taskModalMode, setTaskModalMode] =
    useState<InspectionTaskModalMode>("create")
  const [editingTask, setEditingTask] = useState<Record<string, any> | null>(null)
  const [cancelTaskModalVisible, setCancelTaskModalVisible] = useState(false)
  const [cancellingTask, setCancellingTask] =
    useState<InspectionTeamTaskRow | null>(null)
  const [cancelTaskLoading, setCancelTaskLoading] = useState(false)

  const openTaskModal = useCallback(
    (mode: InspectionTaskModalMode, task?: Record<string, any>) => {
      void ensureTaskInspectorOptionsLoaded()
      setTaskModalMode(mode)
      setEditingTask(task || null)
      setTaskModalVisible(true)
    },
    [ensureTaskInspectorOptionsLoaded]
  )

  const handleTaskModalVisibleChange = useCallback((nextVisible: boolean) => {
    setTaskModalVisible(nextVisible)
    if (!nextVisible) {
      setEditingTask(null)
    }
  }, [])

  const handleTaskSubmitted = useCallback(async () => {
    clearInspectionTeamTaskQueryCache()
    await loadTasks(taskTab, {
      pageIndex: 1,
      pageSize: activeViewState.pageSize,
    }, {
      force: true,
    })
    await onTaskChanged?.()
  }, [activeViewState.pageSize, loadTasks, onTaskChanged, taskTab])

  const handleExport = useCallback(async () => {
    try {
      const payload = buildQueryPayload(taskTab)
      const blob = await exportInspectionTeamManagementTasks(payload)
      downloadBlobFile(`InspectionTeamTasks_${taskTab}_${Date.now()}.csv`, blob)
    } catch {
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
    }
  }, [buildQueryPayload, t, taskTab])

  const buildTaskDetailPath = useCallback(
    (
      record: InspectionTeamTaskRow,
      mode?: string | null
    ) => {
      const resolvedTaskId = String(
        record.sourceId || record.taskId || record.taskNo || ""
      ).trim()
      const resolvedTaskNo = String(record.taskNo || "").trim()
      const pathPatch = {
        [INSPECTION_QUERY_KEYS.from]: "tasks",
        [INSPECTION_QUERY_KEYS.tab]: null,
        [INSPECTION_QUERY_KEYS.teamTab]: null,
        [INSPECTION_QUERY_KEYS.teamTaskSource]: null,
        [INSPECTION_QUERY_KEYS.taskId]: resolvedTaskId || null,
        [INSPECTION_QUERY_KEYS.taskNo]: resolvedTaskNo || null,
        [INSPECTION_QUERY_KEYS.visitId]: null,
        [INSPECTION_QUERY_KEYS.step]: null,
        [INSPECTION_QUERY_KEYS.mode]: mode || null,
        [INSPECTION_QUERY_KEYS.reportNo]: null,
      }

      if (!resolvedTaskId && !resolvedTaskNo) return ""

      return buildInspectionPath(
        INSPECTION_PATHS.taskDetail,
        effectiveSearch,
        pathPatch
      )
    },
    [effectiveSearch]
  )

  const handleDuplicateTask = useCallback(
    (record: InspectionTeamTaskRow) => {
      const taskId = String(record.sourceId || record.taskId || "").trim()
      if (!taskId) {
        CustomMessage.error(t("teamManagement.messages.operationFailed"))
        return
      }

      openTaskModal("duplicate", {
        ...record,
        taskId,
        dueDate: getDefaultDuplicateDueDate(record.dueDateValue),
      })
    },
    [openTaskModal, t]
  )

  const handleCancelTask = useCallback((record: InspectionTeamTaskRow) => {
    setCancellingTask(record)
    setCancelTaskLoading(false)
    setCancelTaskModalVisible(true)
  }, [])

  const closeCancelTaskModal = useCallback(() => {
    if (cancelTaskLoading) return

    setCancelTaskModalVisible(false)
    setCancellingTask(null)
  }, [cancelTaskLoading])

  const confirmCancelTask = useCallback(async () => {
    if (!cancellingTask || cancelTaskLoading) return

    const rawTaskId = String(
      cancellingTask.taskId || cancellingTask.sourceId || ""
    ).trim()
    const taskId = Number(rawTaskId)

    if (!rawTaskId || !Number.isFinite(taskId) || taskId <= 0) {
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
      closeCancelTaskModal()
      return
    }

    setCancelTaskLoading(true)
    try {
      await cancelInspectionTask({
        taskId,
        reason: "Cancelled from team management.",
      })
      CustomMessage.success(t("inspection.tasks.messages.cancelled"))
      setCancelTaskModalVisible(false)
      setCancellingTask(null)
      clearInspectionTeamTaskQueryCache()
      await loadTasks(taskTab, {
        pageIndex: activeViewState.pageIndex,
        pageSize: activeViewState.pageSize,
      }, {
        force: true,
      })
      await onTaskChanged?.()
    } catch {
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
    } finally {
      setCancelTaskLoading(false)
    }
  }, [
    activeViewState.pageIndex,
    activeViewState.pageSize,
    cancelTaskLoading,
    cancellingTask,
    closeCancelTaskModal,
    loadTasks,
    onTaskChanged,
    t,
    taskTab,
  ])

  const navigateToDetail = useCallback(
    (record: InspectionTeamTaskRow) => {
      const detailPath = buildTaskDetailPath(record, null)
      if (!detailPath) return

      history.push(detailPath)
    },
    [buildTaskDetailPath, history]
  )

  const handleViewReport = useCallback(
    (record: InspectionTeamTaskRow) => {
      const detailPath = buildTaskDetailPath(record, "report")
      if (!detailPath) {
        CustomMessage.error(t("teamManagement.messages.operationFailed"))
        return
      }

      history.push(detailPath)
    },
    [buildTaskDetailPath, history, t]
  )

  const buildActions = useCallback(
    (record: InspectionTeamTaskRow) => {
      const statusCode = getInspectionTeamTaskStatusCode(record)
      const actionKeys = getInspectionTeamTaskListActionKeys({
        taskTab,
        statusCode,
        editable: isInspectionTeamTaskEditable(record),
        availableActions: record.availableActions,
      })

      return actionKeys.map<TaskAction>((actionKey) => {
        if (actionKey === "edit") {
          return {
            key: "edit",
            label: t("inspection.common.edit"),
            onClick: () =>
              openTaskModal("edit", {
                ...record,
                taskId: record.taskId || record.sourceId,
              }),
          }
        }

        if (actionKey === "cancel") {
          return {
            key: "cancel",
            label: t("inspection.common.cancel"),
            placement: "overflow",
            onClick: () => handleCancelTask(record),
          }
        }

        if (actionKey === "viewReport") {
          return {
            key: "viewReport",
            label: t("inspection.common.viewReport"),
            onClick: () => handleViewReport(record),
          }
        }

        return {
          key: "duplicate",
          label: t("inspection.common.duplicate"),
          onClick: () => handleDuplicateTask(record),
        }
      })
    },
    [
      handleCancelTask,
      handleDuplicateTask,
      handleViewReport,
      openTaskModal,
      t,
      taskTab,
    ]
  )

  return {
    buildActions,
    cancelTaskLoading,
    cancelTaskModalVisible,
    cancellingTask,
    closeCancelTaskModal,
    confirmCancelTask,
    editingTask,
    handleExport,
    handleTaskModalVisibleChange,
    handleTaskSubmitted,
    navigateToDetail,
    openTaskModal,
    taskModalMode,
    taskModalVisible,
  }
}
