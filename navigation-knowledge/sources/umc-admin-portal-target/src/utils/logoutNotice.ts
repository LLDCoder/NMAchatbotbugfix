const LOGOUT_NOTICE_KEY = "NMA_WORKSPACE_AUTH_LOGOUT_NOTICE";

interface LogoutNoticeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function storeLogoutNotice(
  storage: LogoutNoticeStorage,
  message: string,
): void {
  storage.setItem(LOGOUT_NOTICE_KEY, message);
}

export function consumeLogoutNotice(
  storage: LogoutNoticeStorage,
  defer: boolean,
): string | null {
  if (defer) {
    return null;
  }

  const message = storage.getItem(LOGOUT_NOTICE_KEY);
  if (message) {
    storage.removeItem(LOGOUT_NOTICE_KEY);
  }
  return message;
}

export function clearLogoutNotice(storage: LogoutNoticeStorage): void {
  storage.removeItem(LOGOUT_NOTICE_KEY);
}

export function shouldReloadLoginAfterLogoutFailure(
  logoutUrl: string | null,
  currentToken: string,
  hasNotice: boolean,
): boolean {
  return Boolean(!logoutUrl && !currentToken && hasNotice);
}
