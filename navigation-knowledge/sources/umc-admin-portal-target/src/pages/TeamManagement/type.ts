import type { ReactElement, ReactNode } from "react"
import type { TableProps } from "antd/lib/table"
import type { FilterItem, IFilterStore } from "@/components/common/FilterTable/type"
import type {
  MemberMetricCategory,
  TeamManagementAdapterMode,
  TeamManagementMemberCard,
  TeamManagementAssignedAreaSelection,
  TeamManagementScope,
  TeamManagementSummary,
  TeamManagementTaskItem,
  TeamTaskTab,
} from "@/services/teamManagement"

export type TeamManagementMainTab = "teamTasks" | "teamMembers"

export interface TeamManagementPageContext {
  scope: TeamManagementScope
  summary: TeamManagementSummary
  urgentCount: number
}

export interface ReassignModalState {
  visible: boolean
  tasks: Array<
    Pick<
      TeamManagementTaskItem,
      "sourceType" | "sourceId" | "userId" | "assignedTo" | "assignedToUserId"
    >
  >
  selectedCount: number
}

export interface LeaveModalState {
  visible: boolean
  memberId: string
  memberName: string
}

export interface ResumeModalState {
  visible: boolean
  memberId: string
  memberName: string
}

export interface AssignedAreaModalState {
  visible: boolean
  isEdit: boolean
  memberId: string
  memberName: string
  currentArea: TeamManagementAssignedAreaSelection | null
}

export interface TeamManagementMemberCardUpdatePayload {
  memberId: string
  category: MemberMetricCategory
  nextCard: TeamManagementMemberCard | null
}

export type TeamManagementSorterField = "slaSortValue" | "lastUpdated"
export type TeamTaskSourceRenderMode = "default" | "custom"

export interface TeamManagementTaskSourceOption {
  key: string
  labelKey: string
  renderMode?: TeamTaskSourceRenderMode
}

export interface TeamManagementTaskSourceRenderContext {
  activeSource: TeamManagementTaskSourceOption
  taskTab?: TeamTaskTab
  onTaskTabChange?: (taskTab: TeamTaskTab) => void
  sourceSwitcherNode: ReactNode | null
}

export interface TeamManagementControlledTaskPanelConfig {
  cardClassName?: string
  tabsClassName?: string
  customContent?: ReactNode
  filterTableContainerCls?: string
  filterStore?: IFilterStore
  tableFilters?: FilterItem[]
  request?: () => Promise<void> | undefined
  autoRequestOnFilterChange?: boolean
  toolbarExtraContent?: ReactNode
  loading?: boolean
  columns?: TableProps<Record<string, any>>["columns"]
  dataSource?: Record<string, any>[]
  rowKey?: TableProps<Record<string, any>>["rowKey"]
  rowSelection?: TableProps<Record<string, any>>["rowSelection"]
  scroll?: TableProps<Record<string, any>>["scroll"]
  onRow?: TableProps<Record<string, any>>["onRow"]
  onTableChange?: TableProps<Record<string, any>>["onChange"]
  pagination?: TableProps<Record<string, any>>["pagination"]
  locale?: TableProps<Record<string, any>>["locale"]
  tableClassName?: string
  renderSelectionTip?: () => ReactElement
  actionButtons?: ReactNode
  hideCreateTask?: boolean
  createTaskText?: string
}

export type TeamManagementLayoutMode = "page" | "embedded"

export interface TeamManagementContentProps {
  scope?: TeamManagementScope
  serviceAdapterMode?: TeamManagementAdapterMode
  layoutMode?: TeamManagementLayoutMode
  forcedMainTab?: TeamManagementMainTab
  renderMainTabs?: boolean
  renderSummaryCards?: boolean
  renderTaskToggle?: boolean
  skipAccessCheck?: boolean
  taskTab?: TeamTaskTab
  onTaskTabChange?: (taskTab: TeamTaskTab) => void
  taskHeaderExtraContent?: ReactNode
  onCreateTask?: () => void
  createTaskText?: string
  taskSources?: TeamManagementTaskSourceOption[]
  activeTaskSourceKey?: string
  onTaskSourceChange?: (taskSourceKey: string) => void
  taskSourcePanelConfigs?: Record<
    string,
    TeamManagementControlledTaskPanelConfig | undefined
  >
}
