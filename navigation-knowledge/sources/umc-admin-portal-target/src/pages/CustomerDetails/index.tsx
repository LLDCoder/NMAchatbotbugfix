import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Form, Input, Modal, message, Spin } from "antd";
import LoginMethod from "@/assets/images/login-method.png";
import Mobile from "@/assets/images/mobile.png";
import PC from "@/assets/images/pc.png";
import Tablet from "@/assets/images/tablet.png";
import { CustomButton, ConfirmModal, CustomMessage, PaginationTotal } from "@/components/common";
import { useLocation, useHistory } from "react-router-dom";
import dayjs from "dayjs";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { useButtonPermission } from "@/routes/access";
import { getEmiratesIdInfotickets } from "@/services/icp";
import AllProfilesOverview from "./components/AllProfilesOverview";
import CommercialProfileOverview from "./components/CommercialProfileOverview";
import DetailSection from "./components/DetailSection";
import ProfileListPanel from "./components/ProfileListPanel";
import ProfileOverview from "./components/ProfileOverview";
import type {
  DocumentItem,
  InfoItem,
  PaymentItem,
  PaymentCountStats,
  OverviewRowItem,
  ProfileItem,
  LicenseItem,
  TicketItem,
  RefundItem,
  InspectionOverviewItem,
  InspectionOverviewStats,
  InspectionNoFullScanFilters,
  InspectionNoFullScanSelectOption,
  ViolationFineItem,
  AppealItem,
} from "./types";
import type { TablePaginationConfig } from "antd/es/table";
import type {
  SorterResult,
  TableCurrentDataSource,
} from "antd/es/table/interface";
import {
  getAccountOrIndividualOrEstablishment,
  type CustomerAccountOrProfileOverviewDto,
  type CustomerDetailsProfileDto,
} from "@/services/userManagement";
import {
  getCustomerProfileViolations,
  updateCustomerUserActive,
} from "@/services/customerManagement";
import {
  getFinancePaymentsCount,
  getFinancePaymentsCountSummary,
  type FinanceAccountPaymentsResponse,
  type FinancePaymentTransactionItem,
  type FinancePaymentsSummary,
} from "@/services/wallet";
import {
  applicationPageByProfile,
  getApplicationStatuses,
  getServiceConfigServiceType,
  type ApplicationPageByProfileItem,
  type ApplicationPageByProfileResponse,
  type IApplicationStatus,
  type IServiceType,
} from "@/services/application";
import {
  buildApplicationStatusOptions,
  buildApplicationTypeOptions,
  mapApplicationPageItemToOverviewRow,
  unwrapApplicationDictionaryItems,
  unwrapApplicationPageResponse,
} from "./components/allProfilesOverviewTabs/applicationFilterOptions";
import {
  getFinancePaymentsTotal,
  mapFinancePaymentItem,
  mapFinancePaymentsSummary,
  unwrapFinanceResponse,
} from "./components/allProfilesOverviewTabs/paymentUtils";
import {
  createEmptyLicenseStatistics,
  mapLicenseListResponse,
  mapLicenseStatistics,
} from "./components/allProfilesOverviewTabs/licenseUtils";
import {
  createEmptyTicketsStatusCount,
  mapAccountTicketsResponse,
  mapTicketsStatusCount,
  type NormalizedTicketsStatusCount,
} from "./components/allProfilesOverviewTabs/ticketUtils";
import {
  buildInspectionLookupOptions,
  buildInspectionPriorityOptions,
  buildInspectionStatusOptions,
  createEmptyInspectionOverviewStats,
  getInspectionNumberParam,
  mapInspectionProfileStats,
  mapInspectionProfileTaskListResponse,
} from "./components/allProfilesOverviewTabs/inspectionProfileUtils";
import {
  buildViolationFilterStatusOptions,
  createEmptyViolationStatusCounts,
  mapCustomerProfileViolationFilterStatusOptions,
  mapCustomerProfileViolationRows,
  mapCustomerProfileViolationStatusCounts,
} from "./components/allProfilesOverviewTabs/violationProfileUtils";
import {
  getEstablishmentlInfo,
  getLicenseManagementList,
  getPersonalInfo,
  getStatistics,
  type StatisticsResponseDto,
} from "@/services/license";
import { getAccountTickets, getTicketsStatusCount } from "@/services/tickets";
import { getProfileRefundsByUserProfile } from "@/services/refunds";
import { getInspectionProfileAppeals } from "@/services/inspectionAppeals";
import {
  getInspectionInspectors,
  getInspectionPriorities,
  getInspectionProfileTaskStats,
  getInspectionReasons,
  getInspectionTasksByUserProfile,
  getInspectionTaskStatuses,
  type InspectionLookupOption,
} from "@/services/inspection";
import { AuthenticatedDocumentAvatar } from "@/components/common/AuthenticatedDocumentMedia";
import AlertBanner from "@/components/common/AlertBanner";
import {
  createEmptyRefundOverviewStats,
  mapProfileRefundListResponse,
  mapProfileRefundStats,
  type RefundOverviewStats,
} from "./components/allProfilesOverviewTabs/refundProfileUtils";
import {
  createEmptyAppealOverviewStats,
  mapProfileAppealListResponse,
  mapProfileAppealStats,
  type AppealOverviewStats,
} from "./components/allProfilesOverviewTabs/appealProfileUtils";
import { useProfileAppealSearch } from "./components/allProfilesOverviewTabs/useProfileAppealSearch";
import AccountEmail from "@/assets/images/AccountEmail.svg";
import AccountMobile from "@/assets/images/AccountMobile.svg";
import AccountNational from "@/assets/images/AccountNationality.svg";
import AccountEmirateslD from "@/assets/images/AccountEmirateslD.svg";
import AccountFullName from "@/assets/images/AccountFullName.svg";
import { getViolationStatusLabel } from "@/pages/InspectionCommon/helpers";
import {
  createContactNumberSnapshot,
  getContactNumberDisplay,
} from "@/components/common/MobileNumberInput";

import AccountTotalRecharge from "@/assets/images/AccountTotalRecharge.svg";
import AccountTotalSpent from "@/assets/images/AccountTotalSpending.svg";
import AccountTotalRefunds from "@/assets/images/AccountTotalRefunds.svg";

import "./index.less";
import AED from "@/assets/icons/Aed";
import { formatMoney } from "@/utils/utils";
import { useTranslation } from "react-i18next";

const INITIAL_VISIBLE_PROFILE_COUNT = 9;
const LOAD_MORE_PROFILE_COUNT = 10;

const safeText = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    return value.trim() === "" ? "-" : value;
  }
  return String(value);
};

const getNumberParam = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeLower = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

const isIndividualProfileType = (value?: string | null) => {
  const v = normalizeLower(value);
  return v === "individual" || v.includes("individual");
};

const isCommercialProfileType = (value?: string | null) => {
  const v = normalizeLower(value);
  if (!v) return false;
  if (isIndividualProfileType(v)) return false;
  return true;
};

const normalizeApplicationStatus = (value?: string | null) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

const APPLICATION_PROCESSING_STATUSES = new Set([
  "initialapproval",
  "finalapproval",
  "externalapproval",
  "pendingreview",
  "underreview",
]);

const APPLICATION_REJECTED_STATUSES = new Set(["rejected"]);
const APPLICATION_CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);
const APPLICATION_COMPLETED_STATUSES = new Set([
  "approved",
  "completed",
  "rejected",
  "cancelled",
  "canceled",
]);

const countApplicationsByStatuses = (
  items: Array<{ status?: string | null }>,
  statuses: Set<string>,
) =>
  items.filter((item) => statuses.has(normalizeApplicationStatus(item.status)))
    .length;

type ApplicationOverviewStats = {
  total: number;
  licenses: number;
  content: number;
  processing: number;
  rejected: number;
  completed: number;
  cancelled: number;
};

type AllOverviewStatsTab =
  | "applications"
  | "payments"
  | "licenses"
  | "tickets"
  | "inspection"
  | "violations-fines"
  | "refunds"
  | "appeal";

type AllOverviewStatsCacheData = {
  applications?: ApplicationOverviewStats;
  payments?: PaymentCountStats | null;
  licenses?: StatisticsResponseDto;
  tickets?: NormalizedTicketsStatusCount;
  inspection?: InspectionOverviewStats;
  violationsFines?: {
    statusCounts: Record<string, number>;
    statusOptions: { label: string; value: string }[];
  };
  refunds?: RefundOverviewStats;
  appeal?: AppealOverviewStats;
};

const createEmptyApplicationOverviewStats = (): ApplicationOverviewStats => ({
  total: 0,
  licenses: 0,
  content: 0,
  processing: 0,
  rejected: 0,
  completed: 0,
  cancelled: 0,
});

const toSafeOverviewCount = (value: unknown, fallback = 0) => {
  const count = Number(value ?? fallback);
  return Number.isFinite(count) ? count : fallback;
};

const mapApplicationOverviewStats = (
  data: ApplicationPageByProfileResponse | null,
): ApplicationOverviewStats => {
  const items = (Array.isArray(data?.page?.items) ? data.page.items : []).filter(
    (item): item is ApplicationPageByProfileItem =>
      Boolean(item && typeof item === "object"),
  );
  const fallbackCompleted = countApplicationsByStatuses(
    items,
    APPLICATION_COMPLETED_STATUSES,
  );
  const fallbackRejected = countApplicationsByStatuses(
    items,
    APPLICATION_REJECTED_STATUSES,
  );
  const fallbackCancelled = countApplicationsByStatuses(
    items,
    APPLICATION_CANCELLED_STATUSES,
  );
  const fallbackProcessing = countApplicationsByStatuses(
    items,
    APPLICATION_PROCESSING_STATUSES,
  );

  return {
    total: toSafeOverviewCount(data?.report?.totalCount),
    licenses: toSafeOverviewCount(data?.report?.licenseCount),
    content: toSafeOverviewCount(data?.report?.contentCount),
    processing: toSafeOverviewCount(
      data?.report?.processingCount,
      fallbackProcessing,
    ),
    rejected: toSafeOverviewCount(
      data?.report?.rejectedCount,
      fallbackRejected,
    ),
    completed: toSafeOverviewCount(
      data?.report?.completedCount,
      fallbackCompleted,
    ),
    cancelled: toSafeOverviewCount(
      data?.report?.cancelledCount,
      fallbackCancelled,
    ),
  };
};

const buildAddressInfoItems = (addressInfo: any, t: Function): InfoItem[] => {
  if (!addressInfo) return [];
  const emirate =
    addressInfo?.emirateObj?.nameEn || addressInfo?.emirateObj?.nameAr;
  const region =
    addressInfo?.regionObj?.nameEn || addressInfo?.regionObj?.nameAr;
  const area = addressInfo?.areaObj?.nameEn || addressInfo?.areaObj?.nameAr;
  const street =
    addressInfo?.streetObj?.nameEn || addressInfo?.streetObj?.nameAr;

  const items: InfoItem[] = [];
  if (emirate)
    items.push({
      key: "emirate",
      label: t("Customer.customerDetails.addressInfo.emirate"),
      value: emirate,
    });
  if (region)
    items.push({
      key: "region",
      label: t("Customer.customerDetails.addressInfo.region"),
      value: region,
    });
  if (area)
    items.push({
      key: "area",
      label: t("Customer.customerDetails.addressInfo.area"),
      value: area,
    });
  if (street)
    items.push({
      key: "street",
      label: t("Customer.customerDetails.addressInfo.street"),
      value: street,
    });
  return items;
};

const buildPersonalInfoItems = (personal: any, t: Function): InfoItem[] => {
  if (!personal) return [];
  const getIdTypeLabel = () => {
    if (personal?.identityTypeObj?.id === 1)
      return t("Customer.customerDetails.personalInfo.emiratesId");
    if (personal?.identityTypeObj?.id === 2)
      return t("Customer.customerDetails.personalInfo.uid");
    return t("Customer.customerDetails.personalInfo.passportNumber");
  };
  return [
    {
      key: "full-name-en",
      label: t("Customer.customerDetails.personalInfo.fullNameEn"),
      value: personal?.nameEn || "-",
    },
    {
      key: "full-name-ar",
      label: t("Customer.customerDetails.personalInfo.fullNameAr"),
      value: personal?.nameAr || "-",
    },

    {
      key: getIdTypeLabel(),
      label: getIdTypeLabel(),
      value:
        personal?.identityTypeObj?.id === 1
          ? personal?.emiratesId || "-"
          : personal?.identityTypeObj?.id === 2
          ? personal?.uid || "-"
          : personal?.passportNumber || "-",
    },
    {
      key: "nationality",
      label: t("Customer.customerDetails.personalInfo.nationality"),
      value:
        personal?.nationalityObj?.nameEn ||
        personal?.nationalityObj?.nameAr ||
        "-",
    },
    {
      key: "gender",
      label: t("Customer.customerDetails.personalInfo.gender"),
      value: personal?.genderObj?.nameEn || personal?.genderObj?.nameAr || "-",
    },
    {
      key: "occupation",
      label: t("Customer.customerDetails.personalInfo.occupation"),
      value: personal?.occupation || "-",
    },
    {
      key: "date-birth",
      label: t("Customer.customerDetails.personalInfo.dateOfBirth"),
      value: personal?.birthDate
        ? dayjs(personal.birthDate).format("DD/MM/YYYY")
        : "-",
    },
    {
      key: "expiry",
      label: t("Customer.customerDetails.personalInfo.expiryDate"),
      value: personal?.passportExpiryDate
        ? dayjs(personal.passportExpiryDate).format("DD/MM/YYYY")
        : personal?.emiratesIdexpiryDate
        ? dayjs(personal.emiratesIdexpiryDate).format("DD/MM/YYYY")
        : personal?.uidExpiryDate
        ? dayjs(personal.uidExpiryDate).format("DD/MM/YYYY")
        : "-",
    },
  ];
};

const buildDocumentItemsFromPersonal = (
  docs: any,
  t: Function,
): DocumentItem[] => {
  if (!docs) return [];
  const items: DocumentItem[] = [];
  if (docs?.photoUrl)
    items.push({
      key: "personal-photo",
      label: t("Customer.customerDetails.documents.personalPhoto"),
      url: docs.photoUrl,
    });
  if (docs?.emiratesIdCopyUrl)
    items.push({
      key: "emirates-id",
      label: t("Customer.customerDetails.documents.emiratesId"),
      url: docs.emiratesIdCopyUrl,
    });
  if (docs?.passportCopyUrl)
    items.push({
      key: "passport",
      label: t("Customer.customerDetails.documents.passport"),
      url: docs.passportCopyUrl,
    });
  if (docs?.acquitanceFormUrl)
    items.push({
      key: "acquaintance",
      label: t("Customer.customerDetails.documents.acquaintanceForm"),
      url: docs.acquitanceFormUrl,
    });
  if (docs?.tradeLicenseCopyUrl)
    items.push({
      key: "trade-license",
      label: t("Customer.customerDetails.documents.tradeLicense"),
      url: docs.tradeLicenseCopyUrl,
    });
  return items;
};

const buildDocumentItemsFromEstablishment = (
  docs: any,
  t: Function,
): DocumentItem[] => {
  if (!docs) return [];
  const items: DocumentItem[] = [];
  if (docs?.licenseCopyUrl)
    items.push({
      key: "license-copy",
      label: t("Customer.customerDetails.documents.licenseCopy"),
      url: docs.licenseCopyUrl,
    });
  if (docs?.tenancyContractCopyUrl)
    items.push({
      key: "tenancy",
      label: t("Customer.customerDetails.documents.tenancyContract"),
      url: docs.tenancyContractCopyUrl,
    });
  if (docs?.memorandumOfAssociationCopyUrl)
    items.push({
      key: "moa",
      label: t("Customer.customerDetails.documents.memorandumOfAssociation"),
      url: docs.memorandumOfAssociationCopyUrl,
    });
  if (docs?.powerOfAttorneyCopyUrl)
    items.push({
      key: "poa",
      label: t("Customer.customerDetails.documents.powerOfAttorney"),
      url: docs.powerOfAttorneyCopyUrl,
    });
  return items;
};

const CustomerDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const history = useHistory();
  const { canRenderButton } = useButtonPermission(
    "/happiness/customerManagement/customer-details",
  );
  const canManageAccount = canRenderButton(
    "CustomerModule.Customers.CustomerDetails.Confirm",
  );
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const customerId = useMemo(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return null;
    return idParam;
  }, [searchParams]);

  const [loading, setLoading] = useState(false);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [activateModalVisible, setActivateModalVisible] = useState(false);
  const [suspendModalLoading, setSuspendModalLoading] = useState(false);
  const [activateModalLoading, setActivateModalLoading] = useState(false);
  const [suspendNotes, setSuspendNotes] = useState("");
  const [suspendNotesError, setSuspendNotesError] = useState("");
  const [profileSearchKey, setProfileSearchKey] = useState("");
  const [visibleProfileCount, setVisibleProfileCount] = useState(
    INITIAL_VISIBLE_PROFILE_COUNT,
  );
  const [activeTab, setActiveTab] = useState("applications");

  const [licensesLoading, setLicensesLoading] = useState(false);
  const [licensesRows, setLicensesRows] = useState<LicenseItem[]>([]);
  const [licensesStatus, setLicensesStatus] = useState<string | undefined>(
    undefined,
  );
  const [licensesIssuanceDateStart, setLicensesIssuanceDateStart] =
    useState<string | undefined>(undefined);
  const [licensesIssuanceDateEnd, setLicensesIssuanceDateEnd] = useState<
    string | undefined
  >(undefined);
  const [licensesStatistics, setLicensesStatistics] =
    useState<StatisticsResponseDto>(createEmptyLicenseStatistics);
  const [licensesPagination, setLicensesPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "issuanceTime" as string | undefined,
    sortDirection: 1 as number | undefined,
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string>("all");
  const [profileOverviewTab, setProfileOverviewTab] = useState("basic");
  const [allOverviewSearchKey, setAllOverviewSearchKey] = useState("");
  const [allOverviewType, setAllOverviewType] = useState<string | undefined>(
    undefined,
  );
  const [applicationsStatusId, setApplicationsStatusId] = useState<
    string | undefined
  >(undefined);
  const [applicationsStartDate, setApplicationsStartDate] = useState<
    string | undefined
  >(undefined);
  const [applicationsEndDate, setApplicationsEndDate] = useState<
    string | undefined
  >(undefined);
  const [allOverviewTypeOptions, setAllOverviewTypeOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [applicationsStatusOptions, setApplicationsStatusOptions] = useState<
    { label: string; value: string }[]
  >([{ label: t("Customer.customerDetails.common.allStatuses"), value: "" }]);

  const [paymentsTransactionTypeId, setPaymentsTransactionTypeId] = useState<
    string | undefined
  >(undefined);
  const [paymentsStatusId, setPaymentsStatusId] = useState<string | undefined>(
    undefined,
  );
  const paymentsTransactionTypeOptions = useMemo(
    () => [
      { label: t("Customer.customerDetails.common.allTypes"), value: "" },
      {
        label: t("Customer.customerDetails.tabs.payments.serviceApplication"),
        value: "2",
      },
      { label: t("Customer.customerDetails.tabs.payments.fines"), value: "3" },
      { label: t("Customer.customerDetails.tabs.payments.refund"), value: "4" },
    ],
    [t],
  );
  const paymentsStatusOptions = useMemo(
    () => [
      { label: t("Customer.customerDetails.common.allStatuses"), value: "" },
      { label: t("customStatusTag.completed"), value: "3" },
      { label: t("customStatusTag.failedRefund"), value: "8" },
      { label: t("customStatusTag.failed"), value: "4" },
      { label: t("customStatusTag.refunded"), value: "7" },
    ],
    [t],
  );
  const paymentsPaymentMethodOptions = useMemo(
    () => [
      {
        label: t("Customer.customerDetails.tabs.payments.allPaymentMethod"),
        value: "",
      },
      { label: t("Customer.customerDetails.tabs.payments.wallet"), value: "9" },
      {
        label: t("Customer.customerDetails.tabs.payments.creditDebitCard"),
        value: "8",
      },
    ],
    [t],
  );
  const [paymentsPaymentMethodId, setPaymentsPaymentMethodId] = useState<
    string | undefined
  >(undefined);

  const [paymentsStartDate, setPaymentsStartDate] = useState<
    string | undefined
  >(undefined);
  const [paymentsEndDate, setPaymentsEndDate] = useState<string | undefined>(
    undefined,
  );

  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsStats, setApplicationsStats] =
    useState<ApplicationOverviewStats>(createEmptyApplicationOverviewStats);
  const [inspectionTasksNoFullScan, setInspectionTasksNoFullScan] = useState<
    InspectionOverviewItem[]
  >([]);
  const [inspectionStatsNoFullScan, setInspectionStatsNoFullScan] =
    useState<InspectionOverviewStats>(createEmptyInspectionOverviewStats);
  const [inspectionNoFullScanLoading, setInspectionNoFullScanLoading] =
    useState(false);
  const [inspectionNoFullScanPagination, setInspectionNoFullScanPagination] =
    useState({
      pageIndex: 1,
      pageSize: 10,
      total: 0,
      sortBy: "AssignedOn" as const,
      sortDirection: "desc" as "asc" | "desc",
    });
  const [inspectionNoFullScanFilters, setInspectionNoFullScanFilters] =
    useState<InspectionNoFullScanFilters>({});
  const [violationsFinesRows, setViolationsFinesRows] = useState<
    ViolationFineItem[]
  >([]);
  const [violationsFinesLoading, setViolationsFinesLoading] = useState(false);
  const [violationsFinesStatusCounts, setViolationsFinesStatusCounts] =
    useState<Record<string, number>>(createEmptyViolationStatusCounts);
  const [violationsFinesStatusOptions, setViolationsFinesStatusOptions] =
    useState<{ label: string; value: string }[]>(
      buildViolationFilterStatusOptions,
    );
  const [violationsFinesTypeId, setViolationsFinesTypeId] = useState<
    string | undefined
  >(undefined);
  const [violationsFinesStatusId, setViolationsFinesStatusId] = useState<
    string | undefined
  >(undefined);
  const [violationsFinesStartTime, setViolationsFinesStartTime] = useState<
    string | undefined
  >(undefined);
  const [violationsFinesEndTime, setViolationsFinesEndTime] = useState<
    string | undefined
  >(undefined);
  const [violationsFinesPaidTimeFrom, setViolationsFinesPaidTimeFrom] =
    useState<string | undefined>(undefined);
  const [violationsFinesPaidTimeTo, setViolationsFinesPaidTimeTo] = useState<
    string | undefined
  >(undefined);
  const [appealRows, setAppealRows] = useState<AppealItem[]>([]);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealStatusCounts, setAppealStatusCounts] =
    useState<AppealOverviewStats>(createEmptyAppealOverviewStats);
  const [appealStatusId, setAppealStatusId] = useState<string | undefined>(
    undefined,
  );
  const [appealStartTime, setAppealStartTime] = useState<string | undefined>(
    undefined,
  );
  const [appealEndTime, setAppealEndTime] = useState<string | undefined>(
    undefined,
  );
  const [
    inspectionNoFullScanReasonOptions,
    setInspectionNoFullScanReasonOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>([]);
  const [
    inspectionNoFullScanStatusOptions,
    setInspectionNoFullScanStatusOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>(
    buildInspectionStatusOptions(
      [],
      i18n.language.toLowerCase().startsWith("ar"),
      t,
    ),
  );
  const [
    inspectionNoFullScanPriorityOptions,
    setInspectionNoFullScanPriorityOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>(
    buildInspectionPriorityOptions(
      [],
      i18n.language.toLowerCase().startsWith("ar"),
      t,
    ),
  );
  const [
    inspectionNoFullScanInspectorOptions,
    setInspectionNoFullScanInspectorOptions,
  ] = useState<InspectionNoFullScanSelectOption[]>([]);

  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsRows, setTicketsRows] = useState<TicketItem[]>([]);
  const [ticketsPagination, setTicketsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "updatedOn" as string | undefined,
    sortDirection: 1 as 0 | 1 | undefined,
  });
  const [ticketsStatusCount, setTicketsStatusCount] =
    useState<NormalizedTicketsStatusCount>(createEmptyTicketsStatusCount);
  const [ticketsEnquiryStatusId, setTicketsEnquiryStatusId] = useState<
    string | undefined
  >(undefined);
  const [ticketsEnquiryType, setTicketsEnquiryType] = useState<
    string | undefined
  >(undefined);
  const [ticketsPriorityId, setTicketsPriorityId] = useState<
    string | undefined
  >(undefined);
  const [ticketsStartTime, setTicketsStartTime] = useState<string | undefined>(
    undefined,
  );
  const [ticketsEndTime, setTicketsEndTime] = useState<string | undefined>(
    undefined,
  );

  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsRows, setRefundsRows] = useState<RefundItem[]>([]);
  const [refundsPagination, setRefundsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "UpdateOn" as string | undefined,
    sortDirection: 1 as 0 | 1 | undefined,
  });
  const [refundsCategory, setRefundsCategory] = useState<string | undefined>(
    undefined,
  );
  const [refundsStatusId, setRefundsStatusId] = useState<string | undefined>(
    undefined,
  );
  const [refundsStartTime, setRefundsStartTime] = useState<string | undefined>(
    undefined,
  );
  const [refundsEndTime, setRefundsEndTime] = useState<string | undefined>(
    undefined,
  );
  const [refundsStatusCount, setRefundsStatusCount] =
    useState<RefundOverviewStats>(createEmptyRefundOverviewStats);

  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsStats, setPaymentsStats] = useState<PaymentCountStats | null>(
    null,
  );
  const [paymentsRows, setPaymentsRows] = useState<PaymentItem[]>([]);
  const [paymentsPagination, setPaymentsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "transactionTime" as string | undefined,
    sortDirection: 1 as 0 | 1 | undefined,
  });
  const [applicationsRows, setApplicationsRows] = useState<OverviewRowItem[]>(
    [],
  );
  const allOverviewStatsCacheRef = useRef<{
    customerId: string | null;
    loaded: Set<AllOverviewStatsTab>;
    loading: Set<AllOverviewStatsTab>;
    data: AllOverviewStatsCacheData;
  }>({
    customerId,
    loaded: new Set<AllOverviewStatsTab>(),
    loading: new Set<AllOverviewStatsTab>(),
    data: {},
  });
  const allOverviewStatsMountedRef = useRef(true);
  const selectedProfileIdRef = useRef(selectedProfileId);
  const activeTabRef = useRef(activeTab);

  selectedProfileIdRef.current = selectedProfileId;
  activeTabRef.current = activeTab;

  useEffect(() => {
    return () => {
      allOverviewStatsMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    allOverviewStatsCacheRef.current = {
      customerId,
      loaded: new Set<AllOverviewStatsTab>(),
      loading: new Set<AllOverviewStatsTab>(),
      data: {},
    };
    setApplicationsStats(createEmptyApplicationOverviewStats());
    setPaymentsStats(null);
    setLicensesStatistics(createEmptyLicenseStatistics());
    setTicketsStatusCount(createEmptyTicketsStatusCount());
    setInspectionStatsNoFullScan(createEmptyInspectionOverviewStats());
    setViolationsFinesStatusCounts(createEmptyViolationStatusCounts());
    setViolationsFinesStatusOptions(buildViolationFilterStatusOptions());
    setRefundsStatusCount(createEmptyRefundOverviewStats());
    setAppealStatusCounts(createEmptyAppealOverviewStats());
  }, [customerId]);

  const beginAllOverviewStatsLoad = useCallback(
    (tab: AllOverviewStatsTab) => {
      if (!customerId) return false;

      const cache = allOverviewStatsCacheRef.current;
      if (cache.customerId !== customerId) {
        allOverviewStatsCacheRef.current = {
          customerId,
          loaded: new Set<AllOverviewStatsTab>(),
          loading: new Set<AllOverviewStatsTab>(),
          data: {},
        };
      }

      const currentCache = allOverviewStatsCacheRef.current;
      if (currentCache.loaded.has(tab) || currentCache.loading.has(tab)) {
        return false;
      }

      currentCache.loading.add(tab);
      return true;
    },
    [customerId],
  );

  const finishAllOverviewStatsLoad = useCallback(
    (
      tab: AllOverviewStatsTab,
      requestCustomerId: string,
      succeeded: boolean,
    ) => {
      const cache = allOverviewStatsCacheRef.current;
      if (
        !allOverviewStatsMountedRef.current ||
        cache.customerId !== requestCustomerId
      ) {
        return false;
      }

      cache.loading.delete(tab);
      if (succeeded) {
        cache.loaded.add(tab);
      }
      return true;
    },
    [],
  );

  const handleRefundsTableChange = useCallback(
    (p: TablePaginationConfig, sorter: any) => {
      const nextCurrent = Number(p.current || 1);
      const nextSize = Number(p.pageSize || 10);

      const s = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = (s as any)?.order as "ascend" | "descend" | undefined;
      const field =
        ((s as any)?.field as string | undefined) ||
        ((s as any)?.columnKey as string | undefined);

      const nextSortBy =
        field === "lastUpdated" || field === "requestDate"
          ? "UpdateOn"
          : field || "UpdateOn";

      setRefundsPagination((prev) => ({
        ...prev,
        pageIndex: nextCurrent,
        pageSize: nextSize,
        sortBy: order ? nextSortBy : "UpdateOn",
        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
      }));
    },
    [],
  );
  const handleInspectionNoFullScanTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter:
        | SorterResult<InspectionOverviewItem>
        | SorterResult<InspectionOverviewItem>[],
    ) => {
      const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = currentSorter?.order as
        | "ascend"
        | "descend"
        | undefined;

      setInspectionNoFullScanPagination((prev) => ({
        ...prev,
        pageIndex: Number(pagination.current || prev.pageIndex),
        pageSize: Number(pagination.pageSize || prev.pageSize),
        sortBy: "AssignedOn",
        sortDirection: order === "ascend" ? "asc" : "desc",
      }));
    },
    [],
  );
  const handleInspectionNoFullScanFiltersChange = useCallback(
    (filters: InspectionNoFullScanFilters) => {
      setInspectionNoFullScanFilters(filters);
      setInspectionNoFullScanPagination((prev) => ({
        ...prev,
        pageIndex: 1,
      }));
    },
    [],
  );

  const handleInspectionNoFullScanReset = useCallback(() => {
    if (selectedProfileId === "all") {
      setAllOverviewSearchKey("");
    } else {
      setCommercialOverviewSearchKey("");
    }
    setInspectionNoFullScanFilters({});
    setInspectionNoFullScanPagination((prev) => ({
      ...prev,
      pageIndex: 1,
      sortBy: "AssignedOn",
      sortDirection: "desc",
    }));
  }, [selectedProfileId]);

  const handleViolationsFinesReset = useCallback(() => {
    if (selectedProfileId === "all") {
      setAllOverviewSearchKey("");
    } else {
      setCommercialOverviewSearchKey("");
    }
    setViolationsFinesTypeId(undefined);
    setViolationsFinesStatusId(undefined);
    setViolationsFinesStartTime(undefined);
    setViolationsFinesEndTime(undefined);
    setViolationsFinesPaidTimeFrom(undefined);
    setViolationsFinesPaidTimeTo(undefined);
  }, [selectedProfileId]);

  const handleRefundsReset = useCallback(() => {
    if (selectedProfileId === "all") {
      setAllOverviewSearchKey("");
    } else {
      setCommercialOverviewSearchKey("");
    }
    setRefundsCategory(undefined);
    setRefundsStatusId(undefined);
    setRefundsStartTime(undefined);
    setRefundsEndTime(undefined);
    setRefundsPagination((prev) => ({
      ...prev,
      pageIndex: 1,
      sortBy: "UpdateOn",
      sortDirection: 1,
    }));
  }, [selectedProfileId]);

  const [applicationsPagination, setApplicationsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "lastUpdatedTime" as const,
    sortDirection: 1 as 0 | 1,
  });

  const [commercialOverviewSearchKey, setCommercialOverviewSearchKey] =
    useState("");
  const [commercialOverviewType, setCommercialOverviewType] = useState<
    string | undefined
  >(undefined);
  const [commercialApplicationsStatusId, setCommercialApplicationsStatusId] =
    useState<string | undefined>(undefined);
  const [commercialApplicationsStartDate, setCommercialApplicationsStartDate] =
    useState<string | undefined>(undefined);
  const [commercialApplicationsEndDate, setCommercialApplicationsEndDate] =
    useState<string | undefined>(undefined);

  const [commercialApplicationsLoading, setCommercialApplicationsLoading] =
    useState(false);
  const [commercialApplicationsStats, setCommercialApplicationsStats] =
    useState({
      total: 0,
      licenses: 0,
      content: 0,
      processing: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0,
    });
  const [commercialApplicationsRows, setCommercialApplicationsRows] = useState<
    OverviewRowItem[]
  >([]);
  const [
    commercialApplicationsPagination,
    setCommercialApplicationsPagination,
  ] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "lastUpdatedTime" as const,
    sortDirection: 1 as 0 | 1,
  });

  const [commercialPaymentsLoading, setCommercialPaymentsLoading] =
    useState(false);
  const [commercialPaymentsStats, setCommercialPaymentsStats] =
    useState<PaymentCountStats | null>(null);
  const [commercialPaymentsRows, setCommercialPaymentsRows] = useState<
    PaymentItem[]
  >([]);
  const [commercialPaymentsPagination, setCommercialPaymentsPagination] =
    useState({
      pageIndex: 1,
      pageSize: 10,
      total: 0,
      sortBy: "transactionTime" as string | undefined,
      sortDirection: 1 as 0 | 1 | undefined,
    });
  const [
    commercialPaymentsTransactionTypeId,
    setCommercialPaymentsTransactionTypeId,
  ] = useState<string | undefined>(undefined);
  const [commercialPaymentsStatusId, setCommercialPaymentsStatusId] = useState<
    string | undefined
  >(undefined);
  const [commercialPaymentsPaymentMethodId, setCommercialPaymentsPaymentMethodId] =
    useState<string | undefined>(undefined);
  const [commercialPaymentsStartDate, setCommercialPaymentsStartDate] =
    useState<string | undefined>(undefined);
  const [commercialPaymentsEndDate, setCommercialPaymentsEndDate] = useState<
    string | undefined
  >(undefined);

  const [commercialLicensesLoading, setCommercialLicensesLoading] =
    useState(false);
  const [commercialLicensesRows, setCommercialLicensesRows] = useState<
    LicenseItem[]
  >([]);
  const [commercialLicensesStatus, setCommercialLicensesStatus] = useState<
    string | undefined
  >(undefined);
  const [
    commercialLicensesIssuanceDateStart,
    setCommercialLicensesIssuanceDateStart,
  ] = useState<string | undefined>(undefined);
  const [
    commercialLicensesIssuanceDateEnd,
    setCommercialLicensesIssuanceDateEnd,
  ] = useState<string | undefined>(undefined);
  const [commercialLicensesStatistics, setCommercialLicensesStatistics] =
    useState<StatisticsResponseDto>(createEmptyLicenseStatistics);
  const [commercialLicensesPagination, setCommercialLicensesPagination] =
    useState({
      pageIndex: 1,
      pageSize: 10,
      total: 0,
      sortBy: "issuanceTime" as string | undefined,
      sortDirection: 1 as number | undefined,
    });

  const [customerOverview, setCustomerOverview] =
    useState<CustomerAccountOrProfileOverviewDto | null>(null);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);

  const [basicLoading, setBasicLoading] = useState(false);
  const [basicPersonalInfo, setBasicPersonalInfo] = useState<InfoItem[]>([]);
  const [basicAddressInfo, setBasicAddressInfo] = useState<InfoItem[]>([]);
  const [basicDocuments, setBasicDocuments] = useState<DocumentItem[]>([]);

  const [commercialEstablishmentData, setCommercialEstablishmentData] =
    useState<{
      establishment?: any;
      documentInfo?: any;
      legalPersonal?: any;
      addressInfo?: any;
      partnerList?: any[];
    } | null>(null);

  const hasAvatar = useMemo(() => {
    const photo = customerOverview?.photoUrl;
    return Boolean(photo && photo.trim());
  }, [customerOverview?.photoUrl]);

  const accountStatusText = useMemo(
    () => normalizeLower(customerOverview?.isActiveInfo),
    [customerOverview?.isActiveInfo],
  );

  const isAccountActive = useMemo(
    () =>
      accountStatusText
        ? accountStatusText === "active"
        : customerOverview?.isActive === true,
    [accountStatusText, customerOverview?.isActive],
  );

  const isSuspended = useMemo(
    () => accountStatusText === "suspended",
    [accountStatusText],
  );

  const quickNotes = useMemo(
    () => [
      t("Customer.accounts.modals.quickNote1"),
      t("Customer.accounts.modals.quickNote2"),
      t("Customer.accounts.modals.quickNote3"),
      t("Customer.accounts.modals.quickNote4"),
    ],
    [t],
  );

  const reloadCustomerDetails = useCallback(async () => {
    if (!customerId) return;

    try {
      const res = await getAccountOrIndividualOrEstablishment({
        userId: customerId,
        keyWorld: profileSearchKey,
      });

      if (!res?.isSuccess || !res.data) {
        return;
      }

      setCustomerOverview(res.data);

      const mappedProfiles: ProfileItem[] = (res.data.profileList || []).map(
        (p: CustomerDetailsProfileDto) => {
          const profileNameEn = safeText(p.nameEn);
          const profileNameAr = safeText(p.nameAr);
          const tier = (p.isVipInfo || "Standard") as string;
          const profileType = safeText(p.userTypeName);

          return {
            id: String(p.profileId),
            profileId: String(p.profileId),
            selfMonitorProgram: p.selfMonitorProgram,
            photoUrl:
              typeof p.photoUrl === "string" ? p.photoUrl : undefined,
            emiratesId:
              safeText(p.emiratesId) ||
              safeText(p.uid) ||
              safeText(p.passportNumber),
            profileName: profileNameEn,
            profileNameAr,
            profileType,
            userTypeCode: safeText(p.userTypeCode),
            emirate: "-",
            status: safeText(p.status),
            tier,
            stats: {
              apps: Number(p.apps || 0),
              tickets: Number(p.tickets || 0),
              refund: Number(p.refund || 0),
              appeal: Number(p.appeal || 0),
              violations: Number(p.violations || 0),
              fines: Number(p.fines || 0),
            },
            createdTime: dayjs().toISOString(),
          };
        },
      );

      setProfiles(mappedProfiles);
    } catch (e) {
      console.error(e);
    }
  }, [customerId, profileSearchKey]);

  useEffect(() => {
    if (!customerId) {
      message.error(
        t("Customer.customerDetails.messages.invalidCustomerIdentifier"),
      );
      history.replace("/happiness/customerManagement");
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await getAccountOrIndividualOrEstablishment({
          userId: customerId,
          keyWorld: profileSearchKey,
        });

        if (cancelled) return;
        if (!res?.isSuccess || !res.data) {
          console.error("Customer data request was rejected:", res);
          message.error(
            t("Customer.accounts.messages.failedToLoadCustomerData"),
          );
          setCustomerOverview(null);
          setProfiles([]);
          return;
        }

        setCustomerOverview(res.data);

        const mappedProfiles: ProfileItem[] = (res.data.profileList || []).map(
          (p: CustomerDetailsProfileDto) => {
            const profileNameEn = safeText(p.nameEn);
            const profileNameAr = safeText(p.nameAr);
            const tier = (p.isVipInfo || "Standard") as string;
            const profileType = safeText(p.userTypeName);

            return {
              id: String(p.profileId),
              profileId: String(p.profileId),
              selfMonitorProgram: p.selfMonitorProgram,
              photoUrl:
                typeof p.photoUrl === "string" ? p.photoUrl : undefined,
              profileName: profileNameEn,
              profileNameAr,
              profileType,
              userTypeCode: safeText(p.userTypeCode),
              emirate: "-",
              emiratesId:
                safeText(p.emiratesId) ||
                safeText(p.uid) ||
                safeText(p.passportNumber),
              status: safeText(p.status),
              tier,
              stats: {
                apps: Number(p.apps || 0),
                tickets: Number(p.tickets || 0),
                refund: Number(p.refund || 0),
                appeal: Number(p.appeal || 0),
                violations: Number(p.violations || 0),
                fines: Number(p.fines || 0),
              },
              createdTime: dayjs().toISOString(),
            };
          },
        );

        setProfiles(mappedProfiles);
      } catch (e: any) {
        if (cancelled) return;
        console.error(e);
        message.error(t("Customer.accounts.messages.failedToLoadCustomerData"));
        setCustomerOverview(null);
        setProfiles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [customerId, history]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "licenses") return;

    let cancelled = false;
    const run = async () => {
      setLicensesLoading(true);
      try {
        const listRes = await getLicenseManagementList({
          pageSize: licensesPagination.pageSize,
          pageIndex: licensesPagination.pageIndex,
          sortBy: licensesPagination.sortBy || "issuanceTime",
          sortDirection: licensesPagination.sortDirection ?? 1,
          keyword: allOverviewSearchKey || undefined,
          status: licensesStatus || undefined,
          issuanceDateStart: licensesIssuanceDateStart || undefined,
          issuanceDateEnd: licensesIssuanceDateEnd || undefined,
          userId: customerId,
          // profileId: 0,
        });

        if (cancelled) return;

        const listData = mapLicenseListResponse(listRes, i18n.language);
        setLicensesRows(listData.items);
        setLicensesPagination((prev) => ({
          ...prev,
          total: listData.total,
        }));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        message.error(
          t("Customer.customerDetails.common.failedToLoadLicenses"),
        );
        setLicensesRows([]);
        setLicensesPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setLicensesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    allOverviewSearchKey,
    customerId,
    licensesPagination.pageIndex,
    licensesPagination.pageSize,
    licensesPagination.sortBy,
    licensesPagination.sortDirection,
    licensesIssuanceDateStart,
    licensesIssuanceDateEnd,
    licensesStatus,
    selectedProfileId,
    i18n.language,
    t,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "licenses") return;

    const cache = allOverviewStatsCacheRef.current;
    if (cache.customerId === customerId && cache.loaded.has("licenses")) {
      setLicensesStatistics(
        cache.data.licenses ?? createEmptyLicenseStatistics(),
      );
      return;
    }
    if (!beginAllOverviewStatsLoad("licenses")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await getStatistics(customerId);
        const nextStats = mapLicenseStatistics(response);
        if (
          !finishAllOverviewStatsLoad(
            "licenses",
            requestCustomerId,
            true,
          )
        ) {
          return;
        }
        allOverviewStatsCacheRef.current.data.licenses = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "licenses"
        ) {
          setLicensesStatistics(nextStats);
        }
      } catch (error) {
        if (
          !finishAllOverviewStatsLoad(
            "licenses",
            requestCustomerId,
            false,
          )
        ) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "licenses"
        ) {
          setLicensesStatistics(createEmptyLicenseStatistics());
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (!customerId) return;
    const isTicketsTabActive =
      selectedProfileId === "all"
        ? activeTab === "tickets"
        : profileOverviewTab === "tickets";

    if (!isTicketsTabActive) return;

    const profileNumericId =
      selectedProfileId !== "all"
        ? (() => {
            const profile = profiles.find((p) => p.id === selectedProfileId);
            const id = Number(profile?.profileId);
            return Number.isFinite(id) ? id : null;
          })()
        : null;
    const ticketsSearchKey =
      selectedProfileId === "all"
        ? allOverviewSearchKey
        : commercialOverviewSearchKey;
    if (selectedProfileId !== "all" && !profileNumericId) {
      setTicketsLoading(false);
      setTicketsRows([]);
      setTicketsPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }

    let cancelled = false;
    const run = async () => {
      setTicketsLoading(true);
      try {
        const shouldSkipEnquiryStatusId = String(
          ticketsEnquiryStatusId ?? "",
        )
          .split(",")
          .some((statusId) => statusId.trim() === "10");
        const res = await getAccountTickets({
          UserId: customerId,
          UserProfileId:
            selectedProfileId !== "all"
              ? profileNumericId ?? undefined
              : undefined,
          SearchKey: ticketsSearchKey || undefined,
          StartTime: ticketsStartTime || undefined,
          EndTime: ticketsEndTime || undefined,
          EnquiryType: ticketsEnquiryType
            ? Number(ticketsEnquiryType)
            : undefined,
          EnquiryStatusId: ticketsEnquiryStatusId && !shouldSkipEnquiryStatusId
            ? ticketsEnquiryStatusId
            : undefined,
          PriorityId: ticketsPriorityId
            ? Number(ticketsPriorityId)
            : undefined,
          PageIndex: ticketsPagination.pageIndex,
          PageSize: ticketsPagination.pageSize,
          SortBy: ticketsPagination.sortBy || "updatedOn",
          SortDirection: ticketsPagination.sortDirection ?? 1,
        });

        if (cancelled) return;

        const data = mapAccountTicketsResponse(res, i18n.language, t);
        setTicketsRows(data.items);

        setTicketsPagination((prev) => ({
          ...prev,
          total: data.total,
        }));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setTicketsRows([]);
        setTicketsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setTicketsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    allOverviewSearchKey,
    commercialOverviewSearchKey,
    customerId,
    i18n.language,
    profiles,
    selectedProfileId,
    profileOverviewTab,
    ticketsEnquiryStatusId,
    ticketsEnquiryType,
    ticketsPriorityId,
    ticketsStartTime,
    ticketsEndTime,
    ticketsPagination.pageIndex,
    ticketsPagination.pageSize,
    ticketsPagination.sortBy,
    ticketsPagination.sortDirection,
    t,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "tickets") return;

    const cache = allOverviewStatsCacheRef.current;
    if (cache.customerId === customerId && cache.loaded.has("tickets")) {
      setTicketsStatusCount(
        cache.data.tickets ?? createEmptyTicketsStatusCount(),
      );
      return;
    }
    if (!beginAllOverviewStatsLoad("tickets")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await getTicketsStatusCount({
          _userId: customerId,
        });
        const nextStats = mapTicketsStatusCount(response);
        if (
          !finishAllOverviewStatsLoad("tickets", requestCustomerId, true)
        ) {
          return;
        }
        allOverviewStatsCacheRef.current.data.tickets = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "tickets"
        ) {
          setTicketsStatusCount(nextStats);
        }
      } catch (error) {
        if (
          !finishAllOverviewStatsLoad("tickets", requestCustomerId, false)
        ) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "tickets"
        ) {
          setTicketsStatusCount(createEmptyTicketsStatusCount());
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (!customerId) {
      setTicketsStatusCount(createEmptyTicketsStatusCount());
      return;
    }
    if (selectedProfileId === "all") return;
    if (profileOverviewTab !== "tickets") return;

    const profileNumericId =
      (() => {
        const profile = profiles.find((p) => p.id === selectedProfileId);
        const id = Number(profile?.profileId);
        return Number.isFinite(id) ? id : null;
      })();
    if (!profileNumericId) {
      setTicketsStatusCount(createEmptyTicketsStatusCount());
      return;
    }

    setTicketsStatusCount(createEmptyTicketsStatusCount());
    let cancelled = false;
    const run = async () => {
      try {
        const payloadParams = {
          _userId: customerId,
          _profileId: profileNumericId ?? undefined,
        };

        const res = await getTicketsStatusCount(payloadParams);
        if (cancelled) return;

        setTicketsStatusCount(mapTicketsStatusCount(res));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setTicketsStatusCount(createEmptyTicketsStatusCount());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [profileOverviewTab, customerId, profiles, selectedProfileId]);

  useEffect(() => {
    if (!customerId) {
      setRefundsLoading(false);
      setRefundsRows([]);
      setRefundsPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }
    const isRefundsTabActive =
      selectedProfileId === "all"
        ? activeTab === "refunds"
        : profileOverviewTab === "refunds";
    if (!isRefundsTabActive) {
      setRefundsLoading(false);
      return;
    }

    const profileNumericId =
      selectedProfileId !== "all"
        ? (() => {
            const profile = profiles.find((p) => p.id === selectedProfileId);
            const id = Number(profile?.profileId);
            return Number.isFinite(id) ? id : null;
          })()
        : null;
    if (selectedProfileId !== "all" && !profileNumericId) {
      setRefundsLoading(false);
      setRefundsRows([]);
      setRefundsPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }

    const refundsSearchKey =
      selectedProfileId === "all"
        ? allOverviewSearchKey
        : commercialOverviewSearchKey;

    let cancelled = false;
    const run = async () => {
      setRefundsLoading(true);
      try {
        const res = await getProfileRefundsByUserProfile({
          userId: selectedProfileId === "all" ? customerId : undefined,
          profileId:
            selectedProfileId !== "all"
              ? profileNumericId ?? undefined
              : undefined,
          search: refundsSearchKey || undefined,
          categoryId: getNumberParam(refundsCategory),
          statusId: getNumberParam(refundsStatusId),
          lastupdatedStartTime: refundsStartTime || undefined,
          lastupdatedEndTime: refundsEndTime || undefined,
          pageIndex: refundsPagination.pageIndex,
          pageSize: refundsPagination.pageSize,
          sortBy: refundsPagination.sortBy || "UpdateOn",
          sortDirection: refundsPagination.sortDirection ?? 1,
        });

        if (cancelled) return;
        const data = mapProfileRefundListResponse(res, i18n.language);
        setRefundsRows(data.items);

        setRefundsPagination((prev) => ({
          ...prev,
          total: data.total,
        }));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setRefundsRows([]);
        setRefundsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setRefundsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    profileOverviewTab,
    allOverviewSearchKey,
    commercialOverviewSearchKey,
    customerId,
    refundsCategory,
    refundsPagination.pageIndex,
    refundsPagination.pageSize,
    refundsPagination.sortBy,
    refundsPagination.sortDirection,
    refundsStatusId,
    refundsStartTime,
    refundsEndTime,
    i18n.language,
    profiles,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "refunds") return;

    const cache = allOverviewStatsCacheRef.current;
    if (cache.customerId === customerId && cache.loaded.has("refunds")) {
      setRefundsStatusCount(
        cache.data.refunds ?? createEmptyRefundOverviewStats(),
      );
      return;
    }
    if (!beginAllOverviewStatsLoad("refunds")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await getProfileRefundsByUserProfile({
          userId: customerId,
          pageIndex: 1,
          pageSize: 1,
          sortBy: "UpdateOn",
          sortDirection: 1,
        });
        const nextStats = mapProfileRefundStats(response);
        if (
          !finishAllOverviewStatsLoad("refunds", requestCustomerId, true)
        ) {
          return;
        }
        allOverviewStatsCacheRef.current.data.refunds = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "refunds"
        ) {
          setRefundsStatusCount(nextStats);
        }
      } catch (error) {
        if (
          !finishAllOverviewStatsLoad("refunds", requestCustomerId, false)
        ) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "refunds"
        ) {
          setRefundsStatusCount(createEmptyRefundOverviewStats());
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (selectedProfileId === "all") return;

    const profileNumericId =
      (() => {
        const profile = profiles.find((p) => p.id === selectedProfileId);
        const id = Number(profile?.profileId);
        return Number.isFinite(id) ? id : null;
      })();

    if (!customerId || !profileNumericId) {
      setRefundsStatusCount(createEmptyRefundOverviewStats());
      return;
    }

    setRefundsStatusCount(createEmptyRefundOverviewStats());
    let cancelled = false;
    const run = async () => {
      try {
        const res = await getProfileRefundsByUserProfile({
          profileId: profileNumericId ?? undefined,
          pageIndex: 1,
          pageSize: 1,
          sortBy: "UpdateOn",
          sortDirection: 1,
        });
        if (cancelled) return;
        setRefundsStatusCount(mapProfileRefundStats(res));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setRefundsStatusCount(createEmptyRefundOverviewStats());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [customerId, profiles, selectedProfileId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [typeRes, statusRes] = await Promise.all([
          getServiceConfigServiceType(),
          getApplicationStatuses(),
        ]);
        const typeList = unwrapApplicationDictionaryItems<IServiceType>(typeRes);
        const statusList =
          unwrapApplicationDictionaryItems<IApplicationStatus>(statusRes);
        const isArabic = i18n.language?.toLowerCase().startsWith("ar");

        if (cancelled) return;
        setAllOverviewTypeOptions(
          buildApplicationTypeOptions(
            typeList,
            isArabic,
            t("Customer.customerDetails.common.allTypes"),
          ),
        );
        setApplicationsStatusOptions(
          buildApplicationStatusOptions(
            statusList,
            isArabic,
            t("Customer.customerDetails.common.allStatuses"),
          ),
        );
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setAllOverviewTypeOptions(
          buildApplicationTypeOptions(
            [],
            i18n.language?.toLowerCase().startsWith("ar"),
            t("Customer.customerDetails.common.allTypes"),
          ),
        );
        setApplicationsStatusOptions([
          {
            label: t("Customer.customerDetails.common.allStatuses"),
            value: "",
          },
        ]);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, t]);

  const handleLicensesTableChange = useCallback(
    (p: TablePaginationConfig, sorter: any) => {
      const s = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = (s as any)?.order as "ascend" | "descend" | undefined;
      const field =
        ((s as any)?.field as string | undefined) ||
        ((s as any)?.columnKey as string | undefined);

      setLicensesPagination((prev) => ({
        ...prev,
        pageIndex: Number(p.current || prev.pageIndex),
        pageSize: Number(p.pageSize || prev.pageSize),
        sortBy: order ? field || "issuanceTime" : "issuanceTime",
        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "applications") return;

    const cache = allOverviewStatsCacheRef.current;
    if (cache.customerId === customerId && cache.loaded.has("applications")) {
      setApplicationsStats(
        cache.data.applications ?? createEmptyApplicationOverviewStats(),
      );
      return;
    }
    if (!beginAllOverviewStatsLoad("applications")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await applicationPageByProfile({
          pageSize: 1,
          pageIndex: 1,
          userId: customerId,
        });
        const nextStats = mapApplicationOverviewStats(
          unwrapApplicationPageResponse(response),
        );
        if (
          !finishAllOverviewStatsLoad(
            "applications",
            requestCustomerId,
            true,
          )
        ) {
          return;
        }
        allOverviewStatsCacheRef.current.data.applications = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "applications"
        ) {
          setApplicationsStats(nextStats);
        }
      } catch (error) {
        if (
          !finishAllOverviewStatsLoad(
            "applications",
            requestCustomerId,
            false,
          )
        ) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "applications"
        ) {
          setApplicationsStats(createEmptyApplicationOverviewStats());
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "applications") return;

    let isCancelled = false;
    const run = async () => {
      setApplicationsLoading(true);
      try {
        const res = await applicationPageByProfile({
          pageSize: applicationsPagination.pageSize,
          pageIndex: applicationsPagination.pageIndex,
          sortBy:
            applicationsPagination.sortDirection !== undefined
              ? applicationsPagination.sortBy
              : undefined,
          sortDirection: applicationsPagination.sortDirection,
          userId: customerId,
          // profileId: 0,
          keyword: allOverviewSearchKey || undefined,
          serviceType: allOverviewType || undefined,
          processInstanceStatusCode: applicationsStatusId || undefined,
          submissionStartTime: applicationsStartDate || undefined,
          submissionEndTime: applicationsEndDate || undefined,
        });

        if (isCancelled) return;

        const data = unwrapApplicationPageResponse(res);

        const items = (Array.isArray(data?.page?.items)
          ? data.page.items
          : []
        ).filter(
          (item): item is ApplicationPageByProfileItem =>
            Boolean(item && typeof item === "object"),
        );

        const mapped: OverviewRowItem[] = items.map(
          mapApplicationPageItemToOverviewRow,
        );
        setApplicationsRows(mapped);
        setApplicationsPagination((prev) => ({
          ...prev,
          total: Number(data?.page?.total || 0),
        }));
      } catch (e) {
        if (isCancelled) return;
        console.error(e);
        setApplicationsRows([]);
        setApplicationsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!isCancelled) setApplicationsLoading(false);
      }
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [
    activeTab,
    allOverviewSearchKey,
    allOverviewType,
    applicationsEndDate,
    applicationsPagination.pageIndex,
    applicationsPagination.pageSize,
    applicationsPagination.sortBy,
    applicationsPagination.sortDirection,
    applicationsStartDate,
    applicationsStatusId,
    customerId,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "payments") return;

    let cancelled = false;
    const run = async () => {
      setPaymentsLoading(true);
      try {
        const listRes = await getFinancePaymentsCount({
          userId: customerId,
          pageIndex: paymentsPagination.pageIndex,
          pageSize: paymentsPagination.pageSize,
          keyword: allOverviewSearchKey || undefined,
          transactionTypeId: paymentsTransactionTypeId || undefined,
          paymentMethodId: paymentsPaymentMethodId || undefined,
          statusId: paymentsStatusId || undefined,
          startDate: paymentsStartDate || undefined,
          endDate: paymentsEndDate || undefined,
          sortBy: "completedAt",
          sortDirection:
            paymentsPagination.sortDirection === 0 ? "asc" : "desc",
        });

        if (cancelled) return;

        const listData = unwrapFinanceResponse<FinanceAccountPaymentsResponse>(
          listRes,
        );
        const items = Array.isArray(listData?.items) ? listData.items : [];
        const mapped = items.map((item: FinancePaymentTransactionItem, idx) =>
          mapFinancePaymentItem(item, idx, i18n.language),
        );

        setPaymentsRows(mapped);
        setPaymentsPagination((prev) => ({
          ...prev,
          total: getFinancePaymentsTotal(listData),
        }));

      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setPaymentsRows([]);
        setPaymentsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    allOverviewSearchKey,
    customerId,
    paymentsPagination.pageIndex,
    paymentsPagination.pageSize,
    paymentsPagination.sortBy,
    paymentsPagination.sortDirection,
    paymentsStatusId,
    paymentsPaymentMethodId,
    paymentsTransactionTypeId,
    paymentsStartDate,
    paymentsEndDate,
    selectedProfileId,
    i18n.language,
  ]);

  useEffect(() => {
    if (!customerId || selectedProfileId !== "all" || activeTab !== "payments") {
      return;
    }

    const cache = allOverviewStatsCacheRef.current;
    if (cache.customerId === customerId && cache.loaded.has("payments")) {
      setPaymentsStats(cache.data.payments ?? null);
      return;
    }
    if (!beginAllOverviewStatsLoad("payments")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await getFinancePaymentsCountSummary({
          userId: customerId,
        });
        const summary = unwrapFinanceResponse<FinancePaymentsSummary>(response);
        const nextStats = summary ? mapFinancePaymentsSummary(summary) : null;
        if (
          !finishAllOverviewStatsLoad("payments", requestCustomerId, true)
        ) {
          return;
        }
        allOverviewStatsCacheRef.current.data.payments = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "payments"
        ) {
          setPaymentsStats(nextStats);
        }
      } catch (error) {
        if (
          !finishAllOverviewStatsLoad("payments", requestCustomerId, false)
        ) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "payments"
        ) {
          setPaymentsStats(null);
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  const allOverviewTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: applicationsPagination.total,
      current: applicationsPagination.pageIndex,
      pageSize: applicationsPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={applicationsPagination.pageIndex} pageSize={applicationsPagination.pageSize} />,
      onChange: (page, size) => {
        setApplicationsPagination((prev) => ({
          ...prev,
          pageIndex: page,
          pageSize: size,
        }));
      },
    };
  }, [
    applicationsPagination.pageIndex,
    applicationsPagination.pageSize,
    applicationsPagination.total,
    t,
  ]);

  const paymentsTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: paymentsPagination.total,
      current: paymentsPagination.pageIndex,
      pageSize: paymentsPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={paymentsPagination.pageIndex} pageSize={paymentsPagination.pageSize} />,
    };
  }, [
    paymentsPagination.pageIndex,
    paymentsPagination.pageSize,
    paymentsPagination.total,
    t,
  ]);

  const ticketsTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: ticketsPagination.total,
      current: ticketsPagination.pageIndex,
      pageSize: ticketsPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={ticketsPagination.pageIndex} pageSize={ticketsPagination.pageSize} />,
      onChange: (page, size) => {
        setTicketsPagination((prev) => ({
          ...prev,
          pageIndex: Number(page || prev.pageIndex),
          pageSize: Number(size || prev.pageSize),
        }));
      },
    };
  }, [
    ticketsPagination.pageIndex,
    ticketsPagination.pageSize,
    ticketsPagination.total,
    t,
  ]);

  const refundsTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: refundsPagination.total,
      current: refundsPagination.pageIndex,
      pageSize: refundsPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={refundsPagination.pageIndex} pageSize={refundsPagination.pageSize} />,
      onChange: (page, size) => {
        setRefundsPagination((prev) => ({
          ...prev,
          pageIndex: Number(page || prev.pageIndex),
          pageSize: Number(size || prev.pageSize),
        }));
      },
    };
  }, [
    refundsPagination.pageIndex,
    refundsPagination.pageSize,
    refundsPagination.total,
    t,
  ]);

  const inspectionNoFullScanTablePagination =
    useMemo<TablePaginationConfig>(() => {
      return {
        total: inspectionNoFullScanPagination.total,
        current: inspectionNoFullScanPagination.pageIndex,
        pageSize: inspectionNoFullScanPagination.pageSize,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50"],
        showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={inspectionNoFullScanPagination.pageIndex} pageSize={inspectionNoFullScanPagination.pageSize} />,
      };
    }, [
      inspectionNoFullScanPagination.pageIndex,
      inspectionNoFullScanPagination.pageSize,
      inspectionNoFullScanPagination.total,
      t,
    ]);

  const licensesTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: licensesPagination.total,
      current: licensesPagination.pageIndex,
      pageSize: licensesPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={licensesPagination.pageIndex} pageSize={licensesPagination.pageSize} />,
      onChange: (page, size) => {
        setLicensesPagination((prev) => ({
          ...prev,
          pageIndex: page,
          pageSize: size,
        }));
      },
    };
  }, [
    licensesPagination.pageIndex,
    licensesPagination.pageSize,
    licensesPagination.total,
    t,
  ]);

  const handleAllOverviewTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      sorter: SorterResult<OverviewRowItem> | SorterResult<OverviewRowItem>[],
      _extra: TableCurrentDataSource<OverviewRowItem>,
    ) => {
      const s = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = (s as any)?.order as "ascend" | "descend" | undefined;

      setApplicationsPagination((prev) => ({
        ...prev,
        sortBy: "lastUpdatedTime",
        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
      }));
    },
    [],
  );

  const handleTicketsTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<TicketItem> | SorterResult<TicketItem>[],
    ) => {
      const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = currentSorter?.order as "ascend" | "descend" | undefined;

      setTicketsPagination((prev) => ({
        ...prev,
        pageIndex: Number(pagination.current || prev.pageIndex),
        pageSize: Number(pagination.pageSize || prev.pageSize),
        sortBy: "updatedOn",
        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
      }));
    },
    [],
  );

  const handleTicketsAdvancedFilterChange = useCallback(
    (filters: { enquiryType?: string; priorityId?: string }) => {
      setTicketsEnquiryType(filters.enquiryType);
      setTicketsPriorityId(filters.priorityId);
      setTicketsPagination((prev) => ({ ...prev, pageIndex: 1 }));
    },
    [],
  );

  const handleTicketsReset = useCallback(() => {
    setTicketsEnquiryStatusId(undefined);
    setTicketsEnquiryType(undefined);
    setTicketsPriorityId(undefined);
    setTicketsStartTime(undefined);
    setTicketsEndTime(undefined);
    setTicketsPagination((prev) => ({
      ...prev,
      pageIndex: 1,
      sortBy: "updatedOn",
      sortDirection: 1,
    }));
  }, []);

  const handlePaymentsTableChange = useCallback(
    (
      p: TablePaginationConfig,
      sorter: SorterResult<PaymentItem> | SorterResult<PaymentItem>[],
    ) => {
      const nextCurrent = Number(p.current || 1);
      const nextSize = Number(p.pageSize || 10);

      const s = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = (s as any)?.order as "ascend" | "descend" | undefined;
      const field = (s as any)?.field as string | undefined;

      setPaymentsPagination((prev) => ({
        ...prev,
        pageIndex: nextCurrent,
        pageSize: nextSize,
        sortBy: order ? field || "transactionTime" : "transactionTime",
        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
      }));
    },
    [],
  );

  const accountInfoCells = useMemo(() => {
    const fullNameEn = safeText(customerOverview?.nameEn);
    const fullNameAr = safeText(customerOverview?.nameAr);

    const showTopIdentity = hasAvatar || isSuspended;
    const showFinance = customerOverview?.walletStatus === "Active";
    // ||
    // !isSuspended;

    const cells: Array<{
      key: string;
      label?: string;
      value?: React.ReactNode;
      icon?: string;
      kind?: "avatar" | "empty";
      hasIcon?: boolean;
    }> = [];

    if (showTopIdentity) {
      cells.push({
        key: "avatar",
        kind: "avatar",
        value: (
          <div className="account-info-avatar">
            <AuthenticatedDocumentAvatar
              size={36}
              src={customerOverview?.photoUrl}
              // icon={<UserOutlined />}
            />
            <div className="account-info-avatar-text">
              <div className="account-info-avatar-en">{fullNameEn}</div>
              <div className="account-info-avatar-ar">{fullNameAr}</div>
            </div>
          </div>
        ),
      });
    } else {
      cells.push({
        key: "full-name",
        label: t("Customer.customerDetails.accountInfo.fullName"),
        value: safeText(customerOverview?.nameEn || customerOverview?.nameAr),
        icon: AccountFullName,
      });
    }

    cells.push({
      key: "email",
      label: t("Customer.customerDetails.accountInfo.email"),
      value: safeText(customerOverview?.email),
      icon: AccountEmail,
    });

    const mobileDisplay = getContactNumberDisplay(
      createContactNumberSnapshot({
        countryCode: customerOverview?.mobileCountryCode,
        localNumber: customerOverview?.mobileLocalNumber,
        fullNumber: customerOverview?.mobileNumber,
      }),
    );
    cells.push({
      key: "mobile",
      label: t("Customer.customerDetails.accountInfo.mobileNumber"),
      value: safeText(mobileDisplay),
      icon: AccountMobile,
    });

    if (showTopIdentity) {
      cells.push({
        key: "emirates-id",
        label: t("Customer.customerDetails.accountInfo.emiratesId"),
        value: safeText(customerOverview?.emiratesId),
        icon: AccountEmirateslD,
      });
      cells.push({
        key: "nationality",
        label: t("Customer.customerDetails.accountInfo.nationality"),
        value: safeText(
          customerOverview?.nationalityEn || customerOverview?.nationalityAr,
        ),
        icon: AccountNational,
      });
    } else {
      cells.push({ key: "empty", kind: "empty" });
    }

    if (showFinance) {
      cells.push({
        key: "wallet",
        label: t("Customer.customerDetails.accountInfo.walletBalance"),
        hasIcon: true,
        value: `${safeText(customerOverview?.walletBalance)}`,
        icon: AccountTotalSpent,
      });
      cells.push({
        key: "spending",
        label: t("Customer.customerDetails.accountInfo.totalSpending"),
        hasIcon: true,
        value: formatMoney(`${safeText(customerOverview?.totalSpending)}`),
        icon: AccountTotalSpent,
      });
      cells.push({
        key: "refunds",
        label: t("Customer.customerDetails.accountInfo.totalRefunds"),
        hasIcon: true,
        value: formatMoney(`${safeText(customerOverview?.totalRefunds)}`),
        icon: AccountTotalRefunds,
      });
      cells.push({
        key: "recharge",
        label: t("Customer.customerDetails.accountInfo.totalRecharge"),
        hasIcon: true,
        value: formatMoney(`${safeText(customerOverview?.totalRecharge)}`),
        icon: AccountTotalRecharge,
      });

      if (showTopIdentity) {
        cells.push({ key: "empty-bottom", kind: "empty" });
      }
    }

    cells.push({
      key: "LoginMethod",
      label: t("Customer.customerDetails.accountInfo.loginMethod"),
      hasIcon: false,
      value: `${safeText(customerOverview?.loginMethod)}`,
      icon: LoginMethod,
    });
    cells.push({
      key: "MobileUsage",
      label: t("Customer.customerDetails.accountInfo.mobileUsage"),
      hasIcon: false,
      value: `${safeText(customerOverview?.mobileUsage)}%`,
      icon: Mobile,
    });
    cells.push({
      key: "WebUsage",
      label: t("Customer.customerDetails.accountInfo.webUsage"),
      hasIcon: false,
      value: `${safeText(customerOverview?.webUsage)}%`,
      icon: PC,
    });
    cells.push({
      key: "TabletUsage",
      label: t("Customer.customerDetails.accountInfo.tabletUsage"),
      hasIcon: false,
      value: `${safeText(customerOverview?.tabletUsage)}%`,
      icon: Tablet,
    });
    if (showTopIdentity) {
      cells.push({ key: "empty", kind: "empty" });
    }
    return {
      cells,
      gridClassName: [
        "account-info-grid",
        showTopIdentity ? "layout-identity" : "layout-basic",
        showFinance ? "layout-two-row" : "layout-one-row",
      ].join(" "),
    };
  }, [customerOverview, hasAvatar, isSuspended, t]);

  const filteredProfiles = useMemo(() => {
    if (!profileSearchKey) return profiles;
    const searchLower = profileSearchKey.toLowerCase();
    return profiles.filter(
      (profile) =>
        profile.profileName.toLowerCase().includes(searchLower) ||
        profile.profileId.toLowerCase().includes(searchLower) ||
        profile.emirate.toLowerCase().includes(searchLower) ||
        profile.profileNameAr.toLowerCase().includes(searchLower),
    );
  }, [profileSearchKey, profiles]);

  useEffect(() => {
    setVisibleProfileCount(INITIAL_VISIBLE_PROFILE_COUNT);
  }, [filteredProfiles, profileSearchKey]);

  const visibleProfiles = useMemo(
    () => filteredProfiles.slice(0, visibleProfileCount),
    [filteredProfiles, visibleProfileCount],
  );

  const handleProfilesScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 4;

      if (!isAtBottom) return;

      setVisibleProfileCount((prev) => {
        if (prev >= filteredProfiles.length) return prev;
        return Math.min(
          prev + LOAD_MORE_PROFILE_COUNT,
          filteredProfiles.length,
        );
      });
    },
    [filteredProfiles.length],
  );

  const profileCounts = useMemo(() => {
    const individualCount = profiles.filter((p) =>
      isIndividualProfileType(p.profileType),
    ).length;
    const establishmentCount = profiles.length - individualCount;
    return { individualCount, establishmentCount };
  }, [profiles]);

  const selectedProfile = useMemo(() => {
    if (selectedProfileId === "all") return null;
    return profiles.find((p) => p.id === selectedProfileId) || null;
  }, [profiles, selectedProfileId]);

  const selectedProfileNumericId = useMemo(() => {
    if (!selectedProfile) return null;
    const id = Number(selectedProfile.profileId);
    return Number.isFinite(id) ? id : null;
  }, [selectedProfile]);

  const inspectionNoFullScanSearchKey =
    selectedProfileId === "all"
      ? allOverviewSearchKey
      : commercialOverviewSearchKey;
  const violationsFinesSearchKey =
    selectedProfileId === "all"
      ? allOverviewSearchKey
      : commercialOverviewSearchKey;
  const appealSearchKey =
    selectedProfileId === "all"
      ? allOverviewSearchKey
      : commercialOverviewSearchKey;
  const debouncedAppealSearchKey = useProfileAppealSearch(appealSearchKey);

  useEffect(() => {
    setInspectionNoFullScanPagination((prev) =>
      prev.pageIndex === 1 ? prev : { ...prev, pageIndex: 1 },
    );
  }, [selectedProfileId]);

  useEffect(() => {
    let cancelled = false;
    const isArabic = i18n.language.toLowerCase().startsWith("ar");

    Promise.all([
      getInspectionReasons().catch(() => [] as InspectionLookupOption[]),
      getInspectionTaskStatuses().catch(() => [] as InspectionLookupOption[]),
      getInspectionPriorities().catch(() => [] as InspectionLookupOption[]),
      getInspectionInspectors().catch(() => [] as InspectionLookupOption[]),
    ]).then(([reasons, statuses, priorities, inspectors]) => {
      if (cancelled) return;

      setInspectionNoFullScanReasonOptions(
        buildInspectionLookupOptions(reasons, isArabic, "code"),
      );
      setInspectionNoFullScanStatusOptions(
        buildInspectionStatusOptions(statuses, isArabic, t),
      );
      setInspectionNoFullScanPriorityOptions(
        buildInspectionPriorityOptions(priorities, isArabic, t),
      );
      setInspectionNoFullScanInspectorOptions(
        buildInspectionLookupOptions(inspectors, isArabic),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [i18n.language, t]);

  useEffect(() => {
    if (!customerId) {
      setInspectionTasksNoFullScan([]);
      setInspectionNoFullScanPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }

    const isInspectionTabActive =
      selectedProfileId === "all"
        ? activeTab === "inspection"
        : profileOverviewTab === "inspection";
    if (!isInspectionTabActive) return;

    if (selectedProfileId !== "all" && !selectedProfileNumericId) {
      setInspectionTasksNoFullScan([]);
      setInspectionNoFullScanPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }

    let cancelled = false;
    const run = async () => {
      setInspectionNoFullScanLoading(true);
      try {
        const response = await getInspectionTasksByUserProfile({
          userId: selectedProfileId === "all" ? customerId : undefined,
          profileId:
            selectedProfileId === "all"
              ? undefined
              : selectedProfileNumericId ?? undefined,
          search: inspectionNoFullScanSearchKey.trim() || undefined,
          statusId: getInspectionNumberParam(
            inspectionNoFullScanFilters.statusId,
          ),
          inspectionReasonId:
            inspectionNoFullScanFilters.reasonId?.trim() || undefined,
          priorityId: getInspectionNumberParam(
            inspectionNoFullScanFilters.priorityId,
          ),
          dueDateFrom: inspectionNoFullScanFilters.dueDateFrom,
          dueDateTo: inspectionNoFullScanFilters.dueDateTo,
          assignedTimeFrom: inspectionNoFullScanFilters.assignedTimeFrom,
          assignedTimeTo: inspectionNoFullScanFilters.assignedTimeTo,
          assignedInspectorId:
            inspectionNoFullScanFilters.assignedInspectorId,
          pageIndex: inspectionNoFullScanPagination.pageIndex,
          pageSize: inspectionNoFullScanPagination.pageSize,
          sortBy: inspectionNoFullScanPagination.sortBy,
          sortDirection: inspectionNoFullScanPagination.sortDirection,
        });

        if (cancelled) return;

        const data = mapInspectionProfileTaskListResponse(response, t);
        setInspectionTasksNoFullScan(data.items);
        setInspectionNoFullScanPagination((prev) => ({
          ...prev,
          total: data.total,
        }));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setInspectionTasksNoFullScan([]);
        setInspectionNoFullScanPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setInspectionNoFullScanLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    customerId,
    i18n.language,
    inspectionNoFullScanFilters.assignedInspectorId,
    inspectionNoFullScanFilters.assignedTimeFrom,
    inspectionNoFullScanFilters.assignedTimeTo,
    inspectionNoFullScanFilters.dueDateFrom,
    inspectionNoFullScanFilters.dueDateTo,
    inspectionNoFullScanFilters.priorityId,
    inspectionNoFullScanFilters.reasonId,
    inspectionNoFullScanFilters.statusId,
    inspectionNoFullScanPagination.pageIndex,
    inspectionNoFullScanPagination.pageSize,
    inspectionNoFullScanPagination.sortBy,
    inspectionNoFullScanPagination.sortDirection,
    inspectionNoFullScanSearchKey,
    profileOverviewTab,
    selectedProfileId,
    selectedProfileNumericId,
    t,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "inspection") return;

    const cache = allOverviewStatsCacheRef.current;
    if (cache.customerId === customerId && cache.loaded.has("inspection")) {
      setInspectionStatsNoFullScan(
        cache.data.inspection ?? createEmptyInspectionOverviewStats(),
      );
      return;
    }
    if (!beginAllOverviewStatsLoad("inspection")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await getInspectionProfileTaskStats({
          userId: customerId,
        });
        const nextStats = mapInspectionProfileStats(response);
        if (
          !finishAllOverviewStatsLoad("inspection", requestCustomerId, true)
        ) {
          return;
        }
        allOverviewStatsCacheRef.current.data.inspection = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "inspection"
        ) {
          setInspectionStatsNoFullScan(nextStats);
        }
      } catch (error) {
        if (
          !finishAllOverviewStatsLoad("inspection", requestCustomerId, false)
        ) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "inspection"
        ) {
          setInspectionStatsNoFullScan(createEmptyInspectionOverviewStats());
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (!customerId) {
      setInspectionStatsNoFullScan(createEmptyInspectionOverviewStats());
      return;
    }

    if (selectedProfileId === "all") return;
    if (profileOverviewTab !== "inspection") return;

    if (!selectedProfileNumericId) {
      setInspectionStatsNoFullScan(createEmptyInspectionOverviewStats());
      return;
    }

    setInspectionStatsNoFullScan(createEmptyInspectionOverviewStats());
    let cancelled = false;
    const run = async () => {
      try {
        const response = await getInspectionProfileTaskStats({
          profileId: selectedProfileNumericId ?? undefined,
        });
        if (!cancelled) {
          setInspectionStatsNoFullScan(mapInspectionProfileStats(response));
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setInspectionStatsNoFullScan(createEmptyInspectionOverviewStats());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    customerId,
    profileOverviewTab,
    selectedProfileId,
    selectedProfileNumericId,
  ]);

  useEffect(() => {
    if (!customerId) {
      setViolationsFinesLoading(false);
      setViolationsFinesRows([]);
      return;
    }

    const isViolationsFinesTabActive =
      selectedProfileId === "all"
        ? activeTab === "violations-fines"
        : profileOverviewTab === "violations-fines";
    if (!isViolationsFinesTabActive) {
      setViolationsFinesLoading(false);
      return;
    }

    if (selectedProfileId !== "all" && !selectedProfileNumericId) {
      setViolationsFinesLoading(false);
      setViolationsFinesRows([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setViolationsFinesLoading(true);
      try {
        const response = await getCustomerProfileViolations({
          userId: selectedProfileId === "all" ? customerId : undefined,
          profileId:
            selectedProfileId === "all"
              ? undefined
              : selectedProfileNumericId ?? undefined,
          keyword: violationsFinesSearchKey.trim() || undefined,
          startTime: violationsFinesStartTime,
          endTime: violationsFinesEndTime,
          violationTypeId: getNumberParam(violationsFinesTypeId),
          statusId: getNumberParam(violationsFinesStatusId),
          paidTimeFrom: violationsFinesPaidTimeFrom,
          paidTimeTo: violationsFinesPaidTimeTo,
        });

        if (cancelled) return;

        setViolationsFinesRows(mapCustomerProfileViolationRows(response));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setViolationsFinesRows([]);
      } finally {
        if (!cancelled) setViolationsFinesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    customerId,
    profileOverviewTab,
    selectedProfileId,
    selectedProfileNumericId,
    violationsFinesEndTime,
    violationsFinesPaidTimeFrom,
    violationsFinesPaidTimeTo,
    violationsFinesSearchKey,
    violationsFinesStartTime,
    violationsFinesStatusId,
    violationsFinesTypeId,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "violations-fines") return;

    const cache = allOverviewStatsCacheRef.current;
    if (
      cache.customerId === customerId &&
      cache.loaded.has("violations-fines")
    ) {
      const cachedStats = cache.data.violationsFines;
      setViolationsFinesStatusCounts(
        cachedStats?.statusCounts ?? createEmptyViolationStatusCounts(),
      );
      setViolationsFinesStatusOptions(
        cachedStats?.statusOptions ?? buildViolationFilterStatusOptions(),
      );
      return;
    }
    if (!beginAllOverviewStatsLoad("violations-fines")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await getCustomerProfileViolations({
          userId: customerId,
        });
        const nextStats = {
          statusCounts: mapCustomerProfileViolationStatusCounts(response),
          statusOptions:
            mapCustomerProfileViolationFilterStatusOptions(response),
        };
        if (
          !finishAllOverviewStatsLoad(
            "violations-fines",
            requestCustomerId,
            true,
          )
        ) {
          return;
        }
        allOverviewStatsCacheRef.current.data.violationsFines = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "violations-fines"
        ) {
          setViolationsFinesStatusCounts(nextStats.statusCounts);
          setViolationsFinesStatusOptions(nextStats.statusOptions);
        }
      } catch (error) {
        if (
          !finishAllOverviewStatsLoad(
            "violations-fines",
            requestCustomerId,
            false,
          )
        ) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "violations-fines"
        ) {
          setViolationsFinesStatusCounts(createEmptyViolationStatusCounts());
          setViolationsFinesStatusOptions(buildViolationFilterStatusOptions());
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (selectedProfileId === "all") return;

    const isViolationsFinesTabActive =
      profileOverviewTab === "violations-fines";
    const hasIdentity = Boolean(selectedProfileNumericId);

    if (!isViolationsFinesTabActive) return;
    if (!hasIdentity) {
      setViolationsFinesStatusCounts(createEmptyViolationStatusCounts());
      setViolationsFinesStatusOptions(buildViolationFilterStatusOptions());
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const response = await getCustomerProfileViolations({
          profileId: selectedProfileNumericId ?? undefined,
        });

        if (cancelled) return;
        setViolationsFinesStatusCounts(
          mapCustomerProfileViolationStatusCounts(response),
        );
        setViolationsFinesStatusOptions(
          mapCustomerProfileViolationFilterStatusOptions(response),
        );
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setViolationsFinesStatusCounts(createEmptyViolationStatusCounts());
        setViolationsFinesStatusOptions(buildViolationFilterStatusOptions());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    customerId,
    profileOverviewTab,
    selectedProfileId,
    selectedProfileNumericId,
  ]);

  useEffect(() => {
    if (!customerId) {
      setAppealLoading(false);
      setAppealRows([]);
      return;
    }

    const isAppealTabActive =
      selectedProfileId === "all"
        ? activeTab === "appeal"
        : profileOverviewTab === "appeal";
    if (!isAppealTabActive) {
      setAppealLoading(false);
      return;
    }

    if (selectedProfileId !== "all" && !selectedProfileNumericId) {
      setAppealLoading(false);
      setAppealRows([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setAppealLoading(true);
      try {
        const response = await getInspectionProfileAppeals({
          userId: selectedProfileId === "all" ? customerId : undefined,
          profileId:
            selectedProfileId === "all"
              ? undefined
              : selectedProfileNumericId ?? undefined,
          keyword: debouncedAppealSearchKey || undefined,
          startTime: appealStartTime,
          endTime: appealEndTime,
          statusId: getNumberParam(appealStatusId),
        });

        if (cancelled) return;
        setAppealRows(mapProfileAppealListResponse(response).items);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setAppealRows([]);
      } finally {
        if (!cancelled) setAppealLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    appealEndTime,
    debouncedAppealSearchKey,
    appealStartTime,
    appealStatusId,
    customerId,
    profileOverviewTab,
    selectedProfileId,
    selectedProfileNumericId,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (!selectedProfileNumericId) return;
    if (profileOverviewTab !== "applications") return;

    let isCancelled = false;
    const run = async () => {
      setCommercialApplicationsLoading(true);
      try {
        const res = await applicationPageByProfile({
          pageSize: commercialApplicationsPagination.pageSize,
          pageIndex: commercialApplicationsPagination.pageIndex,
          sortBy: commercialApplicationsPagination.sortBy,
          sortDirection: commercialApplicationsPagination.sortDirection,
          userId: customerId,
          profileId: selectedProfileNumericId,
          keyword: commercialOverviewSearchKey || undefined,
          serviceType: commercialOverviewType || undefined,
          processInstanceStatusCode:
            commercialApplicationsStatusId || undefined,
          submissionStartTime: commercialApplicationsStartDate || undefined,
          submissionEndTime: commercialApplicationsEndDate || undefined,
        });

        if (isCancelled) return;
        const data = unwrapApplicationPageResponse(res);

        const total = Number(data?.report?.totalCount || 0);
        const licenses = Number(data?.report?.licenseCount || 0);
        const content = Number(data?.report?.contentCount || 0);
        const items = (Array.isArray(data?.page?.items)
          ? data.page.items
          : []
        ).filter(
          (item): item is ApplicationPageByProfileItem =>
            Boolean(item && typeof item === "object"),
        );
        const fallbackCompleted = countApplicationsByStatuses(
          items,
          APPLICATION_COMPLETED_STATUSES,
        );
        const fallbackRejected = countApplicationsByStatuses(
          items,
          APPLICATION_REJECTED_STATUSES,
        );
        const fallbackCancelled = countApplicationsByStatuses(
          items,
          APPLICATION_CANCELLED_STATUSES,
        );
        const fallbackProcessing = countApplicationsByStatuses(
          items,
          APPLICATION_PROCESSING_STATUSES,
        );
        const completed = Number(
          data?.report?.completedCount ?? fallbackCompleted,
        );
        const rejected = Number(
          data?.report?.rejectedCount ?? fallbackRejected,
        );
        const cancelledCount = Number(
          data?.report?.cancelledCount ?? fallbackCancelled,
        );
        const processing = Number(
          data?.report?.processingCount ?? fallbackProcessing,
        );

        setCommercialApplicationsStats({
          total,
          licenses,
          content,
          processing,
          rejected,
          completed,
          cancelled: cancelledCount,
        });

        const mapped: OverviewRowItem[] = items.map(
          mapApplicationPageItemToOverviewRow,
        );
        setCommercialApplicationsRows(mapped);
        setCommercialApplicationsPagination((prev) => ({
          ...prev,
          total: Number(data?.page?.total || 0),
        }));
      } catch (e) {
        if (isCancelled) return;
        console.error(e);
        setCommercialApplicationsRows([]);
        setCommercialApplicationsStats({
          total: 0,
          licenses: 0,
          content: 0,
          processing: 0,
          rejected: 0,
          completed: 0,
          cancelled: 0,
        });
        setCommercialApplicationsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!isCancelled) setCommercialApplicationsLoading(false);
      }
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [
    commercialApplicationsEndDate,
    commercialApplicationsPagination.pageIndex,
    commercialApplicationsPagination.pageSize,
    commercialApplicationsPagination.sortBy,
    commercialApplicationsPagination.sortDirection,
    commercialApplicationsStartDate,
    commercialApplicationsStatusId,
    commercialOverviewSearchKey,
    commercialOverviewType,
    customerId,
    profileOverviewTab,
    selectedProfileNumericId,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (!selectedProfileNumericId) return;
    if (profileOverviewTab !== "payments") return;

    let cancelled = false;
    const run = async () => {
      setCommercialPaymentsLoading(true);
      try {
        const listRes = await getFinancePaymentsCount({
          userId: customerId,
          profileId: selectedProfileNumericId,
          pageIndex: commercialPaymentsPagination.pageIndex,
          pageSize: commercialPaymentsPagination.pageSize,
          keyword: commercialOverviewSearchKey || undefined,
          transactionTypeId: commercialPaymentsTransactionTypeId || undefined,
          paymentMethodId: commercialPaymentsPaymentMethodId || undefined,
          statusId: commercialPaymentsStatusId || undefined,
          startDate: commercialPaymentsStartDate || undefined,
          endDate: commercialPaymentsEndDate || undefined,
          sortBy: "completedAt",
          sortDirection:
            commercialPaymentsPagination.sortDirection === 0 ? "asc" : "desc",
        });

        if (cancelled) return;

        const listData = unwrapFinanceResponse<FinanceAccountPaymentsResponse>(
          listRes,
        );
        const items = Array.isArray(listData?.items) ? listData.items : [];
        const mapped = items.map((item: FinancePaymentTransactionItem, idx) =>
          mapFinancePaymentItem(
            item,
            idx,
            i18n.language,
            selectedProfile?.profileType,
          ),
        );

        setCommercialPaymentsRows(mapped);
        setCommercialPaymentsPagination((prev) => ({
          ...prev,
          total: getFinancePaymentsTotal(listData),
        }));

      } catch (e) {
        if (cancelled) return;
        console.error(e);
        message.error(
          t("Customer.customerDetails.common.failedToLoadPayments"),
        );
        setCommercialPaymentsRows([]);
        setCommercialPaymentsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setCommercialPaymentsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    commercialOverviewSearchKey,
    commercialPaymentsEndDate,
    commercialPaymentsPagination.pageIndex,
    commercialPaymentsPagination.pageSize,
    commercialPaymentsPagination.sortBy,
    commercialPaymentsPagination.sortDirection,
    commercialPaymentsStartDate,
    commercialPaymentsStatusId,
    commercialPaymentsPaymentMethodId,
    commercialPaymentsTransactionTypeId,
    customerId,
    profileOverviewTab,
    selectedProfileNumericId,
    selectedProfile?.profileType,
    i18n.language,
    t,
  ]);

  useEffect(() => {
    if (
      !customerId ||
      !selectedProfileNumericId ||
      profileOverviewTab !== "payments"
    ) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const response = await getFinancePaymentsCountSummary({
          userId: customerId,
          profileId: selectedProfileNumericId,
        });
        if (cancelled) return;
        const summary = unwrapFinanceResponse<FinancePaymentsSummary>(response);
        setCommercialPaymentsStats(
          summary ? mapFinancePaymentsSummary(summary) : null,
        );
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setCommercialPaymentsStats(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [customerId, profileOverviewTab, selectedProfileNumericId]);

  useEffect(() => {
    if (!customerId || !selectedProfileNumericId) return;
    if (profileOverviewTab !== "licenses") return;

    let cancelled = false;
    const run = async () => {
      setCommercialLicensesLoading(true);
      try {
        const listRes = await getLicenseManagementList({
          pageSize: commercialLicensesPagination.pageSize,
          pageIndex: commercialLicensesPagination.pageIndex,
          sortBy: commercialLicensesPagination.sortBy || "issuanceTime",
          sortDirection: commercialLicensesPagination.sortDirection ?? 1,
          keyword: commercialOverviewSearchKey || undefined,
          status: commercialLicensesStatus || undefined,
          issuanceDateStart:
            commercialLicensesIssuanceDateStart || undefined,
          issuanceDateEnd: commercialLicensesIssuanceDateEnd || undefined,
          userId: customerId,
          profileId: selectedProfileNumericId,
        });

        if (cancelled) return;

        const listData = mapLicenseListResponse(listRes, i18n.language);
        setCommercialLicensesRows(listData.items);
        setCommercialLicensesPagination((prev) => ({
          ...prev,
          total: listData.total,
        }));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        message.error(
          t("Customer.customerDetails.common.failedToLoadLicenses"),
        );
        setCommercialLicensesRows([]);
        setCommercialLicensesPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setCommercialLicensesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    commercialLicensesIssuanceDateEnd,
    commercialLicensesIssuanceDateStart,
    commercialLicensesPagination.pageIndex,
    commercialLicensesPagination.pageSize,
    commercialLicensesPagination.sortBy,
    commercialLicensesPagination.sortDirection,
    commercialLicensesStatus,
    commercialOverviewSearchKey,
    customerId,
    i18n.language,
    profileOverviewTab,
    selectedProfileNumericId,
    t,
  ]);

  useEffect(() => {
    if (!customerId) return;
    if (selectedProfileId !== "all") return;
    if (activeTab !== "appeal") return;

    const cache = allOverviewStatsCacheRef.current;
    if (cache.customerId === customerId && cache.loaded.has("appeal")) {
      setAppealStatusCounts(
        cache.data.appeal ?? createEmptyAppealOverviewStats(),
      );
      return;
    }
    if (!beginAllOverviewStatsLoad("appeal")) return;

    const requestCustomerId = customerId;
    const run = async () => {
      try {
        const response = await getInspectionProfileAppeals({
          userId: customerId,
        });
        const nextStats = mapProfileAppealStats(response);
        if (!finishAllOverviewStatsLoad("appeal", requestCustomerId, true)) {
          return;
        }
        allOverviewStatsCacheRef.current.data.appeal = nextStats;
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "appeal"
        ) {
          setAppealStatusCounts(nextStats);
        }
      } catch (error) {
        if (!finishAllOverviewStatsLoad("appeal", requestCustomerId, false)) {
          return;
        }
        console.error(error);
        if (
          selectedProfileIdRef.current === "all" &&
          activeTabRef.current === "appeal"
        ) {
          setAppealStatusCounts(createEmptyAppealOverviewStats());
        }
      }
    };

    run();
  }, [
    activeTab,
    beginAllOverviewStatsLoad,
    customerId,
    finishAllOverviewStatsLoad,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (selectedProfileId === "all") return;

    if (!customerId || !selectedProfileNumericId) {
      setAppealStatusCounts(createEmptyAppealOverviewStats());
      return;
    }

    setAppealStatusCounts(createEmptyAppealOverviewStats());
    let cancelled = false;
    const run = async () => {
      try {
        const response = await getInspectionProfileAppeals({
          profileId: selectedProfileNumericId ?? undefined,
        });
        if (!cancelled) {
          setAppealStatusCounts(mapProfileAppealStats(response));
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setAppealStatusCounts(createEmptyAppealOverviewStats());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [customerId, selectedProfileId, selectedProfileNumericId]);

  useEffect(() => {
    if (!customerId || !selectedProfileNumericId) return;
    if (profileOverviewTab !== "licenses") return;

    let cancelled = false;
    const run = async () => {
      try {
        const response = await getStatistics(
          customerId,
          selectedProfileNumericId,
        );
        if (!cancelled) {
          setCommercialLicensesStatistics(mapLicenseStatistics(response));
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setCommercialLicensesStatistics(createEmptyLicenseStatistics());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [customerId, profileOverviewTab, selectedProfileNumericId]);

  const commercialApplicationsTablePagination =
    useMemo<TablePaginationConfig>(() => {
      return {
        total: commercialApplicationsPagination.total,
        current: commercialApplicationsPagination.pageIndex,
        pageSize: commercialApplicationsPagination.pageSize,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50"],
        showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={commercialApplicationsPagination.pageIndex} pageSize={commercialApplicationsPagination.pageSize} />,
        onChange: (page, size) => {
          setCommercialApplicationsPagination((prev) => ({
            ...prev,
            pageIndex: page,
            pageSize: size,
          }));
        },
      };
    }, [
      commercialApplicationsPagination.pageIndex,
      commercialApplicationsPagination.pageSize,
      commercialApplicationsPagination.total,
      t,
    ]);

  const commercialPaymentsTablePagination =
    useMemo<TablePaginationConfig>(() => {
      return {
        total: commercialPaymentsPagination.total,
        current: commercialPaymentsPagination.pageIndex,
        pageSize: commercialPaymentsPagination.pageSize,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50"],
        showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={commercialPaymentsPagination.pageIndex} pageSize={commercialPaymentsPagination.pageSize} />,
      };
    }, [
      commercialPaymentsPagination.pageIndex,
      commercialPaymentsPagination.pageSize,
      commercialPaymentsPagination.total,
      t,
    ]);

  const commercialLicensesTablePagination =
    useMemo<TablePaginationConfig>(() => {
      return {
        total: commercialLicensesPagination.total,
        current: commercialLicensesPagination.pageIndex,
        pageSize: commercialLicensesPagination.pageSize,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50"],
        showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={commercialLicensesPagination.pageIndex} pageSize={commercialLicensesPagination.pageSize} />,
        onChange: (page, size) => {
          setCommercialLicensesPagination((prev) => ({
            ...prev,
            pageIndex: page,
            pageSize: size,
          }));
        },
      };
    }, [
      commercialLicensesPagination.pageIndex,
      commercialLicensesPagination.pageSize,
      commercialLicensesPagination.total,
      t,
    ]);

  useEffect(() => {
    if (!selectedProfile) return;
    if (isCommercialProfileType(selectedProfile.profileType)) return;
    if (profileOverviewTab !== "basic") return;

    let cancelled = false;
    const run = async () => {
      setBasicLoading(true);
      try {
        const profileId = selectedProfile.profileId;
        if (isIndividualProfileType(selectedProfile.profileType)) {
          const res: any = await getPersonalInfo(profileId);
          const data = res?.data ?? res;
          setBasicPersonalInfo(buildPersonalInfoItems(data?.personal, t));
          setBasicAddressInfo(buildAddressInfoItems(data?.addressInfo, t));
          setBasicDocuments(
            buildDocumentItemsFromPersonal(data?.personDocmentInfo, t),
          );
        } else {
          const res: any = await getEstablishmentlInfo(profileId);
          const data = res?.data ?? res;

          const establishment = data?.establishment;
          const legal = data?.legalPersonal;

          const info: InfoItem[] = [
            {
              key: "est-name-en",
              label: t("Customer.customerDetails.establishmentInfo.nameEn"),
              value: establishment?.nameEn || "-",
            },
            {
              key: "est-name-ar",
              label: t("Customer.customerDetails.establishmentInfo.nameAr"),
              value: establishment?.nameAr || "-",
            },
            {
              key: "license-number",
              label: t(
                "Customer.customerDetails.establishmentInfo.licenseNumber",
              ),
              value: establishment?.licenseNumber || "-",
            },
            {
              key: "work-email",
              label: t("Customer.customerDetails.establishmentInfo.workEmail"),
              value: establishment?.workEmail || "-",
            },
            {
              key: "work-mobile",
              label: t("Customer.customerDetails.establishmentInfo.workMobile"),
              value: establishment?.workMobileNumibe || "-",
            },
            {
              key: "legal-person",
              label: t(
                "Customer.customerDetails.establishmentInfo.legalPerson",
              ),
              value: legal?.nameEn || legal?.nameAr || "-",
            },
          ];

          setBasicPersonalInfo(info);
          setBasicAddressInfo(buildAddressInfoItems(data?.addressInfo, t));
          setBasicDocuments(
            buildDocumentItemsFromEstablishment(data?.documentInfo, t),
          );
        }
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        message.error(
          t("Customer.customerDetails.common.failedToLoadBasicInformation"),
        );
        setBasicPersonalInfo([]);
        setBasicAddressInfo([]);
        setBasicDocuments([]);
      } finally {
        if (!cancelled) setBasicLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [profileOverviewTab, selectedProfile, t]);

  useEffect(() => {
    if (!selectedProfile) return;
    if (!isCommercialProfileType(selectedProfile.profileType)) return;

    let cancelled = false;
    const run = async () => {
      try {
        const res: any = await getEstablishmentlInfo(selectedProfile.profileId);
        const data = res?.data ?? res;
        if (cancelled) return;
        setCommercialEstablishmentData({
          establishment: data?.establishment,
          documentInfo: data?.documentInfo,
          legalPersonal: data?.legalPersonal,
          addressInfo: data?.addressInfo,
          partnerList: data?.partnerList || [],
        });
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        message.error(
          t(
            "Customer.customerDetails.common.failedToLoadEstablishmentInformation",
          ),
        );
        setCommercialEstablishmentData(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedProfile, t]);

  const handleSuspendCustomer = useCallback(async () => {
    if (!customerId) return;
    if (!suspendNotes.trim()) {
      setSuspendNotesError(t("Customer.tickets.common.pleaseEnterNotes"));
      return;
    }

    setSuspendNotesError("");
    setSuspendModalLoading(true);
    try {
      await updateCustomerUserActive({
        userId: customerId,
        isActive: false,
        reson: suspendNotes || undefined,
      });

      CustomMessage.success(t("Customer.tickets.messages.operationSuccess"));
      setSuspendModalVisible(false);
      setSuspendNotes("");
      await reloadCustomerDetails();
    } catch (e) {
      console.error(e);
      CustomMessage.error(
        t("Customer.customerDetails.messages.operationFailed"),
      );
    } finally {
      setSuspendModalLoading(false);
    }
  }, [customerId, reloadCustomerDetails, suspendNotes, t]);

  const handleConfirmAction = useCallback(async () => {
    if (!customerId) return;

    setActivateModalLoading(true);
    try {
      await updateCustomerUserActive({
        userId: customerId,
        isActive: true,
      });

      CustomMessage.success(t("Customer.tickets.messages.operationSuccess"));
      setActivateModalVisible(false);
      await reloadCustomerDetails();
    } catch (e) {
      console.error(e);
      CustomMessage.error(
        t("Customer.customerDetails.messages.operationFailed"),
      );
    } finally {
      setActivateModalLoading(false);
    }
  }, [customerId, reloadCustomerDetails]);

  return (
    <div className="customer-details-page">
      {customerOverview?.reson && (
        <AlertBanner
          type="error"
          content={customerOverview?.reson}
        ></AlertBanner>
      )}
      <Spin spinning={loading}>
        <div className="details-content">
          <DetailSection
            title={t("Customer.customerDetails.accountInformation")}
            className="account-info-section"
            extra={
              <CustomStatusTag
                type="accountStatus"
                status={safeText(customerOverview?.isActiveInfo)}
              />
            }
          >
            <div className={accountInfoCells.gridClassName}>
              {accountInfoCells.cells.map((cell, index) => {
                const isFirst =
                  Math.floor(index / (hasAvatar || isSuspended ? 5 : 4)) === 0;
                if (cell.kind === "empty") {
                  return (
                    <div
                      key={cell.key}
                      className={`account-info-cell is-empty ${
                        isFirst ? "" : "border-top"
                      }`}
                    />
                  );
                }

                if (cell.kind === "avatar") {
                  return (
                    <div
                      key={cell.key}
                      className="account-info-cell is-avatar"
                      data-key={cell.key}
                    >
                      {cell.value}
                    </div>
                  );
                }

                return (
                  <div
                    key={cell.key}
                    className={`account-info-cell ${
                      isFirst ? "" : "border-top"
                    }`}
                    data-key={cell.key}
                  >
                    <div className="account-info-icon">
                      <img src={cell.icon || ""} />
                    </div>
                    <div className="account-info-text">
                      <div className="account-info-label">{cell.label}</div>
                      <div className="account-info-value">
                        {cell.hasIcon && <AED />}
                        {cell.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </DetailSection>

          <div className="two-column-layout">
            <div className="left-column" onScroll={handleProfilesScroll}>
              <ProfileListPanel
                profiles={visibleProfiles}
                searchKey={profileSearchKey}
                onSearchKeyChange={setProfileSearchKey}
                selectedProfileId={selectedProfileId}
                onSelectProfileId={setSelectedProfileId}
                individualCount={profileCounts.individualCount}
                establishmentCount={profileCounts.establishmentCount}
              />
            </div>
            <div className="line"></div>

            <div className="right-column">
              {selectedProfileId === "all" ? (
                <AllProfilesOverview
                  wrapperClassName="all-profiles-overview-section"
                  showApplyFor
                  activeTab={activeTab}
                  onTabChange={(k) => {
                    setActiveTab(k);
                    if (k === "licenses") {
                      setLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }
                    if (k === "tickets") {
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }
                    if (k === "refunds") {
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }
                    if (k === "inspection") {
                      setInspectionNoFullScanPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }
                  }}
                  searchKey={allOverviewSearchKey}
                  onSearchKeyChange={(v) => {
                    setAllOverviewSearchKey(v);
                    setApplicationsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                    setPaymentsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                    setLicensesPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                    setTicketsPagination((prev) => ({ ...prev, pageIndex: 1 }));
                    setRefundsPagination((prev) => ({ ...prev, pageIndex: 1 }));
                    setInspectionNoFullScanPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  typeFilter={allOverviewType}
                  typeFilterOptions={allOverviewTypeOptions}
                  applicationsStatusOptions={applicationsStatusOptions}
                  onTypeFilterChange={(v) => {
                    setAllOverviewType(v);
                    setApplicationsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                    setPaymentsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                    setLicensesPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  applicationsStatusId={applicationsStatusId}
                  onApplicationsStatusIdChange={(v) => {
                    setApplicationsStatusId(v);
                    setApplicationsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  applicationsStartDate={applicationsStartDate}
                  applicationsEndDate={applicationsEndDate}
                  onApplicationsDateRangeChange={({ startDate, endDate }) => {
                    setApplicationsStartDate(startDate);
                    setApplicationsEndDate(endDate);
                    setApplicationsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  onApplicationsReset={() => {
                    setAllOverviewSearchKey("");
                    setAllOverviewType(undefined);
                    setApplicationsStatusId(undefined);
                    setApplicationsStartDate(undefined);
                    setApplicationsEndDate(undefined);
                    setApplicationsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                      sortBy: "lastUpdatedTime",
                      sortDirection: 1,
                    }));
                  }}
                  rows={applicationsRows}
                  payments={
                    activeTab === "payments" ? paymentsRows : []
                  }
                  paymentsStats={paymentsStats}
                  paymentsTransactionTypeOptions={
                    paymentsTransactionTypeOptions
                  }
                  paymentsStatusOptions={paymentsStatusOptions}
                  paymentsPaymentMethodOptions={paymentsPaymentMethodOptions}
                  paymentsTransactionTypeId={paymentsTransactionTypeId}
                  paymentsStatusId={paymentsStatusId}
                  paymentsPaymentMethodId={paymentsPaymentMethodId}
                  paymentsStartDate={paymentsStartDate}
                  paymentsEndDate={paymentsEndDate}
                  onPaymentsTransactionTypeIdChange={(v) => {
                    setPaymentsTransactionTypeId(v);
                    setPaymentsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  onPaymentsStatusIdChange={(v) => {
                    setPaymentsStatusId(v);
                    setPaymentsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  onPaymentsAdvancedFilterChange={({
                    paymentMethodId,
                    startDate,
                    endDate,
                  }) => {
                    setPaymentsPaymentMethodId(paymentMethodId);
                    setPaymentsStartDate(startDate);
                    setPaymentsEndDate(endDate);
                    setPaymentsPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  licenses={licensesRows}
                  licensesStats={licensesStatistics}
                  licensesPagination={licensesTablePagination}
                  licensesStatus={licensesStatus}
                  licensesIssuanceDateStart={licensesIssuanceDateStart}
                  licensesIssuanceDateEnd={licensesIssuanceDateEnd}
                  onLicensesStatusChange={(v) => {
                    setLicensesStatus(v);
                    setLicensesPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  onLicensesIssuanceDateRangeChange={({
                    issuanceDateStart,
                    issuanceDateEnd,
                  }) => {
                    setLicensesIssuanceDateStart(issuanceDateStart);
                    setLicensesIssuanceDateEnd(issuanceDateEnd);
                    setLicensesPagination((prev) => ({
                      ...prev,
                      pageIndex: 1,
                    }));
                  }}
                  onLicensesTableChange={handleLicensesTableChange}
                  tickets={ticketsRows}
                  ticketsLoading={ticketsLoading}
                  ticketsStatusCount={ticketsStatusCount}
                  ticketsEnquiryStatusId={ticketsEnquiryStatusId}
                  onTicketsEnquiryStatusIdChange={(v) => {
                    setTicketsEnquiryStatusId(v);
                    setTicketsPagination((prev) => ({ ...prev, pageIndex: 1 }));
                  }}
                  ticketsEnquiryType={ticketsEnquiryType}
                  ticketsPriorityId={ticketsPriorityId}
                  onTicketsAdvancedFilterChange={
                    handleTicketsAdvancedFilterChange
                  }
                  onTicketsReset={handleTicketsReset}
                  ticketsStartTime={ticketsStartTime}
                  ticketsEndTime={ticketsEndTime}
                  onTicketsDateRangeChange={({ startTime, endTime }) => {
                    setTicketsStartTime(startTime);
                    setTicketsEndTime(endTime);
                    setTicketsPagination((prev) => ({ ...prev, pageIndex: 1 }));
                  }}
                  onTicketsTableChange={handleTicketsTableChange}
                  violationsFines={violationsFinesRows}
                  violationsFinesLoading={violationsFinesLoading}
                  violationsFinesStatusCounts={violationsFinesStatusCounts}
                  violationsFinesStatusOptions={violationsFinesStatusOptions}
                  violationsFinesTypeId={violationsFinesTypeId}
                  violationsFinesStatusId={violationsFinesStatusId}
                  violationsFinesStartTime={violationsFinesStartTime}
                  violationsFinesEndTime={violationsFinesEndTime}
                  violationsFinesPaidTimeFrom={violationsFinesPaidTimeFrom}
                  violationsFinesPaidTimeTo={violationsFinesPaidTimeTo}
                  onViolationsFinesTypeIdChange={setViolationsFinesTypeId}
                  onViolationsFinesStatusIdChange={setViolationsFinesStatusId}
                  onViolationsFinesDateRangeChange={({
                    startTime,
                    endTime,
                  }) => {
                    setViolationsFinesStartTime(startTime);
                    setViolationsFinesEndTime(endTime);
                  }}
                  onViolationsFinesPaymentDateRangeChange={({
                    paidTimeFrom,
                    paidTimeTo,
                  }) => {
                    setViolationsFinesPaidTimeFrom(paidTimeFrom);
                    setViolationsFinesPaidTimeTo(paidTimeTo);
                  }}
                  onViolationsFinesReset={handleViolationsFinesReset}
                  inspectionTasksNoFullScan={inspectionTasksNoFullScan}
                  inspectionStats={inspectionStatsNoFullScan}
                  inspectionNoFullScanLoading={inspectionNoFullScanLoading}
                  inspectionNoFullScanPagination={
                    inspectionNoFullScanTablePagination
                  }
                  inspectionNoFullScanSortDirection={
                    inspectionNoFullScanPagination.sortDirection
                  }
                  onInspectionNoFullScanTableChange={
                    handleInspectionNoFullScanTableChange
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
                    handleInspectionNoFullScanFiltersChange
                  }
                  onInspectionNoFullScanReset={handleInspectionNoFullScanReset}
                  refunds={refundsRows}
                  refundsCategory={refundsCategory}
                  onRefundsCategoryChange={(v) => {
                    setRefundsCategory(v);
                    setRefundsPagination((prev) => ({ ...prev, pageIndex: 1 }));
                  }}
                  refundsStatusId={refundsStatusId}
                  onRefundsStatusIdChange={(v) => {
                    setRefundsStatusId(v);
                    setRefundsPagination((prev) => ({ ...prev, pageIndex: 1 }));
                  }}
                  refundsStartTime={refundsStartTime}
                  refundsEndTime={refundsEndTime}
                  onRefundsDateRangeChange={({ startTime, endTime }) => {
                    setRefundsStartTime(startTime);
                    setRefundsEndTime(endTime);
                    setRefundsPagination((prev) => ({ ...prev, pageIndex: 1 }));
                  }}
                  onRefundsTableChange={handleRefundsTableChange}
                  refundsStatusCount={refundsStatusCount}
                  refundsSortDirection={refundsPagination.sortDirection}
                  onRefundsReset={handleRefundsReset}
                  appeals={appealRows}
                  appealsLoading={appealLoading}
                  appealStatusCounts={appealStatusCounts}
                  appealStatusId={appealStatusId}
                  appealStartTime={appealStartTime}
                  appealEndTime={appealEndTime}
                  onAppealStatusIdChange={setAppealStatusId}
                  onAppealDateRangeChange={({ startTime, endTime }) => {
                    setAppealStartTime(startTime);
                    setAppealEndTime(endTime);
                  }}
                  stats={applicationsStats}
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
                      ? appealLoading
                      : false
                  }
                  pagination={allOverviewTablePagination}
                  paymentsPagination={paymentsTablePagination}
                  ticketsPagination={ticketsTablePagination}
                  refundsPagination={refundsTablePagination}
                  onTableChange={handleAllOverviewTableChange}
                  onPaymentsTableChange={handlePaymentsTableChange}
                />
              ) : selectedProfile ? (
                isCommercialProfileType(selectedProfile.profileType) ? (
                  <CommercialProfileOverview
                    activeTab={profileOverviewTab}
                    profileId={selectedProfileNumericId ?? undefined}
                    onTabChange={(k) => {
                      setProfileOverviewTab(k);
                      if (k !== "basic") {
                        if (k === "applications") {
                          setCommercialApplicationsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                        if (k === "payments") {
                          setCommercialPaymentsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                        if (k === "licenses") {
                          setCommercialLicensesPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                        if (k === "tickets") {
                          setTicketsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                        if (k === "refunds") {
                          setRefundsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                        if (k === "inspection") {
                          setInspectionNoFullScanPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                      }
                    }}
                    establishmentData={commercialEstablishmentData || undefined}
                    overviewSearchKey={commercialOverviewSearchKey}
                    onOverviewSearchKeyChange={(v) => {
                      setCommercialOverviewSearchKey(v);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setInspectionNoFullScanPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    overviewTypeFilter={commercialOverviewType}
                    overviewTypeFilterOptions={allOverviewTypeOptions}
                    applicationsStatusOptions={applicationsStatusOptions}
                    onOverviewTypeFilterChange={(v) => {
                      setCommercialOverviewType(v);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    applicationsStatusId={commercialApplicationsStatusId}
                    onApplicationsStatusIdChange={(v) => {
                      setCommercialApplicationsStatusId(v);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    applicationsStartDate={commercialApplicationsStartDate}
                    applicationsEndDate={commercialApplicationsEndDate}
                    onApplicationsDateRangeChange={({ startDate, endDate }) => {
                      setCommercialApplicationsStartDate(startDate);
                      setCommercialApplicationsEndDate(endDate);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onApplicationsReset={() => {
                      setCommercialOverviewSearchKey("");
                      setCommercialOverviewType(undefined);
                      setCommercialApplicationsStatusId(undefined);
                      setCommercialApplicationsStartDate(undefined);
                      setCommercialApplicationsEndDate(undefined);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                        sortBy: "lastUpdatedTime",
                        sortDirection: 1,
                      }));
                    }}
                    applicationsRows={commercialApplicationsRows}
                    applicationsStats={commercialApplicationsStats}
                    applicationsLoading={commercialApplicationsLoading}
                    applicationsPagination={
                      commercialApplicationsTablePagination
                    }
                    onApplicationsTableChange={(
                      _p: TablePaginationConfig,
                      sorter:
                        | SorterResult<OverviewRowItem>
                        | SorterResult<OverviewRowItem>[],
                      _extra: TableCurrentDataSource<OverviewRowItem>,
                    ) => {
                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        sortBy: "lastUpdatedTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    payments={commercialPaymentsRows}
                    paymentsStats={commercialPaymentsStats}
                    paymentsLoading={commercialPaymentsLoading}
                    paymentsPagination={commercialPaymentsTablePagination}
                    onPaymentsTableChange={(p, sorter) => {
                      const nextCurrent = Number(p.current || 1);
                      const nextSize = Number(p.pageSize || 10);

                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;

                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: nextCurrent,
                        pageSize: nextSize,
                        sortBy: order
                          ? field || "transactionTime"
                          : "transactionTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    paymentsTransactionTypeOptions={
                      paymentsTransactionTypeOptions
                    }
                    paymentsStatusOptions={paymentsStatusOptions}
                    paymentsPaymentMethodOptions={paymentsPaymentMethodOptions}
                    paymentsTransactionTypeId={
                      commercialPaymentsTransactionTypeId
                    }
                    paymentsStatusId={commercialPaymentsStatusId}
                    paymentsPaymentMethodId={commercialPaymentsPaymentMethodId}
                    paymentsStartDate={commercialPaymentsStartDate}
                    paymentsEndDate={commercialPaymentsEndDate}
                    onPaymentsTransactionTypeIdChange={(v) => {
                      setCommercialPaymentsTransactionTypeId(v);
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onPaymentsStatusIdChange={(v) => {
                      setCommercialPaymentsStatusId(v);
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onPaymentsAdvancedFilterChange={({
                      paymentMethodId,
                      startDate,
                      endDate,
                    }) => {
                      setCommercialPaymentsPaymentMethodId(paymentMethodId);
                      setCommercialPaymentsStartDate(startDate);
                      setCommercialPaymentsEndDate(endDate);
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    licenses={commercialLicensesRows}
                    licensesLoading={commercialLicensesLoading}
                    licensesStats={commercialLicensesStatistics}
                    licensesPagination={commercialLicensesTablePagination}
                    licensesStatus={commercialLicensesStatus}
                    licensesIssuanceDateStart={
                      commercialLicensesIssuanceDateStart
                    }
                    licensesIssuanceDateEnd={
                      commercialLicensesIssuanceDateEnd
                    }
                    onLicensesStatusChange={(v) => {
                      setCommercialLicensesStatus(v);
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onLicensesIssuanceDateRangeChange={({
                      issuanceDateStart,
                      issuanceDateEnd,
                    }) => {
                      setCommercialLicensesIssuanceDateStart(
                        issuanceDateStart,
                      );
                      setCommercialLicensesIssuanceDateEnd(issuanceDateEnd);
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onLicensesTableChange={(p, sorter) => {
                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: Number(p.current || prev.pageIndex),
                        pageSize: Number(p.pageSize || prev.pageSize),
                        sortBy: order
                          ? field || "issuanceTime"
                          : "issuanceTime",
                        sortDirection: order
                          ? order === "ascend"
                            ? 0
                            : 1
                          : 1,
                      }));
                    }}
                    tickets={ticketsRows}
                    ticketsLoading={ticketsLoading}
                    ticketsPagination={ticketsTablePagination}
                    ticketsStatusCount={ticketsStatusCount}
                    ticketsEnquiryStatusId={ticketsEnquiryStatusId}
                    onTicketsEnquiryStatusIdChange={(v) => {
                      setTicketsEnquiryStatusId(v);
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    ticketsEnquiryType={ticketsEnquiryType}
                    ticketsPriorityId={ticketsPriorityId}
                    onTicketsAdvancedFilterChange={
                      handleTicketsAdvancedFilterChange
                    }
                    onTicketsReset={handleTicketsReset}
                    ticketsStartTime={ticketsStartTime}
                    ticketsEndTime={ticketsEndTime}
                    onTicketsDateRangeChange={({ startTime, endTime }) => {
                      setTicketsStartTime(startTime);
                      setTicketsEndTime(endTime);
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onTicketsTableChange={handleTicketsTableChange}
                    violationsFines={violationsFinesRows}
                    violationsFinesLoading={violationsFinesLoading}
                    violationsFinesStatusCounts={violationsFinesStatusCounts}
                    violationsFinesStatusOptions={violationsFinesStatusOptions}
                    violationsFinesTypeId={violationsFinesTypeId}
                    violationsFinesStatusId={violationsFinesStatusId}
                    violationsFinesStartTime={violationsFinesStartTime}
                    violationsFinesEndTime={violationsFinesEndTime}
                    violationsFinesPaidTimeFrom={violationsFinesPaidTimeFrom}
                    violationsFinesPaidTimeTo={violationsFinesPaidTimeTo}
                    onViolationsFinesTypeIdChange={setViolationsFinesTypeId}
                    onViolationsFinesStatusIdChange={setViolationsFinesStatusId}
                    onViolationsFinesDateRangeChange={({
                      startTime,
                      endTime,
                    }) => {
                      setViolationsFinesStartTime(startTime);
                      setViolationsFinesEndTime(endTime);
                    }}
                    onViolationsFinesPaymentDateRangeChange={({
                      paidTimeFrom,
                      paidTimeTo,
                    }) => {
                      setViolationsFinesPaidTimeFrom(paidTimeFrom);
                      setViolationsFinesPaidTimeTo(paidTimeTo);
                    }}
                    onViolationsFinesReset={handleViolationsFinesReset}
                    inspectionTasksNoFullScan={inspectionTasksNoFullScan}
                    inspectionStats={inspectionStatsNoFullScan}
                    inspectionNoFullScanLoading={inspectionNoFullScanLoading}
                    inspectionNoFullScanPagination={
                      inspectionNoFullScanTablePagination
                    }
                    inspectionNoFullScanSortDirection={
                      inspectionNoFullScanPagination.sortDirection
                    }
                    onInspectionNoFullScanTableChange={
                      handleInspectionNoFullScanTableChange
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
                      handleInspectionNoFullScanFiltersChange
                    }
                    onInspectionNoFullScanReset={
                      handleInspectionNoFullScanReset
                    }
                    refunds={refundsRows}
                    refundsLoading={refundsLoading}
                    refundsPagination={refundsTablePagination}
                    refundsCategory={refundsCategory}
                    onRefundsCategoryChange={(v) => {
                      setRefundsCategory(v);
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    refundsStatusId={refundsStatusId}
                    onRefundsStatusIdChange={(v) => {
                      setRefundsStatusId(v);
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    refundsStartTime={refundsStartTime}
                    refundsEndTime={refundsEndTime}
                    onRefundsDateRangeChange={({ startTime, endTime }) => {
                      setRefundsStartTime(startTime);
                      setRefundsEndTime(endTime);
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onRefundsTableChange={handleRefundsTableChange}
                    refundsStatusCount={refundsStatusCount}
                    refundsSortDirection={refundsPagination.sortDirection}
                    onRefundsReset={handleRefundsReset}
                    appeals={appealRows}
                    appealsLoading={appealLoading}
                    appealStatusCounts={appealStatusCounts}
                    appealStatusId={appealStatusId}
                    appealStartTime={appealStartTime}
                    appealEndTime={appealEndTime}
                    onAppealStatusIdChange={setAppealStatusId}
                    onAppealDateRangeChange={({ startTime, endTime }) => {
                      setAppealStartTime(startTime);
                      setAppealEndTime(endTime);
                    }}
                  />
                ) : (
                  <ProfileOverview
                    profile={selectedProfile}
                    activeTab={profileOverviewTab}
                    onTabChange={(k) => {
                      setProfileOverviewTab(k);
                      if (k === "applications") {
                        setCommercialApplicationsPagination((prev) => ({
                          ...prev,
                          pageIndex: 1,
                        }));
                      }
                      if (k === "payments") {
                        setCommercialPaymentsPagination((prev) => ({
                          ...prev,
                          pageIndex: 1,
                        }));
                      }
                      if (k === "licenses") {
                        setCommercialLicensesPagination((prev) => ({
                          ...prev,
                          pageIndex: 1,
                        }));
                      }
                      if (k === "tickets") {
                        setTicketsPagination((prev) => ({
                          ...prev,
                          pageIndex: 1,
                        }));
                      }
                      if (k === "refunds") {
                        setRefundsPagination((prev) => ({
                          ...prev,
                          pageIndex: 1,
                        }));
                      }
                      if (k === "inspection") {
                        setInspectionNoFullScanPagination((prev) => ({
                          ...prev,
                          pageIndex: 1,
                        }));
                      }
                    }}
                    personalInfo={basicPersonalInfo}
                    addressInfo={basicAddressInfo}
                    documents={basicDocuments}
                    overviewSearchKey={commercialOverviewSearchKey}
                    onOverviewSearchKeyChange={(v) => {
                      setCommercialOverviewSearchKey(v);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setInspectionNoFullScanPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    overviewTypeFilter={commercialOverviewType}
                    overviewTypeFilterOptions={allOverviewTypeOptions}
                    applicationsStatusOptions={applicationsStatusOptions}
                    onOverviewTypeFilterChange={(v) => {
                      setCommercialOverviewType(v);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    applicationsStatusId={commercialApplicationsStatusId}
                    onApplicationsStatusIdChange={(v) => {
                      setCommercialApplicationsStatusId(v);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    applicationsStartDate={commercialApplicationsStartDate}
                    applicationsEndDate={commercialApplicationsEndDate}
                    onApplicationsDateRangeChange={({ startDate, endDate }) => {
                      setCommercialApplicationsStartDate(startDate);
                      setCommercialApplicationsEndDate(endDate);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onApplicationsReset={() => {
                      setCommercialOverviewSearchKey("");
                      setCommercialOverviewType(undefined);
                      setCommercialApplicationsStatusId(undefined);
                      setCommercialApplicationsStartDate(undefined);
                      setCommercialApplicationsEndDate(undefined);
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                        sortBy: "lastUpdatedTime",
                        sortDirection: 1,
                      }));
                    }}
                    applicationsRows={commercialApplicationsRows}
                    applicationsStats={commercialApplicationsStats}
                    applicationsLoading={commercialApplicationsLoading}
                    applicationsPagination={
                      commercialApplicationsTablePagination
                    }
                    onApplicationsTableChange={(
                      _p: TablePaginationConfig,
                      sorter:
                        | SorterResult<OverviewRowItem>
                        | SorterResult<OverviewRowItem>[],
                      _extra: TableCurrentDataSource<OverviewRowItem>,
                    ) => {
                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      setCommercialApplicationsPagination((prev) => ({
                        ...prev,
                        sortBy: "lastUpdatedTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    payments={commercialPaymentsRows}
                    paymentsStats={commercialPaymentsStats}
                    paymentsLoading={commercialPaymentsLoading}
                    paymentsPagination={commercialPaymentsTablePagination}
                    onPaymentsTableChange={(p, sorter) => {
                      const nextCurrent = Number(p.current || 1);
                      const nextSize = Number(p.pageSize || 10);
                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: nextCurrent,
                        pageSize: nextSize,
                        sortBy: order
                          ? field || "transactionTime"
                          : "transactionTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    paymentsTransactionTypeOptions={
                      paymentsTransactionTypeOptions
                    }
                    paymentsStatusOptions={paymentsStatusOptions}
                    paymentsPaymentMethodOptions={paymentsPaymentMethodOptions}
                    paymentsTransactionTypeId={
                      commercialPaymentsTransactionTypeId
                    }
                    paymentsStatusId={commercialPaymentsStatusId}
                    paymentsPaymentMethodId={commercialPaymentsPaymentMethodId}
                    paymentsStartDate={commercialPaymentsStartDate}
                    paymentsEndDate={commercialPaymentsEndDate}
                    onPaymentsTransactionTypeIdChange={(v) => {
                      setCommercialPaymentsTransactionTypeId(v);
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onPaymentsStatusIdChange={(v) => {
                      setCommercialPaymentsStatusId(v);
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onPaymentsAdvancedFilterChange={({
                      paymentMethodId,
                      startDate,
                      endDate,
                    }) => {
                      setCommercialPaymentsPaymentMethodId(paymentMethodId);
                      setCommercialPaymentsStartDate(startDate);
                      setCommercialPaymentsEndDate(endDate);
                      setCommercialPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    licenses={commercialLicensesRows}
                    licensesLoading={commercialLicensesLoading}
                    licensesStats={commercialLicensesStatistics}
                    licensesPagination={commercialLicensesTablePagination}
                    licensesStatus={commercialLicensesStatus}
                    licensesIssuanceDateStart={
                      commercialLicensesIssuanceDateStart
                    }
                    licensesIssuanceDateEnd={
                      commercialLicensesIssuanceDateEnd
                    }
                    onLicensesStatusChange={(v) => {
                      setCommercialLicensesStatus(v);
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onLicensesIssuanceDateRangeChange={({
                      issuanceDateStart,
                      issuanceDateEnd,
                    }) => {
                      setCommercialLicensesIssuanceDateStart(
                        issuanceDateStart,
                      );
                      setCommercialLicensesIssuanceDateEnd(issuanceDateEnd);
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onLicensesTableChange={(p, sorter) => {
                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;
                      setCommercialLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: Number(p.current || prev.pageIndex),
                        pageSize: Number(p.pageSize || prev.pageSize),
                        sortBy: order
                          ? field || "issuanceTime"
                          : "issuanceTime",
                        sortDirection: order
                          ? order === "ascend"
                            ? 0
                            : 1
                          : 1,
                      }));
                    }}
                    tickets={ticketsRows}
                    ticketsLoading={ticketsLoading}
                    ticketsPagination={ticketsTablePagination}
                    ticketsStatusCount={ticketsStatusCount}
                    ticketsEnquiryStatusId={ticketsEnquiryStatusId}
                    onTicketsEnquiryStatusIdChange={(v) => {
                      setTicketsEnquiryStatusId(v);
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    ticketsEnquiryType={ticketsEnquiryType}
                    ticketsPriorityId={ticketsPriorityId}
                    onTicketsAdvancedFilterChange={
                      handleTicketsAdvancedFilterChange
                    }
                    onTicketsReset={handleTicketsReset}
                    ticketsStartTime={ticketsStartTime}
                    ticketsEndTime={ticketsEndTime}
                    onTicketsDateRangeChange={({ startTime, endTime }) => {
                      setTicketsStartTime(startTime);
                      setTicketsEndTime(endTime);
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onTicketsTableChange={handleTicketsTableChange}
                    violationsFines={violationsFinesRows}
                    violationsFinesLoading={violationsFinesLoading}
                    violationsFinesStatusCounts={violationsFinesStatusCounts}
                    violationsFinesStatusOptions={violationsFinesStatusOptions}
                    violationsFinesTypeId={violationsFinesTypeId}
                    violationsFinesStatusId={violationsFinesStatusId}
                    violationsFinesStartTime={violationsFinesStartTime}
                    violationsFinesEndTime={violationsFinesEndTime}
                    violationsFinesPaidTimeFrom={violationsFinesPaidTimeFrom}
                    violationsFinesPaidTimeTo={violationsFinesPaidTimeTo}
                    onViolationsFinesTypeIdChange={setViolationsFinesTypeId}
                    onViolationsFinesStatusIdChange={setViolationsFinesStatusId}
                    onViolationsFinesDateRangeChange={({
                      startTime,
                      endTime,
                    }) => {
                      setViolationsFinesStartTime(startTime);
                      setViolationsFinesEndTime(endTime);
                    }}
                    onViolationsFinesPaymentDateRangeChange={({
                      paidTimeFrom,
                      paidTimeTo,
                    }) => {
                      setViolationsFinesPaidTimeFrom(paidTimeFrom);
                      setViolationsFinesPaidTimeTo(paidTimeTo);
                    }}
                    onViolationsFinesReset={handleViolationsFinesReset}
                    inspectionTasksNoFullScan={inspectionTasksNoFullScan}
                    inspectionStats={inspectionStatsNoFullScan}
                    inspectionNoFullScanLoading={inspectionNoFullScanLoading}
                    inspectionNoFullScanPagination={
                      inspectionNoFullScanTablePagination
                    }
                    inspectionNoFullScanSortDirection={
                      inspectionNoFullScanPagination.sortDirection
                    }
                    onInspectionNoFullScanTableChange={
                      handleInspectionNoFullScanTableChange
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
                      handleInspectionNoFullScanFiltersChange
                    }
                    onInspectionNoFullScanReset={
                      handleInspectionNoFullScanReset
                    }
                    refunds={refundsRows}
                    refundsLoading={refundsLoading}
                    refundsPagination={refundsTablePagination}
                    refundsCategory={refundsCategory}
                    onRefundsCategoryChange={(v) => {
                      setRefundsCategory(v);
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    refundsStatusId={refundsStatusId}
                    onRefundsStatusIdChange={(v) => {
                      setRefundsStatusId(v);
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    refundsStartTime={refundsStartTime}
                    refundsEndTime={refundsEndTime}
                    onRefundsDateRangeChange={({ startTime, endTime }) => {
                      setRefundsStartTime(startTime);
                      setRefundsEndTime(endTime);
                      setRefundsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    onRefundsTableChange={handleRefundsTableChange}
                    refundsStatusCount={refundsStatusCount}
                    refundsSortDirection={refundsPagination.sortDirection}
                    onRefundsReset={handleRefundsReset}
                    appeals={appealRows}
                    appealsLoading={appealLoading}
                    appealStatusCounts={appealStatusCounts}
                    appealStatusId={appealStatusId}
                    appealStartTime={appealStartTime}
                    appealEndTime={appealEndTime}
                    onAppealStatusIdChange={setAppealStatusId}
                    onAppealDateRangeChange={({ startTime, endTime }) => {
                      setAppealStartTime(startTime);
                      setAppealEndTime(endTime);
                    }}
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      </Spin>

      {canManageAccount && (
        <div className="details-footer detail-action-footer">
        <div>
          <CustomButton
            text={t("common.back")}
            variant="outline"
            onClick={() => history.goBack()}
            disabled={loading}
          />
        </div>
        <div className="footer-inner">
          {isAccountActive ? (
            <CustomButton
              text={t("Customer.accounts.modals.suspendCustomer")}
              key={"Suspend"}
              variant="danger-outline"
              customClassName="customer-details-suspend-button"
              onClick={() => setSuspendModalVisible(true)}
              disabled={loading}
              permissionCode="CustomerModule.Customers.CustomerDetails.Confirm"
              permissionRoutePath="/happiness/customerManagement/customer-details"
            />
          ) : (
            <CustomButton
              key={"activate"}
              text={t("Customer.accounts.modals.activateAccount")}
              variant="primary"
              onClick={() => setActivateModalVisible(true)}
              disabled={loading}
              permissionCode="CustomerModule.Customers.CustomerDetails.Confirm"
              permissionRoutePath="/happiness/customerManagement/customer-details"
            />
          )}
        </div>
        </div>
      )}

      <ConfirmModal
        loading={activateModalLoading}
        onCancel={() => setActivateModalVisible(false)}
        onConfirm={handleConfirmAction}
        visible={activateModalVisible}
        type="warning"
        title={t("Customer.accounts.modals.activateAccount")}
        content={t("Customer.accounts.modals.activateAccountConfirm")}
      />

      <Modal
        centered
        className="profiles-action-modal"
        visible={suspendModalVisible}
        onCancel={() => {
          setSuspendModalVisible(false);
          setSuspendNotes("");
          setSuspendNotesError("");
        }}
        footer={null}
        title={t("Customer.accounts.modals.suspendCustomer")}
        destroyOnClose
      >
        <AlertBanner
          content={t("Customer.accounts.modals.suspendCustomerConfirm")}
        />
        <div className="profiles-modal-body">
          <div className="profiles-modal-section">
            <div className="profiles-modal-label">
              {t("Customer.accounts.modals.notes")}
              <span className="required-mark">*</span>
            </div>
            <Form component={false}>
              <Form.Item
                className="profiles-modal-textarea-item"
                validateStatus={suspendNotesError ? "error" : undefined}
                help={suspendNotesError || undefined}
              >
                <Input.TextArea
                  placeholder={t("Customer.accounts.modals.enterNotes")}
                  value={suspendNotes}
                  maxLength={1000}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setSuspendNotes(nextValue);
                    if (suspendNotesError) {
                      setSuspendNotesError(
                        nextValue.trim()
                          ? ""
                          : t("Customer.tickets.common.pleaseEnterNotes"),
                      );
                    }
                  }}
                  autoSize={{ minRows: 4, maxRows: 6 }}
                />
              </Form.Item>
            </Form>
            <div className="profiles-modal-counter">
              {suspendNotes.length} / 1000
            </div>
          </div>

          <div className="profiles-modal-section">
            <div className="profiles-modal-label">
              {t("Customer.accounts.modals.quickNotes")}
            </div>
            <div className="profiles-quick-notes">
              {quickNotes.map((text: string) => (
                <button
                  key={text}
                  type="button"
                  className="profiles-quick-note"
                  onClick={() => {
                    setSuspendNotes((prev: string) => {
                      const next = prev ? `${prev}\n${text}` : text;
                      return next.slice(0, 1000);
                    });
                    setSuspendNotesError("");
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div className="profiles-modal-footer">
            <CustomButton
              variant="danger-outline"
              text={t("common.cancel")}
              onClick={() => {
                setSuspendModalVisible(false);
                setSuspendNotes("");
                setSuspendNotesError("");
              }}
              disabled={suspendModalLoading}
            />
            <CustomButton
              variant="danger"
              text={t("common.confirm")}
              loading={suspendModalLoading}
              onClick={handleSuspendCustomer}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerDetailsPage;
