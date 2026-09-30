import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DatePicker, Empty, Input, Modal, Select, Table, Tooltip } from "antd";
import { BankOutlined } from "@ant-design/icons";
import type { RangePickerProps } from "antd/es/date-picker";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type {
  SorterResult,
  TableCurrentDataSource,
} from "antd/es/table/interface";
import moment from "moment";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import type { OverviewRowItem } from "../../types";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import { useServicesStore } from "@/store/services";
import { canAccessRouteWithToast } from "@/routes/permissionNavigation";
import {
  formatOverviewRequestDateTime,
  renderOverviewSearchPrefix,
} from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import { buildApplicationTypeOptions } from "./applicationFilterOptions";
import "./ApplicationsTab.less";

type SelectOption = { label: string; value: string };

type RangeValue = [moment.Moment | null, moment.Moment | null] | null;
type RangePickerValue = RangePickerProps["value"];

const toRangePickerValue = (value: RangeValue): RangePickerValue =>
  value as unknown as RangePickerValue;

const fromRangePickerValue = (value: RangePickerValue): RangeValue =>
  value as unknown as RangeValue;

const LICENSING_APPLICATION_DETAILS_PATH =
  "/licensing/applications/applicationsDetails";
const CONTENT_APPLICATION_DETAILS_PATH =
  "/content/ContentApplications/ContentApplicationsDetails";

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

const renderTwoLineText = (
  value?: string | null,
  options?: { clamp?: boolean; tooltip?: boolean },
) => {
  const text = (value ?? "-").trim() || "-";
  const content = (
    <div
      className={`overview-two-line${options?.clamp ? " overview-two-line--clamp" : ""}`}
    >
      <div className="overview-primary">{text}</div>
    </div>
  );

  if (!options?.tooltip) return content;

  return (
    <Tooltip
      title={text}
      color="#fff"
      overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
      placement="topLeft"
    >
      {content}
    </Tooltip>
  );
};

const renderDateTimeCell = (value?: string) => {
  const parsed = parseDateValue(value);
  if (!parsed) return "-";

  return (
    <div className="overview-date-time">
      <div className="overview-date-time__date">{parsed.format("DD/MM/YYYY")}</div>
      <div className="overview-date-time__time">{parsed.format("HH:mm:ss")}</div>
    </div>
  );
};

const renderApplyForCell = (value?: string) => (
  <span className="overview-applyfor">
    <BankOutlined className="overview-applyfor-icon" />
    <span className="overview-applyfor-text">{value || "-"}</span>
  </span>
);

const ApplicationsTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  typeFilter?: string;
  onTypeFilterChange: (value?: string) => void;
  typeFilterOptions?: SelectOption[];
  statusOptions?: SelectOption[];
  statusId?: string;
  onStatusIdChange?: (value?: string) => void;
  rows: OverviewRowItem[];
  loading?: boolean;
  pagination: TablePaginationConfig;
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<OverviewRowItem> | SorterResult<OverviewRowItem>[],
    extra: TableCurrentDataSource<OverviewRowItem>
  ) => void;
  startDate?: string;
  endDate?: string;
  onDateRangeChange?: (range: { startDate?: string; endDate?: string }) => void;
  onReset?: () => void;
}> = ({
  searchKey,
  onSearchKeyChange,
  typeFilter,
  onTypeFilterChange,
  typeFilterOptions,
  statusOptions,
  statusId,
  onStatusIdChange,
  rows,
  loading,
  pagination,
  onTableChange,
  startDate,
  endDate,
  onDateRangeChange,
  onReset,
}) => {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const updateServicesCode = useServicesStore(
    (state) => state.updateServicesCode,
  );
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [lastUpdatedSortOrder, setLastUpdatedSortOrder] = useState<
    "ascend" | "descend"
  >("descend");
  const [draftLastUpdatedRange, setDraftLastUpdatedRange] = useState<RangeValue>(
    null,
  );
  const [draftTypeFilter, setDraftTypeFilter] = useState<string | undefined>();
  const [draftStatusId, setDraftStatusId] = useState<string | undefined>();
  const [searchInputValue, setSearchInputValue] = useState(searchKey);

  useEffect(() => {
    setSearchInputValue(searchKey);
  }, [searchKey]);

  const safeRows = useMemo(() => rows || [], [rows]);
  const resolvedTypeOptions = useMemo(
    () =>
      typeFilterOptions?.length
        ? typeFilterOptions
        : buildApplicationTypeOptions(
            [],
            i18n.language?.toLowerCase().startsWith("ar"),
            t("Customer.customerDetails.common.allTypes"),
          ),
    [i18n.language, t, typeFilterOptions],
  );
  const resolvedStatusOptions = useMemo(
    () =>
      statusOptions?.length
        ? statusOptions
        : [{ label: t("Customer.customerDetails.common.allStatuses"), value: "" }],
    [statusOptions, t],
  );

  const columns = useMemo<ColumnsType<OverviewRowItem>>(() => {
    const cols: ColumnsType<OverviewRowItem> = [
      {
        title: t("Customer.customerDetails.tabs.applications.applicationNo"),
        dataIndex: "applicationNo",
        key: "applicationNo",
        width: 150,
        render: (text: string) => renderTwoLineText(text),
      },
      {
        title: t("Customer.customerDetails.tabs.applications.serviceName"),
        dataIndex: "serviceName",
        key: "serviceName",
        width: 190,
        render: (text: string) =>
          renderTwoLineText(text, { clamp: true, tooltip: true }),
      },
      {
        title: t("Customer.customerDetails.tabs.applications.serviceCategory"),
        dataIndex: "serviceCategory",
        key: "serviceCategory",
        width: 160,
        render: (text: string) =>
          renderTwoLineText(text, { clamp: true, tooltip: true }),
      },
      {
        title: t("Customer.customerDetails.tabs.applications.type"),
        dataIndex: "type",
        key: "type",
        width: 90,
        render: (text: string) => text || "-",
      },
      {
        title: t("Customer.customerDetails.tabs.applications.applyFor"),
        dataIndex: "applyFor",
        key: "applyFor",
        width: 140,
        render: (text: string) => renderApplyForCell(text),
      },
      {
        title: t("Customer.customerDetails.tabs.applications.status"),
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (text: string) => (
          <CustomStatusTag type="applications" status={text}></CustomStatusTag>
        ),
      },
      {
        title: (
          <span className="overview-sort-title">
            {t("Customer.customerDetails.tabs.applications.lastUpdated")}
          </span>
        ),
        dataIndex: "lastUpdatedTime",
        key: "lastUpdatedTime",
        width: 130,
        sorter: true,
        sortOrder: lastUpdatedSortOrder,
        render: (text: string) => renderDateTimeCell(text),
      },
    ];

    return cols;
  }, [lastUpdatedSortOrder, t]);

  /**
   * The modal filters application type, status and a last-updated range; the
   * range reads as one filter.
   */
  const appliedFilterCount =
    countAppliedFilters([typeFilter, statusId]) +
    (isAppliedFilterValue(startDate) || isAppliedFilterValue(endDate) ? 1 : 0);

  const openFilterModal = () => {
    const nextStart = startDate ? parseDateValue(startDate) : null;
    const nextEnd = endDate ? parseDateValue(endDate) : null;
    setDraftTypeFilter(typeFilter);
    setDraftStatusId(statusId);
    setDraftLastUpdatedRange([nextStart, nextEnd]);
    setFilterModalOpen(true);
  };

  const handleCancel = () => {
    setDraftTypeFilter(typeFilter);
    setDraftStatusId(statusId);
    setDraftLastUpdatedRange([
      startDate ? parseDateValue(startDate) : null,
      endDate ? parseDateValue(endDate) : null,
    ]);
    setFilterModalOpen(false);
  };

  const handleApply = () => {
    const start = draftLastUpdatedRange?.[0] || null;
    const end = draftLastUpdatedRange?.[1] || null;

    if (draftTypeFilter !== typeFilter) {
      onTypeFilterChange(draftTypeFilter || undefined);
    }
    if (draftStatusId !== statusId) {
      onStatusIdChange?.(draftStatusId || undefined);
    }
    onDateRangeChange?.({
      startDate: formatOverviewRequestDateTime(start?.clone().startOf("day")),
      endDate: formatOverviewRequestDateTime(end?.clone().startOf("day")),
    });
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    setSearchInputValue("");
    setDraftTypeFilter(undefined);
    setDraftStatusId(undefined);
    setDraftLastUpdatedRange(null);
    setLastUpdatedSortOrder("descend");
    if (onReset) {
      onReset();
      return;
    }
    onSearchKeyChange("");
    onTypeFilterChange(undefined);
    onStatusIdChange?.(undefined);
    onDateRangeChange?.({
      startDate: undefined,
      endDate: undefined,
    });
  };

  const handleRowClick = useCallback(
    (record: OverviewRowItem) => {
      const taskId = String(record.taskId ?? "").trim();
      if (!taskId) {
        return;
      }

      const serviceDepartmentId = Number(record.serviceDepartmentId);
      let targetPath = "";

      if (serviceDepartmentId === 1) {
        targetPath = `${LICENSING_APPLICATION_DETAILS_PATH}?taskId=${taskId}`;
      } else if (serviceDepartmentId === 2) {
        targetPath = `${CONTENT_APPLICATION_DETAILS_PATH}?taskId=${taskId}`;
      }

      if (!targetPath) {
        return;
      }

      if (!canAccessRouteWithToast(targetPath)) {
        return;
      }

      if (record.serviceCode !== undefined && record.serviceCode !== null) {
        const serviceCodeNum =
          typeof record.serviceCode === "number"
            ? record.serviceCode
            : Number(record.serviceCode);
        updateServicesCode(Number.isNaN(serviceCodeNum) ? null : serviceCodeNum);
      }

      if (location.pathname === targetPath.split("?")[0]) {
        window.location.assign(targetPath);
        return;
      }

      history.push(targetPath, { details: record });
    },
    [history, location.pathname, updateServicesCode],
  );

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          draftStatusId,
          draftLastUpdatedRange,
          draftTypeFilter,
          endDate,
          filterModalOpen,
          resolvedStatusOptions,
          resolvedTypeOptions,
          searchInputValue,
          startDate,
          statusId,
          t,
          typeFilter,
        ]}
      >
        <>
          <AllOverviewFilterToolbar>
            <Input
              allowClear
              prefix={renderOverviewSearchPrefix()}
              placeholder={t("Customer.customerDetails.common.search")}
              value={searchInputValue}
              className="all-overview-search responsive-filter-toolbar__field responsive-filter-toolbar__field--search responsive-filter-toolbar__field--single-visible-search"
              onChange={(e) => {
                const value = e.target.value;
                setSearchInputValue(value);
                onSearchKeyChange(value);
              }}
            />

            <Select
              value={typeFilter}
              onChange={(value) => onTypeFilterChange(value || undefined)}
              className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
              allowClear
              placeholder={t("Customer.customerDetails.common.allTypes")}
              options={resolvedTypeOptions}
            />

            <Select
              value={statusId}
              onChange={(value) => onStatusIdChange?.(value || undefined)}
              className="all-overview-type-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
              allowClear
              placeholder={t("Customer.customerDetails.common.allStatuses")}
              options={resolvedStatusOptions}
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
                    {t("Customer.customerDetails.tabs.applications.type")}
                  </div>
                  <Select
                    allowClear
                    value={draftTypeFilter}
                    onChange={(value) => setDraftTypeFilter(value || undefined)}
                    placeholder={t("Customer.customerDetails.common.allTypes")}
                    options={resolvedTypeOptions}
                  />
                </div>
                <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                  <div className="overview-filter-label">
                    {t("Customer.customerDetails.tabs.applications.status")}
                  </div>
                  <Select
                    allowClear
                    value={draftStatusId}
                    onChange={(value) => setDraftStatusId(value || undefined)}
                    placeholder={t("Customer.customerDetails.common.allStatuses")}
                    options={resolvedStatusOptions}
                  />
                </div>
                <div className="overview-filter-field2">
                  <div className="overview-filter-label">
                    {t("Customer.customerDetails.tabs.applications.lastUpdated")}
                  </div>
                  <DatePicker.RangePicker
                    value={toRangePickerValue(draftLastUpdatedRange)}
                    onChange={(value) =>
                      setDraftLastUpdatedRange(
                        fromRangePickerValue(value) || null,
                      )
                    }
                    format="DD/MM/YYYY"
                    placeholder={[
                      t("Customer.customerDetails.common.startTime"),
                      t("Customer.customerDetails.common.endTime"),
                    ]}
                  />
                </div>
              </div>
            </div>
          </Modal>
        </>
      </OverviewRenderBoundary>

      {loading || safeRows.length ? (
        <Table
          className="admin-table all-overview-table applications-overview-table"
          columns={columns}
          dataSource={safeRows}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          scroll={{ x: 1100 }}
          tableLayout="fixed"
          sortDirections={["descend", "ascend"]}
          onRow={(record: OverviewRowItem) => ({
            onClick: (event) => {
              event.stopPropagation();
              handleRowClick(record);
            },
          })}
          onChange={(p, _filters, sorter, extra) => {
            const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
            setLastUpdatedSortOrder(
              currentSorter?.order === "ascend" ? "ascend" : "descend",
            );
            onTableChange?.(
              p,
              sorter,
              extra,
            );
          }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("Customer.customerDetails.common.noData")}
        />
      )}
    </>
  );
};

export default ApplicationsTab;
