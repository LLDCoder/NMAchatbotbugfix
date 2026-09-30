import type { ITimeline } from "@/services/content";

const RECALL_APPROVAL_NODE_KEYS = new Set([
  "recall",
  "recalled",
  "recallapproval",
  "recalledapproval",
]);

const normalizeTimelineNodeKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

export const isRecallApprovalNode = (
  item: Pick<ITimeline, "nodeType" | "title">,
) =>
  [item.nodeType, item.title].some((value) =>
    RECALL_APPROVAL_NODE_KEYS.has(normalizeTimelineNodeKey(value)),
  );
