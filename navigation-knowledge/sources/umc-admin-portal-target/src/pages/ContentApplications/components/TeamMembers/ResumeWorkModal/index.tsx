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
        CustomMessage.success(t("Content.contentApplications.messages.operationSuccess"))
      } catch (error) {
        CustomMessage.error(t("Content.contentApplications.messages.failedToResumeEmployee"))
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
        title={t("applications.buttons.resumeWork")}
        content={t("applications.buttons.resumeWorkWarning")}
        cancelText={t("common.cancel")}
        confirmText={t("common.confirm")}
        onCancel={() => setResumeWorkVisible(false)}
        onConfirm={onConfirm}
        loading={loading}
        confirmPermissionCode="Content.Applications.ResumeWork"
        permissionRoutePath="/content/ContentApplications"
      />
    )
  }
)
