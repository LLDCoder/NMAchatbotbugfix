import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react"
import { Modal, Form, Select, Input, Tag } from "antd"
import { CustomButton } from "@/components/common"
import "./index.less"
import type { IFieldType, IRequestModalRef, IRequestProps } from "./type"
import { getTypeDictionaries } from "@/services/serviceApi"
import type { IReason } from "../RejectModal/type"
import {
  applicationMyReviewDetail,
  legacyTaskApprovalAction,
  type IReviewData,
} from "@/services/application"
import { useTranslation } from "react-i18next"

export const RequestModal = forwardRef<IRequestModalRef, IRequestProps>(
  (props, ref) => {
    const { t, i18n } = useTranslation()
    const {
      onOkCb,
      current,
      confirmPermissionCode,
      permissionRoutePath,
    } = props
    const [form] = Form.useForm()
    const [reasons, setReasons] = useState<IReason[]>([])
    const [visible, setVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [fileList, setFileList] = useState<IReviewData["bookList"]>([])
    const approvalComment = Form.useWatch("approvalComment", form) as
      | string
      | undefined
    const APPROVAL_COMMENT_MAX = 1000
    const notes = [
      t("applications.rejectModal.quickNote1"),
      t("applications.rejectModal.quickNote2"),
      t("applications.rejectModal.quickNote3"),
      t("applications.rejectModal.quickNote4"),
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
          setLoading(true)
          const response = await legacyTaskApprovalAction({
            serviceId: current.serviceId,
            applicationId: current.id,
            applicationDetailId: current.applicationDetailId,
            instanceId: current.processInstanceId,
            taskId: current.taskId,
            approvalAction: "Modification",
            approvalComment: values.approvalComment,
            rejectReasonCode: values.rejectReason,
            workflowAction: 200,
          })
          await onOkCb?.(response?.data?.nextTaskId)
          setLoading(false)
          setVisible(false)
        })
        .catch((err) => console.error(err))
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

    const getTaskDetail = useCallback(async () => {
      try {
        const res = await applicationMyReviewDetail(current.taskId)
        setFileList(res.data?.bookList || [])
      } catch (error) {
        console.error("Load task detail failed:", error)
      }
    }, [current.taskId])

    const getReasons = useCallback(async () => {
      try {
        const res = await getTypeDictionaries("ModificationReason")
        setReasons(
          (res?.data || []).map((item) => ({
            label: i18n.language?.startsWith("ar")
              ? item.nameAr || item.nameEn
              : item.nameEn,
            value: item.code,
          }))
        )
      } catch (error) {
        console.error("Load modification reasons failed:", error)
      }
    }, [i18n.language])

    useEffect(() => {
      void getReasons()
    }, [getReasons])

    useEffect(() => {
      return () => {
        form.resetFields()
      }
    }, [form])

    useEffect(() => {
      if (visible) {
        void getTaskDetail()
      }
    }, [getTaskDetail, visible])

    return (
      <Modal
        centered
        className="form-modal request-modal"
        title={t("applications.buttons.requestModification")}
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
              permissionCode={confirmPermissionCode}
              permissionRoutePath={permissionRoutePath}
            />
          </div>
        }
      >
        <Form form={form} layout="vertical" className="custom-form request-form">
          <Form.Item
            name="rejectReason"
            label={t("applications.requestModal.modificationReason")}
            rules={[
              {
                required: true,
                message: t(
                  "applications.requestModal.modificationReasonRequired"
                ),
              },
            ]}
          >
            <Select
              placeholder={t(
                "applications.requestModal.selectModificationReason"
              )}
              className="select-reason"
              options={reasons}
            />
          </Form.Item>
          <Form.Item
            label={t("applications.approvalModals.common.notes")}
            className="request-notes-outer"
          >
            <div className="request-notes-field-wrap">
              <Form.Item name="approvalComment" noStyle>
                <Input.TextArea
                  className="custom-textarea request-notes-textarea"
                  placeholder={t(
                    "applications.approvalModals.common.enterNotes"
                  )}
                  maxLength={APPROVAL_COMMENT_MAX}
                />
              </Form.Item>
              <div className="request-notes-meta-row">
                <span className="request-notes-quick-label">
                  {t("applications.rejectModal.quickNote")}
                </span>
                <span className="request-notes-char-count" aria-live="polite">
                  {(approvalComment?.length ?? 0)}/{APPROVAL_COMMENT_MAX}
                </span>
              </div>
              {quickNoteItems.length ? (
                <div className="notes-list request-notes-tags">
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
  }
)
