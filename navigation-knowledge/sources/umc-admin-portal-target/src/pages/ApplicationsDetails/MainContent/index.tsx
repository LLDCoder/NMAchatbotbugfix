import React from "react"
import FormilyReviewList from "@/components/common/FormilyReviewList"
import type { PartnerItem } from "@/components/designable/src/components/PartnerList/PartnerListField"
import {
  ApplicationOverviewCards,
  ApplicationOverviewDataProvider,
  useApplicationOverviewFullScreenController,
  useApplicationOverviewData,
} from "@/components/common"
import type { IEstablishmentOverview } from "@/services/userProfile"
import type { IUserIndividualProfile } from "@/services/userProfile"
import FullScreen from "@/components/common/ApplicationOverviewCards/FullScreen/FullScreen"
import { ApplicationTimeline } from "@/pages/ContentApplicationsDetails/components/ApplicationTimeline"
import FahrPartnerListSection from "@/pages/ApplicationsDetails/components/FahrPartnerListSection"
import FahrPersonalProfileSection from "@/pages/ApplicationsDetails/components/FahrPersonalProfileSection"
import type { ITimeline } from "@/services/content"
import {
  PARTNER_MANAGEMENT_SERVICE_CODES,
  resolvePartnerManagementOwnerPartners,
} from "./partnerManagementOwner"
import type { FahrReviewRequestDetails } from "@/services/fahr"
import { isFahrEstablishmentPartnerService } from "../fahrServiceCodes"
import { findFahrTargetByPersonType } from "../fahrTargets"
import { useFahrReviewActions } from "../hooks/useFahrReviewActions"
import { useFahrFormilySlots } from "../hooks/useFahrFormilySlots"
import { useBasicInformationExportSlot } from "../hooks/useBasicInformationExportSlot"
import DeliveryInformation from "../DeliveryInformation"
import type { IApplicationDeliveryInfo } from "@/services/application"

interface MainContentProps {
  FormilyList: unknown[]
  timeLineList: ITimeline[]
  deliveryInfo: IApplicationDeliveryInfo | null
  establishment?: IEstablishmentOverview
  applicant?: IUserIndividualProfile
  userProfileId?: string | number
  /** Licensing application id (links to payment-center fee). */
  applicationId?: number
  currentApplicationNumber?: string
  currentServiceId?: string | number | null
  currentServiceCode?: string | number | null
  fahrReviewDetails?: FahrReviewRequestDetails | null
  fahrEnabled?: boolean
  onFahrReviewChanged?: () => Promise<unknown> | unknown
}

type MainContentBodyProps = Omit<MainContentProps, "userProfileId">

const MainContentBody: React.FC<MainContentBodyProps> = ({
  FormilyList,
  timeLineList,
  deliveryInfo,
  establishment,
  applicant,
  applicationId,
  currentApplicationNumber,
  currentServiceId,
  currentServiceCode,
  fahrReviewDetails,
  fahrEnabled = false,
  onFahrReviewChanged,
}) => {
  const { userProfileId } = useApplicationOverviewData()
  const overviewFullScreen = useApplicationOverviewFullScreenController()
  const safeTimelineList = Array.isArray(timeLineList) ? timeLineList : []
  const partnerManagementOwnerPartners = React.useMemo<PartnerItem[]>(() => {
    const normalizedServiceCode = String(currentServiceCode ?? "").trim()

    if (!PARTNER_MANAGEMENT_SERVICE_CODES.has(normalizedServiceCode)) {
      return []
    }

    return resolvePartnerManagementOwnerPartners(establishment?.partnerList)
  }, [currentServiceCode, establishment?.partnerList])
  const normalizedServiceCode = String(currentServiceCode ?? "")
  const isApplicantInfluencerService =
    normalizedServiceCode === "8007" || normalizedServiceCode === "80021"
  const {
    isActionAvailable: isFahrActionAvailable,
    runAction: runFahrAction,
  } = useFahrReviewActions({
    applicationId,
    requestId: fahrReviewDetails?.requestId,
  })
  const handleFahrAction = React.useCallback(
    async (...args: Parameters<typeof runFahrAction>) => {
      await runFahrAction(...args)
      await onFahrReviewChanged?.()
    },
    [onFahrReviewChanged, runFahrAction],
  )
  const fahrFormilyRenderSlot = useFahrFormilySlots({
    serviceCode: currentServiceCode,
    reviewDetails: fahrEnabled ? fahrReviewDetails : null,
    isActionAvailable: isFahrActionAvailable,
    onAction: handleFahrAction,
  })
  const basicInformationExportSlot = useBasicInformationExportSlot({
    serviceCode: currentServiceCode,
    applicationId,
  })
  const combinedFormilyRenderSlot = React.useCallback<
    NonNullable<React.ComponentProps<typeof FormilyReviewList>["renderSlot"]>
  >(
    (context) =>
      fahrFormilyRenderSlot?.(context) ??
      basicInformationExportSlot?.(context) ??
      undefined,
    [basicInformationExportSlot, fahrFormilyRenderSlot],
  )
  const applicantFahrTarget =
    isApplicantInfluencerService
      ? findFahrTargetByPersonType(
          fahrReviewDetails,
          "ApplicantInfluencer",
        )
      : undefined

  const renderSidebarCards = () => (
    <>
      <ApplicationTimeline
        timelineList={safeTimelineList}
        serviceCode={currentServiceCode}
      />
      {deliveryInfo ? (
        <DeliveryInformation deliveryInfo={deliveryInfo} />
      ) : null}
    </>
  )

  if (overviewFullScreen.isFullScreen) {
    return (
      <FullScreen
        type={overviewFullScreen.fullScreenType}
        applicant={applicant}
        establishment={establishment}
        userProfileId={userProfileId}
        {...overviewFullScreen.fullScreenProps}
      />
    )
  }

  return (
    <div className="app-content-body">
      <div className="body-left">
        <FormilyReviewList
          formilyList={FormilyList as Array<{ formData: string }>}
          formilyData={(FormilyList || []) as Array<Record<string, unknown>>}
          applicationId={applicationId}
          icpProfileId={userProfileId}
          serviceCode={currentServiceCode}
          service905OwnerPartners={partnerManagementOwnerPartners}
          renderSlot={combinedFormilyRenderSlot}
        />
        {fahrEnabled && isFahrEstablishmentPartnerService(currentServiceCode) && (
          <FahrPartnerListSection
            applicationId={applicationId}
            establishment={establishment}
            reviewDetails={fahrEnabled ? fahrReviewDetails : null}
            isFahrActionAvailable={
              fahrEnabled ? isFahrActionAvailable : undefined
            }
            onFahrAction={fahrEnabled ? handleFahrAction : undefined}
          />
        )}
        {fahrEnabled && isApplicantInfluencerService && (
          <FahrPersonalProfileSection
            applicationId={applicationId}
            profile={applicant}
            target={applicantFahrTarget}
            isActionAvailable={isFahrActionAvailable}
            onAction={handleFahrAction}
          />
        )}
      </div>
      <ApplicationOverviewCards
        profileOverviewDefaultExpanded
        additionalCards={renderSidebarCards()}
        {...overviewFullScreen.applicationOverviewCardProps}
        currentApplicationNumber={currentApplicationNumber}
        currentServiceId={currentServiceId}
      />
    </div>
  )
}

const MainContent: React.FC<MainContentProps> = ({ userProfileId, ...props }) => {
  return (
    <ApplicationOverviewDataProvider
      userProfileId={userProfileId}
      applicationId={props.applicationId}
    >
      <MainContentBody {...props} />
    </ApplicationOverviewDataProvider>
  )
}

export default MainContent
