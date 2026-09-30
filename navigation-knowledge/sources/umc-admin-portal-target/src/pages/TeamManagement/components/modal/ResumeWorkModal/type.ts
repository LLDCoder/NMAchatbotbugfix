import type {
  TeamManagementAdapterMode,
  TeamManagementScope,
} from "@/services/teamManagement"

export interface ResumeWorkModalProps {
  scope: TeamManagementScope
  serviceAdapterMode?: TeamManagementAdapterMode
  confirmPermissionCode?: string
  permissionRoutePath?: string
  visible: boolean
  memberId: string
  memberName: string
  onCancel: () => void
  onSuccess: () => void
}
