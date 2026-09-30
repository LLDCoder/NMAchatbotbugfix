import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const moduleUrl = new URL(
  "../src/pages/Notifications/notificationNavigation.ts",
  import.meta.url,
);
const source = await readFile(moduleUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const navigation = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("linkifies supported three-part and four-part notification references", () => {
  const input = [
    "IN-2026-6423168",
    "VN-2026-7614884",
    "ML-1-8007-7920182",
    "MC-01-2026-1234567",
    "MP-01-2026-1234567",
    "HC-01-2026-0396597",
    "HC-02-2026-5092236",
    "HC-03-2026-2727667",
    "RF-01-2026-1234567",
  ].join(" ");

  const output = navigation.linkifyNotificationReferenceNumbers(input);

  for (const referenceNo of input.split(" ")) {
    assert.match(
      output,
      new RegExp(
        `<span class="notification-ref-no">${referenceNo}</span>`,
      ),
    );
  }
});

test("linkifies visible text without changing HTML attributes", () => {
  const input =
    '<a href="/inspection/tasks/detail?taskNo=IN-2026-6423168">IN-2026-6423168</a>';

  assert.equal(
    navigation.linkifyNotificationReferenceNumbers(input),
    '<a href="/inspection/tasks/detail?taskNo=IN-2026-6423168"><span class="notification-ref-no">IN-2026-6423168</span></a>',
  );
});

test("preserves tags when an attribute contains a closing angle bracket", () => {
  const input =
    '<span title="Status > IN-2026-6423168">IN-2026-6423168</span>';

  assert.equal(
    navigation.linkifyNotificationReferenceNumbers(input),
    '<span title="Status > IN-2026-6423168"><span class="notification-ref-no">IN-2026-6423168</span></span>',
  );
});

test("accepts registered notification detail routes and rejects legacy or non-route values", () => {
  assert.equal(
    navigation.getInternalNotificationPath(
      "http://adminportal-api/happiness/tickets/tickets-details?id=152",
    ),
    "/happiness/tickets/tickets-details?id=152",
  );
  assert.equal(
    navigation.getInternalNotificationPath(
      "/inspection/tasks/detail?taskNo=IN-2026-6423168",
    ),
    "/inspection/tasks/detail?taskNo=IN-2026-6423168",
  );
  assert.equal(
    navigation.getInternalNotificationPath(
      "http://adminportal-api/applications/2591",
    ),
    null,
  );
  assert.equal(
    navigation.getInternalNotificationPath("15/08/2026 14:49:28"),
    null,
  );
  assert.equal(
    navigation.getInternalNotificationPath(
      "https://external.invalid/happiness/tickets/tickets-details",
    ),
    null,
  );
  assert.equal(
    navigation.getInternalNotificationPath(
      "/licensing/applications/applicationsDetails?applicationNo=ML-1-8007-7920182",
    ),
    null,
  );
});

test("treats a non-empty invalid backend linkUrl as an error", () => {
  assert.throws(
    () =>
      navigation.resolveProvidedNotificationPath(
        "https://external.invalid/happiness/tickets/tickets-details?id=152",
        "/inspection/tasks/detail?taskNo=IN-2026-6423168",
      ),
    /Invalid notification linkUrl/,
  );
  assert.equal(
    navigation.resolveProvidedNotificationPath(
      null,
      "/inspection/tasks/detail?taskNo=IN-2026-6423168",
    ),
    "/inspection/tasks/detail?taskNo=IN-2026-6423168",
  );
  assert.throws(
    () =>
      navigation.resolveProvidedNotificationPath(
        "//external.invalid/happiness/tickets/tickets-details?id=152",
      ),
    /Invalid notification linkUrl/,
  );
  assert.throws(
    () =>
      navigation.resolveProvidedNotificationPath(
        "/\\\\external.invalid/happiness/tickets/tickets-details?id=152",
      ),
    /Invalid notification linkUrl/,
  );
});

test("uses a provided path for multiple references only when it matches the clicked reference", () => {
  assert.equal(
    navigation.resolveProvidedNotificationPath(
      null,
      "/inspection/tasks/detail?taskNo=IN-2026-6423168",
      "IN-2026-6423168",
      true,
    ),
    "/inspection/tasks/detail?taskNo=IN-2026-6423168",
  );
  assert.equal(
    navigation.resolveProvidedNotificationPath(
      null,
      "/inspection/tasks/detail?taskNo=IN-2026-6423168",
      "VN-2026-7614884",
      true,
    ),
    null,
  );
});

test("accepts detail permissions inherited from the registered parent route", () => {
  const route = {
    path: "/licensing/applications/applicationsDetails",
    activeMenuPath: "/licensing/applications",
  };

  assert.equal(
    navigation.isNotificationRouteAllowed(
      route,
      new Set(["/licensing/applications"]),
    ),
    true,
  );
  assert.equal(
    navigation.isNotificationRouteAllowed(route, new Set(["/dashboard"])),
    false,
  );
});

test("builds deterministic detail paths only when the reference contains enough real data", () => {
  assert.equal(
    navigation.buildDirectNotificationPath("IN-2026-6423168"),
    "/inspection/tasks/detail?taskNo=IN-2026-6423168",
  );
  assert.equal(
    navigation.buildDirectNotificationPath("VN-2026-7614884"),
    "/inspection/violations/detail?violationNo=VN-2026-7614884",
  );
  assert.equal(
    navigation.buildDirectNotificationPath("HC-02-2026-5092236"),
    "/happiness/refunds/refundsDetails?refundNo=HC-02-2026-5092236",
  );
  assert.equal(
    navigation.buildDirectNotificationPath("RF-01-2026-1234567"),
    "/happiness/refunds/refundsDetails?refundNo=RF-01-2026-1234567",
  );
  assert.equal(
    navigation.buildDirectNotificationPath("HC-01-2026-0396597", "152"),
    "/happiness/tickets/tickets-details?id=152",
  );
  assert.equal(
    navigation.buildDirectNotificationPath("HC-03-2026-2727667", "83"),
    "/happiness/appeals/appealsDetails?appealId=83",
  );
  assert.equal(
    navigation.buildDirectNotificationPath("HC-03-2026-2727667"),
    null,
  );
  assert.equal(
    navigation.buildDirectNotificationPath("HC-020-2026-5092236"),
    null,
  );
  assert.equal(
    navigation.buildDirectNotificationPath("ML-1-8007-7920182"),
    null,
  );
});

test("identifies service application references that require task lookup", () => {
  assert.equal(
    navigation.isServiceApplicationReference("ML-1-8007-7920182"),
    true,
  );
  assert.equal(
    navigation.isServiceApplicationReference("MC-01-2026-1234567"),
    true,
  );
  assert.equal(
    navigation.isServiceApplicationReference("MP-01-2026-1234567"),
    true,
  );
  assert.equal(
    navigation.isServiceApplicationReference("HC-02-2026-5092236"),
    false,
  );
});

test("builds department-specific application detail paths from a real task lookup", () => {
  assert.equal(
    navigation.buildServiceApplicationPath({
      taskId: "license-task-id",
      departmentId: 1,
      referenceNo: "ML-1-8007-7920182",
    }),
    "/licensing/applications/applicationsDetails?taskId=license-task-id&applicationNo=ML-1-8007-7920182",
  );
  assert.equal(
    navigation.buildServiceApplicationPath({
      taskId: "content-task-id",
      departmentId: 2,
      referenceNo: "MC-01-2026-1234567",
    }),
    "/content/ContentApplications/ContentApplicationsDetails?taskId=content-task-id&applicationNo=MC-01-2026-1234567",
  );
  assert.equal(
    navigation.buildServiceApplicationPath({
      taskId: "unknown-task-id",
      departmentId: 6,
      referenceNo: "MP-01-2026-1234567",
    }),
    null,
  );
});
