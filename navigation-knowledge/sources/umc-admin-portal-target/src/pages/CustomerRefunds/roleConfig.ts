import type {
  RefundAudience,
  RefundStatus,
  RefundSummaryItem,
  RefundTabKey,
  RefundViewRole,
} from "./types";

type RefundSummaryKey = RefundSummaryItem["key"];
type RefundRowAction = "message" | "change_status" | "process" | "send_back";
type RefundSlaSource = "customer_assigned_time" | "department_assigned_time";
export type RefundFilterModalMode =
  | "customer"
  | "department_todo_date_only"
  | "department_completed_date_only";

export interface RefundRoleConfig {
  ui: {
    breadcrumbRootKey: string;
    listPageTitleKey: string;
    detailsPageTitleKey: string;
  };
  list: {
    summaryKeys: RefundSummaryKey[];
    tabStatuses: Record<RefundTabKey, RefundStatus[]>;
    rowActions: Record<RefundTabKey, RefundRowAction[]>;
    toolbar: Record<
      RefundTabKey,
      {
        showDateRange: boolean;
        showStatusSelect: boolean;
        showSourceSelect: boolean;
        showFilterButton: boolean;
        showResetButton: boolean;
      }
    >;
    filterModalMode: Record<RefundTabKey, RefundFilterModalMode>;
    slaPolicy: {
      days: number;
      source: RefundSlaSource;
    };
  };
  details: {
    primaryFooterAction: "change_status" | "department_actions" | "none";
    allowCustomerReplyStatuses: RefundStatus[];
    allowInternalNoteStatuses: RefundStatus[];
    allowDepartmentActionStatuses: RefundStatus[];
    allowChangeStatusStatuses: RefundStatus[];
  };
  message: {
    defaultAudience: RefundAudience;
    allowCustomerAudience: boolean;
  };
}

export const REFUND_SHARED_BREADCRUMB_ROOT_KEY = "menu.customer";
export const REFUND_SHARED_LIST_TITLE_KEY = "menu.refunds";
export const REFUND_SHARED_DETAILS_TITLE_KEY = "menu.refundsDetails";

const CUSTOMER_TODO_STATUSES: RefundStatus[] = [
  "Department Processing",
  "Department Processed",
  "Pending Customer",
];

const CUSTOMER_COMPLETED_STATUSES: RefundStatus[] = [
  "Pending Refund",
  "Rejected",
  "Refunded",
  "Cancelled",
];

const DEPARTMENT_TODO_STATUSES: RefundStatus[] = ["Department Processing"];

const DEPARTMENT_COMPLETED_STATUSES: RefundStatus[] = [
  "Department Processed",
  "Rejected",
  "Refunded",
  "Cancelled",
];

export const REFUND_ROLE_CONFIG: Record<RefundViewRole, RefundRoleConfig> = {
  customer_happiness: {
    ui: {
      breadcrumbRootKey: REFUND_SHARED_BREADCRUMB_ROOT_KEY,
      listPageTitleKey: REFUND_SHARED_LIST_TITLE_KEY,
      detailsPageTitleKey: REFUND_SHARED_DETAILS_TITLE_KEY,
    },
    list: {
      summaryKeys: [
        "total",
        "departmentProcessing",
        "departmentProcessed",
        "pendingCustomer",
        "pendingRefund",
        "refunded",
        "rejected",
        "cancelled",
      ],
      tabStatuses: {
        todo: CUSTOMER_TODO_STATUSES,
        completed: CUSTOMER_COMPLETED_STATUSES,
      },
      rowActions: {
        todo: ["message", "change_status"],
        completed: [],
      },
      toolbar: {
        todo: {
          showDateRange: false,
          showStatusSelect: true,
          showSourceSelect: false,
          showFilterButton: true,
          showResetButton: true,
        },
        completed: {
          showDateRange: false,
          showStatusSelect: false,
          showSourceSelect: true,
          showFilterButton: true,
          showResetButton: true,
        },
      },
      filterModalMode: {
        todo: "customer",
        completed: "customer",
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
      allowDepartmentActionStatuses: [],
      allowChangeStatusStatuses: ["Department Processed", "Pending Customer"],
    },
    message: {
      defaultAudience: "customer",
      allowCustomerAudience: true,
    },
  },
  business_department: {
    ui: {
      breadcrumbRootKey: REFUND_SHARED_BREADCRUMB_ROOT_KEY,
      listPageTitleKey: REFUND_SHARED_LIST_TITLE_KEY,
      detailsPageTitleKey: REFUND_SHARED_DETAILS_TITLE_KEY,
    },
    list: {
      summaryKeys: [
        "total",
        "departmentProcessing",
        "departmentProcessed",
        "refunded",
        "rejected",
        "cancelled",
      ],
      tabStatuses: {
        todo: DEPARTMENT_TODO_STATUSES,
        completed: DEPARTMENT_COMPLETED_STATUSES,
      },
      rowActions: {
        todo: ["message", "process", "send_back"],
        completed: [],
      },
      toolbar: {
        todo: {
          showDateRange: true,
          showStatusSelect: false,
          showSourceSelect: false,
          showFilterButton: false,
          showResetButton: true,
        },
        completed: {
          showDateRange: false,
          showStatusSelect: true,
          showSourceSelect: false,
          showFilterButton: true,
          showResetButton: true,
        },
      },
      filterModalMode: {
        todo: "department_todo_date_only",
        completed: "department_completed_date_only",
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
      allowDepartmentActionStatuses: ["Department Processing"],
      allowChangeStatusStatuses: [],
    },
    message: {
      defaultAudience: "internal",
      allowCustomerAudience: false,
    },
  },
};

export const DEFAULT_REFUND_VIEW_ROLE: RefundViewRole = "customer_happiness";

const REFUND_VIEW_ROLE_QUERY_ORDER: RefundViewRole[] = [
  "business_department",
  "customer_happiness",
];

export function getRefundViewRoleFromSearchParams(
  searchParams: URLSearchParams,
): RefundViewRole | undefined {
  const explicitViewRole = searchParams.get("viewRole");
  if (
    explicitViewRole === "customer_happiness" ||
    explicitViewRole === "business_department"
  ) {
    return explicitViewRole;
  }

  const breadcrumbRootKey = searchParams.get("breadcrumbRootKey");
  const pageTitleKey = searchParams.get("pageTitleKey");

  if (breadcrumbRootKey === "menu.businessDepartment") {
    return "business_department";
  }

  if (breadcrumbRootKey === "menu.customer") {
    return "customer_happiness";
  }

  if (
    pageTitleKey === "menu.businessDepartmentRefunds" ||
    pageTitleKey === "menu.businessDepartmentRefundsDetails"
  ) {
    return "business_department";
  }

  if (
    pageTitleKey === "menu.customerHappinessRefunds" ||
    pageTitleKey === "menu.customerHappinessRefundsDetails"
  ) {
    return "customer_happiness";
  }

  return REFUND_VIEW_ROLE_QUERY_ORDER.find((role) => {
    const { ui } = REFUND_ROLE_CONFIG[role];
    return (
      breadcrumbRootKey === ui.breadcrumbRootKey ||
      pageTitleKey === ui.listPageTitleKey ||
      pageTitleKey === ui.detailsPageTitleKey
    );
  });
}
