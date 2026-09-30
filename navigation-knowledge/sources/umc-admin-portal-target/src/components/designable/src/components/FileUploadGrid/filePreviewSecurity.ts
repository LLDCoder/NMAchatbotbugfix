import { getAllowedOrigins } from "@/utils/allowedOrigins";
import { warnSecurityRestrictedUrl } from "@/utils/securityRestrictedUrlLog";

type PreviewWindow = {
  opener: unknown;
};

type OpenWindow = (
  url: string,
  target: string,
  features: string,
) => PreviewWindow | null;

/**
 * Keeps signed external HTTPS document links working while rejecting URL forms
 * that can execute script or access local resources. HTTP and blob previews are
 * restricted to the current or explicitly configured service origins.
 */
export const resolveSafeFilePreviewUrl = (
  value: string,
  currentOrigin: string,
  configuredOrigins: readonly string[] = [],
) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed, currentOrigin);
    if (parsedUrl.username || parsedUrl.password) return null;

    const trustedOrigins = getAllowedOrigins(currentOrigin, configuredOrigins);
    if (parsedUrl.protocol === "https:") {
      return parsedUrl.href;
    }

    if (
      parsedUrl.protocol === "http:" &&
      trustedOrigins.has(parsedUrl.origin)
    ) {
      return parsedUrl.href;
    }

    if (
      parsedUrl.protocol === "blob:" &&
      parsedUrl.origin !== "null" &&
      trustedOrigins.has(parsedUrl.origin)
    ) {
      return parsedUrl.href;
    }

    return null;
  } catch {
    return null;
  }
};

export const openSafeFilePreviewUrl = (
  value: string,
  currentOrigin: string,
  configuredOrigins: readonly string[],
  openWindow: OpenWindow,
) => {
  const previewUrl = resolveSafeFilePreviewUrl(
    value,
    currentOrigin,
    configuredOrigins,
  );
  if (!previewUrl) {
    warnSecurityRestrictedUrl({
      feature: "file-preview",
      value,
      currentOrigin,
      allowedOrigins: getAllowedOrigins(currentOrigin, configuredOrigins),
      reason: "File preview URL is not allowed.",
    });
    return false;
  }

  const openedWindow = openWindow(
    previewUrl,
    "_blank",
    "noopener,noreferrer",
  );
  if (openedWindow) {
    try {
      openedWindow.opener = null;
    } catch {
      // The noopener feature remains the primary boundary for restricted proxies.
    }
  }

  return true;
};
