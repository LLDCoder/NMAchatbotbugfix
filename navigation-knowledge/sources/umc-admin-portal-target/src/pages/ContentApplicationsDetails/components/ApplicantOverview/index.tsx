import { DownOutlined } from "@ant-design/icons"
import docIcon from "@/assets/images/fujian.svg"
import userImgIcon from "@/assets/images/applicant-user.png"
import "./index.less"
import { ExpandContext } from "../../context"
import { useContext, useEffect, useState, type FC } from "react"
import {
  getUserIndividual,
  type IUserIndividualProfile,
  type ILangInfo,
} from "@/services/userProfile"
import DocumentViewer from "@/components/common/DocumentViewer"
import moment from "moment"
import type { IProps } from "./type"
import { ExpandBtn } from "../ExpandBtn"
import { ReviewPersonalInformation } from "@/components/common";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { useTranslation } from "react-i18next";

export const ApplicantOverview: FC<IProps> = (props) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const expandContext = useContext(ExpandContext)
  const { details } = props
  const [userDetails, setUserDetails] = useState<IUserIndividualProfile>({} as IUserIndividualProfile)

  const renderExpandBtn = () => {
    const { applicant: isExpanded } = expandContext?.whichIsExpanded || {}
    // not approved
    const isDisabled = userDetails?.proFileStatus?.code !== "3"
    return !isDisabled ? (
      <ExpandBtn
        isExpanded={isExpanded || false}
        onExpandClick={() => expandContext?.dispatch?.({ applicant: true })}
        onShrinkClick={() => expandContext?.dispatch?.({ applicant: false })}
      />
    ) : null
  }

  const renderBasicContent = () => {
    const {
      fullNameEn,
      fullNameAr,
      nationalityInfo = {} as ILangInfo,
      email,
      mobileNumber,
      personalPhotoUrl,
    } = userDetails || {}
    return (
      <>
        <div className="overview-top">
          <div className="overview-item">
            <AuthenticatedDocumentImage
              src={personalPhotoUrl}
              fallbackSrc={userImgIcon}
            />
            <div className="item-content">
              <p className="item-value">{fullNameEn || "-"}</p>
              <p className="item-value">{fullNameAr || "-"}</p>
            </div>
          </div>
        </div>
        <div className="overview-center">
          <div className="overview-info">
            <p className="info-title">{t("Content.contentApplicationsDetails.applicantOverview.nationality")}</p>
            <p className="info-value">{isArabic ? nationalityInfo?.nameAr || nationalityInfo?.nameEn || "-" : nationalityInfo?.nameEn || nationalityInfo?.nameAr || "-"}</p>
          </div>
          <div className="overview-info">
            <p className="info-title">{t("Content.contentApplicationsDetails.applicantOverview.email")}</p>
            <p className="info-value">{email}</p>
          </div>
          <div className="overview-info">
            <p className="info-title">{t("Content.contentApplicationsDetails.applicantOverview.mobileNumber")}</p>
            <p className="info-value">{mobileNumber || "-"} </p>
          </div>
        </div>
        <div className="overview-footer">
          <div className="overview-attach">
            <div className="attach-title">
              <img src={docIcon} alt="" />
              <span className="title-text">{t("Content.contentApplicationsDetails.applicantOverview.documents")}</span>
            </div>
            <span className="attach-value">3</span>
          </div>
        </div>
      </>
    )
  }

  const renderMoreContent = () => {
    return (
      <ReviewPersonalInformation ProfileInfoIndex={userDetails} />
    )
  }

  const renderContent = () => {
    switch (expandContext?.whichIsExpanded?.applicant) {
      case true:
        return renderMoreContent()
      case false:
      default:
        return renderBasicContent()
    }
  }

  const getUserDetails = async () => {
    try {
      const res = await getUserIndividual(details?.userId)
      setUserDetails(res?.data || {})
    } catch (error) {}
  }

  useEffect(() => {
    if (details?.userId) {
      getUserDetails()
    } else if (expandContext?.whichIsExpanded?.applicant) {
      getUserDetails()
    }
  }, [expandContext?.whichIsExpanded?.applicant, details?.userId])

  return (
    <details className="applicant-overview" open>
      <summary className="overview-title">
        <b>{t("Content.contentApplicationsDetails.applicantOverview.title")}</b>
        <div>
          <DownOutlined className="collapse-icon" />
          {renderExpandBtn()}
        </div>
      </summary>
      {renderContent()}
    </details>
  )
}
