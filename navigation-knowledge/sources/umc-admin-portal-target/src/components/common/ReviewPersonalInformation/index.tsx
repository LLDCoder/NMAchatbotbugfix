import React from "react";
import "./ReviewPersonalInformation.less";
import DocumentViewer from "@/components/common/DocumentViewer/index";

import moment from "moment";
import { useTranslation } from "react-i18next";
export type ReviewPersonalInformationSection =
  | "personalInformation"
  | "addressInformation"
  | "personalDocuments";

interface ReviewProfileInfoProps {
  expanded?: boolean;
  onToggle?: () => void;
  ProfileInfoIndex?: UserProfileData | null;
  documentsSectionRef?: React.RefObject<HTMLDivElement>;
  visibleSections?: ReviewPersonalInformationSection[];
  hideIdentityFields?: boolean;
}
interface NationalityInfo {
  id: number;
  code: string | null;
  nameEn: string;
  nameAr: string;
}

interface GenderInfo {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface EmirateInfo {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface RegionInfo {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface AreaInfo {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface ProFileStatus {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

export interface UserProfileData {
  type: number;
  profileCode: string;
  userId: string;
  proFileId: number;
  rejectReason: string | null;
  dateOfBirth: string;
  passportNumber: string;
  uid: string;
  email: string;
  mobileNumber: string;
  emiratesId: string;
  fullNameAr: string;
  fullNameEn: string;
  nationalityId: number;
  nationalityInfo: NationalityInfo;
  genderId: number;
  genderInfo: GenderInfo;
  passportExpiryDate: string;
  emiratesIdexpiryDate: string | null;
  occupation: string;
  personalPhotoUrl: string;
  passportCopyUrl: string;
  emiratesIdCopyUrl: string | null;
  visaCopyUrl: string;
  visaExpiryDate: string;
  emirateId: number;
  emirateInfo: EmirateInfo;
  regionId: number;
  regionInfo: RegionInfo;
  areaId: number;
  areaInfo: AreaInfo;
  street: string;
  proFileStatus: ProFileStatus;
}

export default function ReviewPersonalInformation({
  ProfileInfoIndex,
  documentsSectionRef,
  visibleSections,
  hideIdentityFields = false,
}: ReviewProfileInfoProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.resolvedLanguage === "ar";
  const visibleSectionSet = React.useMemo(
    () =>
      new Set<ReviewPersonalInformationSection>(
        visibleSections ?? [
          "personalInformation",
          "addressInformation",
          "personalDocuments",
        ],
      ),
    [visibleSections],
  );
  const getSectionClassName = (
    section: ReviewPersonalInformationSection,
  ) =>
    visibleSectionSet.has(section)
      ? "info-block"
      : "info-block info-block--hidden";
  const getLocalizedName = (
    value?: { nameEn?: string; nameAr?: string; name?: string } | null,
  ) => {
    if (!value) return "-";
    if (isArabic) {
      return value.nameAr || value.name || value.nameEn || "-";
    }
    return value.nameEn || value.name || value.nameAr || "-";
  };
  const formatDate = (
    dateString: string,
    format: string = "DD/MM/YYYY"
  ): string => {
    if (!dateString) return "-";
    return moment(dateString).format(format);
  };

  const renderUIDFields = () => {
    return (
      <div className="section-content">
        <div
          className={getSectionClassName("personalInformation")}
          ref={documentsSectionRef}
        >
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.personalInformation")}</h4>
          <div className="info-grid">
            {hideIdentityFields ? null : (
              <div className="info-item">
                <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.identityVerificationMethod")}</span>
                <span className="info-value">
                  {t("sharedComponents.reviewPersonalInformation.values.uaeUnifiedNumberUid")}
                </span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.dateOfBirth")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.dateOfBirth
                  ? formatDate(ProfileInfoIndex?.dateOfBirth)
                  : "-"}
              </span>
            </div>
            {hideIdentityFields ? null : (
              <div className="info-item">
                <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.uaeUnifiedNumberUid")}</span>
                <span className="info-value">{ProfileInfoIndex?.uid || "-"}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.fullNameInArabic")}</span>
              <span className="info-value domain-direction-rtl">
                {ProfileInfoIndex?.fullNameAr || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.fullNameInEnglish")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.fullNameEn || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.nationality")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.nationalityInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.gender")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.genderInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.passportExpiryDate")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.passportExpiryDate
                  ? formatDate(ProfileInfoIndex?.passportExpiryDate)
                  : "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.occupation")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.occupation || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.visaExpiryDate")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.visaExpiryDate
                  ? formatDate(ProfileInfoIndex?.visaExpiryDate)
                  : "-"}
              </span>
            </div>
            
          </div>
        </div>

        <div
          className={getSectionClassName("addressInformation")}
          ref={documentsSectionRef}
        >
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.addressInformation")}</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.emirate")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.emirateInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.region")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.regionInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.area")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.areaInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.street")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.street || "-"}
              </span>
            </div>
          </div>
        </div>

        <div
          className={getSectionClassName("personalDocuments")}
          ref={documentsSectionRef}
        >
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.personalDocuments")}</h4>
          <div className="documents-grid">
            <div className="document-info">
              <span className="document-label">{t("sharedComponents.reviewPersonalInformation.documents.personalPhoto")}</span>
              {ProfileInfoIndex?.personalPhotoUrl ? (
                <DocumentViewer
                  key={ProfileInfoIndex?.personalPhotoUrl}
                  fileName={ProfileInfoIndex?.personalPhotoUrl}
                  hasDownload={true}
                ></DocumentViewer>
              ) : (
                "-"
              )}
            </div>

            <div className="document-info">
              <span className="document-label">{t("sharedComponents.reviewPersonalInformation.documents.passport")}</span>
              {ProfileInfoIndex?.passportCopyUrl ? (
                <DocumentViewer
                  key={ProfileInfoIndex?.passportCopyUrl}
                  fileName={ProfileInfoIndex?.passportCopyUrl}
                  hasDownload={true}
                ></DocumentViewer>
              ) : (
                "-"
              )}
            </div>

            <div className="document-info">
              <span className="document-label">{t("sharedComponents.reviewPersonalInformation.documents.visa")}</span>
              {ProfileInfoIndex?.visaCopyUrl ? (
                <DocumentViewer
                  key={ProfileInfoIndex?.visaCopyUrl}
                  fileName={ProfileInfoIndex?.visaCopyUrl}
                  hasDownload={true}
                ></DocumentViewer>
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>
 
      </div>
    );
  };
  const renderPassportFields = () => {
    return (
      <div className="section-content">
        <div className={getSectionClassName("personalInformation")}>
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.personalInformation")}</h4>
          <div className="info-grid">
            {hideIdentityFields ? null : (
              <div className="info-item">
                <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.identityVerificationMethod")}</span>
                <span className="info-value">
                  {t("sharedComponents.reviewPersonalInformation.values.passport")}
                </span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.dateOfBirth")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.dateOfBirth
                  ? formatDate(ProfileInfoIndex?.dateOfBirth)
                  : "-"}
              </span>
            </div>
            {hideIdentityFields ? null : (
              <div className="info-item">
                <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.passportNumber")}</span>
                <span className="info-value">
                  {ProfileInfoIndex?.passportNumber || "-"}
                </span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.fullNameInArabic")}</span>
              <span className="info-value domain-direction-rtl">
                {ProfileInfoIndex?.fullNameAr || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.fullNameInEnglish")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.fullNameEn || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.nationality")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.nationalityInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.gender")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.genderInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.occupation")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.occupation || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.expiryDate")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.emiratesIdexpiryDate
                  ? formatDate(ProfileInfoIndex?.emiratesIdexpiryDate)
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className={getSectionClassName("addressInformation")}>
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.addressInformation")}</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.emirate")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.emirateInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.region")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.regionInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.area")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.areaInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.street")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.street || "-"}
              </span>
            </div>
          </div>
        </div>

        <div className={getSectionClassName("personalDocuments")}>
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.personalDocuments")}</h4>
          <div className="documents-grid">
            <div className="document-info">
              <span className="document-label">{t("sharedComponents.reviewPersonalInformation.documents.personalPhoto")}</span>
              {ProfileInfoIndex?.personalPhotoUrl ? (
                <DocumentViewer
                  key={ProfileInfoIndex?.personalPhotoUrl}
                  fileName={ProfileInfoIndex?.personalPhotoUrl}
                  hasDownload={true}
                ></DocumentViewer>
              ) : (
                "-"
              )}
            </div>

            <div className="document-info">
              <span className="document-label">{t("sharedComponents.reviewPersonalInformation.documents.passportScan")}</span>
              {ProfileInfoIndex?.passportCopyUrl ? (
                <DocumentViewer
                  key={ProfileInfoIndex?.passportCopyUrl}
                  fileName={ProfileInfoIndex?.passportCopyUrl}
                  hasDownload={true}
                ></DocumentViewer>
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>

      </div>
    );
  };
  const renderEmiratesIdFields = () => {
    return (
      <div className="section-content">
        <div className={getSectionClassName("personalInformation")}>
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.personalInformation")}</h4>
          <div className="info-grid">
            {hideIdentityFields ? null : (
              <div className="info-item">
                <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.identityVerificationMethod")}</span>
                <span className="info-value">
                  {t("sharedComponents.reviewPersonalInformation.values.emiratesId")}
                </span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.dateOfBirth")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.dateOfBirth
                  ? formatDate(ProfileInfoIndex?.dateOfBirth)
                  : "-"}
              </span>
            </div>
            {hideIdentityFields ? null : (
              <div className="info-item">
                <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.emiratesId")}</span>
                <span className="info-value">
                  {ProfileInfoIndex?.emiratesId || "-"}
                </span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.fullNameInArabic")}</span>
              <span className="info-value domain-direction-rtl">
                {ProfileInfoIndex?.fullNameAr || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.fullNameInEnglish")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.fullNameEn || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.nationality")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.nationalityInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.gender")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.genderInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.occupation")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.occupation || "-"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.expiryDate")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.emiratesIdexpiryDate
                  ? formatDate(ProfileInfoIndex?.emiratesIdexpiryDate)
                  : "-"}
              </span>
            </div>
            
          </div>
        </div>

        <div className={getSectionClassName("addressInformation")}>
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.addressInformation")}</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.emirate")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.emirateInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.region")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.regionInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.area")}</span>
              <span className="info-value">
                {getLocalizedName(ProfileInfoIndex?.areaInfo)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">{t("sharedComponents.reviewPersonalInformation.labels.street")}</span>
              <span className="info-value">
                {ProfileInfoIndex?.street || "-"}
              </span>
            </div>
          </div>
        </div>

        <div className={getSectionClassName("personalDocuments")}>
          <h4 className="block-title">{t("sharedComponents.reviewPersonalInformation.sections.personalDocuments")}</h4>
          <div className="documents-grid">
            <div className="document-info">
              <span className="document-label">{t("sharedComponents.reviewPersonalInformation.documents.personalPhoto")}</span>
              {ProfileInfoIndex?.personalPhotoUrl ? (
                <DocumentViewer
                  key={ProfileInfoIndex?.personalPhotoUrl}
                  fileName={ProfileInfoIndex?.personalPhotoUrl}
                  hasDownload={true}
                ></DocumentViewer>
              ) : (
                "-"
              )}
            </div>

            <div className="document-info">
              <span className="document-label">{t("sharedComponents.reviewPersonalInformation.documents.emiratesId")}</span>
              {ProfileInfoIndex?.emiratesIdCopyUrl ? (
                <DocumentViewer
                  key={ProfileInfoIndex?.emiratesIdCopyUrl}
                  fileName={ProfileInfoIndex?.emiratesIdCopyUrl}
                  hasDownload={true}
                ></DocumentViewer>
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>

      </div>
    );
  };
  const renderFields = () => {
    const profileType = ProfileInfoIndex?.type;

    if (profileType === 2) return renderUIDFields();
    if (profileType === 3) return renderPassportFields();
    return renderEmiratesIdFields();
  };
  return (
    <div className="ReviewPersonalInformation-section">
      {renderFields()}
    </div>
  );
}
