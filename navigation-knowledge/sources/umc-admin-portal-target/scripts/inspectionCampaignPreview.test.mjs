import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const file = new URL("../src/pages/InspectionCommon/inspectionCampaignPreview.ts", import.meta.url);
const { code } = await transformWithEsbuild(await readFile(file, "utf8"), file.pathname, { loader: "ts", format: "esm" });
const { getCampaignPreviewDecision } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const preview = (matched, recent) => ({ matchedEstablishmentCount: matched, willCreateCount: matched, recentInspectionTaskCount: recent });

test("uses recent task counts independently of open establishments", () => {
  assert.equal(getCampaignPreviewDecision(preview(0, 0)), "empty");
  assert.equal(getCampaignPreviewDecision(preview(13, 0)), "create");
  assert.equal(getCampaignPreviewDecision(preview(13, 13)), "confirm");
  assert.equal(getCampaignPreviewDecision(preview(38, 47)), "confirm");
  assert.equal(getCampaignPreviewDecision({ ...preview(13, 0), openTaskEstablishmentCount: 13 }), "create");
  assert.equal(getCampaignPreviewDecision({ ...preview(13, 2), openTaskEstablishmentCount: 0 }), "confirm");
  assert.equal(getCampaignPreviewDecision({ ...preview(13, 2), skippedExistingTaskCount: 99 }), "confirm");
});

test("rejects missing, invalid or inconsistent counts instead of bypassing confirmation", () => {
  for (const value of [null, undefined, {}, { matchedEstablishmentCount: 13, willCreateCount: 13, openTaskEstablishmentCount: 0 }, preview(-1, 0), preview(2, -1), preview(1.5, 0), preview(Infinity, 0), preview(1, NaN), preview(1, null), preview(1, 1.5), { ...preview(13, 2), willCreateCount: 11 }, { ...preview(13, 2), recentInspectionTaskCount: "2" }]) {
    assert.throws(() => getCampaignPreviewDecision(value));
  }
});

test("keeps Commercial Entity filtering on both scope requests and the batch payload", async () => {
  const modal = await readFile(new URL("../src/pages/InspectionTaskManagement/components/CreateTaskModal.tsx", import.meta.url), "utf8");
  const scopeCalls = [...modal.matchAll(/getInspectionCampaignFilterOptions\(\{([\s\S]*?)\}\)/g)];
  assert.equal(scopeCalls.length, 2);
  for (const call of scopeCalls) assert.match(call[1], /establishmentTypeId: 2/);
  const payload = modal.match(/const campaignPayload: InspectionTaskBatchByActivityPayload = \{([\s\S]*?)\};/)[1];
  assert.match(payload, /establishmentTypeId: 2/);
  assert.match(payload, /targetTypeId: 1/);
  assert.match(modal, /message: t\('inspection.tasks.messages.duplicateWarningContent'\)/);
  assert.match(modal, /campaignExistingTasksContent/);
  assert.match(modal, /campaignCount: preview.recentInspectionTaskCount/);
  assert.doesNotMatch(modal, /preview.openTaskEstablishmentCount/);
  assert.doesNotMatch(modal, /\.skippedExistingTaskCount|\.skippedEstablishmentIds/);
});

test("freezes only Campaign fields while requesting or awaiting confirmation", async () => {
  const modal = await readFile(new URL("../src/pages/InspectionTaskManagement/components/CreateTaskModal.tsx", import.meta.url), "utf8");
  const expression = modal.match(/element\.inert = ([^;]+);/)?.[1];
  assert.ok(expression);
  const frozen = new Function("isCreateCampaign", "taskSubmitting", "duplicateTaskWarning", `return (${expression});`);
  assert.equal(frozen(true, false, {}), false);
  assert.equal(frozen(true, true, {}), true);
  assert.equal(frozen(true, false, { campaignCount: 13 }), true);
  assert.equal(frozen(false, true, {}), false);
  assert.equal(frozen(false, false, { visible: true }), false);
});
