import React, { useMemo } from "react";
import { Empty } from "antd";
import DetailSection from "../DetailSection";
import InfoGrid from "../InfoGrid";
import ProfileDetailSummary from "../ProfileDetailSummary";
import EstablishmentDocuments from "../EstablishmentDocuments";
import PartnerList from "../PartnerList";
import type { OrganizationProfileDetailsProps } from "./type";
import {
  buildEstablishmentInfoItems,
  buildOrganizationAddressItems,
  buildPartnerList,
} from "./utils";

const OrganizationProfileDetails: React.FC<OrganizationProfileDetailsProps> = ({
  data,
  viewType,
  summaryItems,
  applicationTitle,
  establishmentOverviewTitle,
  showRejectReason,
  rejectReason,
  preferAr,
  t,
  i18n,
  partnerDetailsPermissionCode,
  partnerDetailsPermissionRoutePath,
}) => {
  const establishmentInfo = useMemo(
    () => buildEstablishmentInfoItems(data?.establishment, viewType, t, preferAr),
    [data?.establishment, preferAr, t, viewType],
  );
  const addressInfo = useMemo(
    () => buildOrganizationAddressItems(data?.addressInfo, t, preferAr),
    [data?.addressInfo, preferAr, t],
  );
  const partnerList = useMemo(
    () => buildPartnerList(data?.partnerList, i18n),
    [data?.partnerList, i18n],
  );
  const isEgaming = viewType === "egaming";

  return (
    <>
      <ProfileDetailSummary
        title={applicationTitle}
        tag={t("Profile.details.document.fromWeb")}
        summaryItems={summaryItems}
        showRejectReason={showRejectReason}
        rejectReason={rejectReason}
      />
      <div className="detail-sections">
        <DetailSection title={establishmentOverviewTitle}>
          {establishmentInfo.length ? (
            <InfoGrid items={establishmentInfo} columns={3} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Profile.details.empty.noEstablishmentInformation")}
            />
          )}
        </DetailSection>

        {!isEgaming && (
          <DetailSection title={t("Profile.details.section.establishmentDocuments")}>
            <EstablishmentDocuments
              documentInfo={data?.documentInfo}
              establishment={data?.establishment}
              t={t}
            />
          </DetailSection>
        )}

        {!isEgaming && (
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
        )}

        {viewType === "commercial" && (
          <PartnerList
            params={partnerList}
            detailsPermissionCode={partnerDetailsPermissionCode}
            detailsPermissionRoutePath={partnerDetailsPermissionRoutePath}
          />
        )}
      </div>
    </>
  );
};

export default OrganizationProfileDetails;
