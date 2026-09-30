import type {
  MemberMetricCategory,
  TeamManagementMemberCard,
  TeamManagementAssignedAreaSelection,
} from "@/services/teamManagement"

export interface TeamMemberCardProps {
  record: TeamManagementMemberCard
  resetKey: number
  permissionRoutePath?: string
  resumeWorkPermissionCode?: string
  allowMemberLeaveActions?: boolean
  allowAssignedAreaActions?: boolean
  supportedCategories?: MemberMetricCategory[]
  onOpenMarkLeave: (memberId: string, memberName: string) => void
  onOpenResumeWork: (memberId: string, memberName: string) => void
  onOpenSetAssignedArea: (memberId: string, memberName: string) => void
  onOpenEditAssignedArea: (
    memberId: string,
    memberName: string,
    currentArea: TeamManagementAssignedAreaSelection | null
  ) => void
  onCategoryChange: (
    memberId: string,
    category: MemberMetricCategory
  ) => Promise<TeamManagementMemberCard | null>
}

export interface MetricRingProps {
  percent: number
}
