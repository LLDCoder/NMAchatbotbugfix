import React, { useState, useEffect, useCallback } from "react";
import { Switch, InputNumber } from "antd";
import { useTranslation } from "react-i18next";
import "./index.less";

const DEFAULT_LIMIT = 200;
const MIN_LIMIT = 1;
// const MAX_LIMIT = 200;

export interface WordLimitSetterProps {
  value?: { enabled: boolean; limit: number };
  onChange?: (value: { enabled: boolean; limit: number }) => void;
}

const WordLimitSetter: React.FC<WordLimitSetterProps> = ({
  value,
  onChange,
  max
}) => {
  const { t } = useTranslation();
  const enabled = value?.enabled ?? false;
  const limit = value?.limit ?? DEFAULT_LIMIT;
  const MAX_LIMIT = max ?? 200;

  const [inputVal, setInputVal] = useState<number | null>(limit);

  useEffect(() => {
    setInputVal(value?.limit ?? DEFAULT_LIMIT);
  }, [value?.limit]);

  const clampValue = (raw: number | null): number => {
    if (raw === null || isNaN(raw) || raw < MIN_LIMIT || raw > MAX_LIMIT) {
      return DEFAULT_LIMIT;
    }
    return Math.floor(raw);
  };

  const handleToggle = useCallback(
    (checked: boolean) => {
      onChange?.({
        enabled: checked,
        limit: checked ? (inputVal != null ? clampValue(inputVal) : DEFAULT_LIMIT) : DEFAULT_LIMIT,
      });
    },
    [onChange, inputVal],
  );

  const handleLimitChange = useCallback((val: number | null) => {
    setInputVal(val);
  }, []);

  const commitValue = useCallback(() => {
    const clamped = clampValue(inputVal);
    setInputVal(clamped);
    onChange?.({ enabled: true, limit: clamped });
  }, [inputVal, onChange]);

  return (
    <div className="word-limit-setter">
      <div className="word-limit-setter__row">
        <span className="word-limit-setter__label">
          {t("Formily.designerSetters.wordLimit")}
        </span>
        <Switch
          checked={enabled}
          onChange={handleToggle}
          size="small"
        />
      </div>

      {enabled && (
        <div className="word-limit-setter__input-row">
          <InputNumber
            className="word-limit-setter__input"
            min={MIN_LIMIT}
            max={MAX_LIMIT}
            value={inputVal}
            precision={0}
            onChange={handleLimitChange}
            onBlur={commitValue}
            onPressEnter={commitValue}
          />
        </div>
      )}
    </div>
  );
};

export default WordLimitSetter;
