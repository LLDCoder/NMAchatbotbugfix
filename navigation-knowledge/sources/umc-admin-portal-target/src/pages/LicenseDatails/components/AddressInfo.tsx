import { Form, Row, Col, Input } from "antd"
import "../index";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";

interface Info{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params:any
}

export default function AddressInfo({params}:Info) {
  const { t } = useTranslation();
  const currentLang = i18n.language;
  const getName = (obj: any) => {
    if (!obj) return '--';
    return currentLang === 'ar' ? (obj.nameAr || obj.nameEn || '--') : (obj.nameEn || obj.nameAr || '--');
  };

  return <div className="establishment-info">
    <h3 className="_title">{t("Licensing.details.addressInfo.title")}</h3>
    <Form form={Form.useForm()} layout="vertical" disabled>
      <Row gutter={[16, 16]} >
        <Col span={8}>
          <Form.Item label={t("Licensing.details.addressInfo.emirate")} name="Emirate">
            <div>{getName(params?.emirateObj)}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.addressInfo.region")} name="Region">
            <div>{getName(params?.regionObj)}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.addressInfo.area")} name="Area">
            <div>{getName(params?.areaObj)}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Licensing.details.addressInfo.street")} name="Street">
            <div>{getName(params?.streetObj)}</div>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </div>
}
