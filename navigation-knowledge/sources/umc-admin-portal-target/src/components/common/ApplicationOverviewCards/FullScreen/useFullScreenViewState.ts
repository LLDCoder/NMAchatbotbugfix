import { useCallback, useEffect, useState } from "react"
import type { InspectionNoFullScanFilters } from "@/pages/CustomerDetails/types"

const createSortablePaginationState = () => ({
  pageIndex: 1,
  pageSize: 10,
  total: 0,
  sortBy: undefined as string | undefined,
  sortDirection: undefined as number | undefined,
})

const createApplicationsPaginationState = () => ({
  ...createSortablePaginationState(),
  sortBy: "lastUpdatedTime" as const,
  sortDirection: 1 as 0 | 1,
})

const createLicensesPaginationState = () => ({
  ...createSortablePaginationState(),
  sortBy: "issuanceTime" as string | undefined,
  sortDirection: 1 as number | undefined,
})

const createTicketsPaginationState = () => ({
  ...createSortablePaginationState(),
  sortBy: "updatedOn" as string | undefined,
  sortDirection: 1 as number | undefined,
})

const createRefundsPaginationState = () => ({
  ...createSortablePaginationState(),
  sortBy: "UpdateOn" as string | undefined,
  sortDirection: 1 as number | undefined,
})

const createInspectionPaginationState = () => ({
  ...createSortablePaginationState(),
  sortBy: "AssignedOn" as string | undefined,
  sortDirection: 1 as number | undefined,
})

const createInspectionNoFullScanFiltersState = (): InspectionNoFullScanFilters => ({})

export const useFullScreenViewState = (initialTab?: string) => {
  const [searchKey, setSearchKey] = useState("")
  const [activeTab, setActiveTab] = useState(initialTab || "basic-information")
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [applicationsStatusId, setApplicationsStatusId] = useState<
    string | undefined
  >(undefined)
  const [applicationsStartDate, setApplicationsStartDate] = useState<
    string | undefined
  >(undefined)
  const [applicationsEndDate, setApplicationsEndDate] = useState<
    string | undefined
  >(undefined)
  const [paymentsTransactionTypeId, setPaymentsTransactionTypeId] = useState<
    string | undefined
  >(undefined)
  const [paymentsStatusId, setPaymentsStatusId] = useState<string | undefined>(
    undefined,
  )
  const [paymentsPaymentMethodId, setPaymentsPaymentMethodId] = useState<
    string | undefined
  >(undefined)
  const [paymentsStartDate, setPaymentsStartDate] = useState<
    string | undefined
  >(undefined)
  const [paymentsEndDate, setPaymentsEndDate] = useState<string | undefined>(
    undefined,
  )
  const [licensesStatus, setLicensesStatus] = useState<string | undefined>(
    undefined,
  )
  const [licensesIssuanceDateStart, setLicensesIssuanceDateStart] =
    useState<string | undefined>(undefined)
  const [licensesIssuanceDateEnd, setLicensesIssuanceDateEnd] = useState<
    string | undefined
  >(undefined)
  const [ticketsEnquiryStatusId, setTicketsEnquiryStatusId] = useState<
    string | undefined
  >(undefined)
  const [ticketsEnquiryType, setTicketsEnquiryType] = useState<
    string | undefined
  >(undefined)
  const [ticketsPriorityId, setTicketsPriorityId] = useState<
    string | undefined
  >(undefined)
  const [ticketsStartTime, setTicketsStartTime] = useState<string | undefined>(
    undefined,
  )
  const [ticketsEndTime, setTicketsEndTime] = useState<string | undefined>(
    undefined,
  )
  const [refundsStatusId, setRefundsStatusId] = useState<string | undefined>(
    undefined,
  )
  const [refundsCategory, setRefundsCategory] = useState<string | undefined>(
    undefined,
  )
  const [refundsStartTime, setRefundsStartTime] = useState<string | undefined>(
    undefined,
  )
  const [refundsEndTime, setRefundsEndTime] = useState<string | undefined>(
    undefined,
  )
  const [violationsFinesTypeId, setViolationsFinesTypeId] = useState<
    string | undefined
  >(undefined)
  const [violationsFinesStatusId, setViolationsFinesStatusId] = useState<
    string | undefined
  >(undefined)
  const [violationsFinesStartTime, setViolationsFinesStartTime] = useState<
    string | undefined
  >(undefined)
  const [violationsFinesEndTime, setViolationsFinesEndTime] = useState<
    string | undefined
  >(undefined)
  const [violationsFinesPaidTimeFrom, setViolationsFinesPaidTimeFrom] =
    useState<string | undefined>(undefined)
  const [violationsFinesPaidTimeTo, setViolationsFinesPaidTimeTo] = useState<
    string | undefined
  >(undefined)
  const [appealStatusId, setAppealStatusId] = useState<string | undefined>(
    undefined,
  )
  const [appealStartTime, setAppealStartTime] = useState<string | undefined>(
    undefined,
  )
  const [appealEndTime, setAppealEndTime] = useState<string | undefined>(
    undefined,
  )
  const [applicationsPaginationState, setApplicationsPaginationState] =
    useState(createApplicationsPaginationState)
  const [paymentsPaginationState, setPaymentsPaginationState] =
    useState(createSortablePaginationState)
  const [licensesPaginationState, setLicensesPaginationState] =
    useState(createLicensesPaginationState)
  const [ticketsPaginationState, setTicketsPaginationState] =
    useState(createTicketsPaginationState)
  const [refundsPaginationState, setRefundsPaginationState] =
    useState(createRefundsPaginationState)
  const [inspectionPaginationState, setInspectionPaginationState] =
    useState(createInspectionPaginationState)
  const [inspectionNoFullScanFilters, setInspectionNoFullScanFilters] =
    useState<InspectionNoFullScanFilters>(createInspectionNoFullScanFiltersState)

  useEffect(() => {
    setSearchKey("")
    setActiveTab(initialTab || "basic-information")
    setTypeFilter(undefined)
    setApplicationsStatusId(undefined)
    setApplicationsStartDate(undefined)
    setApplicationsEndDate(undefined)
    setPaymentsTransactionTypeId(undefined)
    setPaymentsStatusId(undefined)
    setPaymentsPaymentMethodId(undefined)
    setPaymentsStartDate(undefined)
    setPaymentsEndDate(undefined)
    setLicensesStatus(undefined)
    setLicensesIssuanceDateStart(undefined)
    setLicensesIssuanceDateEnd(undefined)
    setTicketsEnquiryStatusId(undefined)
    setTicketsEnquiryType(undefined)
    setTicketsPriorityId(undefined)
    setTicketsStartTime(undefined)
    setTicketsEndTime(undefined)
    setRefundsStatusId(undefined)
    setRefundsCategory(undefined)
    setRefundsStartTime(undefined)
    setRefundsEndTime(undefined)
    setViolationsFinesTypeId(undefined)
    setViolationsFinesStatusId(undefined)
    setViolationsFinesStartTime(undefined)
    setViolationsFinesEndTime(undefined)
    setViolationsFinesPaidTimeFrom(undefined)
    setViolationsFinesPaidTimeTo(undefined)
    setAppealStatusId(undefined)
    setAppealStartTime(undefined)
    setAppealEndTime(undefined)
    setApplicationsPaginationState(createApplicationsPaginationState())
    setPaymentsPaginationState(createSortablePaginationState())
    setLicensesPaginationState(createLicensesPaginationState())
    setTicketsPaginationState(createTicketsPaginationState())
    setRefundsPaginationState(createRefundsPaginationState())
    setInspectionPaginationState(createInspectionPaginationState())
    setInspectionNoFullScanFilters(createInspectionNoFullScanFiltersState())
  }, [initialTab])

  const switchOverviewTab = useCallback((key: string) => {
    setActiveTab(key)
    setSearchKey("")

    if (key === "applications") {
      setApplicationsPaginationState((prev) => ({
        ...prev,
        pageIndex: 1,
      }))
      setTypeFilter(undefined)
      setApplicationsStatusId(undefined)
      setApplicationsStartDate(undefined)
      setApplicationsEndDate(undefined)
      return
    }

    if (key === "payments") {
      setPaymentsPaginationState((prev) => ({
        ...prev,
        pageIndex: 1,
      }))
      setPaymentsTransactionTypeId(undefined)
      setPaymentsStatusId(undefined)
      setPaymentsPaymentMethodId(undefined)
      setPaymentsStartDate(undefined)
      setPaymentsEndDate(undefined)
      return
    }

    if (key === "licenses") {
      setLicensesPaginationState((prev) => ({
        ...prev,
        pageIndex: 1,
      }))
      setLicensesStatus(undefined)
      setLicensesIssuanceDateStart(undefined)
      setLicensesIssuanceDateEnd(undefined)
      return
    }

    if (key === "tickets") {
      setTicketsPaginationState((prev) => ({
        ...prev,
        pageIndex: 1,
      }))
      setTicketsEnquiryStatusId(undefined)
      setTicketsEnquiryType(undefined)
      setTicketsPriorityId(undefined)
      setTicketsStartTime(undefined)
      setTicketsEndTime(undefined)
      return
    }

    if (key === "violations-fines") {
      setViolationsFinesTypeId(undefined)
      setViolationsFinesStatusId(undefined)
      setViolationsFinesStartTime(undefined)
      setViolationsFinesEndTime(undefined)
      setViolationsFinesPaidTimeFrom(undefined)
      setViolationsFinesPaidTimeTo(undefined)
      return
    }

    if (key === "refunds") {
      setRefundsPaginationState(createRefundsPaginationState())
      setRefundsStatusId(undefined)
      setRefundsCategory(undefined)
      setRefundsStartTime(undefined)
      setRefundsEndTime(undefined)
      return
    }

    if (key === "appeal") {
      setAppealStatusId(undefined)
      setAppealStartTime(undefined)
      setAppealEndTime(undefined)
      return
    }

    if (key === "inspection") {
      setInspectionPaginationState(createInspectionPaginationState())
      setInspectionNoFullScanFilters(createInspectionNoFullScanFiltersState())
    }
  }, [])

  const handleTabChange = useCallback(
    (key: string) => {
      switchOverviewTab(key)
    },
    [switchOverviewTab],
  )

  return {
    searchKey,
    setSearchKey,
    activeTab,
    setActiveTab,
    typeFilter,
    setTypeFilter,
    applicationsStatusId,
    setApplicationsStatusId,
    applicationsStartDate,
    setApplicationsStartDate,
    applicationsEndDate,
    setApplicationsEndDate,
    paymentsTransactionTypeId,
    setPaymentsTransactionTypeId,
    paymentsStatusId,
    setPaymentsStatusId,
    paymentsPaymentMethodId,
    setPaymentsPaymentMethodId,
    paymentsStartDate,
    setPaymentsStartDate,
    paymentsEndDate,
    setPaymentsEndDate,
    licensesStatus,
    setLicensesStatus,
    licensesIssuanceDateStart,
    setLicensesIssuanceDateStart,
    licensesIssuanceDateEnd,
    setLicensesIssuanceDateEnd,
    ticketsEnquiryStatusId,
    setTicketsEnquiryStatusId,
    ticketsEnquiryType,
    setTicketsEnquiryType,
    ticketsPriorityId,
    setTicketsPriorityId,
    ticketsStartTime,
    setTicketsStartTime,
    ticketsEndTime,
    setTicketsEndTime,
    refundsStatusId,
    setRefundsStatusId,
    refundsCategory,
    setRefundsCategory,
    refundsStartTime,
    setRefundsStartTime,
    refundsEndTime,
    setRefundsEndTime,
    violationsFinesTypeId,
    setViolationsFinesTypeId,
    violationsFinesStatusId,
    setViolationsFinesStatusId,
    violationsFinesStartTime,
    setViolationsFinesStartTime,
    violationsFinesEndTime,
    setViolationsFinesEndTime,
    violationsFinesPaidTimeFrom,
    setViolationsFinesPaidTimeFrom,
    violationsFinesPaidTimeTo,
    setViolationsFinesPaidTimeTo,
    appealStatusId,
    setAppealStatusId,
    appealStartTime,
    setAppealStartTime,
    appealEndTime,
    setAppealEndTime,
    applicationsPaginationState,
    setApplicationsPaginationState,
    paymentsPaginationState,
    setPaymentsPaginationState,
    licensesPaginationState,
    setLicensesPaginationState,
    ticketsPaginationState,
    setTicketsPaginationState,
    refundsPaginationState,
    setRefundsPaginationState,
    inspectionPaginationState,
    setInspectionPaginationState,
    inspectionNoFullScanFilters,
    setInspectionNoFullScanFilters,
    switchOverviewTab,
    handleTabChange,
  }
}
