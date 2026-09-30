import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const cacheDirectory = resolve("node_modules/.cache");
mkdirSync(cacheDirectory, { recursive: true });
const tempDirectory = mkdtempSync(join(cacheDirectory, "dsh-error-tests-"));
const bundlePath = join(tempDirectory, "dshErrorStates.test.mjs");
const esbuildPath = resolve("node_modules/.bin/esbuild");

try {
  execFileSync(esbuildPath, [
    "scripts/dshErrorStates.test.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--alias:@=./src",
    `--outfile=${bundlePath}`,
  ], { stdio: "inherit" });

  const result = spawnSync(process.execPath, ["--test", bundlePath], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
