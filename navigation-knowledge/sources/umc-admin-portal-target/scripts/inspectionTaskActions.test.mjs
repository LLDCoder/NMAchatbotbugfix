import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/pages/InspectionCommon/taskActions.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { getInspectionTaskActionKeys: actions } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("Queued allows only manager assignment, including mixed roles", () => {
  for (const status of ["Queued", "QUEUED", "PENDING_ASSIGNMENT"]) {
    assert.deepEqual(actions({ role: "manager", task: { status } }), ["assign"]);
    assert.deepEqual(actions({ role: ["manager", "inspector"], task: { status } }), ["assign"]);
    assert.deepEqual(actions({ role: "inspector", task: { status } }), []);
    assert.deepEqual(actions({ role: null, task: { status } }), []);
  }
});

test("non-Queued manager and inspector actions remain unchanged", () => {
  for (const [status, expected] of [["PendingVisit", ["edit", "cancel", "duplicate"]], ["InProgress", ["duplicate"]], ["Completed", ["viewReport", "duplicate"]], ["AccessFailed", ["viewReport", "duplicate"]], ["Cancelled", ["duplicate"]]]) {
    assert.deepEqual(actions({ role: "manager", task: { status } }), expected);
  }
  const own = { status: "PendingVisit", taskSource: { sourceTypeCode: "MANUAL" }, assignment: { assignedInspectors: [{ inspectorId: "self" }] } };
  assert.deepEqual(actions({ role: "inspector", task: own, currentInspectorId: "self" }), ["startVisit", "duplicate", "edit", "cancel"]);
  assert.deepEqual(actions({ role: "inspector", task: own, currentInspectorId: "other" }), ["startVisit", "duplicate"]);
});
