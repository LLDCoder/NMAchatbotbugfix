import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const loadTypeScriptModule = async (relativePath) => {
  const sourcePath = new URL(relativePath, import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
    loader: "ts",
    format: "esm",
    target: "node20",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
    "base64",
  )}`;
  return import(moduleUrl);
};

const selection = await loadTypeScriptModule(
  "../src/pages/InspectionCommon/inspectionAreaSelection.ts",
);

const emirates = [
  { id: 1, nameEn: "Abu Dhabi", requiresRegion: true },
  { id: 2, nameEn: "Dubai", requiresRegion: false },
];
const regions = [
  { id: 10, emirateId: 1, nameEn: "Al Ain" },
  { id: 11, emirateId: 1, nameEn: "Al Dhafra" },
  { id: 20, emirateId: 2, nameEn: "Dubai" },
];
const areas = [
  { id: 100, emirateId: 1, regionId: 10, nameEn: "Al Ain City" },
  { id: 101, emirateId: 1, regionId: 11, nameEn: "Liwa" },
  { id: 200, emirateId: 2, regionId: 20, nameEn: "Business Bay" },
];

test("requires Region when a selected Emirate declares a Region level", () => {
  assert.equal(selection.requiresInspectionRegion(emirates, [1, 2]), true);
  assert.equal(selection.requiresInspectionRegion(emirates, [2]), false);
});

test("removes Region and Area values outside the selected parent scope", () => {
  assert.deepEqual(
    selection.pruneInspectionAreaSelection({
      emirateIds: [2],
      regionIds: [10, 11],
      areaIds: [100, 101, 200],
      emirates,
      regions,
      areas,
    }),
    { emirateIds: [2], regionIds: [], areaIds: [200] },
  );

  assert.deepEqual(
    selection.pruneInspectionAreaSelection({
      emirateIds: [1, 2],
      regionIds: [10, 20],
      areaIds: [100, 101, 200],
      emirates,
      regions,
      areas,
    }),
    { emirateIds: [1, 2], regionIds: [10], areaIds: [100, 200] },
  );
});

test("accepts empty optional Area and Activity selections", () => {
  assert.equal(
    selection.isInspectionCampaignSelectionValid({
      emirates,
      emirateIds: [2],
      regionIds: [],
      areaIds: [],
      activityIds: [],
    }),
    true,
  );
});

test("builds a Campaign location payload without Authority fields", () => {
  const payload = selection.buildInspectionCampaignLocationPayload({
    emirateIds: [1, 2],
    regionIds: [10],
    areaIds: [],
    activityIds: [],
  });

  assert.deepEqual(payload, {
    emirateIds: [1, 2],
    regionIds: [10],
    areaIds: [],
    activityIds: [],
  });
  assert.equal("authorityId" in payload, false);
  assert.equal("authorityIds" in payload, false);
});

test("adds technical Regions for non-required Emirates in mixed Campaigns", () => {
  assert.deepEqual(selection.buildInspectionCampaignRegionIds({
    emirates,
    regions,
    emirateIds: [1, 2],
    regionIds: [10],
  }), [10, 20]);
  assert.deepEqual(selection.buildInspectionCampaignRegionIds({
    emirates,
    regions,
    emirateIds: [2],
    regionIds: [],
  }), []);
});

test("builds leaf-level Assigned Area nodes without broadening the saved scope", () => {
  assert.deepEqual(selection.buildInspectionAssignedAreaNodes({
    emirates,
    regions,
    areas,
    emirateIds: [1, 2],
    regionIds: [10, 11],
    areaIds: [100, 200],
  }), [
    { emirateId: 1, regionId: 10, communityId: 100 },
    { emirateId: 1, regionId: 11 },
    { emirateId: 2, regionId: 20, communityId: 200 },
  ]);
});
