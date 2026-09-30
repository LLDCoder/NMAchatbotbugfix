import { existsSync } from "node:fs";
import { platform } from "node:os";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const distPath = resolve("dist");

if (!existsSync(distPath)) {
  console.error("dist directory not found. Run the build step first.");
  process.exit(1);
}

if (platform() === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      [
        "if (Test-Path 'dist.zip') { Remove-Item 'dist.zip' -Force }",
        "Compress-Archive -Path 'dist\\*' -DestinationPath 'dist.zip' -Force",
      ].join("; "),
    ],
    { stdio: "inherit" },
  );
  console.log("Created dist.zip");
} else {
  execFileSync("tar", ["-czf", "dist.tar.gz", "dist"], { stdio: "inherit" });
  console.log("Created dist.tar.gz");
}
