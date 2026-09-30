import { Col, Form, Radio, Row, DatePicker } from "antd";
import { type FC } from "react";
import { useTranslation } from "react-i18next";
import type { IProps, EventPeriodFieldType } from "./type";
import "./index.less";
import moment from "moment";

export const EventPeriod: FC<IProps> = ({ EventForm }) => {
  const { t } = useTranslation();
  const publishType = Form.useWatch("publishType", EventForm);

  // Custom validator for scheduled time
  const validateScheduledTime = (_: any, value: any) => {
    if (!value) {
      return Promise.reject(new Error(t("CMS.common.requiredField")));
    }
    const now = moment();
    const selectedTime = moment(value);
    if (selectedTime.isBefore(now) || selectedTime.isSame(now)) {
      return Promise.reject(
        new Error("The scheduled time must be later than the current time.")
      );
    }
    return Promise.resolve();
  };

  return (
    <div>
      <Form<EventPeriodFieldType>
        form={EventForm}
        className="custom-form timing-form"
        layout="vertical"
        initialValues={{
          publishType: "1",
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="publishTime"
              label={t("CMS.addEventManagement.eventPeriod.label")}
              rules={[
                { required: true, message: t("CMS.common.requiredField") },
                // { validator: validateScheduledTime },
              ]}
            >
              <DatePicker.RangePicker
                showTime
                format="DD/MM/YYYY"
                placeholder={[
                  t("CMS.addEventManagement.eventPeriod.startDate"),
                  t("CMS.addEventManagement.eventPeriod.endDate"),
                ]}
                style={{ width: "100%" }}
                disabledDate={(current) => {
                  return current && current < moment().startOf("day");
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
