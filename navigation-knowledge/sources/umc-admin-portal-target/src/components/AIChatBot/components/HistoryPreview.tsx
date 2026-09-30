import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  MessageOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { DshConversation } from "@/services/dshChat";
import { getDshChatErrorMessage } from "../model/dshWorkflow";
import { filterAndGroupConversations, formatConversationTime } from "../model/history";
import type { ChatLanguage } from "../model/types";
import "./HistoryPreview.less";

interface HistoryPreviewProps {
  activeConversationId?: string;
  conversations?: DshConversation[];
  deletePendingId?: string;
  error?: unknown;
  language: ChatLanguage;
  loading?: boolean;
  onBack: () => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onOpen: (id: string) => void;
  onRefresh?: () => void;
}

function withVisibleTitle(
  conversation: DshConversation,
  untitledConversation: string,
) {
  const trimmedTitle = conversation.title.trim();
  return {
    ...conversation,
    title: trimmedTitle || untitledConversation,
  };
}

export function HistoryPreview({
  activeConversationId,
  conversations = [],
  deletePendingId,
  error,
  language,
  loading = false,
  onBack,
  onNewChat,
  onOpen,
  onDelete,
  onRefresh,
}: HistoryPreviewProps) {
  const { t } = useTranslation();
  const normalizedConversations = useMemo(
    () => conversations.map((conversation) => withVisibleTitle(
      conversation,
      t("aiChatBot.chat.untitledConversation"),
    )),
    [conversations, t],
  );
  const visibleConversations = useMemo(() => {
    const grouped = filterAndGroupConversations(normalizedConversations, "");
    return [...grouped.today, ...grouped.yesterday, ...grouped.earlier];
  }, [normalizedConversations]);

  return (
    <div className="ai-chatbot__history-overlay">
      <header className="ai-chatbot__history-header">
        <div className="ai-chatbot__history-title">
          <ClockCircleOutlined />
          <h2>{t("aiChatBot.chat.history")}</h2>
        </div>
        <div className="ai-chatbot__history-actions">
          <button
            aria-label={t("aiChatBot.chat.newChat")}
            title={t("aiChatBot.chat.newChat")}
            type="button"
            onClick={onNewChat}
          >
            <EditOutlined />
          </button>
          <button
            aria-label={t("aiChatBot.chat.close")}
            title={t("aiChatBot.chat.close")}
            type="button"
            onClick={onBack}
          >
            <CloseCircleOutlined />
          </button>
        </div>
      </header>

      <div className="ai-chatbot__history-list">
        {error ? (
          <div className="ai-chatbot__history-error" role="alert">
            <span>{getDshChatErrorMessage(error, language)}</span>
            <button type="button" onClick={onRefresh}>
              <ReloadOutlined />
              {t("aiChatBot.chat.retry")}
            </button>
          </div>
        ) : null}
        {loading && !normalizedConversations.length ? (
          <div className="ai-chatbot__history-loading">
            <LoadingOutlined />
            {t("aiChatBot.chat.loadingHistory")}
          </div>
        ) : null}
        {visibleConversations.map((conversation) => {
          const active = conversation.conversationId === activeConversationId;
          const formattedTime = formatConversationTime(conversation.lastActivityAt || "", language);
          return (
            <div
              className={`ai-chatbot__history-item ${active ? "ai-chatbot__history-item-active" : ""}`}
              key={conversation.conversationId}
            >
              <button
                aria-current={active ? "true" : undefined}
                className="ai-chatbot__history-open"
                disabled={loading}
                type="button"
                onClick={() => onOpen(conversation.conversationId)}
              >
                <span className="ai-chatbot__history-icon">
                  <MessageOutlined />
                </span>
                <span className="ai-chatbot__history-body">
                  <strong>{conversation.title}</strong>
                  <time dateTime={conversation.lastActivityAt || ""}>{formattedTime}</time>
                </span>
              </button>
              <button
                aria-label={t("aiChatBot.chat.deleteConversation")}
                className="ai-chatbot__history-delete"
                disabled={Boolean(deletePendingId)}
                title={t("aiChatBot.chat.deleteConversation")}
                type="button"
                onClick={() => onDelete(conversation.conversationId)}
              >
                {deletePendingId === conversation.conversationId ? <LoadingOutlined /> : <DeleteOutlined />}
              </button>
            </div>
          );
        })}
        {!loading && !visibleConversations.length ? (
          <div className="ai-chatbot__empty-history">{t("aiChatBot.chat.noHistory")}</div>
        ) : null}
      </div>
    </div>
  );
}
