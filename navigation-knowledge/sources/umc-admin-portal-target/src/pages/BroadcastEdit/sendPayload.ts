import type {
  BroadcastOperation,
  BroadcastSendPayload,
  BroadcastTemplatePayload,
} from "@/services/messageTemplate";

interface BroadcastSendContext {
  id?: number;
  userId?: string;
}

export const buildBroadcastSendPayload = (
  payload: BroadcastTemplatePayload,
  operation: BroadcastOperation,
  context: BroadcastSendContext,
): BroadcastSendPayload => ({
  ...payload,
  operation,
  createOn: context.userId,
  ...(context.id !== undefined ? { id: context.id } : {}),
});
