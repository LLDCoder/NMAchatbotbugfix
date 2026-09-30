type Packet = { type?: unknown; conversationId?: unknown; clientMessageId?: unknown;
  requestId?: unknown; accepted?: unknown; duplicate?: unknown; busy?: unknown };
type Event = { eventType?: unknown; data?: Record<string, unknown> };

/** Bind a submitted client message to the server's request, not a whole socket. */
export function createDshTurnCorrelation(clientMessageId: string, conversationId: string) {
  let requestId = "";
  const bind = (value: unknown) => {
    if (typeof value !== "string" || !value.trim() || (requestId && requestId !== value)) return false;
    requestId = value;
    return true;
  };
  return {
    accept(packet: Packet): "ignore" | "accepted" | "busy" | "rejected" | "invalid" {
      if (packet.type !== "accepted" || packet.clientMessageId !== clientMessageId
        || packet.conversationId !== conversationId) return "ignore";
      if (packet.busy === true && packet.accepted === false) return "busy";
      if (packet.accepted !== true && packet.duplicate !== true) return "rejected";
      return bind(packet.requestId) ? "accepted" : "invalid";
    },
    acceptsEvent(event: Event): boolean {
      if (event.eventType === "user.message") {
        if (event.data?.clientMessageId === clientMessageId) bind(event.data.requestId);
        return false;
      }
      return Boolean(requestId) && event.data?.requestId === requestId;
    },
  };
}
