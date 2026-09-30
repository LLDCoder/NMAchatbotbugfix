import React, { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Form, Modal, Select } from 'antd';
import type moment from 'moment';
import { useTranslation } from 'react-i18next';
import InspectorSelect from './InspectorSelect';

const { RangePicker } = DatePicker;

type TaskFilterDateRange = [moment.Moment, moment.Moment];
type TaskFilterOption = { value: string; label: string };

export type TaskFilterState = {
  reason?: string;
  status?: string;
  emirate?: string;
  area?: string;
  inspectionMethod?: string;
  priority?: string;
  assignedInspector?: string;
  createdBy?: string;
  dueDateRange?: TaskFilterDateRange;
  creationTimeRange?: TaskFilterDateRange;
};

type TaskFilterModalProps = {
  visible: boolean;
  value: TaskFilterState;
  reasonOptions: TaskFilterOption[];
  statusOptions: TaskFilterOption[];
  emirateOptions: TaskFilterOption[];
  areaOptions: TaskFilterOption[];
  inspectionMethodOptions: TaskFilterOption[];
  priorityOptions: Array<{ value: string; label: string }>;
  createdByOptions: TaskFilterOption[];
  showInspectorFilter: boolean;
  onCancel: () => void;
  onApply: (value: TaskFilterState) => void | Promise<void>;
  onEmirateChange: (emirate?: string) => void | Promise<void>;
};

const emptyFilterValues: TaskFilterState = {
  reason: undefined,
  status: undefined,
  emirate: undefined,
  area: undefined,
  inspectionMethod: undefined,
  priority: undefined,
  assignedInspector: undefined,
  createdBy: undefined,
  dueDateRange: undefined,
  creationTimeRange: undefined,
};

const TaskFilterModal: React.FC<TaskFilterModalProps> = ({
  visible,
  value,
  reasonOptions,
  statusOptions,
  emirateOptions,
  areaOptions,
  inspectionMethodOptions,
  priorityOptions,
  createdByOptions,
  showInspectorFilter,
  onCancel,
  onApply,
  onEmirateChange,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [selectedEmirate, setSelectedEmirate] = useState<string | undefined>(value.emirate);

  useEffect(() => {
    if (!visible) return;

    form.setFieldsValue({
      ...emptyFilterValues,
      ...value,
      assignedInspector: showInspectorFilter ? value.assignedInspector : undefined,
    });
    setSelectedEmirate(value.emirate);
  }, [form, showInspectorFilter, value, visible]);

  const handleValuesChange = useCallback((changedValues: Partial<TaskFilterState>) => {
    if (!Object.prototype.hasOwnProperty.call(changedValues, 'emirate')) return;

    setSelectedEmirate(changedValues.emirate);
    form.setFieldsValue({ area: undefined });
    onEmirateChange(changedValues.emirate);
  }, [form, onEmirateChange]);

  const handleApply = useCallback(async () => {
    const values = await form.validateFields();
    await onApply({
      reason: values.reason,
      status: values.status,
      emirate: values.emirate,
      area: values.area,
      inspectionMethod: values.inspectionMethod,
      priority: values.priority,
      assignedInspector: showInspectorFilter ? values.assignedInspector : undefined,
      createdBy: values.createdBy,
      dueDateRange: values.dueDateRange,
      creationTimeRange: values.creationTimeRange,
    });
  }, [form, onApply, showInspectorFilter]);

  return (
    <Modal
      className="inspection-task-management__filter-modal"
      title={t('inspection.tasks.filterModal.title')}
      visible={visible}
      centered
      forceRender
      onCancel={onCancel}
      footer={(
        <div className="inspection-task-management__filter-modal-footer">
          <div className="inspection-task-management__modal-footer-actions">
            <Button className="inspection-task-management__outline-button" onClick={onCancel}>
              {t('inspection.common.cancel')}
            </Button>
            <Button className="inspection-task-management__primary-button" onClick={handleApply}>
              {t('common.apply')}
            </Button>
          </div>
        </div>
      )}
    >
      <Form
        form={form}
        layout="vertical"
        className="inspection-task-management__filter-form"
        onValuesChange={handleValuesChange}
      >
        <div className="inspection-task-management__modal-grid">
          <Form.Item
            className="inspection-task-management__modal-responsive-field"
            label={t('inspection.tasks.columns.inspectionReason')}
            name="reason"
          >
            <Select allowClear placeholder={t('inspection.tasks.filters.allReasons')}>
              <Select.Option value="all">{t('inspection.tasks.filters.allReasons')}</Select.Option>
              {reasonOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            className="inspection-task-management__modal-responsive-field"
            label={t('inspection.tasks.columns.status')}
            name="status"
          >
            <Select allowClear placeholder={t('inspection.tasks.filters.allStatuses')}>
              <Select.Option value="all">{t('inspection.tasks.filters.allStatuses')}</Select.Option>
              {statusOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.columns.emirate')} name="emirate">
            <Select allowClear placeholder={t('inspection.tasks.filters.selectEmirate')}>
              {emirateOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.columns.area')} name="area">
            <Select allowClear disabled={!selectedEmirate} placeholder={t('inspection.tasks.filters.selectArea')}>
              {areaOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.columns.inspectionMethod')} name="inspectionMethod">
            <Select allowClear placeholder={t('inspection.tasks.filters.selectInspectionMethod')}>
              {inspectionMethodOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.columns.priority')} name="priority">
            <Select allowClear placeholder={t('inspection.tasks.filters.selectPriority')}>
              {priorityOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.columns.dueDate')} name="dueDateRange">
            <RangePicker className="inspection-task-management__date-range" format="DD/MM/YYYY" separator="-" />
          </Form.Item>
          {showInspectorFilter ? (
            <Form.Item label={t('inspection.tasks.columns.inspector')} name="assignedInspector">
              <InspectorSelect
                allowClear
                multiple={false}
                placeholder={t('inspection.tasks.fields.selectInspector')}
              />
            </Form.Item>
          ) : null}
          <Form.Item label={t('inspection.tasks.fields.createdBy')} name="createdBy">
            <Select allowClear showSearch optionFilterProp="children" placeholder={t('inspection.tasks.filters.selectCreatedBy')}>
              {createdByOptions.map((item) => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.tasks.fields.creationTime')} name="creationTimeRange">
            <RangePicker className="inspection-task-management__date-range" format="DD/MM/YYYY" separator="-" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default TaskFilterModal;
