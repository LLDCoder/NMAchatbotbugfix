import type { FC } from "react"
import { Modal } from "antd"
import { useTranslation } from "react-i18next"
import { CustomButton } from "@/components/common"
import type { TeamManagementModalProps } from "./type"
import "./index.less"

export const TEAM_MANAGEMENT_MODAL_WIDTH = 640

const buildClassName = (classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ")

export const TeamManagementModal: FC<TeamManagementModalProps> = ({
  visible,
  title,
  onCancel,
  onConfirm,
  children,
  className,
  footer,
  width = TEAM_MANAGEMENT_MODAL_WIDTH,
  loading = false,
  confirmDisabled = false,
  cancelDisabled = false,
  confirmText,
  cancelText,
  buttonWidth = 140,
  confirmPermissionCode,
  permissionRoutePath,
  destroyOnClose = true,
  maskClosable = true,
  ...restProps
}) => {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.dir(i18n.language) === "rtl"

  const resolvedFooter =
    footer !== undefined
      ? footer
      : onConfirm
        ? (
            <div className="team-management-modal__footer">
              <CustomButton
                text={cancelText ?? t("common.cancel")}
                variant="secondary"
                onClick={onCancel}
                customStyle={{ width: buttonWidth }}
                disabled={loading || cancelDisabled}
              />
              <CustomButton
                text={confirmText ?? t("common.confirm")}
                variant="primary"
                onClick={onConfirm}
                customStyle={{ width: buttonWidth }}
                loading={loading}
                disabled={confirmDisabled}
                permissionCode={confirmPermissionCode}
                permissionRoutePath={permissionRoutePath}
              />
            </div>
          )
        : null

  return (
    <Modal
      {...restProps}
      centered
      visible={visible}
      title={title}
      width={width}
      footer={resolvedFooter}
      destroyOnClose={destroyOnClose}
      maskClosable={!loading && maskClosable}
      onCancel={loading ? undefined : onCancel}
      className={buildClassName([
        "team-management-modal",
        isRtl && "team-management-modal--rtl",
        className,
      ])}
    >
      {children}
    </Modal>
  )
}
