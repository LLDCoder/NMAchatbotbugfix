import type { TTeamTasks } from "@/services/content"

interface IMemberSelection {
  label: string
  value: string
}

type TStatusSelection = IMemberSelection

const ACTIVE_TAB = {
  todo: "1",
  completed: "2",
} as const

type TKeyOfActiveTab = (typeof ACTIVE_TAB)[keyof typeof ACTIVE_TAB]

type TKeyList = TKeyOfActiveTab[]

interface IRequestConfig {
  sortBy?: keyof TTeamTasks
  sortDirection?: 0 | 1
  pageIndex?: number
  pageSize?: number
  approvalStatus?: string[] | null
  startTime?: string | null
  endTime?: string | null
}

export { ACTIVE_TAB }
export type {
  IMemberSelection,
  TStatusSelection,
  TKeyOfActiveTab,
  TKeyList,
  IRequestConfig,
}
