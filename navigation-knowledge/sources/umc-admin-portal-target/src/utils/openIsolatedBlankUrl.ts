export function openIsolatedBlankUrl(
  url: string,
  openWindow: typeof window.open = window.open.bind(window),
): boolean {
  const openedWindow = openWindow(url, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    return true;
  }

  try {
    openedWindow.opener = null;
  } catch {
    // noopener remains the primary boundary when the browser exposes a restricted proxy.
  }

  return true;
}
