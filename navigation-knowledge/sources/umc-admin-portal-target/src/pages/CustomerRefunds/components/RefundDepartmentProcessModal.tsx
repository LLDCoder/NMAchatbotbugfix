import React, { useEffect, useMemo, useRef, useState } from "react";
import { Form, Input, Modal, Tooltip, Upload } from "antd";
import type { RcFile } from "antd/lib/upload";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import { fileUpload, getDocumentUploadResponseUrl } from "@/services/media";
import infoCircleIcon from "../assets/icons/change_status_info_circle.svg";
import infoMarkIcon from "../assets/icons/change_status_info_mark.svg";
import radioApproveIcon from "../assets/icons/transfer_decision_approve.svg";
import radioApproveInactiveIcon from "../assets/icons/transfer_decision_approve_inactive.svg";
import radioRejectActiveIcon from "../assets/icons/transfer_decision_reject_active.svg";
import radioRejectIcon from "../assets/icons/transfer_decision_reject.svg";
import uploadIconBase from "../assets/icons/transfer_upload_base.svg";
import uploadIconMain from "../assets/icons/transfer_upload_main.svg";
import RefundAttachments from "./RefundAttachments";
import type {
  RefundAttachment,
  RefundDepartmentActionMode,
  RefundDepartmentActionPayload,
  RefundDepartmentProcessDecision,
  RefundRecord,
} from "../types";
import { buildRefundAttachmentAccessUrl } from "../utils";

interface RefundDepartmentProcessModalProps {
  open: boolean;
  mode: RefundDepartmentActionMode;
  record?: RefundRecord | null;
  onCancel: () => void;
  onSubmit: (payload: RefundDepartmentActionPayload) => Promise<void>;
}

const QUICK_NOTE_KEYS_BY_DECISION: Record<
  RefundDepartmentProcessDecision,
  string[]
> = {
  Approve: [
    "Customer.customerRefunds.departmentModal.quickNotes.approve1",
    "Customer.customerRefunds.departmentModal.quickNotes.approve2",
    "Customer.customerRefunds.departmentModal.quickNotes.approve3",
  ],
  Reject: [
    "Customer.customerRefunds.departmentModal.quickNotes.reject1",
    "Customer.customerRefunds.departmentModal.quickNotes.reject2",
    "Customer.customerRefunds.departmentModal.quickNotes.reject3",
  ],
};

function ModalActionButton({
  children,
  variant,
  onClick,
  disabled = false,
  loading = false,
}: {
  children: React.ReactNode;
  variant: "primary" | "outline";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`refund-modal-action-button is-${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? t("common.loading") : children}
    </button>
  );
}

const RefundDepartmentProcessModal: React.FC<
  RefundDepartmentProcessModalProps
> = ({ open, mode, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const isProcessMode = mode === "process";
  const [form] = Form.useForm<{ notes: string }>();
  const [decision, setDecision] =
    useState<RefundDepartmentProcessDecision | null>(null);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<RefundAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const uploadRevisionRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setDecision(null);
    uploadRevisionRef.current += 1;
    form.resetFields(["notes"]);
    setNotes("");
    setAttachments([]);
  }, [form, mode, open]);

  const beforeUpload = (file: RcFile) => {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".pdf"].includes(extension)) {
      CustomMessage.error(
        t("Customer.customerRefunds.messages.invalidUploadFormat"),
      );
      return false;
    }
    if (file.size / 1024 / 1024 > 5) {
      CustomMessage.error(t("Customer.customerRefunds.messages.fileSizeExceeds"));
      return false;
    }
    if (attachments.length >= 3) {
      CustomMessage.error(t("Customer.customerRefunds.messages.uploadLimit"));
      return false;
    }
    return true;
  };

  const handleUpload = async (options: UploadRequestOption) => {
    const file = options.file as RcFile;
    const uploadRevision = uploadRevisionRef.current;
    const type = file.name
      .slice(file.name.lastIndexOf(".") + 1)
      .toLowerCase() as RefundAttachment["type"];
    const formData = new FormData();
    formData.append("files", file);

    try {
      const response = await fileUpload(formData);
      const uploadedUrl = getDocumentUploadResponseUrl(response);
      if (!uploadedUrl) {
        throw new Error("Upload response did not include a file URL.");
      }
      const nextAttachment: RefundAttachment = {
        id: `${file.uid}-${Date.now()}`,
        name: file.name,
        type,
        filePath: uploadedUrl,
        url: buildRefundAttachmentAccessUrl(uploadedUrl),
      };
      if (uploadRevision !== uploadRevisionRef.current) return;
      setAttachments((prev) => [...prev, nextAttachment]);
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      if (uploadRevision !== uploadRevisionRef.current) return;
      CustomMessage.error(t("Customer.customerRefunds.messages.uploadFailed"));
      options.onError?.(error as Error);
    }
  };

  const quickNotes = useMemo(() => {
    if (!isProcessMode || !decision) return [];
    return QUICK_NOTE_KEYS_BY_DECISION[decision].map((key) => t(key));
  }, [decision, isProcessMode, t]);

  const canSubmit = isProcessMode
    ? Boolean(decision && notes.trim())
    : Boolean(notes.trim());
  const showExtended = !isProcessMode || Boolean(decision);

  const handleUploadTriggerClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (attachments.length < 3) return;
    event.preventDefault();
    event.stopPropagation();
    CustomMessage.error(t("Customer.customerRefunds.messages.uploadLimit"));
  };

  const resetUserInputs = () => {
    uploadRevisionRef.current += 1;
    form.resetFields(["notes"]);
    setNotes("");
    setAttachments([]);
  };

  const handleDecisionSelect = (
    nextDecision: RefundDepartmentProcessDecision,
  ) => {
    if (decision !== nextDecision) {
      resetUserInputs();
    }
    setDecision(nextDecision);
  };

  return (
    <Modal
      visible={open}
      title={t(
        isProcessMode
          ? "Customer.customerRefunds.departmentModal.processTitle"
          : "Customer.customerRefunds.departmentModal.sendBackTitle",
      )}
      onCancel={onCancel}
      width={isProcessMode ? 960 : 800}
      className={`refund-process-modal ${
        showExtended ? "is-complex" : "is-simple"
      } ${isProcessMode ? "is-process" : "is-send-back"}`}
      centered
      footer={
        <div className="refund-modal-footer">
          <ModalActionButton variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </ModalActionButton>
          <ModalActionButton
            variant="primary"
            disabled={isProcessMode && !canSubmit}
            loading={loading}
            onClick={async () => {
              let trimmedNotes = "";
              try {
                const values = await form.validateFields(["notes"]);
                trimmedNotes = values.notes.trim();
              } catch {
                return;
              }
              if (isProcessMode && !decision) return;
              try {
                setLoading(true);
                if (isProcessMode && decision) {
                  await onSubmit({
                    decision,
                    notes: trimmedNotes,
                    attachments,
                  });
                } else {
                  await onSubmit({
                    notes: trimmedNotes,
                    attachments,
                  });
                }
              } finally {
                setLoading(false);
              }
            }}
          >
            {t("common.confirm")}
          </ModalActionButton>
        </div>
      }
    >
      <Form form={form} component={false} initialValues={{ notes: "" }}>
        <div className="refund-process-form">
        {isProcessMode ? (
          <div className="refund-process-field refund-process-field-decision">
            <div className="refund-process-label is-required">
              {t("Customer.customerRefunds.departmentModal.decision")}
            </div>
            <div className="refund-process-decision-group">
              {(["Approve", "Reject"] as RefundDepartmentProcessDecision[]).map(
                (item) => {
                  const checked = decision === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`refund-process-decision-option ${
                        checked ? "is-active" : ""
                      }`}
                      onClick={() => handleDecisionSelect(item)}
                    >
                      <img
                        src={
                          item === "Approve"
                            ? checked
                              ? radioApproveIcon
                              : radioApproveInactiveIcon
                            : checked
                            ? radioRejectActiveIcon
                            : radioRejectIcon
                        }
                        alt=""
                        className="refund-process-decision-icon"
                      />
                      <span>
                        {item === "Approve"
                          ? t("Customer.customerRefunds.departmentModal.approve")
                          : t("Customer.customerRefunds.departmentModal.reject")}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        ) : null}

        {showExtended ? (
          <>
            <div className="refund-process-field">
              <div className="refund-process-label">
                <span>{t("Customer.customerRefunds.departmentModal.attachments")}</span>
                <Tooltip title={t("Customer.customerRefunds.departmentModal.uploadTip")}>
                  <span className="refund-field-info-icon refund-process-field-info-icon">
                    <img
                      src={infoCircleIcon}
                      alt=""
                      className="refund-field-info-circle"
                    />
                    <img
                      src={infoMarkIcon}
                      alt=""
                      className="refund-field-info-mark"
                    />
                  </span>
                </Tooltip>
              </div>
              <Upload
                showUploadList={false}
                beforeUpload={beforeUpload}
                customRequest={handleUpload}
                accept=".jpg,.jpeg,.png,.pdf"
                openFileDialogOnClick={attachments.length < 3}
              >
                <div
                  className="refund-upload-button is-figma refund-process-upload"
                  onClick={handleUploadTriggerClick}
                >
                  <span className="refund-upload-icon refund-process-upload-icon">
                    <img
                      src={uploadIconBase}
                      alt=""
                      className="refund-upload-icon-layer is-base"
                    />
                    <img
                      src={uploadIconMain}
                      alt=""
                      className="refund-upload-icon-layer is-main"
                    />
                  </span>
                  <span>{t("Customer.customerRefunds.actions.uploadFile")}</span>
                </div>
              </Upload>
              {attachments.length ? (
                <div className="refund-process-attachments">
                  <RefundAttachments
                    attachments={attachments}
                    compact
                    variant="decision"
                    onDelete={(attachmentId) => {
                      setAttachments((prev) =>
                        prev.filter((item) => item.id !== attachmentId),
                      );
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="refund-process-field refund-process-notes-field">
              <div className="refund-process-label is-required">
                {t("Customer.profileDetail.modals.notes")}
              </div>
              <div className="refund-process-notes-wrapper">
                <Form.Item
                  name="notes"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: t(
                        "Customer.customerRefunds.messages.fieldRequired",
                      ),
                    },
                  ]}
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea
                    className="refund-process-textarea"
                    maxLength={1000}
                    showCount
                    bordered={true}
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    placeholder={t("Customer.profileDetail.modals.enterNotes")}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </Form.Item>
              </div>
            </div>

            {quickNotes.length ? (
              <div className="refund-process-field no-margin-bottom">
                <div className="refund-process-quick-notes-title">
                  {t("Customer.profileDetail.modals.quickNotes")}
                </div>
                <div className="refund-quick-notes">
                  {quickNotes.map((item, idx) => (
                    <button
                      type="button"
                      key={`refund-process-note-${idx}`}
                      className="refund-quick-note"
                      onClick={() => {
                        const nextNotes = notes
                          ? `${notes}\n${item}`.slice(0, 1000)
                          : item;
                        form.setFieldsValue({ notes: nextNotes });
                        setNotes(nextNotes);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        </div>
      </Form>
    </Modal>
  );
};

export default RefundDepartmentProcessModal;
