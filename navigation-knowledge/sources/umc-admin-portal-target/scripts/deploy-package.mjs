import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const archivePath = existsSync("dist.zip")
  ? "dist.zip"
  : existsSync("dist.tar.gz")
    ? "dist.tar.gz"
    : "";

if (!archivePath) {
  console.error("No deploy archive found. Run package:dist first.");
  process.exit(1);
}

execFileSync("node", ["scripts/deploy-bt-panel.mjs", archivePath], {
  stdio: "inherit",
});
