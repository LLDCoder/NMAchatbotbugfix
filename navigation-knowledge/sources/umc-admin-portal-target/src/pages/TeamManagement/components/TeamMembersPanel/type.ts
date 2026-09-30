import type { Moment } from "moment"
import type {
  TeamManagementAdapterMode,
  TeamManagementAssignedAreaSelection,
} from "@/services/teamManagement"
import type { TeamManagementScopeConfig } from "../../taskConfig"

export interface TeamMembersPanelProps {
  scopeConfig: TeamManagementScopeConfig
  serviceAdapterMode?: TeamManagementAdapterMode
  refreshToken: number
  onOpenMarkLeave: (memberId: string, memberName: string) => void
  onOpenResumeWork: (memberId: string, memberName: string) => void
  onOpenSetAssignedArea: (memberId: string, memberName: string) => void
  onOpenEditAssignedArea: (
    memberId: string,
    memberName: string,
    currentArea: TeamManagementAssignedAreaSelection | null
  ) => void
}

export interface MemberOption {
  label: string
  value: string
}

export type TeamMembersRange = [Moment, Moment]
