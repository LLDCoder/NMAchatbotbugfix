import type { AdminLogKind, AdminLogRecord } from "@/services/Logs";

const displayText = (value?: string | null) => value?.trim() || "";

const SYSTEM_OPERATION_CONTROLLERS = new Set([
  "InternalJobs",
  "CustomerInternal",
]);

export const isSystemOperationActor = (
  record: Pick<AdminLogRecord, "controllerName">,
) => SYSTEM_OPERATION_CONTROLLERS.has(displayText(record.controllerName));

export const formatLogId = (
  kind: AdminLogKind,
  id?: string | number | null,
) => {
  if (id === null || id === undefined || String(id).trim() === "") return "-";
  const value = String(id);
  if (kind === "userActivity") {
    return value.startsWith("UAL-") ? value : `UAL-${value}`;
  }
  return value.startsWith("SOL-") ? value : `SOL-${value}`;
};

export const resolveBusinessEvent = (
  record: Pick<AdminLogRecord, "businessEvent" | "controllerName" | "actionName">,
) => {
  const businessEvent = displayText(record.businessEvent);
  if (businessEvent) return businessEvent;

  const controller = displayText(record.controllerName);
  const action = displayText(record.actionName);
  return controller && action ? `${controller}.${action}` : "-";
};

const normalizeDownloadFileName = (value: string) => {
  const normalized = value
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/[/\\]/g, "")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();
  return normalized && normalized !== "." && normalized !== ".."
    ? normalized
    : "";
};

const decodeExtendedFileName = (value: string) => {
  const match = /^UTF-8'[^']*'(.*)$/i.exec(value.trim().replace(/^"|"$/g, ""));
  if (!match?.[1]) return "";

  try {
    return normalizeDownloadFileName(decodeURIComponent(match[1]));
  } catch {
    return "";
  }
};

export const getFilenameFromContentDisposition = (contentDisposition?: string) => {
  if (!contentDisposition) return "";

  const extendedValue = /(?:^|;)\s*filename\*\s*=\s*([^;]*)/i
    .exec(contentDisposition)?.[1];
  const extendedFileName = extendedValue
    ? decodeExtendedFileName(extendedValue)
    : "";
  if (extendedFileName) return extendedFileName;

  const standardMatch = /(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]*))/i
    .exec(contentDisposition);
  const standardValue = standardMatch?.[1] ?? standardMatch?.[2];
  return standardValue ? normalizeDownloadFileName(standardValue) : "";
};

export const buildUtcLogFileName = (prefix: string, now = new Date()) => {
  // Log export filenames use an explicit UTC marker and do not represent a user-entered wall-clock value.
  // eslint-disable-next-line no-restricted-syntax
  const timestamp = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `${prefix}-${timestamp}.csv`;
};
