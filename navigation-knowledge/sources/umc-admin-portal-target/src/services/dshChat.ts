import { getAppConfig } from "@/config/appConfig";
import type { ChatFeedbackRating } from "@/components/AIChatBot/model/types";

function getDshApiPrefix() {
  const buildTimeBase = String(import.meta.env.VITE_DSH_API_BASE_URL ?? "").trim();
  const runtimeBase = getAppConfig().ffAi.apiBaseUrl.trim();
  const base = (buildTimeBase || runtimeBase || "/dsh-api").replace(/\/+$/, "");
  return `${base}/api/v1`;
}

export interface DshIdentity {
  token: string;
  tenantId: string;
  userId: string;
}

export interface DshConversation {
  conversationId: string;
  createdAt: string | null;
  lastActivityAt: string | null;
  lastSeq: number;
  title: string;
}

export interface DshEvent {
  data: Record<string, unknown>;
  eventType: string;
  seq: number;
}

export class DshApiError extends Error {
  public readonly kind: "http" | "network" | "protocol";
  public readonly status?: number;
  public readonly code?: "configuration" | "incomplete" | "runtime_failed" | "context_changed";

  constructor(
    kind: "http" | "network" | "protocol",
    message: string,
    status?: number,
    code?: "configuration" | "incomplete" | "runtime_failed" | "context_changed",
  ) {
    super(message);
    this.name = "DshApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

function requestHeaders(identity: DshIdentity) {
  return {
    Authorization: `Bearer ${identity.token}`,
    "Content-Type": "application/json",
    "X-Tenant-Id": identity.tenantId,
    "X-User-Id": identity.userId,
  };
}

async function requestDsh<T>(
  path: string,
  identity: DshIdentity,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getDshApiPrefix()}${path}`, {
      ...init,
      headers: { ...requestHeaders(identity), ...init.headers },
    });
  } catch {
    throw new DshApiError("network", "Unable to reach the AI service.");
  }

  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const detail = payload && typeof payload === "object"
      ? (payload as { detail?: unknown }).detail
      : undefined;
    throw new DshApiError(
      "http",
      typeof detail === "string" ? detail : "The AI service rejected the request.",
      response.status,
    );
  }
  return payload as T;
}

function asConversation(value: unknown): DshConversation {
  if (!value || typeof value !== "object") {
    throw new DshApiError("protocol", "Invalid conversation response.");
  }
  const item = value as Record<string, unknown>;
  if (typeof item.conversationId !== "string" || typeof item.lastSeq !== "number") {
    throw new DshApiError("protocol", "Invalid conversation response.");
  }
  return {
    conversationId: item.conversationId,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
    lastActivityAt: typeof item.lastActivityAt === "string" ? item.lastActivityAt : null,
    lastSeq: item.lastSeq,
    title: typeof item.title === "string" ? item.title : "",
  };
}

export async function createDshConversation(identity: DshIdentity) {
  return asConversation(await requestDsh("/conversations", identity, {
    body: JSON.stringify({ workspace: "admin-portal" }),
    method: "POST",
  }));
}

export async function listDshConversations(identity: DshIdentity) {
  const payload = await requestDsh<{ conversations?: unknown }>("/conversations", identity);
  if (!Array.isArray(payload.conversations)) {
    throw new DshApiError("protocol", "Invalid conversation history response.");
  }
  return payload.conversations.map(asConversation);
}

export async function deleteDshConversation(identity: DshIdentity, conversationId: string) {
  await requestDsh(`/conversations/${encodeURIComponent(conversationId)}`, identity, {
    method: "DELETE",
  });
}
export async function setDshMessageFeedback(
  identity: DshIdentity,
  conversationId: string,
  assistantEventSeq: number,
  rating: ChatFeedbackRating | null,
  reason?: string,
) {
  return requestDsh<{ rating: ChatFeedbackRating | null }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages/${assistantEventSeq}/feedback`,
    identity,
    {
      body: JSON.stringify(reason ? { rating, reason } : { rating }),
      method: "PUT",
    },
  );
}
export async function getDshConversationHistory(
  identity: DshIdentity,
  conversationId: string,
) {
  const payload = await requestDsh<{ conversationId?: unknown; events?: unknown }>(
    `/conversations/${encodeURIComponent(conversationId)}/history`,
    identity,
  );
  if (payload.conversationId !== conversationId || !Array.isArray(payload.events)) {
    throw new DshApiError("protocol", "Invalid conversation history response.");
  }
  return payload.events.map((value) => {
    if (!value || typeof value !== "object") {
      throw new DshApiError("protocol", "Invalid conversation history response.");
    }
    const event = value as Record<string, unknown>;
    if (
      typeof event.seq !== "number" ||
      typeof event.eventType !== "string" ||
      !event.data ||
      typeof event.data !== "object"
    ) {
      throw new DshApiError("protocol", "Invalid conversation history response.");
    }
    return {
      data: event.data as Record<string, unknown>,
      eventType: event.eventType,
      seq: event.seq,
    } satisfies DshEvent;
  });
}

export function makeDshSocketUrl(identity: DshIdentity) {
  const url = new URL(`${getDshApiPrefix()}/ws`, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  // Development DSH accepts these only locally. Production gateways inject the
  // trusted headers during the WebSocket handshake and ignore query values.
  url.searchParams.set("tenantId", identity.tenantId);
  url.searchParams.set("userId", identity.userId);
  return url.toString();
}
