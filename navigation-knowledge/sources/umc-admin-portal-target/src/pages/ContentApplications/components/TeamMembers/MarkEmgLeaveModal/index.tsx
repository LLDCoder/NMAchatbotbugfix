import { DatePicker, Form, Input, Modal, Select } from "antd"
import { useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { useTranslation } from "react-i18next"
import type { IMarkEmgLeaveModalRef } from "../type"
import "./index.less"
import { CustomButton, CustomMessage } from "@/components/common"
import type { IFieldType, ILeaveType, IProps } from "./type"
import { getTypeDictionaries } from "@/services/serviceApi"
import { applicationMyTeamMemberLeave } from "@/services/team"

export const MarkEmgLeaveModal = forwardRef<IMarkEmgLeaveModalRef, IProps>(
  (props, ref) => {
    const { onOkCb, userId } = props
    const { t, i18n } = useTranslation()
    const isArabic = i18n.language?.startsWith("ar")
    const [markEmgLeaveVisible, setMarkEmgLeaveVisible] = useState(false)
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)
    const [leaveTypes, setLeaveTypes] = useState<ILeaveType[]>([])

    useImperativeHandle(ref, () => ({
      show: () => {
        form.resetFields()
        setMarkEmgLeaveVisible(true)
      },
    }))

    const getLeaveTypes = async () => {
      const res = await getTypeDictionaries("LeaveTypes")
      if (res?.data?.length) {
        setLeaveTypes(
          res?.data?.map((item) => ({
            label: item.nameEn,
            value: item.code,
          }))
        )
      }
    }

    const markEmergencyLeave = async (values: IFieldType) => {
      try {
        const reqParams = {
          userId,
          leaveType: values?.leaveType,
          expectedReturnDate: values?.expectedReturnDate,
          briefDescription: values?.briefDescription,
        }
        await applicationMyTeamMemberLeave(reqParams)
        CustomMessage.success(t("Content.contentApplications.messages.operationSuccess"))
      } catch {
        CustomMessage.error(t("Content.contentApplications.messages.failedToMarkEmergencyLeave"))
      }
    }

    const validateBeforeSubmit = () => {
      form
        .validateFields()
        .then(async (values: IFieldType) => {
          setLoading(true)
          await markEmergencyLeave(values)
          onOkCb?.(values)
          setLoading(false)
          setMarkEmgLeaveVisible(false)
        })
        .catch((err) => console.error(err))
    }

    useEffect(() => {
      if (!markEmgLeaveVisible) return
      void getLeaveTypes()
    }, [markEmgLeaveVisible])

    return (
      <Modal
        centered
        title={<b>{t("applications.buttons.markEmergencyLeave")}</b>}
        visible={markEmgLeaveVisible}
        className={`mark-emg-leave-modal${
          isArabic ? " content-applications-modal--rtl" : ""
        }`}
        onCancel={() => setMarkEmgLeaveVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="custom-form">
          <Form.Item<IFieldType>
            required
            label={t("Content.contentApplications.form.leaveType")}
            name="leaveType"
            rules={[{ required: true, message: t("Content.contentApplications.validation.selectLeaveType") }]}
          >
            <Select placeholder={t("Content.contentApplications.placeholders.selectLeaveType")} options={leaveTypes} />
          </Form.Item>
          <Form.Item<IFieldType>
            required
            label={t("Content.contentApplications.form.expectedReturnDate")}
            name="expectedReturnDate"
            rules={[{ required: true, message: t("Content.contentApplications.validation.selectDate") }]}
          >
            <DatePicker placeholder={t("Content.contentApplications.placeholders.expectedReturnDate")} showTime />
          </Form.Item>
          <Form.Item<IFieldType>
            label={t("Content.contentApplications.form.briefDescription")}
            name="briefDescription"
          >
            <Input.TextArea
              className="brief-description"
              placeholder={t("Content.contentApplications.placeholders.enterBriefDescription")}
              maxLength={1000}
              showCount
              rows={4}
            />
          </Form.Item>
        </Form>
        <div className="modal-footer">
          <CustomButton
            text={t("common.cancel")}
            variant="secondary"
            onClick={() => setMarkEmgLeaveVisible(false)}
          />
          <CustomButton
            text={t("common.confirm")}
            variant="primary"
            loading={loading}
            onClick={() => validateBeforeSubmit()}
          />
        </div>
      </Modal>
    )
  }
)
