import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourceUrl = new URL(
  "../src/pages/CustomerDetails/components/allProfilesOverviewTabs/applicationFilterOptions.ts",
  import.meta.url
);
const source = await readFile(sourceUrl, "utf8");
const { code } = await transformWithEsbuild(source, sourceUrl.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64"
)}`;
const { buildApplicationStatusOptions } = await import(moduleUrl);

const statuses = [
  {
    id: 10,
    code: "IN_PROGRESS",
    nameEn: "In Progress",
    nameAr: "in-progress-ar",
    isShown: true,
  },
  {
    id: 11,
    code: "COMPLETED",
    nameEn: "Completed",
    nameAr: "completed-ar",
    isShown: true,
  },
  {
    id: 100,
    code: "100",
    nameEn: "Hidden",
    nameAr: "hidden-ar",
    isShown: true,
  },
];

test("uses application status codes as select values", () => {
  assert.deepEqual(buildApplicationStatusOptions(statuses, false, "All"), [
    { label: "All", value: "" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Completed", value: "COMPLETED" },
  ]);
});

test("keeps status codes stable when displaying Arabic labels", () => {
  assert.deepEqual(buildApplicationStatusOptions(statuses, true, "All"), [
    { label: "All", value: "" },
    { label: "in-progress-ar", value: "IN_PROGRESS" },
    { label: "completed-ar", value: "COMPLETED" },
  ]);
});
