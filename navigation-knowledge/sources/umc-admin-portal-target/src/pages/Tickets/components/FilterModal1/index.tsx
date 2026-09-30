import { CustomButton } from "@/components/common"
import { DatePicker, Modal, Select } from "antd"
import "./index.less"
import { forwardRef, useImperativeHandle, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { IFilterModalRef, IProps } from "./type"
import { transformDate } from "@/utils/transform"

const APPROVAL_RESULT_TRANSLATION_KEYS: Record<string, string> = {
  Approved: "Customer.tickets.filterModal1.results.approved",
  Rejected: "Customer.tickets.filterModal1.results.rejected",
  "Request Modification": "Customer.tickets.filterModal1.results.requestModification",
  "External Approval": "Customer.tickets.filterModal1.results.externalApproval",
  "Send Back": "Customer.tickets.filterModal1.results.sendBack",
}

const DEFAULT_RESULTS = [
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
  { label: "Request Modification", value: "Request Modification" },
  { label: "External Approval", value: "External Approval" },
  { label: "Send Back", value: "Send Back" },
]

export const FilterModal = forwardRef<IFilterModalRef, IProps>((props, ref) => {
  const { approvalStatus } = props
  const { t } = useTranslation()
  const [visible, setVisible] = useState<boolean>(false)
  const [selectResults, setSelectResults] = useState<string[]>([])
  const [time, setTime] = useState<[string | null, string | null]>([null, null])

  const approvalStatusOptions = useMemo(
    () => (approvalStatus?.length ? approvalStatus : DEFAULT_RESULTS).map((item) => {
      const translationKey = APPROVAL_RESULT_TRANSLATION_KEYS[item.value] || APPROVAL_RESULT_TRANSLATION_KEYS[item.label]
      return {
        ...item,
        label: translationKey ? t(translationKey) : item.label,
      }
    }),
    [approvalStatus, t],
  )

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
  }))

  const filterSearch = () => {
    props?.onSuccess?.({
      approvalStatus: selectResults,
      startTime: time[0],
      endTime: time[1],
    })
    setVisible(false)
  }

  return (
    <Modal
      title={t("Customer.tickets.filterModal1.title")}
      visible={visible}
      onCancel={() => setVisible(false)}
      footer={
        <div className="tickets-application-filter-modal__footer">
          <CustomButton
            text={t("Customer.tickets.filterModal1.cancel")}
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
      className="tickets-application-filter-modal"
    >
      <div className="filter-box">
        <div className="filter-item">
          <div className="item-label">{t("Customer.tickets.filterModal1.approvalResults")}</div>
          <Select
            value={selectResults}
            className="filters-select"
            mode="multiple"
            placeholder={t("Customer.tickets.filterModal1.allResults")}
            onChange={(value) => setSelectResults(value)}
            allowClear
            options={approvalStatusOptions}
          />
        </div>
        <div className="filter-item">
          <div className="item-label">{t("Customer.tickets.filterModal1.submissionTime")}</div>
          <DatePicker.RangePicker
            placeholder={[
              t("Customer.tickets.placeholders.startTime"),
              t("Customer.tickets.placeholders.endTime"),
            ]}
            format={["DD/MM/YYYY"]}
            className="search-input"
            allowClear
            onChange={(value) => {
              const [startTime, endTime] = transformDate(value)
              setTime([startTime, endTime])
            }}
          />
        </div>
      </div>
    </Modal>
  )
})
