import { ExclamationCircleFilled } from "@ant-design/icons"
import { type FC, useState } from "react"
import { useTranslation } from "react-i18next"
import { CustomMessage } from "@/components/common"
import {
  resumeTeamManagementMemberWork,
} from "@/services/teamManagement"
import { TeamManagementModal } from "../TeamManagementModal"
import type { ResumeWorkModalProps } from "./type"
import "./index.less"

export const ResumeWorkModal: FC<ResumeWorkModalProps> = ({
  scope,
  serviceAdapterMode = "default",
  confirmPermissionCode,
  permissionRoutePath,
  visible,
  memberId,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    try {
      setLoading(true)
      await resumeTeamManagementMemberWork({
        scope,
        adapterMode: serviceAdapterMode,
        memberId,
      })
      CustomMessage.success(t("teamManagement.messages.operationSuccess"))
      onSuccess()
    } catch (error) {
      CustomMessage.error(t("teamManagement.messages.operationFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <TeamManagementModal
      visible={visible}
      title={null}
      onCancel={onCancel}
      onConfirm={() => void handleConfirm()}
      loading={loading}
      width={600}
      buttonWidth={96}
      centered
      closable={false}
      permissionRoutePath={permissionRoutePath}
      confirmPermissionCode={confirmPermissionCode}
      className="team-management-modal--resume"
    >
      <div className="team-management-resume-modal">
        <div className="team-management-resume-modal__header">
          <div className="team-management-resume-modal__icon">
            <ExclamationCircleFilled />
          </div>
          <h3 className="team-management-resume-modal__title">
            {t("teamManagement.memberActions.resumeWork")}
          </h3>
        </div>
        <p className="team-management-resume-modal__description">
          {t("teamManagement.resume.confirmation")}
        </p>
      </div>
    </TeamManagementModal>
  )
}
