import { useCallback, useMemo } from "react"
import { Tag } from "antd"
import type { ColumnsType, TableProps } from "antd/lib/table"
import type { SorterResult } from "antd/lib/table/interface"
import {
  getPriorityClassName,
  getPriorityLabel,
} from "@/pages/InspectionCommon/helpers"
import { pxToRemValue } from "@/utils/rem"
import { useResponsiveActionColumnWidth } from "@/hooks/useResponsiveActionColumnWidth"
import { getAdaptiveActionColumnKeys } from "@/components/common/AdaptiveActionGroup/layout"
import { getApplyForIconSrc } from "../../../utils"
import TeamManagementStatusTag from "../../TeamManagementStatusTag"
import TaskActions from "../components/TaskActions"
import {
  createDefaultInspectionTeamTaskViewState,
  formatTaskDate,
  formatTaskDateTime,
  getInspectionTeamTaskSlaClassName,
} from "../utils"
import type {
  InspectionTeamTaskRow,
  InspectionTeamTaskSortField,
  InspectionTeamTaskViewState,
  InspectionTeamTaskActionKey,
  TaskAction,
  TeamTaskView,
} from "../type"

interface UseInspectionTeamTaskTableConfigParams {
  activeViewState: InspectionTeamTaskViewState
  buildActions: (record: InspectionTeamTaskRow) => TaskAction[]
  dataSource: InspectionTeamTaskRow[]
  loadTasks: (
    view: TeamTaskView,
    overrides?: Record<string, unknown>
  ) => Promise<void>
  setViewState: React.Dispatch<
    React.SetStateAction<Record<TeamTaskView, InspectionTeamTaskViewState>>
  >
  t: (key: string) => string
  taskTab: TeamTaskView
}

type InspectionTeamTaskActionColumnKey = InspectionTeamTaskActionKey | "more"

const INSPECTION_TEAM_TASK_ACTION_BUTTON_WIDTH_MAP = {
  more: {
    default: 20,
    compact: 20,
  },
} as const

const INSPECTION_TEAM_TASK_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 120,
  maxWidth: 220,
}

const INSPECTION_TEAM_TASK_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 104,
  maxWidth: 200,
}

const INSPECTION_TEAM_TASK_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
}

export const useInspectionTeamTaskTableConfig = ({
  activeViewState,
  buildActions,
  dataSource,
  loadTasks,
  setViewState,
  t,
  taskTab,
}: UseInspectionTeamTaskTableConfigParams) => {
  const getVisibleActions = useCallback(
    (record: InspectionTeamTaskRow): InspectionTeamTaskActionColumnKey[] => {
      return getAdaptiveActionColumnKeys(buildActions(record), "more", {
        maxInlineActions: 2,
      })
    },
    [buildActions]
  )

  const getActionLabel = useCallback(
    (actionKey: InspectionTeamTaskActionColumnKey) => {
      const actionLabelMap: Partial<
        Record<InspectionTeamTaskActionColumnKey, string>
      > = {
        edit: t("inspection.common.edit"),
        cancel: t("inspection.common.cancel"),
        duplicate: t("inspection.common.duplicate"),
        viewReport: t("inspection.common.viewReport"),
      }

      return actionLabelMap[actionKey]
    },
    [t]
  )

  const actionColumnWidth = useResponsiveActionColumnWidth<
    InspectionTeamTaskRow,
    InspectionTeamTaskActionColumnKey
  >({
    rows: dataSource,
    buttonWidthMap: INSPECTION_TEAM_TASK_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions,
    getActionLabel,
    desktopConfig: INSPECTION_TEAM_TASK_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: INSPECTION_TEAM_TASK_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: INSPECTION_TEAM_TASK_ACTION_TEXT_MEASURE_CONFIG,
  })

  const columns = useMemo<ColumnsType<InspectionTeamTaskRow>>(
    () => {
      const baseColumns: ColumnsType<InspectionTeamTaskRow> = [
        {
          title: t("inspection.tasks.columns.taskNo"),
          dataIndex: "taskNo",
          width: pxToRemValue(180),
          render: (value: string) => (
            <span className="inspection-task-management__task-no">
              {value || "-"}
            </span>
          ),
        },
        {
          title: t("inspection.tasks.columns.inspectionTarget"),
          dataIndex: "inspectionTargetLabel",
          width: pxToRemValue(235),
          render: (_, record) => {
            const targetLabel = record.inspectionTargetLabel || "-"
            const targetIconSrc = getApplyForIconSrc(record.applyForUserTypeId)

            return (
              <div className="inspection-task-management__target-cell">
                <img
                  className="inspection-task-management__target-icon"
                  src={targetIconSrc || ""}
                  alt=""
                />
                <span title={targetLabel}>{targetLabel}</span>
              </div>
            )
          },
        },
        {
          title: t("inspection.tasks.columns.inspectionReason"),
          dataIndex: "inspectionReasonLabel",
          width: pxToRemValue(200),
          render: (value: string) => value || "-",
        },
        {
          title: t("inspection.tasks.columns.inspector"),
          dataIndex: "inspectorLabel",
          width: pxToRemValue(180),
          render: (value: string) => value || "-",
        },
        {
          title: t("inspection.tasks.columns.priority"),
          key: "priority",
          width: pxToRemValue(120),
          sorter: true,
          sortOrder:
            activeViewState.sortBy === "priority"
              ? activeViewState.sortDirection === 0
                ? "ascend"
                : "descend"
              : null,
          render: (_, record) => (
            <Tag
              className={`inspection-task-management__priority-tag ${getPriorityClassName(
                record.priorityLabel
              )}`}
            >
              {getPriorityLabel(record.priorityLabel)}
            </Tag>
          ),
        },
        {
          title: t("inspection.tasks.columns.dueDate"),
          key: "dueDate",
          width: pxToRemValue(130),
          sorter: true,
          sortDirections: ["ascend", "descend", "ascend"],
          sortOrder:
            activeViewState.sortBy === "dueDate"
              ? activeViewState.sortDirection === 0
                ? "ascend"
                : "descend"
              : null,
          render: (_, record) => (
            <span className="inspection-task-management__date-cell">
              {formatTaskDate(record.dueDateValue)}
            </span>
          ),
        },
        {
          title: t("inspection.tasks.columns.sla"),
          key: "sla",
          width: pxToRemValue(120),
          sorter: true,
          sortOrder:
            activeViewState.sortBy === "sla"
              ? activeViewState.sortDirection === 0
                ? "ascend"
                : "descend"
              : null,
          render: (_, record) => {
            const slaClassName = getInspectionTeamTaskSlaClassName(record)

            return (
              <span
                className={["inspection-task-management__sla-cell", slaClassName]
                  .filter(Boolean)
                  .join(" ")}
              >
                {record.slaText || "-"}
              </span>
            )
          },
        },
        {
          title: t("inspection.tasks.columns.status"),
          dataIndex: "status",
          width: pxToRemValue(150),
          render: (_, record) => (
            <TeamManagementStatusTag
              scope="inspection"
              statusDisplayOnly={record.statusDisplayOnly}
              label={record.status || "-"}
              className="inspection-task-management__status-label"
            />
          ),
        },
        {
          title: t("inspection.tasks.columns.emirate"),
          dataIndex: "emirateLabel",
          width: pxToRemValue(130),
          render: (value: string) => value || "-",
        },
        {
          title: t("inspection.tasks.columns.area"),
          dataIndex: "areaLabel",
          width: pxToRemValue(180),
          render: (value: string) => value || "-",
        },
      ]

      if (taskTab === "todo") {
        baseColumns.push(
          {
            title: t("inspection.tasks.columns.assignedTime"),
            key: "assignedTime",
            width: pxToRemValue(180),
            sorter: true,
            sortOrder:
              activeViewState.sortBy === "assignedTime"
                ? activeViewState.sortDirection === 0
                  ? "ascend"
                  : "descend"
                : null,
            render: (_, record) => formatTaskDateTime(record.assignedTimeValue),
          },
          {
            title: t("inspection.tasks.columns.inspectionMethod"),
            dataIndex: "inspectionMethodLabel",
            width: pxToRemValue(160),
            render: (value: string) => value || "-",
          },
          {
            title: t("inspection.tasks.columns.createdBy"),
            dataIndex: "createdByLabel",
            width: pxToRemValue(170),
            render: (value: string) => value || "-",
          }
        )
      }

      if (taskTab === "completed") {
        baseColumns.push({
          title: t("inspection.tasks.columns.lastUpdate"),
          key: "lastUpdatedOn",
          width: pxToRemValue(180),
          sorter: true,
          sortDirections: ["ascend", "descend", "ascend"],
          sortOrder:
            activeViewState.sortBy === "lastUpdatedOn"
              ? activeViewState.sortDirection === 0
                ? "ascend"
                : "descend"
              : null,
          render: (_, record) => formatTaskDateTime(String(record.lastUpdatedOn || "")),
        })

        baseColumns.push({
          title: t("inspection.tasks.columns.inspectionMethod"),
          dataIndex: "inspectionMethodLabel",
          width: pxToRemValue(160),
          render: (value: string) => value || "-",
        })

        baseColumns.push({
          title: t("inspection.tasks.columns.createdBy"),
          dataIndex: "createdByLabel",
          width: pxToRemValue(170),
          render: (value: string) => value || "-",
        })
      }

      baseColumns.push({
        title: t("inspection.tasks.columns.action"),
        className: "inspection-task-management__actions-column",
        width: pxToRemValue(actionColumnWidth),
        fixed: "right",
        render: (_, record) => <TaskActions actions={buildActions(record)} />,
      })

      return baseColumns
    },
    [
      actionColumnWidth,
      activeViewState.sortBy,
      activeViewState.sortDirection,
      buildActions,
      t,
      taskTab,
    ]
  )

  const handleTableChange: TableProps<InspectionTeamTaskRow>["onChange"] =
    useCallback(
      (pagination, _filters, sorter, extra) => {
        const activeSorter = Array.isArray(sorter)
          ? sorter[0]
          : (sorter as SorterResult<InspectionTeamTaskRow>)
        const nextPageIndex = pagination.current || 1
        const nextPageSize = pagination.pageSize || activeViewState.pageSize

        if (extra?.action === "sort") {
          const order = activeSorter?.order
          const nextSortBy =
            (order === "ascend" || order === "descend") &&
            typeof activeSorter?.columnKey === "string"
              ? (activeSorter.columnKey as InspectionTeamTaskSortField)
              : createDefaultInspectionTeamTaskViewState(taskTab).sortBy
          const nextSortDirection =
            order === "ascend"
              ? 0
              : order === "descend"
                ? 1
                : createDefaultInspectionTeamTaskViewState(taskTab).sortDirection

          setViewState((previous) => ({
            ...previous,
            [taskTab]: {
              ...previous[taskTab],
              pageIndex: 1,
              pageSize: nextPageSize,
              sortBy: nextSortBy,
              sortDirection: nextSortDirection,
            },
          }))
          void loadTasks(taskTab, {
            pageIndex: 1,
            pageSize: nextPageSize,
            sortBy: nextSortBy,
            sortDirection: nextSortDirection,
          })
          return
        }

        setViewState((previous) => ({
          ...previous,
          [taskTab]: {
            ...previous[taskTab],
            pageIndex: nextPageIndex,
            pageSize: nextPageSize,
          },
        }))
        void loadTasks(taskTab, {
          pageIndex: nextPageIndex,
          pageSize: nextPageSize,
        })
      },
      [activeViewState.pageSize, loadTasks, setViewState, taskTab]
    )

  return {
    columns,
    handleTableChange,
  }
}
