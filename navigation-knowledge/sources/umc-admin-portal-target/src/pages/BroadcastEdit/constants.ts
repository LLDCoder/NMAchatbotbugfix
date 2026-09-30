import type { BroadcastChannelValues } from "./ChannelsContent";

export const BROADCAST_PORTAL = {
  Admin: "1",
  Customer: "2",
} as const;

export const BROADCAST_PUBLISH_TYPE = {
  Now: "1",
  Scheduled: "2",
} as const;

export const BROADCAST_CHANNEL_CODE = {
  Email: "1",
  Sms: "2",
  InApp: "3",
} as const;

export const BROADCAST_TEMPLATE_TYPE = "2";

export const EMPTY_CHANNELS: BroadcastChannelValues = {
  email: false,
  sms: false,
  inApp: false,
  emailSubjectEn: "",
  emailSubjectAr: "",
  emailBodyEn: "",
  emailBodyAr: "",
  smsBodyEn: "",
  smsBodyAr: "",
  inAppTitleEn: "",
  inAppTitleAr: "",
  inAppMessageEn: "",
  inAppMessageAr: "",
};
