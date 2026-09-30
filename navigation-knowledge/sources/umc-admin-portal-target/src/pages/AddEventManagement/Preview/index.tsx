import React, { useState } from "react";
import { Modal, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import type { Moment } from "moment";
import "./index.less";
import Instagram from "@/assets/images/InstagramGray.png";
import MapPin from "@/assets/images/MapPin.svg";
import X from "@/assets/images/TwitterGray.png";
import UpArrow from "@/assets/images/UpArrow.png";
import Facebook from "@/assets/images/FacebookGray.png";
import { useTranslation } from "react-i18next";
import { formatLocalizedDate } from "@/utils/dateLocale";
import { openIsolatedBlankUrl } from "@/utils/openIsolatedBlankUrl";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { AuthenticatedDocumentHtml } from "@/components/common/AuthenticatedDocumentHtml";

type PreviewLanguage = "en" | "ar";
type PreviewPublishTime = [string | Date | Moment | null, string | Date | Moment | null];

interface PreviewData {
  titleEn?: string;
  titleAr?: string;
  contentEn?: string;
  contentAr?: string;
  imageUrl?: string;
  publishTime?: PreviewPublishTime | null;
  emirateName: string | undefined;
  emirateNameAr?: string | undefined;
  regionName: string | undefined;
  regionNameAr?: string | undefined;
  areaName: string | undefined;
  areaNameAr?: string | undefined;
  streetName: string | undefined;
  streetNameAr?: string | undefined;
  emirateId: number | undefined;
  online: boolean;
  onsite: boolean;
  onlineURL: string | undefined;
}

interface PreviewProps {
  visible: boolean;
  onClose: () => void;
  data: PreviewData;
}

function pickLocalizedName(
  language: PreviewLanguage,
  en?: string,
  ar?: string,
): string {
  if (language === "ar") {
    return ar || en || "";
  }
  return en || ar || "";
}

function buildEventAddress(language: PreviewLanguage, data: PreviewData): string {
  const street = pickLocalizedName(language, data.streetName, data.streetNameAr);
  const area = pickLocalizedName(language, data.areaName, data.areaNameAr);
  const region = pickLocalizedName(language, data.regionName, data.regionNameAr);
  const emirate = pickLocalizedName(language, data.emirateName, data.emirateNameAr);

  const parts: string[] = [];
  if (street) {
    parts.push(street);
  }
  if (area) {
    parts.push(area);
  }
  if (data.emirateId == 1 && region) {
    parts.push(region);
  }
  if (emirate) {
    parts.push(emirate);
  }

  return parts.join("-");
}

export const Preview: React.FC<PreviewProps> = ({ visible, onClose, data }) => {
  const [language, setLanguage] = useState<PreviewLanguage>("en");
  const { t } = useTranslation();
  const title = language === "en" ? data.titleEn : data.titleAr;
  const content = language === "en" ? data.contentEn : data.contentAr;
  const address = buildEventAddress(language, data);

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      width="100%"
      style={{ top: 0, paddingBottom: 0 }}
      wrapClassName="event-preview-modal"
    >
      <div className="event-preview-container">
        <div className="event-preview-header">
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="close-button"
          />
        </div>
        <div className="preview-content">
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
                عربي
              </Button>
            </div>
          </div>
          <div
            className={
              language === "en"
                ? "event-preview-content"
                : "event-preview-content ar"
            }
          >
            <div className="event-preview-flex">
              <div className="event-preview-flex">
                {data.publishTime && (
                  <span className="glodspan" dir="ltr">
                    {formatLocalizedDate(data.publishTime[0], language, " DD MMM YYYY")}
                    -
                    {formatLocalizedDate(data.publishTime[1], language, " DD MMM YYYY")}
                  </span>
                )}
              </div>
              <div className="event-preview-date">
                <div className="share-content">
                  <span>{t("CMS.addEventManagement.preview.shareOn", { lng: "en" })}</span>
                  <img src={Facebook} alt="" />
                  <img src={X} alt="" />
                  <img src={Instagram} alt="" />
                </div>
              </div>
            </div>
            <h1 className="event-preview-title">{title || "-"}</h1>
            <div className="address flex">
              <div className="position flex">
                <img src={MapPin} className="MapPin" alt="" />
                <span className="text-ellipsis" title={address}>
                  {address}
                </span>
              </div>
            </div>
            <div className="event-preview-image">
              {data.imageUrl ? (
                <AuthenticatedDocumentImage
                  src={data.imageUrl}
                  alt={t("CMS.addEventManagement.preview.imageAlt", { lng: language })}
                />
              ) : (
                <div className="image-placeholder">
                  <span>{t("CMS.addEventManagement.preview.noImage")}</span>
                </div>
              )}
            </div>

            <AuthenticatedDocumentHtml
              className="event-preview-text"
              html={content || "-"}
            />
          </div>
          <div className="event-preview-footer">
            {data.online && (
              <div
                className="event-preview-btn"
                onClick={() => {
                  if (!data.onlineURL) {
                    return;
                  }

                  openIsolatedBlankUrl(data.onlineURL);
                }}
              >
                <span>
                  {language === "en"
                    ? t("CMS.addEventManagement.preview.registerOnlineEn")
                    : t("CMS.addEventManagement.preview.registerOnlineAr" , { lng: "ar" })}
                </span>
                <img src={UpArrow} className="UpArrow" alt="" />
              </div>
            )}
            {data.onsite && (
              <p>
                {language === "en"
                  ? t("CMS.addEventManagement.preview.onSiteAvailableEn")
                  : t("CMS.addEventManagement.preview.onSiteAvailableAr" , { lng: "ar" })}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
