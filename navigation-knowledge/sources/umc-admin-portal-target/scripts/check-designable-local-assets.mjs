import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const distPath = resolve("dist");
const localRegistry = "/assets/vendor/npm";
const designableSourcePaths = [
  resolve("src/components/designable/playground"),
  resolve("src/components/designable/package.json"),
];
const textFileExtensions = new Set([
  ".css",
  ".ejs",
  ".html",
  ".js",
  ".json",
  ".less",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
]);

const requiredFiles = [
  "assets/vendor/npm/@formily/core/dist/formily.core.all.d.ts",
  "assets/vendor/npm/monaco-editor/min/vs/loader.js",
  "assets/vendor/npm/prettier@2.x/esm/standalone.mjs",
];

const missingFiles = requiredFiles.filter(
  (filePath) => !existsSync(join(distPath, filePath)),
);

if (missingFiles.length > 0) {
  console.error("Missing designable local runtime assets:");
  missingFiles.forEach((filePath) => console.error(`- ${filePath}`));
  process.exit(1);
}

function isTextFile(filePath) {
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();

  return textFileExtensions.has(extension);
}

function collectTextFiles(filePath) {
  const stat = statSync(filePath);

  if (!stat.isDirectory()) {
    return isTextFile(filePath) ? [filePath] : [];
  }

  return readdirSync(filePath).flatMap((entry) =>
    collectTextFiles(join(filePath, entry)),
  );
}

const textFiles = collectTextFiles(distPath);
const jsFiles = textFiles.filter((filePath) => filePath.endsWith(".js"));

const bundleUsesLocalRegistry = jsFiles.some((filePath) =>
  readFileSync(filePath, "utf8").includes(localRegistry),
);

if (!bundleUsesLocalRegistry) {
  console.error(`Bundle does not configure designable registry to ${localRegistry}`);
  process.exit(1);
}

const forbiddenRuntimeFragments = [
  "cdn.jsdelivr.net",
  "unpkg.com",
  "mocky.io",
  "monaco-editor@0.30.1",
];
const forbiddenHits = textFiles.flatMap((filePath) => {
  const content = readFileSync(filePath, "utf8");

  return forbiddenRuntimeFragments
    .filter((fragment) => content.includes(fragment))
    .map((fragment) => `${filePath}: ${fragment}`);
});

if (forbiddenHits.length > 0) {
  console.error("Bundle still contains forbidden external runtime hosts:");
  forbiddenHits.forEach((hit) => console.error(`- ${hit}`));
  process.exit(1);
}

const designableSourceFiles = designableSourcePaths
  .filter((filePath) => existsSync(filePath))
  .flatMap((filePath) => collectTextFiles(filePath));
const forbiddenSourceHits = designableSourceFiles.flatMap((filePath) => {
  const content = readFileSync(filePath, "utf8");

  return forbiddenRuntimeFragments
    .filter((fragment) => content.includes(fragment))
    .map((fragment) => `${filePath}: ${fragment}`);
});

if (forbiddenSourceHits.length > 0) {
  console.error("Designable source still contains forbidden external runtime hosts:");
  forbiddenSourceHits.forEach((hit) => console.error(`- ${hit}`));
  process.exit(1);
}

console.log("Designable local runtime assets are available.");
