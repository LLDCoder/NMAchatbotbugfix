import { useEffect, useRef, useState } from "react";
import { DatePicker, Popover } from "antd";
import moment, { type Moment } from "moment";
import { useTranslation } from "react-i18next";
import departmentBriefcaseIcon from "../assets/department-briefcase.svg";
import departmentChevronCornerIcon from "../assets/department-chevron-corner.svg";
import type {
  DashboardDepartment,
  DashboardDepartmentOption,
  DashboardRangeValue,
  DashboardRoleVariant,
  DashboardTimePreset,
} from "../type";

const { RangePicker } = DatePicker;
let timeFilterControlSequence = 0;

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="dashboard__time-filter-icon"
    >
      <path
        d="M2.25 3.75L6 8.25L9.75 3.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
      />
    </svg>
  );
}

const TIME_PRESET_OPTIONS: Array<{
  key: DashboardTimePreset;
  textKey: string;
}> = [
  {
    key: "last7",
    textKey: "adminDashboard.timeFilter.last7",
  },
  {
    key: "last30",
    textKey: "adminDashboard.timeFilter.last30",
  },
  {
    key: "last6Months",
    textKey: "adminDashboard.timeFilter.last6Months",
  },
  {
    key: "lastYear",
    textKey: "adminDashboard.timeFilter.lastYear",
  },
  {
    key: "custom",
    textKey: "adminDashboard.timeFilter.custom",
  },
];

interface DepartmentSelectorProps {
  visible: boolean;
  departments: DashboardDepartmentOption[];
  value: DashboardDepartment;
  onVisibleChange: (visible: boolean) => void;
  onChange: (department: DashboardDepartment) => void;
}

export function DepartmentSelector({
  visible,
  departments,
  value,
  onVisibleChange,
  onChange,
}: DepartmentSelectorProps) {
  const { t } = useTranslation();
  const selected = departments.find((item) => item.key === value);

  const overlay = (
    <div className="dashboard__department-menu">
      <div className="dashboard__department-menu-title">
        {t("adminDashboard.departments.selectDepartment")}
      </div>
      {departments.map((item) => {
        const isActive = item.key === value;

        return (
          <button
            key={item.key}
            type="button"
            className={`dashboard__department-option${
              isActive ? " dashboard__department-option--active" : ""
            }`}
            onClick={() => {
              onChange(item.key);
              onVisibleChange(false);
            }}
          >
            <span>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover
      trigger="click"
      visible={visible}
      content={overlay}
      placement="bottomLeft"
      overlayClassName="dashboard__department-dropdown"
      destroyTooltipOnHide
      onVisibleChange={onVisibleChange}
    >
      <button
        type="button"
        className={`dashboard__department-trigger${
          visible ? " dashboard__department-trigger--open" : ""
        }`}
        aria-label={t("adminDashboard.departments.selectDepartment")}
        aria-expanded={visible}
      >
        <span className="dashboard__department-icon-frame">
          <img
            src={departmentBriefcaseIcon}
            alt=""
            className="dashboard__department-icon"
          />
        </span>
        <span className="dashboard__department-label">
          {selected ? t(selected.shortLabelKey) : ""}
        </span>
        <span className="dashboard__department-chevron" aria-hidden="true">
          <span className="dashboard__department-chevron-flip">
            <span className="dashboard__department-chevron-rotor">
              <img
                src={departmentChevronCornerIcon}
                alt=""
                className="dashboard__department-chevron-icon"
              />
            </span>
          </span>
        </span>
      </button>
    </Popover>
  );
}

interface RoleSelectorProps {
  visible: boolean;
  roles: DashboardRoleVariant[];
  value: DashboardRoleVariant;
  onVisibleChange: (visible: boolean) => void;
  onChange: (roleVariant: DashboardRoleVariant) => void;
}

export function RoleSelector({
  visible,
  roles,
  value,
  onVisibleChange,
  onChange,
}: RoleSelectorProps) {
  const { t } = useTranslation();
  const roleOptions = roles.length ? roles : [value];
  const options = roleOptions.includes(value)
    ? roleOptions
    : [value, ...roleOptions];
  const hasMultipleRoles = options.length > 1;

  const trigger = (
    <button
      type="button"
      className={`dashboard__role-trigger${
        hasMultipleRoles && visible ? " dashboard__role-trigger--open" : ""
      }${hasMultipleRoles ? "" : " dashboard__role-trigger--readonly"}`}
      aria-label={t("adminDashboard.roles.selectRole")}
      aria-expanded={hasMultipleRoles ? visible : undefined}
    >
      <span className="dashboard__role-label">{t(`adminDashboard.roles.${value}`)}</span>
      {hasMultipleRoles ? (
        <span className="dashboard__role-chevron" aria-hidden="true">
          <span className="dashboard__role-chevron-flip">
            <span className="dashboard__role-chevron-rotor">
              <img
                src={departmentChevronCornerIcon}
                alt=""
                className="dashboard__role-chevron-icon"
              />
            </span>
          </span>
        </span>
      ) : null}
    </button>
  );

  if (!hasMultipleRoles) {
    return trigger;
  }

  const overlay = (
    <div className="dashboard__role-menu">
      <div className="dashboard__role-menu-title">
        {t("adminDashboard.roles.selectRole")}
      </div>
      {options.map((roleVariant) => {
        const isActive = roleVariant === value;

        return (
          <button
            key={roleVariant}
            type="button"
            className={`dashboard__role-option${
              isActive ? " dashboard__role-option--active" : ""
            }`}
            onClick={() => {
              onChange(roleVariant);
              onVisibleChange(false);
            }}
          >
            <span>{t(`adminDashboard.roles.${roleVariant}`)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover
      trigger="click"
      visible={visible}
      content={overlay}
      placement="bottomLeft"
      overlayClassName="dashboard__role-dropdown"
      destroyTooltipOnHide
      onVisibleChange={onVisibleChange}
    >
      {trigger}
    </Popover>
  );
}

interface DashboardTimeFilterProps {
  visible: boolean;
  preset: DashboardTimePreset;
  valueLabel: string;
  draftRange: DashboardRangeValue;
  onVisibleChange: (visible: boolean) => void;
  onPresetSelect: (preset: Exclude<DashboardTimePreset, "custom">) => void;
  onDraftRangeChange: (range: DashboardRangeValue) => void;
  onApplyCustomRange: () => void;
  onCancelCustomRange: () => void;
}

export function DashboardTimeFilter({
  visible,
  preset,
  valueLabel,
  draftRange,
  onVisibleChange,
  onPresetSelect,
  onDraftRangeChange,
  onApplyCustomRange,
  onCancelCustomRange,
}: DashboardTimeFilterProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [controlId] = useState(() => `dashboard-time-filter-${++timeFilterControlSequence}`);
  const [customMode, setCustomMode] = useState(preset === "custom");

  useEffect(() => {
    if (visible) {
      setCustomMode(preset === "custom");
    }
  }, [preset, visible]);

  const hasCompleteRange = Boolean(draftRange?.[0] && draftRange?.[1]);

  const overlay = (
    <div
      ref={overlayRef}
      className={`dashboard__time-filter-panel${
        customMode ? " dashboard__time-filter-panel--custom" : ""
      }`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="dashboard__time-filter-options" id={`${controlId}-options`} role="listbox">
        {TIME_PRESET_OPTIONS.map((option) => {
          const isActive =
            option.key === "custom"
              ? preset === "custom" || customMode
              : preset === option.key && !customMode;

          return (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={isActive}
              data-reader-filter-choice={option.key === "custom" ? "requires-input" : "immediate"}
              data-reader-filter-option-value={option.key}
              className={`dashboard__time-filter-option${
                isActive ? " dashboard__time-filter-option--active" : ""
              }`}
              onClick={() => {
                if (option.key === "custom") {
                  setCustomMode(true);
                  return;
                }

                setCustomMode(false);
                onPresetSelect(option.key);
              }}
            >
              {t(option.textKey)}
            </button>
          );
        })}
      </div>

      {customMode ? (
        <div className="dashboard__time-filter-custom">
          <RangePicker
            value={draftRange as [Moment, Moment] | null}
            format="DD/MM/YYYY"
            allowClear
            placeholder={[
              t("adminDashboard.timeFilter.startDate"),
              t("adminDashboard.timeFilter.endDate"),
            ]}
            className="dashboard__time-filter-range"
            getPopupContainer={() => overlayRef.current || document.body}
            disabledDate={(current) =>
              Boolean(current && current > moment().endOf("day"))
            }
            onChange={(value) =>
              onDraftRangeChange(value as DashboardRangeValue)
            }
          />

          <div className="dashboard__time-filter-actions">
            <button
              type="button"
              className="dashboard__time-filter-action dashboard__time-filter-action--secondary"
              onClick={() => {
                setCustomMode(preset === "custom");
                onCancelCustomRange();
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="dashboard__time-filter-action dashboard__time-filter-action--primary"
              disabled={!hasCompleteRange}
              onClick={() => {
                onApplyCustomRange();
                setCustomMode(false);
              }}
            >
              {t("common.apply")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <Popover
      trigger="click"
      visible={visible}
      content={overlay}
      placement="bottomLeft"
      overlayClassName="dashboard__time-filter-dropdown"
      destroyTooltipOnHide
      onVisibleChange={onVisibleChange}
    >
      <button
        type="button"
        id={controlId}
        role="combobox"
        aria-label={valueLabel}
        aria-haspopup="listbox"
        aria-expanded={visible}
        aria-controls={`${controlId}-options`}
        data-reader-select-filter="true"
        data-reader-filter-context-field="preset"
        data-reader-filter-selected={valueLabel}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onVisibleChange(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            onVisibleChange(true);
          }
        }}
        className={`dashboard__time-filter-trigger${
          visible ? " dashboard__time-filter-trigger--open" : ""
        }${
          preset === "custom" ? " dashboard__time-filter-trigger--custom" : ""
        }`}
      >
        <span className="dashboard__time-filter-label">{valueLabel}</span>
        <ChevronDownIcon />
      </button>
    </Popover>
  );
}
