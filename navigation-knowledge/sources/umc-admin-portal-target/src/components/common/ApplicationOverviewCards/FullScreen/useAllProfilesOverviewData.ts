import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect } from "react"
import { message } from "antd"
import type { TablePaginationConfig } from "antd/es/table"
import type { SorterResult } from "antd/es/table/interface"
import i18next from "i18next"
import PaginationTotal from "@/components/common/PaginationTotal"
import { syncPaginationRequestState } from "./paginationState"
import {
  applicationPageByProfile,
  type ApplicationPageByProfileSortField,
  type ApplicationPageByProfileParams,
  type ApplicationPageByProfileResponse,
} from "@/services/application"
import { mapApplicationPageItemToOverviewRow } from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/applicationFilterOptions"
import {
  getFinancePaymentsCount,
  getFinancePaymentsCountSummary,
  type FinanceAccountPaymentsResponse,
  type FinancePaymentsSummary,
} from "@/services/wallet"
import {
  getFinancePaymentsTotal,
  mapFinancePaymentItem,
  mapFinancePaymentsSummary,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/paymentUtils"
import {
  createEmptyLicenseStatistics,
  mapLicenseListResponse,
  mapLicenseStatistics,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/licenseUtils"
import {
  getLicenseManagementList,
  getStatistics,
} from "@/services/license"
import {
  getAccountTickets,
  getTicketsStatusCount,
} from "@/services/tickets"
import {
  createEmptyTicketsStatusCount,
  mapAccountTicketsResponse,
  mapTicketsStatusCount,
  type NormalizedTicketsStatusCount,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/ticketUtils"
import { getProfileRefundsByUserProfile } from "@/services/refunds"
import {
  getInspectionProfileTaskStats,
  getInspectionTasksByUserProfile,
  getInspectionTargetViolations,
  getInspectionTargetTasks,
  type InspectionProfileTaskSortField,
  type InspectionViolationItem,
  type InspectionTaskSummary,
  type InspectionTargetTaskListStatus,
} from "@/services/inspection"
import {
  createEmptyInspectionOverviewStats,
  mapInspectionProfileStats,
  mapInspectionProfileTaskListResponse,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/inspectionProfileUtils"
import {
  getInspectionProfileAppeals,
  getInspectionTargetAppeals,
  type InspectionAppealListItemDto,
  type InspectionTargetAppealListResponseDto,
} from "@/services/inspectionAppeals"
import {
  getCustomerProfileViolations,
  type CustomerProfileViolationStatusStat,
} from "@/services/customerManagement"
import type {
  OverviewRowItem,
  PaymentItem,
  LicenseItem,
  TicketItem,
  RefundItem,
  PaymentCountStats,
  ViolationFineItem,
  AppealItem,
  InspectionOverviewItem,
  InspectionOverviewStats,
  InspectionNoFullScanFilters,
} from "@/pages/CustomerDetails/types"
import type {
  AllProfilesOverviewStats,
  LicensesStats,
} from "@/pages/CustomerDetails/components/AllProfilesOverview"
import {
  createEmptyRefundOverviewStats,
  mapProfileRefundListResponse,
  mapProfileRefundStats,
  type RefundOverviewStats,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/refundProfileUtils"
import {
  createEmptyAppealOverviewStats,
  mapAppealItemsToStats,
  mapProfileAppealListResponse,
  mapProfileAppealStats,
  type AppealOverviewStats,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/appealProfileUtils"
import { useProfileAppealSearch } from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/useProfileAppealSearch"
import {
  buildViolationFilterStatusOptions,
  buildViolationStatusCounts,
  createEmptyViolationStatusCounts,
  mapCustomerProfileViolationFilterStatusOptions,
  mapCustomerProfileViolationRows,
  mapCustomerProfileViolationStatusCounts,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/violationProfileUtils"

const EMPTY_VIOLATION_FINE_ITEMS: ViolationFineItem[] = []

type ResponseEnvelope<T> = {
  data?: T | { data?: T | null } | null
}

type InspectionTaskListPayload = {
  items?: InspectionTaskSummary[]
  total?: number
  totalCount?: number
  statuses?: InspectionTargetTaskListStatus[]
}

type TargetAppealRowsResult = {
  items: InspectionAppealListItemDto[]
}

type TargetViolationRowsResult = {
  items: ViolationFineItem[]
}

type SelectOption = {
  label: string
  value: string
}

type SortablePaginationState = {
  pageIndex: number
  pageSize: number
  sortBy?: string
  sortDirection?: number
}

const isSortablePaginationSynced = (
  currentPageIndex: number,
  currentPageSize: number,
  currentSortBy: string | undefined,
  currentSortDirection: number | undefined,
  expected: SortablePaginationState
) =>
  currentPageIndex === expected.pageIndex &&
  currentPageSize === expected.pageSize &&
  currentSortBy === expected.sortBy &&
  currentSortDirection === expected.sortDirection

const unwrapResponsePayload = <T,>(payload: unknown): T | null => {
  if (!payload || typeof payload !== "object") return payload as T
  const data = (payload as ResponseEnvelope<T>).data
  if (data && typeof data === "object" && "data" in data) {
    return (data as { data?: T | null }).data ?? null
  }
  return (data ?? payload) as T
}

interface UseAllProfilesOverviewDataParams {
  userId?: string
  profileId?: number
  targetEstablishmentId?: string | number
  targetIndividualId?: string | number
  targetTaskId?: string | number
  visualVariant?: "figmaOverview"
  fallbackViolationsFines?: ViolationFineItem[]
  activeTab: string
  searchKey: string
  typeFilter?: string
  // Applications pagination and filters
  applicationsStatusId?: string
  applicationsPaginationState: {
    pageIndex: number
    pageSize: number
    total: number
    sortBy?: ApplicationPageByProfileSortField
    sortDirection?: 0 | 1
  }
  applicationsStartDate?: string
  applicationsEndDate?: string
  // Payments pagination and filters
  paymentsPaginationState: {
    pageIndex: number
    pageSize: number
    total: number
    sortBy?: string
    sortDirection?: number
  }
  paymentsTransactionTypeId?: string
  paymentsStatusId?: string
  paymentsPaymentMethodId?: string
  paymentsStartDate?: string
  paymentsEndDate?: string
  // Licenses pagination and filters
  licensesPaginationState: {
    pageIndex: number
    pageSize: number
    total: number
    sortBy?: string
    sortDirection?: number
  }
  licensesStatus?: string
  licensesIssuanceDateStart?: string
  licensesIssuanceDateEnd?: string
  // Tickets pagination and filters
  ticketsPaginationState: {
    pageIndex: number
    pageSize: number
    total: number
    sortBy?: string
    sortDirection?: number
  }
  ticketsEnquiryStatusId?: string
  ticketsEnquiryType?: string
  ticketsPriorityId?: string
  ticketsStartTime?: string
  ticketsEndTime?: string
  // Violations & Fines filters
  violationsFinesTypeId?: string
  violationsFinesStatusId?: string
  violationsFinesStartTime?: string
  violationsFinesEndTime?: string
  violationsFinesPaidTimeFrom?: string
  violationsFinesPaidTimeTo?: string
  // Refunds pagination and filters
  refundsPaginationState: {
    pageIndex: number
    pageSize: number
    total: number
    sortBy?: string
    sortDirection?: number
  }
  refundsStatusId?: string
  refundsCategory?: string
  refundsStartTime?: string
  refundsEndTime?: string
  // Inspection pagination and filters
  inspectionPaginationState: {
    pageIndex: number
    pageSize: number
    total: number
    sortBy?: string
    sortDirection?: number
  }
  inspectionNoFullScanFilters?: InspectionNoFullScanFilters
  // Appeal filters
  appealStatusId?: string
  appealStartTime?: string
  appealEndTime?: string
}

interface UseAllProfilesOverviewDataReturn {
  // Applications
  applications: OverviewRowItem[]
  applicationsLoading: boolean
  applicationsStats: AllProfilesOverviewStats
  applicationsPagination: TablePaginationConfig
  onApplicationsTableChange: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<OverviewRowItem> | SorterResult<OverviewRowItem>[]
  ) => void
  // Payments
  payments: PaymentItem[]
  paymentsLoading: boolean
  paymentsStats: PaymentCountStats | null
  paymentsPagination: TablePaginationConfig
  onPaymentsTableChange: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<PaymentItem> | SorterResult<PaymentItem>[]
  ) => void
  // Licenses
  licenses: LicenseItem[]
  licensesLoading: boolean
  licensesStats: LicensesStats | null
  licensesPagination: TablePaginationConfig
  onLicensesTableChange: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<LicenseItem> | SorterResult<LicenseItem>[]
  ) => void
  // Tickets
  tickets: TicketItem[]
  ticketsLoading: boolean
  ticketsStatusCount: NormalizedTicketsStatusCount
  ticketsPagination: TablePaginationConfig
  onTicketsTableChange: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<TicketItem> | SorterResult<TicketItem>[]
  ) => void
  // Refunds
  refunds: RefundItem[]
  refundsLoading: boolean
  refundsStatusCount: Record<string, unknown> | null
  refundsErrorMessage: string | null
  refundsPagination: TablePaginationConfig
  onRefundsTableChange: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<RefundItem> | SorterResult<RefundItem>[]
  ) => void
  // Violations & Fines
  violationsFines: ViolationFineItem[]
  violationsFinesLoading: boolean
  violationsFinesStatusCounts: Record<string, number>
  violationsFinesStatusOptions: SelectOption[]
  // Inspection
  inspectionTasks: InspectionOverviewItem[]
  inspectionTasksNoFullScan: InspectionOverviewItem[]
  inspectionStats: InspectionOverviewStats
  inspectionLoading: boolean
  inspectionNoFullScanLoading: boolean
  inspectionPagination: TablePaginationConfig
  inspectionNoFullScanPagination: TablePaginationConfig
  onInspectionTableChange: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
  ) => void
  // Appeals
  appeals: AppealItem[]
  appealsLoading: boolean
  appealStatusCounts: AppealOverviewStats
}

const getNumberParam = (value?: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const APPEAL_STATUS_NAME_MAP: Record<number, string> = {
  1: "Pending",
  2: "Resolved",
  3: "Department Processing",
  4: "Department Processed",
  5: "Pending Customer",
  6: "Approved",
  7: "Rejected",
  8: "Cancelled",
}

const formatOverviewValue = (...values: unknown[]) => {
  const matched = values.find(
    (value) => value !== undefined && value !== null && String(value).trim() !== ""
  )
  return matched === undefined ? "-" : String(matched)
}

const formatOverviewDateValue = (...values: unknown[]) => {
  const value = formatOverviewValue(...values)
  return value === "-" ? "" : value
}

const normalizeOverviewStatusKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase()
    .replace(/[\s-]+/g, "_")

const toFiniteNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const humanizeStatusCode = (value: unknown) => {
  const text = String(value ?? "").trim()
  if (!text) return ""
  return text
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const formatFineAmount = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === "") return "0"
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? String(numberValue) : String(value)
}

const mapViolationToFineItem = (
  item: InspectionViolationItem,
): ViolationFineItem => {
  const itemRecord = item as InspectionViolationItem & {
    statusId?: string | number | null
  }
  const statusText = formatOverviewValue(
    item.statusName,
    item.businessStatusName,
    item.internalStatusName,
    humanizeStatusCode(item.statusCode),
    humanizeStatusCode(item.status)
  )

  return {
    id: formatOverviewValue(item.violationId, item.id, item.violationNo),
    fineNo: formatOverviewValue(item.violationNo, item.violationCode, item.id),
    inspectionNo: formatOverviewValue(item.sourceTaskNo, item.taskNo, item.sourceTask),
    violationType: formatOverviewValue(
      item.violationTypeName,
      item.violationType,
      item.categoryName,
      item.violationName,
      item.title
    ),
    violationTypeId: item.violationTypeId ?? undefined,
    fineAmount: formatFineAmount(item.fineAmount),
    status: statusText,
    statusId: itemRecord.statusId ?? undefined,
    violator: formatOverviewValue(
      item.violatorName,
      item.establishmentNameEn,
      item.inspectionTarget?.establishmentNameEn,
      item.inspectionTarget?.fullName
    ),
    applyFor: formatOverviewValue(
      item.violatorName,
      item.establishmentNameEn,
      item.inspectionTarget?.establishmentNameEn,
      item.inspectionTarget?.fullName
    ),
    sourceTask: formatOverviewValue(item.sourceTaskNo, item.taskNo, item.sourceTask),
    reportedBy: formatOverviewValue(
      item.reportedByName,
      item.reportedBy,
      item.assignedInspector
    ),
    creationTime: formatOverviewDateValue(
      item.createdOn,
      item.createdAt,
      item.issuedTime,
      item.inspectionDate
    ),
    issueDate: formatOverviewDateValue(
      item.issuedTime,
      item.createdOn,
      item.createdAt,
      item.inspectionDate
    ),
    paidTime: formatOverviewDateValue(item.paidTime),
    paymentDate: "-",
  }
}

const mapAppealToItem = (
  appeal: InspectionAppealListItemDto,
  index: number,
): AppealItem => {
  const statusId = Number(appeal.statusId ?? appeal.statusObj?.id)
  const appealApplyFor =
    typeof appeal.applyFor === "object" && appeal.applyFor
      ? appeal.applyFor.userName ||
        appeal.applyFor.name ||
        appeal.applyFor.fullName ||
        appeal.applyFor.profileName
      : appeal.applyFor
  const status = formatOverviewValue(
    appeal.statusName,
    appeal.status,
    appeal.statusObj?.nameEn,
    appeal.statusCode,
    appeal.displayStatusCode,
    Number.isFinite(statusId) ? APPEAL_STATUS_NAME_MAP[statusId] : undefined
  )
  const appealNo = formatOverviewValue(
    appeal.appealNo,
    appeal.appealNumber,
    appeal.id,
  )
  const appealReason = formatOverviewValue(appeal.appealReason, appeal.reason)
  const violationNo = formatOverviewValue(
    appeal.violation?.violationNo,
    appeal.violation?.violationNumber,
    appeal.violationNo,
    appeal.violationNumber,
  )
  const lastUpdated = formatOverviewDateValue(
    appeal.lastUpdatedOn,
    appeal.lastUpdatedAt,
    appeal.lastUpdated,
    appeal.updateOn,
    appeal.submissionDate,
    appeal.requestDate,
    appeal.createdOn,
  )
  const appealId = formatOverviewValue(
    appeal.appealId,
    appeal.id,
    appeal.appealNo,
  )

  return {
    id: appealId === "-" ? `target-appeal-row-${index}` : appealId,
    appealNo,
    fineNo: violationNo,
    violationNo,
    appealCategory: appealReason,
    appealReason,
    applyFor: formatOverviewValue(appealApplyFor),
    status,
    statusId: Number.isFinite(statusId) ? String(statusId) : undefined,
    requestDate: lastUpdated,
    submissionTime: formatOverviewDateValue(
      appeal.submissionDate,
      appeal.requestDate,
      appeal.createdOn,
    ),
    lastUpdated,
  }
}

const normalizeTargetAppealItems = (payload: unknown) => {
  const data = unwrapResponsePayload<
    InspectionTargetAppealListResponseDto | InspectionAppealListItemDto[]
  >(payload)

  if (Array.isArray(data)) {
    return { supported: true, items: data }
  }

  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) {
      return { supported: true, items: data.items }
    }
    if (Array.isArray(data.data)) {
      return { supported: true, items: data.data }
    }
  }

  return { supported: false, items: [] as InspectionAppealListItemDto[] }
}

const mapInspectionTaskToOverviewItem = (
  task: InspectionTaskSummary,
  index: number
): InspectionOverviewItem => {
  const target = task.inspectionTarget || {}
  const targetTypeName = formatOverviewValue(target.targetTypeName)
  const inspectionTargetType = targetTypeName.toLowerCase().includes("individual")
    ? "Individual"
    : targetTypeName.toLowerCase().includes("government")
      ? "Government"
      : targetTypeName
  const targetName = formatOverviewValue(
    target.establishmentNameEn,
    target.fullName,
    target.socialMediaAccountUsername,
    target.licenseNumber,
    target.mediaLicenseNumber
  )
  const targetMeta = formatOverviewValue(
    target.mediaLicenseNumber,
    target.licenseNumber,
    target.emiratesId,
    target.email,
    target.mobile
  )
  const statusText = humanizeStatusCode(task.status)
  const inspector = Array.isArray(task.assignment?.assignedInspectors)
    ? task.assignment.assignedInspectors
        .map((item) => item.inspectorName || item.inspectorId)
        .filter(Boolean)
        .join(", ")
    : undefined

  return {
    id: formatOverviewValue(task.taskId, task.taskNo, `inspection-task-${index + 1}`),
    taskNo: formatOverviewValue(task.taskNo, task.taskId),
    inspectionTarget: targetName,
    inspectionTargetMeta: targetMeta === "-" ? undefined : targetMeta,
    inspectionTargetType,
    inspectionReason: formatOverviewValue(
      task.inspectionConfig?.inspectionReasonNameEn,
      task.inspectionConfig?.inspectionReasonCode,
      task.taskSource?.sourceTypeNameEn
    ),
    priority: formatOverviewValue(
      task.inspectionConfig?.priorityNameEn,
      task.inspectionConfig?.priorityCode,
      "-"
    ),
    dueDate: formatOverviewDateValue(
      task.inspectionConfig?.dueDate,
      task.sla?.dueOn,
      task.slaDeadlineAt
    ),
    status: statusText || "-",
    assignedTime: formatOverviewDateValue(
      task.assignment?.assignedAt,
      task.createdAt,
      task.updatedAt
    ),
    inspector: formatOverviewValue(
      inspector,
      task.assignment?.assignedInspector,
      task.createdByName,
      task.createdBy
    ),
  }
}

const buildInspectionStats = (
  statuses?: InspectionTargetTaskListStatus[] | null
): InspectionOverviewStats => {
  const toCount = (value: unknown) => {
    const count = Number(value ?? 0)
    return Number.isFinite(count) ? count : 0
  }
  const statusCounts: Record<string, number> = {}
  const inspectionStatuses = statuses || []
  inspectionStatuses.forEach((item) => {
    const key = normalizeOverviewStatusKey(item.statusCode ?? item.statusName)
    if (!key) return
    statusCounts[key] = (statusCounts[key] || 0) + toCount(item.count)
  })
  const countByStatus = (statuses: string[]) => {
    const statusSet = new Set(statuses.map(normalizeOverviewStatusKey))
    return Array.from(statusSet).reduce(
      (total, status) => total + (statusCounts[status] || 0),
      0
    )
  }

  return {
    queued: countByStatus(["Queued"]),
    pendingVisit: countByStatus(["Pending Visit"]),
    inProgress: countByStatus(["In Progress"]),
    accessFailed: countByStatus(["Access Failed"]),
    completed: countByStatus(["Completed"]),
    cancelled: countByStatus(["Cancelled"]),
  }
}

const dedupeViolationFineItems = (items: ViolationFineItem[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.fineNo !== "-" ? item.fineNo : item.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const useAllProfilesOverviewData = (
  params: UseAllProfilesOverviewDataParams
): UseAllProfilesOverviewDataReturn => {
  const currentLanguage = i18next.language
  const {
    userId,
    profileId,
    targetEstablishmentId,
    targetIndividualId,
    targetTaskId,
    visualVariant,
    fallbackViolationsFines = EMPTY_VIOLATION_FINE_ITEMS,
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
  } = params
  const isFigmaOverview = visualVariant === "figmaOverview"
  const hasTargetOverviewIdentity = Boolean(
    targetEstablishmentId || targetIndividualId,
  )

  // Applications state
  const [applications, setApplications] = useState<OverviewRowItem[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationsStats, setApplicationsStats] =
    useState<AllProfilesOverviewStats>({
      total: 0,
      licenses: 0,
      content: 0,
      completed: 0,
      rejected: 0,
    })
  const [applicationsPaginationInternal, setApplicationsPaginationInternal] =
    useState(applicationsPaginationState)

  // Payments state
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentsStats, setPaymentsStats] =
    useState<PaymentCountStats | null>(null)
  const [paymentsPaginationInternal, setPaymentsPaginationInternal] =
    useState(paymentsPaginationState)

  // Licenses state
  const [licenses, setLicenses] = useState<LicenseItem[]>([])
  const [licensesLoading, setLicensesLoading] = useState(false)
  const [licensesStats, setLicensesStats] = useState<LicensesStats | null>(
    null
  )
  const [licensesPaginationInternal, setLicensesPaginationInternal] =
    useState(licensesPaginationState)

  // Tickets state
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketsStatusCount, setTicketsStatusCount] =
    useState<NormalizedTicketsStatusCount>(createEmptyTicketsStatusCount)
  const [ticketsPaginationInternal, setTicketsPaginationInternal] =
    useState(ticketsPaginationState)

  // Refunds state
  const [refunds, setRefunds] = useState<RefundItem[]>([])
  const [refundsLoading, setRefundsLoading] = useState(false)
  const [refundsStatusCount, setRefundsStatusCount] = useState<
    RefundOverviewStats
  >(createEmptyRefundOverviewStats)
  const [refundsErrorMessage, setRefundsErrorMessage] = useState<string | null>(null)
  const [refundsPaginationInternal, setRefundsPaginationInternal] =
    useState(refundsPaginationState)

  // Inspection state
  const [inspectionTasks, setInspectionTasks] = useState<InspectionOverviewItem[]>([])
  const [inspectionTasksNoFullScan, setInspectionTasksNoFullScan] = useState<
    InspectionOverviewItem[]
  >([])
  const [inspectionStats, setInspectionStats] = useState<InspectionOverviewStats>({
    queued: 0,
    pendingVisit: 0,
    inProgress: 0,
    accessFailed: 0,
    completed: 0,
    cancelled: 0,
  })
  const [inspectionLoading, setInspectionLoading] = useState(false)
  const [inspectionNoFullScanLoading, setInspectionNoFullScanLoading] =
    useState(false)
  const [inspectionPaginationInternal, setInspectionPaginationInternal] =
    useState(inspectionPaginationState)

  // Violations & Fines state
  const [violationsFines, setViolationsFines] = useState<ViolationFineItem[]>(
    fallbackViolationsFines
  )
  const [violationsFinesLoading, setViolationsFinesLoading] = useState(false)
  const [violationsFinesStatusCounts, setViolationsFinesStatusCounts] =
    useState<Record<string, number>>(createEmptyViolationStatusCounts)
  const [violationsFinesStatusOptions, setViolationsFinesStatusOptions] =
    useState<SelectOption[]>(buildViolationFilterStatusOptions)

  // Appeals state
  const [appeals, setAppeals] = useState<AppealItem[]>([])
  const [appealsLoading, setAppealsLoading] = useState(false)
  const [appealStatusCounts, setAppealStatusCounts] =
    useState<AppealOverviewStats>(createEmptyAppealOverviewStats)
  const debouncedAppealSearchKey = useProfileAppealSearch(searchKey)

  // Sync external pagination state with internal state
  useEffect(() => {
    setApplicationsPaginationInternal((current) =>
      syncPaginationRequestState(current, applicationsPaginationState)
    )
  }, [applicationsPaginationState])

  useEffect(() => {
    setPaymentsPaginationInternal((current) =>
      syncPaginationRequestState(current, paymentsPaginationState)
    )
  }, [paymentsPaginationState])

  useEffect(() => {
    setLicensesPaginationInternal((current) =>
      syncPaginationRequestState(current, licensesPaginationState)
    )
  }, [licensesPaginationState])

  useEffect(() => {
    setTicketsPaginationInternal((current) =>
      syncPaginationRequestState(current, ticketsPaginationState)
    )
  }, [ticketsPaginationState])

  useEffect(() => {
    setRefundsPaginationInternal((current) =>
      syncPaginationRequestState(current, refundsPaginationState)
    )
  }, [refundsPaginationState])

  useEffect(() => {
    setInspectionPaginationInternal((current) =>
      syncPaginationRequestState(current, inspectionPaginationState)
    )
  }, [inspectionPaginationState])

  useEffect(() => {
    setViolationsFines(fallbackViolationsFines)
  }, [fallbackViolationsFines])

  useLayoutEffect(() => {
    if (activeTab === "applications") {
      setApplicationsLoading(true)
    } else if (activeTab === "payments") {
      setPaymentsLoading(true)
    } else if (activeTab === "licenses") {
      setLicensesLoading(true)
    } else if (activeTab === "tickets") {
      setTicketsLoading(true)
    } else if (activeTab === "violations-fines") {
      setViolationsFinesLoading(true)
    } else if (activeTab === "refunds") {
      setRefundsLoading(true)
    } else if (activeTab === "inspection") {
      if (isFigmaOverview && hasTargetOverviewIdentity) {
        setInspectionLoading(true)
      } else {
        setInspectionNoFullScanLoading(true)
      }
    } else if (activeTab === "appeal") {
      setAppealsLoading(true)
    }
  }, [activeTab, hasTargetOverviewIdentity, isFigmaOverview])

  const fetchTargetViolationRows = useCallback(
    async (keyword?: string): Promise<TargetViolationRowsResult> => {
      const establishmentId = toFiniteNumber(targetEstablishmentId)
      const individualId = toFiniteNumber(targetIndividualId)
      const taskId = toFiniteNumber(targetTaskId)

      if (!establishmentId && !individualId) {
        const fallbackRows = dedupeViolationFineItems(fallbackViolationsFines)
        return { items: fallbackRows }
      }

      const response = await getInspectionTargetViolations({
        establishmentId: establishmentId || undefined,
        individualId: individualId || undefined,
        taskId: taskId || undefined,
        keyword: keyword || undefined,
        startTime: violationsFinesStartTime || undefined,
        endTime: violationsFinesEndTime || undefined,
        violationTypeId: violationsFinesTypeId || undefined,
        statusId: violationsFinesStatusId || undefined,
      })
      const items = Array.isArray(response?.data?.items)
        ? response.data.items.map(mapViolationToFineItem)
        : []
      const rows = dedupeViolationFineItems(items)
      return { items: rows }
    },
    [
      fallbackViolationsFines,
      targetEstablishmentId,
      targetIndividualId,
      targetTaskId,
      violationsFinesEndTime,
      violationsFinesStartTime,
      violationsFinesStatusId,
      violationsFinesTypeId,
    ]
  )

  const fetchTargetAppealRows = useCallback(async (keyword?: string): Promise<TargetAppealRowsResult> => {
    const establishmentId = toFiniteNumber(targetEstablishmentId)
    const individualId = toFiniteNumber(targetIndividualId)
    const taskId = toFiniteNumber(targetTaskId)

    if (!establishmentId && !individualId) {
      return { items: [] }
    }

    const response = await getInspectionTargetAppeals({
      establishmentId: establishmentId || undefined,
      individualId: individualId || undefined,
      taskId: taskId || undefined,
      keyword: keyword || undefined,
      startTime: appealStartTime || undefined,
      endTime: appealEndTime || undefined,
      statusId: appealStatusId || undefined,
      pageNumber: 1,
      pageSize: 100,
      sortField: "submissionDate",
      sortDescending: true,
    })
    const normalized = normalizeTargetAppealItems(response)

    return {
      items: normalized.supported ? normalized.items : [],
    }
  }, [
    appealEndTime,
    appealStartTime,
    appealStatusId,
    targetEstablishmentId,
    targetIndividualId,
    targetTaskId,
  ])

  // Fetch violations and fines data
  useEffect(() => {
    if (activeTab !== "violations-fines") return
    if (!isFigmaOverview || !hasTargetOverviewIdentity) return

    let cancelled = false
    const run = async () => {
      setViolationsFinesLoading(true)
      try {
        const result = await fetchTargetViolationRows(searchKey)
        if (cancelled) return
        setViolationsFines(result.items)
      } catch (e) {
        if (cancelled) return
        console.error(e)
        const rows = dedupeViolationFineItems(fallbackViolationsFines)
        setViolationsFines(rows)
      } finally {
        if (!cancelled) setViolationsFinesLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    fallbackViolationsFines,
    fetchTargetViolationRows,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    searchKey,
  ])

  useEffect(() => {
    if (activeTab !== "violations-fines") return
    if (!isFigmaOverview || !hasTargetOverviewIdentity) return

    const establishmentId = toFiniteNumber(targetEstablishmentId)
    const individualId = toFiniteNumber(targetIndividualId)
    const taskId = toFiniteNumber(targetTaskId)

    if (!establishmentId && !individualId) {
      setViolationsFinesStatusCounts(createEmptyViolationStatusCounts())
      setViolationsFinesStatusOptions(buildViolationFilterStatusOptions())
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const response = await getInspectionTargetViolations({
          establishmentId: establishmentId || undefined,
          individualId: individualId || undefined,
          taskId: taskId || undefined,
        })
        if (cancelled) return

        const statuses = Array.isArray(response?.data?.statuses)
          ? (response.data.statuses as CustomerProfileViolationStatusStat[])
          : []
        setViolationsFinesStatusCounts(buildViolationStatusCounts(statuses))
        setViolationsFinesStatusOptions(
          buildViolationFilterStatusOptions(statuses),
        )
      } catch (error) {
        if (cancelled) return
        console.error(error)
        setViolationsFinesStatusCounts(createEmptyViolationStatusCounts())
        setViolationsFinesStatusOptions(buildViolationFilterStatusOptions())
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    targetEstablishmentId,
    targetIndividualId,
    targetTaskId,
  ])

  // Fetch violations and fines data for shared fullscreen overview.
  useEffect(() => {
    if (activeTab !== "violations-fines") return
    if (isFigmaOverview && hasTargetOverviewIdentity) return
    if (!userId && !profileId) {
      setViolationsFinesLoading(false)
      setViolationsFines([])
      return
    }

    let cancelled = false
    const run = async () => {
      setViolationsFinesLoading(true)
      try {
        const response = await getCustomerProfileViolations({
          userId: profileId ? undefined : userId,
          profileId,
          keyword: searchKey.trim() || undefined,
          startTime: violationsFinesStartTime,
          endTime: violationsFinesEndTime,
          violationTypeId: getNumberParam(violationsFinesTypeId),
          statusId: getNumberParam(violationsFinesStatusId),
          paidTimeFrom: violationsFinesPaidTimeFrom,
          paidTimeTo: violationsFinesPaidTimeTo,
        })

        if (cancelled) return

        setViolationsFines(mapCustomerProfileViolationRows(response))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setViolationsFines([])
      } finally {
        if (!cancelled) setViolationsFinesLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    profileId,
    searchKey,
    userId,
    violationsFinesEndTime,
    violationsFinesPaidTimeFrom,
    violationsFinesPaidTimeTo,
    violationsFinesStartTime,
    violationsFinesStatusId,
    violationsFinesTypeId,
  ])

  useEffect(() => {
    if (activeTab !== "violations-fines") return
    if (isFigmaOverview && hasTargetOverviewIdentity) return
    if (!userId && !profileId) {
      setViolationsFinesStatusCounts(createEmptyViolationStatusCounts())
      setViolationsFinesStatusOptions(buildViolationFilterStatusOptions())
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const response = await getCustomerProfileViolations({
          userId: profileId ? undefined : userId,
          profileId,
        })
        if (cancelled) return

        setViolationsFinesStatusCounts(
          mapCustomerProfileViolationStatusCounts(response),
        )
        setViolationsFinesStatusOptions(
          mapCustomerProfileViolationFilterStatusOptions(response),
        )
      } catch (error) {
        if (cancelled) return
        console.error(error)
        setViolationsFinesStatusCounts(createEmptyViolationStatusCounts())
        setViolationsFinesStatusOptions(buildViolationFilterStatusOptions())
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    profileId,
    userId,
  ])

  // Fetch inspection task data for target overview.
  useEffect(() => {
    if (activeTab !== "inspection") return
    if (!isFigmaOverview) return
    if (
      !isSortablePaginationSynced(
        inspectionPaginationInternal.pageIndex,
        inspectionPaginationInternal.pageSize,
        inspectionPaginationInternal.sortBy,
        inspectionPaginationInternal.sortDirection,
        inspectionPaginationState
      )
    ) {
      return
    }

    const establishmentId = toFiniteNumber(targetEstablishmentId)
    const individualId = toFiniteNumber(targetIndividualId)
    const taskId = toFiniteNumber(targetTaskId)

    if (!establishmentId && !individualId) {
      setInspectionLoading(false)
      setInspectionTasks([])
      setInspectionStats({
        queued: 0,
        pendingVisit: 0,
        inProgress: 0,
        accessFailed: 0,
        completed: 0,
        cancelled: 0,
      })
      setInspectionPaginationInternal((prev) => ({ ...prev, total: 0 }))
      return
    }

    let cancelled = false
    const run = async () => {
      setInspectionLoading(true)
      try {
        const sortBy = ["DueDate", "CreatedOn", "Priority", "SLA"].includes(
          String(inspectionPaginationInternal.sortBy)
        )
          ? (inspectionPaginationInternal.sortBy as "DueDate" | "CreatedOn" | "Priority" | "SLA")
          : undefined
        const response = await getInspectionTargetTasks({
          establishmentId: establishmentId || undefined,
          individualId: individualId || undefined,
          taskId: taskId || undefined,
          search: searchKey || undefined,
          pageIndex: inspectionPaginationInternal.pageIndex,
          pageSize: inspectionPaginationInternal.pageSize,
          sortBy,
          sortDirection:
            inspectionPaginationInternal.sortDirection === undefined
              ? undefined
              : inspectionPaginationInternal.sortDirection === 0
                ? "asc"
                : "desc",
        })

        if (cancelled) return
        const data = unwrapResponsePayload<InspectionTaskListPayload>(response) || {}
        const items = data.items || []
        const rows = items.map(mapInspectionTaskToOverviewItem)

        setInspectionTasks(rows)
        setInspectionStats(buildInspectionStats(data?.statuses))
        setInspectionPaginationInternal((prev) => ({
          ...prev,
          total: Number(data?.totalCount ?? data?.total ?? 0),
        }))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setInspectionTasks([])
        setInspectionStats({
          queued: 0,
          pendingVisit: 0,
          inProgress: 0,
          accessFailed: 0,
          completed: 0,
          cancelled: 0,
        })
        setInspectionPaginationInternal((prev) => ({ ...prev, total: 0 }))
      } finally {
        if (!cancelled) setInspectionLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    isFigmaOverview,
    targetEstablishmentId,
    targetIndividualId,
    targetTaskId,
    searchKey,
    inspectionPaginationInternal.pageIndex,
    inspectionPaginationInternal.pageSize,
    inspectionPaginationInternal.sortBy,
    inspectionPaginationInternal.sortDirection,
    inspectionPaginationState,
  ])

  // Fetch inspection task data for shared fullscreen overview.
  useEffect(() => {
    if (activeTab !== "inspection") return
    if (isFigmaOverview && hasTargetOverviewIdentity) return
    if (!userId && !profileId) {
      setInspectionNoFullScanLoading(false)
      setInspectionTasksNoFullScan([])
      setInspectionPaginationInternal((prev) => ({ ...prev, total: 0 }))
      return
    }
    if (
      !isSortablePaginationSynced(
        inspectionPaginationInternal.pageIndex,
        inspectionPaginationInternal.pageSize,
        inspectionPaginationInternal.sortBy,
        inspectionPaginationInternal.sortDirection,
        inspectionPaginationState,
      )
    ) {
      return
    }

    let cancelled = false
    const run = async () => {
      setInspectionNoFullScanLoading(true)
      try {
        const hasProfileId = Number.isFinite(Number(profileId)) && Number(profileId) > 0
        const identityParams = hasProfileId
          ? { profileId: Number(profileId) }
          : { userId: userId || undefined }
        const supportedSortFields: InspectionProfileTaskSortField[] = [
          "TaskNo",
          "DueDate",
          "AssignedOn",
          "CreatedOn",
        ]
        const sortBy = supportedSortFields.includes(
          inspectionPaginationInternal.sortBy as InspectionProfileTaskSortField,
        )
          ? (inspectionPaginationInternal.sortBy as InspectionProfileTaskSortField)
          : "AssignedOn"
        const response = await getInspectionTasksByUserProfile({
          ...identityParams,
          search: searchKey.trim() || undefined,
          statusId: getNumberParam(inspectionNoFullScanFilters?.statusId),
          inspectionReasonId:
            inspectionNoFullScanFilters?.reasonId?.trim() || undefined,
          priorityId: getNumberParam(inspectionNoFullScanFilters?.priorityId),
          dueDateFrom: inspectionNoFullScanFilters?.dueDateFrom,
          dueDateTo: inspectionNoFullScanFilters?.dueDateTo,
          assignedTimeFrom: inspectionNoFullScanFilters?.assignedTimeFrom,
          assignedTimeTo: inspectionNoFullScanFilters?.assignedTimeTo,
          assignedInspectorId: inspectionNoFullScanFilters?.assignedInspectorId,
          pageIndex: inspectionPaginationInternal.pageIndex,
          pageSize: inspectionPaginationInternal.pageSize,
          sortBy,
          sortDirection:
            inspectionPaginationInternal.sortDirection === 0
              ? "asc"
              : "desc",
        })

        if (cancelled) return
        const mapped = mapInspectionProfileTaskListResponse(
          response,
          i18next.t,
        )

        setInspectionTasksNoFullScan(mapped.items)
        setInspectionPaginationInternal((prev) => ({
          ...prev,
          total: mapped.total,
        }))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setInspectionTasksNoFullScan([])
        setInspectionPaginationInternal((prev) => ({ ...prev, total: 0 }))
      } finally {
        if (!cancelled) setInspectionNoFullScanLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    hasTargetOverviewIdentity,
    inspectionNoFullScanFilters?.assignedInspectorId,
    inspectionNoFullScanFilters?.assignedTimeFrom,
    inspectionNoFullScanFilters?.assignedTimeTo,
    inspectionNoFullScanFilters?.dueDateFrom,
    inspectionNoFullScanFilters?.dueDateTo,
    inspectionNoFullScanFilters?.priorityId,
    inspectionNoFullScanFilters?.reasonId,
    inspectionNoFullScanFilters?.statusId,
    inspectionPaginationInternal.pageIndex,
    inspectionPaginationInternal.pageSize,
    inspectionPaginationInternal.sortBy,
    inspectionPaginationInternal.sortDirection,
    inspectionPaginationState,
    currentLanguage,
    isFigmaOverview,
    profileId,
    searchKey,
    userId,
  ])

  useEffect(() => {
    if (activeTab !== "inspection") return
    if (isFigmaOverview && hasTargetOverviewIdentity) return
    if (!userId && !profileId) {
      setInspectionStats(createEmptyInspectionOverviewStats())
      return
    }

    setInspectionStats(createEmptyInspectionOverviewStats())
    let cancelled = false
    const run = async () => {
      try {
        const hasProfileId = Number.isFinite(Number(profileId)) && Number(profileId) > 0
        const response = await getInspectionProfileTaskStats(
          hasProfileId
            ? { profileId: Number(profileId) }
            : { userId: userId || undefined },
        )
        if (!cancelled) {
          setInspectionStats(mapInspectionProfileStats(response))
        }
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setInspectionStats(createEmptyInspectionOverviewStats())
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    profileId,
    userId,
  ])

  // Fetch appeal data by the target violations.
  useEffect(() => {
    if (activeTab !== "appeal") return
    if (!isFigmaOverview || !hasTargetOverviewIdentity) return

    let cancelled = false
    const run = async () => {
      setAppealsLoading(true)
      try {
        const { items } = await fetchTargetAppealRows(debouncedAppealSearchKey)
        if (cancelled) return

        const rows = items.map((appeal, index) =>
          mapAppealToItem(appeal, index),
        )
        setAppeals(rows)
        setAppealStatusCounts(mapAppealItemsToStats(rows))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setAppeals([])
        setAppealStatusCounts(createEmptyAppealOverviewStats())
      } finally {
        if (!cancelled) setAppealsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    debouncedAppealSearchKey,
    fetchTargetAppealRows,
    hasTargetOverviewIdentity,
    isFigmaOverview,
  ])

  // Fetch appeal data for shared fullscreen overview.
  useEffect(() => {
    if (activeTab !== "appeal") return
    if (isFigmaOverview && hasTargetOverviewIdentity) return
    const effectiveProfileId = toFiniteNumber(profileId)
    const effectiveUserId = effectiveProfileId
      ? undefined
      : String(userId ?? "").trim() || undefined

    if (!effectiveUserId && !effectiveProfileId) {
      setAppealsLoading(false)
      setAppeals([])
      return
    }

    let cancelled = false
    const run = async () => {
      setAppealsLoading(true)
      try {
        const response = await getInspectionProfileAppeals({
          userId: effectiveUserId,
          profileId: effectiveProfileId,
          keyword: debouncedAppealSearchKey || undefined,
          startTime: appealStartTime,
          endTime: appealEndTime,
          statusId: getNumberParam(appealStatusId),
        })

        if (cancelled) return

        setAppeals(mapProfileAppealListResponse(response).items)
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setAppeals([])
      } finally {
        if (!cancelled) setAppealsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    appealEndTime,
    appealStartTime,
    appealStatusId,
    debouncedAppealSearchKey,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    profileId,
    userId,
  ])

  useEffect(() => {
    if (activeTab !== "appeal") return
    if (isFigmaOverview && hasTargetOverviewIdentity) return
    const effectiveProfileId = toFiniteNumber(profileId)
    const effectiveUserId = effectiveProfileId
      ? undefined
      : String(userId ?? "").trim() || undefined

    if (!effectiveUserId && !effectiveProfileId) {
      setAppealStatusCounts(createEmptyAppealOverviewStats())
      return
    }

    setAppealStatusCounts(createEmptyAppealOverviewStats())
    let cancelled = false
    const run = async () => {
      try {
        const response = await getInspectionProfileAppeals({
          userId: effectiveUserId,
          profileId: effectiveProfileId,
        })
        if (!cancelled) {
          setAppealStatusCounts(mapProfileAppealStats(response))
        }
      } catch (error) {
        if (cancelled) return
        console.error(error)
        setAppealStatusCounts(createEmptyAppealOverviewStats())
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    hasTargetOverviewIdentity,
    isFigmaOverview,
    profileId,
    userId,
  ])

  // Fetch applications data
  useEffect(() => {
    if (activeTab !== "applications") return
    if (!userId && !profileId) {
      setApplicationsLoading(false)
      setApplications([])
      setApplicationsStats({
        total: 0,
        licenses: 0,
        content: 0,
        processing: 0,
        cancelled: 0,
        completed: 0,
        rejected: 0,
      })
      setApplicationsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      return
    }

    let cancelled = false
    const run = async () => {
      setApplicationsLoading(true)
      try {
        const applicationParams: ApplicationPageByProfileParams = {
          pageSize: applicationsPaginationInternal.pageSize,
          pageIndex: applicationsPaginationInternal.pageIndex,
          sortBy: applicationsPaginationInternal.sortBy,
          sortDirection: applicationsPaginationInternal.sortDirection,
          userId,
          profileId,
          keyword: searchKey || undefined,
          serviceType: typeFilter || undefined,
          processInstanceStatusCode: applicationsStatusId || undefined,
          submissionStartTime: applicationsStartDate || undefined,
          submissionEndTime: applicationsEndDate || undefined,
        }
        const res = await applicationPageByProfile(applicationParams)

        if (cancelled) return

        const data = unwrapResponsePayload<ApplicationPageByProfileResponse>(res)
        const report = data?.report as
          | (ApplicationPageByProfileResponse["report"] & {
              processingCount?: number
              cancelledCount?: number
              rejectedCount?: number
              completedCount?: number
            })
          | undefined

        const items = data?.page?.items || []
        const mapped: OverviewRowItem[] = items.map(
          mapApplicationPageItemToOverviewRow,
        )

        setApplicationsStats({
          total: Number(report?.totalCount || 0),
          licenses: Number(report?.licenseCount || 0),
          content: Number(report?.contentCount || 0),
          processing: Number(report?.processingCount || 0),
          cancelled: Number(report?.cancelledCount || 0),
          rejected: Number(report?.rejectedCount || 0),
          completed: Number(report?.completedCount || 0),
        })
        setApplications(mapped)
        setApplicationsPaginationInternal((prev) => ({
          ...prev,
          total: Number(data?.page?.total || 0),
        }))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setApplications([])
        setApplicationsStats({
          total: 0,
          licenses: 0,
          content: 0,
          processing: 0,
          cancelled: 0,
          completed: 0,
          rejected: 0,
        })
        setApplicationsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      } finally {
        if (!cancelled) setApplicationsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    userId,
    profileId,
    searchKey,
    typeFilter,
    applicationsStatusId,
    applicationsStartDate,
    applicationsEndDate,
    applicationsPaginationInternal.pageIndex,
    applicationsPaginationInternal.pageSize,
    applicationsPaginationInternal.sortBy,
    applicationsPaginationInternal.sortDirection,
  ])

  // Fetch payments data
  useEffect(() => {
    if (activeTab !== "payments") return
    if (!userId && !profileId) {
      setPaymentsLoading(false)
      setPayments([])
      setPaymentsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      return
    }

    let cancelled = false
    const run = async () => {
      setPaymentsLoading(true)
      try {
        const listRes = await getFinancePaymentsCount({
          userId: userId,
          profileId: profileId,
          pageIndex: paymentsPaginationInternal.pageIndex,
          pageSize: paymentsPaginationInternal.pageSize,
          keyword: searchKey || undefined,
          sortBy: "completedAt",
          sortDirection:
            paymentsPaginationInternal.sortDirection === 0
              ? "asc"
              : "desc",
          transactionTypeId: paymentsTransactionTypeId || undefined,
          paymentMethodId: paymentsPaymentMethodId || undefined,
          statusId: paymentsStatusId || undefined,
          startDate: paymentsStartDate || undefined,
          endDate: paymentsEndDate || undefined,
        })

        if (cancelled) return

        const listData = unwrapResponsePayload<FinanceAccountPaymentsResponse>(listRes)
        const items = Array.isArray(listData?.items) ? listData.items : []

        const mapped: PaymentItem[] = items.map((item, idx) =>
          mapFinancePaymentItem(item, idx, currentLanguage),
        )

        setPayments(mapped)
        setPaymentsPaginationInternal((prev) => ({
          ...prev,
          total: getFinancePaymentsTotal(listData),
        }))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setPayments([])
        setPaymentsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      } finally {
        if (!cancelled) setPaymentsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    userId,
    profileId,
    searchKey,
    paymentsPaginationInternal.pageIndex,
    paymentsPaginationInternal.pageSize,
    paymentsPaginationInternal.sortBy,
    paymentsPaginationInternal.sortDirection,
    paymentsTransactionTypeId,
    paymentsPaymentMethodId,
    paymentsStatusId,
    paymentsStartDate,
    paymentsEndDate,
    currentLanguage,
  ])

  useEffect(() => {
    if (activeTab !== "payments") return
    if (!userId && !profileId) {
      setPaymentsStats(null)
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const countRes = await getFinancePaymentsCountSummary({
          userId: userId,
          profileId: profileId,
        })

        if (cancelled) return

        const countPayload = unwrapResponsePayload<FinancePaymentsSummary>(countRes)
        if (countPayload && typeof countPayload === "object") {
          setPaymentsStats(mapFinancePaymentsSummary(countPayload))
        } else {
          setPaymentsStats(null)
        }
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setPaymentsStats(null)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, userId, profileId])

  // Fetch licenses data
  useEffect(() => {
    if (activeTab !== "licenses") return
    if (!userId && !profileId) {
      setLicensesLoading(false)
      setLicenses([])
      setLicensesPaginationInternal((prev) => ({ ...prev, total: 0 }))
      return
    }

    let cancelled = false
    const run = async () => {
      setLicensesLoading(true)
      try {
        const listRes = await getLicenseManagementList({
          pageSize: licensesPaginationInternal.pageSize,
          pageIndex: licensesPaginationInternal.pageIndex,
          sortBy: licensesPaginationInternal.sortBy || "issuanceTime",
          sortDirection: licensesPaginationInternal.sortDirection ?? 1,
          keyword: searchKey || undefined,
          userId: userId,
          profileId: profileId,
          status: licensesStatus || undefined,
          issuanceDateStart: licensesIssuanceDateStart || undefined,
          issuanceDateEnd: licensesIssuanceDateEnd || undefined,
        })

        if (cancelled) return

        const listData = mapLicenseListResponse(listRes, currentLanguage)
        setLicenses(listData.items)
        setLicensesPaginationInternal((prev) => ({
          ...prev,
          total: listData.total,
        }))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        message.error(i18next.t("applicationOverviewCards.failedToLoadLicenses"))
        setLicenses([])
        setLicensesPaginationInternal((prev) => ({ ...prev, total: 0 }))
      } finally {
        if (!cancelled) setLicensesLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    userId,
    profileId,
    currentLanguage,
    searchKey,
    licensesPaginationInternal.pageIndex,
    licensesPaginationInternal.pageSize,
    licensesPaginationInternal.sortBy,
    licensesPaginationInternal.sortDirection,
    licensesStatus,
    licensesIssuanceDateStart,
    licensesIssuanceDateEnd,
  ])

  useEffect(() => {
    if (activeTab !== "licenses") return
    if (!userId && !profileId) {
      setLicensesStats(createEmptyLicenseStatistics())
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const response = await getStatistics(userId, profileId)
        if (!cancelled) {
          setLicensesStats(mapLicenseStatistics(response))
        }
      } catch (error) {
        if (cancelled) return
        console.error(error)
        setLicensesStats(createEmptyLicenseStatistics())
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, profileId, userId])

  // Fetch tickets data
  useEffect(() => {
    if (activeTab !== "tickets") return
    if (
      !isSortablePaginationSynced(
        ticketsPaginationInternal.pageIndex,
        ticketsPaginationInternal.pageSize,
        ticketsPaginationInternal.sortBy,
        ticketsPaginationInternal.sortDirection,
        ticketsPaginationState
      )
    ) {
      return
    }
    if (!userId && !profileId) {
      setTicketsLoading(false)
      setTickets([])
      setTicketsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      return
    }

    let cancelled = false
    const run = async () => {
      setTicketsLoading(true)
      try {
        const listRes = await getAccountTickets({
          UserId: userId,
          UserProfileId: profileId,
          SearchKey: searchKey || undefined,
          PageSize: ticketsPaginationInternal.pageSize,
          PageIndex: ticketsPaginationInternal.pageIndex,
          SortBy: ticketsPaginationInternal.sortBy || "updatedOn",
          SortDirection: ticketsPaginationInternal.sortDirection ?? 1,
          StartTime: ticketsStartTime || undefined,
          EndTime: ticketsEndTime || undefined,
          EnquiryType: ticketsEnquiryType
            ? Number(ticketsEnquiryType)
            : undefined,
          EnquiryStatusId: ticketsEnquiryStatusId || undefined,
          PriorityId: ticketsPriorityId
            ? Number(ticketsPriorityId)
            : undefined,
        })

        if (cancelled) return

        const listData = mapAccountTicketsResponse(
          listRes,
          currentLanguage,
          i18next.t
        )
        setTickets(listData.items)
        setTicketsPaginationInternal((prev) => ({
          ...prev,
          total: listData.total,
        }))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setTickets([])
        setTicketsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      } finally {
        if (!cancelled) setTicketsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    currentLanguage,
    userId,
    profileId,
    searchKey,
    ticketsPaginationInternal.pageIndex,
    ticketsPaginationInternal.pageSize,
    ticketsPaginationInternal.sortBy,
    ticketsPaginationInternal.sortDirection,
    ticketsPaginationState,
    ticketsEnquiryStatusId,
    ticketsEnquiryType,
    ticketsPriorityId,
    ticketsStartTime,
    ticketsEndTime,
  ])

  useEffect(() => {
    if (activeTab !== "tickets") return
    if (!userId && !profileId) {
      setTicketsStatusCount(createEmptyTicketsStatusCount())
      return
    }

    setTicketsStatusCount(createEmptyTicketsStatusCount())
    let cancelled = false
    const run = async () => {
      try {
        const response = await getTicketsStatusCount({
          _userId: userId,
          _profileId: profileId,
        })
        if (!cancelled) {
          setTicketsStatusCount(mapTicketsStatusCount(response))
        }
      } catch (error) {
        if (cancelled) return
        console.error(error)
        setTicketsStatusCount(createEmptyTicketsStatusCount())
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, profileId, userId])

  // Fetch refunds data
  useEffect(() => {
    if (activeTab !== "refunds") return
    const effectiveProfileId = toFiniteNumber(profileId)
    const effectiveUserId = effectiveProfileId
      ? undefined
      : String(userId ?? "").trim() || undefined

    if (!effectiveUserId && !effectiveProfileId) {
      setRefundsLoading(false)
      setRefunds([])
      setRefundsErrorMessage(null)
      setRefundsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      return
    }
    if (
      !isSortablePaginationSynced(
        refundsPaginationInternal.pageIndex,
        refundsPaginationInternal.pageSize,
        refundsPaginationInternal.sortBy,
        refundsPaginationInternal.sortDirection,
        refundsPaginationState
      )
    ) {
      return
    }

    let cancelled = false
    const run = async () => {
      setRefundsLoading(true)
      try {
        const listRes = await getProfileRefundsByUserProfile({
          userId: effectiveUserId,
          profileId: effectiveProfileId,
          search: searchKey.trim() || undefined,
          categoryId: toFiniteNumber(refundsCategory),
          statusId: toFiniteNumber(refundsStatusId),
          lastupdatedStartTime: refundsStartTime || undefined,
          lastupdatedEndTime: refundsEndTime || undefined,
          pageIndex: refundsPaginationInternal.pageIndex,
          pageSize: refundsPaginationInternal.pageSize,
          sortBy: refundsPaginationInternal.sortBy || "UpdateOn",
          sortDirection:
            refundsPaginationInternal.sortDirection === 0 ? 0 : 1,
        })

        if (cancelled) return
        const listData = mapProfileRefundListResponse(
          listRes,
          currentLanguage,
        )
        setRefundsErrorMessage(null)
        setRefunds(listData.items)
        setRefundsPaginationInternal((prev) => ({
          ...prev,
          total: listData.total,
        }))
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setRefunds([])
        setRefundsErrorMessage("Refund requests failed. Please check permission or retry.")
        setRefundsPaginationInternal((prev) => ({ ...prev, total: 0 }))
      } finally {
        if (!cancelled) setRefundsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    currentLanguage,
    userId,
    profileId,
    searchKey,
    refundsPaginationInternal.pageIndex,
    refundsPaginationInternal.pageSize,
    refundsPaginationInternal.sortBy,
    refundsPaginationInternal.sortDirection,
    refundsStatusId,
    refundsCategory,
    refundsStartTime,
    refundsEndTime,
    refundsPaginationState,
  ])

  useEffect(() => {
    if (activeTab !== "refunds") return
    const effectiveProfileId = toFiniteNumber(profileId)
    const effectiveUserId = effectiveProfileId
      ? undefined
      : String(userId ?? "").trim() || undefined

    if (!effectiveUserId && !effectiveProfileId) {
      setRefundsStatusCount(createEmptyRefundOverviewStats())
      return
    }

    setRefundsStatusCount(createEmptyRefundOverviewStats())
    let cancelled = false
    const run = async () => {
      try {
        const response = await getProfileRefundsByUserProfile({
          userId: effectiveUserId,
          profileId: effectiveProfileId,
          pageIndex: 1,
          pageSize: 1,
          sortBy: "UpdateOn",
          sortDirection: 1,
        })
        if (cancelled) return
        setRefundsStatusCount(mapProfileRefundStats(response))
      } catch (error) {
        if (cancelled) return
        console.error(error)
        setRefundsStatusCount(createEmptyRefundOverviewStats())
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeTab, profileId, userId])

  // Convert to TablePaginationConfig for Ant Design Table
  const applicationsPagination: TablePaginationConfig = useMemo(
    () => ({
      current: applicationsPaginationInternal.pageIndex,
      pageSize: applicationsPaginationInternal.pageSize,
      total: applicationsPaginationInternal.total,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total) => React.createElement(PaginationTotal, { label: i18next.t("common.total"), total, current: applicationsPaginationInternal.pageIndex, pageSize: applicationsPaginationInternal.pageSize }),
    }),
    [applicationsPaginationInternal]
  )

  const paymentsPagination: TablePaginationConfig = useMemo(
    () => ({
      current: paymentsPaginationInternal.pageIndex,
      pageSize: paymentsPaginationInternal.pageSize,
      total: paymentsPaginationInternal.total,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total) => React.createElement(PaginationTotal, { label: i18next.t("common.total"), total, current: paymentsPaginationInternal.pageIndex, pageSize: paymentsPaginationInternal.pageSize }),
    }),
    [paymentsPaginationInternal]
  )

  const licensesPagination: TablePaginationConfig = useMemo(
    () => ({
      current: licensesPaginationInternal.pageIndex,
      pageSize: licensesPaginationInternal.pageSize,
      total: licensesPaginationInternal.total,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total) => React.createElement(PaginationTotal, { label: i18next.t("common.total"), total, current: licensesPaginationInternal.pageIndex, pageSize: licensesPaginationInternal.pageSize }),
    }),
    [licensesPaginationInternal]
  )

  const ticketsPagination: TablePaginationConfig = useMemo(
    () => ({
      current: ticketsPaginationInternal.pageIndex,
      pageSize: ticketsPaginationInternal.pageSize,
      total: ticketsPaginationInternal.total,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total) => React.createElement(PaginationTotal, { label: i18next.t("common.total"), total, current: ticketsPaginationInternal.pageIndex, pageSize: ticketsPaginationInternal.pageSize }),
    }),
    [ticketsPaginationInternal]
  )

  const refundsPagination: TablePaginationConfig = useMemo(
    () => ({
      current: refundsPaginationInternal.pageIndex,
      pageSize: refundsPaginationInternal.pageSize,
      total: refundsPaginationInternal.total,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total) => React.createElement(PaginationTotal, { label: i18next.t("common.total"), total, current: refundsPaginationInternal.pageIndex, pageSize: refundsPaginationInternal.pageSize }),
    }),
    [refundsPaginationInternal]
  )

  const inspectionPagination: TablePaginationConfig = useMemo(
    () => ({
      current: inspectionPaginationInternal.pageIndex,
      pageSize: inspectionPaginationInternal.pageSize,
      total: inspectionPaginationInternal.total,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total) => React.createElement(PaginationTotal, { label: i18next.t("common.total"), total, current: inspectionPaginationInternal.pageIndex, pageSize: inspectionPaginationInternal.pageSize }),
    }),
    [inspectionPaginationInternal]
  )

  const inspectionNoFullScanPagination = inspectionPagination

  // Table change handlers
  const onApplicationsTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<OverviewRowItem> | SorterResult<OverviewRowItem>[]
    ) => {
      setApplicationsPaginationInternal((prev) => ({
        ...prev,
        pageIndex: pagination.current || 1,
        pageSize: pagination.pageSize || 10,
        total: pagination.total || 0,
        sortBy: "lastUpdatedTime",
        sortDirection:
          Array.isArray(sorter) || !sorter.order
            ? 1
            : sorter.order === "ascend"
            ? 0
            : 1,
      }))
    },
    []
  )

  const onPaymentsTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<PaymentItem> | SorterResult<PaymentItem>[]
    ) => {
      setPaymentsPaginationInternal((prev) => ({
        ...prev,
        pageIndex: pagination.current || 1,
        pageSize: pagination.pageSize || 10,
        total: pagination.total || 0,
        sortBy: Array.isArray(sorter)
          ? undefined
          : sorter.field?.toString(),
        sortDirection:
          Array.isArray(sorter) || !sorter.order
            ? undefined
            : sorter.order === "ascend"
            ? 0
            : 1,
      }))
    },
    []
  )

  const onTicketsTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<TicketItem> | SorterResult<TicketItem>[]
    ) => {
      setTicketsPaginationInternal((prev) => ({
        ...prev,
        pageIndex: pagination.current || 1,
        pageSize: pagination.pageSize || 10,
        total: pagination.total || 0,
        sortBy: "updatedOn",
        sortDirection:
          Array.isArray(sorter) || !sorter.order
            ? 1
            : sorter.order === "ascend"
              ? 0
              : 1,
      }))
    },
    []
  )

  const onLicensesTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<LicenseItem> | SorterResult<LicenseItem>[]
    ) => {
      setLicensesPaginationInternal((prev) => ({
        ...prev,
        pageIndex: pagination.current || 1,
        pageSize: pagination.pageSize || 10,
        total: pagination.total || 0,
        sortBy:
          !Array.isArray(sorter) && sorter.order
            ? sorter.field?.toString() || "issuanceTime"
            : "issuanceTime",
        sortDirection:
          Array.isArray(sorter) || !sorter.order
            ? 1
            : sorter.order === "ascend"
            ? 0
            : 1,
      }))
    },
    []
  )

  const onRefundsTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<RefundItem> | SorterResult<RefundItem>[]
    ) => {
      const order = Array.isArray(sorter) ? undefined : sorter.order
      setRefundsPaginationInternal((prev) => ({
        ...prev,
        pageIndex: pagination.current || 1,
        pageSize: pagination.pageSize || 10,
        total: pagination.total || 0,
        sortBy: "UpdateOn",
        sortDirection: order === "ascend" ? 0 : 1,
      }))
    },
    []
  )

  const onInspectionTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
    ) => {
      const field = Array.isArray(sorter) ? undefined : sorter.field?.toString()
      const hasSorter = Boolean(field)
      const sortBy =
        field === "dueDate"
          ? "DueDate"
          : field === "priority"
            ? "Priority"
            : field === "assignedTime"
              ? "AssignedOn"
            : undefined

      setInspectionPaginationInternal((prev) => ({
        ...prev,
        pageIndex: pagination.current || 1,
        pageSize: pagination.pageSize || 10,
        total: pagination.total || 0,
        sortBy: hasSorter ? sortBy : prev.sortBy,
        sortDirection:
          !hasSorter
            ? prev.sortDirection
            : Array.isArray(sorter) || !sorter.order
            ? undefined
            : sorter.order === "ascend"
            ? 0
            : 1,
      }))
    },
    []
  )

  return {
    // Applications
    applications,
    applicationsLoading,
    applicationsStats,
    applicationsPagination,
    onApplicationsTableChange,
    // Payments
    payments,
    paymentsLoading,
    paymentsStats,
    paymentsPagination,
    onPaymentsTableChange,
    // Licenses
    licenses,
    licensesLoading,
    licensesStats,
    licensesPagination,
    onLicensesTableChange,
    // Tickets
    tickets,
    ticketsLoading,
    ticketsStatusCount,
    ticketsPagination,
    onTicketsTableChange,
    // Refunds
    refunds,
    refundsLoading,
    refundsStatusCount,
    refundsErrorMessage,
    refundsPagination,
    onRefundsTableChange,
    // Violations & Fines
    violationsFines,
    violationsFinesLoading,
    violationsFinesStatusCounts,
    violationsFinesStatusOptions,
    // Inspection
    inspectionTasks,
    inspectionTasksNoFullScan,
    inspectionStats,
    inspectionLoading,
    inspectionNoFullScanLoading,
    inspectionPagination,
    inspectionNoFullScanPagination,
    onInspectionTableChange,
    // Appeals
    appeals,
    appealsLoading,
    appealStatusCounts,
  }
}
