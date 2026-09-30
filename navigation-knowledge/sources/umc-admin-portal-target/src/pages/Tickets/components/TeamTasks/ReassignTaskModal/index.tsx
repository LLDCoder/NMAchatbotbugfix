import { Form, Modal, Select } from "antd"
import { useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { useTranslation } from "react-i18next"
import "./index.less"
import { CustomButton, CustomMessage } from "@/components/common"
import type { IProps, IReassignTaskModalRef } from "./type"
import type { IMemberSelection } from "../type"
import { getAssigns, putAssign } from "@/services/tickets"

export const ReassignTaskModal = forwardRef<IReassignTaskModalRef, IProps>(
  (props, ref) => {
    const { title, onOkCb, id } = props
    const { t, i18n } = useTranslation()
    const [members, setMembers] = useState<IMemberSelection[]>([])
    const [reassignTaskVisible, setReassignTaskVisible] = useState(false)
    const [form] = Form.useForm()
    const [loading,setLoading] = useState(false);
    useImperativeHandle(ref, () => ({
      show: () => setReassignTaskVisible(true),
    }))

    const reassignTaskUser = async (userId: string) => {
      try {
        if(id){
          const res = await putAssign(id, { userId });
          if(res.data){
            CustomMessage.success(t("Customer.tickets.messages.reassignTaskSuccess"))
          }else {
            CustomMessage.error(t("Customer.tickets.messages.failedToReassignTaskUser"))
          }
        }
      } catch (error) {
        CustomMessage.error(t("Customer.tickets.messages.failedToReassignTaskUser"))
      }
    }

    const getMembers = async () => {
      try {
        // not leave team members
        const mem = await getAssigns()
        setMembers(
          (mem?.data || []).map((item) => ({
            label: i18n.resolvedLanguage === "en" ? item.nameEn : item.nameAr,
            value: item.userId,
          }))
        )
      } catch (error) {
        CustomMessage.error(t("Customer.tickets.messages.failedToGetTeamMembers"))
      }
    }

    const validateBeforeSubmit = () => {
      form
        .validateFields()
        .then(async (values) => {
          try{
            if(id){
              setLoading(true);
              await reassignTaskUser(values.assignPerson)
            }
            onOkCb?.()
            setReassignTaskVisible(false)
          }finally{
            setLoading(false);
          }
        })
        .catch((err) => console.error(err))
    }

    useEffect(() => {
      if (reassignTaskVisible) {
        form.resetFields();
        getMembers();
      }
    }, [reassignTaskVisible])

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
              { required: true, message: t("Customer.tickets.reassign.selectAssignPerson") },
            ]}
          >
            <Select placeholder={t("Customer.tickets.reassign.selectAssignPersonPlaceholder")} options={members} />
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
            loading={loading}
            onClick={() => validateBeforeSubmit()}
          />
        </div>
      </Modal>
    )
  }
)
