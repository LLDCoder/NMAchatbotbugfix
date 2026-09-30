import * as React from "react";
import { useState, useEffect } from "react";
import { Button, Modal, Table, Select } from "antd";
import { useField } from "@formily/react";
import { useTranslation } from "react-i18next";
import EmptyBox from "../../../../../common/EmptyBox/EmptyBox";
import "./DataListSourceSetter.less";

import {
  DATA_SOURCE_OPTIONS,
  getDefaultFieldsForDataSource,
} from "./dataSourceDefaults";
import type {
  DataListFieldConfig,
  DataListSourceConfig,
} from "./dataSourceDefaults";

// Re-exported so existing importers (Setter/index.ts, DataList.tsx) keep
// resolving these types from this module.
export type {
  DataListFieldConfig,
  DataListSourceConfig,
  DropdownOption,
} from "./dataSourceDefaults";


interface DataListSourceSetterProps {
  value?: DataListSourceConfig;
  onChange?: (value: DataListSourceConfig) => void;
}



const DataListSourceSetter: React.FC<DataListSourceSetterProps> = (props) => {
  const field = useField();
  const { t } = useTranslation();
  const localizedText: Record<string, string> = {
    equipment_list: t("DataList.sourceSetter.dataSources.equipmentList"),
    material_list: t("DataList.sourceSetter.dataSources.materialList"),
    languages_name_list: t(
      "DataList.sourceSetter.dataSources.languagesNameList",
    ),
    list_of_trainees: t("DataList.sourceSetter.dataSources.listOfTrainees"),
    Equipment: t("DataList.sourceSetter.fieldLabels.equipment"),
    Number: t("DataList.sourceSetter.fieldLabels.number"),
    Title: t("DataList.sourceSetter.fieldLabels.title"),
    Language: t("DataList.sourceSetter.fieldLabels.language"),
    "Number Of Title": t("DataList.sourceSetter.fieldLabels.numberOfTitle"),
    "Suggested Name": t("DataList.sourceSetter.fieldLabels.suggestedName"),
    "Full Name": t("DataList.sourceSetter.fieldLabels.fullName"),
    "Emirates ID Number": t(
      "DataList.sourceSetter.fieldLabels.emiratesIdNumber",
    ),
    "Mobile Number": t("DataList.sourceSetter.fieldLabels.mobileNumber"),
    Email: t("DataList.sourceSetter.fieldLabels.email"),
    "Select Equipment": t(
      "DataList.sourceSetter.placeholders.selectEquipment",
    ),
    "Enter Number": t("DataList.sourceSetter.placeholders.enterNumber"),
    "Enter Title": t("DataList.sourceSetter.placeholders.enterTitle"),
    "Select Language": t(
      "DataList.sourceSetter.placeholders.selectLanguage",
    ),
    "Enter Number Of Title": t(
      "DataList.sourceSetter.placeholders.enterNumberOfTitle",
    ),
    "Enter Suggested Name": t(
      "DataList.sourceSetter.placeholders.enterSuggestedName",
    ),
    "Enter full name": t("DataList.sourceSetter.placeholders.enterFullName"),
    "784-XXXX-XXXXXXX-X": t(
      "DataList.sourceSetter.placeholders.enterEmiratesId",
    ),
    "Enter mobile number": t(
      "DataList.sourceSetter.placeholders.enterMobile",
    ),
    "Enter email address": t(
      "DataList.sourceSetter.placeholders.enterEmail",
    ),
    "Text Input": t("DataList.sourceSetter.displayType.textInput"),
    Dropdown: t("DataList.sourceSetter.displayType.dropdown"),
    "Emirates ID": t("DataList.sourceSetter.displayType.emiratesId"),
    Mobile: t("DataList.sourceSetter.displayType.mobile"),
  };
  const [visible, setVisible] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<string>("");
  const [fields, setFields] = useState<DataListFieldConfig[]>([]);

  const getCurrentValue = (): DataListSourceConfig | undefined => {
    if (props.value !== undefined) return props.value;
    return (field as any).value;
  };

  useEffect(() => {
    const val = getCurrentValue();
    if (val) {
      setSelectedDataSource(val.dataSource || "");
      setFields(val.fields || []);
    }
  }, [props.value, field]);

  const handleOpen = () => {
    const val = getCurrentValue();
    if (val) {
      setSelectedDataSource(val.dataSource || "");
      setFields(val.fields || []);
    } else {
      setSelectedDataSource("");
      setFields([]);
    }
    setVisible(true);
  };

  const handleSave = () => {
    const config: DataListSourceConfig = {
      dataSource: selectedDataSource,
      fields,
    };
    if (props.onChange) {
      props.onChange(config);
    } else if ((field as any).setValue) {
      (field as any).setValue(config);
    }
    setVisible(false);
  };

  const handleCancel = () => {
    const val = getCurrentValue();
    if (val) {
      setSelectedDataSource(val.dataSource || "");
      setFields(val.fields || []);
    } else {
      setSelectedDataSource("");
      setFields([]);
    }
    setVisible(false);
  };

  const handleDataSourceChange = (value: string) => {
    setSelectedDataSource(value);
    setFields(getDefaultFieldsForDataSource(value));
  };

  const isConfigured = !!getCurrentValue()?.dataSource;

  const tableColumns = [
    {
      title: t("DataList.sourceSetter.columnFieldName"),
      dataIndex: "fieldName",
      key: "fieldName",
      width: "18%",
      render: (value: string) => localizedText[value] || value,
    },
    {
      title: t("DataList.sourceSetter.columnRequired"),
      dataIndex: "required",
      key: "required",
      width: "10%",
      render: (val: boolean) =>
        val
          ? t("DataList.sourceSetter.yes")
          : t("DataList.sourceSetter.no"),
    },
    {
      title: t("DataList.sourceSetter.columnPlaceholder"),
      dataIndex: "placeholderText",
      key: "placeholderText",
      width: "22%",
      render: (value: string) => localizedText[value] || value,
    },
    {
      title: t("DataList.sourceSetter.columnListVisible"),
      dataIndex: "listVisible",
      key: "listVisible",
      width: "12%",
      render: (val: boolean) =>
        val
          ? t("DataList.sourceSetter.yes")
          : t("DataList.sourceSetter.no"),
    },
    {
      title: t("DataList.sourceSetter.columnFormVisible"),
      dataIndex: "formVisible",
      key: "formVisible",
      width: "12%",
      render: (val: boolean) =>
        val
          ? t("DataList.sourceSetter.yes")
          : t("DataList.sourceSetter.no"),
    },
    {
      title: t("DataList.sourceSetter.columnDisplayType"),
      dataIndex: "displayType",
      key: "displayType",
      width: "14%",
      render: (value: string) => localizedText[value] || value,
    },
  ];

  return (
    <div className="datalist-source-setter">
      <Button
        onClick={handleOpen}
        type="default"
        block
        className={`source-config-btn ${isConfigured ? "configured" : ""}`}
      >
        {isConfigured
          ? t("DataList.sourceSetter.configured")
          : t("DataList.sourceSetter.configure")}
      </Button>
      <Modal
        centered
        title={
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {t("DataList.sourceSetter.modalTitle")}
          </div>
        }
        visible={visible}
        onCancel={handleCancel}
        width={1000}
        footer={null}
        className="datalist-source-config-modal"
        bodyStyle={{ padding: "24px" }}
        maskClosable={false}
        getContainer={() => document.body}
      >
        <div className="datalist-source-config-content">
          <div className="data-source-select-section">
            <div className="section-label">
              {t("DataList.sourceSetter.selectDataSource")}{" "}
              <span style={{ color: "#ff4d4f" }}>*</span>
            </div>
            <Select
              style={{ width: "100%" }}
              placeholder={t("DataList.sourceSetter.selectDataSourcePlaceholder")}
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

          <div className="fields-section">
            <div className="section-label">
              {t("DataList.sourceSetter.fieldsSection")}
            </div>
            <div className="fields-table-container">
              {selectedDataSource && fields.length > 0 ? (
                <Table
                  columns={tableColumns}
                  dataSource={fields}
                  pagination={false}
                  rowKey={(_, index) => `field-${index}`}
                  bordered
                  size="middle"
                />
              ) : (
                <div className="empty-fields">
                  <EmptyBox
                    title={t("DataList.sourceSetter.emptySelectSource")}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer-custom">
            <Button
              onClick={handleCancel}
              size="large"
              className="cancel-btn"
            >
              {t("DataList.sourceSetter.cancel")}
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              size="large"
              className="save-btn"
              disabled={!selectedDataSource}
            >
              {t("DataList.sourceSetter.save")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DataListSourceSetter;
