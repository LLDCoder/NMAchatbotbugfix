import React, { useState } from "react"
import ApplicantOverview from "./ApplicantOverview"
import ProfileOverview from "./ProfileOverview"
import ApplicationOverviewPanel from "./ApplicationOverviewPanel"
import { useApplicationOverviewData } from "./ApplicationOverviewDataContext"
import type {
  ApplicationOverviewProfileData,
  ApplicationOverviewProfileType,
} from "./types"
import {
  hasExplicitUserTypeId,
  resolveProfileTypeFromUserTypeId,
} from "./utils/userType"
import type { IEnquiryInfoResponse, IRelateAppsResponse } from "@/services/tickets"
import {
  createOverviewQuickNavTarget,
  type ApplicationOverviewFullScreenOpenPayload,
} from "./overviewQuickNav"
import "./index.less"

export interface ApplicationOverviewCardsProps {
  // Additional cards to render (e.g., Application Timeline)
  additionalCards?: React.ReactNode
  // Callback when fullscreen state changes
  onFullScreenChange?: (isFullScreen: boolean) => void
  // Controlled fullscreen state (optional, for parent control)
  isFullScreen?: boolean
  onSetFullScreen?: (isFullScreen: boolean) => void
  // Callbacks to pass scroll and tab state to parent
  onScrollToDocumentsChange?: (scrollToDocuments: boolean) => void
  onScrollToPartnersChange?: (scrollToPartners: boolean) => void
  onInitialTabChange?: (initialTab: string | undefined) => void
  onIsProfileExpandedChange?: (isProfileExpanded: boolean) => void
  onFullScreenProfileTypeChange?: (
    profileType: ApplicationOverviewProfileType | undefined,
  ) => void
  onOpenFullScreen?: (
    payload: ApplicationOverviewFullScreenOpenPayload,
  ) => void
  enquiryInfo?: IEnquiryInfoResponse & {
    isCustormer?: number
  }
  applicantOverviewDataOverride?: ApplicationOverviewProfileData
  applicantPhoneNumberOverride?: string
  applicationOverviewRelatedSectionData?: IRelateAppsResponse
  currentApplicationNumber?: string
  currentEnquiryNumber?: string
  currentServiceId?: string | number | null
  showApplicantExpandButton?: boolean
  isTicketApplicationOverviewExpanded?: boolean
  onTicketApplicationOverviewExpand?: () => void
  onTicketApplicationOverviewShrink?: () => void
  onRelatedApplicationReferenceClick?: (applicationNo: string) => void
  /** Opens the Profile Overview card expanded; Inspection leaves it collapsed. */
  profileOverviewDefaultExpanded?: boolean
}

const toPositiveProfileId = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : undefined
}

const ApplicationOverviewCards: React.FC<ApplicationOverviewCardsProps> = ({
  additionalCards,
  onFullScreenChange,
  isFullScreen: controlledIsFullScreen,
  onSetFullScreen,
  onScrollToDocumentsChange,
  onScrollToPartnersChange,
  onInitialTabChange,
  onIsProfileExpandedChange,
  onFullScreenProfileTypeChange,
  onOpenFullScreen,
  enquiryInfo,
  applicantOverviewDataOverride,
  applicantPhoneNumberOverride,
  applicationOverviewRelatedSectionData,
  currentApplicationNumber,
  currentEnquiryNumber,
  currentServiceId,
  showApplicantExpandButton = false,
  isTicketApplicationOverviewExpanded,
  onTicketApplicationOverviewExpand,
  onTicketApplicationOverviewShrink,
  onRelatedApplicationReferenceClick,
  profileOverviewDefaultExpanded = false,
}) => {
  const {
    userProfileId,
    profileAndApplicantData,
    applicationOverviewRelatedProfileType,
    applicationOverviewRelatedSectionData: contextRelatedSectionData,
    applicationType,
  } =
    useApplicationOverviewData()
  const resolvedApplicationOverviewRelatedSectionData =
    applicationOverviewRelatedSectionData ?? contextRelatedSectionData
  const baseApplicantOverviewData =
    profileAndApplicantData ?? applicantOverviewDataOverride ?? undefined
  const resolvedApplicantOverviewData =
    baseApplicantOverviewData && applicantPhoneNumberOverride !== undefined
      ? {
          ...baseApplicantOverviewData,
          phoneNumber: applicantPhoneNumberOverride,
          personalPhoneNumber:
            baseApplicantOverviewData.personalPhoneNumber ||
            applicantPhoneNumberOverride,
        }
      : baseApplicantOverviewData
  const resolvedProfileData = profileAndApplicantData ?? undefined
  const resolvedProfileId =
    userProfileId ??
    toPositiveProfileId(profileAndApplicantData?.userProfileId) ??
    toPositiveProfileId(
      (profileAndApplicantData as Record<string, unknown> | null)?.profileId,
    ) ??
    toPositiveProfileId(
      (profileAndApplicantData as Record<string, unknown> | null)?.proFileId,
    ) ??
    toPositiveProfileId(
      (profileAndApplicantData as Record<string, unknown> | null)
        ?.userProfileID,
    )
  void resolvedProfileId
  const isShowProfile = enquiryInfo
    ? Boolean(
        Number(enquiryInfo.isCustormer) === 1 ||
          (Number(enquiryInfo.isCustormer) === 0 &&
            enquiryInfo.applicationNo !== ""),
      )
    : true

  const [internalIsApplicantExpanded, setInternalIsApplicantExpanded] =
    useState(false)
  const [internalIsProfileExpanded, setInternalIsProfileExpanded] =
    useState(false)
  const updateScrollToDocuments = (nextScrollToDocuments: boolean) => {
    onScrollToDocumentsChange?.(nextScrollToDocuments)
  }

  const updateScrollToPartners = (nextScrollToPartners: boolean) => {
    onScrollToPartnersChange?.(nextScrollToPartners)
  }

  const updateInitialTab = (nextInitialTab: string | undefined) => {
    onInitialTabChange?.(nextInitialTab)
  }

  const setExpandedOverviewSource = (
    source: "applicant" | "profile" | "application",
  ) => {
    setInternalIsApplicantExpanded(source === "applicant")
    setInternalIsProfileExpanded(source === "profile")
  }

  const isProfileExpanded =
    controlledIsFullScreen !== undefined
      ? controlledIsFullScreen && !internalIsApplicantExpanded
      : internalIsProfileExpanded

  // Notify parent component about expanded state changes
  React.useEffect(() => {
    onIsProfileExpandedChange?.(isProfileExpanded)
  }, [isProfileExpanded, onIsProfileExpandedChange])

  const resetFullScreenProfileType = () => {
    onFullScreenProfileTypeChange?.(undefined)
  }

  const requestFullScreenChange = (nextIsFullScreen: boolean) => {
    if (onSetFullScreen) {
      onSetFullScreen(nextIsFullScreen)
      return
    }

    onFullScreenChange?.(nextIsFullScreen)
  }

  const openFullScreen = (payload: {
    expandedSource: "applicant" | "profile" | "application"
    quickNav?: Partial<ApplicationOverviewFullScreenOpenPayload["quickNav"]>
    fallbackInitialTab?: string
    profileTypeOverride?: ApplicationOverviewProfileType
    profileAndApplicantData?: ApplicationOverviewProfileData
  }) => {
    const nextQuickNav = createOverviewQuickNavTarget(
      payload.quickNav,
      payload.fallbackInitialTab,
    )

    setExpandedOverviewSource(payload.expandedSource)

    if (onOpenFullScreen) {
      onOpenFullScreen({
        expandedSource: payload.expandedSource,
        quickNav: nextQuickNav,
        profileTypeOverride: payload.profileTypeOverride,
        profileAndApplicantData:
          payload.profileAndApplicantData ?? resolvedProfileData,
      })
      requestFullScreenChange(true)
      return
    }

    onFullScreenProfileTypeChange?.(payload.profileTypeOverride)
    updateInitialTab(nextQuickNav.initialTab)
    updateScrollToDocuments(nextQuickNav.scrollToDocuments)
    updateScrollToPartners(nextQuickNav.scrollToPartners)
    requestFullScreenChange(true)
  }

  const handleProfileExpand = (nextInitialTab = "basic-information") => {
    resetFullScreenProfileType()
    openFullScreen({
      expandedSource: "profile",
      quickNav: {
        initialTab: nextInitialTab,
        scrollToDocuments: false,
        scrollToPartners: false,
      },
      fallbackInitialTab: nextInitialTab,
      profileTypeOverride: applicationType,
      profileAndApplicantData: resolvedProfileData,
    })
  }

  const handleApplicantExpand = () => {
    openFullScreen({
      expandedSource: "applicant",
      quickNav: {
        initialTab: "basic-information",
        scrollToDocuments: false,
        scrollToPartners: false,
      },
      fallbackInitialTab: "basic-information",
      profileTypeOverride: applicationType,
      profileAndApplicantData: resolvedApplicantOverviewData,
    })
  }

  const handleScrollToDocuments = () => {
    resetFullScreenProfileType()
    openFullScreen({
      expandedSource: "profile",
      quickNav: {
        initialTab: "basic-information",
        scrollToDocuments: true,
        scrollToPartners: false,
      },
      fallbackInitialTab: "basic-information",
      profileTypeOverride: applicationType,
      profileAndApplicantData: resolvedProfileData,
    })
  }

  const handleScrollToPartners = () => {
    resetFullScreenProfileType()
    openFullScreen({
      expandedSource: "profile",
      quickNav: {
        initialTab: "basic-information",
        scrollToDocuments: false,
        scrollToPartners: true,
      },
      fallbackInitialTab: "basic-information",
      profileTypeOverride: applicationType,
      profileAndApplicantData: resolvedProfileData,
    })
  }

  const openApplicationOverviewFullScreen = (nextInitialTab: string) => {
    const relatedUserTypeId =
      resolvedApplicationOverviewRelatedSectionData?.userTypeId
    const overviewProfileType: ApplicationOverviewProfileType =
      hasExplicitUserTypeId(relatedUserTypeId)
        ? resolveProfileTypeFromUserTypeId(
            relatedUserTypeId,
            applicationOverviewRelatedProfileType,
          )
        : applicationOverviewRelatedProfileType
    openFullScreen({
      expandedSource:
        overviewProfileType === "Commercial" ? "profile" : "applicant",
      quickNav: {
        initialTab: nextInitialTab,
        scrollToDocuments: false,
        scrollToPartners: false,
      },
      fallbackInitialTab: "basic-information",
      profileTypeOverride: overviewProfileType,
      profileAndApplicantData: resolvedProfileData,
    })
    onTicketApplicationOverviewExpand?.()
  }

  const handleApplicationOverviewExpand = () => {
    openApplicationOverviewFullScreen("applications")
  }

  const handleApplicationOverviewStatisticClick = (
    key:
      | "historicalApplications"
      | "historicalTicketsEnquiry"
      | "refund"
      | "appeal",
  ) => {
    if (key === "historicalApplications") {
      openApplicationOverviewFullScreen("applications")
      return
    }

    if (key === "historicalTicketsEnquiry") {
      openApplicationOverviewFullScreen("tickets")
      return
    }

    if (key === "refund") {
      openApplicationOverviewFullScreen("refunds")
      return
    }

    openApplicationOverviewFullScreen("appeal")
  }

  
  // Collapsed view - render cards
  return (
    <div className="body-right">
      <div className="body-right-column">
        <ApplicantOverview
          mode="simple"
          applicantData={resolvedApplicantOverviewData}
          showExpandButton={showApplicantExpandButton}
          onExpand={handleApplicantExpand}
        />

        {isShowProfile && (
          <ProfileOverview
            defaultExpanded={profileOverviewDefaultExpanded}
            applicationType={applicationType}
            profileData={resolvedProfileData}
            onExpand={handleProfileExpand}
            onScrollToDocuments={handleScrollToDocuments}
            onScrollToPartners={
              applicationType === "Commercial"
                ? handleScrollToPartners
                : undefined
            }
            setInitialTab={updateInitialTab}
          />
        )}
      </div>

      <div className="body-right-column">
        {isShowProfile && (
          <ApplicationOverviewPanel
            isExpanded={isTicketApplicationOverviewExpanded}
            onExpand={handleApplicationOverviewExpand}
            onShrink={onTicketApplicationOverviewShrink}
            onStatisticClick={handleApplicationOverviewStatisticClick}
            onRelatedApplicationReferenceClick={
              onRelatedApplicationReferenceClick
            }
            relatedSectionData={applicationOverviewRelatedSectionData}
            currentApplicationNumber={currentApplicationNumber}
            currentEnquiryNumber={currentEnquiryNumber}
            currentServiceId={currentServiceId}
          />
        )}

        {/* Additional cards (e.g., Application Timeline) */}
        {additionalCards}
      </div>
    </div>
  )
}

export default ApplicationOverviewCards
