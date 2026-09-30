import { Alert, Form, Input, notification } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import request from "@/utils/request";
import PublicAuthHeader from "@/components/common/PublicAuthHeader";
import SimpleBar from "@/components/SimpleBar";
import Eye from "@/assets/icons/Eye";
import EyeView from "@/assets/icons/EyeView";
import { useTranslation } from "react-i18next";
import aesEncrypt from "@/utils/aesEncrypt";
import {
  CustomMessage,
  FormErrorPrompt,
  hasForgotPasswordHint,
} from "@/components/common";
import microsoftImg from "@/assets/images/microsoft.png";
import fingerprintImg from "@/assets/images/fingerprint.png";
import { useUserStore } from "@/store/user";
import { Redirect, useHistory, useLocation } from "react-router-dom";
import { useForgotPwdStore } from "@/store/forgot-pwd-store";
import { authService } from "@/services/auth";
import "./index.css";
import {
  completeLogin,
  exchangeUAEPassCode,
  fetchAzureADLoginUrl,
  fetchLoginMethodFlags,
  persistMandatoryPasswordResetTokenOnly,
  type LoginUserData,
} from "./auth";
import { consumeUAEPassState, createUAEPassLoginUrl } from "./uaePassState";
import {
  consumeLogoutNotice,
  isMandatoryAdminPasswordResetPending,
} from "@/utils/authSession";
import { resetUnauthorizedSessionHandling } from "@/utils/handleUnauthorizedSession";

function getSearchParamCaseInsensitive(
  params: URLSearchParams,
  name: string,
): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of params.entries()) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return null;
}

function normalizeLoginProvider(value: unknown) {
  return String(value ?? "").replace(
    /^[\s\u200B-\u200D\u2060\uFEFF\uFFFC]+|[\s\u200B-\u200D\u2060\uFEFF\uFFFC]+$/g,
    "",
  );
}

export default function Login() {
  const history = useHistory();
  const location = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const code = getSearchParamCaseInsensitive(urlParams, "code");
  const state = getSearchParamCaseInsensitive(urlParams, "state");
  const isOAuthCallback = !!code && !!state;
  const [inputType, setInputType] = useState("password");
  const [remember] = useState(false);
  const [activeLoginMethod, setActiveLoginMethod] = useState<
    "form" | "uae" | "microsoft" | null
  >(null);
  const [loginApiMessage, setLoginApiMessage] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<{
    isADLogin: boolean;
    isUAELogin: boolean;
  } | null>(null);
  const [showResetPasswordSuccess, setShowResetPasswordSuccess] =
    useState(false);
  const [form] = Form.useForm();
  const loginProviderWatch = Form.useWatch("loginProvider", form);
  const providerKeyWatch = Form.useWatch("providerKey", form);
  const isFormCredentialsReady = useMemo(
    () =>
      Boolean(
        String(loginProviderWatch ?? "").trim() &&
          String(providerKeyWatch ?? "").trim(),
      ),
    [loginProviderWatch, providerKeyWatch],
  );
  const { t, i18n } = useTranslation();
  const setData = useUserStore((state) => state.setData);
  const pendingMandatoryPasswordReset = isMandatoryAdminPasswordResetPending();
  const reset = useForgotPwdStore((state) => state.reset);
  const isLoading = activeLoginMethod !== null;
  const isFormLoading = activeLoginMethod === "form";
  const isMicrosoftLoading = activeLoginMethod === "microsoft";
  const isUaeLoading = activeLoginMethod === "uae";
  const isRtl = i18n.dir() === "rtl";
  const mountedRef = useRef(false);
  const handledUAECallbackRef = useRef("");

  useEffect(() => {
    mountedRef.current = true;

    resetUnauthorizedSessionHandling();
    const logoutNotice = consumeLogoutNotice();
    if (logoutNotice) {
      CustomMessage.error(logoutNotice);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleEyeClick() {
    setInputType(inputType === "password" ? "text" : "password");
  }


  useEffect(() => {
    const fieldsWithError = form
      .getFieldsError()
      .filter((field) => field.errors.length > 0)
      .map((field) => field.name);
    if (fieldsWithError.length > 0) {
      void form.validateFields(fieldsWithError).catch(() => undefined);
    }
  }, [form, i18n.language]);

  const goToForgotPassword = useCallback(() => {
    reset();
    history.push('/forgot-password');
  }, [history, reset]);

  const handleSubmit = useCallback(async () => {
    if (isLoading) return;
    const email = normalizeLoginProvider(form.getFieldValue("loginProvider"));
    const pwd = String(form.getFieldValue("providerKey") ?? "").trim();
    if (!email || !pwd) {
      return;
    }
    setLoginApiMessage(null);
    let fieldsValue: { loginProvider?: string; providerKey?: string };
    try {
      fieldsValue = await form.validateFields();
    } catch {
      return;
    }
    if (
      !normalizeLoginProvider(fieldsValue.loginProvider) ||
      !fieldsValue.providerKey?.trim()
    ) {
      return;
    }
    let shouldResetLoading = true;
    try {
      setActiveLoginMethod("form");
      const providerKey = aesEncrypt(fieldsValue.providerKey);
      const data = await request.post<
        { data: LoginUserData },
        { data: LoginUserData }
      >(
        "/api/AdminUser/Login",
        {
          ...fieldsValue,
          loginProvider: normalizeLoginProvider(fieldsValue.loginProvider),
          providerKey,
        },
        { skipErrorMessage: true },
      );

      if (data.data.isChangePwd) {
        persistMandatoryPasswordResetTokenOnly(data.data, remember);
        shouldResetLoading = false;
        history.push("/new-password");
        return;
      }

      completeLogin(data.data, setData, remember);
      CustomMessage.success(t("login.toastLoginSuccess"));
      shouldResetLoading = false;
      history.push("/");
    } catch (error: unknown) {
      const data = (error as { response?: { data?: { message?: unknown } } })
      .response?.data;
      const msg = typeof data?.message === "string" ? data.message.trim() : "";
      if (mountedRef.current) {
      setLoginApiMessage(msg);
      }
      console.error("Admin login failed:", error);
    } finally {
      if (shouldResetLoading && mountedRef.current) {
        setActiveLoginMethod(null);
      }
    }
  }, [form, history, isLoading, remember, setData, t]);

  useEffect(() => {
    const handleTextareaKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener("keydown", handleTextareaKeyDown);
    return () => {
      window.removeEventListener("keydown", handleTextareaKeyDown);
    };
  }, [handleSubmit]);

  const handleUAEPassLogin = useCallback(async () => {
    if (isLoading) return;
    setActiveLoginMethod("uae");
    let shouldResetLoading = true;
    try {
      localStorage.setItem("uaepassType", "1");
      if (!code) {
        const uaepassUrl = createUAEPassLoginUrl(import.meta.env.VITE_UAE_PASS_URL || "");
        shouldResetLoading = false;
        window.location.href = uaepassUrl;
        return;
      }
      if (!consumeUAEPassState(state || "")) {
        throw new Error("Invalid UAEPASS state");
      }
      const userInfo = await exchangeUAEPassCode(code, state || "");
      completeLogin(userInfo, setData, remember, "uaepass");

      notification.success({
        message: t("login.notifySuccessTitle"),
        description: t("login.notifyUaepassSuccess"),
      });
      shouldResetLoading = false;
      history.push("/");
    } catch {
      notification.error({
        message: t("login.notifyErrorTitle"),
        description: t("login.notifyUaepassFailed"),
      });
    } finally {
      if (shouldResetLoading && mountedRef.current) {
        setActiveLoginMethod(null);
      }
    }
  }, [code, history, isLoading, remember, setData, state, t]);

  const handleMicrosoftLogin = async () => {
    if (isLoading) return;

    try {
      setActiveLoginMethod("microsoft");
      const loginUrl = await fetchAzureADLoginUrl();
      window.location.href = loginUrl;
    } catch {
      CustomMessage.error(t("login.toastMicrosoftFailed"));
      if (mountedRef.current) {
        setActiveLoginMethod(null);
      }
    }
  };

  useEffect(() => {
    if (code && state) {
      const callbackKey = `${code}:${state}`;
      if (handledUAECallbackRef.current === callbackKey) {
        return;
      }
      handledUAECallbackRef.current = callbackKey;
      handleUAEPassLogin();
    }
  }, [code, handleUAEPassLogin, state]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const flags = await fetchLoginMethodFlags();
        if (!cancelled) setLoginMethod(flags);
      } catch {
        if (!cancelled) {
          setLoginMethod({ isADLogin: false, isUAELogin: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resetPasswordSuccess = getSearchParamCaseInsensitive(
      params,
      "passwordResetSuccess",
    );

    if (resetPasswordSuccess !== "1") {
      return;
    }

    setShowResetPasswordSuccess(true);

    const next = new URLSearchParams();
    for (const [key, value] of params.entries()) {
      if (key.toLowerCase() !== "passwordresetsuccess") {
        next.append(key, value);
      }
    }

    const search = next.toString();
    history.replace({
      pathname: location.pathname,
      search: search ? `?${search}` : "",
      hash: location.hash,
    });
  }, [history, location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!showResetPasswordSuccess) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowResetPasswordSuccess(false);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showResetPasswordSuccess]);

  if (
    authService.isAuthenticated() &&
    !isOAuthCallback &&
    !pendingMandatoryPasswordReset
  ) {
    return <Redirect to="/" />;
  }

  return (
    <SimpleBar
      className="login-page-scroll"
      dir={isRtl ? "rtl" : "ltr"}
      data-simplebar-direction={isRtl ? "rtl" : "ltr"}
    >
      <div className="login-wrapper">
        <PublicAuthHeader />
        {showResetPasswordSuccess ? (
          <div
            className={`login-reset-success${
              isRtl ? " login-reset-success--rtl" : ""
            }`}
            dir={isRtl ? "rtl" : "ltr"}
          >
            <Alert
              type="success"
              showIcon
              message={t("pwdResetSuccess.description")}
              className="login-reset-success__alert"
            />
          </div>
        ) : null}
        <div className="login-main">
          <div className="login-box">
            <div className="login-header">
              <div className="login-header-title">{t("login.title")}</div>
              <div className="login-header-desc">{t("login.desc")}</div>
            </div>

        {loginMethod?.isUAELogin ? (
          <div
            className={`login-type login-uae-pass ${
              isUaeLoading ? "loading" : ""
            } ${isLoading ? "disabled" : ""}`}
            onClick={handleUAEPassLogin}
          >
            <img src={fingerprintImg} alt="" className="login-uae-pass-icon" />
            <div className="login-type-text">
              {t("login.uae")}
              {isUaeLoading ? (
                <LoadingOutlined className="login-spinner" />
              ) : null}
            </div>
          </div>
        ) : null}

        {loginMethod?.isADLogin ? (
          <div
            className={`login-type login-microsoft ${
              isMicrosoftLoading ? "loading" : ""
            } ${isLoading ? "disabled" : ""}`}
            onClick={handleMicrosoftLogin}
          >
            <img src={microsoftImg} alt="" />
            <div className="login-type-text">
              {t("login.azure")}
              {isMicrosoftLoading ? (
                <LoadingOutlined className="login-spinner" />
              ) : null}
            </div>
          </div>
        ) : null}

        {loginMethod && (loginMethod.isUAELogin || loginMethod.isADLogin) ? (
          <div className="login-divider">
            <div className="login-divider-text">{t("login.or")}</div>
          </div>
        ) : null}
        <FormErrorPrompt
          message={loginApiMessage}
          onInlineActionClick={
            loginApiMessage && hasForgotPasswordHint(loginApiMessage)
              ? goToForgotPassword
              : undefined
          }
        />
        <Form
          form={form}
          className="custorm-form"
          layout="vertical"
          requiredMark={false}
          onValuesChange={() => setLoginApiMessage(null)}
        >
          <Form.Item
            name="loginProvider"
            label={t('login.form.email')}
            normalize={normalizeLoginProvider}
            rules={[
              { required: true, message: t('login.form.required') },
              {
                pattern:
                  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: t('signup.please.emailFormat'),
              },
            ]}
          >
            <Input
              allowClear
              autoComplete="username"
              placeholder={t("login.form.emailPlace")}
            />
          </Form.Item>
          <Form.Item 
            name="providerKey" 
            label={t("login.form.password")}
            rules={[
              { required: true, message: t('login.form.required') },
            ]}
          >
            <Input
              autoComplete="current-password"
              placeholder={t("login.form.passwordPlace")}
              type={inputType}
              suffix={
                inputType === "text" ? (
                  <EyeView onClick={handleEyeClick} className="icon-eye" />
                ) : (
                  <Eye onClick={handleEyeClick} className="icon-eye" />
                )
              }
            />
          </Form.Item>
          <div className="remember">
            <div />
            <div
              className="forget"
              onClick={() => {
                reset();
                history.push("/forgot-password");
              }}
            >
              {t("login.forget")}
            </div>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => void handleSubmit()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className={[
              "login-btn",
              isFormLoading ? "loading" : "",
              isLoading && !isFormLoading ? "disabled" : "",
              !isFormCredentialsReady && !isFormLoading
                ? "login-btn--inactive"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="login-btn-text">
              {t("login.title")}
              {isFormLoading ? (
                <LoadingOutlined className="login-spinner" />
              ) : null}
            </span>
          </div>
        </Form>
          </div>
        </div>
      </div>
    </SimpleBar>
  );
}
