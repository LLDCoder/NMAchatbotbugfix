import type { ITeamTasksDto } from "@/services/team"

interface IMemberSelection {
  label: string
  value: string
}

type TStatusSelection = Record<TKeyOfActiveTab, IMemberSelection[]>

const ACTIVE_TAB = {
  todo: "1",
  completed: "2",
} as const

type TKeyOfActiveTab = (typeof ACTIVE_TAB)[keyof typeof ACTIVE_TAB]

type TKeyList = TKeyOfActiveTab[]

interface IRequestConfig {
  sortBy?: keyof ITeamTasksDto
  sortDirection?: 0 | 1
  pageIndex?: number
  pageSize?: number
}

export { ACTIVE_TAB }
export type {
  IMemberSelection,
  TStatusSelection,
  TKeyOfActiveTab,
  TKeyList,
  IRequestConfig,
}
