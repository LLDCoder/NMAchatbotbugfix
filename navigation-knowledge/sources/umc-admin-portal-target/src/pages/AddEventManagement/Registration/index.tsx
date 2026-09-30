import { Col, Form, Switch, Row, DatePicker, Input } from "antd";
import { type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { RegistProps, RegistrationPeriodFieldType } from "./type";
import "./index.less";
import moment from "moment";

export const Registration: FC<RegistProps> = ({ RegistrationForm }) => {
  const { t } = useTranslation();
  const onlineValue = Form.useWatch("online", RegistrationForm);

  const validateUrl = (_: any, value: string) => {
    if (!value || value.trim() === "") {
      return Promise.resolve();
    }

    const urlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;

    if (!urlPattern.test(value)) {
      return Promise.reject(
        new Error(
          t("CMS.addEventManagement.registration.validation.invalidUrl"),
        ),
      );
    }

    return Promise.resolve();
  };
  useEffect(() => {
    if (RegistrationForm && onlineValue === false) {
      RegistrationForm.setFieldValue("onlineURL", undefined);
    }
  }, [onlineValue, RegistrationForm]);
  return (
    <div>
      <Form<RegistrationPeriodFieldType>
        form={RegistrationForm}
        className="custom-form Registration-form"
        layout="vertical"
        initialValues={{
          online: false,
          onsite: false,
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="onsite"
              label={t("CMS.addEventManagement.registration.onSite")}
              className="registration-switch-item"
              valuePropName="checked"
            >
              <Switch className="registration-switch" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="online"
              label={t("CMS.addEventManagement.registration.online")}
              className="registration-switch-item"
              valuePropName="checked"
            >
              <Switch className="registration-switch" />
            </Form.Item>
          </Col>
          <Col span={12}></Col>
          {onlineValue && (
            <Col span={12}>
              <Form.Item
                name="onlineURL"
                label={t("CMS.addEventManagement.registration.onlineLink")}
                rules={[
                  { required: true, message: t("CMS.common.requiredField") },
                  { validator: validateUrl },
                ]}
              >
                <Input
                  placeholder={t(
                    "CMS.addEventManagement.registration.placeholders.onlineLink",
                  )}
                  className="search-input"
                />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </div>
  );
};
