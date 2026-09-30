import { DownOutlined } from "@ant-design/icons"
import doc from "@/assets/images/fujian.svg"
import user from "@/assets/images/UserCircle.svg"
import "./index.less"
import { useContext, useEffect, useState, type FC } from "react"
import { ExpandContext } from "../../context"
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

export const EstablishmentOverview: FC<IProps> = (props) => {
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
            <span>{t("Content.contentApplicationsDetails.establishmentOverview.warningsViolations")}</span>
            <span className="item-value color-r">0</span>
          </div>
          <div className="overview-item bg-y">
            <span>{t("Content.contentApplicationsDetails.establishmentOverview.unpaidFines")}</span>
            <span className="item-value color-g">1</span>
          </div>
        </div>
        <div className="overview-center">
          <div className="overview-info">
            <p className="info-title">{t("Content.contentApplicationsDetails.establishmentOverview.establishmentName")}</p>
            <p className="info-value">{nameEn || "-"}</p>
            <p className="info-value">{nameAr || "-"}</p>
          </div>
          <div className="overview-info">
            <p className="info-title">{t("Content.contentApplicationsDetails.establishmentOverview.commercialLicenseNumber")}</p>
            <p className="info-value">{licenseNumber || "-"}</p>
          </div>
          <div className="overview-info">
            <p className="info-title">{t("Content.contentApplicationsDetails.establishmentOverview.emirate")}</p>
            <p className="info-value">{establishmentEmirateName || ""}</p>
          </div>
        </div>
        <div className="overview-footer">
          <div className="overview-attach">
            <div className="attach-title">
              <img src={doc} alt="" />
              <span className="title-text">{t("Content.contentApplicationsDetails.establishmentOverview.documents")}</span>
            </div>
            <span className="item-value color-r">{documentsCount || "-"}</span>
          </div>
          <div className="overview-attach">
            <div className="attach-title">
              <img src={user} alt="" />
              <span className="title-text">{t("Content.contentApplicationsDetails.establishmentOverview.partners")}</span>
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
          name: t("Content.contentApplicationsDetails.establishmentOverview.establishmentSubTypes"),
          value: establishmentTypeName || "",
          cls: "sub-types-cls",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.workEmail"),
          value: emails || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.commercialLicenseNumber"),
          value: licenseNumber || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.licenseExpiryDate"),
          value: moment(licenseExpiryDate).format("DD/MM/YYYY"),
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.establishmentNameAr"),
          value: nameAr || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.establishmentNameEn"),
          value: nameEn || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.emirate"),
          value: addressName || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.licensingAuthority"),
          value: authorityIdName || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.phoneNumber"),
          value: establishmentMobile || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.tenancyContractEndDate"),
          value: moment(tenancyContractEndDate).format("DD/MM/YYYY"),
        },
      ]
      return (
        <div className="establishment-info">
          <div className="establishment-title">{t("Content.contentApplicationsDetails.establishmentOverview.establishmentInformation")}</div>
          <div className="establishment-content">
            {establishmentObj.map((item) => (
              <div
                className={`overview-info ${item?.cls || ""}`}
                key={item.name}
              >
                <p className="info-title">{item.name}</p>
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
          name: t("Content.contentApplicationsDetails.establishmentOverview.commercialLicense"),
          value: licenseCopyUrl,
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.tenancyContract"),
          value: tenancyContractCopyUrl,
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.memorandumOfAssociation"),
          value: memorandumOfAssociationCopyUrl,
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.powerOfAttorney"),
          value: powerOfAttorneyCopyUrl,
        },
      ]
      return (
        <div className="doc-info">
          <div className="doc-title">{t("Content.contentApplicationsDetails.establishmentOverview.establishmentDocuments")}</div>
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
          name: t("Content.contentApplicationsDetails.establishmentOverview.legalPerson"),
          value: name || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.legalPersonContactNumber"),
          value: personalMobile || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.idType"),
          value: idTypeInfo?.name || "-",
        },
        {
          name: ID_NAME_MAP[ID_TYPE_MAP[idTypeInfo?.name as string]] ?? "-",
          value: idValue,
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.dateOfBirth"),
          value: moment(dateBirth).format("DD/MM/YYYY") || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.email"),
          value: personalEmail || "-",
        },
      ]
      return (
        <div className="legal-person-info">
          <div className="legal-person-title">{t("Content.contentApplicationsDetails.establishmentOverview.legalPersonInformation")}</div>
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
          name: t("Content.contentApplicationsDetails.establishmentOverview.emirate"),
          value: emiratesInfo?.name || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.region"),
          value: regionInfo?.name || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.area"),
          value: areaInfo?.name || "-",
        },
        {
          name: t("Content.contentApplicationsDetails.establishmentOverview.street"),
          value: street || "-",
        },
      ]
      return (
        <div className="address-info">
          <div className="address-title">{t("Content.contentApplicationsDetails.establishmentOverview.addressInformation")}</div>
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
          <div className="partner-list-title">{t("Content.contentApplicationsDetails.establishmentOverview.partnerList")}</div>
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
                    text={t("Content.contentApplicationsDetails.establishmentOverview.details")}
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
        <b>{t("Content.contentApplicationsDetails.establishmentOverview.title")}</b>
        <div>
          <DownOutlined className="collapse-icon" />
          {renderExpandBtn()}
        </div>
      </summary>
      {renderContent()}
    </details>
  )
}
