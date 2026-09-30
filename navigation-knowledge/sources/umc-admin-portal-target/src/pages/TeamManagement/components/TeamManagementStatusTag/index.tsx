import type { TeamManagementScope } from "@/services/teamManagement"
import "./index.less"

export type TeamManagementStatusTagSize = "default" | "compact"

interface TeamManagementStatusTagProps {
  scope?: TeamManagementScope | null
  statusDisplayOnly?: string | null
  label?: string | null
  size?: TeamManagementStatusTagSize
  className?: string
}

const DEFAULT_STATUS_TYPE = "default"
const STATUS_STYLE_TYPE_MAP: Record<string, string> = {
  "initial-approval": "warm",
  "disposition-verification": "warm",
  "pending-visit": "warm",
  open: "warm",
  
  queued: "warning",
  "final-approval": "warning",
  "pending-modification": "warning",
  "department-processing": "warning",
  "pending-disposition": "warning",
  "pending-customer": "warning",
  "pending-payment": "warning",
  "pending-review": "warning",
  "in-progress": "warning",
  "department-processed": "warning",
  "pending-refund": "warning",

  completed: "success",
  approved: "success",
  resolved: "success",
  refunded: "success",

  rejected: "danger",
  "access-failed": "danger",

  cancelled: "muted",
  canceled: "muted",

  "external-approval": "info",
}

const buildClassName = (...classNames: Array<string | false | null | undefined>) =>
  classNames.filter(Boolean).join(" ")

const normalizeStatusDisplayOnly = (statusDisplayOnly?: string | null) => {
  const normalizedValue = String(statusDisplayOnly ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!normalizedValue) {
    return ""
  }

  return normalizedValue
}

const getResolvedLabel = (label?: string | null) => {
  const normalizedLabel = String(label || "").trim()
  return normalizedLabel || "-"
}

const getTeamManagementStatusType = (
  statusDisplayOnly?: string | null
) => {
  const normalizedStatusDisplayOnly =
    normalizeStatusDisplayOnly(statusDisplayOnly)

  if (!normalizedStatusDisplayOnly) {
    return DEFAULT_STATUS_TYPE
  }

  return (
    STATUS_STYLE_TYPE_MAP[normalizedStatusDisplayOnly] || DEFAULT_STATUS_TYPE
  )
}

const TeamManagementStatusTag = ({
  scope,
  statusDisplayOnly,
  label,
  size = "default",
  className,
}: TeamManagementStatusTagProps) => {
  const resolvedStatusType = getTeamManagementStatusType(statusDisplayOnly)

  return (
    <span
      className={buildClassName(
        "team-management-status-tag",
        `team-management-status-tag--${resolvedStatusType}`,
        size === "compact" && "team-management-status-tag--compact",
        className
      )}
      data-status-scope={scope || "UNKNOWN"}
      data-status-display-only={String(statusDisplayOnly || "").trim() || "UNKNOWN"}
      data-status-key={normalizeStatusDisplayOnly(statusDisplayOnly) || "UNKNOWN"}
      data-status-type={resolvedStatusType}
    >
      {getResolvedLabel(label)}
    </span>
  )
}

export default TeamManagementStatusTag
