import type { IDomEditor } from "@wangeditor/editor";
import { Col, Form, Input, Row, Select, DatePicker } from "antd";
import { useState, type FC, useEffect, useImperativeHandle,forwardRef } from "react";
import type { IBasicFieldType, IProps } from "./type";
import "./index.less";
import { GetEmiratesAsync, GetJobTypesAsync } from "@/services/cms";
import moment from "moment";
import { useTranslation } from "react-i18next";
export const BasicInformation = forwardRef(({ BasicInformationForm }: IProps, ref) => {
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const { Option } = Select;
  const [regionName, setRegionName] = useState("");
  const { t, i18n } = useTranslation();

  const [emirateList, setemirateList] = useState<
    { id: number; nameEn: string; nameAr: string }[]
  >([]);
  const [JobTypesList, setJobTypesList] = useState<
    { id: number; code: string; nameEn: string; nameAr: string }[]
  >([]);
  useEffect(() => { 
    if (BasicInformationForm.getFieldValue("emirateId")) {
      handleEmirateChange(BasicInformationForm.getFieldValue("emirateId"));
    }
  }, [BasicInformationForm.getFieldValue("emirateId")]);
  const handleEmirateChange = (value: number) => {
    setRegionName(
      (i18n.resolvedLanguage === "ar"
        ? emirateList.find((emirate) => emirate.id === value)?.nameAr
        : emirateList.find((emirate) => emirate.id === value)?.nameEn) || "",
    );
  };
  useImperativeHandle(ref, () => ({
    regionName,
  }));
  useEffect(() => {
    GetEmiratesAsync().then((res) => {
      setemirateList(res.data);
    });
    GetJobTypesAsync().then((res) => {
      setJobTypesList(res.data);
    });
  }, []);

  return (
    <Form<IBasicFieldType>
      form={BasicInformationForm}
      className="custom-form Basic-Information-form"
      layout="vertical"
    >
      {/* first row */}
      <Row gutter={16}>
        {/* first column */}
        <Col span={12}>
          <Form.Item
            name="jobTitleEn"
            label={t("CMS.jobOpeningsManagement.basicInformation.labels.englishJobTitle")}
            rules={[
              { required: true, message: t("CMS.common.requiredField") },
            ]}
          >
            <Input
              className="search-input"
              maxLength={200}
              placeholder={t("CMS.jobOpeningsManagement.basicInformation.placeholders.enterEnglishJobTitle")}
            />
          </Form.Item>
        </Col>

        {/* second column */}
        <Col span={12}>
          <Form.Item
            name="jobTitleAr"
            label={t("CMS.jobOpeningsManagement.basicInformation.labels.arabicJobTitle")}
            rules={[
              { required: true, message: t("CMS.common.requiredField") },
            ]}
          >
            <Input
              maxLength={200}
              placeholder={t("CMS.jobOpeningsManagement.basicInformation.placeholders.enterArabicJobTitle")}
              className="search-input ar"
            />
          </Form.Item>
        </Col>
      </Row>

      {/* second row */}
      <Row gutter={16}>
        {/* first column */}
        <Col span={12}>
          <Form.Item
            name="emirateId"
            label={t("CMS.jobOpeningsManagement.basicInformation.labels.jobLocation")}
            rules={[{ required: true, message: t("CMS.common.requiredField") }]}
            className="form-item"
          >
            <Select
              placeholder={t("CMS.jobOpeningsManagement.basicInformation.placeholders.selectJobLocation")}
              onChange={handleEmirateChange}
            >
              {emirateList.map((emirate) => (
                <Option key={emirate.id} value={emirate.id}>
                  {i18n.resolvedLanguage === "ar" ? emirate.nameAr : emirate.nameEn}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        {/* second column */}
        <Col span={12}>
          <Form.Item
            name="jobTypes"
            label={t("CMS.jobOpeningsManagement.basicInformation.labels.jobTypes")}
            rules={[{ required: true, message: t("CMS.common.requiredField") }]}
            className="form-item"
          >
            <Select placeholder={t("CMS.jobOpeningsManagement.basicInformation.placeholders.selectJobType")}>
              {JobTypesList.map((jobType) => (
                <Option key={jobType.id} value={jobType.code}>
                  {i18n.resolvedLanguage === "ar" ? jobType.nameAr : jobType.nameEn}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="applicationDeadline"
            label={t("CMS.jobOpeningsManagement.basicInformation.labels.applicationDeadline")}

            className="form-item"
          >
            <DatePicker
              showTime
              format="DD/MM/YYYY HH:mm"
              placeholder={t("CMS.jobOpeningsManagement.basicInformation.placeholders.selectDeadlineDate")}
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
      </Row>
    </Form>
  );
});
