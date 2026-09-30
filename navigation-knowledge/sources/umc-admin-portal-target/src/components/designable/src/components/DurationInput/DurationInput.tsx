import React, { useEffect, useMemo, useState } from "react";
import { connect, mapReadPretty, useField, useForm } from "@formily/react";
import { PreviewText } from "@formily/antd";
import { Input } from "antd";
import { useTranslation } from "react-i18next";
import {
  buildDurationValue,
  getDurationSegmentMaxLength,
  isDurationSegmentWithinRange,
  normalizeDurationHmsValue,
  parseDurationSegments,
} from "./utils";
import "./index.less";

type DurationSegmentKey = "hours" | "minutes" | "seconds";
type DurationSegments = Record<DurationSegmentKey, string>;

export interface DurationInputProps {
  autoFocus?: boolean;
  bordered?: boolean;
  className?: string;
  disabled?: boolean;
  onChange?: (value?: string) => void;
  readOnly?: boolean;
  size?: "large" | "middle" | "small";
  style?: React.CSSProperties;
  value?: string;
}

function isNonEditablePattern(pattern: string | undefined) {
  return (
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty"
  );
}

const DurationInputComponent: React.FC<DurationInputProps> = ({
  autoFocus,
  bordered = true,
  className,
  disabled,
  onChange,
  readOnly,
  size = "middle",
  style,
  value,
}) => {
  const field = useField();
  const form = useForm();
  const { t } = useTranslation();
  const [segments, setSegments] = useState<DurationSegments>(() =>
    parseDurationSegments(value),
  );
  const [editingSegment, setEditingSegment] = useState<DurationSegmentKey | null>(
    null,
  );

  const isNonEditable =
    Boolean(disabled) ||
    Boolean(readOnly) ||
    isNonEditablePattern(form.pattern) ||
    isNonEditablePattern(field.pattern);

  useEffect(() => {
    if (editingSegment) return;
    setSegments(parseDurationSegments(value));
  }, [editingSegment, value]);

  useEffect(() => {
    const normalized = normalizeDurationHmsValue(value);
    if (
      !isNonEditable &&
      typeof onChange === "function" &&
      value &&
      normalized &&
      normalized !== value
    ) {
      onChange(normalized);
    }
  }, [isNonEditable, onChange, value]);

  const placeholders = useMemo(
    () => ({
      hours: t("DurationInput.hourPlaceholder"),
      minutes: t("DurationInput.minutePlaceholder"),
      seconds: t("DurationInput.secondPlaceholder"),
    }),
    [t],
  );

  const handleSegmentChange =
    (key: DurationSegmentKey) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value
        .replace(/\D/g, "")
        .slice(0, getDurationSegmentMaxLength(key));

      if (!isDurationSegmentWithinRange(key, digits)) {
        return;
      }

      const nextSegments = {
        ...segments,
        [key]: digits,
      };
      setSegments(nextSegments);
      onChange?.(buildDurationValue(nextSegments));
    };

  const handleFocus = (key: DurationSegmentKey) => () => {
    setEditingSegment(key);
  };

  const handleBlur = () => {
    setEditingSegment(null);
    if (Object.values(segments).every((value) => value === "")) return;
    const paddedSegments: DurationSegments = {
      hours: segments.hours.padStart(2, "0"),
      minutes: segments.minutes.padStart(2, "0"),
      seconds: segments.seconds.padStart(2, "0"),
    };
    setSegments(paddedSegments);
    onChange?.(buildDurationValue(paddedSegments));
  };

  return (
    <div
      className={[
        "duration-input",
        bordered !== false ? "duration-input--framed" : "",
        isNonEditable ? "duration-input--readonly" : "",
        bordered === false ? "duration-input--borderless" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <Input
        autoFocus={autoFocus}
        bordered={false}
        className="duration-input__segment"
        disabled={isNonEditable}
        inputMode="numeric"
        maxLength={getDurationSegmentMaxLength("hours")}
        onBlur={handleBlur}
        onChange={handleSegmentChange("hours")}
        onFocus={handleFocus("hours")}
        placeholder={placeholders.hours}
        readOnly={isNonEditable}
        size={size}
        value={segments.hours}
      />
      <span className="duration-input__separator">:</span>
      <Input
        bordered={false}
        className="duration-input__segment"
        disabled={isNonEditable}
        inputMode="numeric"
        maxLength={getDurationSegmentMaxLength("minutes")}
        onBlur={handleBlur}
        onChange={handleSegmentChange("minutes")}
        onFocus={handleFocus("minutes")}
        placeholder={placeholders.minutes}
        readOnly={isNonEditable}
        size={size}
        value={segments.minutes}
      />
      <span className="duration-input__separator">:</span>
      <Input
        bordered={false}
        className="duration-input__segment"
        disabled={isNonEditable}
        inputMode="numeric"
        maxLength={getDurationSegmentMaxLength("seconds")}
        onBlur={handleBlur}
        onChange={handleSegmentChange("seconds")}
        onFocus={handleFocus("seconds")}
        placeholder={placeholders.seconds}
        readOnly={isNonEditable}
        size={size}
        value={segments.seconds}
      />
    </div>
  );
};

export const DurationInput = connect(
  DurationInputComponent,
  mapReadPretty((props) => (
    <PreviewText.Input
      {...props}
      value={normalizeDurationHmsValue(props.value) ?? ""}
    />
  )),
);

export default DurationInput;
