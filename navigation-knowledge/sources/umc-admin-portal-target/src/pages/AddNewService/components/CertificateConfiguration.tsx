import React, { useState, useEffect, useImperativeHandle, useRef } from "react";
import { Input, Select, Switch, Form, Card, Modal, Spin } from "antd";
import { useTranslation } from "react-i18next";
import type { FormInstance } from "antd";
import { getServiceCertificateTemplate } from "@/services/serviceApi";
import type { ServiceCertificateTemplate } from "@/services/serviceApi";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { ImageBaseUrl } from "@/utils/url";
import CertificateTemplate from "./CertificateTemplate";
import "./CertificateConfiguration.less";

const { Option } = Select;

interface CertificateConfigurationProps {
  form: FormInstance;
  isUnifiedExpiry?: boolean | null;
  onDirtyChange?: (dirty: boolean) => void;
}
export interface ICertificateConfigurationRefProps{
  getData: () => {
    isUnifiedExpiry: boolean;
    status: string;
  };
  hasTemplate: () => boolean;
}

const getCertificateFormEnabled = (value?: boolean | null) => value !== false;

const CertificateConfiguration: React.RefForwardingComponent<ICertificateConfigurationRefProps, CertificateConfigurationProps> = ({
  form,
  isUnifiedExpiry,
  onDirtyChange,
}, ref) => {
  const { t, i18n } = useTranslation();
  const [certificateFormEnabled, setCertificateFormEnabled] = useState(() =>
    getCertificateFormEnabled(isUnifiedExpiry),
  );
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [zoomedTemplate, setZoomedTemplate] = useState<ServiceCertificateTemplate | null>(null);
  const [certificateTemplates, setCertificateTemplates] = useState<ServiceCertificateTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const initRef = useRef<boolean>(false);
  const [,update] = useState({});
  useEffect(() => {
    fetchCertificateTemplates();
  }, []);

  useEffect(() => {
    setCertificateFormEnabled(getCertificateFormEnabled(isUnifiedExpiry));
  }, [isUnifiedExpiry]);

  useEffect(()=>{
    initRef.current = true;
    setSelectedTemplate(form.getFieldValue('templateId'));
  },[form.getFieldValue('templateId')])
  const fetchCertificateTemplates = async () => {
    try {
      setLoading(true);
      const response = await getServiceCertificateTemplate();
      const templates = Array.isArray(response) ? response : response?.data || [];
      setCertificateTemplates(templates);
      if (templates.length > 0 && selectedTemplate === null && !initRef.current) {
        setSelectedTemplate(templates[0].id);
        form.setFieldsValue({ templateId: templates[0].id });
      }
      
      console.log("Certificate Templates:", templates);
    } catch (error) {
      console.error("Failed to fetch certificate templates:", error);
      setCertificateTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: number) => {
    setSelectedTemplate(templateId);
    form.setFieldsValue({ templateId });
    onDirtyChange?.(true);
  };

  const handleTemplateZoom = (template: ServiceCertificateTemplate) => {
    setZoomedTemplate(template);
  };

  // 
  const certificateFields = [
    { value: "issue_date", label: "{{issue_date}}" },
    { value: "expiry_date", label: "{{expiry_date}}" },
    { value: "certificate_id", label: "{{certificate_id}}" },
    { value: "applicant_name", label: "{{applicant_name}}" }
  ];

  const formFields = [
    {
      value: "photography_start_date",
      label: t("addNewService.certificateConfiguration.formFields.photographyStartingDate"),
    },
    {
      value: "application_date",
      label: t("addNewService.certificateConfiguration.formFields.applicationDate"),
    },
    {
      value: "approval_date",
      label: t("addNewService.certificateConfiguration.formFields.approvalDate"),
    },
    {
      value: "full_name",
      label: t("addNewService.certificateConfiguration.formFields.fullName"),
    }
  ];

  const validityPeriodOptions = [
    {
      value: "custom",
      label: t("addNewService.certificateConfiguration.validityOptions.custom"),
    },
    {
      value: "1year",
      label: t("addNewService.certificateConfiguration.validityOptions.oneYear"),
    },
    {
      value: "2years",
      label: t("addNewService.certificateConfiguration.validityOptions.twoYears"),
    },
    {
      value: "3years",
      label: t("addNewService.certificateConfiguration.validityOptions.threeYears"),
    },
    {
      value: "5years",
      label: t("addNewService.certificateConfiguration.validityOptions.fiveYears"),
    },
    {
      value: "permanent",
      label: t("addNewService.certificateConfiguration.validityOptions.permanent"),
    },
  ];

  const certificateNameEnRules = certificateFormEnabled
    ? [{ required: true, message: t("addNewService.certificateConfiguration.validation.nameInEnglish")}]
    : [];
  const certificateNameArRules = certificateFormEnabled
    ? [{ required: true, message:t("addNewService.certificateConfiguration.validation.nameInArabic")}]
    : [];
  const fieldMappingRequiredRules = certificateFormEnabled
    ? [{ required: true }]
    : [];
  const certificateFormClassName = certificateFormEnabled
    ? "certificate-form"
    : "certificate-form certificate-form-glass";

  useEffect(() => {
    if (certificateFormEnabled) {
      return;
    }

    form.setFields([
      { name: "cNameEn", errors: [] },
      { name: "cNameAr", errors: [] },
      { name: "validityPeriod", errors: [] },
      { name: "certificateField1", errors: [] },
      { name: "formField1", errors: [] },
    ]);
  }, [certificateFormEnabled, form]);

  useImperativeHandle(ref, () => ({
    getData: () => {
      return {
        isUnifiedExpiry: certificateFormEnabled,
        status: 'INACTIVE'
      };
    },
    hasTemplate: () => certificateTemplates.length > 0,
  }));

  return (
    <div className="tab-content certificate-configuration-container">
      <Card className="certificate-header-card">
        <div className="certificate-header">
          <div className="certificate-configuration-container__header-copy">
            <h3 className="section-title">
              {t("addNewService.certificateConfiguration.title")}
            </h3>
            <p className="section-subtitle">
              {t("addNewService.certificateConfiguration.subtitle")}
            </p>
          </div>
          <Switch
            checked={certificateFormEnabled}
            onChange={(checked) => {
              setCertificateFormEnabled(checked);
              onDirtyChange?.(true);
            }}
            className="auto-generate-switch"
          />
        </div>
      </Card>

      <Form
        form={form}
        layout="vertical"
        className={certificateFormClassName}
        disabled={!certificateFormEnabled}
        onValuesChange={() => {
          onDirtyChange?.(true);
          update({});
        }}
      >
        <Form.Item name="templateId" hidden>
          <Input />
        </Form.Item>

        <Card className="template-section-card">
          <div className="certificate-configuration-container__template-header">
            <h4 className="subsection-title">
              {t("addNewService.certificateConfiguration.selectTemplate")}
            </h4>
          </div>
          {loading ? (
            <div className="certificate-configuration-container__template-loading">
              <Spin size="large" />
            </div>
          ) : (
            <div className="template-grid">
              {certificateTemplates.map((template) => (
                <CertificateTemplate
                  key={template.id}
                  template={template}
                  selectedTemplate={selectedTemplate}
                  onTemplateSelect={handleTemplateSelect}
                  onTemplateZoom={handleTemplateZoom}
                />
              ))}
            </div>
          )}
          <Card className="basic-config-card">
            <div className="certificate-configuration-container__basic-header">
              <h4 className="subsection-title">
                {t("addNewService.certificateConfiguration.basicConfig")}
              </h4>
            </div>

            <div className="certificate-configuration-container__basic-body">
              <div className="basic-config-card-block">
                <Form.Item
                  name="cNameEn"
                  className="certificateNameEn"
                  label={t("addNewService.certificateConfiguration.nameInEnglish")}
                  rules={certificateNameEnRules}
                >
                  <Input
                    placeholder={t(
                      "addNewService.certificateConfiguration.placeholders.nameInEnglish",
                    )}
                  />
                </Form.Item>
                <Form.Item
                  name="cNameAr"
                  className="certificateNameAr"
                  label={t("addNewService.certificateConfiguration.nameInArabic")}
                  rules={certificateNameArRules}
                >
                  <Input
                    className="certificate-name-ar-input"
                    dir="rtl"
                    placeholder={t(
                      "addNewService.certificateConfiguration.placeholders.nameInArabic",
                    )}
                  />
                </Form.Item>
              </div>

              {form.getFieldValue("validityPeriod") === "custom" && (
                <div className="field-mapping-section">
                  <h5 className="mapping-title">
                    {t("addNewService.certificateConfiguration.fieldMapping")}
                  </h5>

                  <div className="field-mapping-section-blocks">
                    <div className="field-mapping-section-block">
                      <Form.Item
                        name="certificateField1"
                        label={t(
                          "addNewService.certificateConfiguration.certificateField",
                        )}
                        rules={fieldMappingRequiredRules}
                      >
                        <Select placeholder="{{issue_date}}">
                          {certificateFields.map((field) => (
                            <Option key={field.value} value={field.value}>
                              {field.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Form.Item
                        name="certificateField2"
                        label={t(
                          "addNewService.certificateConfiguration.certificateField",
                        )}
                      >
                        <Select placeholder="{{issue_date}}">
                          {certificateFields.map((field) => (
                            <Option key={field.value} value={field.value}>
                              {field.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </div>

                    <div className="field-mapping-section-block">
                      <Form.Item
                        name="formField1"
                        label={t(
                          "addNewService.certificateConfiguration.formField",
                        )}
                        rules={fieldMappingRequiredRules}
                      >
                        <Select
                          placeholder={t(
                            "addNewService.certificateConfiguration.formFields.photographyStartingDate",
                          )}
                        >
                          {formFields.map((field) => (
                            <Option key={field.value} value={field.value}>
                              {field.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Form.Item
                        name="formField2"
                        label={t(
                          "addNewService.certificateConfiguration.formField",
                        )}
                      >
                        <Select
                          placeholder={t(
                            "addNewService.certificateConfiguration.formFields.photographyStartingDate",
                          )}
                        >
                          {formFields.map((field) => (
                            <Option key={field.value} value={field.value}>
                              {field.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

        </Card>
      </Form>

      <Modal
        className="certificate-configuration-container__template-modal"
        visible={!!zoomedTemplate}
        title={
          zoomedTemplate
            ? i18n.resolvedLanguage === "en"
              ? zoomedTemplate.nameEn
              : zoomedTemplate.nameAr
            : undefined
        }
        footer={null}
        centered
        width="min(1040px, calc(100vw - 32px))"
        destroyOnClose
        onCancel={() => setZoomedTemplate(null)}
      >
        {zoomedTemplate?.icon && (
          <AuthenticatedDocumentImage
            src={ImageBaseUrl + encodeURIComponent(zoomedTemplate.icon)}
            alt={
              i18n.resolvedLanguage === "en"
                ? zoomedTemplate.nameEn
                : zoomedTemplate.nameAr
            }
            className="certificate-configuration-container__template-modal-image"
          />
        )}
      </Modal>
    </div>
  );
};

export default React.forwardRef(CertificateConfiguration);
