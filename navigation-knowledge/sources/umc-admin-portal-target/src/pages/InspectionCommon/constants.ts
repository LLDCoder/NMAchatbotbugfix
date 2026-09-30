export const INSPECTION_QUERY_KEYS = {
  scope: "scope",
  role: "role",
  tab: "tab",
  teamTab: "teamTab",
  teamTaskSource: "teamTaskSource",
  view: "view",
  taskId: "taskId",
  taskNo: "taskNo",
  visitId: "visitId",
  step: "step",
  violationId: "violationId",
  violationNo: "violationNo",
  type: "type",
  status: "status",
  from: "from",
  reportNo: "reportNo",
  mode: "mode",
} as const;

export const INSPECTION_ROUTE_STATE_KEYS = {
  resetTaskFilters: "__resetInspectionTaskFilters",
} as const;

export const formatInspectionAttachmentFileTypes = (
  extensions: string[],
  locale: string,
) => {
  const fileTypes = extensions.map((extension) => extension.replace(".", "").toLowerCase());

  if (fileTypes.length <= 1) {
    return fileTypes[0] || "";
  }

  return new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(fileTypes);
};

export const INSPECTION_PATHS = {
  tasks: "/inspection/tasks",
  taskDetail: "/inspection/tasks/detail",
  taskExecution: "/inspection/tasks/execution",
  violations: "/inspection/violations",
  violationDetail: "/inspection/violations/detail",
  report: "/inspection/tasks/report",
} as const;

export const TASK_STATUSES = [
  "QUEUED",
  "PENDING_VISIT",
  "IN_PROGRESS",
  "ACCESS_FAILED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const VIOLATION_STATUSES = [
  "PENDING_ROUTING",
  "PENDING_CONTENT_REPORT",
  "REPORT_SUBMITTED",
  "PENDING_REVIEW",
  "PENDING_COMMITTEE_DECISION",
  "PENDING_APPROVAL",
  "PENDING_PAYMENT",
  "WARNING_ISSUED",
  "PAID",
  "UNDER_APPEAL",
  "CANCELLED",
] as const;

export const EXECUTION_STEPS = [
  "targetAccess",
  "checklist",
  "seizedMaterials",
  "review",
] as const;
