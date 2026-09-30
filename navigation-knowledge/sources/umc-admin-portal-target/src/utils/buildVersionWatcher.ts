// Proactive companion to the reactive recovery in lazyWithRetry: when routing
// falls through to 404, probe version.json before showing the error page. If a
// newer build is found, the app shows a refresh prompt and lets the user decide
// when to reload.

import {
  hasBuildVersionChanged,
  normalizeBuildVersion,
  shouldStartBuildVersionCheck,
  type BuildVersionInfo,
} from "./buildVersionPolicy";

let currentVersion: BuildVersionInfo | null = normalizeBuildVersion(
  typeof __ADMIN_PORTAL_BUILD_VERSION__ === "undefined"
    ? null
    : __ADMIN_PORTAL_BUILD_VERSION__,
);
let latestVersion: BuildVersionInfo | null = null;
let checking = false;
let promptVisible = false;
let checkingPromise: Promise<boolean> | null = null;
const listeners = new Set<(visible: boolean) => void>();

function emitPromptState() {
  listeners.forEach((listener) => {
    listener(promptVisible);
  });
}

function setPromptVisible(visible: boolean) {
  if (promptVisible === visible) {
    return;
  }

  promptVisible = visible;
  emitPromptState();
}

export function isNewBuildAvailable(): boolean {
  return hasBuildVersionChanged(currentVersion, latestVersion);
}

export function getBuildUpdatePromptVisible(): boolean {
  return promptVisible;
}

export function subscribeBuildUpdatePrompt(
  listener: (visible: boolean) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersionUrl(): string {
  const baseUrl = import.meta.env.BASE_URL || "/";
  return new URL("version.json", window.location.origin + baseUrl).toString();
}

export async function checkBuildVersionNow(): Promise<boolean> {
  if (!shouldStartBuildVersionCheck(checking)) {
    return checkingPromise || Promise.resolve(isNewBuildAvailable());
  }

  checking = true;
  checkingPromise = (async () => {
    try {
      const response = await fetch(getVersionUrl(), {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        return false;
      }

      const version = normalizeBuildVersion(await response.json());
      if (!version) {
        return false;
      }

      if (!currentVersion) {
        currentVersion = version;
      }

      latestVersion = version;
      setPromptVisible(isNewBuildAvailable());
      return isNewBuildAvailable();
    } catch {
      // Offline or transient failure — keep whatever we knew before.
      return false;
    } finally {
      checking = false;
      checkingPromise = null;
    }
  })();

  return checkingPromise;
}
