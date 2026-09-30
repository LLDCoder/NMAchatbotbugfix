import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatePicker, Empty, Input, Modal, Select, Table, Tooltip } from "antd";
import type { RefSelectProps } from "antd/es/select";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useHistory } from "react-router-dom";
import moment from "moment";
import sortIcon from "@/assets/images/sort.png";
import { CustomButton } from "@/components/common";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import Individual from "@/assets/icons/Individual";
import Establishment from "@/assets/icons/Establishment";
import { navigateToTicketApplicationDetails } from "@/pages/Tickets/utils/applicationDetailsNavigation";
import { canAccessRouteWithToast } from "@/routes/permissionNavigation";
import type { TicketItem } from "../../types";
import { useTranslation } from "react-i18next";
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

type SelectOption = { label: string; value: string };
type RangeValue = [moment.Moment | null, moment.Moment | null] | null;

const ALL_TICKETS_STATUS_VALUE = "10";

const normalizeTicketStatusIds = (values: unknown): string[] => {
  const uniqueStatusIds = new Set<string>();
  const statusValues = Array.isArray(values)
    ? values
    : String(values ?? "").split(",");

  statusValues
    .map((value) => String(value ?? "").trim())
    .filter(
      (value) =>
        value === ALL_TICKETS_STATUS_VALUE || /^[1-7]$/.test(value),
    )
    .forEach((value) => uniqueStatusIds.add(value));

  return Array.from(uniqueStatusIds);
};

const toTicketStatusFilterValue = (statusIds: string[]) => {
  const normalizedStatusIds = normalizeTicketStatusIds(statusIds);

  if (normalizedStatusIds.includes(ALL_TICKETS_STATUS_VALUE)) {
    return ALL_TICKETS_STATUS_VALUE;
  }

  return normalizedStatusIds.length ? normalizedStatusIds.join(",") : undefined;
};

type TicketStatusSelectProps = {
  value?: string;
  onChange: (value: string | undefined) => void;
  className?: string;
};

const TicketStatusSelect: React.FC<TicketStatusSelectProps> = React.memo(
  ({ value, onChange, className }) => {
    const { t } = useTranslation();
    const statusSelectRef = useRef<RefSelectProps>(null);
    const keepOpenAfterSelectRef = useRef(false);
    const [isOpen, setIsOpen] = useState(false);
    const selectedStatusIds = useMemo(
      () => normalizeTicketStatusIds(value),
      [value],
    );
    const statusOptions = useMemo<SelectOption[]>(
      () => [
        {
          label: t("Customer.customerDetails.common.allStatuses"),
          value: ALL_TICKETS_STATUS_VALUE,
        },
        {
          label: t("Customer.customerDetails.allProfilesOverview.stats.open"),
          value: "1",
        },
        {
          label: t(
            "Customer.customerDetails.allProfilesOverview.stats.pendingCustomer",
          ),
          value: "2",
        },
        {
          label: t(
            "Customer.customerDetails.allProfilesOverview.stats.departmentProcessing",
          ),
          value: "3",
        },
        {
          label: t(
            "Customer.customerDetails.allProfilesOverview.stats.departmentProcessed",
          ),
          value: "4",
        },
        {
          label: t(
            "Customer.customerDetails.allProfilesOverview.stats.resolved",
          ),
          value: "5",
        },
        {
          label: t(
            "Customer.customerDetails.allProfilesOverview.stats.completed",
          ),
          value: "6",
        },
        {
          label: t(
            "Customer.customerDetails.allProfilesOverview.stats.cancelled",
          ),
          value: "7",
        },
      ],
      [t],
    );

    useEffect(() => {
      if (!isOpen) return;

      const frameId = window.requestAnimationFrame(() => {
        statusSelectRef.current?.focus();
      });

      return () => window.cancelAnimationFrame(frameId);
    }, [isOpen, selectedStatusIds]);

    const handleChange = (values: string[]) => {
      const statusIds = normalizeTicketStatusIds(values);
      const nextStatusIds = statusIds.includes(ALL_TICKETS_STATUS_VALUE)
        ? [ALL_TICKETS_STATUS_VALUE]
        : statusIds;
      const nextStatusValue = toTicketStatusFilterValue(nextStatusIds);
      const currentStatusValue = toTicketStatusFilterValue(selectedStatusIds);

      keepOpenAfterSelectRef.current = true;
      setIsOpen(true);
      if (nextStatusValue !== currentStatusValue) {
        onChange(nextStatusValue);
      }
    };

    const handleDropdownVisibleChange = (open: boolean) => {
      if (!open && keepOpenAfterSelectRef.current) {
        setIsOpen(true);
        return;
      }

      setIsOpen(open);
    };

    const handleBlur = () => {
      keepOpenAfterSelectRef.current = false;
      setIsOpen(false);
    };

    return (
      <Select
        mode="multiple"
        maxTagCount={1}
        maxTagTextLength={18}
        maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
        showArrow
        ref={statusSelectRef}
        open={isOpen}
        value={selectedStatusIds.length ? selectedStatusIds : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
        onDropdownVisibleChange={handleDropdownVisibleChange}
        className={["all-overview-type-select", className]
          .filter(Boolean)
          .join(" ")}
        allowClear
        placeholder={t("Customer.customerDetails.common.allStatuses")}
        options={statusOptions}
        optionFilterProp="label"
      />
    );
  },
);

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

const renderEllipsisText = (value?: string | null) => {
  const text = (value ?? "-").trim() || "-";

  return (
    <Tooltip title={text}>
      <span className="overview-cell-ellipsis">{text}</span>
    </Tooltip>
  );
};

const renderServiceName = (value?: string | null) => {
  const text = (value ?? "-").trim() || "-";

  return (
    <Tooltip title={text}>
      <div className="overview-two-line overview-two-line--clamp">
        <span className="overview-primary">{text}</span>
      </div>
    </Tooltip>
  );
};

const renderCustomerCell = (
  value?: string | null,
  customerTypeId?: number,
  customerTypeCode?: string,
) => {
  const text = (value ?? "-").trim() || "-";
  const normalizedTypeCode = String(customerTypeCode ?? "").toLowerCase();
  const isIndividual =
    customerTypeId === 1 ||
    normalizedTypeCode.includes("individual") ||
    normalizedTypeCode.includes("person");
  const isEstablishment =
    [2, 5, 20, 27].includes(Number(customerTypeId)) ||
    normalizedTypeCode.includes("establishment") ||
    normalizedTypeCode.includes("commercial");
  const Icon = isIndividual
    ? Individual
    : isEstablishment
      ? Establishment
      : null;

  return (
    <Tooltip title={text}>
      <span className="overview-entity-cell overview-entity-cell--two-line">
        {text !== "-" && Icon ? (
          <span className="overview-entity-cell__icon">
            <Icon />
          </span>
        ) : null}
        <span className="overview-entity-cell__text">{text}</span>
      </span>
    </Tooltip>
  );
};

const TicketsTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  tickets?: TicketItem[];
  loading?: boolean;
  pagination?: TablePaginationConfig;
  showApplyFor?: boolean;
  enquiryStatusId?: string;
  onEnquiryStatusIdChange?: (value: string | undefined) => void;
  enquiryType?: string;
  priorityId?: string;
  onAdvancedFilterChange?: (filters: {
    enquiryType?: string;
    priorityId?: string;
  }) => void;
  onResetFilters?: () => void;
  startTime?: string;
  endTime?: string;
  onDateRangeChange?: (range: { startTime?: string; endTime?: string }) => void;
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<TicketItem> | SorterResult<TicketItem>[],
  ) => void;
}> = ({
  searchKey,
  onSearchKeyChange,
  tickets,
  loading,
  pagination,
  enquiryStatusId,
  onEnquiryStatusIdChange,
  enquiryType,
  priorityId,
  onAdvancedFilterChange,
  onResetFilters,
  startTime,
  endTime,
  onDateRangeChange,
  onTableChange,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftTicketsType, setDraftTicketsType] = useState<string | undefined>(
    undefined,
  );
  const [draftTicketsPriority, setDraftTicketsPriority] = useState<
    string | undefined
  >(undefined);
  const [draftEnquiryStatusId, setDraftEnquiryStatusId] = useState<
    string | undefined
  >(undefined);
  const [draftDateRange, setDraftDateRange] = useState<RangeValue>(null);
  const ticketTypeOptions = useMemo<SelectOption[]>(
    () => [
      {
        label: t(
          "Customer.customerDetails.allProfilesOverview.ticketFilters.types.enquiry",
        ),
        value: "1",
      },
      {
        label: t(
          "Customer.customerDetails.allProfilesOverview.ticketFilters.types.suggestion",
        ),
        value: "4",
      },
      {
        label: t(
          "Customer.customerDetails.allProfilesOverview.ticketFilters.types.complaint",
        ),
        value: "2",
      },
    ],
    [t],
  );
  const ticketPriorityOptions = useMemo<SelectOption[]>(
    () => [
      { label: t("Customer.tickets.priority.low"), value: "3" },
      { label: t("Customer.tickets.priority.medium"), value: "2" },
      { label: t("Customer.tickets.priority.high"), value: "1" },
    ],
    [t],
  );

  const columns = useMemo<ColumnsType<TicketItem>>(() => {
    return [
      {
        title: t("Customer.tickets.table.ticketNo"),
        dataIndex: "ticketNo",
        key: "ticketNo",
        width: 200,
        render: (text: string, row) => (
          <div className="overview-two-line">
            <span className="overview-primary">{text || "-"}</span>
            {row.reopenTimes > 0 ? (
              <span className="overview-subpill">
                {t("Customer.tickets.labels.reopen")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        title: t("Customer.tickets.table.type"),
        dataIndex: "type",
        key: "type",
        width: 140,
        render: (text: string) => renderEllipsisText(text),
      },
      {
        title: t("Customer.tickets.table.applicationNo"),
        dataIndex: "applicationNo",
        key: "applicationNo",
        width: 180,
        render: (text?: string) => {
          const value = String(text ?? "").trim();
          if (!value || value === "-") return "-";

          return (
            <Tooltip title={value}>
              <span
                className="overview-link-value"
                style={{ cursor: "pointer" }}
                onClick={async (event) => {
                  event.stopPropagation();
                  try {
                    await navigateToTicketApplicationDetails(history, value);
                  } catch (error) {
                    console.error(error);
                  }
                }}
              >
                {value}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: t("Customer.tickets.table.serviceName"),
        dataIndex: "serviceName",
        key: "serviceName",
        width: 240,
        render: (text: string) => renderServiceName(text),
      },
      {
        title: t("Customer.tickets.table.customer"),
        dataIndex: "customer",
        key: "customer",
        width: 220,
        render: (text: string, row) =>
          renderCustomerCell(
            text,
            row.customerTypeId,
            row.customerTypeCode,
          ),
      },
      {
        title: t("Customer.tickets.table.Priority"),
        dataIndex: "priority",
        key: "priority",
        width: 120,
        render: (text?: string) => renderEllipsisText(text),
      },
      {
        title: t("Customer.tickets.table.status"),
        dataIndex: "status",
        key: "status",
        width: 200,
        render: (text: string, row) => {
          const statusId = Number(text);
          return Number.isInteger(statusId) && statusId >= 1 && statusId <= 7 ? (
            <CustomStatusTag type="enquiryStatus" status={statusId} />
          ) : (
            renderEllipsisText(row.statusName)
          );
        },
      },
      {
        title: (
          <span className="overview-sort-title">
            {t("Customer.tickets.table.lastUpdated")}
          </span>
        ),
        dataIndex: "lastUpdated",
        key: "lastUpdated",
        width: 180,
        sorter: true,
        defaultSortOrder: "descend",
        render: (text?: string) => {
          const parsed = parseDateValue(text);
          return parsed ? parsed.format("DD/MM/YYYY HH:mm:ss") : "-";
        },
      },
    ];
  }, [history, t]);

  const rangeValue = useMemo<RangeValue>(() => {
    if (!startTime && !endTime) return null;

    return [
      startTime ? parseDateValue(startTime) : null,
      endTime ? parseDateValue(endTime) : null,
    ];
  }, [endTime, startTime]);

  const rows = useMemo(() => tickets || [], [tickets]);
  const enquiryStatusChangeRef = useRef(onEnquiryStatusIdChange);

  useEffect(() => {
    enquiryStatusChangeRef.current = onEnquiryStatusIdChange;
  }, [onEnquiryStatusIdChange]);

  const handleEnquiryStatusIdChange = useCallback(
    (value: string | undefined) => {
      enquiryStatusChangeRef.current?.(value);
    },
    [],
  );

  /**
   * The modal filters enquiry type, priority and status, plus a date range that
   * reads as one filter.
   */
  const appliedFilterCount =
    countAppliedFilters([enquiryType, priorityId, enquiryStatusId]) +
    (isAppliedFilterValue(startTime) || isAppliedFilterValue(endTime) ? 1 : 0);

  const openFilterModal = () => {
    setDraftTicketsType(enquiryType);
    setDraftTicketsPriority(priorityId);
    setDraftEnquiryStatusId(enquiryStatusId);
    setDraftDateRange(rangeValue);
    setFilterModalOpen(true);
  };

  const handleCancel = () => {
    setDraftTicketsType(enquiryType);
    setDraftTicketsPriority(priorityId);
    setDraftEnquiryStatusId(enquiryStatusId);
    setDraftDateRange(rangeValue);
    setFilterModalOpen(false);
  };

  const handleApply = () => {
    onAdvancedFilterChange?.({
      enquiryType: draftTicketsType || undefined,
      priorityId: draftTicketsPriority || undefined,
    });
    if (draftEnquiryStatusId !== enquiryStatusId) {
      handleEnquiryStatusIdChange(draftEnquiryStatusId);
    }
    const nextStart = draftDateRange?.[0]
      ? formatOverviewRequestDateTime(draftDateRange[0].clone().startOf("day"))
      : undefined;
    const nextEnd = draftDateRange?.[1]
      ? formatOverviewRequestDateTime(draftDateRange[1].clone().endOf("day"))
      : undefined;
    if (nextStart !== startTime || nextEnd !== endTime) {
      onDateRangeChange?.({ startTime: nextStart, endTime: nextEnd });
    }
    setFilterModalOpen(false);
  };

  const handleReset = () => {
    onSearchKeyChange("");
    onResetFilters?.();
    setDraftTicketsType(undefined);
    setDraftTicketsPriority(undefined);
    setDraftEnquiryStatusId(undefined);
    setDraftDateRange(null);
    setFilterModalOpen(false);
  };

  return (
    <>
      <OverviewRenderBoundary
        dependencies={[
          enquiryStatusId,
          enquiryType,
          priorityId,
          rangeValue,
          searchKey,
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
            onChange={(event) => onSearchKeyChange(event.target.value)}
          />

          <TicketStatusSelect
            value={enquiryStatusId}
            onChange={handleEnquiryStatusIdChange}
            className="all-overview-tickets-status-select responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
          />

          <DatePicker.RangePicker
            value={rangeValue ?? undefined}
            onChange={(values) => {
              const nextStart = values?.[0]
                ? formatOverviewRequestDateTime(values[0].clone().startOf("day"))
                : undefined;
              const nextEnd = values?.[1]
                ? formatOverviewRequestDateTime(values[1].clone().endOf("day"))
                : undefined;

              onDateRangeChange?.({
                startTime: nextStart,
                endTime: nextEnd,
              });
            }}
            className="all-overview-date-range all-overview-tickets-date-range responsive-filter-toolbar__field responsive-filter-toolbar__field--compact-hidden"
            allowClear
            inputReadOnly
            format="DD/MM/YYYY"
            placeholder={[
              t("Customer.tickets.placeholders.startDate"),
              t("Customer.tickets.placeholders.endDate"),
            ]}
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

      <Table<TicketItem>
        className="admin-table all-overview-table"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        scroll={{ x: 1480 }}
        loading={loading}
        pagination={pagination || { pageSize: 10, showSizeChanger: true }}
        sortDirections={["descend", "ascend"]}
        onRow={(data) => {
          return {
            onClick: () => {
              const detailsId = Number(data.detailsId ?? data.id);
              if (!Number.isInteger(detailsId) || detailsId <= 0) return;
              const targetPath =
                `/happiness/tickets/tickets-details?id=${detailsId}`;
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
        onChange={(pageConfig, _filters, sorter) => {
          onTableChange?.(pageConfig, sorter);
        }}
      />

      <OverviewRenderBoundary
        dependencies={[
          draftDateRange,
          draftEnquiryStatusId,
          draftTicketsPriority,
          draftTicketsType,
          filterModalOpen,
          t,
          ticketPriorityOptions,
          ticketTypeOptions,
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
                  {t("Customer.tickets.table.status")}
                </div>
                <TicketStatusSelect
                  value={draftEnquiryStatusId}
                  onChange={setDraftEnquiryStatusId}
                />
              </div>
              <div className="overview-filter-field2 customer-details-overview-filter-modal__responsive-field">
                <div className="overview-filter-label">
                  {t("Customer.tickets.table.lastUpdated")}
                </div>
                <DatePicker.RangePicker
                  value={draftDateRange ?? undefined}
                  onChange={(value) => setDraftDateRange(value || null)}
                  allowClear
                  inputReadOnly
                  format="DD/MM/YYYY"
                  placeholder={[
                    t("Customer.tickets.placeholders.startDate"),
                    t("Customer.tickets.placeholders.endDate"),
                  ]}
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t("Customer.tickets.table.type")}
                </div>
                <Select
                  value={draftTicketsType}
                  onChange={(value) => setDraftTicketsType(value || undefined)}
                  placeholder={t("Customer.customerDetails.common.allTypes")}
                  options={ticketTypeOptions}
                  allowClear
                  optionFilterProp="label"
                />
              </div>
              <div className="overview-filter-field2">
                <div className="overview-filter-label">
                  {t("Customer.tickets.table.Priority")}
                </div>
                <Select
                  value={draftTicketsPriority}
                  onChange={(value) =>
                    setDraftTicketsPriority(value || undefined)
                  }
                  placeholder={t(
                    "Customer.customerDetails.allProfilesOverview.ticketFilters.allPriorities",
                  )}
                  options={ticketPriorityOptions}
                  allowClear
                  optionFilterProp="label"
                />
              </div>
            </div>
          </div>
        </Modal>
      </OverviewRenderBoundary>
    </>
  );
};

export default TicketsTab;
