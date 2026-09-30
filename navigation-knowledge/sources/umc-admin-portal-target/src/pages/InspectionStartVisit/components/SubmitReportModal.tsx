import React from 'react';
import { Button, DatePicker, Form, Input, Modal, Radio } from 'antd';
import type { FormInstance } from 'antd/es/form';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { inspectionFigmaAssets } from '@/pages/InspectionCommon/assets';

type SubmitReportModalProps = {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  needsReinspection: boolean;
  onNeedsReinspectionChange: (needsReinspection: boolean) => void;
  onCancel: () => void;
  onAfterClose?: () => void;
  onConfirm: () => void | Promise<void>;
};

const buildRequiredLabel = (label: string, required = false) => (
  <span className="inspection-start-visit__submit-report-label">
    <span>{label}</span>
    {required ? <em>*</em> : null}
  </span>
);

const SubmitReportModal: React.FC<SubmitReportModalProps> = ({
  visible,
  form,
  submitting,
  needsReinspection,
  onNeedsReinspectionChange,
  onCancel,
  onAfterClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('inspection.execution.submitInspectionReport')}
      visible={visible}
      onCancel={onCancel}
      afterClose={onAfterClose}
      centered
      destroyOnClose
      forceRender
      closable={!submitting}
      keyboard={!submitting}
      maskClosable={!submitting}
      confirmLoading={submitting}
      className="inspection-start-visit__standard-modal inspection-start-visit__submit-report-modal"
      footer={(
        <div className="inspection-start-visit__modal-footer-actions">
          <Button className="inspection-start-visit__outline-button" disabled={submitting} onClick={onCancel}>
            {t('inspection.common.cancel')}
          </Button>
          <Button className="inspection-start-visit__primary-button" loading={submitting} onClick={onConfirm}>
            {t('inspection.common.confirm')}
          </Button>
        </div>
      )}
    >
      <div className="inspection-start-visit__submit-alert" role="status">
        <span className="inspection-start-visit__submit-alert-icon">
          <img src={inspectionFigmaAssets.ocrTypeIcons.info} alt="" />
        </span>
        <span className="inspection-start-visit__submit-alert-text">
          {t('inspection.execution.reinspectionPrompt')}
        </span>
      </div>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="inspection-start-visit__submit-report-form"
        initialValues={{ needsReinspection: true, reinspectionDueDate: moment().add(30, 'days') }}
        onValuesChange={(changedValues, values) => {
          if (Object.prototype.hasOwnProperty.call(changedValues, 'needsReinspection')) {
            const nextNeedsReinspection = Boolean(values.needsReinspection);
            if (nextNeedsReinspection && !values.reinspectionDueDate) {
              form.setFieldsValue({ reinspectionDueDate: moment().add(30, 'days') });
            }
            onNeedsReinspectionChange(nextNeedsReinspection);
          }
        }}
      >
        <Form.Item
          className="inspection-start-visit__submit-report-field"
          label={buildRequiredLabel(t('inspection.execution.reinspectionNeeded'), true)}
          name="needsReinspection"
          rules={[{ required: true }]}
        >
          <Radio.Group className="inspection-start-visit__submit-report-radio-group">
            <Radio value={true}>{t('inspection.common.yes')}</Radio>
            <Radio value={false}>{t('inspection.common.no')}</Radio>
          </Radio.Group>
        </Form.Item>
        {needsReinspection ? (
          <Form.Item
            className="inspection-start-visit__submit-report-field"
            label={buildRequiredLabel(t('inspection.execution.reinspectionDate'), true)}
            name="reinspectionDueDate"
            rules={[{ required: true, message: t('inspection.execution.messages.reinspectionDateRequired') }]}
          >
            <DatePicker
              allowClear={false}
              className="inspection-start-visit__date-picker"
              format="DD/MM/YYYY"
              disabledDate={(current) => !!current && current < moment().startOf('day')}
            />
          </Form.Item>
        ) : null}
        <Form.Item
          className="inspection-start-visit__submit-report-field inspection-start-visit__submit-report-field--wide"
          label={buildRequiredLabel(t('inspection.execution.note'))}
          name="reviewNote"
        >
          <Input.TextArea rows={4} maxLength={1000} showCount placeholder={t('inspection.execution.notePlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SubmitReportModal;
