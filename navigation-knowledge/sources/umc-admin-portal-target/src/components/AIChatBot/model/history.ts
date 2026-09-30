import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

import type { DshConversation } from "@/services/dshChat";
import { fromApi, GST, nowGst } from "@/utils/gstTime";
import type { ChatLanguage } from "./types";

export type ConversationDateGroup = "today" | "yesterday" | "earlier";

type ConversationNow = Date | Dayjs;

function toGst(value: ConversationNow) {
  return dayjs.isDayjs(value) ? value.tz(GST) : dayjs(value).tz(GST);
}

export function getConversationDateGroup(
  updatedAt: string,
  now: ConversationNow = nowGst(),
): ConversationDateGroup {
  const updated = fromApi(updatedAt);
  if (!updated) return "earlier";
  const dayDifference = toGst(now).startOf("day").diff(updated.startOf("day"), "day");
  if (dayDifference <= 0) return "today";
  if (dayDifference === 1) return "yesterday";
  return "earlier";
}

export function formatConversationTime(updatedAt: string, language: ChatLanguage) {
  const value = fromApi(updatedAt);
  if (!value) return "";
  return new Intl.DateTimeFormat(language.startsWith("ar") ? "ar-AE" : "en-AE", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: GST,
  }).format(value.toDate());
}

export function filterAndGroupConversations(
  conversations: DshConversation[],
  query: string,
  now: ConversationNow = nowGst(),
) {
  const normalized = query.trim().toLocaleLowerCase();
  const visible = normalized
    ? conversations.filter((item) => item.title.toLocaleLowerCase().includes(normalized))
    : conversations;
  return visible.reduce<Record<ConversationDateGroup, DshConversation[]>>(
    (groups, item) => {
      groups[getConversationDateGroup(item.lastActivityAt || "", now)].push(item);
      return groups;
    },
    { today: [], yesterday: [], earlier: [] },
  );
}
