export function resolveAvatarImageSrc(
  value?: string | null,
  imageBaseUrl = "",
  fallback = "",
) {
  const src = value?.trim() || "";

  if (!src) {
    return fallback;
  }

  if (/^(https?:|data:|blob:)/i.test(src)) {
    return src;
  }

  return `${imageBaseUrl}${src}`;
}
