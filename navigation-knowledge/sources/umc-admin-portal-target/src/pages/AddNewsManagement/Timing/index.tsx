import { Col, Form, Radio, Row, DatePicker } from "antd";
import { type FC } from "react";
import type { IProps, ITimingFieldType } from "./type";
import "./index.less";
import moment from "moment";
import { useTranslation } from "react-i18next";

export const Timing: FC<IProps> = ({ timingForm }) => {
  const { t } = useTranslation();
  const publishType = Form.useWatch("publishType", timingForm);

  // Custom validator for scheduled time
  const validateScheduledTime = (_: any, value: any) => {
    if (!value) {
      return Promise.reject(new Error(t("CMS.addNewsManagement.validation.fieldRequired")));
    }
    const now = moment();
    const selectedTime = moment(value);
    if (selectedTime.isBefore(now) || selectedTime.isSame(now)) {
      return Promise.reject(
        new Error(t("CMS.addNewsManagement.timing.scheduledTimeError"))
      );
    }
    return Promise.resolve();
  };

  return (
    <div>
      <Form<ITimingFieldType>
        form={timingForm}
        className="custom-form timing-form"
        layout="vertical"
        initialValues={{
          publishType: '1',
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="publishType"
              label={t("CMS.addNewsManagement.timing.publishMethod")}
              rules={[{ required: true, message: t("CMS.addNewsManagement.validation.fieldRequired") }]}
            >
              <Radio.Group>
                <Radio value={'1'}>{t("CMS.addNewsManagement.timing.publishNow")}</Radio>
                <Radio value={'2'}>{t("CMS.addNewsManagement.timing.scheduled")}</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>

          {publishType === '2' && (
            <Col span={12}>
              <Form.Item
                name="publishTime"
                label={t("CMS.addNewsManagement.timing.scheduledTime")}
                rules={[
                  { required: true, message: t("CMS.addNewsManagement.validation.fieldRequired") },
                  { validator: validateScheduledTime },
                ]}
              >
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  placeholder={t("CMS.addNewsManagement.timing.placeholder")}
                  style={{ width: "100%" }}
                  disabledDate={(current) => {
                    return current && current < moment().startOf("day");
                  }}
                  disabledTime={(current) => {
                    if (!current) return {};
                    const now = moment();
                    if (current.isSame(now, "day")) {
                      return {
                        disabledHours: () => {
                          const hours = [];
                          for (let i = 0; i <= now.hour(); i++) {
                            hours.push(i);
                          }
                          return hours;
                        },
                        disabledMinutes: (selectedHour: number) => {
                          if (selectedHour === now.hour()) {
                            const minutes = [];
                            for (let i = 0; i <= now.minute(); i++) {
                              minutes.push(i);
                            }
                            return minutes;
                          }
                          return [];
                        },
                      };
                    }
                    return {};
                  }}
                />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </div>
  );
};
