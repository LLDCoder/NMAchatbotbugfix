import type { ReactElement, ReactNode } from "react"
import type { TableProps } from "antd/lib/table"
import type { FilterItem, IFilterStore } from "@/components/common/FilterTable/type"
import type {
  TeamManagementAdapterMode,
  TeamManagementTaskItem,
  TeamTaskTab,
} from "@/services/teamManagement"
import type { TeamManagementScopeConfig } from "../../taskConfig"
import type {
  ReassignModalState,
  TeamManagementControlledTaskPanelConfig,
} from "../../type"

export type TableRowSelection<T extends object = object> =
  TableProps<T>["rowSelection"]

export type TeamTaskReassignSelection = Pick<
  TeamManagementTaskItem,
  "sourceType" | "sourceId" | "userId" | "assignedTo" | "assignedToUserId"
>

export interface TeamTasksPanelQueryParams {
  pageIndex?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: 0 | 1
}

export interface UseTeamTasksPanelResult {
  activeTab: TeamTaskTab
  activePanelConfig?: TeamManagementControlledTaskPanelConfig
  filterTableRenderKey: string
  handleTabChange: (key: string) => void
  resolvedTableConfigs: TableProps<Record<string, any>>
  resolvedTableFilters: FilterItem[]
  resolvedFilterStore: IFilterStore
  resolvedLoading: boolean
  resolvedRequest: () => Promise<void> | undefined
  resolvedRenderSelectionTip: () => ReactElement
  resolvedFilterTableContainerCls: string
  extraActions: ReactElement | null
  ensureMemberOptionsLoaded: () => Promise<void>
}

export interface TeamTasksPanelProps {
  scopeConfig: TeamManagementScopeConfig
  serviceAdapterMode?: TeamManagementAdapterMode
  applicationTaskOnly: boolean
  refreshToken: number
  toggleControl?: ReactNode
  taskTab?: TeamTaskTab
  onTaskTabChange?: (taskTab: TeamTaskTab) => void
  taskHeaderExtraContent?: ReactNode
  onCreateTask?: () => void
  createTaskText?: string
  activeTaskSourceKey?: string
  taskSourcePanelConfigs?: Record<
    string,
    TeamManagementControlledTaskPanelConfig | undefined
  >
  onOpenReassign: (
    tasks: ReassignModalState["tasks"],
    selectedCount: number
  ) => void
}
