import type { ReactNode } from "react";
import { Tooltip } from "antd";
import type { SelectProps } from "antd/es/select";

type OmittedSelectValue = {
  label?: ReactNode;
  value?: unknown;
};

type ReadOnlyMultiSelectConfig = {
  isMultiple: boolean;
  isReadOnly: boolean;
  configuredMaxTagCount?: SelectProps<unknown, any>["maxTagCount"];
  configuredMaxTagPlaceholder?: SelectProps<unknown, any>["maxTagPlaceholder"];
  defaultMaxTagCount?: SelectProps<unknown, any>["maxTagCount"];
};

export function isNonEditablePattern(pattern: string | undefined) {
  return (
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty"
  );
}

export function getDisplayTextFromNode(value: ReactNode | unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return "";
}

export function getOmittedSelectLabels(
  omittedValues: OmittedSelectValue[],
) {
  return omittedValues
    .map((item) => {
      const labelText = getDisplayTextFromNode(item?.label);
      if (labelText) {
        return labelText;
      }

      return getDisplayTextFromNode(item?.value);
    })
    .filter(Boolean);
}

export function buildReadOnlyMaxTagPlaceholder(
  omittedValues: OmittedSelectValue[],
) {
  const omittedLabels = getOmittedSelectLabels(omittedValues);
  const tooltipTitle = omittedLabels.join(", ");
  const hiddenCount = Array.isArray(omittedValues) ? omittedValues.length : 0;
  const placeholderText = `+${hiddenCount}`;

  if (!tooltipTitle) {
    return <span>{placeholderText}</span>;
  }

  return (
    <Tooltip
      title={tooltipTitle}
      overlayInnerStyle={{ maxWidth: 800, whiteSpace: "normal" }}
    >
      <span title={tooltipTitle}>{placeholderText}</span>
    </Tooltip>
  );
}

export function getReadOnlyMultiSelectProps({
  isMultiple,
  isReadOnly,
  configuredMaxTagCount,
  configuredMaxTagPlaceholder,
  defaultMaxTagCount,
}: ReadOnlyMultiSelectConfig) {
  if (!isMultiple || !isReadOnly) {
    return {
      maxTagCount: configuredMaxTagCount,
      maxTagPlaceholder: configuredMaxTagPlaceholder,
    };
  }

  return {
    maxTagCount: configuredMaxTagCount ?? defaultMaxTagCount,
    maxTagPlaceholder: buildReadOnlyMaxTagPlaceholder,
  };
}
