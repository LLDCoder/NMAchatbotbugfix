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
    const { t } = useTranslation()
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
        CustomMessage.success(t("common.operationSuccess"))
      } catch {
        CustomMessage.error(t("Customer.tickets.messages.failedToMarkEmergencyLeave"))
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
        className="mark-emg-leave-modal"
        onCancel={() => setMarkEmgLeaveVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="custom-form">
          <Form.Item<IFieldType>
            required
            label={t("Customer.tickets.markEmgLeave.leaveType")}
            name="leaveType"
            rules={[{ required: true, message: t("Customer.tickets.markEmgLeave.selectLeaveType") }]}
          >
            <Select placeholder={t("Customer.tickets.markEmgLeave.selectLeaveTypePlaceholder")} options={leaveTypes} />
          </Form.Item>
          <Form.Item<IFieldType>
            required
            label={t("Customer.tickets.markEmgLeave.expectedReturnDate")}
            name="expectedReturnDate"
            rules={[{ required: true, message: t("Customer.tickets.markEmgLeave.selectDate") }]}
          >
            <DatePicker placeholder={t("Customer.tickets.markEmgLeave.datePlaceholder")} showTime />
          </Form.Item>
          <Form.Item<IFieldType>
            label={t("Customer.tickets.markEmgLeave.briefDescription")}
            name="briefDescription"
          >
            <Input.TextArea
              className="brief-description"
              placeholder={t("Customer.tickets.markEmgLeave.enterBriefDescription")}
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
