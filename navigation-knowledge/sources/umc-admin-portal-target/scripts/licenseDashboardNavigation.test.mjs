import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const dashboardSourceUrl = new URL(
  "../src/services/licenseDashboard.ts",
  import.meta.url,
);
const sharedSourceUrl = new URL(
  "../src/services/dashboardApiShared.ts",
  import.meta.url,
);
const teamManagementSourceUrl = new URL(
  "../src/services/teamManagement.ts",
  import.meta.url,
);
const dashboardSource = await readFile(dashboardSourceUrl, "utf8");
const sharedSource = await readFile(sharedSourceUrl, "utf8");
const teamManagementSource = await readFile(
  teamManagementSourceUrl,
  "utf8",
);
const targetStart = dashboardSource.indexOf(
  "const getLicenseAttentionRowTarget",
);
const targetEnd = dashboardSource.indexOf(
  "const mapNeedsAttentionRow",
  targetStart,
);

assert.notEqual(targetStart, -1, "License attention row target not found");
assert.notEqual(targetEnd, -1, "License attention row target end not found");

const extractSection = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${startMarker} not found`);
  assert.notEqual(end, -1, `${endMarker} not found`);

  return source.slice(start, end);
};

const withQuerySource = extractSection(
  sharedSource,
  "export const withQuery",
  "const appendMissingQuery",
);
const actionTargetSource = extractSection(
  sharedSource,
  "const appendMissingQuery",
  "export const getFirstActionTarget",
);
const categorySource = extractSection(
  teamManagementSource,
  "export const getTeamManagementTaskCategoryKey",
  "const normalizeLicensingStatusFilterValue",
)
  .replace(
    "export const getTeamManagementTaskCategoryKey",
    "const getTeamManagementTaskCategoryKey",
  )
  .replace(
    "export const normalizeTeamManagementTaskCategory",
    "const normalizeTeamManagementTaskCategory",
  );
const detailNavigationSource = extractSection(
  teamManagementSource,
  "const normalizeTeamManagementDetailTarget",
  "const buildUniqueStatusOptions",
).replace(
  "export interface BuildTeamManagementTaskDetailNavigationParams",
  "interface BuildTeamManagementTaskDetailNavigationParams",
);

const testSource = `
type DashboardRoleVariant = "staff" | "manager";
type LicenseAttentionTabKey = "urgent" | "blocked";
type TeamManagementScope = "licensing" | "content" | "customer" | "inspection";
type TeamTaskCategory =
  | "applications"
  | "profileVerifications"
  | "enquiries"
  | "refunds"
  | "appeals"
  | "inspectionTasks"
  | "violations";
interface TeamManagementTaskItem {
  detailTarget?: string | null;
  detailRoutePath?: string | null;
  detailRouteQuery?: Record<
    string,
    string | number | boolean | null | undefined
  >;
}
interface DashboardNavigationTarget {
  targetPath?: string;
  permissionPath?: string;
}
interface LicenseNeedsAttentionTaskDto {
  sourceType?: string | null;
  sourceId?: number | string | null;
  taskNo?: string | null;
  taskCategory?: string | null;
  taskCategoryCode?: string | null;
  taskCategoryDisplay?: string | null;
  canReassign?: boolean | null;
  detailTarget?: string | null;
}
const LICENSE_ROUTE = {
  teamManagement: "/licensing/team-management",
};
const isManagerRole = (roleVariant: DashboardRoleVariant) =>
  roleVariant === "manager";
const optionalString = (value?: unknown) => {
  if (value == null) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
};
const getLicenseAttentionApplicationTarget = () => ({
  targetPath: "/licensing/applications/applicationsDetails?taskId=legacy",
  permissionPath: "/licensing/applications/applicationsDetails",
});
${withQuerySource}
${actionTargetSource}
${categorySource}
${detailNavigationSource}
${dashboardSource
  .slice(targetStart, targetEnd)
  .replace(
    "const getLicenseAttentionRowTarget",
    "export const getLicenseAttentionRowTarget",
  )}
`;
const { code } = await transformWithEsbuild(
  testSource,
  dashboardSourceUrl.pathname,
  {
    loader: "ts",
    format: "esm",
    target: "node20",
  },
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64",
)}`;
const {
  buildTeamManagementTaskDetailNavigation,
  getLicenseAttentionRowTarget,
} = await import(moduleUrl);

const inspectionDetailRouteCases = [
  [
    "violations",
    "/inspection/tasks/violationsDetails",
    "violationId",
    "/inspection/violations/284",
  ],
  [
    "appeals",
    "/inspection/tasks/appealsDetails",
    "appealId",
    "/inspection/appeals/95",
  ],
  [
    "refunds",
    "/inspection/tasks/refundsDetails",
    "refundId",
    "/finance/refunds/71",
  ],
  [
    "enquiries",
    "/inspection/tasks/ticketsDetails",
    "id",
    "/happiness/tickets/38",
  ],
];

test("inspection detail presets use sourceId for every Other Task category", () => {
  inspectionDetailRouteCases.forEach(
    ([taskCategory, path, queryKey, businessTarget]) => {
      const navigation = buildTeamManagementTaskDetailNavigation({
        scope: "inspection",
        taskCategory,
        sourceId: "source-284",
        taskNo: "VN-2026-123",
        detailTarget: `${businessTarget}?${queryKey}=stale-id`,
      });

      assert.equal(navigation.detailRoutePath, path);
      assert.equal(navigation.detailRouteQuery?.[queryKey], "source-284");
    },
  );
});

test("inspection detail presets never use taskNo as a business detail ID", () => {
  inspectionDetailRouteCases.forEach(
    ([taskCategory, path, queryKey, businessTarget]) => {
      const navigation = buildTeamManagementTaskDetailNavigation({
        scope: "inspection",
        taskCategory,
        taskNo: "VN-2026-123",
        detailTarget: `${businessTarget}?${queryKey}=stale-id`,
      });

      assert.equal(navigation.detailRoutePath, path);
      assert.equal(queryKey in navigation.detailRouteQuery, false);
    },
  );
});

test("manager urgent application rows open the Team Management task detail", () => {
  const target = getLicenseAttentionRowTarget(
    {
      sourceType: "application",
      sourceId: "task-uuid",
      taskNo: "ML-2-1-2332555",
      taskCategoryCode: "Applications",
      taskCategoryDisplay: "Applications",
      canReassign: true,
      detailTarget:
        "/licensing/applications/applicationsDetails?id=2351&taskId=task-uuid",
    },
    "manager",
    "urgent",
  );
  const targetUrl = new URL(target.targetPath, "https://dashboard.local");

  assert.equal(
    targetUrl.pathname,
    "/licensing/team-management/applicationsDetails",
  );
  assert.equal(targetUrl.searchParams.get("taskId"), "task-uuid");
  assert.equal(
    targetUrl.searchParams.get("breadcrumbMode"),
    "teamManagementTask",
  );
  assert.equal(
    targetUrl.searchParams.get("teamManagementScope"),
    "licensing",
  );
  assert.equal(targetUrl.searchParams.get("sourcePage"), "teamManagement");
  assert.equal(targetUrl.searchParams.get("canReassign"), "true");
  assert.equal(target.permissionPath, "/licensing/team-management");
});

test("staff attention rows keep the licensing business detail target", () => {
  assert.deepEqual(
    getLicenseAttentionRowTarget(
      {
        detailTarget: "/applications/2351?taskId=task-uuid",
      },
      "staff",
      "urgent",
    ),
    {
      targetPath:
        "/licensing/applications/applicationsDetails?id=2351&taskId=task-uuid",
      permissionPath: "/licensing/applications/applicationsDetails",
    },
  );
});

test("manager rows use the first recognized task category", () => {
  const target = getLicenseAttentionRowTarget(
    {
      sourceType: "refund",
      sourceId: "refund-17",
      taskCategoryCode: "UnknownCategory",
      taskCategoryDisplay: "Refunds",
      detailTarget: "/refunds/refund-17",
    },
    "manager",
    "urgent",
  );

  assert.equal(
    new URL(target.targetPath, "https://dashboard.local").pathname,
    "/licensing/team-management/refundsDetails",
  );
});

test("manager rows do not guess a detail route for an unknown category", () => {
  assert.deepEqual(
    getLicenseAttentionRowTarget(
      {
        sourceType: "application",
        sourceId: "task-uuid",
        taskCategoryCode: "UnknownCategory",
        taskCategoryDisplay: "Unknown Category",
        taskCategory: "Unknown",
        detailTarget: "/applications/2351?taskId=task-uuid",
      },
      "manager",
      "urgent",
    ),
    {},
  );
});
