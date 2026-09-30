import { Form, Row, Col } from "antd";
import "../index";
import moment from "moment";
import { useTranslation } from "react-i18next";

interface Info {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}

export default function EstablishmentInfo({ params }: Info) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const formatDate = (value?: string | null) =>
    value ? moment(value).format("DD/MM/YYYY") : "--";
  const normalizeSubtype = (value?: string | null) => {
    const text = value?.trim();
    if (!text) return "--";
    if (/commercial entity/i.test(text)) return "Commercial";
    return text;
  };
  const licensingAuthority =
    params?.licensingAutharityObj?.nameEn ||
    params?.licensingAutharityObj?.nameAr ||
    params?.licensingAutharityId ||
    "--";
  const emirateName =
    params?.emirateObj?.nameEn || params?.emirateObj?.nameAr || "--";
  const workMobile = params?.workMobileNumibe || params?.workMobileNumber || "--";
  const phoneNumber = params?.personalMobile || params?.phoneNumber || "--";
  const subtype = normalizeSubtype(
    params?.establishmentTypeObj?.nameEn || params?.establishmentTypeObj?.nameAr,
  );

  return (
    <div className="establishment-info">
      <h3 className="_title">{t("Licensing.details.establishmentInfo.title")}</h3>
      <Form form={form} layout="vertical" className="custorm-form Establishment-form" disabled>
        <Row gutter={[16, 24]}>
          <Col span={12} style={{ margin: 0 }}>
            <Form.Item label={t("Licensing.details.establishmentInfo.subTypes")} name="subType">
              <div>{subtype}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.establishmentInfo.workMobileNumber")}
              name="workMobileNumber"
            >
              <div>{workMobile}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.establishmentInfo.workEmail")} name="workEmail">
              <div>{params?.workEmail || "--"}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.establishmentInfo.commercialLicenseNumber")}
              name="commercialLicenseNumber"
            >
              <div>{params?.licenseNumber || "--"}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.establishmentInfo.licenseExpiryDate")}
              name="expiryDate"
            >
              <div>{formatDate(params?.licenseExpiryDate)}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.establishmentInfo.arabicName")}
              name="arabicName"
            >
              <div>{params?.nameAr || "--"}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.establishmentInfo.englishName")}
              name="englishName"
            >
              <div>{params?.nameEn || "--"}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.addressInfo.emirate")} name="emirate">
              <div>{emirateName}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.establishmentInfo.licensingAuthority")}
              name="authority"
            >
              <div>{licensingAuthority}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("Licensing.details.establishmentInfo.phoneNumber")} name="phone">
              <div>{phoneNumber}</div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t("Licensing.details.establishmentInfo.tenancyContractEndDate")}
              name="endDate"
            >
              <div>{formatDate(params?.tenancyContractEndDate)}</div>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
