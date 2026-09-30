import authStorage, { AUTH_USER_STORAGE_KEY } from "@/storage/authStorage";
import { history } from "@/utils/history";
import { useUserStore } from "@/store/user";
import { invalidateCurrentAdminUser } from "@/store/currentAdminUser";
import {
  getInspectionLeaveConfirmBypassState,
  isInspectionExecutionPath,
  markNextInspectionLeaveConfirmBypassed,
  requestInspectionExecutionDraftSave,
} from "@/utils/inspectionExecutionLeaveGuard";
import { clearStoredLastAuthorizedPrivatePath } from "@/routes/access";
import { requestUaePassLogout } from "@/services/uaePassLogout";
import {
  clearLogoutNotice,
  consumeLogoutNotice as consumeStoredLogoutNotice,
  shouldReloadLoginAfterLogoutFailure,
  storeLogoutNotice,
} from "@/utils/logoutNotice";
import {
  AUTH_SESSION_SYNC_ACTION,
  publishAuthSessionSync,
} from "@/utils/authSessionSync";

type PerformLocalLogoutOptions = {
  bypassInspectionLeaveConfirm?: boolean;
  saveInspectionExecutionDraft?: boolean;
  syncOtherTabs?: boolean;
};

type PerformAuthenticatedLogoutOptions = PerformLocalLogoutOptions & {
  loginNotice?: string;
};

let uaePassLogoutStarted = false;
let sessionSequence = 0;

/** Session-only: user authenticated with JWT but must complete reset on `/new-password`. */
export const MANDATORY_ADMIN_PASSWORD_RESET_SESSION_KEY =
  "auth:mandatory-admin-password-reset";

export function markMandatoryAdminPasswordResetPending() {
  sessionStorage.setItem(MANDATORY_ADMIN_PASSWORD_RESET_SESSION_KEY, "1");
}

export function clearMandatoryAdminPasswordResetPending() {
  sessionStorage.removeItem(MANDATORY_ADMIN_PASSWORD_RESET_SESSION_KEY);
}

export function isMandatoryAdminPasswordResetPending(): boolean {
  return (
    sessionStorage.getItem(MANDATORY_ADMIN_PASSWORD_RESET_SESSION_KEY) === "1"
  );
}

/** Clears auth tokens, persisted profile, and password-reset markers without navigation. */
export function wipeAuthForReturningToLogin() {
  clearMandatoryAdminPasswordResetPending();
  clearStoredLastAuthorizedPrivatePath();
  authStorage.clearAuth();
  clearPersistedUser();
  removeTokenFromCurrentUrl();
  publishAuthSessionSync(AUTH_SESSION_SYNC_ACTION.LOGOUT);
}

export function clearPersistedUser() {
  invalidateCurrentAdminUser();
  useUserStore.getState().resetUserInfo();
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export function consumeLogoutNotice(): string | null {
  return consumeStoredLogoutNotice(sessionStorage, uaePassLogoutStarted);
}

export function resetAuthenticatedLogoutState() {
  sessionSequence += 1;
  uaePassLogoutStarted = false;
  clearLogoutNotice(sessionStorage);
}

export function removeTokenFromCurrentUrl() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("token")) {
    return;
  }

  url.searchParams.delete("token");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export function performLocalLogout(options: PerformLocalLogoutOptions) {
  const isInspectionExecutionPage =
    typeof window !== "undefined" && isInspectionExecutionPath(window.location.pathname);
  const shouldBypassInspectionLeaveConfirm = isInspectionExecutionPage && options.bypassInspectionLeaveConfirm;

  if (isInspectionExecutionPage && options.saveInspectionExecutionDraft) {
    requestInspectionExecutionDraftSave();
  }

  if (shouldBypassInspectionLeaveConfirm) {
    markNextInspectionLeaveConfirmBypassed();
  }

  clearMandatoryAdminPasswordResetPending();
  clearStoredLastAuthorizedPrivatePath();
  authStorage.clearAuth();
  clearPersistedUser();
  removeTokenFromCurrentUrl();
  history.replace(
    "/login",
    shouldBypassInspectionLeaveConfirm ? getInspectionLeaveConfirmBypassState() : undefined,
  );

  if (options.syncOtherTabs !== false) {
    publishAuthSessionSync(AUTH_SESSION_SYNC_ACTION.LOGOUT);
  }
}

export function performAuthenticatedLogout(
  options: PerformAuthenticatedLogoutOptions,
) {
  const token = authStorage.getToken();
  const shouldLogoutFromUaePass = authStorage.isUaePassSession();

  if (options.loginNotice) {
    storeLogoutNotice(sessionStorage, options.loginNotice);
  }

  performLocalLogout(options);

  if (!shouldLogoutFromUaePass || !token || uaePassLogoutStarted) {
    return;
  }

  uaePassLogoutStarted = true;
  const logoutSequence = ++sessionSequence;
  void requestUaePassLogout(token).then((logoutUrl) => {
    if (logoutSequence !== sessionSequence) {
      return;
    }
    const currentToken = authStorage.getToken();
    if (!logoutUrl || currentToken) {
      uaePassLogoutStarted = false;
      if (currentToken) {
        clearLogoutNotice(sessionStorage);
      }
      if (
        shouldReloadLoginAfterLogoutFailure(
          logoutUrl,
          currentToken,
          Boolean(options.loginNotice),
        )
      ) {
        window.location.replace("/login");
      }
      return;
    }
    window.location.replace(logoutUrl);
  });
}
