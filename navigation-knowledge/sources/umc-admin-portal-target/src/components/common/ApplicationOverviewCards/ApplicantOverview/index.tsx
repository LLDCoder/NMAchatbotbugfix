import React, { useState } from "react"
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader"
import Individual from "../Individual"
import { getDisplayValue, getPhoneDisplayValue } from "../displayValue"
import type { ApplicationOverviewProfileData } from "../types"
import "./index.less";
import { useTranslation } from "react-i18next";

export type ApplicantData = ApplicationOverviewProfileData

interface ApplicantOverviewProps {
    // New API data structure
    applicantData?: ApplicantData
    // Mode: "full" or "simple"
    mode: "full" | "simple"
    showExpandButton?: boolean
    // Callbacks
    onExpand?: () => void
    onScrollToDocuments?: () => void
}

const ApplicantOverview: React.FC<ApplicantOverviewProps> = ({
    applicantData,
    mode,
    showExpandButton = false,
    onExpand,
    onScrollToDocuments,
}) => {
    const { t, i18n } = useTranslation()
    const isArabic = i18n.language?.toLowerCase().startsWith("ar")
    const [isCollapsed, setIsCollapsed] = useState(true)
    const {
        userName,
        userEmail,
        phoneNumber,
        personalName,
        personalEmail,
        personalPhoneNumber,
        profileStatusObj,
    } = applicantData || {}
    const hasMeaningfulValue = (value: unknown) =>
        typeof value === "string" ? value.trim() !== "" : value !== undefined && value !== null
    const resolvedUserName = hasMeaningfulValue(userName)
        ? userName
        : personalName
    const resolvedUserEmail = hasMeaningfulValue(userEmail)
        ? userEmail
        : personalEmail
    const resolvedPhoneNumber = hasMeaningfulValue(phoneNumber)
        ? phoneNumber
        : personalPhoneNumber

    return (
        <div className="right-card application-overview-card">
            <CollapsibleCardHeader
                title={t("applicationOverviewCards.applicantOverview")}
                expanded={!isCollapsed}
                onToggle={() => setIsCollapsed((current) => !current)}
                action={
                    mode === "full" || showExpandButton
                        ? {
                            ariaLabel: t("common.openExpandedView", {
                                title: t("applicationOverviewCards.applicantOverview"),
                            }),
                            onClick: () => onExpand?.(),
                        }
                        : undefined
                }
            />
            

            {!isCollapsed && (
                <div className="application-overview-card__body">
                    {
                        mode === "simple" && (
                            <>
                                <div className="feild-item">
                                    <div className="feild-label">{t("applicationOverviewCards.fullName")}</div>
                                    <div className="feild-value">{getDisplayValue(resolvedUserName)}</div>
                                </div>
                                <div className="feild-item">
                                    <div className="feild-label">{t("applicationOverviewCards.email")}</div>
                                    <div className="feild-value">{getDisplayValue(resolvedUserEmail)}</div>
                                </div>
                                <div className="feild-item">
                                    <div className="feild-label">{t("applicationOverviewCards.mobileNumber")}</div>
                                    <div
                                        className={`feild-value phone-number-value${isArabic ? " phone-number-value--rtl" : ""}`}
                                    >
                                        {getPhoneDisplayValue(resolvedPhoneNumber)}
                                    </div>
                                </div>
                            </>
                        )
                    }

                    {
                        mode === "full" && (
                            <>
                                <div className="feild-item">
                                    {/* VIP badge removed (VIP retired). The applicant is an
                                        individual, so no Self-Monitor badge replaces it. */}
                                    <span className={`profile_status status_id_${profileStatusObj?.nameEn || 'default'}`}>
                                        {getDisplayValue(isArabic ? profileStatusObj?.nameAr ?? profileStatusObj?.nameEn : profileStatusObj?.nameEn ?? profileStatusObj?.nameAr)}
                                    </span>
                                </div>
                                <Individual
                                    individualData={applicantData}
                                    onScrollToDocuments={onScrollToDocuments}
                                />
                            </>
                            
                        )
                    }
                </div>
            )}
        </div>
    )
}

export default ApplicantOverview
