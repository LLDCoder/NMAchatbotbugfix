export const AUTH_SESSION_SYNC_ACTION = {
  LOGIN: "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGIN",
  LOGOUT: "@@NMA_WORKSPACE_AUTH_SESSION_SYNC/LOGOUT",
} as const;

export type AuthSessionSyncAction =
  (typeof AUTH_SESSION_SYNC_ACTION)[keyof typeof AUTH_SESSION_SYNC_ACTION];

export const AUTH_SESSION_SYNC_STORAGE_KEY =
  "NMA_WORKSPACE_AUTH_SESSION_SYNC_EVENT";

type AuthSessionSyncMessage = {
  eventId: string;
  action: AuthSessionSyncAction;
};

export function parseAuthSessionSyncMessage(
  value: string | null,
): AuthSessionSyncAction | null {
  if (!value) {
    return null;
  }

  try {
    const message = JSON.parse(value) as Partial<AuthSessionSyncMessage> | null;

    if (
      !message ||
      typeof message.eventId !== "string" ||
      !message.eventId.trim() ||
      (message.action !== AUTH_SESSION_SYNC_ACTION.LOGIN &&
        message.action !== AUTH_SESSION_SYNC_ACTION.LOGOUT)
    ) {
      return null;
    }

    return message.action;
  } catch {
    return null;
  }
}

export function shouldPublishUrlTokenLogin(
  tokenFromUrl: string,
  cachedToken: string,
): boolean {
  return Boolean(tokenFromUrl && tokenFromUrl !== cachedToken);
}

export function publishAuthSessionSync(action: AuthSessionSyncAction): void {
  const message: AuthSessionSyncMessage = {
    eventId: `${Date.now()}-${Math.random()}`,
    action,
  };

  window.localStorage.setItem(
    AUTH_SESSION_SYNC_STORAGE_KEY,
    JSON.stringify(message),
  );
}

export function subscribeAuthSessionSync(
  listener: (action: AuthSessionSyncAction) => void,
): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (
      event.storageArea !== window.localStorage ||
      event.key !== AUTH_SESSION_SYNC_STORAGE_KEY
    ) {
      return;
    }

    const action = parseAuthSessionSyncMessage(event.newValue);
    if (action) {
      listener(action);
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}
