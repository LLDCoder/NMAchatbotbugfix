import WarningGold from "@/assets/icons/WarningGold"
import { CustomButton } from "@/components/common"
import { Modal } from "antd"
import { useState, type FC } from "react"
import "./index.less"
import { useTranslation } from "react-i18next"

export const ApproveExportModal: FC = () => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith("ar")
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  return (
    <Modal
      centered
      visible={true}
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
          <h1 className="content-title">{t("Content.contentApplications.modals.approveExport.title")}</h1>
          <p className="content-desc">
            {t("Content.contentApplications.modals.approveExport.desc")}
          </p>
        </div>
      </div>
    </Modal>
  )
}
