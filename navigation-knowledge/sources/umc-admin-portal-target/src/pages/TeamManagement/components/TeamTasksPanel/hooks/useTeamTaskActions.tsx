import { useCallback, useMemo } from "react"
import moment from "moment"
import { useTranslation } from "react-i18next"
import { ExportBtn } from "@/components/common/ExportBtn"
import { CustomButton, PermissionGuard } from "@/components/common"
import type {
  TeamManagementTaskPageParams,
  TeamTaskTab,
} from "@/services/teamManagement"
import { exportTeamManagementTasks } from "@/services/teamManagement"
import type {
  TeamManagementControlledTaskPanelConfig,
} from "../../../type"
import type { TeamManagementScopeConfig } from "../../../taskConfig"
import type { TeamTasksPanelProps } from "../type"

interface UseTeamTaskActionsParams {
  activePanelConfig?: TeamManagementControlledTaskPanelConfig
  activeTab: TeamTaskTab
  buildTaskRequestPayload: () => TeamManagementTaskPageParams
  canCreateTask: boolean
  canExportTasks: boolean
  createTaskText?: string
  onCreateTask?: TeamTasksPanelProps["onCreateTask"]
  scopeConfig: TeamManagementScopeConfig
}

export const useTeamTaskActions = ({
  activePanelConfig,
  activeTab,
  buildTaskRequestPayload,
  canCreateTask,
  canExportTasks,
  createTaskText,
  onCreateTask,
  scopeConfig,
}: UseTeamTaskActionsParams) => {
  const { t } = useTranslation()

  const handleExport = useCallback(async () => {
    const {
      pageIndex: _pageIndex,
      pageSize: _pageSize,
      sortBy: _sortBy,
      sortDirection: _sortDirection,
      ...exportPayload
    } = buildTaskRequestPayload()

    return exportTeamManagementTasks(exportPayload)
  }, [buildTaskRequestPayload])

  const defaultExportButton = useMemo(
    () => (
      <ExportBtn
        exportName={`TeamManagement_${activeTab}_${moment().format(
          "DDMMYYYY_HHmmss"
        )}.csv`}
        exportCb={handleExport}
      />
    ),
    [activeTab, handleExport]
  )

  const actionButtons = useMemo(() => {
    if (activePanelConfig?.actionButtons) {
      return activePanelConfig.actionButtons
    }

    if (!canExportTasks) {
      return null
    }

    if (!scopeConfig.permissions.export) {
      return defaultExportButton
    }

    return (
      <PermissionGuard
        permissionCode={scopeConfig.permissions.export}
        routePath={scopeConfig.permissionRoutePath}
      >
        {defaultExportButton}
      </PermissionGuard>
    )
  }, [
    activePanelConfig?.actionButtons,
    canExportTasks,
    defaultExportButton,
    scopeConfig.permissionRoutePath,
    scopeConfig.permissions.export,
  ])

  const shouldShowCreateTask =
    canCreateTask &&
    Boolean(onCreateTask) &&
    activePanelConfig?.hideCreateTask !== true

  const extraActions = useMemo(() => {
    if (!actionButtons && !shouldShowCreateTask) {
      return null
    }

    return (
      <div className="team-management-table-card__actions">
        {actionButtons}
        {shouldShowCreateTask ? (
          <CustomButton
            text={
              activePanelConfig?.createTaskText ||
              createTaskText ||
              t("teamManagement.actions.createTask")
            }
            variant="primary"
            customStyle={{ width: 130 }}
            customClassName="team-management-table-card__create-task-btn"
            onClick={onCreateTask}
          />
        ) : null}
      </div>
    )
  }, [
    actionButtons,
    activePanelConfig?.createTaskText,
    createTaskText,
    onCreateTask,
    shouldShowCreateTask,
    t,
  ])

  return {
    extraActions,
  }
}
