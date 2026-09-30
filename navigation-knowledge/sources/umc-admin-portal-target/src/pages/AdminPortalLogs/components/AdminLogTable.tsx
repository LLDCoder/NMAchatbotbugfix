import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { DatePicker, Input, Select, Tooltip } from "antd";
import type { ColumnType, TableProps } from "antd/lib/table";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { CustomButton, CustomMessage } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import { FilterTable, useFilter } from "@/components/common/FilterTable";
import { usePagination } from "@/hooks/usePagination";
import { downloadBlobFile } from "@/pages/InspectionCommon/csvExport";
import Sousuo from "@/assets/icons/Sousuo";
import {
  type AdminLogKind,
  type AdminLogRecord,
  type LogExportResponse,
  type LogQueryRequest,
  exportSecurityAuditLogs,
  exportSecurityLogs,
  exportSystemOperationLogs,
  exportUserActivityLogs,
  getLogFilterOptions,
  getSecurityAuditLogPage,
  getSecurityLogPage,
  getSystemOperationLogPage,
  getUserActivityLogPage,
} from "@/services/Logs";
import { transformNoValueString, transformSpaceString } from "@/utils/transform";
import { DISPLAY_DATETIME_SEC, fmt, toApi, GST } from "@/utils/gstTime";
import {
  buildUtcLogFileName,
  formatLogId,
  getFilenameFromContentDisposition,
  isSystemOperationActor,
  resolveBusinessEvent,
} from "../logFormatters";

interface AdminLogTableProps {
  kind: AdminLogKind;
}

// Each tab maps to one portal boundary, so Source is fixed and exposed as a locked Select.
const LOG_CONFIG = {
  userActivity: {
    security: false,
    fixedSource: "CustomerPortalService",
    getPage: getUserActivityLogPage,
    exportFile: exportUserActivityLogs,
    fileNamePrefix: "user-activity-logs",
  },
  systemOperations: {
    security: false,
    fixedSource: "AdminPortalService",
    getPage: getSystemOperationLogPage,
    exportFile: exportSystemOperationLogs,
    fileNamePrefix: "system-operation-logs",
  },
  securityLogs: {
    security: true,
    fixedSource: undefined,
    getPage: getSecurityLogPage,
    exportFile: exportSecurityLogs,
    fileNamePrefix: "security-logs",
  },
  securityAudit: {
    security: true,
    fixedSource: "AdminPortalService",
    getPage: getSecurityAuditLogPage,
    exportFile: exportSecurityAuditLogs,
    fileNamePrefix: "admin-security-logs",
  },
} satisfies Record<AdminLogKind, {
  security: boolean;
  fixedSource: string | undefined;
  getPage: typeof getUserActivityLogPage;
  exportFile: (data: LogQueryRequest) => Promise<LogExportResponse>;
  fileNamePrefix: string;
}>;

const DEFAULT_PAGE = {
  pageIndex: 1,
  pageSize: 10,
};

const displayValue = (value?: string | number | null) =>
  typeof value === "string" && value.trim() === ""
    ? "-"
    : transformNoValueString(value as string | number);

const normalizeOptionKey = (value: string) => value.replace(/\./g, "_");

export default function AdminLogTable({ kind }: AdminLogTableProps) {
  const config = LOG_CONFIG[kind];
  const [pageInfo, setPage] = usePagination();
  const [filterStore] = useFilter();
  const [dataSource, setDataSource] = useState<AdminLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    sources: [] as string[],
    environments: [] as string[],
    statuses: [] as string[],
    eventTypes: [] as string[],
  });
  const { t } = useTranslation();
  const history = useHistory();

  const apl = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      opts != null
        ? String(t(`Settings.adminPortalLogs.${key}` as never, opts))
        : String(t(`Settings.adminPortalLogs.${key}` as never)),
    [t],
  );

  const localizedLogValue = useCallback(
    (group: "source" | "environment" | "eventType" | "status", value?: string | null) => {
      if (!value) return "-";
      if (group === "status") {
        if (value === "Success") return apl("options.success");
        if (value === "Failed") return apl("options.failed");
      }
      const key = `Settings.adminPortalLogs.options.${group}.${normalizeOptionKey(value)}`;
      const translated = String(t(key as never));
      return translated === key ? value : translated;
    },
    [apl, t],
  );

  const getFilterRequest = useCallback((): LogQueryRequest => {
    const { keyword, source, environment, status, eventType, isSuccess, date } =
      filterStore.getFieldsValue();
    const trimmedKeyword = typeof keyword === "string" ? keyword.trim() : "";
    // Date contract: submit Dubai wall-clock (no Z/offset) day boundaries as a half-open range
    // [startOfSelectedFrom, startOfDayAfterSelectedTo) so it aligns with the backend's
    // `CreateTime >= start && CreateTime < end` filter. Boundaries are taken in the Dubai timezone
    // regardless of the browser timezone (frontend datetime guideline §3.1 / §4).
    const startTime = date?.[0] ? toApi(dayjs(date[0]).tz(GST).startOf("day")) : undefined;
    const endTime = date?.[1] ? toApi(dayjs(date[1]).tz(GST).add(1, "day").startOf("day")) : undefined;

    const request: LogQueryRequest = {
      keyword: trimmedKeyword || undefined,
      source: config.fixedSource || source || undefined,
      status: config.security ? undefined : status || undefined,
      eventType: config.security ? eventType || undefined : undefined,
      isSuccess: config.security && typeof isSuccess === "boolean" ? isSuccess : undefined,
      startTime,
      endTime,
    };

    if (kind !== "userActivity") {
      request.environment = environment || undefined;
    }
    return request;
  }, [config.fixedSource, config.security, filterStore, kind]);

  const loadLogs = useCallback(
    async (pagination = DEFAULT_PAGE) => {
      setLoading(true);
      try {
        const response = await config.getPage({
          ...getFilterRequest(),
          ...pagination,
        });
        const { currentPage, itemsPerPage, totalItems, items } = response.data;
        setPage({
          pageIndex: currentPage || pagination.pageIndex,
          pageSize: itemsPerPage || pagination.pageSize,
          total: totalItems || 0,
        });
        setDataSource(items || []);
      } catch {
        CustomMessage.error(apl("messages.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [apl, config, getFilterRequest, setPage],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;
    let errorShown = false;
    const loadOptions = () => {
      getLogFilterOptions(kind)
        .then((options) => {
          if (active) setFilterOptions(options);
        })
        .catch(() => {
          if (!active) return;
          if (!errorShown) {
            CustomMessage.error(apl("messages.optionsLoadFailed"));
            errorShown = true;
          }
          retryTimer = window.setTimeout(loadOptions, 10_000);
        });
    };
    loadOptions();
    return () => {
      active = false;
      if (retryTimer != null) window.clearTimeout(retryTimer);
    };
  }, [apl, kind]);

  const requestFilteredLogs = useCallback(
    () => loadLogs({ pageIndex: 1, pageSize: pageInfo.pageSize }),
    [loadLogs, pageInfo.pageSize],
  );

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      const response = await config.exportFile(getFilterRequest());
      const fileName = getFilenameFromContentDisposition(
        response.headers["content-disposition"],
      ) || buildUtcLogFileName(config.fileNamePrefix);
      downloadBlobFile(fileName, response.data);
    } catch {
      CustomMessage.error(apl("messages.exportFailed"));
    } finally {
      setExportLoading(false);
    }
  }, [apl, config, getFilterRequest]);

  const columns = useMemo<ColumnType<AdminLogRecord>[]>(() => {
    if (kind === "userActivity") {
      return [
        {
          title: apl("table.logId"),
          dataIndex: "id",
          key: "id",
          width: 130,
          render: (id: string | number) => formatLogId(kind, id),
        },
        {
          title: apl("table.accountHolder"),
          dataIndex: "userName",
          key: "userName",
          width: 150,
          render: (text: string) => displayValue(text),
        },
        {
          title: apl("table.actionEvent"),
          dataIndex: "businessEvent",
          key: "businessEvent",
          width: 220,
          render: (_text: string, record) => {
            const event = resolveBusinessEvent(record);
            return (
              <Tooltip
                title={event}
                color="#fff"
                overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
                placement="topLeft"
                className="text-ellipsis-2"
              >
                {event}
              </Tooltip>
            );
          },
        },
        {
          title: apl("table.ipAddress"),
          dataIndex: "remoteIp",
          key: "remoteIp",
          width: 140,
          render: (text: string) => displayValue(text),
        },
        {
          title: apl("table.status"),
          dataIndex: "status",
          key: "status",
          width: 120,
          render: (text: string) => (
            <div className={`status-tag ${transformSpaceString(text || "")}`}>
              {localizedLogValue("status", text)}
            </div>
          ),
        },
        {
          title: apl("table.timestamp"),
          dataIndex: "createTime",
          key: "createTime",
          width: 180,
          render: (text: string) => fmt(text, DISPLAY_DATETIME_SEC),
        },
      ];
    }

    if (kind === "systemOperations") {
      return [
        {
          title: apl("table.logId"),
          dataIndex: "id",
          key: "id",
          width: 150,
          render: (id: string | number) => formatLogId(kind, id),
        },
        {
          title: apl("table.adminUser"),
          dataIndex: "userName",
          key: "userName",
          width: 160,
          render: (text: string, record) =>
            isSystemOperationActor(record) ? "System" : displayValue(text),
        },
        {
          title: apl("table.userRole"),
          dataIndex: "userRole",
          key: "userRole",
          width: 190,
          render: (text: string, record) =>
            isSystemOperationActor(record) ? "System" : displayValue(text),
        },
        {
          title: apl("table.actionEvent"),
          dataIndex: "businessEvent",
          key: "businessEvent",
          width: 220,
          render: (_text: string, record) => {
            const event = resolveBusinessEvent(record);
            return (
              <Tooltip
                title={event}
                color="#fff"
                overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
                placement="topLeft"
                className="text-ellipsis-2"
              >
                {event}
              </Tooltip>
            );
          },
        },
        {
          title: apl("table.ipAddress"),
          dataIndex: "remoteIp",
          key: "remoteIp",
          width: 140,
          render: (text: string) => displayValue(text),
        },
        {
          title: apl("table.status"),
          dataIndex: "status",
          key: "status",
          width: 120,
          render: (text: string) => (
            <div className={`status-tag ${transformSpaceString(text || "")}`}>
              {localizedLogValue("status", text)}
            </div>
          ),
        },
        {
          title: apl("table.timestamp"),
          dataIndex: "createTime",
          key: "createTime",
          width: 180,
          render: (text: string) => fmt(text, DISPLAY_DATETIME_SEC),
        },
      ];
    }

    return [
      {
        title: apl("table.logId"),
        dataIndex: "id",
        key: "id",
        width: 220,
        render: (id: string | number, record) => {
          if (kind !== "securityLogs") return formatLogId(kind, id);
          const logNumber = record.logNumber?.trim();
          return logNumber ? `SEC-${logNumber}` : "-";
        },
      },
      {
        title: apl("table.accountHolder"),
        dataIndex: "userName",
        key: "userName",
        width: 150,
        render: (text: string) => displayValue(text),
      },
      {
        title: apl("table.userRole"),
        dataIndex: "userRole",
        key: "userRole",
        width: 190,
        render: (text: string) => displayValue(text),
      },
      {
        title: apl("table.securityEvent"),
        dataIndex: "eventType",
        key: "eventType",
        width: 190,
        render: (text: string, record) => (
          <Tooltip
            title={record.eventDescription || text}
            color="#fff"
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
            className="text-ellipsis-2"
          >
            {localizedLogValue("eventType", text)}
          </Tooltip>
        ),
      },
      {
        title: apl("filters.source"),
        dataIndex: "source",
        key: "source",
        width: 160,
        render: (text: string) => localizedLogValue("source", text),
      },
      {
        title: apl("table.ipAddress"),
        dataIndex: "ipAddress",
        key: "ipAddress",
        width: 140,
        render: (text: string) => displayValue(text),
      },
      {
        title: apl("table.status"),
        dataIndex: "isSuccess",
        key: "isSuccess",
        width: 120,
        render: (value: boolean | null | undefined, record) => {
          if (value !== true && value !== false) return "-";
          const status = value ? "Success" : "Failed";
          const label = value ? apl("options.success") : apl("options.failed");
          return (
            <div className={`status-tag ${transformSpaceString(status)}`}>
              {label}
              {record.isSuspicious ? " (!)" : ""}
            </div>
          );
        },
      },
      {
        title: apl("table.timestamp"),
        dataIndex: "eventTimestamp",
        key: "eventTimestamp",
        width: 180,
        render: (text: string) => fmt(text, DISPLAY_DATETIME_SEC),
      },
    ];
  }, [apl, kind, localizedLogValue]);

  const tableFilters = useMemo(() => {
    const searchFilter = {
      label: apl("filters.search"),
      element: (
        <Input
          key="input-keyword"
          placeholder={apl("filters.search")}
          prefix={<Sousuo className="search-icon" />}
          className="search-input"
          allowClear
        />
      ),
      requestDebounceMs: 500,
    };
    const sourceFilter = {
      label: apl("filters.source"),
      element: (
        <Select
          key="select-source"
          placeholder={
            config.fixedSource
              ? localizedLogValue("source", config.fixedSource)
              : apl("filters.allSources")
          }
          className="select-style"
          options={
            config.fixedSource
              ? [{
                  value: config.fixedSource,
                  label: localizedLogValue("source", config.fixedSource),
                }]
              : filterOptions.sources.map((value) => ({
                  value,
                  label: localizedLogValue("source", value),
                }))
          }
          disabled={Boolean(config.fixedSource)}
          allowClear={!config.fixedSource}
        />
      ),
    };
    const statusFilter = {
      label: apl("table.status"),
      element: (
        <Select
          key="select-status"
          placeholder={apl("filters.allStatuses")}
          className="select-style"
          options={filterOptions.statuses.map((value) => ({
            value,
            label: localizedLogValue("status", value),
          }))}
          allowClear
        />
      ),
    };
    const dateFilter = {
      label: apl("filters.date"),
      element: (
        <DatePicker.RangePicker
          key="range-date"
          format="DD/MM/YYYY"
          placeholder={[apl("filters.startDate"), apl("filters.endDate")]}
          className="range-picker"
          allowClear
        />
      ),
    };

    if (kind !== "securityLogs" && kind !== "securityAudit") {
      return [searchFilter, statusFilter, sourceFilter, dateFilter];
    }

    return [
      searchFilter,
      {
        label: apl("filters.eventType"),
        element: (
          <Select
            key="select-eventType"
            placeholder={apl("filters.allEventTypes")}
            className="select-style"
            options={filterOptions.eventTypes.map((value) => ({
              value,
              label: localizedLogValue("eventType", value),
            }))}
            allowClear
          />
        ),
      },
      sourceFilter,
      {
        label: apl("filters.result"),
        element: (
          <Select
            key="select-isSuccess"
            placeholder={apl("filters.allResults")}
            className="select-style"
            options={[
              { value: true, label: apl("options.success") },
              { value: false, label: apl("options.failed") },
            ]}
            allowClear
          />
        ),
      },
      dateFilter,
    ];
  }, [apl, config.fixedSource, filterOptions, kind, localizedLogValue]);

  const tableProps = useMemo<TableProps<AdminLogRecord>>(
    () => ({
      scroll: { x: 1000 },
      rowKey: (record) => record.id,
      columns,
      dataSource,
      onRow: (record) => ({
        onClick: (event) => {
          event.stopPropagation();
          history.push(
            `/system-management/adminPortalLogs/adminPortalLogsDetail?id=${record.id}&kind=${kind}`,
            { details: record, kind },
          );
        },
      }),
      onChange: (pagination) => {
        void loadLogs({
          pageIndex: pagination.current ?? 1,
          pageSize: pagination.pageSize ?? 10,
        });
      },
    }),
    [columns, dataSource, history, kind, loadLogs],
  );

  const exportButton = useMemo(
    () => (
      <CustomButton
        variant="outline"
        customClassName="filters-filterBtn"
        type="primary"
        loading={exportLoading}
        onClick={() => void handleExport()}
      >
        {apl("buttons.export")}
      </CustomButton>
    ),
    [apl, exportLoading, handleExport],
  );

  return (
    <div className="security-logs">
      <FilterTable
        containerCls="custom-table news-table"
        {...tableProps}
        loading={loading}
        filterStore={filterStore}
        tableFilters={tableFilters}
        responsiveToolbar
        extraBtn={exportButton}
        request={requestFilteredLogs}
        pagination={{
          size: "default",
          total: pageInfo.total,
          pageSize: pageInfo.pageSize,
          current: pageInfo.pageIndex,
          showSizeChanger: true,
          showTotal: (total: number) => (
            <PaginationTotal label={t("common.total")} total={total} current={pageInfo.pageIndex} pageSize={pageInfo.pageSize} />
          ),
          pageSizeOptions: ["10", "20", "50", "100"],
        }}
      />
    </div>
  );
}
