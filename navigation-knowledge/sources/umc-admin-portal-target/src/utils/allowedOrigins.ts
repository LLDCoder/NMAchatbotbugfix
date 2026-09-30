const normalizeOrigin = (value: string, currentOrigin: string) => {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed, currentOrigin).origin;
  } catch {
    return null;
  }
};

export const getAllowedOrigins = (
  currentOrigin: string,
  values: readonly string[],
) => {
  const origins = new Set<string>();
  const current = normalizeOrigin(currentOrigin, currentOrigin);
  if (current) {
    origins.add(current);
  }

  values.forEach((value) => {
    value
      .split(",")
      .map((item) => normalizeOrigin(item, currentOrigin))
      .forEach((origin) => {
        if (origin) {
          origins.add(origin);
        }
      });
  });

  return origins;
};
