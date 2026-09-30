import moment from "moment";
import type { Moment } from "moment";
import { DISPLAY_DATETIME_SEC, fmt } from "@/utils/gstTime";
import request from "@/utils/request";

export type MessageLogTypeDto = "MessageTemplate" | "Broadcast";
export type MessageLogPortalDto = "AdminPortal" | "CustomerPortal";
export type MessageLogChannelDto = "Email" | "SMS";
export type MessageLogStatusDto = "Sent" | "Failed";
export type MessageChannel = "Email" | "SMS";
export type MessageStatus = "Sent" | "Failed";
export type MessageType = "Message Template" | "Broadcast";
export type MessagePortal = "Admin" | "Customer";
export interface MessageLogRecord {
  id: number;
  key: number;
  no: string;
  type: MessageType;
  recipient: string;
  subject: string;
  templateName?: string;
  portal: MessagePortal;
  channel: MessageChannel;
  status: MessageStatus;
  sentTime: string;
  sentBy: string;
  recipientEmail?: string;
  cc?: string;
  recipientMobile?: string;
  failedReason?: string;
  emailSubjectEn?: string;
  emailBodyEn?: string;
  emailSubjectAr?: string;
  emailBodyAr?: string;
  smsMessageEn?: string;
  smsMessageAr?: string;
}

export interface MessageLogListRequest {
  search: string | null;
  type: MessageLogTypeDto | null;
  portal: MessageLogPortalDto | null;
  channel: MessageLogChannelDto | null;
  status: MessageLogStatusDto | null;
  sentFrom: string | null;
  sentTo: string | null;
  sentBy: string | null;
  pageIndex: number;
  pageSize: number;
}

export interface MessageLogItemDto {
  id: number;
  no: string;
  type: MessageLogTypeDto;
  recipient: string;
  subject: string;
  templateName: string | null;
  portal: MessageLogPortalDto;
  channel: MessageLogChannelDto;
  status: MessageLogStatusDto;
  sentTime: string;
  sentBy: string;
}

export interface MessageLogDetailDto extends MessageLogItemDto {
  failedReason: string | null;
  recipientEmail: string | null;
  recipientMobile: string | null;
  ccEmails: string[];
  emailSubjectEn: string | null;
  emailSubjectAr: string | null;
  emailBodyEn: string | null;
  emailBodyAr: string | null;
  smsContentEn: string | null;
  smsContentAr: string | null;
}

interface ApiEnvelope<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: T;
}

interface MessageLogPageDto {
  items: MessageLogItemDto[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface MessageLogPage {
  items: MessageLogRecord[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

const TYPE_LABELS: Record<MessageLogTypeDto, MessageType> = {
  MessageTemplate: "Message Template",
  Broadcast: "Broadcast",
};

const PORTAL_LABELS: Record<MessageLogPortalDto, MessagePortal> = {
  AdminPortal: "Admin",
  CustomerPortal: "Customer",
};

export const toMessageLogTypeDto = (
  value?: MessageType,
): MessageLogTypeDto | null =>
  value === "Message Template" ? "MessageTemplate" : value || null;

export const toMessageLogPortalDto = (
  value?: MessagePortal,
): MessageLogPortalDto | null =>
  value === "Admin" ? "AdminPortal" : value === "Customer" ? "CustomerPortal" : null;

export function getDefaultMessageLogDateRange(): [Moment, Moment] {
  return [moment().subtract(29, "days").startOf("day"), moment().endOf("day")];
}

export function formatMessageLogSentTime(value: string): string {
  return fmt(value, DISPLAY_DATETIME_SEC);
}

function mapItem(dto: MessageLogItemDto): MessageLogRecord {
  return {
    id: dto.id,
    key: dto.id,
    no: dto.no || "-",
    type: TYPE_LABELS[dto.type],
    recipient: dto.recipient || "-",
    subject: dto.subject || "-",
    templateName: dto.templateName || undefined,
    portal: PORTAL_LABELS[dto.portal],
    channel: dto.channel as MessageChannel,
    status: dto.status as MessageStatus,
    sentTime: formatMessageLogSentTime(dto.sentTime),
    sentBy: dto.sentBy || "-",
  };
}

export async function getMessageLogList(
  data: MessageLogListRequest,
): Promise<MessageLogPage> {
  const response = await request.post<
    ApiEnvelope<MessageLogPageDto>,
    ApiEnvelope<MessageLogPageDto>
  >("/api/MessageLog/GetList", data, { skipErrorMessage: true });
  const page = response.data;

  return {
    items: page.items.map(mapItem),
    total: page.total,
    pageIndex: page.pageIndex,
    pageSize: page.pageSize,
  };
}

export async function getMessageLogById(id: number): Promise<MessageLogRecord> {
  const response = await request.get<
    ApiEnvelope<MessageLogDetailDto>,
    ApiEnvelope<MessageLogDetailDto>
  >("/api/MessageLog/GetById", { id }, { skipErrorMessage: true });
  const dto = response.data;

  return {
    ...mapItem(dto),
    recipientEmail: dto.recipientEmail || undefined,
    recipientMobile: dto.recipientMobile || undefined,
    cc: dto.ccEmails?.length ? dto.ccEmails.flatMap((e) => e.split(",")).map((e) => e.trim()).filter(Boolean).join("; ") || undefined : undefined,
    failedReason: dto.failedReason || undefined,
    emailSubjectEn: dto.emailSubjectEn || undefined,
    emailSubjectAr: dto.emailSubjectAr || undefined,
    emailBodyEn: dto.emailBodyEn || undefined,
    emailBodyAr: dto.emailBodyAr || undefined,
    smsMessageEn: dto.smsContentEn || undefined,
    smsMessageAr: dto.smsContentAr || undefined,
  };
}
