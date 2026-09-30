import type {
  BroadcastTemplatePayload,
  MessageTemplateDetail,
} from "@/services/messageTemplate";
import { toApi } from "@/utils/gstTime";
import type { BroadcastChannelValues } from "./ChannelsContent";
import { fromBroadcastApiTime } from "./timing";
import {
  BROADCAST_CHANNEL_CODE,
  BROADCAST_PORTAL,
  BROADCAST_PUBLISH_TYPE,
  BROADCAST_TEMPLATE_TYPE,
} from "./constants";
import type { BroadcastEditDetailState, BroadcastFormValues } from "./types";

const firstNonEmpty = (...values: Array<string | undefined>) =>
  values.find((value) => Boolean(value && value.trim())) || "";

const htmlToPlainText = (value?: string) =>
  (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSmsTemplateName = (bodyEn?: string, bodyAr?: string) =>
  firstNonEmpty(htmlToPlainText(bodyEn), htmlToPlainText(bodyAr)).slice(0, 200);

const removeBroadcastApiTimeSeconds = (value?: string | null) => {
  if (!value) return "";
  const minutePrecisionTime = value.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/,
  );
  return minutePrecisionTime?.[1] || value;
};
const toBroadcastApiTime = (value: unknown) =>
  removeBroadcastApiTimeSeconds(
    toApi(value as Parameters<typeof toApi>[0]),
  );
const isTemplateDetail = (value: unknown): value is MessageTemplateDetail =>
  Boolean(value) &&
  typeof value === "object" &&
  (() => {
    const detail = value as Record<string, unknown>;
    return "id" in detail || "templateCode" in detail || "templateName" in detail;
  })();

export const unwrapTemplateDetail = (response: unknown): MessageTemplateDetail | null => {
  if (isTemplateDetail(response)) return response;
  if (!response || typeof response !== "object") return null;

  const data = (response as { data?: unknown }).data;
  if (isTemplateDetail(data)) return data;
  if (!data || typeof data !== "object") return null;

  const nestedData = (data as { data?: unknown }).data;
  return isTemplateDetail(nestedData) ? nestedData : null;
};

export const normalizeChannels = (
  data: MessageTemplateDetail,
): BroadcastChannelValues => {
  const channelCodes = data.channels?.split(",").map((item) => item.trim()).filter(Boolean) || [];

  return {
    email: channelCodes.length > 0
      ? channelCodes.includes(BROADCAST_CHANNEL_CODE.Email)
      : Boolean(data.emailSubjectEn || data.emailSubjectAr || data.emailBodyEn || data.emailBodyAr),
    sms: channelCodes.length > 0
      ? channelCodes.includes(BROADCAST_CHANNEL_CODE.Sms)
      : Boolean(data.smsTitleEn || data.smsTitleAr || data.smsen || data.smsar),
    inApp: channelCodes.length > 0
      ? channelCodes.includes(BROADCAST_CHANNEL_CODE.InApp)
      : Boolean(data.inAppTitleEn || data.inAppTitleAr || data.inAppMessageEn || data.inAppMessageAr),
    emailSubjectEn: firstNonEmpty(data.emailSubjectEn, data.subjectEn),
    emailSubjectAr: firstNonEmpty(data.emailSubjectAr, data.subjectAr),
    emailBodyEn: firstNonEmpty(data.emailBodyEn),
    emailBodyAr: firstNonEmpty(data.emailBodyAr),
    smsBodyEn: firstNonEmpty(data.smsen),
    smsBodyAr: firstNonEmpty(data.smsar),
    inAppTitleEn: firstNonEmpty(data.inAppTitleEn),
    inAppTitleAr: firstNonEmpty(data.inAppTitleAr),
    inAppMessageEn: firstNonEmpty(data.inAppMessageEn),
    inAppMessageAr: firstNonEmpty(data.inAppMessageAr),
  };
};

export const getInitialBroadcastFormValues = (): BroadcastFormValues => ({
  portal: BROADCAST_PORTAL.Customer,
  publishType: BROADCAST_PUBLISH_TYPE.Now,
  expiryTime: undefined,
  displayPeriod: undefined,
});

export const mapDetailToEditState = (
  data: MessageTemplateDetail,
): BroadcastEditDetailState => {
  const portal = data.protalType || BROADCAST_PORTAL.Customer;
  const selectedRecipients =
    portal === BROADCAST_PORTAL.Admin
      ? data.departments?.split(",").filter(Boolean) || []
      : data.userTypeCode?.split(",").filter(Boolean) || [];

  const publishTimeType =
    data.publishType || data.pulishType || BROADCAST_PUBLISH_TYPE.Now;

  const expiryTime = fromBroadcastApiTime(data.expireTime);
  const pushTime = fromBroadcastApiTime(data.pushTime);
  const displayPeriod =
    publishTimeType === BROADCAST_PUBLISH_TYPE.Scheduled &&
    pushTime?.isValid() &&
    expiryTime?.isValid()
      ? [pushTime, expiryTime] as BroadcastFormValues["displayPeriod"]
      : undefined;

  return {
    portal,
    publishTimeType,
    loadedRecipientsAreAll: selectedRecipients.length === 0,
    formValues: {
      portal,
      userTypes: selectedRecipients,
      publishType: publishTimeType,
      expiryTime:
        publishTimeType === BROADCAST_PUBLISH_TYPE.Now && expiryTime?.isValid()
          ? expiryTime
          : undefined,
      displayPeriod,
    },
    channels: normalizeChannels(data),
  };
};

export const isBroadcastMainFormValid = (values: BroadcastFormValues) => {
  const isScheduled = values.publishType === BROADCAST_PUBLISH_TYPE.Scheduled;
  const hasValidTime = isScheduled
    ? Array.isArray(values.displayPeriod) && values.displayPeriod.length === 2
    : Boolean(values.expiryTime);

  return Boolean(
    values.portal &&
      Array.isArray(values.userTypes) &&
      values.userTypes.length > 0 &&
      hasValidTime,
  );
};

export const buildBroadcastTemplatePayload = ({
  values,
  channelValues,
  templateDetail,
}: {
  values: BroadcastFormValues;
  channelValues: BroadcastChannelValues;
  templateDetail: MessageTemplateDetail | null;
}): BroadcastTemplatePayload => {
  // Always send the explicit selection as a comma separated code list,
  // including the select-all case, instead of collapsing it to an empty string.
  const recipientValue = (values.userTypes || [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(",");

  const channels = [
    channelValues.email ? BROADCAST_CHANNEL_CODE.Email : "",
    channelValues.sms ? BROADCAST_CHANNEL_CODE.Sms : "",
    channelValues.inApp ? BROADCAST_CHANNEL_CODE.InApp : "",
  ].filter(Boolean).join(",");

  const templateName =
    (channelValues.email ? channelValues.emailSubjectEn.trim() : "") ||
    (channelValues.inApp ? channelValues.inAppTitleEn.trim() : "") ||
    templateDetail?.templateName ||
    (channelValues.sms ? getSmsTemplateName(channelValues.smsBodyEn, channelValues.smsBodyAr) : "");

  let pushTime = removeBroadcastApiTimeSeconds(templateDetail?.pushTime);
  let expireTime = removeBroadcastApiTimeSeconds(templateDetail?.expireTime);

  if (values.publishType === BROADCAST_PUBLISH_TYPE.Now) {
    expireTime = toBroadcastApiTime(values.expiryTime) || "";
  } else {
    expireTime = toBroadcastApiTime(values.displayPeriod?.[1]) || "";
    pushTime = toBroadcastApiTime(values.displayPeriod?.[0]) || "";
  }

  return {
    channels,
    protalType: values.portal,
    userTypeCode: values.portal === BROADCAST_PORTAL.Customer ? recipientValue : "",
    departments: values.portal === BROADCAST_PORTAL.Admin ? recipientValue : "",
    templateName,
    description: templateDetail?.description || "",
    emailSubjectEn: channelValues.email ? channelValues.emailSubjectEn.trim() : "",
    emailSubjectAr: channelValues.email ? channelValues.emailSubjectAr.trim() : "",
    emailBodyEn: channelValues.email ? channelValues.emailBodyEn : "",
    emailBodyAr: channelValues.email ? channelValues.emailBodyAr : "",
    smsen: channelValues.sms ? channelValues.smsBodyEn : "",
    smsar: channelValues.sms ? channelValues.smsBodyAr : "",
    inAppTitleEn: channelValues.inApp ? channelValues.inAppTitleEn.trim() : "",
    inAppTitleAr: channelValues.inApp ? channelValues.inAppTitleAr.trim() : "",
    inAppMessageEn: channelValues.inApp ? channelValues.inAppMessageEn : "",
    inAppMessageAr: channelValues.inApp ? channelValues.inAppMessageAr : "",
    publishType: values.publishType,
    pushTime,
    expireTime,
    relatedId: templateDetail?.relatedId || "",
    showBox: true,
    type: BROADCAST_TEMPLATE_TYPE,
  };
};
