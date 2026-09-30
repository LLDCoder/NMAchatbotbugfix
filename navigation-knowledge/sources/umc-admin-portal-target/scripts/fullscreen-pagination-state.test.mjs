import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const sourcePath = resolve(
  "src/components/common/ApplicationOverviewCards/FullScreen/paginationState.ts",
);
const bundlePath = join(tmpdir(), "fullscreen-pagination-state.cjs");
const esbuildPath = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "esbuild.cmd" : "esbuild",
);

const loadPaginationState = () => {
  execFileSync(
    esbuildPath,
    [
      sourcePath,
      "--bundle",
      "--platform=node",
      "--format=cjs",
      `--outfile=${bundlePath}`,
    ],
    { stdio: "inherit" },
  );
  delete require.cache[bundlePath];
  return require(bundlePath);
};

test("external page changes preserve the last known server total", () => {
  const { syncPaginationRequestState } = loadPaginationState();
  const current = {
    pageIndex: 1,
    pageSize: 10,
    total: 249,
    sortBy: "lastUpdatedTime",
    sortDirection: 1,
  };
  const external = {
    pageIndex: 24,
    pageSize: 10,
    total: 0,
    sortBy: "lastUpdatedTime",
    sortDirection: 1,
  };

  assert.deepEqual(syncPaginationRequestState(current, external), {
    pageIndex: 24,
    pageSize: 10,
    total: 249,
    sortBy: "lastUpdatedTime",
    sortDirection: 1,
  });
});

test.after(() => {
  rmSync(bundlePath, { force: true });
});
