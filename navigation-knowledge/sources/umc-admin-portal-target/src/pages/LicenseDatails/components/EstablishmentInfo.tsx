import { Form, Row, Col, Input, Select, DatePicker } from "antd"
import "../index";
import moment from "moment";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";

interface Info{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any
}

export default function EstablishmentInfo({params}:Info) {
  const { t } = useTranslation();
  const currentLang = i18n.language;
  const getName = (obj: any) => {
    if (!obj) return '--';
    return currentLang === 'ar' ? (obj.nameAr || obj.nameEn || '--') : (obj.nameEn || obj.nameAr || '--');
  };

  return <div className="establishment-info">
    <h3 className="_title">{t("Licensing.details.establishmentInfo.title")}</h3>
    <Form form={Form.useForm()} layout="vertical" className="custorm-form" disabled>
      <Row gutter={[16, 16]} >
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.subTypes")} name="subType">
            <div>{getName(params?.establishmentTypeObj)}</div>
          </Form.Item>
        </Col>
        <Col span={16} ></Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.workEmail")} name="workEmail">
            <div>{params?.workEmail || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.commercialLicenseNumber")} name="commercialLicenseNumber">
           <div>{params?.licenseNumber || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.licenseExpiryDate")} name="expiryDate">
            <div>{moment(params?.licenseExpiryDate).format('DD-MM-YYYY') || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.arabicName")} name="arabicName">
            <div>{params?.nameAr || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.englishName")} name="englishName">
            <div>{params?.nameEn || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.emirate")} name="emirate">
            <div>{getName(params?.emirateObj)}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.licensingAuthority")} name="authority">
            <div>{params?.licensingAutharityId || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.phoneNumber")} name="phone">
            <div>{params?.personalMobile || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.establishmentInfo.tenancyContractEndDate")} name="endDate">
           <div>{moment(params?.tenancyContractEndDate).format('DD-MM-YYYY') || '--'}</div>
          </Form.Item>
        </Col>
        
      </Row>
    </Form>
  </div>
}
