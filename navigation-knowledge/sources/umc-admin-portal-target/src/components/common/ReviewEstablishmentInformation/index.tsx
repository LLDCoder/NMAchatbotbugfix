import React from "react"
import moment from "moment"
import DocumentViewer from "@/components/common/DocumentViewer"
import PartnerList from "@/components/BusinessCmps/PartnerList/PartnerList"
import type { IEstablishmentOverview } from "@/services/userProfile"
import "./index.less"
import { useTranslation } from "react-i18next"

interface ReviewEstablishmentInformationProps {
  establishment?: IEstablishmentOverview
  documentsSectionRef?: React.RefObject<HTMLDivElement>
  partnersSectionRef?: React.RefObject<HTMLDivElement>
}

type EstablishmentRecord = Record<string, unknown>
const GOVERNMENT_GROUP_SUB_TYPE_IDS = new Set([3, 4, 31, 32, 33])

const toRecord = (value: unknown): EstablishmentRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as EstablishmentRecord
}

const toFirstRecord = (value: unknown): EstablishmentRecord => {
  if (Array.isArray(value)) return toRecord(value[0])
  return toRecord(value)
}

const normalizeText = (value: unknown): string => {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}
const normalizeNullableText = (value: unknown): string | null => {
  const text = normalizeText(value)
  return text || null
}

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = normalizeText(value)
    if (text) return text
  }
  return ""
}

const getLocalizedName = (value: unknown, isArabic: boolean): string => {
  const record = toRecord(value)
  return firstText(
    isArabic ? record.nameAr : record.nameEn,
    isArabic ? record.nameEn : record.nameAr,
    record.name,
  )
}

const formatDate = (value: unknown): string => {
  const normalizedValue = normalizeText(value)
  if (!normalizedValue) return "-"

  const date = moment(normalizedValue)
  return date.isValid() ? date.format("DD/MM/YYYY") : "-"
}

const getOptionalId = (value: unknown): string | number | null => {
  if (typeof value === "string" || typeof value === "number") return value
  return null
}
const getPartnerIdentity = (value: unknown): string => {
  const partner = toRecord(value)
  return firstText(
    partner.id,
    partner.partnerId,
    partner.profileId,
    partner.userProfileId,
    partner.emiratesId,
    partner.uaeNumber,
    partner.passportNumber,
    partner.number,
    partner.fullNameEn,
    partner.fullNameAr,
    partner.name,
  ).toLowerCase()
}
const normalizePartnerList = (value: unknown): EstablishmentRecord[] =>
  Array.isArray(value) ? value.map(toRecord).filter((item) => Object.keys(item).length) : []
const getLicenseOwnerPartners = (
  establishmentRecord: EstablishmentRecord,
  establishmentInfo: EstablishmentRecord,
): EstablishmentRecord[] => {
  const candidates = [
    establishmentRecord.licenseOwner,
    establishmentRecord.licenseOwnerInfo,
    establishmentRecord.licenseOwnerProfile,
    establishmentRecord.licenseOwnerPartner,
    establishmentRecord.owner,
    establishmentRecord.ownerInfo,
    establishmentRecord.ownerPartner,
    establishmentInfo.licenseOwner,
    establishmentInfo.licenseOwnerInfo,
    establishmentInfo.licenseOwnerProfile,
    establishmentInfo.licenseOwnerPartner,
    establishmentInfo.owner,
    establishmentInfo.ownerInfo,
    establishmentInfo.ownerPartner,
  ]
  return candidates
    .map(toRecord)
    .filter((item) => Object.keys(item).length)
    .map((item) => ({ ...item, isOwner: true }))
}

const ReviewEstablishmentInformation: React.FC<
  ReviewEstablishmentInformationProps
> = ({ establishment, documentsSectionRef, partnersSectionRef }) => {
  const { i18n, t } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar") ?? false
  const establishmentRecord = toRecord(establishment)
  const establishmentInfo = toRecord(establishmentRecord.establishment)
  const documentInfo = toFirstRecord(establishmentRecord.documentInfo)
  const addressInfo = toRecord(establishmentRecord.addressInfo)
  const rawPartners = normalizePartnerList(establishmentRecord.partners)
  const fallbackPartners = normalizePartnerList(establishmentRecord.partnerList)
  const partners = rawPartners.length ? rawPartners : fallbackPartners
  const licenseOwnerPartners = getLicenseOwnerPartners(
    establishmentRecord,
    establishmentInfo,
  )
  const overviewPartners = licenseOwnerPartners.reduce<EstablishmentRecord[]>(
    (list, owner) => {
      const ownerIdentity = getPartnerIdentity(owner)
      if (
        ownerIdentity &&
        list.some((partner) => getPartnerIdentity(partner) === ownerIdentity)
      ) {
        return list.map((partner) =>
          getPartnerIdentity(partner) === ownerIdentity
            ? { ...partner, isOwner: true }
            : partner,
        )
      }
      return [...list, owner]
    },
    partners,
  )
  const establishmentTypeName = firstText(
    establishmentRecord.establishmentTypeName,
    getLocalizedName(establishmentInfo.establishmentTypeObj, isArabic),
  )
  const establishmentType = toRecord(establishmentInfo.establishmentTypeObj)
  const establishmentTypeId = Number(
    establishmentInfo.establishmentTypeId ??
      establishmentType.id ??
      establishmentRecord.establishmentTypeId ??
      establishmentRecord.userTypeId,
  )
  const isGovernmentGroup =
    Number.isFinite(establishmentTypeId) &&
    GOVERNMENT_GROUP_SUB_TYPE_IDS.has(establishmentTypeId)
  const establishmentMobile = firstText(
    establishmentRecord.establishmentMobile,
    establishmentInfo.workMobileNumber,
    establishmentInfo.workMobileNumibe,
    establishmentInfo.personalMobile,
    establishmentInfo.phoneNumber,
  )
  const emails = firstText(
    establishmentRecord.emails,
    establishmentInfo.workEmail,
  )
  const licenseNumber = firstText(
    establishmentRecord.licenseNumber,
    establishmentInfo.licenseNumber,
  )
  const tenancyContractEndDate = firstText(
    establishmentRecord.tenancyContractEndDate,
    establishmentInfo.tenancyContractEndDate,
  )
  const licenseExpiryDate = firstText(
    establishmentRecord.licenseExpiryDate,
    establishmentInfo.licenseExpiryDate,
  )
  const addressName = firstText(
    establishmentRecord.addressName,
    establishmentRecord.establishmentEmirateName,
    getLocalizedName(establishmentInfo.emirateObj, isArabic),
    getLocalizedName(addressInfo.emirateObj, isArabic),
  )
  const nameAr = firstText(establishmentRecord.nameAr, establishmentInfo.nameAr)
  const nameEn = firstText(establishmentRecord.nameEn, establishmentInfo.nameEn)
  const authorityIdName = firstText(
    establishmentRecord.authorityIdName,
    isArabic
      ? establishmentInfo.authorityIdNameAr
      : establishmentInfo.authorityIdNameEn,
    isArabic
      ? establishmentInfo.authorityIdNameEn
      : establishmentInfo.authorityIdNameAr,
    getLocalizedName(establishmentInfo.licensingAuthorityObj, isArabic),
    getLocalizedName(establishmentInfo.licensingAutharityObj, isArabic),
  )
  const licenseCopyUrl = firstText(
    establishmentRecord.licenseCopyUrl,
    documentInfo.licenseCopyUrl,
  )
  const tenancyContractCopyUrl = firstText(
    establishmentRecord.tenancyContractCopyUrl,
    documentInfo.tenancyContractCopyUrl,
  )
  const memorandumOfAssociationCopyUrl = firstText(
    establishmentRecord.memorandumOfAssociationCopyUrl,
    documentInfo.memorandumOfAssociationCopyUrl,
  )
  const powerOfAttorneyCopyUrl = firstText(
    establishmentRecord.powerOfAttorneyCopyUrl,
    documentInfo.powerOfAttorneyCopyUrl,
  )
  const officialLetterUrl = firstText(
    establishmentRecord.officialLetterUrl,
    documentInfo.officialLetterUrl,
  )
  const commonInformationFields = [
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.establishmentSubTypes"),
      value: establishmentTypeName || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.workMobileNumber"),
      value: establishmentMobile || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.workEmail"),
      value: emails || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.emirate"),
      value: addressName || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.establishmentNameInArabic"),
      value: nameAr || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.establishmentNameInEnglish"),
      value: nameEn || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.phoneNumber"),
      value: establishmentMobile || "-",
    },
  ]
  const commercialInformationFields = [
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.commercialLicenseNumber"),
      value: licenseNumber || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.tenancyContractEndDate"),
      value: formatDate(tenancyContractEndDate),
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.licenseExpiryDate"),
      value: formatDate(licenseExpiryDate),
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.licensingAuthority"),
      value: authorityIdName || "-",
    },
  ]
  const feildList1 = isGovernmentGroup
    ? commonInformationFields
    : [...commonInformationFields, ...commercialInformationFields]
  const addressInformationFields = [
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.emirate"),
      value: getLocalizedName(addressInfo.emirateObj, isArabic) || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.region"),
      value: getLocalizedName(addressInfo.regionObj, isArabic) || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.area"),
      value: getLocalizedName(addressInfo.areaObj, isArabic) || "-",
    },
    {
      label: t("sharedComponents.reviewEstablishmentInformation.labels.street"),
      value: getLocalizedName(addressInfo.streetObj, isArabic) || "-",
    },
  ]
  const feildList2 = isGovernmentGroup
    ? [
        {
          label: t("sharedComponents.reviewEstablishmentInformation.documents.officialLetter"),
          value: officialLetterUrl,
        },
      ]
    : [
        {
          label: t("sharedComponents.reviewEstablishmentInformation.documents.powerOfAttorney"),
          value: powerOfAttorneyCopyUrl,
        },
        {
          label: t("sharedComponents.reviewEstablishmentInformation.documents.memorandumOfAssociation"),
          value: memorandumOfAssociationCopyUrl,
        },
        {
          label: t("sharedComponents.reviewEstablishmentInformation.documents.commercialLicense"),
          value: licenseCopyUrl,
        },
        {
          label: t("sharedComponents.reviewEstablishmentInformation.documents.tenancyContract"),
          value: tenancyContractCopyUrl,
        },
      ]
  return (
    <div className="ReviewEstablishmentInformation">
      <div className="border-card">
        <div className="border-card-title">{t("sharedComponents.reviewEstablishmentInformation.sections.establishmentInformation")}</div>
        <div className="feild-list first-feild-list">
          {feildList1.map((item, i) => {
            const isArabicField = item.label === t("sharedComponents.reviewEstablishmentInformation.labels.establishmentNameInArabic")
            return (
              <div className="feild-item" key={i}>
                <div className="feild-label">{item.label}</div>
                <div className={`feild-value ${isArabicField && isArabic ? "arabic-text" : ""}`}>
                  {item.value}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="border-card" ref={documentsSectionRef}>
        <div className="border-card-title">{t("sharedComponents.reviewEstablishmentInformation.sections.establishmentDocuments")}</div>
        <div className="feild-list">
          {feildList2.map((item, i) => {
            return (
              <div className="feild-item" key={i}>
                <div className="feild-label">{item.label}</div>
                {item.value ? (
                  <div className="feild-value">
                    <DocumentViewer
                      hasDownload
                      hasView
                      fileName={item.value}
                    />
                  </div>
                ) : (
                  "-"
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="border-card">
        <div className="border-card-title">{t("sharedComponents.reviewEstablishmentInformation.sections.addressInformation")}</div>
        <div className="feild-list">
          {addressInformationFields.map((item, i) => {
            return (
              <div className="feild-item" key={i}>
                <div className="feild-label">{item.label}</div>
                <div className="feild-value">{item.value}</div>
              </div>
            )
          })}
        </div>
      </div>
      {/* <div className="border-card">
        <div className="border-card-title">{t("sharedComponents.reviewEstablishmentInformation.sections.legalPersonInformation")}</div>
        <div className="feild-list">
          {feildList3.map((item, i) => {
            return (
              <div className="feild-item" key={i}>
                <div className="feild-label">{item.label}</div>
                <div className="feild-value">{item.value}</div>
              </div>
            )
          })}
        </div>
      </div> */}
      {!isGovernmentGroup && (
      <div className="border-card2" ref={partnersSectionRef}>
      <PartnerList
      localSearch
      params={
            overviewPartners.map((item) => {
              const partner = toRecord(item)
              return {
                ...partner,
                representativeNameEn: normalizeNullableText(
                  partner.representativeNameEn,
                ),
                representativeNameAr: normalizeNullableText(
                  partner.representativeNameAr,
                ),
                representativeEmiratesId: normalizeNullableText(
                  partner.representativeEmiratesId,
                ),
                name: firstText(
                  partner.name,
                  isArabic ? partner.fullNameAr : partner.fullNameEn,
                  isArabic ? partner.fullNameEn : partner.fullNameAr,
                ),
                identifier: firstText(
                  partner.number,
                  partner.emiratesId,
                  partner.uaeNumber,
                  partner.passportNumber,
                ),
                location: firstText(
                  partner.address,
                  getLocalizedName(partner.emirateObj, isArabic),
                ),
                id: getOptionalId(partner.id),
              }
            })
          }
        />
      </div>
      )}
    </div>
  )
}

export default ReviewEstablishmentInformation
