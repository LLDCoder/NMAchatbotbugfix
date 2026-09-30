import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import type { ClientRequest, IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { viteMockServe } from "vite-plugin-mock";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { resolve } from "path";
import {
  designableReactSettingsFormAliasPath,
  designableRuntimeAssetsPlugin,
  designableRuntimeLocalDefaultsPlugin,
} from "./build/vite/designableRuntime";

const require = createRequire(import.meta.url);
const pdfWorkerRequestPath = "/assets/pdf.worker.min.js";
const pdfWorkerOutputPath = "assets/pdf.worker.min.js";
const dshAuditIdentityHeaders = [
  "authorization",
  "x-user-id",
  "x-tenant-id",
  "x-request-id",
] as const;
let pdfWorkerSourceCache: string | undefined;
const packageJson = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version?: string;
};
const buildTime = new Date().toJSON();
const buildVersion = {
  buildId: getBuildId(buildTime),
  buildTime,
  packageVersion: packageJson.version || "",
};

const vendorChunkRules: Array<[string, RegExp]> = [
  ["vendor-react", /\/node_modules\/(?:react|react-dom|scheduler)\//],
  [
    "vendor-router",
    /\/node_modules\/(?:react-router|react-router-dom|history|path-to-regexp|tiny-warning|tiny-invariant)\//,
  ],
  [
    "vendor-antd",
    /\/node_modules\/(?:antd|@ant-design|rc-[^/]+|@rc-component)\//,
  ],
  ["vendor-i18n", /\/node_modules\/(?:i18next|react-i18next)\//],
  ["vendor-http", /\/node_modules\/axios\//],
  [
    "vendor-state-dnd",
    /\/node_modules\/(?:zustand|redux|react-dnd|react-dnd-html5-backend|dnd-core|@react-dnd)\//,
  ],
  ["vendor-ui-runtime", /\/node_modules\/(?:@mantine|@emotion)\//],
  ["vendor-formily-designable", /\/node_modules\/(?:@formily|@designable)\//],
  ["vendor-echarts", /\/node_modules\/(?:echarts|echarts-for-react|zrender)\//],
  ["vendor-wangeditor", /\/node_modules\/@wangeditor\//],
  ["vendor-pdf", /\/node_modules\/pdfjs-dist\//],
  ["vendor-xlsx", /\/node_modules\/xlsx\//],
  ["vendor-moment", /\/node_modules\/moment\//],
  ["vendor-lodash", /\/node_modules\/lodash\//],
  ["vendor-signalr", /\/node_modules\/@microsoft\/signalr\//],
];

function manualChunks(id: string) {
  const normalizedId = id.replace(/\\/g, "/");

  if (normalizedId.includes("commonjsHelpers")) {
    return "vendor-runtime";
  }

  if (!id.includes("node_modules")) {
    return undefined;
  }

  const vendorRule = vendorChunkRules.find(([, rule]) =>
    rule.test(normalizedId),
  );

  return vendorRule?.[0];
}

function getPdfWorkerSource() {
  if (!pdfWorkerSourceCache) {
    const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
    pdfWorkerSourceCache = readFileSync(workerPath, "utf8").replace(
      /\n?\/\/# sourceMappingURL=.*(?:\r?\n)?$/u,
      "\n",
    );
  }

  return pdfWorkerSourceCache;
}

function pdfWorkerJsPlugin(): PluginOption {
  return {
    name: "umc-pdf-worker-js",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = req.url?.split("?")[0];

        if (requestPath !== pdfWorkerRequestPath) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(getPdfWorkerSource());
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: pdfWorkerOutputPath,
        source: getPdfWorkerSource(),
      });
    },
  };
}

function dshAuditEntryPlugin(enabled: boolean): PluginOption {
  return {
    name: "dsh-audit-entry",
    configureServer(server) {
      if (!enabled) return;

      server.middlewares.use((req, res, next) => {
        if (req.url !== "/dsh-audit") {
          next();
          return;
        }

        res.statusCode = 307;
        res.setHeader("Location", "/dsh-audit/");
        res.end();
      });
    },
  };
}

function forwardDshAuditIdentityHeaders(
  proxyRequest: ClientRequest,
  request: IncomingMessage,
) {
  for (const name of dshAuditIdentityHeaders) {
    const value = request.headers[name];
    if (typeof value === "string") proxyRequest.setHeader(name, value);
  }
}

function testEnvironmentPlugin(
  environment: string,
  agentApiTarget: string,
  umcApiTarget: string,
  auditAssetsDirectory: string,
): PluginOption {
  const auditAssets: Record<string, string> = {
    "index.html": "text/html; charset=utf-8",
    "audit-app.js": "application/javascript; charset=utf-8",
    "styles.css": "text/css; charset=utf-8",
    "audit-styles.css": "text/css; charset=utf-8",
    "favicon.svg": "image/svg+xml",
    "assets/logo.svg": "image/svg+xml",
    "assets/login-logo.png": "image/png",
    "assets/login-bg.png": "image/png",
  };
  return {
    name: "nma-test-environment",
    configureServer(server) {
      if (!environment) return;
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        // The debug UI uses the repaired local audit assets; its API and
        // session cookies still pass through to the configured remote service.
        if (auditAssetsDirectory && path?.startsWith("/dsh-audit/") &&
            !path.startsWith("/dsh-audit/api/") && path !== "/dsh-audit/healthz") {
          const asset = path.slice("/dsh-audit/".length) || "index.html";
          res.setHeader("Cache-Control", "no-store");
          if (!Object.hasOwn(auditAssets, asset)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          try {
            const contents = readFileSync(resolve(auditAssetsDirectory, asset));
            res.setHeader("Content-Type", auditAssets[asset]);
            res.end(contents);
          } catch {
            res.statusCode = 404;
            res.end();
          }
          return;
        }
        if (path === "/__env/meta.json") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify({ environment, agentApiTarget, umcApiTarget }));
          return;
        }
        if (path === "/__env" || path === "/__env/") {
          req.url = "/__env/index.html";
        }
        next();
      });
    },
  };
}

function getBuildId(fallbackBuildTime: string) {
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallbackBuildTime;
  }
}

function buildVersionPlugin(): PluginOption {
  return {
    name: "umc-build-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify(buildVersion, null, 2)}\n`,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const modeEnv = loadEnv(mode, process.cwd());
  const configuredPublicBase = String(
    modeEnv.VITE_PUBLIC_BASE_PATH ?? "/",
  )
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const publicBase = `/${configuredPublicBase.replace(/^\/+|\/+$/g, "")}/`.replace(
    /^\/\/$/,
    "/",
  );
  const configuredProxyTarget = String(
    modeEnv.VITE_API_PROXY_TARGET ?? "",
  )
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");
  const configuredProxyHost = String(modeEnv.VITE_API_PROXY_HOST ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  // const apiBaseUrl = String(modeEnv.VITE_API_BASE_URL ?? "")
  //   .trim()
  //   .replace(/^['"]|['"]$/g, "")
  //   .replace(/\/+$/, "");

  // Dev-server proxy defaults per mode. The proxy is serve-only, so this has no
  // effect on production builds; keeping the targets here (instead of in .env.*)
  // means the deployed env files carry only build-time config. An explicit
  // VITE_API_PROXY_TARGET / VITE_API_PROXY_HOST still overrides these defaults.
  const proxyDefaultsByMode: Record<string, { target: string; host: string }> = {
    daypopdevelopment: {
      target: "https://umc-adminportal.sol.daypop.ai",
      host: "",
    },
    "nma-staging": {
      target: "https://stg-eservices-admin.nma.gov.ae",
      host: "",
    },
  };
  const proxyDefaults = proxyDefaultsByMode[mode] ?? {
    target: "http://192.168.2.24:5000",
    host: "admin.umc.example.com",
  };
  const apiProxyTarget = configuredProxyTarget || proxyDefaults.target;
  const apiProxyHost =
    configuredProxyHost || (configuredProxyTarget ? "" : proxyDefaults.host);
  const createApiProxyConfig = (ws = false) => ({
    target: apiProxyTarget,
    changeOrigin: true,
    ...(ws ? { ws: true } : {}),
    ...(apiProxyHost ? { headers: { Host: apiProxyHost } } : {}),
  });
  const dshProxyTarget = String(modeEnv.VITE_DSH_PROXY_TARGET ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");
  const adminSwaggerProxyTarget = String(
    modeEnv.VITE_ADMIN_SWAGGER_PROXY_TARGET ?? "",
  )
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");
  const dshConsoleProxyTarget = String(
    modeEnv.VITE_DSH_CONSOLE_PROXY_TARGET ?? "",
  )
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");
  const devServerPort = Number(modeEnv.VITE_DEV_SERVER_PORT) || 5173;

  return {
    base: publicBase,
    cacheDir: modeEnv.VITE_CACHE_DIR || "node_modules/.vite",
    define: {
      __ADMIN_PORTAL_BUILD_VERSION__: JSON.stringify(buildVersion),
    },
    plugins: [
      // Must be registered before @vitejs/plugin-react (see code-inspector-plugin docs).
      ...(command === "serve"
        ? [
            codeInspectorPlugin({
              bundler: "vite",
              behavior: { locate: false, copy: false },
              hideConsole: true,
            }) as PluginOption,
          ]
        : []),
      react(),
      buildVersionPlugin(),
      pdfWorkerJsPlugin(),
      dshAuditEntryPlugin(Boolean(dshConsoleProxyTarget)),
      testEnvironmentPlugin(
        String(modeEnv.VITE_NMA_ENVIRONMENT ?? ""),
        dshProxyTarget,
        apiProxyTarget,
        String(modeEnv.VITE_NMA_AUDIT_ASSETS_DIR ?? ""),
      ),
      designableRuntimeLocalDefaultsPlugin(),
      designableRuntimeAssetsPlugin(),
      mode === "development" &&
        viteMockServe({
          mockPath: "src/mocks",
          ignore: /^_.*\.bundled_.*\.(mjs|cjs)$/,
          logger: false,
        }),
    ].filter(Boolean),
    server: {
      host: "0.0.0.0",
      port: devServerPort,
      proxy: {
        "/api": createApiProxyConfig(),
        "/chatHub": createApiProxyConfig(true),
        "/chathub": createApiProxyConfig(true),
        ...(dshProxyTarget
          ? {
              "/dsh-api": {
                target: dshProxyTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (path: string) => path.replace(/^\/dsh-api/, ""),
              },
            }
          : {}),
        ...(adminSwaggerProxyTarget
          ? {
              "/swagger": {
                target: adminSwaggerProxyTarget,
                changeOrigin: true,
              },
            }
          : {}),
        ...(dshConsoleProxyTarget
          ? {
              "/dsh-audit": {
                target: dshConsoleProxyTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (path: string) => path.replace(/^\/dsh-audit/, ""),
                configure: (proxy) => {
                  proxy.on("proxyReq", forwardDshAuditIdentityHeaders);
                  proxy.on("proxyReqWs", forwardDshAuditIdentityHeaders);
                },
              },
            }
          : {}),
      },
    },
    css: {
      preprocessorOptions: {
        less: {
          timeout: 30000,
          javascriptEnabled: true,
          modifyVars: {},
          alias: {
            "~antd": resolve(__dirname, "node_modules/antd"),
            "~": resolve(__dirname, "node_modules"),
          },
        },
      },
    },
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      alias: [
        {
          find: /^@designable\/react-settings-form$/,
          replacement: resolve(__dirname, designableReactSettingsFormAliasPath),
        },
        { find: "@", replacement: resolve(__dirname, "src") },
        {
          find: "react/jsx-runtime",
          replacement: resolve(__dirname, "node_modules/react/jsx-runtime.js"),
        },
        {
          find: "react/jsx-dev-runtime",
          replacement: resolve(
            __dirname,
            "node_modules/react/jsx-dev-runtime.js",
          ),
        },
        {
          find: "react-dom",
          replacement: resolve(__dirname, "node_modules/react-dom"),
        },
        {
          find: "react",
          replacement: resolve(__dirname, "node_modules/react"),
        },
        { find: "~antd", replacement: resolve(__dirname, "node_modules/antd") },
        { find: "~", replacement: resolve(__dirname, "node_modules") },
        {
          find: "@designable/core",
          replacement: resolve(__dirname, "node_modules/@designable/core"),
        },
        {
          find: "@designable/shared",
          replacement: resolve(__dirname, "node_modules/@designable/shared"),
        },
        {
          find: "@designable/react",
          replacement: resolve(__dirname, "node_modules/@designable/react"),
        },
      ],
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
        },
        output: {
          manualChunks,
        },
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      exclude: ["@designable/shared"],
    },
  };
});
