import request from "@/utils/request";
import { getClientCorrelationId } from "@/utils/request";

let installed = false;

/**
 * Front-end client log SDK (M6 T6.4).
 * Reports JS errors / pure client behaviour to the logging service via the gateway. It only captures
 * information the backend cannot see; business/security/audit logs remain backend-owned. The current
 * X-Correlation-Id is added by the shared request interceptor chain when present, so client errors can
 * be correlated with the originating server request in the unified log store.
 */
export interface ClientLogReport {
  message?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  source?: string;
}

/** Sends a single client log report. Never throws — logging must not break the app. */
export async function reportClientLog(report: ClientLogReport): Promise<void> {
  try {
    await request.post(
      "/api/clientlog/report",
      {
        ...report,
        url: report.url ?? window.location?.pathname,
        userAgent: report.userAgent ?? navigator?.userAgent,
        source: report.source ?? "admin-portal",
        correlationId: getClientCorrelationId(),
      },
      { skipErrorMessage: true } as any,
    );
  } catch {
    // swallow — best-effort client telemetry
  }
}

/**
 * Installs global handlers for uncaught errors and unhandled promise rejections.
 * Call once during app bootstrap (e.g. in main.tsx) if client error capture is desired.
 */
export function installClientErrorReporting(): void {
  if (typeof window === "undefined") return;
  if (installed) return;
  installed = true;

  window.addEventListener("error", (e: ErrorEvent) => {
    void reportClientLog({
      message: e.message,
      stack: e.error?.stack,
      url: window.location?.href,
    });
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason: any = e.reason;
    void reportClientLog({
      message:
        typeof reason === "string" ? reason : reason?.message ?? "unhandledrejection",
      stack: reason?.stack,
      url: window.location?.href,
    });
  });
}
