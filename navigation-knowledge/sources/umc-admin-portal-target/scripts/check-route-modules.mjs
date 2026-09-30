import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSourcePath = resolve("src/routes/index.tsx");
const routeSource = readFileSync(routeSourcePath, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
const pageNames = [
  ...routeSource.matchAll(/\bpage:\s*"([A-Za-z0-9_-]+)"/g),
].map((match) => match[1]);
const routePaths = [
  ...routeSource.matchAll(/\bpath:\s*"([^"]+)"/g),
].map((match) => match[1]);
const pageDirectories = new Set(
  readdirSync(resolve("src/pages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);
const missingPages = [...new Set(pageNames)].filter(
  (page) => !pageDirectories.has(page),
);
const normalizedPathOwners = new Map();

for (const path of routePaths) {
  const normalizedPath = (path.replace(/\/+$/, "") || "/").toLowerCase();
  const owners = normalizedPathOwners.get(normalizedPath) || [];
  owners.push(path);
  normalizedPathOwners.set(normalizedPath, owners);
}

const duplicatePaths = [...normalizedPathOwners.values()].filter(
  (paths) => paths.length > 1,
);

if (missingPages.length) {
  console.error(`Route page modules not found: ${missingPages.join(", ")}`);
  process.exit(1);
}

if (duplicatePaths.length) {
  console.error(
    `Duplicate route paths found: ${duplicatePaths
      .map((paths) => paths.join(" / "))
      .join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `Verified ${pageNames.length} route page mappings and ${routePaths.length} unique paths.`,
);
