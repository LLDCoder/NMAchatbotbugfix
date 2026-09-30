import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePicker, Dropdown } from "antd";
import moment, { type Moment } from "moment";
import type {
  ReportsAnalyticsRangeValue,
  ReportsAnalyticsTimePreset,
} from "../type";

const { RangePicker } = DatePicker;

const TEXT = {
  presets: {
    last7: "serviceReportsAnalytics.timeFilter.last7",
    last30: "serviceReportsAnalytics.timeFilter.last30",
    last6Months: "serviceReportsAnalytics.timeFilter.last6Months",
    lastYear: "serviceReportsAnalytics.timeFilter.lastYear",
    custom: "serviceReportsAnalytics.timeFilter.custom",
  },
  startDate: "serviceReportsAnalytics.timeFilter.startDate",
  endDate: "serviceReportsAnalytics.timeFilter.endDate",
  cancel: "common.cancel",
  apply: "common.apply",
} as const;

const PRESET_OPTIONS: Array<{ key: ReportsAnalyticsTimePreset; textKey: string }> = [
  { key: "last7", textKey: TEXT.presets.last7 },
  { key: "last30", textKey: TEXT.presets.last30 },
  { key: "last6Months", textKey: TEXT.presets.last6Months },
  { key: "lastYear", textKey: TEXT.presets.lastYear },
  { key: "custom", textKey: TEXT.presets.custom },
];

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="service-reports__time-filter-icon"
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

interface HeaderTimeFilterProps {
  visible: boolean;
  preset: ReportsAnalyticsTimePreset;
  valueLabel: string;
  draftRange: ReportsAnalyticsRangeValue;
  onVisibleChange: (visible: boolean) => void;
  onPresetSelect: (
    preset: Exclude<ReportsAnalyticsTimePreset, "custom">,
  ) => void;
  onDraftRangeChange: (range: ReportsAnalyticsRangeValue) => void;
  onApplyCustomRange: () => void;
  onCancelCustomRange: () => void;
}

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
  const { t: translate } = useTranslation();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [customMode, setCustomMode] = useState(preset === "custom");
  const timePresets = PRESET_OPTIONS.map((item) => ({
    key: item.key,
    label: translate(item.textKey),
  }));

  useEffect(() => {
    if (visible) {
      setCustomMode(preset === "custom");
    }
  }, [preset, visible]);

  const hasCompleteRange = Boolean(draftRange?.[0] && draftRange?.[1]);

  const overlay = (
    <div
      ref={overlayRef}
      className={`service-reports__time-filter-panel${
        customMode ? " service-reports__time-filter-panel--custom" : ""
      }`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="service-reports__time-filter-options">
        {timePresets.map((option) => {
          const isActive =
            option.key === "custom"
              ? preset === "custom" || customMode
              : preset === option.key && !customMode;

          return (
            <button
              key={option.key}
              type="button"
              className={`service-reports__time-filter-option${
                isActive ? " service-reports__time-filter-option--active" : ""
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
              {option.label}
            </button>
          );
        })}
      </div>

      {customMode ? (
        <div className="service-reports__time-filter-custom">
          <RangePicker
            value={draftRange as [Moment, Moment] | null}
            format="DD/MM/YYYY"
            allowClear
            placeholder={[
              translate(TEXT.startDate),
              translate(TEXT.endDate),
            ]}
            className="service-reports__time-filter-range"
            getPopupContainer={() => overlayRef.current || document.body}
            disabledDate={(current) =>
              Boolean(current && current > moment().endOf("day"))
            }
            onChange={(value) =>
              onDraftRangeChange(value as ReportsAnalyticsRangeValue)
            }
          />

          <div className="service-reports__time-filter-actions">
            <button
              type="button"
              className="service-reports__time-filter-action service-reports__time-filter-action--secondary"
              onClick={() => {
                setCustomMode(preset === "custom");
                onCancelCustomRange();
              }}
            >
              {translate(TEXT.cancel)}
            </button>
            <button
              type="button"
              className="service-reports__time-filter-action service-reports__time-filter-action--primary"
              disabled={!hasCompleteRange}
              onClick={() => {
                onApplyCustomRange();
                setCustomMode(false);
              }}
            >
              {translate(TEXT.apply)}
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
      overlayClassName="service-reports__time-filter-dropdown"
      destroyPopupOnHide
      onVisibleChange={onVisibleChange}
    >
      <button
        type="button"
        className={`service-reports__time-filter-trigger${
          visible ? " service-reports__time-filter-trigger--open" : ""
        }${
          preset === "custom"
            ? " service-reports__time-filter-trigger--custom"
            : ""
        }`}
      >
        <span className="service-reports__time-filter-label">{valueLabel}</span>
        <ChevronDownIcon />
      </button>
    </Dropdown>
  );
}
