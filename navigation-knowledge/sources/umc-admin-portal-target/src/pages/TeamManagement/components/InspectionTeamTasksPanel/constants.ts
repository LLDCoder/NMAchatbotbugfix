import type { InspectionTeamTaskViewState, TeamTaskView } from "./type"

export const DEFAULT_INSPECTION_TEAM_TASK_VIEW_STATE: Record<
  TeamTaskView,
  InspectionTeamTaskViewState
> = {
  todo: {
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "dueDate",
    sortDirection: 1,
  },
  completed: {
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "lastUpdatedOn",
    sortDirection: 1,
  },
}

export const todoStatusFilterCodes = new Set(["PENDING_VISIT", "IN_PROGRESS"])

export const completedStatusFilterCodes = new Set([
  "ACCESS_FAILED",
  "COMPLETED",
  "CANCELLED",
])

export const SLA_ACTIVE_STATUS_CODES = new Set(["PENDING_VISIT", "IN_PROGRESS"])

export const SLA_CLOSED_STATUS_CODES = new Set([
  "COMPLETED",
  "ACCESS_FAILED",
  "CANCELLED",
  "CANCELED",
])

export const APPEAL_SOURCE_TYPE = "appeal"

export const MINUTES_PER_HOUR = 60

export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

export const inspectionTeamTaskNumericStatusMap: Record<string, string> = {
  "0": "QUEUED",
  "1": "PENDING_VISIT",
  "2": "IN_PROGRESS",
  "3": "ACCESS_FAILED",
  "4": "COMPLETED",
  "5": "CANCELLED",
}
