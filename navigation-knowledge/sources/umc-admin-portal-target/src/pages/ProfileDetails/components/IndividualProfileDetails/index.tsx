import React, { useMemo } from "react";
import { Empty } from "antd";
import DetailSection from "../DetailSection";
import InfoGrid from "../InfoGrid";
import ProfileDetailSummary from "../ProfileDetailSummary";
import type { IndividualProfileDetailsProps } from "./type";
import {
  buildDocuments,
  buildPersonalAddressItems,
  buildPersonalInfoItems,
  renderPersonalDocument,
} from "./utils";

const IndividualProfileDetails: React.FC<IndividualProfileDetailsProps> = ({
  data,
  summaryItems,
  applicationTitle,
  showRejectReason,
  rejectReason,
  preferAr,
  t,
}) => {
  const personalInfo = useMemo(
    () => buildPersonalInfoItems(data?.personal, t, preferAr),
    [data?.personal, preferAr, t],
  );
  const addressInfo = useMemo(
    () => buildPersonalAddressItems(data?.addressInfo, t, preferAr),
    [data?.addressInfo, preferAr, t],
  );
  const documents = useMemo(
    () => buildDocuments(data?.personDocmentInfo),
    [data?.personDocmentInfo],
  );

  return (
    <>
      <ProfileDetailSummary
        title={applicationTitle}
        tag={t("Profile.details.document.fromWeb")}
        showRejectReason={showRejectReason}
        rejectReason={rejectReason}
        summaryItems={summaryItems}
      />
      <div className="detail-sections">
        <DetailSection title={t("Profile.details.section.personalInformation")}>
          {personalInfo.length ? (
            <InfoGrid items={personalInfo} columns={3} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Profile.details.empty.noPersonalInformation")}
            />
          )}
        </DetailSection>

        <DetailSection title={t("Profile.details.section.addressInformation")}>
          {addressInfo.length > 0 ? (
            <InfoGrid items={addressInfo} columns={3} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Profile.details.empty.noAddressInformation")}
            />
          )}
        </DetailSection>

        <DetailSection title={t("Profile.details.section.personalDocuments")}>
          {documents.length > 0 ? (
            <div className="document-viewer-list">
              {documents.map((doc) => renderPersonalDocument(doc, t))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Profile.details.empty.noDocuments")}
            />
          )}
        </DetailSection>
      </div>
    </>
  );
};

export default IndividualProfileDetails;
