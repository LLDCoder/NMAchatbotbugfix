import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const source = await readFile(new URL("../src/pages/TeamManagement/components/InspectionTeamTasksPanel/hooks/useInspectionTeamTaskTableConfig.tsx", import.meta.url), "utf8");
const block = source.match(/const order = activeSorter\?\.order([\s\S]*?)\n\s*setViewState/);
assert.ok(block, "Production sort transition must be present");
const { code } = await transformWithEsbuild(`export default function(activeSorter, taskTab, createDefaultInspectionTeamTaskViewState) { const order = activeSorter?.order${block[1]}; return {sortBy: nextSortBy, sortDirection: nextSortDirection}; }`, "sort.ts", { loader: "ts", format: "esm" });
const { default: transition } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const constantsFile = new URL("../src/pages/TeamManagement/components/InspectionTeamTasksPanel/constants.ts", import.meta.url);
const constants = await transformWithEsbuild(await readFile(constantsFile, "utf8"), constantsFile.pathname, { loader: "ts", format: "esm" });
const { DEFAULT_INSPECTION_TEAM_TASK_VIEW_STATE: defaults } = await import(`data:text/javascript;base64,${Buffer.from(constants.code).toString("base64")}`);

test("sort cancellation restores both fields for each tab and allows sorting again", () => {
  for (const tab of ["todo", "completed"]) {
    const resolve = sorter => transition(sorter, tab, key => defaults[key]);
    for (const field of ["assignedTime", "priority", "sla"]) {
      assert.deepEqual(resolve({ columnKey: field, order: "ascend" }), { sortBy: field, sortDirection: 0 });
      assert.deepEqual(resolve({ columnKey: field, order: "descend" }), { sortBy: field, sortDirection: 1 });
      assert.deepEqual(resolve({ columnKey: field, order: undefined }), { sortBy: defaults[tab].sortBy, sortDirection: defaults[tab].sortDirection });
      assert.deepEqual(resolve({ columnKey: field, order: "ascend" }), { sortBy: field, sortDirection: 0 });
    }
  }
});
