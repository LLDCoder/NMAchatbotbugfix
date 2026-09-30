import { useCallback, useMemo } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { Tag, Tooltip } from "antd"
import type { TableProps } from "antd/lib/table"
import { useTranslation } from "react-i18next"
import { PaginationTotal, PermissionGuard } from "@/components/common"
import { InspectionViolationStatusTag } from "@/pages/InspectionCommon/components"
import type {
  TeamManagementScope,
  TeamManagementTaskItem,
  TeamTaskCategory,
  TeamTaskTab,
} from "@/services/teamManagement"
import { DEFAULT_PAGE_INFO } from "@/hooks/usePagination"
import { useResponsiveActionColumnWidth } from "@/hooks/useResponsiveActionColumnWidth"
import applicationNoProfileStar from "@/assets/images/application-no-star.png"
import TeamManagementStatusTag from "../../TeamManagementStatusTag"
import type {
  TeamManagementControlledTaskPanelConfig,
} from "../../../type"
import type { TeamManagementScopeConfig } from "../../../taskConfig"
import {
  formatTeamManagementDate,
  getApplyForIconSrc,
  getTaskCategoryLabel,
  getTeamManagementSlaPresentation,
  getTeamManagementSubStatusTone,
  resolveTeamManagementTaskDetail,
  splitTeamManagementStatus,
} from "../../../utils"
import type { TableRowSelection, TeamTasksPanelProps } from "../type"
import { buildReassignTaskSelection } from "../utils"
import { TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY } from "../../../teamManagementReturnState"

interface UseTeamTaskTableConfigParams {
  activePanelConfig?: TeamManagementControlledTaskPanelConfig
  activeTab: TeamTaskTab
  canReassignTasks: boolean
  dataSource: TeamManagementTaskItem[]
  handleTableChange: NonNullable<
    TableProps<TeamManagementTaskItem>["onChange"]
  >
  onOpenReassign: TeamTasksPanelProps["onOpenReassign"]
  pageInfo: typeof DEFAULT_PAGE_INFO
  rowSelection: TableRowSelection<TeamManagementTaskItem> | undefined
  scope: TeamManagementScope
  scopeConfig: TeamManagementScopeConfig
}

type TeamManagementActionColumnKey = "reassign"

const TEAM_MANAGEMENT_ACTION_BUTTON_WIDTH_MAP = {}

const TEAM_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 0,
  padding: 32,
  minWidth: 120,
  maxWidth: 160,
}

const TEAM_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 0,
  padding: 24,
  minWidth: 104,
  maxWidth: 140,
}

const TEAM_MANAGEMENT_ACTION_TEXT_MEASURE_CONFIG = {
  font: "600 16px Inter, sans-serif",
  narrowFont: "600 14px Inter, sans-serif",
  textPadding: 0,
}

export const useTeamTaskTableConfig = ({
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
}: UseTeamTaskTableConfigParams) => {
  const { t } = useTranslation()
  const history = useHistory()
  const location = useLocation()

  const getVisibleActions = useCallback(
    (record: TeamManagementTaskItem): TeamManagementActionColumnKey[] => {
      if (
        activeTab !== "todo" ||
        !canReassignTasks ||
        record.canReassign === false
      ) {
        return []
      }

      return ["reassign"]
    },
    [activeTab, canReassignTasks]
  )

  const getActionLabel = useCallback(
    (actionKey: TeamManagementActionColumnKey) => {
      const actionLabelMap: Record<TeamManagementActionColumnKey, string> = {
        reassign: t("teamManagement.reassign.action"),
      }

      return actionLabelMap[actionKey]
    },
    [t]
  )

  const actionColumnWidth = useResponsiveActionColumnWidth<
    TeamManagementTaskItem,
    TeamManagementActionColumnKey
  >({
    rows: dataSource,
    buttonWidthMap: TEAM_MANAGEMENT_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions,
    getActionLabel,
    desktopConfig: TEAM_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: TEAM_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: TEAM_MANAGEMENT_ACTION_TEXT_MEASURE_CONFIG,
  })
  const hasVipTask = useMemo(
    () => dataSource.some((record) => record.profileIsVIP),
    [dataSource]
  )

  const handleTaskRowClick = useCallback(
    (record: TeamManagementTaskItem) => {
      const detailPath = resolveTeamManagementTaskDetail(record)
      if (!detailPath) {
        return
      }

      history.push(detailPath, {
        [TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY]: `${location.pathname}${location.search}${location.hash}`,
      })
    },
    [history, location.hash, location.pathname, location.search]
  )

  const defaultColumns = useMemo<TableProps<TeamManagementTaskItem>["columns"]>(
    () => {
      const baseColumns: NonNullable<
        TableProps<TeamManagementTaskItem>["columns"]
      > = [
        {
          title: t("teamManagement.table.taskNo"),
          dataIndex: "taskNo",
          key: "taskNo",
          fixed: "left",
          width: 260,
          render: (text, record) => (
            <div className="team-management-task-no">
              <div className="team-management-task-no__main">
                {hasVipTask ? (
                  <span className="team-management-task-no__star-slot">
                    {record.profileIsVIP ? (
                      <img
                        src={applicationNoProfileStar}
                        alt=""
                        className="team-management-task-no__star"
                      />
                    ) : (
                      <span
                        className="team-management-task-no__star-placeholder"
                        aria-hidden
                      />
                    )}
                  </span>
                ) : null}
                <span className="team-management-task-no__text">
                  {String(text || "-").trim() || "-"}
                </span>
              </div>
              {record.isUrgent ? (
                <Tag
                  color="rgba(235, 95, 36, 1)"
                  className="team-management-urgent-tag"
                >
                  {t("teamManagement.table.urgent")}
                </Tag>
              ) : null}
            </div>
          ),
        },
        {
          title: t("teamManagement.table.taskCategory"),
          dataIndex: "taskCategory",
          key: "taskCategory",
          render: (value: TeamTaskCategory, record) =>
            scope === "customer" && value === "enquiries"
              ? getTaskCategoryLabel(value, t, scope)
              : record.taskCategoryLabel ||
                getTaskCategoryLabel(value, t, scope),
        },
        {
          title: t("teamManagement.table.applyFor"),
          dataIndex: "applyFor",
          key: "applyFor",
          width: 220,
          ellipsis: false,
          render: (text: string, record) => {
            const displayText = String(text || "-").trim() || "-"
            const shouldShowApplyForIcon = displayText !== "-"
            const applyForIconSrc = shouldShowApplyForIcon
              ? getApplyForIconSrc(record.applyForUserTypeId)
              : null

            return (
              <Tooltip
                title={displayText !== "-" ? displayText : undefined}
                color="#fff"
                overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
                placement="topLeft"
              >
                <span className="team-management-apply-for-cell">
                  {applyForIconSrc ? (
                    <img
                      src={applyForIconSrc}
                      alt=""
                      className="team-management-apply-for-cell__icon"
                    />
                  ) : null}
                  <span className="team-management-apply-for-cell__text">
                    {displayText}
                  </span>
                </span>
              </Tooltip>
            )
          },
        },
        {
          title: t("teamManagement.table.assignedTo"),
          dataIndex: "assignedTo",
          key: "assignedTo",
          render: (text: string, record) => {
            const assignedValue = (
              String(record.assignedToUserId ?? "").trim() ||
              String(text ?? "").trim()
            ).toLowerCase()

            if (assignedValue === "auto") {
              return t("teamManagement.memberOptions.auto")
            }

            if (assignedValue === "self-monitor") {
              return t("teamManagement.memberOptions.selfMonitor")
            }

            return text || "-"
          },
        },
        {
        title: t("teamManagement.table.status"),
        dataIndex: "status",
        key: "status",
        width: 220,
        render: (text: string, record) => {
        const { mainStatus, subStatus } = splitTeamManagementStatus(
        record.status || text
        )
        const statusLabel = mainStatus || "-"
        // Status display-only may still carry the bracketed sub status, keep the main part for tone mapping.
        const mainStatusDisplayOnly =
        splitTeamManagementStatus(record.statusDisplayOnly).mainStatus ||
        mainStatus
        const statusNode =
        record.taskCategory === "violations" ? (
          <InspectionViolationStatusTag
          status={
          mainStatusDisplayOnly ||
          record.statusCode ||
          mainStatus ||
          record.status
          }
          label={statusLabel}
          />
          ) : (
          <TeamManagementStatusTag
          scope={scope}
          statusDisplayOnly={mainStatusDisplayOnly}
          label={statusLabel}
          />
        )

        if (!subStatus) {
        return statusNode
        }

        return (
        <div className="team-management-status-cell">
          {statusNode}
          <span
          className={`team-management-status-cell__sub team-management-status-cell__sub--${getTeamManagementSubStatusTone(
          subStatus
          )}`}
          title={subStatus}
          >
          {subStatus}
          </span>
        </div>
        )
        },
        },
        {
          title: t("teamManagement.table.lastUpdated"),
          dataIndex: "lastUpdated",
          key: "lastUpdated",
          sorter: true,
          render: (text: string) => formatTeamManagementDate(text),
        },
      ]

      if (activeTab !== "completed") {
        const applyForColumnIndex = baseColumns.findIndex(
          (column) => column.key === "applyFor"
        )
        const slaColumnIndex =
          applyForColumnIndex >= 0 ? applyForColumnIndex + 1 : baseColumns.length

        baseColumns.splice(slaColumnIndex, 0, {
          title: t("teamManagement.table.sla"),
          dataIndex: "slaDisplay",
          key: "slaSortValue",
          width: 160,
          sorter: true,
          render: (_, record) => {
            const slaPresentation = getTeamManagementSlaPresentation(record)

            return (
              <span
                className={
                  slaPresentation.isOverdue
                    ? "team-management-sla-overdue"
                    : ""
                }
              >
                {slaPresentation.text}
              </span>
            )
          },
        })
      }

      if (activeTab === "todo" && canReassignTasks) {
        baseColumns.push({
          title: t("teamManagement.table.actions"),
          key: "actions",
          fixed: "right",
          width: actionColumnWidth,
          render: (_, record) => {
            const canReassign = record.canReassign !== false
            
            if (!canReassign) {
              return "-"
            }

            const actionNode = (
              <div className="team-management-table-action">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenReassign([buildReassignTaskSelection(record)], 1)
                  }}
                >
                  {t("teamManagement.reassign.action")}
                </button>
              </div>
            )

            if (!scopeConfig.permissions.reassign) {
              return actionNode
            }
            
            return (
              <PermissionGuard
                permissionCode={scopeConfig.permissions.reassign}
                routePath={scopeConfig.permissionRoutePath}
                fallback="-"
              >
                {actionNode}
              </PermissionGuard>
            )
          },
        })
      }

      return baseColumns
    },
    [
      activeTab,
      actionColumnWidth,
      canReassignTasks,
      hasVipTask,
      onOpenReassign,
      scope,
      scopeConfig.permissionRoutePath,
      scopeConfig.permissions.reassign,
      t,
    ]
  )

  const defaultTableConfigs = useMemo<TableProps<TeamManagementTaskItem>>(
    () => ({
      columns: defaultColumns,
      dataSource,
      rowKey: (record) => record.taskId,
      rowSelection,
      scroll: { x: 1400 },
      onRow: (record) => ({
        onClick: (event) => {
          const target = event.target as HTMLElement
          const selectionCell = target.closest("td.ant-table-selection-column")

          if (selectionCell) {
            if (!target.closest(".ant-checkbox")) {
              selectionCell.querySelector<HTMLInputElement>(
                ".ant-checkbox-input"
              )?.click()
            }
            return
          }

          handleTaskRowClick(record)
        },
      }),
      onChange: handleTableChange,
      pagination: {
        total: pageInfo.total,
        pageSize: pageInfo.pageSize,
        current: pageInfo.pageIndex,
        showSizeChanger: true,
        showTotal: (total) => (
          <PaginationTotal
            label={t("common.total")}
            total={total}
            current={pageInfo.pageIndex}
            pageSize={pageInfo.pageSize}
          />
        ),
        pageSizeOptions: ["10", "20", "50", "100"],
      },
    }),
    [
      dataSource,
      defaultColumns,
      handleTableChange,
      handleTaskRowClick,
      pageInfo,
      rowSelection,
      t,
    ]
  )

  const resolvedTableConfigs = useMemo<TableProps<Record<string, any>>>(() => {
    if (!activePanelConfig) {
      return defaultTableConfigs as unknown as TableProps<Record<string, any>>
    }

    return {
      ...(defaultTableConfigs as unknown as TableProps<Record<string, any>>),
      ...(activePanelConfig.columns ? { columns: activePanelConfig.columns } : {}),
      ...(activePanelConfig.dataSource
        ? { dataSource: activePanelConfig.dataSource }
        : {}),
      ...(activePanelConfig.rowKey ? { rowKey: activePanelConfig.rowKey } : {}),
      ...(activePanelConfig.rowSelection
        ? { rowSelection: activePanelConfig.rowSelection }
        : {}),
      ...(activePanelConfig.scroll ? { scroll: activePanelConfig.scroll } : {}),
      ...(activePanelConfig.onRow ? { onRow: activePanelConfig.onRow } : {}),
      ...(activePanelConfig.onTableChange
        ? { onChange: activePanelConfig.onTableChange }
        : {}),
      ...(activePanelConfig.pagination
        ? { pagination: activePanelConfig.pagination }
        : {}),
      ...(activePanelConfig.locale ? { locale: activePanelConfig.locale } : {}),
      ...(activePanelConfig.tableClassName
        ? { className: activePanelConfig.tableClassName }
        : {}),
    }
  }, [activePanelConfig, defaultTableConfigs])

  return {
    resolvedTableConfigs,
  }
}
