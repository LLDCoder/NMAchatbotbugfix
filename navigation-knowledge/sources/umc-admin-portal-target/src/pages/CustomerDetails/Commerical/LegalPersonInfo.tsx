import { Form, Row, Col } from "antd";
import "../index";
import moment from "moment";
import { useTranslation } from "react-i18next";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LegalPersonInfo({ params }: any) {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  function getIdTypeLabel() {
    switch (params?.idTypeObj?.nameEn) {
      case "Emirates ID":
        return t("Licensing.details.legalPersonInfo.emiratesId");
      case "UID":
        return t("Licensing.details.legalPersonInfo.uid");
      case "Passport ID":
        return t("Licensing.details.legalPersonInfo.passportNumber");
      default:
        return "";
    }
  }

  return (
    <div className="establishment-info">
      <h3 className="_title">{t("Licensing.details.legalPersonInfo.title")}</h3>
      <Form form={form} layout="vertical" className="custorm-form" disabled>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.legalPersonInfo.legalPerson")} name="Person">
              <div>{params?.nameEn || '--'}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.legalPersonInfo.contactNumber")}
              name="contactNumber"
            >
              <div>{params?.nameEn || '--'}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.legalPersonInfo.idType")} name="idType">
              <div>{params?.idTypeObj.nameEn || '--'}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={getIdTypeLabel() || '--'} name="emiratesId">
              <div>{params?.emiratesId || '--'}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.legalPersonInfo.dateOfBirth")} name="expiryDate">
              <div>{moment(params?.birthDate).format('DD/MM/YYYY') || '--'}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.legalPersonInfo.email")} name="email">
              <div>{params?.personalEmail || '--'}</div>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
