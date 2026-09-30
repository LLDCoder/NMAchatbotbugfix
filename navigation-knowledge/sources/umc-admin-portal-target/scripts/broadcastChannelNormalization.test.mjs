import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourceUrl = new URL("../src/pages/BroadcastEdit/index.tsx", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const normalizationStart = source.indexOf("const firstNonEmpty");
const normalizationEnd = source.indexOf("const BroadcastEdit");

assert.notEqual(normalizationStart, -1, "Broadcast channel normalization start not found");
assert.notEqual(normalizationEnd, -1, "Broadcast channel normalization end not found");

const normalizationSource = `${source.slice(normalizationStart, normalizationEnd)}\nexport { normalizeChannels, getSmsTemplateName };`;
const { code } = await transformWithEsbuild(normalizationSource, sourceUrl.pathname, {
  loader: "tsx",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const { normalizeChannels, getSmsTemplateName } = await import(moduleUrl);

test("keeps broadcast content isolated to the channel fields returned by the API", () => {
  const channels = normalizeChannels({
    channels: "1",
    emailSubjectEn: "Email title",
    emailSubjectAr: "Arabic email title",
    emailBodyEn: "<p>Email body</p>",
    emailBodyAr: "<p>Arabic email body</p>",
    smsTitleEn: "Legacy SMS title",
    smsTitleAr: "Legacy SMS Arabic title",
    smsen: "",
    smsar: "",
    inAppTitleEn: "",
    inAppTitleAr: "",
    inAppMessageEn: "",
    inAppMessageAr: "",
  });

  assert.equal(channels.emailSubjectEn, "Email title");
  assert.equal(channels.emailBodyEn, "<p>Email body</p>");
  assert.equal("smsTitleEn" in channels, false);
  assert.equal("smsTitleAr" in channels, false);
  assert.equal(channels.smsBodyEn, "");
  assert.equal(channels.smsBodyAr, "");
  assert.equal(channels.inAppTitleEn, "");
  assert.equal(channels.inAppTitleAr, "");
  assert.equal(channels.inAppMessageEn, "");
  assert.equal(channels.inAppMessageAr, "");
});

test("uses SMS body text as the fallback template name", () => {
  assert.equal(getSmsTemplateName("<p>English SMS body</p>"), "English SMS body");
  assert.equal(getSmsTemplateName("", "<p>Arabic SMS body</p>"), "Arabic SMS body");
  assert.equal(getSmsTemplateName(`<p>${"x".repeat(240)}</p>`).length, 200);
});

test("detects legacy SMS records without copying title fields into the form", () => {
  const channels = normalizeChannels({
    channels: "",
    smsTitleEn: "Legacy SMS title",
    smsTitleAr: "Legacy SMS Arabic title",
    smsen: "",
    smsar: "",
  });

  assert.equal(channels.sms, true);
  assert.equal("smsTitleEn" in channels, false);
  assert.equal("smsTitleAr" in channels, false);
});
