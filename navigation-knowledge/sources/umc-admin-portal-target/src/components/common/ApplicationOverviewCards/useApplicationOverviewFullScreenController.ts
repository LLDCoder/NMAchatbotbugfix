import { useCallback, useMemo, useState } from "react"
import { useApplicationOverviewData } from "./ApplicationOverviewDataContext"
import type {
  ApplicationOverviewProfileData,
  ApplicationOverviewProfileType,
} from "./types"
import {
  type ApplicationOverviewExpandedSource,
  type ApplicationOverviewFullScreenOpenPayload,
  type OverviewQuickNavTarget,
  DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
} from "./overviewQuickNav"

const cloneDefaultQuickNavTarget = (): OverviewQuickNavTarget => ({
  ...DEFAULT_OVERVIEW_QUICK_NAV_TARGET,
})

export const useApplicationOverviewFullScreenController = () => {
  const { applicationType } = useApplicationOverviewData()
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [quickNav, setQuickNav] = useState<OverviewQuickNavTarget>(
    cloneDefaultQuickNavTarget,
  )
  const [expandedSource, setExpandedSource] =
    useState<ApplicationOverviewExpandedSource>("applicant")
  const [profileTypeOverride, setProfileTypeOverride] = useState<
    ApplicationOverviewProfileType | undefined
  >(undefined)
  const [profileAndApplicantData, setProfileAndApplicantData] = useState<
    ApplicationOverviewProfileData | undefined
  >(undefined)

  const closeFullScreen = useCallback(() => {
    setIsFullScreen(false)
    setQuickNav(cloneDefaultQuickNavTarget())
    setExpandedSource("applicant")
    setProfileTypeOverride(undefined)
    setProfileAndApplicantData(undefined)
  }, [])

  const setFullScreenState = useCallback(
    (nextIsFullScreen: boolean) => {
      if (!nextIsFullScreen) {
        closeFullScreen()
        return
      }

      setIsFullScreen(true)
    },
    [closeFullScreen],
  )

  const openFullScreen = useCallback(
    (payload: ApplicationOverviewFullScreenOpenPayload) => {
      setExpandedSource(payload.expandedSource)
      setQuickNav(payload.quickNav)
      setProfileTypeOverride(payload.profileTypeOverride)
      setProfileAndApplicantData(payload.profileAndApplicantData)
      setIsFullScreen(true)
    },
    [],
  )

  const fullScreenType = useMemo<ApplicationOverviewProfileType>(() => {
    if (profileTypeOverride) {
      return profileTypeOverride
    }

    if (expandedSource === "profile") {
      return applicationType
    }

    if (expandedSource === "application" && applicationType === "Commercial") {
      return "Commercial"
    }

    return "Individual"
  }, [applicationType, expandedSource, profileTypeOverride])

  return {
    isFullScreen,
    quickNav,
    fullScreenType,
    closeFullScreen,
    setFullScreenState,
    openFullScreen,
    applicationOverviewCardProps: {
      isFullScreen,
      onSetFullScreen: setFullScreenState,
      onFullScreenChange: setFullScreenState,
      onOpenFullScreen: openFullScreen,
    },
    fullScreenProps: {
      onClose: closeFullScreen,
      quickNav,
      initialTab: quickNav.initialTab,
      scrollToDocuments: quickNav.scrollToDocuments,
      scrollToPartners: quickNav.scrollToPartners,
      profileAndApplicantData,
    },
  }
}
