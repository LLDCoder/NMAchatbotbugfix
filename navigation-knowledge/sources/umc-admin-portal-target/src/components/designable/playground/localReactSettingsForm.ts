import { loader as monacoLoader } from "@monaco-editor/react";
import {
  getNpmCDNRegistry,
  setNpmCDNRegistry as setOriginalNpmCDNRegistry,
} from "@designable/react-settings-form/esm/registry";
import "@designable/react-settings-form/esm/locales";

const DESIGNABLE_LOCAL_NPM_REGISTRY = "/assets/vendor/npm";
const DESIGNABLE_LOCAL_MONACO_VS_PATH = "monaco-editor/min/vs";

const configureDesignableRuntime = (registry: string) => {
  const normalizedRegistry = registry.replace(/\/$/, "");

  setOriginalNpmCDNRegistry(normalizedRegistry);
  monacoLoader.config({
    paths: {
      vs: `${normalizedRegistry}/${DESIGNABLE_LOCAL_MONACO_VS_PATH}`,
    },
  });
};

configureDesignableRuntime(DESIGNABLE_LOCAL_NPM_REGISTRY);

export const setNpmCDNRegistry = configureDesignableRuntime;
export { getNpmCDNRegistry, DESIGNABLE_LOCAL_NPM_REGISTRY };
export * from "@designable/react-settings-form/esm/components";
export * from "@designable/react-settings-form/esm/SchemaField";
export * from "@designable/react-settings-form/esm/SettingsForm";
