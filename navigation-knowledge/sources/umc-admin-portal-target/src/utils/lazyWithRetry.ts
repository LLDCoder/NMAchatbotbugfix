import * as React from "react";
import {
  classifyRouteFailure,
  createRecoveryKey,
  getRecoveryPendingRemainingMs,
  getRouteFailureMessage,
  normalizeRecoveryResource,
  shouldAttemptRecoveryReload,
} from "./routeRecoveryPolicy";

const reloadParam = "__app_reload";
// Transient network failures usually recover within a couple of retries;
// only fall back to a full recovery reload when the asset keeps failing.
const importRetryDelaysMs = [300, 1200];

type LazyModule<T extends React.ComponentType> = {
  default: T;
};

type LazyLoader<T extends React.ComponentType> = () => Promise<
  LazyModule<T>
>;

function readReloadMarkerFromUrl(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const currentUrl = new URL(window.location.href);
  return (
    Number(currentUrl.searchParams.get(reloadParam) || 0) ||
    Number(
      (window as Window & { __ADMIN_PORTAL_ASSET_RELOAD_AT__?: number })
        .__ADMIN_PORTAL_ASSET_RELOAD_AT__ || 0,
    ) ||
    0
  );
}

export function getBuildFingerprint() {
  if (typeof document === "undefined") return "unknown";

  // Must match the fingerprint used by the inline recovery script in
  // index.html so both layers share the same one-shot recovery key.
  return (
    document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      ?.src || "unknown"
  );
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readRecoveryTimestamp(reason: string): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const recoveryKey = createRecoveryKey(
    getBuildFingerprint(),
    normalizeRecoveryResource(reason),
  );

  try {
    const stored = Number(sessionStorage.getItem(recoveryKey) || 0);
    if (stored) {
      return stored;
    }
  } catch {
    // Storage access can be blocked; fall back to the URL/window marker.
  }

  // Intentionally also consult the global reload marker when this resource
  // has no recovery key of its own: a reload triggered for a sibling asset
  // (e.g. the inline index.html handler keyed by a dependency URL) is about
  // to replace the whole document anyway, so this failure should wait for it
  // rather than racing it with another reload or an error page.
  return readReloadMarkerFromUrl();
}

export function isStaleAssetError(error: unknown): boolean {
  return classifyRouteFailure(error) === "stale-asset";
}

export function getRouteRecoveryPendingRemainingMs(reason: string): number {
  return getRecoveryPendingRemainingMs(readRecoveryTimestamp(reason), Date.now());
}

export function reloadOnceForStaleAsset(reason: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const recoveryKey = createRecoveryKey(
    getBuildFingerprint(),
    normalizeRecoveryResource(reason),
  );
  const now = Date.now();

  try {
    const lastAttemptAt = Number(sessionStorage.getItem(recoveryKey) || 0);
    if (!shouldAttemptRecoveryReload(lastAttemptAt, now)) return false;
    sessionStorage.setItem(recoveryKey, String(now));
  } catch {
    if (!shouldAttemptRecoveryReload(readReloadMarkerFromUrl(), now)) {
      return false;
    }
  }

  // Mirror the inline index.html handler so concurrent failures elsewhere
  // wait for this pending reload instead of triggering their own.
  (
    window as Window & { __ADMIN_PORTAL_ASSET_RELOAD_AT__?: number }
  ).__ADMIN_PORTAL_ASSET_RELOAD_AT__ = now;

  if (window.console && typeof window.console.warn === "function") {
    window.console.warn("[lazy-retry]", reason);
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(reloadParam, String(now));
  window.location.replace(nextUrl.toString());
  return true;
}

export function lazyWithRetry<T extends React.ComponentType>(
  loader: LazyLoader<T>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    let lastError: unknown = null;

    // Best-effort retries: modern browsers no longer cache failed dynamic
    // module fetches, so re-invoking the loader re-requests the asset
    // (verified against the bundled Chromium: a fail-once chunk recovered in
    // place without a reload). If a browser does serve the cached rejection,
    // the retries fail fast and the reload path below still recovers.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await loader();
      } catch (error) {
        lastError = error;

        // Runtime module errors are not recoverable by refetching the asset.
        if (!isStaleAssetError(error)) {
          throw error;
        }

        if (attempt >= importRetryDelaysMs.length) {
          break;
        }

        await delay(importRetryDelaysMs[attempt]);
      }
    }

    const reason = getRouteFailureMessage(lastError);

    // A recovery reload is already in flight (triggered here earlier or by
    // the inline index.html handler) and its `location.replace` has not
    // committed yet. Hold the loading state for the remaining window instead
    // of racing it with another reload or flashing the route error page;
    // only surface the error if the reload never lands.
    const pendingRemainingMs = getRouteRecoveryPendingRemainingMs(reason);
    if (pendingRemainingMs > 0) {
      await delay(pendingRemainingMs);
      throw lastError;
    }

    if (reloadOnceForStaleAsset(reason)) {
      // Keep the suspense fallback visible while the recovery reload commits.
      return new Promise<LazyModule<T>>(() => undefined);
    }

    throw lastError;
  });
}
