import React, { useCallback, useEffect } from 'react';
import { Button, Form, Input, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '../../InspectionCommon/assets';

export type ViolationWorkflowModalValues = {
  status: string;
  reason?: string;
  remark?: string;
};

type ViolationWorkflowModalProps = {
  visible: boolean;
  title: React.ReactNode;
  confirmText: React.ReactNode;
  loading?: boolean;
  initialValues: ViolationWorkflowModalValues;
  statusOptions: string[];
  getStatusLabel: (status: string) => string;
  onCancel: () => void;
  onSubmit: (values: ViolationWorkflowModalValues) => void | Promise<void>;
};

type WorkflowTextAreaProps = {
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
  clearLabel: string;
};

const getSelectPopupContainer = () => document.body;

const WorkflowTextArea: React.FC<WorkflowTextAreaProps> = ({
  value,
  onChange,
  rows = 4,
  clearLabel,
}) => {
  const hasValue = Boolean(value);

  const handleClear = useCallback(() => {
    onChange?.('');
  }, [onChange]);

  return (
    <div className="inspection-violations__workflow-textarea-control">
      <Input.TextArea rows={rows} value={value} onChange={(event) => onChange?.(event.target.value)} />
      {hasValue ? (
        <button
          type="button"
          aria-label={clearLabel}
          className="inspection-violations__workflow-textarea-clear"
          onClick={handleClear}
          onMouseDown={(event) => event.preventDefault()}
        >
          <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};

const ViolationWorkflowModal: React.FC<ViolationWorkflowModalProps> = ({
  visible,
  title,
  confirmText,
  loading = false,
  initialValues,
  statusOptions,
  getStatusLabel,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ViolationWorkflowModalValues>();

  useEffect(() => {
    if (!visible) return;
    form.setFieldsValue(initialValues);
  }, [form, initialValues, visible]);

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  }, [form, onSubmit]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  return (
    <Modal
      className="inspection-violations__workflow-modal"
      title={title}
      visible={visible}
      centered
      forceRender
      confirmLoading={loading}
      onCancel={handleCancel}
      footer={(
        <div className="inspection-violations__modal-footer-actions">
          <Button className="inspection-violations__modal-outline-button" disabled={loading} onClick={handleCancel}>
            {t('inspection.common.cancel')}
          </Button>
          <Button className="inspection-violations__modal-primary-button" loading={loading} onClick={handleSubmit}>
            {confirmText}
          </Button>
        </div>
      )}
    >
      <Form form={form} layout="vertical" className="inspection-violations__workflow-form">
        <div className="inspection-violations__workflow-grid">
          <Form.Item label={t('inspection.tasks.columns.status')} name="status" rules={[{ required: true }]}>
            <Select
              dropdownClassName="inspection-violations__workflow-select-dropdown"
              getPopupContainer={getSelectPopupContainer}
            >
              {statusOptions.map((status) => (
                <Select.Option key={status} value={status} title={getStatusLabel(status)}>
                  {getStatusLabel(status)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            className="inspection-violations__workflow-full-row inspection-violations__workflow-textarea-form-item"
            label={t('inspection.violation.detail.decisionReason')}
            name="reason"
          >
            <WorkflowTextArea rows={3} clearLabel={t('inspection.common.reset')} />
          </Form.Item>
          <Form.Item
            className="inspection-violations__workflow-full-row inspection-violations__workflow-textarea-form-item"
            label={t('inspection.violation.detail.remark')}
            name="remark"
          >
            <WorkflowTextArea rows={4} clearLabel={t('inspection.common.reset')} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default ViolationWorkflowModal;
