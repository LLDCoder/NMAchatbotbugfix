import { Form, Row,Col, Input, } from "antd"
import "../index";
import { useTranslation } from "react-i18next";
interface Info{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params:any
}

export default function AddressInfo({params}:Info) {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm()

  return <div className="establishment-info">
    <h3 className="_title">{t("Content.contentApplicationsDetails.establishmentOverview.addressInformation")}</h3>
    <Form form={form} layout="vertical"  disabled>
      <Row gutter={[16, 16]} >
        <Col span={8}>
        {/* initialValue="Commercial" */}
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.emirate")} name="Emirate"  >
            <div>
              {i18n.resolvedLanguage === "ar" ? params?.emirateObj?.nameAr || params?.emirateObj?.nameEn || '--' : params?.emirateObj?.nameEn || params?.emirateObj?.nameAr || '--'}
            </div>
          </Form.Item>
        </Col>
        <Col span={8}>
        {/* initialValue="democommercial@business.ae" */}
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.region")} name="Region" >
            <div>{i18n.resolvedLanguage === "ar" ? params?.regionObj?.nameAr || params?.regionObj?.nameEn || '--' : params?.regionObj?.nameEn || params?.regionObj?.nameAr || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
        {/* Mobile number example */}
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.area")}  name="Area" >
            <div>{i18n.resolvedLanguage === "ar" ? params?.areaObj?.nameAr || params?.areaObj?.nameEn || '--' : params?.areaObj?.nameEn || params?.areaObj?.nameAr || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.street")} name="Street" >
            <div>{i18n.resolvedLanguage === "ar" ? params?.streetObj?.nameAr || params?.streetObj?.nameEn || '--' : params?.streetObj?.nameEn || params?.streetObj?.nameAr || '--'}</div>
          </Form.Item>
        </Col>
      </Row>
    </Form>

  </div> 
  
}