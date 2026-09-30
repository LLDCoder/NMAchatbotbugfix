import type { TeamManagementAdapterMode, TeamManagementScope } from "@/services/teamManagement"
import type { ReassignModalState } from "../../../type"

export interface MemberOption {
  label: string
  value: string
}

export interface ReassignTasksModalProps {
  scope: TeamManagementScope
  serviceAdapterMode?: TeamManagementAdapterMode
  manualReassignSelection?: boolean
  confirmPermissionCode?: string
  permissionRoutePath?: string
  visible: boolean
  tasks: ReassignModalState["tasks"]
  selectedCount: number
  onCancel: () => void
  onSuccess: () => void
}

export interface ReassignFormValues {
  memberId?: string
}

export interface MemberSelectFieldProps {
  value?: string
  onChange?: (value?: string) => void
  options: MemberOption[]
  loading?: boolean
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  searchEmptyText: string
}
