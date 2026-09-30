import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const file = new URL("../src/pages/InspectionTaskManagement/index.tsx", import.meta.url);
const source = await readFile(file, "utf8");
const start = source.indexOf("const EMPTY_INSPECTION_TEAM_TASK_SUMMARY_STATS");
const end = source.indexOf("const shouldIgnoreTaskRowClick", start);
assert.ok(start >= 0 && end > start);
const { code } = await transformWithEsbuild(
  `${source.slice(start, end)}\nexport { mapInspectionTeamManagementSummaryToInspectionStats as mapSummary };`,
  file.pathname,
  { loader: "ts", format: "esm" },
);
const { mapSummary } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("maps captured EN/AR status cards identically without using category aggregates", () => {
  const codes = ["Queued", "PendingVisit", "InProgress", "AccessFailed", "Completed", "Cancelled"];
  const arabic = ["في قائمة الانتظار", "بانتظار الزيارة", "قيد التنفيذ", "تعذر الوصول", "مكتمل", "ملغي"];
  const counts = [41, 144, 22, 0, 42, 5];
  const expected = { queuedCount: 41, pendingVisitCount: 144, inProgressCount: 22, accessFailedCount: 0, completedCount: 42, cancelledCount: 5 };
  for (const displays of [codes, arabic]) {
    assert.deepEqual(mapSummary({
      todoCount: 217,
      completedCount: 76,
      categories: [{ category: "all", categoryDisplay: "الكل", todoCount: 217, completedCount: 76 }],
      statusCards: codes.map((code, index) => ({ code, display: displays[index], count: counts[index] })),
    }), expected);
  }
});

test("does not interpret display text as a technical status code", () => {
  assert.equal(mapSummary({ statusCards: [{ code: "Unknown", display: "Queued", count: 99 }] }).queuedCount, 0);
});
