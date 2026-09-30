import React, { useCallback, useEffect, useRef } from "react";
import { Form, Select } from "antd";
import { useTranslation } from "react-i18next";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";
import {
  getSelectPopupContainer,
  renderSelectOptionText,
} from "../helpers";

interface SelectTextOption {
  value: string;
  label: string;
}

interface TaskInfoFieldsProps {
  reasonDropdownOpen: boolean;
  reasonSearchKeyword: string;
  filteredReasonOptions: SelectTextOption[];
  prioritySelectOptions: SelectTextOption[];
  onReasonDropdownVisibleChange: (open: boolean) => void;
  onReasonSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReasonSearchClear: () => void;
  onReasonSelect: () => void;
}

const TaskInfoFields: React.FC<TaskInfoFieldsProps> = ({
  reasonDropdownOpen,
  reasonSearchKeyword,
  filteredReasonOptions,
  prioritySelectOptions,
  onReasonDropdownVisibleChange,
  onReasonSearchChange,
  onReasonSearchClear,
  onReasonSelect,
}) => {
  const { t } = useTranslation();
  const reasonSearchInputRef = useRef<HTMLInputElement>(null);
  const hasReasonSearchKeyword = reasonSearchKeyword.trim().length > 0;

  useEffect(() => {
    if (!reasonDropdownOpen) return undefined;

    const focusTimer = window.setTimeout(() => {
      reasonSearchInputRef.current?.focus();
    });

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [reasonDropdownOpen]);

  const handleReasonSearchClear = useCallback(() => {
    onReasonSearchClear();
    reasonSearchInputRef.current?.focus();
  }, [onReasonSearchClear]);

  const renderReasonDropdown = useCallback((menu: React.ReactElement) => {
    const searchRowClassName = hasReasonSearchKeyword
      ? "inspection-task-management__reason-dropdown-search inspection-task-management__reason-dropdown-search--active"
      : "inspection-task-management__reason-dropdown-search";
    const dropdownPanelClassName = filteredReasonOptions.length
      ? "inspection-task-management__reason-dropdown-panel"
      : "inspection-task-management__reason-dropdown-panel inspection-task-management__reason-dropdown-panel--empty";

    return (
      <div className={dropdownPanelClassName}>
        <div
          className={searchRowClassName}
          onClick={() => reasonSearchInputRef.current?.focus()}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <img
            src={inspectionFigmaAssets.createTask.searchIcon}
            alt=""
            className="inspection-task-management__reason-dropdown-search-icon"
          />
          <input
            ref={reasonSearchInputRef}
            className="inspection-task-management__reason-dropdown-search-input"
            value={reasonSearchKeyword}
            placeholder={t("inspection.common.search")}
            onChange={onReasonSearchChange}
            onKeyDown={(event) => event.stopPropagation()}
          />
          {hasReasonSearchKeyword ? (
            <button
              type="button"
              className="inspection-task-management__reason-dropdown-clear"
              onClick={handleReasonSearchClear}
              onMouseDown={(event) => event.preventDefault()}
              aria-label={t("inspection.common.reset")}
            >
              <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" />
            </button>
          ) : null}
        </div>
        <div className="inspection-task-management__reason-dropdown-menu">
          {menu}
        </div>
      </div>
    );
  }, [
    filteredReasonOptions.length,
    handleReasonSearchClear,
    hasReasonSearchKeyword,
    onReasonSearchChange,
    reasonSearchKeyword,
    t,
  ]);

  return (
    <div className="inspection-task-management__modal-section">
      <div className="inspection-task-management__modal-section-title">
        {t("inspection.tasks.sections.taskInformation")}
      </div>
      <div className="inspection-task-management__modal-grid">
        <Form.Item
          label={t("inspection.tasks.columns.inspectionReason")}
          name="inspectionReasonCode"
          rules={[{ required: true }]}
        >
          <Select
          className="umc-select-arrow-manual"
            allowClear
            showSearch={false}
            filterOption={false}
            optionLabelProp="label"
            placeholder={t("inspection.tasks.filters.selectInspectionReason")}
            dropdownClassName="inspection-task-management__reason-select-dropdown"
            dropdownRender={renderReasonDropdown}
            getPopupContainer={getSelectPopupContainer}
            listHeight={280}
            menuItemSelectedIcon={null}
            open={reasonDropdownOpen}
            virtual={false}
            onClear={handleReasonSearchClear}
            onDropdownVisibleChange={onReasonDropdownVisibleChange}
            onSelect={onReasonSelect}
            notFoundContent={(
              <div className="inspection-task-management__dropdown-empty">
                {t("inspection.tasks.messages.noRecordsFound")}
              </div>
            )}
          >
            {filteredReasonOptions.map(({ value, label }) => (
              <Select.Option key={value} value={value} label={label} title={label}>
                {renderSelectOptionText(label)}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          label={t("inspection.tasks.columns.priority")}
          name="priorityCode"
          rules={[{ required: true }]}
        >
          <Select allowClear placeholder={t("inspection.tasks.filters.selectPriority")}>
            {prioritySelectOptions.map((item) => (
              <Select.Option key={item.value} value={item.value}>
                {item.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </div>
    </div>
  );
};

export default TaskInfoFields;
