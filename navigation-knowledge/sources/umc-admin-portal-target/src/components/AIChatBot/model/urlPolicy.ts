function isIpLiteral(hostname: string) {
  if (hostname.startsWith("[") || hostname.endsWith("]")) return true;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function hostMatchesPolicy(hostname: string, allowedHosts: readonly string[]) {
  const normalizedHostname = hostname.toLowerCase();
  return allowedHosts.some((entry) => {
    const allowed = entry.trim().toLowerCase().replace(/\.$/, "");
    if (!allowed) return false;
    if (allowed.startsWith("*.")) {
      const suffix = allowed.slice(2);
      return Boolean(suffix) && normalizedHostname.endsWith(`.${suffix}`);
    }
    return normalizedHostname === allowed;
  });
}

function normalizePortalPath(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return null;
  try {
    const base = "https://portal.local";
    const url = new URL(candidate, base);
    if (url.origin !== base || url.username || url.password) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function normalizeCurrentPortalUrl(value: unknown) {
  if (typeof value !== "string" || typeof window === "undefined") return null;
  try {
    const url = new URL(value);
    if (url.origin !== window.location.origin || url.username || url.password) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function normalizeAllowedExternalUrl(
  value: unknown,
  allowedHosts: readonly string[],
) {
  if (typeof value !== "string" || !allowedHosts.length) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !hostname ||
      isIpLiteral(hostname) ||
      !hostMatchesPolicy(hostname, allowedHosts)
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeMarkdownHref(
  value: unknown,
  allowedHosts: readonly string[],
) {
  return normalizePortalPath(value)
    || normalizeCurrentPortalUrl(value)
    || normalizeAllowedExternalUrl(value, allowedHosts);
}
