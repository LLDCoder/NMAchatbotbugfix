import { Form, Modal, Select } from "antd"
import { useState, forwardRef, useImperativeHandle, useEffect } from "react"
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
    const { t, i18n } = useTranslation()
    const isArabic = i18n.language?.startsWith("ar")
    const [members, setMembers] = useState<IMemberSelection[]>([])
    const [reassignTaskVisible, setReassignTaskVisible] = useState(false)
    const [form] = Form.useForm()

    useImperativeHandle(ref, () => ({
      show: () => setReassignTaskVisible(true),
    }))

    const reassignTaskUser = async (userId: string, data: ITaskIds) => {
      try {
        await assignTaskUser(userId, data)
        CustomMessage.success(t("Content.contentApplications.messages.reassignTaskSuccess"))
      } catch {
        CustomMessage.error(t("Content.contentApplications.messages.failedToReassignTaskUser"))
      }
    }

    const getMembers = async () => {
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
        CustomMessage.error(t("Content.contentApplications.messages.failedToGetTeamMembers"))
      }
    }

    const validateBeforeSubmit = () => {
      form
        .validateFields()
        .then(async (values) => {
          await reassignTaskUser(values.assignPerson, taskIds)
          onOkCb?.()
          setReassignTaskVisible(false)
        })
        .catch((err) => console.error(err))
    }

    useEffect(() => {
      if (reassignTaskVisible) {
        form.setFieldsValue({
          assignPerson: "",
        })
        getMembers()
      }
    }, [reassignTaskVisible, form])

    useEffect(() => {
      return () => {
        if (reassignTaskVisible) {
          form.setFieldsValue({
            leaveType: "",
            expectedReturnDate: "",
            briefDescription: "",
            assignPerson: "",
          })
        }
      }
    }, [form, reassignTaskVisible])

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
        className={`reassign-task-modal${
          isArabic ? " content-applications-modal--rtl" : ""
        }`}
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
              { required: true, message: t("Content.contentApplications.validation.selectAssignPerson") },
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => {
                const label = option?.label
                const text =
                  typeof label === "string" ? label : String(label ?? "")
                const q = input.trim().toLowerCase()
                if (!q) return true
                return text.toLowerCase().includes(q)
              }}
              placeholder={t(
                "Content.contentApplications.placeholders.selectAssignPerson",
              )}
              options={members}
              className="umc-select-arrow-manual"
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
