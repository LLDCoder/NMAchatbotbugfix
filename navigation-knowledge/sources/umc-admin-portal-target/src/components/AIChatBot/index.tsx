import { CloseOutlined, RightOutlined } from "@ant-design/icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import aiChatbotRobot from "@/assets/images/ai-chatbot-avatar.png";
import { useUserStore } from "@/store/user";
import { useAdminAuthToken } from "./model/adminIdentity";
import { ChatBotContent } from "./ChatBotContent";
import { openAiChatBotEvent } from "./featureFlag";
import "./index.less";

interface ChatBotErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
  resetKey: string;
}

interface ChatBotErrorBoundaryState {
  hasError: boolean;
}

/**
 * The widget is mounted directly under the portal Layout, outside the route
 * error boundaries. Keep a Chatbot render failure local to the widget so it
 * can never unmount the Admin dashboard.
 */
class ChatBotErrorBoundary extends React.Component<
  ChatBotErrorBoundaryProps,
  ChatBotErrorBoundaryState
> {
  state: ChatBotErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previous: ChatBotErrorBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("[ai-chatbot] Failed to render widget", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="ai-chatbot__auth-state" role="alert">
        <strong>The AI assistant could not display this response.</strong>
        <button type="button" onClick={this.props.onReset}>Close and try again</button>
      </div>
    );
  }
}

export default function AIChatBot() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const adminToken = useAdminAuthToken();
  const userId = useUserStore((state) => state.userInfo.id);
  const authenticated = Boolean(adminToken && userId);

  useEffect(() => {
    if (!open || collapsed) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !document.querySelector('[role="dialog"][aria-modal="true"]')
      ) {
        setExpanded(false);
        setCollapsed(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed, open]);

  useEffect(() => {
    const openChatBot = () => {
      setOpen(true);
      setCollapsed(false);
    };
    window.addEventListener(openAiChatBotEvent, openChatBot);
    return () => window.removeEventListener(openAiChatBotEvent, openChatBot);
  }, []);

  const close = () => {
    setExpanded(false);
    setCollapsed(false);
    setOpen(false);
  };

  const collapse = () => {
    setExpanded(false);
    setCollapsed(true);
  };

  const showPanel = () => {
    setOpen(true);
    setCollapsed(false);
  };

  return (
    <div className="ai-chatbot__widget">
      {open ? (
        <section
          id="nma-ai-chatbot-panel"
          aria-label={t("aiChatBot.panelLabel")}
          aria-modal="false"
          aria-hidden={collapsed}
          className={`ai-chatbot__panel ${expanded ? "ai-chatbot__panel-expanded" : ""} ${collapsed ? "ai-chatbot__panel-collapsed" : ""}`}
          role="dialog"
        >
          {authenticated ? (
            <ChatBotErrorBoundary
              onReset={close}
              resetKey={`${open}:${adminToken ? "authenticated" : "anonymous"}`}
            >
              <ChatBotContent
                expanded={expanded}
                onClose={close}
                onExpandedChange={setExpanded}
              />
            </ChatBotErrorBoundary>
          ) : (
            <div className="ai-chatbot__auth-state" role="alert">
              <button
                aria-label={t("aiChatBot.close")}
                className="ai-chatbot__login-close"
                title={t("aiChatBot.close")}
                type="button"
                onClick={close}
              >
                <CloseOutlined />
              </button>
              <strong>{t("aiChatBot.validationError")}</strong>
            </div>
          )}
        </section>
      ) : null}
      {!expanded ? (
        <button
          aria-controls="nma-ai-chatbot-panel"
          aria-expanded={open && !collapsed}
          aria-label={t(open && !collapsed ? "aiChatBot.collapse" : "aiChatBot.open")}
          className="ai-chatbot__launcher"
          title={t(open && !collapsed ? "aiChatBot.collapse" : "aiChatBot.open")}
          type="button"
          onClick={() => (open && !collapsed ? collapse() : showPanel())}
        >
          {open && !collapsed ? (
            <span aria-hidden="true" className="ai-chatbot__collapse-badge">
              <RightOutlined />
            </span>
          ) : (
            <span aria-hidden="true" className="ai-chatbot__robot-badge">
              <span className="ai-chatbot__robot-crop">
                <img alt="" draggable="false" src={aiChatbotRobot} />
              </span>
            </span>
          )}
        </button>
      ) : null}
    </div>
  );
}
