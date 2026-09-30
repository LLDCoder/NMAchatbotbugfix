import React, { useCallback, useEffect } from 'react';
import { Button, DatePicker, Form, Modal, Select } from 'antd';
import type moment from 'moment';
import { useTranslation } from 'react-i18next';

const { RangePicker } = DatePicker;

export type ViolationFilterDateRange = [moment.Moment, moment.Moment];

export type ViolationFilterState = {
  type?: string;
  status?: string;
  reportedBy?: string;
  createdOnRange?: ViolationFilterDateRange;
};

export type ViolationFilterOption = {
  value: string;
  label: string;
};

type ViolationFilterModalProps = {
  visible: boolean;
  value: ViolationFilterState;
  typeOptions: ViolationFilterOption[];
  statusOptions: ViolationFilterOption[];
  reportedByOptions: ViolationFilterOption[];
  onCancel: () => void;
  onApply: (value: ViolationFilterState) => void | Promise<void>;
};

const emptyFilterValues: ViolationFilterState = {
  type: undefined,
  status: undefined,
  reportedBy: undefined,
  createdOnRange: undefined,
};

const getSelectPopupContainer = () => document.body;

const ViolationFilterModal: React.FC<ViolationFilterModalProps> = ({
  visible,
  value,
  typeOptions,
  statusOptions,
  reportedByOptions,
  onCancel,
  onApply,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const canFilterReportedBy = reportedByOptions.length > 0;

  useEffect(() => {
    if (!visible) return;

    form.setFieldsValue({
      ...emptyFilterValues,
      ...value,
    });
  }, [form, value, visible]);

  const handleApply = useCallback(async () => {
    const values = await form.validateFields();
    await onApply({
      type: values.type,
      status: values.status,
      reportedBy: values.reportedBy,
      createdOnRange: values.createdOnRange,
    });
  }, [form, onApply]);

  return (
    <Modal
      className="inspection-violations__filter-modal"
      title={t('inspection.common.filter')}
      visible={visible}
      centered
      forceRender
      onCancel={onCancel}
      footer={(
        <div className="inspection-violations__filter-modal-footer">
          <div className="inspection-violations__modal-footer-actions">
            <Button className="inspection-violations__modal-outline-button" onClick={onCancel}>
              {t('inspection.common.cancel')}
            </Button>
            <Button className="inspection-violations__modal-primary-button" onClick={handleApply}>
              {t('common.apply')}
            </Button>
          </div>
        </div>
      )}
    >
      <Form form={form} layout="vertical" className="inspection-violations__filter-form">
        <div className="inspection-violations__modal-grid">
          <Form.Item
            className="inspection-violations__modal-responsive-field"
            label={t('inspection.violation.columns.type')}
            name="type"
          >
            <Select
              allowClear
              placeholder={t('inspection.violation.filters.allTypes')}
              dropdownClassName="inspection-violations__filter-select-dropdown"
              getPopupContainer={getSelectPopupContainer}
            >
              {typeOptions.map((item) => (
                <Select.Option key={item.value} value={item.value} title={item.label}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            className="inspection-violations__modal-responsive-field"
            label={t('inspection.violation.columns.status')}
            name="status"
          >
            <Select
              allowClear
              placeholder={t('inspection.violation.filters.allStatuses')}
              dropdownClassName="inspection-violations__filter-select-dropdown"
              getPopupContainer={getSelectPopupContainer}
            >
              {statusOptions.map((item) => (
                <Select.Option key={item.value} value={item.value} title={item.label}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.violation.filters.reportedBy')} name="reportedBy">
            <Select
              allowClear
              disabled={!canFilterReportedBy}
              showSearch
              optionFilterProp="children"
              placeholder={t('inspection.violation.filters.pleaseSelect')}
              dropdownClassName="inspection-violations__filter-select-dropdown"
              getPopupContainer={getSelectPopupContainer}
            >
              {reportedByOptions.map((item) => (
                <Select.Option key={item.value} value={item.value} title={item.label}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label={t('inspection.violation.filters.creationTime')} name="createdOnRange">
            <RangePicker
              className="inspection-violations__date-range"
              format="DD/MM/YYYY"
              separator="-"
              placeholder={[t('common.startTime'), t('common.endTime')]}
              getPopupContainer={getSelectPopupContainer}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default ViolationFilterModal;
