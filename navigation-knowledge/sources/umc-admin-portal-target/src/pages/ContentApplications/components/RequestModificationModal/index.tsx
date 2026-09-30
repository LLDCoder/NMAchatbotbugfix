import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { Modal, Form, Select, Input, Tag } from "antd"
import { CustomButton } from "@/components/common"
import "./index.less"
import type { IFieldType, IRequestModalRef, IRequestProps } from "./type"
import { getTypeDictionaries } from "@/services/serviceApi"
import type { IReason } from "../RejectModal/type"
import {
  approveTask,
  getReviewTaskDetail,
  type IAIFiles,
} from "@/services/content"
import { useTranslation } from "react-i18next"
import { useContentApplicationReviewStore } from "@/store/content-application-review"

export const RequestModificationModal = forwardRef<
  IRequestModalRef,
  IRequestProps
>((props, ref) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const {
    onOkCb,
    current,
    modificationFiles,
  } = props
  const [fileList, setFileList] = useState<IAIFiles[] | undefined>(
    modificationFiles
  )
  const [form] = Form.useForm()
  const [reasons, setReasons] = useState<IReason[]>([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const setIsFirstApprovalRejected = useContentApplicationReviewStore(
    (state) => state.setIsFirstApprovalRejected,
  )
  const approvalComment = Form.useWatch("approvalComment", form) as
    | string
    | undefined
  const APPROVAL_COMMENT_MAX = 1000
  const notes = [
    t("Content.contentApplications.modals.reject.quickNote1"),
    t("Content.contentApplications.modals.reject.quickNote2"),
    t("Content.contentApplications.modals.reject.quickNote3"),
    t("Content.contentApplications.modals.reject.quickNote4"),
  ]

  useImperativeHandle(ref, () => ({
    show: () => {
      form?.resetFields()
      setVisible(true)
    },
  }))

  const onSubmit = () => {
    form
      .validateFields()
      .then(async (values: IFieldType) => {
        const rejectReasonCode = (
          Array.isArray(values.rejectReason)
            ? values.rejectReason
            : [values.rejectReason]
        )
          .map((code) => String(code ?? "").trim())
          .filter(Boolean)
          .join(",")

        setLoading(true)
        try {
          const response = await approveTask({
            serviceId: current.serviceId,
            applicationId: current.id,
            applicationDetailId: current.applicationDetailId,
            instanceId: current.processInstanceId,
            taskId: current.taskId,
            approvalAction: "Modification",
            approvalComment: values.approvalComment,
            rejectReasonCode,
            workflowAction:200
          })
          await onOkCb?.(response?.data?.nextTaskId)
          setVisible(false)
        } finally {
          setLoading(false)
        }
      })
      .catch((err) => console.error(err))
  }

  const getTaskDetail = async () => {
    if (!current.taskId) {
      setIsFirstApprovalRejected(null)
      setFileList([])
      return
    }

    try {
      const res = await getReviewTaskDetail(current.taskId)
      setIsFirstApprovalRejected(res?.data?.isFirstApprovalRejected)
      setFileList(res?.data?.applicationFiles || [])
    } catch (error) {
      setIsFirstApprovalRejected(null)
      console.error("Load task detail failed:", error)
    }
  }

  const getReasons = async () => {
    try {
      const res = await getTypeDictionaries("ModificationReason")
      setReasons(
        (res?.data || []).map((item) => ({
          label: isArabic ? item.nameAr || item.nameEn : item.nameEn || item.nameAr,
          value: item.code,
        }))
      )
    } catch (error) {
      console.error("Load modification reasons failed:", error)
    }
  }

  const appendApprovalComment = (item: string) => {
    const value = (form.getFieldValue("approvalComment") as string) || ""
    const nextValue = value ? `${value};${item}` : item
    if (nextValue.length > APPROVAL_COMMENT_MAX) return
    form.setFieldValue("approvalComment", nextValue)
  }

  const quickNoteItems = [
    ...notes,
    ...(fileList?.map((item) => item.filePath).filter(Boolean) ?? []),
  ]

  useEffect(() => {
    getReasons()
    return () => {
      form.resetFields()
    }
  }, [])

  useEffect(() => {
    // request if no modifications passed when open it
    if (visible && typeof fileList === "undefined") {
      getTaskDetail()
    }
  }, [visible])

  return (
    <Modal
      centered
      title={t("Content.contentApplications.modals.requestModification.title")}
      className={`form-modal request-modification-modal${
        isArabic ? " content-applications-modal--rtl" : ""
      }`}
      visible={visible}
      onCancel={() => setVisible(false)}
      destroyOnClose
      footer={
        <div>
          <CustomButton
            text={t("common.cancel")}
            variant="outline"
            onClick={() => setVisible(false)}
          />
          <CustomButton
            onClick={onSubmit}
            loading={loading}
            text={t("common.confirm")}
            variant="primary"
          />
        </div>
      }
    >
      <Form form={form} layout="vertical" className="custom-form request-modification-form">
        <Form.Item
          name="rejectReason"
          label={t("Content.contentApplications.modals.requestModification.modificationReason")}
          rules={[
            { required: true, message: t("Content.contentApplications.validation.selectModificationReason") },
          ]}
        >
          <Select
            mode="multiple"
            placeholder={t("Content.contentApplications.placeholders.selectModificationReason")}
            className="select-reason"
            options={reasons}
          />
        </Form.Item>
        <Form.Item
          label={t("Content.contentApplications.modals.common.notes")}
          className="request-modification-notes-outer"
        >
          <div className="request-modification-notes-field-wrap">
            <Form.Item name="approvalComment" noStyle>
              <Input.TextArea
                className="custom-textarea request-modification-notes-textarea"
                placeholder={t("Content.contentApplications.modals.common.enterNotes")}
                maxLength={APPROVAL_COMMENT_MAX}
              />
            </Form.Item>
            <div className="request-modification-notes-meta-row">
              <span className="request-modification-notes-quick-label">
                {t("Content.contentApplications.modals.reject.quickNote")}
              </span>
              <span
                className="request-modification-notes-char-count"
                aria-live="polite"
              >
                {(approvalComment?.length ?? 0)}/{APPROVAL_COMMENT_MAX}
              </span>
            </div>
            {quickNoteItems.length ? (
              <div className="notes-list request-modification-notes-tags">
                {quickNoteItems.map((item, index) => (
                  <Tag
                    key={`${item}-${index}`}
                    color="rgba(225, 227, 229, 0.5)"
                    className="note-item"
                    onClick={() => appendApprovalComment(item)}
                  >
                    {item}
                  </Tag>
                ))}
              </div>
            ) : null}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
})
