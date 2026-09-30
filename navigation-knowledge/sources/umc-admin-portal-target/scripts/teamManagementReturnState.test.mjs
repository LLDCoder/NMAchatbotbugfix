import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const loadReturnStateModule = async () => {
  const source = await readFile(
    new URL(
      "../src/pages/TeamManagement/teamManagementReturnState.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "teamManagementReturnState.ts",
  }).outputText;

  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
};

test("restores Team Management breadcrumbs through the recorded history entry", async () => {
  const {
    TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY,
    resolveTeamManagementBreadcrumbNavigation,
  } = await loadReturnStateModule();
  const returnLocation =
    "/inspection/tasks?tab=teamTasks&teamTab=todo&teamTaskSource=other";

  assert.deepEqual(
    resolveTeamManagementBreadcrumbNavigation(
      "team-management-list",
      "/inspection/tasks",
      { [TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY]: returnLocation },
    ),
    {
      path: returnLocation,
      restoreHistory: true,
    },
  );
});

test("uses the breadcrumb fallback for direct Team Management detail entries", async () => {
  const { resolveTeamManagementBreadcrumbNavigation } =
    await loadReturnStateModule();

  assert.deepEqual(
    resolveTeamManagementBreadcrumbNavigation(
      "team-management-list",
      "/inspection/tasks",
      undefined,
    ),
    {
      path: "/inspection/tasks",
      restoreHistory: false,
    },
  );
});

test("does not alter unrelated breadcrumb navigation", async () => {
  const {
    TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY,
    resolveTeamManagementBreadcrumbNavigation,
  } = await loadReturnStateModule();

  assert.deepEqual(
    resolveTeamManagementBreadcrumbNavigation(
      "finance-transactions",
      "/financial-payment/transactions",
      {
        [TEAM_MANAGEMENT_RETURN_LOCATION_STATE_KEY]:
          "/inspection/tasks?tab=teamTasks",
      },
    ),
    {
      path: "/financial-payment/transactions",
      restoreHistory: false,
    },
  );
});
