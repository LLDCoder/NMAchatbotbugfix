import assert from "node:assert/strict";
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
  getDashboardTaskCardTitleFromTaskNo,
  getInspectionDashboardTaskCardTitle,
} = await vite.ssrLoadModule("/src/services/dashboardTaskCardTitle.ts");

const loadTaskCardMapper = async ({
  serviceFile,
  dtoName,
  normalizerSource,
  mapperName = "mapTaskCards",
}) => {
  const sourceUrl = new URL(`../src/services/${serviceFile}`, import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const start = source.indexOf(`const ${mapperName} = (`);
  const end = source.indexOf("const mapTodoTabs = (", start);

  assert.notEqual(start, -1, `${serviceFile} task mapper not found`);
  assert.notEqual(end, -1, `${serviceFile} task mapper end not found`);

  const mapperSource = source
    .slice(start, end)
    .replace(`const ${mapperName}`, "export const mapTaskCards");
  const testSource = `
type DashboardTaskSourceType =
  | "application"
  | "profile"
  | "enquiry"
  | "ticket"
  | "refund"
  | "appeal"
  | "inspection"
  | "violation";
type DashboardTaskCard = Record<string, unknown>;
type ${dtoName} = Record<string, any>;
const createDashboardItemKeyFactory = () => () => "test-key";
const optionalString = (value?: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const normalizeDashboardEntityIconType = () => undefined;
const normalizeStatusTone = () => "default";
const getFirstActionTarget = () => ({});
const getFirstOpenActionTarget = () => ({});
const getStatusConfig = () => ({
  statusKey: undefined,
  statusText: undefined,
  tone: "default",
});
const withQuery = () => "/test-target";
const CONTENT_ROUTE = {
  violationDetails: "/content/violations/detail",
  teamManagement: "/content/team-management",
};
${normalizerSource}
const getDashboardTaskCardTitleFromTaskNo = (
  sourceType: DashboardTaskSourceType | undefined,
  card: { taskTitle?: string; taskNo?: string },
) =>
  sourceType === "enquiry" ||
  sourceType === "refund" ||
  sourceType === "violation"
    ? card.taskNo
    : card.taskTitle;
const getInspectionDashboardTaskCardTitle = (
  sourceType: DashboardTaskSourceType | undefined,
  card: { taskTitle?: string; taskNo?: string },
) => (sourceType === "refund" ? card.taskNo : card.taskTitle);
${mapperSource}
`;
  const { code } = await transformWithEsbuild(testSource, sourceUrl.pathname, {
    loader: "ts",
    format: "esm",
    target: "node20",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
    "base64",
  )}`;

  return (await import(moduleUrl)).mapTaskCards;
};

const extractSource = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${startMarker} not found`);
  assert.notEqual(end, -1, `${endMarker} not found`);

  return source.slice(start, end);
};
const sharedDashboardSource = await readFile(
  new URL("../src/services/dashboardApiShared.ts", import.meta.url),
  "utf8",
);
const customerDashboardSource = await readFile(
  new URL("../src/services/customerHappinessDashboard.ts", import.meta.url),
  "utf8",
);
const sharedSourceNormalizer = extractSource(
  sharedDashboardSource,
  "export const normalizeTaskSourceType",
  "export const withQuery",
).replace("export const normalizeTaskSourceType", "const normalizeTaskSourceType");
const customerSourceNormalizer = extractSource(
  customerDashboardSource,
  "const normalizeCustomerSourceType",
  "const isNumericPathValue",
);

const contentTaskCardMapper = await loadTaskCardMapper({
  serviceFile: "contentDashboard.ts",
  dtoName: "ContentDashboardTaskCardDto",
  normalizerSource: sharedSourceNormalizer,
});
const customerTaskCardMapper = await loadTaskCardMapper({
  serviceFile: "customerHappinessDashboard.ts",
  dtoName: "CustomerDashboardTaskCardDto",
  normalizerSource: customerSourceNormalizer,
  mapperName: "mapCustomerTaskCards",
});
const inspectionTaskCardMapper = await loadTaskCardMapper({
  serviceFile: "inspectionDashboard.ts",
  dtoName: "InspectionDashboardTaskCardDto",
  normalizerSource: sharedSourceNormalizer,
});

test.after(async () => {
  await vite.close();
});

test("selects Content task titles from the Figma-defined API field", () => {
  const card = {
    taskTitle: "Business label",
    taskNo: "HC-02-2026-3334303",
  };

  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("application", card),
    "Business label",
  );
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("appeal", card),
    "Business label",
  );
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("enquiry", card),
    "HC-02-2026-3334303",
  );
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("refund", card),
    "HC-02-2026-3334303",
  );
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("violation", card),
    "HC-02-2026-3334303",
  );
});

test("selects Customer enquiry and refund numbers without changing appeal reasons", () => {
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("enquiry", {
      taskTitle: "Enquiries & Complaints",
      taskNo: "HC-01-2026-0613286",
    }),
    "HC-01-2026-0613286",
  );
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("refund", {
      taskTitle: "Application",
      taskNo: "HC-02-2026-5092236",
    }),
    "HC-02-2026-5092236",
  );
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("appeal", {
      taskTitle: "Procedural Error",
      taskNo: "HC-03-2026-2686197",
    }),
    "Procedural Error",
  );
});

test("does not substitute taskTitle when a number-based title is absent", () => {
  assert.equal(
    getDashboardTaskCardTitleFromTaskNo("refund", {
      taskTitle: "Application",
    }),
    undefined,
  );
});

test("uses Inspection taskTitle except for Refund taskNo", () => {
  const card = {
    taskTitle: "VN-2026-6847884",
    taskNo: "HC-02-2026-3571239",
  };

  for (const sourceType of ["inspection", "violation", "enquiry", "appeal"]) {
    assert.equal(
      getInspectionDashboardTaskCardTitle(sourceType, card),
      "VN-2026-6847884",
    );
  }

  assert.equal(
    getInspectionDashboardTaskCardTitle("refund", card),
    "HC-02-2026-3571239",
  );
});

test("keeps Inspection Refund empty until the backend provides taskNo", () => {
  assert.equal(
    getInspectionDashboardTaskCardTitle("refund", {
      taskTitle: "Fine",
    }),
    undefined,
  );
});

test("wires Content API fields and normalized source types into task cards", () => {
  const cards = [
    ["Service Application", "Service name", "SA-01"],
    ["Appeal", "Procedural Error", "HC-03-01"],
    ["Enquiry", "Enquiry label", "HC-01-01"],
    ["Refund", "Refund label", "HC-02-01"],
    ["Violation", "Violation label", "VN-01"],
  ].map(([sourceType, taskTitle, taskNo], index) => ({
    sourceType,
    sourceId: String(index + 1),
    taskTitle,
    taskNo,
  }));

  assert.deepEqual(
    contentTaskCardMapper(cards, "content").map((card) => [
      card.sourceType,
      card.title,
    ]),
    [
      ["application", "Service name"],
      ["appeal", "Procedural Error"],
      ["enquiry", "HC-01-01"],
      ["refund", "HC-02-01"],
      ["violation", "VN-01"],
    ],
  );
});

test("wires Customer API fields and normalized source types into task cards", () => {
  const cards = [
    ["Enquiry", "Enquiry label", "HC-01-01"],
    ["Refund", "Refund label", "HC-02-01"],
    ["Appeal", "Procedural Error", "HC-03-01"],
  ].map(([sourceType, taskTitle, taskNo], index) => ({
    sourceType,
    sourceId: String(index + 1),
    taskTitle,
    taskNo,
  }));

  assert.deepEqual(
    customerTaskCardMapper(cards, "customer").map((card) => [
      card.sourceType,
      card.title,
    ]),
    [
      ["enquiry", "HC-01-01"],
      ["refund", "HC-02-01"],
      ["appeal", "Procedural Error"],
    ],
  );
});

test("wires Inspection taskType and strict Refund taskNo into task cards", () => {
  const cards = [
    ["Inspection", "IN-2026-01", undefined],
    ["Violation", "VN-2026-01", undefined],
    ["Enquiry", "Ticket reason", undefined],
    ["Appeal", "Procedural Error", undefined],
    ["Refund", "Fine", "HC-02-2026-01"],
    ["Refund", "Fine", undefined],
  ].map(([taskType, taskTitle, taskNo], index) => ({
    taskType,
    taskId: String(index + 1),
    taskTitle,
    taskNo,
  }));

  assert.deepEqual(
    inspectionTaskCardMapper(cards, "inspection").map((card) => [
      card.sourceType,
      card.title,
    ]),
    [
      ["inspection", "IN-2026-01"],
      ["violation", "VN-2026-01"],
      ["enquiry", "Ticket reason"],
      ["appeal", "Procedural Error"],
      ["refund", "HC-02-2026-01"],
      ["refund", undefined],
    ],
  );
});
