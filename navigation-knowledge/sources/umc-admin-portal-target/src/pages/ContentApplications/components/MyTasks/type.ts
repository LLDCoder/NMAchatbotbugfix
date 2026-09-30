import type { IRejectStatus } from "../RejectModal/type"
import type { WorkflowActionConfig } from "@/constants/workflowActions"

interface IMemberSelection {
  label: string
  value: string
}

type TStatusSelection = IMemberSelection

type TCategoriesSelection = IMemberSelection

const ACTIVE_TAB = {
  todo: "1",
  completed: "2",
} as const

const AI_RECOMANDATION = {
  2: "approve",
  3: "reject",
  4: "reject",
} as const

type TValueOfAIRecomandation =
  (typeof AI_RECOMANDATION)[keyof typeof AI_RECOMANDATION]
type TKeyOfAIRecomandation = keyof typeof AI_RECOMANDATION

type TKeyOfActiveTab = (typeof ACTIVE_TAB)[keyof typeof ACTIVE_TAB]

type TKeyList = TKeyOfActiveTab[]

interface IRequestConfig {
  sortBy?: string
  sortDirection?: 0 | 1
  pageIndex?: number
  pageSize?: number
  approvalStatus?: string[] | null
  startTime?: string | null
  endTime?: string | null
}

interface IButtonAuth {
  approve?: boolean | WorkflowActionConfig
  reject?: IRejectStatus
  requestModification?: boolean
}

export { ACTIVE_TAB, AI_RECOMANDATION }
export type {
  IMemberSelection,
  TStatusSelection,
  TKeyOfActiveTab,
  TKeyList,
  IRequestConfig,
  TCategoriesSelection,
  IButtonAuth,
  TValueOfAIRecomandation,
  TKeyOfAIRecomandation,
}
