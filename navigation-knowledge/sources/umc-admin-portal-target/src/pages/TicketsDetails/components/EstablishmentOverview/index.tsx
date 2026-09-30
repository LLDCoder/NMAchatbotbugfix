import { DownOutlined } from "@ant-design/icons"
import doc from "@/assets/images/fujian.svg"
import user from "@/assets/images/UserCircle.svg"
import "./index.less"
import { useContext, useEffect, useState, type FC } from "react"
import { ExpandContext } from "@/pages/TicketsDetails"
import profile from "@/assets/images/ProfileCircle.svg"
import idIcon from "@/assets/images/id_icon.svg"
import PartnerCountryFlagIcon from "@/assets/images/partner-country-flag.svg"
import { CustomButton } from "@/components/common"
import {
  getEstablishment,
  type IEstablishmentOverview,
} from "@/services/userProfile"
import moment from "moment"
import DocumentViewer from "@/components/common/DocumentViewer"
import { ID_NAME_MAP, ID_TYPE_MAP, type IProps } from "./type"
import { ExpandBtn } from "../ExpandBtn"
import { useTranslation } from "react-i18next"
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia"

const EstablishmentOverview: FC<IProps> = (props) => {
  const { t } = useTranslation()
  const expandContext = useContext(ExpandContext)
  const { details } = props
  const [establishment, setEstablishment] = useState<IEstablishmentOverview>()

  const renderExpandBtn = () => {
    const { establishment: isExpanded } = expandContext?.whichIsExpanded || {}
    return (
      <ExpandBtn
        isExpanded={isExpanded || false}
        onShrinkClick={() => {

          expandContext?.dispatch?.({ establishment: false })
        }}
        onExpandClick={() => {
          expandContext?.dispatch?.({ establishment: true })
        }}
      />
    )
  }

  const renderBasicContent = () => {
    const {
      nameEn,
      nameAr,
      licenseNumber,
      establishmentEmirateName,
      partnersCount,
      documentsCount,
    } = establishment || {}
    return (
      <>
        <div className="overview-top">
          <div className="overview-item bg-p">
            <span>{t("Customer.ticketsDetails.establishment.warningsViolations")}</span>
            <span className="item-value color-r">0</span>
          </div>
          <div className="overview-item bg-y">
            <span>{t("Customer.ticketsDetails.establishment.unpaidFines")}</span>
            <span className="item-value color-g">1</span>
          </div>
        </div>
        <div className="overview-center">
          <div className="overview-info">
            <p className="info-title">{t("Customer.ticketsDetails.establishment.establishmentName")}</p>
            <p className="info-value">{nameEn || "-"}</p>
            <p className="info-value">{nameAr || "-"}</p>
          </div>
          <div className="overview-info">
            <p className="info-title">{t("Customer.ticketsDetails.establishment.commercialLicenseNumber")}</p>
            <p className="info-value">{licenseNumber || "-"}</p>
          </div>
          <div className="overview-info">
            <p className="info-title">{t("Customer.ticketsDetails.establishment.emirate")}</p>
            <p className="info-value">{establishmentEmirateName || ""}</p>
          </div>
        </div>
        <div className="overview-footer">
          <div className="overview-attach">
            <div className="attach-title">
              <img src={doc} alt="" />
              <span className="title-text">{t("Customer.ticketsDetails.establishment.documents")}</span>
            </div>
            <span className="item-value color-r">{documentsCount || "-"}</span>
          </div>
          <div className="overview-attach">
            <div className="attach-title">
              <img src={user} alt="" />
              <span className="title-text">{t("Customer.ticketsDetails.establishment.partners")}</span>
            </div>
            <span className="item-value color-g">{partnersCount || "-"}</span>
          </div>
        </div>
      </>
    )
  }

  const renderMoreContent = () => {
    const renderEstablishmentInfo = () => {
      const {
        establishmentTypeName,
        emails,
        licenseNumber,
        licenseExpiryDate = "",
        nameAr,
        nameEn,
        tenancyContractEndDate,
        authorityIdName,
        establishmentMobile,
        addressName,
      } = establishment || {}
      const establishmentObj = [
        {
          fieldKey: "establishmentSubTypes" as const,
          value: establishmentTypeName || "",
          cls: "sub-types-cls",
        },
        {
          fieldKey: "workEmail" as const,
          value: emails || "-",
        },
        {
          fieldKey: "commercialLicenseNumber" as const,
          value: licenseNumber || "-",
        },
        {
          fieldKey: "licenseExpiryDate" as const,
          value: moment(licenseExpiryDate).format("DD/MM/YYYY"),
        },
        {
          fieldKey: "establishmentNameInArabic" as const,
          value: nameAr || "-",
        },
        {
          fieldKey: "establishmentNameInEnglish" as const,
          value: nameEn || "-",
        },
        {
          fieldKey: "emirate" as const,
          value: addressName || "-",
        },
        {
          fieldKey: "licensingAuthority" as const,
          value: authorityIdName || "-",
        },
        {
          fieldKey: "phoneNumber" as const,
          value: establishmentMobile || "-",
        },
        {
          fieldKey: "tenancyContractEndDate" as const,
          value: moment(tenancyContractEndDate).format("DD/MM/YYYY"),
        },
      ]
      return (
        <div className="establishment-info">
          <div className="establishment-title">{t("Customer.ticketsDetails.establishment.establishmentInformation")}</div>
          <div className="establishment-content">
            {establishmentObj.map((item) => (
              <div
                className={`overview-info ${item?.cls || ""}`}
                key={item.fieldKey}
              >
                <p className="info-title">
                  {t(`Customer.ticketsDetails.establishment.${item.fieldKey}`)}
                </p>
                <p className="info-value">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    const renderEstablishmentDoc = () => {
      const {
        licenseCopyUrl,
        tenancyContractCopyUrl,
        memorandumOfAssociationCopyUrl,
        powerOfAttorneyCopyUrl,
      } = establishment || {}
      const docObj = [
        {
          name: t("Customer.ticketsDetails.establishment.commercialLicense"),
          value: licenseCopyUrl,
        },
        {
          name: t("Customer.ticketsDetails.establishment.tenancyContract"),
          value: tenancyContractCopyUrl,
        },
        {
          name: t("Customer.ticketsDetails.establishment.memorandumOfAssociation"),
          value: memorandumOfAssociationCopyUrl,
        },
        {
          name: t("Customer.ticketsDetails.establishment.powerOfAttorney"),
          value: powerOfAttorneyCopyUrl,
        },
      ]
      return (
        <div className="doc-info">
          <div className="doc-title">{t("Customer.ticketsDetails.establishment.establishmentDocuments")}</div>
          <div className="doc-content">
            {docObj.map((item) => (
              <div className="overview-info" key={item.name}>
                <p className="info-title">{item.name}</p>
                {item.value ? (
                  <div className="feild-value">
                    <DocumentViewer hasDownload hasView fileName={item.value} />
                  </div>
                ) : (
                  "-"
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    const renderLegalPersonInfo = () => {
      const { name, personalMobile, dateBirth, personalEmail, idTypeInfo } =
        establishment?.legalPerson || {}
      const { legalPerson } = establishment || {}
      const idValue = legalPerson
        ? legalPerson?.[
            ID_TYPE_MAP[idTypeInfo?.name as string] as keyof typeof legalPerson
          ]
        : "-"
      const legalPersonObj = [
        {
          name: "Legal Person",
          value: name || "-",
        },
        {
          name: "Legal Person’s Contact Number",
          value: personalMobile || "-",
        },
        {
          name: "ID Type",
          value: idTypeInfo?.name || "-",
        },
        {
          name: ID_NAME_MAP[ID_TYPE_MAP[idTypeInfo?.name as string]] ?? "-",
          value: idValue,
        },
        {
          name: "Date of Birth",
          value: moment(dateBirth).format("DD/MM/YYYY") || "-",
        },
        {
          name: "Email",
          value: personalEmail || "-",
        },
      ]
      return (
        <div className="legal-person-info">
          <div className="legal-person-title">{t("sharedComponents.reviewEstablishmentInformation.sections.legalPersonInformation")}</div>
          <div className="legal-person-content">
            {legalPersonObj.map((item) => (
              <div className="overview-info" key={item.name}>
                <p className="info-title">{item.name}</p>
                <p className="info-value">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    const renderAddressInfo = () => {
      const { regionInfo, areaInfo, street, emiratesInfo } =
        establishment?.legalPerson || {}
      const addObj = [
        {
          name: t("Customer.ticketsDetails.establishment.emirate"),
          value: emiratesInfo?.name || "-",
        },
        {
          name: t("Customer.ticketsDetails.establishment.region"),
          value: regionInfo?.name || "-",
        },
        {
          name: t("Customer.ticketsDetails.establishment.area"),
          value: areaInfo?.name || "-",
        },
        {
          name: t("Customer.ticketsDetails.establishment.street"),
          value: street || "-",
        },
      ]
      return (
        <div className="address-info">
          <div className="address-title">{t("Customer.ticketsDetails.establishment.addressInformation")}</div>
          <div className="address-content">
            {addObj.map((item) => (
              <div className="overview-info" key={item.name}>
                <p className="info-title">{item.name}</p>
                <p className="info-value">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    const renderPartnerList = () => {
      return (
        <div className="partner-list-info">
          <div className="partner-list-title">{t("Customer.ticketsDetails.establishment.partnerList")}</div>
          <div className="partner-list-content">
            {(establishment?.partners || []).map((item) => (
              <div className="info-content" key={item.id}>
                <div className="info-content-item">
                  <div>
                    <p className="item-title">{item.name}</p>
                    <p className="info-title">
                      <img src={idIcon} alt="" />
                      <span>{item.number}</span>e
                    </p>
                    <p className="info-value">
                      <img src={PartnerCountryFlagIcon} alt="" />
                      <span>{item.address}</span>
                    </p>
                  </div>
                  <div className="profile-img-container">
                    <AuthenticatedDocumentImage
                      className="profile-img"
                      src={item?.partnerPhotoUrl}
                      fallbackSrc={profile}
                      alt={t("sharedComponents.partnerList.labels.personalPhoto")}
                    />
                  </div>
                </div>
                <div className="info-btn">
                  <CustomButton
                    text={t("common.details")}
                    variant="primary"
                    customClassName="btn-cls"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <>
        {renderEstablishmentInfo()}
        {renderEstablishmentDoc()}
        {/* {renderLegalPersonInfo()} */}
        {renderAddressInfo()}
        {renderPartnerList()}
      </>
    )
  }

  const renderContent = () => {
    switch (expandContext?.whichIsExpanded?.establishment) {
      case true:
        return renderMoreContent()
      case false:
      default:
        return renderBasicContent()
    }
  }

  const getEstablishmentDetails = async () => {
    try {
      const res = await getEstablishment(details?.profileId)
      setEstablishment(res?.data || {})
    } catch (error) {}
  }

  useEffect(() => {
    if (details?.profileId) {
      getEstablishmentDetails()
    } else if (expandContext?.whichIsExpanded?.establishment) {
      getEstablishmentDetails()
    }
  }, [expandContext?.whichIsExpanded?.establishment, details?.profileId])

  return (
    <details className="establishment-overview" open>
      <summary className="overview-title">
        <b>{t("Customer.ticketsDetails.establishment.title")}</b>
        <div>
          <DownOutlined className="collapse-icon" />
          {renderExpandBtn()}
        </div>
      </summary>
      {renderContent()}
    </details>
  )
}
export default EstablishmentOverview
