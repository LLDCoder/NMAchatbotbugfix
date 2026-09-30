import { useEffect, useRef, useState } from "react";
import { DatePicker, Dropdown } from "antd";
import moment, { type Moment } from "moment";
import { useTranslation } from "react-i18next";
import type {
  InspectionAnalyticsRangeValue,
  InspectionAnalyticsTimePreset,
} from "../types";

const { RangePicker } = DatePicker;

const PRESETS: Array<{
  key: InspectionAnalyticsTimePreset;
  labelKey: string;
}> = [
  { key: "last7", labelKey: "inspection.reportsAnalytics.timePresets.last7" },
  { key: "last30", labelKey: "inspection.reportsAnalytics.timePresets.last30" },
  { key: "last6Months", labelKey: "inspection.reportsAnalytics.timePresets.last6Months" },
  { key: "lastYear", labelKey: "inspection.reportsAnalytics.timePresets.lastYear" },
  { key: "custom", labelKey: "inspection.reportsAnalytics.timePresets.custom" },
];

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="inspection-reports__time-filter-icon"
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

type HeaderTimeFilterProps = {
  visible: boolean;
  preset: InspectionAnalyticsTimePreset;
  valueLabel: string;
  draftRange: InspectionAnalyticsRangeValue;
  onVisibleChange: (visible: boolean) => void;
  onPresetSelect: (preset: Exclude<InspectionAnalyticsTimePreset, "custom">) => void;
  onDraftRangeChange: (range: InspectionAnalyticsRangeValue) => void;
  onApplyCustomRange: () => void;
  onCancelCustomRange: () => void;
};

export default function HeaderTimeFilter({
  visible,
  preset,
  valueLabel,
  draftRange,
  onVisibleChange,
  onPresetSelect,
  onDraftRangeChange,
  onApplyCustomRange,
  onCancelCustomRange,
}: HeaderTimeFilterProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [customMode, setCustomMode] = useState(preset === "custom");

  useEffect(() => {
    if (visible) setCustomMode(preset === "custom");
  }, [preset, visible]);

  const hasCompleteRange = Boolean(draftRange?.[0] && draftRange?.[1]);

  const overlay = (
    <div
      ref={overlayRef}
      className={`inspection-reports__time-filter-panel${
        customMode ? " inspection-reports__time-filter-panel--custom" : ""
      }`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="inspection-reports__time-filter-options">
        {PRESETS.map((option) => {
          const active =
            option.key === "custom"
              ? preset === "custom" || customMode
              : preset === option.key && !customMode;

          return (
            <button
              key={option.key}
              type="button"
              className={`inspection-reports__time-filter-option${
                active ? " inspection-reports__time-filter-option--active" : ""
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
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>

      {customMode ? (
        <div className="inspection-reports__time-filter-custom">
          <RangePicker
            value={draftRange as [Moment, Moment] | null}
            format="DD/MM/YYYY"
            allowClear
            className="inspection-reports__time-filter-range"
            placeholder={[
              t("inspection.reportsAnalytics.timeFilter.startDate"),
              t("inspection.reportsAnalytics.timeFilter.endDate"),
            ]}
            getPopupContainer={() => overlayRef.current || document.body}
            disabledDate={(current) =>
              Boolean(current && current > moment().endOf("day"))
            }
            onChange={(value) =>
              onDraftRangeChange(value as InspectionAnalyticsRangeValue)
            }
          />
          <div className="inspection-reports__time-filter-actions">
            <button
              type="button"
              className="inspection-reports__time-filter-action inspection-reports__time-filter-action--secondary"
              onClick={() => {
                setCustomMode(preset === "custom");
                onCancelCustomRange();
              }}
            >
              {t("inspection.common.cancel")}
            </button>
            <button
              type="button"
              disabled={!hasCompleteRange}
              className="inspection-reports__time-filter-action inspection-reports__time-filter-action--primary"
              onClick={() => {
                onApplyCustomRange();
                setCustomMode(false);
              }}
            >
              {t("inspection.common.apply")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <Dropdown
      trigger={["click"]}
      visible={visible}
      overlay={overlay}
      placement="bottomLeft"
      overlayClassName="inspection-reports__time-filter-dropdown"
      destroyPopupOnHide
      onVisibleChange={onVisibleChange}
    >
      <button
        type="button"
        aria-label={t("inspection.reportsAnalytics.timeFilter.ariaLabel")}
        className={`inspection-reports__time-filter-trigger${
          visible ? " inspection-reports__time-filter-trigger--open" : ""
        }${
          preset === "custom"
            ? " inspection-reports__time-filter-trigger--custom"
            : ""
        }`}
      >
        <span className="inspection-reports__time-filter-label">{valueLabel}</span>
        <ChevronDownIcon />
      </button>
    </Dropdown>
  );
}
