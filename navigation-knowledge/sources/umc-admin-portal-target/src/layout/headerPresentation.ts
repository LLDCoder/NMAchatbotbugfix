export interface HeaderBreadcrumbItem {
  key: string;
  label: string;
  path?: string;
  active?: boolean;
}

type Translate = (key: string) => string;

type TeamManagementBreadcrumbScope =
  | "licensing"
  | "content"
  | "customer"
  | "inspection";

interface HeaderPresentationOptions {
  pathname: string;
  params: URLSearchParams;
  pageTitle: string;
  moduleI18nKey?: string;
  t: Translate;
}

interface HeaderPresentation {
  pageTitle: string;
  breadcrumbItems?: HeaderBreadcrumbItem[];
  hideAutoBreadcrumb: boolean;
}

const TEAM_MANAGEMENT_BREADCRUMB_CONFIG: Record<
  TeamManagementBreadcrumbScope,
  {
    moduleLabelKey: string;
    teamManagementLabelKey: string;
    teamManagementPath: string;
  }
> = {
  licensing: {
    moduleLabelKey: "menu.licensingManagement",
    teamManagementLabelKey: "menu.teamManagement",
    teamManagementPath: "/licensing/team-management",
  },
  content: {
    moduleLabelKey: "menu.contentManagement",
    teamManagementLabelKey: "menu.teamManagement",
    teamManagementPath: "/content/team-management",
  },
  customer: {
    moduleLabelKey: "menu.CustomerHappiness",
    teamManagementLabelKey: "menu.teamManagement",
    teamManagementPath: "/happiness/team-management",
  },
  inspection: {
    moduleLabelKey: "menu.inspection",
    teamManagementLabelKey: "menu.inspectionTasks",
    teamManagementPath: "/inspection/tasks",
  },
};

const ADD_NEW_SERVICE_PATH =
  "/service-management/service-configuration/addnewservice";

function isTeamManagementBreadcrumbScope(
  value: string | null,
): value is TeamManagementBreadcrumbScope {
  return Boolean(
    value &&
      Object.prototype.hasOwnProperty.call(
        TEAM_MANAGEMENT_BREADCRUMB_CONFIG,
        value,
      ),
  );
}

function createInspectionTaskDetailPath(params: URLSearchParams) {
  const detailParams = new URLSearchParams();

  ["taskId", "taskNo", "tab", "from"].forEach((key) => {
    const value = params.get(key);

    if (value) {
      detailParams.set(key, value);
    }
  });

  const query = detailParams.toString();

  return query ? `/inspection/tasks/detail?${query}` : "/inspection/tasks/detail";
}

function createTransactionsDetailPresentation(t: Translate): HeaderPresentation {
  return {
    pageTitle: t("Finance.transactionsDetail.breadcrumbs.paymentsDetails"),
    breadcrumbItems: [
      {
        key: "finance-and-payments",
        label: t("Finance.transactionsDetail.breadcrumbs.financeAndPayments"),
      },
      {
        key: "finance-transactions",
        label: t("Finance.transactionsDetail.breadcrumbs.transactions"),
        path: "/financial-payment/transactions",
      },
      {
        key: "finance-payments",
        label: t("Finance.transactionsDetail.breadcrumbs.payments"),
        path: "/financial-payment/transactions",
      },
      {
        key: "finance-payments-details",
        label: t("Finance.transactionsDetail.breadcrumbs.paymentsDetails"),
        active: true,
      },
    ],
    hideAutoBreadcrumb: false,
  };
}

function createRoleDetailsPresentation(
  params: URLSearchParams,
  t: Translate,
): HeaderPresentation {
  const pageTitle = t(
    params.get("id")
      ? "Settings.roleDetails.pageTitle.edit"
      : "Settings.roleDetails.pageTitle.add",
  );

  return {
    pageTitle,
    breadcrumbItems: [
      {
        key: "system-management",
        label: t("menu.systemManagement"),
      },
      {
        key: "role-management",
        label: t("menu.roleManagement"),
        path: "/system-management/roleManagement",
      },
      {
        key: "role-details",
        label: pageTitle,
        active: true,
      },
    ],
    hideAutoBreadcrumb: false,
  };
}

function createInspectionExecutionPresentation(
  params: URLSearchParams,
  t: Translate,
): HeaderPresentation {
  const pageTitle = t("inspection.execution.inspectionInProgress");

  return {
    pageTitle,
    breadcrumbItems: [
      {
        key: "inspection",
        label: t("menu.inspection"),
      },
      {
        key: "inspection-tasks",
        label: t("menu.inspectionTasks"),
        path: "/inspection/tasks",
      },
      {
        key: "inspection-task-details",
        label: t("menu.inspectionTaskDetails"),
        path: createInspectionTaskDetailPath(params),
      },
      {
        key: "inspection-in-progress",
        label: pageTitle,
        active: true,
      },
    ],
    hideAutoBreadcrumb: false,
  };
}

function createTeamManagementTaskPresentation(
  scope: TeamManagementBreadcrumbScope,
  t: Translate,
): HeaderPresentation {
  const config = TEAM_MANAGEMENT_BREADCRUMB_CONFIG[scope];
  const pageTitle = t("menu.taskDetails");

  return {
    pageTitle,
    breadcrumbItems: [
      {
        key: "team-management-module",
        label: t(config.moduleLabelKey),
      },
      {
        key: "team-management-list",
        label: t(config.teamManagementLabelKey),
        path: config.teamManagementPath,
      },
      {
        key: "team-management-task-details",
        label: pageTitle,
        active: true,
      },
    ],
    hideAutoBreadcrumb: true,
  };
}

function createBroadcastPresentation(
  isEditPage: boolean,
  params: URLSearchParams,
  t: Translate,
): HeaderPresentation {
  const pageTitle = isEditPage
    ? t(
        params.get("id")
          ? "Settings.broadcast.list.actions.edit"
          : "Settings.broadcast.list.actions.addNew",
      )
    : t("menu.broadcastView");

  return {
    pageTitle,
    breadcrumbItems: [
      {
        key: "communications",
        label: t("menu.communications"),
      },
      {
        key: "broadcast",
        label: t("menu.broadcast"),
        path: "/communications/broadcast",
      },
      {
        key: isEditPage ? "broadcast-edit" : "broadcast-view",
        label: pageTitle,
        active: true,
      },
    ],
    hideAutoBreadcrumb: false,
  };
}

function createReportsAnalyticsPresentation(
  moduleI18nKey: string | undefined,
  t: Translate,
): HeaderPresentation {
  return {
    pageTitle: t("menu.reportsAnalytics"),
    breadcrumbItems: [
      {
        key: "parent-module",
        label: moduleI18nKey ? t(moduleI18nKey) : t("menu.serviceManagement"),
      },
      {
        key: "reports-analytics",
        label: t("menu.reportsAnalytics"),
        active: true,
      },
    ],
    hideAutoBreadcrumb: true,
  };
}

function createServiceConfigurationPresentation(
  params: URLSearchParams,
  pageTitle: string,
  t: Translate,
): HeaderPresentation {
  const viewValue =
    params.get("view") ?? params.get("isView") ?? params.get("isVie") ?? "";
  const isView = ["1", "true"].includes(viewValue.toLowerCase());
  const isDuplicate = params.get("type")?.toLowerCase() === "duplicate";
  const isAdd = params.get("from") === "add";
  const hasService = Boolean(
    params.get("id") || params.get("serviceId") || params.get("serviceCode"),
  );

  const resolvedPageTitle = isView
    ? t("pageTitle.viewService")
    : isDuplicate
    ? t("pageTitle.editService")
    : hasService && !isAdd
    ? t("pageTitle.configureService")
    : pageTitle;

  return {
    pageTitle: resolvedPageTitle,
    breadcrumbItems: [
      {
        key: "service-management",
        label: t("menu.serviceManagement"),
      },
      {
        key: "service-configuration",
        label: t("menu.serviceConfiguration"),
        path: "/service-management/service-configuration",
      },
      {
        key: "service-configuration-details",
        label: resolvedPageTitle,
        active: true,
      },
    ],
    hideAutoBreadcrumb: true,
  };
}

export function resolveHeaderPresentation({
  pathname,
  params,
  pageTitle,
  moduleI18nKey,
  t,
}: HeaderPresentationOptions): HeaderPresentation {
  if (pathname === ADD_NEW_SERVICE_PATH) {
    return createServiceConfigurationPresentation(params, pageTitle, t);
  }

  if (pathname === "/financial-payment/transactions/transactions-detail") {
    return createTransactionsDetailPresentation(t);
  }

  if (pathname === "/system-management/roleManagement/roledetails") {
    return createRoleDetailsPresentation(params, t);
  }

  if (pathname === "/inspection/tasks/execution") {
    return createInspectionExecutionPresentation(params, t);
  }

  const teamManagementScope = params.get("teamManagementScope");
  const isTeamManagementTaskPage =
    params.get("breadcrumbMode") === "teamManagementTask" &&
    isTeamManagementBreadcrumbScope(teamManagementScope);

  if (isTeamManagementTaskPage) {
    return createTeamManagementTaskPresentation(teamManagementScope, t);
  }

  const isBroadcastEditPage = pathname === "/communications/broadcastEdit";

  if (pathname === "/communications/broadcastView" || isBroadcastEditPage) {
    return createBroadcastPresentation(isBroadcastEditPage, params, t);
  }

  const currentPath = pathname.split("/").filter(Boolean).pop() || "";
  const isReportsAnalyticsPage =
    currentPath.toLowerCase().replace(/-/g, "") === "reportsanalytics";

  if (isReportsAnalyticsPage) {
    return createReportsAnalyticsPresentation(moduleI18nKey, t);
  }

  return {
    pageTitle,
    breadcrumbItems: undefined,
    hideAutoBreadcrumb: false,
  };
}
