import type { Moment } from "moment"
import type {
  TeamManagementAdapterMode,
  TeamManagementScope,
} from "@/services/teamManagement"

export interface LeaveReasonOption {
  label: string
  value: string
}

export interface MarkEmergencyLeaveModalProps {
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

export interface LeaveFormValues {
  leaveType?: string
  expectedReturnDate?: Moment
  briefDescription?: string
}
