import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spin, Tabs } from "antd";
import type { TablePaginationConfig } from "antd/es/table";
import type {
  SorterResult,
  TableCurrentDataSource,
} from "antd/es/table/interface";
import External from "@/assets/images/app-external.png";
import TotalIcon from "@/assets/images/TotalAll.svg";
import CompletedIcon from "@/assets/images/Completed.svg";
import PaymentIcon from "@/assets/images/Payment.svg";
import ActiveIcon from "@/assets/images/Active2.svg";
import ExpiredIcon from "@/assets/images/Expired 2.svg";
import CancelledIcon from "@/assets/images/Cancelled 2.svg";
import DisabledIcon from "@/assets/images/Disabled 2.svg";
import ReopenedIcon from "@/assets/images/Reopened.svg";
import ResolvedIcon from "@/assets/images/Resolved.svg";
import PendingCustomerIcon from "@/assets/images/Pending Customer.svg";
import DepartmentProcessingIcon from "@/assets/images/Department Processing.svg";
import DepartmentProcessedIcon from "@/assets/images/Department Processed.svg";
import OpenIcon from "@/assets/images/Open.svg";
import ServiceApplicationFeesIcon from "@/assets/images/ServiceApplicationFees.svg";
import TotalFinesPaidIcon from "@/assets/images/TotalFinesPaid.svg";
import TotalRefundsIcon from "@/assets/images/TotalRefunds.svg";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type {
  AppealItem,
  InspectionNoFullScanFilters,
  InspectionNoFullScanSelectOption,
  InspectionOverviewItem,
  InspectionOverviewStats,
  LicenseItem,
  OverviewRowItem,
  PaymentItem,
  PaymentCountStats,
  RefundItem,
  TicketItem,
  ViolationFineItem,
} from "../types";
import DetailSection from "./DetailSection";

import ApplicationsTab from "./allProfilesOverviewTabs/ApplicationsTab";
import PaymentsTab from "./allProfilesOverviewTabs/PaymentsTab";
import TicketsTab from "./allProfilesOverviewTabs/TicketsTab";
import ViolationsFinesTab from "./allProfilesOverviewTabs/ViolationsFinesTab";
import RefundsTab from "./allProfilesOverviewTabs/RefundsTab";
import LicensesTab from "./allProfilesOverviewTabs/LicensesTab";
import AppealTab from "./allProfilesOverviewTabs/AppealTab";
import InspectionTab from "./allProfilesOverviewTabs/InspectionTab";
import InspectionTabNoFullScan from "./allProfilesOverviewTabs/InspectionTabNoFullScan";
import type { NormalizedTicketsStatusCount } from "./allProfilesOverviewTabs/ticketUtils";
import type { AppealOverviewStats } from "./allProfilesOverviewTabs/appealProfileUtils";
import { overviewFigmaAssets } from "@/components/common/ApplicationOverviewCards/assets/overviewFigmaAssets";
import { formatMoney } from "@/utils/utils";

type SelectOption = { label: string; value: string };
const TICKETS_SEARCH_DEBOUNCE_MS = 500;
const REFUNDS_SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_SEARCH_DEBOUNCE_MS = 500;

export interface AllProfilesOverviewStats {
  total: number;
  licenses: number;
  content: number;
  processing?: number;
  completed?: number;
  rejected?: number;
  cancelled?: number;
}

export interface LicensesStats {
  total: number;
  active: number;
  expired: number;
  cancelled: number;
  disabled: number;
}

type StatCardItem = {
  label: string;
  value: number | string;
  icon?: string;
  iconMode?: "vector" | "frame";
  iconTone?: "queued" | "warning" | "info" | "danger" | "success" | "muted";
};

const STAT_ICON_TONE_BACKGROUND: Record<
  NonNullable<StatCardItem["iconTone"]>,
  string
> = {
  queued: "#f9f7ed",
  warning: "#fffbeb",
  info: "#e7f5ff",
  danger: "#fef2f2",
  success: "#f3faf4",
  muted: "#f8f7f4",
};

const normalizeStatusForCount = (status: unknown) =>
  String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

const toOverviewCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
};

const formatOverviewStatValue = (value: number | string) => {
  if (typeof value !== "number") return value;

  const formatted = formatMoney(value);
  return typeof formatted === "string"
    ? formatted.replace(/\.00$/, "")
    : String(formatted);
};

const hasStatValue = (value: number | string) => {
  if (typeof value === "number") {
    return value > 0;
  }

  const normalizedValue = value.replace(/,/g, "").trim();
  if (!normalizedValue) {
    return false;
  }

  const numericValue = Number(normalizedValue);
  if (Number.isFinite(numericValue)) {
    return numericValue > 0;
  }

  return normalizedValue !== "0";
};

const OverviewStatsPanel = React.memo(
  ({
    stats,
    columnsClassName,
  }: {
    stats: StatCardItem[];
    columnsClassName: string;
  }) => {
    const statsScrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollControls = useCallback(() => {
      const statsElement = statsScrollRef.current;
      if (!statsElement) return;

      const maxScrollLeft = Math.max(
        0,
        statsElement.scrollWidth - statsElement.clientWidth,
      );

      setCanScrollLeft(statsElement.scrollLeft > 1);
      setCanScrollRight(statsElement.scrollLeft < maxScrollLeft - 1);
    }, []);

    useEffect(() => {
      const statsElement = statsScrollRef.current;
      if (!statsElement) return undefined;

      const resizeObserver = new ResizeObserver(updateScrollControls);
      resizeObserver.observe(statsElement);
      statsElement.addEventListener("scroll", updateScrollControls, {
        passive: true,
      });
      updateScrollControls();

      return () => {
        resizeObserver.disconnect();
        statsElement.removeEventListener("scroll", updateScrollControls);
      };
    }, [stats.length, updateScrollControls]);

    if (!stats.length) return null;

    return (
      <div
        className={[
          "all-overview-stats-scroll",
          canScrollLeft ? "all-overview-stats-scroll--left-shadow" : "",
          canScrollRight ? "all-overview-stats-scroll--right-shadow" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          ref={statsScrollRef}
          className={`all-overview-stats ${columnsClassName}`}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="all-overview-stat-card">
              <div
                className={[
                  "all-overview-stat-icon",
                  stat.iconMode === "vector"
                    ? "all-overview-stat-icon--vector"
                    : "",
                  stat.iconTone
                    ? `all-overview-stat-icon--${stat.iconTone}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={
                  stat.iconMode === "vector" && stat.iconTone
                    ? {
                        backgroundColor:
                          STAT_ICON_TONE_BACKGROUND[stat.iconTone],
                        borderRadius: "50%",
                      }
                    : undefined
                }
              >
                <img
                  src={stat.icon}
                  alt=""
                  style={
                    stat.iconMode === "vector"
                      ? { width: 20, height: 20 }
                      : undefined
                  }
                />
              </div>
              <div>
                <div className="all-overview-stat-value">
                  {formatOverviewStatValue(stat.value)}
                </div>
                <div
                  className="all-overview-stat-label"
                  title={stat.label}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

OverviewStatsPanel.displayName = "OverviewStatsPanel";

export interface ExtraTab {
  key: string;
  tab: string;
  content: React.ReactNode;
}

const AllProfilesOverview: React.FC<{
  hideTabs?: boolean;
  activeTab: string;
  onTabChange: (key: string) => void;
  showApplyFor?: boolean;
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  typeFilter?: string;
  onTypeFilterChange: (value?: string) => void;
  typeFilterOptions?: SelectOption[];
  applicationsStatusOptions?: SelectOption[];
  applicationsStatusId?: string;
  onApplicationsStatusIdChange?: (value?: string) => void;
  applicationsStartDate?: string;
  applicationsEndDate?: string;
  onApplicationsDateRangeChange?: (range: {
    startDate?: string;
    endDate?: string;
  }) => void;
  onApplicationsReset?: () => void;
  rows: OverviewRowItem[];
  payments?: PaymentItem[];
  paymentsStats?: PaymentCountStats | null;
  paymentsTransactionTypeOptions?: SelectOption[];
  paymentsStatusOptions?: SelectOption[];
  paymentsPaymentMethodOptions?: SelectOption[];
  paymentsTransactionTypeId?: string;
  paymentsStatusId?: string;
  paymentsPaymentMethodId?: string;
  paymentsStartDate?: string;
  paymentsEndDate?: string;
  onPaymentsTransactionTypeIdChange?: (value?: string) => void;
  onPaymentsStatusIdChange?: (value?: string) => void;
  onPaymentsDateRangeChange?: (range: {
    startDate?: string;
    endDate?: string;
  }) => void;
  onPaymentsAdvancedFilterChange?: (filters: {
    paymentMethodId?: string;
    startDate?: string;
    endDate?: string;
  }) => void;
  licenses?: LicenseItem[];
  licensesStats?: LicensesStats;
  licensesPagination?: TablePaginationConfig;
  licensesStatus?: string;
  licensesIssuanceDateStart?: string;
  licensesIssuanceDateEnd?: string;
  onLicensesStatusChange?: (value?: string) => void;
  onLicensesIssuanceDateRangeChange?: (value: {
    issuanceDateStart?: string;
    issuanceDateEnd?: string;
  }) => void;
  onLicensesTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<LicenseItem> | SorterResult<LicenseItem>[]
  ) => void;
  tickets?: TicketItem[];
  ticketsLoading?: boolean;
  ticketsStatusCount?: NormalizedTicketsStatusCount | null;
  ticketsEnquiryStatusId?: string;
  onTicketsEnquiryStatusIdChange?: (value?: string) => void;
  ticketsEnquiryType?: string;
  ticketsPriorityId?: string;
  onTicketsAdvancedFilterChange?: (filters: {
    enquiryType?: string;
    priorityId?: string;
  }) => void;
  onTicketsReset?: () => void;
  ticketsStartTime?: string;
  ticketsEndTime?: string;
  onTicketsDateRangeChange?: (range: {
    startTime?: string;
    endTime?: string;
  }) => void;
  onTicketsTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<TicketItem> | SorterResult<TicketItem>[]
  ) => void;
  violationsFines?: ViolationFineItem[];
  violationsFinesLoading?: boolean;
  violationsFinesStatusCounts?: Record<string, number>;
  violationsFinesStatusOptions?: SelectOption[];
  violationsFinesTypeId?: string;
  violationsFinesStatusId?: string;
  violationsFinesStartTime?: string;
  violationsFinesEndTime?: string;
  violationsFinesPaidTimeFrom?: string;
  violationsFinesPaidTimeTo?: string;
  onViolationsFinesTypeIdChange?: (value?: string) => void;
  onViolationsFinesStatusIdChange?: (value?: string) => void;
  onViolationsFinesDateRangeChange?: (range: {
    startTime?: string;
    endTime?: string;
  }) => void;
  onViolationsFinesPaymentDateRangeChange?: (range: {
    paidTimeFrom?: string;
    paidTimeTo?: string;
  }) => void;
  onViolationsFinesReset?: () => void;
  inspectionTasks?: InspectionOverviewItem[];
  inspectionTasksNoFullScan?: InspectionOverviewItem[];
  inspectionStats?: InspectionOverviewStats;
  inspectionLoading?: boolean;
  inspectionPagination?: TablePaginationConfig;
  onInspectionTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
  ) => void;
  inspectionNoFullScanLoading?: boolean;
  inspectionNoFullScanPagination?: TablePaginationConfig;
  inspectionNoFullScanSortDirection?: "asc" | "desc";
  onInspectionNoFullScanTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
  ) => void;
  inspectionNoFullScanFilters?: InspectionNoFullScanFilters;
  inspectionNoFullScanReasonOptions?: InspectionNoFullScanSelectOption[];
  inspectionNoFullScanStatusOptions?: InspectionNoFullScanSelectOption[];
  inspectionNoFullScanPriorityOptions?: InspectionNoFullScanSelectOption[];
  inspectionNoFullScanInspectorOptions?: InspectionNoFullScanSelectOption[];
  onInspectionNoFullScanFiltersChange?: (
    filters: InspectionNoFullScanFilters
  ) => void;
  onInspectionNoFullScanReset?: () => void;
  refunds?: RefundItem[];
  refundsStatusCount?: Record<string, unknown> | null;
  refundsErrorMessage?: string | null;
  refundsStatusId?: string;
  refundsCategory?: string;
  onRefundsCategoryChange?: (value?: string) => void;
  onRefundsStatusIdChange?: (value?: string) => void;
  refundsStartTime?: string;
  refundsEndTime?: string;
  onRefundsDateRangeChange?: (range: {
    startTime?: string;
    endTime?: string;
  }) => void;
  refundsSortDirection?: 0 | 1;
  onRefundsReset?: () => void;
  onRefundsTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<RefundItem> | SorterResult<RefundItem>[]
  ) => void;
  appeals?: AppealItem[];
  appealsLoading?: boolean;
  appealStatusCounts?: AppealOverviewStats;
  appealStatusId?: string;
  appealStartTime?: string;
  appealEndTime?: string;
  onAppealStatusIdChange?: (value?: string) => void;
  onAppealDateRangeChange?: (range: {
    startTime?: string;
    endTime?: string;
  }) => void;
  stats: AllProfilesOverviewStats;
  loading?: boolean;
  pagination: TablePaginationConfig;
  paymentsPagination?: TablePaginationConfig;
  ticketsPagination?: TablePaginationConfig;
  refundsPagination?: TablePaginationConfig;
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<OverviewRowItem> | SorterResult<OverviewRowItem>[],
    extra: TableCurrentDataSource<OverviewRowItem>
  ) => void;
  onPaymentsTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<PaymentItem> | SorterResult<PaymentItem>[]
  ) => void;
  title?: string;
  extraTabs?: ExtraTab[];
  wrapperClassName?: string;
  headerExtra?: React.ReactNode;
  visualVariant?: "figmaOverview";
}> = ({
  hideTabs,
  activeTab,
  onTabChange,
  showApplyFor,
  searchKey,
  onSearchKeyChange,
  typeFilter,
  onTypeFilterChange,
  typeFilterOptions,
  applicationsStatusOptions,
  applicationsStatusId,
  onApplicationsStatusIdChange,
  applicationsStartDate,
  applicationsEndDate,
  onApplicationsDateRangeChange,
  onApplicationsReset,
  rows,
  payments,
  paymentsStats,
  paymentsTransactionTypeOptions,
  paymentsStatusOptions,
  paymentsPaymentMethodOptions,
  paymentsTransactionTypeId,
  paymentsStatusId,
  paymentsPaymentMethodId,
  paymentsStartDate,
  paymentsEndDate,
  onPaymentsTransactionTypeIdChange,
  onPaymentsStatusIdChange,
  onPaymentsDateRangeChange,
  onPaymentsAdvancedFilterChange,
  licenses,
  licensesStats,
  licensesPagination,
  licensesStatus,
  licensesIssuanceDateStart,
  licensesIssuanceDateEnd,
  onLicensesStatusChange,
  onLicensesIssuanceDateRangeChange,
  onLicensesTableChange,
  tickets,
  ticketsLoading,
  ticketsStatusCount,
  ticketsEnquiryStatusId,
  onTicketsEnquiryStatusIdChange,
  ticketsEnquiryType,
  ticketsPriorityId,
  onTicketsAdvancedFilterChange,
  onTicketsReset,
  ticketsStartTime,
  ticketsEndTime,
  onTicketsDateRangeChange,
  onTicketsTableChange,
  violationsFines,
  violationsFinesLoading,
  violationsFinesStatusCounts,
  violationsFinesStatusOptions,
  violationsFinesTypeId,
  violationsFinesStatusId,
  violationsFinesStartTime,
  violationsFinesEndTime,
  violationsFinesPaidTimeFrom,
  violationsFinesPaidTimeTo,
  onViolationsFinesTypeIdChange,
  onViolationsFinesStatusIdChange,
  onViolationsFinesDateRangeChange,
  onViolationsFinesPaymentDateRangeChange,
  onViolationsFinesReset,
  inspectionTasks,
  inspectionTasksNoFullScan,
  inspectionStats,
  inspectionLoading,
  inspectionPagination,
  onInspectionTableChange,
  inspectionNoFullScanLoading,
  inspectionNoFullScanPagination,
  inspectionNoFullScanSortDirection,
  onInspectionNoFullScanTableChange,
  inspectionNoFullScanFilters,
  inspectionNoFullScanReasonOptions,
  inspectionNoFullScanStatusOptions,
  inspectionNoFullScanPriorityOptions,
  inspectionNoFullScanInspectorOptions,
  onInspectionNoFullScanFiltersChange,
  onInspectionNoFullScanReset,
  refunds,
  refundsStatusCount,
  refundsErrorMessage,
  appeals,
  appealsLoading,
  appealStatusCounts,
  appealStatusId,
  appealStartTime,
  appealEndTime,
  onAppealStatusIdChange,
  onAppealDateRangeChange,
  stats,
  loading,
  pagination,
  paymentsPagination,
  ticketsPagination,
  refundsPagination,
  refundsStatusId,
  refundsCategory,
  onRefundsCategoryChange,
  onRefundsStatusIdChange,
  refundsStartTime,
  refundsEndTime,
  onRefundsDateRangeChange,
  refundsSortDirection,
  onRefundsReset,
  onRefundsTableChange,
  onTableChange,
  onPaymentsTableChange,
  title,
  extraTabs,
  wrapperClassName,
  headerExtra,
  visualVariant,
}) => {
  const { t } = useTranslation();
  const sectionTitle =
    title ?? t("Customer.customerDetails.allProfilesOverview.defaultTitle");
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftSearchKey, setDraftSearchKey] = useState(searchKey || "");

  const clearSearchDebounce = useCallback(() => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearSearchDebounce();
    setDraftSearchKey(searchKey || "");
  }, [clearSearchDebounce, searchKey]);

  useEffect(
    () => () => {
      clearSearchDebounce();
    },
    [clearSearchDebounce]
  );

  const handleOverviewSearchKeyChange = useCallback(
    (value: string) => {
      const nextValue = value || "";
      setDraftSearchKey(nextValue);
      clearSearchDebounce();

      if (!nextValue) {
        onSearchKeyChange("");
        return;
      }

      searchDebounceTimerRef.current = setTimeout(
        () => {
          searchDebounceTimerRef.current = null;
          onSearchKeyChange(nextValue);
        },
        activeTab === "tickets"
          ? TICKETS_SEARCH_DEBOUNCE_MS
          : activeTab === "refunds"
            ? REFUNDS_SEARCH_DEBOUNCE_MS
            : DEFAULT_SEARCH_DEBOUNCE_MS,
      );
    },
    [activeTab, clearSearchDebounce, onSearchKeyChange]
  );

  const handleTabChange = useCallback(
    (key: string) => {
      clearSearchDebounce();
      setDraftSearchKey("");
      onSearchKeyChange("");
      onTabChange(key);
    },
    [clearSearchDebounce, onSearchKeyChange, onTabChange]
  );

  const currentLoading =
    activeTab === "violations-fines"
      ? violationsFinesLoading ?? loading
      : activeTab === "tickets"
        ? ticketsLoading ?? loading
      : activeTab === "inspection"
        ? visualVariant === "figmaOverview"
          ? inspectionLoading ?? loading
          : inspectionNoFullScanLoading ?? loading
      : activeTab === "appeal"
        ? appealsLoading ?? loading
        : loading;

  const currentStats: StatCardItem[] = useMemo(() => {
    const SL = (key: string) =>
      t(`Customer.customerDetails.allProfilesOverview.stats.${key}`);
    const useFigmaStats = visualVariant === "figmaOverview";
    if (activeTab === "applications") {
      const processing = toOverviewCount(stats.processing ?? stats.licenses);
      const completed = toOverviewCount(stats.completed);
      const rejected = toOverviewCount(stats.rejected);
      const cancelled = toOverviewCount(stats.cancelled ?? stats.content);

      return [
        { label: SL("processing"), value: processing, icon: External },
        { label: SL("completed"), value: completed, icon: CompletedIcon },
        { label: SL("rejected"), value: rejected, icon: DisabledIcon },
        { label: SL("cancelled"), value: cancelled, icon: CancelledIcon },
      ];
    }

    if (activeTab === "payments") {
      // if (paymentsStats) {
      // }
      return [
        {
          label: SL("totalSpending"),
          value: Number(paymentsStats?.totalSpending || 0),
          icon: TotalIcon,
        },
        {
          label: SL("serviceApplicationFees"),
          value: Number(paymentsStats?.serviceApplicationFees || 0),
          icon: ServiceApplicationFeesIcon,
        },
        {
          label: SL("totalFinesPaid"),
          value: Number(paymentsStats?.totalFinesPaid || 0),
          icon: TotalFinesPaidIcon,
        },
        {
          label: SL("totalRefunds"),
          value: Number(paymentsStats?.totalRefunds || 0),
          icon: TotalRefundsIcon,
        },
        {
          label: SL("totalRecharge"),
          value: Number(paymentsStats?.totalRecharge || 0),
          icon: PaymentIcon,
        },
      ];

      // const list = payments || [];
      // const pending = list.filter((p) => String(p.status) === "1").length;
      // const completed = list.filter((p) => String(p.status) === "3").length;
      // return [
      //   { label: SL("total"), value: list.length, icon: TotalIcon },
      //   { label: SL("pendingPayment"), value: pending, icon: PaymentIcon },
      //   { label: SL("completed"), value: completed, icon: CompletedIcon },
      // ];
    }

    if (activeTab === "licenses") {
      // { label: SL("total"), value: licensesStats.total, icon: TotalIcon },
      return [
        {
          label: SL("active"),
          value: toOverviewCount(licensesStats?.active),
          icon: ActiveIcon,
        },
        {
          label: SL("expired"),
          value: toOverviewCount(licensesStats?.expired),
          icon: ExpiredIcon,
        },
        {
          label: SL("cancelled"),
          value: toOverviewCount(licensesStats?.cancelled),
          icon: CancelledIcon,
        },
        {
          label: SL("suspended"),
          value: toOverviewCount(licensesStats?.disabled),
          icon: DisabledIcon,
        },
      ];
    }

    if (activeTab === "tickets") {
      return [
        {
          label: SL("total"),
          value: toOverviewCount(ticketsStatusCount?.totalCount),
          icon: TotalIcon,
        },
        {
          label: SL("open"),
          value: toOverviewCount(ticketsStatusCount?.openCount),
          icon: OpenIcon,
        },
        {
          label: SL("pendingCustomer"),
          value: toOverviewCount(ticketsStatusCount?.pendingCustormer),
          icon: PendingCustomerIcon,
        },
        {
          label: SL("departmentProcessing"),
          value: toOverviewCount(
            ticketsStatusCount?.departmentProcessingCount,
          ),
          icon: DepartmentProcessingIcon,
        },
        {
          label: SL("departmentProcessed"),
          value: toOverviewCount(ticketsStatusCount?.departmentProcessedCount),
          icon: DepartmentProcessedIcon,
        },
        {
          label: SL("resolved"),
          value: toOverviewCount(ticketsStatusCount?.resolvedCount),
          icon: ResolvedIcon,
        },
        {
          label: SL("reopened"),
          value: toOverviewCount(ticketsStatusCount?.reopentCount),
          icon: ReopenedIcon,
        },
        {
          label: SL("completed"),
          value: toOverviewCount(ticketsStatusCount?.completedCount),
          icon: CompletedIcon,
        },
        {
          label: SL("cancelled"),
          value: toOverviewCount(ticketsStatusCount?.cancelledCount),
          icon: CancelledIcon,
        },
      ];
    }

    if (activeTab === "violations-fines") {
      const violationStatusCounts = violationsFinesStatusCounts || {};
      const getViolationCount = (statuses: string[]) => {
        return statuses.reduce(
          (total, status) =>
            total +
            toOverviewCount(
              violationStatusCounts[normalizeStatusForCount(status)],
            ),
          0,
        );
      }
      return [
        {
          label: SL("warningIssued"),
          value: getViolationCount(["Warning Issued"]),
          icon: overviewFigmaAssets.violationStats?.warningIssued,
          iconMode: "vector",
          iconTone: "info",
        },
        {
          label: SL("reviewInProgress"),
          value: getViolationCount([
            "Pending Routing",
            "Pending Content Report",
            "Pending Review",
            "Pending Committee Decision",
            "Pending Approval",
          ]),
          icon: overviewFigmaAssets.violationStats?.reviewProgress,
          iconMode: "vector",
          iconTone: "warning",
        },
        {
          label: SL("pendingPayment"),
          value: getViolationCount(["Pending Payment"]),
          icon: overviewFigmaAssets.violationStats?.pendingPayment,
          iconMode: "vector",
          iconTone: "info",
        },
        {
          label: SL("underAppeal"),
          value: getViolationCount(["Under Appeal"]),
          icon: overviewFigmaAssets.violationStats?.underAppeal,
          iconMode: "vector",
          iconTone: "danger",
        },
        {
          label: SL("paid"),
          value: getViolationCount(["Paid"]),
          icon: overviewFigmaAssets.violationStats?.paid,
          iconMode: "vector",
          iconTone: "success",
        },
        {
          label: SL("cancelled"),
          value: getViolationCount(["Cancelled"]),
          icon: overviewFigmaAssets.violationStats?.cancelled,
          iconMode: "vector",
          iconTone: "muted",
        },
      ];
    }

    if (activeTab === "refunds") {
      const statsSource = refundsStatusCount || {};
      return [
        {
          label: SL("departmentProcessing"),
          value: toOverviewCount(statsSource.departmentProcessingCount),
          icon: useFigmaStats
            ? overviewFigmaAssets.refundStats.departmentProcessing
            : DepartmentProcessingIcon,
        },
        {
          label: SL("departmentProcessed"),
          value: toOverviewCount(statsSource.departmentProcessedCount),
          icon: useFigmaStats
            ? overviewFigmaAssets.refundStats.departmentProcessed
            : DepartmentProcessedIcon,
        },
        {
          label: SL("pendingCustomer"),
          value: toOverviewCount(statsSource.pendingCustomerCount),
          icon: useFigmaStats
            ? overviewFigmaAssets.refundStats.pendingCustomer
            : PendingCustomerIcon,
        },
        {
          label: SL("pendingRefund"),
          value: toOverviewCount(statsSource.pendingRefundCount),
          icon: useFigmaStats
            ? overviewFigmaAssets.refundStats.pendingRefund
            : PaymentIcon,
        },
        {
          label: SL("refunded"),
          value: toOverviewCount(statsSource.refundedCount),
          icon: useFigmaStats
            ? overviewFigmaAssets.refundStats.refunded
            : CompletedIcon,
        },
        {
          label: SL("rejected"),
          value: toOverviewCount(statsSource.rejectedCount),
          icon: useFigmaStats
            ? overviewFigmaAssets.refundStats.rejected
            : DisabledIcon,
        },
        {
          label: SL("cancelled"),
          value: toOverviewCount(statsSource.cancelledCount),
          icon: useFigmaStats
            ? overviewFigmaAssets.refundStats.cancelled
            : CancelledIcon,
        },
      ];
    }

    if (activeTab === "appeal") {
      const source = appealStatusCounts || {
        departmentProcessing: 0,
        departmentProcessed: 0,
        pendingCustomer: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      };
      return [
        {
          label: SL("departmentProcessing"),
          value: source.departmentProcessing,
          icon: useFigmaStats
            ? overviewFigmaAssets.appealStats.departmentProcessing
            : DepartmentProcessingIcon,
        },
        {
          label: SL("departmentProcessed"),
          value: source.departmentProcessed,
          icon: useFigmaStats
            ? overviewFigmaAssets.appealStats.departmentProcessed
            : DepartmentProcessedIcon,
        },
        {
          label: SL("pendingCustomer"),
          value: source.pendingCustomer,
          icon: useFigmaStats
            ? overviewFigmaAssets.appealStats.pendingCustomer
            : PendingCustomerIcon,
        },
        {
          label: SL("approved"),
          value: source.approved,
          icon: useFigmaStats
            ? overviewFigmaAssets.appealStats.approved
            : CompletedIcon,
        },
        {
          label: SL("rejected"),
          value: source.rejected,
          icon: useFigmaStats
            ? overviewFigmaAssets.appealStats.rejected
            : DisabledIcon,
        },
        {
          label: SL("cancelled"),
          value: source.cancelled,
          icon: useFigmaStats
            ? overviewFigmaAssets.appealStats.cancelled
            : CancelledIcon,
        },
      ];
    }

    if (activeTab === "inspection") {
      const source = inspectionStats || {
        queued: 0,
        pendingVisit: 0,
        inProgress: 0,
        accessFailed: 0,
        completed: 0,
        cancelled: 0,
      };
      return [
        {
          label: t("inspection.status.task.queued"),
          value: source.queued,
          icon: overviewFigmaAssets.inspectionStats.queued,
          iconMode: "vector",
          iconTone: "queued",
        },
        {
          label: t("inspection.status.task.pendingVisit"),
          value: source.pendingVisit,
          icon: overviewFigmaAssets.inspectionStats.pendingVisit,
          iconMode: "vector",
          iconTone: "warning",
        },
        {
          label: t("inspection.status.task.inProgress"),
          value: source.inProgress,
          icon: overviewFigmaAssets.inspectionStats.inProgress,
          iconMode: "vector",
          iconTone: "info",
        },
        {
          label: t("inspection.status.task.accessFailed"),
          value: source.accessFailed,
          icon: overviewFigmaAssets.inspectionStats.accessFailed,
          iconMode: "vector",
          iconTone: "danger",
        },
        {
          label: t("inspection.status.task.completed"),
          value: source.completed,
          icon: overviewFigmaAssets.inspectionStats.completed,
          iconMode: "vector",
          iconTone: "success",
        },
        {
          label: t("inspection.status.task.cancelled"),
          value: source.cancelled,
          icon: overviewFigmaAssets.inspectionStats.cancelled,
          iconMode: "vector",
          iconTone: "muted",
        },
      ];
    }

    return [];
  }, [
    activeTab,
    appealStatusCounts,
    inspectionStats,
    licensesStats,
    paymentsStats,
    refundsStatusCount,
    stats,
    ticketsStatusCount,
    violationsFinesStatusCounts,
    t,
    visualVariant,
  ]);

  const hasTableData = useMemo(() => {
    if (activeTab === "applications") {
      return (rows || []).length > 0;
    }
    if (activeTab === "payments") {
      return (payments || []).length > 0;
    }
    if (activeTab === "licenses") {
      return (licenses || []).length > 0;
    }
    if (activeTab === "tickets") {
      return (tickets || []).length > 0;
    }
    if (activeTab === "violations-fines") {
      return (violationsFines || []).length > 0;
    }
    if (activeTab === "refunds") {
      return (refunds || []).length > 0;
    }
    if (activeTab === "inspection") {
      return visualVariant === "figmaOverview"
        ? (inspectionTasks || []).length > 0
        : (inspectionTasksNoFullScan || []).length > 0;
    }
    if (activeTab === "appeal") {
      return (appeals || []).length > 0;
    }
    return false;
  }, [
    activeTab,
    appeals,
    inspectionTasks,
    inspectionTasksNoFullScan,
    licenses,
    payments,
    refunds,
    rows,
    visualVariant,
    violationsFines,
    tickets,
  ]);

  const hasStatsData = useMemo(
    () => currentStats.some((stat) => hasStatValue(stat.value)),
    [currentStats],
  );

  const shouldShowPageLoading = currentLoading && !hasStatsData && !hasTableData;

  const statsColumnsClass = (() => {
    if (visualVariant === "figmaOverview") {
      if (activeTab === "payments") return "all-overview-stats--columns-5";
      if (activeTab === "refunds") return "all-overview-stats--columns-5 all-overview-stats--wide";
      if (activeTab === "violations-fines") return "all-overview-stats--columns-4";
      if (["inspection", "violations-fines", "appeal"].includes(activeTab)) {
        return "all-overview-stats--columns-6";
      }
    }

    if (currentStats.length >= 7) return "all-overview-stats--columns-4 all-overview-stats--wide";
    if (currentStats.length === 5) return "all-overview-stats--columns-5";
    if (currentStats.length >= 4) return "all-overview-stats--columns-4";
    return "all-overview-stats--columns-3";
  })();

  const loadingView = (
    <div className="all-overview-loading">
      <Spin size="large" />
    </div>
  );

  const renderBody = () => (
    <div
      className={`all-overview-body${
        visualVariant === "figmaOverview" ? " all-overview-body--figma" : ""
      }${visualVariant === "figmaOverview" ? ` all-overview-body--tab-${activeTab}` : ""}`}
    >
      <OverviewStatsPanel
        stats={currentStats}
        columnsClassName={statsColumnsClass}
      />

      {activeTab === "applications" ? (
        <ApplicationsTab
          searchKey={draftSearchKey}
          onSearchKeyChange={handleOverviewSearchKeyChange}
          typeFilter={typeFilter}
          onTypeFilterChange={onTypeFilterChange}
          typeFilterOptions={typeFilterOptions}
          statusOptions={applicationsStatusOptions}
          statusId={applicationsStatusId}
          onStatusIdChange={onApplicationsStatusIdChange}
          rows={rows}
          loading={currentLoading}
          pagination={pagination}
          onTableChange={onTableChange}
          startDate={applicationsStartDate}
          endDate={applicationsEndDate}
          onDateRangeChange={onApplicationsDateRangeChange}
          onReset={onApplicationsReset}
        />
      ) : null}

      {activeTab === "payments" ? (
        <PaymentsTab
          searchKey={draftSearchKey}
          onSearchKeyChange={handleOverviewSearchKeyChange}
          payments={payments}
          paymentsStats={paymentsStats}
          loading={currentLoading}
          pagination={
            paymentsPagination || { pageSize: 10, showSizeChanger: true }
          }
          showApplyFor={showApplyFor}
          onTableChange={onPaymentsTableChange}
          transactionTypeOptions={paymentsTransactionTypeOptions}
          statusOptions={paymentsStatusOptions}
          paymentMethodOptions={paymentsPaymentMethodOptions}
          transactionTypeId={paymentsTransactionTypeId}
          statusId={paymentsStatusId}
          paymentMethodId={paymentsPaymentMethodId}
          onTransactionTypeIdChange={onPaymentsTransactionTypeIdChange}
          onStatusIdChange={onPaymentsStatusIdChange}
          startDate={paymentsStartDate}
          endDate={paymentsEndDate}
          onAdvancedFilterChange={onPaymentsAdvancedFilterChange}
          onDateRangeChange={onPaymentsDateRangeChange}
        />
      ) : null}

      {activeTab === "licenses" ? (
        <LicensesTab
          searchKey={draftSearchKey}
          onSearchKeyChange={handleOverviewSearchKeyChange}
          licenses={licenses}
          loading={currentLoading}
          pagination={licensesPagination}
          showApplyFor={showApplyFor}
          status={licensesStatus}
          issuanceDateStart={licensesIssuanceDateStart}
          issuanceDateEnd={licensesIssuanceDateEnd}
          onStatusChange={onLicensesStatusChange}
          onIssuanceDateRangeChange={onLicensesIssuanceDateRangeChange}
          onTableChange={onLicensesTableChange}
        />
      ) : null}

      {activeTab === "tickets" ? (
        <TicketsTab
          searchKey={draftSearchKey}
          onSearchKeyChange={handleOverviewSearchKeyChange}
          tickets={tickets}
          loading={currentLoading}
          pagination={ticketsPagination}
          enquiryStatusId={ticketsEnquiryStatusId}
          onEnquiryStatusIdChange={onTicketsEnquiryStatusIdChange}
          enquiryType={ticketsEnquiryType}
          priorityId={ticketsPriorityId}
          onAdvancedFilterChange={onTicketsAdvancedFilterChange}
          onResetFilters={onTicketsReset}
          startTime={ticketsStartTime}
          endTime={ticketsEndTime}
          onDateRangeChange={onTicketsDateRangeChange}
          onTableChange={onTicketsTableChange}
        />
      ) : null}

      {activeTab === "violations-fines" ? (
        <ViolationsFinesTab
          searchKey={draftSearchKey}
          onSearchKeyChange={handleOverviewSearchKeyChange}
          violationsFines={violationsFines}
          loading={currentLoading}
          showApplyFor={showApplyFor}
          visualVariant={visualVariant}
          violationTypeId={violationsFinesTypeId}
          statusId={violationsFinesStatusId}
          statusOptions={violationsFinesStatusOptions}
          startTime={violationsFinesStartTime}
          endTime={violationsFinesEndTime}
          paidTimeFrom={violationsFinesPaidTimeFrom}
          paidTimeTo={violationsFinesPaidTimeTo}
          onViolationTypeIdChange={onViolationsFinesTypeIdChange}
          onStatusIdChange={onViolationsFinesStatusIdChange}
          onDateRangeChange={onViolationsFinesDateRangeChange}
          onPaymentDateRangeChange={onViolationsFinesPaymentDateRangeChange}
          onResetFilters={onViolationsFinesReset}
        />
      ) : null}

      {activeTab === "refunds" ? (
        <RefundsTab
          searchKey={draftSearchKey}
          onSearchKeyChange={handleOverviewSearchKeyChange}
          refunds={refunds}
          errorMessage={refundsErrorMessage}
          loading={currentLoading}
          pagination={refundsPagination}
          onTableChange={onRefundsTableChange}
          showApplyFor={showApplyFor}
          refundsCategory={refundsCategory}
          onRefundsCategoryChange={onRefundsCategoryChange}
          refundsStatusId={refundsStatusId}
          onRefundsStatusIdChange={onRefundsStatusIdChange}
          startTime={refundsStartTime}
          endTime={refundsEndTime}
          onDateRangeChange={onRefundsDateRangeChange}
          lastUpdatedSortDirection={refundsSortDirection}
          onResetFilters={onRefundsReset}
          visualVariant={visualVariant}
        />
      ) : null}

      {activeTab === "appeal" ? (
        <AppealTab
          searchKey={draftSearchKey}
          onSearchKeyChange={handleOverviewSearchKeyChange}
          appeals={appeals}
          loading={currentLoading}
          showApplyFor={showApplyFor}
          visualVariant={visualVariant}
          statusId={appealStatusId}
          startTime={appealStartTime}
          endTime={appealEndTime}
          onStatusIdChange={onAppealStatusIdChange}
          onDateRangeChange={onAppealDateRangeChange}
        />
      ) : null}

      {activeTab === "inspection" ? (
        visualVariant === "figmaOverview" ? (
          <InspectionTab
            searchKey={draftSearchKey}
            onSearchKeyChange={handleOverviewSearchKeyChange}
            inspectionTasks={inspectionTasks}
            loading={currentLoading}
            showApplyFor={showApplyFor}
            pagination={inspectionPagination}
            onTableChange={onInspectionTableChange}
          />
        ) : (
          <InspectionTabNoFullScan
            searchKey={draftSearchKey}
            onSearchKeyChange={handleOverviewSearchKeyChange}
            inspectionTasksNoFullScan={inspectionTasksNoFullScan}
            loading={currentLoading}
            showApplyFor={showApplyFor}
            pagination={inspectionNoFullScanPagination}
            assignedTimeSortDirection={inspectionNoFullScanSortDirection}
            onTableChange={onInspectionNoFullScanTableChange}
            filters={inspectionNoFullScanFilters}
            reasonOptions={inspectionNoFullScanReasonOptions}
            statusOptions={inspectionNoFullScanStatusOptions}
            priorityOptions={inspectionNoFullScanPriorityOptions}
            inspectorOptions={inspectionNoFullScanInspectorOptions}
            onFiltersChange={onInspectionNoFullScanFiltersChange}
            onResetFilters={onInspectionNoFullScanReset}
          />
        )
      ) : null}
    </div>
  );

  if (hideTabs) {
    if (shouldShowPageLoading) {
      return loadingView;
    }

    if (
      [
        "applications",
        "payments",
        "licenses",
        "tickets",
        "inspection",
        "violations-fines",
        "refunds",
        "appeal",
      ].includes(activeTab)
    ) {
      return renderBody();
    }

    return hasStatsData || hasTableData ? renderBody() : (
      <div className="all-overview-empty">
        <EmptyBox title={t("Customer.customerDetails.common.noData")} />
      </div>
    );
  }

  return (
    <DetailSection title={sectionTitle} extra={headerExtra} className={wrapperClassName}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        className="customer-details-tabs"
      >
        {extraTabs?.map((tab) => (
          <Tabs.TabPane tab={tab.tab} key={tab.key}>
            {tab.content}
          </Tabs.TabPane>
        ))}
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.applications")} key="applications" />
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.payments")} key="payments" />
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.licenses")} key="licenses" />
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.enquiriesComplaints")} key="tickets" />
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.inspection")} key="inspection" />
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.violationsFines")} key="violations-fines" />
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.refunds")} key="refunds" />
        <Tabs.TabPane tab={t("Customer.customerDetails.allProfilesOverview.tabs.appeal")} key="appeal" />
      </Tabs>
      
      {renderBody()}
    </DetailSection>
  );
};

export default AllProfilesOverview;
