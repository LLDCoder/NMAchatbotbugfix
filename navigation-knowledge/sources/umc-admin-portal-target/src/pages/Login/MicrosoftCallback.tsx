import { useEffect, useState } from "react";
import { LoadingOutlined } from "@ant-design/icons";
import { useHistory } from "react-router-dom";
import { CustomMessage } from "@/components/common";
import { useUserStore } from "@/store/user";
import { completeLogin, exchangeAzureADCode } from "@/pages/Login/auth";
import { useTranslation } from "react-i18next";
import "./index.css";

export default function MicrosoftCallback() {
  const history = useHistory();
  const { i18n, t } = useTranslation();
  const setData = useUserStore((state) => state.setData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      if (!code || !state) {
        CustomMessage.error(i18n.t("login.toastMicrosoftFailed"));
        history.replace("/login");
        return;
      }

      try {
        const userInfo = await exchangeAzureADCode(code, state);

        if (!mounted) {
          return;
        }

        completeLogin(userInfo, setData, false, "microsoft");
        CustomMessage.success(i18n.t("login.toastLoginSuccess"));
        history.replace("/");
      } catch {
        if (!mounted) {
          return;
        }

        CustomMessage.error(i18n.t("login.toastMicrosoftFailed"));
        history.replace("/login");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void handleCallback();

    return () => {
      mounted = false;
    };
  }, [history, i18n, setData]);

  return (
    <div className="login-wrapper login-callback-wrapper">
      <div className="login-callback-card">
        <LoadingOutlined className="login-callback-icon" />
        <div className="login-callback-title">
          {loading
            ? t("login.microsoftCallback.signingIn")
            : t("login.microsoftCallback.redirecting")}
        </div>
      </div>
    </div>
  );
}
