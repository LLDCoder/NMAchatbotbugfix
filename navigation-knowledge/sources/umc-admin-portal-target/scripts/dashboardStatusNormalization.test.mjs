import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sharedSourceUrl = new URL(
  "../src/services/dashboardApiShared.ts",
  import.meta.url
);
const sharedSource = await readFile(sharedSourceUrl, "utf8");
const toneStart = sharedSource.indexOf("export const normalizeStatusTone");
const toneEnd = sharedSource.indexOf(
  "export const normalizeTaskSourceType",
  toneStart
);

assert.notEqual(toneStart, -1, "Dashboard status tone normalizer not found");
assert.notEqual(toneEnd, -1, "Dashboard status tone normalizer end not found");

const toneSource = `
type DashboardTone = "default" | "green" | "red" | "orange" | "yellow";
${sharedSource.slice(toneStart, toneEnd)}
`;
const { code: toneCode } = await transformWithEsbuild(
  toneSource,
  sharedSourceUrl.pathname,
  {
    loader: "ts",
    format: "esm",
    target: "node20",
  }
);
const toneModuleUrl = `data:text/javascript;base64,${Buffer.from(toneCode).toString(
  "base64"
)}`;
const { normalizeStatusTone } = await import(toneModuleUrl);

const textSourceUrl = new URL(
  "../src/pages/Dashboard/components/dashboardText.ts",
  import.meta.url
);
const textSource = await readFile(textSourceUrl, "utf8");
const textEnd = textSource.indexOf("export const formatDashboardTaskAlert");

assert.notEqual(textEnd, -1, "Dashboard static text translator end not found");

const { code: textCode } = await transformWithEsbuild(
  textSource.slice(0, textEnd),
  textSourceUrl.pathname,
  {
    loader: "ts",
    format: "esm",
    target: "node20",
  }
);
const textModuleUrl = `data:text/javascript;base64,${Buffer.from(
  textCode
).toString("base64")}`;
const { translateDashboardStaticText } = await import(textModuleUrl);
const dashboardEnglishResource = JSON.parse(
  await readFile(
    new URL("../src/localization/dashboard/en.json", import.meta.url),
    "utf8"
  )
);
const dashboardArabicResource = JSON.parse(
  await readFile(
    new URL("../src/localization/dashboard/ar.json", import.meta.url),
    "utf8"
  )
);

const translate = (key) => key;

test("normalizes compact and spaced refund status codes to the same display keys", () => {
  const cases = [
    ["DepartmentProcessing", "adminDashboard.status.departmentProcessing"],
    ["Department Processing", "adminDashboard.status.departmentProcessing"],
    ["DepartmentProcessed", "adminDashboard.status.departmentProcessed"],
    ["Department Processed", "adminDashboard.status.departmentProcessed"],
    ["PendingCustomer", "adminDashboard.status.pendingCustomer"],
    ["Pending Customer", "adminDashboard.status.pendingCustomer"],
    ["PendingRefund", "adminDashboard.status.pendingRefund"],
    ["Pending Refund", "adminDashboard.status.pendingRefund"],
    ["Refunded", "adminDashboard.status.refunded"],
  ];

  for (const [status, expectedKey] of cases) {
    assert.equal(
      translateDashboardStaticText(status, translate),
      expectedKey,
      status
    );
  }
});

test("translates the compact expiring soon license status", () => {
  assert.equal(
    translateDashboardStaticText("ExpiringSoon", translate),
    "adminDashboard.status.expiringSoon"
  );
  assert.equal(
    dashboardEnglishResource.adminDashboard.status.expiringSoon,
    "Expiring Soon"
  );
  assert.equal(
    dashboardArabicResource.adminDashboard.status.expiringSoon,
    "ينتهي قريبًا"
  );
});

test("translates license performance trend task names", () => {
  const cases = [
    ["ServiceApplication", "adminDashboard.tabs.serviceApplication"],
    ["ProfileVerification", "adminDashboard.tabs.profileVerification"],
    ["Enquiries", "adminDashboard.tabs.enquiriesComplaints"],
    ["Refunds", "adminDashboard.tabs.refunds"],
    ["Appeals", "adminDashboard.tabs.appeals"],
  ];

  for (const [taskName, expectedKey] of cases) {
    assert.equal(
      translateDashboardStaticText(taskName, translate),
      expectedKey,
      taskName
    );
  }
});

test("uses the established dashboard tones for refund statuses", () => {
  for (const status of [
    "DepartmentProcessing",
    "Department Processing",
    "DepartmentProcessed",
    "Department Processed",
    "PendingCustomer",
    "Pending Customer",
    "PendingRefund",
    "Pending Refund",
  ]) {
    assert.equal(normalizeStatusTone(status), "orange", status);
  }

  assert.equal(normalizeStatusTone("Refunded"), "green");
});

test("preserves the existing fallback for unknown statuses", () => {
  assert.equal(
    translateDashboardStaticText("BackendOnlyStatus", translate),
    "BackendOnlyStatus"
  );
  assert.equal(normalizeStatusTone("BackendOnlyStatus"), "default");
});
