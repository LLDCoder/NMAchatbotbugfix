import * as React from "react";
import { useState, useEffect } from "react";
import { Button, Modal, Table, Select } from "antd";
import { useField } from "@formily/react";
import { useTranslation } from "react-i18next";
import EmptyBox from "../../../../../common/EmptyBox/EmptyBox";
import { createEquipmentListTextMap } from "../i18n";
import "./DataSource.less";

// DataSourceOption
interface DataSourceOption {
  label: string;
  value: string;
}

// DropdownOption
export interface DropdownOption {
  label: string;
  value: string;
}

// FieldConfig
export interface FieldConfig {
  fieldName: string;
  required: boolean;
  fieldType: 'string' | 'number' | 'boolean';
  placeholderText: string;
  listVisible: boolean;
  formVisible: boolean;
  displayType: 'Text Input' | 'Dropdown';
  options?: DropdownOption[]; // Dropdown options
}

// DataSourceConfig
export interface DataSourceConfig {
  dataSource: string;
  fields: FieldConfig[];
}

interface DataSourceSetterProps {
  value?: DataSourceConfig;
  onChange?: (value: DataSourceConfig) => void;
}

// Mock DataSourceOptions - In actual project, it should be fetched from API
const DATA_SOURCE_OPTIONS: DataSourceOption[] = [
  { label: 'Equipment List', value: 'equipment_list' },
  { label: 'User List', value: 'user_list' },
  { label: 'Product List', value: 'product_list' },
];

// Get default fields configuration for a given data source
const getDefaultFieldsForDataSource = (dataSource: string): FieldConfig[] => {
  const fieldMappings: Record<string, FieldConfig[]> = {
    equipment_list: [
      {
        fieldName: 'Equipment',
        fieldType: 'string',
        required: true,
        placeholderText: 'Select equipment',
        listVisible: true,
        formVisible: true,
        displayType: 'Dropdown',
        options: [
          { label: 'Camera', value: 'camera' },
          { label: 'Monopod', value: 'monopod' },
          { label: 'Photographic filter', value: 'filter' },
        ],
      },
      {
        fieldName: 'Number',
        fieldType: 'number',
        required: true,
        placeholderText: 'Enter number',
        listVisible: true,
        formVisible: true,
        displayType: 'Text Input',
      },
      {
        fieldName: 'Serial Number',
        fieldType: 'string',
        required: true,
        placeholderText: 'Enter serial number',
        listVisible: true,
        formVisible: true,
        displayType: 'Text Input',
      },
      {
        fieldName: 'Status',
        fieldType: 'string',
        required: true,
        placeholderText: 'Select status',
        listVisible: true,
        formVisible: true,
        displayType: 'Dropdown',
        options: [
          { label: 'Available', value: 'available' },
          { label: 'In Use', value: 'in_use' },
          { label: 'Maintenance', value: 'maintenance' },
        ],
      },
    ],
    user_list: [
      {
        fieldName: 'Username',
        required: true,
        fieldType: 'string',
        placeholderText: 'Enter username',
        listVisible: true,
        formVisible: true,
        displayType: 'Text Input',
      },
      {
        fieldName: 'Email',
        fieldType: 'string',
        required: true,
        placeholderText: 'Enter email',
        listVisible: true,
        formVisible: true,
        displayType: 'Text Input',
      },
    ],
    product_list: [
      {
        fieldName: 'Product Name',
        fieldType: 'string',
        required: true,
        placeholderText: 'Enter product name',
        listVisible: true,
        formVisible: true,
        displayType: 'Text Input',
      },
      {
        fieldName: 'Price',
        fieldType: 'number',
        required: true,
        placeholderText: 'Enter price',
        listVisible: true,
        formVisible: true,
        displayType: 'Text Input',
      },
    ],
  };

  return fieldMappings[dataSource] || [];
};

const DataSourceSetter: React.FC<DataSourceSetterProps> = (props) => {
  const { t } = useTranslation();
  const field = useField();
  const [visible, setVisible] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const localizedText = createEquipmentListTextMap(t);

  // Get current value
  const getCurrentValue = (): DataSourceConfig | undefined => {
    if (props.value !== undefined) {
      return props.value;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldValue = (field as any).value;
    return fieldValue;
  };

  // Initialize data
  useEffect(() => {
    const currentValue = getCurrentValue();
    if (currentValue) {
      setSelectedDataSource(currentValue.dataSource || '');
      setFields(currentValue.fields || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, field]);

  const handleOpen = () => {
    const currentValue = getCurrentValue();
    if (currentValue) {
      setSelectedDataSource(currentValue.dataSource || '');
      setFields(currentValue.fields || []);
    } else {
      setSelectedDataSource('');
      setFields([]);
    }
    setVisible(true);
  };

  const handleSave = () => {
    const config: DataSourceConfig = {
      dataSource: selectedDataSource,
      fields: fields,
    };

    if (props.onChange) {
      props.onChange(config);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((field as any).setValue) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (field as any).setValue(config);
      }
    }
    setVisible(false);
  };

  const handleCancel = () => {
    const currentValue = getCurrentValue();
    if (currentValue) {
      setSelectedDataSource(currentValue.dataSource || '');
      setFields(currentValue.fields || []);
    } else {
      setSelectedDataSource('');
      setFields([]);
    }
    setVisible(false);
  };

  const handleDataSourceChange = (value: string) => {
    setSelectedDataSource(value);
    // Automatically fill fields based on the selected data source
    const defaultFields = getDefaultFieldsForDataSource(value);
    setFields(defaultFields);
  };

  const columns = [
    {
      title: t('DataList.sourceSetter.columnFieldName'),
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: '15%',
      render: (value: string) => localizedText[value] || value,
    },
    {
      title: t('DataList.sourceSetter.columnRequired'),
      dataIndex: 'required',
      key: 'required',
      width: '12%',
      render: (value: boolean) =>
        value
          ? t('DataList.sourceSetter.yes')
          : t('DataList.sourceSetter.no'),
    },
    {
      title: t('DataList.sourceSetter.columnPlaceholder'),
      dataIndex: 'placeholderText',
      key: 'placeholderText',
      width: '20%',
      render: (value: string) => localizedText[value] || value,
    },
    {
      title: t('DataList.sourceSetter.columnListVisible'),
      dataIndex: 'listVisible',
      key: 'listVisible',
      width: '13%',
      render: (value: boolean) =>
        value
          ? t('DataList.sourceSetter.yes')
          : t('DataList.sourceSetter.no'),
    },
    {
      title: t('DataList.sourceSetter.columnFormVisible'),
      dataIndex: 'formVisible',
      key: 'formVisible',
      width: '13%',
      render: (value: boolean) =>
        value
          ? t('DataList.sourceSetter.yes')
          : t('DataList.sourceSetter.no'),
    },
    {
      title: t('DataList.sourceSetter.columnDisplayType'),
      dataIndex: 'displayType',
      key: 'displayType',
      width: '15%',
      render: (value: string) => localizedText[value] || value,
    },
  ];

  return (
    <>
      <Button onClick={handleOpen} type="default" block>
        {t('DataList.sourceSetter.configureDataSource')}
      </Button>
      <Modal
        centered
        title={
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {t('DataList.sourceSetter.modalTitle')}
          </div>
        }
        open={visible}
        visible={visible}
        onCancel={handleCancel}
        width={1200}
        footer={null}
        className="data-source-config-modal"
        bodyStyle={{ padding: '24px' }}
      >
        <div className="data-source-config-content">
          {/* Data Source Selection */}
          <div className="data-source-select-section">
            <div className="section-label">
              {t('DataList.sourceSetter.selectDataSource')}{' '}
              <span style={{ color: '#ff4d4f' }}>*</span>
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder={t('DataList.sourceSetter.selectDataSourcePlaceholder')}
              value={selectedDataSource || undefined}
              onChange={handleDataSourceChange}
              size="large"
            >
              {DATA_SOURCE_OPTIONS.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {localizedText[option.value] || option.label}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Fields Table */}
          <div className="fields-section">
            <div className="section-label">
              {t('DataList.sourceSetter.fieldsSection')}
            </div>
            <div className="fields-table-container">
              {selectedDataSource && fields.length > 0 ? (
                <Table
                  columns={columns}
                  dataSource={fields}
                  pagination={false}
                  rowKey={(record, index) => `field-${index}`}
                  bordered
                  size="middle"
                />
              ) : (
                <div className="empty-fields">
                  <EmptyBox
                    title={t('DataList.sourceSetter.emptySelectSource')}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Buttons */}
          <div className="modal-footer-custom">
            <Button onClick={handleCancel} size="large" className="cancel-btn">
              {t('DataList.sourceSetter.cancel')}
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              size="large"
              className="save-btn"
              disabled={!selectedDataSource}
            >
              {t('DataList.sourceSetter.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DataSourceSetter;
