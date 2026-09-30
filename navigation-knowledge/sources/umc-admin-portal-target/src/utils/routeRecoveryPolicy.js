const staleAssetPattern =
  /(Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [A-Za-z0-9_-]+ failed|ChunkLoadError|Unable to preload CSS)/i;

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (error && typeof error.message === "string") return error.message;
  if (error && typeof error.stack === "string") return error.stack;
  return String(error || "");
}

export function classifyRouteFailure(error) {
  const message = getErrorMessage(error);

  if (
    message.includes("Page module not found") ||
    message.includes("missing `page`")
  ) {
    return "page-unavailable";
  }

  if (staleAssetPattern.test(message)) {
    return "stale-asset";
  }

  return "render-error";
}

export function createRecoveryKey(buildFingerprint, resource) {
  return `admin-portal:asset-recovery:${buildFingerprint}:${normalizeRecoveryResource(resource)}`;
}

export function normalizeRecoveryResource(reason) {
  const value = String(reason || "");
  return value.match(/https?:\/\/[^\s'")]+/i)?.[0] || value;
}

export function sanitizeDiagnosticRouteKey(routeKey) {
  return String(routeKey || "").split(/[?#]/, 1)[0];
}

export function getRouteFailureMessage(error) {
  return getErrorMessage(error);
}

export const RECOVERY_PENDING_WINDOW_MS = 15000;

// A recovery reload is rate-limited per (build, resource) instead of being a
// permanent one-shot: blocking forever leaves users stuck on the error page
// when the same stale pairing comes back later (rollbacks, mixed replicas),
// while a cooldown still prevents rapid reload loops.
export const RECOVERY_RETRY_COOLDOWN_MS = 60000;

export function shouldAttemptRecoveryReload(lastAttemptAt, now) {
  const timestamp = Number(lastAttemptAt || 0);
  if (!timestamp || Number.isNaN(timestamp)) {
    return true;
  }

  return Number(now) - timestamp >= RECOVERY_RETRY_COOLDOWN_MS;
}

export function extractMainModuleSrc(html) {
  const source = String(html || "");
  const match =
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/i.exec(
      source,
    ) ||
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["'][^>]*>/i.exec(
      source,
    );
  return match ? match[1] : "";
}

// Guards the version watcher against foreign HTML served with a 200 (SSO
// pages, maintenance pages, SPA fallbacks): a candidate only counts as a
// newer build of THIS app when it lives in the same directory as the current
// entry and shares its name stem (e.g. /assets/main-<hash>.js).
export function isCompatibleEntryPath(currentPath, candidatePath) {
  const current = String(currentPath || "");
  const candidate = String(candidatePath || "");
  if (!current || !candidate || !/\.js$/i.test(candidate)) {
    return false;
  }

  const dirOf = (path) => path.slice(0, path.lastIndexOf("/") + 1);
  const stemOf = (path) => {
    const base = path.slice(path.lastIndexOf("/") + 1);
    const dash = base.indexOf("-");
    return dash > 0 ? base.slice(0, dash) : base;
  };

  return (
    dirOf(candidate) === dirOf(current) && stemOf(candidate) === stemOf(current)
  );
}

export function getRecoveryPendingRemainingMs(recoveredAt, now) {
  const timestamp = Number(recoveredAt || 0);
  if (!timestamp || Number.isNaN(timestamp)) {
    return 0;
  }

  const remaining = timestamp + RECOVERY_PENDING_WINDOW_MS - Number(now);
  return remaining > 0 ? Math.min(remaining, RECOVERY_PENDING_WINDOW_MS) : 0;
}

export function isRecoveryPendingTimestamp(recoveredAt, now) {
  return getRecoveryPendingRemainingMs(recoveredAt, now) > 0;
}
