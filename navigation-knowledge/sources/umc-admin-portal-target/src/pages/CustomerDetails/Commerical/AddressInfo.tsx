import { Form, Row, Col } from "antd";
import "../index";
import { useTranslation } from "react-i18next";

interface Info {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}

export default function AddressInfo({ params }: Info) {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  return (
    <div className="establishment-info">
      <h3 className="_title">{t("Licensing.details.addressInfo.title")}</h3>
      <Form form={form} layout="vertical" className="custorm-form custorm-address" disabled>
        <Row gutter={[16,24]}>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.addressInfo.emirate")} name="Emirate">
              <div>{params?.emirateObj.nameEn || '--'}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.addressInfo.region")} name="Region">
              <div>{params?.regionObj.nameEn}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.addressInfo.area")} name="Area">
              <div>{params?.areaObj.nameEn}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.addressInfo.street")} name="Street">
              <div>{params?.streetObj.nameEn}</div>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
