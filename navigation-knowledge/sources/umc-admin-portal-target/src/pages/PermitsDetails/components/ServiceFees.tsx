import { Table } from "antd";
// import AedHui from "@/assets/images/AEDHui.png";
// import AED from "@/assets/images/AED.png";
import moment from "moment";
import { applicationHistory } from "../data";
import { useTranslation } from "react-i18next";

export default function ServiceFees({historyData}  ) {
  const { t } = useTranslation();
  return <div className="service-fees">
    <div>
      <h3 style={{ fontSize: '18px' }}>{t("Content.permitsDetails.relatedApplications.title")}</h3>
    </div>
    <Table
      className="admin-table"
      pagination={false}
      columns={[
        {
          title: t("Content.permitsDetails.relatedApplications.number"),
          dataIndex: "number",
          key: "number",
          render:(text, row, index) => {
            return index + 1;
          }
        },
        {
          title: t("Content.permitsDetails.relatedApplications.applicationNumber"),
          dataIndex: 'applicationNumber',
          key: 'applicationNumber'
        },
        {
          title: t("Content.permitsDetails.relatedApplications.serviceName"),
          dataIndex: "serviceName",
          key: "serviceName",
        },
        {
          title: t("Content.permitsDetails.relatedApplications.type"),
          dataIndex: 'type',
          key: 'type',
          render: (text) => {
            const obj = applicationHistory.find(item => `${item.value}` === text)
            return obj?.textKey ? t(obj.textKey) : ""
          }
        },
        {
          title: t("Content.permitsDetails.relatedApplications.submissionTime"),
          dataIndex: 'submissionTime',
          key: 'submissionTime',
          render: (text) => {
            return moment(text).format('DD/MM/YYYY HH:mm:ss')
          }
        }
      ]}
      dataSource={historyData}
    />
  </div>
}