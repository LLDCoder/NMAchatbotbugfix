import { DshApiError } from "@/services/dshChat";

export type DshChatErrorKind =
  | "network"
  | "configuration"
  | "notFound"
  | "forbidden"
  | "sessionExpired"
  | "contextChanged"
  | "unavailable"
  | "incomplete"
  | "protocol"
  | "generic";

export interface DshChatErrorPresentation {
  kind: DshChatErrorKind;
  titleKey: string;
  messageKey: string;
  retryable: boolean;
  startNewChat?: boolean;
}

const ERROR_TITLE_KEYS: Record<DshChatErrorKind, string> = {
  network: "aiChatBot.chat.errors.titles.network",
  configuration: "aiChatBot.chat.errors.titles.configuration",
  notFound: "aiChatBot.chat.errors.titles.notFound",
  forbidden: "aiChatBot.chat.errors.titles.forbidden",
  sessionExpired: "aiChatBot.chat.errors.titles.sessionExpired",
  contextChanged: "aiChatBot.chat.errors.titles.contextChanged",
  unavailable: "aiChatBot.chat.errors.titles.unavailable",
  incomplete: "aiChatBot.chat.errors.titles.incomplete",
  protocol: "aiChatBot.chat.errors.titles.generic",
  generic: "aiChatBot.chat.errors.titles.generic",
};

const ERROR_MESSAGE_KEYS: Record<DshChatErrorKind, string> = {
  network: "aiChatBot.chat.errors.network",
  configuration: "aiChatBot.chat.errors.configuration",
  notFound: "aiChatBot.chat.errors.notFound",
  forbidden: "aiChatBot.chat.errors.forbidden",
  sessionExpired: "aiChatBot.chat.errors.sessionExpired",
  contextChanged: "aiChatBot.chat.errors.contextChanged",
  unavailable: "aiChatBot.chat.errors.unavailable",
  incomplete: "aiChatBot.chat.errors.incomplete",
  protocol: "aiChatBot.chat.errors.generic",
  generic: "aiChatBot.chat.errors.generic",
};

export function getDshChatErrorPresentation(error: unknown): DshChatErrorPresentation {
  let kind: DshChatErrorKind = "generic";
  let retryable = true;
  let startNewChat = false;

  if (error instanceof DshApiError) {
    if (error.code === "configuration") {
      kind = "configuration";
      retryable = false;
    } else if (error.code === "context_changed") {
      kind = "contextChanged";
      retryable = false;
    } else if (error.code === "incomplete") {
      kind = "incomplete";
    } else if (error.code === "runtime_failed") {
      kind = "generic";
    } else if (error.status === 404) {
      kind = "notFound";
      retryable = false;
      startNewChat = true;
    } else if (error.status === 401) {
      kind = "sessionExpired";
      retryable = false;
    } else if (error.status === 403) {
      kind = "forbidden";
      retryable = false;
    } else if (
      error.status === 408 ||
      error.status === 429 ||
      (error.status !== undefined && error.status >= 500 && error.status <= 599)
    ) {
      kind = "unavailable";
    } else if (error.kind === "network") {
      kind = "network";
    } else if (error.kind === "protocol") {
      kind = "protocol";
    }
  }

  return {
    kind,
    titleKey: ERROR_TITLE_KEYS[kind],
    messageKey: ERROR_MESSAGE_KEYS[kind],
    retryable,
    ...(startNewChat ? { startNewChat: true } : {}),
  };
}

export function getDshSocketError(code: unknown): DshApiError {
  if (code === "conversation_busy") {
    return new DshApiError("http", "This conversation is still processing a request.", 503);
  }
  if (code === "conversation_not_found") {
    return new DshApiError("http", "Conversation no longer exists.", 404);
  }
  if (code === "umc_token_required" || code === "identity_mismatch" || code === "authentication_failed") {
    return new DshApiError("http", "Admin identity was rejected.", 401);
  }
  if (code === "permission_denied") {
    return new DshApiError("http", "Access is not permitted.", 403);
  }
  if (code === "missing_user_identity" || code === "identity_dependency_timeout" || code === "identity_dependency_unavailable") {
    return new DshApiError("http", "Unable to verify the Admin identity.", 503);
  }
  return new DshApiError("protocol", "The AI service rejected the message.");
}

export function getDshRuntimeError(data: unknown, hasPartialReply: boolean): DshApiError {
  if (hasPartialReply) {
    return new DshApiError("protocol", "The AI service could not finish its response.", undefined, "incomplete");
  }
  if (data && typeof data === "object" && "code" in data && data.code === "runtime_failed") {
    return new DshApiError("protocol", "The AI service could not complete this request.", undefined, "runtime_failed");
  }
  return new DshApiError("protocol", "The AI service could not complete this request.");
}
