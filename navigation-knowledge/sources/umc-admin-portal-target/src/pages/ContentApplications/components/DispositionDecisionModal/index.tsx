import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import {
  CustomButton,
  CustomMessage,
  HideFromCustomerFormItem,
} from "@/components/common";
import { getTypeDictionaries } from "@/services/form";
import DocumentViewer from "@/components/common/DocumentViewer";
import WarningGold from "@/assets/icons/WarningGold";
import { documentUpload } from "@/services/serviceApi";
import {
  reviewDispositionCase,
  type DispositionReviewPayload,
} from "@/services/disposition";
import {
  DISPOSITION_APPROVE_WORKFLOW_ACTION,
  DISPOSITION_REJECT_WORKFLOW_ACTION,
  isDispositionVerificationStatus,
  normalizeTaskAttachmentFileName,
  type WorkflowActionIntent,
} from "../../utils/workflowActionRouting";
import { getDispositionModalCopy } from "../../utils/workflowActionModalCopy";
import { WorkflowActionSummary } from "../WorkflowActionSummary";
import { useTranslation } from "react-i18next";
import type {
  IDispositionDecisionModalProps,
  IDispositionDecisionModalRef,
  IFieldType,
  IRejectDispositionReasonOption,
} from "./type";
import "../ApproveModal/index.less";
import { isMaterialStatusRequiredError } from "@/utils/service302MaterialStatus";

interface UploadOptions {
  file: File;
  onSuccess?: (fileName: string) => void;
  onError?: (error: unknown) => void;
}

export const DispositionDecisionModal = forwardRef<
  IDispositionDecisionModalRef,
  IDispositionDecisionModalProps
>((props, ref) => {
  const { current, onOkCb } = props;
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const [visible, setVisible] = useState(false);
  const [intent, setIntent] = useState<WorkflowActionIntent>("approve");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm<IFieldType>();
  const [reasons, setReasons] = useState<IRejectDispositionReasonOption[]>([]);
  const modalCopy = getDispositionModalCopy(intent, t);
  const isDispositionVerification =
    isDispositionVerificationStatus(current?.status) ||
    isDispositionVerificationStatus(current?.taskStatus);
  const shouldShowRejectReason = isDispositionVerification;
  useImperativeHandle(ref, () => ({
    show: (nextIntent) => {
      form.resetFields();
      setIntent(nextIntent);
      setVisible(true);
    },
  }));

  const upload = async (options: UploadOptions) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await documentUpload(formData);
      const uploadedFiles = Array.isArray(res.data) ? res.data : [];
      if (uploadedFiles.length > 0) {
        onSuccess?.(uploadedFiles[0]);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      onError?.(error);
    }
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const dispositionCaseId =
        current?.dispositionCaseId ?? current?.dispositionCase?.caseId;

      if (!dispositionCaseId) {
        CustomMessage.error(
          t("Content.contentApplications.messages.dispositionCaseIdMissing"),
        );
        return;
      }

      setConfirmLoading(true);
      const rejectReasonFile = normalizeTaskAttachmentFileName(
        values.attachment,
      );
      const workflowAction: DispositionReviewPayload["workflowAction"] =
        intent === "approve"
          ? DISPOSITION_APPROVE_WORKFLOW_ACTION
          : DISPOSITION_REJECT_WORKFLOW_ACTION;
      const payload: DispositionReviewPayload = {
        workflowAction,
        reviewerComment: values.notes?.trim() || undefined,
        ...(shouldShowRejectReason ? { rejectReason: values.rejectReason } : {}),
        ...(rejectReasonFile ? { rejectReasonFile } : {}),
        hideFromCustomer: values.hideFromCustomer
          ? values.hideFromCustomer
          : false,
      };
      await reviewDispositionCase(Number(dispositionCaseId), payload);
      onOkCb?.();
      setVisible(false);
      form.resetFields();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }
      console.error("Failed to review content disposition case:", error);
      CustomMessage.error(
        t(
          isMaterialStatusRequiredError(error)
            ? "DataList.validation.assignNewspapersMagazinesStatus"
            : "common.operationFailed",
        ),
      );
    } finally {
      setConfirmLoading(false);
    }
  };
  useEffect(() => {
    if (!visible || !shouldShowRejectReason) {
      return undefined;
    }

    let isActive = true;
    getTypeDictionaries("RejectDispositionReason")
      .then((res) => {
        if (!isActive) {
          return;
        }

        const nextReasons = Array.isArray(res?.data)
          ? res.data.reduce<IRejectDispositionReasonOption[]>(
              (options, item) => {
                const value =
                  item?.code === null || item?.code === undefined
                    ? ""
                    : String(item.code).trim();
                const labelEn =
                  typeof item?.nameEn === "string" ? item.nameEn.trim() : "";
                const labelAr =
                  typeof item?.nameAr === "string" ? item.nameAr.trim() : "";
                const label = isArabic
                  ? labelAr || labelEn
                  : labelEn || labelAr;

                if (value && label) {
                  options.push({ label, value });
                }

                return options;
              },
              [],
            )
          : [];
        setReasons(nextReasons);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        console.error("Load reject disposition reasons failed:", error);
        setReasons([]);
      });

    return () => {
      isActive = false;
    };
  }, [isArabic, shouldShowRejectReason, visible]);

  return (
    <Modal
      title={modalCopy.title}
      visible={visible}
      destroyOnClose
      centered
      className={`form-modal application-action-modal application-disposition-modal${
        isArabic ? " content-applications-modal--rtl" : ""
      }`}
      onCancel={() => setVisible(false)}
      footer={
        <div>
          <CustomButton
            text={t("applications.approvalModals.common.cancel", "Cancel")}
            variant="outline"
            disabled={confirmLoading}
            onClick={() => setVisible(false)}
          />
          <CustomButton
            loading={confirmLoading}
            text={t("applications.approvalModals.common.confirm", "Confirm")}
            variant="primary"
            onClick={onSubmit}
          />
        </div>
      }
    >
      <div className="custom-tips">
        <WarningGold className="warning-icon" />
        <span className="tips-text">{modalCopy.tip}</span>
      </div>
      <WorkflowActionSummary
        title={modalCopy.summaryTitle}
        items={modalCopy.summaryItems}
      />
      <Form form={form} layout="vertical" className="custom-form">
        <HideFromCustomerFormItem
          action={
            intent === "approve"
              ? DISPOSITION_APPROVE_WORKFLOW_ACTION
              : DISPOSITION_REJECT_WORKFLOW_ACTION
          }
        />
        {shouldShowRejectReason && (
          <Form.Item
            name="rejectReason"
            label={t("applications.rejectModal.rejectionReason")}
            rules={[
              {
                required: true,
                message: t("applications.rejectModal.selectRejectionReason"),
              },
            ]}
          >
            <Select
              placeholder={t("applications.rejectModal.selectRejectionReason")}
              className="select-reason"
              options={reasons}
            />
          </Form.Item>
        )}
        <Form.Item name="attachment" label={modalCopy.attachmentLabel}>
          <DocumentViewer
            hasDelete
            hasDownload
            uploadConfig={{
              customRequest: upload,
              maxSize: 5,
              maxCount: 5,
              placeholder: t(
                "applications.approvalModals.common.uploadFile",
                "Upload File",
              ),
              uploadTip: t(
                "applications.approvalModals.common.uploadTip",
                "Maximum Size: 5MB, File Types: jpg, jpeg, png, and pdf.",
              ),
            }}
          />
        </Form.Item>
        <Form.Item name="notes" label={modalCopy.notesLabel}>
          <Input.TextArea
            className="custom-textarea"
            showCount
            placeholder={t(
              "applications.approvalModals.common.enterNotes",
              "Enter notes",
            )}
            maxLength={1000}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
});
