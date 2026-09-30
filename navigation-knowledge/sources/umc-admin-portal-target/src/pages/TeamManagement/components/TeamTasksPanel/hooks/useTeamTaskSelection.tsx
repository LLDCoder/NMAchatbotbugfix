import {
  useCallback,
  useMemo,
  useState,
  type Key,
  type MutableRefObject,
  type ReactElement,
} from "react"
import { useTranslation } from "react-i18next"
import { CustomButton, PermissionGuard } from "@/components/common"
import type { TeamManagementTaskItem, TeamTaskTab } from "@/services/teamManagement"
import type { TeamManagementScopeConfig } from "../../../taskConfig"
import type { TeamTasksPanelProps, TableRowSelection } from "../type"
import { buildReassignTaskSelection } from "../utils"

interface UseTeamTaskSelectionParams {
  activeTab: TeamTaskTab
  canReassignTasks: boolean
  mountedRef: MutableRefObject<boolean>
  onOpenReassign: TeamTasksPanelProps["onOpenReassign"]
  scopeConfig: TeamManagementScopeConfig
}

export const useTeamTaskSelection = ({
  activeTab,
  canReassignTasks,
  mountedRef,
  onOpenReassign,
  scopeConfig,
}: UseTeamTaskSelectionParams) => {
  const { t } = useTranslation()
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [selectedTasks, setSelectedTasks] = useState(
    [] as ReturnType<typeof buildReassignTaskSelection>[]
  )

  const resetTaskSelection = useCallback(() => {
    if (!mountedRef.current) {
      return
    }

    setSelectedRowKeys([])
    setSelectedTasks([])
  }, [mountedRef])

  const rowSelection = useMemo<
    TableRowSelection<TeamManagementTaskItem> | undefined
  >(() => {
    if (activeTab !== "todo" || !canReassignTasks) {
      return undefined
    }

    return {
      selectedRowKeys,
      onChange: (
        nextSelectedRowKeys: Key[],
        selectedRows: TeamManagementTaskItem[]
      ) => {
        setSelectedRowKeys(nextSelectedRowKeys)
        setSelectedTasks(
          selectedRows.map((item) => buildReassignTaskSelection(item))
        )
      },
      getCheckboxProps(record) {
        return {
          disabled: record.canReassign === false,
        }
      },
    }
  }, [
    activeTab,
    canReassignTasks,
    selectedRowKeys,
  ])

  const renderSelectionTip = useCallback((): ReactElement => {
    if (!canReassignTasks || !selectedRowKeys.length || activeTab !== "todo") {
      return <></>
    }

    const reassignButton = (
      <CustomButton
        text={t("teamManagement.reassign.action")}
        variant="primary"
        permissionCode={scopeConfig.permissions.reassign}
        permissionRoutePath={scopeConfig.permissionRoutePath}
        onClick={() => onOpenReassign(selectedTasks, selectedTasks.length)}
      />
    )

    return (
      <div className="team-management-selection-tip">
        <span>
          {t("teamManagement.reassign.tasksSelected", {
            count: selectedRowKeys.length,
          })}
        </span>
        {scopeConfig.permissions.confirmReassign ? (
          <PermissionGuard
            permissionCode={scopeConfig.permissions.confirmReassign}
            routePath={scopeConfig.permissionRoutePath}
          >
            {reassignButton}
          </PermissionGuard>
        ) : (
          reassignButton
        )}
      </div>
    )
  }, [
    activeTab,
    canReassignTasks,
    onOpenReassign,
    scopeConfig.permissionRoutePath,
    scopeConfig.permissions.confirmReassign,
    scopeConfig.permissions.reassign,
    selectedRowKeys.length,
    selectedTasks,
    t,
  ])

  return {
    resetTaskSelection,
    rowSelection,
    renderSelectionTip,
  }
}
