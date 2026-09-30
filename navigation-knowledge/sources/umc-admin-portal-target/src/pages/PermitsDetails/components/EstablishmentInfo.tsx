import { Form, Row,Col, Input, Select, DatePicker } from "antd"
import "../index";
import moment from "moment";
import { useTranslation } from "react-i18next";
interface Info{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any
}

export default function EstablishmentInfo({params}:Info) {
  const { t, i18n } = useTranslation();
  
  const [form] = Form.useForm()

  return <div className="establishment-info">
    <h3 className="_title">{t("Content.contentApplicationsDetails.establishmentOverview.establishmentInformation")}</h3>
    <Form form={form} layout="vertical" className="custorm-form" disabled>
      <Row gutter={[16, 16]} >
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.establishmentSubTypes")} name="subType"  >
            <div>{i18n.resolvedLanguage === "ar" ? params?.establishmentTypeObj?.nameAr || params?.establishmentTypeObj?.nameEn || '--' : params?.establishmentTypeObj?.nameEn || params?.establishmentTypeObj?.nameAr || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={16} ></Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.workEmail")} name="workEmail"  >
            <div>{params?.workEmail || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.commercialLicenseNumber")} name="commercialLicenseNumber" >
           <div>{params?.licenseNumber || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.licenseExpiryDate")} name="expiryDate" >
            <div>{moment(params?.licenseExpiryDate).format('DD-MM-YYYY') || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.establishmentNameAr")} name="arabicName"  >
            <div>{params?.nameAr || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.establishmentNameEn")} name="englishName" >
            <div>{params?.nameEn || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.emirate")} name="emirate" >
            <div>{i18n.resolvedLanguage === "ar" ? params?.emirateObj?.nameAr || params?.emirateObj?.nameEn || '--' : params?.emirateObj?.nameEn || params?.emirateObj?.nameAr || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.licensingAuthority")} name="authority" >
            <div>{params?.licensingAutharityId || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.phoneNumber")} name="phone" >
            <div>{params?.personalMobile || '--'}</div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.tenancyContractEndDate")} name="endDate" >
           <div>{moment(params?.tenancyContractEndDate).format('DD-MM-YYYY') || '--'}</div>
          </Form.Item>
        </Col>
        
      </Row>
    </Form>

  </div> 
  
}