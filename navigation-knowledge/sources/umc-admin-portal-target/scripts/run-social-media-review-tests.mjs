import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outputDirectory = mkdtempSync(join(tmpdir(), "social-media-review-tests-"));
const outputFile = join(outputDirectory, "socialMediaReview.test.mjs");

execFileSync(
  join(process.cwd(), "node_modules/.bin/esbuild"),
  [
    "scripts/socialMediaReview.test.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${outputFile}`,
  ],
  { stdio: "inherit" },
);

execFileSync(process.execPath, ["--test", outputFile], { stdio: "inherit" });
