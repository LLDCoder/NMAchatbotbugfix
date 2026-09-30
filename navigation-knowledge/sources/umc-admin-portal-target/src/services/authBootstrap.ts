import request from "@/utils/request";
import authStorage from "@/storage/authStorage";
import { TIME } from "@/config/constants";
import { useUserStore, type IUser } from "@/store/user";
import {
  clearPersistedUser,
  performAuthenticatedLogout,
  resetAuthenticatedLogoutState,
} from "@/utils/authSession";
import {
  isUnauthorizedResponse,
  resetUnauthorizedSessionHandling,
} from "@/utils/handleUnauthorizedSession";
import {
  AUTH_SESSION_SYNC_ACTION,
  publishAuthSessionSync,
  shouldPublishUrlTokenLogin,
} from "@/utils/authSessionSync";

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token")?.trim() || "";
}

async function fetchCurrentUser() {
  const response = await request.post<{ data: IUser }, { data: IUser }>(
    "/api/AdminUser/GetUserInfo",
    {},
    { skipErrorMessage: true },
  );

  return response?.data;
}

function persistToken(token: string, syncOtherTabs = false) {
  authStorage.clearUaePassSession();
  authStorage.setTokenInfo({
    token,
    refreshToken: "",
    expiresIn: TIME.REFRESH_TOKEN_EXPIRE,
    remember: true,
  });
  resetAuthenticatedLogoutState();
  resetUnauthorizedSessionHandling();

  if (syncOtherTabs) {
    publishAuthSessionSync(AUTH_SESSION_SYNC_ACTION.LOGIN);
  }
}

function hasPersistedUser() {
  return !!useUserStore.getState().userInfo?.id;
}

function hasUsablePermissionSnapshot(user?: Partial<IUser> | null) {
  return Boolean(user?.id && Array.isArray(user.listSysPermission));
}

function isUnauthorizedCurrentUserError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      isUnauthorizedResponse(
        error as Parameters<typeof isUnauthorizedResponse>[0],
      ),
  );
}

export function bootstrapAuthToken() {
  const tokenFromUrl = getTokenFromUrl();
  const cachedToken = authStorage.getToken();

  if (tokenFromUrl) {
    const syncOtherTabs = shouldPublishUrlTokenLogin(tokenFromUrl, cachedToken);

    if (cachedToken && cachedToken !== tokenFromUrl) {
      clearPersistedUser();
    }

    persistToken(tokenFromUrl, syncOtherTabs);
    return;
  }

  if (!cachedToken) {
    authStorage.clearAuth();

    if (hasPersistedUser()) {
      clearPersistedUser();
    }
    return;
  }

  if (!authStorage.isTokenValid(TIME.TOKEN_REFRESH_AHEAD)) {
    performAuthenticatedLogout({
      bypassInspectionLeaveConfirm: true,
      saveInspectionExecutionDraft: true,
    });
  }
}

export async function syncCurrentUserAfterAuth(): Promise<boolean> {
  const token = authStorage.getToken();

  if (!token || !authStorage.isTokenValid(TIME.TOKEN_REFRESH_AHEAD)) {
    performAuthenticatedLogout({
      bypassInspectionLeaveConfirm: true,
      saveInspectionExecutionDraft: true,
    });
    return false;
  }

  try {
    const currentUser = await fetchCurrentUser();

    if (!hasUsablePermissionSnapshot(currentUser)) {
      throw new Error("Missing current user");
    }

    useUserStore.getState().setData(currentUser);
    return true;
  } catch (error) {
    if (isUnauthorizedCurrentUserError(error)) {
      return false;
    }

    const persistedUser = useUserStore.getState().userInfo;

    if (hasUsablePermissionSnapshot(persistedUser)) {
      return true;
    }
  }

  performAuthenticatedLogout({
    bypassInspectionLeaveConfirm: true,
    saveInspectionExecutionDraft: true,
  });
  return false;
}
