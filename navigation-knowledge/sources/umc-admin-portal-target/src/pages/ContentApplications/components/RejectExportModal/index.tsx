import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { Modal, Form, Input } from "antd"
import { CustomButton } from "@/components/common"
import "./index.less"
import type { IFieldType, IRejectExportRef, IRejectExportProps } from "./type"
import { legacyTaskApprovalAction } from "@/services/application"
import { taskApprovalAction } from "@/services/application"
import { useTranslation } from "react-i18next"

export const RejectExportModal = forwardRef<
  IRejectExportRef,
  IRejectExportProps
>((props, ref) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith("ar")
  const { current, onOkCb, confirmPermissionCode, permissionRoutePath } = props
  const [form] = Form.useForm()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
  }))

  const onSubmit = () => {
    form
      .validateFields()
      .then(async (values: IFieldType) => {
        setLoading(true)
        await legacyTaskApprovalAction({
          serviceId: current.serviceId,
          applicationId: current.id,
          applicationDetailId: current.applicationDetailId,
          instanceId: current.processInstanceId,
          taskId: current.taskId,
          approvalAction: "Rejected",
          approvalComment: values.approvalComment,
          rejectReasonCode: values.rejectReason,
          rejectReasonFile: values.rejectReasonFile,
          workflowAction: 200,
        })
        onOkCb?.()
        setLoading(false)
        setVisible(false)
      })
      .catch((err) => console.error(err))
  }

  useEffect(() => {
    // getReasons()
  }, [])

  return (
    <Modal
      centered
      title={t("Content.contentApplications.modals.rejectExport.title")}
      className={`form-modal${isArabic ? " content-applications-modal--rtl" : ""}`}
      visible={visible}
      destroyOnClose
      onCancel={() => setVisible(false)}
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
            onClick={onSubmit}
            permissionCode={confirmPermissionCode}
            permissionRoutePath={permissionRoutePath}
          />
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        className="custom-form reject-export-form"
      >
        <Form.Item
          name="notes"
          label={t("Content.contentApplications.modals.common.notes")}
          rules={[{ required: true, message: t("Content.contentApplications.validation.enterNotes") }]}
        >
          <Input.TextArea
            showCount
            rows={4}
            placeholder={t("Content.contentApplications.modals.common.enterNotes")}
            maxLength={200}
            className="custom-textarea"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
})
