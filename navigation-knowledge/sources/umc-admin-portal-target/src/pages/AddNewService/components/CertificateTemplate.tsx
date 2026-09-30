import { Card } from "antd";
import { useTranslation } from "react-i18next";
import type { ServiceCertificateTemplate } from "@/services/serviceApi";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { ImageBaseUrl } from "@/utils/url";
import zoomHandle from "../assets/certificate-template-zoom/handle.svg";
import zoomHorizontal from "../assets/certificate-template-zoom/horizontal.svg";
import zoomLens from "../assets/certificate-template-zoom/lens.svg";
import zoomVertical from "../assets/certificate-template-zoom/vertical.svg";

interface ICertificateTemplateProps {
  template: ServiceCertificateTemplate;
  selectedTemplate: number | null;
  onTemplateSelect: (templateId: number) => void;
  onTemplateZoom: (template: ServiceCertificateTemplate) => void;
}

export default function CertificateTemplate({
  template,
  selectedTemplate,
  onTemplateSelect,
  onTemplateZoom,
}: ICertificateTemplateProps) {
  const { i18n, t } = useTranslation();
  const templateName =
    i18n.resolvedLanguage === "en" ? template.nameEn : template.nameAr;
  const templateIcon = template.icon || "";
  const isSelected = selectedTemplate === template.id;

  return (
    <Card
      className={`certificate-template-card ${
        isSelected ? "certificate-template-card--selected" : ""
      }`}
      onClick={() => onTemplateSelect(template.id)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onTemplateSelect(template.id);
        }
      }}
    >
      {isSelected && templateIcon && (
        <button
          type="button"
          className="certificate-template-card__zoom-icon"
          aria-label={t("addNewService.certificateConfiguration.preview")}
          onClick={(event) => {
            event.stopPropagation();
            onTemplateZoom(template);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          <img
            src={zoomLens}
            alt=""
            className="certificate-template-card__zoom-lens"
          />
          <img
            src={zoomVertical}
            alt=""
            className="certificate-template-card__zoom-vertical"
          />
          <img
            src={zoomHorizontal}
            alt=""
            className="certificate-template-card__zoom-horizontal"
          />
          <img
            src={zoomHandle}
            alt=""
            className="certificate-template-card__zoom-handle"
          />
        </button>
      )}
      <div className="certificate-template-card__heading">
        <span className="certificate-template-card__name">
          {templateName}
        </span>
      </div>
      <div className="certificate-template-card__divider" />
      <div className="certificate-template-card__preview">
        <AuthenticatedDocumentImage
          src={ImageBaseUrl + encodeURIComponent(templateIcon)}
          alt={templateName}
          className="certificate-template-card__image"
        />
      </div>
    </Card>
  );
}
