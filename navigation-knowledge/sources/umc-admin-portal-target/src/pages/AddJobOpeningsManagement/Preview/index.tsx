import React, { useState } from "react";
import { Modal, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import moment from "moment";
import { useTranslation } from "react-i18next";
import "./index.less";
import MapPin from "@/assets/images/MapPin.svg";
import PositionIcon from "@/assets/images/PositionIcon.png";
import ClockIcon from "@/assets/images/ClockIcon.png";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
interface PreviewProps {
  visible: boolean;
  onClose: () => void;
  data: {
    contentEn?: string;
    contentAr?: string;
    jobTitleEn?: string;
    jobTitleAr?: string;
    jobTypes?: string;
    applicationDeadline?: string;
    emirateId?: number;
    emirateName?: string;
  };
}

export const Preview: React.FC<PreviewProps> = ({ visible, onClose, data }) => {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const { t } = useTranslation();

  const title = language === "en" ? data.jobTitleEn : data.jobTitleAr;
  const content = language === "en" ? data.contentEn : data.contentAr;
  const currentDate = moment().format("DD MMMM YYYY");
  // console.log(data);

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      width="100%"
      style={{ top: 0, paddingBottom: 0 }}
      wrapClassName="news-preview-modal"
    >
      <div className="news-preview-container">
        <div className="news-preview-header">
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="close-button"
          />
        </div>
        <div
          className={
            language === "ar" ? "preview-content ar" : "preview-content"
          }
        >
          <div className="language-switcher">
            <div className="btnList">
              <Button
                type={language === "en" ? "primary" : "default"}
                onClick={() => setLanguage("en")}
              >
                {t("CMS.common.english")}
              </Button>
              <Button
                type={language === "ar" ? "primary" : "default"}
                onClick={() => setLanguage("ar")}
              >
                {t("CMS.common.arabic")}
              </Button>
            </div>
          </div>
          <div className="news-preview-content">
            <div className="news-preview-title">
              <span className="job-title">{title || "-"}</span>
              <span className="job-type-badge">
                {data.jobTypes == "2"
                  ? t("CMS.jobOpeningsManagement.jobTypes.internship")
                  : t("CMS.jobOpeningsManagement.jobTypes.fullTime")}
              </span>
            </div>
            <div className="news-preview-description">
              <div className="description-item">
                <img
                  src={PositionIcon}
                  alt={t("CMS.jobOpeningsManagement.preview.mapPinAlt")}
                />
                <span>{data.emirateName || data.emirateId}</span>{" "}
              </div>
              <div className="description-item ClockIcon">
                <img
                  src={ClockIcon}
                  alt={t("CMS.jobOpeningsManagement.preview.clockAlt")}
                />
                <span>{currentDate}</span>
              </div>
            </div>
            <div className="baseLine"></div>
            {/* <div className="news-preview-date">{}</div> */}

            <div
              className="news-preview-text"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(content || "-"),
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
