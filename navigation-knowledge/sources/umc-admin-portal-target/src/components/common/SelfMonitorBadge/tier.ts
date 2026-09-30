import type { SelfMonitorProgramInfo } from "./index"

/**
 * Tier classification (donut / filter / export / URL) counts a profile as
 * Self-Monitor **only** when its programme is Trial or Active. Suspended,
 * Expired, individual and no-record all fall to Standard — per backend spec,
 * "tier classification ≠ status label". Use this wherever tier is derived; the
 * SelfMonitorBadge itself still shows the true status (incl. Suspended/Expired).
 *
 * Lives in its own module so the badge file only exports a component (keeps
 * react-refresh happy).
 */
export const isSelfMonitorTier = (
  program?: SelfMonitorProgramInfo | null,
): boolean => {
  const status = String(program?.status ?? "").trim().toLowerCase()
  return status === "trial" || status === "active"
}
