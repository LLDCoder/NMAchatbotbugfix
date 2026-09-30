import React, { useState, useEffect } from "react";
import { Modal, Select, DatePicker } from "antd";
import { useTranslation } from "react-i18next";
import "./index.less";
import moment, { type Moment } from "moment";
import { CustomButton, SelectAllDropdown } from "@/components/common";
const { Option } = Select;
const { RangePicker } = DatePicker;

const getPopupContainer = () => document.body;

type FilterSelectValue =
  | Array<string | number>
  | string
  | number
  | null
  | undefined;

const normalizeMultiValue = (value: FilterSelectValue): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  if (value === null || value === undefined) {
    return [];
  }

  const normalizedValue = String(value).trim();

  if (!normalizedValue) {
    return [];
  }

  return normalizedValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeSingleValue = (value: FilterSelectValue) =>
  normalizeMultiValue(value)[0];

export interface FilterValues {
  serviceCategory?: string[];
  priority?: string[];
  department?: string[];
  startTime?: string;
  endTime?: string;
  status?: string;
  type?: string;
}

export interface FilterModalProps {
  visible: boolean;
  onCancel: () => void;
  onSearch: (values: FilterValues) => void;
  initialValues?: FilterValues;
  categoryOptions?: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    code: string;
  }>;
  departmentOptions?: Array<{
    id: string | number;
    nameEn: string;
    nameAr: string;
    code: string;
  }>;
  priorityOptions?: Array<{
    id: number;
    nameEn: string;
    nameAr: string;
    code: string;
  }>;
  statusOptions?: Array<{
    id: number;
    nameEn: string;
    nameAr: string;
    code: string;
  }>;
  typeOptions?: Array<{
    id: number;
    nameEn: string;
    nameAr: string;
    code: string;
  }>;
  includeInlineFilters?: boolean;
}

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onCancel,
  onSearch,
  initialValues,
  categoryOptions = [],
  departmentOptions = [],
  priorityOptions = [],
  statusOptions = [],
  typeOptions = [],
  includeInlineFilters = false,
}) => {
  const { i18n, t } = useTranslation();
  const [serviceCategory, setServiceCategory] = useState<string[]>([]);
  const [priority, setPriority] = useState<string | undefined>();
  const [department, setDepartment] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [type, setType] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Moment | null, Moment | null]>([
    null,
    null,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setServiceCategory(normalizeMultiValue(initialValues?.serviceCategory));
    setPriority(normalizeSingleValue(initialValues?.priority));
    setDepartment(normalizeSingleValue(initialValues?.department));
    setStatus(normalizeSingleValue(initialValues?.status));
    setType(normalizeSingleValue(initialValues?.type));

    const startMoment = initialValues?.startTime
      ? moment(initialValues.startTime)
      : null;
    const endMoment = initialValues?.endTime
      ? moment(initialValues.endTime)
      : null;

    if (startMoment?.isValid() && endMoment?.isValid()) {
      setDateRange([startMoment, endMoment]);
      return;
    }

    setDateRange([null, null]);
  }, [visible, initialValues]);

  const handleSearch = () => {
    const values: FilterValues = {
      serviceCategory: serviceCategory.length > 0 ? serviceCategory : undefined,
      priority: priority ? [priority] : undefined,
      department: department ? [department] : undefined,
      startTime: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
      endTime: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : undefined,
      ...(includeInlineFilters ? { status, type } : {}),
    };
    onSearch(values);
  };

  const handleCancel = () => {
    setServiceCategory([]);
    setPriority(undefined);
    setDepartment(undefined);
    setStatus(undefined);
    setType(undefined);
    setDateRange([null, null]);
    onCancel();
  };
  const categoryOpts = categoryOptions.map((option)=>{
    const label = i18n.resolvedLanguage === "ar" ? option.nameAr : option.nameEn;
    return {
      label,
      value: String(option.id ?? "")
    }
  });
  return (
    <Modal
      visible={visible}
      onCancel={handleCancel}
      title={t("serviceConfiguration.filters.filterTitle")}
      footer={
        <div className="filter-modal-footer">
          <CustomButton
            text={t("common.cancel")}
            variant="outline"
            onClick={handleCancel}
            customClassName="filter-cancel-btn"
          />
          <CustomButton
            text={t("common.apply")}
            variant="primary"
            onClick={handleSearch}
            customClassName="filter-search-btn"
          />
        </div>
      }
      className="service-configuration-filter-modal"
      centered
      width={960}
    >
      <div className="filter-modal-content">
        <div className="filter-modal-body">
          {includeInlineFilters && (
            <div className="filter-form-row">
              <div className="filter-form-item">
                <label className="filter-label">
                  {t("serviceConfiguration.table.status")}
                </label>
                <Select
                  allowClear
                  className="filter-select"
                  placeholder={t("form.placeholder.allStatus")}
                  value={status}
                  onChange={(value) => setStatus(normalizeSingleValue(value))}
                  getPopupContainer={getPopupContainer}
                >
                  {statusOptions.map((option) => (
                    <Option key={option.id} value={option.code}>
                      {i18n.resolvedLanguage === "ar" ? option.nameAr : option.nameEn}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="filter-form-item">
                <label className="filter-label">
                  {t("serviceConfiguration.table.type")}
                </label>
                <Select
                  allowClear
                  className="filter-select"
                  placeholder={t("form.placeholder.allTypes")}
                  value={type}
                  onChange={(value) => setType(normalizeSingleValue(value))}
                  getPopupContainer={getPopupContainer}
                >
                  {typeOptions.map((option) => (
                    <Option key={option.id} value={option.code}>
                      {i18n.resolvedLanguage === "ar" ? option.nameAr : option.nameEn}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          <div className="filter-form-row">
            <div className="filter-form-item">
              <label className="filter-label">
                {t("serviceConfiguration.filters.serviceCategory")}
              </label>
              <SelectAllDropdown
                className="filter-select"
                placeholder={t("serviceConfiguration.filters.allCategory")}
                options={categoryOpts}
                value={serviceCategory}
                onChange={(values) => setServiceCategory(normalizeMultiValue(values))}
                getPopupContainer={getPopupContainer}
                dropdownPanelClassName="filter-select-dropdown-panel"
                showSearch
                maxTagCount={2}
                
              />
            </div>
            <div className="filter-form-item">
              <label className="filter-label">
                {t("serviceConfiguration.filters.priority")}
              </label>
              <Select
                allowClear
                className="filter-select"
                placeholder={t("serviceConfiguration.filters.allService")}
                value={priority}
                onChange={(value) => setPriority(normalizeSingleValue(value))}
                optionFilterProp="children"
                getPopupContainer={getPopupContainer}
              >
                {priorityOptions.map((option) => {
                  const label =
                    i18n.resolvedLanguage === "ar" ? option.nameAr : option.nameEn;
                  const value = String(option.code ?? "");

                  if (!value) {
                    return null;
                  }

                  return (
                    <Option key={option.id} value={value}>
                      {label}
                    </Option>
                  );
                })}
              </Select>
            </div>
          </div>
          <div className="filter-form-row">
            <div className="filter-form-item">
              <label className="filter-label">
                {t("serviceConfiguration.filters.department")}
              </label>
              <Select
                allowClear
                className="filter-select"
                placeholder={t("serviceConfiguration.filters.allDepartment")}
                value={department}
                onChange={(value) => setDepartment(normalizeSingleValue(value))}
                optionFilterProp="children"
                getPopupContainer={getPopupContainer}
              >
                {departmentOptions.map((option) => {
                  const label =
                    i18n.resolvedLanguage === "ar" ? option.nameAr : option.nameEn;
                  const value = String(option.id ?? "");

                  if (!value) {
                    return null;
                  }

                  return (
                    <Option key={option.id} value={value}>
                      {label}
                    </Option>
                  );
                })}
              </Select>
            </div>
            <div className="filter-form-item">
              <label className="filter-label">
                {t("serviceConfiguration.filters.lastUpdatedTime")}
              </label>
              <RangePicker
                value={dateRange}
                onChange={(dates) =>
                  setDateRange(
                    dates
                      ? (dates as [Moment | null, Moment | null])
                      : [null, null],
                  )
                }
                className="filter-date-range"
                placeholder={[
                  t("serviceConfiguration.filters.startDate"),
                  t("serviceConfiguration.filters.endDate"),
                ]}
                format="DD/MM/YYYY"
                getPopupContainer={getPopupContainer}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FilterModal;
