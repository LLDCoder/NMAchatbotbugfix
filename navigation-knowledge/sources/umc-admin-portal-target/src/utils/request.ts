import axios from "axios";
import type {
  AxiosProgressEvent,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
// import i18next from "@/localization/config";
import { CustomMessage } from "@/components/common";
import { authService } from "@/services/auth";
import i18n from "@/localization/config";
import {
  beginNetworkErrorToastSuppress,
  endNetworkErrorToastSuppress,
} from "@/utils/blockOtherErrorToasts";
import {
  handleUnauthorizedSession,
  isUnauthorizedResponse,
} from "@/utils/handleUnauthorizedSession";
import { notifySessionActivity } from "@/utils/sessionActivity";

const service = axios.create({
  baseURL: import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 60 * 1000,
  headers: {
    "Content-Type": "application/json;charset=utf-8",
  },
});

const CORRELATION_ID_HEADER = "X-Correlation-Id";
const CORRELATION_ID_STORAGE_KEY = "umc-correlation-id";

const createCorrelationId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const getCurrentCorrelationId = () => {
  if (typeof window === "undefined") return createCorrelationId();

  const stored = window.sessionStorage.getItem(CORRELATION_ID_STORAGE_KEY);
  if (stored) return stored;

  const next = createCorrelationId();
  window.sessionStorage.setItem(CORRELATION_ID_STORAGE_KEY, next);
  return next;
};

export const getClientCorrelationId = () => getCurrentCorrelationId();

service.interceptors.request.use(
  (config) => {
    config.headers["Accept-Language"] = i18n.language;
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      notifySessionActivity();
    }
    config.headers[CORRELATION_ID_HEADER] = getCurrentCorrelationId();
    // P8 Plan A: per-prefix baseURL rewriting removed. All requests use the shared relative
    // baseURL (VITE_API_BASE_URL = '') and reach the gateway, which owns the routing of
    // /Enquiry, /User, /UAEPASS, /AzureAD, /home, /config, /ContentLibrary, etc. to the right
    // downstream service. The frontend no longer knows which back-end service handles a path.
    if (config.method?.toUpperCase() === "GET" && config.params) {
      Object.keys(config.params).forEach((key) => {
        if (config.params[key] === undefined || config.params[key] === null) {
          delete config.params[key];
        }
      });
    }
    return config;
  },
  (error) => {
    console.error("Request parameter error:", error);
    // CustomMessage.error(i18next.t("request.parameter.error"));
    return Promise.reject(error);
  }
);

interface RequestConfig extends AxiosRequestConfig {
  skipErrorMessage?: boolean;
  rawResponse?: boolean;
}

export type NetworkErrorType = "timeout" | "offline" | "network";

const classifyNetworkError = (error: unknown): NetworkErrorType => {
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? "";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "offline";
  }
  if (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    /timeout/i.test(message)
  ) {
    return "timeout";
  }
  return "network";
};

// Timeout and generic failures share the network copy; only a true offline
// state gets the dedicated offline copy.
const NETWORK_ERROR_I18N_KEY: Record<NetworkErrorType, string> = {
  timeout: "response.network.error",
  offline: "response.offline.error",
  network: "response.network.error",
};

const NETWORK_ERROR_TOAST_KEY = "network-error-toast";

const isCanceledError = (error: { code?: string; name?: string }) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

service.interceptors.response.use(
  (response) => {
    const responseCorrelationId = response.headers?.[CORRELATION_ID_HEADER.toLowerCase()];
    if (typeof window !== "undefined" && responseCorrelationId) {
      window.sessionStorage.setItem(CORRELATION_ID_STORAGE_KEY, String(responseCorrelationId));
    }

    if ((response.config as RequestConfig).rawResponse) {
      return response;
    }

    const { data } = response;
    // if (response.status !== 200) {
    //   CustomMessage.error(
    //     data.message || i18next.t("request.operation.failed")
    //   );
    //   return Promise.reject(
    //     new Error(data.message || i18next.t("request.error"))
    //   );
    // }

    return data;
  },
  (error) => {
    if (isCanceledError(error)) {
      return Promise.reject(error);
    }

    // if (error.config?.skipErrorMessage) {
    //   return Promise.reject(error);
    // }

    console.error("Response error:", error);

    // The browser reports no connectivity. Any response present here (e.g. a
    // dev-proxy 500 produced because the proxy could not reach the backend) is
    // not a genuine business error, so treat it as a network-level failure.
    const isBrowserOffline =
      typeof navigator !== "undefined" && navigator.onLine === false;

    if (isBrowserOffline || !error.response) {
      const networkErrorType = classifyNetworkError(error);
      const networkMessage = i18n.t(NETWORK_ERROR_I18N_KEY[networkErrorType]);

      if (!(error.config as RequestConfig)?.skipErrorMessage) {
        CustomMessage.error(
          networkMessage,
          undefined,
          undefined,
          NETWORK_ERROR_TOAST_KEY
        );
        beginNetworkErrorToastSuppress();
        setTimeout(endNetworkErrorToastSuppress, 0);
      }

      (error as { networkErrorType?: NetworkErrorType }).networkErrorType =
        networkErrorType;
      return Promise.reject(error);
    }

    if (isUnauthorizedResponse(error)) {
      handleUnauthorizedSession(error);
      return Promise.reject(error);
    }

    if (error.config?.skipErrorMessage) {
      return Promise.reject(error);
    }

    // const { statusCode, message: errorMessage } = error.response.data;
    // switch (statusCode) {
    //   case 403:
    //     CustomMessage.error(i18next.t("response.error.403"));
    //     break;
    //   case 404:
    //     CustomMessage.error(i18next.t("response.error.404"));
    //     break;
    //   case 400:
    //     CustomMessage.error(errorMessage);
    //     break;
    //   case 500:
    //     CustomMessage.error(errorMessage);
    //     break;
    //   default:
    //     CustomMessage.error(
    //       statusCode
    //         ? `${i18next.t("response.error.default")} (${statusCode})`
    //         : i18next.t("response.error.default")
    //     );
    // }

    return Promise.reject(error);
  }
);

const request = {
  get<T = unknown, R = AxiosResponse<T>>(
    url: string,
    params = {},
    config: RequestConfig = {}
  ) {
    return service.get<T, R>(url, { params, ...config });
  },

  getRaw<T = unknown>(
    url: string,
    params = {},
    config: RequestConfig = {}
  ) {
    const rawConfig: RequestConfig = {
      params,
      ...config,
      rawResponse: true,
    };
    return service.get<T, AxiosResponse<T>>(url, rawConfig);
  },

  post<T = unknown, R = AxiosResponse<T>>(
    url: string,
    data = {},
    config: RequestConfig = {}
  ) {
    return service.post<T, R>(url, data, config);
  },

  put<T = unknown, R = AxiosResponse<T>>(
    url: string,
    data = {},
    config: RequestConfig = {}
  ) {
    return service.put<T, R>(url, data, config);
  },

  delete<T = unknown, R = AxiosResponse<T>>(
    url: string,
    params = {},
    config: RequestConfig = {}
  ) {
    return service.delete<T, R>(url, { params, ...config });
  },

  upload<T = unknown, R = AxiosResponse<T>>(
    url: string,
    file: File,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ) {
    const formData = new FormData();
    formData.append("file", file);
    return service.post<T, R>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },
};

export default request;
