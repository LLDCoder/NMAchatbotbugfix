import type { MemberMetricCategory, TeamTaskCategory, TeamTaskTab } from "@/services/teamManagement"
import type {
  AssignedAreaModalState,
  LeaveModalState,
  ReassignModalState,
  ResumeModalState,
} from "./type"

export const INITIAL_REASSIGN_STATE: ReassignModalState = {
  visible: false,
  tasks: [],
  selectedCount: 0,
}

export const INITIAL_LEAVE_STATE: LeaveModalState = {
  visible: false,
  memberId: "",
  memberName: "",
}

export const INITIAL_RESUME_STATE: ResumeModalState = {
  visible: false,
  memberId: "",
  memberName: "",
}

export const INITIAL_ASSIGNED_AREA_STATE: AssignedAreaModalState = {
  visible: false,
  isEdit: false,
  memberId: "",
  memberName: "",
  currentArea: null,
}

export const TEAM_TASK_TABS: Array<{
  key: TeamTaskTab
  labelKey: string
}> = [
  {
    key: "todo",
    labelKey: "teamManagement.subTabs.todo",
  },
  {
    key: "completed",
    labelKey: "teamManagement.subTabs.completed",
  },
]

export const TEAM_TASK_CATEGORIES: TeamTaskCategory[] = [
  "applications",
  "profileVerifications",
  "enquiries",
  "refunds",
  "appeals",
  "inspectionTasks",
  "violations",
]

export const TEAM_MEMBER_CATEGORIES: MemberMetricCategory[] = [
  "all",
  "applications",
  "profileVerification",
  "enquiries",
  "appeals",
  "refunds",
  "inspectionTasks",
  "violations",
]
