import React, { useMemo, useState } from "react";
import { DatePicker, Empty, Input, Modal, Select, Table, Tooltip } from "antd";
import { BankOutlined, UserOutlined } from "@ant-design/icons";
import type { TablePaginationConfig } from "antd/es/table";
import type {
  ColumnsType,
  SorterResult,
} from "antd/es/table/interface";
import moment from "moment";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import type { PaymentCountStats, PaymentItem } from "../../types";
import AED from "@/assets/icons/Aed";
import { formatMoney } from "@/utils/utils";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { canAccessRouteWithToast } from "@/routes/permissionNavigation";
import { renderOverviewSearchPrefix } from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";

type SelectOption = { label: string; value: string };

type RangeValue = [moment.Moment | null, moment.Moment | null] | null;

const normalizeOverviewText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

const parseDateValue = (value?: string) => {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return null;

  const parsed = moment(
    text,
    [
      moment.ISO_8601,
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
      "YYYY-MM-DD",
      "DD/MM/YYYY HH:mm:ss",
      "DD/MM/YYYY HH:mm",
      "DD/MM/YYYY",
    ],
    true,
  );

  return parsed.isValid() ? parsed : null;
};

const renderDateTimeCell = (value?: string) => {
  const parsed = parseDateValue(value);
  if (!parsed) return "-";

  return (
    <div className="overview-date-time">
      <div className="overview-date-time__date">
        {parsed.format("DD/MM/YYYY")}
      </div>
      <div className="overview-date-time__time">
        {parsed.format("HH:mm:ss")}
      </div>
    </div>
  );
};

const renderEllipsisText = (value?: string | null) => {
  const text = (value ?? "-").trim() || "-";
  return (
    <Tooltip title={text}>
      <span className="overview-cell-ellipsis">{text}</span>
    </Tooltip>
  );
};

const getPaymentAmountMeta = (row: PaymentItem) => {
  const normalizedType = normalizeOverviewText(row.transactionType);
  const rawTransactionTypeId = row.transactionTypeId;
  const transactionTypeId = Number(rawTransactionTypeId);
  const hasTransactionTypeId =
    rawTransactionTypeId !== null &&
    rawTransactionTypeId !== undefined &&
    String(rawTransactionTypeId).trim() !== "" &&
    Number.isFinite(transactionTypeId);
  const rawAmount = row.amount;
  const numericAmount = Number(rawAmount);
  const hasValidAmount =
    rawAmount !== null &&
    rawAmount !== undefined &&
    rawAmount !== "" &&
    Number.isFinite(numericAmount);

  if (!hasValidAmount) {
    return {
      displayAmount: String(rawAmount ?? "-"),
      sign: "",
      positive: false,
    };
  }

  const isRefund = hasTransactionTypeId
    ? transactionTypeId === 4
    : normalizedType === "refund";
  const isSpending = hasTransactionTypeId
    ? transactionTypeId === 2 || transactionTypeId === 3
    : normalizedType === "serviceapplication" ||
      normalizedType === "servicepayment" ||
      normalizedType === "fine" ||
      normalizedType === "fines";
  const isPositive = isRefund ? true : isSpending ? false : numericAmount >= 0;

  return {
    displayAmount: formatMoney(Math.abs(numericAmount)),
    sign: isPositive ? "+" : "-",
    positive: isPositive,
  };
};

const getPaymentStatusMeta = (row: PaymentItem, t: (key: string) => string) => {
  const rawStatus = String(row.statusLabel || row.status || "").trim();
  const normalizedStatus = normalizeOverviewText(rawStatus);
  const rawStatusId = row.statusId;
  const statusId = Number(rawStatusId);
  const hasStatusId =
    rawStatusId !== null &&
    rawStatusId !== undefined &&
    String(rawStatusId).trim() !== "" &&
    Number.isFinite(statusId);
  const normalizedSubStatus = normalizeOverviewText(row.statusSubLabel);
  const isCompleted =
    statusId === 3 || (!hasStatusId && normalizedStatus === "completed");

  let mainLabel = rawStatus || "-";
  let tone: "neutral" | "success" | "danger" = "neutral";

  if (isCompleted) {
    mainLabel = t("customStatusTag.completed");
    tone = "success";
  } else if (
    statusId === 4 ||
    (!hasStatusId && normalizedStatus === "failed")
  ) {
    mainLabel = t("customStatusTag.failed");
    tone = "danger";
  } else if (
    statusId === 8 ||
    (!hasStatusId && normalizedStatus === "failedrefund")
  ) {
    mainLabel = t("customStatusTag.failedRefund");
    tone = "danger";
  } else if (
    statusId === 7 ||
    (!hasStatusId &&
      (normalizedStatus === "refunded" ||
        normalizedStatus === "refundcompleted"))
  ) {
    mainLabel = t("customStatusTag.refunded");
    tone = "success";
  }

  let subLabel = "";
  let subClassName = "";
  if (isCompleted) {
    if (normalizedSubStatus === "refundinprogress") {
      subLabel = t("customStatusTag.refundInProgress");
      subClassName = "overview-payment-status-sub--warning";
    } else if (
      normalizedSubStatus === "refunded" ||
      normalizedSubStatus === "refundcompleted"
    ) {
      subLabel = t("customStatusTag.refunded");
      subClassName = "overview-payment-status-sub--success";
    } else if (
      normalizedSubStatus === "partialrefunded" ||
      normalizedSubStatus === "partiallyrefunded"
    ) {
      subLabel = t("customStatusTag.partialRefunded");
      subClassName = "overview-payment-status-sub--success";
    }
  }

  return { tone, mainLabel, subLabel, subClassName };
};

const getPaymentTypeLabel = (
  row: PaymentItem,
  t: (key: string) => string,
) => {
  const transactionTypeId = Number(row.transactionTypeId);
  if (transactionTypeId === 2) {
    return t("Customer.customerDetails.tabs.payments.serviceApplication");
  }
  if (transactionTypeId === 3) {
    return t("Customer.customerDetails.tabs.payments.fine");
  }
  if (transactionTypeId === 4) {
    return t("Customer.customerDetails.tabs.payments.refund");
  }
  return row.transactionType || "-";
};

const renderApplyForCell = (value?: string, type?: string) => {
  const normalizedType = normalizeOverviewText(type);
  const Icon = normalizedType === "individual" ? UserOutlined : BankOutlined;

  return (
    <span className="overview-applyfor overview-applyfor--multiline">
      <Icon className="overview-applyfor-icon" />
      <Tooltip title={value || "-"}>
        <span className="overview-applyfor-text overview-applyfor-text--multiline">
          {value || "-"}
        </span>
      </Tooltip>
    </span>
  );
};

const PaymentsTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  payments?: PaymentItem[];
  paymentsStats?: PaymentCountStats | null;
  loading?: boolean;
  pagination: TablePaginationConfig;
  showApplyFor?: boolean;
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<PaymentItem> | SorterResult<PaymentItem>[],
  ) => void;
  transactionTypeOptions?: SelectOption[];
  statusOptions?: SelectOption[];
  paymentMethodOptions?: SelectOption[];
  transactionTypeId?: string;
  statusId?: string;
  paymentMethodId?: string;
  onTransactionTypeIdChange?: (value?: string) => void;
  onStatusIdChange?: (value?: string) => void;
  startDate?: string;
  endDate?: string;
  onAdvancedFilterChange?: (filters: {
    paymentMethodId?: string;
    startDate?: string;
    endDate?: string;
  }) => void;
  onDateRangeChange?: (range: { startDate?: string; endDate?: string }) => void;
}> = ({
  searchKey,
  onSearchKeyChange,
  payments,
  paymentsStats,
  loading,
  pagination,
  onTableChange,
  transactionTypeOptions,
  statusOptions,
  paymentMethodOptions,
  transactionTypeId,
  statusId,
  paymentMethodId,
  onTransactionTypeIdChange,
  onStatusIdChange,
  startDate,
  endDate,
  onAdvancedFilterChange,
  onDateRangeChange,
}) => {
  const history = useHistory();
  const { t } = useTranslation();
  void paymentsStats;
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftTransactionRange, setDraftTransactionRange] =
    useState<RangeValue>(null);
  const [draftPaymentMethodId, setDraftPaymentMethodId] = useState<
    string | undefined
  >(undefined);
  const [draftTransactionTypeId, setDraftTransactionTypeId] = useState<
    string | undefined
  >(undefined);
  const [draftStatusId, setDraftStatusId] = useState<string | undefined>();

  const columns = useMemo<ColumnsType<PaymentItem>>(() => {
    const cols: ColumnsType<PaymentItem> = [
      {
        title: t("Customer.customerDetails.tabs.payments.transactionNo"),
        dataIndex: "transactionNo",
        key: "transactionNo",
        width: 120,
        render: (text: string) => renderEllipsisText(text),
      },
      {
        title: t("Customer.customerDetails.tabs.payments.type"),
        dataIndex: "transactionType",
        key: "transactionType",
        width: 120,
        render: (_text: string, row: PaymentItem) =>
          renderEllipsisText(getPaymentTypeLabel(row, t)),
      },
      {
        title: t("Customer.customerDetails.tabs.payments.paymentMethod"),
        dataIndex: "paymentMethod",
        key: "paymentMethod",
        width: 150,
        render: (text: string) => renderEllipsisText(text),
      },
      {
        title: (
          <div className="amount-title">
            {t("Customer.customerDetails.tabs.payments.amount")} <AED />
          </div>
        ),
        dataIndex: "amount",
        key: "amount",
        width: 110,
        render: (_text: string | number, row: PaymentItem) => {
          const { displayAmount, sign, positive } = getPaymentAmountMeta(row);
          return (
            <div className="payments-table-amount">
              <span
                className={`payments-table-amount__value${
                  positive
                    ? " payments-table-amount__value--positive"
                    : " payments-table-amount__value--negative"
                }`}
              >
                {`${sign}${displayAmount}`}
              </span>
            </div>
          );
        },
      },
      {
        title: t("Customer.customerDetails.tabs.payments.status"),
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (_text: string, row: PaymentItem) => {
          const statusMeta = getPaymentStatusMeta(row, t);
          return (
            <div className="overview-payment-status">
              <CustomStatusTag
                label={statusMeta.mainLabel}
                tone={statusMeta.tone}
                size="compact"
              />
              {statusMeta.subLabel ? (
                <div
                  className={`overview-payment-status-sub ${statusMeta.subClassName}`}
                >
                  {statusMeta.subLabel}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: t("Customer.customerDetails.tabs.payments.applyFor"),
        dataIndex: "applyFor",
        key: "applyFor",
        width: 150,
        render: (text: string, row: PaymentItem) =>
          renderApplyForCell(text, row.applyForType),
      },
      {
        title: (
          <span className="overview-sort-title">
            {t("Customer.customerDetails.tabs.payments.transactionTime")}
          </span>
        ),
        dataIndex: "transactionTime",
        key: "transactionTime",
        width: 160,
        sorter: true,
        defaultSortOrder: "descend",
        render: (text: string) => renderDateTimeCell(text),
      },
    ];

    return cols;
  }, [t]);

  /**
   * The modal filters payment method, transaction type and status, plus a
   * transaction date range that reads as one filter.
   */
  const appliedFilterCount =
    countAppliedFilters([paymentMethodId, transactionTypeId, statusId]) +
    (isAppliedFilterValue(startDate) || isAppliedFilterValue(endDate) ? 1 : 0);

  const openFilterModal = () => {
    const nextStart = startDate ? parseDateValue(startDate) : null;
    const nextEnd = endDate ? parseDateValue(endDate) : null;
    setDraftTransactionRange([nextStart, nextEnd]);
    setDraftPaymentMethodId(paymentMethodId);
    setDraftTransactionTypeId(transactionTypeId);
    setDraftStatusId(statusId);
    setFilterModalOpen(true);
  };

  const handleCancel = () => {
    setDraftTransactionRange([
      startDate ? parseDateValue(startDate) : null,
      endDate ? parseDateValue(endDate) : null,
    ]);
    setDraftPaymentMethodId(paymentMethodId);
    setDraftTransactionTypeId(transactionTypeId);
    setDraftStatusId(statusId);
    setFilterModalOpen(false);
  };

  const handleApply = () => {
    const start = draftTransactionRange?.[0] || null;
    const end = draftTransactionRange?.[1] || null;

    if (draftTransactionTypeId !== transactionTypeId) {
      onTransactionTypeIdChange?.(draftTransactionTypeId || undefined);
    }
    if (draftStatusId !== statusId) {
      onStatusIdChange?.(draftStatusId || undefined);
    }

    const nextFilters = {
      paymentMethodId: draftPaymentMethodId || undefined,
      startDate: start?.isValid() ? start.format("YYYY-MM-DD") : undefined,
      endDate: end?.isValid() ? end.format("YYYY-MM-DD") : undefined,
    };
    if (onAdvancedFilterChange) {
      onAdvancedFilterChange(nextFilters);
    } else {
      onDateRangeChange?.(nextFilters);
    }
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    onSearchKeyChange("");
    onTransactionTypeIdChange?.(undefined);
    onStatusIdChange?.(undefined);
    setDraftTransactionTypeId(undefined);
    setDraftStatusId(undefined);
    setDraftPaymentMethodId(undefined);
    setDraftTransactionRange(null);
    const emptyFilters = {
      paymentMethodId: undefined,
      startDate: undefined,
      endDate: undefined,
    };
    if (onAdvancedFilterChange) {
      onAdvancedFilterChange(emptyFilters);
    } else {
      onDateRangeChange?.(emptyFilters);
    }
  };

  const rows = useMemo(() => payments || [], [payments]);

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          endDate,
          paymentMethodId,
          searchKey,
          startDate,
          statusId,
          statusOptions,
          t,
          transactionTypeId,
          transactionTypeOptions,
        ]}
      >
        <AllOverviewFilterToolbar>
          <Input
            allowClear
            prefix={renderOverviewSearchPrefix()}
            placeholder={t("Customer.customerDetails.common.search")}
            value={searchKey}
            className="all-overview-search responsive-filter-toolbar__field responsive-filter-toolbar__field--search"
            onChange={(e) => onSearchKeyChange(e.target.value)}
          />

          <Select
            value={transactionTypeId}
            onChange={(value) =>
              onTransactionTypeIdChange?.(value || undefined)
            }
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            placeholder={t("Customer.customerDetails.common.allTypes")}
            options={transactionTypeOptions}
          />

          <Select
            value={statusId}
            onChange={(value) => onStatusIdChange?.(value || undefined)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            placeholder={t("Customer.customerDetails.common.allStatuses")}
            options={statusOptions}
          />

          <CustomButton
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button filter-trigger-with-count"
            onClick={openFilterModal}
          >
            {t("Customer.customerDetails.common.filter")}
            <img className="filter-trigger-funnel" src={sortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>

          <CustomButton
            text={t("common.reset")}
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button"
            onClick={handleReset}
          />
        </AllOverviewFilterToolbar>
      </OverviewRenderBoundary>

      <Table<PaymentItem>
        className="admin-table all-overview-table"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        scroll={{ x: 1200 }}
        loading={loading}
        pagination={pagination}
        sortDirections={["descend", "ascend"]}
        onRow={(item) => {
          return {
            onClick() {
              const targetPath =
                `/financial-payment/transactions/transactions-detail?transactionNo=${item.transactionNo}`;
              if (!canAccessRouteWithToast(targetPath)) return;
              history.push(targetPath);
            },
          };
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Customer.customerDetails.common.noData")}
            />
          ),
        }}
        onChange={(p, _filters, sorter) => {
          onTableChange?.(p, sorter);
        }}
      />

      <OverviewRenderBoundary
        dependencies={[
          draftPaymentMethodId,
          draftTransactionRange,
          draftTransactionTypeId,
          draftStatusId,
          filterModalOpen,
          paymentMethodOptions,
          t,
        ]}
      >
        <Modal
          visible={filterModalOpen}
          onCancel={handleCancel}
          centered
          width={960}
          className="overview-filter-modal"
          title={t("Customer.customerDetails.common.filter")}
          destroyOnClose
          footer={
            <div className="overview-filter-footer">
              <CustomButton
                text={t("common.cancel")}
                variant="outline"
                onClick={handleCancel}
              />
              <CustomButton
                text={t("common.apply")}
                variant="primary"
                onClick={handleApply}
              />
            </div>
          }
        >
          <div className="overview-filter-body">
            <div className="overview-filter-form overview-filter-form--two-column">
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.payments.type")}
                </div>
                <Select
                  value={draftTransactionTypeId}
                  onChange={(value) =>
                    setDraftTransactionTypeId(value || undefined)
                  }
                  allowClear
                  placeholder={t("Customer.customerDetails.common.allTypes")}
                  options={transactionTypeOptions}
                />
              </div>
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.payments.status")}
                </div>
                <Select
                  value={draftStatusId}
                  onChange={(value) => setDraftStatusId(value || undefined)}
                  allowClear
                  placeholder={t("Customer.customerDetails.common.allStatuses")}
                  options={statusOptions}
                />
              </div>
              {paymentMethodOptions?.length ? (
                <div className="overview-filter-field2">
                  <div className="overview-filter-label">
                    {t("Customer.customerDetails.tabs.payments.paymentMethod")}
                  </div>
                  <Select
                    value={draftPaymentMethodId}
                    onChange={(value) =>
                      setDraftPaymentMethodId(value || undefined)
                    }
                    allowClear
                    placeholder={t(
                      "Customer.customerDetails.tabs.payments.allPaymentMethod",
                    )}
                    options={paymentMethodOptions}
                  />
                </div>
              ) : null}
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.payments.transactionTime")}
                </div>
                <DatePicker.RangePicker
                  value={draftTransactionRange}
                  onChange={(value) => setDraftTransactionRange(value || null)}
                  allowClear
                  format="DD/MM/YYYY"
                  separator="-"
                  placeholder={[
                    t("Customer.customerDetails.common.startDate"),
                    t("Customer.customerDetails.common.endDate"),
                  ]}
                />
              </div>
            </div>
          </div>
        </Modal>
      </OverviewRenderBoundary>
    </>
  );
};

export default PaymentsTab;
