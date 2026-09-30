const getStatusCode = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isSuccessStatusCode = (value: unknown) => {
  const statusCode = getStatusCode(value);
  return statusCode !== undefined && statusCode >= 200 && statusCode < 300;
};

/**
 * SignalR save endpoints have returned several equivalent success envelopes.
 * Explicit failure fields always win over a permissive status-code fallback.
 */
export const isSuccessfulBroadcastResponse = (response: unknown): boolean => {
  if (typeof response === "boolean") return response;
  if (!response || typeof response !== "object") return false;

  const payload = response as Record<string, unknown>;
  if (payload.isSuccess === false || payload.data === false) return false;
  if (payload.statusCode !== undefined && !isSuccessStatusCode(payload.statusCode)) {
    return false;
  }
  if (payload.data === true || payload.isSuccess === true) {
    return payload.statusCode === undefined || isSuccessStatusCode(payload.statusCode);
  }

  return isSuccessStatusCode(payload.statusCode);
};
