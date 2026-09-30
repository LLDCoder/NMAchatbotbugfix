import { ConfirmModal, CustomMessage } from "@/components/common"
import { useState, forwardRef, useImperativeHandle } from "react"
import { useTranslation } from "react-i18next"
import type { IResumeWorkModalRef } from "../type"
import type { IProps } from "./type"
import { applicationMyTeamMemberReturn } from "@/services/team"

export const ResumeWorkModal = forwardRef<IResumeWorkModalRef, IProps>(
  (props, ref) => {
    const { onOkCb, userId } = props
    const { t } = useTranslation()
    const [resumeWorkVisible, setResumeWorkVisible] = useState(false)
    const [loading, setLoading] = useState(false)

    const resumeEmployee = async () => {
      try {
        await applicationMyTeamMemberReturn({ userId })
        CustomMessage.success(
          t("applications.teamModals.messages.operationSuccess")
        )
      } catch {
        CustomMessage.error(t("applications.teamModals.messages.resumeFailed"))
      }
    }

    const onConfirm = async () => {
      setLoading(true)
      await resumeEmployee()
      onOkCb?.()
      setLoading(false)
      setResumeWorkVisible(false)
    }

    useImperativeHandle(ref, () => ({
      show: () => setResumeWorkVisible(true),
    }))

    return (
      <ConfirmModal
        visible={resumeWorkVisible}
        type="warning"
        width={600}
        title={t("applications.buttons.resumeWork")}
        content={t("applications.buttons.resumeWorkWarning")}
        cancelText={t("common.cancel")}
        confirmText={t("common.confirm")}
        onCancel={() => setResumeWorkVisible(false)}
        onConfirm={onConfirm}
        loading={loading}
        confirmPermissionCode="Licensing.Applications.ResumeWork"
        permissionRoutePath="/licensing/applications"
      />
    )
  }
)
