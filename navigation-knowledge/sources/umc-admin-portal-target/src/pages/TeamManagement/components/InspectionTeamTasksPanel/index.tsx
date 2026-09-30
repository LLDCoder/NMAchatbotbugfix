/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from "react"
import { Button } from "antd"
import type { TableProps } from "antd/lib/table"
import { useTranslation } from "react-i18next"
import { CustomButton, PaginationTotal } from "@/components/common"
import { FilterTable, useFilter } from "@/components/common/FilterTable"
import { pxToRemValue } from "@/utils/rem"
import { useInspectionAccess } from "@/pages/InspectionCommon/access"
import InspectionTaskModal from "../InspectionTaskModal"
import CancelTaskModal from "../modal/CancelTaskModal"
import { getAuthorityName, shouldIgnoreTaskRowClick } from "./utils"
import { useInspectionTeamTaskActions } from "./hooks/useInspectionTeamTaskActions"
import { useInspectionTeamTaskData } from "./hooks/useInspectionTeamTaskData"
import { useInspectionTeamTaskFilters } from "./hooks/useInspectionTeamTaskFilters"
import { useInspectionTeamTaskMetadata } from "./hooks/useInspectionTeamTaskMetadata"
import { useInspectionTeamTaskTableConfig } from "./hooks/useInspectionTeamTaskTableConfig"
import type {
  InspectionTeamTaskRow,
  InspectionTeamTasksPanelProps,
} from "./type"

const InspectionTeamTasksPanel: React.FC<InspectionTeamTasksPanelProps> = ({
  taskTab,
  effectiveSearch,
  createTaskText,
  refreshToken,
  onCreateTask,
  onTaskChanged,
}) => {
  const { t, i18n } = useTranslation()
  const { inspectorId: currentInspectorId } = useInspectionAccess()
  const [todoFilterStore] = useFilter()
  const [completedFilterStore] = useFilter()
  const mountedRef = useRef(false)
  const activeFilterStore =
    taskTab === "completed" ? completedFilterStore : todoFilterStore

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const {
    ensureTaskInspectorOptionsLoaded,
    loadMetadata,
    metadata,
    taskInspectorOptions,
    taskInspectorOptionsLoading,
  } = useInspectionTeamTaskMetadata({
    mountedRef,
    t,
    language: i18n.resolvedLanguage || "en",
  })

  const {
    activeLoading,
    activeRows,
    activeViewState,
    buildQueryPayload,
    loadTasks,
    rows,
    setViewState,
  } = useInspectionTeamTaskData({
    completedFilterStore,
    mountedRef,
    taskTab,
    todoFilterStore,
    t,
  })

  const {
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
  } = useInspectionTeamTaskActions({
    activeViewState,
    buildQueryPayload,
    effectiveSearch,
    ensureTaskInspectorOptionsLoaded,
    loadTasks,
    onTaskChanged,
    t,
    taskTab,
  })

  const { tableFilters } = useInspectionTeamTaskFilters({
    metadata,
    rows,
    t,
    taskTab,
  })

  const { columns, handleTableChange } = useInspectionTeamTaskTableConfig({
    activeViewState,
    buildActions,
    dataSource: activeRows,
    loadTasks,
    setViewState,
    t,
    taskTab,
  })

  useEffect(() => {
    void loadMetadata()
    void ensureTaskInspectorOptionsLoaded()
  }, [ensureTaskInspectorOptionsLoaded, loadMetadata])

  useEffect(() => {
    void loadTasks(taskTab)
    // Keep initial load tied to tab switches only; loadTasks depends on view state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, taskTab])

  const toolbarActions = (
    <div className="team-management-table-card__actions">
      <Button
        className="inspection-task-management__toolbar-button inspection-task-management__outline-button"
        onClick={handleExport}
      >
        {t("inspection.common.export")}
      </Button>
      {taskTab === "todo" ? (
        <CustomButton
          text={createTaskText || t("teamManagement.actions.createTask")}
          variant="primary"
          customStyle={{ width: 130 }}
          customClassName="team-management-table-card__create-task-btn"
          onClick={onCreateTask || (() => openTaskModal("create"))}
        />
      ) : null}
    </div>
  )

  return (
    <>
      <FilterTable
        responsiveToolbar
        containerCls="team-management-filter-table team-management-filter-table--inspection"
        columns={columns as TableProps<Record<string, any>>["columns"]}
        dataSource={activeRows as Record<string, any>[]}
        rowKey="rowKey"
        scroll={{ x: pxToRemValue(taskTab === "completed" ? 2600 : 2400) }}
        loading={activeLoading}
        filterStore={activeFilterStore}
        tableFilters={tableFilters}
        request={() =>
          loadTasks(taskTab, {
            pageIndex: 1,
            pageSize: activeViewState.pageSize,
          })
        }
        extraBtn={toolbarActions}
        className="inspection-task-management__table admin-table"
        onRow={(record: Record<string, any>) => ({
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            if (shouldIgnoreTaskRowClick(event)) return
            navigateToDetail(record as InspectionTeamTaskRow)
          },
        })}
        onChange={handleTableChange as TableProps<Record<string, any>>["onChange"]}
        pagination={{
          size: "default",
          current: activeViewState.pageIndex,
          pageSize: activeViewState.pageSize,
          total: activeViewState.total,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (total: number) => (
            <PaginationTotal
              label={t("common.total")}
              total={total}
              current={activeViewState.pageIndex}
              pageSize={activeViewState.pageSize}
            />
          ),
        }}
      />

      <InspectionTaskModal
        visible={taskModalVisible}
        mode={taskModalMode}
        editingTask={editingTask}
        isInspectorSelfCreate={false}
        currentInspectorId={currentInspectorId}
        inspectorOptions={taskInspectorOptions}
        inspectorOptionsLoading={taskInspectorOptionsLoading}
        getAuthorityName={getAuthorityName}
        onVisibleChange={handleTaskModalVisibleChange}
        onSubmitted={handleTaskSubmitted}
      />

      <CancelTaskModal
        visible={cancelTaskModalVisible && Boolean(cancellingTask)}
        title={t("inspection.tasks.actions.cancelTask")}
        content={
          <div className="team-management-cancel-task-modal__content">
            <p>
              {t(
                "inspection.tasks.messages.cancelConfirmDescription",
                "Are you sure you want to cancel this inspection task?"
              )}
            </p>
            <p>
              {t(
                "inspection.tasks.messages.cancelConfirmImpact",
                "This action cannot be undone. The task will be marked as Cancelled and no inspection will be performed."
              )}
            </p>
          </div>
        }
        cancelText={t("common.cancel")}
        confirmText={t("common.confirm")}
        loading={cancelTaskLoading}
        onCancel={closeCancelTaskModal}
        onConfirm={confirmCancelTask}
      />
    </>
  )
}

export default InspectionTeamTasksPanel
