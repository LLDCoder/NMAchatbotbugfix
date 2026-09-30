import "./index.less";
import { Alert, Button, Empty, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import LogsDetail1 from "@/assets/images/LogsDetail1.svg";
import LogsDetail2 from "@/assets/images/LogsDetail2.svg";
import LogsDetail3 from "@/assets/images/LogsDetail3.svg";
import LogsDetail4 from "@/assets/images/LogsDetail4.svg";
import {
  type AdminLogKind,
  type AdminLogRecord,
  getSecurityAuditLog,
  getSecurityLog,
  getSystemOperationLog,
  getUserActivityLog,
} from "@/services/Logs";
import {
  formatLogId,
  isSystemOperationActor,
  resolveBusinessEvent,
} from "@/pages/AdminPortalLogs/logFormatters";
import { fmt } from "@/utils/gstTime";

const LOG_DETAIL_TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss";

const DETAIL_REQUESTS: Record<AdminLogKind, (id: string) => Promise<AdminLogRecord>> = {
  userActivity: getUserActivityLog,
  systemOperations: getSystemOperationLog,
  securityLogs: getSecurityLog,
  securityAudit: getSecurityAuditLog,
};

const LOG_TYPE_KEYS: Record<AdminLogKind, string> = {
  userActivity: "tabs.userActivity",
  systemOperations: "tabs.systemOperations",
  securityLogs: "tabs.securityLogs",
  securityAudit: "tabs.adminSecurityLogs",
};

const SUMMARY_ICONS = [LogsDetail1, LogsDetail2, LogsDetail3, LogsDetail4];

function isAdminLogKind(value: string | null): value is AdminLogKind {
  return value != null && Object.prototype.hasOwnProperty.call(DETAIL_REQUESTS, value);
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function buildKibanaUrl(traceId?: string) {
  const template = import.meta.env.VITE_KIBANA_TRACE_URL_TEMPLATE;
  if (!traceId || !template) return undefined;
  return String(template).replace("{traceId}", encodeURIComponent(traceId));
}

interface DetailItem {
  label: string;
  value: unknown;
}

function hasDisplayValue(value: unknown) {
  return value !== null
    && value !== undefined
    && !(typeof value === "string" && value.trim() === "");
}

function compactItems(items: DetailItem[]) {
  return items.filter((item) => hasDisplayValue(item.value));
}

function DetailSection({ title, items }: { title: string; items: DetailItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="container logs-detail-section">
      <h2 className="container-title">{title}</h2>
      <div className="container-row">
        {items.map((item) => (
          <div className="item" key={item.label}>
            <div className="title">{item.label}</div>
            <div className="value">{displayValue(item.value)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminPortalLogsDetail() {
  const { t } = useTranslation();
  const location = useLocation<{ details?: AdminLogRecord; kind?: AdminLogKind }>();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const id = searchParams.get("id");
  const queryKind = searchParams.get("kind");
  const kind = isAdminLogKind(queryKind) ? queryKind : location.state?.kind;
  const requestKey = id && kind ? `${kind}:${id}` : undefined;
  const stateDetails = location.state?.details;
  const stateRequestKey = stateDetails && location.state?.kind
    ? `${location.state.kind}:${stateDetails.id}`
    : undefined;
  const initialRecord = requestKey && stateRequestKey === requestKey ? stateDetails : undefined;
  const [record, setRecord] = useState<AdminLogRecord | undefined>(initialRecord);
  const [loading, setLoading] = useState(Boolean(id && kind));
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!id || !kind) {
      setRecord(undefined);
      setLoadFailed(false);
      setLoading(false);
      return;
    }

    let active = true;
    const fallbackRecord = stateRequestKey === requestKey ? stateDetails : undefined;
    setRecord(fallbackRecord);
    setLoadFailed(false);
    setLoading(true);
    DETAIL_REQUESTS[kind](id)
      .then((details) => {
        if (active) setRecord(details);
      })
      .catch(() => {
        if (active) {
          setRecord(fallbackRecord);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, kind, requestKey, stateDetails, stateRequestKey]);

  const traceId = String(record?.traceId ?? record?.correlationId ?? "") || undefined;
  const kibanaUrl = buildKibanaUrl(traceId);

  if (loading && !record) {
    return (
      <div className="LogsDetail-container logs-detail-state">
        <Spin size="large" />
      </div>
    );
  }

  if (!record || !kind) {
    return (
      <div className="LogsDetail-container logs-detail-state">
        {loadFailed ? (
          <Alert
            type="error"
            showIcon
            message={t("Settings.adminPortalLogs.messages.detailLoadFailed")}
          />
        ) : (
          <Empty description={t("Settings.adminPortalLogsDetail.empty.noData")} />
        )}
      </div>
    );
  }

  const security = kind === "securityLogs" || kind === "securityAudit";
  const status = security
    ? record.isSuccess === true
      ? "Success"
      : record.isSuccess === false
        ? "Failed"
        : "-"
    : record.status === "Success" || record.status === "Failed"
      ? record.status
      : "-";
  const timestamp = record.eventTimestamp ?? record.createTime ?? record.createdAt;
  const portal = record.source
    ?? (kind === "userActivity" || kind === "securityLogs"
      ? "CustomerPortalService"
      : "AdminPortalService");
  const localizedPortal = portal === "CustomerPortalService"
    ? t("Settings.adminPortalLogs.options.source.CustomerPortalService")
    : portal === "AdminPortalService"
      ? t("Settings.adminPortalLogs.options.source.AdminPortalService")
      : portal;
  const summary = [
    { label: t("Settings.adminPortalLogsDetail.summary.logType"), value: t(`Settings.adminPortalLogs.${LOG_TYPE_KEYS[kind]}` as never) },
    { label: t("Settings.adminPortalLogsDetail.summary.portal"), value: localizedPortal },
    { label: t("Settings.adminPortalLogsDetail.summary.status"), value: status, status: true },
    { label: t("Settings.adminPortalLogsDetail.summary.timestamp"), value: timestamp ? fmt(timestamp, LOG_DETAIL_TIMESTAMP_FORMAT) : "-" },
  ];
  const requestParameters = record.requestParameters ?? record.requestParam;
  const isSystemActor = kind === "systemOperations"
    && isSystemOperationActor(record);
  const isAuthenticatedAdminActor = kind === "systemOperations"
    && !isSystemActor
    && hasDisplayValue(record.userId);
  const actorType = isSystemActor
    ? "System"
    : isAuthenticatedAdminActor
      ? String(t("Settings.adminPortalLogsDetail.options.actorType.adminUser"))
      : String(t("Settings.adminPortalLogsDetail.options.actorType.anonymous"));
  const userInformationItems = kind === "userActivity"
    ? compactItems([
        { label: String(t("Settings.adminPortalLogsDetail.userInfo.id")), value: record.userId },
        { label: String(t("Settings.adminPortalLogsDetail.userInfo.fullName")), value: record.userName },
        { label: String(t("Settings.adminPortalLogsDetail.userInfo.userRole")), value: record.userRole },
      ])
    : kind === "systemOperations"
      ? compactItems([
          { label: String(t("Settings.adminPortalLogsDetail.userInfo.actorType")), value: actorType },
          { label: String(t("Settings.adminPortalLogsDetail.userInfo.id")), value: isSystemActor ? "System" : record.userId },
          { label: String(t("Settings.adminPortalLogsDetail.userInfo.fullName")), value: isSystemActor ? "System" : record.userName },
          { label: String(t("Settings.adminPortalLogsDetail.userInfo.userRole")), value: isSystemActor ? "System" : record.userRole },
        ])
      : compactItems([
          { label: String(t("Settings.adminPortalLogsDetail.userInfo.id")), value: record.userId },
          { label: String(t("Settings.adminPortalLogsDetail.userInfo.fullName")), value: record.userName },
          { label: String(t("Settings.adminPortalLogsDetail.userInfo.userRole")), value: record.userRole },
          ...(record.source === "AdminPortalService"
            ? [{ label: String(t("Settings.adminPortalLogsDetail.userInfo.department")), value: record.department }]
            : []),
        ]);
  const activityInformationItems = compactItems([
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.actionEvent")), value: resolveBusinessEvent(record) },
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.controllerName")), value: record.controllerName },
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.actionName")), value: record.actionName },
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.httpMethod")), value: record.httpMethod },
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.requestUrl")), value: record.requestUrl },
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.executionTime")), value: record.elapsed == null ? null : `${record.elapsed} ms` },
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.traceId")), value: record.traceId ?? record.correlationId },
  ]);
  const securityEventItems = compactItems([
    { label: String(t("Settings.adminPortalLogsDetail.securityInfo.eventType")), value: record.eventType },
    { label: String(t("Settings.adminPortalLogsDetail.securityInfo.eventDescription")), value: record.eventDescription },
    {
      label: String(t("Settings.adminPortalLogsDetail.securityInfo.result")),
      value: record.isSuccess === true
        ? String(t("Settings.adminPortalLogs.options.success"))
        : record.isSuccess === false
          ? String(t("Settings.adminPortalLogs.options.failed"))
          : null,
    },
    {
      label: String(t("Settings.adminPortalLogsDetail.securityInfo.suspicious")),
      value: record.isSuspicious === true
        ? String(t("Settings.adminPortalLogs.options.true"))
        : record.isSuspicious === false
          ? String(t("Settings.adminPortalLogs.options.false"))
          : null,
    },
    { label: String(t("Settings.adminPortalLogsDetail.securityInfo.failureReason")), value: record.failureReason },
    { label: String(t("Settings.adminPortalLogsDetail.securityInfo.responseStatusCode")), value: record.responseStatusCode },
  ]);
  const securityRequestItems = compactItems([
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.requestMethod")), value: record.requestMethod },
    { label: String(t("Settings.adminPortalLogsDetail.requestInfo.requestPath")), value: record.requestPath },
    { label: String(t("Settings.adminPortalLogsDetail.securityInfo.responseStatusCode")), value: record.responseStatusCode },
  ]);
  const networkDeviceItems = compactItems([
    { label: String(t("Settings.adminPortalLogsDetail.networkInfo.ipAddress")), value: record.ipAddress ?? record.remoteIp },
    ...(kind === "systemOperations"
      ? [
          { label: String(t("Settings.adminPortalLogsDetail.networkInfo.browser")), value: record.browser },
          { label: String(t("Settings.adminPortalLogsDetail.networkInfo.operatingSystem")), value: record.os },
        ]
      : [
          { label: String(t("Settings.adminPortalLogsDetail.networkInfo.location")), value: record.location },
          { label: String(t("Settings.adminPortalLogsDetail.networkInfo.browser")), value: record.browser },
          { label: String(t("Settings.adminPortalLogsDetail.networkInfo.operatingSystem")), value: record.os },
          { label: String(t("Settings.adminPortalLogsDetail.networkInfo.deviceType")), value: record.device },
        ]),
  ]);
  const operationResultItems = compactItems([
    { label: String(t("Settings.adminPortalLogsDetail.fields.returnResult")), value: record.returnResult },
    { label: String(t("Settings.adminPortalLogsDetail.fields.exception")), value: record.exception },
    { label: String(t("Settings.adminPortalLogsDetail.fields.message")), value: record.message },
  ]);
  const securityAuthenticationEvents = new Set([
    "LoginSuccess",
    "LoginFailure",
    "RepeatedLoginFailure",
    "AccountLocked",
    "AccountDisabled",
    "PasswordChanged",
    "ForgotPasswordProbe",
    "Logout",
  ]);
  const showRequestParameters = kind === "systemOperations"
    ? hasDisplayValue(requestParameters)
    : security && hasDisplayValue(requestParameters) && !securityAuthenticationEvents.has(record.eventType ?? "");
  const showUserAgent = kind !== "systemOperations" && hasDisplayValue(record.userAgent);

  return (
    <div className="LogsDetail-container">
      {kibanaUrl ? (
        <div className="logs-detail-actions">
          <Button type="primary" href={kibanaUrl} target="_blank" rel="noreferrer">
            {t("Settings.adminPortalLogsDetail.actions.openInKibana")}
          </Button>
        </div>
      ) : null}
      {loadFailed ? (
        <Alert
          type="warning"
          showIcon
          message={t("Settings.adminPortalLogs.messages.detailLoadFailed")}
        />
      ) : null}
      <section className="container logs-detail-summary">
        <h1 className="container-title">
          {kind === "securityLogs"
            ? record.logNumber?.trim()
              ? `SEC-${record.logNumber.trim()}`
              : "-"
            : formatLogId(kind, record.id)}
        </h1>
        <div className="icon-flex">
          {summary.map((item, index) => (
            <div className="icon-item" key={String(item.label)}>
              <img src={SUMMARY_ICONS[index]} alt="" />
              <div>
                <div className="title">{item.label}</div>
                {item.status && status !== "-" ? (
                  <div className={`status-tag ${status}`}>
                    {status === "Success"
                      ? t("Settings.adminPortalLogs.options.success")
                      : t("Settings.adminPortalLogs.options.failed")}
                  </div>
                ) : (
                  <div className="value">{displayValue(item.value)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <DetailSection
        title={String(t("Settings.adminPortalLogsDetail.sections.userInformation"))}
        items={userInformationItems}
      />
      {security ? (
        <>
          <DetailSection
            title={String(t("Settings.adminPortalLogsDetail.sections.securityEventInformation"))}
            items={securityEventItems}
          />
          <DetailSection
            title={String(t("Settings.adminPortalLogsDetail.sections.requestInformation"))}
            items={securityRequestItems}
          />
        </>
      ) : (
        <DetailSection
          title={String(t(`Settings.adminPortalLogsDetail.sections.${kind === "userActivity" ? "activityInformation" : "operationInformation"}` as never))}
          items={activityInformationItems}
        />
      )}
      <DetailSection
        title={String(t("Settings.adminPortalLogsDetail.sections.networkDeviceInformation"))}
        items={networkDeviceItems}
      />
      {kind === "systemOperations" ? (
        <DetailSection
          title={String(t("Settings.adminPortalLogsDetail.sections.operationResult"))}
          items={operationResultItems}
        />
      ) : null}
      {showRequestParameters ? (
        <section className="container logs-detail-section">
          <h2 className="container-title">{t("Settings.adminPortalLogsDetail.sections.requestParameters")}</h2>
          <pre className="container-html">{displayValue(requestParameters)}</pre>
        </section>
      ) : null}
      {showUserAgent ? (
        <section className="container logs-detail-section">
          <h2 className="container-title">{t("Settings.adminPortalLogsDetail.sections.userAgentString")}</h2>
          <div className="container-html">{displayValue(record.userAgent)}</div>
        </section>
      ) : null}
    </div>
  );
}
