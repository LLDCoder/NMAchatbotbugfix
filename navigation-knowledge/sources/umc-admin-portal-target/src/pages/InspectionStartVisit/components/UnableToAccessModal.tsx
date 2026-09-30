import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Tooltip, Upload } from 'antd';
import type { RcFile } from 'antd/lib/upload';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { useTranslation } from 'react-i18next';
import { CustomMessage } from '@/components/common';
import { UPLOAD_LIMITS } from '@/constants/uploadLimits';
import type { InspectionTaskAttachmentPayload } from '@/services/inspection';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';
import { formatInspectionAttachmentFileTypes } from '@/pages/InspectionCommon/constants';
import { uploadInspectionFile } from '@/pages/InspectionCommon/upload';
import InspectionAttachmentGrid from './InspectionAttachmentGrid';

export type UnableToAccessReasonOption = {
  value: string;
  label: string;
};

export type UnableToAccessModalValue = {
  reason: string;
  remark: string;
  attachments: InspectionTaskAttachmentPayload[];
};

type UnableToAccessModalProps = {
  visible: boolean;
  value: UnableToAccessModalValue;
  reasonOptions: UnableToAccessReasonOption[];
  reasonOptionsLoading?: boolean;
  remarkRequired: boolean;
  submitting: boolean;
  onChange: (value: UnableToAccessModalValue) => void;
  onCancel: () => void;
  onSubmit: (value: UnableToAccessModalValue) => void | Promise<void>;
};

const ACCEPTED_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const ATTACHMENT_ACCEPT = '.jpg,.jpeg,.png,.pdf';
const MAX_ATTACHMENT_SIZE_MB = 5;
const MAX_ATTACHMENT_COUNT = UPLOAD_LIMITS.MULTI_ATTACHMENT;

const getFormValue = (value: UnableToAccessModalValue) => ({
  ...value,
  reason: value.reason || undefined,
});

const buildRequiredLabel = (
  label: string,
  required: boolean,
  extra?: React.ReactNode,
) => (
  <span className="inspection-start-visit__unable-modal-label">
    <span>{label}</span>
    {extra}
    {required ? <em>*</em> : null}
  </span>
);

const renderChecklistHelpIcon = (title: string) => (
  <Tooltip title={title} placement="top" trigger={['hover', 'focus']}>
    <span className="inspection-start-visit__checklist-help-icon" tabIndex={0} aria-label={title}>
      <img className="inspection-start-visit__checklist-help-circle" src={inspectionFigmaAssets.checklist.helpCircle} alt="" />
      <img className="inspection-start-visit__checklist-help-mark" src={inspectionFigmaAssets.checklist.helpMark} alt="" />
    </span>
  </Tooltip>
);

const renderUploadIcon = () => (
  <span className="inspection-start-visit__checklist-upload-icon" aria-hidden="true">
    <img className="inspection-start-visit__checklist-upload-cloud" src={inspectionFigmaAssets.checklist.uploadCloud} alt="" />
    <img className="inspection-start-visit__checklist-upload-arrow" src={inspectionFigmaAssets.checklist.uploadArrow} alt="" />
  </span>
);

const UnableToAccessModal: React.FC<UnableToAccessModalProps> = ({
  visible,
  value,
  reasonOptions,
  reasonOptionsLoading = false,
  remarkRequired,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm<UnableToAccessModalValue>();
  const [uploading, setUploading] = useState(false);
  const [showAttachmentValidationError, setShowAttachmentValidationError] = useState(false);
  const submitButtonInactive = useMemo(() => (
    submitting ||
    uploading ||
    !value.reason ||
    !value.attachments.length ||
    (remarkRequired && !value.remark.trim())
  ), [remarkRequired, submitting, uploading, value.attachments.length, value.reason, value.remark]);
  const submitButtonClassName = submitButtonInactive
    ? 'inspection-start-visit__primary-button inspection-start-visit__unable-modal-action inspection-start-visit__primary-button--visual-disabled'
    : 'inspection-start-visit__primary-button inspection-start-visit__unable-modal-action';

  useEffect(() => {
    form.setFieldsValue(getFormValue(value));
  }, [form, value]);

  useEffect(() => {
    if (!visible || value.attachments.length) {
      setShowAttachmentValidationError(false);
    }
  }, [value.attachments.length, visible]);

  const handleValuesChange = (changedValues: Partial<UnableToAccessModalValue>, allValues: UnableToAccessModalValue) => {
    if (Object.prototype.hasOwnProperty.call(changedValues, 'reason')) {
      form.setFields([{ name: 'remark', errors: [] }]);
    }

    onChange({
      reason: allValues.reason || '',
      remark: allValues.remark || '',
      attachments: value.attachments || [],
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (uploading) {
      CustomMessage.warning(t('inspection.execution.messages.uploadInProgress'));
      return;
    }

    if (!value.attachments.length) {
      setShowAttachmentValidationError(true);
    }

    let values: UnableToAccessModalValue;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    if (!value.attachments.length) {
      return;
    }

    await onSubmit({
      reason: values.reason || '',
      remark: values.remark || '',
      attachments: value.attachments || [],
    });
  };

  const handleAttachmentDelete = (_attachment: unknown, index: number) => {
    const nextAttachments = value.attachments.filter((_item, itemIndex) => itemIndex !== index);
    onChange({
      reason: form.getFieldValue('reason') || '',
      remark: form.getFieldValue('remark') || '',
      attachments: nextAttachments,
    });
  };

  const beforeUpload = (file: RcFile) => {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      CustomMessage.error(t('inspection.tasks.messages.invalidAttachmentFileType', {
        fileTypes: formatInspectionAttachmentFileTypes(ACCEPTED_ATTACHMENT_EXTENSIONS, i18n.language),
      }));
      return Upload.LIST_IGNORE;
    }
    if (file.size / 1024 / 1024 > MAX_ATTACHMENT_SIZE_MB) {
      CustomMessage.error(t('inspection.tasks.messages.attachmentFileSizeExceeded', { maxSize: MAX_ATTACHMENT_SIZE_MB }));
      return Upload.LIST_IGNORE;
    }
    if (value.attachments.length >= MAX_ATTACHMENT_COUNT) {
      CustomMessage.error(t('inspection.tasks.messages.attachmentUploadLimit', { maxCount: MAX_ATTACHMENT_COUNT }));
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleUpload = async (options: UploadRequestOption) => {
    const file = options.file as RcFile;
    setUploading(true);
    try {
      const uploadResult = await uploadInspectionFile(file);
      const nextAttachment: InspectionTaskAttachmentPayload = {
        fileName: uploadResult.fileName,
        fileUrl: uploadResult.fileUrl,
        contentType: uploadResult.contentType,
        attachmentCategory: 'AccessFailed',
      };
      onChange({
        reason: form.getFieldValue('reason') || '',
        remark: form.getFieldValue('remark') || '',
        attachments: [...value.attachments, nextAttachment],
      });
      options.onSuccess?.(nextAttachment);
    } catch (error) {
      CustomMessage.error(t('inspection.tasks.messages.attachmentUploadFailed'));
      options.onError?.(error as Error);
    } finally {
      setUploading(false);
    }
  };

  if (!visible) {
    return <Form form={form} className="inspection-start-visit__form-bridge" />;
  }

  return (
    <Modal
      title={t('inspection.execution.unableToAccess')}
      visible={visible}
      onCancel={onCancel}
      centered
      destroyOnClose
      forceRender
      maskClosable={!submitting}
      confirmLoading={submitting}
      className="inspection-start-visit__standard-modal inspection-start-visit__unable-modal"
      footer={(
        <div className="inspection-start-visit__modal-footer-actions">
          <Button className="inspection-start-visit__outline-button inspection-start-visit__unable-modal-action" disabled={submitting} onClick={onCancel}>
            {t('inspection.common.cancel')}
          </Button>
          <Button
            className={submitButtonClassName}
            aria-disabled={submitButtonInactive}
            loading={submitting}
            onClick={handleSubmit}
          >
            {t('inspection.common.submit')}
          </Button>
        </div>
      )}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="inspection-start-visit__unable-modal-form"
        onValuesChange={handleValuesChange}
      >
        <Form.Item
          className="inspection-start-visit__unable-modal-field"
          label={buildRequiredLabel(t('inspection.execution.failureReason'), true)}
          name="reason"
          rules={[{ required: true, message: t('inspection.execution.messages.accessReasonRequired') }]}
        >
          <Select allowClear loading={reasonOptionsLoading} placeholder={t('inspection.execution.selectReason')}>
            {reasonOptions.map((reason) => (
              <Select.Option key={reason.value} value={reason.value}>
                {reason.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          className="inspection-start-visit__unable-modal-field inspection-start-visit__unable-modal-upload"
          label={buildRequiredLabel(
            t('inspection.execution.attachEvidencePhotos'),
            true,
            renderChecklistHelpIcon(t('inspection.execution.accessAttachmentTooltip')),
          )}
          validateStatus={showAttachmentValidationError && !value.attachments.length ? 'error' : undefined}
          help={showAttachmentValidationError && !value.attachments.length ? t('inspection.execution.messages.accessAttachmentRequired') : undefined}
        >
          <Upload
            accept={ATTACHMENT_ACCEPT}
            beforeUpload={beforeUpload}
            customRequest={handleUpload}
            disabled={uploading || submitting || value.attachments.length >= MAX_ATTACHMENT_COUNT}
            maxCount={MAX_ATTACHMENT_COUNT}
            showUploadList={false}
          >
            <Button
              className="inspection-start-visit__unable-modal-upload-button"
              disabled={uploading || submitting || value.attachments.length >= MAX_ATTACHMENT_COUNT}
              icon={renderUploadIcon()}
            >
              {t('inspection.tasks.fields.uploadFile')}
            </Button>
          </Upload>
        </Form.Item>
        {value.attachments.length ? (
          <InspectionAttachmentGrid
            attachments={value.attachments}
            className="inspection-start-visit__unable-modal-attachment-grid"
            onDelete={handleAttachmentDelete}
          />
        ) : null}
        <Form.Item
          className="inspection-start-visit__unable-modal-field inspection-start-visit__unable-modal-field--wide"
          label={buildRequiredLabel(t('inspection.execution.remark'), remarkRequired)}
          name="remark"
          rules={[
            () => ({
              validator: (_, remark: string = '') => {
                if (remarkRequired && !remark.trim()) {
                  return Promise.reject(new Error(t('inspection.execution.messages.accessRemarkRequired')));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <Input.TextArea
            allowClear
            autoSize={{ minRows: 4 }}
            maxLength={1000}
            showCount
            placeholder={t('inspection.execution.enterRemark')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UnableToAccessModal;
