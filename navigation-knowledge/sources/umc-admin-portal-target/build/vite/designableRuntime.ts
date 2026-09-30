import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { PluginOption } from "vite";

const require = createRequire(import.meta.url);

const designableRuntimeAssetsRequestBase = "/assets/vendor/npm";
const designableRuntimeAssetsOutputBase = "assets/vendor/npm";
const monacoRuntimeAssetPath = "monaco-editor/min/vs";

export const designableReactSettingsFormAliasPath =
  "src/components/designable/playground/localReactSettingsForm.ts";

interface DesignableRuntimeAsset {
  requestPath: string;
  outputPath: string;
  sourcePath: string;
}

function normalizeAssetPath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function collectFiles(sourceDir: string, outputDir: string): DesignableRuntimeAsset[] {
  return readdirSync(sourceDir).flatMap((entry) => {
    const sourcePath = join(sourceDir, entry);
    const stat = statSync(sourcePath);

    if (stat.isDirectory()) {
      return collectFiles(sourcePath, join(outputDir, entry));
    }

    const outputPath = normalizeAssetPath(join(outputDir, entry));

    return [
      {
        requestPath: `${designableRuntimeAssetsRequestBase}/${outputPath}`,
        outputPath,
        sourcePath,
      },
    ];
  });
}

function getDesignableRuntimeAssets(): DesignableRuntimeAsset[] {
  const monacoVsDir = resolve(require.resolve("monaco-editor/min/vs/loader.js"), "..");
  const formilyCoreTypesPath = require.resolve(
    "@formily/core/dist/formily.core.all.d.ts",
  );
  const prettierStandalonePath = require.resolve("prettier/esm/standalone.mjs");

  return [
    {
      requestPath: `${designableRuntimeAssetsRequestBase}/@formily/core/dist/formily.core.all.d.ts`,
      outputPath: "@formily/core/dist/formily.core.all.d.ts",
      sourcePath: formilyCoreTypesPath,
    },
    {
      requestPath: `${designableRuntimeAssetsRequestBase}/prettier@2.x/esm/standalone.mjs`,
      outputPath: "prettier@2.x/esm/standalone.mjs",
      sourcePath: prettierStandalonePath,
    },
    ...collectFiles(monacoVsDir, monacoRuntimeAssetPath),
  ];
}

function getContentType(filePath: string) {
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
    return "application/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".d.ts")) {
    return "text/plain; charset=utf-8";
  }

  if (filePath.endsWith(".ttf")) {
    return "font/ttf";
  }

  return "application/octet-stream";
}

export function designableRuntimeAssetsPlugin(): PluginOption {
  const assets = getDesignableRuntimeAssets();

  return {
    name: "umc-designable-runtime-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = decodeURI(req.url?.split("?")[0] ?? "");

        if (!requestPath.startsWith(designableRuntimeAssetsRequestBase)) {
          next();
          return;
        }

        const asset = assets.find((item) => item.requestPath === requestPath);

        if (!asset) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", getContentType(asset.sourcePath));
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(asset.sourcePath));
      });
    },
    generateBundle() {
      assets.forEach((asset) => {
        this.emitFile({
          type: "asset",
          fileName: normalizeAssetPath(
            join(designableRuntimeAssetsOutputBase, asset.outputPath),
          ),
          source: readFileSync(asset.sourcePath),
        });
      });
    },
  };
}

function replaceDesignableRegistryDefault(code: string) {
  return code.replace(
    /(['"])\/\/cdn\.jsdelivr\.net\/npm\1/g,
    `$1${designableRuntimeAssetsRequestBase}$1`,
  ).replace(
    /\/monaco-editor@[^/]+\/min\/vs/g,
    `/${monacoRuntimeAssetPath}`,
  );
}

function replaceMonacoLoaderDefault(code: string) {
  const localMonacoPath =
    `${designableRuntimeAssetsRequestBase}/${monacoRuntimeAssetPath}`;

  return code.replace(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/monaco-editor@[^'"]+\/min\/vs/g,
    localMonacoPath,
  );
}

export function designableRuntimeLocalDefaultsPlugin(): PluginOption {
  return {
    name: "umc-designable-runtime-local-defaults",
    enforce: "pre",
    transform(code, id) {
      const filePath = normalizeAssetPath(id.split("?")[0]);

      let nextCode = code;

      if (
        filePath.endsWith("/@designable/react-settings-form/esm/registry.js")
      ) {
        nextCode = replaceDesignableRegistryDefault(nextCode);
      }

      if (filePath.endsWith("/@monaco-editor/loader/lib/es/config/index.js")) {
        nextCode = replaceMonacoLoaderDefault(nextCode);
      }

      return nextCode === code ? null : { code: nextCode, map: null };
    },
  };
}
