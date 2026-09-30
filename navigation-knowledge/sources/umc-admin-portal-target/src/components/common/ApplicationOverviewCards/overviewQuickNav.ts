import type {
  ApplicationOverviewProfileData,
  ApplicationOverviewProfileType,
} from "./types"

export type OverviewQuickNavTarget = {
  initialTab: string
  scrollToDocuments: boolean
  scrollToPartners: boolean
}

export type ApplicationOverviewExpandedSource =
  | "applicant"
  | "profile"
  | "application"

export type ApplicationOverviewFullScreenOpenPayload = {
  expandedSource: ApplicationOverviewExpandedSource
  quickNav: OverviewQuickNavTarget
  profileTypeOverride?: ApplicationOverviewProfileType
  profileAndApplicantData?: ApplicationOverviewProfileData
}

export const DEFAULT_OVERVIEW_QUICK_NAV_TARGET: OverviewQuickNavTarget = {
  initialTab: "basic-information",
  scrollToDocuments: false,
  scrollToPartners: false,
}

export const createOverviewQuickNavTarget = (
  target?: Partial<OverviewQuickNavTarget>,
  fallbackInitialTab = DEFAULT_OVERVIEW_QUICK_NAV_TARGET.initialTab,
): OverviewQuickNavTarget => ({
  initialTab: target?.initialTab ?? fallbackInitialTab,
  scrollToDocuments: target?.scrollToDocuments ?? false,
  scrollToPartners: target?.scrollToPartners ?? false,
})
