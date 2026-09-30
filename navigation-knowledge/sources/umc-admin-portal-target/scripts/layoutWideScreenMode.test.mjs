import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const configFilePath = "src/config/layoutWideScreenMode.ts";
const configSource = readFileSync(configFilePath, "utf8");
const envExpression = "import.meta.env.VITE_LAYOUT_WIDE_SCREEN_MODE";
const layoutSource = readFileSync("src/layout/index.tsx", "utf8");
const layoutCss = readFileSync("src/layout/index.css", "utf8");
const envFilePaths = [
  ".env.daypopdevelopment",
  ".env.daypopproduction",
];
const supportedModes = new Set(["centered", "legacy", "fluid"]);

function loadConfig(envValue) {
  assert.ok(
    configSource.includes(envExpression),
    `${configFilePath} must read ${envExpression}`,
  );

  const envLiteral =
    envValue === undefined ? "undefined" : JSON.stringify(envValue);
  const compiled = ts.transpileModule(
    configSource.replace(envExpression, envLiteral),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const testModule = { exports: {} };

  new Function("exports", "module", compiled)(
    testModule.exports,
    testModule,
  );

  return testModule.exports;
}

test("resolves centered, legacy, and fluid wide-screen modes", () => {
  const centered = loadConfig("centered");
  const legacy = loadConfig("legacy");
  const fluid = loadConfig("fluid");

  assert.equal(centered.layoutWideScreenMode, "centered");
  assert.equal(centered.isWideScreenCenteredMode, true);
  assert.equal(centered.isWideScreenFluidMode, false);

  assert.equal(legacy.layoutWideScreenMode, "legacy");
  assert.equal(legacy.isWideScreenCenteredMode, false);
  assert.equal(legacy.isWideScreenFluidMode, false);

  assert.equal(fluid.layoutWideScreenMode, "fluid");
  assert.equal(fluid.isWideScreenCenteredMode, false);
  assert.equal(fluid.isWideScreenFluidMode, true);
});

test("falls back to legacy for missing or invalid wide-screen modes", () => {
  assert.equal(loadConfig(undefined).layoutWideScreenMode, "legacy");
  assert.equal(loadConfig("invalid").layoutWideScreenMode, "legacy");
});

test("applies the fluid modifier and fluid layout variables", () => {
  assert.match(layoutSource, /isWideScreenFluidMode/);
  assert.match(layoutSource, /"layout layout--wide-screen-fluid"/);
  assert.match(
    layoutCss,
    /\.layout\.layout--wide-screen-fluid\s*\{[^}]*--layout-outer-gutter:\s*0px;[^}]*--layout-visual-content-width:\s*100%;[^}]*\}/s,
  );
});

test("documents fluid mode and uses supported values in every environment", () => {
  envFilePaths.forEach((envFilePath) => {
    const envSource = readFileSync(envFilePath, "utf8");
    const configuredMode = envSource.match(
      /^VITE_LAYOUT_WIDE_SCREEN_MODE=(.+)$/m,
    )?.[1];

    assert.match(envSource, /# - fluid:/);
    assert.ok(
      configuredMode && supportedModes.has(configuredMode),
      `${envFilePath} must use a supported wide-screen mode`,
    );
  });
});
