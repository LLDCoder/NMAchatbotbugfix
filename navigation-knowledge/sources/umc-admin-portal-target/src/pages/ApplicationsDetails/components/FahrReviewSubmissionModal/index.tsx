import React, { useEffect, useState } from "react";
import { Form, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";
import type { UploadProps } from "antd/lib/upload";
import { CustomButton } from "@/components/common";
import FileUpload, {
  type FileItem,
} from "@/components/common/FileUpload";
import { fileUpload, getDocumentUploadResponseUrl } from "@/services/media";
import "./index.less";

const NOTES_MAX_LENGTH = 1000;
const FAHR_ATTACHMENT_MAX_SIZE_MB = 2;

export type FahrReviewSubmissionMode = "resubmit" | "reconsider";

export interface FahrReviewSubmissionPayload {
  notes?: string;
  attachments: FileItem[];
}

interface FahrReviewSubmissionFormValues {
  notes?: string;
}

interface FahrReviewSubmissionModalProps {
  visible: boolean;
  mode: FahrReviewSubmissionMode;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (payload: FahrReviewSubmissionPayload) => Promise<void> | void;
  uploadRequest?: NonNullable<UploadProps["customRequest"]>;
}

class FahrDocumentUploadError extends Error {
  constructor() {
    super("FAHR document upload failed.");
    this.name = "FahrDocumentUploadError";
  }
}

const defaultUploadRequest: NonNullable<UploadProps["customRequest"]> = async (
  options,
) => {
  const { file, onSuccess, onError } = options;

  try {
    const uploadFile = file as File;
    const formData = new FormData();
    formData.append("files", uploadFile);
    const response = await fileUpload(formData);
    const url = getDocumentUploadResponseUrl(response);
    if (!url) throw new FahrDocumentUploadError();
    onSuccess?.({
      url,
      name: uploadFile.name,
    });
  } catch (error) {
    onError?.(
      error instanceof Error ? error : new FahrDocumentUploadError(),
    );
  }
};

const FahrReviewSubmissionModal: React.FC<
  FahrReviewSubmissionModalProps
> = ({
  visible,
  mode,
  loading = false,
  onCancel,
  onConfirm,
  uploadRequest = defaultUploadRequest,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<FahrReviewSubmissionFormValues>();
  const [attachments, setAttachments] = useState<FileItem[]>([]);
  const copy = (() => {
    switch (mode) {
      case "resubmit":
        return {
          title: t("Licensing.fahrReview.submission.resubmitTitle"),
          notesLabel: t("Licensing.fahrReview.submission.notes"),
          attachmentLabel: t("Licensing.fahrReview.submission.attachment"),
          placeholder: t(
            "Licensing.fahrReview.submission.resubmitPlaceholder",
          ),
        };
      case "reconsider":
      default:
        return {
          title: t("Licensing.fahrReview.submission.reconsiderTitle"),
          notesLabel: t("Licensing.fahrReview.submission.notes"),
          attachmentLabel: t("Licensing.fahrReview.submission.attachment"),
          placeholder: t(
            "Licensing.fahrReview.submission.reconsiderPlaceholder",
          ),
        };
    }
  })();
  const isNotesRequired = true;
  const isAttachmentRequired = true;
  const isConfirmDisabled =
    loading ||
    (isAttachmentRequired && attachments.length !== 1);
  const maxAttachmentCount = isAttachmentRequired ? 1 : undefined;

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setAttachments([]);
    }
  }, [form, visible, mode]);

  const handleSubmit = async () => {
    if (loading) return;

    try {
      const values = await form.validateFields();
      await onConfirm({
        notes: values.notes?.trim() || undefined,
        attachments,
      });
    } catch (error) {
      if (!(error as { errorFields?: unknown[] })?.errorFields) {
        console.error("Failed to submit FAHR review response:", error);
      }
    }
  };

  return (
    <Modal
      title={copy.title}
      visible={visible}
      width={640}
      centered
      destroyOnClose
      closable={!loading}
      maskClosable={!loading}
      keyboard={!loading}
      className="form-modal fahr-review-submission-modal"
      onCancel={loading ? undefined : onCancel}
      footer={
        <div>
          <CustomButton
            text={t("common.cancel")}
            variant="outline"
            disabled={loading}
            onClick={onCancel}
            customClassName="fahr-review-submission-modal__action"
          />
          <CustomButton
            text={t("common.confirm")}
            variant="primary"
            loading={loading}
            disabled={isConfirmDisabled}
            onClick={handleSubmit}
            customClassName="fahr-review-submission-modal__action"
          />
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        className="fahr-review-submission-modal__form"
      >
        <Form.Item
          name="notes"
          label={copy.notesLabel}
          rules={[
            ...(isNotesRequired
              ? [
                  {
                    required: true,
                    whitespace: true,
                    message: t("Licensing.fahrReview.submission.notesRequired"),
                  },
                ]
              : []),
            {
              max: NOTES_MAX_LENGTH,
              message: t("Licensing.fahrReview.submission.notesMax", {
                max: NOTES_MAX_LENGTH,
              }),
            },
          ]}
        >
          <Input.TextArea
            className="fahr-review-submission-modal__textarea"
            showCount
            maxLength={NOTES_MAX_LENGTH}
            disabled={loading}
            placeholder={copy.placeholder}
          />
        </Form.Item>

        <Form.Item
          label={copy.attachmentLabel}
          required={isAttachmentRequired}
        >
          <FileUpload
            value={attachments}
            onChange={setAttachments}
            customRequest={uploadRequest}
            maxCount={maxAttachmentCount}
            maxSize={FAHR_ATTACHMENT_MAX_SIZE_MB}
            accept=".jpg,.jpeg,.png,.pdf"
            placeholder={t("Licensing.fahrReview.submission.uploadFile")}
            uploadTip={t("Licensing.fahrReview.submission.uploadTip")}
            disabled={loading}
            isSingle
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FahrReviewSubmissionModal;
