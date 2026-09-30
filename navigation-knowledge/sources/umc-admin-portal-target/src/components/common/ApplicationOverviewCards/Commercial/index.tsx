import React from "react"
import DocumentIcon from "@/assets/images/document_icon.svg"
import PartnersIcon from "@/assets/images/partners_icon.svg"
import OverflowTooltip from "@/components/common/OverflowTooltip"
import { useTranslation } from "react-i18next"
import { getDisplayValue } from "../displayValue"

export interface CommercialData {
  establishmentName?: string
  establishmentNameAr?: string
  licenseNumber?: string
  userTypeObj?: {
    code?: string | number
    nameEn?: string
    nameAr?: string
  }
  emirateObj?: {
    nameEn?: string
    nameAr?: string
  }
  establishmentDocumentCount?: number
  partnerCount?: number
}

interface CommercialProps {
  commercialData?: CommercialData
  onScrollToDocuments: () => void
  onScrollToPartners?: () => void
  setInitialTab: (tab: string) => void
}

const Commercial: React.FC<CommercialProps> = ({
  commercialData,
  onScrollToDocuments,
  onScrollToPartners,
  setInitialTab,
}) => {
  const hiddenLicenseUserTypeCodes = new Set(["3", "4", "13", "14", "15"])
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const {
    establishmentName,
    establishmentNameAr,
    licenseNumber,
    userTypeObj,
    emirateObj,
    establishmentDocumentCount,
    partnerCount
  } = commercialData || {}
  const normalizedUserTypeCode = String(userTypeObj?.code ?? "").trim()
  const shouldHideLicenseNumber = hiddenLicenseUserTypeCodes.has(normalizedUserTypeCode)
  const displayEstablishmentName = getDisplayValue(establishmentName)
  const displayEstablishmentNameAr = getDisplayValue(establishmentNameAr)

  return (
    <>

      <div className="feild-item">
        <div className="feild-label">{t("applicationOverviewCards.establishmentName")}</div>
        <div className="feild-value">
          <div className="overview-name-box">
            <OverflowTooltip
              className="overview-name-text"
              placement="topLeft"
              title={displayEstablishmentName}
              overlayClassName="profile-overview__type-tooltip"
            >
              {displayEstablishmentName}
            </OverflowTooltip>
            <OverflowTooltip
              className="overview-name-text"
              placement="topLeft"
              title={displayEstablishmentNameAr}
              overlayClassName="profile-overview__type-tooltip"
            >
              {displayEstablishmentNameAr}
            </OverflowTooltip>
          </div>
        </div>
      </div>
      {!shouldHideLicenseNumber && (
        <div className="feild-item">
          <div className="feild-label">{t("applicationOverviewCards.commercialLicenseNumber")}</div>
          <div className="feild-value">
            {licenseNumber || "-"}
          </div>
        </div>
      )}
      <div className="feild-item">
        <div className="feild-label">{t("applicationOverviewCards.emirate")}</div>
        <div className="feild-value">
          {isArabic ? emirateObj?.nameAr || emirateObj?.nameEn || "-" : emirateObj?.nameEn || emirateObj?.nameAr || "-"}
        </div>
      </div>
      <div className="entry-box">
        <div 
          className="entry-item"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setInitialTab("basic-information")
            onScrollToDocuments()
          }}
        >
          <img src={DocumentIcon} alt="" />
          <div className="entry-name">{t("applicationOverviewCards.documents")}</div>
          <div className="entry-value">{establishmentDocumentCount}</div>
        </div>
        <div 
          className="entry-item"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setInitialTab("basic-information")
            onScrollToPartners?.()
          }}
        >
          <img src={PartnersIcon} alt="" />
          <div className="entry-name">{t("applicationOverviewCards.partners")}</div>
          <div className="entry-value">{partnerCount}</div>
        </div>
      </div>
    </>
  )
}

export default Commercial
