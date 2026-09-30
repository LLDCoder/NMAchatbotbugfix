import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import type { AxiosError } from "axios";
import { DatePicker, Input, Select, Tooltip } from "antd";
import type { ColumnType, TableProps } from "antd/lib/table";
import type { SorterResult } from "antd/lib/table/interface";
import { debounce } from "lodash";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import refunds2 from "@/assets/images/refunds2.svg";
import refunds from "@/assets/images/refunds.svg";
import AED from "@/assets/images/AED.png";
import AEDHui from "@/assets/images/aed_table.svg";
import { CustomMessage } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { FilterTable, useFilter } from "@/components/common/FilterTable";
import { usePagination } from "@/hooks/usePagination";
import Sousuo from "@/assets/icons/Sousuo";
import type {
  FinancialRefundDetailDto,
  FinancialRefundListItemDto,
  FinancialRefundListParams,
  FinancialRefundStatisticsDto,
  RefundExecutionPreview,
} from "@/services/financialRefunds";
import {
  executeFinancialRefund,
  getFinancialRefundDetail,
  getFinancialRefundList,
  getFinancialRefundStatistics,
} from "@/services/financialRefunds";
import { useUserStore } from "@/store/user";
import type { IUser } from "@/store/user";
import formatMoney from "@/utils/formatMoney";
import { formatPaymentCardInformation } from "@/utils/payment";
import { SorterKeys, transformDate } from "@/utils/transform";
import StatisticsDonutCard, {
  type RefundLegendItem,
} from "./components/StatisticsDonutCard";
import {
  getFinancialRefundStatusLabel,
  getFinancialRefundStatusTone,
  isFinancialRefundCompleted,
} from "./status";
import RefundConfirmModal from "./components/RefundConfirmModal";
import enterprise from "@/pages/CustomerRefunds/assets/icons/apply_for_company.svg";
import individual from "@/pages/CustomerRefunds/assets/icons/apply_for_user.svg";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import "./index.less";

const DEFAULT_SORT_BY = "LastUpdatedOn";
const DEFAULT_SORT_DIRECTION: "asc" | "desc" = "desc";
const WALLET_REFUND_COLOR = "#FAD44F";
const CARD_REFUND_COLOR = "#A0D5AB";
type FinancialRefundActionKey = "refund";

const FINANCIAL_REFUND_ACTION_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<FinancialRefundActionKey> = {};

const FINANCIAL_REFUND_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 0,
  padding: 32,
  minWidth: 88,
  maxWidth: 128,
};

const FINANCIAL_REFUND_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 0,
  padding: 24,
  minWidth: 80,
  maxWidth: 112,
};

const FINANCIAL_REFUND_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

interface RefundErrorPayload {
  statusCode?: number;
  message?: string | null;
  errorCode?: string | null;
  code?: string | null;
  data?: {
    statusCode?: number;
    message?: string | null;
    errorCode?: string | null;
    code?: string | null;
  } | null;
}

const getExecutionErrorMessage = (code: string, t: TFunction) => {
  const base = "Finance.financialRefunds.errors";
  const keyMap: Record<string, string> = {
    REFUND_NOT_FOUND: `${base}.refundNotFound`,
    ORIGINAL_TRANSACTION_NOT_FOUND: `${base}.originalTransactionNotFound`,
    UNSUPPORTED_REFUND_PAYMENT_METHOD: `${base}.unsupportedPaymentMethod`,
    INVALID_ORIGINAL_TRANSACTION_STATUS: `${base}.invalidOriginalTransactionStatus`,
    REFUND_AMOUNT_EXCEEDED: `${base}.amountExceeded`,
    REFUND_ALREADY_COMPLETED: `${base}.alreadyCompleted`,
    REFUND_CONCURRENCY_CONFLICT: `${base}.concurrencyConflict`,
    MAGNATI_GATEWAY_TIMEOUT: `${base}.gatewayTimeout`,
    MAGNATI_GATEWAY_FAILED: `${base}.gatewayFailed`,
    REFUND_EXECUTION_FAILED: `${base}.executionFailedContactBackend`,
  };

  return keyMap[code] ? t(keyMap[code]) : "";
};

interface RefundListQueryState {
  pageIndex: number;
  pageSize: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
}

const formatDateTime = (value?: string | null) =>
  value ? moment(value).format("DD/MM/YYYY HH:mm:ss") : "-";

const formatLargeNumber = (num?: number | null) => {
  if (!num) return "0";
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toFixed(2);
};

const normalizeScopeLabel = (scope?: string | null) => {
  if (!scope) return "";
  const normalized = scope.toLowerCase();
  if (normalized.includes("partial")) return "Partial";
  if (normalized.includes("full")) return "Full";
  return scope;
};

const normalizeSortDirection = (
  order?: SorterResult<FinancialRefundListItemDto>["order"],
) => {
  if (order === SorterKeys.ascend) return "asc";
  if (order === SorterKeys.descend) return "desc";
  return DEFAULT_SORT_DIRECTION;
};

const getRefundErrorPayload = (error: unknown): RefundErrorPayload => {
  const axiosError = error as AxiosError<RefundErrorPayload>;
  return axiosError.response?.data ?? {};
};

const getApplyForIcon = (record: FinancialRefundListItemDto) => {
  const typeId = String(record.applyFor?.userTypeId ?? "");
  const iconKey = String(record.applyFor?.iconKey ?? "").toLowerCase();
  if (
    typeId === "1" ||
    iconKey.includes("individual") ||
    iconKey.includes("user")
  ) {
    return individual;
  }
  return enterprise;
};

const buildExecutionPreview = (
  detail: FinancialRefundDetailDto,
): RefundExecutionPreview => ({
  refundNo: detail.refundNo,
  originalTransactionNo: detail.relatedPaymentInformation?.transactionNo,
  paymentMethod: detail.applicationInformation?.paymentMethod,
  accountOrCardHolder: detail.applicationInformation?.accountOrCardHolder,
  email: detail.applicationInformation?.email,
  cardInformation: formatPaymentCardInformation(
    detail.applicationInformation?.cardInformation,
  ),
  amount:
    detail.applicationInformation?.refundAmount ??
    detail.applicationInformation?.amountCharged,
  currency:
    detail.applicationInformation?.currency ??
    detail.relatedPaymentInformation?.currency,
  expectedLastUpdatedOn: detail.lastUpdatedOn,
});

const resolveExecutionError = (error: unknown, t: TFunction) => {
  const payload = getRefundErrorPayload(error);
  const payloadData = payload.data ?? {};
  const rawErrorCode =
    payload?.errorCode ?? payloadData?.errorCode ?? payload?.code;
  const errorCode = rawErrorCode ? String(rawErrorCode) : "";
  const message =
    getExecutionErrorMessage(errorCode, t) ||
    t("Finance.financialRefunds.messages.executionFailed");

  return {
    errorCode,
    message,
  };
};

export default function FinancialRefunds() {
  const { t } = useTranslation();
  const [pageInfo, setPageInfo] = usePagination();
  const [filterStore] = useFilter();
  const history = useHistory();
  const userInfo = useUserStore((state: { userInfo: IUser }) => state.userInfo);

  const [dataSource, setDataSource] = useState<FinancialRefundListItemDto[]>(
    [],
  );
  const [statistics, setStatistics] =
    useState<FinancialRefundStatisticsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmPreview, setConfirmPreview] =
    useState<RefundExecutionPreview | null>(null);
  const [activeRefundNo, setActiveRefundNo] = useState<string>("");

  const lastQueryRef = useRef<RefundListQueryState>({
    pageIndex: 1,
    pageSize: 10,
    sortBy: DEFAULT_SORT_BY,
    sortDirection: DEFAULT_SORT_DIRECTION,
  });
  const latestListRequestIdRef = useRef(0);
  const latestStatisticsRequestIdRef = useRef(0);
  const getVisibleFinancialRefundActions = useCallback(
    (record: FinancialRefundListItemDto): FinancialRefundActionKey[] =>
      isFinancialRefundCompleted(record.status) ? [] : ["refund"],
    [],
  );
  const getFinancialRefundActionLabel = useCallback(
    () => t("Finance.financialRefunds.actions.refund"),
    [t],
  );
  const financialRefundActionColumnWidth = useResponsiveActionColumnWidth<
    FinancialRefundListItemDto,
    FinancialRefundActionKey
  >({
    rows: dataSource,
    buttonWidthMap: FINANCIAL_REFUND_ACTION_WIDTH_MAP,
    getVisibleActions: getVisibleFinancialRefundActions,
    getActionLabel: getFinancialRefundActionLabel,
    desktopConfig: FINANCIAL_REFUND_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: FINANCIAL_REFUND_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: FINANCIAL_REFUND_ACTION_TEXT_MEASURE_CONFIG,
  });

  const operatorName = useMemo(() => {
    const fullName = `${userInfo?.firstName ?? ""} ${
      userInfo?.lastName ?? ""
    }`.trim();
    return fullName || userInfo?.email || t("common.admin", "Admin");
  }, [t, userInfo?.email, userInfo?.firstName, userInfo?.lastName]);

  const operatorId = String(userInfo?.id ?? "");

  const loadStatistics = useCallback(async () => {
    const requestId = latestStatisticsRequestIdRef.current + 1;
    latestStatisticsRequestIdRef.current = requestId;
    try {
      const statisticsData = await getFinancialRefundStatistics({
        skipErrorMessage: true,
      });
      if (requestId !== latestStatisticsRequestIdRef.current) return;
      setStatistics(statisticsData);
    } catch {
      if (requestId !== latestStatisticsRequestIdRef.current) return;
      setStatistics(null);
    }
  }, []);

  const loadList = useCallback(
    async (query?: Partial<RefundListQueryState>) => {
      const requestId = latestListRequestIdRef.current + 1;
      latestListRequestIdRef.current = requestId;
      const nextQuery = {
        ...lastQueryRef.current,
        ...query,
      };
      lastQueryRef.current = nextQuery;

      const { search, status, submissionTime } = filterStore.getFieldsValue();
      const [startTime, endTime] = transformDate(submissionTime);
      const params: FinancialRefundListParams = {
        search: search || undefined,
        status: status || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        pageIndex: nextQuery.pageIndex,
        pageSize: nextQuery.pageSize,
        sortBy: nextQuery.sortBy,
        sortDirection: nextQuery.sortDirection,
      };

      setLoading(true);
      try {
        const data = await getFinancialRefundList(params);
        if (requestId !== latestListRequestIdRef.current) return;
        setPageInfo({
          pageIndex: data?.pageIndex ?? nextQuery.pageIndex,
          pageSize: data?.pageSize ?? nextQuery.pageSize,
          total: data?.total ?? 0,
        });
        setDataSource(data?.items ?? []);
      } finally {
        if (requestId === latestListRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [filterStore, setPageInfo],
  );

  const debouncedLoadList = useMemo(
    () =>
      debounce(() => {
        loadList({
          pageIndex: 1,
          pageSize: lastQueryRef.current.pageSize,
        });
      }, 300),
    [loadList],
  );

  useKeepAliveActivated({
    onActivated: () => {
      void Promise.all([loadStatistics(), loadList()]);
    },
    onDeactivated: () => {
      latestListRequestIdRef.current += 1;
      latestStatisticsRequestIdRef.current += 1;
      debouncedLoadList.cancel();
      setLoading(false);
      setConfirmVisible(false);
      setConfirmLoading(false);
      setConfirmSubmitting(false);
      setConfirmPreview(null);
      setActiveRefundNo("");
    },
  });

  useEffect(() => {
    loadStatistics();
    loadList();
  }, [loadList, loadStatistics]);

  useEffect(() => () => debouncedLoadList.cancel(), [debouncedLoadList]);

  const closeConfirmModal = useCallback(() => {
    setConfirmVisible(false);
    setConfirmLoading(false);
    setConfirmSubmitting(false);
    setConfirmPreview(null);
    setActiveRefundNo("");
  }, []);

  const handleOpenRefundModal = useCallback(
    async (record: FinancialRefundListItemDto) => {
      if (!record.canExecuteRefund) {
        return;
      }

      setConfirmVisible(true);
      setConfirmLoading(true);
      setActiveRefundNo(record.refundNo);
      setConfirmPreview({
        refundNo: record.refundNo,
        originalTransactionNo: record.originalTransactionNo,
        paymentMethod: record.paymentMethod,
        accountOrCardHolder: record.accountOrCardHolder,
        amount: record.amount,
        currency: record.currency,
        expectedLastUpdatedOn: record.lastUpdatedOn,
      });

      try {
        const detail = await getFinancialRefundDetail(record.refundNo, {
          skipErrorMessage: true,
        });
        if (detail) {
          setConfirmPreview(buildExecutionPreview(detail));
        }
      } catch {
        closeConfirmModal();
        CustomMessage.error(t("Finance.financialRefunds.messages.loadDetailsFailed"));
      } finally {
        setConfirmLoading(false);
      }
    },
    [closeConfirmModal, t],
  );

  const handleExecuteRefund = useCallback(async () => {
    if (!activeRefundNo || !confirmPreview?.expectedLastUpdatedOn) {
      return;
    }

    setConfirmSubmitting(true);
    try {
      const result = await executeFinancialRefund(activeRefundNo, {
        refundNo: activeRefundNo,
        operatorId,
        operatorName,
        expectedLastUpdatedOn: confirmPreview.expectedLastUpdatedOn,
      });

      if (!result?.isSuccess) {
        console.error("Refund execution was rejected:", result);
        CustomMessage.warning(
          t("Finance.financialRefunds.messages.executionFailed"),
        );
      } else {
        CustomMessage.success(
          t("Finance.financialRefunds.messages.executionSuccess"),
        );
      }

      closeConfirmModal();
      await Promise.all([loadList(), loadStatistics()]);
    } catch (error) {
      const { errorCode, message } = resolveExecutionError(error, t);
      CustomMessage.warning(message);
      closeConfirmModal();
      await Promise.all([loadList(), loadStatistics()]);
      if (errorCode === "REFUND_CONCURRENCY_CONFLICT") {
        return;
      }
    } finally {
      setConfirmSubmitting(false);
    }
  }, [
    activeRefundNo,
    closeConfirmModal,
    confirmPreview?.expectedLastUpdatedOn,
    loadList,
    loadStatistics,
    operatorId,
    operatorName,
    t,
  ]);

  const amountLegendItems = useMemo<RefundLegendItem[]>(
    () => [
      {
        label: t("Finance.financialRefunds.statistics.walletRefund"),
        value: statistics?.totalRefundAmount?.walletRefundAmount || 0,
        color: WALLET_REFUND_COLOR,
        valueText: formatLargeNumber(
          statistics?.totalRefundAmount?.walletRefundAmount || 0,
        ),
      },
      {
        label: t("Finance.financialRefunds.statistics.cardRefund"),
        value: statistics?.totalRefundAmount?.cardRefundAmount || 0,
        color: CARD_REFUND_COLOR,
        valueText: formatLargeNumber(
          statistics?.totalRefundAmount?.cardRefundAmount || 0,
        ),
      },
    ],
    [statistics, t],
  );

  const amountTotalLabel = useMemo(() => {
    const total = statistics?.totalRefundAmount?.totalRefundAmount || 0;
    return formatLargeNumber(total);
  }, [statistics]);

  const countLegendItems = useMemo<RefundLegendItem[]>(
    () => [
      {
        label: t("Finance.financialRefunds.statistics.walletRefund"),
        value: statistics?.totalRefundCount?.walletRefundCount || 0,
        color: WALLET_REFUND_COLOR,
        valueText: String(
          formatMoney(
            statistics?.totalRefundCount?.walletRefundCount || 0,
            false,
          ),
        ),
      },
      {
        label: t("Finance.financialRefunds.statistics.cardRefund"),
        value: statistics?.totalRefundCount?.cardRefundCount || 0,
        color: CARD_REFUND_COLOR,
        valueText: String(
          formatMoney(
            statistics?.totalRefundCount?.cardRefundCount || 0,
            false,
          ),
        ),
      },
    ],
    [statistics, t],
  );

  const countTotalLabel = useMemo(
    () =>
      String(
        formatMoney(statistics?.totalRefundCount?.totalRefundCount || 0, false),
      ),
    [statistics],
  );

  const columns = useMemo<ColumnType<FinancialRefundListItemDto>[]>(
    () => [
      {
        title: t("Finance.financialRefunds.table.applicationNo"),
        dataIndex: "refundNo",
        key: "refundNo",
        width: 140,
        render: (value: string) => (
          <span className="financial-refunds__column-number">
            {value || "-"}
          </span>
        ),
      },
      {
        title: t("Finance.financialRefunds.table.transactionNo"),
        dataIndex: "originalTransactionNo",
        key: "originalTransactionNo",
        width: 148,
        render: (value?: string | null) => value || "-",
      },
      {
        title: t("Finance.financialRefunds.table.type"),
        dataIndex: "type",
        key: "type",
        width: 110,
        render: (_value: string, record) => {
          const scopeLabel = normalizeScopeLabel(record.refundScope);
          return (
            <div className="financial-refunds__type-cell">
              <span className="financial-refunds__type-text">
                {record.type || t("Finance.financialRefunds.actions.refund")}
              </span>
              {scopeLabel === "Partial" ? (
                <span className="financial-refunds__scope-badge">{t("Finance.financialRefunds.table.partial")}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        title: t("Finance.financialRefunds.table.applyFor"),
        dataIndex: "applyFor",
        key: "applyFor",
        width: 120,
        render: (_value, record) => (
          <div className="financial-refunds__apply-for">
            <img src={getApplyForIcon(record)} alt="" />
            <span>{record.applyFor?.name || "-"}</span>
          </div>
        ),
      },
      {
        title: t("Finance.financialRefunds.table.paymentMethod"),
        dataIndex: "paymentMethod",
        key: "paymentMethod",
        width: 132,
        render: (value?: string | null) => value || "-",
      },
      {
        title: () => (
          <span>
            {t("Finance.financialRefunds.table.amount")}
            <img
              className="financial-refunds__currency-icon"
              src={AEDHui}
              alt="AED"
            />
          </span>
        ),
        dataIndex: "amount",
        key: "amount",
        width: 105,
        render: (value?: number | null) => (
          <span className="financial-refunds__amount-negative">
            -{formatMoney(Math.abs(value || 0))}
          </span>
        ),
      },
      {
        title: t("Finance.financialRefunds.table.status"),
        dataIndex: "status",
        key: "status",
        width: 110,
        render: (value?: string | null) => (
          <span
            className={`financial-refunds__status-tag is-${getFinancialRefundStatusTone(
              value,
            )}`}
          >
            {getFinancialRefundStatusLabel(value, t)}
          </span>
        ),
      },
      {
        title: t("Finance.financialRefunds.table.lastUpdated"),
        dataIndex: "lastUpdatedOn",
        key: "lastUpdatedOn",
        width: 165,
        sorter: true,
        render: (value?: string | null) => formatDateTime(value),
      },
      {
        title: t("Finance.financialRefunds.table.actions"),
        dataIndex: "refundNo",
        key: "actions",
        width: financialRefundActionColumnWidth,
        render: (_value, record) => {
          if (isFinancialRefundCompleted(record.status)) {
            return <span className="financial-refunds__action-placeholder">-</span>;
          }

          const disabled = !record.canExecuteRefund;
          const action = (
            <button
              type="button"
              className={`financial-refunds__action-button ${
                disabled ? "is-disabled" : ""
              }`}
              aria-disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                if (disabled) {
                  return;
                }
                handleOpenRefundModal(record);
              }}
            >
              {t("Finance.financialRefunds.actions.refund")}
            </button>
          );

          if (!disabled || !record.unsupportedReason) {
            return action;
          }

          return (
            <Tooltip
              trigger={["hover"]}
              placement="top"
              title={record.unsupportedReason}
              getPopupContainer={() => document.body}
            >
              <span className="financial-refunds__action-anchor">{action}</span>
            </Tooltip>
          );
        },
      },
    ],
    [financialRefundActionColumnWidth, handleOpenRefundModal, t],
  );

  const tableConfigs: TableProps<FinancialRefundListItemDto> = {
    scroll: { x: 1320 },
    rowKey: "refundNo",
    columns,
    dataSource,
    loading,
    onRow: (record) => ({
      onClick: () => {
        const params = new URLSearchParams();
        params.set("refundNo", record.refundNo);
        params.set("pageTitleKey", "menu.refundsDetails");
        params.set("breadcrumbRootKey", "menu.financialPayment");
        history.push(
          `/financial-payment/refunds/refundsDetails?${params.toString()}`,
        );
      },
    }),
    onChange: (pagination, _filters, sorter) => {
      const currentSorter = sorter as SorterResult<FinancialRefundListItemDto>;
      loadList({
        pageIndex: pagination.current ?? pageInfo.pageIndex,
        pageSize: pagination.pageSize ?? pageInfo.pageSize,
        sortBy: currentSorter.field
          ? String(currentSorter.field)
          : DEFAULT_SORT_BY,
        sortDirection: normalizeSortDirection(currentSorter.order),
      });
    },
  };

  const tableFilterConfigs = useMemo(
    () => [
      {
        label: t("Finance.financialRefunds.common.search"),
        element: (
          <Input
            key="input-search"
            placeholder={t("Finance.financialRefunds.common.search")}
            prefix={<Sousuo className="search-icon" />}
            className="search-input"
            allowClear
          />
        ),
      },
      {
        label: t("Finance.financialRefunds.table.status"),
        element: (
          <Select
            key="select-status"
            className="filters-select"
            placeholder={t("Finance.financialRefunds.common.allStatuses")}
            allowClear
            options={[
              {
                value: "Pending Refund",
                label: t("Finance.financialRefunds.status.pendingRefund"),
              },
              {
                value: "Completed",
                label: t("Finance.financialRefunds.status.refunded"),
              },
            ]}
          />
        ),
      },
      {
        label: t("Finance.financialRefunds.table.lastUpdated"),
        element: (
          <DatePicker.RangePicker
            key="range-submissionTime"
            format={["DD/MM/YYYY"]}
            className="range-picker"
            placeholder={[
              t("Finance.financialRefunds.common.startTime"),
              t("Finance.financialRefunds.common.endTime"),
            ]}
          />
        ),
      },
    ],
    [t],
  );

  const handleTableRequest = useCallback(async () => {
    debouncedLoadList();
  }, [debouncedLoadList]);

  return (
    <div className="financial-refunds">
      <div className="financial-refunds__header">
        <StatisticsDonutCard
          title={t("Finance.financialRefunds.statistics.totalRefundAmount")}
          showAed={true}
          totalLabel={amountTotalLabel}
          legendItems={amountLegendItems}
          formatVisibleTotal={formatLargeNumber}
        />
        <StatisticsDonutCard
          title={t("Finance.financialRefunds.statistics.totalRefundCount")}
          totalLabel={countTotalLabel}
          legendItems={countLegendItems}
          formatVisibleTotal={(value) => String(formatMoney(value, false))}
        />
        <div className="financial-refunds__pending-cards">
          <div className="financial-refunds__pending-card">
            <img src={refunds2} alt="" />
            <div className="financial-refunds__pending-card-detail">
              <div className="financial-refunds__pending-card-title">
                {formatMoney(statistics?.pendingRefundCount || 0, false)}
              </div>
              <div className="financial-refunds__pending-card-value">
                {t("Finance.financialRefunds.statistics.pendingRefundCount")}
              </div>
            </div>
          </div>
          <div className="financial-refunds__pending-card">
            <img src={refunds} alt="" />
            <div className="financial-refunds__pending-card-detail">
              <div className="financial-refunds__pending-card-title">
                <img src={AED} alt="AED" />
                {formatLargeNumber(statistics?.pendingRefundAmount || 0)}
              </div>
              <div className="financial-refunds__pending-card-value">
                {t("Finance.financialRefunds.statistics.pendingRefundAmount")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="financial-refunds__table">
        <FilterTable
          containerCls="custom-table financial-refunds__filter-table"
          {...tableConfigs}
          filterStore={filterStore}
          tableFilters={tableFilterConfigs}
          responsiveToolbar
          maxVisibleFilters={3}
          request={handleTableRequest}
          extraBtn={<div />}
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

      <RefundConfirmModal
        visible={confirmVisible}
        preview={confirmPreview}
        loading={confirmLoading}
        confirming={confirmSubmitting}
        onCancel={closeConfirmModal}
        onConfirm={handleExecuteRefund}
      />
    </div>
  );
}
