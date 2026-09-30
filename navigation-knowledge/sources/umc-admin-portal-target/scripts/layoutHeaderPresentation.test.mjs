import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const sourcePath = "src/layout/headerPresentation.ts";
const t = (key) => `[${key}]`;

function loadResolver() {
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const testModule = { exports: {} };

  new Function("exports", "module", compiled)(
    testModule.exports,
    testModule,
  );

  return testModule.exports.resolveHeaderPresentation;
}

function resolve({
  pathname,
  search = "",
  pageTitle = "Default title",
  moduleI18nKey,
}) {
  return loadResolver()({
    pathname,
    params: new URLSearchParams(search),
    pageTitle,
    moduleI18nKey,
    t,
  });
}

test("falls back to the default page title and automatic breadcrumbs", () => {
  assert.deepEqual(resolve({ pathname: "/content/articles" }), {
    pageTitle: "Default title",
    breadcrumbItems: undefined,
    hideAutoBreadcrumb: false,
  });
});

test("resolves the transactions detail header presentation", () => {
  assert.deepEqual(
    resolve({
      pathname: "/financial-payment/transactions/transactions-detail",
    }),
    {
      pageTitle: "[Finance.transactionsDetail.breadcrumbs.paymentsDetails]",
      breadcrumbItems: [
        {
          key: "finance-and-payments",
          label: "[Finance.transactionsDetail.breadcrumbs.financeAndPayments]",
        },
        {
          key: "finance-transactions",
          label: "[Finance.transactionsDetail.breadcrumbs.transactions]",
          path: "/financial-payment/transactions",
        },
        {
          key: "finance-payments",
          label: "[Finance.transactionsDetail.breadcrumbs.payments]",
          path: "/financial-payment/transactions",
        },
        {
          key: "finance-payments-details",
          label: "[Finance.transactionsDetail.breadcrumbs.paymentsDetails]",
          active: true,
        },
      ],
      hideAutoBreadcrumb: false,
    },
  );
});

test("resolves role details titles for new and edit modes", () => {
  const expectedBreadcrumbPrefix = [
    { key: "system-management", label: "[menu.systemManagement]" },
    {
      key: "role-management",
      label: "[menu.roleManagement]",
      path: "/system-management/roleManagement",
    },
  ];

  [
    ["", "Settings.roleDetails.pageTitle.add"],
    ["id=42", "Settings.roleDetails.pageTitle.edit"],
  ].forEach(([search, titleKey]) => {
    assert.deepEqual(
      resolve({
        pathname: "/system-management/roleManagement/roledetails",
        search,
      }),
      {
        pageTitle: `[${titleKey}]`,
        breadcrumbItems: [
          ...expectedBreadcrumbPrefix,
          {
            key: "role-details",
            label: `[${titleKey}]`,
            active: true,
          },
        ],
        hideAutoBreadcrumb: false,
      },
    );
  });
});

test("preserves inspection execution detail query parameters", () => {
  assert.deepEqual(
    resolve({
      pathname: "/inspection/tasks/execution",
      search: "taskId=12&taskNo=TASK-9&tab=violations&from=dashboard&ignored=x",
    }),
    {
      pageTitle: "[inspection.execution.inspectionInProgress]",
      breadcrumbItems: [
        { key: "inspection", label: "[menu.inspection]" },
        {
          key: "inspection-tasks",
          label: "[menu.inspectionTasks]",
          path: "/inspection/tasks",
        },
        {
          key: "inspection-task-details",
          label: "[menu.inspectionTaskDetails]",
          path: "/inspection/tasks/detail?taskId=12&taskNo=TASK-9&tab=violations&from=dashboard",
        },
        {
          key: "inspection-in-progress",
          label: "[inspection.execution.inspectionInProgress]",
          active: true,
        },
      ],
      hideAutoBreadcrumb: false,
    },
  );
});

test("resolves every supported team management scope", () => {
  const scopes = {
    licensing: [
      "menu.licensingManagement",
      "menu.teamManagement",
      "/licensing/team-management",
    ],
    content: [
      "menu.contentManagement",
      "menu.teamManagement",
      "/content/team-management",
    ],
    customer: [
      "menu.CustomerHappiness",
      "menu.teamManagement",
      "/happiness/team-management",
    ],
    inspection: [
      "menu.inspection",
      "menu.inspectionTasks",
      "/inspection/tasks",
    ],
  };

  Object.entries(scopes).forEach(
    ([scope, [moduleLabelKey, teamManagementLabelKey, path]]) => {
    assert.deepEqual(
      resolve({
        pathname: "/tasks/detail",
        search: `breadcrumbMode=teamManagementTask&teamManagementScope=${scope}`,
      }),
      {
        pageTitle: "[menu.taskDetails]",
        breadcrumbItems: [
          { key: "team-management-module", label: `[${moduleLabelKey}]` },
          {
            key: "team-management-list",
            label: `[${teamManagementLabelKey}]`,
            path,
          },
          {
            key: "team-management-task-details",
            label: "[menu.taskDetails]",
            active: true,
          },
        ],
        hideAutoBreadcrumb: true,
      },
    );
    },
  );
});

test("keeps invalid team management scopes on the default header", () => {
  assert.deepEqual(
    resolve({
      pathname: "/tasks/detail",
      search: "breadcrumbMode=teamManagementTask&teamManagementScope=invalid",
    }),
    {
      pageTitle: "Default title",
      breadcrumbItems: undefined,
      hideAutoBreadcrumb: false,
    },
  );
});

test("resolves broadcast view and edit header presentations", () => {
  [
    ["/communications/broadcastView", "", "broadcast-view", "menu.broadcastView"],
    [
      "/communications/broadcastEdit",
      "",
      "broadcast-edit",
      "Settings.broadcast.list.actions.addNew",
    ],
    [
      "/communications/broadcastEdit",
      "id=4",
      "broadcast-edit",
      "Settings.broadcast.list.actions.edit",
    ],
  ].forEach(([pathname, search, key, titleKey]) => {
    assert.deepEqual(resolve({ pathname, search }), {
      pageTitle: `[${titleKey}]`,
      breadcrumbItems: [
        { key: "communications", label: "[menu.communications]" },
        {
          key: "broadcast",
          label: "[menu.broadcast]",
          path: "/communications/broadcast",
        },
        { key, label: `[${titleKey}]`, active: true },
      ],
      hideAutoBreadcrumb: false,
    });
  });
});

test("resolves reports analytics with the module title and hides automatic breadcrumbs", () => {
  assert.deepEqual(
    resolve({
      pathname: "/service-management/reports-analytics",
      moduleI18nKey: "menu.customModule",
    }),
    {
      pageTitle: "[menu.reportsAnalytics]",
      breadcrumbItems: [
        { key: "parent-module", label: "[menu.customModule]" },
        {
          key: "reports-analytics",
          label: "[menu.reportsAnalytics]",
          active: true,
        },
      ],
      hideAutoBreadcrumb: true,
    },
  );
});
