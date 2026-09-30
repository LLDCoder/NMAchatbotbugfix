type AllowedOriginInput = ReadonlySet<string> | readonly string[];

type SecurityRestrictedUrlLogOptions = {
  feature: string;
  value: string;
  currentOrigin?: string;
  allowedOrigins?: AllowedOriginInput;
  reason?: string;
};

const toAllowedOriginList = (allowedOrigins?: AllowedOriginInput) => {
  if (!allowedOrigins) return undefined;
  return Array.from(allowedOrigins).sort();
};

export const warnSecurityRestrictedUrl = ({
  feature,
  value,
  currentOrigin,
  allowedOrigins,
  reason = "URL blocked by security policy",
}: SecurityRestrictedUrlLogOptions) => {
  if (typeof console === "undefined" || typeof console.warn !== "function") {
    return;
  }

  const trimmedValue = value.trim();
  const details: Record<string, unknown> = {
    feature,
    reason,
    allowedOrigins: toAllowedOriginList(allowedOrigins),
  };

  try {
    const parsedUrl = new URL(trimmedValue, currentOrigin);
    details.origin = parsedUrl.origin;
    details.hostname = parsedUrl.hostname;
    details.protocol = parsedUrl.protocol;
  } catch {
    details.inputType = trimmedValue ? "invalid-url" : "empty-url";
  }

  console.warn("[Security] Restricted URL blocked.", details);
};
