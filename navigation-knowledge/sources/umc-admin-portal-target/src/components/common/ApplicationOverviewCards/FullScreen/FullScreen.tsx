import React, { useState, useMemo, useCallback, useEffect, useRef } from "react"
import type { TablePaginationConfig } from "antd/es/table"
import type {
  SorterResult,
} from "antd/es/table/interface"
import {
  getEstablishment,
  getUserIndividual,
  type IEstablishmentOverview,
} from "@/services/userProfile"
import type { IUserIndividualProfile } from "@/services/userProfile"
import type { SelfMonitorProgramInfo } from "@/components/common/SelfMonitorBadge"
import AllProfilesOverview from "@/pages/CustomerDetails/components/AllProfilesOverview"
import type {
  OverviewRowItem,
  PaymentItem,
  LicenseItem,
  TicketItem,
  RefundItem,
  ViolationFineItem,
  InspectionOverviewItem,
} from "@/pages/CustomerDetails/types"
import { useAllProfilesOverviewData } from "./useAllProfilesOverviewData"
import { useApplicationOverviewData } from "../ApplicationOverviewDataContext"
import type { ApplicationOverviewProfileData } from "../types"
import type { OverviewQuickNavTarget } from "../overviewQuickNav"
import "@/pages/CustomerDetails/index.less"
import "./applicationOverviewFullscreen.less"
import { useTranslation } from "react-i18next"
import { useFullScreenViewState } from "./useFullScreenViewState"
import { useFullScreenFilterOptions } from "./useFullScreenFilterOptions"
import FullScreenHeader from "./FullScreenHeader"
import FullScreenBasicInformation from "./FullScreenBasicInformation"
import FullScreenTabs from "./FullScreenTabs"

interface FullScreenProps {
  type: "Individual" | "Commercial"
  applicant?: IUserIndividualProfile
  establishment?: IEstablishmentOverview
  userId?: string | number
  userProfileId?: string | number
  profileId?: string | number
  targetEstablishmentId?: string | number
  targetIndividualId?: string | number
  targetTaskId?: string | number
  onClose: () => void
  quickNav?: OverviewQuickNavTarget
  initialTab?: string
  scrollToDocuments?: boolean
  scrollToPartners?: boolean
  profileAndApplicantData?: ApplicationOverviewProfileData
  violationsFines?: ViolationFineItem[]
  visualVariant?: "figmaOverview"
  preserveApplicantIdentity?: boolean
}

const getSorterField = <T,>(
  sorter: SorterResult<T> | SorterResult<T>[]
) => (Array.isArray(sorter) ? undefined : sorter.field?.toString())

const getSortDirection = <T,>(
  sorter: SorterResult<T> | SorterResult<T>[]
) => {
  if (Array.isArray(sorter) || !sorter.order) return undefined
  return sorter.order === "ascend" ? 0 : 1
}

const getRefundsSortState = (
  sorter: SorterResult<RefundItem> | SorterResult<RefundItem>[]
) => {
  const field = getSorterField(sorter)
  const sortDirection = getSortDirection(sorter)
  const hasSorter =
    (field === "lastUpdated" || field === "requestDate") &&
    sortDirection !== undefined
  return {
    hasSorter,
    sortBy: "UpdateOn",
    sortDirection: sortDirection ?? 1,
  }
}

const getInspectionSortState = (
  sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
) => {
  const field = getSorterField(sorter)
  const sortBy =
    field === "dueDate"
      ? "DueDate"
      : field === "priority"
        ? "Priority"
        : undefined
  return {
    hasSorter: Boolean(field),
    sortBy,
    sortDirection: getSortDirection(sorter),
  }
}

const getInspectionProfileSortState = (
  sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
) => {
  const field = getSorterField(sorter)
  const sortDirection = getSortDirection(sorter)

  return {
    sortBy: "AssignedOn" as const,
    sortDirection: sortDirection === 0 ? 0 : 1,
    hasAssignedTimeSorter: field === "assignedTime" && sortDirection !== undefined,
  }
}

const toObjectRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined

const getLocalizedStatusText = (
  value: unknown,
  isArabic: boolean,
): string | undefined => {
  const record = toObjectRecord(value)

  if (!record) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }

    return undefined
  }

  const candidates = isArabic
    ? [record.nameAr, record.nameEn, record.name]
    : [record.nameEn, record.nameAr, record.name]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim()
    }
  }

  return undefined
}

const FullScreen: React.FC<FullScreenProps> = ({
  type,
  applicant,
  establishment,
  userId: propUserId,
  userProfileId: propUserProfileId,
  profileId: propProfileId,
  targetEstablishmentId,
  targetIndividualId,
  targetTaskId,
  onClose,
  quickNav,
  initialTab,
  scrollToDocuments,
  scrollToPartners,
  profileAndApplicantData,
  violationsFines: providedViolationsFines,
  visualVariant,
  preserveApplicantIdentity = false,
}) => {
  const {
    profileAndApplicantData: sharedProfileAndApplicantData,
    userProfileId: sharedUserProfileId,
  } = useApplicationOverviewData()
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const isFigmaOverview = visualVariant === "figmaOverview"
  const hasTargetOverviewIdentity = Boolean(
    targetEstablishmentId || targetIndividualId,
  )
  const resolvedProfileAndApplicantData =
    profileAndApplicantData ?? sharedProfileAndApplicantData
  const resolvedQuickNav = useMemo<OverviewQuickNavTarget>(
    () => ({
      initialTab:
        quickNav?.initialTab ?? initialTab ?? "basic-information",
      scrollToDocuments:
        quickNav?.scrollToDocuments ?? Boolean(scrollToDocuments),
      scrollToPartners:
        quickNav?.scrollToPartners ?? Boolean(scrollToPartners),
    }),
    [initialTab, quickNav, scrollToDocuments, scrollToPartners],
  )
  const {
    searchKey,
    setSearchKey,
    activeTab,
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
  } = useFullScreenViewState(resolvedQuickNav.initialTab)
  const documentsSectionRef = useRef<HTMLDivElement>(null)
  const partnersSectionRef = useRef<HTMLDivElement>(null)
  const [applicantData, setApplicantData] = useState(applicant)
  const [establishmentData, setEstablishmentData] = useState(establishment)
  const {
    typeFilterOptions,
    applicationsStatusOptions,
    paymentsTransactionTypeOptions,
    paymentsStatusOptions,
    paymentsPaymentMethodOptions,
    inspectionNoFullScanReasonOptions,
    inspectionNoFullScanStatusOptions,
    inspectionNoFullScanPriorityOptions,
    inspectionNoFullScanInspectorOptions,
  } = useFullScreenFilterOptions({ isArabic, t })

  const toPositiveNumber = useCallback((value: unknown) => {
    if (value === undefined || value === null || value === "") return undefined
    const numericValue = Number(value)
    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : undefined
  }, [])

  const sourceApplicantUserId = useMemo(() => {
    const raw = propUserId ?? applicant?.userId
    if (raw === undefined || raw === null || raw === "") return undefined
    return String(raw)
  }, [propUserId, applicant?.userId])

  // Get userId and profileId from props or extract from applicant/establishment
  const userId = useMemo(() => {
    const raw = propUserId ?? applicantData?.userId ?? applicant?.userId
    if (raw === undefined || raw === null || raw === "") return undefined
    return String(raw)
  }, [applicant?.userId, applicantData?.userId, propUserId])

  const profileId = useMemo(() => {
    // IMPORTANT:
    // - For Commercial overview, list APIs must use the establishment profileId (e.g. 4047),
    //   not the applicant's individual profileId (which can be different, e.g. 4114).
    // - For Individual overview, use the applicant's profileId.
    const raw =
      propProfileId ??
      propUserProfileId ??
      sharedUserProfileId ??
      (type === "Commercial"
        ? establishmentData?.userProfileId ??
          establishmentData?.id ??
          applicantData?.proFileId
        : applicantData?.proFileId ??
          establishmentData?.userProfileId ??
          establishmentData?.id)
    if (raw === undefined || raw === null || raw === "") return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }, [
    applicantData?.proFileId,
    establishmentData?.id,
    establishmentData?.userProfileId,
    propProfileId,
    propUserProfileId,
    sharedUserProfileId,
    type,
  ])

  const commercialUserProfileId = useMemo(
    () =>
      toPositiveNumber(
        // Priority: explicit props first, then the reliable context profileId
        // (from ApplicationOverviewDataProvider), then whatever the loaded
        // establishment payloads expose. The raw `establishment` prop is empty
        // on first open, so it must not be the first choice.
        propProfileId ??
          propUserProfileId ??
          sharedUserProfileId ??
          establishmentData?.userProfileId ??
          establishment?.userProfileId ??
          establishmentData?.id ??
          establishment?.id,
      ),
    [
      establishment?.id,
      establishment?.userProfileId,
      establishmentData?.id,
      establishmentData?.userProfileId,
      propProfileId,
      propUserProfileId,
      sharedUserProfileId,
      toPositiveNumber,
    ],
  )

  useEffect(() => {
    setApplicantData(applicant)
  }, [applicant])

  useEffect(() => {
    // Only sync meaningful establishment data from props. An empty/undefined
    // prop (parent async not finished yet) must not clobber data that the
    // fullscreen self-fetch may have already resolved.
    if (establishment && Object.keys(establishment).length > 0) {
      setEstablishmentData(establishment)
    }
  }, [establishment])

  useEffect(() => {
    let cancelled = false

    if (type !== "Individual") {
      return () => {
        cancelled = true
      }
    }

    if (!sourceApplicantUserId) {
      setApplicantData(applicant)
      return () => {
        cancelled = true
      }
    }

    const loadApplicantData = async () => {
      try {
        const response = await getUserIndividual(sourceApplicantUserId)
        if (cancelled) return

        const nextApplicantData = response?.data
        if (nextApplicantData && Object.keys(nextApplicantData).length > 0) {
          setApplicantData(
            preserveApplicantIdentity
              ? {
                  ...nextApplicantData,
                  type: applicant?.type ?? nextApplicantData.type,
                  emiratesId: applicant?.emiratesId ?? "",
                  passportNumber: applicant?.passportNumber ?? "",
                  uid: applicant?.uid ?? "",
                }
              : nextApplicantData,
          )
          return
        }

        setApplicantData(applicant)
      } catch (error) {
        console.error("Failed to load individual overview", error)
        if (cancelled) return
        setApplicantData(applicant)
      }
    }

    void loadApplicantData()

    return () => {
      cancelled = true
    }
  }, [applicant, preserveApplicantIdentity, sourceApplicantUserId, type])

  useEffect(() => {
    let cancelled = false

    if (type !== "Commercial") {
      return () => {
        cancelled = true
      }
    }
    
    if (!commercialUserProfileId) {
      setEstablishmentData(establishment)
      return () => {
        cancelled = true
      }
    }

    const loadEstablishmentData = async () => {
    try {
      const response = await getEstablishment(commercialUserProfileId)
      if (cancelled) return
      // An empty payload ({}) is truthy but carries no data; keep the
      // existing establishment (from props or a previous fetch) instead of
      // clobbering it, which is the first-open "no data" race.
      const nextData = response?.data
      if (nextData && Object.keys(nextData).length > 0) {
      setEstablishmentData(nextData)
      return
      }
      setEstablishmentData((prev) => prev || establishment)
    } catch (error) {
      console.error("Failed to load establishment overview", error)
      if (cancelled) return
      setEstablishmentData((prev) => prev || establishment)
    }
    }

    void loadEstablishmentData()

    return () => {
      cancelled = true
    }
  }, [commercialUserProfileId, establishment, type])
  // Use custom hook to fetch all tabs data
  const {
    applications,
    applicationsLoading,
    applicationsStats,
    applicationsPagination,
    onApplicationsTableChange,
    payments,
    paymentsLoading,
    paymentsStats,
    paymentsPagination,
    onPaymentsTableChange,
    licenses,
    licensesLoading,
    licensesStats,
    licensesPagination,
    onLicensesTableChange,
    tickets,
    ticketsLoading,
    ticketsStatusCount,
    ticketsPagination,
    onTicketsTableChange,
    refunds,
    refundsLoading,
    refundsStatusCount,
    refundsErrorMessage,
    refundsPagination,
    onRefundsTableChange,
    inspectionTasks,
    inspectionTasksNoFullScan,
    inspectionStats,
    inspectionLoading,
    inspectionNoFullScanLoading,
    inspectionPagination,
    inspectionNoFullScanPagination,
    onInspectionTableChange,
    violationsFines,
    violationsFinesLoading,
    violationsFinesStatusCounts,
    violationsFinesStatusOptions,
    appeals,
    appealsLoading,
    appealStatusCounts,
  } = useAllProfilesOverviewData({
    userId,
    profileId,
    targetEstablishmentId,
    targetIndividualId,
    targetTaskId,
    visualVariant: isFigmaOverview ? "figmaOverview" : undefined,
    fallbackViolationsFines: providedViolationsFines,
    activeTab,
    searchKey,
    typeFilter,
    applicationsStatusId,
    applicationsPaginationState,
    applicationsStartDate,
    applicationsEndDate,
    paymentsPaginationState,
    paymentsTransactionTypeId,
    paymentsStatusId,
    paymentsPaymentMethodId,
    paymentsStartDate,
    paymentsEndDate,
    licensesPaginationState,
    licensesStatus,
    licensesIssuanceDateStart,
    licensesIssuanceDateEnd,
    ticketsPaginationState,
    ticketsEnquiryStatusId,
    ticketsEnquiryType,
    ticketsPriorityId,
    ticketsStartTime,
    ticketsEndTime,
    violationsFinesTypeId,
    violationsFinesStatusId,
    violationsFinesStartTime,
    violationsFinesEndTime,
    violationsFinesPaidTimeFrom,
    violationsFinesPaidTimeTo,
    refundsPaginationState,
    refundsStatusId,
    refundsCategory,
    refundsStartTime,
    refundsEndTime,
    inspectionPaginationState,
    inspectionNoFullScanFilters,
    appealStatusId,
    appealStartTime,
    appealEndTime,
  })

  useEffect(() => {
    if (
      resolvedQuickNav.scrollToDocuments &&
      activeTab === "basic-information"
    ) {
      documentsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [activeTab, resolvedQuickNav.scrollToDocuments])

  useEffect(() => {
    if (
      resolvedQuickNav.scrollToPartners &&
      activeTab === "basic-information"
    ) {
      partnersSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [activeTab, resolvedQuickNav.scrollToPartners])

  const currentTabLoading = useMemo(() => {
    if (activeTab === "applications") return applicationsLoading
    if (activeTab === "payments") return paymentsLoading
    if (activeTab === "licenses") return licensesLoading
    if (activeTab === "tickets") return ticketsLoading
    if (activeTab === "violations-fines") return violationsFinesLoading
    if (activeTab === "refunds") return refundsLoading
    if (activeTab === "inspection") {
      return isFigmaOverview && hasTargetOverviewIdentity
        ? inspectionLoading
        : inspectionNoFullScanLoading
    }
    if (activeTab === "appeal") return appealsLoading
    return false
  }, [
    activeTab,
    applicationsLoading,
    paymentsLoading,
    licensesLoading,
    ticketsLoading,
    violationsFinesLoading,
    refundsLoading,
    inspectionLoading,
    inspectionNoFullScanLoading,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    appealsLoading,
  ])

  const loading = currentTabLoading

  const resetActiveTabPagination = useCallback(() => {
    if (activeTab === "applications") {
      setApplicationsPaginationState((prev) => ({ ...prev, pageIndex: 1 }))
      return
    }

    if (activeTab === "payments") {
      setPaymentsPaginationState((prev) => ({ ...prev, pageIndex: 1 }))
      return
    }

    if (activeTab === "licenses") {
      setLicensesPaginationState((prev) => ({ ...prev, pageIndex: 1 }))
      return
    }

    if (activeTab === "tickets") {
      setTicketsPaginationState((prev) => ({ ...prev, pageIndex: 1 }))
      return
    }

    if (activeTab === "refunds") {
      setRefundsPaginationState((prev) => ({ ...prev, pageIndex: 1 }))
      return
    }

    if (activeTab === "inspection") {
      setInspectionPaginationState((prev) => ({ ...prev, pageIndex: 1 }))
    }
  }, [
    activeTab,
    setApplicationsPaginationState,
    setInspectionPaginationState,
    setLicensesPaginationState,
    setPaymentsPaginationState,
    setRefundsPaginationState,
    setTicketsPaginationState,
  ])

  const handleSearchKeyChange = useCallback(
    (value: string) => {
      setSearchKey(value)
      resetActiveTabPagination()
    },
    [resetActiveTabPagination, setSearchKey],
  )

  const allProfilesOverviewPropsBase = useMemo(
    () => ({
      hideTabs: true,
      activeTab,
      onTabChange: (key: string) => {
        switchOverviewTab(key)
      },
      searchKey,
      onSearchKeyChange: handleSearchKeyChange,
      typeFilter,
      onTypeFilterChange: (value?: string) => {
        setTypeFilter(value)
        setApplicationsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      typeFilterOptions,
      applicationsStatusOptions,
      applicationsStatusId,
      onApplicationsStatusIdChange: (value?: string) => {
        setApplicationsStatusId(value)
        setApplicationsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      applicationsStartDate,
      applicationsEndDate,
      onApplicationsDateRangeChange: (range: {
        startDate?: string
        endDate?: string
      }) => {
        setApplicationsStartDate(range.startDate)
        setApplicationsEndDate(range.endDate)
        setApplicationsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      onApplicationsReset: () => {
        setSearchKey("")
        setTypeFilter(undefined)
        setApplicationsStatusId(undefined)
        setApplicationsStartDate(undefined)
        setApplicationsEndDate(undefined)
        setApplicationsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
          sortBy: "lastUpdatedTime",
          sortDirection: 1,
        }))
      },
      rows: applications,
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
      onPaymentsTransactionTypeIdChange: (value?: string) => {
        setPaymentsTransactionTypeId(value)
        setPaymentsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      onPaymentsStatusIdChange: (value?: string) => {
        setPaymentsStatusId(value)
        setPaymentsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      onPaymentsAdvancedFilterChange: (range: {
        paymentMethodId?: string
        startDate?: string
        endDate?: string
      }) => {
        setPaymentsPaymentMethodId(range.paymentMethodId)
        setPaymentsStartDate(range.startDate)
        setPaymentsEndDate(range.endDate)
        setPaymentsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      paymentsPagination,
      onPaymentsTableChange: (
        pagination: TablePaginationConfig,
        sorter: SorterResult<PaymentItem> | SorterResult<PaymentItem>[]
      ) => {
        const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter
        const order = currentSorter?.order as
          | "ascend"
          | "descend"
          | undefined
        const field =
          currentSorter?.field?.toString() ??
          currentSorter?.columnKey?.toString()

        onPaymentsTableChange(pagination, sorter)
        setPaymentsPaginationState((prev) => ({
          ...prev,
          pageIndex: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
          sortBy: order ? field || "transactionTime" : "transactionTime",
          sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
        }))
      },
      licenses,
      licensesStats: licensesStats || undefined,
      licensesStatus,
      licensesIssuanceDateStart,
      licensesIssuanceDateEnd,
      onLicensesStatusChange: (value?: string) => {
        setLicensesStatus(value)
        setLicensesPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      onLicensesIssuanceDateRangeChange: (range: {
        issuanceDateStart?: string
        issuanceDateEnd?: string
      }) => {
        setLicensesIssuanceDateStart(range.issuanceDateStart)
        setLicensesIssuanceDateEnd(range.issuanceDateEnd)
        setLicensesPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      licensesPagination,
      onLicensesTableChange: (
        pagination: TablePaginationConfig,
        sorter: SorterResult<LicenseItem> | SorterResult<LicenseItem>[]
      ) => {
        const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter
        const order = currentSorter?.order as
          | "ascend"
          | "descend"
          | undefined
        const field =
          currentSorter?.field?.toString() ??
          currentSorter?.columnKey?.toString()

        onLicensesTableChange(pagination, sorter)
        setLicensesPaginationState((prev) => ({
          ...prev,
          pageIndex: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
          sortBy: order ? field || "issuanceTime" : "issuanceTime",
          sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
        }))
      },
      tickets,
      ticketsStatusCount,
      ticketsEnquiryStatusId,
      onTicketsEnquiryStatusIdChange: (value?: string) => {
        setTicketsEnquiryStatusId(value)
        setTicketsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      ticketsEnquiryType,
      ticketsPriorityId,
      onTicketsAdvancedFilterChange: (filters: {
        enquiryType?: string
        priorityId?: string
      }) => {
        setTicketsEnquiryType(filters.enquiryType)
        setTicketsPriorityId(filters.priorityId)
        setTicketsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      onTicketsReset: () => {
        setTicketsEnquiryStatusId(undefined)
        setTicketsEnquiryType(undefined)
        setTicketsPriorityId(undefined)
        setTicketsStartTime(undefined)
        setTicketsEndTime(undefined)
        setTicketsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
          sortBy: "updatedOn",
          sortDirection: 1,
        }))
      },
      ticketsStartTime,
      ticketsEndTime,
      onTicketsDateRangeChange: (range: {
        startTime?: string
        endTime?: string
      }) => {
        setTicketsStartTime(range.startTime)
        setTicketsEndTime(range.endTime)
        setTicketsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      ticketsPagination,
      onTicketsTableChange: (
        pagination: TablePaginationConfig,
        sorter: SorterResult<TicketItem> | SorterResult<TicketItem>[]
      ) => {
        const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter
        const order = currentSorter?.order as
          | "ascend"
          | "descend"
          | undefined

        onTicketsTableChange(pagination, sorter)
        setTicketsPaginationState((prev) => ({
          ...prev,
          pageIndex: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
          sortBy: "updatedOn",
          sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
        }))
      },
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
      onViolationsFinesTypeIdChange: (value?: string) => {
        setViolationsFinesTypeId(value)
      },
      onViolationsFinesStatusIdChange: (value?: string) => {
        setViolationsFinesStatusId(value)
      },
      onViolationsFinesDateRangeChange: (range: {
        startTime?: string
        endTime?: string
      }) => {
        setViolationsFinesStartTime(range.startTime)
        setViolationsFinesEndTime(range.endTime)
      },
      onViolationsFinesPaymentDateRangeChange: (range: {
        paidTimeFrom?: string
        paidTimeTo?: string
      }) => {
        setViolationsFinesPaidTimeFrom(range.paidTimeFrom)
        setViolationsFinesPaidTimeTo(range.paidTimeTo)
      },
      onViolationsFinesReset: () => {
        setSearchKey("")
        setViolationsFinesTypeId(undefined)
        setViolationsFinesStatusId(undefined)
        setViolationsFinesStartTime(undefined)
        setViolationsFinesEndTime(undefined)
        setViolationsFinesPaidTimeFrom(undefined)
        setViolationsFinesPaidTimeTo(undefined)
      },
      refunds,
      refundsStatusCount,
      refundsErrorMessage,
      refundsStatusId,
      refundsCategory,
      onRefundsCategoryChange: (value?: string) => {
        setRefundsCategory(value)
        setRefundsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      onRefundsStatusIdChange: (value?: string) => {
        setRefundsStatusId(value)
        setRefundsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      refundsStartTime,
      refundsEndTime,
      onRefundsDateRangeChange: (range: {
        startTime?: string
        endTime?: string
      }) => {
        setRefundsStartTime(range.startTime)
        setRefundsEndTime(range.endTime)
        setRefundsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      refundsPagination,
      refundsSortDirection:
        (refundsPaginationState.sortDirection === 0 ? 0 : 1) as 0 | 1,
      onRefundsReset: () => {
        setSearchKey("")
        setRefundsCategory(undefined)
        setRefundsStatusId(undefined)
        setRefundsStartTime(undefined)
        setRefundsEndTime(undefined)
        setRefundsPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
          sortBy: "UpdateOn",
          sortDirection: 1,
        }))
      },
      onRefundsTableChange: (
        pagination: TablePaginationConfig,
        sorter: SorterResult<RefundItem> | SorterResult<RefundItem>[]
      ) => {
        const sortState = getRefundsSortState(sorter)
        onRefundsTableChange(pagination, sorter)
        setRefundsPaginationState((prev) => ({
          ...prev,
          pageIndex: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
          sortBy: sortState.hasSorter ? sortState.sortBy : "UpdateOn",
          sortDirection: sortState.hasSorter ? sortState.sortDirection : 1,
        }))
      },
      inspectionTasks: hasTargetOverviewIdentity
        ? inspectionTasks
        : inspectionTasksNoFullScan,
      inspectionTasksNoFullScan,
      inspectionStats,
      inspectionLoading: hasTargetOverviewIdentity
        ? inspectionLoading
        : inspectionNoFullScanLoading,
      inspectionPagination: hasTargetOverviewIdentity
        ? inspectionPagination
        : inspectionNoFullScanPagination,
      inspectionNoFullScanLoading,
      inspectionNoFullScanPagination,
      inspectionNoFullScanSortDirection:
        inspectionPaginationState.sortDirection === 0
          ? ("asc" as const)
          : ("desc" as const),
      onInspectionTableChange: (
        pagination: TablePaginationConfig,
        sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
      ) => {
        const sortState = getInspectionSortState(sorter)
        onInspectionTableChange(pagination, sorter)
        setInspectionPaginationState((prev) => ({
          ...prev,
          pageIndex: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
          sortBy: sortState.hasSorter ? sortState.sortBy : prev.sortBy,
          sortDirection: sortState.hasSorter
            ? sortState.sortDirection
            : prev.sortDirection,
        }))
      },
      onInspectionNoFullScanTableChange: (
        pagination: TablePaginationConfig,
        sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
      ) => {
        const sortState = getInspectionProfileSortState(sorter)
        onInspectionTableChange(pagination, sorter)
        setInspectionPaginationState((prev) => ({
          ...prev,
          pageIndex: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
          sortBy: sortState.sortBy,
          sortDirection: sortState.hasAssignedTimeSorter
            ? sortState.sortDirection
            : 1,
        }))
      },
      inspectionNoFullScanFilters,
      inspectionNoFullScanReasonOptions,
      inspectionNoFullScanStatusOptions,
      inspectionNoFullScanPriorityOptions,
      inspectionNoFullScanInspectorOptions,
      onInspectionNoFullScanFiltersChange: (
        filters: typeof inspectionNoFullScanFilters
      ) => {
        setInspectionNoFullScanFilters(filters)
        setInspectionPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
        }))
      },
      onInspectionNoFullScanReset: () => {
        setSearchKey("")
        setInspectionNoFullScanFilters({})
        setInspectionPaginationState((prev) => ({
          ...prev,
          pageIndex: 1,
          sortBy: "AssignedOn",
          sortDirection: 1,
        }))
      },
      appeals,
      appealsLoading,
      appealStatusCounts,
      appealStatusId,
      appealStartTime,
      appealEndTime,
      onAppealStatusIdChange: (value?: string) => {
        setAppealStatusId(value)
      },
      onAppealDateRangeChange: (range: {
        startTime?: string
        endTime?: string
      }) => {
        setAppealStartTime(range.startTime)
        setAppealEndTime(range.endTime)
      },
      stats: applicationsStats,
      loading,
      pagination: applicationsPagination,
      onTableChange: (
        pagination: TablePaginationConfig,
        sorter: SorterResult<OverviewRowItem> | SorterResult<OverviewRowItem>[]
      ) => {
        onApplicationsTableChange(pagination, sorter)
        setApplicationsPaginationState((prev) => ({
          ...prev,
          pageIndex: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
        }))
      },
      visualVariant: isFigmaOverview ? "figmaOverview" as const : undefined,
    }),
    [
      activeTab,
      searchKey,
      handleSearchKeyChange,
      typeFilter,
      setTypeFilter,
      typeFilterOptions,
      applicationsStatusOptions,
      applicationsStatusId,
      setApplicationsStatusId,
      applicationsStartDate,
      applicationsEndDate,
      setApplicationsStartDate,
      setApplicationsEndDate,
      applications,
      setApplicationsPaginationState,
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
      setPaymentsTransactionTypeId,
      setPaymentsStatusId,
      setPaymentsPaymentMethodId,
      setPaymentsStartDate,
      setPaymentsEndDate,
      paymentsPagination,
      onPaymentsTableChange,
      setPaymentsPaginationState,
      licenses,
      licensesStats,
      licensesStatus,
      licensesIssuanceDateStart,
      licensesIssuanceDateEnd,
      setLicensesStatus,
      setLicensesIssuanceDateStart,
      setLicensesIssuanceDateEnd,
      licensesPagination,
      onLicensesTableChange,
      setLicensesPaginationState,
      tickets,
      ticketsStatusCount,
      ticketsEnquiryStatusId,
      ticketsEnquiryType,
      ticketsPriorityId,
      ticketsStartTime,
      ticketsEndTime,
      ticketsPagination,
      onTicketsTableChange,
      setTicketsEnquiryStatusId,
      setTicketsEnquiryType,
      setTicketsPriorityId,
      setTicketsStartTime,
      setTicketsEndTime,
      setTicketsPaginationState,
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
      setViolationsFinesTypeId,
      setViolationsFinesStatusId,
      setViolationsFinesStartTime,
      setViolationsFinesEndTime,
      setViolationsFinesPaidTimeFrom,
      setViolationsFinesPaidTimeTo,
      setSearchKey,
      refunds,
      refundsStatusCount,
      refundsErrorMessage,
      refundsStatusId,
      refundsCategory,
      refundsStartTime,
      refundsEndTime,
      refundsPagination,
      refundsPaginationState.sortDirection,
      onRefundsTableChange,
      setRefundsStatusId,
      setRefundsCategory,
      setRefundsStartTime,
      setRefundsEndTime,
      setRefundsPaginationState,
      inspectionTasks,
      inspectionTasksNoFullScan,
      inspectionStats,
      inspectionLoading,
      inspectionPagination,
      inspectionNoFullScanLoading,
      inspectionNoFullScanPagination,
      inspectionPaginationState.sortDirection,
      hasTargetOverviewIdentity,
      onInspectionTableChange,
      setInspectionPaginationState,
      inspectionNoFullScanFilters,
      inspectionNoFullScanReasonOptions,
      inspectionNoFullScanStatusOptions,
      inspectionNoFullScanPriorityOptions,
      inspectionNoFullScanInspectorOptions,
      setInspectionNoFullScanFilters,
      appeals,
      appealsLoading,
      appealStatusCounts,
      appealStatusId,
      appealStartTime,
      appealEndTime,
      setAppealStatusId,
      setAppealStartTime,
      setAppealEndTime,
      applicationsStats,
      loading,
      applicationsPagination,
      onApplicationsTableChange,
      isFigmaOverview,
      switchOverviewTab,
    ]
  )

  const fallbackStatusSource =
    type === "Individual" ? applicantData?.proFileStatus : establishmentData?.status
  const title = type === "Individual"
    ? t("applicationOverviewCards.individualOverview")
    : t("applicationOverviewCards.establishmentOverview")
  const profileStatusClassName = String(
    resolvedProfileAndApplicantData?.profileStatusObj?.nameEn ||
      getLocalizedStatusText(fallbackStatusSource, false) ||
      "default",
  ).replace(/[^a-zA-Z0-9_-]/g, "")
  const profileStatusText = isArabic
    ? resolvedProfileAndApplicantData?.profileStatusObj?.nameAr ||
      resolvedProfileAndApplicantData?.profileStatusObj?.nameEn ||
      getLocalizedStatusText(fallbackStatusSource, true) ||
      "-"
    : resolvedProfileAndApplicantData?.profileStatusObj?.nameEn ||
      resolvedProfileAndApplicantData?.profileStatusObj?.nameAr ||
      getLocalizedStatusText(fallbackStatusSource, false) ||
      "-"

  const getTabLabel = (key: string, fallbackLabel: string) => {
    if (!isFigmaOverview) return fallbackLabel
    if (key === "appeal") return t("menu.appeals")
    return fallbackLabel
  }

  const rootClassName = [
    "customer-details-page",
    "expend-box",
    "application-overview-fullscreen",
    isFigmaOverview ? "application-overview-fullscreen--figma-overview" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={rootClassName}>
      <FullScreenHeader
        title={title}
        statusText={profileStatusText}
        profileStatusClassName={profileStatusClassName}
        selfMonitorProgram={
          // Same multi-source fallback as resolvedIsVip above: the profile
          // detail (Context) is primary; the establishment payload backs it up.
          ((resolvedProfileAndApplicantData as Record<string, unknown> | null)
            ?.selfMonitorProgram ??
            toObjectRecord(establishmentData)?.selfMonitorProgram) as
            | SelfMonitorProgramInfo
            | null
            | undefined
        }
        onClose={onClose}
      />

      <FullScreenTabs
        activeTab={activeTab}
        onChange={handleTabChange}
        getTabLabel={getTabLabel}
        t={t}
      />

      {activeTab === "basic-information" ? (
        <FullScreenBasicInformation
          type={type}
          applicantData={applicantData}
          establishmentData={establishmentData}
          hideIdentityFields={
            preserveApplicantIdentity &&
            type === "Individual" &&
            !applicantData?.emiratesId &&
            !applicantData?.passportNumber &&
            !applicantData?.uid
          }
          documentsSectionRef={documentsSectionRef}
          partnersSectionRef={partnersSectionRef}
        />
      ) : (
        <AllProfilesOverview {...allProfilesOverviewPropsBase} />
      )}
    </div>
  )
}

export default FullScreen
