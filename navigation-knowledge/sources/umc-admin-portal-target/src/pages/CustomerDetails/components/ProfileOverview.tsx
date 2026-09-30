import React from "react";
import { Empty, Tabs } from "antd";
import { useTranslation } from "react-i18next";
import type { TablePaginationConfig } from "antd/es/table";
import type {
  SorterResult,
  TableCurrentDataSource,
} from "antd/es/table/interface";
import type {
  InfoItem,
  ProfileItem,
  OverviewRowItem,
  PaymentItem,
  PaymentCountStats,
  LicenseItem,
  TicketItem,
  RefundItem,
  AppealItem,
  DocumentItem,
  InspectionNoFullScanFilters,
  InspectionNoFullScanSelectOption,
  InspectionOverviewItem,
  InspectionOverviewStats,
  ViolationFineItem,
} from "../types";
import DetailSection from "./DetailSection";
import InfoGrid from "./InfoGrid";
import DocumentViewer from "@/components/common/DocumentViewer";
import AllProfilesOverview from "./AllProfilesOverview";
import type { NormalizedTicketsStatusCount } from "./allProfilesOverviewTabs/ticketUtils";
import type { AppealOverviewStats } from "./allProfilesOverviewTabs/appealProfileUtils";

const ProfileOverview: React.FC<{
  profile: ProfileItem;
  activeTab: string;
  onTabChange: (key: string) => void;
  personalInfo?: InfoItem[];
  addressInfo?: InfoItem[];
  documents?: DocumentItem[];
  overviewSearchKey: string;
  onOverviewSearchKeyChange: (value: string) => void;
  overviewTypeFilter?: string;
  overviewTypeFilterOptions?: { label: string; value: string }[];
  onOverviewTypeFilterChange: (value?: string) => void;
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
  applicationsRows: OverviewRowItem[];
  applicationsStats: { total: number; licenses: number; content: number };
  applicationsLoading?: boolean;
  applicationsPagination: TablePaginationConfig;
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
  titleContent?: React.ReactNode;
}> = ({
  profile,
  activeTab,
  onTabChange,
  personalInfo,
  addressInfo,
  documents,
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
  titleContent,
}) => {
  const { t } = useTranslation();

  const individualTypeLabel = t("Customer.profiles.chart.individual");
  const profileTypeRaw = (profile.profileType ?? "").trim();
  const isIndividualOverviewTitle =
    profileTypeRaw === "Individual" ||
    profileTypeRaw === individualTypeLabel ||
    profileTypeRaw.toLowerCase() === "individual";

  const tabsBase = "Customer.customerDetails.allProfilesOverview.tabs";
  const po = "Customer.customerDetails.profileOverview";

  return (
    <>
      <div className="section-title">
        <div>
          {isIndividualOverviewTitle
            ? t(`${po}.pageTitle.individual`)
            : t(`${po}.pageTitle.default`)}
        </div>
        {titleContent}
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        className="customer-details-tabs"
      >
        <Tabs.TabPane
          tab={t(`${po}.tabs.basicInformation`)}
          key="basic"
        >
          <div className="detail-sections">
            <DetailSection title={t(`${po}.sections.personalInformation`)}>
              {personalInfo?.length ? (
                <InfoGrid items={personalInfo} columns={2} />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(`${po}.empty.noPersonalInformation`)}
                />
              )}
            </DetailSection>

            <DetailSection title={t(`${po}.sections.addressInformation`)}>
              {addressInfo?.length ? (
                <InfoGrid items={addressInfo} columns={2} />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(`${po}.empty.noAddressInformation`)}
                />
              )}
            </DetailSection>

            <DetailSection title={t(`${po}.sections.personalDocuments`)}>
              {documents?.length ? (
                <div className="document-viewer-list">
                  {documents.map((doc) => (
                    <div style={{ flex: 1 }} key={doc.key}>
                      <DocumentViewer
                        hasDownload
                        uploadConfig={{
                          maxCount: 1,
                          maxSize: 5,
                          uploadTip: t(`${po}.documentUploadTip`),
                        }}
                        fileName={doc.url}
                        label={doc.label}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(`${po}.empty.noDocuments`)}
                />
              )}
            </DetailSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t(`${tabsBase}.applications`)} key="applications">
          <AllProfilesOverview
            hideTabs
            activeTab="applications"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            applicationsStatusOptions={applicationsStatusOptions}
            applicationsStatusId={applicationsStatusId}
            onApplicationsStatusIdChange={onApplicationsStatusIdChange}
            applicationsStartDate={applicationsStartDate}
            applicationsEndDate={applicationsEndDate}
            onApplicationsDateRangeChange={onApplicationsDateRangeChange}
            onApplicationsReset={onApplicationsReset}
            rows={applicationsRows}
            stats={applicationsStats}
            loading={applicationsLoading}
            pagination={applicationsPagination}
            onTableChange={onApplicationsTableChange}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t(`${tabsBase}.payments`)} key="payments">
          <AllProfilesOverview
            hideTabs
            activeTab="payments"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            rows={[]}
            stats={{ total: 0, licenses: 0, content: 0 }}
            loading={paymentsLoading}
            pagination={{ current: 1, pageSize: 10, total: 0 }}
            payments={payments}
            paymentsStats={paymentsStats}
            paymentsPagination={paymentsPagination}
            onPaymentsTableChange={onPaymentsTableChange}
            paymentsTransactionTypeOptions={paymentsTransactionTypeOptions}
            paymentsStatusOptions={paymentsStatusOptions}
            paymentsPaymentMethodOptions={paymentsPaymentMethodOptions}
            paymentsTransactionTypeId={paymentsTransactionTypeId}
            paymentsStatusId={paymentsStatusId}
            paymentsPaymentMethodId={paymentsPaymentMethodId}
            paymentsStartDate={paymentsStartDate}
            paymentsEndDate={paymentsEndDate}
            onPaymentsTransactionTypeIdChange={
              onPaymentsTransactionTypeIdChange
            }
            onPaymentsStatusIdChange={onPaymentsStatusIdChange}
            onPaymentsAdvancedFilterChange={onPaymentsAdvancedFilterChange}
            onPaymentsDateRangeChange={onPaymentsDateRangeChange}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t(`${tabsBase}.licenses`)} key="licenses">
          <AllProfilesOverview
            hideTabs
            activeTab="licenses"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            rows={[]}
            stats={{ total: 0, licenses: 0, content: 0 }}
            loading={licensesLoading}
            pagination={{ current: 1, pageSize: 10, total: 0 }}
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
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t(`${tabsBase}.enquiriesComplaints`)} key="tickets">
          <AllProfilesOverview
            hideTabs
            activeTab="tickets"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            rows={[]}
            stats={{ total: 0, licenses: 0, content: 0 }}
            loading={ticketsLoading}
            ticketsLoading={ticketsLoading}
            pagination={ticketsPagination || { current: 1, pageSize: 10, total: 0 }}
            tickets={tickets}
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
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t(`${tabsBase}.inspection`)} key="inspection">
          <AllProfilesOverview
            hideTabs
            activeTab="inspection"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            rows={[]}
            stats={{ total: 0, licenses: 0, content: 0 }}
            loading={false}
            pagination={{ current: 1, pageSize: 10, total: 0 }}
            tickets={tickets}
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
            inspectionNoFullScanReasonOptions={
              inspectionNoFullScanReasonOptions
            }
            inspectionNoFullScanStatusOptions={
              inspectionNoFullScanStatusOptions
            }
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
          />
        </Tabs.TabPane>

        <Tabs.TabPane
          tab={t(`${tabsBase}.violationsFines`)}
          key="violations-fines"
        >
          <AllProfilesOverview
            hideTabs
            activeTab="violations-fines"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            rows={[]}
            stats={{ total: 0, licenses: 0, content: 0 }}
            loading={violationsFinesLoading}
            pagination={{ current: 1, pageSize: 10, total: 0 }}
            violationsFines={violationsFines}
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
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t(`${tabsBase}.refunds`)} key="refunds">
          <AllProfilesOverview
            hideTabs
            activeTab="refunds"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            rows={[]}
            stats={{ total: 0, licenses: 0, content: 0 }}
            refunds={refunds}
            loading={refundsLoading}
            pagination={{ current: 1, pageSize: 10, total: 0 }}
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
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t(`${tabsBase}.appeal`)} key="appeal">
          <AllProfilesOverview
            hideTabs
            activeTab="appeal"
            onTabChange={onTabChange}
            searchKey={overviewSearchKey}
            onSearchKeyChange={onOverviewSearchKeyChange}
            typeFilter={overviewTypeFilter}
            onTypeFilterChange={onOverviewTypeFilterChange}
            typeFilterOptions={overviewTypeFilterOptions}
            rows={[]}
            stats={{ total: 0, licenses: 0, content: 0 }}
            loading={appealsLoading}
            pagination={{ current: 1, pageSize: 10, total: 0 }}
            appeals={appeals}
            appealsLoading={appealsLoading}
            appealStatusCounts={appealStatusCounts}
            appealStatusId={appealStatusId}
            appealStartTime={appealStartTime}
            appealEndTime={appealEndTime}
            onAppealStatusIdChange={onAppealStatusIdChange}
            onAppealDateRangeChange={onAppealDateRangeChange}
          />
        </Tabs.TabPane>
      </Tabs>
    </>
  );
};

export default ProfileOverview;
