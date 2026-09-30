import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Empty, Input, Modal, Spin } from "antd";
import type { TablePaginationConfig } from "antd/es/table";
import type {
  SorterResult,
  TableCurrentDataSource,
} from "antd/es/table/interface";
import { useHistory, useLocation } from "react-router-dom";
import dayjs from "dayjs";

import DetailSection from "@/pages/CustomerDetails/components/DetailSection";
import InfoGrid from "@/pages/CustomerDetails/components/InfoGrid";
import DocumentViewer from "@/components/common/DocumentViewer";
import {
  ConfirmModal,
  CustomButton,
  CustomFooter,
  CustomMessage,
  PaginationTotal,
} from "@/components/common";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { useButtonPermission } from "@/routes/access";
import SelfMonitorBadge, {
  type SelfMonitorProgramInfo,
} from "@/components/common/SelfMonitorBadge";
import { AuthenticatedDocumentAvatar } from "@/components/common/AuthenticatedDocumentMedia";
import AlertBanner from "@/components/common/AlertBanner";

import CommercialProfileOverview from "@/pages/CustomerDetails/components/CommercialProfileOverview";

import type {
  OverviewRowItem,
  PaymentCountStats,
  PaymentItem,
  LicenseItem,
  RefundItem,
  TicketItem,
  InspectionNoFullScanFilters,
  InspectionNoFullScanSelectOption,
  InspectionOverviewItem,
  InspectionOverviewStats,
  ViolationFineItem,
  AppealItem,
} from "@/pages/CustomerDetails/types";

import {
  getAccountOrIndividualOrEstablishment,
  getUserProfileEstablishment,
  getUserProfilePersonal,
  updateProfileActiveAsync,
  type CustomerAccountOrProfileOverviewDto,
} from "@/services/userManagement";

import {
  applicationPageByProfile,
  getApplicationStatuses,
  getServiceConfigServiceType,
  type ApplicationPageByProfileItem,
  type IApplicationStatus,
  type IServiceType,
} from "@/services/application";
import {
  buildApplicationStatusOptions,
  buildApplicationTypeOptions,
  mapApplicationPageItemToOverviewRow,
  unwrapApplicationDictionaryItems,
  unwrapApplicationPageResponse,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/applicationFilterOptions";
import {
  getFinancePaymentsCount,
  getFinancePaymentsCountSummary,
  type FinanceAccountPaymentsResponse,
  type FinancePaymentTransactionItem,
  type FinancePaymentsSummary,
} from "@/services/wallet";
import {
  getFinancePaymentsTotal,
  mapFinancePaymentItem,
  mapFinancePaymentsSummary,
  unwrapFinanceResponse,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/paymentUtils";
import { getTypeDictionaries } from "@/services/serviceApi";
import {
  getLicenseManagementList,
  getStatistics,
  type StatisticsResponseDto,
} from "@/services/license";
import {
  createEmptyLicenseStatistics,
  mapLicenseListResponse,
  mapLicenseStatistics,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/licenseUtils";
import { getAccountTickets, getTicketsStatusCount } from "@/services/tickets";
import { getProfileRefundsByUserProfile } from "@/services/refunds";
import { getInspectionProfileAppeals } from "@/services/inspectionAppeals";
import {
  createEmptyRefundOverviewStats,
  mapProfileRefundListResponse,
  mapProfileRefundStats,
  type RefundOverviewStats,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/refundProfileUtils";
import {
  createEmptyAppealOverviewStats,
  mapProfileAppealListResponse,
  mapProfileAppealStats,
  type AppealOverviewStats,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/appealProfileUtils";
import { useProfileAppealSearch } from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/useProfileAppealSearch";
import {
  createEmptyTicketsStatusCount,
  mapAccountTicketsResponse,
  mapTicketsStatusCount,
  type NormalizedTicketsStatusCount,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/ticketUtils";
import {
  getInspectionInspectors,
  getInspectionPriorities,
  getInspectionProfileTaskStats,
  getInspectionReasons,
  getInspectionTaskStatuses,
  getInspectionTasksByUserProfile,
  type InspectionLookupOption,
} from "@/services/inspection";
import {
  buildInspectionLookupOptions,
  buildInspectionPriorityOptions,
  buildInspectionStatusOptions,
  createEmptyInspectionOverviewStats,
  getInspectionNumberParam,
  mapInspectionProfileStats,
  mapInspectionProfileTaskListResponse,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/inspectionProfileUtils";
import {
  buildViolationFilterStatusOptions,
  createEmptyViolationStatusCounts,
  mapCustomerProfileViolationFilterStatusOptions,
  mapCustomerProfileViolationRows,
  mapCustomerProfileViolationStatusCounts,
} from "@/pages/CustomerDetails/components/allProfilesOverviewTabs/violationProfileUtils";
import { getCustomerProfileViolations } from "@/services/customerManagement";

import "./index.less";
import ProfileOverview from "@/pages/CustomerDetails/components/ProfileOverview";
import AED from "@/assets/icons/Aed";
import { formatMoney } from "@/utils/utils";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  createContactNumberSnapshot,
  getContactNumberDisplay,
} from "@/components/common/MobileNumberInput";

type ViewType = "individual" | "commercial";

type SelectOption = { label: string; value: string };

type InfoItem = {
  key: string;
  label: string;
  value: React.ReactNode;
  span?: number;
};

type DocumentItem = {
  key: string;
  label: string;
  url?: string;
};

const safeText = (value?: string | number | null) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    return value.trim() === "" ? "-" : value;
  }
  return String(value);
};

const buildAddressInfoItems = (addressInfo: any, t: TFunction): InfoItem[] => {
  if (!addressInfo) return [];
  const emirate =
    addressInfo?.emirateObj?.nameEn || addressInfo?.emirateObj?.nameAr;
  const region =
    addressInfo?.regionObj?.nameEn || addressInfo?.regionObj?.nameAr;
  const area = addressInfo?.areaObj?.nameEn || addressInfo?.areaObj?.nameAr;
  const street =
    addressInfo?.streetObj?.nameEn || addressInfo?.streetObj?.nameAr;

  const items: InfoItem[] = [];
  items.push({
    key: "emirate",
    label: t("Customer.ticketsDetails.establishment.emirate"),
    value: safeText(emirate),
  });
  items.push({
    key: "region",
    label: t("Customer.ticketsDetails.establishment.region"),
    value: safeText(region),
  });
  items.push({
    key: "area",
    label: t("Customer.ticketsDetails.establishment.area"),
    value: safeText(area),
  });
  items.push({
    key: "street",
    label: t("Customer.ticketsDetails.establishment.street"),
    value: safeText(street),
  });
  return items;
};

const unwrapApiPayload = <T,>(res: any): T | null => {
  const raw = res?.data ?? res;
  if (raw?.isSuccess === false) return null;
  return (raw?.data ?? raw) as T;
};

const normalizeLower = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

const updateSearchParam = (search: string, next: Record<string, string>) => {
  const sp = new URLSearchParams(search);
  Object.entries(next).forEach(([k, v]) => {
    sp.set(k, v);
  });
  return `?${sp.toString()}`;
};

const unwrapListPayload = (res: any) => (res as any)?.data ?? res;

const buildPersonalInfoItems = (personal: any, t: TFunction): InfoItem[] => {
  if (!personal) return [];

  return [
    {
      key: "full-name-en",
      label: t("Customer.customerProfileDetail.personal.fullNameInEnglish"),
      value: safeText(personal?.nameEn),
    },
    {
      key: "full-name-ar",
      label: t("Customer.customerProfileDetail.personal.fullNameInArabic"),
      value: safeText(personal?.nameAr),
    },
    {
      key: "emirates-id",
      label: t("Customer.customerDetails.accountInfo.emiratesId"),
      value: safeText(personal?.emiratesId),
    },
    {
      key: "nationality",
      label: t("Customer.customerDetails.accountInfo.nationality"),
      value: safeText(
        personal?.nationalityObj?.nameEn || personal?.nationalityObj?.nameAr,
      ),
    },
    {
      key: "gender",
      label: t("Customer.customerProfileDetail.personal.gender"),
      value: safeText(
        personal?.genderObj?.nameEn || personal?.genderObj?.nameAr,
      ),
    },
    {
      key: "occupation",
      label: t("Customer.customerProfileDetail.personal.occupation"),
      value: safeText(personal?.occupation),
    },
    {
      key: "date-birth",
      label: t("Customer.customerProfileDetail.personal.dateOfBirth"),
      value: personal?.birthDate
        ? dayjs(personal.birthDate).format("DD/MM/YYYY")
        : "-",
    },
    {
      key: "expiry-date",
      label: t("Customer.customerProfileDetail.personal.expiryDate"),
      value: personal?.passportExpiryDate
        ? dayjs(personal.passportExpiryDate).format("DD/MM/YYYY")
        : "-",
    },
  ];
};

const buildPersonalDocuments = (docInfo: any, t: TFunction): DocumentItem[] => {
  if (!docInfo) return [];

  const items: DocumentItem[] = [];

  if (docInfo?.photoUrl) {
    items.push({
      key: "photo",
      label: t("Customer.customerProfileDetail.documents.personalPhoto"),
      url: docInfo.photoUrl,
    });
  }
  if (docInfo?.emiratesIdCopyUrl) {
    items.push({
      key: "emirates-id-copy",
      label: t("Customer.customerProfileDetail.documents.emiratesIdCopy"),
      url: docInfo.emiratesIdCopyUrl,
    });
  }
  if (docInfo?.passportCopyUrl) {
    items.push({
      key: "passport-copy",
      label: t("Customer.customerProfileDetail.documents.passportCopy"),
      url: docInfo.passportCopyUrl,
    });
  }
  if (docInfo?.acquitanceFormUrl) {
    items.push({
      key: "acquaintance-form",
      label: t("Customer.customerProfileDetail.documents.acquaintanceForm"),
      url: docInfo.acquitanceFormUrl,
    });
  }

  return items;
};

const ProfileDetail = () => {
  const { canRenderButton } = useButtonPermission(
    "/happiness/customerManagement/customerProfileDetail",
  );
  const canManageProfile = canRenderButton(
    "CustomerModule.Customers.ProfileDetail.Confirm",
  );
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const history = useHistory();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const profileId = useMemo(() => searchParams.get("id"), [searchParams]);
  const type = useMemo(() => {
    const raw = (searchParams.get("type") || "commercial").toLowerCase();
    return (raw === "individual" ? "individual" : "commercial") as ViewType;
  }, [searchParams]);

  const profileTier = useMemo(
    () => safeText(searchParams.get("tier")),
    [searchParams],
  );
  const profileStatus = useMemo(
    () => safeText(searchParams.get("status")),
    [searchParams],
  );
  const customerId = useMemo(
    () => searchParams.get("customerId"),
    [searchParams],
  );

  const [commercialActiveTab, setCommercialActiveTab] = useState("basic");

  const [actionModal, setActionModal] = useState<"suspend" | "activate" | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesValidationAttempted, setNotesValidationAttempted] =
    useState(false);
  const notesRequiredError = notesValidationAttempted && !notes.trim();

  const numericProfileId = useMemo(() => {
    const id = Number(profileId);
    return Number.isFinite(id) ? id : null;
  }, [profileId]);

  const userId = useMemo(() => {
    const raw = customerId ?? "";
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
  }, [customerId]);

  const optionalUserId = useMemo(() => userId || undefined, [userId]);

  const [overviewSearchKey, setOverviewSearchKey] = useState("");
  const [overviewTypeFilter, setOverviewTypeFilter] = useState<
    string | undefined
  >(undefined);
  const [overviewTypeFilterOptions, setOverviewTypeFilterOptions] = useState<
    SelectOption[]
  >([]);
  const [applicationsStatusOptions, setApplicationsStatusOptions] = useState<
    SelectOption[]
  >([{ label: t("Customer.customerDetails.common.allStatuses"), value: "" }]);
  const [applicationsStatusId, setApplicationsStatusId] = useState<
    string | undefined
  >(undefined);
  const [applicationsStartDate, setApplicationsStartDate] = useState<
    string | undefined
  >(undefined);
  const [applicationsEndDate, setApplicationsEndDate] = useState<
    string | undefined
  >(undefined);

  const [paymentsTransactionTypeOptions, setPaymentsTransactionTypeOptions] =
    useState<SelectOption[]>([]);
  const [paymentsStatusOptions, setPaymentsStatusOptions] = useState<
    SelectOption[]
  >([]);
  const [paymentsTransactionTypeId, setPaymentsTransactionTypeId] = useState<
    string | undefined
  >(undefined);
  const [paymentsStatusId, setPaymentsStatusId] = useState<string | undefined>(
    undefined,
  );
  const [paymentsStartDate, setPaymentsStartDate] = useState<
    string | undefined
  >(undefined);
  const [paymentsEndDate, setPaymentsEndDate] = useState<string | undefined>(
    undefined,
  );

  const [licensesStatus, setLicensesStatus] = useState<string | undefined>(
    undefined,
  );
  const [licensesIssuanceDateStart, setLicensesIssuanceDateStart] = useState<
    string | undefined
  >(undefined);
  const [licensesIssuanceDateEnd, setLicensesIssuanceDateEnd] = useState<
    string | undefined
  >(undefined);

  const [applicationsRows, setApplicationsRows] = useState<OverviewRowItem[]>(
    [],
  );
  const [applicationsStats, setApplicationsStats] = useState({
    total: 0,
    licenses: 0,
    content: 0,
    rejected: 0,
    completed: 0,
  });
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsPagination, setApplicationsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "lastUpdatedTime" as const,
    sortDirection: 1 as 0 | 1,
  });

  const [paymentsRows, setPaymentsRows] = useState<PaymentItem[]>([]);
  const [paymentsStats, setPaymentsStats] = useState<PaymentCountStats | null>(
    null,
  );
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsPagination, setPaymentsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: undefined as string | undefined,
    sortDirection: undefined as 0 | 1 | undefined,
  });

  const [licensesRows, setLicensesRows] = useState<LicenseItem[]>([]);
  const [licensesStatistics, setLicensesStatistics] =
    useState<StatisticsResponseDto>(createEmptyLicenseStatistics);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [licensesPagination, setLicensesPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "issuanceTime" as string | undefined,
    sortDirection: 1 as 0 | 1 | undefined,
  });

  const [ticketsRows, setTicketsRows] = useState<TicketItem[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
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
  const [ticketsPagination, setTicketsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "updatedOn" as string | undefined,
    sortDirection: 1 as 0 | 1 | undefined,
  });

  const [refundsRows, setRefundsRows] = useState<RefundItem[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsStatusCount, setRefundsStatusCount] =
    useState<RefundOverviewStats>(createEmptyRefundOverviewStats);
  const [refundsCategory, setRefundsCategory] = useState<string | undefined>();
  const [refundsStatusId, setRefundsStatusId] = useState<string | undefined>();
  const [refundsStartTime, setRefundsStartTime] = useState<
    string | undefined
  >();
  const [refundsEndTime, setRefundsEndTime] = useState<string | undefined>();
  const [refundsPagination, setRefundsPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "UpdateOn" as string | undefined,
    sortDirection: 1 as 0 | 1,
  });

  const [appealRows, setAppealRows] = useState<AppealItem[]>([]);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealStatusCounts, setAppealStatusCounts] =
    useState<AppealOverviewStats>(createEmptyAppealOverviewStats);
  const [appealStatusId, setAppealStatusId] = useState<string | undefined>();
  const [appealStartTime, setAppealStartTime] = useState<string | undefined>();
  const [appealEndTime, setAppealEndTime] = useState<string | undefined>();
  const debouncedAppealSearchKey = useProfileAppealSearch(overviewSearchKey);

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

  const [inspectionRows, setInspectionRows] = useState<
    InspectionOverviewItem[]
  >([]);
  const [inspectionStats, setInspectionStats] =
    useState<InspectionOverviewStats>(createEmptyInspectionOverviewStats);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionFilters, setInspectionFilters] =
    useState<InspectionNoFullScanFilters>({});
  const [inspectionReasonOptions, setInspectionReasonOptions] = useState<
    InspectionNoFullScanSelectOption[]
  >([]);
  const [inspectionStatusOptions, setInspectionStatusOptions] = useState<
    InspectionNoFullScanSelectOption[]
  >(buildInspectionStatusOptions([], false, t));
  const [inspectionPriorityOptions, setInspectionPriorityOptions] = useState<
    InspectionNoFullScanSelectOption[]
  >(buildInspectionPriorityOptions([], false, t));
  const [inspectionInspectorOptions, setInspectionInspectorOptions] = useState<
    InspectionNoFullScanSelectOption[]
  >([]);
  const [inspectionPagination, setInspectionPagination] = useState({
    pageIndex: 1,
    pageSize: 10,
    total: 0,
    sortBy: "AssignedOn" as const,
    sortDirection: "desc" as "asc" | "desc",
  });

  const [loading, setLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);

  const [personalPayload, setPersonalPayload] = useState<any>(null);
  const [establishmentPayload, setEstablishmentPayload] = useState<any>(null);
  const [accountOverview, setAccountOverview] =
    useState<CustomerAccountOrProfileOverviewDto | null>(null);

  const paymentsIdentity = useMemo(() => {
    if (!accountOverview) {
      return { userId: undefined, profileId: undefined };
    }

    const directUserId = String(accountOverview.userId ?? "").trim();
    const fallbackUserId = String(
      accountOverview.allProfileCount?.userId ?? "",
    ).trim();
    const matchedProfileId = Array.isArray(accountOverview.profileList)
      ? accountOverview.profileList.find(
          (profile) => Number(profile?.profileId) === numericProfileId,
        )?.profileId
      : undefined;
    const profileId = Number(matchedProfileId ?? numericProfileId);

    return {
      userId: directUserId || fallbackUserId || undefined,
      profileId:
        Number.isFinite(profileId) && profileId > 0 ? profileId : undefined,
    };
  }, [accountOverview, numericProfileId]);

  const load = useCallback(async () => {
    if (!profileId) {
      history.replace("/happiness/customerManagement");
      return;
    }

    if (!numericProfileId) {
      history.replace("/happiness/customerManagement");
      return;
    }

    setLoading(true);
    try {
      if (type === "individual") {
        const res: any = await getUserProfilePersonal(numericProfileId);
        const payload = unwrapApiPayload<any>(res);
        if (!payload) {
          return;
        }
        setPersonalPayload(payload);
        setEstablishmentPayload(null);
      } else {
        const res: any = await getUserProfileEstablishment(numericProfileId);
        const payload = unwrapApiPayload<any>(res);
        if (!payload) {
          return;
        }
        setEstablishmentPayload(payload);
        setPersonalPayload(null);

        setCommercialActiveTab("basic");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load profile detail", error);
    } finally {
      setLoading(false);
    }
  }, [history, numericProfileId, profileId, type]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [
          serviceTypesRes,
          applicationStatusesRes,
          walletTypesRes,
          walletStatusesRes,
        ] = await Promise.all([
          getServiceConfigServiceType(),
          getApplicationStatuses(),
          getTypeDictionaries("Wallet Transaction Type"),
          getTypeDictionaries("Wallet Transaction Status"),
        ]);

        const serviceTypes =
          unwrapApplicationDictionaryItems<IServiceType>(serviceTypesRes);
        const applicationStatuses =
          unwrapApplicationDictionaryItems<IApplicationStatus>(
            applicationStatusesRes,
          );
        const isArabic = i18n.language?.toLowerCase().startsWith("ar");
        const mappedServiceTypes = buildApplicationTypeOptions(
          serviceTypes,
          isArabic,
          t("Customer.customerDetails.common.allTypes"),
        );
        const mappedApplicationStatuses = buildApplicationStatusOptions(
          applicationStatuses,
          isArabic,
          t("Customer.customerDetails.common.allStatuses"),
        );

        const walletTypes = unwrapListPayload(walletTypesRes);
        const walletStatuses = unwrapListPayload(walletStatusesRes);

        const mappedWalletTypes: SelectOption[] = [
          { label: t("Customer.customerDetails.common.allTypes"), value: "" },
          ...(Array.isArray(walletTypes)
            ? walletTypes
                .filter((x: any) => x?.isShown !== false)
                .map((x: any) => ({
                  label: x?.nameEn || x?.code,
                  value: String(x?.id ?? x?.code ?? ""),
                }))
            : []),
        ];

        const mappedWalletStatuses: SelectOption[] = [
          {
            label: t("Customer.customerDetails.common.allStatuses"),
            value: "",
          },
          ...(Array.isArray(walletStatuses)
            ? walletStatuses
                .filter((x: any) => x?.isShown !== false)
                .map((x: any) => ({
                  label: x?.nameEn || x?.code,
                  value: String(x?.id ?? x?.code ?? ""),
                }))
            : []),
        ];

        if (cancelled) return;
        setOverviewTypeFilterOptions(mappedServiceTypes);
        setApplicationsStatusOptions(mappedApplicationStatuses);
        setPaymentsTransactionTypeOptions(mappedWalletTypes);
        setPaymentsStatusOptions(mappedWalletStatuses);
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setOverviewTypeFilterOptions(
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
        setPaymentsTransactionTypeOptions([
          { label: t("Customer.customerDetails.common.allTypes"), value: "" },
        ]);
        setPaymentsStatusOptions([
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

  useEffect(() => {
    let cancelled = false;
    const isArabic = i18n.language?.toLowerCase().startsWith("ar");

    setInspectionStatusOptions(buildInspectionStatusOptions([], isArabic, t));
    setInspectionPriorityOptions(
      buildInspectionPriorityOptions([], isArabic, t),
    );

    const run = async () => {
      const [reasons, statuses, priorities, inspectors] = await Promise.all([
        getInspectionReasons().catch(() => [] as InspectionLookupOption[]),
        getInspectionTaskStatuses().catch(() => [] as InspectionLookupOption[]),
        getInspectionPriorities().catch(() => [] as InspectionLookupOption[]),
        getInspectionInspectors().catch(() => [] as InspectionLookupOption[]),
      ]);

      if (cancelled) return;
      setInspectionReasonOptions(
        buildInspectionLookupOptions(reasons, isArabic),
      );
      setInspectionStatusOptions(
        buildInspectionStatusOptions(statuses, isArabic, t),
      );
      setInspectionPriorityOptions(
        buildInspectionPriorityOptions(priorities, isArabic, t),
      );
      setInspectionInspectorOptions(
        buildInspectionLookupOptions(inspectors, isArabic),
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, t]);

  useEffect(() => {
    if (!numericProfileId) return;
    if (commercialActiveTab !== "applications") return;

    let cancelled = false;
    const run = async () => {
      setApplicationsLoading(true);
      try {
        const res = await applicationPageByProfile({
          userId: optionalUserId as any,
          profileId: numericProfileId,
          pageIndex: applicationsPagination.pageIndex,
          pageSize: applicationsPagination.pageSize,
          sortBy: applicationsPagination.sortBy,
          sortDirection: applicationsPagination.sortDirection,
          keyword: overviewSearchKey || undefined,
          serviceType: overviewTypeFilter || undefined,
          processInstanceStatusCode: applicationsStatusId || undefined,
          submissionStartTime: applicationsStartDate || undefined,
          submissionEndTime: applicationsEndDate || undefined,
        });

        if (cancelled) return;
        const data = unwrapApplicationPageResponse(res);

        setApplicationsStats({
          total: Number(data?.report?.totalCount || 0),
          licenses: Number(data?.report?.licenseCount || 0),
          content: Number(data?.report?.contentCount || 0),
          rejected: Number(data?.report?.rejectedCount || 0),
          completed: Number(data?.report?.completedCount || 0),
        });

        const items = (
          Array.isArray(data?.page?.items) ? data.page.items : []
        ).filter((item): item is ApplicationPageByProfileItem =>
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
        if (cancelled) return;
        console.error(e);
        setApplicationsRows([]);
        setApplicationsStats({
          total: 0,
          licenses: 0,
          content: 0,
          rejected: 0,
          completed: 0,
        });
        setApplicationsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setApplicationsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    applicationsEndDate,
    applicationsPagination.pageIndex,
    applicationsPagination.pageSize,
    applicationsPagination.sortBy,
    applicationsPagination.sortDirection,
    applicationsStartDate,
    applicationsStatusId,
    commercialActiveTab,
    numericProfileId,
    overviewSearchKey,
    overviewTypeFilter,
    optionalUserId,
  ]);

  useEffect(() => {
    if (commercialActiveTab !== "payments") return;

    if (accountLoading) {
      setPaymentsLoading(true);
      setPaymentsRows([]);
      setPaymentsPagination((prev) =>
        prev.total === 0 ? prev : { ...prev, total: 0 },
      );
      return;
    }

    if (!paymentsIdentity.userId || !paymentsIdentity.profileId) {
      setPaymentsLoading(false);
      setPaymentsRows([]);
      setPaymentsPagination((prev) =>
        prev.total === 0 ? prev : { ...prev, total: 0 },
      );
      return;
    }

    let cancelled = false;
    const run = async () => {
      setPaymentsLoading(true);
      try {
        const listRes = await getFinancePaymentsCount({
          userId: paymentsIdentity.userId,
          profileId: paymentsIdentity.profileId,
          pageIndex: paymentsPagination.pageIndex,
          pageSize: paymentsPagination.pageSize,
          keyword: overviewSearchKey || undefined,
          transactionTypeId: paymentsTransactionTypeId || undefined,
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
        const mapped = items.map(
          (item: FinancePaymentTransactionItem, index) =>
            mapFinancePaymentItem(item, index, i18n.language, type),
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
    accountLoading,
    commercialActiveTab,
    i18n.language,
    overviewSearchKey,
    paymentsIdentity.profileId,
    paymentsIdentity.userId,
    paymentsEndDate,
    paymentsPagination.pageIndex,
    paymentsPagination.pageSize,
    paymentsPagination.sortDirection,
    paymentsStartDate,
    paymentsStatusId,
    paymentsTransactionTypeId,
    type,
  ]);

  useEffect(() => {
    if (commercialActiveTab !== "payments") return;

    if (accountLoading) {
      setPaymentsStats(null);
      return;
    }

    if (!paymentsIdentity.userId || !paymentsIdentity.profileId) {
      setPaymentsStats(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const response = await getFinancePaymentsCountSummary({
          userId: paymentsIdentity.userId,
          profileId: paymentsIdentity.profileId,
        });
        if (cancelled) return;

        const summary = unwrapFinanceResponse<FinancePaymentsSummary>(response);
        setPaymentsStats(summary ? mapFinancePaymentsSummary(summary) : null);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setPaymentsStats(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    accountLoading,
    commercialActiveTab,
    paymentsIdentity.profileId,
    paymentsIdentity.userId,
  ]);

  useEffect(() => {
    if (!numericProfileId) return;
    if (commercialActiveTab !== "licenses") return;

    let cancelled = false;
    const run = async () => {
      setLicensesLoading(true);
      try {
        const listRes = await getLicenseManagementList({
          userId: optionalUserId || undefined,
          profileId: numericProfileId,
          pageIndex: licensesPagination.pageIndex,
          pageSize: licensesPagination.pageSize,
          sortBy: licensesPagination.sortBy || "issuanceTime",
          sortDirection: licensesPagination.sortDirection ?? 1,
          keyword: overviewSearchKey || undefined,
          status: licensesStatus || undefined,
          issuanceDateStart: licensesIssuanceDateStart || undefined,
          issuanceDateEnd: licensesIssuanceDateEnd || undefined,
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
    commercialActiveTab,
    i18n.language,
    licensesIssuanceDateEnd,
    licensesIssuanceDateStart,
    licensesPagination.pageIndex,
    licensesPagination.pageSize,
    licensesPagination.sortBy,
    licensesPagination.sortDirection,
    licensesStatus,
    numericProfileId,
    overviewSearchKey,
    optionalUserId,
  ]);

  useEffect(() => {
    if (!numericProfileId) return;
    if (commercialActiveTab !== "licenses") return;

    let cancelled = false;
    const run = async () => {
      try {
        const response = await getStatistics(
          optionalUserId || undefined,
          numericProfileId,
        );
        if (!cancelled) {
          setLicensesStatistics(mapLicenseStatistics(response));
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setLicensesStatistics(createEmptyLicenseStatistics());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [commercialActiveTab, numericProfileId, optionalUserId]);

  useEffect(() => {
    if (!numericProfileId) {
      setViolationsFinesRows([]);
      return;
    }
    if (commercialActiveTab !== "violations-fines") return;

    let cancelled = false;
    const run = async () => {
      setViolationsFinesLoading(true);
      try {
        const response = await getCustomerProfileViolations({
          profileId: numericProfileId,
          keyword: overviewSearchKey.trim() || undefined,
          startTime: violationsFinesStartTime,
          endTime: violationsFinesEndTime,
          violationTypeId: getInspectionNumberParam(violationsFinesTypeId),
          statusId: getInspectionNumberParam(violationsFinesStatusId),
          paidTimeFrom: violationsFinesPaidTimeFrom,
          paidTimeTo: violationsFinesPaidTimeTo,
        });

        if (!cancelled) {
          setViolationsFinesRows(mapCustomerProfileViolationRows(response));
        }
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
    commercialActiveTab,
    numericProfileId,
    overviewSearchKey,
    violationsFinesEndTime,
    violationsFinesPaidTimeFrom,
    violationsFinesPaidTimeTo,
    violationsFinesStartTime,
    violationsFinesStatusId,
    violationsFinesTypeId,
  ]);

  useEffect(() => {
    if (!numericProfileId) {
      setViolationsFinesStatusCounts(createEmptyViolationStatusCounts());
      setViolationsFinesStatusOptions(buildViolationFilterStatusOptions());
      return;
    }
    if (commercialActiveTab !== "violations-fines") return;

    let cancelled = false;
    const run = async () => {
      try {
        const response = await getCustomerProfileViolations({
          profileId: numericProfileId,
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
  }, [commercialActiveTab, numericProfileId]);

  useEffect(() => {
    if (!numericProfileId) return;
    if (commercialActiveTab !== "tickets") return;

    let cancelled = false;
    const run = async () => {
      setTicketsLoading(true);
      try {
        const response = await getAccountTickets({
          UserId: optionalUserId,
          UserProfileId: numericProfileId,
          SearchKey: overviewSearchKey || undefined,
          StartTime: ticketsStartTime || undefined,
          EndTime: ticketsEndTime || undefined,
          EnquiryType: ticketsEnquiryType
            ? Number(ticketsEnquiryType)
            : undefined,
          PriorityId: ticketsPriorityId ? Number(ticketsPriorityId) : undefined,
          EnquiryStatusId: ticketsEnquiryStatusId || undefined,
          PageIndex: ticketsPagination.pageIndex,
          PageSize: ticketsPagination.pageSize,
          SortBy: ticketsPagination.sortBy || "updatedOn",
          SortDirection: ticketsPagination.sortDirection ?? 1,
        });

        if (cancelled) return;
        const data = mapAccountTicketsResponse(response, i18n.language, t);
        setTicketsRows(data.items);
        setTicketsPagination((prev) => ({ ...prev, total: data.total }));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
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
    commercialActiveTab,
    i18n.language,
    numericProfileId,
    optionalUserId,
    overviewSearchKey,
    t,
    ticketsEndTime,
    ticketsEnquiryStatusId,
    ticketsEnquiryType,
    ticketsPagination.pageIndex,
    ticketsPagination.pageSize,
    ticketsPagination.sortBy,
    ticketsPagination.sortDirection,
    ticketsPriorityId,
    ticketsStartTime,
  ]);

  useEffect(() => {
    if (!numericProfileId) {
      setTicketsStatusCount(createEmptyTicketsStatusCount());
      return;
    }
    if (commercialActiveTab !== "tickets") return;

    setTicketsStatusCount(createEmptyTicketsStatusCount());
    let cancelled = false;
    const run = async () => {
      try {
        const response = await getTicketsStatusCount({
          _userId: optionalUserId,
          _profileId: numericProfileId,
        });
        if (!cancelled) {
          setTicketsStatusCount(mapTicketsStatusCount(response));
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setTicketsStatusCount(createEmptyTicketsStatusCount());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [commercialActiveTab, numericProfileId, optionalUserId]);

  useEffect(() => {
    if (!numericProfileId) {
      setRefundsRows([]);
      setRefundsPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }
    if (commercialActiveTab !== "refunds") return;

    let cancelled = false;
    const run = async () => {
      setRefundsLoading(true);
      try {
        const response = await getProfileRefundsByUserProfile({
          profileId: numericProfileId,
          search: overviewSearchKey.trim() || undefined,
          categoryId: getInspectionNumberParam(refundsCategory),
          statusId: getInspectionNumberParam(refundsStatusId),
          lastupdatedStartTime: refundsStartTime,
          lastupdatedEndTime: refundsEndTime,
          pageIndex: refundsPagination.pageIndex,
          pageSize: refundsPagination.pageSize,
          sortBy: refundsPagination.sortBy || "UpdateOn",
          sortDirection: refundsPagination.sortDirection,
        });
        if (cancelled) return;
        const mapped = mapProfileRefundListResponse(response, i18n.language);
        setRefundsRows(mapped.items);
        setRefundsPagination((prev) => ({ ...prev, total: mapped.total }));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setRefundsRows([]);
        setRefundsPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setRefundsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    commercialActiveTab,
    i18n.language,
    numericProfileId,
    overviewSearchKey,
    refundsCategory,
    refundsEndTime,
    refundsPagination.pageIndex,
    refundsPagination.pageSize,
    refundsPagination.sortBy,
    refundsPagination.sortDirection,
    refundsStartTime,
    refundsStatusId,
  ]);

  useEffect(() => {
    if (!numericProfileId) {
      setRefundsStatusCount(createEmptyRefundOverviewStats());
      return;
    }
    if (commercialActiveTab !== "refunds") return;

    setRefundsStatusCount(createEmptyRefundOverviewStats());
    let cancelled = false;
    const run = async () => {
      try {
        const response = await getProfileRefundsByUserProfile({
          profileId: numericProfileId,
          pageIndex: 1,
          pageSize: 1,
          sortBy: "UpdateOn",
          sortDirection: 1,
        });
        if (!cancelled) {
          setRefundsStatusCount(mapProfileRefundStats(response));
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setRefundsStatusCount(createEmptyRefundOverviewStats());
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [commercialActiveTab, numericProfileId]);

  useEffect(() => {
    if (!numericProfileId) {
      setAppealRows([]);
      return;
    }
    if (commercialActiveTab !== "appeal") return;

    let cancelled = false;
    const run = async () => {
      setAppealLoading(true);
      try {
        const response = await getInspectionProfileAppeals({
          profileId: numericProfileId,
          keyword: debouncedAppealSearchKey || undefined,
          startTime: appealStartTime,
          endTime: appealEndTime,
          statusId: getInspectionNumberParam(appealStatusId),
        });
        if (!cancelled) {
          setAppealRows(mapProfileAppealListResponse(response).items);
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setAppealRows([]);
      } finally {
        if (!cancelled) setAppealLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    appealEndTime,
    appealStartTime,
    appealStatusId,
    commercialActiveTab,
    numericProfileId,
    debouncedAppealSearchKey,
  ]);

  useEffect(() => {
    if (!numericProfileId) {
      setAppealStatusCounts(createEmptyAppealOverviewStats());
      return;
    }

    setAppealStatusCounts(createEmptyAppealOverviewStats());
    let cancelled = false;
    const run = async () => {
      try {
        const response = await getInspectionProfileAppeals({
          profileId: numericProfileId,
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

    void run();
    return () => {
      cancelled = true;
    };
  }, [numericProfileId]);

  useEffect(() => {
    if (!numericProfileId) {
      setInspectionRows([]);
      setInspectionPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }
    if (commercialActiveTab !== "inspection") return;

    let cancelled = false;
    const run = async () => {
      setInspectionLoading(true);
      try {
        const response = await getInspectionTasksByUserProfile({
          profileId: numericProfileId,
          search: overviewSearchKey.trim() || undefined,
          statusId: getInspectionNumberParam(inspectionFilters.statusId),
          inspectionReasonId: getInspectionNumberParam(
            inspectionFilters.reasonId,
          ),
          priorityId: getInspectionNumberParam(inspectionFilters.priorityId),
          dueDateFrom: inspectionFilters.dueDateFrom,
          dueDateTo: inspectionFilters.dueDateTo,
          assignedTimeFrom: inspectionFilters.assignedTimeFrom,
          assignedTimeTo: inspectionFilters.assignedTimeTo,
          assignedInspectorId: inspectionFilters.assignedInspectorId,
          pageIndex: inspectionPagination.pageIndex,
          pageSize: inspectionPagination.pageSize,
          sortBy: "AssignedOn",
          sortDirection: inspectionPagination.sortDirection,
        });

        if (cancelled) return;
        const mapped = mapInspectionProfileTaskListResponse(response, t);
        setInspectionRows(mapped.items);
        setInspectionPagination((prev) => ({
          ...prev,
          total: mapped.total,
        }));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setInspectionRows([]);
        setInspectionPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        if (!cancelled) setInspectionLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    commercialActiveTab,
    i18n.language,
    inspectionFilters.assignedInspectorId,
    inspectionFilters.assignedTimeFrom,
    inspectionFilters.assignedTimeTo,
    inspectionFilters.dueDateFrom,
    inspectionFilters.dueDateTo,
    inspectionFilters.priorityId,
    inspectionFilters.reasonId,
    inspectionFilters.statusId,
    inspectionPagination.pageIndex,
    inspectionPagination.pageSize,
    inspectionPagination.sortDirection,
    numericProfileId,
    overviewSearchKey,
    t,
  ]);

  useEffect(() => {
    if (!numericProfileId) {
      setInspectionStats(createEmptyInspectionOverviewStats());
      return;
    }
    if (commercialActiveTab !== "inspection") return;

    setInspectionStats(createEmptyInspectionOverviewStats());
    let cancelled = false;
    const run = async () => {
      try {
        const response = await getInspectionProfileTaskStats({
          profileId: numericProfileId,
        });
        if (!cancelled) {
          setInspectionStats(mapInspectionProfileStats(response));
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setInspectionStats(createEmptyInspectionOverviewStats());
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [commercialActiveTab, numericProfileId]);

  const applicationsTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: applicationsPagination.total,
      current: applicationsPagination.pageIndex,
      pageSize: applicationsPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => (
        <PaginationTotal
          label={t("common.total")}
          total={total}
          current={applicationsPagination.pageIndex}
          pageSize={applicationsPagination.pageSize}
        />
      ),
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
      showTotal: (total) => (
        <PaginationTotal
          label={t("common.total")}
          total={total}
          current={paymentsPagination.pageIndex}
          pageSize={paymentsPagination.pageSize}
        />
      ),
      onChange: (page, size) => {
        setPaymentsPagination((prev) => ({
          ...prev,
          pageIndex: page,
          pageSize: size,
        }));
      },
    };
  }, [
    paymentsPagination.pageIndex,
    paymentsPagination.pageSize,
    paymentsPagination.total,
    t,
  ]);

  const licensesTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: licensesPagination.total,
      current: licensesPagination.pageIndex,
      pageSize: licensesPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => (
        <PaginationTotal
          label={t("common.total")}
          total={total}
          current={licensesPagination.pageIndex}
          pageSize={licensesPagination.pageSize}
        />
      ),
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

  const ticketsTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: ticketsPagination.total,
      current: ticketsPagination.pageIndex,
      pageSize: ticketsPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => (
        <PaginationTotal
          label={t("common.total")}
          total={total}
          current={ticketsPagination.pageIndex}
          pageSize={ticketsPagination.pageSize}
        />
      ),
      onChange: (page, size) => {
        setTicketsPagination((prev) => ({
          ...prev,
          pageIndex: page,
          pageSize: size,
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
      showTotal: (total) => (
        <PaginationTotal
          label={t("common.total")}
          total={total}
          current={refundsPagination.pageIndex}
          pageSize={refundsPagination.pageSize}
        />
      ),
    };
  }, [
    refundsPagination.pageIndex,
    refundsPagination.pageSize,
    refundsPagination.total,
    t,
  ]);

  const inspectionTablePagination = useMemo<TablePaginationConfig>(() => {
    return {
      total: inspectionPagination.total,
      current: inspectionPagination.pageIndex,
      pageSize: inspectionPagination.pageSize,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50"],
      showTotal: (total) => (
        <PaginationTotal
          label={t("common.total")}
          total={total}
          current={inspectionPagination.pageIndex}
          pageSize={inspectionPagination.pageSize}
        />
      ),
      onChange: (page, size) => {
        setInspectionPagination((prev) => ({
          ...prev,
          pageIndex: page,
          pageSize: size,
        }));
      },
    };
  }, [
    inspectionPagination.pageIndex,
    inspectionPagination.pageSize,
    inspectionPagination.total,
    t,
  ]);

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

  const handleRefundsTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter: SorterResult<RefundItem> | SorterResult<RefundItem>[],
    ) => {
      const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = currentSorter?.order as "ascend" | "descend" | undefined;

      setRefundsPagination((prev) => ({
        ...prev,
        pageIndex: Number(pagination.current || prev.pageIndex),
        pageSize: Number(pagination.pageSize || prev.pageSize),
        sortBy: "UpdateOn",
        sortDirection: order === "ascend" ? 0 : 1,
      }));
    },
    [],
  );

  const handleRefundsReset = useCallback(() => {
    setOverviewSearchKey("");
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
  }, []);

  const handleInspectionTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      sorter:
        | SorterResult<InspectionOverviewItem>
        | SorterResult<InspectionOverviewItem>[],
    ) => {
      const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const order = currentSorter?.order as "ascend" | "descend" | undefined;

      setInspectionPagination((prev) => ({
        ...prev,
        pageIndex: Number(pagination.current || prev.pageIndex),
        pageSize: Number(pagination.pageSize || prev.pageSize),
        sortBy: "AssignedOn",
        sortDirection: order === "ascend" ? "asc" : "desc",
      }));
    },
    [],
  );

  const handleInspectionFiltersChange = useCallback(
    (filters: InspectionNoFullScanFilters) => {
      setInspectionFilters(filters);
      setInspectionPagination((prev) => ({ ...prev, pageIndex: 1 }));
    },
    [],
  );

  const handleInspectionReset = useCallback(() => {
    setOverviewSearchKey("");
    setInspectionFilters({});
    setInspectionPagination((prev) => ({
      ...prev,
      pageIndex: 1,
      sortBy: "AssignedOn",
      sortDirection: "desc",
    }));
  }, []);

  const handleViolationsFinesReset = useCallback(() => {
    setOverviewSearchKey("");
    setViolationsFinesTypeId(undefined);
    setViolationsFinesStatusId(undefined);
    setViolationsFinesStartTime(undefined);
    setViolationsFinesEndTime(undefined);
    setViolationsFinesPaidTimeFrom(undefined);
    setViolationsFinesPaidTimeTo(undefined);
  }, []);

  const violationsFinesOverviewProps = {
    violationsFines: violationsFinesRows,
    violationsFinesLoading,
    violationsFinesStatusCounts,
    violationsFinesStatusOptions,
    violationsFinesTypeId,
    violationsFinesStatusId,
    violationsFinesStartTime,
    violationsFinesEndTime,
    violationsFinesPaidTimeFrom,
    violationsFinesPaidTimeTo,
    onViolationsFinesTypeIdChange: setViolationsFinesTypeId,
    onViolationsFinesStatusIdChange: setViolationsFinesStatusId,
    onViolationsFinesDateRangeChange: ({
      startTime,
      endTime,
    }: {
      startTime?: string;
      endTime?: string;
    }) => {
      setViolationsFinesStartTime(startTime);
      setViolationsFinesEndTime(endTime);
    },
    onViolationsFinesPaymentDateRangeChange: ({
      paidTimeFrom,
      paidTimeTo,
    }: {
      paidTimeFrom?: string;
      paidTimeTo?: string;
    }) => {
      setViolationsFinesPaidTimeFrom(paidTimeFrom);
      setViolationsFinesPaidTimeTo(paidTimeTo);
    },
    onViolationsFinesReset: handleViolationsFinesReset,
  };

  const inspectionOverviewProps = {
    inspectionTasksNoFullScan: inspectionRows,
    inspectionStats,
    inspectionNoFullScanLoading: inspectionLoading,
    inspectionNoFullScanPagination: inspectionTablePagination,
    inspectionNoFullScanSortDirection: inspectionPagination.sortDirection,
    onInspectionNoFullScanTableChange: handleInspectionTableChange,
    inspectionNoFullScanFilters: inspectionFilters,
    inspectionNoFullScanReasonOptions: inspectionReasonOptions,
    inspectionNoFullScanStatusOptions: inspectionStatusOptions,
    inspectionNoFullScanPriorityOptions: inspectionPriorityOptions,
    inspectionNoFullScanInspectorOptions: inspectionInspectorOptions,
    onInspectionNoFullScanFiltersChange: handleInspectionFiltersChange,
    onInspectionNoFullScanReset: handleInspectionReset,
  };

  const refundsOverviewProps = {
    refunds: refundsRows,
    refundsLoading,
    refundsPagination: refundsTablePagination,
    refundsStatusCount,
    refundsCategory,
    refundsStatusId,
    refundsStartTime,
    refundsEndTime,
    refundsSortDirection: refundsPagination.sortDirection,
    onRefundsCategoryChange: (value?: string) => {
      setRefundsCategory(value);
      setRefundsPagination((prev) => ({ ...prev, pageIndex: 1 }));
    },
    onRefundsStatusIdChange: (value?: string) => {
      setRefundsStatusId(value);
      setRefundsPagination((prev) => ({ ...prev, pageIndex: 1 }));
    },
    onRefundsDateRangeChange: ({
      startTime,
      endTime,
    }: {
      startTime?: string;
      endTime?: string;
    }) => {
      setRefundsStartTime(startTime);
      setRefundsEndTime(endTime);
      setRefundsPagination((prev) => ({ ...prev, pageIndex: 1 }));
    },
    onRefundsTableChange: handleRefundsTableChange,
    onRefundsReset: handleRefundsReset,
  };

  const appealOverviewProps = {
    appeals: appealRows,
    appealsLoading: appealLoading,
    appealStatusCounts,
    appealStatusId,
    appealStartTime,
    appealEndTime,
    onAppealStatusIdChange: (value?: string) => {
      setAppealStatusId(value);
    },
    onAppealDateRangeChange: ({
      startTime,
      endTime,
    }: {
      startTime?: string;
      endTime?: string;
    }) => {
      setAppealStartTime(startTime);
      setAppealEndTime(endTime);
    },
  };

  useEffect(() => {
    load();
  }, [load]);

  const loadAccountOverview = useCallback(async () => {
    if (!numericProfileId) return;

    setAccountOverview(null);
    setAccountLoading(true);
    try {
      const res = await getAccountOrIndividualOrEstablishment({
        profileId: numericProfileId,
      });
      const payload = (res as any)?.data?.data ?? (res as any)?.data ?? null;
      setAccountOverview(payload);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load account overview", error);
      setAccountOverview(null);
    } finally {
      setAccountLoading(false);
    }
  }, [numericProfileId]);

  useEffect(() => {
    loadAccountOverview();
  }, [loadAccountOverview]);

  const personalInfo = useMemo(
    () => buildPersonalInfoItems(personalPayload?.personal, t),
    [personalPayload, t],
  );
  const addressInfo = useMemo(
    () => buildAddressInfoItems(personalPayload?.addressInfo, t),
    [personalPayload, t],
  );
  const personalDocs = useMemo(
    () => buildPersonalDocuments(personalPayload?.personDocmentInfo, t),
    [personalPayload, t],
  );
  const commercialEstablishmentData = useMemo(() => {
    if (!establishmentPayload) {
      return undefined;
    }

    const establishment = establishmentPayload.establishment;
    if (!establishment) {
      return establishmentPayload;
    }

    const fixedPhoneDisplay = getContactNumberDisplay(
      createContactNumberSnapshot({
        countryCode: establishment.phoneCountryCode,
        localNumber: establishment.phoneLocalNumber,
        fullNumber: establishment.phoneNumber,
      }),
    );

    return {
      ...establishmentPayload,
      establishment: {
        ...establishment,
        phoneNumber: fixedPhoneDisplay,
      },
    };
  }, [establishmentPayload]);

  const profileOverviewProfile = useMemo(() => {
    if (!profileId) return null;

    const nameEn =
      (type === "individual"
        ? personalPayload?.personal?.nameEn
        : establishmentPayload?.establishment?.establishmentNameEn) || "";
    const nameAr =
      (type === "individual"
        ? personalPayload?.personal?.nameAr
        : establishmentPayload?.establishment?.establishmentNameAr) || "";

    const emirate =
      (type === "individual"
        ? personalPayload?.addressInfo?.emirateObj?.nameEn ||
          personalPayload?.addressInfo?.emirateObj?.nameAr
        : establishmentPayload?.addressInfo?.emirateObj?.nameEn ||
          establishmentPayload?.addressInfo?.emirateObj?.nameAr) || "";

    const createdTime =
      (type === "individual"
        ? personalPayload?.personal?.createdOn
        : establishmentPayload?.establishment?.createdOn) || "";

    return {
      id: String(profileId),
      profileId: String(profileId),
      profileName: safeText(nameEn),
      profileNameAr: safeText(nameAr),
      profileType:
        type === "individual"
          ? t("Customer.profiles.chart.individual")
          : t("Customer.profiles.chart.commercial"),
      emirate: safeText(emirate),
      status: safeText(profileStatus),
      tier: safeText(profileTier),
      stats: {
        apps: 0,
        tickets: 0,
        refund: 0,
        appeal: 0,
        violations: 0,
        fines: 0,
      },
      createdTime: safeText(createdTime),
    };
  }, [
    establishmentPayload,
    personalPayload,
    profileId,
    profileStatus,
    profileTier,
    t,
    type,
  ]);

  // The establishment endpoint returns the real Self-Monitor programme at the
  // top level, so the header badge can show the full status ("Self-Monitor(Trial)"
  // etc.) exactly like the list. Null for individuals or no programme record.
  const selfMonitorProgram = useMemo<SelfMonitorProgramInfo | null>(
    () =>
      (
        establishmentPayload as {
          selfMonitorProgram?: SelfMonitorProgramInfo | null;
        } | null
      )?.selfMonitorProgram ?? null,
    [establishmentPayload],
  );
  const profileStatusId = useMemo(() => {
    const rawStatusId =
      type === "individual"
        ? personalPayload?.statusId
        : establishmentPayload?.statusId;
    const statusId = Number(rawStatusId);

    return Number.isFinite(statusId) ? statusId : null;
  }, [establishmentPayload, personalPayload, type]);
  const profileIsActive = useMemo(() => {
    const currentProfile = Array.isArray(accountOverview?.profileList)
      ? accountOverview.profileList.find(
          (profile) => Number(profile?.profileId) === numericProfileId,
        )
      : undefined;
    const isActive = currentProfile?.isActive ?? accountOverview?.isActive;

    return typeof isActive === "boolean" ? isActive : null;
  }, [accountOverview, numericProfileId]);
  const canSuspendProfile = profileIsActive === true && profileStatusId === 3;
  const isSuspended = useMemo(
    () => normalizeLower(profileStatus).includes("suspend"),
    [profileStatus],
  );
  // Under Review profiles are not suspendable yet, so hide the footer action.
  const isUnderReview = useMemo(
    () => normalizeLower(profileStatus).includes("under review"),
    [profileStatus],
  );

  const quickNotes = useMemo(
    () => [
      t("Customer.profiles.modals.quickNote1"),
      t("Customer.profiles.modals.quickNote2"),
      t("Customer.profiles.modals.quickNote3"),
      t("Customer.profiles.modals.quickNote4"),
    ],
    [t],
  );

  const handleConfirmAction = useCallback(async () => {
    if (!numericProfileId) return;
    if (!actionModal) return;
    const trimmedNotes = notes.trim();

    if (actionModal === "suspend" && !trimmedNotes) {
      setNotesValidationAttempted(true);
      return;
    }

    setNotesValidationAttempted(false);
    setActionLoading(true);
    try {
      if (actionModal === "suspend") {
        const res: any = await updateProfileActiveAsync({
          profileId: numericProfileId,
          isActive: false,
          reson: trimmedNotes,
        });

        if (res?.isSuccess === false) return;

        await loadAccountOverview();

        CustomMessage.success(
          t("Customer.profileDetail.messages.suspendSuccess"),
        );
        history.replace({
          pathname: location.pathname,
          search: updateSearchParam(location.search, {
            status: "Suspended",
          }),
        });
        setActionModal(null);
        setNotes("");
        setNotesValidationAttempted(false);
        return;
      }

      if (actionModal === "activate") {
        const res: any = await updateProfileActiveAsync({
          profileId: numericProfileId,
          isActive: true,
        });

        if (res?.isSuccess === false) return;

        await loadAccountOverview();

        CustomMessage.success(
          t("Customer.profileDetail.messages.activateSuccess"),
        );
        history.replace({
          pathname: location.pathname,
          search: updateSearchParam(location.search, {
            status: "Approved",
          }),
        });
        setActionModal(null);
        return;
      }
      // set-vip / remove-vip branch removed — VIP tier retired.
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  }, [
    actionModal,
    history,
    location.pathname,
    location.search,
    loadAccountOverview,
    notes,
    numericProfileId,
    t,
  ]);

  const renderAccountInformation = useMemo(() => {
    const fullNameEn = safeText(accountOverview?.nameEn);
    const fullNameAr = safeText(accountOverview?.nameAr);
    const showAvatar = Boolean(accountOverview?.photoUrl);
    const mobileDisplay = getContactNumberDisplay(
      createContactNumberSnapshot({
        countryCode: accountOverview?.mobileCountryCode,
        localNumber: accountOverview?.mobileLocalNumber,
        fullNumber: accountOverview?.mobileNumber,
      }),
    );

    const rows: Array<{
      key: string;
      label: string;
      value: React.ReactNode;
      hasIcon?: boolean;
    }> = [
      {
        key: "email",
        label: t("Customer.customerDetails.accountInfo.email"),
        value: safeText(accountOverview?.email),
      },
      {
        key: "mobile",
        label: t("Customer.customerDetails.accountInfo.mobileNumber"),
        value: safeText(mobileDisplay),
      },
    ];

    if (!showAvatar) {
      rows.unshift({
        key: "fullName",
        label: t("Customer.customerDetails.accountInfo.fullName"),
        value: safeText(accountOverview?.nameEn || accountOverview?.nameAr),
      });
    }

    if (showAvatar) {
      rows.splice(2, 0, {
        key: "emiratesId",
        label: t("Customer.customerDetails.accountInfo.emiratesId"),
        value: safeText(accountOverview?.emiratesId),
      });
      rows.splice(3, 0, {
        key: "nationality",
        label: t("Customer.customerDetails.accountInfo.nationality"),
        value: safeText(
          accountOverview?.nationalityEn || accountOverview?.nationalityAr,
        ),
      });
    }

    rows.push(
      {
        key: "walletBalance",
        label: t("Customer.customerDetails.accountInfo.walletBalance"),
        hasIcon: true,
        value: formatMoney(`${safeText(accountOverview?.walletBalance)}`),
      },
      {
        key: "totalSpending",
        label: t("Customer.customerDetails.accountInfo.totalSpending"),
        hasIcon: true,
        value: formatMoney(`${safeText(accountOverview?.totalSpending)}`),
      },
      {
        key: "totalRefunds",
        label: t("Customer.customerDetails.accountInfo.totalRefunds"),
        hasIcon: true,
        value: formatMoney(`${safeText(accountOverview?.totalRefunds)}`),
      },
      {
        key: "totalRecharge",
        label: t("Customer.customerDetails.accountInfo.totalRecharge"),
        hasIcon: true,
        value: formatMoney(`${safeText(accountOverview?.totalRecharge)}`),
      },
    );

    return (
      <Spin spinning={accountLoading}>
        <div className="cpd-account">
          {showAvatar ? (
            <div className="cpd-account-avatar">
              <AuthenticatedDocumentAvatar
                size={40}
                src={accountOverview?.photoUrl}
              />
              <div className="cpd-account-avatar-text">
                <div className="cpd-account-name-en">{fullNameEn}</div>
                <div className="cpd-account-name-ar">{fullNameAr}</div>
              </div>
            </div>
          ) : null}

          {/* <div className="cpd-account-divider" /> */}

          <div className="cpd-account-rows">
            {rows.map((row) => (
              <div key={row.key} className="cpd-account-row">
                <div className="cpd-account-label">{row.label}</div>
                <div className="cpd-account-value">
                  {" "}
                  {row.hasIcon && <AED />}
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Spin>
    );
  }, [accountLoading, accountOverview, t]);

  return (
    <div className="cpd-page">
      <div className="cpd-layout">
        <div className="cpd-left">
          <div className="cpd-main">
            <Spin spinning={loading}>
              {type === "individual" ? (
                profileOverviewProfile ? (
                  <ProfileOverview
                    {...inspectionOverviewProps}
                    {...violationsFinesOverviewProps}
                    {...refundsOverviewProps}
                    {...appealOverviewProps}
                    titleContent={
                      <div className="cpd-header-tags">
                        {selfMonitorProgram?.status ? (
                          <SelfMonitorBadge
                            program={selfMonitorProgram}
                            className="cpd-tier-badge"
                          />
                        ) : null}
                        <CustomStatusTag
                          status={profileStatus}
                          type="profileCard"
                        />
                      </div>
                    }
                    profile={profileOverviewProfile}
                    activeTab={commercialActiveTab}
                    onTabChange={(k) => {
                      setCommercialActiveTab(k);
                      if (k !== "basic") {
                        if (k === "applications") {
                          setApplicationsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                        if (k === "payments") {
                          setPaymentsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
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
                          setInspectionPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                      }
                    }}
                    personalInfo={personalInfo}
                    addressInfo={addressInfo}
                    documents={personalDocs}
                    overviewSearchKey={overviewSearchKey}
                    onOverviewSearchKeyChange={(v) => {
                      setOverviewSearchKey(v);
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
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setInspectionPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    overviewTypeFilter={overviewTypeFilter}
                    overviewTypeFilterOptions={overviewTypeFilterOptions}
                    applicationsStatusOptions={applicationsStatusOptions}
                    onOverviewTypeFilterChange={(v) => {
                      setOverviewTypeFilter(v);
                      setApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    applicationsStatusId={applicationsStatusId}
                    onApplicationsStatusIdChange={(value) => {
                      setApplicationsStatusId(value);
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
                      setOverviewSearchKey("");
                      setOverviewTypeFilter(undefined);
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
                    applicationsRows={applicationsRows}
                    applicationsStats={applicationsStats}
                    applicationsLoading={applicationsLoading}
                    applicationsPagination={applicationsTablePagination}
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
                      setApplicationsPagination((prev) => ({
                        ...prev,
                        sortBy: "lastUpdatedTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    payments={paymentsRows}
                    paymentsStats={paymentsStats}
                    paymentsLoading={paymentsLoading}
                    paymentsPagination={paymentsTablePagination}
                    onPaymentsTableChange={(p, sorter) => {
                      const nextCurrent = Number(p.current || 1);
                      const nextSize = Number(p.pageSize || 10);

                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;

                      setPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: nextCurrent,
                        pageSize: nextSize,
                        sortBy: order ? field : undefined,
                        sortDirection: order
                          ? order === "ascend"
                            ? 0
                            : 1
                          : undefined,
                      }));
                    }}
                    paymentsTransactionTypeOptions={
                      paymentsTransactionTypeOptions
                    }
                    paymentsStatusOptions={paymentsStatusOptions}
                    paymentsTransactionTypeId={paymentsTransactionTypeId}
                    paymentsStatusId={paymentsStatusId}
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
                    onPaymentsDateRangeChange={({ startDate, endDate }) => {
                      setPaymentsStartDate(startDate);
                      setPaymentsEndDate(endDate);
                      setPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    licenses={licensesRows}
                    licensesLoading={licensesLoading}
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
                    onLicensesTableChange={(p, sorter) => {
                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;
                      setLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: Number(p.current || prev.pageIndex),
                        pageSize: Number(p.pageSize || prev.pageSize),
                        sortBy: order
                          ? field || "issuanceTime"
                          : "issuanceTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    tickets={ticketsRows}
                    ticketsLoading={ticketsLoading}
                    ticketsPagination={ticketsTablePagination}
                    ticketsStatusCount={ticketsStatusCount}
                    ticketsEnquiryStatusId={ticketsEnquiryStatusId}
                    onTicketsEnquiryStatusIdChange={(value) => {
                      setTicketsEnquiryStatusId(value);
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
                  />
                ) : null
              ) : (
                <div className="customer-details-page">
                  <CommercialProfileOverview
                    {...inspectionOverviewProps}
                    {...violationsFinesOverviewProps}
                    {...refundsOverviewProps}
                    {...appealOverviewProps}
                    titleContent={
                      <div className="cpd-header-tags">
                        {selfMonitorProgram?.status ? (
                          <SelfMonitorBadge
                            program={selfMonitorProgram}
                            className="cpd-tier-badge"
                          />
                        ) : null}
                        <CustomStatusTag
                          status={profileStatus}
                          type="profileCard"
                        />
                      </div>
                    }
                    activeTab={commercialActiveTab}
                    onTabChange={(k) => {
                      setCommercialActiveTab(k);
                      if (k !== "basic") {
                        if (k === "applications") {
                          setApplicationsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                        if (k === "payments") {
                          setPaymentsPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
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
                          setInspectionPagination((prev) => ({
                            ...prev,
                            pageIndex: 1,
                          }));
                        }
                      }
                    }}
                    establishmentData={commercialEstablishmentData}
                    overviewSearchKey={overviewSearchKey}
                    onOverviewSearchKeyChange={(v) => {
                      setOverviewSearchKey(v);
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
                      setTicketsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                      setInspectionPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    overviewTypeFilter={overviewTypeFilter}
                    overviewTypeFilterOptions={overviewTypeFilterOptions}
                    applicationsStatusOptions={applicationsStatusOptions}
                    onOverviewTypeFilterChange={(v) => {
                      setOverviewTypeFilter(v);
                      setApplicationsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    applicationsStatusId={applicationsStatusId}
                    onApplicationsStatusIdChange={(value) => {
                      setApplicationsStatusId(value);
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
                      setOverviewSearchKey("");
                      setOverviewTypeFilter(undefined);
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
                    applicationsRows={applicationsRows}
                    applicationsStats={applicationsStats}
                    applicationsLoading={applicationsLoading}
                    applicationsPagination={applicationsTablePagination}
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
                      setApplicationsPagination((prev) => ({
                        ...prev,
                        sortBy: "lastUpdatedTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    payments={paymentsRows}
                    paymentsStats={paymentsStats}
                    paymentsLoading={paymentsLoading}
                    paymentsPagination={paymentsTablePagination}
                    onPaymentsTableChange={(p, sorter) => {
                      const nextCurrent = Number(p.current || 1);
                      const nextSize = Number(p.pageSize || 10);

                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;

                      setPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: nextCurrent,
                        pageSize: nextSize,
                        sortBy: order ? field : undefined,
                        sortDirection: order
                          ? order === "ascend"
                            ? 0
                            : 1
                          : undefined,
                      }));
                    }}
                    paymentsTransactionTypeOptions={
                      paymentsTransactionTypeOptions
                    }
                    paymentsStatusOptions={paymentsStatusOptions}
                    paymentsTransactionTypeId={paymentsTransactionTypeId}
                    paymentsStatusId={paymentsStatusId}
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
                    onPaymentsDateRangeChange={({ startDate, endDate }) => {
                      setPaymentsStartDate(startDate);
                      setPaymentsEndDate(endDate);
                      setPaymentsPagination((prev) => ({
                        ...prev,
                        pageIndex: 1,
                      }));
                    }}
                    licenses={licensesRows}
                    licensesLoading={licensesLoading}
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
                    onLicensesTableChange={(p, sorter) => {
                      const s = Array.isArray(sorter) ? sorter[0] : sorter;
                      const order = (s as any)?.order as
                        | "ascend"
                        | "descend"
                        | undefined;
                      const field = (s as any)?.field as string | undefined;
                      setLicensesPagination((prev) => ({
                        ...prev,
                        pageIndex: Number(p.current || prev.pageIndex),
                        pageSize: Number(p.pageSize || prev.pageSize),
                        sortBy: order
                          ? field || "issuanceTime"
                          : "issuanceTime",
                        sortDirection: order ? (order === "ascend" ? 0 : 1) : 1,
                      }));
                    }}
                    tickets={ticketsRows}
                    ticketsLoading={ticketsLoading}
                    ticketsPagination={ticketsTablePagination}
                    ticketsStatusCount={ticketsStatusCount}
                    ticketsEnquiryStatusId={ticketsEnquiryStatusId}
                    onTicketsEnquiryStatusIdChange={(value) => {
                      setTicketsEnquiryStatusId(value);
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
                  />
                </div>
              )}
            </Spin>
          </div>
        </div>

        <div className="cpd-right">
          <DetailSection
            title={t("Customer.customerDetails.accountInformation")}
            className="cpd-account-card"
          >
            {renderAccountInformation}
          </DetailSection>
        </div>
      </div>

      {!isUnderReview && canManageProfile && <CustomFooter
        needBack
        onBack={() => history.goBack()}
        rightContent={
          <div className="cpd-footer-right">
          <CustomButton
          text={
          isSuspended
            ? t("Customer.profileDetail.actions.activateProfile")
            : t("Customer.profileDetail.actions.suspendProfile")
          }
          variant={isSuspended ? "primary" : "danger-outline"}
          permissionCode="CustomerModule.Customers.ProfileDetail.Confirm"
          permissionRoutePath="/happiness/customerManagement/customerProfileDetail"
          onClick={() => {
          if (isSuspended) {
            setActionModal("activate");
          } else {
            setActionModal("suspend");
          }
          }}
          />
          {/* Set as VIP / Remove VIP removed — VIP tier retired. */}
          </div>
        }
      />}

      <Modal
        centered
        className="profiles-action-modal"
        visible={actionModal === "suspend"}
        onCancel={() => {
          setActionModal(null);
          setNotes("");
          setNotesValidationAttempted(false);
        }}
        footer={null}
        title={t("Customer.profileDetail.modals.suspendProfile")}
        destroyOnClose
      >
        <AlertBanner
          content={t("Customer.profileDetail.modals.suspendProfileAlert")}
        />

        <div className="profiles-modal-body">
          <div className="profiles-modal-section">
            <div className="profiles-modal-label">
              {t("Customer.profileDetail.modals.notes")}
              <span className="profiles-modal-required" aria-hidden="true">
                *
              </span>
            </div>
            <Input.TextArea
              className={
                notesRequiredError
                  ? "profiles-modal-textarea--error"
                  : undefined
              }
              placeholder={t("Customer.profileDetail.modals.enterNotes")}
              value={notes}
              required
              aria-required="true"
              aria-invalid={notesRequiredError}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              autoSize={{ minRows: 4, maxRows: 6 }}
            />
            {notesRequiredError && (
              <div className="profiles-modal-error" role="alert">
                {t("common.required")}
              </div>
            )}
            <div className="profiles-modal-counter">{notes.length} / 1000</div>
          </div>

          <div className="profiles-modal-section">
            <div className="profiles-modal-label">
              {t("Customer.profileDetail.modals.quickNotes")}
            </div>
            <div className="profiles-quick-notes">
              {quickNotes.map((text, idx) => (
                <button
                  key={`profile-detail-quick-note-${idx}`}
                  type="button"
                  className="profiles-quick-note"
                  onClick={() => {
                    setNotes((prev) => {
                      const next = prev ? `${prev}\n${text}` : text;
                      return next.slice(0, 1000);
                    });
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
                setActionModal(null);
                setNotes("");
                setNotesValidationAttempted(false);
              }}
              disabled={actionLoading}
            />
            <CustomButton
              variant="danger"
              text={t("common.confirm")}
              onClick={handleConfirmAction}
              loading={actionLoading}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        loading={actionLoading}
        onCancel={() => setActionModal(null)}
        onConfirm={handleConfirmAction}
        visible={actionModal === "activate"}
        type="warning"
        title={t("Customer.profileDetail.modals.activateProfile")}
        content={t("Customer.profileDetail.modals.activateProfileConfirm")}
      />
      {/* Set as VIP / Remove VIP confirm modals removed — VIP tier retired. */}
    </div>
  );
};
export default ProfileDetail;
