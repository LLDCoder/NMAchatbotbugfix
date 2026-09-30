import type {
  AppealAudience,
  AppealStatus,
  AppealSummaryItem,
  AppealTabKey,
  AppealViewRole,
} from "./types";

type AppealSummaryKey = AppealSummaryItem["key"];
export type AppealRowAction = "message" | "change_status" | "process" | "send_back";
type AppealSlaSource = "customer_assigned_time" | "department_assigned_time";
export type AppealFilterModalMode =
  | "handler_and_date"
  | "date_only"
  | "department";

export const CUSTOMER_HAPPINESS_DEPARTMENT_ID = 8;

export interface AppealRoleSourceUser {
  departmentIds?: Array<number | string | null> | number | string | null;
}

export interface AppealRoleConfig {
  ui: {
    breadcrumbRootKey: string;
    listPageTitleKey: string;
    detailsPageTitleKey: string;
  };
  list: {
    summaryKeys: AppealSummaryKey[];
    tabStatuses: Record<AppealTabKey, AppealStatus[]>;
    rowActions: Record<AppealTabKey, AppealRowAction[]>;
    toolbar: Record<
      AppealTabKey,
      {
        showDateRange: boolean;
        showStatusSelect: boolean;
        showReasonSelect: boolean;
        showFilterButton: boolean;
        showResetButton: boolean;
      }
    >;
    filterModalMode: Record<AppealTabKey, AppealFilterModalMode>;
    slaPolicy: {
      days: number;
      source: AppealSlaSource;
    };
  };
  details: {
    primaryFooterAction: "change_status" | "department_actions" | "none";
    allowCustomerReplyStatuses: AppealStatus[];
    allowInternalNoteStatuses: AppealStatus[];
    allowChangeStatusStatuses: AppealStatus[];
    allowDepartmentActionStatuses: AppealStatus[];
  };
  message: {
    defaultAudience: AppealAudience;
    allowCustomerAudience: boolean;
  };
}

export const APPEAL_SHARED_BREADCRUMB_ROOT_KEY = "menu.customer";
export const APPEAL_SHARED_LIST_TITLE_KEY = "menu.appeals";
export const APPEAL_SHARED_DETAILS_TITLE_KEY = "menu.appealsDetails";

export const CUSTOMER_TODO_APPEAL_STATUSES: AppealStatus[] = [
  "Department Processing",
  "Department Processed",
  "Pending Customer",
];

export const CUSTOMER_COMPLETED_APPEAL_STATUSES: AppealStatus[] = [
  "Approved",
  "Rejected",
  "Cancelled",
];

export const DEPARTMENT_TODO_APPEAL_STATUSES: AppealStatus[] = [
  "Department Processing",
  "Department Processed",
  "Pending Customer",
];

export const DEPARTMENT_COMPLETED_APPEAL_STATUSES: AppealStatus[] = [
  "Department Processed",
  "Department Processing",
  "Pending Customer",
  "Approved",
  "Rejected",
  "Cancelled",
];

export const COMMITTEE_TODO_APPEAL_STATUSES: AppealStatus[] = [
  "Department Processing",
];

export const COMMITTEE_COMPLETED_APPEAL_STATUSES: AppealStatus[] = [
  "Approved",
  "Rejected",
  "Cancelled",
  "Pending Customer",
  "Department Processed",
  "Department Processing",
];

export const APPEAL_ROLE_CONFIG: Record<AppealViewRole, AppealRoleConfig> = {
  customer_happiness: {
    ui: {
      breadcrumbRootKey: APPEAL_SHARED_BREADCRUMB_ROOT_KEY,
      listPageTitleKey: APPEAL_SHARED_LIST_TITLE_KEY,
      detailsPageTitleKey: APPEAL_SHARED_DETAILS_TITLE_KEY,
    },
    list: {
      summaryKeys: [
        "total",
        "departmentProcessing",
        "departmentProcessed",
        "pendingCustomer",
        "approved",
        "rejected",
        "cancelled",
      ],
      tabStatuses: {
        todo: CUSTOMER_TODO_APPEAL_STATUSES,
        completed: CUSTOMER_COMPLETED_APPEAL_STATUSES,
      },
      rowActions: {
        todo: ["message", "change_status"],
        completed: [],
      },
      toolbar: {
        todo: {
          showDateRange: false,
          showStatusSelect: true,
          showReasonSelect: true,
          showFilterButton: true,
          showResetButton: true,
        },
        completed: {
          showDateRange: false,
          showStatusSelect: true,
          showReasonSelect: true,
          showFilterButton: true,
          showResetButton: true,
        },
      },
      filterModalMode: {
        todo: "handler_and_date",
        completed: "date_only",
      },
      slaPolicy: {
        days: 5,
        source: "customer_assigned_time",
      },
    },
    details: {
      primaryFooterAction: "change_status",
      allowCustomerReplyStatuses: [
        "Department Processing",
        "Department Processed",
        "Pending Customer",
      ],
      allowInternalNoteStatuses: ["Department Processing"],
      allowChangeStatusStatuses: ["Department Processed", "Pending Customer"],
      allowDepartmentActionStatuses: [],
    },
    message: {
      defaultAudience: "customer",
      allowCustomerAudience: true,
    },
  },
  department: {
    ui: {
      breadcrumbRootKey: APPEAL_SHARED_BREADCRUMB_ROOT_KEY,
      listPageTitleKey: APPEAL_SHARED_LIST_TITLE_KEY,
      detailsPageTitleKey: APPEAL_SHARED_DETAILS_TITLE_KEY,
    },
    list: {
      summaryKeys: [
        "total",
        "departmentProcessing",
        "departmentProcessed",
        "pendingCustomer",
        "approved",
        "rejected",
        "cancelled",
      ],
      tabStatuses: {
        todo: DEPARTMENT_TODO_APPEAL_STATUSES,
        completed: DEPARTMENT_COMPLETED_APPEAL_STATUSES,
      },
      rowActions: {
        todo: ["message", "process", "send_back"],
        completed: [],
      },
      toolbar: {
        todo: {
          showDateRange: false,
          showStatusSelect: true,
          showReasonSelect: true,
          showFilterButton: true,
          showResetButton: true,
        },
        completed: {
          showDateRange: false,
          showStatusSelect: true,
          showReasonSelect: true,
          showFilterButton: true,
          showResetButton: true,
        },
      },
      filterModalMode: {
        todo: "handler_and_date",
        completed: "date_only",
      },
      slaPolicy: {
        days: 3,
        source: "department_assigned_time",
      },
    },
    details: {
      primaryFooterAction: "department_actions",
      allowCustomerReplyStatuses: [],
      allowInternalNoteStatuses: ["Department Processing"],
      allowChangeStatusStatuses: [],
      allowDepartmentActionStatuses: ["Department Processing"],
    },
    message: {
      defaultAudience: "internal",
      allowCustomerAudience: false,
    },
  },
  committee: {
    ui: {
      breadcrumbRootKey: APPEAL_SHARED_BREADCRUMB_ROOT_KEY,
      listPageTitleKey: APPEAL_SHARED_LIST_TITLE_KEY,
      detailsPageTitleKey: APPEAL_SHARED_DETAILS_TITLE_KEY,
    },
    list: {
      summaryKeys: [
        "total",
        "departmentProcessing",
        "departmentProcessed",
        "pendingCustomer",
        "approved",
        "rejected",
        "cancelled",
      ],
      tabStatuses: {
        todo: COMMITTEE_TODO_APPEAL_STATUSES,
        completed: COMMITTEE_COMPLETED_APPEAL_STATUSES,
      },
      rowActions: {
        todo: ["message", "process", "send_back"],
        completed: [],
      },
      toolbar: {
        todo: {
          showDateRange: false,
          showStatusSelect: true,
          showReasonSelect: true,
          showFilterButton: true,
          showResetButton: true,
        },
        completed: {
          showDateRange: false,
          showStatusSelect: true,
          showReasonSelect: true,
          showFilterButton: true,
          showResetButton: true,
        },
      },
      filterModalMode: {
        todo: "handler_and_date",
        completed: "date_only",
      },
      slaPolicy: {
        days: 3,
        source: "department_assigned_time",
      },
    },
    details: {
      primaryFooterAction: "department_actions",
      allowCustomerReplyStatuses: [],
      allowInternalNoteStatuses: ["Department Processing"],
      allowChangeStatusStatuses: [],
      allowDepartmentActionStatuses: ["Department Processing"],
    },
    message: {
      defaultAudience: "internal",
      allowCustomerAudience: false,
    },
  },
};

export const DEFAULT_APPEAL_VIEW_ROLE: AppealViewRole = "customer_happiness";

function normalizeRoleSourceList<T>(value?: T | T[] | null): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeDepartmentIds(user?: AppealRoleSourceUser | null) {
  return normalizeRoleSourceList(user?.departmentIds).reduce<number[]>(
    (departmentIds, departmentId) => {
      const departmentIdText = String(departmentId ?? "").trim();

      if (!departmentIdText) {
        return departmentIds;
      }

      const normalizedDepartmentId = Number(departmentIdText);

      if (Number.isFinite(normalizedDepartmentId)) {
        departmentIds.push(normalizedDepartmentId);
      }

      return departmentIds;
    },
    [],
  );
}

export function resolveAppealViewRoleFromAdminUser(
  user?: AppealRoleSourceUser | null,
): AppealViewRole | undefined {
  const departmentIds = normalizeDepartmentIds(user);

  if (departmentIds.includes(CUSTOMER_HAPPINESS_DEPARTMENT_ID)) {
    return "customer_happiness";
  }

  if (departmentIds.length > 0) {
    return "department";
  }

  return undefined;
}
