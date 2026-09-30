import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const sourceUrl = new URL(
  "../src/services/licenseDashboard.ts",
  import.meta.url
);
const source = await readFile(sourceUrl, "utf8");

const mappingStart = source.indexOf(
  "const licenseAttentionSourceTypeByValue"
);
const mappingEnd = source.indexOf("const getAttentionLabelKey", mappingStart);
const normalizerStart = source.indexOf(
  "const getLicenseAttentionSourceType"
);
const normalizerEnd = source.indexOf(
  "const getLicenseUrgentTaskSource",
  normalizerStart
);

assert.notEqual(mappingStart, -1, "License attention source mapping not found");
assert.notEqual(mappingEnd, -1, "License attention source mapping end not found");
assert.notEqual(normalizerStart, -1, "License attention source normalizer not found");
assert.notEqual(
  normalizerEnd,
  -1,
  "License attention source normalizer end not found"
);

const testSource = `
type LicenseAttentionSourceType =
  | "application"
  | "enquiry"
  | "refund"
  | "appeal";
const optionalString = (value?: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
};
${source.slice(mappingStart, mappingEnd)}
${source
  .slice(normalizerStart, normalizerEnd)
  .replace(
    "const getLicenseAttentionSourceType",
    "export const getLicenseAttentionSourceType"
  )}
`;
const { code } = await transformWithEsbuild(testSource, sourceUrl.pathname, {
  loader: "ts",
  format: "esm",
  target: "node20",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
  "base64"
)}`;
const { getLicenseAttentionSourceType } = await import(moduleUrl);

test("recognizes the application source type returned by licensing attention tasks", () => {
  assert.equal(getLicenseAttentionSourceType("application"), "application");
});
