import { Col, Form, Input, Row, Tooltip } from "antd";
import { type FC } from "react";
import type { IProps, ISEOFieldType } from "./type";
import { useTranslation } from "react-i18next";
import Doubt from "@/assets/images/doubt.svg";
import "./index.less";

const renderSeoFieldLabel = (label: string, tooltip: string) => (
  <span className="seo-field-label">
    <span>{label}</span>
    <Tooltip
      title={tooltip}
      placement="topLeft"
      overlayClassName="seo-form-tooltip"
      getPopupContainer={() => document.body}
    >
      <img src={Doubt} alt="" className="seo-field-label__icon" />
    </Tooltip>
  </span>
);

export const SEO: FC<IProps> = ({ seoForm }) => {
  const { t } = useTranslation();

  return (
    <div>
      <Form<ISEOFieldType>
        form={seoForm}
        className="custom-form seo-form"
        layout="vertical"
      >
        {/* first row */}
        <Row gutter={16}>
          {/* first column */}
          <Col span={24}>
            <Form.Item
              name="seotitle"
              label={renderSeoFieldLabel(
                t("CMS.addNewsManagement.seo.metaTitle"),
                t("CMS.addNewsManagement.seo.metaTitleHelperTooltip"),
              )}
            >
              <Input placeholder={t("CMS.addNewsManagement.seo.metaTitlePlaceholder")} maxLength={200} className="search-input" />
            </Form.Item>
          </Col>
        </Row>

        {/* second row */}
        <Row gutter={16}>
          {/* first column */}
          <Col span={12}>
            <Form.Item
              name="seodescription"
              label={renderSeoFieldLabel(
                t("CMS.addNewsManagement.seo.metaDescription"),
                t("CMS.addNewsManagement.seo.metaDescriptionTooltip"),
              )}
            >
              <Input.TextArea
                placeholder={t("CMS.addNewsManagement.seo.metaDescriptionPlaceholder")}
                maxLength={1000}
                showCount
                rows={4}
                className="seo-textarea"
              />
            </Form.Item>
          </Col>

          {/* second column */}
          <Col span={12}>
            <Form.Item
              name="seokeyWords"
              label={renderSeoFieldLabel(
                t("CMS.addNewsManagement.seo.metaKeywords"),
                t("CMS.addNewsManagement.seo.metaKeywordsTooltip"),
              )}
            >
              <Input.TextArea
                placeholder={t("CMS.addNewsManagement.seo.metaKeywordsPlaceholder")}
                maxLength={500}
                showCount
                className="seo-textarea"
                rows={4}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
