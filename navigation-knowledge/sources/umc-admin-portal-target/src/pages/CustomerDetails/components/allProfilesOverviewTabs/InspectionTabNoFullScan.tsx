import React, { useMemo, useState } from "react";
import { DatePicker, Empty, Input, Modal, Select, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useTranslation } from "react-i18next";
import moment from "moment";
import type { Moment } from "moment";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";

import { overviewFigmaAssets } from "@/components/common/ApplicationOverviewCards/assets/overviewFigmaAssets";
import type {
  InspectionNoFullScanFilters,
  InspectionNoFullScanSelectOption,
  InspectionOverviewItem,
} from "../../types";
import {
  formatOverviewDate,
  formatOverviewDateTime,
  formatOverviewRequestDateTime,
  renderInspectionOverviewStatusPill,
  renderOverviewPriorityPill,
  renderOverviewSearchPrefix,
} from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";

type RangeValue = [Moment | null, Moment | null] | null;

const { RangePicker } = DatePicker;

const I18N_BASE =
  "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan";

const getTargetIcon = (targetType?: string) => {
  const normalized = String(targetType || "").toLowerCase();
  if (normalized.includes("individual")) return overviewFigmaAssets.inspectionTargets.user;
  if (normalized.includes("government")) return overviewFigmaAssets.inspectionTargets.government;
  if (normalized.includes("establishment") || normalized.includes("commercial")) {
    return overviewFigmaAssets.inspectionTargets.company;
  }
  return undefined;
};

const toRangeValue = (start?: string, end?: string): RangeValue => {
  if (!start && !end) return null;

  const startValue = start ? moment(start) : null;
  const endValue = end ? moment(end) : null;

  return [
    startValue?.isValid() ? startValue : null,
    endValue?.isValid() ? endValue : null,
  ];
};

const getRangeParams = (range: RangeValue) => ({
  from: formatOverviewRequestDateTime(
    range?.[0]?.clone?.().startOf("day") || null,
  ),
  to: formatOverviewRequestDateTime(
    range?.[1]?.clone?.().endOf("day") || null,
  ),
});

const InspectionTabNoFullScan: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  inspectionTasksNoFullScan?: InspectionOverviewItem[];
  loading?: boolean;
  pagination?: TablePaginationConfig;
  assignedTimeSortDirection?: "asc" | "desc";
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
  ) => void;
  showApplyFor?: boolean;
  filters?: InspectionNoFullScanFilters;
  reasonOptions?: InspectionNoFullScanSelectOption[];
  statusOptions?: InspectionNoFullScanSelectOption[];
  priorityOptions?: InspectionNoFullScanSelectOption[];
  inspectorOptions?: InspectionNoFullScanSelectOption[];
  onFiltersChange?: (filters: InspectionNoFullScanFilters) => void;
  onResetFilters?: () => void;
}> = ({
  searchKey,
  onSearchKeyChange,
  inspectionTasksNoFullScan,
  loading,
  pagination,
  assignedTimeSortDirection = "desc",
  onTableChange,
  filters,
  reasonOptions,
  statusOptions,
  priorityOptions,
  inspectorOptions,
  onFiltersChange,
  onResetFilters,
}) => {
  const { t } = useTranslation();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftReasonId, setDraftReasonId] = useState<string | undefined>();
  const [draftStatusId, setDraftStatusId] = useState<string | undefined>();
  const [draftPriorityId, setDraftPriorityId] = useState<string | undefined>();
  const [draftDueDateRange, setDraftDueDateRange] = useState<RangeValue>(null);
  const [draftAssignedTimeRange, setDraftAssignedTimeRange] =
    useState<RangeValue>(null);
  const [draftAssignedInspectorId, setDraftAssignedInspectorId] =
    useState<string | undefined>();

  const activeFilters = filters || {};
  /**
   * The modal filters reason, status, priority, assigned inspector plus a due
   * date and an assigned time range. Each range reads as one filter.
   */
  const appliedFilterCount =
    countAppliedFilters([
      activeFilters.reasonId,
      activeFilters.statusId,
      activeFilters.priorityId,
      activeFilters.assignedInspectorId,
    ]) +
    (isAppliedFilterValue(activeFilters.dueDateFrom) ||
    isAppliedFilterValue(activeFilters.dueDateTo)
      ? 1
      : 0) +
    (isAppliedFilterValue(activeFilters.assignedTimeFrom) ||
    isAppliedFilterValue(activeFilters.assignedTimeTo)
      ? 1
      : 0);
  const safeReasonOptions = reasonOptions || [];
  const safeStatusOptions = statusOptions || [];
  const safePriorityOptions = priorityOptions || [];
  const safeInspectorOptions = inspectorOptions || [];

  const rows = useMemo(
    () => inspectionTasksNoFullScan || [],
    [inspectionTasksNoFullScan],
  );

  const columns = useMemo<ColumnsType<InspectionOverviewItem>>(
    () => [
      {
        title: t(`${I18N_BASE}.columns.ticketNo`),
        dataIndex: "taskNo",
        key: "taskNo",
        width: 170,
      },
      {
        title: t(`${I18N_BASE}.columns.inspectionTarget`),
        dataIndex: "inspectionTarget",
        key: "inspectionTarget",
        width: 250,
        render: (_text, row) => {
          const targetIcon = getTargetIcon(row.inspectionTargetType);

          return (
            <span className="overview-target-cell">
              {targetIcon ? (
                <img
                  className="overview-target-cell__icon"
                  src={targetIcon}
                  alt=""
                />
              ) : null}
              <span className="overview-target-cell__content">
                <span className="overview-target-cell__title">{row.inspectionTarget || "-"}</span>
                {row.inspectionTargetMeta ? (
                  <span className="overview-target-cell__meta">{row.inspectionTargetMeta}</span>
                ) : null}
              </span>
            </span>
          );
        },
      },
      {
        title: t(`${I18N_BASE}.columns.inspectionReason`),
        dataIndex: "inspectionReason",
        key: "inspectionReason",
        width: 190,
      },
      {
        title: t(`${I18N_BASE}.columns.priority`),
        dataIndex: "priority",
        key: "priority",
        width: 120,
        render: (text?: string) => {
          const value = String(text ?? "").trim();
          return !value || value === "-"
            ? "-"
            : renderOverviewPriorityPill(value);
        },
      },
      {
        title: t(`${I18N_BASE}.columns.dueDate`),
        dataIndex: "dueDate",
        key: "dueDate",
        width: 160,
        render: (text: string) => formatOverviewDate(text),
      },
      {
        title: t(`${I18N_BASE}.columns.status`),
        dataIndex: "status",
        key: "status",
        width: 150,
        render: (text: string, row) =>
          renderInspectionOverviewStatusPill(text, row.statusKey),
      },
      {
        title: t(`${I18N_BASE}.columns.assignedTime`),
        dataIndex: "assignedTime",
        key: "assignedTime",
        width: 180,
        sorter: true,
        sortOrder:
          assignedTimeSortDirection === "asc" ? "ascend" : "descend",
        sortDirections: ["descend", "ascend", "descend"],
        render: (text: string) => formatOverviewDateTime(text),
      },
    ],
    [assignedTimeSortDirection, t],
  );

  const applyFilters = (nextFilters: InspectionNoFullScanFilters) => {
    onFiltersChange?.(nextFilters);
  };

  const openFilterModal = () => {
    setDraftReasonId(activeFilters.reasonId);
    setDraftStatusId(activeFilters.statusId);
    setDraftPriorityId(activeFilters.priorityId);
    setDraftDueDateRange(
      toRangeValue(activeFilters.dueDateFrom, activeFilters.dueDateTo),
    );
    setDraftAssignedTimeRange(
      toRangeValue(
        activeFilters.assignedTimeFrom,
        activeFilters.assignedTimeTo,
      ),
    );
    setDraftAssignedInspectorId(activeFilters.assignedInspectorId);
    setFilterModalOpen(true);
  };

  const handleApply = () => {
    const dueDate = getRangeParams(draftDueDateRange);
    const assignedTime = getRangeParams(draftAssignedTimeRange);

    applyFilters({
      ...activeFilters,
      reasonId: draftReasonId || undefined,
      statusId: draftStatusId || undefined,
      priorityId: draftPriorityId || undefined,
      dueDateFrom: dueDate.from,
      dueDateTo: dueDate.to,
      assignedTimeFrom: assignedTime.from,
      assignedTimeTo: assignedTime.to,
      assignedInspectorId: draftAssignedInspectorId || undefined,
    });
    setFilterModalOpen(false);
  };

  const handleCancel = () => {
    setDraftReasonId(activeFilters.reasonId);
    setDraftStatusId(activeFilters.statusId);
    setDraftPriorityId(activeFilters.priorityId);
    setDraftDueDateRange(
      toRangeValue(activeFilters.dueDateFrom, activeFilters.dueDateTo),
    );
    setDraftAssignedTimeRange(
      toRangeValue(
        activeFilters.assignedTimeFrom,
        activeFilters.assignedTimeTo,
      ),
    );
    setDraftAssignedInspectorId(activeFilters.assignedInspectorId);
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    setDraftReasonId(undefined);
    setDraftStatusId(undefined);
    setDraftPriorityId(undefined);
    setDraftDueDateRange(null);
    setDraftAssignedTimeRange(null);
    setDraftAssignedInspectorId(undefined);
    setFilterModalOpen(false);
    if (onResetFilters) {
      onResetFilters();
      return;
    }
    onSearchKeyChange("");
    onFiltersChange?.({});
  };

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          activeFilters.assignedInspectorId,
          activeFilters.assignedTimeFrom,
          activeFilters.assignedTimeTo,
          activeFilters.dueDateFrom,
          activeFilters.dueDateTo,
          activeFilters.priorityId,
          activeFilters.reasonId,
          activeFilters.statusId,
          safeReasonOptions,
          safeStatusOptions,
          searchKey,
          t,
        ]}
      >
        <AllOverviewFilterToolbar>
          <Input
            allowClear
            prefix={renderOverviewSearchPrefix()}
            placeholder={t(`${I18N_BASE}.filters.search`)}
            value={searchKey}
            className="all-overview-search responsive-filter-toolbar__field responsive-filter-toolbar__field--search responsive-filter-toolbar__field--single-visible-search"
            onChange={(event) => onSearchKeyChange(event.target.value)}
          />

          <Select
            allowClear
            value={activeFilters.reasonId}
            placeholder={t(`${I18N_BASE}.filters.allReasons`)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            options={safeReasonOptions}
            onChange={(value) =>
              applyFilters({
                ...activeFilters,
                reasonId: value || undefined,
              })
            }
          />

          <Select
            allowClear
            value={activeFilters.statusId}
            placeholder={t(`${I18N_BASE}.filters.allStatuses`)}
            className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            options={safeStatusOptions}
            onChange={(value) =>
              applyFilters({
                ...activeFilters,
                statusId: value || undefined,
              })
            }
          />

          <CustomButton
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button filter-trigger-with-count"
            onClick={openFilterModal}
          >
            {t(`${I18N_BASE}.filters.filter`)}
            <img className="filter-trigger-funnel" src={sortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>

          <CustomButton
            text={t(`${I18N_BASE}.filters.reset`)}
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button"
            onClick={handleReset}
          />
        </AllOverviewFilterToolbar>
      </OverviewRenderBoundary>

      {loading || rows.length ? (
        <Table<InspectionOverviewItem>
          className="admin-table all-overview-table"
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          pagination={pagination || { pageSize: 10, showSizeChanger: true }}
          tableLayout="fixed"
          scroll={{ x: 1220 }}
          onChange={(p, _filters, sorter) => {
            onTableChange?.(p, sorter);
          }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t(`${I18N_BASE}.empty.noData`)}
        />
      )}

      <OverviewRenderBoundary
        dependencies={[
          draftAssignedInspectorId,
          draftAssignedTimeRange,
          draftDueDateRange,
          draftPriorityId,
          draftReasonId,
          draftStatusId,
          filterModalOpen,
          safeInspectorOptions,
          safePriorityOptions,
          safeReasonOptions,
          safeStatusOptions,
          t,
        ]}
      >
        <Modal
          visible={filterModalOpen}
          onCancel={handleCancel}
          centered
          width={960}
          className="overview-filter-modal"
          title={t(`${I18N_BASE}.filters.filter`)}
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
                  {t(`${I18N_BASE}.columns.inspectionReason`)}
                </div>
                <Select
                  allowClear
                  value={draftReasonId}
                  placeholder={t(`${I18N_BASE}.filters.allReasons`)}
                  options={safeReasonOptions}
                  onChange={(value) => setDraftReasonId(value || undefined)}
                />
              </div>
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.columns.status`)}
                </div>
                <Select
                  allowClear
                  value={draftStatusId}
                  placeholder={t(`${I18N_BASE}.filters.allStatuses`)}
                  options={safeStatusOptions}
                  onChange={(value) => setDraftStatusId(value || undefined)}
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.modal.priority`)}
                </div>
                <Select
                  allowClear
                  value={draftPriorityId}
                  placeholder={t(`${I18N_BASE}.modal.allPriorities`)}
                  options={safePriorityOptions}
                  onChange={(value) => setDraftPriorityId(value || undefined)}
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.modal.dueDate`)}
                </div>
                <RangePicker
                  value={draftDueDateRange || undefined}
                  onChange={(value) => setDraftDueDateRange((value as RangeValue) || null)}
                  format="DD/MM/YYYY"
                  placeholder={[t(`${I18N_BASE}.modal.startDate`), t(`${I18N_BASE}.modal.endDate`)]}
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.modal.assignedTime`)}
                </div>
                <RangePicker
                  value={draftAssignedTimeRange || undefined}
                  onChange={(value) => setDraftAssignedTimeRange((value as RangeValue) || null)}
                  format="DD/MM/YYYY"
                  placeholder={[t(`${I18N_BASE}.modal.startDate`), t(`${I18N_BASE}.modal.endDate`)]}
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t(`${I18N_BASE}.modal.inspector`)}
                </div>
                <Select
                className="umc-select-arrow-manual"
                  allowClear
                  showSearch
                  value={draftAssignedInspectorId}
                  placeholder={t(`${I18N_BASE}.modal.allInspectors`)}
                  options={safeInspectorOptions}
                  optionFilterProp="label"
                  onChange={(value) => setDraftAssignedInspectorId(value || undefined)}
                />
              </div>
            </div>
          </div>
        </Modal>
      </OverviewRenderBoundary>
    </>
  );
};

export default InspectionTabNoFullScan;
