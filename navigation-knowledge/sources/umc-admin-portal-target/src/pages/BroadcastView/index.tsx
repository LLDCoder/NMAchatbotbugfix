import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useHistory, useLocation } from "react-router-dom";
import { CustomFooter } from "@/components/common";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { getMessageTemplateById, type MessageTemplateDetail } from "@/services/messageTemplate";
import { useTranslation } from "react-i18next";
import moment from "moment";
import "./index.less";
import broadcastNoIcon from "@/assets/images/BroadcastEdit-BroadcastNo.svg";
import publishedByIcon from "@/assets/images/BroadcastEdit-PublishedBy.svg";
import statusIcon from "@/assets/images/BroadcastEdit-Status.svg";
import EnvelopeSimpleIcon from "@/assets/images/EnvelopeSimple.svg";
import ChatDotsIcon from "@/assets/images/ChatDots.svg";
import BellRingingIcon from "@/assets/images/BellRinging.svg";
import {
  AuthenticatedDocumentHtml,
} from "@/components/common/AuthenticatedDocumentHtml";

type ChannelKey = "email" | "sms" | "inApp";

interface ChannelContent {
  titleEn: string;
  contentEn: string;
  titleAr: string;
  contentAr: string;
}

interface BroadcastDetailRecord {
  broadcastNo: string;
  status: number | string | null;
  portalCode: string;
  portal: string;
  recipients: string;
  publishType: string;
  publishTime: string;
  expiryTime: string;
  publishedBy: string;
  channels: Record<ChannelKey, ChannelContent>;
}

const CHANNELS: Array<{ key: ChannelKey; icon: string }> = [
  { key: "email", icon: EnvelopeSimpleIcon },
  { key: "sms", icon: ChatDotsIcon },
  { key: "inApp", icon: BellRingingIcon },
];

const firstNonEmpty = (...values: Array<string | undefined>) =>
  values.find((value) => Boolean(value && value.trim())) || "";

const isGuidLike = (value?: string) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

const displayPublishedByName = (name?: string) => isGuidLike(name) ? "-" : name || "-";

const hasChannelContent = (channel: ChannelContent) =>
  Boolean(channel.titleEn || channel.contentEn || channel.titleAr || channel.contentAr);

const isTemplateDetail = (value: unknown): value is MessageTemplateDetail =>
  Boolean(value) &&
  typeof value === "object" &&
  (() => {
    const detail = value as Record<string, unknown>;
    return "id" in detail || "templateCode" in detail || "templateName" in detail;
  })();

const getRecipientName = (item: unknown) => {
  const recipient = item as { name?: string; nameEn?: string; nameAr?: string };
  return recipient.name || recipient.nameEn || recipient.nameAr || "";
};

const unwrapTemplateDetail = (response: unknown): MessageTemplateDetail | null => {
  if (isTemplateDetail(response)) return response;
  if (!response || typeof response !== "object") return null;
  const data = (response as { data?: unknown }).data;
  if (isTemplateDetail(data)) return data;
  if (!data || typeof data !== "object") return null;
  const nestedData = (data as { data?: unknown }).data;
  return isTemplateDetail(nestedData) ? nestedData : null;
};

const formatDateTime = (value?: string) => {
  const date = value ? moment(value) : null;
  return date?.isValid() ? date.format("DD/MM/YYYY HH:mm") : "-";
};

const BroadcastView: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const [record, setRecord] = useState<BroadcastDetailRecord | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<ChannelKey[]>([]);

  const bv = useCallback(
    (key: string) => String(t(`Settings.broadcast.view.${key}` as never)),
    [t],
  );
  const channelLabels: Record<ChannelKey, string> = {
    email: String(t("Settings.broadcast.edit.channels.email")),
    sms: String(t("Settings.broadcast.edit.channels.sms")),
    inApp: String(t("Settings.broadcast.edit.channels.PopUp")),
  };

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
      setRecord(null);
      setExpandedChannels([]);
      return;
    }

    const fetchDetail = async () => {
      try {
        const response = await getMessageTemplateById(id, "2");
        const data = unwrapTemplateDetail(response);
        if (!data) throw new Error("BROADCAST_TEMPLATE_DETAIL_UNAVAILABLE");

        const portalIsAdmin = data.protalType === "1";
        const recipientItems = portalIsAdmin
          ? data.departmentsInfo || []
          : data.userTypeCodeInfo || [];
        const recipients = recipientItems.length > 0
          ? recipientItems.map(getRecipientName).filter(Boolean).join(", ")
          : portalIsAdmin
            ? String(t("Settings.broadcast.list.table.allDepartments" as never))
            : String(t("Settings.broadcast.list.table.allUserTypes" as never));
        const email: ChannelContent = {
          titleEn: firstNonEmpty(data.emailSubjectEn, data.subjectEn),
          contentEn: firstNonEmpty(data.emailBodyEn),
          titleAr: firstNonEmpty(data.emailSubjectAr, data.subjectAr),
          contentAr: firstNonEmpty(data.emailBodyAr),
        };
        const sms: ChannelContent = {
          titleEn: firstNonEmpty(data.smsTitleEn),
          contentEn: firstNonEmpty(data.smsen),
          titleAr: firstNonEmpty(data.smsTitleAr),
          contentAr: firstNonEmpty(data.smsar),
        };
        const inApp: ChannelContent = {
          titleEn: firstNonEmpty(data.inAppTitleEn),
          contentEn: firstNonEmpty(data.inAppMessageEn),
          titleAr: firstNonEmpty(data.inAppTitleAr),
          contentAr: firstNonEmpty(data.inAppMessageAr),
        };
        const nextRecord: BroadcastDetailRecord = {
          broadcastNo: data.templateCode || "-",
          status: data.status ?? null,
          portalCode: data.protalType || "",
          portal: portalIsAdmin
            ? String(t("Settings.broadcast.edit.portals.admin"))
            : String(t("Settings.broadcast.edit.portals.customer")),
          recipients,
          publishType: data.publishType || data.pulishType || "1",
          publishTime: formatDateTime(data.pushTime),
          expiryTime: formatDateTime(data.expireTime),
          publishedBy: displayPublishedByName(data.updateOnInfo?.name || data.createOnInfo?.name),
          channels: { email, sms, inApp },
        };
        setRecord(nextRecord);
        const firstContentChannel = CHANNELS.find((channel) =>
          hasChannelContent(nextRecord.channels[channel.key]),
        )?.key;
        setExpandedChannels(firstContentChannel ? [firstContentChannel] : []);
      } catch (error) {
        console.error("Failed to load broadcast detail", error);
        setRecord(null);
        setExpandedChannels([]);
      }
    };

    fetchDetail();
  }, [location.search, t]);

  const timingItems = useMemo(() => {
    if (!record) return [];
    if (record.publishType === "2") {
      return [
        { label: bv("labels.publishTime"), value: String(t("Settings.broadcast.edit.publishTypes.scheduled")) },
        { label: "Scheduled Time", value: record.publishTime },
      ];
    }
    return [
      { label: bv("labels.publishTime"), value: record.publishTime },
      { label: bv("labels.expiryTime"), value: record.expiryTime },
    ];
  }, [bv, record, t]);

  return (
    <div className="broadcast-view-page">
      {record && (
        <>
          <section className="broadcast-view-summary">
            <div className="broadcast-view-summary__fields">
              <div className="broadcast-view-summary__item">
                <span className="broadcast-view-summary__icon">
                  <img src={broadcastNoIcon} alt="" />
                </span>
                <div className="broadcast-view-summary__text">
                  <span className="broadcast-view-summary__label">{bv("labels.broadcastNo")}</span>
                  <strong>{record.broadcastNo}</strong>
                </div>
              </div>
              <div className="broadcast-view-summary__item">
                <span className="broadcast-view-summary__icon">
                  <img src={publishedByIcon} alt="" />
                </span>
                <div className="broadcast-view-summary__text">
                  <span className="broadcast-view-summary__label">{bv("labels.publishedBy")}</span>
                  <strong>{record.publishedBy}</strong>
                </div>
              </div>
              <div className="broadcast-view-summary__item">
                <span className="broadcast-view-summary__icon">
                  <img src={statusIcon} alt="" />
                </span>
                <div className="broadcast-view-summary__text">
                  <span className="broadcast-view-summary__label">{bv("labels.status")}</span>
                  <CustomStatusTag type="broadcast" status={Number(record.status)} />
                </div>
              </div>
            </div>
          </section>

          <div className="broadcast-view-grid">
            <section className="broadcast-view-card">
              <h2>{bv("sections.recipients")}</h2>
              <div className="broadcast-view-card__fields">
                <div>
                  <span>{bv("labels.receivingPortal")}</span>
                  <strong>{record.portal}</strong>
                </div>
                <div>
                  <span>{record.portalCode === "1" ? bv("labels.departments") : bv("labels.userTypes")}</span>
                  <strong>{record.recipients}</strong>
                </div>
              </div>
            </section>
            <section className="broadcast-view-card">
              <h2>{bv("sections.timing")}</h2>
              <div className="broadcast-view-card__fields">
                {timingItems.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="broadcast-view-content">
            <h2>{t("Settings.broadcast.edit.sections.channelsContent")}</h2>
            <div className="broadcast-view-accordions">
              {CHANNELS.map((channel) => {
                const content = record.channels[channel.key];
                const expanded = expandedChannels.includes(channel.key);
                return (
                  <article className="broadcast-view-channel" key={channel.key}>
                    <button
                      type="button"
                      className="broadcast-view-channel__header"
                      onClick={() => {
                        setExpandedChannels((current) =>
                          expanded
                            ? current.filter((key) => key !== channel.key)
                            : [...current, channel.key],
                        );
                      }}
                      aria-expanded={expanded}
                    >
                      <span className="broadcast-view-channel__name">
                        <img className="broadcast-view-channel__icon" src={channel.icon} alt="" />
                        {channelLabels[channel.key]}
                      </span>
                      {expanded ? <UpOutlined /> : <DownOutlined />}
                    </button>
                    {expanded && (
                      <div className="broadcast-view-channel__body">
                        <div className="broadcast-view-channel__language">
                          <div className="broadcast-view-channel__field">
                            <span>{bv("labels.titleEn")}</span>
                            <strong>{content.titleEn || "-"}</strong>
                          </div>
                          <div className="broadcast-view-channel__field">
                            <span>{bv("labels.contentEn")}</span>
                            <AuthenticatedDocumentHtml
                              className="broadcast-view-channel__html"
                              html={content.contentEn || "-"}
                            />
                          </div>
                        </div>
                        <div className="broadcast-view-channel__language broadcast-view-channel__language--arabic">
                          <div className="broadcast-view-channel__field">
                            <span>{bv("labels.titleAr")}</span>
                            <strong>{content.titleAr || "-"}</strong>
                          </div>
                          <div className="broadcast-view-channel__field">
                            <span>{bv("labels.contentAr")}</span>
                            <AuthenticatedDocumentHtml
                              className="broadcast-view-channel__html"
                              html={content.contentAr || "-"}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
      <CustomFooter onBack={() => history.push("/communications/broadcast")} />
    </div>
  );
};

export default BroadcastView;
