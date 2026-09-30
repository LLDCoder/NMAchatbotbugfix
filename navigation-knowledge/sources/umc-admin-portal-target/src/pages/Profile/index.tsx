import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { Card, DatePicker, Input, Select, Tooltip } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { SorterResult } from "antd/lib/table/interface";
import type { RangeValue } from "rc-picker/lib/interface";
import type { Moment } from "moment";
import dayjs from "dayjs";
import { GST, toApi } from "@/utils/gstTime";
import moment from "moment";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sousuo from "@/assets/icons/Sousuo";

import { FilterTable, useFilter } from "@/components/common/FilterTable";
import { CustomButton, PaginationTotal, RejectModal } from "@/components/common";
import ConfirmModal from "@/components/common/ConfirmModal";
import CustomMessage from "@/components/common/CustomMessage";
import { usePagination } from "@/hooks/usePagination";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import MenuIcon from "@/assets/images/menu.png";
import IndividualStatIcon from "@/assets/images/Individual.png";
import CommercialStatIcon from "@/assets/images/Commercial.png";
import FreeZoneStatIcon from "@/assets/images/FreeZone.png";
import TalentStatIcon from "@/assets/images/TalentAgency.png";
import GovernmentStatIcon from "@/assets/images/Government.png";
import EmbassyStatIcon from "@/assets/images/Embassy.png";
import CulturalStatIcon from "@/assets/images/CulturalClubs.png";
import ApplyForIndividualIcon from "@/assets/images/tablelndividual.png";
import ApplyForBusinessIcon from "@/assets/images/tableCommercial.png";
import ApplyForGovernmentIcon from "@/assets/images/tableGovernment.png";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import {
  getUserProfiles,
  processUserProfile,
  getUserProfileStatuses,
  getUserProfileTypeCount,
  getUserProfileUserTypes,
  type ApiResponse,
  type UserManagementValueObject,
  type UserProfileManagementDtoPageResponse,
  type UserProfileTypeCountDto,
  type ApprovesResponseDto,
  type UserProfilesQueryParams,
} from "@/services/userManagement";
import { getUserProfileExport } from "@/services/license";
import { DtoAdapter, Sorter, type ISortRule, type TSorter } from "./type";
import { DefaultSortRule } from "./constants";

import "./index.less";

const { RangePicker } = DatePicker;

const APPROVE_STATUS_ID = 3;
const REJECT_STATUS_ID = 4;
const PROFILE_DETAILS_PATH = "/licensing/profile/profiledetails";
const DEFAULT_PAGE_SIZE = 10;
const ALL_STATUSES_FALLBACK_VALUE = "all";
const ALL_USER_TYPES_FALLBACK_VALUE = "all";
type ProfileActionColumnKey = "approve" | "reject";

const PROFILE_ACTION_COLUMN_BASE_SCROLL_X = 1420;
const PROFILE_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<ProfileActionColumnKey> =
  {
    approve: {
      default: 80,
      compact: 72,
    },
    reject: {
      default: 64,
      compact: 56,
    },
  };
const PROFILE_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 8,
  padding: 32,
  minWidth: 128,
  maxWidth: 200,
};
const PROFILE_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 32,
  minWidth: 112,
  maxWidth: 184,
};
const PROFILE_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 16,
};
type ProfileFilterValues = {
  search?: string;
  status?: string;
  userType?: string[];
  submissionTime?: RangeValue<Moment> | null;
};

type LoadProfilesOverrides = Partial<
  Pick<UserProfilesQueryParams, "PageIndex" | "PageSize" | "SortBy" | "SortDirection">
>;

interface StatCard {
  key: string;
  label: string;
  value: number | string;
  icon: string;
}

const serializeUserProfilesQueryParams = (params: UserProfilesQueryParams) => {
  const queryParts: string[] = [];

  Reflect.ownKeys(params).forEach((item) => {
    const key = item as keyof UserProfilesQueryParams;
    const value = params[key];

    if (Array.isArray(value)) {
      if (value.length) {
        queryParts.push(value.map((entry) => `${String(key)}=${entry}`).join("&"));
      }
      return;
    }

    if (value !== undefined && value !== null && value !== "") {
      queryParts.push(`${String(key)}=${value}`);
    }
  });

  return queryParts.join("&");
};

const getStatusClassName = (statusName?: string | null) => {
  const normalized = String(statusName ?? "").trim().toLowerCase();

  if (normalized.includes("approv")) {
    return "status-tag status-approved";
  }

  if (normalized.includes("reject")) {
    return "status-tag status-rejected";
  }

  return "status-tag status-pending";
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const dateValue = moment(value);

  if (!dateValue.isValid()) {
    return "-";
  }

  return dateValue.format("DD/MM/YYYY HH:mm:ss");
};

const getSlaDisplayText = (value?: string | null) => {
  const normalizedValue = String(value ?? "").trim();

  return normalizedValue || "-";
};

const GOVERNMENT_USER_TYPE_IDS: number[] = [7, 10, 12, 13];

const renderApplyForTypeIcon = (record: ApprovesResponseDto) => {
  if (record.userTypeId === 1) {
    return <img src={ApplyForIndividualIcon} alt="" />;
  }

  const label = `${record.userTypeObj?.nameEn ?? ""} ${
    record.userTypeObj?.nameAr ?? ""
  }`.toLowerCase();
  const isGovernment =
    GOVERNMENT_USER_TYPE_IDS.includes(record.userTypeId) ||
    /(government|embassy|consulate|cultural)/.test(label);

  if (isGovernment) {
    return <img src={ApplyForGovernmentIcon} alt="" />;
  }

  return <img src={ApplyForBusinessIcon} alt="" />;
};

const INDIVIDUAL_REJECT_KEYS = [
  "documentUnclear",
  "documentMismatch",
  "faceNotClearlyVisible",
  "missingRequiredDocument",
  "invalidEmiratesId",
] as const;

const OTHER_REJECT_KEYS = [
  "documentUnclear",
  "documentExpired",
  "licenseNumberMismatch",
  "licenseExpired",
  "unableVerifyEconomy",
] as const;

const ProfilePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const [filterStore] = useFilter();
  const [pageInfo, setPageInfo] = usePagination();
  const [statusList, setStatusList] = useState<UserManagementValueObject[]>([]);
  const [userTypeList, setUserTypeList] = useState<UserManagementValueObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<ApprovesResponseDto[]>([]);
  const [typeCounts, setTypeCounts] = useState<UserProfileTypeCountDto | null>(null);
  const [approveVisible, setApproveVisible] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ApprovesResponseDto | null>(null);
  const [sortRule, setSortRule] = useState<ISortRule>(DefaultSortRule);
  const isMountedRef = useRef(true);
  const isActiveRef = useRef(false);
  const latestRequestIdRef = useRef(0);
  const latestCountRequestIdRef = useRef(0);
  const latestActionRequestIdRef = useRef(0);
  const pageInfoRef = useRef(pageInfo);
  const sortRuleRef = useRef(sortRule);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    pageInfoRef.current = pageInfo;
  }, [pageInfo]);

  useEffect(() => {
    sortRuleRef.current = sortRule;
  }, [sortRule]);

  const individualQuickNotes = useMemo(
    () => INDIVIDUAL_REJECT_KEYS.map((key) => t(`Profile.rejectReasons.${key}`)),
    [t],
  );
  const otherQuickNotes = useMemo(
    () => OTHER_REJECT_KEYS.map((key) => t(`Profile.rejectReasons.${key}`)),
    [t],
  );

  const getFilterValues = useCallback(() => {
    const values = filterStore.getFieldsValue() as ProfileFilterValues;
    const search =
      typeof values.search === "string" && values.search.trim()
        ? values.search.trim()
        : undefined;
    const status =
      typeof values.status === "string" &&
      values.status.trim() &&
      values.status !== ALL_STATUSES_FALLBACK_VALUE
        ? values.status
        : undefined;
    const userType = Array.isArray(values.userType)
      ? values.userType.filter(
          (item) =>
            typeof item === "string" &&
            item &&
            item !== ALL_USER_TYPES_FALLBACK_VALUE,
        )
      : undefined;
    const submissionTime =
      Array.isArray(values.submissionTime) && values.submissionTime.length === 2
        ? (values.submissionTime as RangeValue<Moment>)
        : null;

    return {
      search,
      status,
      userType: userType?.length ? userType : undefined,
      submissionTime,
    };
  }, [filterStore]);

  const buildListQueryParams = useCallback(
    (overrides: LoadProfilesOverrides = {}) => {
      const { search, status, userType, submissionTime } = getFilterValues();
      const rangeStartValue = submissionTime?.[0]?.valueOf() ?? null;
      const rangeEndValue = submissionTime?.[1]?.valueOf() ?? null;

      return {
        ApplicationNo: search,
        StatusId: status ? Number(status) || undefined : undefined,
        UserTypeId: userType,
        StartDate: rangeStartValue
          ? toApi(dayjs(rangeStartValue).tz(GST).startOf("day"))
          : undefined,
        EndDate: rangeEndValue
          ? toApi(dayjs(rangeEndValue).tz(GST).endOf("day"))
          : undefined,
        PageIndex: overrides.PageIndex ?? pageInfoRef.current.pageIndex,
        PageSize: overrides.PageSize ?? pageInfoRef.current.pageSize,
        SortBy: overrides.SortBy ?? sortRuleRef.current.sortField,
        SortDirection: overrides.SortDirection ?? sortRuleRef.current.sortOrder,
      } satisfies UserProfilesQueryParams;
    },
    [getFilterValues],
  );

  const buildExportQueryParams = useCallback(() => {
    const { search, status, userType, submissionTime } = getFilterValues();
    const rangeStartValue = submissionTime?.[0]?.valueOf() ?? null;
    const rangeEndValue = submissionTime?.[1]?.valueOf() ?? null;

    return {
      ApplicationNo: search,
      StatusId: status ? Number(status) || undefined : undefined,
      UserTypeId: userType,
      StartDate: rangeStartValue
        ? toApi(dayjs(rangeStartValue).tz(GST).startOf("day"))
        : undefined,
      EndDate: rangeEndValue
        ? toApi(dayjs(rangeEndValue).tz(GST).endOf("day"))
        : undefined,
      PageIndex: 1,
      PageSize: 10000,
      SortBy: sortRule.sortField,
      SortDirection: sortRule.sortOrder,
    } satisfies UserProfilesQueryParams;
  }, [getFilterValues, sortRule.sortField, sortRule.sortOrder]);

  const loadProfiles = useCallback(
    async (overrides: LoadProfilesOverrides = {}) => {
      let params = buildListQueryParams(overrides);
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;

      setLoading(true);

      try {
        let response =
          (await getUserProfiles(params, {
            paramsSerializer: serializeUserProfilesQueryParams,
          })) as unknown as ApiResponse<UserProfileManagementDtoPageResponse>;

        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }

        let profileData = response.data;
        const responseTotal = profileData?.total ?? 0;
        const responsePageSize =
          profileData?.pageSize ?? params.PageSize ?? DEFAULT_PAGE_SIZE;
        const responsePageIndex =
          profileData?.pageIndex ?? params.PageIndex ?? 1;
        const lastPage = Math.max(
          1,
          Math.ceil(responseTotal / responsePageSize),
        );

        if (responseTotal > 0 && responsePageIndex > lastPage) {
          params = {
            ...params,
            PageIndex: lastPage,
          };
          response =
            (await getUserProfiles(params, {
              paramsSerializer: serializeUserProfilesQueryParams,
            })) as unknown as ApiResponse<UserProfileManagementDtoPageResponse>;

          if (
            !isMountedRef.current ||
            requestId !== latestRequestIdRef.current
          ) {
            return;
          }

          profileData = response.data;
        }

        setProfiles(
          Array.isArray(profileData?.items)
            ? (profileData.items as ApprovesResponseDto[])
            : [],
        );
        const resolvedTotal = profileData?.total ?? 0;
        setPageInfo({
          total: resolvedTotal,
          pageIndex:
            resolvedTotal === 0
              ? 1
              : profileData?.pageIndex ?? params.PageIndex ?? 1,
          pageSize: profileData?.pageSize ?? params.PageSize ?? DEFAULT_PAGE_SIZE,
        });
      } catch (error) {
        console.error("Failed to load user profiles", error);

        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }

        setProfiles([]);
        setPageInfo({
          total: 0,
          pageIndex: 1,
          pageSize: params.PageSize ?? pageInfoRef.current.pageSize,
        });
      } finally {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [buildListQueryParams, setPageInfo],
  );

  const loadTypeCounts = useCallback(async () => {
    const requestId = latestCountRequestIdRef.current + 1;
    latestCountRequestIdRef.current = requestId;
    try {
      const response = await getUserProfileTypeCount();
      if (
        !isActiveRef.current ||
        requestId !== latestCountRequestIdRef.current
      ) {
        return;
      }
      const countResponse =
        response as unknown as ApiResponse<UserProfileTypeCountDto>;
      setTypeCounts(countResponse.data ?? null);
    } catch {
      if (
        !isActiveRef.current ||
        requestId !== latestCountRequestIdRef.current
      ) {
        return;
      }
      setTypeCounts(null);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    const [statusResult, userTypeResult] = await Promise.allSettled([
      getUserProfileStatuses(),
      getUserProfileUserTypes(),
    ]);

    if (!isMountedRef.current || !isActiveRef.current) {
      return;
    }

    if (statusResult.status === "fulfilled") {
      const statusData = Array.isArray(statusResult.value.data)
        ? statusResult.value.data
        : [];
      setStatusList(statusData);
    } else {
      console.error("Failed to load profile statuses", statusResult.reason);
      setStatusList([]);
    }

    if (userTypeResult.status === "fulfilled") {
      const typeData = Array.isArray(userTypeResult.value.data)
        ? userTypeResult.value.data.filter((item) => item.nameEn !== "Establishment")
        : [];
      setUserTypeList(typeData);
    } else {
      console.error("Failed to load profile user types", userTypeResult.reason);
      setUserTypeList([]);
    }
  }, []);

  const keepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      isActiveRef.current = true;
      void fetchInitialData();
      void loadProfiles();
      void loadTypeCounts();
    },
    onDeactivated: () => {
      isActiveRef.current = false;
      latestRequestIdRef.current += 1;
      latestCountRequestIdRef.current += 1;
      latestActionRequestIdRef.current += 1;
      setLoading(false);
      setApproveVisible(false);
      setRejectVisible(false);
      setSelectedRecord(null);
      setActionLoading(false);
      setRejectLoading(false);
    },
  });
  isActiveRef.current = keepAliveActivated;

  useEffect(() => {
    if (!isActiveRef.current) return;
    void fetchInitialData();
    void loadProfiles();
    void loadTypeCounts();
  }, [fetchInitialData, loadProfiles, loadTypeCounts]);

  const statusOptions = useMemo(() => {
    const backendOptions = statusList
      .filter((item) => [2, 3, 4, 5].includes(item.id))
      .map((status) => {
        const label =
          i18n.resolvedLanguage === "ar"
            ? status.nameAr || status.nameEn
            : status.nameEn || status.nameAr;

        return {
          label: label || `Status ${status.id}`,
          value: String(status.id),
        };
      });

    return [
      {
        label: t("Profile.filters.allStatuses"),
        value: ALL_STATUSES_FALLBACK_VALUE,
      },
      ...backendOptions,
    ];
  }, [i18n.language, statusList, t]);

  const userTypeOptions = useMemo(() => {
    const isAllUserTypes = (type: UserManagementValueObject) =>
      type.code?.trim().toLowerCase() === "all" ||
      type.nameEn?.trim().toLowerCase() === "all user types";

    const backendAllOption = userTypeList.find(isAllUserTypes);
    const backendOptions = userTypeList
      .filter((type) => !isAllUserTypes(type))
      .map((type) => {
        const label =
          i18n.resolvedLanguage === "ar"
            ? type.nameAr || type.nameEn
            : type.nameEn || type.nameAr;

        return {
          label: label || `Type ${type.id}`,
          value: String(type.id),
        };
      });

    const allLabel = backendAllOption
      ? i18n.resolvedLanguage === "ar"
        ? backendAllOption.nameAr || backendAllOption.nameEn
        : backendAllOption.nameEn || backendAllOption.nameAr
      : t("Profile.filters.allUserTypes");

    return [
      {
        label: allLabel || t("Profile.filters.allUserTypes"),
        value: ALL_USER_TYPES_FALLBACK_VALUE,
      },
      ...backendOptions,
    ];
  }, [i18n.language, t, userTypeList]);

  const statsCards = useMemo<StatCard[]>(() => {
    const counts = typeCounts ?? {};

    return [
      {
        key: "total",
        label: t("Profile.stats.total"),
        value: counts.total ?? 0,
        icon: MenuIcon,
      },
      {
        key: "individual",
        label: t("Profile.stats.individual"),
        value: counts.individualCount ?? 0,
        icon: IndividualStatIcon,
      },
      {
        key: "commercial",
        label: t("Profile.stats.commercial"),
        value: counts.commercialCount ?? 0,
        icon: CommercialStatIcon,
      },
      {
        key: "freeZone",
        label: t("Profile.stats.freeZone"),
        value: counts.freeZoneCount ?? 0,
        icon: FreeZoneStatIcon,
      },
      {
        key: "talent",
        label: t("Profile.stats.talentAgency"),
        value: counts.talentAgencyCount ?? 0,
        icon: TalentStatIcon,
      },
      {
        key: "government",
        label: t("Profile.stats.government"),
        value: counts.governmentCount ?? 0,
        icon: GovernmentStatIcon,
      },
      {
        key: "embassy",
        label: t("Profile.stats.embassy"),
        value: counts.embassyCount ?? 0,
        icon: EmbassyStatIcon,
      },
      {
        key: "consulate",
        label: t("Profile.stats.consulate"),
        value: counts.consulateCount ?? 0,
        icon: EmbassyStatIcon,
      },
      {
        key: "cultural",
        label: t("Profile.stats.culturalClubs"),
        value: counts.culturalClubsCount ?? 0,
        icon: CulturalStatIcon,
      },
    ];
  }, [t, typeCounts]);

  const navigateToDetails = useCallback(
    (record: ApprovesResponseDto) => {
      const concatAppNo = record?.profileCode
        ? `&applicationNo=${record.profileCode}`
        : "";

      history.push({
        pathname: PROFILE_DETAILS_PATH,
        search: `?id=${record.id}&userTypeId=${record.userTypeId}${concatAppNo}`,
        state: {
          from: `${history.location.pathname}${history.location.search || ""}`,
        },
      });
    },
    [history],
  );

  const openApproveModal = useCallback((record: ApprovesResponseDto) => {
    setSelectedRecord(record);
    setApproveVisible(true);
  }, []);

  const openRejectModal = useCallback((record: ApprovesResponseDto) => {
    setSelectedRecord(record);
    setRejectVisible(true);
  }, []);

  const closeModals = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    setApproveVisible(false);
    setRejectVisible(false);
    setSelectedRecord(null);
  }, []);

  const handleApproveConfirm = useCallback(async () => {
    if (!selectedRecord || actionLoading) return;

    const requestId = latestActionRequestIdRef.current + 1;
    latestActionRequestIdRef.current = requestId;
    setActionLoading(true);

    try {
      await processUserProfile(selectedRecord.id, {
        statusId: APPROVE_STATUS_ID,
      });

      if (
        !isMountedRef.current ||
        !isActiveRef.current ||
        requestId !== latestActionRequestIdRef.current
      ) {
        return;
      }

      CustomMessage.success(t("Profile.messages.approveSuccess"));
      closeModals();
      await loadProfiles();
    } catch (error) {
      console.error("Failed to approve application", error);

      if (
        isMountedRef.current &&
        isActiveRef.current &&
        requestId === latestActionRequestIdRef.current
      ) {
        CustomMessage.error(t("Profile.messages.approveFailed"));
      }
    } finally {
      if (
        isMountedRef.current &&
        isActiveRef.current &&
        requestId === latestActionRequestIdRef.current
      ) {
        setActionLoading(false);
      }
    }
  }, [actionLoading, closeModals, loadProfiles, selectedRecord, t]);

  const handleRejectConfirm = useCallback(
    async (remarks: string) => {
      if (!selectedRecord || rejectLoading) return;

      const requestId = latestActionRequestIdRef.current + 1;
      latestActionRequestIdRef.current = requestId;
      setRejectLoading(true);

      try {
        await processUserProfile(selectedRecord.id, {
          statusId: REJECT_STATUS_ID,
          remark: remarks,
        });

        if (
          !isMountedRef.current ||
          !isActiveRef.current ||
          requestId !== latestActionRequestIdRef.current
        ) {
          return;
        }

        CustomMessage.success(t("Profile.messages.rejectSuccess"));
        closeModals();
        await loadProfiles();
      } catch (error) {
        console.error("Failed to reject application", error);

        if (
          isMountedRef.current &&
          isActiveRef.current &&
          requestId === latestActionRequestIdRef.current
        ) {
          CustomMessage.error(t("Profile.messages.rejectFailed"));
        }
      } finally {
        if (
          isMountedRef.current &&
          isActiveRef.current &&
          requestId === latestActionRequestIdRef.current
        ) {
          setRejectLoading(false);
        }
      }
    },
    [closeModals, loadProfiles, rejectLoading, selectedRecord, t],
  );

  const profileActionColumnWidth = useResponsiveActionColumnWidth<
    ApprovesResponseDto,
    ProfileActionColumnKey
  >({
    rows: profiles,
    buttonWidthMap: PROFILE_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) =>
      record.statusId === 2 ? ["approve", "reject"] : [],
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "approve":
          return t("Profile.actions.approve");
        case "reject":
          return t("Profile.actions.reject");
        default:
          return undefined;
      }
    },
    desktopConfig: PROFILE_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: PROFILE_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: PROFILE_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const columns = useMemo<ColumnsType<ApprovesResponseDto>>(
    () => [
      {
        title: t("Profile.table.applicationNo"),
        dataIndex: "profileCode",
        key: "profileCode",
        width: 200,
        fixed: "left",
      },
      {
        title: t("Profile.table.userType"),
        dataIndex: "userTypeObj",
        key: "userTypeObj",
        render: (userTypeObj) =>
          i18n.resolvedLanguage === "ar"
            ? userTypeObj?.nameAr || userTypeObj?.nameEn
            : userTypeObj?.nameEn || userTypeObj?.nameAr,
      },
      {
        title: t("Profile.table.applyFor"),
        dataIndex: "applyNameEn",
        key: "applyNameEn",
        width: 260,
        ellipsis: {
          showTitle: false,
        },
        render: (value: string, record) => (
          <div className="apply-for-cell">
            {renderApplyForTypeIcon(record)}
            <Tooltip
              title={value}
              color={"#fff"}
              overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
              placement="topLeft"
            >
              <span>{value}</span>
            </Tooltip>
          </div>
        ),
      },
      {
        title: t("Profile.table.sla"),
        dataIndex: "sla",
        key: "sla",
        width: 160,
        sorter: true,
        render: (sla: ApprovesResponseDto["sla"]) => {
          const displayText = getSlaDisplayText(sla?.displayText);

          return (
            <span className={sla?.isOverdue === true ? "profile-sla-overdue" : ""}>
              {displayText}
            </span>
          );
        },
      },
      {
        title: t("Profile.table.applicant"),
        dataIndex: "applicant",
        key: "applicant",
        render: (value: string) => <span>{value}</span>,
      },
      {
        title: t("Profile.table.status"),
        dataIndex: "statusObj",
        key: "statusObj",
        render: (statusObj) => {
          const displayName =
            i18n.resolvedLanguage === "ar"
              ? statusObj?.nameAr || statusObj?.nameEn
              : statusObj?.nameEn || statusObj?.nameAr;

          return (
            <span className={getStatusClassName(statusObj?.nameEn)}>
              {displayName}
            </span>
          );
        },
      },
      {
        title: t("Profile.table.lastUpdated"),
        dataIndex: "updateOn",
        key: "updateOn",
        render: (text?: string | null) => formatDateTime(text),
        sorter: true,
      },
      {
        title: t("Profile.table.actions"),
        key: "actions",
        dataIndex: "id",
        fixed: "right",
        width: profileActionColumnWidth,
        render: (_: unknown, record) =>
          record.statusId === 2 ? (
            <div className="table-actions">
              <CustomButton
                text={t("Profile.actions.approve")}
                variant="text"
                size="small"
                customStyle={{ padding: "0 8px", minWidth: "auto" }}
                disabled={actionLoading || rejectLoading}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  openApproveModal(record);
                }}
              />
              <CustomButton
                customClassName="reject-btn"
                text={t("Profile.actions.reject")}
                variant="text"
                size="small"
                customStyle={{ padding: "0 8px", minWidth: "auto" }}
                disabled={actionLoading || rejectLoading}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  openRejectModal(record);
                }}
              />
            </div>
          ) : ('-'),
      },
    ],
    [
      actionLoading,
      i18n.language,
      openApproveModal,
      openRejectModal,
      profileActionColumnWidth,
      rejectLoading,
      t,
    ],
  );

  const handleFilterTableRequest = useCallback(async () => {
    pageInfoRef.current = {
      ...pageInfoRef.current,
      pageIndex: 1,
    };

    setPageInfo({
      pageIndex: 1,
    });

    await loadProfiles({
      PageIndex: 1,
      PageSize: pageInfo.pageSize,
    });
  }, [loadProfiles, pageInfo.pageSize, setPageInfo]);

  const handleTableChange = useCallback(
    async (pagination, _filters, sorter) => {
      const currentSorter = sorter as SorterResult<ApprovesResponseDto>;
      const nextPageIndex = pagination.current ?? pageInfo.pageIndex;
      const nextPageSize = pagination.pageSize ?? pageInfo.pageSize;
      let nextSortRule = sortRule;

      if (currentSorter.field) {
        const field = currentSorter.field as keyof ApprovesResponseDto;
        const mappedField = Reflect.has(DtoAdapter, field)
          ? DtoAdapter[field]
          : (field as string);

        nextSortRule = currentSorter.order
          ? {
              sortOrder: Sorter[currentSorter.order as keyof TSorter],
              sortField: mappedField || DefaultSortRule.sortField,
            }
          : DefaultSortRule;

        sortRuleRef.current = nextSortRule;
        setSortRule(nextSortRule);
      }

      pageInfoRef.current = {
        ...pageInfoRef.current,
        pageIndex: nextPageIndex,
        pageSize: nextPageSize,
      };

      setPageInfo({
        pageIndex: nextPageIndex,
        pageSize: nextPageSize,
      });

      await loadProfiles({
        PageIndex: nextPageIndex,
        PageSize: nextPageSize,
        SortBy: nextSortRule.sortField,
        SortDirection: nextSortRule.sortOrder,
      });
    },
    [loadProfiles, pageInfo.pageIndex, pageInfo.pageSize, setPageInfo, sortRule],
  );

  const tableConfigs = useMemo<TableProps<ApprovesResponseDto>>(
    () => ({
      className: "profile-table",
      columns,
      dataSource: profiles,
      rowKey: "id",
      /* Default no-data illustration per the Figma annotation (box + "No data"). */
      locale: { emptyText: <EmptyBox /> },
      scroll: {
        x: PROFILE_ACTION_COLUMN_BASE_SCROLL_X + profileActionColumnWidth,
      },
      onRow: (record) => ({
        onClick: () => {
          navigateToDetails(record);
        },
      }),
      onChange: handleTableChange,
      pagination: {
        position: ["bottomCenter"],
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50", "100"],
        current: pageInfo.pageIndex,
        pageSize: pageInfo.pageSize,
        total: pageInfo.total,
        showTotal: (total) => (
          <PaginationTotal
            label={t("Profile.stats.total")}
            total={total}
            current={pageInfo.pageIndex}
            pageSize={pageInfo.pageSize}
          />
        ),
      },
    }),
    [
      columns,
      handleTableChange,
      navigateToDetails,
      pageInfo.pageIndex,
      pageInfo.pageSize,
      pageInfo.total,
      profileActionColumnWidth,
      profiles,
      t,
    ],
  );

  const tableFilterConfigs = useMemo(
    () => [
      {
        label: t("Profile.filters.searchPlaceholder"),
        requestDebounceMs: 300,
        element: (
          <Input
            key="input-search"
            placeholder={t("Profile.filters.searchPlaceholder")}
            prefix={<Sousuo className="search-icon" />}
            className="search-input"
            allowClear
          />
        ),
      },
      {
        label: t("Profile.table.status"),
        element: (
          <Select
            key="select-status"
            className="filters-select"
            placeholder={t("Profile.filters.allStatuses")}
            allowClear
            options={statusOptions}
          />
        ),
      },
      {
        label: t("Profile.table.userType"),
        element: (
          <Select
            key="select-userType"
            className="filters-select profile-filter-table__user-type-select"
            placeholder={t("Profile.filters.allUserTypes")}
            allowClear
            mode="multiple"
            showArrow
            showSearch={false}
            getPopupContainer={() => document.body}
            maxTagCount={0}
            maxTagPlaceholder={(selectedValues) => (
              <span className="profile-filter-table__user-type-summary">
                <span className="profile-filter-table__user-type-summary-label">
                  {selectedValues[0]?.label}
                </span>
                {selectedValues.length > 1
                  ? (
                      <span className="profile-filter-table__user-type-summary-count">
                        + {selectedValues.length - 1}
                      </span>
                    )
                  : null}
              </span>
            )}
            onChange={(values: string[]) => {
              if (
                values.length <= 1 ||
                !values.includes(ALL_USER_TYPES_FALLBACK_VALUE)
              ) {
                return;
              }

              const normalizedValues =
                values[values.length - 1] === ALL_USER_TYPES_FALLBACK_VALUE
                  ? [ALL_USER_TYPES_FALLBACK_VALUE]
                  : values.filter(
                      (value) => value !== ALL_USER_TYPES_FALLBACK_VALUE,
                    );

              values.splice(0, values.length, ...normalizedValues);
            }}
            options={userTypeOptions}
          />
        ),
      },
      {
        label: t("Profile.filters.lastUpdated"),
        element: (
          <RangePicker
            key="range-submissionTime"
            className="date-range-picker"
            placeholder={[
              t("Profile.filters.startTime"),
              t("Profile.filters.endTime"),
            ]}
            allowClear
          />
        ),
      },
    ],
    [statusOptions, t, userTypeOptions],
  );

  const handleExport = useCallback(async () => {
    if (exportLoading || !profiles.length || pageInfo.total === 0) {
      return;
    }

    setExportLoading(true);

    try {
      await getUserProfileExport(
        buildExportQueryParams(),
        `Profile_Verification_${moment().format("DDMMYYYY_HHmmss")}.csv`,
        serializeUserProfilesQueryParams,
      );
    } catch (error) {
      console.error("Failed to export profile verification list", error);

      if (isMountedRef.current) {
        CustomMessage.error(t("common.downloadFailed"));
      }
    } finally {
      if (isMountedRef.current) {
        setExportLoading(false);
      }
    }
  }, [buildExportQueryParams, exportLoading, pageInfo.total, profiles.length, t]);

  return (
    <div className="profile-container">
      <div className="stat-cards-grid">
        {statsCards.map((card) => (
          <Card key={card.key} className="stat-card" bordered={false}>
            <div className="stat-icon">
              <img src={card.icon} alt="" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="table-card" bordered={false}>
        <FilterTable
          {...tableConfigs}
          responsiveToolbar
          loading={loading}
          filterStore={filterStore}
          tableFilters={tableFilterConfigs}
          request={handleFilterTableRequest}
          containerCls="profile-filter-table"
          extraBtn={
            <CustomButton
              text={t("Profile.export")}
              variant="outline"
              disabled={!profiles.length || pageInfo.total === 0}
              loading={exportLoading}
              permissionCode="Licensing.Profile.Export"
              permissionRoutePath="/licensing/profile"
              onClick={handleExport}
            />
          }
        />
      </Card>

      <ConfirmModal
        visible={approveVisible}
        type="success"
        title={t("Profile.approveModal.title")}
        content={t("Profile.approveModal.content")}
        cancelText={t("Profile.approveModal.cancel")}
        confirmText={t("Profile.approveModal.confirm")}
        onCancel={closeModals}
        onConfirm={handleApproveConfirm}
        loading={actionLoading}
      />

      <RejectModal
        quickNotes={selectedRecord?.userTypeId === 1 ? individualQuickNotes : otherQuickNotes}
        visible={rejectVisible}
        initialRemarks=""
        placeholder={t("sharedComponents.rejectModal.placeholder")}
        onCancel={closeModals}
        onConfirm={handleRejectConfirm}
        loading={rejectLoading}
      />
    </div>
  );
};

export default ProfilePage;
