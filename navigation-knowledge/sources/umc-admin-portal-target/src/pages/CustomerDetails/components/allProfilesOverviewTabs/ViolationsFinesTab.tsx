import React, { useMemo, useState } from "react";
import { DatePicker, Empty, Input, Modal, Select, Table } from "antd";
import type { RangePickerProps } from "antd/es/date-picker";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import moment from "moment";
import AedIcon from "@/assets/icons/Aed";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";
import type { ViolationFineItem } from "../../types";
import { useTranslation } from "react-i18next";
import { buildViolationFilterStatusOptions } from "./violationProfileUtils";
import {
  compareOverviewDates,
  formatOverviewRequestDateTime,
  formatOverviewDateTime,
  renderOverviewEntityCell,
  renderOverviewSearchPrefix,
  renderOverviewViolationStatusPill,
} from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import PaginationTotal from "@/components/common/PaginationTotal";
import { formatMoney } from "@/utils/utils";
import "./ViolationsFinesTab.less";

type SelectOption = { label: string; value: string };

type RangeValue = [moment.Moment | null, moment.Moment | null] | null;
type RangePickerValue = RangePickerProps["value"];
type ViolationFineTableItem = ViolationFineItem & { applyFor?: string };

const FIGMA_OVERVIEW_VIOLATIONS_TABLE_SCROLL_X = 1740;
const VIOLATION_STATUS_OPTIONS = buildViolationFilterStatusOptions();

const normalizeOptionLabel = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

const toRangePickerValue = (value: RangeValue): RangePickerValue => value as unknown as RangePickerValue;

const fromRangePickerValue = (value: RangePickerValue): RangeValue => value as unknown as RangeValue;

const toMomentRange = (
  start?: string,
  end?: string,
): RangeValue => {
  const startMoment = start ? moment(start) : null;
  const endMoment = end ? moment(end) : null;
  return [
    startMoment?.isValid() ? startMoment : null,
    endMoment?.isValid() ? endMoment : null,
  ];
};

const toDateRangeParams = (
  range: RangeValue,
): { start?: string; end?: string } => {
  const [start, end] = range || [];
  return {
    start: start?.isValid()
      ? formatOverviewRequestDateTime(start.clone().startOf("day"))
      : undefined,
    end: end?.isValid()
      ? formatOverviewRequestDateTime(end.clone().endOf("day"))
      : undefined,
  };
};

const renderFineAmountTitle = (label: string) => (
  <span className="all-overview-table__column-title all-overview-table__column-title--fine-amount">
    <span>{label}</span>
    <AedIcon className="all-overview-table__column-title-currency-icon" aria-label="AED" />
  </span>
);

const ViolationsFinesTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  violationsFines?: ViolationFineItem[];
  loading?: boolean;
  pagination?: TablePaginationConfig;
  showApplyFor?: boolean;
  visualVariant?: "figmaOverview";
  violationTypeId?: string;
  statusId?: string;
  statusOptions?: SelectOption[];
  startTime?: string;
  endTime?: string;
  paidTimeFrom?: string;
  paidTimeTo?: string;
  onViolationTypeIdChange?: (value?: string) => void;
  onStatusIdChange?: (value?: string) => void;
  onDateRangeChange?: (range: { startTime?: string; endTime?: string }) => void;
  onPaymentDateRangeChange?: (range: {
    paidTimeFrom?: string;
    paidTimeTo?: string;
  }) => void;
  onResetFilters?: () => void;
}> = ({
  searchKey,
  onSearchKeyChange,
  violationsFines,
  loading,
  pagination,
  visualVariant,
  violationTypeId,
  statusId,
  statusOptions,
  startTime,
  endTime,
  paidTimeFrom,
  paidTimeTo,
  onViolationTypeIdChange,
  onStatusIdChange,
  onDateRangeChange,
  onPaymentDateRangeChange,
  onResetFilters,
}) => {
  const { t } = useTranslation();
  const [fallbackPageSize, setFallbackPageSize] = useState(10);
  const fallbackPagination = useMemo<TablePaginationConfig>(
    () => ({
      pageSize: fallbackPageSize,
      showSizeChanger: true,
      showTotal: (total, range) => (
        <PaginationTotal
          label={t("common.total")}
          total={total}
          current={Math.max(1, Math.ceil(range[0] / fallbackPageSize))}
          pageSize={fallbackPageSize}
        />
      ),
      onChange: (_page, nextPageSize) => setFallbackPageSize(nextPageSize),
    }),
    [fallbackPageSize, t],
  );
  const violationTypeOptions = useMemo<SelectOption[]>(
    () => [
      {
        label: t(
          "Customer.customerDetails.tabs.violations.licensingViolation",
        ),
        value: "1",
      },
      {
        label: t("Customer.customerDetails.tabs.violations.contentViolation"),
        value: "2",
      },
    ],
    [t],
  );
  const isFigmaOverview = visualVariant === "figmaOverview";
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  /**
   * The modal filters violation type, status, an issue date range and a payment
   * date range. Each range reads as one filter to the user.
   */
  const appliedFilterCount =
    countAppliedFilters([violationTypeId, statusId]) +
    (isAppliedFilterValue(startTime) || isAppliedFilterValue(endTime) ? 1 : 0) +
    (isAppliedFilterValue(paidTimeFrom) || isAppliedFilterValue(paidTimeTo)
      ? 1
      : 0);
  const [draftViolationTypeId, setDraftViolationTypeId] = useState<string | undefined>();
  const [draftStatusId, setDraftStatusId] = useState<string | undefined>();
  const [draftIssueRange, setDraftIssueRange] = useState<RangeValue>(null);
  const [draftPaymentRange, setDraftPaymentRange] = useState<RangeValue>(null);

  const columns = useMemo(() => {
    const cols: ColumnsType<ViolationFineTableItem> = [
      {
        title: t("Customer.customerDetails.tabs.violations.violationNo"),
        dataIndex: "fineNo",
        key: "fineNo",
        width: 180,
      },
      {
        title: t("Customer.customerDetails.tabs.violations.violationType"),
        dataIndex: "violationType",
        key: "violationType",
        width: 210,
      },
      {
        title: t("Customer.customerDetails.tabs.violations.violator"),
        dataIndex: "violator",
        key: "violator",
        width: 220,
        render: (_text: string, row) => renderOverviewEntityCell(
          row.violator || row.applyFor,
          "overview-entity-cell--two-line",
        ),
      },
      {
        title: renderFineAmountTitle(
          t("Customer.customerDetails.tabs.violations.fineAmount"),
        ),
        dataIndex: "fineAmount",
        key: "fineAmount",
        width: 170,
        render: (text: string | undefined | null) => (
          <span className="overview-amount">
            {text === undefined || text === null || String(text).trim() === ""
              ? "-"
              : String(formatMoney(String(text)))}
          </span>
        ),
      },
      {
        title: t("Customer.customerDetails.tabs.violations.status"),
        dataIndex: "status",
        key: "status",
        width: 170,
        render: (text: string) => renderOverviewViolationStatusPill(text),
      },
      {
        title: t("Customer.customerDetails.tabs.violations.sourceTask"),
        dataIndex: "sourceTask",
        key: "sourceTask",
        width: 180,
        render: (_text: string, row) => <span className="overview-link-value">{row.sourceTask || row.inspectionNo || "-"}</span>,
      },
      {
        title: t("Customer.customerDetails.tabs.violations.reportedBy"),
        dataIndex: "reportedBy",
        key: "reportedBy",
        width: 190,
        render: (text: string) => <span>{text || "-"}</span>,
      },
      {
        title: t("Customer.customerDetails.tabs.violations.creationTime"),
        dataIndex: "creationTime",
        key: "creationTime",
        width: 210,
        defaultSortOrder: "descend",
        sorter: (a, b) =>
          compareOverviewDates(
            a.creationTime || a.issueDate,
            b.creationTime || b.issueDate,
          ),
        render: (_text: string, row) => formatOverviewDateTime(row.creationTime || row.issueDate),
      },
      // {
      //   title: t("Customer.customerDetails.tabs.violations.paymentTime"),
      //   dataIndex: "paidTime",
      //   key: "paidTime",
      //   width: 210,
      //   render: (text: string | undefined) => formatOverviewDateTime(text),
      // },
    ];

    return cols;
  }, [t]);

  const normalizedStatusOptions = useMemo(() => {
    const list = Array.isArray(statusOptions) ? statusOptions : [];
    const normalized = VIOLATION_STATUS_OPTIONS.map((fallbackOption) => {
      const matchedOption = list.find(
        (option) =>
          normalizeOptionLabel(option?.label) ===
          normalizeOptionLabel(fallbackOption.label),
      );
      const value = String(matchedOption?.value ?? "").trim();

      return {
        label: fallbackOption.label,
        value: value || fallbackOption.value,
      };
    });

    return [
      { label: t("Customer.customerDetails.common.allStatuses"), value: "" },
      ...normalized,
    ];
  }, [statusOptions, t]);

  const openFilterModal = () => {
    setDraftViolationTypeId(violationTypeId);
    setDraftStatusId(statusId);
    setDraftIssueRange(toMomentRange(startTime, endTime));
    setDraftPaymentRange(toMomentRange(paidTimeFrom, paidTimeTo));
    setFilterModalOpen(true);
  };

  const handleCancel = () => {
    setDraftViolationTypeId(violationTypeId);
    setDraftStatusId(statusId);
    setDraftIssueRange(toMomentRange(startTime, endTime));
    setDraftPaymentRange(toMomentRange(paidTimeFrom, paidTimeTo));
    setFilterModalOpen(false);
  };

  const handleSearch = () => {
    const issueParams = toDateRangeParams(draftIssueRange);
    const paymentParams = toDateRangeParams(draftPaymentRange);
    if (draftViolationTypeId !== violationTypeId) {
      onViolationTypeIdChange?.(draftViolationTypeId || undefined);
    }
    if (draftStatusId !== statusId) {
      onStatusIdChange?.(draftStatusId || undefined);
    }
    onDateRangeChange?.({
      startTime: issueParams.start,
      endTime: issueParams.end,
    });
    onPaymentDateRangeChange?.({
      paidTimeFrom: paymentParams.start,
      paidTimeTo: paymentParams.end,
    });
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    setDraftViolationTypeId(undefined);
    setDraftStatusId(undefined);
    setDraftIssueRange(null);
    setDraftPaymentRange(null);
    setFilterModalOpen(false);
    if (onResetFilters) {
      onResetFilters();
      return;
    }
    onSearchKeyChange("");
  };

  const sortedRows = useMemo(() => {
    const base = violationsFines?.length ? violationsFines : [];
    return base
      .slice()
      .sort((left, right) =>
        compareOverviewDates(
          right.creationTime || right.issueDate,
          left.creationTime || left.issueDate,
        ),
      );
  }, [violationsFines]);

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          endTime,
          isFigmaOverview,
          normalizedStatusOptions,
          paidTimeFrom,
          paidTimeTo,
          searchKey,
          startTime,
          statusId,
          t,
          violationTypeId,
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
            value={violationTypeId}
            onChange={(v) => onViolationTypeIdChange?.(v || undefined)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            placeholder={t("Customer.customerDetails.common.allTypes")}
            options={[
              {
                label: t("Customer.customerDetails.common.allTypes"),
                value: "",
              },
              ...violationTypeOptions,
            ]}
          />

          <Select
            value={statusId}
            onChange={(v) => onStatusIdChange?.(v || undefined)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            placeholder={t("Customer.customerDetails.common.allStatuses")}
            options={normalizedStatusOptions}
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

      <Table<ViolationFineTableItem>
        className="admin-table all-overview-table"
        columns={columns}
        dataSource={sortedRows}
        rowKey={(row, index) =>
          row.id || row.fineNo || row.creationTime || `violation-${index}`
        }
        loading={loading}
        pagination={pagination || fallbackPagination}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Customer.customerDetails.common.noData")}
            />
          ),
        }}
        tableLayout={isFigmaOverview ? "fixed" : undefined}
        scroll={{ x: FIGMA_OVERVIEW_VIOLATIONS_TABLE_SCROLL_X }}
      />

      <OverviewRenderBoundary
        dependencies={[
          draftIssueRange,
          draftPaymentRange,
          draftStatusId,
          draftViolationTypeId,
          filterModalOpen,
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
                  {t("Customer.customerDetails.tabs.violations.violationType")}
                </div>
                <Select
                  allowClear
                  value={draftViolationTypeId}
                  onChange={(value) => setDraftViolationTypeId(value || undefined)}
                  placeholder={t("Customer.customerDetails.common.allTypes")}
                  options={[
                    { label: t("Customer.customerDetails.common.allTypes"), value: "" },
                    ...violationTypeOptions,
                  ]}
                />
              </div>
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.violations.status")}
                </div>
                <Select
                  allowClear
                  value={draftStatusId}
                  onChange={(value) => setDraftStatusId(value || undefined)}
                  placeholder={t("Customer.customerDetails.common.allStatuses")}
                  options={normalizedStatusOptions}
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.violations.violationDate")}
                </div>
                <DatePicker.RangePicker
                  value={toRangePickerValue(draftIssueRange)}
                  onChange={(value) => setDraftIssueRange(fromRangePickerValue(value) || null)}
                  placeholder={[t("Customer.customerDetails.common.startDate"), t("Customer.customerDetails.common.endDate")]}
                />
              </div>
              {/* <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t("Customer.customerDetails.tabs.violations.paymentDate")}
                </div>
                <DatePicker.RangePicker
                  value={toRangePickerValue(draftPaymentRange)}
                  onChange={(value) => setDraftPaymentRange(fromRangePickerValue(value) || null)}
                  placeholder={[t("Customer.customerDetails.common.startDate"), t("Customer.customerDetails.common.endDate")]}
                />
              </div> */}
            </div>
          </div>
        </Modal>
      </OverviewRenderBoundary>
    </>
  );
};

export default ViolationsFinesTab;
