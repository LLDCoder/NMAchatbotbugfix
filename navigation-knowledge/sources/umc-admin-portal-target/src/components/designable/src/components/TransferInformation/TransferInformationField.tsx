/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { observer, useField } from "@formily/react";
import { Input, Row, Col, Card as AntdCard, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import "./styles.less";

const { TextArea } = Input;

type TransferInformationValue = {
  powerOfAttorney?: any;
  initialApprovalDocument?: any;
  transferReason?: string;
};

export const TransferInformationField: React.FC<any> = observer((props) => {
  const field = useField<any>();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const current: TransferInformationValue = field.value || {};
  const { disabled = false } = props;
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tf = React.useCallback(
    (key: string) =>
      String(
        i18n.t(`TransferInformation.${key}`, {
          lng: previewLang,
        })
      ),
    [previewLang]
  );

  const handleFieldChange = (key: string, value: any) => {
    const newValue = {
      ...current,
      [key]: value,
    };
    field.setValue(newValue);
  };

  const renderLabel = (label: string, required: boolean = true, tooltip?: string) => (
    <div className="transfer-info-label">
      <span>
        {label}
        {required && <span className="transfer-info-required">*</span>}
      </span>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="transfer-info-tooltip-icon" />
        </Tooltip>
      )}
    </div>
  );

  const renderUpload = (
    name: string,
    label: string,
    tooltip?: string
  ) => {
    return (
      <div className="transfer-info-field">
        {renderLabel(label, true, tooltip)}
        <DocumentViewer
          hasDelete={true}
          disabled={disabled}
          value={current[name as keyof TransferInformationValue]}
          onChange={(value) => handleFieldChange(name, value)}
          uploadConfig={{
            maxCount: 1,
            maxSize: 5,
            uploadTip: tf("uploadTip"),
            accept: ".pdf",
            placeholder: tf("uploadPlaceholder"),
          }}
        />
      </div>
    );
  };

  return (
    <div className="transfer-info-container" {...props}>
      <AntdCard className="transfer-info-card" title={tf("defaultCardTitle")}>
        <Row gutter={24}>
          <Col span={12}>
            {renderUpload(
              "powerOfAttorney",
              tf("labelPowerOfAttorney"),
              tf("tooltipPowerOfAttorney")
            )}
          </Col>
          <Col span={12}>
            {renderUpload(
              "initialApprovalDocument",
              tf("labelInitialApprovalDocument"),
              tf("tooltipInitialApprovalDocument")
            )}
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={24}>
            <div className="transfer-info-field">
              {renderLabel(tf("labelTransferReason"), true)}
              <TextArea
                disabled={disabled}
                placeholder={tf("placeholderEnter")}
                value={current.transferReason || ""}
                maxLength={1000}
                rows={4}
                showCount
                onChange={(e) => handleFieldChange("transferReason", e.target.value)}
                className="transfer-info-textarea"
              />
            </div>
          </Col>
        </Row>
      </AntdCard>
    </div>
  );
});

TransferInformationField.displayName = "TransferInformationField";

export default TransferInformationField;
