import WarningGold from "@/assets/icons/WarningGold"
import { CustomButton } from "@/components/common"
import { Modal } from "antd"
import { useImperativeHandle, useState } from "react"
import "./index.less"
import React from "react"
import type { IChangeStatusProps, IChangeStatusRef } from "./type"
import { useTranslation } from "react-i18next"

export const ChangeStatusModal = React.forwardRef<
  IChangeStatusRef,
  IChangeStatusProps
>((_props, ref) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith("ar")
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
  }))

  // CARE lack of request api

  return (
    <Modal
      centered
      visible={visible}
      className={isArabic ? "content-applications-modal--rtl" : ""}
      destroyOnClose
      footer={
        <div>
          <CustomButton
            text={t("common.cancel")}
            variant="outline"
            onClick={() => setVisible(false)}
          />
          <CustomButton
            loading={loading}
            text={t("common.confirm")}
            variant="primary"
            onClick={() => {}}
          />
        </div>
      }
    >
      <div className="status-content">
        <WarningGold className="status-icon" />
        <div>
          <h1 className="content-title">{t("Content.contentApplications.modals.changeStatus.title")}</h1>
          <p className="content-desc">
            {t("Content.contentApplications.modals.changeStatus.descPrefix")} "
            <b>{t("Content.contentApplications.modals.changeStatus.pendingReview")}</b>"?
          </p>
        </div>
      </div>
    </Modal>
  )
})
