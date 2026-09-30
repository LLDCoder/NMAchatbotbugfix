import assert from "node:assert/strict";
import test from "node:test";
import { loadProgressiveDetail } from "../src/pages/InspectionViolationDetails/progressiveDetail.ts";

test("publishes the core violation detail before optional data finishes loading", async () => {
  let resolveOptionalData:
    | ((value: { targetOverview: { targetName: string } }) => void)
    | undefined;
  const optionalData = new Promise<{ targetOverview: { targetName: string } }>(
    (resolve) => {
      resolveOptionalData = resolve;
    },
  );
  let resolveEnhanced:
    | (() => void)
    | undefined;
  const enhancedPublished = new Promise<void>((resolve) => {
    resolveEnhanced = resolve;
  });
  const published: Array<Record<string, unknown> | null> = [];

  const loading = loadProgressiveDetail({
    loadCore: async () => ({ id: 140, violationNo: "VN-2026-1143220" }),
    loadOptional: async () => optionalData,
    publishCore: (detail) => {
      published.push(detail);
    },
    publishOptional: (optional) => {
      published.push({
        ...published[published.length - 1],
        ...optional,
      });
      resolveEnhanced?.();
    },
  });

  await loading;

  assert.deepEqual(published, [
    { id: 140, violationNo: "VN-2026-1143220" },
  ]);

  resolveOptionalData?.({
    targetOverview: { targetName: "Test Establishment" },
  });
  await enhancedPublished;

  assert.deepEqual(published, [
    { id: 140, violationNo: "VN-2026-1143220" },
    {
      id: 140,
      violationNo: "VN-2026-1143220",
      targetOverview: { targetName: "Test Establishment" },
    },
  ]);
});

test("keeps the core violation detail visible when optional data fails", async () => {
  const core = { id: 140, violationNo: "VN-2026-1143220" };
  const published: Array<Record<string, unknown> | null> = [];

  const result = await loadProgressiveDetail({
    loadCore: async () => core,
    loadOptional: async () => {
      throw new Error("Target overview unavailable");
    },
    publishCore: (detail) => published.push(detail),
    publishOptional: (optional) => {
      published.push(optional);
    },
  });

  assert.deepEqual(published, [core]);
  assert.deepEqual(result, core);
});
