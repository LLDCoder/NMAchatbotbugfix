import React, { useCallback, useMemo, useState } from "react";
import { DatePicker, Empty, Input, Modal, Select, Table } from "antd";
import type { RangePickerProps } from "antd/es/date-picker";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import moment from "moment";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";
import type { AppealItem } from "../../types";
import { useTranslation } from "react-i18next";
import {
  compareOverviewDates,
  formatOverviewDateTime,
  formatOverviewRequestDateTime,
  renderOverviewEntityCell,
  renderOverviewSearchPrefix,
  renderOverviewStatusPill,
} from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import { PROFILE_APPEAL_STATUS_OPTIONS } from "./appealProfileUtils";
import PaginationTotal from "@/components/common/PaginationTotal";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";

type AppealTableItem = AppealItem & { applyFor?: string };
type RangeValue = [moment.Moment | null, moment.Moment | null] | null;
type RangePickerValue = RangePickerProps["value"];

const APPEAL_TABLE_SCROLL_X = 1180;

const toRangePickerValue = (value: RangeValue): RangePickerValue =>
  value as unknown as RangePickerValue;

const fromRangePickerValue = (value: RangePickerValue): RangeValue =>
  value as unknown as RangeValue;

const getLastUpdatedValue = (row: AppealTableItem) =>
  row.lastUpdated || row.submissionTime || row.requestDate;

const formatStatusLabel = (value?: string | number | null) =>
  String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");

const normalizeStatusKey = (value?: string | number | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const toMomentRange = (
  startTime?: string,
  endTime?: string,
): RangeValue => {
  const start = startTime ? moment(startTime) : null;
  const end = endTime ? moment(endTime) : null;
  return [
    start?.isValid() ? start : null,
    end?.isValid() ? end : null,
  ];
};

const toDateRangeParams = (value: RangeValue) => ({
  startTime: value?.[0]?.isValid()
    ? formatOverviewRequestDateTime(value[0].clone().startOf("day"))
    : undefined,
  endTime: value?.[1]?.isValid()
    ? formatOverviewRequestDateTime(value[1].clone().endOf("day"))
    : undefined,
});

const AppealTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  appeals?: AppealItem[];
  loading?: boolean;
  pagination?: TablePaginationConfig;
  showApplyFor?: boolean;
  visualVariant?: "figmaOverview";
  statusId?: string;
  startTime?: string;
  endTime?: string;
  onStatusIdChange?: (value?: string) => void;
  onDateRangeChange?: (range: {
    startTime?: string;
    endTime?: string;
  }) => void;
}> = ({
  searchKey,
  onSearchKeyChange,
  appeals,
  loading,
  pagination,
  visualVariant,
  statusId,
  startTime,
  endTime,
  onStatusIdChange,
  onDateRangeChange,
}) => {
  const { t } = useTranslation();
  const isFigmaOverview = visualVariant === "figmaOverview";
  const [fallbackPageSize, setFallbackPageSize] = useState(10);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  // The modal filters status and a date range; the search box stays inline.
  const appliedFilterCount =
    countAppliedFilters([statusId]) +
    (isAppliedFilterValue(startTime) || isAppliedFilterValue(endTime) ? 1 : 0);
  const [draftStatusId, setDraftStatusId] = useState<string | undefined>();
  const [draftDateRange, setDraftDateRange] = useState<RangeValue>(null);
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

  const getLocalizedStatusLabel = useCallback(
    (
      value?: string | number | null,
      valueStatusId?: string | number | null,
    ) => {
      const statusIdText = String(valueStatusId ?? "").trim();
      const normalizedValue = normalizeStatusKey(value);
      const definition = PROFILE_APPEAL_STATUS_OPTIONS.find(
        (option) =>
          option.id === statusIdText ||
          normalizeStatusKey(option.name) === normalizedValue,
      );

      if (definition) {
        return t(definition.translationKey, {
          defaultValue: definition.name,
        });
      }
      return formatStatusLabel(value) || "-";
    },
    [t],
  );

  const columns = useMemo<ColumnsType<AppealTableItem>>(
    () => [
      {
        title: t("Customer.customerAppeals.table.appealNo"),
        dataIndex: "appealNo",
        key: "appealNo",
        width: 180,
      },
      {
        title: t("Customer.customerAppeals.table.appealReason"),
        dataIndex: "appealReason",
        key: "appealReason",
        width: 240,
        render: (_text: string, row) =>
          row.appealReason || row.appealCategory || "-",
      },
      {
        title: t("Customer.customerAppeals.table.violationNo"),
        dataIndex: "violationNo",
        key: "violationNo",
        width: 180,
        render: (_text: string, row) => row.violationNo || row.fineNo || "-",
      },
      {
        title: t("Customer.customerAppeals.table.applyFor"),
        dataIndex: "applyFor",
        key: "applyFor",
        width: 180,
        render: (text?: string) =>
          isFigmaOverview ? (
            renderOverviewEntityCell(text)
          ) : (
            <span>{text || "-"}</span>
          ),
      },
      {
        title: t("Customer.customerAppeals.table.status"),
        dataIndex: "status",
        key: "status",
        width: 180,
        render: (text: string, row) =>
          renderOverviewStatusPill(getLocalizedStatusLabel(text, row.statusId)),
      },
      {
        title: t("Customer.customerAppeals.table.lastUpdated"),
        dataIndex: "lastUpdated",
        key: "lastUpdated",
        width: 210,
        defaultSortOrder: "descend",
        sorter: (a, b) =>
          compareOverviewDates(getLastUpdatedValue(a), getLastUpdatedValue(b)),
        render: (_text: string, row) =>
          formatOverviewDateTime(getLastUpdatedValue(row)),
      },
    ],
    [getLocalizedStatusLabel, isFigmaOverview, t],
  );

  const normalizedStatusOptions = useMemo(
    () => [
      {
        label: t("Customer.customerDetails.common.allStatuses"),
        value: "",
      },
      ...PROFILE_APPEAL_STATUS_OPTIONS.map((option) => ({
        label: t(option.translationKey, { defaultValue: option.name }),
        value: option.id,
      })),
    ],
    [t],
  );

  const dateRangeValue = useMemo(
    () => toMomentRange(startTime, endTime),
    [endTime, startTime],
  );

  const rows = appeals || [];

  const openFilterModal = () => {
    setDraftStatusId(statusId);
    setDraftDateRange(dateRangeValue);
    setFilterModalOpen(true);
  };

  const handleCancel = () => {
    setDraftStatusId(statusId);
    setDraftDateRange(dateRangeValue);
    setFilterModalOpen(false);
  };

  const handleApply = () => {
    if (draftStatusId !== statusId) {
      onStatusIdChange?.(draftStatusId || undefined);
    }
    onDateRangeChange?.(toDateRangeParams(draftDateRange));
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    setDraftStatusId(undefined);
    setDraftDateRange(null);
    setFilterModalOpen(false);
    onSearchKeyChange("");
    onStatusIdChange?.(undefined);
    onDateRangeChange?.({ startTime: undefined, endTime: undefined });
  };

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          dateRangeValue,
          draftDateRange,
          draftStatusId,
          filterModalOpen,
          isFigmaOverview,
          normalizedStatusOptions,
          searchKey,
          statusId,
          t,
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
            value={statusId}
            onChange={(v) => onStatusIdChange?.(v || undefined)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            placeholder={t("Customer.customerDetails.common.allStatuses")}
            options={normalizedStatusOptions}
          />
          <DatePicker.RangePicker
            value={toRangePickerValue(dateRangeValue)}
            onChange={(value) =>
              onDateRangeChange?.(toDateRangeParams(fromRangePickerValue(value)))
            }
            className="overview-inline-range responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            format="DD/MM/YYYY"
            placeholder={[
              t("Customer.customerDetails.common.startDate"),
              t("Customer.customerDetails.common.endDate"),
            ]}
            separator="-"
          />
          <CustomButton
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button all-overview-filter-toolbar__filter-button--compact all-overview-filter-toolbar__action--responsive-only filter-trigger-with-count"
            onClick={openFilterModal}
          >
            {t("Customer.customerDetails.common.filter")}
            <img className="filter-trigger-funnel" src={sortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>
          <CustomButton
            text={t("common.reset")}
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button all-overview-filter-toolbar__action--responsive-only"
            onClick={handleReset}
          />
        </AllOverviewFilterToolbar>

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
                  {t("Customer.customerAppeals.table.status")}
                </div>
                <Select
                  value={draftStatusId}
                  onChange={(value) => setDraftStatusId(value || undefined)}
                  allowClear
                  placeholder={t("Customer.customerDetails.common.allStatuses")}
                  options={normalizedStatusOptions}
                />
              </div>
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t("Customer.customerAppeals.table.submissionTime")}
                </div>
                <DatePicker.RangePicker
                  value={toRangePickerValue(draftDateRange)}
                  onChange={(value) => setDraftDateRange(fromRangePickerValue(value) || null)}
                  format="DD/MM/YYYY"
                  placeholder={[
                    t("Customer.customerDetails.common.startDate"),
                    t("Customer.customerDetails.common.endDate"),
                  ]}
                  separator="-"
                />
              </div>
            </div>
          </div>
        </Modal>
      </OverviewRenderBoundary>

      <Table<AppealTableItem>
        className="admin-table all-overview-table"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        pagination={pagination || fallbackPagination}
        tableLayout={isFigmaOverview ? "fixed" : undefined}
        scroll={{ x: APPEAL_TABLE_SCROLL_X }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("Customer.customerDetails.common.noData")}
            />
          ),
        }}
      />
    </>
  );
};

export default AppealTab;
