import type {
  TeamManagementOption,
  TeamTaskTab,
} from "@/services/teamManagement"

export interface TeamTaskSortState {
  sortBy: string
  sortDirection: 0 | 1
}

export const DEFAULT_SORT_BY_TAB: Record<TeamTaskTab, TeamTaskSortState> = {
  todo: {
    sortBy: "slaSortValue",
    sortDirection: 1,
  },
  completed: {
    sortBy: "lastUpdated",
    sortDirection: 1,
  },
}

export const DEFAULT_TASK_FILTER_CONTAINER_CLS =
  "team-management-filter-table"

export const EMPTY_STATUS_OPTIONS_BY_TAB: Record<
  TeamTaskTab,
  TeamManagementOption[]
> = {
  todo: [],
  completed: [],
}

export const EMPTY_STATUS_OPTIONS_READY_BY_TAB: Record<TeamTaskTab, boolean> = {
  todo: false,
  completed: false,
}

// Auto / Self-Monitor executors only exist on finished tasks, so the Completed tab owns them.
export const COMPLETED_ONLY_MEMBER_VALUES = {
  auto: "auto",
  selfMonitor: "self-monitor",
} as const

export const COMPLETED_ONLY_MEMBER_VALUE_LIST: string[] = [
  COMPLETED_ONLY_MEMBER_VALUES.auto,
  COMPLETED_ONLY_MEMBER_VALUES.selfMonitor,
]
