import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createDshConversation,
  deleteDshConversation,
  DshApiError,
  type DshConversation,
  type DshEvent,
  type DshIdentity,
  getDshConversationHistory,
  listDshConversations,
  makeDshSocketUrl,
  setDshMessageFeedback,
} from "@/services/dshChat";
import { useUserStore } from "@/store/user";
import { useAdminAuthToken } from "./adminIdentity";
import { captureReaderPageContext } from "./readerPageContext";
import { createDshTurnCorrelation } from "./dshTurnCorrelation";
import { getDshChatErrorPresentation, getDshRuntimeError, getDshSocketError } from "./dshErrors";
import i18n from "@/localization/config";
import type {
  ChatAttachment,
  ChatFeedbackRating,
  ChatLanguage,
  ScenarioChoice,
  ScenarioMessage,
  WorkflowInteraction,
} from "./types";

const STREAM_INACTIVITY_TIMEOUT_MS = 90_000;
// Reader work is bounded to at most 300s by the service; allow transport grace
// while ensuring heartbeats cannot keep an unfinished request alive forever.
const STREAM_TOTAL_TIMEOUT_MS = 360_000;

export interface DshChatController {
  activeConversationId?: string;
  completionRevision: number;
  config: { name: string } | null;
  configError: unknown;
  configLoading: boolean;
  conversations: DshConversation[];
  deletePendingId?: string;
  historyError: unknown;
  historyLoading: boolean;
  lastFailedDisplayPrompt: string;
  lastFailedAttachment?: ChatAttachment;
  lastFailedPrompt: string;
  messageError: unknown;
  messages: ScenarioMessage[];
  messagesLoading: boolean;
  streaming: boolean;
  cancelPending: () => void;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  loadConversation: (conversationId: string) => Promise<boolean>;
  refreshConversations: () => Promise<void>;
  retryConfiguration: () => Promise<void>;
  submitFeedback: (
    messageId: string,
    assistantEventSeq: number,
    rating: ChatFeedbackRating | null,
    reason?: string,
  ) => Promise<boolean>;
  respondToInteraction: (interactionId: string, action: "confirm" | "modify" | "cancel") => Promise<void>;
  selectChoice: (messageId: string, choice: ScenarioChoice) => Promise<boolean>;
  send: (
    message: string,
    _interactionResponse?: unknown,
    displayMessage?: string,
    attachment?: ChatAttachment,
  ) => Promise<boolean>;
  startNewConversation: () => void;
  stopStreaming: () => void;
  uploadInteraction: (interaction: WorkflowInteraction, file: File) => Promise<boolean>;
}

function createClientMessageId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `dsh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function dshIdentity(
  userId: string,
  token: string,
  profileId: string,
  establishments: Array<{
    id: number;
    nameAr?: string | null;
    nameEn?: string | null;
    userProfileId: string;
  }> | null | undefined,
): DshIdentity | null {
  if (!userId || !token) return null;
  // Admin identities do not necessarily include Customer Portal profile or
  // establishment collections. Treat that valid Admin shape as a global
  // identity instead of attempting Customer-only profile resolution.
  if (!profileId || profileId === "0") {
    return { userId, token, tenantId: `umc:global:${userId}` };
  }
  const establishment = establishments?.find(
    (item) => String(item.userProfileId) === profileId,
  );
  return {
    userId,
    token,
    tenantId: establishment
      ? `umc:establishment:${establishment.id}`
      : `umc:profile:${profileId || userId}`,
  };
}

type DshProfileContext = {
  activeProfileId: string;
  activeProfileName: string;
  isGlobalView: boolean;
  profiles: Array<{ id: string; name: string }>;
};

function dshProfileContext(
  profileId: string,
  invitation: { userProfileId?: string | null; name?: string | null } | null | undefined,
  establishments: Array<{
    userProfileId: string;
    nameAr?: string | null;
    nameEn?: string | null;
  }> | null | undefined,
): DshProfileContext {
  const profiles = new Map<string, string>();
  const addProfile = (id: string | null | undefined, name: string | null | undefined) => {
    const normalizedId = String(id || "").trim();
    const normalizedName = String(name || "").trim();
    if (normalizedId && normalizedName) profiles.set(normalizedId, normalizedName);
  };
  addProfile(invitation?.userProfileId, invitation?.name);
  establishments?.forEach((item) => addProfile(item.userProfileId, item.nameEn || item.nameAr));
  const activeProfileId = String(profileId || "").trim();
  return {
    activeProfileId,
    activeProfileName: profiles.get(activeProfileId) || "",
    isGlobalView: !activeProfileId || activeProfileId === "0",
    profiles: Array.from(profiles, ([id, name]) => ({ id, name })),
  };
}

function eventMessage(event: DshEvent, conversationId: string): ScenarioMessage | null {
  const content = typeof event.data.content === "string" ? event.data.content : "";
  const rawAttachment = event.data.attachment;
  const attachment = rawAttachment && typeof rawAttachment === "object"
    ? rawAttachment as Record<string, unknown>
    : null;
  const fileRef = typeof attachment?.fileRef === "string" ? attachment.fileRef : "";
  const fileName = typeof attachment?.fileName === "string" ? attachment.fileName : "";
  const fileType: 0 | 1 | null =
    attachment?.fileType === 0 ? 0 : attachment?.fileType === 1 ? 1 : null;
  const messageAttachment = fileRef && fileName && fileType !== null
    ? {
      fileRef,
      fileName,
      fileUrl: fileRef,
      fileType,
      kind: fileType === 0 ? "pdf" as const : "image" as const,
      mimeType: typeof attachment?.mimeType === "string"
        ? attachment.mimeType
        : fileType === 0 ? "application/pdf" : "image/*",
    }
    : undefined;
  if (!content && !messageAttachment) return null;
  if (event.eventType === "user.message") {
    return { id: `${conversationId}-${event.seq}`, role: "user", text: content, attachment: messageAttachment };
  }
  if (event.eventType === "assistant.message" || event.eventType === "assistant.welcome") {
    const feedback = event.data.feedback === "up" || event.data.feedback === "down"
      ? event.data.feedback
      : undefined;
    return {
      id: `${conversationId}-${event.seq}`,
      role: "assistant",
      text: content,
      ...(event.eventType === "assistant.message" ? { eventSeq: event.seq, feedback } : {}),
    };
  }
  return null;
}

function pageScopeKey(context: ReturnType<typeof captureReaderPageContext>) {
  return JSON.stringify({
    route: context.route,
    query: Object.entries(context.query).sort(([a], [b]) => a.localeCompare(b)),
    view: context.view,
    selectedRecordKeys: [...context.selectedRecordKeys].sort(),
    filters: context.filters.map(({ name, value }) => [name, value]).sort(),
  });
}

function currentPageScopeKey() {
  return pageScopeKey(captureReaderPageContext(window.location, document, "UTC"));
}

function getErrorMessage(error: unknown, language: ChatLanguage) {
  return String(i18n.t(getDshChatErrorPresentation(error).messageKey, { lng: language }));
}

export function getDshChatErrorMessage(error: unknown, language: ChatLanguage) {
  return getErrorMessage(error, language);
}

export function useDshChat(language: ChatLanguage): DshChatController {
  const userId = useUserStore((state) => state.userInfo.id);
  const token = useAdminAuthToken();
  const currentProfileId = useUserStore((state) => state.currentProfileId);
  const establishments = useUserStore((state) => state.userInfo.userEstablishments);
  const invitation = useUserStore((state) => state.userInfo.userInvitation);
  const identity = useMemo(
    () => dshIdentity(userId, token, String(currentProfileId || ""), establishments),
    [currentProfileId, establishments, token, userId],
  );
  const identityKey = `${identity?.userId || ""}:${identity?.tenantId || ""}:${token}`;
  const profileContext = useMemo(
    () => dshProfileContext(String(currentProfileId || ""), invitation, establishments),
    [currentProfileId, establishments, invitation],
  );
  const [conversations, setConversations] = useState<DshConversation[]>([]);
  const [messages, setMessages] = useState<ScenarioMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [messageError, setMessageError] = useState<unknown>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState("");
  const [lastFailedDisplayPrompt, setLastFailedDisplayPrompt] = useState("");
  const [lastFailedAttachment, setLastFailedAttachment] = useState<ChatAttachment>();
  const [deletePendingId, setDeletePendingId] = useState<string>();
  const [completionRevision, setCompletionRevision] = useState(0);
  const socketRef = useRef<WebSocket>();
  const socketInactivityTimerRef = useRef<{ socket: WebSocket; timer: number }>();
  const mountedRef = useRef(true);
  const requestRevisionRef = useRef(0);
  const pendingSendRef = useRef(false);
  const historyRevisionRef = useRef(0);
  const requestPageScopeRef = useRef<string>();
  const activeConversationRef = useRef<string>();
  const activeIdentityKeyRef = useRef(identityKey);
  activeConversationRef.current = activeConversationId;
  activeIdentityKeyRef.current = identityKey;

  const closeSocket = useCallback((expectedSocket?: WebSocket) => {
    const socket = socketRef.current;
    if (!socket || (expectedSocket && socket !== expectedSocket)) return;
    if (socketInactivityTimerRef.current?.socket === socket) {
      window.clearTimeout(socketInactivityTimerRef.current.timer);
      socketInactivityTimerRef.current = undefined;
    }
    socketRef.current = undefined;
    if (socket.readyState < WebSocket.CLOSING) socket.close();
  }, []);

  const stopStreaming = useCallback(() => {
    requestRevisionRef.current += 1;
    pendingSendRef.current = false;
    closeSocket();
    setStreaming(false);
    setMessages((current) => current.flatMap((message) => (
      message.status !== "streaming"
        ? [message]
        : message.text ? [{ ...message, status: undefined }] : []
    )));
  }, [closeSocket]);

  const cancelPending = useCallback(() => {
    historyRevisionRef.current += 1;
    stopStreaming();
    setMessagesLoading(false);
  }, [stopStreaming]);

  const refreshConversations = useCallback(async () => {
    if (!identity) return;
    const requestIdentityKey = identityKey;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await listDshConversations(identity);
      if (mountedRef.current && activeIdentityKeyRef.current === requestIdentityKey) setConversations(items);
    } catch (error) {
      if (mountedRef.current && activeIdentityKeyRef.current === requestIdentityKey) setHistoryError(error);
    } finally {
      if (mountedRef.current && activeIdentityKeyRef.current === requestIdentityKey) setHistoryLoading(false);
    }
  }, [identity, identityKey]);

  const startNewConversation = useCallback(() => {
    cancelPending();
    setActiveConversationId(undefined);
    setMessages([]);
    setMessageError(null);
    setLastFailedPrompt("");
    setLastFailedDisplayPrompt("");
    setLastFailedAttachment(undefined);
  }, [cancelPending]);

  const loadConversation = useCallback(async (conversationId: string) => {
    if (!identity) return false;
    cancelPending();
    const requestIdentityKey = identityKey;
    const historyRevision = historyRevisionRef.current;
    const isCurrent = () => mountedRef.current && activeIdentityKeyRef.current === requestIdentityKey
      && historyRevisionRef.current === historyRevision;
    setMessagesLoading(true);
    setMessageError(null);
    try {
      const events = await getDshConversationHistory(identity, conversationId);
      const history: ScenarioMessage[] = [];
      for (const event of events) {
        const message = eventMessage(event, conversationId);
        if (message) history.push(message);
      }
      if (!isCurrent()) return false;
      setActiveConversationId(conversationId);
      setMessages(history);
      return true;
    } catch (error) {
      if (isCurrent()) setHistoryError(error);
      return false;
    } finally {
      if (isCurrent()) setMessagesLoading(false);
    }
  }, [cancelPending, identity, identityKey]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!identity) return false;
    const requestIdentityKey = identityKey;
    const isCurrent = () => mountedRef.current && activeIdentityKeyRef.current === requestIdentityKey;
    setDeletePendingId(conversationId);
    try {
      await deleteDshConversation(identity, conversationId);
      if (!isCurrent()) return false;
      if (activeConversationRef.current === conversationId) startNewConversation();
      await refreshConversations();
      return true;
    } catch (error) {
      if (isCurrent()) setHistoryError(error);
      return false;
    } finally {
      if (isCurrent()) setDeletePendingId(undefined);
    }
  }, [identity, identityKey, refreshConversations, startNewConversation]);

  const send = useCallback(async (
    value: string,
    _interactionResponse?: unknown,
    displayValue?: string,
    attachment?: ChatAttachment,
  ) => {
    const prompt = value.trim();
    if (!identity || (!prompt && !attachment) || socketRef.current || pendingSendRef.current) return false;
    pendingSendRef.current = true;
    const requestRevision = ++requestRevisionRef.current;
    const requestIdentityKey = identityKey;
    // Bind the visible context at submission, before asynchronous conversation
    // creation and authentication can race with navigation or filter changes.
    const pageContext = captureReaderPageContext(
      window.location,
      document,
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    );
    const requestPageScope = pageScopeKey(pageContext);
    requestPageScopeRef.current = requestPageScope;
    const isCurrent = () => mountedRef.current && activeIdentityKeyRef.current === requestIdentityKey
      && requestRevisionRef.current === requestRevision && currentPageScopeKey() === requestPageScope;
    const displayPrompt = displayValue === undefined ? prompt : displayValue.trim();
    const clientMessageId = createClientMessageId();
    const assistantId = `assistant-${clientMessageId}`;
    setMessageError(null);
    setLastFailedPrompt("");
    setLastFailedDisplayPrompt("");
    setLastFailedAttachment(undefined);
    setStreaming(true);
    setMessages((current) => [
      ...current,
      ...(displayPrompt || attachment
        ? [{ id: `user-${clientMessageId}`, role: "user" as const, text: displayPrompt, attachment }]
        : []),
      { id: assistantId, role: "assistant" as const, status: "streaming", text: "" },
    ]);

    let conversationId = activeConversationId;
    try {
      if (!conversationId) {
        const conversation = await createDshConversation(identity);
        if (!isCurrent()) return false;
        conversationId = conversation.conversationId;
        setActiveConversationId(conversationId);
      }
      if (!isCurrent()) return false;
      const socket = new WebSocket(makeDshSocketUrl(identity));
      const activeSocket = socket;
      const turnCorrelation = createDshTurnCorrelation(clientMessageId, conversationId);
      const streamStartedAt = Date.now();
      socketRef.current = activeSocket;
      await new Promise<void>((resolve, reject) => {
        let subscribed = false;
        let turnCompleted = false;
        let handshakeSettled = false;
        let receivedAssistantContent = false;
        const rejectHandshake = (error: DshApiError) => {
          if (handshakeSettled) return;
          handshakeSettled = true;
          reject(error);
        };
        const failActiveStream = (error: DshApiError) => {
          if (!isCurrent() || turnCompleted || socketRef.current !== activeSocket) return;
          pendingSendRef.current = false;
          closeSocket(activeSocket);
          setStreaming(false);
          setMessageError(error);
          setLastFailedPrompt(prompt);
          setLastFailedDisplayPrompt(displayPrompt);
          setLastFailedAttachment(attachment);
          setMessages((current) => current.map((message) => (
            message.id === assistantId ? { ...message, status: "failed" } : message
          )));
        };
        const resetInactivityTimer = () => {
          if (socketRef.current !== activeSocket) return;
          if (socketInactivityTimerRef.current) {
            window.clearTimeout(socketInactivityTimerRef.current.timer);
          }
          const remaining = Math.max(0, STREAM_TOTAL_TIMEOUT_MS - (Date.now() - streamStartedAt));
          socketInactivityTimerRef.current = {
            socket: activeSocket,
            timer: window.setTimeout(() => {
              if (subscribed) {
                failActiveStream(new DshApiError("network", "The AI service stopped responding.", undefined, "incomplete"));
              } else {
                rejectHandshake(new DshApiError("network", "Unable to connect to the AI service."));
              }
            }, Math.min(STREAM_INACTIVITY_TIMEOUT_MS, remaining)),
          };
        };
        activeSocket.onopen = () => {
          if (!isCurrent() || socketRef.current !== activeSocket) return;
          resetInactivityTimer();
          activeSocket.send(JSON.stringify({ type: "auth", umctoken: identity.token }));
        };
        activeSocket.onerror = () => {
          const error = new DshApiError("network", "Unable to connect to the AI service.");
          if (subscribed) failActiveStream(new DshApiError("network", error.message, undefined, "incomplete"));
          else rejectHandshake(error);
        };
        activeSocket.onclose = () => {
          if (subscribed) {
            failActiveStream(new DshApiError("network", "The AI service connection was interrupted.", undefined, "incomplete"));
          } else {
            rejectHandshake(new DshApiError("network", "Unable to connect to the AI service."));
          }
        };
        activeSocket.onmessage = (raw) => {
          if (!isCurrent() || socketRef.current !== activeSocket) return;
          resetInactivityTimer();
          let payload: Record<string, unknown>;
          try {
            const parsed = JSON.parse(String(raw.data)) as unknown;
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              throw new Error("Unexpected WebSocket payload shape.");
            }
            payload = parsed as Record<string, unknown>;
          } catch {
            const error = new DshApiError("protocol", "The AI service returned an invalid response.");
            if (subscribed) failActiveStream(error);
            else rejectHandshake(error);
            return;
          }
          if (payload.type === "authenticated") {
            activeSocket.send(JSON.stringify({ type: "subscribe", conversationId, afterSeq: 0 }));
            return;
          }
          if (payload.type === "subscribed") {
            subscribed = true;
            handshakeSettled = true;
            activeSocket.send(JSON.stringify({
              type: "message",
              conversationId,
              content: prompt,
              clientMessageId,
              responseLanguage: language,
              profileContext,
              pageContext,
              ...(attachment ? {
                attachment: {
                  fileRef: attachment.fileRef,
                  fileName: attachment.fileName,
                  fileType: attachment.fileType,
                  mimeType: attachment.mimeType,
                },
              } : {}),
            }));
            resolve();
            return;
          }
          if (payload.type === "accepted") {
            const acceptance = turnCorrelation.accept(payload);
            if (acceptance === "busy") failActiveStream(getDshSocketError("conversation_busy"));
            else if (acceptance === "rejected" || acceptance === "invalid") {
              failActiveStream(new DshApiError("protocol", "The AI service did not accept this request."));
            }
            return;
          }
          if (payload.type === "error") {
            const error = getDshSocketError(payload.code);
            if (subscribed) failActiveStream(error);
            else rejectHandshake(error);
            return;
          }
          if (!subscribed || payload.type !== "event") return;
          const event = payload as unknown as DshEvent;
          // A running previous turn may still publish after this subscription.
          // Only a matching client message/acceptance establishes this turn.
          if (!turnCorrelation.acceptsEvent(event)) return;
          if (event.eventType === "runtime.error") {
            failActiveStream(getDshRuntimeError(event.data, receivedAssistantContent));
            return;
          }
          if (event.eventType === "assistant.chunk") {
            const chunk = typeof event.data?.content === "string" ? event.data.content : "";
            if (chunk) {
              receivedAssistantContent = true;
              setMessages((current) => current.map((message) => (
                message.id === assistantId ? { ...message, text: `${message.text}${chunk}` } : message
              )));
            }
          }
          if (event.eventType === "assistant.status") {
            const statusMessage = typeof event.data?.message === "string" ? event.data.message : "";
            setMessages((current) => current.map((message) => (
              message.id === assistantId
                ? { ...message, statusMessage }
                : message
            )));
          }
          if (event.eventType === "assistant.message") {
            const content = typeof event.data?.content === "string" ? event.data.content : "";
            receivedAssistantContent = Boolean(content);
            setMessages((current) => current.map((message) => (
              message.id === assistantId
                ? {
                  ...message,
                  id: `${conversationId}-${event.seq}`,
                  eventSeq: event.seq,
                  text: content,
                  status: undefined,
                  statusMessage: undefined,
                }
                : message
            )));
          }
          if (event.eventType === "turn.completed") {
            turnCompleted = true;
            pendingSendRef.current = false;
            closeSocket(activeSocket);
            setStreaming(false);
            setCompletionRevision((revision) => revision + 1);
            void refreshConversations();
            if (!receivedAssistantContent && conversationId) {
              const requestIdentityKey = identityKey;
              void getDshConversationHistory(identity, conversationId).then((events) => {
                if (
                  !isCurrent() ||
                  activeIdentityKeyRef.current !== requestIdentityKey ||
                  activeConversationRef.current !== conversationId
                ) return;
                const history = events.flatMap((item) => {
                  const message = eventMessage(item, conversationId as string);
                  return message ? [message] : [];
                });
                setMessages(history);
              }).catch(() => undefined);
            }
          }
        };
      });
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      pendingSendRef.current = false;
      closeSocket();
      setStreaming(false);
      setMessageError(error);
      setLastFailedPrompt(prompt);
      setLastFailedDisplayPrompt(displayPrompt);
      setLastFailedAttachment(attachment);
      setMessages((current) => current.map((message) => (
        message.id === assistantId ? { ...message, status: "failed" } : message
      )));
      return false;
    }
  }, [activeConversationId, closeSocket, identity, identityKey, language, profileContext, refreshConversations]);
  const submitFeedback = useCallback(async (
    messageId: string,
    assistantEventSeq: number,
    rating: ChatFeedbackRating | null,
    reason?: string,
  ) => {
    const conversationId = activeConversationRef.current;
    if (!identity || !conversationId) return false;
    const requestIdentityKey = identityKey;
    try {
      const result = await setDshMessageFeedback(
        identity,
        conversationId,
        assistantEventSeq,
        rating,
        reason,
      );
      if (
        !mountedRef.current ||
        activeIdentityKeyRef.current !== requestIdentityKey ||
        activeConversationRef.current !== conversationId
      ) return false;
      setMessages((current) => current.map((message) => (
        message.id === messageId
          ? { ...message, feedback: result.rating ?? undefined }
          : message
      )));
      return true;
    } catch {
      return false;
    }
  }, [identity, identityKey]);

  useEffect(() => {
    startNewConversation();
    setConversations([]);
    setHistoryError(null);
    setHistoryLoading(false);
    setDeletePendingId(undefined);
    if (identity) void refreshConversations();
  }, [identity, identityKey, refreshConversations, startNewConversation]);

  useEffect(() => {
    if (!streaming) return;
    const timer = window.setInterval(() => {
      if (requestPageScopeRef.current === currentPageScopeKey()) return;
      requestRevisionRef.current += 1;
      pendingSendRef.current = false;
      closeSocket();
      setStreaming(false);
      setMessages((current) => current.filter((message) => message.status !== "streaming"));
      setLastFailedPrompt("");
      setLastFailedDisplayPrompt("");
      setLastFailedAttachment(undefined);
      setMessageError(new DshApiError("protocol", "Page context changed.", undefined, "context_changed"));
    }, 250);
    return () => window.clearInterval(timer);
  }, [closeSocket, streaming]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closeSocket();
    };
  }, [closeSocket]);

  const unavailableInteraction = useCallback(async () => undefined, []);
  const unavailableChoice = useCallback(async () => false, []);
  const unavailableUpload = useCallback(async () => false, []);

  return {
    activeConversationId,
    completionRevision,
    config: identity ? { name: String(i18n.t("aiChatBot.chat.assistantName", { lng: language })) } : null,
    configError: identity ? null : new DshApiError("http", "Admin session is required.", 401),
    configLoading: false,
    conversations,
    deletePendingId,
    historyError,
    historyLoading,
    lastFailedDisplayPrompt,
    lastFailedAttachment,
    lastFailedPrompt,
    messageError,
    messages,
    messagesLoading,
    streaming,
    cancelPending,
    deleteConversation,
    loadConversation,
    refreshConversations,
    retryConfiguration: async () => undefined,
    submitFeedback,
    respondToInteraction: unavailableInteraction,
    selectChoice: unavailableChoice,
    send,
    startNewConversation,
    stopStreaming,
    uploadInteraction: unavailableUpload,
  };
}
