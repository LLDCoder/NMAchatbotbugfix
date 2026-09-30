import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourcePath = new URL(
  "../src/utils/service302MaterialStatus.ts",
  import.meta.url,
);
const source = await readFile(sourcePath, "utf8");
const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64",
)}`;
const {
  createMaterialId,
  ensureService302MaterialIds,
  getService302MaterialStatusSummary,
  isService302NewspapersMagazinesMaterial,
  isService302MaterialStatusTaskReadOnly,
  isService302ReviewFormDataShapeValid,
  normalizeService302MaterialStatus,
} = await import(moduleUrl);

const createReviewData = (dataList) =>
  JSON.stringify([
    {
      formData: JSON.stringify({
        formValues: { dataList },
      }),
    },
  ]);

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("creates UUID v4 material identifiers", () => {
  assert.match(createMaterialId(), UUID_V4_PATTERN);
});

test("preserves existing material IDs and stably fills historical rows", () => {
  const generatedIds = new Map();
  const firstPass = ensureService302MaterialIds(
    [{ materialId: "existing-id", title: "Existing" }, { title: "Legacy" }],
    generatedIds,
  );
  const secondPass = ensureService302MaterialIds(
    [{ materialId: "existing-id", title: "Edited" }, { title: "Legacy" }],
    generatedIds,
  );

  assert.equal(firstPass[0].materialId, "existing-id");
  assert.equal(secondPass[0].materialId, "existing-id");
  assert.match(firstPass[1].materialId, UUID_V4_PATTERN);
  assert.equal(secondPass[1].materialId, firstPass[1].materialId);
});

test("recognizes newspapers and magazines by code, id, and legacy label", () => {
  assert.equal(
    isService302NewspapersMagazinesMaterial({ materialTypeCode: "MG" }),
    true,
  );
  assert.equal(
    isService302NewspapersMagazinesMaterial({ materialTypeId: 14 }),
    true,
  );
  assert.equal(
    isService302NewspapersMagazinesMaterial({
      material_type: "Newspapers & Magazines",
    }),
    true,
  );
  assert.equal(
    isService302NewspapersMagazinesMaterial({ materialTypeCode: "BR" }),
    false,
  );
});

test("treats both approved and rejected as assigned statuses", () => {
  assert.equal(normalizeService302MaterialStatus(1), 1);
  assert.equal(normalizeService302MaterialStatus(0), 0);
  assert.equal(normalizeService302MaterialStatus("1"), 1);
  assert.equal(normalizeService302MaterialStatus("0"), 0);
  assert.equal(normalizeService302MaterialStatus(null), undefined);

  const summary = getService302MaterialStatusSummary(
    createReviewData([
      { materialTypeCode: "MG", status: 1 },
      { materialTypeId: 14, status: 0 },
      { materialTypeCode: "BR" },
    ]),
  );

  assert.deepEqual(summary, {
    locatorKeys: ["step:0:material:0", "step:0:material:1"],
    assignedLocatorKeys: ["step:0:material:0", "step:0:material:1"],
    total: 2,
    assigned: 2,
    complete: true,
  });
});

test("blocks only when a newspapers and magazines row is missing status", () => {
  const incomplete = getService302MaterialStatusSummary(
    createReviewData([
      { materialTypeCode: "MG", status: 1 },
      { material_type: "Newspapers and Magazines" },
    ]),
  );
  assert.equal(incomplete.total, 2);
  assert.equal(incomplete.assigned, 1);
  assert.equal(incomplete.complete, false);

  const withoutTargetRows = getService302MaterialStatusSummary(
    createReviewData([{ materialTypeCode: "BR" }]),
  );
  assert.equal(withoutTargetRows.total, 0);
  assert.equal(withoutTargetRows.complete, true);
});

test("rejects malformed review form data shapes", () => {
  assert.equal(isService302ReviewFormDataShapeValid(createReviewData([])), true);
  assert.equal(isService302ReviewFormDataShapeValid("not-json"), false);
  assert.equal(isService302ReviewFormDataShapeValid(undefined), false);
  assert.equal(isService302ReviewFormDataShapeValid("null"), false);
});

test("treats completed and closed review tasks as read-only", () => {
  assert.equal(
    isService302MaterialStatusTaskReadOnly({ taskStatus: "Completed" }),
    true,
  );
  assert.equal(
    isService302MaterialStatusTaskReadOnly({ status: " closed " }),
    true,
  );
  assert.equal(
    isService302MaterialStatusTaskReadOnly({ taskStatus: "In Progress" }),
    false,
  );
});
