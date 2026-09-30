import { DatePicker, Form, Input, Modal, Select } from "antd"
import {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
} from "react"
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

    const getLeaveTypes = useCallback(async () => {
      const res = await getTypeDictionaries("LeaveTypes")
      if (res?.data?.length) {
        setLeaveTypes(
          res?.data?.map((item) => ({
            label: i18n.language?.startsWith("ar")
              ? item.nameAr || item.nameEn
              : item.nameEn,
            value: item.code,
          }))
        )
      }
    }, [i18n.language])

    const markEmergencyLeave = async (values: IFieldType) => {
      try {
        const reqParams = {
          userId,
          leaveType: values?.leaveType,
          expectedReturnDate: values?.expectedReturnDate,
          briefDescription: values?.briefDescription,
        }
        await applicationMyTeamMemberLeave(reqParams)
        CustomMessage.success(t("applications.teamModals.messages.operationSuccess"))
      } catch {
        CustomMessage.error(
          t("applications.teamModals.messages.emergencyLeaveFailed")
        )
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
    }, [getLeaveTypes, markEmgLeaveVisible])

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
        <Form form={form} layout="vertical">
          <Form.Item<IFieldType>
            required
            label={t("applications.teamModals.leave.type")}
            name="leaveType"
            rules={[
              {
                required: true,
                message: t("applications.teamModals.leave.typeRequired"),
              },
            ]}
          >
            <Select
              allowClear
              placeholder={t("applications.teamModals.leave.selectType")}
              options={leaveTypes}
            />
          </Form.Item>
          <Form.Item<IFieldType>
            required
            label={t("applications.teamModals.leave.expectedReturnDate")}
            name="expectedReturnDate"
            rules={[
              {
                required: true,
                message: t("applications.teamModals.leave.dateRequired"),
              },
            ]}
          >
            <DatePicker
              placeholder={t("applications.teamModals.leave.datePlaceholder")}
              showTime
            />
          </Form.Item>
          <Form.Item<IFieldType>
            label={t("applications.approvalModals.common.notes")}
            name="briefDescription"
          >
            <Input.TextArea
              className="brief-description"
              placeholder={t("applications.approvalModals.common.enterNotes")}
              showCount
              maxLength={1000}
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
