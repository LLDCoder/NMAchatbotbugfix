import { Table } from "antd";
import moment from "moment";
import { applicationHistory } from "../data";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";

type HistoryRow = {
  applicationNumber?: string;
  serviceName?: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  type?: string;
  typeAr?: string;
  typeEn?: string;
  submissionTime?: string;
};

const TYPE_TRANSLATION_BY_LABEL: Record<string, string> = {
  new: "Licensing.details.new",
  renew: "Licensing.details.renew",
  modify: "Licensing.details.modify",
  cancel: "Licensing.details.cancel",
  transfer: "Licensing.details.transfer",
  "partner management": "Licensing.details.partnerManagement",
};

export default function ServiceFees({historyData, t: tProp}  ) {
  const { t: defaultT } = useTranslation();
  const t = tProp || defaultT;
  const currentLang = i18n.language;

  const resolveHistoryType = (text: unknown, row: HistoryRow) => {
    if (currentLang === "ar" && row?.typeAr) {
      return row.typeAr;
    }
    if (currentLang !== "ar" && row?.typeEn) {
      return row.typeEn;
    }

    const lookupValue = text == null ? "" : String(text).trim();
    const byValue = applicationHistory.find((item) => `${item.value}` === lookupValue);
    if (byValue?.textKey) {
      return t(byValue.textKey);
    }

    const normalized = lookupValue.toLowerCase();
    const translationKey = TYPE_TRANSLATION_BY_LABEL[normalized];
    if (translationKey) {
      return t(translationKey);
    }

    return lookupValue || "-";
  };

  const resolveServiceName = (row: HistoryRow) => {
    if (currentLang === "ar") {
      return row?.serviceNameAr || row?.serviceName || "-";
    }

    return row?.serviceNameEn || row?.serviceName || "-";
  };

  return <div className="service-fees">
    <div>
      <h3 style={{ fontSize: '18px' }}>{t("Licensing.details.relatedApplications")}</h3>
    </div>
    <Table
      className="admin-table"
      pagination={false}
      columns={[
        {
          title: t("Licensing.details.number"),
          dataIndex: "number",
          key: "number",
          render:(text, row, index) => {
            return index + 1;
          }
        },
        {
          title: t("Licensing.details.applicationNumber"),
          dataIndex: 'applicationNumber',
          key: 'applicationNumber'
        },
        {
          title: t("Licensing.details.serviceName"),
          dataIndex: currentLang === "ar" ? "serviceNameAr" : "serviceNameEn",
          key: "serviceName",
          render: (_text, row: HistoryRow) => resolveServiceName(row),
        },
        {
          title: t("Licensing.details.type"),
          dataIndex: 'type',
          key: 'type',
          render: (text, row: HistoryRow) => {
            return resolveHistoryType(text, row);
          }
        },
        {
          title: t("Licensing.details.submissionTime"),
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
