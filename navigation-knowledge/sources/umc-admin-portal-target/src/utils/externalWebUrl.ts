const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

const hasAsciiControlCharacter = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) {
      return true;
    }
  }

  return false;
};

/**
 * Resolves a user-supplied external link into a safe absolute http(s) URL.
 * Returns null when the value is empty or cannot be trusted as a web link.
 */
export const resolveExternalWebUrl = (value?: string | null) => {
  const text = String(value ?? "").trim();

  if (!text || hasAsciiControlCharacter(text)) {
    return null;
  }

  const candidate = ABSOLUTE_URL_RE.test(text) ? text : `https://${text}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};
