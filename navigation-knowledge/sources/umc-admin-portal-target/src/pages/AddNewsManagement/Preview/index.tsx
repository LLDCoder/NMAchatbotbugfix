import React, { useEffect, useState } from "react";
import { Modal, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import moment from "moment";
import "./index.less";
import Instagram from "@/assets/images/InstagramGray.png";
import X from "@/assets/images/TwitterGray.png";
import Facebook from "@/assets/images/FacebookGray.png";
import { useTranslation } from "react-i18next";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { AuthenticatedDocumentHtml } from "@/components/common/AuthenticatedDocumentHtml";

interface PreviewProps {
  visible: boolean;
  onClose: () => void;
  data: {
    titleEn?: string;
    titleAr?: string;
    contentEn?: string;
    contentAr?: string;
    imageUrl?: string;
    publishTime?: any;
  };
}

export const Preview: React.FC<PreviewProps> = ({ visible, onClose, data }) => {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState<"en" | "ar">("en");

  useEffect(() => {
    if (visible) {
      const lang = i18n.language || "en";
      setLanguage(lang.startsWith("ar") ? "ar" : "en");
    }
  }, [visible, i18n.language]);

  const title = language === "en" ? data.titleEn : data.titleAr;
  const content = language === "en" ? data.contentEn : data.contentAr;

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
                {t("CMS.addNewsManagement.preview.english")}
              </Button>
              <Button
                type={language === "ar" ? "primary" : "default"}
                onClick={() => setLanguage("ar")}
              >
                {t("CMS.addNewsManagement.preview.arabic")}
              </Button>
            </div>
          </div>
          <div className="news-preview-content">
            <div className="news-preview-date">
              {data.publishTime && (
                <span className="glodspan" dir="ltr">
                  {moment(data.publishTime).format(" DD MMM YYYY")}
                </span>
              )}
              <div className="share-content">
                <span>{t("CMS.addNewsManagement.preview.share")}</span>
                <img src={Facebook} alt={t("CMS.addNewsManagement.preview.facebookAlt")} />
                <img src={X} alt={t("CMS.addNewsManagement.preview.xAlt")} />
                <img src={Instagram} alt={t("CMS.addNewsManagement.preview.instagramAlt")} />
              </div>
            </div>
            <h1 className="news-preview-title">{title || "-"}</h1>

            <div className="news-preview-image">
              {data.imageUrl ? (
                <AuthenticatedDocumentImage
                  src={data.imageUrl}
                  alt={t("CMS.addNewsManagement.preview.imageAlt")}
                />
              ) : (
                <div className="image-placeholder">
                  <span>{t("CMS.addNewsManagement.preview.noImage")}</span>
                </div>
              )}
            </div>

            <AuthenticatedDocumentHtml
              className="news-preview-text"
              html={content || "-"}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
