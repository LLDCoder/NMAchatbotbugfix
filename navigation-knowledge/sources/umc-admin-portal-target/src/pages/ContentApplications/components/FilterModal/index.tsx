import { CustomButton } from "@/components/common"
import { DatePicker, Modal, Select } from "antd"
import "./index.less"
import { forwardRef, useImperativeHandle, useState } from "react"
import type { IFilterModalRef, IProps } from "./type"
import { transformDate } from "@/utils/transform"
import { useTranslation } from "react-i18next"

export const DEFAULT_RESULTS = [
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
  { label: "Request Modification", value: "Request Modification" },
  { label: "External Approval", value: "External Approval" },
  { label: "Send Back", value: "Send Back" },
]

export const FilterModal = forwardRef<IFilterModalRef, IProps>((props, ref) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith("ar")
  const { approvalStatus } = props
  const [visible, setVisible] = useState<boolean>(false)
  const [selectResults, setSelectResults] = useState<string[]>([])
  const [lastUpdatedTimeRange, setLastUpdatedTimeRange] = useState<
    [string | null, string | null]
  >([null, null])

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
    clear: () => {
      setSelectResults([])
      setLastUpdatedTimeRange([null, null])
    },
  }))

  const filterSearch = () => {
    props?.onSuccess?.({
      approvalStatus: selectResults,
      startTime: lastUpdatedTimeRange[0],
      endTime: lastUpdatedTimeRange[1],
    })
    setVisible(false)
  }

  return (
    <Modal
      title={t("serviceConfiguration.filters.filter")}
      visible={visible}
      className={`content-applications-filter-modal${isArabic ? " content-applications-modal--rtl" : ""}`}
      onCancel={() => setVisible(false)}
      footer={
        <div className="content-applications-filter-modal__footer">
          <CustomButton
            text={t("common.cancel")}
            variant="outline"
            onClick={() => setVisible(false)}
          />
          <CustomButton
            text={t("common.apply")}
            variant="primary"
            onClick={filterSearch}
          />
        </div>
      }
      width={960}
      centered
    >
      <div className="filter-box">
        <div className="filter-item">
          <div className="item-label">{t("Content.contentApplications.filters.approvalResults")}</div>
          <Select
            value={selectResults}
            className="filters-select"
            mode="multiple"
            placeholder={t("Content.contentApplications.filters.allResults")}
            onChange={(value) => setSelectResults(value)}
            allowClear
            options={approvalStatus}
          />
        </div>
        <div className="filter-item">
          <div className="item-label">{t("Content.contentApplications.table.lastUpdatedTime")}</div>
          <DatePicker.RangePicker
            placeholder={[t("Content.contentApplications.filters.startTime"), t("Content.contentApplications.filters.endTime")]}
            format={["DD/MM/YYYY"]}
            className="search-input"
            allowClear
            onChange={(value) => {
              const [startTime, endTime] = transformDate(value)
              setLastUpdatedTimeRange([startTime, endTime])
            }}
          />
        </div>
      </div>
    </Modal>
  )
})
