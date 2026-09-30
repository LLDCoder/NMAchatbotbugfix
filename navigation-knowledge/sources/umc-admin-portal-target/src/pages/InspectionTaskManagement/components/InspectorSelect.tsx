import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import emptyIcon from '@/assets/images/empty.svg';
import { getInspectionInspectors } from '@/services/inspection';
import { inspectionFigmaAssets } from '../../InspectionCommon/assets';
import { inspectorOptions } from '../taskConfig';
import { normalizeInspectorIds } from './inspectorSelectUtils';

type InspectorSelectValue = string | string[] | undefined;
export type InspectorSelectOption = {
  id: string;
  name: string;
};

type InspectorSelectProps = {
  value?: InspectorSelectValue;
  onChange?: (value: InspectorSelectValue) => void;
  multiple?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  maxTagCount?: number;
  options?: InspectorSelectOption[];
  loading?: boolean;
  enabled?: boolean;
};

const InspectorSelect: React.FC<InspectorSelectProps> = ({
  value,
  onChange,
  multiple = true,
  disabled = false,
  allowClear,
  placeholder,
  className,
  dropdownClassName,
  maxTagCount = 2,
  options,
  loading = false,
  enabled = true,
}) => {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [remoteInspectorOptions, setRemoteInspectorOptions] = useState(inspectorOptions);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasProvidedOptions = Array.isArray(options);
  const resolvedInspectorOptions = useMemo(() => {
    if (hasProvidedOptions) {
      return options || [];
    }
    return remoteInspectorOptions.length ? remoteInspectorOptions : inspectorOptions;
  }, [hasProvidedOptions, options, remoteInspectorOptions]);

  const trimmedSearchKeyword = searchKeyword.trim().toLowerCase();
  const filteredInspectorOptions = useMemo(() => {
    if (!trimmedSearchKeyword) return resolvedInspectorOptions;

    return resolvedInspectorOptions.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(trimmedSearchKeyword));
  }, [resolvedInspectorOptions, trimmedSearchKeyword]);
  const visibleInspectorOptions = useMemo(() => {
    if (!disabled || multiple) return filteredInspectorOptions;

    const currentId = normalizeInspectorIds(value)[0];
    const selectedInspector = resolvedInspectorOptions.find((item) => item.id === currentId);
    return selectedInspector ? [selectedInspector] : resolvedInspectorOptions.slice(0, 1);
  }, [disabled, filteredInspectorOptions, multiple, resolvedInspectorOptions, value]);
  const hasSearchKeyword = searchKeyword.trim().length > 0;

  useEffect(() => {
    if (!enabled || hasProvidedOptions) {
      return undefined;
    }

    let active = true;
    getInspectionInspectors()
      .then((items) => {
        if (!active) return;
        const nextOptions = items
          .map((item) => ({
            id: String(item.id),
            name: item.nameEn || item.name || String(item.id),
          }))
          .filter((item) => item.id);
        if (nextOptions.length) {
          setRemoteInspectorOptions(nextOptions);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [enabled, hasProvidedOptions]);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [dropdownOpen]);

  const handleDropdownVisibleChange = useCallback((open: boolean) => {
    if (disabled) return;

    setDropdownOpen(open);
    if (!open) {
      setSearchKeyword('');
    }
  }, [disabled]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDropdownOpen(true);
    setSearchKeyword(event.target.value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchKeyword('');
    searchInputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(() => {
    setSearchKeyword('');
  }, []);

  const renderDropdown = useCallback((menu: React.ReactElement) => {
    const searchRowClassName = hasSearchKeyword
      ? 'inspection-task-management__assign-modal-dropdown-search inspection-task-management__assign-modal-dropdown-search--active'
      : 'inspection-task-management__assign-modal-dropdown-search';
    const dropdownPanelClassName = filteredInspectorOptions.length
      ? 'inspection-task-management__assign-modal-dropdown-panel'
      : 'inspection-task-management__assign-modal-dropdown-panel inspection-task-management__assign-modal-dropdown-panel--empty';

    return (
      <div className={dropdownPanelClassName}>
        <div
          className={searchRowClassName}
          onClick={() => searchInputRef.current?.focus()}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <img
            src={inspectionFigmaAssets.createTask.searchIcon}
            alt=""
            className="inspection-task-management__assign-modal-dropdown-search-icon"
          />
          <input
            ref={searchInputRef}
            className="inspection-task-management__assign-modal-dropdown-search-input"
            value={searchKeyword}
            placeholder={t('inspection.common.search')}
            onChange={handleSearchChange}
            onKeyDown={(event) => event.stopPropagation()}
          />
          {hasSearchKeyword ? (
            <button
              type="button"
              className="inspection-task-management__assign-modal-dropdown-clear"
              onClick={handleSearchClear}
              onMouseDown={(event) => event.preventDefault()}
              aria-label={t('inspection.common.reset')}
            >
              <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" />
            </button>
          ) : null}
        </div>
        <div className="inspection-task-management__assign-modal-dropdown-menu">
          {menu}
        </div>
      </div>
    );
  }, [
    filteredInspectorOptions.length,
    handleSearchChange,
    handleSearchClear,
    hasSearchKeyword,
    searchKeyword,
    t,
  ]);

  return (
    <Select
      allowClear={allowClear ?? !disabled}
      autoClearSearchValue
      className={[
        'inspection-task-management__inspector-select',
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      dropdownClassName={dropdownClassName || 'inspection-task-management__assign-modal-dropdown'}
      dropdownRender={renderDropdown}
      filterOption={false}
      listHeight={272}
      loading={loading}
      maxTagCount={multiple ? maxTagCount : undefined}
      menuItemSelectedIcon={null}
      mode={multiple ? 'multiple' : undefined}
      notFoundContent={(
        <div className="inspection-task-management__assign-modal-empty-state">
          <img src={emptyIcon} alt="" className="inspection-task-management__assign-modal-empty-icon" />
          <div className="inspection-task-management__assign-modal-empty-text">
            {t('inspection.tasks.messages.noRecordsFound')}
          </div>
        </div>
      )}
      open={disabled ? false : dropdownOpen}
      placeholder={placeholder || t('inspection.tasks.fields.selectInspector')}
      showArrow
      showSearch={false}
      value={value}
      onChange={onChange}
      onClear={handleSearchClear}
      onDropdownVisibleChange={handleDropdownVisibleChange}
      onSelect={handleSelect}
    >
      {visibleInspectorOptions.map((item) => (
        <Select.Option key={item.id} value={item.id}>
          {item.name}
        </Select.Option>
      ))}
    </Select>
  );
};

export default InspectorSelect;
