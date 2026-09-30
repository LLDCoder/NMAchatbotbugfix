export type RouteFailureKind =
  | "page-unavailable"
  | "stale-asset"
  | "render-error";

export function classifyRouteFailure(error: unknown): RouteFailureKind;
export function createRecoveryKey(buildFingerprint: string, resource: string): string;
export function normalizeRecoveryResource(reason: string): string;
export function sanitizeDiagnosticRouteKey(routeKey: string): string;
export function getRouteFailureMessage(error: unknown): string;
export const RECOVERY_PENDING_WINDOW_MS: number;
export const RECOVERY_RETRY_COOLDOWN_MS: number;
export function shouldAttemptRecoveryReload(
  lastAttemptAt: number | undefined,
  now: number,
): boolean;
export function extractMainModuleSrc(html: string): string;
export function isCompatibleEntryPath(
  currentPath: string,
  candidatePath: string,
): boolean;
export function getRecoveryPendingRemainingMs(
  recoveredAt: number | undefined,
  now: number,
): number;
export function isRecoveryPendingTimestamp(
  recoveredAt: number | undefined,
  now: number,
): boolean;
