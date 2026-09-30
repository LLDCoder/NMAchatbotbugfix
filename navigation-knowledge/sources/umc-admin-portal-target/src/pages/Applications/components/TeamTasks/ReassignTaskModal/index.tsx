import { Form, Modal, Select } from "antd"
import {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
} from "react"
import { useTranslation } from "react-i18next"
import "./index.less"
import { CustomButton, CustomMessage } from "@/components/common"
import type { IProps, IReassignTaskModalRef } from "./type"
import { assignTaskUser, type ITaskIds } from "@/services/application"
import { applicationMyTeamMembers } from "@/services/team"
import type { IMemberSelection } from "../type"

export const ReassignTaskModal = forwardRef<IReassignTaskModalRef, IProps>(
  (props, ref) => {
    const { title, onOkCb, taskIds } = props
    const { t } = useTranslation()
    const [members, setMembers] = useState<IMemberSelection[]>([])
    const [reassignTaskVisible, setReassignTaskVisible] = useState(false)
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)

    useImperativeHandle(ref, () => ({
      show: () => setReassignTaskVisible(true),
    }))

    const reassignTaskUser = async (userId: string, data: ITaskIds) => {
      try {
        await assignTaskUser(userId, data)
        CustomMessage.success(
          t("applications.teamModals.messages.reassignSuccess")
        )
      } catch {
        CustomMessage.error(
          t("applications.teamModals.messages.reassignFailed")
        )
      }
    }

    const getMembers = useCallback(async () => {
      try {
        // not leave team members
        const mem = await applicationMyTeamMembers(true)
        setMembers(
          (mem?.data || []).map((item) => ({
            label: item.userName,
            value: item.userId,
          }))
        )
      } catch {
        CustomMessage.error(
          t("applications.teamModals.messages.membersLoadFailed")
        )
      }
    }, [t])

    const validateBeforeSubmit = async () => {
      setLoading(true)
      try {
        const values = await form.validateFields()
        await reassignTaskUser(values.assignPerson, taskIds)
        onOkCb?.()
        setReassignTaskVisible(false)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => {
      return () => {
        if (reassignTaskVisible) {
          form.setFieldsValue({
            leaveType: "",
            expectedReturnDate: "",
            briefDescription: "",
          })
        }
      }
    }, [form, reassignTaskVisible])

    useEffect(() => {
      if (reassignTaskVisible) {
        void getMembers()
      }
    }, [getMembers, reassignTaskVisible])

    return (
      <Modal
        centered
        title={
          <b>
            {t("applications.buttons.reassignTasks")}
            {title}
          </b>
        }
        visible={reassignTaskVisible}
        className="reassign-task-modal"
        onCancel={() => setReassignTaskVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            required
            label={t("applications.labels.assignPerson")}
            name="assignPerson"
            rules={[
              {
                required: true,
                message: t(
                  "applications.teamModals.reassign.assignPersonRequired"
                ),
              },
            ]}
          >
            <Select
            className="umc-select-arrow-manual"
              filterOption={(inputValue, option) => {
                if (!option) {
                  return false
                }
                const { label } = option
                return (
                  label.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                )
              }}
              showSearch
              allowClear
              placeholder={t(
                "applications.teamModals.reassign.selectAssignPerson"
              )}
              options={members}
            />
          </Form.Item>
        </Form>
        <div className="modal-footer">
          <CustomButton
            text={t("common.cancel")}
            variant="secondary"
            onClick={() => setReassignTaskVisible(false)}
          />
          <CustomButton
            text={t("common.confirm")}
            variant="primary"
            onClick={() => validateBeforeSubmit()}
          />
        </div>
      </Modal>
    )
  }
)
