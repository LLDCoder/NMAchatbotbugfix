import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Modal, Form, Select, Input } from "antd";
import { CustomButton, CustomMessage } from "@/components/common";
import "./index.less";
import type {
  IFieldType,
  IReason,
  IExternalApprovalRef,
  IExternalApprovalProps,
} from "./type";
import { approveTask } from "@/services/content";
import { getTypeDictionaries } from "@/services/serviceApi";
import { useTranslation } from "react-i18next";
import { extraTaskApprovalAction } from "@/services/application"

export const ExternalApprovalModal = forwardRef<
  IExternalApprovalRef,
  IExternalApprovalProps
>((props, ref) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.toLowerCase().startsWith("ar");
  const {
    current,
    onOkCb,
    onAfterConfirm,
    type,
    confirmPermissionCode,
    permissionRoutePath,
  } = props;
  const [form] = Form.useForm<IFieldType>();
  const [organizations, setOrganizations] = useState<IReason[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    show: () => {
      form.resetFields();
      setVisible(true);
    },
  }));

  const getOrganizations = async () => {
    try {
      const isArabic = i18n.language?.toLowerCase().startsWith("ar");
      const res = await getTypeDictionaries("ExternalApprovalOrganization");
      setOrganizations(
        (res?.data || []).map((item) => ({
          label: isArabic
            ? item.nameAr || item.nameEn
            : item.nameEn || item.nameAr,
          value: item.code,
        })),
      );
    } catch (error) {
      console.error("Load external approval organizations failed:", error);
    }
  };

  const onSubmit = () => {
    form
      .validateFields()
      .then(async (values: IFieldType) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setLoading(true);
        try {
          let nextTaskId: string | null | undefined;
          if (type === 1) {
            const response = await extraTaskApprovalAction({
              serviceId: current.serviceId,
              applicationId: current.id,
              applicationDetailId: current.applicationDetailId,
              instanceId: current.processInstanceId,
              taskId: current.taskId,
              approvalAction: "ExternalApproval",
              approvalComment: values.notes,
              actionPayload: { organizationCode: values.organization },
              workflowAction: 300,
            });
            nextTaskId = response?.data?.nextTaskId;
          } else {
            const response = await approveTask({
              serviceId: current.serviceId,
              applicationId: current.id,
              applicationDetailId: current.applicationDetailId,
              instanceId: current.processInstanceId,
              taskId: current.taskId,
              approvalAction: "ExternalApproval",
              approvalComment: values.notes,
              actionPayload: { organizationCode: values.organization },
              workflowAction: 300,
            });
            nextTaskId = response?.data?.nextTaskId;
          }
          setVisible(false);
          try {
            await onAfterConfirm?.(values, nextTaskId);
            await onOkCb?.(nextTaskId);
          } catch (refreshError) {
            console.error("External approval refresh failed:", refreshError);
            CustomMessage.error(
              t("applications.approvalModals.common.refreshFailed"),
            );
          }
        } catch (error) {
          console.error("External approval confirmation failed:", error);
          CustomMessage.error(
            t("applications.approvalModals.common.operationFailed"),
          );
        } finally {
          submittingRef.current = false;
          setLoading(false);
        }
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    if (visible) {
      getOrganizations();
    }
  }, [visible, i18n.language]);

  return (
    <Modal
      centered
      title={t("Content.contentApplications.modals.externalApproval.title")}
      className={`form-modal${
        isArabic ? " content-applications-modal--rtl" : ""
      }`}
      visible={visible}
      destroyOnClose
      onCancel={loading ? undefined : () => setVisible(false)}
      footer={
        <div>
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
        className="custom-form external-approval-form"
      >
        <Form.Item
          name="organization"
          label={t(
            "Content.contentApplications.modals.externalApproval.organization",
          )}
          rules={[
            {
              required: true,
              message: t(
                "Content.contentApplications.validation.selectOrganization",
              ),
            },
          ]}
        >
          <Select
            placeholder={t(
              "Content.contentApplications.placeholders.selectOrganization",
            )}
            className="select-reason"
            options={organizations}
          />
        </Form.Item>
        <Form.Item
          name="notes"
          label={t("Content.contentApplications.modals.common.notes")}
        >
          <Input.TextArea
            showCount
            rows={4}
            placeholder={t(
              "Content.contentApplications.modals.common.enterNotes",
            )}
            maxLength={1000}
            className="custom-textarea"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
});
