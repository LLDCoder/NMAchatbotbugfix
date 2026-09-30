import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer, transformWithEsbuild } from "vite";

const vite = await createServer({
  appType: "custom",
  configFile: false,
  logLevel: "silent",
  root: process.cwd(),
  server: { hmr: false, middlewareMode: true },
});

const {
  getLicenseDashboardTaskCardTitle,
  getLicenseDashboardTaskCardSubtitle,
  getLicenseDashboardTaskCardActionTarget,
} = await vite.ssrLoadModule("/src/services/licenseDashboardTaskCard.ts");
const { normalizeDashboardActionTarget } = await vite.ssrLoadModule(
  "/src/services/dashboardApiShared.ts",
);

globalThis.__licenseTaskCardTest = {
  getLicenseDashboardTaskCardActionTarget,
  getLicenseDashboardTaskCardSubtitle,
  getLicenseDashboardTaskCardTitle,
  normalizeDashboardActionTarget,
};

const licenseDashboardSourceUrl = new URL(
  "../src/services/licenseDashboard.ts",
  import.meta.url,
);
const licenseDashboardSource = await readFile(licenseDashboardSourceUrl, "utf8");
const mapperStart = licenseDashboardSource.indexOf("const mapTaskCards = (");
const mapperEnd = licenseDashboardSource.indexOf(
  "const mapTodoTabs = (",
  mapperStart,
);
const categoryStart = licenseDashboardSource.indexOf(
  "const LICENSE_TASK_CATEGORIES = [",
);
const categoryEnd = licenseDashboardSource.indexOf(
  "type LicenseTaskTabKey",
  categoryStart,
);
const categoryLookupStart = licenseDashboardSource.indexOf(
  "const getCategoryConfigByTaskType",
);
const categoryLookupEnd = licenseDashboardSource.indexOf(
  "const countKeyByCategory",
  categoryLookupStart,
);
const sourceTypeStart = licenseDashboardSource.indexOf(
  "const getLicenseTaskSourceType",
);

assert.notEqual(mapperStart, -1, "License task mapper not found");
assert.notEqual(mapperEnd, -1, "License task mapper end not found");
assert.notEqual(categoryStart, -1, "License task categories not found");
assert.notEqual(categoryEnd, -1, "License task categories end not found");
assert.notEqual(categoryLookupStart, -1, "License category lookup not found");
assert.notEqual(categoryLookupEnd, -1, "License category lookup end not found");
assert.notEqual(sourceTypeStart, -1, "License task source type mapper not found");

const categorySource = licenseDashboardSource.slice(categoryStart, categoryEnd);
const categoryLookupSource = licenseDashboardSource.slice(
  categoryLookupStart,
  categoryLookupEnd,
);
const sourceTypeSource = licenseDashboardSource.slice(
  sourceTypeStart,
  mapperStart,
);
const mapperSource = licenseDashboardSource
  .slice(mapperStart, mapperEnd)
  .replace("const mapTaskCards", "export const mapTaskCards");
const { code: mapperCode } = await transformWithEsbuild(
  `
type DashboardTaskCard = Record<string, unknown>;
type LicenseDashboardTaskDto = Record<string, any>;
type LicenseDashboardTaskCardSourceType =
  | "application"
  | "profile"
  | "enquiry"
  | "refund"
  | "appeal";
const createDashboardItemKeyFactory = () => () => "test-key";
const optionalString = (value?: unknown) => {
  const text = String(value ?? "").trim();
  return text || undefined;
};
const normalizeStatusTone = () => "default";
const normalizeDashboardEntityIconType = () => undefined;
const {
  getLicenseDashboardTaskCardActionTarget,
  getLicenseDashboardTaskCardSubtitle,
  getLicenseDashboardTaskCardTitle,
  normalizeDashboardActionTarget,
} = globalThis.__licenseTaskCardTest;
${categorySource}
${categoryLookupSource}
${sourceTypeSource}
${mapperSource}
`,
  licenseDashboardSourceUrl.pathname,
  {
    loader: "ts",
    format: "esm",
    target: "node20",
  },
);
const licenseMapperModuleUrl = `data:text/javascript;base64,${Buffer.from(
  mapperCode,
).toString("base64")}`;
const { mapTaskCards: mapLicenseTaskCards } = await import(
  licenseMapperModuleUrl
);

test.after(async () => {
  delete globalThis.__licenseTaskCardTest;
  await vite.close();
});

test("selects the Figma-defined title field for each license task type", () => {
  const card = {
    title: "Task title",
    applyFor: "Applicant name",
    referenceNumber: "HC-02-2026-5092236",
  };

  assert.equal(
    getLicenseDashboardTaskCardTitle("application", card),
    "Task title",
  );
  assert.equal(
    getLicenseDashboardTaskCardTitle("appeal", card),
    "Task title",
  );
  assert.equal(
    getLicenseDashboardTaskCardTitle("profile", card),
    "Applicant name",
  );
  assert.equal(
    getLicenseDashboardTaskCardTitle("enquiry", card),
    "HC-02-2026-5092236",
  );
  assert.equal(
    getLicenseDashboardTaskCardTitle("refund", card),
    "HC-02-2026-5092236",
  );
});

test("does not substitute another field when the required title field is absent", () => {
  assert.equal(
    getLicenseDashboardTaskCardTitle("refund", {
      title: "Application",
      applyFor: "Applicant name",
    }),
    undefined,
  );
});

test("keeps the profile title and subtitle on different API fields", () => {
  const card = {
    title: "Creative Media Hub",
    applyFor: "Agency Mira",
  };

  assert.equal(getLicenseDashboardTaskCardSubtitle("profile", card), card.title);
  assert.equal(
    getLicenseDashboardTaskCardSubtitle("application", card),
    card.applyFor,
  );
});

test("overrides a refund action with its refund detail target", () => {
  const actionTarget = getLicenseDashboardTaskCardActionTarget(
    "refund",
    "80",
    [{ actionCode: "open", actionUrl: "appeals/80" }],
  );

  assert.equal(actionTarget, "/refunds/80");
  assert.deepEqual(normalizeDashboardActionTarget(actionTarget, "license"), {
    targetPath:
      "/happiness/refunds/refundsDetails?refundId=80&viewRole=business_department&pageTitleKey=menu.refundsDetails&breadcrumbRootKey=menu.customer",
    permissionPath: "/happiness/refunds/refundsDetails",
  });
});

test("wires the License mapper to the normalized Refund Details target", () => {
  const [card] = mapLicenseTaskCards(
    [
      {
        taskType: 3,
        taskId: 80,
        referenceNumber: "HC-02-2026-5092236",
        title: "Application",
        availableActions: [
          { actionCode: "open", actionUrl: "appeals/80" },
        ],
      },
    ],
    "license",
  );

  assert.equal(card.sourceType, "refund");
  assert.equal(card.title, "HC-02-2026-5092236");
  assert.equal(
    card.targetPath,
    "/happiness/refunds/refundsDetails?refundId=80&viewRole=business_department&pageTitleKey=menu.refundsDetails&breadcrumbRootKey=menu.customer",
  );
  assert.equal(card.permissionPath, "/happiness/refunds/refundsDetails");
});

test("keeps non-refund actions and disables refunds without a task id", () => {
  assert.equal(
    getLicenseDashboardTaskCardActionTarget(
      "appeal",
      "84",
      [{ actionCode: "open", actionUrl: "appeals/84" }],
    ),
    "appeals/84",
  );
  assert.equal(
    getLicenseDashboardTaskCardActionTarget(
      "refund",
      undefined,
      [{ actionCode: "open", actionUrl: "appeals/80" }],
    ),
    undefined,
  );
});

test("keeps the shared task list aligned with the desktop Figma specification", () => {
  const styles = readFileSync("src/pages/Dashboard/index.less", "utf8");
  const taskScrollHeight = styles.match(
    /\.dashboard__task-scroll\s*\{[\s\S]*?height:\s*(\d+)px;/,
  )?.[1];
  const taskEmptyHeight = styles.match(
    /\.dashboard__task-empty\s*\{[\s\S]*?height:\s*(\d+)px;/,
  )?.[1];
  const taskEmptyPaddingBottom = styles.match(
    /\.dashboard__task-empty\s*\{[\s\S]*?padding-bottom:\s*(\d+)px;/,
  )?.[1];
  const taskEmptyStateMinHeight = styles.match(
    /\.dashboard__task-empty\s+\.dashboard__empty-state\s*\{[\s\S]*?min-height:\s*(\d+)px;/,
  )?.[1];

  assert.equal(taskScrollHeight, "156", "populated task content height");
  assert.equal(taskEmptyHeight, "156", "loading and empty task content height");
  assert.equal(
    taskEmptyHeight,
    taskScrollHeight,
    "loading and populated task content must keep the same height",
  );
  assert.equal(
    Number(taskEmptyPaddingBottom) + Number(taskEmptyStateMinHeight),
    Number(taskEmptyHeight),
    "the empty state content and padding must fit its fixed height",
  );

  assert.match(
    styles,
    /\.dashboard__task-section\s*\{[\s\S]*?border-radius:\s*20px;/,
  );
  assert.match(
    styles,
    /\.dashboard__page--inspection\s+\.dashboard__task-section\s*\{[\s\S]*?border-radius:\s*24px;/,
  );
  assert.ok(
    styles.lastIndexOf(
      ".dashboard__page--inspection .dashboard__task-section",
    ) > styles.lastIndexOf(".dashboard__page--inspection .dashboard__card {"),
    "the Inspection task radius override must follow the generic Inspection card rule",
  );
  assert.match(
    styles,
    /\.dashboard__task-section\s+\.dashboard__card-title\s*\{[\s\S]*?font-size:\s*20px;[\s\S]*?line-height:\s*24px;/,
  );
  assert.match(
    styles,
    /\.dashboard__tabs--task\s*\{[\s\S]*?gap:\s*32px;/,
  );
  assert.match(
    styles,
    /\.dashboard__tabs--task\s+\.dashboard__tab\s*\{[\s\S]*?padding:\s*16px 0;[\s\S]*?font-size:\s*16px;[\s\S]*?line-height:\s*24px;/,
  );
  assert.match(
    styles,
    /\.dashboard__task-card\s*\{[\s\S]*?gap:\s*16px;[\s\S]*?padding:\s*16px;[\s\S]*?border-radius:\s*12px;/,
  );
  assert.match(
    styles,
    /\.dashboard__task-section\s+\.dashboard__application-status\s*\{[\s\S]*?height:\s*26px;[\s\S]*?padding:\s*2px 6px;[\s\S]*?font-size:\s*14px;[\s\S]*?line-height:\s*20px;/,
  );
  assert.match(
    styles,
    /\.dashboard__task-subtitle-icon\s*\{[\s\S]*?width:\s*14px;[\s\S]*?height:\s*14px;/,
  );
});
