import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { UPLOAD_LIMITS } from '@/constants/uploadLimits';
import type { InspectionTaskAttachmentPayload } from '@/services/inspection';
import InspectionAttachmentUpload from '@/pages/InspectionCommon/components/InspectionAttachmentUpload';
import './SubmitReportModal.less';

const REPORT_SUMMARY_TEXTAREA_AUTO_SIZE = {
  minRows: 5,
  maxRows: 20,
};

export type SubmitReportPayload = {
  summary: string;
  files: InspectionTaskAttachmentPayload[];
};

type SubmitReportModalProps = {
  visible: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: SubmitReportPayload) => Promise<void>;
};

function SubmitReportModal({
  visible,
  submitting,
  onCancel,
  onSubmit,
}: SubmitReportModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<InspectionTaskAttachmentPayload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!visible) return;
    form.resetFields();
    setFileList([]);
    setUploading(false);
    setUploadError('');
  }, [form, visible]);

  const renderRequiredLabel = (label: string) => (
    <span className="inspection-violation-details__submit-report-label">
      <span>{label}</span>
      <span className="inspection-violation-details__submit-report-required">*</span>
    </span>
  );

  const handleModalCancel = () => {
    if (submitting) return;
    onCancel();
  };

  const handleSubmit = async () => {
    if (uploading || submitting) return;

    const hasFile = Boolean(fileList.length);
    setUploadError(hasFile ? '' : t('inspection.violation.submitReport.fileRequired'));

    let values: { summary?: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (!hasFile) return;

    await onSubmit({
      summary: String(values.summary || '').trim(),
      files: fileList,
    });
  };

  return (
    <Modal
      visible={visible}
      centered
      closable={!submitting}
      destroyOnClose
      keyboard={!submitting}
      maskClosable={!submitting}
      title={t('inspection.violation.submitReport.title')}
      className="inspection-violation-details__modal inspection-violation-details__submit-report-modal"
      onCancel={handleModalCancel}
      footer={[
        <Button
          key="cancel"
          className="inspection-violation-details__modal-button inspection-violation-details__modal-button--outline"
          onClick={handleModalCancel}
          disabled={submitting}
        >
          {t('inspection.violation.submitReport.cancel')}
        </Button>,
        <Button
          key="submit"
          className="inspection-violation-details__modal-button inspection-violation-details__modal-button--primary"
          onClick={handleSubmit}
          disabled={uploading || submitting}
          loading={submitting}
        >
          {t('inspection.violation.submitReport.submit')}
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="inspection-violation-details__form inspection-violation-details__submit-report-form"
      >
        <Form.Item
          className="inspection-violation-details__submit-report-field inspection-violation-details__submit-report-field--summary"
          name="summary"
          label={renderRequiredLabel(t('inspection.violation.submitReport.reportSummary'))}
          rules={[{
            required: true,
            whitespace: true,
            message: t('inspection.violation.submitReport.summaryRequired'),
          }]}
        >
          <Input.TextArea
            className="inspection-violation-details__textarea"
            placeholder={t('inspection.violation.submitReport.enterReportSummary')}
            maxLength={1000}
            showCount
            autoSize={REPORT_SUMMARY_TEXTAREA_AUTO_SIZE}
          />
        </Form.Item>
        <Form.Item
          className="inspection-violation-details__submit-report-field inspection-violation-details__submit-report-field--upload"
          label={renderRequiredLabel(t('inspection.violation.submitReport.report'))}
          validateStatus={uploadError ? 'error' : ''}
          help={uploadError || undefined}
        >
          <InspectionAttachmentUpload
            value={fileList}
            uploadText={t('inspection.violation.submitReport.uploadFile')}
            disabled={submitting}
            maxCount={UPLOAD_LIMITS.MULTI_ATTACHMENT}
            attachmentCategory="ContentReviewReport"
            attachmentGridClassName="inspection-attachment-grid--two-columns"
            onUploadingChange={setUploading}
            onChange={(nextFileList) => {
              setFileList(nextFileList);
              setUploadError('');
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default SubmitReportModal;
