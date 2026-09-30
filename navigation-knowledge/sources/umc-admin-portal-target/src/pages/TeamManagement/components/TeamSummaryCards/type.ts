import type { ReactNode } from "react"
import type {
  TeamManagementScope,
  TeamManagementSummary,
  TeamTaskCategory,
} from "@/services/teamManagement"

export interface TeamSummaryCardsProps {
  scope: TeamManagementScope
  summary: TeamManagementSummary
  supportedTaskCategories: TeamTaskCategory[]
}

export interface SummaryCardItem {
  key: string
  labelKey: string
  value: number
  icon: ReactNode
  label?: string
  category?: TeamTaskCategory
}
