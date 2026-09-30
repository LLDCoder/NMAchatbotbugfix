import { forwardRef, useImperativeHandle, useState } from "react"
import { Modal } from "antd"
import { useTranslation } from "react-i18next"
import { CustomButton, CustomMessage } from "@/components/common"
import CheckedIcon from "@/assets/images/checked.png"
import {
  reviewDispositionCase,
  type DispositionReviewPayload,
} from "@/services/disposition"
import { DISPOSITION_APPROVE_WORKFLOW_ACTION } from "../../utils/workflowActionRouting"
import { getDispositionModalCopy } from "../../utils/workflowActionModalCopy"
import type {
  IDispositionApproveConfirmModalProps,
  IDispositionApproveConfirmModalRef,
} from "./type"
import "./index.less"
import { isMaterialStatusRequiredError } from "@/utils/service302MaterialStatus"

/**
 * Light "Approve Disposition" confirmation used by service 302 while the task
 * sits in Disposition Verification. Unlike DispositionDecisionModal there is no
 * form to fill in — approving only submits the workflow action.
 */
export const DispositionApproveConfirmModal = forwardRef<
  IDispositionApproveConfirmModalRef,
  IDispositionApproveConfirmModalProps
>((props, ref) => {
  const { current, onOkCb, confirmPermissionCode, permissionRoutePath } = props
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const [visible, setVisible] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const modalCopy = getDispositionModalCopy("approve", t)

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
  }))

  const onCancel = () => {
    if (confirmLoading) {
      return
    }
    setVisible(false)
  }

  const onConfirm = async () => {
    const dispositionCaseId =
      current?.dispositionCaseId ?? current?.dispositionCase?.caseId

    if (!dispositionCaseId) {
      CustomMessage.error(
        t("Content.contentApplications.messages.dispositionCaseIdMissing")
      )
      return
    }

    try {
      setConfirmLoading(true)
      const payload: DispositionReviewPayload = {
        workflowAction: DISPOSITION_APPROVE_WORKFLOW_ACTION,
      }
      await reviewDispositionCase(Number(dispositionCaseId), payload)
      setVisible(false)
      onOkCb?.()
    } catch (error) {
      console.error("Failed to approve content disposition case:", error)
      CustomMessage.error(
        t(
          isMaterialStatusRequiredError(error)
            ? "DataList.validation.assignNewspapersMagazinesStatus"
            : "common.operationFailed"
        )
      )
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <Modal
      visible={visible}
      centered
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      footer={null}
      onCancel={onCancel}
      className={`disposition-approve-confirm-modal${
        isArabic ? " content-applications-modal--rtl" : ""
      }`}
    >
      <div className="disposition-approve-confirm-modal__content">
        <div className="disposition-approve-confirm-modal__icon">
          <img src={CheckedIcon} alt="" aria-hidden="true" />
        </div>
        <h3 className="disposition-approve-confirm-modal__title">
          {modalCopy.title}
        </h3>
        <p className="disposition-approve-confirm-modal__message">
          {modalCopy.tip}
        </p>
        <div className="disposition-approve-confirm-modal__footer">
          <CustomButton
            text={t("applications.approvalModals.common.cancel")}
            variant="outline"
            customClassName="disposition-approve-confirm-modal__button"
            disabled={confirmLoading}
            onClick={onCancel}
          />
          <CustomButton
            text={t("applications.approvalModals.common.confirm")}
            variant="primary"
            customClassName="disposition-approve-confirm-modal__button"
            loading={confirmLoading}
            onClick={onConfirm}
            permissionCode={confirmPermissionCode}
            permissionRoutePath={permissionRoutePath}
          />
        </div>
      </div>
    </Modal>
  )
})
