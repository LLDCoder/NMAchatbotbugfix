import React from "react"
import { useTranslation } from "react-i18next"
import "./index.less"

/**
 * Self-Monitor Program state as reported by the backend.
 *
 * The field is absent (or null) for establishments with no Self-Monitor record —
 * most rows in a profile list — which is why every consumer passes it straight
 * through and lets this component decide whether to render anything.
 */
export type SelfMonitorStatus = "Trial" | "Active" | "Suspended" | "Expired"

export interface SelfMonitorProgramInfo {
  status?: SelfMonitorStatus | string | null
  certificateNumber?: string | null
  effectiveDate?: string | null
  expiryDate?: string | null
  trialEndDate?: string | null
  isEligibleForAutoApproval?: boolean | null
}

const STATUS_I18N_KEY: Record<SelfMonitorStatus, string> = {
  Trial: "selfMonitor.status.trial",
  Active: "selfMonitor.status.active",
  Suspended: "selfMonitor.status.suspended",
  Expired: "selfMonitor.status.expired",
}

const KNOWN_STATUSES = Object.keys(STATUS_I18N_KEY) as SelfMonitorStatus[]

/** Tolerates casing drift between services (e.g. "trial" vs "Trial"). */
const normalizeStatus = (
  value: SelfMonitorProgramInfo["status"],
): SelfMonitorStatus | undefined => {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return undefined
  return KNOWN_STATUSES.find((status) => status.toLowerCase() === raw)
}

interface SelfMonitorBadgeProps {
  program?: SelfMonitorProgramInfo | null
  className?: string
}

/**
 * Self-Monitor Program badge shown on the establishment views (spec section 4).
 *
 * Renders nothing when there is no programme, when the status is missing, or
 * when it is a value this build does not know — a profile list is mostly made of
 * such rows, and an unrecognised status is better hidden than shown raw.
 *
 * Expiry is normalized server-side: a certificate past its expiry date arrives
 * as "Expired", so nothing here compares dates.
 */
const SelfMonitorBadge: React.FC<SelfMonitorBadgeProps> = ({
  program,
  className = "",
}) => {
  const { t } = useTranslation()
  const status = normalizeStatus(program?.status)

  if (!status) return null

  return (
    <span
      className={`self-monitor-badge self-monitor-badge--${status.toLowerCase()} ${className}`.trim()}
    >
      {t(STATUS_I18N_KEY[status])}
    </span>
  )
}

export default SelfMonitorBadge
