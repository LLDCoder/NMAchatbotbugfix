import type {
  TeamManagementAdapterMode,
  TeamManagementAssignedAreaSelection,
  TeamManagementScope,
} from "@/services/teamManagement"

export interface AssignedAreaModalProps {
  scope: TeamManagementScope
  serviceAdapterMode?: TeamManagementAdapterMode
  visible: boolean
  isEdit: boolean
  memberId: string
  memberName: string
  currentArea: TeamManagementAssignedAreaSelection | null
  onCancel: () => void
  onSuccess: () => void
}

export interface AreaFormValues {
  assignedEmirateIds?: number[]
  assignedRegionIds?: number[]
  assignedAreaIds?: number[]
}

export interface AreaOption {
  value: number
  label: string
}
