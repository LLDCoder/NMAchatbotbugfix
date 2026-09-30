import React, { useEffect, useMemo, useState } from "react";
import { DatePicker, Empty, Input, Modal, Select, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import type { RangePickerProps } from "antd/es/date-picker";
import moment from "moment";
import AedIcon from "@/assets/icons/Aed";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";
import {
  getAdminRefundCategories,
  getAdminRefundStatusTypes,
  type RefundStatusItemDto,
} from "@/services/refunds";
import { isArabicLanguage } from "@/localization/language";
import type { RefundItem } from "../../types";
import { useTranslation } from "react-i18next";
import {
  formatOverviewDateTime,
  parseOverviewMoment,
  renderOverviewEntityCell,
  renderOverviewSearchPrefix,
  renderOverviewStatusPill,
} from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";

type SelectOption = { label: string; value: string };

type RangeValue = [moment.Moment | null, moment.Moment | null] | null;
type RangePickerValue = RangePickerProps["value"];

const REFUNDS_TABLE_SCROLL_X = 1510;
const I18N_BASE = "Customer.customerDetails.tabs.refunds";
const REFUND_LAST_UPDATED_REQUEST_FORMAT = "YYYY-MM-DD[T]HH:mm:ss";

const toRangePickerValue = (value: RangeValue): RangePickerValue =>
  value as unknown as RangePickerValue;

const fromRangePickerValue = (value: RangePickerValue): RangeValue =>
  value as unknown as RangeValue;

const parseRefundLastUpdatedMoment = (value?: string) => {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const parsed = moment(text, REFUND_LAST_UPDATED_REQUEST_FORMAT, true);
  return parsed.isValid() ? parsed : parseOverviewMoment(text);
};

const formatRefundLastUpdatedRequestDate = (
  value?: moment.Moment | null,
  boundary: "start" | "end" = "start",
) => {
  if (!value?.isValid()) return undefined;
  const normalizedValue = value.clone();
  return (boundary === "end"
    ? normalizedValue.endOf("day")
    : normalizedValue.startOf("day")
  ).format(REFUND_LAST_UPDATED_REQUEST_FORMAT);
};

const unwrapRefundLookupItems = (response: unknown) => {
  let payload = response;

  for (let index = 0; index < 2; index += 1) {
    if (Array.isArray(payload)) {
      return payload as RefundStatusItemDto[];
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !("data" in payload)
    ) {
      break;
    }

    payload = (payload as { data?: unknown }).data;
  }

  return Array.isArray(payload) ? (payload as RefundStatusItemDto[]) : [];
};

const toLookupLabelPart = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
};

const buildRefundLookupOptions = (
  items: RefundStatusItemDto[],
  isArabic: boolean,
): SelectOption[] => {
  const seenIds = new Set<string>();

  return (Array.isArray(items) ? items : []).reduce<SelectOption[]>(
    (options, item) => {
      const value = toLookupLabelPart(item?.id);
      if (!value || !Number.isFinite(Number(value)) || seenIds.has(value)) {
        return options;
      }

      seenIds.add(value);
      const preferredLabel = toLookupLabelPart(
        isArabic ? item?.nameAr : item?.nameEn,
      );
      const fallbackLabel = toLookupLabelPart(
        isArabic ? item?.nameEn : item?.nameAr,
      );
      const code = toLookupLabelPart(item?.code);

      options.push({
        label: preferredLabel || fallbackLabel || code || value,
        value,
      });
      return options;
    },
    [],
  );
};

const toDateTimeRangeParams = (
  range: RangeValue,
): { startTime?: string; endTime?: string } => {
  const [start, end] = range || [];
  return {
    startTime: formatRefundLastUpdatedRequestDate(start, "start"),
    endTime: formatRefundLastUpdatedRequestDate(end, "end"),
  };
};

const renderAmountTitle = (label: string) => (
  <span className="all-overview-table__column-title all-overview-table__column-title--fine-amount">
    <span>{label}</span>
    <AedIcon
      className="all-overview-table__column-title-currency-icon"
      aria-label="AED"
    />
  </span>
);

const RefundsTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  refunds?: RefundItem[];
  errorMessage?: string | null;
  loading?: boolean;
  pagination?: TablePaginationConfig;
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<RefundItem> | SorterResult<RefundItem>[],
  ) => void;
  showApplyFor?: boolean;
  refundsCategory?: string;
  onRefundsCategoryChange?: (value?: string) => void;
  refundsStatusId?: string;
  onRefundsStatusIdChange?: (value?: string) => void;
  startTime?: string;
  endTime?: string;
  onDateRangeChange?: (range: { startTime?: string; endTime?: string }) => void;
  lastUpdatedSortDirection?: 0 | 1;
  onResetFilters?: () => void;
  visualVariant?: "figmaOverview";
}> = ({
  searchKey,
  onSearchKeyChange,
  refunds,
  errorMessage,
  loading,
  pagination,
  onTableChange,
  refundsCategory,
  onRefundsCategoryChange,
  refundsStatusId,
  onRefundsStatusIdChange,
  startTime,
  endTime,
  onDateRangeChange,
  lastUpdatedSortDirection,
  onResetFilters,
  visualVariant,
}) => {
  const { t, i18n } = useTranslation();
  const isFigmaOverview = visualVariant === "figmaOverview";
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  /**
   * The modal filters category, status and a last-updated date range. The search
   * box stays inline, so it is not part of the count.
   */
  const appliedFilterCount =
    countAppliedFilters([refundsCategory, refundsStatusId]) +
    (isAppliedFilterValue(startTime) || isAppliedFilterValue(endTime) ? 1 : 0);
  const [draftLastUpdatedRange, setDraftLastUpdatedRange] =
    useState<RangeValue>(null);
  const [draftCategory, setDraftCategory] = useState<string | undefined>();
  const [draftStatusId, setDraftStatusId] = useState<string | undefined>();
  const [categoryItems, setCategoryItems] = useState<RefundStatusItemDto[]>([]);
  const [statusItems, setStatusItems] = useState<RefundStatusItemDto[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = useState(true);
  const [statusOptionsLoading, setStatusOptionsLoading] = useState(true);
  const defaultTimeRange = useMemo(
    () =>
      [moment().startOf("day"), moment().endOf("day")] as [
        moment.Moment,
        moment.Moment,
      ],
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      try {
        const response = await getAdminRefundCategories();
        if (cancelled) return;
        setCategoryItems(unwrapRefundLookupItems(response));
      } catch {
        if (cancelled) return;
        setCategoryItems([]);
      } finally {
        if (!cancelled) setCategoryOptionsLoading(false);
      }
    };

    const loadStatuses = async () => {
      try {
        const response = await getAdminRefundStatusTypes();
        if (cancelled) return;
        setStatusItems(unwrapRefundLookupItems(response));
      } catch {
        if (cancelled) return;
        setStatusItems([]);
      } finally {
        if (!cancelled) setStatusOptionsLoading(false);
      }
    };

    void loadCategories();
    void loadStatuses();

    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => {
    const cols: ColumnsType<RefundItem> = [
      {
        title: t(`${I18N_BASE}.applicationNo`),
        dataIndex: "applicationNo",
        key: "applicationNo",
        width: 190,
      },
      {
        title: t(`${I18N_BASE}.refundCategory`),
        dataIndex: "refundCategory",
        key: "refundCategory",
        width: 200,
        render: (text: string) => <span>{text || "-"}</span>,
      },
      {
        title: t(`${I18N_BASE}.referenceNo`),
        dataIndex: "referenceNo",
        key: "referenceNo",
        width: 190,
        render: (_text: string, row) => (
          <span>{row.referenceNo || row.refundNo || "-"}</span>
        ),
      },
      {
        title: t(`${I18N_BASE}.applyFor`),
        dataIndex: "applyFor",
        key: "applyFor",
        width: 170,
        render: (text: string) =>
          isFigmaOverview ? (
            renderOverviewEntityCell(text)
          ) : (
            <span>{text || "-"}</span>
          ),
      },
      {
        title: renderAmountTitle(t(`${I18N_BASE}.amount`)),
        dataIndex: "amount",
        key: "amount",
        width: 150,
        render: (text: string) => (
          <span className="overview-amount">{text || "-"}</span>
        ),
      },
      {
        title: t(`${I18N_BASE}.status`),
        dataIndex: "status",
        key: "status",
        width: 190,
        render: (text: string) => renderOverviewStatusPill(text),
      },
      {
        title: t(`${I18N_BASE}.lastUpdated`),
        dataIndex: "lastUpdated",
        key: "lastUpdated",
        width: 210,
        sorter: true,
        sortOrder:
          lastUpdatedSortDirection === 0 ? "ascend" : "descend",
        sortDirections: ["descend", "ascend", "descend"],
        render: (_text: string, row) =>
          formatOverviewDateTime(row.lastUpdated || row.requestDate),
      },
    ];

    return cols;
  }, [isFigmaOverview, lastUpdatedSortDirection, t]);

  const openFilterModal = () => {
    setDraftCategory(refundsCategory);
    setDraftStatusId(refundsStatusId);
    setDraftLastUpdatedRange([
      parseRefundLastUpdatedMoment(startTime),
      parseRefundLastUpdatedMoment(endTime),
    ]);
    setFilterModalOpen(true);
  };

  const handleCancel = () => {
    setDraftCategory(refundsCategory);
    setDraftStatusId(refundsStatusId);
    setDraftLastUpdatedRange([
      parseRefundLastUpdatedMoment(startTime),
      parseRefundLastUpdatedMoment(endTime),
    ]);
    setFilterModalOpen(false);
  };

  const handleSearch = () => {
    if (draftCategory !== refundsCategory) {
      onRefundsCategoryChange?.(draftCategory || undefined);
    }
    if (draftStatusId !== refundsStatusId) {
      onRefundsStatusIdChange?.(draftStatusId || undefined);
    }
    onDateRangeChange?.(toDateTimeRangeParams(draftLastUpdatedRange));
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    setDraftCategory(undefined);
    setDraftStatusId(undefined);
    setDraftLastUpdatedRange(null);
    setFilterModalOpen(false);
    if (onResetFilters) {
      onResetFilters();
      return;
    }
    onRefundsCategoryChange?.(undefined);
    onRefundsStatusIdChange?.(undefined);
    onDateRangeChange?.({ startTime: undefined, endTime: undefined });
    onSearchKeyChange("");
  };

  const isArabic = isArabicLanguage(
    i18n.resolvedLanguage || i18n.language,
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () => [
      {
        label: t("Customer.customerDetails.common.allTypes"),
        value: "",
      },
      ...buildRefundLookupOptions(categoryItems, isArabic),
    ],
    [categoryItems, isArabic, t],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      {
        label: t("Customer.customerDetails.common.allStatuses"),
        value: "",
      },
      ...buildRefundLookupOptions(statusItems, isArabic),
    ],
    [isArabic, statusItems, t],
  );

  const rows = refunds || [];

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          categoryOptions,
          categoryOptionsLoading,
          endTime,
          isFigmaOverview,
          refundsCategory,
          refundsStatusId,
          searchKey,
          startTime,
          statusOptions,
          statusOptionsLoading,
          t,
        ]}
      >
        <AllOverviewFilterToolbar>
          <Input
            allowClear
            prefix={renderOverviewSearchPrefix()}
            placeholder={t("Customer.customerDetails.common.search")}
            value={searchKey}
            className="all-overview-search responsive-filter-toolbar__field responsive-filter-toolbar__field--search responsive-filter-toolbar__field--single-visible-search"
            onChange={(e) => onSearchKeyChange(e.target.value)}
          />

          <Select
            value={refundsCategory}
            onChange={(v) => onRefundsCategoryChange?.(v || undefined)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            loading={categoryOptionsLoading}
            placeholder={t("Customer.customerDetails.common.allTypes")}
            options={categoryOptions}
          />
          <Select
            value={refundsStatusId}
            onChange={(v) => onRefundsStatusIdChange?.(v || undefined)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            loading={statusOptionsLoading}
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

      <Table
        className="admin-table all-overview-table"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        pagination={pagination || { pageSize: 10, showSizeChanger: true }}
        tableLayout={isFigmaOverview ? "fixed" : undefined}
        scroll={{ x: REFUNDS_TABLE_SCROLL_X }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                errorMessage || t("Customer.customerDetails.common.noData")
              }
            />
          ),
        }}
        onChange={(p, _f, s) => {
          onTableChange?.(p, s);
        }}
      />

      <OverviewRenderBoundary
        dependencies={[
          defaultTimeRange,
          draftCategory,
          draftLastUpdatedRange,
          draftStatusId,
          filterModalOpen,
          categoryOptions,
          categoryOptionsLoading,
          statusOptions,
          statusOptionsLoading,
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
                onClick={handleSearch}
              />
            </div>
          }
        >
          <div className="overview-filter-body">
            <div className="overview-filter-form overview-filter-form--two-column">
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.refundCategory`)}
                </div>
                <Select
                  allowClear
                  loading={categoryOptionsLoading}
                  value={draftCategory}
                  onChange={(value) => setDraftCategory(value || undefined)}
                  placeholder={t("Customer.customerDetails.common.allTypes")}
                  options={categoryOptions}
                />
              </div>
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.status`)}
                </div>
                <Select
                  allowClear
                  loading={statusOptionsLoading}
                  value={draftStatusId}
                  onChange={(value) => setDraftStatusId(value || undefined)}
                  placeholder={t("Customer.customerDetails.common.allStatuses")}
                  options={statusOptions}
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.lastUpdated`)}
                </div>
                <DatePicker.RangePicker
                  value={toRangePickerValue(draftLastUpdatedRange)}
                  onChange={(value) =>
                    setDraftLastUpdatedRange(
                      fromRangePickerValue(value) || null,
                    )
                  }
                  format="DD/MM/YYYY"
                  // showTime={{
                  //   format: "HH:mm:ss",
                  //   defaultValue: defaultTimeRange,
                  // }}
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

export default RefundsTab;
