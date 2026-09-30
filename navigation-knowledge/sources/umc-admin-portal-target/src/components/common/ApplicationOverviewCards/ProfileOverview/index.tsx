import React, { useState } from "react"
import { Tooltip } from "antd"
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader"
import OverflowTooltip from "@/components/common/OverflowTooltip"
import type { IUserIndividualProfile, IEstablishmentOverview } from "@/services/userProfile"
import SelfMonitorBadge, {
  type SelfMonitorProgramInfo,
} from "@/components/common/SelfMonitorBadge"
import {
  PROFILE_STATUS_ICONS,
  resolveProfileStatusIconKey,
} from "../profileStatusIcon"
import Individual from "../Individual"
import Commercial, { type CommercialData } from "../Commercial"
import type { ApplicationOverviewProfileData } from "../types"
import { getDisplayValue } from "../displayValue"
import "./index.less"
import { useTranslation } from "react-i18next"

export interface ProfileData extends ApplicationOverviewProfileData {
  profile?: IUserIndividualProfile | IEstablishmentOverview
}

interface ProfileOverviewProps {
  applicationType?: "Individual" | "Commercial"
  profileData?: ProfileData
  onExpand: (initialTab?: string) => void
  onScrollToDocuments: () => void
  onScrollToPartners?: () => void
  setInitialTab: (tab: string) => void
  /**
   * Content, Licensing and Customer Happiness open this card expanded.
   * Inspection keeps the collapsed default, so the default stays false and
   * the callers that want it open say so.
   */
  defaultExpanded?: boolean
}

const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  applicationType,
  profileData,
  onExpand,
  onScrollToDocuments,
  onScrollToPartners,
  setInitialTab,
  defaultExpanded = false,
}) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const [isCollapsed, setIsCollapsed] = useState(!defaultExpanded)

  // The tier slot holds the Self-Monitor badge alone. VIP and Standard are both
  // retired, so a profile with no programme shows no badge at all — the badge
  // renders nothing by itself when the status is missing or unrecognised.
  const selfMonitorProgram = (
    profileData as { selfMonitorProgram?: SelfMonitorProgramInfo | null } | undefined
  )?.selfMonitorProgram
  const profileTypeText = isArabic
    ? profileData?.userTypeObj?.nameAr || profileData?.userTypeObj?.nameEn
    : profileData?.userTypeObj?.nameEn || profileData?.userTypeObj?.nameAr
  const profileTypeDisplayText =
    profileTypeText ||
    (applicationType === "Commercial"
      ? t("applicationOverviewCards.commercial")
      : t("applicationOverviewCards.individual"))

  const statusKey = resolveProfileStatusIconKey(profileData?.profileStatusObj?.id)
  const statusIcon = PROFILE_STATUS_ICONS[statusKey]
  const statusText =
    (isArabic
      ? profileData?.profileStatusObj?.nameAr || profileData?.profileStatusObj?.nameEn
      : profileData?.profileStatusObj?.nameEn || profileData?.profileStatusObj?.nameAr) || "-"
  const openViolationsFines = () => {
    setInitialTab("violations-fines")
    onExpand("violations-fines")
  }
  const handleViolationsFinesKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openViolationsFines()
    }
  }

  return (
    <div className="right-card application-overview-card">
      <CollapsibleCardHeader
        title={t("applicationOverviewCards.profileOverview")}
        expanded={!isCollapsed}
        onToggle={() => setIsCollapsed((current) => !current)}
        action={{
          ariaLabel: t("common.openExpandedView", {
            title: t("applicationOverviewCards.profileOverview"),
          }),
          onClick: () => onExpand(),
        }}
      />
      
      {!isCollapsed && (
        <div className="application-overview-card__body">
          <div className="feild-item profile-type-box">
            <div className="profile-type-box__label">
              {t("applicationOverviewCards.profileType")}
            </div>

            <div className="profile-type-box__value">
              {statusIcon ? (
                <Tooltip
                  placement="top"
                  title={statusText}
                  overlayClassName="profile-overview__type-tooltip"
                >
                  <img
                    className={`profile-type-box__status-icon status_id_${statusKey || "default"}`}
                    src={statusIcon}
                    alt={statusText}
                  />
                </Tooltip>
              ) : null}
              <OverflowTooltip
                className="profile-type"
                title={profileTypeDisplayText}
                overlayClassName="profile-overview__type-tooltip"
              >
                {profileTypeDisplayText}
              </OverflowTooltip>
            </div>

            <div className="profile-type-box__tags">
              <SelfMonitorBadge program={selfMonitorProgram} />
            </div>
          </div>

          {profileData && applicationType === "Individual" && (
            <Individual 
              individualData={profileData}
              onScrollToDocuments={onScrollToDocuments}
            />
          )}

          {profileData && applicationType === "Commercial" && (
            <Commercial
              commercialData={profileData as CommercialData}
              onScrollToDocuments={onScrollToDocuments}
              onScrollToPartners={onScrollToPartners}
              setInitialTab={setInitialTab}
            />
          )}

          {profileData && (
            <>
              <div
                style={{ margin: "24px 0", borderTop: "1px solid #E1E3E5" }}
              />
              <div
                className="card-tag danger"
                style={{ cursor: "pointer" }}
                onClick={openViolationsFines}
                onKeyDown={handleViolationsFinesKeyDown}
                role="button"
                tabIndex={0}
              >
                <div className="tag-label">
                  {t("applicationOverviewCards.warningsViolations")}
                </div>
                <div className="tag-value">
                  {getDisplayValue(profileData.violationCount)}
                </div>
              </div>
              <div
                className="card-tag warn"
                style={{ cursor: "pointer" }}
                onClick={openViolationsFines}
                onKeyDown={handleViolationsFinesKeyDown}
                role="button"
                tabIndex={0}
              >
                <div className="tag-label">
                  {t("applicationOverviewCards.unpaidFines")}
                </div>
                <div className="tag-value">
                  {getDisplayValue(profileData.unpaidFinesCount)}
                </div>
              </div>
            </>
          )}
        </div>
      )} 
    </div>
  )
}

export default ProfileOverview
