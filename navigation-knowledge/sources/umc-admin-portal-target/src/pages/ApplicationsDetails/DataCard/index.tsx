import BaseNum from "@/assets/images/licenseDatails1.svg";
import BaseCategory from "@/assets/images/application-details-service-category.svg";
import BaseProgress from "@/assets/images/application-details-status.svg";
import BaseType from "@/assets/images/application-statistics-todo.svg";
import BaseSla from "@/assets/images/licenseDatails5.svg";
import scrollIcon from "@/assets/images/scroll.svg";
import { useTranslation } from "react-i18next";
import {
  transformSpaceString,
} from "@/utils/transform";
import "@/pages/ContentApplications/reset.less"

const NARROW_SUMMARY_KEYS = new Set(["type", "sla", "status"]);
const WIDE_SUMMARY_KEYS = new Set(["serviceCategory"]);

export default function DataCard({
  details,
  activeTab,
}: {
  details: any;
  activeTab: any;
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.toLowerCase().startsWith("ar");
  const baseList = [
    {
      key: "applicationNumber",
      name: t("applications.details.applicationNumber"),
      value: details?.applicationNumber || "-",
      icon: BaseNum,
    },
    {
      key: "serviceCategory",
      name: t("applications.details.serviceCategory"),
      value: isArabic
        ? details?.serviceCategoryNameAr || "-"
        : details?.serviceCategoryNameEn || "-",
      icon: BaseCategory,
    },
    {
      key: "type",
      name: t("applications.details.type"),
      value: isArabic
        ? details?.serviceTypeNameAr || "-"
        : details?.serviceTypeNameEn || "-",
      icon: BaseType,
    },
    {
      key: "sla",
      name: t("applications.details.sla"),
      value:
        activeTab === "2"
          ? details.sla >= 0
            ? t("applications.details.exceeded")
            : t("applications.details.onTime")
          : details?.slaDescription || "-",
      icon: BaseSla,
    },
    {
      key: "status",
      name: t("applications.details.status"),
      value: (
        <div className={`status-tag ${transformSpaceString(details?.status)}`}>
          {details?.status}
        </div>
      ),
      icon: BaseProgress,
    },
  ].reduce((acc, cur) => {
    acc.push(cur);
    // NOTE display approval result when activeTab is completed
    if (cur.key === "sla" && activeTab === "2") {
      acc.push({
        key: "myDecision",
        name: t("applications.details.myDecision"),
        value: details?.taskStatus || "-",
        icon: scrollIcon,
      });
    }
    return acc;
  }, [] as Record<string, any>[]);

  const infos = baseList.map((item: any, i: number) => (
    <div
      className={`base_info_item application-details-summary__item${
        NARROW_SUMMARY_KEYS.has(item.key)
          ? " application-details-summary__item--narrow"
          : WIDE_SUMMARY_KEYS.has(item.key)
            ? " application-details-summary__item--wide"
            : ""
      }`}
      key={i}
    >
      <div className="application-details-summary__icon-background">
        <img
          className="application-details-summary__icon"
          src={item.icon}
          alt=""
        />
      </div>
      <div className="info_content">
        <div className="info_name">{item.name}</div>
        <div className="info_value">{item.value}</div>
      </div>
    </div>
  ));

  
  return (
    <div className="top-box">
      <div className="detail-title">
        <div className="title">
          {isArabic ? details?.serviceNameAr : details?.serviceNameEn || "-"}
        </div>
        <div className="tag">{t("applications.details.fromWeb")}</div>
      </div>
      <div className="base_info">{infos}</div>
    </div>
  );
}
