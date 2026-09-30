import type { TFunction } from "i18next"
import type { Moment } from "moment"
import moment from "moment"
import { transformSpaceString } from "@/utils/transform"
import { ImageBaseUrl } from "@/utils/url"
import enterpriseIcon from "@/assets/images/enterprise.svg"
import userIcon from "@/assets/images/userIcon.svg"
import type {
  MemberMetricCategory,
  TeamManagementScope,
  TeamManagementMemberCard,
  TeamManagementTaskItem,
  TeamTaskCategory,
} from "@/services/teamManagement"

export const getApplyForIconSrc = (
  applyForUserTypeId?: string | number | null
): string | null => {
  const normalizedApplyForUserTypeId = String(applyForUserTypeId ?? "")
    .trim()

  if (!normalizedApplyForUserTypeId) {
    return null
  }

  return normalizedApplyForUserTypeId === "1" ? userIcon : enterpriseIcon
}

export const DEFAULT_TEAM_MANAGEMENT_SUMMARY = {
  todoCount: 0,
  completedCount: 0,
  applicationsCount: 0,
  profileVerificationsCount: 0,
  enquiriesCount: 0,
  refundsCount: 0,
  appealsCount: 0,
  inspectionTasksCount: 0,
  violationsCount: 0,
  urgentCount: 0,
}

export const DEFAULT_TEAM_MEMBERS_RANGE = [
  moment().add(-6, "day").startOf("day"),
  moment().endOf("day"),
] as [Moment, Moment]

export const toRangePickerValue = (
  range?: [string | null | undefined, string | null | undefined]
) => {
  if (!range?.[0] || !range?.[1]) {
    return undefined
  }

  return [moment(range[0]), moment(range[1])] as [Moment, Moment]
}

export const formatTeamManagementDate = (value?: string | null) => {
  if (!value) {
    return "-"
  }

  const dateValue = moment(value)
  if (!dateValue.isValid()) {
    return "-"
  }

  return dateValue.format("DD/MM/YYYY HH:mm:ss")
}

const normalizeSlaDisplayText = (value?: string | null) =>
  String(value || "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase()

export const getTeamManagementSlaPresentation = (
  record: Pick<
    TeamManagementTaskItem,
    "slaDisplay" | "slaIsOverdue"
  >
) => {
  const displayText = String(record.slaDisplay || "").trim()
  const normalizedDisplayText = normalizeSlaDisplayText(displayText)

  return {
    text: displayText || "-",
    isOverdue:
      record.slaIsOverdue === true ||
      normalizedDisplayText.includes("overdue"),
  }
}

// Backend returns the sub service status inside brackets of the same status field,
// e.g. "Completed (Disposition Verified)".
const TEAM_MANAGEMENT_SUB_STATUS_PATTERN =
  /^([\s\S]*?)\s*[(（]\s*([^()（）]*?)\s*[)）]\s*$/

const TEAM_MANAGEMENT_SUB_STATUS_TONE_MAP: Record<string, string> = {
  dispositionverified: "success",
  dispositionnotverified: "danger",
}

export const splitTeamManagementStatus = (status?: string | null) => {
  const statusText = typeof status === "string" ? status.trim() : ""

  if (!statusText) {
    return { mainStatus: "", subStatus: "" }
  }

  const matched = statusText.match(TEAM_MANAGEMENT_SUB_STATUS_PATTERN)
  const mainStatus = (matched?.[1] ?? "").trim()
  const subStatus = (matched?.[2] ?? "").trim()

  if (!matched || !mainStatus || !subStatus) {
    return { mainStatus: statusText, subStatus: "" }
  }

  return { mainStatus, subStatus }
}

export const getTeamManagementSubStatusTone = (subStatus?: string | null) =>
  TEAM_MANAGEMENT_SUB_STATUS_TONE_MAP[
    String(subStatus ?? "")
      .replace(/\s+/g, "")
      .toLowerCase()
  ] ?? "default"

export const formatEmergencyLeaveDate = (value?: string | null) => {
  if (!value) {
    return "-"
  }

  const dateValue = moment(value)
  if (!dateValue.isValid()) {
    return "-"
  }

  return dateValue.format("DD/MM/YYYY HH:mm:ss")
}

export const formatCompletedTasksValue = (
  completedCount?: number | null,
  totalAssignedCount?: number | null
) => {
  const safeCompleted = completedCount ?? 0
  const safeTotal = totalAssignedCount ?? 0
  return `${safeCompleted}/${safeTotal}`
}

export const getCompletedTaskRate = (
  completedCount?: number | null,
  totalAssignedCount?: number | null
) => {
  const safeCompleted = completedCount ?? 0
  const safeTotal = totalAssignedCount ?? 0

  if (!safeTotal) {
    return 0
  }

  return Math.min(100, Math.max(0, (safeCompleted / safeTotal) * 100))
}

export const getSlaGaugeTone = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "default"
  }

  if (value >= 60) {
    return "success"
  }

  if (value >= 30) {
    return "warning"
  }

  return "danger"
}

export const normalizeTaskCategoryByToggle = (
  applicationTaskOnly: boolean,
  category?: TeamTaskCategory
) => {
  if (applicationTaskOnly) {
    return "applications" as TeamTaskCategory
  }

  return category
}

export const getTaskCategoryLabel = (
  category: TeamTaskCategory,
  t: TFunction,
  scope?: TeamManagementScope
) => {
  if (scope === "customer" && category === "enquiries") {
    return t("menu.tickets")
  }

  if (scope === "content") {
    if (category === "applications") {
      return t(
        "teamManagement.contentCategories.applications",
        "Service Applications"
      )
    }
    if (category === "enquiries") {
      return t(
        "teamManagement.contentCategories.enquiries",
        "Enquiries & Complaints"
      )
    }
    if (category === "violations") {
      return t(
        "teamManagement.contentCategories.violations",
        "Violations & Fines"
      )
    }
  }

  return t(`teamManagement.categories.${category}`)
}

export const getMemberCategoryLabel = (
  category: MemberMetricCategory,
  t: TFunction
) => {
  return t(`teamManagement.memberCategories.${category}`)
}

export const resolveTeamManagementAvatarUrl = (
  value?: string | null
) => {
  const raw = String(value ?? "").trim()

  if (!raw) {
    return ""
  }

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw
  }

  if (raw.startsWith(ImageBaseUrl)) {
    return raw
  }

  // P8 Plan A: images served same-origin through the gateway (relative paths).
  const imageBaseUrl = ""

  if (raw.startsWith("/api/Document/Dowload")) {
    return imageBaseUrl ? `${imageBaseUrl}${raw}` : raw
  }

  if (raw.startsWith("/")) {
    return raw
  }

  return `${ImageBaseUrl}${raw}`
}

export const getStatusClassName = (status?: string | null) => {
  return transformSpaceString(status || "")
}

export const sortTeamManagementMembers = (
  members: TeamManagementMemberCard[]
) => {
  return [...members].sort((left, right) => {
    if (left.isLeave !== right.isLeave) {
      return left.isLeave ? 1 : -1
    }

    if (!left.isLeave && !right.isLeave) {
      if (left.todoTaskCount !== right.todoTaskCount) {
        return left.todoTaskCount - right.todoTaskCount
      }
    }

    if (left.isLeave && right.isLeave) {
      const leftReturn = left.expectedReturnDate
        ? moment(left.expectedReturnDate).valueOf()
        : Number.MAX_SAFE_INTEGER
      const rightReturn = right.expectedReturnDate
        ? moment(right.expectedReturnDate).valueOf()
        : Number.MAX_SAFE_INTEGER

      if (leftReturn !== rightReturn) {
        return leftReturn - rightReturn
      }
    }

    return String(left.memberName || "").localeCompare(
      String(right.memberName || ""),
      "en",
      {
        sensitivity: "base",
      }
    )
  })
}

export const resolveTeamManagementTaskDetail = (
  record: TeamManagementTaskItem
) => {
  const queryString = new URLSearchParams()
  Object.entries(record.detailRouteQuery || {}).forEach(([key, value]) => {
    if (value == null || value === "") {
      return
    }
    queryString.set(key, String(value))
  })

  const mergeQueryWithPath = (path: string) => {
    try {
      const url = new URL(path, "https://team-management.local")
      queryString.forEach((value, key) => {
        url.searchParams.set(key, value)
      })
      return `${url.pathname}${url.search}${url.hash}`
    } catch (error) {
      const suffix = queryString.toString()
      if (!suffix) {
        return path
      }
      return `${path}${path.includes("?") ? "&" : "?"}${suffix}`
    }
  }

  if (record.detailTarget) {
    return mergeQueryWithPath(record.detailTarget)
  }

  if (!record.detailRoutePath) {
    return null
  }

  return mergeQueryWithPath(record.detailRoutePath)
}

export const buildTaskCategoryOptions = (
  t: TFunction,
  scope?: TeamManagementScope
) => [
  {
    label: t("teamManagement.placeholders.allCategories"),
    value: undefined,
  },
  {
    label: getTaskCategoryLabel("applications", t, scope),
    value: "applications" as TeamTaskCategory,
  },
  {
    label: getTaskCategoryLabel("profileVerifications", t, scope),
    value: "profileVerifications" as TeamTaskCategory,
  },
  {
    label: getTaskCategoryLabel("enquiries", t, scope),
    value: "enquiries" as TeamTaskCategory,
  },
  {
    label: getTaskCategoryLabel("refunds", t, scope),
    value: "refunds" as TeamTaskCategory,
  },
  {
    label: getTaskCategoryLabel("appeals", t, scope),
    value: "appeals" as TeamTaskCategory,
  },
  {
    label: getTaskCategoryLabel("inspectionTasks", t, scope),
    value: "inspectionTasks" as TeamTaskCategory,
  },
  {
    label: getTaskCategoryLabel("violations", t, scope),
    value: "violations" as TeamTaskCategory,
  },
]
