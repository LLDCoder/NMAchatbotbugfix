import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const loadDashboardReturnState = async () => {
  const source = await readFile(
    new URL("../src/pages/Dashboard/dashboardReturnState.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "dashboardReturnState.ts",
  }).outputText;

  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
};

const validReturnState = {
  version: 1,
  department: "customer",
  roleVariant: "manager",
  timeFilter: { preset: "last7", days: 7 },
  attention: {
    tabKey: "blocked",
    pageIndex: 2,
    pageSize: 20,
    sortBy: "sla",
    sortDirection: "desc",
  },
  scrollTop: 864,
};

test("reads a valid versioned Dashboard return state", async () => {
  const { readDashboardReturnState } = await loadDashboardReturnState();

  assert.deepEqual(
    readDashboardReturnState({ __dashboardReturn: validReturnState }),
    validReturnState,
  );
});

test("rejects malformed Dashboard return state instead of restoring it", async () => {
  const { readDashboardReturnState } = await loadDashboardReturnState();

  assert.equal(
    readDashboardReturnState({
      __dashboardReturn: {
        ...validReturnState,
        attention: { ...validReturnState.attention, pageIndex: 0 },
      },
    }),
    undefined,
  );
  assert.equal(
    readDashboardReturnState({
      __dashboardReturn: { ...validReturnState, version: 2 },
    }),
    undefined,
  );
});

test("adds Dashboard return state without discarding existing location state", async () => {
  const { withDashboardReturnState } = await loadDashboardReturnState();

  assert.deepEqual(
    withDashboardReturnState({ focusReply: true }, validReturnState),
    {
      focusReply: true,
      __dashboardReturn: validReturnState,
    },
  );
});

test("builds an explicit Dashboard return location", async () => {
  const { createDashboardReturnLocation } = await loadDashboardReturnState();

  assert.deepEqual(createDashboardReturnLocation(validReturnState), {
    pathname: "/dashboard",
    state: { __dashboardReturn: validReturnState },
  });
});

test("clamps a restored page to the latest real tab total", async () => {
  const { normalizeDashboardAttentionPageIndex } =
    await loadDashboardReturnState();

  assert.equal(normalizeDashboardAttentionPageIndex(9, 10, 22), 3);
  assert.equal(normalizeDashboardAttentionPageIndex(2, 10, 22), 2);
  assert.equal(normalizeDashboardAttentionPageIndex(4, 10, 0), 1);
});
