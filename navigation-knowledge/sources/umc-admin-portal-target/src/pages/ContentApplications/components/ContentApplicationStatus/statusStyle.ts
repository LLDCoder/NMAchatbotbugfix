const CONTENT_APPLICATION_STATUS_TONE_BY_ID = new Map<string, string>([
  ["2", "orange"],
  ["7", "orange"],
  ["8", "danger"],
  ["10", "neutral"],
  ["11", "warning"],
  ["12", "success"],
  ["13", "warning"],
  ["103", "info"],
  ["104", "warning"],
  ["105", "success"],
  ["106", "danger"],
  ["107", "neutral"],
  ["108", "warning"],
  ["109", "orange"],
]);

export const getContentApplicationStatusStyleClass = (
  statusId?: string | number | null,
) => {
  const tone =
    CONTENT_APPLICATION_STATUS_TONE_BY_ID.get(String(statusId ?? "").trim()) ??
    "neutral";
  return `content-application-status__main--${tone}`;
};
