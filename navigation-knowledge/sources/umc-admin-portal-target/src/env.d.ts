/// <reference types="vite/client" />

interface ImportMetaEnv {
  // P8 Plan A: per-service API base-URL env vars removed (routing owned by the gateway).
  readonly VITE_LAYOUT_WIDE_SCREEN_MODE?: "centered" | "legacy" | "fluid";
  readonly VITE_AZURE_AD_CALLBACK_PATH?: string;
  readonly VITE_UAE_PASS_URL?: string;
  readonly VITE_CUSTOMER_PORTAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.less";

declare const __ADMIN_PORTAL_BUILD_VERSION__: {
  buildId: string;
  buildTime: string;
  packageVersion: string;
};
