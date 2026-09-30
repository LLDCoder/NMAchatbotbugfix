export type DashboardTranslate = (
  key: string,
  options?: Record<string, string | number>
) => string;

const DASHBOARD_STATIC_TEXT_KEYS: Record<string, string> = {
  Active: "adminDashboard.status.active",
  "Adult Content": "adminDashboard.risks.adult",
  "Artificial Sensitivity": "adminDashboard.risks.artificialSensitivity",
  "AI Content Risk Detection": "adminDashboard.cards.aiContentRisk",
  All: "adminDashboard.tabs.all",
  Appeals: "adminDashboard.tabs.appeals",
  "Approval Rate": "adminDashboard.metrics.approvalRate",
  "Approval Rate of Application": "adminDashboard.metrics.approvalRate",
  Approved: "adminDashboard.status.approved",
  "Avg. Processing Time": "adminDashboard.metrics.avgProcessingTime",
  Blocked: "adminDashboard.tabs.blocked",
  Canceled: "adminDashboard.status.cancelled",
  Cancelled: "adminDashboard.status.cancelled",
  "Child Protection": "adminDashboard.risks.childProtection",
  "Critical Priority": "adminDashboard.priority.critical",
  "Department Processed": "adminDashboard.status.departmentProcessed",
  DepartmentProcessed: "adminDashboard.status.departmentProcessed",
  "Department Processing": "adminDashboard.status.departmentProcessing",
  DepartmentProcessing: "adminDashboard.status.departmentProcessing",
  "Done Today": "adminDashboard.metrics.doneToday",
  "Enquiries & Complaints": "adminDashboard.tabs.enquiriesComplaints",
  Enquiries: "adminDashboard.tabs.enquiriesComplaints",
  Expired: "adminDashboard.status.expired",
  ExpiringSoon: "adminDashboard.status.expiringSoon",
  "External Approval": "adminDashboard.status.externalApproval",
  "High Priority": "adminDashboard.priority.high",
  "Initial Approval": "adminDashboard.status.initialApproval",
  "In Progress": "adminDashboard.status.inProgress",
  "Inspection Tasks": "adminDashboard.tabs.inspectionTasks",
  Inspections: "adminDashboard.tabs.inspections",
  "LGBT+ Content": "adminDashboard.risks.lgbtContent",
  "LGBT+ Content, Royal Family": "adminDashboard.risks.lgbtContentRoyalFamily",
  "License Distribution by Status": "adminDashboard.cards.licenseDistribution",
  "Medical Emergency": "adminDashboard.leave.medicalEmergency",
  Member: "adminDashboard.table.member",
  "Members Needing Coaching": "adminDashboard.sections.membersNeedingCoaching",
  "Members on Emergency Leave":
    "adminDashboard.sections.membersOnEmergencyLeave",
  "My Performance": "adminDashboard.sections.myPerformance",
  "Needs Manager Attention": "adminDashboard.sections.needsManagerAttention",
  "Needs Your Attention": "adminDashboard.sections.needsYourAttention",
  Open: "adminDashboard.status.open",
  Escalated: "adminDashboard.status.escalated",
  "Other Tasks": "adminDashboard.tabs.otherTasks",
  Overdue: "adminDashboard.table.overdue",
  "Overdue Tasks": "adminDashboard.metrics.overdueTasks",
  "Pending Approval": "adminDashboard.status.pendingApproval",
  "Pending Customer": "adminDashboard.status.pendingCustomer",
  PendingCustomer: "adminDashboard.status.pendingCustomer",
  "Pending Disposition": "adminDashboard.status.pendingDisposition",
  "Disposition Verification": "adminDashboard.status.dispositionVerification",
  "Pending Modification": "adminDashboard.status.pendingModification",
  "Pending Payment": "adminDashboard.status.pendingPayment",
  "Pending Refund": "adminDashboard.status.pendingRefund",
  PendingRefund: "adminDashboard.status.pendingRefund",
  "Pending Review": "adminDashboard.status.pendingReview",
  "Pending Routing": "adminDashboard.status.pendingRouting",
  "Pending Visit": "adminDashboard.status.pendingVisit",
  "Performance Trend": "adminDashboard.sections.performanceTrend",
  "Political Sensitivity": "adminDashboard.risks.political",
  "Malicious Content": "adminDashboard.risks.maliciousContent",
  "Profile Verification": "adminDashboard.tabs.profileVerification",
  ProfileVerification: "adminDashboard.tabs.profileVerification",
  "Prohibited Words": "adminDashboard.risks.prohibitedWords",
  "Recently Assigned Tasks": "adminDashboard.tabs.recentlyAssignedTasks",
  Refunds: "adminDashboard.tabs.refunds",
  Refunded: "adminDashboard.status.refunded",
  Rejected: "adminDashboard.status.rejected",
  "Religious Content": "adminDashboard.risks.religious",
  "Royal Family": "adminDashboard.risks.royalFamily",
  "Service Application": "adminDashboard.tabs.serviceApplication",
  ServiceApplication: "adminDashboard.tabs.serviceApplication",
  "SLA Compliance": "adminDashboard.metrics.slaCompliance",
  "Medium Priority": "adminDashboard.priority.medium",
  "Low Priority": "adminDashboard.priority.low",
  Suspended: "adminDashboard.status.suspended",
  "Team Performance": "adminDashboard.sections.teamPerformance",
  ToDo: "adminDashboard.labels.toDoCompact",
  "To Do": "adminDashboard.labels.toDo",
  Total: "adminDashboard.labels.total",
  "Total Tasks": "adminDashboard.metrics.totalTasks",
  Urgent: "adminDashboard.tabs.urgent",
  "Violations & Fines": "adminDashboard.tabs.violationsFines",
  "Violence & Hate Speech": "adminDashboard.risks.violence",
  "Violence&Hate Speech": "adminDashboard.risks.violence",
  "Number of tasks in the selected category within the selected period.":
    "adminDashboard.tooltips.totalTasks",
  "Average time taken to complete all department tasks within the selected period.":
    "adminDashboard.tooltips.manager.avgProcessingTime",
  "Average time taken to complete tasks within the selected period and across all assigned tasks.":
    "adminDashboard.tooltips.staff.avgProcessingTime",
  "Percentage of Approve decisions among all final decisions made on Service Applications within the selected period.":
    "adminDashboard.tooltips.manager.approvalRate",
  "Percentage of Approve decisions among all final decisions made at this approval step within the selected period":
    "adminDashboard.tooltips.staff.approvalRate",
  "Number of open department tasks that exceeded the SLA deadline within the selected period.":
    "adminDashboard.tooltips.manager.overdueTasks",
  "Number of open tasks that exceeded the SLA deadline within the selected period and across all assigned tasks.":
    "adminDashboard.tooltips.staff.overdueTasks",
  "Percentage of all completed department tasks that met the SLA within the selected period.":
    "adminDashboard.tooltips.manager.slaCompliance",
  "Percentage of completed tasks that met the SLA within the selected period and across all assigned tasks.":
    "adminDashboard.tooltips.staff.slaCompliance",
  "Distribution of AI-tagged labels across your assigned applications. Each label is counted once per application.":
    "adminDashboard.tooltips.staff.aiContentRisk",
  "Distribution of AI-tagged labels across department-assigned applications. Each label is counted once per application.":
    "adminDashboard.tooltips.manager.aiContentRisk",
  "Trend of SLA Compliance and Average Processing Time within the selected period and across all assigned tasks.":
    "adminDashboard.tooltips.performanceTrend",
  "Team members who may need additional guidance or follow-up based on the performance within the selected period.":
    "adminDashboard.tooltips.membersNeedingCoaching",
};

const translateDashboardDuration = (
  value: string,
  translate: DashboardTranslate
) => {
  const isEnglish = translate("adminDashboard.table.overdue") === "Overdue";

  if (isEnglish) {
    return value;
  }

  return value.replace(
    /(\d+(?:\.\d+)?)(min|[dhm])/gi,
    (_match, count: string, unit: string) => {
      const normalizedUnit = unit.toLowerCase();
      const unitKey =
        normalizedUnit === "d"
          ? "adminDashboard.duration.days"
          : normalizedUnit === "h"
            ? "adminDashboard.duration.hours"
            : "adminDashboard.duration.minutes";

      return `${count} ${translate(unitKey)}`;
    }
  );
};

export const translateApplicationTaskAlert = (
  text: string | undefined,
  translate: DashboardTranslate
) => {
  if (!text) {
    return "";
  }

  const trimmed = text.trim();
  const overduePrefixMatch = trimmed.match(/^Overdue\s+(.+)$/i);
  const overdueSuffixMatch = trimmed.match(/^(.+?)\s+Overdue$/i);
  const duration = overduePrefixMatch?.[1] || overdueSuffixMatch?.[1];

  if (!duration) {
    return translateDashboardStaticText(text, translate);
  }

  const overdue = translate("adminDashboard.table.overdue");
  const translatedDuration = translateDashboardDuration(duration, translate);

  return overdue === "Overdue"
    ? `${translatedDuration} ${overdue}`
    : `${overdue} ${translatedDuration}`;
};

export const translateDashboardStaticText = (
  text: string | undefined,
  translate: DashboardTranslate
) => {
  if (!text) {
    return "";
  }

  const trimmed = text.trim();
  const key = DASHBOARD_STATIC_TEXT_KEYS[trimmed];

  if (key) {
    return translate(key);
  }

  const labelCountMatch = trimmed.match(/^(.+?)\s+(\d+)$/);

  if (labelCountMatch) {
    const labelKey = DASHBOARD_STATIC_TEXT_KEYS[labelCountMatch[1].trim()];

    if (labelKey) {
      return `${translate(labelKey)} ${labelCountMatch[2]}`;
    }
  }

  const statusCodeMatch = trimmed.match(/^Status\s*(\d+)$/i);

  if (statusCodeMatch) {
    return `${translate("adminDashboard.table.status")} ${statusCodeMatch[1]}`;
  }

  const overduePrefixMatch = trimmed.match(/^Overdue\s+(.+)$/i);

  if (overduePrefixMatch) {
    return `${translate("adminDashboard.table.overdue")} ${translateDashboardDuration(
      overduePrefixMatch[1],
      translate
    )}`;
  }

  const overdueSuffixMatch = trimmed.match(/^(.+?)\s+Overdue$/i);

  if (overdueSuffixMatch) {
    return `${translate("adminDashboard.table.overdue")} ${translateDashboardDuration(
      overdueSuffixMatch[1],
      translate
    )}`;
  }

  if (/^(?:\d+(?:\.\d+)?(?:min|[dhm])\s*)+$/i.test(trimmed)) {
    return translateDashboardDuration(trimmed, translate);
  }

  return text;
};

const formatArabicDashboardTrendDurationPart = (
  count: number,
  singularUnit: string,
  dualUnit: string,
  pluralUnit: string
) => {
  if (count === 2) {
    return dualUnit;
  }

  const unit = count >= 3 && count <= 10 ? pluralUnit : singularUnit;

  return `${count} ${unit}`;
};

export const formatDashboardTrendDuration = (
  value: unknown,
  translate?: DashboardTranslate,
  isArabic = false
) => {
  const numericMinutes = Number(value);

  if (!Number.isFinite(numericMinutes) || numericMinutes < 0) {
    return "-";
  }

  const totalMinutes = Math.round(numericMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!translate || !isArabic) {
    if (!hours) {
      return `${minutes}m`;
    }

    return minutes ? `${hours}hr ${minutes}m` : `${hours}hr`;
  }

  const parts: string[] = [];

  if (hours) {
    parts.push(
      formatArabicDashboardTrendDurationPart(
        hours,
        translate("adminDashboard.duration.trendHoursSingular"),
        translate("adminDashboard.duration.trendHoursDual"),
        translate("adminDashboard.duration.trendHoursPlural")
      )
    );
  }

  if (minutes || !hours) {
    parts.push(
      formatArabicDashboardTrendDurationPart(
        minutes,
        translate("adminDashboard.duration.trendMinutesSingular"),
        translate("adminDashboard.duration.trendMinutesDual"),
        translate("adminDashboard.duration.trendMinutesPlural")
      )
    );
  }

  return parts.join(" ");
};

export const formatDashboardTaskAlert = (
  text: string | undefined,
  translate: DashboardTranslate
) => {
  if (!text) {
    return "";
  }

  const trimmed = text.trim();
  const overdueMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)([dh])\s+Overdue$/i
  );

  if (overdueMatch) {
    return translate(
      overdueMatch[2].toLowerCase() === "d"
        ? "adminDashboard.alert.overdueDays"
        : "adminDashboard.alert.overdueHours",
      { value: overdueMatch[1] }
    );
  }

  const dueInMatch = trimmed.match(/^Due in\s+(\d+(?:\.\d+)?)([dh])$/i);

  if (dueInMatch) {
    return translate(
      dueInMatch[2].toLowerCase() === "d"
        ? "adminDashboard.alert.dueInDays"
        : "adminDashboard.alert.dueInHours",
      { value: dueInMatch[1] }
    );
  }

  if (/^Due Today$/i.test(trimmed)) {
    return translate("adminDashboard.alert.dueToday");
  }

  return translateDashboardStaticText(text, translate);
};
