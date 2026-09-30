import { Form, Row,Col, Input, Select, DatePicker } from "antd"
import "../index";
import moment from "moment";
import { useTranslation } from "react-i18next";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LegalPersonInfo({params}:any) {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  function getIdTypeLabel(){
    const idTypeName = i18n.resolvedLanguage === "ar" ? params?.idTypeObj?.nameAr || params?.idTypeObj?.nameEn : params?.idTypeObj?.nameEn || params?.idTypeObj?.nameAr;
    switch (idTypeName) {
      case "Emirates ID":
      case "الهوية الإماراتية":
        return t("Content.permitsDetails.idLabels.emiratesId")
      case "UID":
        return t("Content.permitsDetails.idLabels.uid")
      case "Passport ID":
      case "هوية جواز السفر":
        return t("Content.permitsDetails.idLabels.passportNumber")
      default:
        return ""
    }
  }
  return <div className="establishment-info">
    <h3 className="_title">{t("Content.contentApplicationsDetails.establishmentOverview.legalPersonInformation")}</h3>
    <Form form={form} layout="vertical" className="custorm-form" disabled>
      <Row gutter={[16, 16]} >
        <Col span={8}>
        {/* initialValue="Commercial" */}
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.legalPerson")} name="Person"  >
            <div>
              {params?.nameEn || '--'}
            </div>
          </Form.Item>
        </Col>
        <Col span={8}>
        {/* initialValue="democommercial@business.ae" */}
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.legalPersonContactNumber")} name="contactNumber">
            <div>
              {params?.nameEn || '--'}
            </div>
          </Form.Item>
        </Col>
        <Col span={8}>
        {/* Mobile number example */}
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.idType")}  name="idType" >
            <div>
              { params?.idTypeObj.nameEn || '--'}
            </div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={ getIdTypeLabel() || '--'} name="emiratesId" >
            <div>
              {params?.emiratesId || '--'}
            </div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.dateOfBirth")} name="expiryDate" >
            <div>
              {moment(params?.birthDate).format('DD/MM/YYYY') || '--'}
            </div>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label={t("Content.contentApplicationsDetails.establishmentOverview.email")} name="email"  >
            <div>
              {params?.personalEmail || '--'}
            </div>
          </Form.Item>
        </Col>
      </Row>
    </Form>

  </div> 
  
}