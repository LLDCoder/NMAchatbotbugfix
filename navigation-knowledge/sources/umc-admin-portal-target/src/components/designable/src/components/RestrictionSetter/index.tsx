import React, { useCallback } from "react";
import { Switch } from "antd";
import type { RestrictionSetterValue } from "../../utils/dateRestriction";
import { useTranslation } from "react-i18next";
import "./index.less";

export type { RestrictionSetterValue } from "../../utils/dateRestriction";

export interface RestrictionSetterProps {
  value?: RestrictionSetterValue;
  onChange?: (value: RestrictionSetterValue) => void;
  showTenDaysFromToday?: boolean;
  showWithinSixMonthsFromToday?: boolean;
}

const RestrictionSetter: React.FC<RestrictionSetterProps> = ({
  value,
  onChange,
  showTenDaysFromToday = false,
  showWithinSixMonthsFromToday = false,
}) => {
  const { t } = useTranslation();
  const beforeToday = value?.beforeToday ?? false;
  const afterToday = value?.afterToday ?? false;
  const includeToday = value?.includeToday ?? false;
  const tenDaysFromToday = value?.tenDaysFromToday ?? false;
  const withinSixMonthsFromToday =
    value?.withinSixMonthsFromToday ?? false;

  const handleBeforeChange = useCallback(
    (checked: boolean) => {
      onChange?.({
        beforeToday: checked,
        afterToday: checked ? false : value?.afterToday ?? false,
        includeToday: value?.includeToday ?? false,
        tenDaysFromToday: checked
          ? false
          : value?.tenDaysFromToday ?? false,
        withinSixMonthsFromToday: checked
          ? false
          : value?.withinSixMonthsFromToday ?? false,
      });
    },
    [onChange, value],
  );

  const handleAfterChange = useCallback(
    (checked: boolean) => {
      onChange?.({
        beforeToday: checked ? false : value?.beforeToday ?? false,
        afterToday: checked,
        includeToday: value?.includeToday ?? false,
        tenDaysFromToday: checked
          ? false
          : value?.tenDaysFromToday ?? false,
        withinSixMonthsFromToday: checked
          ? false
          : value?.withinSixMonthsFromToday ?? false,
      });
    },
    [onChange, value],
  );

  const handleIncludeTodayChange = useCallback(
    (checked: boolean) => {
      onChange?.({
        beforeToday: value?.beforeToday ?? false,
        afterToday: value?.afterToday ?? false,
        includeToday: checked,
        tenDaysFromToday: checked
          ? false
          : value?.tenDaysFromToday ?? false,
        withinSixMonthsFromToday: checked
          ? false
          : value?.withinSixMonthsFromToday ?? false,
      });
    },
    [onChange, value],
  );

  const handleTenDaysFromTodayChange = useCallback(
    (checked: boolean) => {
      onChange?.({
        beforeToday: checked ? false : value?.beforeToday ?? false,
        afterToday: checked ? false : value?.afterToday ?? false,
        includeToday: checked ? false : value?.includeToday ?? false,
        tenDaysFromToday: checked,
        withinSixMonthsFromToday:
          value?.withinSixMonthsFromToday ?? false,
      });
    },
    [onChange, value],
  );

  const handleWithinSixMonthsFromTodayChange = useCallback(
    (checked: boolean) => {
      onChange?.({
        beforeToday: checked ? false : value?.beforeToday ?? false,
        afterToday: checked ? false : value?.afterToday ?? false,
        includeToday: checked ? false : value?.includeToday ?? false,
        tenDaysFromToday: value?.tenDaysFromToday ?? false,
        withinSixMonthsFromToday: checked,
      });
    },
    [onChange, value],
  );

  return (
    <div className="restriction-setter">
      <div className="restriction-setter__row">
        <span className="restriction-setter__label">
          {t("Formily.designerSetters.beforeToday")}
        </span>
        <Switch checked={beforeToday} onChange={handleBeforeChange} size="small" />
      </div>
      <div className="restriction-setter__row">
        <span className="restriction-setter__label">
          {t("Formily.designerSetters.afterToday")}
        </span>
        <Switch checked={afterToday} onChange={handleAfterChange} size="small" />
      </div>
      <div className="restriction-setter__row">
        <span className="restriction-setter__label">
          {t("Formily.designerSetters.today")}
        </span>
        <Switch checked={includeToday} onChange={handleIncludeTodayChange} size="small" />
      </div>
      {showTenDaysFromToday && (
        <div className="restriction-setter__row">
          <span className="restriction-setter__label">
            {t("Formily.designerSetters.tenDaysFromToday")}
          </span>
          <Switch
            checked={tenDaysFromToday}
            onChange={handleTenDaysFromTodayChange}
            size="small"
          />
        </div>
      )}
      {showWithinSixMonthsFromToday && (
        <div className="restriction-setter__row">
          <span className="restriction-setter__label">
            {t("Formily.designerSetters.withinSixMonthsFromToday")}
          </span>
          <Switch
            checked={withinSixMonthsFromToday}
            onChange={handleWithinSixMonthsFromTodayChange}
            size="small"
          />
        </div>
      )}
    </div>
  );
};

export default RestrictionSetter;
