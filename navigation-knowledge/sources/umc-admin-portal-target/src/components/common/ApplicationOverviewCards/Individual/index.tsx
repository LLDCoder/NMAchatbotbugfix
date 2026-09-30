import React from "react";
import { Skeleton, Tooltip } from "antd";
import DocumentIcon from "@/assets/images/document_icon.svg";
import { useTranslation } from "react-i18next";
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl";
import {
  getDisplayValue,
  getEmiratesIdDisplayValue,
  getPhoneDisplayValue,
} from "../displayValue";

interface IndividualData {
  potoUrl?: string;
  personalName?: string;
  personalNameAr?: string;
  personalEmail?: string;
  personalPhoneNumber?: string;
  emiratesId?: string;
  nationalityObj?: {
    id?: number;
    nameEn?: string;
    nameAr?: string;
  };
  documentCount?: number;
  uid?: string | number;
  passportNumber?: string | number;
}

interface IndividualProps {
  individualData?: IndividualData;
  onScrollToDocuments?: () => void;
}

const Individual: React.FC<IndividualProps> = ({
  individualData,
  onScrollToDocuments,
}) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.toLowerCase().startsWith("ar");
  const {
    potoUrl,
    personalName,
    personalNameAr,
    personalEmail,
    personalPhoneNumber,
    emiratesId,
    nationalityObj,
    documentCount,
    uid,
    passportNumber,
  } = individualData || {};
  const displayPersonalName = getDisplayValue(personalName);
  const displayPersonalNameAr = getDisplayValue(personalNameAr);
  const photoSource = useAuthenticatedDocumentUrl(potoUrl);

  return (
    <>
      <div className="feild-item">
        <div className="overview-basic-info">
          {photoSource ? (
            <img
              src={photoSource}
              alt=""
              className="overview-avatar"
            />
          ) : (
            <Skeleton.Avatar
              active
              size={64}
              className="overview-avatar overview-avatar-skeleton"
            />
          )}
          <div className="overview-name-box">
            <Tooltip placement="topLeft" title={displayPersonalName === "-" ? null : displayPersonalName}>
              <div className="overview-name-text">{displayPersonalName}</div>
            </Tooltip>
            <Tooltip
              placement="topLeft"
              title={displayPersonalNameAr === "-" ? null : displayPersonalNameAr}
            >
              <div className="overview-name-text overview-name-text--rtl">{displayPersonalNameAr}</div>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="feild-item">
        <div className="feild-label">{t("applicationOverviewCards.email")}</div>
        <div className="feild-value">{getDisplayValue(personalEmail)}</div>
      </div>
      <div className="feild-item">
        <div className="feild-label">
          {t("applicationOverviewCards.mobileNumber")}
        </div>
        <div className="feild-value">{getPhoneDisplayValue(personalPhoneNumber)}</div>
      </div>
      {emiratesId && (
        <div className="feild-item">
          <div className="feild-label">
            {t("applicationOverviewCards.emiratesId")}
          </div>
          <div className="feild-value">{getEmiratesIdDisplayValue(emiratesId)}</div>
        </div>
      )}
      {passportNumber && (
        <div className="feild-item">
          <div className="feild-label">
            {t("applicationOverviewCards.passport")}
          </div>
          <div className="feild-value">{getDisplayValue(passportNumber)}</div>
        </div>
      )}
      {uid && (
        <div className="feild-item">
          <div className="feild-label">
            {t("applicationOverviewCards.uid")}
          </div>
          <div className="feild-value">{getDisplayValue(uid)}</div>
        </div>
      )}

      <div className="feild-item">
        <div className="feild-label">
          {t("applicationOverviewCards.nationality")}
        </div>
        <div className="feild-value">
          {getDisplayValue(
            isArabic
              ? nationalityObj?.nameAr ?? nationalityObj?.nameEn
              : nationalityObj?.nameEn ?? nationalityObj?.nameAr,
          )}
        </div>
      </div>
      <div className="entry-box">
        <div
          className="entry-item"
          style={{ cursor: "pointer" }}
          onClick={onScrollToDocuments}
        >
          <img src={DocumentIcon} alt="" />
          <div className="entry-name">
            {t("applicationOverviewCards.documents")}
          </div>
          <div className="entry-value">{getDisplayValue(documentCount)}</div>
        </div>
      </div>
    </>
  );
};

export default Individual;
