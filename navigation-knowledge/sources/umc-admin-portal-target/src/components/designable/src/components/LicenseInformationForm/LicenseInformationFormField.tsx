/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { observer, useField } from "@formily/react";
import { Input, Row, Col, Card as AntdCard } from "antd";
import { useTranslation } from "react-i18next";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import "./styles.less";

type LicenseInformationFormValue = {
  licenseName?: string;
  licenseNumber?: string;
  expiryDate?: string;
};

const MOCK_LICENSE_DATA: LicenseInformationFormValue = {
  licenseName: "Media License",
  licenseNumber: "ML-2025-00001234",
  expiryDate: "22/05/2025",
};

export const LicenseInformationFormField: React.FC<any> = observer((props) => {
  const field = useField<any>();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const isReadPretty = field.pattern === "readPretty";
  const current: LicenseInformationFormValue =
    field.value || (isReadPretty ? {} : MOCK_LICENSE_DATA);
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tf = React.useCallback(
    (key: string) =>
      String(
        i18n.t(`LicenseInformationForm.${key}`, {
          lng: previewLang,
        }),
      ),
    [previewLang],
  );

  React.useEffect(() => {
    if (!isReadPretty && !field.value) {
      field.setValue(MOCK_LICENSE_DATA);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize mock readonly data once when the field has no saved value
  }, []);

  const renderLabel = (label: string) => (
    <div className="license-info-form-label">
      <span>{label}</span>
    </div>
  );

  const renderTextDisplay = (value: string | undefined) => {
    return (
      <Input
        disabled
        value={value || ""}
        className="license-info-form-readonly"
      />
    );
  };

  return (
    <div className="license-info-form-container" {...props}>
      <AntdCard className="license-info-form-card" title={tf("defaultCardTitle")}>
        <Row gutter={24}>
          <Col span={12}>
            <div className="license-info-form-field">
              {renderLabel(tf("labelLicenseName"))}
              {renderTextDisplay(current.licenseName)}
            </div>
          </Col>
          <Col span={12}>
            <div className="license-info-form-field">
              {renderLabel(tf("labelLicenseNumber"))}
              {renderTextDisplay(current.licenseNumber)}
            </div>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={12}>
            <div className="license-info-form-field">
              {renderLabel(tf("labelExpiryDate"))}
              {renderTextDisplay(current.expiryDate)}
            </div>
          </Col>
          <Col span={12} />
        </Row>
      </AntdCard>
    </div>
  );
});

LicenseInformationFormField.displayName = "LicenseInformationFormField";

export default LicenseInformationFormField;
