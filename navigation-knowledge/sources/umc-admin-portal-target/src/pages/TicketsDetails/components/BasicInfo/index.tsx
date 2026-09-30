import DocumentViewer from "@/components/common/DocumentViewer";
import "./index.less";
import type { IEnquiryInfoResponse } from "@/services/tickets";
import { useTranslation } from "react-i18next";
import { Tooltip } from "antd";
import { useHistory } from "react-router-dom";
import { navigateToTicketApplicationDetails } from "@/pages/Tickets/utils/applicationDetailsNavigation";

export default function BasicInfo({
  details,
}: {
  details: IEnquiryInfoResponse;
}) {
  const history = useHistory();
  const { i18n, t } = useTranslation();
  return (
    <div className="tickets-details-basic-info">
      <div className="tickets-details-section-title">
        {t("Customer.ticketsDetails.basicInfo.title")}
      </div>
      <div className="tickets-details-basic-items">
        <div className="tickets-details-basic-item">
          <div className="tickets-details-basic-field">
            {t("Customer.ticketsDetails.basicInfo.enquirySource")}
          </div>
          <div className="tickets-details-basic-value">
            {i18n.resolvedLanguage === "ar"
              ? details?.enquirySoruceObj?.nameAr || "-"
              : details?.enquirySoruceObj?.nameEn || "-"}
          </div>
        </div>
        <div className="tickets-details-basic-item">
          <div className="tickets-details-basic-field">
            {t("Customer.ticketsDetails.basicInfo.applicationNumber")}
          </div>
          <div
            className="tickets-details-basic-value tickets-details-basic-appnum cursor-box"
            onClick={async () => {
              await navigateToTicketApplicationDetails(
                history,
                details?.applicationNo,
              );
            }}
          >
            {details?.applicationNo ? details?.applicationNo : "-"}
          </div>
        </div>
        <div className="tickets-details-basic-item">
          <div className="tickets-details-basic-field">
            {t("Customer.ticketsDetails.basicInfo.serviceName")}
          </div>
          <div className="tickets-details-basic-value">
            {i18n.resolvedLanguage === "ar"
              ? details?.serviceObj?.nameAr || "-"
              : details?.serviceObj?.nameEn || "-"}
          </div>
        </div>
        <div className="tickets-details-basic-item">
          <div className="tickets-details-basic-field">
            {t("Customer.ticketsDetails.basicInfo.problemDescription")}
          </div>
          <div className="tickets-details-basic-value tickets-details-basic-field-desc-no-hidden">
            {details?.description ? details?.description : "-"}
          </div>
          {/* <Tooltip title={details?.description}>
                </Tooltip> */}
        </div>
        <div className="tickets-details-basic-item tickets-details-basic-attachments">
          <div className="tickets-details-basic-field">
            {t("Customer.ticketsDetails.basicInfo.attachments")}
          </div>
          <div className="tickets-details-basic-value">
            {!!details?.attachmentUrls?.length
              ? details?.attachmentUrls?.map((url) => (
                  <DocumentViewer fileName={url} hasDownload />
                ))
              : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
