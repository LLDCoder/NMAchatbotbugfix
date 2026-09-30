import request from "@/utils/request";
import type { IUser } from "@/store/user";
import authStorage from "@/storage/authStorage";
import { preloadDesignablePlayground } from "@/components/designable/playground/preload";
import {
  clearPersistedUser,
  markMandatoryAdminPasswordResetPending,
  resetAuthenticatedLogoutState,
} from "@/utils/authSession";
import { resetUnauthorizedSessionHandling } from "@/utils/handleUnauthorizedSession";
import { TIME } from "@/config/constants";
import { CustomMessage } from "@/components/common";
import { clearStoredLastAuthorizedPrivatePath } from "@/routes/access";
import {
  AUTH_SESSION_SYNC_ACTION,
  publishAuthSessionSync,
} from "@/utils/authSessionSync";

export const AZURE_AD_CALLBACK_PATH =
  import.meta.env.VITE_AZURE_AD_CALLBACK_PATH || "/auth/microsoft/callback";
const UAE_PASS_LOGIN_URL = import.meta.env.VITE_UAE_PASS_URL || "";

type UserStoreSetter = (data: IUser) => void;
export type LoginSource = "local" | "microsoft" | "uaepass";

interface OAuthTokenResponse {
  access_token?: string;
}

interface AzureLoginUrlResponse {
  url?: string;
}

export interface LoginUserData extends Partial<IUser>, Record<string, unknown> {
  token?: string;
}

export interface LoginMethodFlags {
  isADLogin?: boolean;
  isUAELogin?: boolean;
}

function getUAEPassRedirectUri() {
  if (!UAE_PASS_LOGIN_URL) {
    return "";
  }

  try {
    return new URL(UAE_PASS_LOGIN_URL).searchParams.get("redirect_uri") || "";
  } catch {
    return "";
  }
}

export async function fetchLoginMethodFlags(): Promise<{
  isADLogin: boolean;
  isUAELogin: boolean;
}> {
  const response = await request.get<
    { data?: LoginMethodFlags },
    { data?: LoginMethodFlags }
  >("/api/AdminUser/LoginMethod", {}, { skipErrorMessage: true });

  return {
    isADLogin: Boolean(response?.data?.isADLogin),
    isUAELogin: Boolean(response?.data?.isUAELogin),
  };
}

function persistAuthenticatedUser(
  userData: LoginUserData,
  setData: UserStoreSetter,
  remember = false,
  source: LoginSource = "local",
) {
  if (!userData?.token) {
    throw new Error("Missing business token");
  }

  authStorage.setTokenInfo({
    token: userData.token,
    refreshToken: "",
    expiresIn: TIME.REFRESH_TOKEN_EXPIRE,
    remember,
  });
  if (source === "uaepass") {
    authStorage.markUaePassSession();
  } else {
    authStorage.clearUaePassSession();
  }
  resetAuthenticatedLogoutState();
  resetUnauthorizedSessionHandling();

  const persistedUser = {
    ...userData,
    token: "",
  } as unknown as IUser;
  setData(persistedUser);
  clearStoredLastAuthorizedPrivatePath();
  publishAuthSessionSync(AUTH_SESSION_SYNC_ACTION.LOGIN);
}

export function completeLogin(
  userData: LoginUserData,
  setData: UserStoreSetter,
  remember = false,
  source: LoginSource = "local",
) {
  persistAuthenticatedUser(userData, setData, remember, source);
  void preloadDesignablePlayground().catch((error) => {
    console.warn("[login] Failed to preload designable playground", error);
  });
  CustomMessage.destroy();
}

/**
 * Persist only the bearer token until `/new-password` succeeds; avoids writing profile into `user-storage`.
 */
export function persistMandatoryPasswordResetTokenOnly(
  userData: LoginUserData,
  remember = false,
) {
  if (!userData?.token) {
    throw new Error("Missing business token");
  }

  clearPersistedUser();
  clearStoredLastAuthorizedPrivatePath();
  authStorage.clearUaePassSession();
  authStorage.setTokenInfo({
    token: userData.token,
    refreshToken: "",
    expiresIn: TIME.REFRESH_TOKEN_EXPIRE,
    remember,
  });
  resetAuthenticatedLogoutState();
  resetUnauthorizedSessionHandling();
  markMandatoryAdminPasswordResetPending();
  CustomMessage.destroy();
}

export async function fetchAzureADLoginUrl() {
  const response = await request.get<
    { data?: AzureLoginUrlResponse },
    { data?: AzureLoginUrlResponse }
  >(
    "/api/AzureAD/GetAzureADLoginURL",
    {},
    { skipErrorMessage: true },
  );
  const url = response?.data?.url;

  if (!url) {
    throw new Error("Missing Azure AD login URL");
  }

  return url as string;
}

export async function exchangeAzureADCode(
  code: string,
  state: string,
): Promise<LoginUserData> {
  const tokenData = await request.post<
    { data?: OAuthTokenResponse },
    { data?: OAuthTokenResponse }
  >(
    "/api/AzureAD/CallBackGetTokenByCode",
    {
      code,
      state,
    },
    {
      skipErrorMessage: true,
    },
  );

  const accessToken = tokenData?.data?.access_token;

  if (!accessToken) {
    throw new Error("Failed to get Azure AD access token");
  }

  const userInfo = await request.get(
    "/api/AzureAD/GetUserInfoToLogin",
    {
      accessToken,
    },
    {
      skipErrorMessage: true,
    },
  ) as { data?: LoginUserData };

  if (!userInfo?.data?.token) {
    throw new Error("Failed to get Azure AD user information");
  }

  return userInfo.data as LoginUserData;
}

export async function exchangeUAEPassCode(
  code: string,
  state: string,
): Promise<LoginUserData> {
  const redirectUri = getUAEPassRedirectUri();
  const tokenData = await request.post<
    { data?: OAuthTokenResponse },
    { data?: OAuthTokenResponse }
  >("/api/AdminUser/UAEPass/CallBackGetTokenByCode", {
    code,
    state,
    url: redirectUri,
  });

  const accessToken = tokenData?.data?.access_token;

  if (!accessToken) {
    throw new Error("Failed to get UAEPASS access token");
  }

  const userInfo = await request.get("/api/AdminUser/UAEPass/Login", {
    accessToken,
  }) as { data?: LoginUserData };

  if (!userInfo?.data?.token) {
    throw new Error("Failed to get UAEPASS user information");
  }

  return userInfo.data as LoginUserData;
}
