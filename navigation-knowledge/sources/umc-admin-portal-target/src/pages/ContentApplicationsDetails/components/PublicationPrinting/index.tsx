import "./index.less"
import type { FC } from "react"
import React from "react"
import type { IProps, ITaskList } from "./type"
import BaseNum from "@/assets/images/licenseDatails1.svg"
import BaseCategory from "@/assets/images/application-details-service-category.svg"
import BaseSla from "@/assets/images/licenseDatails5.svg"
import BaseProgress from "@/assets/images/application-details-status.svg"
import { useTranslation } from "react-i18next"
import { ContentApplicationStatus } from "@/pages/ContentApplications/components/ContentApplicationStatus"

const ICON_MAP = {
  applicationNumber: BaseNum,
  serviceCategoryName: BaseCategory,
  sla: BaseSla,
  status: BaseProgress,
}

export const PublicationPrinting: FC<IProps> = React.memo((props) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const { data } = props
  const KEY_MAP = {
    applicationNumber: t("Content.contentApplicationsDetails.publicationPrinting.applicationNumber"),
    serviceCategoryName: t("Content.contentApplicationsDetails.publicationPrinting.serviceCategory"),
    sla: t("Content.contentApplicationsDetails.publicationPrinting.sla"),
    status: t("Content.contentApplicationsDetails.publicationPrinting.status"),
  }

  const getSlaValue = (): ITaskList["value"] => {
    const slaDescription = String(data?.slaDescription ?? "").trim()

    if (slaDescription) {
      return slaDescription
    }

    return data?.sla || "-"
  }

  const getItemValue = (key: keyof typeof KEY_MAP): ITaskList["value"] => {
    if (key === "sla") {
      return getSlaValue()
    }

    if (key === "serviceCategoryName") {
      return (isArabic ? data?.serviceCategoryNameAr : data?.serviceCategoryNameEn) || "-"
    }

    if (key === "applicationNumber") {
      return data?.applicationNumber || "-"
    }

    return data?.status || "-"
  }

  const list: ITaskList[] = Reflect.ownKeys(KEY_MAP).map((key) => ({
    name: KEY_MAP[key as keyof typeof KEY_MAP],
    value: getItemValue(key as keyof typeof KEY_MAP),
    icon: ICON_MAP[key as keyof typeof ICON_MAP],
  }))

  const renderItems = () =>
    list.map((item, i) => (
      <div className="items-content" key={i}>
        <div className="content-application-summary__icon-background">
          <img className="content-application-summary__icon" src={item.icon} alt="" />
        </div>
        <div className="item-content">
          <div className="item-name">{item.name}</div>
          <div className="item-value">
            {item.name === t("Content.contentApplicationsDetails.publicationPrinting.status") ? (
              <ContentApplicationStatus
                layout="inline"
                status={String(item.value)}
                statusId={data?.statusId}
              />
            ) : (
              <span>{item.value}</span>
            )}
          </div>
        </div>
      </div>
    ))

  return (
    <div className="permit-card">
      <div className="card-title">
        <div className="title-text">{(isArabic ? data?.serviceNameAr : data?.serviceNameEn) || "-"}</div>
        <div className="title-tag">{t("Content.contentApplicationsDetails.publicationPrinting.fromWeb")}</div>
      </div>
      <div className="info-content">{renderItems()}</div>
    </div>
  )
})
