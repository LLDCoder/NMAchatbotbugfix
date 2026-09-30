import React, { useMemo } from "react";
import { Empty, Tabs } from "antd";
import { useTranslation } from "react-i18next";
import type {
  AppealItem,
  LicenseItem,
  PaymentItem,
  PaymentCountStats,
  RefundItem,
  InspectionNoFullScanFilters,
  InspectionNoFullScanSelectOption,
  InspectionOverviewItem,
  InspectionOverviewStats,
  TicketItem,
  ViolationFineItem,
  OverviewRowItem,
} from "../types";
import EstablishmentInfo from "../Commerical/EstablishmentInfo";
import EstablishmentDocuments from "../Commerical/EstablishmentDocuments";
import AddressInfo from "../Commerical/AddressInfo";
import PartnerList from "@/components/BusinessCmps/PartnerList/PartnerList";
import type { TablePaginationConfig } from "antd/es/table";
import type { SorterResult, TableCurrentDataSource } from "antd/es/table/interface";
import AllProfilesOverview from "./AllProfilesOverview";
import type { NormalizedTicketsStatusCount } from "./allProfilesOverviewTabs/ticketUtils";
import type { AppealOverviewStats } from "./allProfilesOverviewTabs/appealProfileUtils";

const CommercialProfileOverview: React.FC<{
  activeTab: string;
  onTabChange: (key: string) => void;
  profileId?: number;
  establishmentData?: {
    establishment?: any;
    documentInfo?: any;
    legalPersonal?: any;
    addressInfo?: any;
    partnerList?: any[];
  };
  applicationsRows?: OverviewRowItem[];
  applicationsStats?: { total: number; licenses: number; content: number };
  applicationsLoading?: boolean;
  applicationsPagination?: TablePaginationConfig;
  onApplicationsTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<OverviewRowItem> | SorterResult<OverviewRowItem>[],
    extra: TableCurrentDataSource<OverviewRowItem>
  ) => void;

  payments?: PaymentItem[];
  paymentsStats?: PaymentCountStats | null;
  paymentsLoading?: boolean;
  paymentsPagination?: TablePaginationConfig;
  onPaymentsTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<PaymentItem> | SorterResult<PaymentItem>[]
  ) => void;
  paymentsTransactionTypeOptions?: { label: string; value: string }[];
  paymentsStatusOptions?: { label: string; value: string }[];
  paymentsPaymentMethodOptions?: { label: string; value: string }[];
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
  titleContent?: React.ReactNode;

  licenses?: LicenseItem[];
  licensesLoading?: boolean;
  licensesStats?: {
    total: number;
    active: number;
    expired: number;
    cancelled: number;
    disabled: number;
  };
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
    sorter: any
  ) => void;
  tickets?: TicketItem[];
  ticketsLoading?: boolean;
  ticketsPagination?: TablePaginationConfig;
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
  inspectionTasksNoFullScan?: InspectionOverviewItem[];
  inspectionStats?: InspectionOverviewStats;
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
  violationsFines?: ViolationFineItem[];
  violationsFinesLoading?: boolean;
  violationsFinesStatusCounts?: Record<string, number>;
  violationsFinesStatusOptions?: { label: string; value: string }[];
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
  refunds?: RefundItem[];
  refundsLoading?: boolean;
  refundsPagination?: TablePaginationConfig;
  refundsCategory?: string;
  onRefundsCategoryChange?: (value?: string) => void;
  refundsStatusId?: string;
  onRefundsStatusIdChange?: (value?: string) => void;
  refundsStartTime?: string;
  refundsEndTime?: string;
  onRefundsDateRangeChange?: (range: { startTime?: string; endTime?: string }) => void;
  refundsSortDirection?: 0 | 1;
  onRefundsReset?: () => void;
  onRefundsTableChange?: (pagination: TablePaginationConfig, sorter: any) => void;
  refundsStatusCount?: any;
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

  overviewSearchKey?: string;
  onOverviewSearchKeyChange?: (value: string) => void;
  overviewTypeFilter?: string;
  overviewTypeFilterOptions?: { label: string; value: string }[];
  onOverviewTypeFilterChange?: (value?: string) => void;
  applicationsStatusOptions?: { label: string; value: string }[];
  applicationsStatusId?: string;
  onApplicationsStatusIdChange?: (value?: string) => void;
  applicationsStartDate?: string;
  applicationsEndDate?: string;
  onApplicationsDateRangeChange?: (range: {
    startDate?: string;
    endDate?: string;
  }) => void;
  onApplicationsReset?: () => void;
}> = ({
  activeTab,
  onTabChange,
  profileId,
  establishmentData,
  applicationsRows,
  applicationsStats,
  applicationsLoading,
  applicationsPagination,
  onApplicationsTableChange,
  payments,
  paymentsStats,
  paymentsLoading,
  paymentsPagination,
  onPaymentsTableChange,
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
  licensesLoading,
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
  ticketsPagination,
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
  inspectionTasksNoFullScan,
  inspectionStats,
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
  refunds,
  refundsLoading,
  refundsPagination,
  refundsCategory,
  onRefundsCategoryChange,
  refundsStatusId,
  onRefundsStatusIdChange,
  refundsStartTime,
  refundsEndTime,
  onRefundsDateRangeChange,
  refundsSortDirection,
  onRefundsReset,
  onRefundsTableChange,
  refundsStatusCount,
  appeals,
  appealsLoading,
  appealStatusCounts,
  appealStatusId,
  appealStartTime,
  appealEndTime,
  onAppealStatusIdChange,
  onAppealDateRangeChange,
  overviewSearchKey,
  onOverviewSearchKeyChange,
  overviewTypeFilter,
  overviewTypeFilterOptions,
  onOverviewTypeFilterChange,
  applicationsStatusOptions,
  applicationsStatusId,
  onApplicationsStatusIdChange,
  applicationsStartDate,
  applicationsEndDate,
  onApplicationsDateRangeChange,
  onApplicationsReset,
  titleContent,
}) => {
  const { t, i18n } = useTranslation();
  const tabsBase = "Customer.customerDetails.allProfilesOverview.tabs";
  const profileOverviewBase = "Customer.customerDetails.profileOverview";
  const commercialOverviewBase =
    "Customer.customerDetails.commercialProfileOverview";
  const isArabic =
    i18n.resolvedLanguage?.startsWith("ar") ||
    i18n.language.startsWith("ar");

  const statsForActiveTab = useMemo(() => {
    if (activeTab === "applications") {
      return applicationsStats || { total: 0, licenses: 0, content: 0 };
    }
    return { total: 0, licenses: 0, content: 0 };
  }, [activeTab, applicationsStats]);

  const safeApplicationsRows = applicationsRows || [];
  const safeTickets = tickets || [];
  const safeViolationsFines = violationsFines || [];
  const safeRefunds = refunds || [];
  const safeAppeals = appeals || [];

  return (
    <>
      <div className="section-title">
        {t(`${commercialOverviewBase}.title`)}

        {titleContent}
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        className="customer-details-tabs"
      >
        <Tabs.TabPane
          tab={t(`${profileOverviewBase}.tabs.basicInformation`)}
          key="basic"
        >
          <div className="detail-sections">
            <EstablishmentInfo params={establishmentData?.establishment} />
            <EstablishmentDocuments params={establishmentData?.documentInfo} />
            {/* <LegalPersonInfo params={establishmentData?.legalPersonal} /> */}
            <AddressInfo params={establishmentData?.addressInfo} />
            {establishmentData?.partnerList?.length ? (
              <PartnerList
                column={2}
                enableSearch
                profileId={profileId}
                params={establishmentData?.partnerList?.map((item: any) => ({
                  ...item,
                  name: isArabic
                    ? item.fullNameAr || item.fullNameEn || "-"
                    : item.fullNameEn || item.fullNameAr || "-",
                  identifier: item.emiratesId,
                  location: isArabic
                    ? item.emirateObj?.nameAr || item.emirateObj?.nameEn || "-"
                    : item.emirateObj?.nameEn || item.emirateObj?.nameAr || "-",
                }))}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t(`${commercialOverviewBase}.empty.noPartners`)}
              />
            )}
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab={t(`${tabsBase}.applications`)} key="applications" />
        <Tabs.TabPane tab={t(`${tabsBase}.payments`)} key="payments" />
        <Tabs.TabPane tab={t(`${tabsBase}.licenses`)} key="licenses" />
        <Tabs.TabPane
          tab={t(`${tabsBase}.enquiriesComplaints`)}
          key="tickets"
        />
        <Tabs.TabPane tab={t(`${tabsBase}.inspection`)} key="inspection" />
        <Tabs.TabPane
          tab={t(`${tabsBase}.violationsFines`)}
          key="violations-fines"
        />
        <Tabs.TabPane tab={t(`${tabsBase}.refunds`)} key="refunds" />
        <Tabs.TabPane tab={t(`${tabsBase}.appeal`)} key="appeal" />
      </Tabs>

      {activeTab !== "basic" ? (
        <AllProfilesOverview
          hideTabs
          activeTab={activeTab}
          onTabChange={onTabChange}
          searchKey={overviewSearchKey || ""}
          onSearchKeyChange={onOverviewSearchKeyChange || (() => undefined)}
          typeFilter={overviewTypeFilter}
          onTypeFilterChange={onOverviewTypeFilterChange || (() => undefined)}
          typeFilterOptions={overviewTypeFilterOptions}
          applicationsStatusOptions={applicationsStatusOptions}
          applicationsStatusId={applicationsStatusId}
          onApplicationsStatusIdChange={onApplicationsStatusIdChange}
          applicationsStartDate={applicationsStartDate}
          applicationsEndDate={applicationsEndDate}
          onApplicationsDateRangeChange={onApplicationsDateRangeChange}
          onApplicationsReset={onApplicationsReset}
          rows={safeApplicationsRows}
          payments={payments}
          paymentsStats={paymentsStats}
          paymentsTransactionTypeOptions={paymentsTransactionTypeOptions}
          paymentsStatusOptions={paymentsStatusOptions}
          paymentsPaymentMethodOptions={paymentsPaymentMethodOptions}
          paymentsTransactionTypeId={paymentsTransactionTypeId}
          paymentsStatusId={paymentsStatusId}
          paymentsPaymentMethodId={paymentsPaymentMethodId}
          paymentsStartDate={paymentsStartDate}
          paymentsEndDate={paymentsEndDate}
          onPaymentsTransactionTypeIdChange={onPaymentsTransactionTypeIdChange}
          onPaymentsStatusIdChange={onPaymentsStatusIdChange}
          onPaymentsAdvancedFilterChange={onPaymentsAdvancedFilterChange}
          onPaymentsDateRangeChange={onPaymentsDateRangeChange}
          licenses={licenses}
          licensesStats={licensesStats}
          licensesPagination={licensesPagination}
          licensesStatus={licensesStatus}
          licensesIssuanceDateStart={licensesIssuanceDateStart}
          licensesIssuanceDateEnd={licensesIssuanceDateEnd}
          onLicensesStatusChange={onLicensesStatusChange}
          onLicensesIssuanceDateRangeChange={
            onLicensesIssuanceDateRangeChange
          }
          onLicensesTableChange={onLicensesTableChange}
          tickets={safeTickets}
          ticketsLoading={ticketsLoading}
          ticketsPagination={ticketsPagination}
          ticketsStatusCount={ticketsStatusCount}
          ticketsEnquiryStatusId={ticketsEnquiryStatusId}
          onTicketsEnquiryStatusIdChange={onTicketsEnquiryStatusIdChange}
          ticketsEnquiryType={ticketsEnquiryType}
          ticketsPriorityId={ticketsPriorityId}
          onTicketsAdvancedFilterChange={onTicketsAdvancedFilterChange}
          onTicketsReset={onTicketsReset}
          ticketsStartTime={ticketsStartTime}
          ticketsEndTime={ticketsEndTime}
          onTicketsDateRangeChange={onTicketsDateRangeChange}
          onTicketsTableChange={onTicketsTableChange}
          inspectionTasksNoFullScan={inspectionTasksNoFullScan}
          inspectionStats={inspectionStats}
          inspectionNoFullScanLoading={inspectionNoFullScanLoading}
          inspectionNoFullScanPagination={inspectionNoFullScanPagination}
          inspectionNoFullScanSortDirection={
            inspectionNoFullScanSortDirection
          }
          onInspectionNoFullScanTableChange={
            onInspectionNoFullScanTableChange
          }
          inspectionNoFullScanFilters={inspectionNoFullScanFilters}
          inspectionNoFullScanReasonOptions={inspectionNoFullScanReasonOptions}
          inspectionNoFullScanStatusOptions={inspectionNoFullScanStatusOptions}
          inspectionNoFullScanPriorityOptions={
            inspectionNoFullScanPriorityOptions
          }
          inspectionNoFullScanInspectorOptions={
            inspectionNoFullScanInspectorOptions
          }
          onInspectionNoFullScanFiltersChange={
            onInspectionNoFullScanFiltersChange
          }
          onInspectionNoFullScanReset={onInspectionNoFullScanReset}
          violationsFines={safeViolationsFines}
          violationsFinesLoading={violationsFinesLoading}
          violationsFinesStatusCounts={violationsFinesStatusCounts}
          violationsFinesStatusOptions={violationsFinesStatusOptions}
          violationsFinesTypeId={violationsFinesTypeId}
          violationsFinesStatusId={violationsFinesStatusId}
          violationsFinesStartTime={violationsFinesStartTime}
          violationsFinesEndTime={violationsFinesEndTime}
          violationsFinesPaidTimeFrom={violationsFinesPaidTimeFrom}
          violationsFinesPaidTimeTo={violationsFinesPaidTimeTo}
          onViolationsFinesTypeIdChange={onViolationsFinesTypeIdChange}
          onViolationsFinesStatusIdChange={onViolationsFinesStatusIdChange}
          onViolationsFinesDateRangeChange={
            onViolationsFinesDateRangeChange
          }
          onViolationsFinesPaymentDateRangeChange={
            onViolationsFinesPaymentDateRangeChange
          }
          onViolationsFinesReset={onViolationsFinesReset}
          refunds={safeRefunds}
          appeals={safeAppeals}
          appealsLoading={appealsLoading}
          appealStatusCounts={appealStatusCounts}
          appealStatusId={appealStatusId}
          appealStartTime={appealStartTime}
          appealEndTime={appealEndTime}
          onAppealStatusIdChange={onAppealStatusIdChange}
          onAppealDateRangeChange={onAppealDateRangeChange}
          stats={statsForActiveTab}
          loading={
            activeTab === "applications"
              ? applicationsLoading
              : activeTab === "payments"
              ? paymentsLoading
              : activeTab === "licenses"
              ? licensesLoading
              : activeTab === "tickets"
              ? ticketsLoading
              : activeTab === "violations-fines"
              ? violationsFinesLoading
              : activeTab === "refunds"
              ? refundsLoading
              : activeTab === "appeal"
              ? appealsLoading
              : false
          }
          pagination={
            applicationsPagination || { pageSize: 10, showSizeChanger: true }
          }
          paymentsPagination={paymentsPagination}
          refundsPagination={refundsPagination}
          refundsCategory={refundsCategory}
          onRefundsCategoryChange={onRefundsCategoryChange}
          refundsStatusId={refundsStatusId}
          onRefundsStatusIdChange={onRefundsStatusIdChange}
          refundsStartTime={refundsStartTime}
          refundsEndTime={refundsEndTime}
          onRefundsDateRangeChange={onRefundsDateRangeChange}
          refundsSortDirection={refundsSortDirection}
          onRefundsReset={onRefundsReset}
          onRefundsTableChange={onRefundsTableChange}
          refundsStatusCount={refundsStatusCount}
          onTableChange={onApplicationsTableChange}
          onPaymentsTableChange={onPaymentsTableChange}
        />
      ) : null}
    </>
  );
};

export default CommercialProfileOverview;
