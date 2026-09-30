import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import InspectorSelect from './InspectorSelect';
import { normalizeInspectorIds } from './inspectorSelectUtils';
import { PermissionGuard } from '@/components/common';
import { PERMISSION_CODES } from '@/constants/permissionCodes';
import { INSPECTION_PATHS } from '@/pages/InspectionCommon/constants';

type AssignTaskFormValues = {
  assignedInspector?: unknown;
};

type AssignTaskModalProps = {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (inspectorIds: string[]) => void | Promise<void>;
};

const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  visible,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<AssignTaskFormValues>();
  const [submitEnabled, setSubmitEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;

    form.resetFields();
    setSubmitEnabled(false);
    setSubmitting(false);
  }, [form, visible]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    setSubmitEnabled(false);
    setSubmitting(false);
    onCancel();
  }, [form, onCancel]);

  const handleValuesChange = useCallback((_: unknown, values: AssignTaskFormValues) => {
    setSubmitEnabled(normalizeInspectorIds(values.assignedInspector).length > 0);
  }, []);

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    const inspectorIds = normalizeInspectorIds(values.assignedInspector);
    setSubmitting(true);
    try {
      await onSubmit(inspectorIds);
    } finally {
      setSubmitting(false);
    }
  }, [form, onSubmit]);

  return (
    <Modal
      className="inspection-task-management__assign-modal"
      title={t('inspection.tasks.assignInspector')}
      visible={visible}
      centered
      forceRender
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" className="inspection-task-management__outline-button" onClick={handleCancel}>
          {t('inspection.common.cancel')}
        </Button>,
        <PermissionGuard
          key="submit"
          permissionCode={PERMISSION_CODES.inspection.task.assign}
          routePath={INSPECTION_PATHS.tasks}
        >
          <Button
            className="inspection-task-management__primary-button"
            disabled={!submitEnabled}
            loading={submitting}
            onClick={handleSubmit}
          >
            {t('inspection.common.confirm')}
          </Button>
        </PermissionGuard>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        className="inspection-task-management__assign-modal-form"
        onValuesChange={handleValuesChange}
      >
        <Form.Item label={t('inspection.tasks.fields.assignedInspector')} name="assignedInspector" rules={[{ required: true }]}>
          <InspectorSelect
            className="inspection-task-management__assign-modal-select"
            maxTagCount={2}
            placeholder={t('inspection.tasks.fields.selectInspector')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AssignTaskModal;
