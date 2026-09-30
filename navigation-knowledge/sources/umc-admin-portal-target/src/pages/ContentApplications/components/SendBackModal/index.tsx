import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react"
import { Modal, Form, Select, Input } from "antd"
import { CustomButton } from "@/components/common"
import "./index.less"
import type {
  IFieldType,
  INode,
  ISendBackModalRef,
  ISendBackProps,
} from "./type"
import { getFallbackNode, sendBackTask } from "@/services/camundaTask"
import { useTranslation } from "react-i18next"

const SEND_BACK_FORM_ID = "content-send-back-form"

export const SendBackModal = forwardRef<ISendBackModalRef, ISendBackProps>(
  (props, ref) => {
    const { t, i18n } = useTranslation()
    const isArabic = i18n.language?.startsWith("ar")
    const { current, onOkCb, confirmPermissionCode, permissionRoutePath } = props
    const [form] = Form.useForm<IFieldType>()
    const [fallbackNodes, setFallbackNodes] = useState<INode[]>([])
    const [visible, setVisible] = useState(false)
    const [loading, setLoading] = useState(false)

    useImperativeHandle(ref, () => ({
      show: () => {
        form.resetFields()
        setVisible(true)
      },
    }))

    const onSubmit = async (values: IFieldType) => {
      if (loading) return
      setLoading(true)
      try {
        await sendBackTask({
          serviceId: current.serviceId,
          applicationId: current.id,
          applicationDetailId: current.applicationDetailId,
          instanceId: current.processInstanceId,
          currentTaskId: current.taskId,
          rollbackNodeId: values.fallbackNode,
          remarks: values.notes?.trim() ?? "",
        })
        onOkCb?.()
        setVisible(false)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    const getFallbackData = useCallback(async () => {
      try {
        // Backend returns the human-passed user-task nodes (Approval / RejectedWithReview),
        // excluding the current active node. An empty result means there is no upstream node to
        // send back to (e.g. still on the first/only node), which the dropdown shows as no options.
        const res = await getFallbackNode({
          instanceId: current.processInstanceId,
          serviceId: current.serviceId,
        })
        setFallbackNodes((res?.data || []).map((item) => ({
          label: item.nodeName,
          value: item.taskDefinitionKey,
        })))
      } catch (error) {
        console.error(error)
      }
    }, [current.processInstanceId, current.serviceId])

    useEffect(() => {
      if (visible) {
        getFallbackData()
      }
    }, [getFallbackData, visible])

    return (
      <Modal
        title={t("Content.contentApplications.modals.sendBack.title")}
        className={`form-modal send-back-modal${
          isArabic ? " content-applications-modal--rtl" : ""
        }`}
        visible={visible}
        centered
        destroyOnClose
        onCancel={() => setVisible(false)}
        footer={
          <div className="send-back-modal__footer">
            <CustomButton
              text={t("common.cancel")}
              variant="outline"
              disabled={loading}
              onClick={() => setVisible(false)}
            />
            <CustomButton
              loading={loading}
              text={t("common.confirm")}
              variant="primary"
              disabled={loading}
              htmlType="submit"
              form={SEND_BACK_FORM_ID}
              customClassName="send-back-modal__confirm-button"
              permissionCode={confirmPermissionCode}
              permissionRoutePath={permissionRoutePath}
            />
          </div>
        }
      >
        <Form<IFieldType>
          id={SEND_BACK_FORM_ID}
          form={form}
          layout="vertical"
          className="custom-form send-back-form"
          onFinish={onSubmit}
        >
          <Form.Item
            name="fallbackNode"
            required
            label={t("Content.contentApplications.modals.sendBack.fallbackNode")}
            rules={[
              { required: true, message: t("Content.contentApplications.validation.selectFallbackNode") },
            ]}
          >
            <Select
              placeholder={t("Content.contentApplications.placeholders.selectNode")}
              className="select-reason"
              options={fallbackNodes}
            />
          </Form.Item>
          <Form.Item
            name="notes"
            label={t("Content.contentApplications.modals.common.notes")}
          >
            <Input.TextArea
              showCount
              placeholder={t("Content.contentApplications.modals.common.enterNotes")}
              maxLength={1000}
              className="custom-textarea"
            />
          </Form.Item>
        </Form>
      </Modal>
    )
  }
)
