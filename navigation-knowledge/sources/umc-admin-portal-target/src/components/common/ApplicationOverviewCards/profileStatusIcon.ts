import ProfileStatusApprovedIcon from "@/assets/images/ProfileStatus_Approved.svg"
import ProfileStatusExpiredIcon from "@/assets/images/ProfileStatus_Expired.svg"
import ProfileStatusUnderReviewIcon from "@/assets/images/ProfileStatus_Under_Reivew.svg"
import ProfileStatusRejectedIcon from "@/assets/images/ProfileStatus_Rejected.svg"
import ProfileStatusPendingCompletionIcon from "@/assets/images/ProfileStatus_PendingCompletion.svg"
import ProfileStatusSuspendedIcon from "@/assets/images/ProfileStatus_Suspended.svg"

/** Status icons keyed by the icon key resolved from the backend status code. */
export const PROFILE_STATUS_ICONS: Record<string, string> = {
  approved: ProfileStatusApprovedIcon,
  expired: ProfileStatusExpiredIcon,
  underreview: ProfileStatusUnderReviewIcon,
  rejected: ProfileStatusRejectedIcon,
  pendingcompletion: ProfileStatusPendingCompletionIcon,
  suspended: ProfileStatusSuspendedIcon,
}

/**
 * Backend status code (`profileStatusObj.id` carries the lookup Code, shared by
 * the `UserProfileStatus` and `UserProfileStatus_Admin` scopes) mapped to an
 * icon key. The code is the only source of truth here: the localized names
 * cannot be matched reliably under Arabic.
 */
const PROFILE_STATUS_ICON_KEY_BY_CODE: Record<number, string> = {
  1: "pendingcompletion",
  2: "underreview",
  3: "approved",
  4: "rejected",
  5: "expired",
  6: "suspended",
}

/** Resolves the icon key purely from the language-neutral status code. */
export const resolveProfileStatusIconKey = (code?: number | null): string => {
  if (typeof code === "number" && PROFILE_STATUS_ICON_KEY_BY_CODE[code]) {
    return PROFILE_STATUS_ICON_KEY_BY_CODE[code]
  }
  return ""
}

/** Icon asset for a backend status code, or undefined when it maps to none. */
export const resolveProfileStatusIcon = (
  code?: number | null,
): string | undefined => PROFILE_STATUS_ICONS[resolveProfileStatusIconKey(code)]
