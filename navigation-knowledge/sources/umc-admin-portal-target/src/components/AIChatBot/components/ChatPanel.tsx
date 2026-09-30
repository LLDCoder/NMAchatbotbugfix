import {
  ArrowsAltOutlined,
  CheckCircleFilled,
  CloseOutlined,
  ClockCircleOutlined,
  CompressOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LoadingOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Modal } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import sendIcon from "@/assets/images/ai-chat-send.png";
import dashboardDeadlineIcon from "@/assets/images/ai-dashboard-deadlines.svg";
import dashboardOverdueIcon from "@/assets/images/ai-dashboard-overdue.svg";
import dashboardOverviewIcon from "@/assets/images/ai-dashboard-overview.svg";
import dashboardPrioritizeIcon from "@/assets/images/ai-dashboard-prioritize.svg";
import { authService } from "@/services/auth";
import { fileUpload, getDocumentUploadResponseUrl } from "@/services/media";
import { history } from "@/utils/history";
import { resolvePortalActionNavigation } from "../model/actions";
import { storePortalReturnUrl } from "../model/cards";
import { getDshChatErrorPresentation } from "../model/dshErrors";
import {
  getDshChatErrorMessage,
  type DshChatController,
} from "../model/dshWorkflow";
import type { ChatAttachment, ChatLanguage, ScenarioAction } from "../model/types";
import { HistoryPreview } from "./HistoryPreview";
import { Mascot } from "./Mascot";
import { MessageView } from "./MessageView";
import "./ChatPanel.less";

interface ChatPanelProps {
  customerChat: DshChatController;
  language: ChatLanguage;
  fullscreen: boolean;
  onClose: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
}

function trimOrFallback(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function getMostRecentConversation(
  conversations: DshChatController["conversations"],
) {
  return conversations.reduce<typeof conversations[number] | undefined>(
    (mostRecent, conversation) => {
      if (!mostRecent) return conversation;
      const mostRecentTime = Date.parse(
        mostRecent.lastActivityAt || mostRecent.createdAt || "",
      );
      const conversationTime = Date.parse(
        conversation.lastActivityAt || conversation.createdAt || "",
      );
      return conversationTime > mostRecentTime ? conversation : mostRecent;
    },
    undefined,
  );
}

export function ChatPanel({
  customerChat,
  language,
  fullscreen,
  onClose,
  onFullscreenChange,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment>();
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [toast, setToast] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [deleteId, setDeleteId] = useState<string>();
  const chatBodyRef = useRef<HTMLElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const lastCompletionRevisionRef = useRef(customerChat.completionRevision);
  const lastLiveMessage = customerChat.messages[customerChat.messages.length - 1];
  const configErrorPresentation = customerChat.configError
    ? getDshChatErrorPresentation(customerChat.configError)
    : null;
  const messageErrorPresentation = customerChat.messageError
    ? getDshChatErrorPresentation(customerChat.messageError)
    : null;

  useEffect(() => {
    if (!chatBodyRef.current) return;
    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [lastLiveMessage?.id, lastLiveMessage?.text]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (lastCompletionRevisionRef.current !== customerChat.completionRevision) {
      setAnnouncement(t("aiChatBot.chat.responseComplete"));
    }
    lastCompletionRevisionRef.current = customerChat.completionRevision;
  }, [customerChat.completionRevision, t]);

  const showToast = (message: string) =>
    setToast(message === "copy" ? t("aiChatBot.chat.copied") : message);

  const handleAction = (action: string | ScenarioAction) => {
    if (typeof action === "string") {
      showToast(action);
      return;
    }

    const navigation = resolvePortalActionNavigation(
      action,
      authService.isAuthenticated(),
    );
    if (!navigation) {
      showToast(action.label);
      return;
    }

    if (navigation.returnUrl) storePortalReturnUrl(navigation.returnUrl);
    history.push(navigation.path);
  };

  const headerTitle = trimOrFallback(
    customerChat.config?.name,
    t("aiChatBot.chat.assistantName"),
  );
  const showWelcome = !customerChat.messages.length && !customerChat.messagesLoading;
  const canSend = Boolean(
    !customerChat.streaming &&
      !attachmentUploading &&
      (input.trim() || pendingAttachment) &&
      customerChat.config &&
      !customerChat.configLoading,
  );
  const composerDisabled = Boolean(
    customerChat.streaming ||
      !customerChat.config ||
      customerChat.configLoading ||
      attachmentUploading,
  );

  const clearPendingAttachment = () => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(undefined);
    setAttachmentError("");
  };

  const uploadAttachment = async (file: File) => {
    const lowerCaseName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerCaseName.endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setAttachmentError(t("aiChatBot.chat.errors.fileType"));
      return;
    }

    clearPendingAttachment();
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    setAttachmentUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fileUpload(formData);
      const fileUrl = getDocumentUploadResponseUrl(response);
      if (!fileUrl) throw new Error("Missing uploaded file URL.");
      setPendingAttachment({
        fileRef: fileUrl,
        fileName: file.name,
        fileUrl,
        fileType: isPdf ? 0 : 1,
        kind: isPdf ? "pdf" : "image",
        mimeType: file.type || (isPdf ? "application/pdf" : "image/*"),
        previewUrl,
      });
      // Attachments are OCR-only turns for now, so they cannot be combined
      // with text that may have been entered before the file was selected.
      setInput("");
    } catch {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setAttachmentError(t("aiChatBot.chat.errors.attachmentUpload"));
    } finally {
      setAttachmentUploading(false);
    }
  };

  const startNewChat = () => {
    setHistoryOpen(false);
    customerChat.startNewConversation();
    setInput("");
    clearPendingAttachment();
    showToast(t("aiChatBot.chat.newChatStarted"));
  };

  const submit = () => {
    const prompt = input.trim();
    if (!prompt && !pendingAttachment) return;
    const attachment = pendingAttachment;
    const outgoingAttachment = attachment
      ? { ...attachment, previewUrl: undefined }
      : undefined;
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setInput("");
    setPendingAttachment(undefined);
    setAttachmentError("");
    void customerChat.send(prompt, undefined, prompt, outgoingAttachment);
  };

  const openConversation = async (conversationId: string) => {
    const loaded = await customerChat.loadConversation(conversationId);
    if (loaded) setHistoryOpen(false);
  };

  const recentConversation = getMostRecentConversation(customerChat.conversations);
  const welcomeServices: Array<{
    icon: string;
    label: string;
  } & (
    | { onClick: () => void; prompt?: never }
    | { onClick?: never; prompt: string }
  )> = [
    {
      icon: dashboardDeadlineIcon,
      label: recentConversation
        ? t("aiChatBot.chat.recentConversation")
        : t("aiChatBot.chat.noRecentConversation"),
      onClick: () => {
        if (recentConversation) void openConversation(recentConversation.conversationId);
        else startNewChat();
      },
    },
    {
      icon: dashboardOverdueIcon,
      label: t("aiChatBot.chat.capabilities"),
      prompt: t("aiChatBot.chat.capabilities"),
    },
    {
      icon: dashboardPrioritizeIcon,
      label: t("aiChatBot.chat.needsAttention"),
      prompt: t("aiChatBot.chat.needsAttention"),
    },
    {
      icon: dashboardOverviewIcon,
      label: t("aiChatBot.chat.dashboardOverview"),
      prompt: t("aiChatBot.chat.dashboardOverview"),
    },
  ];

  const historyLoading = customerChat.historyLoading || customerChat.messagesLoading;

  return (
    <section
      aria-label={headerTitle}
      className={`ai-chatbot__chat-panel ${fullscreen ? "ai-chatbot__chat-panel-fullscreen" : ""}`}
    >
      <header className="ai-chatbot__chat-header">
        <button
          aria-label={t("aiChatBot.chat.history")}
          className="ai-chatbot__header-button"
          title={t("aiChatBot.chat.history")}
          type="button"
          onClick={() => {
            const next = !historyOpen;
            setHistoryOpen(next);
            if (next) void customerChat.refreshConversations();
          }}
        >
          <ClockCircleOutlined />
        </button>

        <div className="ai-chatbot__header-title-block">
          <Mascot />
          <div className="ai-chatbot__header-text">
            <div className="ai-chatbot__header-name">{headerTitle}</div>
            <div className="ai-chatbot__header-status">{t("aiChatBot.chat.online")}</div>
          </div>
        </div>

        <button
          aria-label={t(fullscreen ? "aiChatBot.chat.collapse" : "aiChatBot.chat.expand")}
          className={`ai-chatbot__header-button ai-chatbot__header-action-optional`}
          title={t(fullscreen ? "aiChatBot.chat.collapse" : "aiChatBot.chat.expand")}
          type="button"
          onClick={() => onFullscreenChange(!fullscreen)}
        >
          {fullscreen ? <CompressOutlined /> : <ArrowsAltOutlined />}
        </button>
        <button
          aria-label={t("aiChatBot.chat.newChat")}
          className={`ai-chatbot__header-button ai-chatbot__header-action-optional`}
          title={t("aiChatBot.chat.newChat")}
          type="button"
          onClick={startNewChat}
        >
          <PlusOutlined />
        </button>
        <button
          aria-label={t("aiChatBot.chat.close")}
          className="ai-chatbot__header-button"
          title={t("aiChatBot.chat.close")}
          type="button"
          onClick={onClose}
        >
          <CloseOutlined />
        </button>
      </header>

      <main className="ai-chatbot__chat-body" ref={chatBodyRef}>
        {customerChat.configLoading && !customerChat.config ? (
          <div className="ai-chatbot__live-loading">
            <LoadingOutlined />
            {t("aiChatBot.chat.loadingWorkflow")}
          </div>
        ) : null}
        {customerChat.configError && !customerChat.config ? (
          <div className="ai-chatbot__live-error ai-chatbot__message-error" role="alert">
            <InfoCircleOutlined />
            <div className="ai-chatbot__message-error-copy">
              <strong>{t(configErrorPresentation?.titleKey || "aiChatBot.chat.errors.titles.generic")}</strong>
              <span>{getDshChatErrorMessage(customerChat.configError, language)}</span>
            </div>
            {configErrorPresentation?.retryable ? (
              <button type="button" onClick={() => void customerChat.retryConfiguration()}>
                <ReloadOutlined />
                {t("aiChatBot.chat.retry")}
              </button>
            ) : null}
          </div>
        ) : null}
        {showWelcome && !(customerChat.configLoading && !customerChat.config) ? (
          <div className="ai-chatbot__welcome">
            <div className="ai-chatbot__quick-heading">
              {t("aiChatBot.chat.quickActions")}
            </div>
            <div className="ai-chatbot__quick-grid">
              {welcomeServices.map((service) => (
                <button
                  className="ai-chatbot__quick-card"
                  key={service.label}
                  type="button"
                  onClick={() => {
                    if (service.onClick) service.onClick();
                    else setInput(service.prompt);
                  }}
                >
                  <img alt="" className="ai-chatbot__quick-icon" src={service.icon} />
                  <span className="ai-chatbot__quick-label">{service.label}</span>
                  {language.startsWith("ar") ? (
                    <LeftOutlined aria-hidden="true" className="ai-chatbot__quick-chevron" />
                  ) : (
                    <RightOutlined aria-hidden="true" className="ai-chatbot__quick-chevron" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ai-chatbot__conversation">
            {customerChat.messages.map((message) => (
              <MessageView
                key={message.id}
                language={language}
                message={message}
                onAction={handleAction}
                onChoice={(choice) => void customerChat.selectChoice(message.id, choice)}
                onFeedback={message.eventSeq === undefined ? undefined : async (rating, reason) => {
                  return customerChat.submitFeedback(message.id, message.eventSeq!, rating, reason);
                }}
                onInteractionAction={customerChat.respondToInteraction}
                onUploadInteraction={customerChat.uploadInteraction}
              />
            ))}
            {customerChat.messagesLoading ? (
              <div className="ai-chatbot__live-loading">
                <LoadingOutlined />
                {t("aiChatBot.chat.loadingMessages")}
              </div>
            ) : null}
            {customerChat.messageError && messageErrorPresentation ? (
              <div className="ai-chatbot__live-error ai-chatbot__message-error" role="alert">
                <InfoCircleOutlined />
                <div className="ai-chatbot__message-error-copy">
                  <strong>{t(messageErrorPresentation.titleKey)}</strong>
                  <span>{getDshChatErrorMessage(customerChat.messageError, language)}</span>
                </div>
                {messageErrorPresentation.startNewChat ? (
                  <button type="button" onClick={startNewChat}>
                    <PlusOutlined />
                    {t("aiChatBot.chat.newChat")}
                  </button>
                ) : messageErrorPresentation.retryable &&
                  (customerChat.lastFailedPrompt || customerChat.lastFailedAttachment) ? (
                  <button
                    disabled={customerChat.streaming}
                    type="button"
                    onClick={() =>
                      void customerChat.send(
                        customerChat.lastFailedPrompt,
                        undefined,
                        customerChat.lastFailedDisplayPrompt,
                        customerChat.lastFailedAttachment,
                      )
                    }
                  >
                    <ReloadOutlined />
                    {t("aiChatBot.chat.retry")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </main>

      <footer className="ai-chatbot__composer-wrap">
        <input
          ref={attachmentInputRef}
          accept="image/*,application/pdf"
          className="ai-chatbot__hidden-file-input"
          disabled={Boolean(composerDisabled || pendingAttachment)}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void uploadAttachment(file);
          }}
        />
        {pendingAttachment || attachmentUploading || attachmentError ? (
          <div className="ai-chatbot__composer-attachment">
            {pendingAttachment?.kind === "image" && pendingAttachment.previewUrl ? (
              <img alt="" className="ai-chatbot__composer-attachment-preview" src={pendingAttachment.previewUrl} />
            ) : (
              <FilePdfOutlined className="ai-chatbot__composer-attachment-icon" />
            )}
            <span className="ai-chatbot__composer-attachment-name">
              {attachmentUploading
                ? t("aiChatBot.chat.uploading")
                : pendingAttachment?.fileName ?? attachmentError}
            </span>
            {pendingAttachment ? (
              <button
                aria-label={t("aiChatBot.chat.removeAttachment")}
                className="ai-chatbot__composer-attachment-remove"
                title={t("aiChatBot.chat.removeAttachment")}
                type="button"
                disabled={attachmentUploading || customerChat.streaming}
                onClick={clearPendingAttachment}
              >
                <CloseOutlined />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="ai-chatbot__composer">
          <button
            aria-label={t("aiChatBot.chat.attachFile")}
            className="ai-chatbot__attachment-button"
            disabled={Boolean(composerDisabled || pendingAttachment)}
            title={t("aiChatBot.chat.attachFile")}
            type="button"
            onClick={() => attachmentInputRef.current?.click()}
          >
            {attachmentUploading ? <LoadingOutlined /> : <PaperClipOutlined />}
          </button>
          <input
            aria-label={t("aiChatBot.chat.placeholder")}
            disabled={Boolean(composerDisabled || pendingAttachment)}
            placeholder={t("aiChatBot.chat.placeholder")}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (customerChat.streaming) customerChat.stopStreaming();
                else submit();
              }
            }}
          />
          <button
            aria-label={t(customerChat.streaming ? "aiChatBot.chat.stop" : "aiChatBot.chat.send")}
            className="ai-chatbot__send-button"
            disabled={!customerChat.streaming && !canSend}
            type="button"
            onClick={() => {
              if (customerChat.streaming) customerChat.stopStreaming();
              else submit();
            }}
          >
            {customerChat.streaming ? <StopOutlined /> : <img alt="" src={sendIcon} />}
          </button>
        </div>
        <div className="ai-chatbot__disclaimer">{t("aiChatBot.chat.disclaimer")}</div>
      </footer>

      {historyOpen ? (
        <HistoryPreview
          activeConversationId={customerChat.activeConversationId}
          conversations={customerChat.conversations}
          deletePendingId={customerChat.deletePendingId}
          error={customerChat.historyError}
          language={language}
          loading={historyLoading}
          onBack={onClose}
          onDelete={setDeleteId}
          onNewChat={startNewChat}
          onOpen={(conversationId) => void openConversation(conversationId)}
          onRefresh={() => void customerChat.refreshConversations()}
        />
      ) : null}

      {toast ? (
        <div aria-live="polite" className="ai-chatbot__toast" role="status">
          <CheckCircleFilled className="ai-chatbot__toast-icon" />
          <span className="ai-chatbot__toast-text">{toast}</span>
        </div>
      ) : null}
      <div aria-atomic="true" aria-live="polite" className="ai-chatbot__sr-only" role="status">
        {announcement}
      </div>

      <Modal
        centered
        cancelText={t("aiChatBot.chat.cancel")}
        confirmLoading={Boolean(customerChat.deletePendingId)}
        destroyOnClose
        focusTriggerAfterClose
        keyboard
        maskClosable={false}
        okButtonProps={{ danger: true }}
        okText={t("aiChatBot.chat.delete")}
        title={t("aiChatBot.chat.deleteTitle")}
        visible={Boolean(deleteId)}
        zIndex={10002}
        onCancel={() => setDeleteId(undefined)}
        onOk={async () => {
          if (!deleteId) return;
          const deleted = await customerChat.deleteConversation(deleteId);
          if (!deleted) return;
          setDeleteId(undefined);
          const message = t("aiChatBot.chat.conversationDeleted");
          showToast(message);
          setAnnouncement(message);
        }}
      >
        <p>{t("aiChatBot.chat.deleteBody")}</p>
      </Modal>
    </section>
  );
}
