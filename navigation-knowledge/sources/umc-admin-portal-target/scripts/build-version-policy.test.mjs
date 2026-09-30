import assert from "node:assert/strict";
import test from "node:test";

import {
  hasBuildVersionChanged,
  normalizeBuildVersion,
  shouldStartBuildVersionCheck,
} from "../src/utils/buildVersionPolicy.js";

test("does not report an update when build ids match", () => {
  const currentVersion = normalizeBuildVersion({ buildId: "abc123" });
  const latestVersion = normalizeBuildVersion({ buildId: "abc123" });

  assert.equal(hasBuildVersionChanged(currentVersion, latestVersion), false);
});

test("reports an update when build ids differ", () => {
  const currentVersion = normalizeBuildVersion({ buildId: "abc123" });
  const latestVersion = normalizeBuildVersion({ buildId: "def456" });

  assert.equal(hasBuildVersionChanged(currentVersion, latestVersion), true);
});

test("ignores failed or malformed version responses", () => {
  const currentVersion = normalizeBuildVersion({ buildId: "abc123" });
  const latestVersion = normalizeBuildVersion(null);

  assert.equal(latestVersion, null);
  assert.equal(hasBuildVersionChanged(currentVersion, latestVersion), false);
});

test("normalization accepts optional build metadata", () => {
  assert.deepEqual(
    normalizeBuildVersion({
      buildId: "abc123",
      buildTime: "2026-08-07T00:00:00.000Z",
      packageVersion: "1.2.3",
    }),
    {
      buildId: "abc123",
      buildTime: "2026-08-07T00:00:00.000Z",
      packageVersion: "1.2.3",
    },
  );
});

test("active version checks are blocked only while a request is in flight", () => {
  assert.equal(shouldStartBuildVersionCheck(false), true);
  assert.equal(shouldStartBuildVersionCheck(true), false);
});
