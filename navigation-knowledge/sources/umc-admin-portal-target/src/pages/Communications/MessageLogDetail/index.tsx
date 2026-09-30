import { CloseCircleFilled } from "@ant-design/icons";
import { Button, Result, Spin } from "antd";
import type { AxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import messageLogEmailIcon from "@/assets/icons/message-log-email.svg";
import messageLogNumberIcon from "@/assets/icons/message-log-number.svg";
import messageLogSentTimeIcon from "@/assets/icons/message-log-sent-time.svg";
import messageLogSmsIcon from "@/assets/icons/message-log-sms.svg";
import messageLogStatusIcon from "@/assets/icons/message-log-status.svg";
import messageLogTypeIcon from "@/assets/icons/message-log-type.svg";
import { CustomFooter } from "@/components/common";
import { useCanRenderButton } from "@/routes/access";
import { getMessageLogById } from "@/services/messageLog";
import type { MessageLogRecord } from "@/services/messageLog";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import EmailMessageContent from "./components/EmailMessageContent";
import hasText from "./components/hasText";
import SmsMessageContent from "./components/SmsMessageContent";
import "./index.less";

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="message-detail-field">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function MessageContent({ record }: { record: MessageLogRecord }) {
  const { t } = useTranslation();
  const isEmail = record.channel === "Email";
  return (
    <section className="message-detail-section message-detail-content-section">
      <h2>{t("Communications.messageLogDetail.content")}</h2>
      <div className="message-content-card">
        <div className="message-content-card__title">
          <span className="message-content-card__icon">
            <img
              src={isEmail ? messageLogEmailIcon : messageLogSmsIcon}
              alt=""
              aria-hidden="true"
            />
          </span>
          <strong>{record.channel}</strong>
        </div>
        <div className="message-content-card__fields">
          {isEmail ? (
            <EmailMessageContent record={record} />
          ) : (
            <SmsMessageContent record={record} />
          )}
        </div>
      </div>
    </section>
  );
}

export default function MessageLogDetail() {
  const history = useHistory();
  const location = useLocation();
  const { t } = useTranslation();
  const canViewDetails = useCanRenderButton(
    PERMISSION_CODES.communications.messageLog.detail,
    "/communications/message-log/message-details",
  );
  const id = Number(new URLSearchParams(location.search).get("id"));
  const [record, setRecord] = useState<MessageLogRecord>();
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<"403" | "404" | "error">();
  const [reloadKey, setReloadKey] = useState(0);

  const loadRecord = useCallback(async () => {
    void reloadKey;
    if (!canViewDetails) {
      setLoading(false);
      setErrorStatus("403");
      return;
    }
    if (!Number.isInteger(id) || id <= 0) {
      setLoading(false);
      setErrorStatus("404");
      return;
    }

    setLoading(true);
    setErrorStatus(undefined);
    try {
      setRecord(await getMessageLogById(id));
    } catch (error) {
      setRecord(undefined);
      const status = (error as AxiosError).response?.status;
      setErrorStatus(status === 404 ? "404" : status === 403 ? "403" : "error");
    } finally {
      setLoading(false);
    }
  }, [canViewDetails, id, reloadKey]);

  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  if (loading) {
    return (
      <div
        className="message-detail-page message-detail-state"
        role="status"
        aria-atomic="true"
        aria-busy="true"
        aria-label={t("Communications.messageLogDetail.loadingAria")}
      >
        <Spin size="large" tip={t("Communications.messageLogDetail.loadingTip")} />
      </div>
    );
  }

  if (!record || errorStatus) {
    const isNotFound = errorStatus === "404";
    const isForbidden = errorStatus === "403";
    return (
      <div className="message-detail-page">
        <Result
          status={isNotFound ? "404" : isForbidden ? "403" : "error"}
          title={
            isNotFound
              ? t("Communications.messageLogDetail.notFound")
              : isForbidden
                ? t("Communications.messageLogDetail.forbidden")
                : t("Communications.messageLogDetail.loadError")
          }
          subTitle={isNotFound ? t("Communications.messageLogDetail.notFoundDescription") : undefined}
          extra={
            <>
              {!isNotFound && !isForbidden && (
                <Button onClick={() => setReloadKey((value) => value + 1)}>{t("Communications.messageLogDetail.retry")}</Button>
              )}
              <Button onClick={() => history.push("/communications/message-log")}>{t("Communications.messageLogDetail.back")}</Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="message-detail-page">
      <section className="message-detail-summary">
        <div className="message-detail-summary__item">
          <span className="message-detail-summary__icon"><img src={messageLogNumberIcon} alt="" aria-hidden="true" /></span>
          <DetailField label={t("Communications.messageLogDetail.no")} value={record.no} />
        </div>
        <div className="message-detail-summary__item">
          <span className="message-detail-summary__icon"><img src={messageLogTypeIcon} alt="" aria-hidden="true" /></span>
          <DetailField label={t("Communications.messageLogDetail.type")} value={record.type} />
        </div>
        <div className="message-detail-summary__item">
          <span className="message-detail-summary__icon"><img src={messageLogStatusIcon} alt="" aria-hidden="true" /></span>
          <div className="message-detail-field">
            <span>{t("Communications.messageLogDetail.status")}</span>
            <strong className={`message-detail-status message-detail-status--${record.status.toLowerCase()}`}>
              {record.status}
            </strong>
          </div>
        </div>
        <div className="message-detail-summary__item">
          <span className="message-detail-summary__icon"><img src={messageLogSentTimeIcon} alt="" aria-hidden="true" /></span>
          <DetailField label={t("Communications.messageLogDetail.sentTime")} value={record.sentTime} />
        </div>
      </section>

      <section className="message-detail-section">
        <h2>{t("Communications.messageLogDetail.messageInfo")}</h2>
        <div className="message-detail-info-grid">
          <DetailField label={t("Communications.messageLogDetail.recipient")} value={record.recipient} />
          <DetailField label={t("Communications.messageLogDetail.portal")} value={record.portal} />
          <DetailField label={t("Communications.messageLogDetail.channel")} value={record.channel} />
          <DetailField label={t("Communications.messageLogDetail.sentBy")} value={record.sentBy} />
        </div>
        {record.status === "Failed" && (
          <div className="message-detail-failure">
            <CloseCircleFilled />
            <div className="message-detail-failure__content">
              <strong>{t("Communications.messageLogDetail.failedReason")}</strong>
              <span>{record.failedReason || t("Communications.messageLogDetail.failedReasonFallback")}</span>
            </div>
          </div>
        )}
        {record.type === "Message Template" && (
          <div className="message-detail-contact">
            <div className="message-detail-contact__title">
              <strong>{t("Communications.messageLogDetail.relatedRecipientContact")}</strong>
            </div>
            <div className="message-detail-contact__fields">
              {record.channel === "Email" ? (
                <>
                  <DetailField label={t("Communications.messageLogDetail.recipientEmailAddress")} value={hasText(record.recipientEmail) ? record.recipientEmail : t("Communications.messageLogDetail.notProvided")} />
                  {hasText(record.cc) && <DetailField label={t("Communications.messageLogDetail.cc")} value={record.cc} />}
                </>
              ) : (
                <DetailField label={t("Communications.messageLogDetail.recipientMobileNumber")} value={hasText(record.recipientMobile) ? record.recipientMobile : t("Communications.messageLogDetail.notProvided")} />
              )}
            </div>
          </div>
        )}
      </section>

      <MessageContent record={record} />

      <CustomFooter onBack={() => history.push("/communications/message-log")} />
    </div>
  );
}
