import { CalendarOutlined } from "@ant-design/icons";
import Sousuo from "@/assets/icons/Sousuo";
import { Button, DatePicker, Input, Result, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { AxiosError } from "axios";
import type { Moment } from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import messageLogEmailIcon from "@/assets/icons/message-log-email.svg";
import messageLogSmsIcon from "@/assets/icons/message-log-sms.svg";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import PaginationTotal from "@/components/common/PaginationTotal";
import {
  FilterTable,
  useFilter,
} from "@/components/common/FilterTable";
import type { FilterItem } from "@/components/common/FilterTable/type";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { useCanRenderButton } from "@/routes/access";
import {
  getDefaultMessageLogDateRange,
  getMessageLogList,
  toMessageLogPortalDto,
  toMessageLogTypeDto,
} from "@/services/messageLog";
import type {
  MessageChannel,
  MessageLogRecord,
  MessagePortal,
  MessageStatus,
  MessageType,
} from "@/services/messageLog";
import { toApi } from "@/utils/gstTime";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import "./index.less";

const { RangePicker } = DatePicker;
// API supports 1-200; explicitly send the product default 10, never fallback 20.
const DEFAULT_PAGE_SIZE = 10;

interface MessageLogFilterValues {
  search?: string;
  sentTime?: [Moment, Moment] | null;
  type?: MessageType;
  portal?: MessagePortal;
  channel?: MessageChannel;
  status?: MessageStatus;
  sentBy?: string;
}
const getDefaultFilterValues = (): Pick<MessageLogFilterValues, "sentTime"> => ({
  // Initial load and toolbar Reset use the rolling 30-day product default.
  sentTime: getDefaultMessageLogDateRange(),
});
export default function MessageLog() {
  const history = useHistory();
  const { t } = useTranslation();
  const canViewDetails = useCanRenderButton(
    PERMISSION_CODES.communications.messageLog.detail,
    "/communications/message-log/message-details",
  );
  const [baseFilterStore] = useFilter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);
  const filterStore = useMemo(
    () => ({
      ...baseFilterStore,
      resetFields: () => {
        baseFilterStore.resetFields();
        baseFilterStore.setFieldsValue(getDefaultFilterValues());
        pageSizeRef.current = DEFAULT_PAGE_SIZE;
        setPage(1);
        setPageSize(DEFAULT_PAGE_SIZE);
        return true;
      },
    }),
    [baseFilterStore],
  );
  const [filtersInitialized] = useState(() => {
    filterStore.setFieldsValue(getDefaultFilterValues());
    return true;
  });
  const [records, setRecords] = useState<MessageLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<"403" | "error">();
  const getFilterValues = useCallback(
    () => filterStore.getFieldsValue() as MessageLogFilterValues,
    [filterStore],
  );
  const loadRecords = useCallback(async (
    nextPage: number,
    nextPageSize: number,
  ) => {
    setLoading(true);
    setLoadError(undefined);

    try {
      const filters = getFilterValues();
      const result = await getMessageLogList({
        search: filters.search?.trim() || null,
        type: toMessageLogTypeDto(filters.type),
        portal: toMessageLogPortalDto(filters.portal),
        channel: filters.channel || null,
        status: filters.status || null,
        sentFrom: filters.sentTime?.[0]
          ? toApi(filters.sentTime[0].clone().startOf("day").toDate())
          : null,
        sentTo: filters.sentTime?.[1]
          ? toApi(filters.sentTime[1].clone().endOf("day").toDate())
          : null,
        sentBy: filters.sentBy?.trim() || null,
        pageIndex: nextPage,
        pageSize: nextPageSize,
      });
      setRecords(result.items);
      setTotal(result.total);
    } catch (error) {
      if ((error as AxiosError).code !== "ERR_CANCELED") {
        setRecords([]);
        setTotal(0);
        setLoadError(
          (error as AxiosError).response?.status === 403 ? "403" : "error",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [getFilterValues]);
  useKeepAliveActivated({
    onActivated: () => {
      void loadRecords(page, pageSize);
    },
  });
  useEffect(() => {
    if (filtersInitialized) {
      void loadRecords(1, DEFAULT_PAGE_SIZE);
    }
    // Initial request only; subsequent requests are driven by FilterTable and pagination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersInitialized]);

  const openDetails = (record: MessageLogRecord) => {
    if (canViewDetails) {
      history.push(`/communications/message-log/message-details?id=${record.id}`);
    }
  };
  const suppressedFilterSignatureRef = useRef<string>();
  const getFilterSignature = useCallback(() => {
    const filters = getFilterValues();
    return JSON.stringify({
      ...filters,
      sentTime: filters.sentTime?.map((value) => value.valueOf()),
      pageSize: pageSizeRef.current,
    });
  }, [getFilterValues]);
  const requestFilteredRecords = useCallback(async () => {
    const signature = getFilterSignature();
    if (suppressedFilterSignatureRef.current === signature) {
      suppressedFilterSignatureRef.current = undefined;
      return;
    }
    suppressedFilterSignatureRef.current = undefined;
    setPage(1);
    await loadRecords(1, pageSizeRef.current);
  }, [getFilterSignature, loadRecords]);
  const refreshImmediatelyAfterSearchClear = useCallback(() => {
    setTimeout(() => {
      suppressedFilterSignatureRef.current = getFilterSignature();
      setPage(1);
      void loadRecords(1, pageSizeRef.current);
    }, 0);
  }, [getFilterSignature, loadRecords]);

  const columns: ColumnsType<MessageLogRecord> = useMemo(
    () => [
      { title: t("Communications.messageLog.no"), dataIndex: "no", width: "12%", className: "message-log-nowrap" },
      { title: t("Communications.messageLog.type"), dataIndex: "type", width: "12%", className: "message-log-wrap" },
      {
        title: t("Communications.messageLog.recipient"),
        dataIndex: "recipient",
        width: "14%",
        render: (recipient: string) => (
          <div className="message-recipient" title={recipient}>
            {recipient}
          </div>
        ),
      },
      { title: t("Communications.messageLog.subject"), dataIndex: "subject", width: "15%", className: "message-log-wrap" },
      { title: t("Communications.messageLog.portal"), dataIndex: "portal", width: "8%", className: "message-log-wrap" },
      {
        title: t("Communications.messageLog.channel"),
        dataIndex: "channel",
        width: "8%",
        render: (channel: MessageChannel) => (
          <span className="message-channel" title={channel} aria-label={channel}>
            <img
              src={channel === "Email" ? messageLogEmailIcon : messageLogSmsIcon}
              alt=""
              aria-hidden="true"
            />
          </span>
        ),
      },
      {
        title: t("Communications.messageLog.status"),
        dataIndex: "status",
        width: "8%",
        render: (status: MessageStatus) => (
          <span className={`message-status message-status--${status.toLowerCase()}`}>
            {status}
          </span>
        ),
      },
      { title: t("Communications.messageLog.sentTime"), dataIndex: "sentTime", width: "13%", className: "message-log-wrap" },
      { title: t("Communications.messageLog.sentBy"), dataIndex: "sentBy", width: "10%", className: "message-log-nowrap" },
    ],
    [t],
  );

  const tableFilters = useMemo<FilterItem[]>(
    () => [
      {
        label: t("Communications.messageLog.search"),
        element: (
          <Input
            key="input-search"
            className="message-log-search"
            prefix={<Sousuo className="search-icon" />}
            placeholder={t("Communications.messageLog.search")}
            allowClear
            onChange={(event) => {
              if (!event.target.value) {
                refreshImmediatelyAfterSearchClear();
              }
            }}
          />
        ),
        requestDebounceMs: 500,
      },
      {
        label: t("Communications.messageLog.sentTime"),
        element: (
          <RangePicker
            key="range-sentTime"
            className="message-log-range"
            suffixIcon={<CalendarOutlined />}
            format="DD/MM/YYYY"
            placeholder={[t("Communications.messageLog.startDate"), t("Communications.messageLog.endDate")]}
            allowClear
          />
        ),
      },
      {
        label: t("Communications.messageLog.type"),
        element: (
          <Select<MessageType>
            key="select-type"
            className="message-log-type"
            placeholder={t("Communications.messageLog.allTypes")}
            allowClear
            options={[
              { value: "Message Template", label: t("Communications.messageLog.messageTemplate") },
              { value: "Broadcast", label: t("Communications.messageLog.broadcast") },
            ]}
          />
        ),
      },
      {
        label: t("Communications.messageLog.portal"),
        element: (
          <Select<MessagePortal>
            key="select-portal"
            placeholder={t("Communications.messageLog.allPortals")}
            allowClear
            options={[
              { value: "Admin", label: t("Communications.messageLog.adminPortal") },
              { value: "Customer", label: t("Communications.messageLog.customerPortal") },
            ]}
          />
        ),
      },
      {
        label: t("Communications.messageLog.channel"),
        element: (
          <Select<MessageChannel>
            key="select-channel"
            placeholder={t("Communications.messageLog.allChannels")}
            allowClear
            options={[
              { value: "Email", label: t("Communications.messageLog.email") },
              { value: "SMS", label: t("Communications.messageLog.sms") },
            ]}
          />
        ),
      },
      {
        label: t("Communications.messageLog.status"),
        element: (
          <Select<MessageStatus>
            key="select-status"
            placeholder={t("Communications.messageLog.allStatuses")}
            allowClear
            options={[
              { value: "Sent", label: t("Communications.messageLog.sent") },
              { value: "Failed", label: t("Communications.messageLog.failed") },
            ]}
          />
        ),
      },
      {
        label: t("Communications.messageLog.sentBy"),
        element: (
          <Input
            key="input-sentBy"
            placeholder={t("Communications.messageLog.sentByPlaceholder")}
            allowClear
          />
        ),
      },
    ],
    [refreshImmediatelyAfterSearchClear, t],
  );

  return (
    <div className="communications-page">
      <div className="message-log-table-container">
        {loadError === "403" ? (
          <Result
            status="403"
            title={t("Communications.messageLog.forbidden")}
          />
        ) : loadError ? (
          <Result
            status="error"
            title={t("Communications.messageLog.loadError")}
            subTitle={t("Communications.messageLog.tryAgain")}
            extra={
              <Button onClick={() => void loadRecords(page, pageSize)}>
                {t("Communications.messageLog.retry")}
              </Button>
            }
          />
        ) : (
          <FilterTable
            containerCls="message-log-filter-table"
            filterStore={filterStore}
            tableFilters={tableFilters}
            responsiveToolbar
            request={requestFilteredRecords}
            className="admin-table"
            columns={columns}
            dataSource={records}
            rowKey="id"
            loading={loading}
            locale={{
              emptyText: (
                <EmptyBox title={t("Communications.messageLog.empty")} />
              ),
            }}
            tableLayout="fixed"
            pagination={{
              size: "default",
              total,
              pageSize,
              current: page,
              showTotal: (totalValue: number) => (
                <PaginationTotal label={t("common.total")} total={totalValue} current={page} pageSize={pageSize} />
              ),
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              onChange: (nextPage: number, nextPageSize: number) => {
                const resolvedPage = nextPageSize === pageSize ? nextPage : 1;
                pageSizeRef.current = nextPageSize;
                setPage(resolvedPage);
                setPageSize(nextPageSize);
                void loadRecords(resolvedPage, nextPageSize);
              },
            }}
            rowClassName={canViewDetails ? "message-log-row" : ""}
            onRow={(record: MessageLogRecord) => ({
              onClick: () => openDetails(record),
            })}
          />
        )}
      </div>
    </div>
  );
}
