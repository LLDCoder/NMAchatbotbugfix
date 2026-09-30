import type {
  InspectionTeamManagementTaskItemDto,
} from "@/services/inspectionTeamManagement"

import type { AdaptiveActionItem } from "@/components/common/AdaptiveActionGroup"

export type TeamTaskView = "todo" | "completed"

export type InspectionTeamTaskSortField =
  | "priority"
  | "dueDate"
  | "sla"
  | "assignedTime"
  | "lastUpdatedOn"

export interface InspectionTeamTaskViewState {
  pageIndex: number
  pageSize: number
  total: number
  sortBy: InspectionTeamTaskSortField
  sortDirection: 0 | 1
}

export interface TaskFilterOption {
  value: string
  label: string
}

export interface InspectionTeamTaskMetadataOptions {
  reasonOptions: TaskFilterOption[]
  statusOptions: TaskFilterOption[]
  emirateOptions: TaskFilterOption[]
  areaOptions: TaskFilterOption[]
  methodOptions: TaskFilterOption[]
  priorityOptions: TaskFilterOption[]
  inspectorOptions: TaskFilterOption[]
  createdByOptions: TaskFilterOption[]
}

export interface InspectionTeamTaskRow
  extends InspectionTeamManagementTaskItemDto {
  rowKey: string
  inspectionTargetLabel: string
  inspectionReasonLabel: string
  inspectorLabel: string
  priorityLabel: string
  dueDateValue: string
  emirateLabel: string
  areaLabel: string
  assignedTimeValue: string
  inspectionMethodLabel: string
  createdByLabel: string
  statusLabelValue: string
  slaText: string
  slaTone: "default" | "warning" | "danger"
  isOverdueValue: boolean
}

export type InspectionTeamTaskActionKey =
  | "edit"
  | "cancel"
  | "duplicate"
  | "viewReport"

export type TaskAction = AdaptiveActionItem<InspectionTeamTaskActionKey>

export interface InspectionTeamTasksPanelProps {
  taskTab: TeamTaskView
  effectiveSearch: string
  createTaskText?: string
  refreshToken?: number
  onCreateTask?: () => void
  onTaskChanged?: () => void | Promise<void>
}

export interface InspectionTeamTaskQueryResult {
  rows: InspectionTeamTaskRow[]
  viewState: InspectionTeamTaskViewState
}
