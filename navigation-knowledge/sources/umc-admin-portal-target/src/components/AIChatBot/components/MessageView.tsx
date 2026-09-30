import {
  CheckOutlined,
  CopyOutlined,
  EditOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  LinkOutlined,
  LoadingOutlined,
  UploadOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  ChatLanguage,
  ScenarioAction,
  ScenarioChoice,
  ScenarioMessage,
  WorkflowInteraction,
} from "../model/types";
import { copyToClipboard } from "@/utils/copy";
import { getAppConfig } from "@/config/appConfig";
import { resolveDocumentAccessUrl } from "@/utils/pdfPreview";
import { MarkdownContent } from "./MarkdownContent";
import { renderBidiText } from "./BidiText";
import { ChatCardList } from "./ChatCardList";
import { Mascot } from "./Mascot";
import { StructuredArtifactList } from "./StructuredArtifactList";
import { normalizeChatCards } from "../model/cards";
import { formatMessageForCopy } from "../model/messageCopy";
import copyIcon from "@/assets/images/ai-chat-copy.svg";
import thumbDownIcon from "@/assets/images/ai-chat-thumb-down.svg";
import thumbDownFilledIcon from "@/assets/images/ai-chat-thumb-down-filled.svg";
import thumbUpIcon from "@/assets/images/ai-chat-thumb-up.svg";
import thumbUpFilledIcon from "@/assets/images/ai-chat-thumb-up-filled.svg";
import "./MessageView.less";

const FEEDBACK_DOWN_REASONS = [
  "inaccurate",
  "irrelevant",
  "incomplete",
  "outdated",
  "other",
] as const;

interface MessageViewProps {
  language: ChatLanguage;
  message: ScenarioMessage;
  onAction?: (action: string | ScenarioAction) => void;
  onChoice?: (choice: ScenarioChoice) => void;
  onInteractionAction?: (
    interactionId: string,
    action: "confirm" | "modify" | "cancel",
  ) => Promise<void>;
  onUploadInteraction?: (
    interaction: WorkflowInteraction,
    file: File,
  ) => Promise<boolean>;
  onFeedback?: (rating: "up" | "down" | null, reason?: string) => Promise<boolean>;
}

interface InteractionControlProps {
  interaction: WorkflowInteraction;
  onAction?: MessageViewProps["onInteractionAction"];
  onUpload?: MessageViewProps["onUploadInteraction"];
}

function InteractionControl({ interaction, onAction, onUpload }: InteractionControlProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [responding, setResponding] = useState(false);
  const pending = interaction.status === "pending";
  const summaryEntries =
    interaction.summary && typeof interaction.summary === "object"
      ? Object.entries(interaction.summary)
      : [];

  const respond = async (action: "confirm" | "modify") => {
    if (!onAction || responding || !pending) return;
    setResponding(true);
    try {
      await onAction(interaction.id, action);
    } finally {
      setResponding(false);
    }
  };

  if (interaction.kind === "file_upload") {
    const uploading = interaction.client_status === "uploading";
    return (
      <section className="ai-chatbot__interaction-panel">
        <input
          ref={inputRef}
          accept={
            interaction.constraints?.accept ??
            interaction.constraints?.accepted_media_types?.join(",")
          }
          className="ai-chatbot__hidden-file-input"
          disabled={!pending || uploading}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file && onUpload) void onUpload(interaction, file);
          }}
        />
        <button
          className="ai-chatbot__interaction-primary-button"
          disabled={!pending || uploading}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <LoadingOutlined /> : interaction.status === "completed" ? <CheckOutlined /> : <UploadOutlined />}
          {uploading
            ? t("aiChatBot.chat.uploading")
            : interaction.status === "completed"
              ? t("aiChatBot.chat.uploadCompleted")
              : t(interaction.client_status === "failed"
                ? "aiChatBot.chat.replaceFile"
                : "aiChatBot.chat.uploadFile")}
        </button>
        {interaction.client_error ? (
          <span className="ai-chatbot__interaction-error" role="alert">{interaction.client_error}</span>
        ) : null}
        {interaction.status === "expired" ? (
          <span className="ai-chatbot__interaction-status">{t("aiChatBot.chat.interactionExpired")}</span>
        ) : null}
        {interaction.status === "completed" && interaction.uploaded_file_name ? (
          <span className="ai-chatbot__interaction-status">{interaction.uploaded_file_name}</span>
        ) : null}
      </section>
    );
  }

  return (
    <section className="ai-chatbot__interaction-panel">
      <strong className="ai-chatbot__interaction-title">{t("aiChatBot.chat.confirmationSummary")}</strong>
      {typeof interaction.summary === "string" ? <p>{interaction.summary}</p> : null}
      {summaryEntries.length ? (
        <dl className="ai-chatbot__interaction-summary">
          {summaryEntries.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{typeof value === "string" || typeof value === "number" ? String(value) : "-"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="ai-chatbot__interaction-actions">
        <button
          className="ai-chatbot__interaction-primary-button"
          disabled={!pending || responding}
          type="button"
          onClick={() => void respond("confirm")}
        >
          {responding ? <LoadingOutlined /> : <CheckOutlined />}
          {t("aiChatBot.chat.confirm")}
        </button>
        <button
          className="ai-chatbot__interaction-secondary-button"
          disabled={!pending || responding}
          type="button"
          onClick={() => void respond("modify")}
        >
          <EditOutlined />
          {t("aiChatBot.chat.modify")}
        </button>
      </div>
      {interaction.status === "expired" ? (
        <span className="ai-chatbot__interaction-status">{t("aiChatBot.chat.interactionExpired")}</span>
      ) : null}
    </section>
  );
}

export function MessageView({
  language,
  message,
  onAction,
  onChoice,
  onInteractionAction,
  onUploadInteraction,
  onFeedback,
}: MessageViewProps) {
  const { t } = useTranslation();
  const [quoteCopied, setQuoteCopied] = useState(false);
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [reasonPanelOpen, setReasonPanelOpen] = useState(false);
  const [reasonSubmitting, setReasonSubmitting] = useState<string>();

  const runFeedback = async (rating: "up" | "down" | null, reason?: string) => {
    if (!onFeedback) return;
    setFeedbackPending(true);
    try {
      await onFeedback(rating, reason);
    } finally {
      setFeedbackPending(false);
    }
  };

  if (message.role === "system") {
    return (
      <div className="ai-chatbot__system-message">
        <CheckOutlined />
        <span>{message.text}</span>
      </div>
    );
  }

  if (message.role === "user") {
    const attachmentPreviewUrl = message.attachment?.kind === "image"
      ? message.attachment.previewUrl || resolveDocumentAccessUrl(message.attachment.fileUrl)
      : "";
    return (
      <div className={`ai-chatbot__message-row ai-chatbot__user-message-row`}>
        <div className={`ai-chatbot__message-bubble ai-chatbot__user-bubble`}>
          {message.attachment ? (
            <div className="ai-chatbot__user-attachment">
              {message.attachment.kind === "image" && attachmentPreviewUrl ? (
                <img alt={message.attachment.fileName} src={attachmentPreviewUrl} />
              ) : (
                <FilePdfOutlined className="ai-chatbot__user-attachment-pdf" />
              )}
              <span>{message.attachment.fileName}</span>
            </div>
          ) : null}
          {message.text ? <span>{renderBidiText(message.text, "user-message")}</span> : null}
        </div>
        <span className={`ai-chatbot__avatar ai-chatbot__user-avatar`}>
          <UserOutlined />
        </span>
      </div>
    );
  }

  return (
    <div className={`ai-chatbot__message-row ${
      message.status === "failed" && !message.text
        ? "ai-chatbot__failed-message-row"
        : ""
    }`}>
      <Mascot />
      <div className="ai-chatbot__assistant-column">
        {message.status === "streaming" && !message.text ? (
          <div
            aria-label={message.statusMessage || t("aiChatBot.chat.processing")}
            className="ai-chatbot__assistant-status"
            role="status"
          >
            <span aria-hidden="true" className="ai-chatbot__assistant-status-dot" />
            <span>{message.statusMessage || t("aiChatBot.chat.processing")}</span>
          </div>
        ) : null}
        {message.text ? (
          <>
            <div
              className={`ai-chatbot__message-bubble ai-chatbot__assistant-bubble ${
                message.tone === "danger"
                  ? "ai-chatbot__danger-bubble"
                  : message.tone === "warning"
                    ? "ai-chatbot__warning-bubble"
                    : ""
              }`}
            >
          {message.tone === "danger" ? <WarningOutlined className="ai-chatbot__inline-icon" /> : null}
          {message.text ? (
            <MarkdownContent
              content={message.text}
              trailing={message.status === "streaming" ? (
                <span className="ai-chatbot__streaming-cursor" aria-hidden="true" />
              ) : undefined}
            />
          ) : null}

          {message.quote ? (
            <section className="ai-chatbot__quote-block">
              <blockquote>{message.quote}</blockquote>
              <button
                aria-label={t("aiChatBot.chat.copyQuote")}
                className="ai-chatbot__quote-copy-button"
                type="button"
                onClick={() => {
                  void copyToClipboard(message.quote ?? "");
                  setQuoteCopied(true);
                }}
              >
                {quoteCopied ? <CheckOutlined /> : <CopyOutlined />}
                {quoteCopied ? t("aiChatBot.chat.copied") : t("aiChatBot.chat.copyQuote")}
              </button>
            </section>
          ) : null}

          {message.progress ? (
            <div className="ai-chatbot__progress-status">
              <LoadingOutlined />
              <span>{t("aiChatBot.chat.processing")}</span>
              <span>{message.progress.elapsed_seconds}s</span>
            </div>
          ) : null}

          {message.sections?.map((section) => (
            <section className="ai-chatbot__response-section" key={section.title}>
              <h4>
                <FileTextOutlined />
                {section.title}
              </h4>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          {message.choices?.length ? (
            <div className="ai-chatbot__choice-list">
              {message.choices.map((choice) => {
                const selected = message.selectedChoiceKey === choice.key;
                return (
                  <button
                    aria-pressed={selected}
                    className={`ai-chatbot__choice-button ${selected ? "ai-chatbot__choice-button-selected" : ""}`}
                    disabled={Boolean(message.selectedChoiceKey) || !onChoice}
                    key={choice.key}
                    type="button"
                    onClick={() => onChoice?.(choice)}
                  >
                    <span>{choice.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {message.dataRows?.length ? (
            <section className="ai-chatbot__data-card">
              <h4>{message.dataTitle}</h4>
              {message.dataRows.map((row) => (
                <div className="ai-chatbot__data-row" key={`${row.label}-${row.value}`}>
                  <span>{row.label}</span>
                  <strong
                    className={
                      row.tone === "danger"
                        ? "ai-chatbot__danger-text"
                        : row.tone === "warning"
                          ? "ai-chatbot__warning-text"
                          : row.tone === "success"
                            ? "ai-chatbot__success-text"
                            : ""
                    }
                  >
                    {row.value}
                  </strong>
                </div>
              ))}
            </section>
          ) : null}

          {message.cards?.length ? (
            <ChatCardList cards={message.cards} language={language} />
          ) : null}

          {message.artifacts?.length ? (
            <StructuredArtifactList artifacts={message.artifacts} language={language} />
          ) : null}

          {message.sources?.length ? (
            <div className="ai-chatbot__source-row">
              {message.sources.map((source) => (
                <button key={source} type="button" onClick={() => onAction?.(source)}>
                  <FileTextOutlined />
                  {source}
                </button>
              ))}
            </div>
          ) : null}

          {message.citations?.length ? (
            <div className="ai-chatbot__source-row">
              {message.citations.map((citation) => (
                <button
                  key={citation.id}
                  title={citation.locator}
                  type="button"
                  onClick={() => onAction?.(citation.title)}
                >
                  <FileTextOutlined />
                  {citation.title}
                </button>
              ))}
            </div>
          ) : null}

          {message.actions?.length ? (
            <div className="ai-chatbot__action-row">
              {message.actions.map((action, index) => {
                const key = typeof action === "string" ? action : action.key;
                const label = typeof action === "string" ? action : action.label;
                return (
                  <button
                    className={index === 0 ? "ai-chatbot__primary-action" : "ai-chatbot__secondary-action"}
                    key={key}
                    type="button"
                    onClick={() => onAction?.(action)}
                  >
                    {label}
                    {index === 0 ? <LinkOutlined /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {message.interactions?.map((interaction) => (
            <InteractionControl
              interaction={interaction}
              key={interaction.id}
              onAction={onInteractionAction}
              onUpload={onUploadInteraction}
            />
          ))}
            </div>
            <div className="ai-chatbot__message-meta">
              {message.eventSeq !== undefined && onFeedback ? (
                <>
                  <button
                    aria-label={t("aiChatBot.chat.helpful")}
                    aria-pressed={message.feedback === "up"}
                    className={message.feedback === "up" ? "ai-chatbot__feedback-button-active" : ""}
                    disabled={feedbackPending}
                    type="button"
                    onClick={() => {
                      setReasonPanelOpen(false);
                      void runFeedback(message.feedback === "up" ? null : "up");
                    }}
                  >
                    <img alt="" aria-hidden="true" src={message.feedback === "up" ? thumbUpFilledIcon : thumbUpIcon} />
                  </button>
                  <button
                    aria-label={t("aiChatBot.chat.notHelpful")}
                    aria-pressed={message.feedback === "down"}
                    className={message.feedback === "down" ? "ai-chatbot__feedback-button-active" : ""}
                    disabled={feedbackPending}
                    type="button"
                    onClick={() => {
                      if (message.feedback === "down") {
                        setReasonPanelOpen(false);
                        void runFeedback(null);
                        return;
                      }
                      void runFeedback("down");
                      setReasonPanelOpen(true);
                    }}
                  >
                    <img alt="" aria-hidden="true" src={message.feedback === "down" ? thumbDownFilledIcon : thumbDownIcon} />
                  </button>
                </>
              ) : null}
              <button aria-label={t("aiChatBot.chat.copy")} type="button" onClick={() => {
                const visibleCards = normalizeChatCards(
                  message.cards ?? [],
                  getAppConfig().ffAi.cardAllowedExternalHosts,
                );
                void copyToClipboard(formatMessageForCopy(message, language, visibleCards));
              }}>
                <img alt="" aria-hidden="true" src={copyIcon} />
              </button>
            </div>
            {message.eventSeq !== undefined && onFeedback && reasonPanelOpen && message.feedback === "down" ? (
              <div className="ai-chatbot__feedback-reasons" role="group" aria-label={t("aiChatBot.chat.feedbackReasonTitle")}>
                <span className="ai-chatbot__feedback-reasons-title">{t("aiChatBot.chat.feedbackReasonTitle")}</span>
                <div className="ai-chatbot__feedback-reasons-list">
                  {FEEDBACK_DOWN_REASONS.map((reason) => (
                    <button
                      className="ai-chatbot__feedback-reason-chip"
                      disabled={feedbackPending}
                      key={reason}
                      type="button"
                      onClick={async () => {
                        setReasonSubmitting(reason);
                        try {
                          await runFeedback("down", reason);
                          setReasonPanelOpen(false);
                        } finally {
                          setReasonSubmitting(undefined);
                        }
                      }}
                    >
                      {reasonSubmitting === reason ? <LoadingOutlined /> : null}
                      {t(`aiChatBot.chat.feedbackReasons.${reason}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
