import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const tempDirectory = mkdtempSync(
  join(tmpdir(), "inspection-overview-identity-tests-"),
);
const bundlePath = join(tempDirectory, "inspectionOverviewIdentity.test.mjs");
const esbuildPath = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "esbuild.cmd" : "esbuild",
);

try {
  execFileSync(
    esbuildPath,
    [
      "scripts/inspectionOverviewIdentity.test.ts",
      "--bundle",
      "--platform=node",
      "--format=esm",
      `--outfile=${bundlePath}`,
    ],
    { stdio: "inherit" },
  );

  const result = spawnSync(process.execPath, ["--test", bundlePath], {
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
