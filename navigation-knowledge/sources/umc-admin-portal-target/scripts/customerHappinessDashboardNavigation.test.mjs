import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourceUrl = new URL(
  "../src/services/customerHappinessDashboard.ts",
  import.meta.url,
);
const source = await readFile(sourceUrl, "utf8");

const extractSection = (startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${startMarker} not found`);
  assert.notEqual(end, -1, `${endMarker} not found`);

  return source.slice(start, end);
};

const routeSource = extractSection(
  "const CUSTOMER_ROUTE",
  "const CUSTOMER_TAB_ORDER",
);
const queryHelperSource = extractSection(
  "const withQuery",
  "const unwrapCustomerDashboardResponse",
);
const roleSource = extractSection(
  "const isManagerRole",
  "const getCustomerOverviewSections",
);
const sourceTypeSource = extractSection(
  "const normalizeCustomerSourceType",
  "const isNumericPathValue",
);
const targetSource = extractSection(
  "const isNumericPathValue",
  "const getFirstOpenActionTarget",
);
const rowTargetSource = extractSection(
  "const getCustomerActionTarget",
  "const mapAttentionTab",
)
  .replace("const mapAttentionRow", "export const mapAttentionRow");

const testSource = `
type DashboardRoleVariant = "staff" | "manager";
type DashboardTaskSourceType = "enquiry" | "refund" | "appeal" | "ticket";
type DashboardTone = "default" | "red" | "orange" | "neutral";
interface DashboardNavigationTarget {
  targetPath?: string;
  permissionPath?: string;
}
interface DashboardTableCell {
  text?: string;
  textKey?: string;
  [key: string]: unknown;
}
interface DashboardTableRow extends DashboardNavigationTarget {
  key: string;
  [key: string]: unknown;
}
interface CustomerDashboardActionDto {
  actionCode?: string | null;
  actionUrl?: string | null;
}
interface CustomerDashboardAttentionTaskDto {
  sourceType?: string | null;
  sourceId?: string | null;
  taskNo?: string | null;
  taskCategory?: string | null;
  applyFor?: string | null;
  applyForIconType?: string | null;
  waitingOn?: string | null;
  waitingOnIconType?: string | null;
  assignedToUserId?: string | null;
  assignedTo?: string | null;
  sla?: { displayText?: string | null } | null;
  statusDisplay?: string | null;
  timeAlertDisplay?: string | null;
  isUrgent?: boolean | null;
  canReassign?: boolean | null;
  detailTarget?: string | null;
  availableActions?: CustomerDashboardActionDto[] | null;
}
const createDashboardItemKeyFactory = () => () => "test-key";
const optionalString = (value?: string | null) => value || undefined;
const normalizeDashboardEntityIconType = (value?: string | null) => value;
const createDashboardWaitingOnCell = (value?: string | null) => ({
  text: optionalString(value),
});
const getStatusConfig = () => ({ tone: "default" as DashboardTone });
const getSlaTone = () => "default" as DashboardTone;
const getTimeAlertTone = () => "default" as DashboardTone;
const dashboardCell = (
  text?: string,
  options: Omit<DashboardTableCell, "text"> = {},
): DashboardTableCell => ({ text, ...options });
const dashboardLabelCell = (
  textKey: string,
  options: Omit<DashboardTableCell, "textKey"> = {},
): DashboardTableCell => ({ textKey, ...options });
${routeSource}
${queryHelperSource}
${roleSource}
${sourceTypeSource}
${targetSource}
${rowTargetSource}
`;
const { code } = await transformWithEsbuild(testSource, sourceUrl.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64",
)}`;
const { mapAttentionRow } = await import(moduleUrl);

const enquiryTask = {
  sourceType: "enquiry",
  sourceId: "120",
  taskNo: "HC-01-2026-2297753",
  taskCategory: "Enquiries & Complaints",
  statusDisplay: "Department Processed",
  canReassign: true,
  detailTarget: "happiness/tickets/tickets-details?id=120",
  availableActions: [
    {
      actionCode: "open",
      actionUrl: "happiness/tickets/tickets-details?id=120",
    },
  ],
};

const managerDetailCases = [
  {
    name: "urgent enquiry",
    tabKey: "urgent",
    task: enquiryTask,
    targetPath: "/happiness/tickets/tickets-details?id=120",
    permissionPath: "/happiness/tickets/tickets-details",
  },
  {
    name: "urgent refund",
    tabKey: "urgent",
    task: {
      sourceType: "refund",
      sourceId: "101",
      taskNo: "HC-02-2026-2023551",
      taskCategory: "Refunds",
      detailTarget: "finance/refunds/HC-02-2026-2023551",
    },
    targetPath:
      "/happiness/refunds/refundsDetails?refundNo=HC-02-2026-2023551&viewRole=business_department&pageTitleKey=menu.refundsDetails&breadcrumbRootKey=menu.customer",
    permissionPath: "/happiness/refunds/refundsDetails",
  },
  {
    name: "blocked enquiry",
    tabKey: "blocked",
    task: {
      taskNo: "HC-01-2026-9992330",
      taskCategory: "Enquiries & Complaints",
      detailTarget: "happiness/tickets/tickets-details?id=126",
    },
    targetPath: "/happiness/tickets/tickets-details?id=126",
    permissionPath: "/happiness/tickets/tickets-details",
  },
  {
    name: "blocked appeal",
    tabKey: "blocked",
    task: {
      taskNo: "HC-03-2026-2727667",
      taskCategory: "Appeals",
      detailTarget: "appeals/84",
    },
    targetPath:
      "/happiness/appeals/appealsDetails?appealId=84&viewRole=department&tab=todo&pageTitleKey=menu.appealsDetails&breadcrumbRootKey=menu.customer",
    permissionPath: "/happiness/appeals/appealsDetails",
  },
  {
    name: "blocked refund",
    tabKey: "blocked",
    task: {
      taskNo: "HC-02-2026-5092236",
      taskCategory: "Refunds",
      detailTarget: "finance/refunds/HC-02-2026-5092236",
    },
    targetPath:
      "/happiness/refunds/refundsDetails?refundNo=HC-02-2026-5092236&viewRole=business_department&pageTitleKey=menu.refundsDetails&breadcrumbRootKey=menu.customer",
    permissionPath: "/happiness/refunds/refundsDetails",
  },
];

for (const detailCase of managerDetailCases) {
  test(`manager ${detailCase.name} rows open the backend detail target`, () => {
    const row = mapAttentionRow(
      detailCase.task,
      0,
      "manager",
      detailCase.tabKey,
      () => `row-${detailCase.name}`,
    );

    assert.equal(row.targetPath, detailCase.targetPath);
    assert.equal(row.permissionPath, detailCase.permissionPath);
  });
}

test("manager urgent rows keep the reassign action", () => {
  const row = mapAttentionRow(
    enquiryTask,
    0,
    "manager",
    "urgent",
    () => "row-manager-reassign",
  );

  assert.deepEqual(row.reassignTask, {
    sourceType: "enquiry",
    sourceId: "120",
    userId: undefined,
    assignedTo: undefined,
    assignedToUserId: undefined,
  });
  assert.deepEqual(row.actions, [
    {
      key: "reassign",
      labelKey: "adminDashboard.actions.reassign",
      tone: "gold",
    },
  ]);
});

test("staff attention rows keep the backend detail target", () => {
  const row = mapAttentionRow(
    enquiryTask,
    0,
    "staff",
    "all",
    () => "row-staff-enquiry",
  );

  assert.equal(row.targetPath, "/happiness/tickets/tickets-details?id=120");
  assert.equal(row.permissionPath, "/happiness/tickets/tickets-details");
});

for (const actionCode of ["open", "view"]) {
  test(`manager attention rows fall back to the backend ${actionCode} action`, () => {
    const row = mapAttentionRow(
      {
        ...enquiryTask,
        detailTarget: null,
        availableActions: [
          {
            actionCode,
            actionUrl: "happiness/tickets/tickets-details?id=120",
          },
        ],
      },
      0,
      "manager",
      "urgent",
      () => `row-manager-${actionCode}`,
    );

    assert.equal(row.targetPath, "/happiness/tickets/tickets-details?id=120");
    assert.equal(row.permissionPath, "/happiness/tickets/tickets-details");
  });
}
