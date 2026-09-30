import { Form, Row, Col, Input, Select, DatePicker } from "antd"
import "../index";
import moment from "moment";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LegalPersonInfo({params}:any) {
  const { t } = useTranslation();
  const currentLang = i18n.language;
  const getName = (obj: any) => {
    if (!obj) return '--';
    return currentLang === 'ar' ? (obj.nameAr || obj.nameEn || '--') : (obj.nameEn || obj.nameAr || '--');
  };

  function getIdTypeLabel(){
    const name = getName(params?.idTypeObj);
    switch (name) {
      case "Emirates ID":
      case "الهوية الإماراتية":
        return t("Licensing.details.legalPersonInfo.emiratesId");
      case "UID":
        return t("Licensing.details.legalPersonInfo.uid");
      case "Passport ID":
      case "رقم الجواز":
        return t("Licensing.details.legalPersonInfo.passportNumber");
      default:
        return "";
    }
  }

  return <div className="establishment-info">
    <h3 className="_title">{t("Licensing.details.legalPersonInfo.title")}</h3>
    <Form form={Form.useForm()} layout="vertical" className="custorm-form" disabled>
      <Row gutter={[16, 16]} >
        <Col span={8}>
          <Form.Item label={t("Licensing.details.legalPersonInfo.legalPerson")} name="Person">
            <div>{params?.nameEn || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.legalPersonInfo.contactNumber")} name="contactNumber">
            <div>{params?.nameEn || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.legalPersonInfo.idType")} name="idType">
            <div>{getName(params?.idTypeObj)}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={getIdTypeLabel() || '--'} name="emiratesId">
            <div>{params?.emiratesId || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.legalPersonInfo.dateOfBirth")} name="expiryDate">
            <div>{moment(params?.birthDate).format('DD/MM/YYYY') || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.legalPersonInfo.email")} name="email">
            <div>{params?.personalEmail || '--'}</div>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </div>
}
