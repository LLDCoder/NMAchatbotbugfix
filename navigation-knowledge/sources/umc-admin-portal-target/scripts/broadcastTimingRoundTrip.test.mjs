import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const require = createRequire(import.meta.url);

const compileCommonJs = async (filePath, loader) => {
  const source = await readFile(filePath, "utf8");
  const { code } = await transformWithEsbuild(source, filePath, {
    loader,
    format: "cjs",
    target: "node20",
  });
  return code;
};

const executeCommonJs = (code, loadModule) => {
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(loadModule, module, module.exports);
  return module.exports;
};

const gstTimePath = fileURLToPath(new URL("../src/utils/gstTime.ts", import.meta.url));
const gstTime = executeCommonJs(await compileCommonJs(gstTimePath, "ts"), require);

const timingPath = fileURLToPath(new URL("../src/pages/BroadcastEdit/timing.ts", import.meta.url));
const timing = executeCommonJs(
  await compileCommonJs(timingPath, "ts"),
  (moduleName) => (moduleName === "@/utils/gstTime" ? gstTime : require(moduleName)),
);

test("preserves a non-Dubai picker time through the broadcast API round trip", () => {
  const selected = require("moment").parseZone("2026-08-03T18:00:00+08:00");
  const apiValue = timing.toBroadcastApiTime(selected);
  const reloaded = timing.fromBroadcastApiTime(apiValue);

  assert.equal(apiValue, "2026-08-03T18:00:00");
  assert.equal(reloaded?.format(gstTime.API_FMT), "2026-08-03T18:00:00");
});

test("converts legacy offset responses to Dubai picker fields", () => {
  const reloaded = timing.fromBroadcastApiTime("2026-08-03T14:00:00Z");

  assert.equal(reloaded?.format(gstTime.API_FMT), "2026-08-03T18:00:00");
  assert.equal(timing.toBroadcastApiTime(reloaded), "2026-08-03T18:00:00");
});

test("uses the same Dubai wall-clock conversion for scheduled ranges and expiry validation", () => {
  const start = require("moment").parseZone("2026-08-03T09:00:00+08:00");
  const end = require("moment").parseZone("2026-08-03T18:00:00+08:00");
  const futurePickerValue = timing.fromBroadcastApiTime(
    gstTime.toApi(gstTime.nowGst().add(2, "minute")),
  );
  const expiredPickerValue = timing.fromBroadcastApiTime(
    gstTime.toApi(gstTime.nowGst().subtract(2, "minute")),
  );

  assert.equal(timing.toBroadcastApiTime(start), "2026-08-03T09:00:00");
  assert.equal(timing.toBroadcastApiTime(end), "2026-08-03T18:00:00");
  assert.equal(timing.isAfterMinimumExpiryTime(futurePickerValue), true);
  assert.equal(timing.isAfterMinimumExpiryTime(expiredPickerValue), false);
});
